/**
 * 生成执行器：把「计划」变成真的一件事。
 *
 * 三条硬纪律（都在 `docs/04` / `docs/05` 里踩过）：
 *
 *  1. **先落台账，再提交，立刻回写 task_id。** 接口没有幂等键；
 *     顺序错了就是「任务在跑没人知道」或者「重复扣费」。
 *  2. **绝不自动重试付费提交。** 提交超时可能已经成功——只能查台账 / 查任务，
 *     不能重发。本模块因此连一个 retry 循环都没有。
 *  3. **产物立刻落地。** H3/H3-Max 的成片只保留 7 天；`node_id` 当天就要变成
 *     作品目录里的文件并登记进资产索引。
 *
 * 「插件不发起付费生成」的落地方式：**执行必须由调用方点名**（带计划摘要 +
 * 明确的 approve），本模块从不自己决定提交什么、什么时候提交。
 */
import { dirname, extname, join } from 'node:path'
import { mkdir, stat } from 'node:fs/promises'
import { McodeToolsError } from './transport/cli.js'
import { resolveWithin } from './fsx.js'
import { videoVersion } from './media.js'
import { registerProductionAsset } from './registration.js'
import { writeShotFields, writeAssetFields, loadWorkspace } from './workspace.js'
import {
  FINGERPRINT_ALGO, appendLedgerEntry, fingerprintOf, patchLedgerEntry, promptSha, readLedger,
} from './ledger.js'
import { driverFor } from './drivers/index.js'
import { generationPlan } from './generation.js'

/** 一次执行里同一份素材只上传一次（temp_url 约 1 小时有效）。 */
function createUploadCache() {
  const cache = new Map()
  return {
    async ref(driver, absolutePath, mimeType) {
      const key = absolutePath + '|' + (mimeType ?? '')
      const hit = cache.get(key)
      if (hit !== undefined) return hit
      const uploaded = await driver.upload(absolutePath, mimeType)
      const value = { url: uploaded.temp_url ?? uploaded.url, mimeType }
      cache.set(key, value)
      return value
    },
  }
}

/**
 * 执行一份生成计划。
 *
 * @param {any} service
 * @param {{id: string, title?: string}} workspace
 * @param {any} work 已加载的作品
 * @param {{digest: string, approve: boolean, kinds?: Array<'image'|'video'>, shots?: string[], limit?: number}} options
 * @returns {Promise<object>}
 */
const executing = new Set()

export async function executeGenerationPlan(service, workspace, work, options = {}) {
  if (executing.has(work.dir)) throw new Error('这个作品正在提交生成，请等待结果，不要重复提交')
  executing.add(work.dir)
  try { return await executeUnlocked(service, workspace, work, options) }
  finally { executing.delete(work.dir) }
}

async function executeUnlocked(service, workspace, work, options) {
  // Reload under the lock so a waiting caller cannot execute against an older ledger.
  work = await loadWorkspace(work.dir)
  if (options.approve !== true) {
    throw new Error('执行付费生成需要显式 approve: true，并且必须带上刚算出来的计划摘要（digest）')
  }
  const digest = typeof options.digest === 'string' ? options.digest.trim() : ''
  if (digest === '') throw new Error('缺少计划摘要（digest）：先生成计划，再用它的摘要执行')
  if (service?.config?.paidExecution === 'off') {
    throw new Error('当前配置关闭了付费执行（paidExecution: off）：只能生成计划，不会提交')
  }
  const kinds = Array.isArray(options.kinds) && options.kinds.length > 0
    ? options.kinds.filter(kind => kind === 'image' || kind === 'video')
    : ['image', 'video']
  if (kinds.length === 0) throw new Error('kinds 里没有可执行的类型（image / video）')

  // 现算一份计划：摘要对不上就说明「计划变了」，绝不能拿旧的去花钱。
  const fresh = await generationPlan(work, service, workspace.id, {
    shots: options.shots,
    limit: options.limit,
    includePrompts: true,
    imageRequests: options.imageRequests,
  })
  if (fresh.digest !== digest) {
    throw new Error('计划已经变了（提示词 / 台账 / 生成器），摘要对不上：请重新生成计划再执行')
  }

  const results = []
  const uploads = createUploadCache()
  for (const kind of kinds) {
    const section = kind === 'image' ? fresh.image : fresh.video
    if (section === undefined) continue
    if (section.summary.channelReady !== true) {
      throw new Error(`${kind === 'image' ? '生图' : '生视频'}生成器现在用不了：${section.summary.channelReason || '未知原因'}`)
    }
    const { driver } = await driverFor(service, kind, section.channel?.channel)
    if (kind === 'image') {
      results.push(...await executeImageRows(service, workspace, work, driver, section, uploads))
    } else {
      results.push(...await executeVideoRows(service, workspace, work, driver, section, uploads))
    }
  }
  service.invalidateWork(work.dir)
  return {
    ok: true,
    digest,
    workspace: { id: workspace.id },
    executed: results,
    summary: {
      submitted: results.filter(row => row.status === 'submitted' || row.status === 'succeeded').length,
      failed: results.filter(row => row.status === 'failed').length,
    },
  }
}

// ── 生图（同步）────────────────────────────────────────────────────────────

async function executeImageRows(service, workspace, work, driver, section, uploads) {
  const rows = section.rows.filter(row => row.action === 'submit')
  const results = []
  const batchSize = 10
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize)
    const prepared = []
    for (const row of batch) {
      // 计划里统一叫 `promptText`（UI / agent 默认不返回正文），执行时从这里取。
      const prompt = String(row.request?.promptText ?? row.request?.prompt ?? '')
      const fingerprint = fingerprintOf({
        kind: 'image',
        prompt,
        area: row.request?.area,
        n: row.request?.count,
        aspectRatio: row.request?.aspectRatio,
        references: row.request?.referenceAssetIds ?? [],
      })
      const now = new Date().toISOString()
      // ① 先落账（还没花钱）：占位条目是「中断之后唯一的恢复依据」。
      await appendLedgerEntry(work.dir, {
        kind: 'image',
        request_id: row.id,
        shot_id: row.request?.targetShotId,
        fingerprint,
        fingerprint_algo: FINGERPRINT_ALGO,
        prompt_sha256: promptSha(prompt),
        model: 'MiniMax-H3-Image',
        resolution: row.request?.area,
        ratio: row.request?.aspectRatio,
        references: row.request?.referenceAssetIds ?? [],
        cost_usd: row.request?.costUsd,
        cost_source: row.request?.costUsd === undefined ? 'unknown' : 'state.budget',
        status: 'submitting',
        task_id: null,
        submitted_at: now,
        trajectory: [{ status: 'submitting', at: now }],
      })
      // ② 参考图先换成 temp_url（批量先传完，再一次性提交）。
      const references = []
      for (const assetId of row.request?.referenceAssetIds ?? []) {
        const asset = (work.assets ?? []).find(item => item.id === assetId)
        if (asset === undefined) continue
        const absolute = resolveWithin(work.dir, asset.path)
        references.push(await uploads.ref(driver, absolute, mimeForPath(asset.path)))
      }
      prepared.push({ row, prompt, references })
    }
    // ③ 一次性提交这一批（同步，返回即出图）。
    try {
      const result = await driver.submit(prepared.map(item => ({
        prompt: item.prompt,
        references: item.references,
        aspectRatio: item.row.request?.aspectRatio,
        area: item.row.request?.area,
        n: item.row.request?.count ?? 1,
        outputFile: item.row.id,
      })))
      for (let index = 0; index < prepared.length; index += 1) {
        const item = prepared[index]
        const produced = result.items.find(entry => entry.requestIndex === index)
        const failed = result.failures.find(entry => entry.requestIndex === index)
        if (produced !== undefined) {
          try {
            const saved = await saveImage(work, item.row, produced, driver)
            await patchLedgerEntry(work.dir, { requestId: item.row.id }, {
              status: 'succeeded',
              node_id: produced.nodeId,
              file_name: produced.fileName,
              output_path: saved.path,
              asset_id: saved.assetId,
              succeeded_at: new Date().toISOString(),
            }, { status: 'succeeded' })
            results.push({ kind: 'image', id: item.row.id, status: 'succeeded', assetId: saved.assetId, path: saved.path })
          } catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause)
            await patchLedgerEntry(work.dir, { requestId: item.row.id }, {
              status: 'failed', failure: '出图成功但落地失败：' + message, failed_at: new Date().toISOString(),
            }, { status: 'failed' })
            results.push({ kind: 'image', id: item.row.id, status: 'failed', error: '出图成功但落地失败：' + message })
          }
          continue
        }
        const message = failed?.message ?? '服务没有返回这一条的结果'
        await patchLedgerEntry(work.dir, { requestId: item.row.id }, {
          status: 'failed', failure: message, failed_at: new Date().toISOString(),
        }, { status: 'failed' })
        results.push({ kind: 'image', id: item.row.id, status: 'failed', error: message })
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      for (const item of prepared) {
        await patchLedgerEntry(work.dir, { requestId: item.row.id }, {
          status: 'failed', failure: message, failed_at: new Date().toISOString(),
        }, { status: 'failed' })
        results.push({ kind: 'image', id: item.row.id, status: 'failed', error: message })
      }
    }
  }
  return results
}

/** 图落地 + 登记。 */
async function saveImage(work, row, produced, driver) {
  const extension = extname(produced.fileName || '') || guessImageExtension(produced.fileName)
  const target = row.request?.targetShotId ? 'keyframes' : 'refs'
  const base = slug(row.id)
  let id = base
  let index = 2
  const taken = candidate => (work.assets ?? []).some(asset => asset.id === candidate)
  let relative = `${target}/${id}${extension}`
  while (taken(id) || await exists(resolveWithin(work.dir, relative))) {
    id = base + '-' + index
    index += 1
    relative = `${target}/${id}${extension}`
  }
  const absolute = resolveWithin(work.dir, relative)
  await mkdir(dirname(absolute), { recursive: true })
  // 落地：node_id → get_asset_url → 流式下载。
  await driver.download(produced.nodeId, absolute)
  const asset = await registerProductionAsset(work.dir, {
    id,
    type: row.request?.targetShotId ? 'keyframe' : 'reference_image',
    path: relative,
    shotId: row.request?.targetShotId,
    role: row.request?.role,
    source: 'mcode:generate_image',
  })
  await writeAssetFields(work.dir, asset.id, { prompt: row.request?.promptText ?? '',
    notes: '生成形象；清晰度 ' + (row.request?.area ?? '默认') + '；比例 ' + (row.request?.aspectRatio ?? '默认') })
  return { path: relative, assetId: asset.id }
}

// ── 生视频（异步两段式）────────────────────────────────────────────────────

async function executeVideoRows(service, workspace, work, driver, section, uploads) {
  const rows = section.rows.filter(row => row.action === 'submit')
  const results = []
  for (const row of rows) {
    const prompt = String(row.request?.promptText ?? '')
    const fingerprint = fingerprintOf({
      kind: 'video',
      prompt,
      model: row.request?.model,
      resolution: row.request?.resolution,
      ratio: row.request?.ratio,
      duration: row.request?.duration,
      references: row.request?.referenceAssetIds ?? [],
    })
    const now = new Date().toISOString()
    // ① 占位条目。`status=submitting` + `task_id=null` 是「可能在跑」的危险条目。
    await appendLedgerEntry(work.dir, {
      kind: 'video',
      shot_id: row.id,
      fingerprint,
      fingerprint_algo: FINGERPRINT_ALGO,
      prompt_sha256: promptSha(prompt),
      model: row.request?.model,
      resolution: row.request?.resolution,
      ratio: row.request?.ratio,
      duration: row.request?.duration,
      references: row.request?.referenceAssetIds ?? [],
      cost_usd: row.request?.costUsd,
      cost_source: row.request?.costUsd === undefined ? 'unknown' : 'state.budget',
      status: 'submitting',
      task_id: null,
      submitted_at: now,
      trajectory: [{ status: 'submitting', at: now }],
    })
    try {
      const media = await prepareVideoMedia(work, row, uploads, driver)
      // ② 提交（付费，一次）。
      const submitted = await driver.submit({
        prompt,
        model: row.request?.model,
        durationSeconds: row.request?.duration,
        resolution: row.request?.resolution,
        ratio: row.request?.ratio,
        ...media,
      })
      // ③ 立刻回写 task_id —— 中断也查得到。
      await patchLedgerEntry(work.dir, { shotId: row.id, fingerprint }, {
        status: 'submitted',
        task_id: submitted.taskId,
      }, { status: 'submitted' })
      results.push({ kind: 'video', id: row.id, status: 'submitted', taskId: submitted.taskId })
    } catch (cause) {
      // **任何提交失败都不自动重试**：可能已经到达服务端。
      const message = cause instanceof Error ? cause.message : String(cause)
      const kind = cause instanceof McodeToolsError ? cause.kind : 'unknown'
      await patchLedgerEntry(work.dir, { shotId: row.id, fingerprint }, {
        status: 'failed',
        failure: message,
        failure_kind: kind,
        failed_at: new Date().toISOString(),
      }, { status: 'failed' })
      results.push({ kind: 'video', id: row.id, status: 'failed', error: message })
    }
  }
  return results
}

/** 关键帧优先；没有关键帧才用参考图（两者互斥，混用会被服务拒绝）。 */
async function prepareVideoMedia(work, row, uploads, driver) {
  const keyframes = (work.assets ?? []).filter(asset =>
    asset.type === 'keyframe' && asset.shot_id === row.id && asset.status !== 'deprecated')
  const byName = name => keyframes.find(asset => String(asset.path).toLowerCase().includes(name))
  const first = byName('first') ?? keyframes[0]
  const last = byName('last')
  if (first !== undefined) {
    const media = {}
    media.inputImage = await uploads.ref(driver, resolveWithin(work.dir, first.path), mimeForPath(first.path))
    if (last !== undefined && last.path !== first.path) {
      media.lastFrameImage = await uploads.ref(driver, resolveWithin(work.dir, last.path), mimeForPath(last.path))
    }
    return media
  }
  const references = []
  for (const assetId of row.request?.referenceAssetIds ?? []) {
    const asset = (work.assets ?? []).find(item => item.id === assetId)
    if (asset === undefined) continue
    references.push(await uploads.ref(driver, resolveWithin(work.dir, asset.path), mimeForPath(asset.path)))
  }
  return references.length > 0 ? { referenceImages: references } : {}
}

// ── 轮询（只读 + 落地，不重提）─────────────────────────────────────────────

/**
 * 轮询所有在途的视频任务。**单轮询器**，由调用方显式触发（不开后台定时器）。
 *
 * @param {any} service
 * @param {{id: string}} workspace
 * @param {any} work
 * @returns {Promise<object>}
 */
export async function pollGenerationTasks(service, workspace, work) {
  const { driver } = await driverFor(service, 'video', undefined)
  const doc = await readLedger(work.dir)
  const live = doc.entries.filter(entry => entry?.kind === 'video'
    && typeof entry?.task_id === 'string' && entry.task_id !== ''
    && ['submitting', 'submitted', 'running'].includes(entry.status))
  const results = []
  for (const entry of live) {
    const now = new Date().toISOString()
    try {
      const state = await driver.poll(entry.task_id, entry.model)
      if (state.status === 'succeeded' && state.nodeId !== undefined) {
        const saved = await saveVideo(work, entry, state, driver)
        await patchLedgerEntry(work.dir, { taskId: entry.task_id }, {
          status: 'succeeded',
          node_id: state.nodeId,
          file_name: state.fileName,
          output_path: saved.path,
          asset_id: saved.assetId,
          succeeded_at: now,
          last_query_at: now,
        }, { status: 'succeeded' })
        results.push({ shotId: entry.shot_id, taskId: entry.task_id, status: 'succeeded', assetId: saved.assetId, path: saved.path })
      } else if (state.status === 'failed' || state.status === 'cancelled') {
        await patchLedgerEntry(work.dir, { taskId: entry.task_id }, {
          status: 'failed', failure: state.failure ?? state.status, failed_at: now, last_query_at: now,
        }, { status: 'failed' })
        results.push({ shotId: entry.shot_id, taskId: entry.task_id, status: 'failed', error: state.failure ?? state.status })
      } else {
        await patchLedgerEntry(work.dir, { taskId: entry.task_id }, {
          status: state.status === 'unknown' ? entry.status : state.status,
          last_query_at: now,
        })
        results.push({ shotId: entry.shot_id, taskId: entry.task_id, status: state.status })
      }
    } catch (cause) {
      // 查询是幂等的（不花钱）：只记一笔，不重提、不判失败。
      results.push({
        shotId: entry.shot_id,
        taskId: entry.task_id,
        status: 'error',
        error: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }
  service.invalidateWork(work.dir)
  return {
    ok: true,
    workspace: { id: workspace.id },
    polled: results.length,
    results,
    summary: {
      succeeded: results.filter(row => row.status === 'succeeded').length,
      running: results.filter(row => ['queued', 'running'].includes(row.status)).length,
      failed: results.filter(row => row.status === 'failed').length,
      errors: results.filter(row => row.status === 'error').length,
    },
  }
}

/** 视频落地 + 登记 + 把这一版设成当前视频。 */
async function saveVideo(work, entry, state, driver) {
  const shot = (work.shots ?? []).find(item => item.id === entry.shot_id)
  if (shot === undefined) throw new Error(`镜头 ${entry.shot_id} 不存在，产物无法登记`)
  const versions = (work.assets ?? [])
    .filter(asset => asset.type === 'video' && asset.shot_id === shot.id)
    .map(asset => videoVersion(asset) ?? 0)
  const nextVersion = Math.max(Number(shot.current_version) || 0, ...versions) + 1
  const id = `${shot.id}_v${String(nextVersion).padStart(2, '0')}`
  const relative = `videos/${id}.mp4`
  const absolute = resolveWithin(work.dir, relative)
  await mkdir(dirname(absolute), { recursive: true })
  // 产物只保留 7 天：这里必须真的把文件拿下来。
  const downloaded = await driver.download(state.nodeId, absolute)
  const asset = await registerProductionAsset(work.dir, {
    id,
    type: 'video',
    path: relative,
    shotId: shot.id,
    version: nextVersion,
    source: 'mcode:' + (entry.model ?? 'MiniMax'),
  })
  // 生成完的状态：**已生成，未验收**。验收是另一件事（verify 阶段）。
  await writeShotFields(work.dir, shot.id, { current_version: nextVersion, status: 'succeeded' })
  return { path: relative, assetId: asset.id, bytes: downloaded.bytes }
}

// ── 小工具 ──────────────────────────────────────────────────────────────────

function mimeForPath(path) {
  const extension = extname(String(path)).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.heic') return 'image/heic'
  if (extension === '.heif') return 'image/heif'
  if (extension === '.mp4') return 'video/mp4'
  if (extension === '.mov') return 'video/quicktime'
  return 'image/jpeg'
}

function guessImageExtension(nodeId) {
  const text = String(nodeId ?? '').toLowerCase()
  if (text.includes('.png')) return '.png'
  if (text.includes('.webp')) return '.webp'
  return '.jpeg'
}

function slug(text) {
  return String(text ?? '').trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'image'
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
