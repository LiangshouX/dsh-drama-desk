#!/usr/bin/env node
/**
 * 客户端冒烟测试：**真的把 client.js 跑起来渲染一次**。
 *
 * 为什么需要这一步
 * ----------------
 * `client.js` 是五千多行的浏览器 bundle，它只在 DSH 的浏览器里跑。
 * 在那之前，它**一行都没被执行过**——而它恰恰是最容易出错的一半：
 *
 *   · 变量名写错 → 用户看到空白面板（不是报错，是「没反应」）
 *   · hook 用错 → React 抛异常，面整个挂掉
 *   · JSX 结构写错 → 渲染直接失败
 *
 * 这些错误在 `node --check` 里全都查不出来（它只查语法）。所以这里用
 * **真的 React + 真的 SSR 渲染**跑一遍：
 *
 *   1. 桩一个 `window.__ModuleLoader__`，把 client bundle 抓出来；
 *   2. 桩一个 cordis ctx，把 `main` 槽里注册的组件截下来；
 *   3. 用 `react-dom/server` 渲染成 HTML；
 *   4. 断言关键结构真的出现在输出里。
 *
 * SSR 不执行 `useEffect`，所以这一轮不会碰 fetch、轮询、IntersectionObserver
 * ——但**首屏结构、变量作用域、hook 调用顺序**全部会暴露。
 *
 * React 只在开发时需要。装不上就跳过（不阻塞构建）。
 *
 *   node scripts/client-smoke.mjs
 */

import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CLIENT = join(ROOT, 'client.js')

/** Load react + react-dom/server, or return undefined when unavailable. */
async function loadReact() {
  try {
    const React = await import('react')
    const server = await import('react-dom/server')
    return { React, server }
  } catch {
    return undefined
  }
}

/**
 * Run the client bundle in a sandbox with a stubbed window, and capture
 * the component it registers into the `main` slot.
 */
async function captureComponent(React) {
  let main = undefined
  const slotRegister = (spec, component) => {
    // 插件会注册两个槽：`main`（面板本体）与 `sidebar.panellist`（侧栏图标）。
    // 这里只留 main——侧栏那个是图标，不是要渲染的东西。
    if (spec?.name === 'main') main = { spec, component }
    return () => {}
  }
  const slotInject = (name, factory) => {
    const disposer = factory()
    return () => { if (typeof disposer === 'function') disposer() }
  }
  const ctx = {
    effect: () => () => {},
    locale: {
      register: () => () => {},
      // 返回 undefined ⇒ 插件回落到它自带的文案（中文默认）。
      // 若这里返回 key，界面上的字就全变成 key 了，断言也就没意义。
      bind: () => () => undefined,
    },
    slots: { register: slotRegister, inject: slotInject },
  }

  // The bundle is a classic script that assigns to `window.__ModuleLoader__`.
  const source = await readFile(CLIENT, 'utf8')
  const windowStub = {
    __ModuleLoader__: {
      load(definition) {
        const factory = definition.factory
        const module = factory((name) => {
          if (name === 'react') return React
          throw new Error(`client-smoke: 未预期的模块 ${name}`)
        })
        module.apply(ctx)
      },
    },
  }
  const sandbox = {
    window: windowStub,
    document: undefined,
    console,
    // 浏览器里有的那几个全局。缺了 `URL` 的话，资产视图里的
    // `assetImageUrl()` 会在渲染时炸掉——那正是这个冒烟测试要抓的东西。
    URL,
    location: { origin: 'http://127.0.0.1:13144' },
    // **自检标志**：只有这里会设，于是 bundle 里那两行「自检出口」在生产环境
    // 什么都不做（详见 src/client/90-panel.js 的注释）。
    __DRAMA_DESK_SELF_CHECK__: true,
  }
  runInNewContext(source, sandbox, { filename: 'client.js' })
  return { main, internals: sandbox.__DRAMA_DESK_INTERNALS__ }
}

/** Render one component to static HTML. */
function render(server, React, component, props) {
  return server.renderToStaticMarkup(React.createElement(component, props))
}

async function main() {
  const react = await loadReact()
  if (react === undefined) {
    console.log('· 跳过：没装 react / react-dom（开发期装一下就能跑这个检查）')
    return
  }
  const { React, server } = react

  const { main: captured, internals } = await captureComponent(React)
  if (captured === undefined) {
    throw new Error('client.js 没有向 main 槽注册组件')
  }
  if (captured.spec.key !== 'drama-desk') {
    throw new Error(`main 槽的 key 不对：${String(captured.spec.key)}`)
  }
  if (typeof captured.component !== 'function') {
    throw new Error('main 槽注册的不是组件')
  }

  const html = render(server, React, captured.component, {})

  // 首屏必须有的东西。
  const expectations = [
    ['面板标题', '导演工作台'],
    ['副标题', 'AI 短剧生产线'],
    ['首页', '首页'],
    ['工作台', '工作台'],
    ['规范', '规范'],
    ['资产', '资产'],
    ['台账', '台账'],
  ]
  for (const [name, needle] of expectations) {
    if (!html.includes(needle)) {
      throw new Error(`渲染结果里没有${name}（找的是「${needle}」）`)
    }
  }

  // ── 组件级渲染：那些需要特定数据的分支 ──────────────────────────────
  //
  // 根组件的 SSR 够不到「台账有数据」「资产有数据」这些分支——而**恰恰是
  // 那些分支里藏着最容易崩的东西**（少一个 hook、读了一个 null 字段）。
  // 崩了的表现是「整个面板一片空白」，不是报错。
  if (internals === undefined) throw new Error('自检出口没挂上：bundle 的自检标志没生效')
  const { LedgerView, AssetsView, Editable } = internals

  // **两个状态都要渲染**：有数据的「台账」与**没数据的「台账」**。
  // 出事那天的写法（早退排在 hook 之前）只有在「数据还没到」的那一次渲染里
  // 才会读到一个 null 字段——只渲染有数据的那一份，**抓不到**。
  const ledgerLoadingHtml = render(server, React, LedgerView, { ledger: null, onGoto: () => {} })
  if (!ledgerLoadingHtml.includes('正在读取台账')) {
    throw new Error('台账视图在「数据还没到」时没有走早退分支')
  }

  const ledgerHtml = render(server, React, LedgerView, {
    ledger: {
      totals: { tasks: 2, costUsd: 1.5, succeeded: 2 },
      budget: { limit_usd: 10, spent_usd: 1.5 },
      entries: [
        { taskId: 't1', shotId: 'SC01-SH01', model: 'm', duration: 5, costUsd: 0.5, status: 'succeeded', submittedAt: '2026-11-20T00:00:00Z' },
        { taskId: 't2', shotId: 'SC01-SH02', model: 'm', duration: 6, costUsd: 1.0, status: 'failed', submittedAt: '2026-11-20T00:01:00Z' },
      ],
    },
    onGoto: () => {},
  })
  if (!ledgerHtml.includes('SC01-SH01')) throw new Error('台账视图没有渲染出镜头号')
  if (!ledgerHtml.includes('预算')) throw new Error('台账视图没有渲染出预算')

  const assetsHtml = render(server, React, AssetsView, {
    assets: {
      totals: { count: 2, bytes: 1024, deprecated: 0, missing: 0 },
      assets: [
        { id: 'a1', type: 'reference_image', path: 'refs/a.png', status: 'active', bytes: 512, width: 100, height: 200, referencedBy: ['SC01-SH01'] },
        { id: 'a2', type: 'prompt', path: 'prompts/a.md', status: 'active', bytes: 512, referencedBy: [] },
      ],
    },
    workspaceId: 'w',
    onOpenImage: () => {},
    onGoto: () => {},
  })
  if (!assetsHtml.includes('参考图')) throw new Error('资产视图没有渲染出类型分类')
  if (!assetsHtml.includes('SC01-SH01')) throw new Error('资产视图没有渲染出交叉引用')

  const editableHtml = render(server, React, Editable, {
    label: '字段',
    value: '# 标题\n\n一段 **粗体**。',
    multiline: true,
    markdown: true,
    onSave: () => {},
  })
  if (!editableHtml.includes('md-root')) throw new Error('文本字段没有按 markdown 渲染')

  const stageProps = { busy: false, actions: {}, workspaceId: 'w', onOpenShot: () => {}, onGoto: () => {} }
  const stageCases = [
    ['OutlineView', { scenes: [] }, '新增场次'],
    ['CharactersView', { characters: [], props: [] }, '新增角色'],
    ['StoryboardView', { shots: [], scenes: [{ id: 'SC01', title: '测试' }] }, '创建镜头'],
    ['VerifyView', { shots: [{ id: 'SC01-SH01', currentVersion: 1, videoAssetId: 'v1' }] }, '确认本镜验收通过'],
    ['AssembleView', { shots: [], ready: false, gaps: ['缺素材'] }, '导出本地粗剪'],
    ['AssembleView', { shots: [], ready: true, job: { status: 'running', total: 2, completed: 1, message: '正在处理' } }, 'progress'],
    ['DeliverView', { finals: [], ready: false }, '前往装配'],
    ['DeliverView', { finals: [{ assetId: 'cut', path: 'finals/cut.mp4', exists: true }], ready: true }, '确认这一版交付'],
  ]
  for (const [name, data, expected] of stageCases) {
    const markup = render(server, React, internals[name], { ...stageProps, data })
    if (!markup.includes(expected)) throw new Error(`${name} 缺少 ${expected}`)
  }

  console.log(`✓ 客户端冒烟测试通过：首屏 ${html.length} 字符 + 台账/资产/文本字段 + 8 个制作阶段分支`)
}

main().catch(error => {
  console.error(`\n✗ 客户端冒烟测试失败：${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
