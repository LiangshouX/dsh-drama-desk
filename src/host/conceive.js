/**
 * 「构思会话」——把第一阶段的 Skill 交给一个**真实 DSH 会话**。
 *
 * 设计选择（重要）
 * ----------------
 * DSH 的规范里写得很清楚：插件不许把宿主的 Client 包当模块加载，也不许自己
 * 折叠会话事件去画一个仿聊天界面（见 dsh-doc 的 `practices.md`）。所以这里
 * **不自己仿造聊天**，而是开一个真的 agent 会话：
 *
 *   · 真模型、真工具、真技能（`drama-conceive` 由 `skills.js` 提供）
 *   · **会话挂在 DSH 的工作区下**（见下），不是只有一个 cwd 的孤儿会话
 *   · 会话 id 记在 `state.json` 的 `desk_session_id` 上，所以关掉 DSH、
 *     换一台机器、隔天回来，还是同一段构思对话
 *
 * 工作区纪律（2026-11-16 修）
 * --------------------------
 * 一开始只给了 `meta.cwd`，会话就成了一段**没有工作区**的对话：
 * 侧栏里找不到它，工作区的会话列表里也没有它，用户只能从工作台的小窗看。
 * 现在的规则是：**任何一次开会话之前，先确保「短剧项目根」是一个 DSH 工作区**，
 * 会话的 cwd 就等于工作区路径。这样它和用户在侧栏里自己开的会话没有区别。
 *
 * 客户端只负责「显示状态 + 发一条消息」，聊天界面复用宿主自己的。
 */
import { randomUUID } from 'node:crypto'
import { join, relative } from 'node:path'
import { readJsonIfExists, writeJsonAtomic } from './fsx.js'

/** `state.json` 里记住构思会话 id 的字段。 */
export const SESSION_FIELD = 'desk_session_id'

/**
 * 一条新会话的开场白。
 *
 * 短是刻意的：这段话会出现在小窗的对话流里，导演看的是 AI 的回答，
 * 不是自己那一段长指令。技能怎么用写在技能里，不必在这儿复述。
 *
 * 路径用**相对工作区根**的写法：会话的 cwd 是短剧项目根，不是作品目录。
 */
export function seedMessage(workspace, projectRoot) {
  const name = workspace.title !== undefined && workspace.title !== '' ? workspace.title : workspace.id
  const workPath = typeof projectRoot === 'string' && projectRoot !== ''
    ? relative(projectRoot, workspace.dir).split('\\').join('/')
    : workspace.dir
  return [
    `用 \`drama-conceive\` 技能开始「${name}」的构思。`,
    `这个作品在 \`${workPath}/\`（简报写进 \`${workPath}/creative/brief.md\`）。`,
    `先问我三到五个真正影响故事的问题，聊清楚之后写进简报，再告诉我你写了什么。`,
  ].join('\n\n')
}

/**
 * 这段会话用哪个模型。
 *
 * `agents.create()` 不接受「没有模型」——它会直接拒：
 * `AgentOptions.provider and AgentOptions.model or record a model selection`。
 * 所以这里把宿主的**默认模型选择**显式带上：构思会话就该用你在 DSH 里
 * 选定的那个模型，而不是插件自己发明一个。
 *
 * @returns {{provider: string, model: string, reasoningEffort?: string}|undefined}
 */
function modelFor(service) {
  const host = service.ctx?.get?.('agentDefaultModel')
  try {
    const selection = host?.currentSelection?.()
    if (selection === undefined || selection === null) return undefined
    if (typeof selection.provider !== 'string' || typeof selection.model !== 'string') return undefined
    const out = { provider: selection.provider, model: selection.model }
    if (typeof selection.reasoningEffort === 'string' && selection.reasoningEffort !== '') {
      out.reasoningEffort = selection.reasoningEffort
    }
    return out
  } catch {
    return undefined
  }
}

/** 这个作品当前的构思会话状态（不创建）。 */export async function deskSessionState(service, workspace) {
  const state = await readJsonIfExists(join(workspace.dir, 'state.json'))
  const sessionId = typeof state?.[SESSION_FIELD] === 'string' ? state[SESSION_FIELD] : undefined
  if (sessionId === undefined) return { sessionId: undefined, live: false, cwd: workspace.dir }
  const agents = service.ctx?.get?.('agents')
  const live = agents !== undefined && typeof agents.get === 'function' ? agents.get(sessionId) !== undefined : false
  return { sessionId, live, cwd: workspace.dir }}

/**
 * 拿到（或开设）这个作品的构思会话，并保证它是**活的**——
 * 只有活着的 agent 才能接消息。
 *
 * @param {object} service
 * @param {{id: string, dir: string, title?: string}} workspace
 * @returns {Promise<{sessionId: string, live: boolean, created: boolean, cwd: string}>}
 */
/**
 * 保证「短剧项目根」在宿主的**工作区注册表**里。
 *
 * 会话必须有归处：只给 `meta.cwd` 而工作区不存在时，这段对话在侧栏里
 * 找不到、在所属工作区的会话列表里也没有——用户只能从工作台的小窗看它。
 * 所以每次开会话之前先走这一步，**新开与恢复都走同一条路**。
 *
 * @returns {Promise<{id?: string, path: string, title?: string}|undefined>}
 */
async function ensureDshWorkspace(service, projectRoot, title) {
  const registry = service.ctx?.get?.('workspaceRegistry')
  if (registry === undefined || registry === null) return undefined
  const lookup = async () => {
    if (typeof registry.resolveByPath !== 'function') return undefined
    try {
      const found = await registry.resolveByPath(projectRoot)
      return found === null ? undefined : found
    } catch {
      return undefined
    }
  }
  const existing = await lookup()
  if (existing !== undefined) return existing
  try {
    if (typeof registry.create === 'function') return await registry.create(projectRoot, title)
  } catch {
    // 并发创建会抛「已存在」：再查一次就拿到了。
  }
  return await lookup()
}

/**
 * 拿到（或开设）这个作品的构思会话，并保证它是**活的**——
 * 只有活着的 agent 才能接消息。
 *
 * @param {object} service
 * @param {{id: string, dir: string, title?: string}} workspace
 * @returns {Promise<{sessionId: string, live: boolean, created: boolean, cwd: string, workspacePath: string}>}
 */
export async function ensureDeskSession(service, workspace) {
  const agents = service.ctx?.get?.('agents')
  if (agents === undefined || typeof agents.create !== 'function') {
    throw new Error('这个宿主没有 agents 服务：开设不了构思会话（需要用 DSH 桌面版或 dsh web）')
  }
  if (service.deskAgents === undefined) service.deskAgents = new Map()

  // **工作区先行**：会话必须挂在一个 DSH 工作区下，否则它是一段没有归处的对话。
  const locations = await service.locations()
  const projectRoot = locations.project.path
  const title = projectRoot.split(/[\\/]/).filter(Boolean).pop()
  const dshWorkspace = await ensureDshWorkspace(service, projectRoot, title)
  if (dshWorkspace === undefined) {
    throw new Error(
      `DSH 不接受 ${projectRoot} 作为工作区（workspaceRegistry 没有响应）：`
      + '先在侧栏把这个目录加成一个工作区，再开构思会话',
    )
  }
  const cwd = typeof dshWorkspace.path === 'string' && dshWorkspace.path !== '' ? dshWorkspace.path : projectRoot

  const state = (await readJsonIfExists(join(workspace.dir, 'state.json'))) ?? {}
  const remembered = typeof state[SESSION_FIELD] === 'string' ? state[SESSION_FIELD] : undefined

  // ① 已经活着 → 直接用
  if (remembered !== undefined) {
    const live = agents.get(remembered)
    if (live !== undefined) {
      return { sessionId: remembered, live: true, created: false, cwd, workspacePath: projectRoot }
    }
    // ② 磁盘上有这段会话 → 恢复它（换机器/重启后仍然是同一段对话）
    if (typeof agents.resume === 'function') {
      try {
        const resumeOptions = { resumeSessionId: remembered }
        const rememberedModel = modelFor(service)
        if (rememberedModel !== undefined) resumeOptions.agentOptions = rememberedModel
        const handle = await agents.resume(resumeOptions)
        service.deskAgents.set(remembered, handle)
        return { sessionId: remembered, live: true, created: false, cwd, workspacePath: projectRoot }
      } catch {
        // 会话可能被删了或被归档了：往下走，开一段新的。
      }
    }
  }

  // ③ 开一段新的
  // `agents.create()` 不接受「没有模型」——它直接拒：
  //   AgentOptions.provider and AgentOptions.model or record a model selection
  // 所以把宿主的默认模型选择显式带上：构思会话用你在 DSH 里选定的那个模型。
  const agentOptions = modelFor(service)
  if (agentOptions === undefined) {
    throw new Error('宿主的默认模型还没选定（agentDefaultModel 没有返回 provider/model）：先在 DSH 里选一个模型，再开构思会话')
  }
  const sessionId = randomUUID()
  const handle = await agents.create({
    sessionId,
    // cwd = **工作区路径**：会话出现在这个工作区下，和用户自己开的会话没有区别。
    meta: { cwd },
    agentOptions,
  })
  service.deskAgents.set(sessionId, handle)
  await writeJsonAtomic(join(workspace.dir, 'state.json'), {
    ...state,
    [SESSION_FIELD]: sessionId,
    updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  })
  service.invalidateWork(workspace.dir)
  return { sessionId, live: true, created: true, cwd, workspacePath: projectRoot }
}

/** 插件卸载时把这次会话的 agent 收掉（会话本身留在磁盘上）。 */
export async function disposeDeskAgents(service) {
  const map = service.deskAgents
  if (map === undefined) return
  service.deskAgents = new Map()
  for (const handle of map.values()) {
    try {
      await handle.dispose()
    } catch {
      // 收不掉就算了：会话已落盘，下次 resume 即可。
    }
  }
}
