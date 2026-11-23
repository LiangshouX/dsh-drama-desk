/**
 * 生成控制面：**通道、进度与开销、下一批计划**。
 *
 * 这一层是**编排层**：它不认识 MiniMax，也不认识第二家供应商。
 * 供应商差异全部在 `drivers/` 里，传输在 `transport/` 里。
 *
 * 它回答三个导演真会问的问题：
 *  1. 现在能用什么出片？（`probeChannels` —— 驱动在不在、认证过没有、工具 schema 读不读得到）
 *  2. 做到哪儿了、花了多少？（`generationBoard` —— 全部从磁盘派生）
 *  3. 下一次提交是什么？（`generationPlan` —— 生图与生视频**两段**：
 *     该提交 / 已在跑别重发 / 缺什么，以及这一批的预计费用）
 *
 * 硬边界：**本模块不提交任何付费生成。** 执行在 `generation-exec.js`，
 * 而且必须由调用方带计划摘要点名（见那里的注释）。
 */
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { listDirIfExists, readJsonIfExists, readTextIfExists } from './fsx.js'
import { currentVideo } from './media.js'
import { canonicalJson, entryMatches, fingerprintOf, promptSha, FINGERPRINT_ALGO } from './ledger.js'
import { forgetDrivers, probeDrivers } from './drivers/index.js'

/** 通道探测的缓存时长：探测要问宿主与 CLI，不能每几秒问一遍。 */
const PROBE_TTL_MS = 30_000

/** 宿主模型目录的缓存（只在设置抽屉打开时用）。 */
const hostCache = new WeakMap()

const LABEL = { image: '生图', video: '生视频' }

/**
 * 探测可用通道，并解析「生图 / 生视频」各自被配成了什么。
 *
 * 「继承宿主」= 用宿主已认证的 mcode-tools 连接器；「自治」= 插件配置指定一条。
 *
 * @param {any} service
 * @param {{refresh?: boolean, host?: boolean}} [options]
 */
export async function probeChannels(service, options = {}) {
  const probed = await probeDrivers(service, { refresh: options.refresh === true })
  const host = options.host === true ? await readHostCatalogue(service) : {
    providers: [],
    reachable: false,
    note: '未探测：设置面板打开时才问宿主的模型目录',
  }
  return {
    host,
    connectors: probed.builtins,
    custom: probed.custom,
    selection: probed.selection,
    cli: probed.cli,
    auth: probed.auth,
    notes: probed.notes,
  }
}

/** 丢掉通道探测缓存（配置改了、或点了「重新探测」）。 */
export function forgetChannels(service) {
  forgetDrivers(service)
  hostCache.delete(service)
}

/**
 * 读宿主的模型目录（设置面板打开时才问）。
 *
 * 走 `service.providerList(true)`：宿主自己的注册表，不是插件自造的一份。
 */
async function readHostCatalogue(service) {
  const cached = hostCache.get(service)
  if (cached !== undefined && Date.now() - cached.at < PROBE_TTL_MS) return cached.value
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
  const value = {
    providers: rows,
    reachable: rows.length > 0,
    modelCount: rows.reduce((sum, row) => sum + row.models, 0),
    note: rows.length === 0 ? '宿主没有公布模型目录：模型 id 可以手填' : undefined,
  }
  hostCache.set(service, { at: Date.now(), value })
  return value
}

// ── 生产看板 ────────────────────────────────────────────────────────────────

/**
 * 一个作品的生成进度与开销。**全部从磁盘派生**，不缓存业务状态。
 *
 * 口径（错了就是说谎）：
 *  - `done`    有**当前视频**（能回看）——任务 succeeded 不等于这一条；
 *  - `pending` 任务已成功 / 镜状态已生成，但还没下载登记成本地视频；
 *  - `inFlight` 台账 submitting/submitted/running；
 *  - `failed`  台账 failed；
 *  - `todo`    其余。
 *
 * @param {any} work
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
  const progress = counts.total === 0 ? 0 : Math.round((counts.done / counts.total) * 100)

  const spentUsd = round2(entries.reduce((sum, entry) => sum + (numberOrUndefined(entry?.cost_usd) ?? 0), 0))
  const limitUsd = numberOrUndefined(work?.state?.budget?.limit_usd)
  const declaredPerShot = numberOrUndefined(work?.state?.budget?.cost_per_shot_usd)
  // 均价与速度只算**视频**：一张图 15 秒、一条视频 2 分钟，混在一起算出来的
  // 「每镜均价 / 每镜耗时」两头都不对。
  const completedVideo = entries.filter(entry => entry?.status === 'succeeded' && entry?.kind !== 'image')
  const completedImages = entries.filter(entry => entry?.status === 'succeeded' && entry?.kind === 'image')
  const ledgerPerShot = completedVideo.length === 0
    ? undefined
    : round4(completedVideo.reduce((sum, entry) => sum + (numberOrUndefined(entry?.cost_usd) ?? 0), 0) / completedVideo.length)
  const perShotUsd = declaredPerShot ?? ledgerPerShot
  const perShotSource = declaredPerShot !== undefined ? 'state.json 的预算单价' : (ledgerPerShot !== undefined ? '台账里已完成视频任务的平均价' : undefined)

  const shotsLeft = counts.todo + counts.failed
  const forecastCost = perShotUsd === undefined ? undefined : round2(perShotUsd * (counts.todo + counts.failed))
  const avgSeconds = averageSeconds(completedVideo)
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
      requestId: entry.request_id,
      kind: entry.kind ?? 'video',
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
      requestId: entry.request_id,
      kind: entry.kind ?? 'video',
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
      completed: completedVideo.length,
      avgSecondsPerShot: avgSeconds,
      avgCostUsd: ledgerPerShot,
    },
    images: {
      references,
      keyframes: keyframes.length,
      shotsWithKeyframe: shotsWithKeyframe.size,
      completedImages: completedImages.length,
    },
    scenes,
    inFlight,
    recent,
  }
}

// ── 生成计划 ────────────────────────────────────────────────────────────────

/**
 * 下一批提交的计划，**生图与生视频两段**。
 *
 * 幂等判据：当前请求的 **full-v2 指纹**与台账里那条一样 ⇒ 同一个请求。
 * 老台账（只有 prompt_sha256）按提示词比对——向后兼容，不让历史作品「全部重做」。
 *
 * @param {any} work
 * @param {any} service
 * @param {string} workspaceId
 * @param {{shots?: string[], limit?: number, includePrompts?: boolean}} [options]
 */
export async function generationPlan(work, service, workspaceId, options = {}) {
  const channels = await probeChannels(service, { host: false })
  const video = await buildVideoSection(work, service, workspaceId, channels.selection.video, options)
  const image = await buildImageSection(work, service, channels.selection.image)
  const digest = sha256(canonicalJson({
    channel: { image: channels.selection.image?.channel ?? null, video: channels.selection.video?.channel ?? null },
    image: image.rows.map(row => ({ id: row.id, action: row.action, request: row.request, fingerprint: row.fingerprint })),
    video: video.rows.map(row => ({ id: row.id, action: row.action, request: row.request, fingerprint: row.fingerprint })),
  }))
  // 提示词正文默认不回给 UI / agent（72 镜会撑爆上下文）；执行时用 includePrompts 重算。
  if (options.includePrompts !== true) {
    for (const row of [...image.rows, ...video.rows]) {
      if (row.request !== undefined) delete row.request.promptText
    }
  }
  return {
    workspace: { id: workspaceId, dir: work?.dir },
    channels: { image: channels.selection.image, video: channels.selection.video },
    image,
    video,
    digest,
    // 兼容：旧调用方把 rows/summary 当视频段读。
    rows: video.rows,
    summary: video.summary,
  }
}

async function buildVideoSection(work, service, workspaceId, channel, options) {
  const prompts = await readPromptArtifacts(work?.dir)
  const ledger = Array.isArray(work?.ledger) ? work.ledger : []
  const ledgerOf = latestByShot(ledger)
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
    const model = channel.model ?? shot?.model
    const resolution = shot?.resolution ?? work?.state?.budget?.resolution
    const ratio = shot?.ratio ?? work?.state?.ratio
    const duration = numberOrUndefined(shot?.duration)
    const referenceAssetIds = (Array.isArray(shot?.references) ? shot.references : []).map(String)
    const promptText = prompt?.text ?? ''
    const fingerprint = fingerprintOf({
      kind: 'video', prompt: promptText, model, resolution, ratio, duration, references: referenceAssetIds,
    })
    const candidate = { fingerprint, promptSha: prompt === undefined ? '' : prompt.sha256 }
    if (action !== 'blocked' && entry !== undefined && sameShot(entry)) {
      const matched = entryMatches(entry, candidate)
      if (matched && (isInFlight(entry.status) || entry.status === 'succeeded')) {
        action = 'skip'
        reasons.push(entry.status === 'succeeded'
          ? '同一份请求已经生成过（提示词 + 模型 + 时长 + 参考图一致）'
          : `同一份请求已在途（任务 ${entry.task_id ?? '未知'}，状态 ${entry.status}）`)
      } else if (matched && entry.status === 'failed') {
        reasons.push('上一次同一份请求失败了：先看失败原因，再决定是否重发')
      } else if (!matched) {
        reasons.push('请求参数变了（提示词 / 模型 / 分辨率 / 时长 / 参考图）：这是一次新的提交')
      }
    }
    const stale = staleShots.has(shot?.id)
    if (stale) reasons.push('提示词已过期（真源改过）：建议先重新编译')
    const cost = perShotUsd
    rows.push({
      kind: 'video',
      id: shot?.id,
      scene: shot?.scene,
      title: shot?.title ?? '',
      action,
      reasons,
      fingerprint,
      fingerprintAlgo: FINGERPRINT_ALGO,
      prompt: prompt === undefined
        ? { exists: false }
        : { exists: true, source: prompt.source, sha256: prompt.sha256, bytes: prompt.bytes, stale, words: prompt.words },
      ledger: entry === undefined ? null : {
        status: entry.status,
        taskId: entry.task_id ?? null,
        fingerprint: entry.fingerprint ?? null,
        promptSha256: entry.prompt_sha256 ?? null,
        costUsd: numberOrUndefined(entry?.cost_usd),
        submittedAt: entry.submitted_at,
      },
      request: {
        model,
        resolution,
        duration,
        ratio,
        referenceCount: referenceAssetIds.length,
        referenceAssetIds,
        costUsd: cost,
        promptText,
      },
    })
    if (action === 'submit') {
      projection.submit += 1
      projection.costUsd += cost ?? 0
      projection.seconds += duration ?? 0
    } else if (action === 'skip') projection.skip += 1
    else projection.blocked += 1
    if (limit !== undefined && projection.submit >= limit) {
      projection.capped = true
      break
    }
  }

  return {
    channel,
    rows,
    summary: {
      submit: projection.submit,
      skip: projection.skip,
      blocked: projection.blocked,
      capped: projection.capped,
      channelReady: channel.available === true && channel.executable !== false,
      channelReason: channel.available === true && channel.executable !== false
        ? undefined
        : (channel.reason || '生视频生成器暂时不可用'),
      costUsd: perShotUsd === undefined && projection.submit > 0 ? undefined : round2(projection.costUsd),
      seconds: projection.seconds,
      perShotUsd,
      note: perShotUsd === undefined
        ? '还没有预算单价（state.json 的 budget.cost_per_shot_usd）：费用只能按模型单价自己算'
        : '按 state.json 的预算单价估算；实际以服务计费为准，台账回写的是这个估算值',
    },
  }
}

/**
 * 生图段：读作品里的 `image-requests.json`（导演 / 规划用例的真源）。
 *
 * 形状：
 * ```json
 * { "requests": [ { "id": "SC01-SH01-keyframe", "prompt": "…", "aspectRatio": "16:9",
 *                   "area": "2K", "count": 1, "referenceAssetIds": ["char_face"],
 *                   "targetShotId": "SC01-SH01", "role": "keyframe" } ] }
 * ```
 */
async function buildImageSection(work, service, channel) {
  const doc = await readJsonIfExists(join(work?.dir ?? '', 'image-requests.json'))
  const requests = Array.isArray(doc?.requests) ? doc.requests : []
  const ledger = Array.isArray(work?.ledger) ? work.ledger : []
  const perImageUsd = numberOrUndefined(work?.state?.budget?.cost_per_image_usd)
  const used = new Set()
  const rows = []
  const projection = { submit: 0, skip: 0, blocked: 0, costUsd: 0, images: 0 }
  for (let index = 0; index < requests.length; index += 1) {
    const request = requests[index] ?? {}
    const id = typeof request.id === 'string' && request.id.trim() !== '' ? request.id.trim() : 'img-' + (index + 1)
    const promptText = typeof request.prompt === 'string' ? request.prompt : ''
    const reasons = []
    let action = 'submit'
    if (promptText.trim() === '') {
      action = 'blocked'
      reasons.push('这一条没有 prompt')
    }
    const referenceAssetIds = Array.isArray(request.referenceAssetIds) ? request.referenceAssetIds.map(String) : []
    for (const assetId of referenceAssetIds) {
      if (!(work?.assets ?? []).some(asset => asset.id === assetId)) {
        action = 'blocked'
        reasons.push('参考资产不存在：' + assetId)
      }
    }
    if (request.targetShotId !== undefined && !(work?.shots ?? []).some(shot => shot.id === request.targetShotId)) {
      action = 'blocked'
      reasons.push('目标镜头不存在：' + request.targetShotId)
    }
    const fingerprint = fingerprintOf({
      kind: 'image', prompt: promptText, area: request.area, n: request.count ?? 1,
      aspectRatio: request.aspectRatio, references: referenceAssetIds,
    })
    const entry = ledger.find(row => row?.kind === 'image'
      && (row?.request_id === id || row?.fingerprint === fingerprint))
    if (action !== 'blocked' && entry !== undefined) {
      const matched = entry.fingerprint_algo === FINGERPRINT_ALGO
        ? entry.fingerprint === fingerprint
        : entry.prompt_sha256 === promptSha(promptText)
      if (matched && (entry.status === 'succeeded' || entry.status === 'submitting')) {
        action = 'skip'
        reasons.push(entry.status === 'succeeded' ? '这一条已经出过图（同一参数）' : '这一条正在提交中')
      } else if (matched && entry.status === 'failed') {
        reasons.push('上一次失败了：先看原因再决定是否重试')
      } else if (!matched) {
        reasons.push('参数变了：这是一次新的出图')
      }
    }
    const count = Number.isInteger(request.count) && request.count > 0 ? request.count : 1
    const cost = perImageUsd === undefined ? undefined : round2(perImageUsd * count)
    rows.push({
      kind: 'image',
      id,
      action,
      reasons,
      fingerprint,
      fingerprintAlgo: FINGERPRINT_ALGO,
      request: {
        promptText,
        aspectRatio: request.aspectRatio,
        area: request.area,
        count,
        referenceAssetIds,
        targetShotId: request.targetShotId,
        role: request.role,
        outputFile: id,
        costUsd: cost,
      },
      ledger: entry === undefined ? null : {
        status: entry.status,
        nodeId: entry.node_id ?? null,
        file: entry.output_path ?? null,
        costUsd: numberOrUndefined(entry?.cost_usd),
      },
    })
    if (action === 'submit') {
      projection.submit += 1
      projection.images += count
      projection.costUsd += cost ?? 0
    } else if (action === 'skip') projection.skip += 1
    else projection.blocked += 1
    used.add(id)
  }
  return {
    channel,
    source: requests.length === 0 ? '作品里没有 image-requests.json（生图计划为空）' : 'image-requests.json',
    rows,
    summary: {
      submit: projection.submit,
      skip: projection.skip,
      blocked: projection.blocked,
      images: projection.images,
      channelReady: channel.available === true && channel.executable !== false,
      channelReason: channel.available === true && channel.executable !== false
        ? undefined
        : (channel.reason || '生图生成器暂时不可用'),
      costUsd: perImageUsd === undefined && projection.images > 0 ? undefined : round2(projection.costUsd),
      perImageUsd,
      note: perImageUsd === undefined
        ? '还没有图片单价（state.json 的 budget.cost_per_image_usd）：费用只能按模型单价自己算'
        : '按 state.json 的单价估算；实际以服务计费为准',
    },
  }
}

// ── 提示词产物 ──────────────────────────────────────────────────────────────

/**
 * 读全片的提示词产物（人工覆盖优先）。
 *
 * 两个目录各列一次，再只读真正存在的那一份——不是逐镜两次「失败探测」。
 *
 * @param {string} dir
 * @returns {Promise<Map<string, {source:'override'|'slim', text:string, sha256:string, bytes:number, words:number}>>}
 */
export async function readPromptArtifacts(dir) {
  const map = new Map()
  if (typeof dir !== 'string' || dir === '') return map
  const slim = await listDirIfExists(join(dir, 'prompts', 'slim'))
  const overrides = await listDirIfExists(join(dir, 'prompts', 'overrides'))
  const collect = (names, folder) => {
    const out = new Map()
    for (const name of names) {
      if (!name.endsWith('.prompt.txt')) continue
      out.set(name.slice(0, -'.prompt.txt'.length), join(dir, 'prompts', folder, name))
    }
    return out
  }
  const slimFiles = collect(slim, 'slim')
  const overrideFiles = collect(overrides, 'overrides')
  for (const id of new Set([...slimFiles.keys(), ...overrideFiles.keys()])) {
    const override = overrideFiles.get(id)
    const path = override ?? slimFiles.get(id)
    const text = await readTextIfExists(path)
    if (text === undefined) continue
    map.set(id, {
      source: override === undefined ? 'slim' : 'override',
      text,
      sha256: promptSha(text),
      bytes: Buffer.byteLength(text, 'utf8'),
      words: text.trim() === '' ? 0 : text.trim().split(/\s+/).length,
    })
  }
  return map
}

// ── 小工具 ──────────────────────────────────────────────────────────────────

function sameShot(entry) {
  return entry !== undefined
}

/** 台账里同一镜可能有多条：取「最近提交」的那条（只看视频条目）。 */
function latestByShot(entries) {
  const map = new Map()
  for (const entry of entries) {
    if (entry?.kind === 'image') continue
    const id = entry?.shot_id
    if (typeof id !== 'string' || id === '') continue
    const current = map.get(id)
    if (current === undefined || stampOf(entry) >= stampOf(current)) map.set(id, entry)
  }
  return map
}

function stampOf(entry) {
  const explicit = entry?.succeeded_at ?? entry?.failed_at ?? entry?.last_query_at ?? entry?.submitted_at
  const explicitAt = typeof explicit === 'string' ? Date.parse(explicit) : Number.NaN
  if (Number.isFinite(explicitAt)) return explicitAt
  const events = trajectoryOf(entry)
  return events.length === 0 ? 0 : events[events.length - 1].at
}

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

function trajectoryOf(entry) {
  const rows = Array.isArray(entry?.trajectory) ? entry.trajectory : []
  const events = []
  for (const row of rows) {
    const at = typeof row?.at === 'string' ? Date.parse(row.at) : Number.NaN
    if (Number.isFinite(at)) events.push({ status: row?.status, at })
  }
  return events
}

function elapsedSeconds(entry, now) {
  const events = trajectoryOf(entry)
  const submitted = events.find(event => event.status === 'submitted')
  const startText = typeof entry?.submitted_at === 'string' ? Date.parse(entry.submitted_at) : Number.NaN
  const start = Number.isFinite(startText) ? startText : (submitted?.at ?? events[0]?.at)
  if (!Number.isFinite(start)) return undefined
  const stop = completedAtOf(entry) ?? now
  return Math.max(0, Math.round((stop - start) / 1000))
}

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

function sha256(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex')
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function round4(value) {
  return Math.round(value * 10000) / 10000
}
