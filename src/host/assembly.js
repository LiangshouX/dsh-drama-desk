/** Local export orchestration. The media transformation lives in the bundled tool. */
import { execFile } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { readJsonIfExists, writeJsonAtomic, resolveWithin, isFile } from './fsx.js'
import { loadWorkspace } from './workspace.js'
import { currentVideo, isFinalVideo } from './media.js'
import { checkPrerequisite } from './stages.js'
import { TOOLS_DIR } from './paths.js'
import { appendRegisteredAsset } from './registration.js'

export const CUT_PROFILES = {
  landscape: { width: 1280, height: 720, label: '横屏 16:9' },
  portrait: { width: 720, height: 1280, label: '竖屏 9:16' },
  square: { width: 1080, height: 1080, label: '方形 1:1' },
}

// Only live process coordination; every durable status is read back from disk.
const runningCuts = new Map()
const assemblyOwner = randomUUID()

export async function assemblyPlan(work) {
  const gaps = [...checkPrerequisite('assemble', work).gaps]
  const warnings = []
  if (work.shots.length === 0) gaps.push('还没有分镜，无法装配空作品')
  const shots = []
  for (const shot of work.shots) {
    const asset = currentVideo(work, shot)
    const gapReasons = []
    let file
    if (!asset) gapReasons.push(`镜头 ${shot.id} 的当前版本 v${shot.current_version ?? '?'} 没有唯一有效的视频资产`)
    else {
      try { file = await stat(resolveWithin(work.dir, asset.path)) } catch { /* reported below */ }
      if (!file?.isFile()) gapReasons.push(`镜头 ${shot.id} 的当前视频文件不存在或路径无效`)
      if (shot.verified_asset_id && shot.verified_asset_id !== asset.id) gapReasons.push(`镜头 ${shot.id} 的验收对应旧版本，需要重新复核`)
      if (asset.has_audio !== true) warnings.push(`镜头 ${shot.id} 未登记音轨；导出时读取实际音轨，确实无声时补静音`)
    }
    gaps.push(...gapReasons)
    shots.push({ id: shot.id, scene: shot.scene, title: shot.title, status: shot.status,
      duration: shot.duration, version: shot.current_version, videoAssetId: asset?.id,
      path: asset?.path, hasAudio: asset?.has_audio === true, costUsd: asset?.cost_usd,
      bytes: file?.size, mtimeMs: file?.mtimeMs, gap: gapReasons.length > 0, gapReasons })
  }
  return { shots, gaps, warnings, ready: gaps.length === 0, fingerprint: cutFingerprint(shots) }
}

function cutFingerprint(shots) {
  return createHash('sha256').update(JSON.stringify(shots.map(s =>
    [s.id, s.version, s.videoAssetId, s.path, s.bytes, s.mtimeMs]))).digest('hex')
}

export async function assemblyJob(dir) {
  const job = await readJsonIfExists(join(dir, 'assembly', 'status.json'))
  if (!job) return undefined
  if (job.status === 'running' && job.owner !== assemblyOwner && !workerAlive(job.workerPid)) {
    return { ...job, status: 'interrupted', message: '宿主已重启，上次装配未完成。可以重新导出，旧成片保留。' }
  }
  return job
}

function workerAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false
  try { process.kill(pid, 0); return true } catch { return false }
}

export async function startAssembly(service, workspace, profile = 'landscape') {
  if (!Object.hasOwn(CUT_PROFILES, profile)) throw new Error('未知导出画幅')
  const existing = runningCuts.get(workspace.dir)
  if (existing) return existing.started
  const record = {}
  runningCuts.set(workspace.dir, record)
  record.started = (async () => {
    const prior = await assemblyJob(workspace.dir)
    if (prior?.status === 'running' && prior.owner !== assemblyOwner) {
      runningCuts.delete(workspace.dir)
      return { ok: true, job: prior }
    }
    const work = await loadWorkspace(workspace.dir)
    const plan = await assemblyPlan(work)
    if (!plan.ready) throw new Error('暂不能装配：' + plan.gaps.join('；'))
    const id = 'cut-' + Date.now().toString(36) + '-' + randomUUID().slice(0, 8)
    const job = { id, owner: assemblyOwner, status: 'running', profile, ...CUT_PROFILES[profile],
      createdAt: new Date().toISOString(), completed: 0, total: plan.shots.length,
      message: '正在准备本地装配', shots: plan.shots, fingerprint: plan.fingerprint,
      output: `finals/${id}.mp4`, manifest: `assembly/${id}/manifest.json` }
    await mkdir(join(workspace.dir, 'assembly', id), { recursive: true })
    await writeJsonAtomic(join(workspace.dir, 'assembly', 'status.json'), job)
    service.invalidateWork(workspace.dir)
    record.finished = finishAssembly(service, workspace, job).finally(() => runningCuts.delete(workspace.dir))
    // All failures are recorded in status.json by finishAssembly.
    record.finished.catch(() => {})
    return { ok: true, job }
  })().catch(error => { runningCuts.delete(workspace.dir); throw error })
  return record.started
}

async function finishAssembly(service, workspace, initial) {
  const statusPath = join(workspace.dir, 'assembly', 'status.json')
  try {
    await new Promise((resolve, reject) => {
      execFile('python', [join(TOOLS_DIR, 'assemble_cut.py'), workspace.dir, 'assembly/status.json'], {
        windowsHide: true, timeout: 3600000, maxBuffer: 1024 * 1024,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      }, (error, stdout, stderr) => error ? reject(new Error(stderr?.slice(-1600) || error.message)) : resolve())
    })
    const job = await readJsonIfExists(statusPath)
    if (job?.id !== initial.id || !job.result) throw new Error('装配产物记录不完整')
    const asset = {
      id: job.id, type: 'video', purpose: 'final', path: job.output,
      width: job.width, height: job.height, duration_sec: job.result.durationSec,
      bytes: job.result.bytes, sha256: job.result.sha256, has_audio: true,
      created_at: new Date().toISOString(), created_by: 'tool', source: 'ffmpeg-local-cut',
      cost_usd: 0, task_id: job.id, references: job.shots.map(s => s.videoAssetId),
      assembly_manifest: job.manifest, source_fingerprint: job.fingerprint,
    }
    await appendRegisteredAsset(workspace.dir, asset)
    job.status = 'succeeded'
    job.assetId = asset.id
    job.finishedAt = new Date().toISOString()
    job.message = '本地粗剪已登记，可前往交付页回看'
    await writeJsonAtomic(resolveWithin(workspace.dir, job.manifest), job)
    await writeJsonAtomic(statusPath, job)
  } catch (error) {
    const job = await readJsonIfExists(statusPath) ?? initial
    if (job.id === initial.id) {
      const toolMessage = job.status === 'failed' ? job.message : undefined
      job.status = 'failed'
      job.message = toolMessage || (error instanceof Error ? error.message : String(error))
      await writeJsonAtomic(statusPath, job)
    }
  } finally {
    service.invalidateWork(workspace.dir)
  }
}

export async function finalCuts(work) {
  const plan = await assemblyPlan(work)
  const finals = []
  for (const asset of work.assets.filter(isFinalVideo)) {
    let exists = false
    try { exists = await isFile(resolveWithin(work.dir, asset.path)) } catch { /* invalid path */ }
    finals.push({ assetId: asset.id, path: asset.path, bytes: asset.bytes,
      durationSec: asset.duration_sec, costUsd: asset.cost_usd, createdAt: asset.created_at,
      width: asset.width, height: asset.height, manifest: asset.assembly_manifest,
      exists, stale: !!asset.source_fingerprint && asset.source_fingerprint !== plan.fingerprint,
      confirmed: work.state?.delivery_asset_id === asset.id })
  }
  return finals.reverse()
}
