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
 * 上下文纪律（2026-11-22 修，2026-11-22 晚 再修）
 * ------------------------------------------------
 * 「这次只谈 `workspaces/<id>/`」这段话以前是**塞进用户的第一条消息**里
 * （`<system-reminder>` 包着），靠客户端把它抹掉才不显得像人说的话。
 * 后来改成交给宿主的 **prompt context**：它作为 user-role 上下文进模型历史，
 * 宿主的对话面板会把它折成一行「上下文」——**不占用户的话**。
 *
 * 但「开会话时装一次」不够：会话窗里能选的对话**不全是这里开的**
 * （用户在宿主侧栏自己开的、插件重装前开的、别的作品开的都在清单里）。
 * 那种会话从来没有过项目范围，agent 只能靠猜——猜就是串台。
 *
 * 所以现在是 **按会话钉住**（`installScope`）：谁被显示，就给谁挂上；
 * 而且交给宿主的是一段**函数**文本，每一步装配都重取——整段对话都不会漂。
 */
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { readJsonIfExists, writeJsonAtomic } from './fsx.js'

/** `state.json` 里记住构思会话 id 的字段。 */
export const SESSION_FIELD = 'desk_session_id'

/**
 * `state.json` 里**这个作品用过的所有**构思会话 id（新的在前）。
 *
 * 为什么要有它：会话属于哪个作品得有个出处。会话的 `cwd` 是**总根**
 * （所有作品共用同一个 DSH 工作区，`AGENTS.md` §7），从 cwd 分不出作品；
 * 只有这张台账说得清「这段对话是哪一部戏的」。没有它，「换一个对话」里
 * 就分不清谁是谁 —— 那正是串台。
 */
export const SESSION_LIST_FIELD = 'desk_session_ids'

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
 * 挂在 agent 对象上的记号（`Symbol.for` 跨模块实例稳定，插件重载也认得出）。
 *
 * 宿主的 prompt registry 是**进程级**的：插件重装后我们这一代模块里的 Map
 * 全没了，agent 还在、它身上那条旧注册也还在。再挂一次会撞名字抛错，于是
 * 表现成「重装之后范围挂不上」。记号里存着那条注册的 disposer：换作品时
 * 先收掉再挂。
 */
const SCOPE_STAMP = Symbol.for('dsh-drama-desk/scope')

/**
 * 这段对话要带给模型的**作品范围**。
 *
 *   一个工作台只有一个总根，所有短剧项目都是它下面的子目录，共用同一个 DSH
 *   工作区。共用一个工作区意味着 agent 能看见**别人的**项目——所以每一段
 *   构思对话都要把「这次只谈哪个项目」钉死，而且**目录 ID 与作品名的对应
 *   关系不能变**。这就是「防止串台」。
 *
 * 两个名字都写上是刻意的：目录 ID 是机器认的那个（`demo-epic`），作品名是
 * 人认的那个（「演示·潮信」）。读文件用 ID，跟人说话用名字。
 *
 * 注意这里**不写 `@路径`**：那是用户消息里的文件引用语法，在 prompt context 里
 * 没有意义（也没有引用块可解析），写成普通路径更诚实。
 *
 * @param {{id: string, title?: string, path?: string, fresh?: boolean}} scope
 * @returns {string}
 */
export function scopePrompt(scope) {
  const id = typeof scope.id === 'string' ? scope.id : ''
  const name = typeof scope.title === 'string' && scope.title !== '' ? scope.title : id
  const path = typeof scope.path === 'string' && scope.path !== '' ? scope.path : `workspaces/${id}`
  const draft = scope.draft === true
  const lines = [
    `# 当前作品（整段对话的固定范围）`,
    '',
    `- 作品名：「${name}」`,
    `- 目录 ID：\`${id}\``,
    `- 路径：\`${path}/\`（在本次工作区的总根之下）`,
  ]
  if (draft) lines.push('- 状态：**草稿（还没立项）** —— 名字与目录 ID 都是暂定的')
  lines.push('')
  if (draft) {
    lines.push(
      `这是一个**刚起的草稿**：导演还没想好要拍什么，先开了这段对话找方向。`,
      `所以先别急着写文件——把方向聊清楚（问三到五个真正影响故事的问题）。`,
      `方向定了导演会**立项命名**：那之后这一段换成正式的目录与名字，对话继续，不用重开。`,
      `在那之前，别把这个临时 ID 当成作品的正式身份到处引用。`,
      '',
    )
  }
  lines.push(
    `这一页打开的就是「${name}」，它的目录 ID 是 \`${id}\`——这个对应关系不会变。`,
    `**只读写 \`${path}/\` 下的文件**：不要读、不要改总根下别的目录，也不要把别的作品的`,
    `角色、剧情、镜头混进来。别的目录就是别的戏。`,
    '',
    scope.fresh === true
      ? `这是一个**刚建的新作品**，目录还是空的。用 \`drama-conceive\` 技能跟我一起把创意想出来。`
      : `继续「${name}」的构思时用 \`drama-conceive\` 技能；要改稿就先读 \`${path}/\` 里的文件。`,
  )
  return lines.join('\n')
}

/**
 * 把「只谈这个作品」挂到**这一段会话**上（挂上之后整段对话每一步都在）。
 *
 * 为什么不是「开会话时装一次」：会话窗里能选的对话**不全是这里开的**——
 * 用户在宿主侧栏自己开的那段、插件重装前开的那段、别的作品开的那段，都在这份
 * 清单里。它们从来没有过项目范围，agent 只能靠猜；猜就是串台。所以规矩改成
 * **谁被显示，就给谁挂上**。
 *
 * 两条正规通道，按优先级试：
 *
 *   ① `context()` —— **动态模型上下文**，落成一条 user-role 快照。
 *      宿主自己的对话面板会把它折成一行「上下文」，不占用户的话。
 *      文本传**函数**（宿主类型是 `string | ((context) => string)`）：
 *      每一步装配都重取，于是整段对话都不会漂。
 *   ② `section()` —— 退一步进 system prompt：看不见但模型一定读得到。
 *
 * 注册在**这个 agent 自己的作用域**上（`agent.ctx`），所以只有这一段会话带着它。
 * 同一个作品重复挂 = 只换文本（幂等，不重注册）；换了作品 = 先收旧的再挂。
 *
 * @param {object} service
 * @param {string} sessionId
 * @param {{id: string, title?: string, path?: string, fresh?: boolean}} scope
 * @returns {{seeded: boolean, reason?: 'cold'|'host'|'rejected'}}
 */
export function installScope(service, sessionId, scope) {
  const agents = service.ctx?.get?.('agents')
  const agent = agents !== undefined && typeof agents.get === 'function' ? agents.get(sessionId) : undefined
  if (agent === undefined || agent === null) return { seeded: false, reason: 'cold' }
  const prompt = agent.ctx !== undefined && agent.ctx !== null ? agent.ctx.systemPrompt : undefined
  if (prompt === undefined || prompt === null) return { seeded: false, reason: 'host' }

  const text = scopePrompt(scope)
  let previous
  try {
    previous = agent[SCOPE_STAMP]
  } catch {
    previous = undefined
  }
  // 同一个作品：只换文本，不重新注册（重名会抛，而且没必要）。
  if (previous !== undefined && previous !== null && previous.scopeId === scope.id) {
    previous.record.title = scope.title
    previous.record.path = scope.path
    previous.record.fresh = scope.fresh
    previous.record.text = text
    return { seeded: true }
  }
  if (previous !== undefined && previous !== null) {
    try {
      previous.dispose()
    } catch {
      // 已经随作用域销毁了：忽略。
    }
    try {
      delete agent[SCOPE_STAMP]
    } catch {
      // 宿主对象不可写：让下面的注册自己去撞，撞了会如实返回 rejected。
    }
  }

  const record = { id: scope.id, title: scope.title, path: scope.path, fresh: scope.fresh, text }
  /** 每一步装配都会调它：整段对话拿到的都是**当下**这份范围。 */
  const provider = () => record.text
  let dispose
  try {
    dispose = prompt.context({ name: SEED_CONTEXT, order: SEED_ORDER, text: provider, required: true })
  } catch {
    dispose = undefined
  }
  if (typeof dispose !== 'function') {
    try {
      dispose = prompt.section({ name: SEED_CONTEXT, order: SEED_ORDER, text: provider })
    } catch {
      dispose = undefined
    }
  }
  if (typeof dispose !== 'function') return { seeded: false, reason: 'rejected' }
  try {
    agent[SCOPE_STAMP] = { scopeId: scope.id, record, dispose }
  } catch {
    // 记不上就记不上：这一段照样带着范围，只是下次得重挂。
  }
  return { seeded: true }
}

/**
 * 会话**一出生**就把它欠着的那份范围挂上。
 *
 * 有一类会话在界面上是「能打字、但 agent 还没起来」的：刚建的作品、被宿主自己
 * 归档又点开的对话、插件重装后的旧对话。宿主会在**用户发出第一条消息时**才把
 * agent 造出来——而那第一条消息最需要知道「只谈哪部戏」。等它造完再去挂就晚了。
 *
 * 所以 `conceiveScope` 遇到冷会话时把范围记在这里（`service.coldScopes`），
 * 等宿主的 `agent/created` 一来就挂上。**钩子绝不抛**：它是宿主的会话创建链上
 * 的一环（serial），抛出去等于让一段对话开不起来。
 */
export function watchAgentBirth(service) {
  if (service.agentWatch !== undefined) return
  const ctx = service.ctx
  if (ctx === undefined || ctx === null || typeof ctx.on !== 'function') return
  if (service.coldScopes === undefined) service.coldScopes = new Map()
  try {
    service.agentWatch = ctx.on('agent/created', payload => {
      try {
        const agent = payload !== undefined && payload !== null ? payload.agent : undefined
        const id = agent !== undefined && agent !== null ? String(agent.id ?? '') : ''
        if (id === '') return
        const wanted = service.coldScopes !== undefined && service.coldScopes !== null
          ? service.coldScopes.get(id)
          : undefined
        if (wanted === undefined) return
        const install = installScope(service, id, wanted)
        if (install.seeded === true) service.coldScopes.delete(id)
      } catch {
        // 挂不上就留给界面的下一次请求，绝不打断宿主的创建链。
      }
    })
  } catch {
    service.agentWatch = undefined
  }
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
  // **记账**：`desk_session_id` 是「现在用哪一段」，`desk_session_ids` 是
  // 「这个作品用过哪些」——后者是会话→作品的唯一出处（见 SESSION_LIST_FIELD）。
  // 「新对话」只是换掉前者，历史仍然留着，所以旧的对话不会被认成别的作品的。
  const history = Array.isArray(state[SESSION_LIST_FIELD])
    ? state[SESSION_LIST_FIELD].filter(id => typeof id === 'string' && id !== sessionId)
    : []
  await writeJsonAtomic(join(workspace.dir, 'state.json'), {
    ...state,
    [SESSION_FIELD]: sessionId,
    [SESSION_LIST_FIELD]: [sessionId, ...history].slice(0, 20),
    updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  })
  service.invalidateWork(workspace.dir)
  return { sessionId, live: true, created: true, cwd, workspacePath: projectRoot, attached }
}

/** 插件卸载时把这次会话的 agent 收掉（会话本身留在磁盘上）。 */
export async function disposeDeskAgents(service) {
  service.coldScopes = undefined
  if (typeof service.agentWatch === 'function') {
    try {
      service.agentWatch()
    } catch {
      // 已经随作用域销毁：忽略。
    }
    service.agentWatch = undefined
  }
  const agents = service.ctx?.get?.('agents')
  const map = service.deskAgents
  if (map === undefined) return
  service.deskAgents = new Map()
  for (const [sessionId, handle] of map) {
    // 范围注册跟着这一段会话走，卸载就该一起收掉——否则插件被删了，
    // agent 的 prompt 里还挂着一句「只谈 <作品>」。
    try {
      const agent = agents !== undefined && typeof agents.get === 'function' ? agents.get(sessionId) : undefined
      if (agent !== undefined && agent !== null) {
        const held = agent[SCOPE_STAMP]
        if (held !== undefined && held !== null) held.dispose()
        delete agent[SCOPE_STAMP]
      }
    } catch {
      // 收不掉就算了：作用域销毁时会带走。
    }
    try {
      await handle.dispose()
    } catch {
      // 收不掉就算了：会话已落盘，下次 resume 即可。
    }
  }
}
