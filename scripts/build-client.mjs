#!/usr/bin/env node
/**
 * 客户端 bundle 的拼装器。
 *
 *   node scripts/build-client.mjs           # src/client/* → client.js
 *   node scripts/build-client.mjs --check   # 只校验 client.js 是否与源码同步
 *
 * 为什么需要它
 * ------------
 * DSH 的客户端只加载**一个** `client.js`——浏览器里没有打包器，也没有相对
 * import 的解析。但 5000 行的单文件没法维护：改不动、并行不了、看不见边界。
 *
 * 所以源码搬到 `src/client/`，按功能分模块；`client.js` 是**产物**。
 * 拆分与单文件契约只能靠构建弥合：
 *
 *   src/client/00-header.js   设计语言与 bundle 格式说明（注释）
 *   src/client/10-prelude.js  React 取值与 hooks 解构
 *   src/client/2x-*.js        基础层：locale / 主题 / API / 常量
 *   src/client/3x-*.js        通用组件：图标 / markdown / 编辑 / 面板
 *   src/client/4x-*.js        阶段视图（九个阶段各一块）
 *   src/client/9x-*.js        面板装配与导出
 *
 * **拼装顺序由 `src/client/manifest.json` 显式声明**，不靠目录遍历的运气。
 *
 * 四条纪律（构建会拦）
 * --------------------
 *  1. 分段文件里**不许**出现 `window.__ModuleLoader__` 或第二次
 *     `require('react')`——它们只属于拼装器生成的壳。
 *  2. **所有分段的顶层名字必须全局唯一。** 拼进同一个函数作用域之后，
 *     同名就是覆盖，而覆盖会把「A 的函数被 B 悄悄换掉」变成静默 bug。
 *  3. 分段文件里**不许**出现 `import` / `export`——它们不是 ES 模块，
 *     是拼进同一作用域的片段。写了 `import` 只会让人以为它是独立模块。
 *  4. manifest 里列的文件必须都存在；顺序即依赖顺序。
 *
 * 与 `dsh-realtime-interview` 的 `scripts/build-client.mjs` 同一套做法。
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src', 'client')
const OUT = join(ROOT, 'client.js')

/** The generated file says so, loudly. */
const BANNER = [
  '/*!',
  ' * dsh-drama-desk — client half (browser bundle).',
  ' *',
  ' * ⚠ 这个文件是**生成物**：源码在 src/client/，由 scripts/build-client.mjs 拼装。',
  ' *   要改界面请改 src/client/*.js，改这里会在下一次构建时被覆盖。',
  ' *',
  ' * 设计语言与 bundle 格式的完整说明在 src/client/00-header.js。',
  ' */',
].join('\n')

/** The loader shell: the only place the module contract may appear. */
function shell(body) {
  return [
    BANNER,
    'window.__ModuleLoader__.load({',
    "  id: 'dsh-drama-desk',",
    '  factory: (require) => {',
    body,
    '  },',
    '})',
    '',
  ].join('\n')
}

/**
 * 收一个分段的顶层声明名。
 *
 * 只看**分段顶层**的声明（0–4 格缩进）——嵌套作用域里的同名变量是合法的，不算冲突。
 *
 * 缩进 0–4 而不是只认顶格：`src/client/*.js` 的每个分段都是**整体缩进 4 格**的片段
 * （它们要拼进同一个函数体）。以前这个正则只认 `^` 顶格，于是在客户端分段上
 * **一个名字都扫不到**，「顶层名字全局唯一」这道闸门等于不存在 —— 同名覆盖会变成
 * 静默 bug（后拼的覆盖先拼的，界面「莫名其妙少了个功能」）。6 格起才进入函数体。
 *
 * @param {string} text 分段正文
 * @returns {string[]}
 */
function declaredNames(text) {
  const names = []
  for (const line of text.split('\n')) {
    const match = /^\s{0,4}(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^\s{0,4}(?:const|let|var)\s+([A-Za-z_$][\w$]*)|^\s{0,4}(?:class)\s+([A-Za-z_$][\w$]*)/.exec(line)
    if (match === null) continue
    names.push(match[1] ?? match[2] ?? match[3])
  }
  return names
}

/**
 * **组件的早退必须在所有 hook 之后。**
 *
 * 为什么这条要变成一道闸门：组件第一次渲染时数据还没到（`if (!ledger) return …`），
 * 第二次渲染数据到了、于是多走了两个 `useMemo` —— React 直接报 #310
 * （「渲染的 hook 比上一次多」），**整个面板崩成空白**。
 * 症状是「界面上什么都没有」，不是报错，很容易被当成「没数据」而不是「代码错了」。
 *
 * 判据：组件体（函数体第一层，缩进 6 格）里的 `return` 出现在**最后一个 hook 调用之后**
 * 才是安全的；出现在之前就是 bug。
 *
 * @param {string} file 分段文件名
 * @param {string} text 分段正文
 * @returns {string[]} 问题清单
 */
function checkHookOrderStrict(file, text) {
  const HOOK = /\buse(State|Effect|Memo|Callback|Ref|LayoutEffect|InsertionEffect|ImperativeHandle|SyncExternalStore|Deferred|Transition)\s*\(/
  const lines = text.split('\n')
  const problems = []
  for (let i = 0; i < lines.length; i += 1) {
    const open = /^ {4}(?:function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/.exec(lines[i])
    if (open === null) continue
    const name = open[1] ?? open[2] ?? '?'
    let lastHook = -1
    let firstReturn = -1
    let returnText = ''
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j]
      // 组件体结束：遇到下一个顶格声明。
      if (/^ {4}\S/.test(line)) break
      // **组件体的第一层**：正好 6 格缩进。
      // 更深的缩进是嵌套回调（useMemo(() => { … return … })）——那不是组件的早退。
      if (!/^ {6}(?!\s)/.test(line)) continue
      const stripped = line.replace(/\/\/.*$/, '').trim()
      if (HOOK.test(line)) lastHook = j
      if (firstReturn === -1 && /\breturn\b/.test(stripped)) {
        firstReturn = j
        returnText = stripped.slice(0, 60)
      }
    }
    if (firstReturn !== -1 && lastHook !== -1 && firstReturn < lastHook) {
      problems.push(`${file}: ${name}() 在第 ${firstReturn + 1} 行早退（${returnText}），`
        + `但第 ${lastHook + 1} 行还有 hook —— React 会报 #310，整个面板崩成空白`)
    }
  }
  return problems
}

/**
 * Read the manifest and assemble the bundle text.
 *
 * @returns {Promise<string>}
 */
export async function assembleClient() {
  const manifestPath = join(SRC, 'manifest.json')
  if (!existsSync(manifestPath)) throw new Error(`src/client/manifest.json 不存在：${manifestPath}`)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const header = await readFile(join(SRC, manifest.header), 'utf8')

  const owner = new Map()
  const parts = []
  for (const name of manifest.parts) {
    const path = join(SRC, name)
    if (!existsSync(path)) throw new Error(`src/client/${name} 不存在（manifest 里列了它）`)
    const text = await readFile(path, 'utf8')
    if (text.includes('window.__ModuleLoader__')) {
      throw new Error(`src/client/${name} 里出现了 window.__ModuleLoader__：bundle 契约只属于构建壳。`)
    }
    if (name !== '10-prelude.js' && text.includes("require('react')")) {
      throw new Error(`src/client/${name} 里重复 require('react')：它只该出现在 10-prelude.js。`)
    }
    if (/^\s*(import|export)\s/m.test(text)) {
      throw new Error(`src/client/${name} 里出现了 import/export：分段不是 ES 模块，是拼进同一作用域的片段。`)
    }
    for (const declared of declaredNames(text)) {
      const previous = owner.get(declared)
      if (previous !== undefined) {
        throw new Error(`顶层名字 '${declared}' 在 ${previous} 与 ${name} 里重复：拼进同一作用域后会互相覆盖。`)
      }
      owner.set(declared, name)
    }
    // ⑤ 组件的早退必须在所有 hook 之后（React #310 → 整个面板崩成空白）。
    const hookProblems = checkHookOrderStrict(name, text)
    if (hookProblems.length > 0) {
      throw new Error(hookProblems.join('\n'))
    }
    parts.push(text.trimEnd())
  }
  return `${header.trimEnd()}\n${shell(parts.join('\n\n'))}`
}

/** Write client.js from the sources. */
export async function writeClient() {
  const text = await assembleClient()
  await writeFile(OUT, text, 'utf8')
  return text
}

/**
 * Whether client.js is out of date.
 *
 * @returns {Promise<boolean>}
 */
export async function clientOutOfDate() {
  let current = ''
  try {
    current = await readFile(OUT, 'utf8')
  } catch {
    return true
  }
  return current !== await assembleClient()
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (invokedDirectly) {
  const check = process.argv.includes('--check')
  if (check) {
    const stale = await clientOutOfDate()
    console.log(stale ? '✗ client.js 与 src/client/ 不同步：先跑 node scripts/build-client.mjs' : '✓ client.js 与 src/client/ 同步')
    if (stale) process.exit(1)
  } else {
    const text = await writeClient()
    console.log(`✓ 已拼装 client.js（${text.split('\n').length} 行）`)
  }
}
