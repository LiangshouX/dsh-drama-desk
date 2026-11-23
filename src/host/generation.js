/**
 * The **generation control surface**: which channels can make pictures, how far
 * the work has got, what it has cost, and what the next submission would be.
 *
 * 这份模块回答三个导演真会问的问题：
 *
 *  1. **现在能用什么出片？**（`probeChannels`）宿主已经配好的连接器 / 本插件
 *     自定义的通道；以及「为什么现在不能出」的那一句实话。
 *  2. **做到哪儿了、花了多少？**（`generationBoard`）逐场进度、在途任务、
 *     预算余量、剩余预估。
 *  3. **下一次提交是什么？**（`generationPlan`）逐镜：
 *     该提交 / 已经在跑别重发 / 缺什么；以及这一批的预计花费。
 *
 * 硬边界照旧：**本模块绝不提交付费生成。** 它只把「要提交什么、要花多少、
 * 是不是已经提交过」算清楚，交给 agent（走幂等三步）或导演决定。
 *
 * 三个函数都只读磁盘 + 只读宿主能力，不写任何作品文件。
 */
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { listDirIfExists, readJsonIfExists, readTextIfExists } from './fsx.js'
import { currentVideo } from './media.js'

/**
 * 随包的**内置通道**。
 *
 * 工具名不是拍的：它们就写在随包技能里（`imagecraft/references/接口速查.md`
 * 的 `connector__matrix__generate_image`、`drama-generate` 的
 * `connector__matrix__submit_video_generation`）。插件不复制调用参数，
 * 只负责「这条通道在不在」和「选的是哪条」。
 */
const BUILTIN_CHANNELS = [
  {
    id: 'connector-image',
    kind: 'image',
    label: 'MiniMax H3 · 图片（连接器）',
    tool: 'connector__matrix__generate_image',
    cli: 'mcode-tools',
    note: '文生图 / 图片编辑；2K 单张约 ¥0.153。随包技能 imagecraft 写的是这条通道。',
  },
  {
    id: 'connector-video',
    kind: 'video',
    label: 'MiniMax H3 · 视频（连接器）',
    tool: 'connector__matrix__submit_video_generation',
    cli: 'mcode-tools',
    note: '按秒计费（768P 约 $0.08/秒，6 秒一条约 $0.48）。随包技能 drama-generate 写的是这条通道。',
  },
]

/** 通道探测的缓存时长：探测要问宿主，不能每几秒问一遍。 */
const PROBE_TTL_MS = 30_000

/** 探测结果按 service 分开存（同一个进程可能有多个插件实例）。 */
const probeCache = new WeakMap()

const LABEL = { image: '生图', video: '生视频' }

/**
 * 探测可用通道，并解析「生图 / 生视频」各自被配成了什么。
 *
 * 「继承宿主」= 用宿主已经装好的连接器（`mcode-tools`）与宿主已配的模型路由；
 * 「自治」= 插件自己的 `imageChannel` / `videoChannel` 指定一条通道。
 *
 * @param {any} service DramaDeskService
 * @param {{refresh?: boolean, host?: boolean}} [options]
 *   host=false（默认）时不问宿主的模型目录——设置面板打开时才需要它。
 * @returns {Promise<{
 *   host: {providers: Array<{id:string,name:string,models:number}>, reachable: boolean},
 *   connectors: Array<{id:string,kind:string,label:string,tool:string,installed:boolean,path?:string,reason?:string}>,
 *   custom: Array<{id:string,kind:string,label:string,model?:string,tool?:string,note?:string,installed:boolean,reason?:string}>,
 *   selection: {image: object, video: object},
 * }>}
 */
export async function probeChannels(service, options = {}) {
  const cached = probeCache.get(service)
  const fresh = cached !== undefined && !options.refresh && Date.now() - cached.at < PROBE_TTL_MS
  // 已经问过宿主的那份缓存，对 light 与 host 两种请求都够用；
  // 只问过 light 的那份，遇到要宿主的请求必须重算。
  if (fresh && (options.host !== true || cached.hostLoaded === true)) return cached.value
  const config = service?.config ?? {}
  const cliPath = await resolveCli(service)
  const connectors = BUILTIN_CHANNELS.map(channel => {
    const installed = cliPath !== undefined
    const row = {
      id: channel.id,
      kind: channel.kind,
      label: channel.label,
      tool: channel.tool,
      installed,
    }
    if (installed) row.path = cliPath
    else row.reason = '找不到 mcode-tools（连接器 CLI）：这条通道现在调不动'
    return row
  })
  const custom = readCustomChannels(config).map(channel => {
    // 自定义通道：写了 cli 就按 CLI 是否存在判可用；没写就是「导演自己确认」。
    const wanted = typeof channel.cli === 'string' && channel.cli !== '' ? channel.cli : undefined
    const installed = wanted === undefined ? true : wanted === 'mcode-tools' ? cliPath !== undefined : true
    const row = { ...channel, installed }
    if (!installed) row.reason = `找不到 ${wanted}：这条通道现在调不动`
    return row
  })
  const all = [...connectors, ...custom]
  const host = options.host === true
    ? await readHostCatalogue(service)
    : { providers: [], reachable: false, note: '未探测：设置面板打开时才问宿主的模型目录' }
  const value = {
    host,
    connectors,
    custom,
    selection: {
      image: resolveSelection('image', all, host, config),
      video: resolveSelection('video', all, host, config),
    },
  }
  probeCache.set(service, { at: Date.now(), value, hostLoaded: options.host === true, hostTried: options.host === true })
  return value
}

/**
 * 丢掉通道探测缓存（配置改了、或导演点了「重新探测」）。
 *
 * @param {any} service
 */
export function forgetChannels(service) {
  probeCache.delete(service)
}

/**
 * 解析某一类生成最终会落到哪条通道。
 *
 * 返回里**永远带 `available` 与 `reason`**：不能出片时要能一句话说清为什么
 * （没装连接器 / 选的通道不存在 / 宿主没有模型），而不是让界面干瞪眼。
 *
 * @param {'image'|'video'} kind
 * @param {Array<any>} channels
 * @param {{providers: Array<any>}} host
 * @param {any} config
 */
function resolveSelection(kind, channels, host, config) {
  const wanted = kind === 'image' ? config.imageChannel : config.videoChannel
  const model = kind === 'image' ? config.imageModel : config.videoModel
  const usable = channels.filter(channel => channel.kind === kind)
  const inherit = wanted === '' || wanted === undefined || wanted === 'inherit'
  const hostModels = Array.isArray(host?.providers) ? host.providers.reduce((sum, row) => sum + (row.models || 0), 0) : 0
  if (inherit) {
    const candidate = usable.find(channel => channel.installed)
    if (candidate !== undefined) {
      return {
        mode: 'inherit',
        channel: candidate.id,
        label: candidate.label,
        tool: candidate.tool,
        model: model !== undefined && model !== '' ? model : undefined,
        available: true,
        reason: '继承宿主：用宿主已装好的连接器',
      }
    }
    return {
      mode: 'inherit',
      channel: undefined,
      model: model !== undefined && model !== '' ? model : undefined,
      available: false,
      hostModels,
      reason: usable.length === 0
        ? `没有可用的${LABEL[kind]}通道`
        : `继承宿主，但宿主没有装连接器 CLI（mcode-tools）——${LABEL[kind]}暂时调不动。可以装它，或在「生成通道」里自定义一条。`,
    }
  }
  const picked = usable.find(channel => channel.id === wanted)
  if (picked === undefined) {
    return {
      mode: 'custom',
      channel: wanted,
      model: model !== undefined && model !== '' ? model : undefined,
      available: false,
      reason: `配置指定的通道「${wanted}」不在可用通道里（可能被删了）`,
    }
  }
  return {
    mode: 'custom',
    channel: picked.id,
    label: picked.label,
    tool: picked.tool,
    model: model !== undefined && model !== '' ? model : picked.model,
    available: picked.installed === true,
    reason: picked.installed === true ? '本插件指定的通道' : (picked.reason || '通道不可用'),
  }
}

/**
 * 读宿主的模型目录（设置面板打开时才问）。
 *
 * 走 `service.providerList(true)`：它已经是「宿主自己的注册表」而不是插件
 * 自造的一份清单。这里只保留计数与 id，不把几十个模型塞进每次设置读取。
 *
 * @param {any} service
 */
async function readHostCatalogue(service) {
  let providers = []
  try {
    providers = await service.providerList(true)
  } catch {
    providers = []
  }
  const rows = (Array.isArray(providers) ? providers : []).map(row => ({
    id: typeof row?.id === 'string' ? row.id : '',
    name: typeof row?.name === 'string' && row.name !== '' ? row.name : (row?.id ?? ''),
    models: Array.isArray(row?.models) ? row.models.length : 0,
    configured: row?.configured === true,
  })).filter(row => row.id !== '')
  return {
    providers: rows,
    reachable: rows.length > 0,
    modelCount: rows.reduce((sum, row) => sum + row.models, 0),
    note: rows.length === 0
      ? '宿主没有公布模型目录：模型 id 可以手填'
      : undefined,
  }
}

/** 配置里的自定义通道（形状不合法的一律丢掉，不猜）。 */
function readCustomChannels(config) {
  const raw = Array.isArray(config?.channels) ? config.channels : []
  const out = []
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue
    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    const kind = entry.kind === 'image' || entry.kind === 'video' ? entry.kind : undefined
    if (id === '' || kind === undefined) continue
    const row = {
      id,
      kind,
      label: typeof entry.label === 'string' && entry.label !== '' ? entry.label : id,
      custom: true,
    }
    if (typeof entry.model === 'string' && entry.model !== '') row.model = entry.model
    if (typeof entry.tool === 'string' && entry.tool !== '') row.tool = entry.tool
    if (typeof entry.cli === 'string' && entry.cli !== '') row.cli = entry.cli
    if (typeof entry.note === 'string' && entry.note !== '') row.note = entry.note
    out.push(row)
  }
  return out
}

/**
 * 连接器 CLI 在不在。
 *
 * 用宿主自己的 `subprocess.resolveExecutable`：它知道 PATH、也知道宿主自己的
 * 终端环境。宿主没有这个服务时**不猜**（返回 undefined ⇒ 通道标为不可用，
 * 理由写「找不到」——宁可说不能，也不要让导演以为能。
 *
 * @param {any} service
 * @returns {Promise<string|undefined>}
 */
async function resolveCli(service) {
  const subprocess = service?.ctx?.get?.('subprocess')
  if (subprocess === undefined || typeof subprocess?.resolveExecutable !== 'function') return undefined
  try {
    const path = await subprocess.resolveExecutable('mcode-tools')
    return typeof path === 'string' && path !== '' ? path : undefined
  } catch {
    return undefined
  }
}

// ── 生产看板 ────────────────────────────────────────────────────────────────

/**
 * 一个作品的生成进度与开销。
 *
 * **全部从磁盘派生**（shots / assets / ledger / state.budget），不缓存业务状态：
 * agent 在别的会话里提交了任务、写回台账，这里下一轮就该看见。
 *
 * @param {any} work the loaded work（dir/shots/assets/ledger/state）
 * @returns {{
 *   counts: {total:number, done:number, pending:number, inFlight:number, failed:number, todo:number},
 *   progress: number,
 *   budget: {limitUsd?:number, spentUsd:number, remainingUsd?:number, perShotUsd?:number, perShotSource?:string},
 *   forecast: {shotsLeft:number, costUsd?:number, seconds?:number, basis:string},
 *   speed: {completed:number, avgSecondsPerShot?:number, avgCostUsd?:number},
 *   images: {references:number, keyframes:number, shotsWithKeyframe:number},
 *   scenes: Array<any>,
 *   inFlight: Array<any>,
 *   recent: Array<any>,
 * }}
 */
export function generationBoard(work) {
  const shots = Array.isArray(work?.shots) ? work.shots : []
  const assets = Array.isArray(work?.assets) ? work.assets : []
  const entries = Array.isArray(work?.ledger) ? work.ledger : []
  const ledgerOf = latestByShot(entries)

  const counts = { total: shots.length, done: 0, pending: 0, inFlight: 0, failed: 0, todo: 0 }
  const perShot = new Map()
  for (const shot of shots) {
    const entry = ledgerOf.get(shot?.id)
    // 「做完了」的判据是**有一版能看的当前视频**，不是任务状态。
    // 任务 succeeded 只说明服务端出片了；文件还没下载登记到资产索引时，
    // 导演在网格里仍然看不到画面。所以这两件事分开数：
    //   done    = 有当前视频（能回看）
    //   pending = 任务已成功 / 镜状态已生成，但还没有登记成本地视频
    const take = hasCurrentVideo(work, shot)
    const inFlight = entry !== undefined && isInFlight(entry.status)
    const generated = entry?.status === 'succeeded' || shot?.status === 'succeeded' || shot?.status === 'generated'
    const failed = entry?.status === 'failed'
    if (take) counts.done += 1
    else if (inFlight) counts.inFlight += 1
    else if (generated) counts.pending += 1
    else if (failed) counts.failed += 1
    else counts.todo += 1
    perShot.set(shot?.id, {
      entry,
      done: take,
      inFlight,
      pending: generated && !take,
      failedTask: failed,
      costUsd: numberOrUndefined(entry?.cost_usd),
    })
  }
  // 没有镜头的作品：不该显示 0% 进度，显示 0 且明确「还没有分镜」。
  const progress = counts.total === 0 ? 0 : Math.round((counts.done / counts.total) * 100)

  const spentUsd = round2(entries.reduce((sum, entry) => sum + (numberOrUndefined(entry?.cost_usd) ?? 0), 0))
  const limitUsd = numberOrUndefined(work?.state?.budget?.limit_usd)
  const declaredPerShot = numberOrUndefined(work?.state?.budget?.cost_per_shot_usd)
  const completedEntries = entries.filter(entry => entry?.status === 'succeeded')
  const ledgerPerShot = completedEntries.length === 0
    ? undefined
    : round4(completedEntries.reduce((sum, entry) => sum + (numberOrUndefined(entry?.cost_usd) ?? 0), 0) / completedEntries.length)
  const perShotUsd = declaredPerShot ?? ledgerPerShot
  const perShotSource = declaredPerShot !== undefined ? 'state.json 的预算单价' : (ledgerPerShot !== undefined ? '台账里已完成任务的平均价' : undefined)

  const shotsLeft = counts.todo + counts.failed
  const forecastCost = perShotUsd === undefined ? undefined : round2(perShotUsd * (counts.todo + counts.failed))
  const avgSeconds = averageSeconds(completedEntries)
  const forecastSeconds = avgSeconds === undefined ? undefined : Math.round(avgSeconds * (counts.todo + counts.failed))

  const scenes = (Array.isArray(work?.scenes) ? work.scenes : []).map(scene => {
    const shotsOfScene = shots.filter(shot => shot?.scene === scene?.id)
    let done = 0, pending = 0, inFlight = 0, failed = 0, costUsd = 0, seconds = 0
    for (const shot of shotsOfScene) {
      const row = perShot.get(shot?.id)
      if (row === undefined) continue
      if (row.done) done += 1
      else if (row.inFlight) inFlight += 1
      else if (row.pending) pending += 1
      else if (row.failedTask) failed += 1
      costUsd += row.costUsd ?? 0
      seconds += numberOrUndefined(shot?.duration) ?? 0
    }
    return {
      id: scene?.id,
      title: scene?.title ?? '',
      shots: shotsOfScene.length,
      done,
      pending,
      inFlight,
      failed,
      todo: shotsOfScene.length - done - pending - inFlight - failed,
      costUsd: round2(costUsd),
      seconds: round2(seconds),
    }
  })

  const now = Date.now()
  const inFlight = entries
    .filter(entry => isInFlight(entry?.status))
    .map(entry => ({
      shotId: entry.shot_id,
      taskId: entry.task_id ?? null,
      status: entry.status,
      model: entry.model,
      resolution: entry.resolution,
      duration: entry.duration,
      costUsd: numberOrUndefined(entry?.cost_usd),
      submittedAt: entry.submitted_at,
      elapsedSec: elapsedSeconds(entry, now),
    }))
    .sort((a, b) => (b.elapsedSec ?? 0) - (a.elapsedSec ?? 0))

  const recent = entries
    .slice()
    .sort((a, b) => stampOf(b) - stampOf(a))
    .slice(0, 5)
    .map(entry => ({
      shotId: entry.shot_id,
      taskId: entry.task_id ?? null,
      status: entry.status,
      model: entry.model,
      costUsd: numberOrUndefined(entry?.cost_usd),
      completedAt: entry.succeeded_at ?? entry.failed_at ?? entry.last_query_at ?? entry.submitted_at,
      seconds: elapsedSeconds(entry, now),
    }))

  const references = assets.filter(asset => asset?.type === 'reference_image').length
  const keyframes = assets.filter(asset => asset?.type === 'keyframe')
  const shotsWithKeyframe = new Set(keyframes.map(asset => asset?.shot_id).filter(id => typeof id === 'string'))

  return {
    counts,
    progress,
    budget: {
      limitUsd,
      spentUsd,
      remainingUsd: limitUsd === undefined ? undefined : round2(limitUsd - spentUsd),
      perShotUsd,
      perShotSource,
    },
    forecast: {
      shotsLeft,
      costUsd: forecastCost,
      seconds: forecastSeconds,
      basis: perShotSource === undefined
        ? '还没有单价：既没有预算单价，也没有已完成的台账任务'
        : '按 ' + perShotSource + ' 推算',
    },
    speed: {
      completed: completedEntries.length,
      avgSecondsPerShot: avgSeconds,
      avgCostUsd: ledgerPerShot,
    },
    images: {
      references,
      keyframes: keyframes.length,
      shotsWithKeyframe: shotsWithKeyframe.size,
    },
    scenes,
    inFlight,
    recent,
  }
}

// ── 生成计划 ────────────────────────────────────────────────────────────────

/**
 * 下一批提交的计划。
 *
 * 逐镜给出**动作**：
 *  - `submit`  该提交（提示词齐、还没提交过）
 *  - `skip`    已经在跑/已经成功（同一份提示词）——**这一步就是为了不重复扣费**
 *  - `blocked` 缺提示词 / 缺时长 / 缺运镜 / 没选通道
 *
 * 幂等的判据是**提示词 sha256**：台账记的是提交时那份提示词的指纹，
 * 现在这份指纹一样 ⇒ 同一个请求，重发就是重复付费。
 *
 * @param {any} work the loaded work
 * @param {any} service DramaDeskService（用它的 `check()` 拿过期的镜号清单）
 * @param {string} workspaceId
 * @param {{shots?: string[], limit?: number}} [options]
 * @returns {Promise<object>}
 */
export async function generationPlan(work, service, workspaceId, options = {}) {
  const channels = await probeChannels(service)
  const channel = channels.selection.video
  const prompts = await readPromptArtifacts(work?.dir)
  const ledgerOf = latestByShot(Array.isArray(work?.ledger) ? work.ledger : [])
  let staleShots = new Set()
  if (typeof service?.check === 'function' && workspaceId !== undefined) {
    try {
      const checked = await service.check({ workspaceId })
      staleShots = new Set(Array.isArray(checked?.staleShots) ? checked.staleShots : [])
    } catch {
      staleShots = new Set()
    }
  }
  const wanted = Array.isArray(options.shots) && options.shots.length > 0 ? new Set(options.shots) : undefined
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : undefined
  const perShotUsd = numberOrUndefined(work?.state?.budget?.cost_per_shot_usd)
  const projection = { submit: 0, skip: 0, blocked: 0, costUsd: 0, seconds: 0, capped: false }
  const rows = []

  for (const shot of Array.isArray(work?.shots) ? work.shots : []) {
    if (wanted !== undefined && !wanted.has(shot?.id)) continue
    const prompt = prompts.get(shot?.id)
    const entry = ledgerOf.get(shot?.id)
    const reasons = []
    let action = 'submit'
    if (prompt === undefined) {
      action = 'blocked'
      reasons.push('还没有提示词产物（先在生成台重新编译）')
    }
    if (numberOrUndefined(shot?.duration) === undefined) {
      action = 'blocked'
      reasons.push('镜头缺 duration')
    }
    if (typeof shot?.camera !== 'string' || shot.camera.trim() === '') {
      action = 'blocked'
      reasons.push('镜头缺 camera（运镜）')
    }
    // 通道不可用**不逐镜标阻塞**：计划的内容（该提交谁、花多少、有没有重复）
    // 仍然成立，agent 也可能走别的合法通道。它作为整批的一条警告挂在 summary 上，
    // 由界面与 agent 在「真正提交前」解决。
    if (action !== 'blocked' && prompt !== undefined && entry !== undefined) {
      const sameRequest = typeof entry.prompt_sha256 === 'string' && entry.prompt_sha256 === prompt.sha256
      if (sameRequest && (isInFlight(entry.status) || entry.status === 'succeeded')) {
        action = 'skip'
        reasons.push(entry.status === 'succeeded'
          ? `同一份提示词已经生成过（${entry.shot_id} 版本已在台账）`
          : `同一份提示词已在途（任务 ${entry.task_id ?? '未知'}，状态 ${entry.status}）`)
      } else if (sameRequest && entry.status === 'failed') {
        reasons.push('上一次同一份提示词失败了：先看失败原因，再决定是否重发')
      } else if (!sameRequest && entry !== undefined) {
        reasons.push('提示词或版本变了：这是一次新的提交')
      }
    }
    // 提示词过期不是阻塞：产物在那儿就能提交，只是它和真源不一致。
    const stale = staleShots.has(shot?.id)
    if (stale) reasons.push('提示词已过期（真源改过）：建议先重新编译')
    const cost = perShotUsd === undefined ? undefined : perShotUsd
    const seconds = numberOrUndefined(shot?.duration)
    rows.push({
      id: shot?.id,
      scene: shot?.scene,
      title: shot?.title ?? '',
      action,
      reasons,
      prompt: prompt === undefined
        ? { exists: false }
        : { exists: true, source: prompt.source, sha256: prompt.sha256, bytes: prompt.bytes, stale, words: prompt.words },
      ledger: entry === undefined ? null : {
        status: entry.status,
        taskId: entry.task_id ?? null,
        promptSha256: entry.prompt_sha256 ?? null,
        costUsd: numberOrUndefined(entry?.cost_usd),
        submittedAt: entry.submitted_at,
      },
      request: {
        model: channel.model ?? shot?.model,
        resolution: shot?.resolution ?? work?.state?.budget?.resolution,
        duration: seconds,
        ratio: shot?.ratio ?? work?.state?.ratio,
        referenceCount: Array.isArray(shot?.references) ? shot.references.length : 0,
        costUsd: cost,
      },
    })
    if (action === 'submit') {
      projection.submit += 1
      projection.costUsd += cost ?? 0
      projection.seconds += seconds ?? 0
    } else if (action === 'skip') projection.skip += 1
    else projection.blocked += 1
    if (limit !== undefined && projection.submit >= limit) {
      projection.capped = true
      break
    }
  }

  projection.costUsd = round2(projection.costUsd)
  return {
    workspace: { id: workspaceId, dir: work?.dir },
    channel,
    rows,
    summary: {
      submit: projection.submit,
      skip: projection.skip,
      blocked: projection.blocked,
      capped: projection.capped,
      // 通道能不能真把事办成，是**整批**的前提；不可用时界面要顶一条横幅，
      // 而不是把 72 行都标成阻塞（那样反而看不出「哪些镜该提交」）。
      channelReady: channel.available === true,
      channelReason: channel.available === true ? undefined : (channel.reason || '没有可用的生视频通道'),
      costUsd: perShotUsd === undefined && projection.submit > 0 ? undefined : projection.costUsd,
      seconds: projection.seconds,
      perShotUsd,
      note: perShotUsd === undefined
        ? '还没有预算单价（state.json 的 budget.cost_per_shot_usd）：费用只能按模型单价自己算'
        : '按 state.json 的预算单价估算；实际以台账回写的 cost_usd 为准',
    },
  }
}

// ── 小工具 ──────────────────────────────────────────────────────────────────

/** 台账里同一镜可能有多条：取「最近提交」的那条。 */
function latestByShot(entries) {
  const map = new Map()
  for (const entry of entries) {
    const id = entry?.shot_id
    if (typeof id !== 'string' || id === '') continue
    const current = map.get(id)
    if (current === undefined || stampOf(entry) >= stampOf(current)) map.set(id, entry)
  }
  return map
}

/** 一条台账的「最近活动」时间戳（毫秒）；读不出来就是 0。 */
function stampOf(entry) {
  const explicit = entry?.succeeded_at ?? entry?.failed_at ?? entry?.last_query_at ?? entry?.submitted_at
  const explicitAt = typeof explicit === 'string' ? Date.parse(explicit) : Number.NaN
  if (Number.isFinite(explicitAt)) return explicitAt
  const events = trajectoryOf(entry)
  return events.length === 0 ? 0 : events[events.length - 1].at
}

/**
 * 任务的完成时刻（毫秒）。
 *
 * 台账**不一定有** `succeeded_at`：随包技能写的是 `trajectory`（每次状态变化
 * 一行）。只认 `succeeded_at` 会把「7 天前提交、当天完成」算成「跑了 7 天」。
 * 所以终态先从轨迹里找。
 */
function completedAtOf(entry) {
  for (const status of ['succeeded', 'failed']) {
    const explicit = status === 'succeeded' ? entry?.succeeded_at : entry?.failed_at
    const explicitAt = typeof explicit === 'string' ? Date.parse(explicit) : Number.NaN
    if (Number.isFinite(explicitAt)) return explicitAt
    const terminal = trajectoryOf(entry).filter(event => event.status === status)
    if (terminal.length > 0) return terminal[terminal.length - 1].at
  }
  return undefined
}

/** 台账轨迹里能解析出时间的事件。 */
function trajectoryOf(entry) {
  const rows = Array.isArray(entry?.trajectory) ? entry.trajectory : []
  const events = []
  for (const row of rows) {
    const at = typeof row?.at === 'string' ? Date.parse(row.at) : Number.NaN
    if (Number.isFinite(at)) events.push({ status: row?.status, at })
  }
  return events
}

/** 任务跑了多久（秒）：从提交到完成；还没完成就到现在。 */
function elapsedSeconds(entry, now) {
  const events = trajectoryOf(entry)
  const submitted = events.find(event => event.status === 'submitted')
  const startText = typeof entry?.submitted_at === 'string' ? Date.parse(entry.submitted_at) : Number.NaN
  const start = Number.isFinite(startText) ? startText : (submitted?.at ?? events[0]?.at)
  if (!Number.isFinite(start)) return undefined
  const stop = completedAtOf(entry) ?? now
  return Math.max(0, Math.round((stop - start) / 1000))
}

/** 已完成任务的平均耗时（秒）。 */
function averageSeconds(entries) {
  const values = []
  for (const entry of entries) {
    const events = trajectoryOf(entry)
    const submitted = events.find(event => event.status === 'submitted')
    const startText = typeof entry?.submitted_at === 'string' ? Date.parse(entry.submitted_at) : Number.NaN
    const start = Number.isFinite(startText) ? startText : submitted?.at
    const end = completedAtOf(entry)
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) values.push((end - start) / 1000)
  }
  if (values.length === 0) return undefined
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function isInFlight(status) {
  return status === 'submitting' || status === 'submitted' || status === 'running'
}

function isFinishedStatus(status) {
  return status === 'pass' || status === 'warn' || status === 'fail' || status === 'verified' || status === 'succeeded'
}

function hasCurrentVideo(work, shot) {
  try {
    return currentVideo(work, shot) !== undefined
  } catch {
    return false
  }
}

function numberOrUndefined(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function round4(value) {
  return Math.round(value * 10000) / 10000
}

/**
 * 读全片的提示词产物（人工覆盖优先）。
 *
 * 两个目录各列一次，再只读真正存在的那一份——不是逐镜两次「失败探测」
 * （见 `docs/dev/performance.md` P7）。
 *
 * @param {string} dir work directory
 * @returns {Promise<Map<string, {source:'override'|'slim', text:string, sha256:string, bytes:number, words:number}>>}
 */
async function readPromptArtifacts(dir) {
  const map = new Map()
  if (typeof dir !== 'string' || dir === '') return map
  const slim = await listDirIfExists(join(dir, 'prompts', 'slim'))
  const overrides = await listDirIfExists(join(dir, 'prompts', 'overrides'))
  const slimFiles = new Map()
  for (const name of slim) {
    if (!name.endsWith('.prompt.txt')) continue
    slimFiles.set(name.slice(0, -'.prompt.txt'.length), join(dir, 'prompts', 'slim', name))
  }
  const overrideFiles = new Map()
  for (const name of overrides) {
    if (!name.endsWith('.prompt.txt')) continue
    overrideFiles.set(name.slice(0, -'.prompt.txt'.length), join(dir, 'prompts', 'overrides', name))
  }
  for (const id of new Set([...slimFiles.keys(), ...overrideFiles.keys()])) {
    const override = overrideFiles.get(id)
    const path = override ?? slimFiles.get(id)
    const text = await readTextIfExists(path)
    if (text === undefined) continue
    map.set(id, {
      source: override === undefined ? 'slim' : 'override',
      text,
      sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
      bytes: Buffer.byteLength(text, 'utf8'),
      words: text.trim() === '' ? 0 : text.trim().split(/\s+/).length,
    })
  }
  return map
}

export { readPromptArtifacts, BUILTIN_CHANNELS }
