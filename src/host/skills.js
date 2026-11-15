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
 * 形态
 * ----
 * `ctx.skills.registerProvider()` —— 一个进程内的惰性 provider：
 *   list() 给出摘要（不读正文，避免每次都会话把 8 份 SKILL.md 全读一遍）
 *   get()  才把正文读出来
 * 注册进的是**全局层**（插件上下文不属任何 agent preset），所以任何会话里
 * 的 agent 都能按名字取到这些技能。
 */
import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
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
 * @returns {(() => void)|undefined} 注销器；宿主没有 skills 服务时返回 undefined
 */
export function registerDeskSkills(ctx) {
  const skills = ctx?.get?.('skills')
  if (skills === undefined || skills === null || typeof skills.registerProvider !== 'function') return undefined
  if (!existsSync(SKILL_DIR)) return undefined
  return skills.registerProvider(() => ({
    name: PROVIDER_NAME,
    async list() {
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
    async get(candidate) {
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
        description: typeof fields.description === 'string' ? fields.description : candidate.description,
        content: body,
        metadata: { skillDir: typeof locator.name === 'string' ? locator.name : undefined },
      }
    },
  }))
}
