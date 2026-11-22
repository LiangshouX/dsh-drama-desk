/**
 * 把插件自带的 Skill 注册进宿主的技能目录。
 *
 * 为什么需要这一步
 * ----------------
 * 插件包里一直躺着 `build/skills/*\/SKILL.md`（conceive / outline / characters /
 * script / storyboard / generate / imagecraft …），但**宿主从来没看见过它们**：
 * DSH 只扫 `<root>/.dsh/skills`、`<root>/.agents/skills` 这类目录，而
 * `package.json` 里没有 `bundledSkillDir`，`index.js` 也没有注册任何 provider。
 *
 * 结果是：`drama-conceive` 这些名字对任何 agent 都不可用——工作台也就没法
 * 「加载第一阶段的 Skill 和 AI 聊创意」。这个模块补上那一环。
 *
 * 作用域：**只在插件自己的工作区里生效**（这一版的核心）
 * ----------------------------------------------
 * 宿主的技能注册表是「全局层 + scope 层」结构：注册落入**调用方上下文的 scope**
 * 对应的层——插件挂在宿主层，于是 provider 落进**全局层**。
 * 全局层对**所有工作区的所有会话**可见，于是 `drama-conceive` 这些名字
 * 在跟短剧毫无关系的会话里也能被调到——那等于往别人的目录里塞方法论。
 *
 * 但这些 Skill 只描述**短剧流水线**，只在**短剧工作台自己的工作区**
 * （短剧项目总根，见 `AGENTS.md` §7）里有意义。
 *
 * 宿主为此留了正确的机制：`SkillProvider.list(options)` 与
 * `get(candidate, options)` 收到的 `options.cwd` 就是「这次查找属于哪个工作区」——
 * 「skill 查找对 cwd 敏感，因为提供方可能暴露工作区本地的 skill」。
 * 所以本 provider **只在 `cwd` 落在短剧项目总根之内时**贡献候选项；
 * 其他工作区一律返回空目录——是「这里没有短剧 Skill」，不是「发现失败」
 * （`complete: true`），所以注册表不会把目录标成不完整、也不会反复重试。
 *
 * 于是：注册仍在全局层（插件就挂在宿主层），但**可见性由 cwd 决定**。
 * 插件工作的工作区里 `drama-conceive` 照旧可用，别的会话里看不到。
 */
import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { SKILL_DIR } from './paths.js'

/** 本 provider 的名字（出现在技能摘要的 `provider` 字段里）。 */
export const PROVIDER_NAME = 'dsh-drama-desk'

/**
 * 拆出 `--- ... ---` 之间的 frontmatter。
 *
 * 只认 `key: value` 单行值——SKILL.md 的 frontmatter 就是这么写的，
 * 也正好是 `scripts/build.mjs` 校验的那一份，所以这里不引入 YAML 依赖。
 *
 * @param {string} text
 * @returns {{fields: Record<string, string>, body: string}}
 */
export function splitFrontmatter(text) {
  const source = String(text ?? '')
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (match === null) return { fields: {}, body: source }
  const fields = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line)
    if (pair === null) continue
    let value = pair[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    fields[pair[1]] = value
  }
  return { fields, body: source.slice(match[0].length) }
}

/**
 * `cwd` 是不是插件自己的工作区（短剧项目总根），或者在它里面。
 *
 * 只比路径：短剧项目总根是插件唯一的项目根（`AGENTS.md` §7），而在
 * `<root>/workspaces/<work-id>/` 下开的会话要和在总根上开的会话看到同样的 Skill。
 *
 * Windows 上路径不区分大小写，所以先折叠再比；否则 `D:\Code` 与 `d:\code`
 * 会被判成两个地方。
 *
 * @param {string|undefined} cwd 本次查找的工作目录
 * @param {string|undefined} root 短剧项目总根
 * @returns {boolean}
 */
export function isDeskScope(cwd, root) {
  if (typeof cwd !== 'string' || cwd.trim() === '') return false
  if (typeof root !== 'string' || root.trim() === '') return false
  const fold = value => (process.platform === 'win32' ? value.toLowerCase() : value)
  const rel = relative(fold(resolve(root)), fold(resolve(cwd)))
  if (rel === '') return true
  if (rel.startsWith('..')) return false
  return !isAbsolute(rel)
}

/**
 * 作用域闸门：短剧项目总根，**每个进程只解析一次**。
 *
 * 真源在 service（`locations.js` 负责解析，§3「规范只有一份」），provider 只负责问。
 * 解析结果按 **promise** 缓存：并发查找共用同一次解析，而不是各跑一次
 * （解析里有一次 Windows shell 探测，并发跑就是白费）。
 *
 * @param {object} service
 * @returns {{warm: () => void, allows: (options?: {cwd?: string}) => Promise<boolean>}}
 */
export function createScopeGate(service) {
  let rootPromise
  const root = () => {
    if (rootPromise === undefined) {
      rootPromise = Promise.resolve()
        .then(() => service?.projectRoot?.())
        .catch(() => undefined)
    }
    return rootPromise
  }
  return {
    /**
     * 后台预热解析。
     *
     * 不预热的话，第一次列目录要等一次 shell 探测才出结果——而列目录
     * 发生在每个会话的第一个模型步骤上。放后台跑，代价落在空闲时间里。
     */
    warm: () => { void root() },
    /**
     * 这次查找是不是发生在插件自己的工作区里。
     *
     * 拿不到 cwd（没有工作区的会话）或拿不到总根（解析失败）都判为「不是」——
     * 宁可少给，也不要把短剧 Skill 漏到别的工作区去。
     *
     * @param {{cwd?: string}|undefined} options
     * @returns {Promise<boolean>}
     */
    allows: async options => {
      const cwd = options?.cwd
      if (typeof cwd !== 'string' || cwd === '') return false
      const resolved = await root()
      return isDeskScope(cwd, resolved)
    },
  }
}

/**
 * 读一个技能目录，产出候选摘要。
 *
 * @param {string} name 目录名
 * @returns {Promise<object|undefined>}
 */
async function readSkill(name) {
  const dir = join(SKILL_DIR, name)
  const path = join(dir, 'SKILL.md')
  let text
  try {
    text = await readFile(path, 'utf8')
  } catch {
    return undefined
  }
  const { fields } = splitFrontmatter(text)
  return {
    name: typeof fields.name === 'string' && fields.name !== '' ? fields.name : name,
    description: typeof fields.description === 'string' ? fields.description : '',
    whenToUse: typeof fields.whenToUse === 'string' && fields.whenToUse !== '' ? fields.whenToUse : undefined,
    path,
    source: 'bundled',
    provider: PROVIDER_NAME,
    invocation: { modelInvocable: true, userInvocable: true },
    resourceBase: { kind: 'directory', path: dir },
    rank: 0,
    locator: { name, path },
  }
}

/**
 * 注册「随包技能」provider。
 *
 * @param {object} ctx 插件上下文
 * @param {object} service 插件 service——短剧项目总根的真源
 * @returns {(() => void)|undefined} 注销器；宿主没有 skills 服务时返回 undefined
 */
export function registerDeskSkills(ctx, service) {
  const skills = ctx?.get?.('skills')
  if (skills === undefined || skills === null || typeof skills.registerProvider !== 'function') return undefined
  if (!existsSync(SKILL_DIR)) return undefined

  const scope = createScopeGate(service)
  scope.warm()

  return skills.registerProvider(() => ({
    name: PROVIDER_NAME,
    async list(options = {}) {
      // 不是插件自己的工作区 → 这里没有短剧 Skill。
      // `complete: true` 是关键：空目录是**确定的事实**，不是「没发现完」。
      if (!await scope.allows(options)) return { candidates: [], complete: true }
      // 一层深度：`build/skills/<name>/SKILL.md`。DSH 的技能发现也是这么浅。
      let entries
      try {
        entries = await readdir(SKILL_DIR, { withFileTypes: true })
      } catch {
        return { candidates: [], complete: true }
      }
      const candidates = []
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const skill = await readSkill(entry.name)
        if (skill !== undefined) candidates.push(skill)
      }
      return { candidates, complete: true }
    },
    async get(candidate, options = {}) {
      // 加载也要过闸门：注册表会把候选项交给胜出的提供方去读正文，
      // 那里也带着 cwd——别让正文从别的目录漏出去。
      if (!await scope.allows(options)) return undefined
      const locator = candidate?.locator ?? {}
      const path = typeof locator.path === 'string' ? locator.path : undefined
      if (path === undefined) return undefined
      let text
      try {
        text = await readFile(path, 'utf8')
      } catch {
        return undefined
      }
      const { fields, body } = splitFrontmatter(text)
      return {
        ...candidate,
        name: typeof fields.name === 'string' && fields.name !== '' ? fields.name : candidate.name,
        description: typeof fields.description === 'string' && fields.description !== '' ? fields.description : candidate.description,
        content: body,
        metadata: { skillDir: typeof locator.name === 'string' ? locator.name : undefined },
      }
    },
  }))
}
