/**
 * 「构思会话」——把第一阶段的 Skill 交给一个**真实 DSH 会话**。
 *
 * 会话是真 agent：真模型、真工具、真技能（`drama-conceive` 由 `skills.js` 提供），
 * 界面是**宿主自己的对话装配**（见 `src/client/70-chat.js` 顶部的说明）——
 * 插件既不仿造聊天，也不再自己算「处理过程」。
 *
 * 工作区纪律（2026-11-22 修）
 * --------------------------
 * 只把 `meta.cwd` 设成工作区路径是**不够**的。DSH 的工作区有两个面：
 *
 *   · `path` —— 会话的 cwd 落在它下面（以前只做了这一半）
 *   · `sessionIds` —— 工作区**自己的会话账本**
 *
 * 漏了账本的表现正是用户报的那样：会话能在工作台小窗里聊，但侧栏
 * 「DSH-DRAMA-DESK」下面**没有它**，它掉进「未分组」。所以现在**新开与恢复
 * 之后都要 `attachSession()`**（见 `attachDeskSession`）。
 *
 * 上下文纪律（2026-11-22 修）
 * --------------------------
 * 「这次只谈 `workspaces/<id>/`」这段话以前是**塞进用户的第一条消息**里
 * （`<system-reminder>` 包着），靠客户端把它抹掉才不显得像人说的话。
 * 现在交给宿主的 **prompt context**：它作为 user-role 上下文进模型历史，
 * 宿主的对话面板会把它折成一行「上下文」——**不占用户的话**（见 `installSeed`）。
 */
import { randomUUID } from 'node:crypto'
import { join, relative } from 'node:path'
import { readJsonIfExists, writeJsonAtomic } from './fsx.js'

/** `state.json` 里记住构思会话 id 的字段。 */
export const SESSION_FIELD = 'desk_session_id'

/** 这段会话的上下文在宿主 prompt registry 里的名字（重复注册会抛，重装即去重）。 */
export const SEED_CONTEXT = 'drama-desk/project'

/**
 * 上下文在 prompt 里的顺序。
 *
 * sections 按 order 升序拼接；contexts 同理。这个值只需要落在
 * 「身份/规则」之后、「运行时上下文」之前——它是一段任务级的说明。
 */
const SEED_ORDER = 40

/**
 * 这段构思会话要带给模型的**上下文**。
 *
 *   一个工作台只有一个总根（`「视频」/DSH-DRAMA-DESK`），所有短剧项目都是它下面的
 *   子目录，共用同一个 DSH 工作区。共用一个工作区意味着 agent 能看见**别人的**
 *   项目——所以每一段构思对话都先把「这次只谈哪个项目」钉死，并明说
 *   不要动别的目录。这就是「防止串台」。
 *
 * 注意这里**不写 `@路径`**：那是用户消息里的文件引用语法，在 prompt context 里
 * 没有意义（也没有引用块可解析），写成普通路径更诚实。
 */
export function seedPrompt(workspace, projectRoot, options = {}) {
  const name = workspace.title !== undefined && workspace.title !== '' ? workspace.title : workspace.id
  const workPath = typeof projectRoot === 'string' && projectRoot !== ''
    ? relative(projectRoot, workspace.dir).split('\\').join('/')
    : workspace.dir
  const fresh = options.isNew === true
  return [
    `# 这次对话的范围`,
    '',
    `只谈一个短剧项目：\`${workPath}/\`（作品名「${name}」）。`,
    '',
    fresh
      ? `这是一个**刚建的新项目**，目录还是空的。用 \`drama-conceive\` 技能跟我一起把它的创意想出来。`
      : `用 \`drama-conceive\` 技能继续「${name}」的构思。`,
    `先问我三到五个真正影响故事的问题；聊清楚之后把创意写进 \`${workPath}/creative/brief.md\`，再告诉我你写了什么。`,
    '',
    `⚠️ 这个工作区里还有别的短剧项目：**只读写 \`${workPath}/\` 下的文件**，不要碰别的目录，也不要混用别的项目的角色与数据。`,
  ].join('\n')
}

/**
 * 把这段会话的上下文交给宿主的 **prompt registry**。
 *
 * 为什么不用「注入一条用户消息」：那会让导演看到满屏给模型看的说明
 * （宿主的折叠规则也不归我们管）。prompt 这边有两条正规通道，按优先级试：
 *
 *   ① `context()` —— **动态模型上下文**，落成一条 user-role 快照。
 *      宿主自己的对话面板会把它折成一行「上下文」，不占用户的话。
 *   ② `section()` —— 退一步进 system prompt：看不见但模型一定读得到。
 *
 * 注册在**这个 agent 自己的作用域**上（`agent.ctx`），所以只有这一段会话带着它；
 * 作用域一收，上下文跟着走（注册返回的 disposer 交给 `ctx.effect`）。
 *
 * @returns {boolean} 装上了没有（宿主版本不支持时如实返回 false）
 */
export function installSeed(service, sessionId, text) {
  if (service.deskSeeds === undefined) service.deskSeeds = new Set()
  if (service.deskSeeds.has(sessionId)) return true

  const agents = service.ctx?.get?.('agents')
  const agent = agents !== undefined && typeof agents.get === 'function' ? agents.get(sessionId) : undefined
  const scoped = agent !== undefined && agent !== null ? agent.ctx : undefined
  const prompt = scoped !== undefined && scoped !== null ? scoped.systemPrompt : undefined
  if (prompt === undefined || prompt === null) return false

  const install = () => {
    try {
      if (typeof prompt.context === 'function') {
        const off = prompt.context({
          name: SEED_CONTEXT,
          order: SEED_ORDER,
          text,
          // 关掉「可选运行时上下文」时也别把它丢掉：没有它 agent 会串台。
          required: true,
        })
        if (typeof off === 'function') return off
      }
    } catch {
      // 这个名字已经注册过，或作用域已销毁：往下试 section。
    }
    try {
      if (typeof prompt.section === 'function') {
        const off = prompt.section({ name: SEED_CONTEXT, order: SEED_ORDER, text })
        if (typeof off === 'function') return off
      }
    } catch {
      // 两条通道都不行：如实回报。
    }
    return undefined
  }

  let done = false
  try {
    if (typeof scoped.effect === 'function') {
      scoped.effect(() => {
        const off = install()
        done = off !== undefined
        return off
      }, 'drama-desk: 构思会话的上下文')
    } else {
      done = install() !== undefined
    }
  } catch {
    done = false
  }
  if (done) service.deskSeeds.add(sessionId)
  return done
}

/**
 * 把会话挂进工作区的**会话账本**（`sessionIds`）。
 *
 * 分组是第二位的：挂了失败也不许影响「这段会话能聊」。
 *
 * @returns {Promise<boolean>} 挂上了没有
 */
export async function attachDeskSession(dshWorkspace, sessionId) {
  if (dshWorkspace === undefined || dshWorkspace === null) return false
  if (typeof dshWorkspace.attachSession !== 'function') return false
  try {
    await dshWorkspace.attachSession(sessionId)
    return true
  } catch {
    return false
  }
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
 * 保证「短剧项目根」在宿主的**工作区注册表**里。
 *
 * 会话必须有归处：只给 `meta.cwd` 而工作区不存在时，这段对话在侧栏里
 * 找不到、在所属工作区的会话列表里也没有——用户只能从工作台的小窗看它。
 * 所以每次开会话之前先走这一步，**新开与恢复都走同一条路**。
 *
 * @returns {Promise<import('./conceive.js') extends never ? never : any>} Workspace（带 attachSession）
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
 * 三条路（已活 / 恢复 / 新开）**都要 `attachSession()`**：漏了这一步，
 * 会话就会掉进 DSH 侧栏的「未分组」。
 *
 * @param {object} service
 * @param {{id: string, dir: string, title?: string}} workspace
 * @returns {Promise<{sessionId: string, live: boolean, created: boolean, cwd: string, workspacePath: string, attached: boolean}>}
 */
export async function ensureDeskSession(service, workspace, options = {}) {
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
  let remembered = typeof state[SESSION_FIELD] === 'string' ? state[SESSION_FIELD] : undefined

  // 「新对话」：把这一段收掉，重新开。旧会话仍留在 DSH 的会话列表里，不会被删。
  if (options.fresh === true && remembered !== undefined) {
    const held = service.deskAgents.get(remembered)
    if (held !== undefined) {
      try {
        await held.dispose()
      } catch {
        // 收不掉就算了。
      }
      service.deskAgents.delete(remembered)
    }
    remembered = undefined
    delete state[SESSION_FIELD]
    await writeJsonAtomic(join(workspace.dir, 'state.json'), state)
    service.invalidateWork(workspace.dir)
  }

  // ① 已经活着 → 直接用
  if (remembered !== undefined) {
    const live = agents.get(remembered)
    if (live !== undefined) {
      // 账本可能缺（旧版本开的会话）：补一次，幂等。
      const attached = await attachDeskSession(dshWorkspace, remembered)
      return { sessionId: remembered, live: true, created: false, cwd, workspacePath: projectRoot, attached }
    }
    // ② 磁盘上有这段会话 → 恢复它（换机器/重启后仍然是同一段对话）
    if (typeof agents.resume === 'function') {
      try {
        const resumeOptions = { resumeSessionId: remembered }
        const rememberedModel = modelFor(service)
        if (rememberedModel !== undefined) resumeOptions.agentOptions = rememberedModel
        const handle = await agents.resume(resumeOptions)
        service.deskAgents.set(remembered, handle)
        const attached = await attachDeskSession(dshWorkspace, remembered)
        return { sessionId: remembered, live: true, created: false, cwd, workspacePath: projectRoot, attached }
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
  // **挂账本**：cwd 对了只说明它在工作目录下；在 `sessionIds` 里才说明
  // 它属于这个工作区——DSH 侧栏就是按账本分组的。
  const attached = await attachDeskSession(dshWorkspace, sessionId)
  await writeJsonAtomic(join(workspace.dir, 'state.json'), {
    ...state,
    [SESSION_FIELD]: sessionId,
    updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  })
  service.invalidateWork(workspace.dir)
  return { sessionId, live: true, created: true, cwd, workspacePath: projectRoot, attached }
}

/** 插件卸载时把这次会话的 agent 收掉（会话本身留在磁盘上）。 */
export async function disposeDeskAgents(service) {
  service.deskSeeds = undefined
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
