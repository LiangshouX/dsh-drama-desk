/**
 * 镜头封面 —— 网格卡片用的静帧。
 *
 * 解析顺序（`docs/API.md` §3.3）：
 *
 *   1. `<work>/keyframes/<shotId>.{png,jpg,jpeg}`
 *   2. `<work>/.frames/<shotId>.jpg`
 *   3. `<work>/frames/<shotId>.jpg`
 *   4. 该镜的视频资产 → ffmpeg 抽第 1 帧（`-ss 0.1`），缓存到 `.frames/`
 *   5. 都没有 → `undefined`（客户端画排版封面）
 *
 * **`.frames/` 是缓存目录，不是资产** —— 它不进 `assets.json`，可以随时删。
 * 缓存命中后直接读文件，不再跑 ffmpeg。
 *
 * 两条硬约束：
 *  - **ffmpeg 缺失不抛异常**，只是没有封面（返回 `undefined`）；
 *  - **镜头 id 必须像 id**（`/^[A-Za-z0-9_-]+$/`），否则路径可能越出作品目录。
 */
import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { isFile, resolveWithin, listFilesIfExists } from './fsx.js'

/** 允许出现在镜头 id 里的字符（防目录穿越）。 */
const SAFE_ID = /^[A-Za-z0-9_-]+$/

/** 关键帧目录（相对作品目录）。 */
const KEYFRAME_DIR = 'keyframes'

/** 帧目录（相对作品目录）。 */
const FRAME_DIR = 'frames'

/** 抽帧缓存目录（相对作品目录）。**不是资产**，不登记。 */
const CACHE_DIR = '.frames'

/** 静帧允许的扩展名。 */
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg']

/** 抽帧的超时（毫秒）。 */
const FFMPEG_TIMEOUT_MS = 60000

/**
 * 解析一镜的静帧。
 *
 * @param {any} work `loadWorkspace(dir)` 的返回
 * @param {string} shotId
 * @returns {Promise<{path: string, cached: boolean}|undefined>}
 *   `cached` 为 true 表示这个文件在 `.frames/` 缓存目录里（抽帧产物）。
 */
export async function resolvePoster(work, shotId) {
  if (!isSafeId(shotId)) return undefined
  const dir = work?.dir
  if (typeof dir !== 'string' || dir === '') return undefined

  // ① 关键帧
  for (const extension of IMAGE_EXTENSIONS) {
    const path = join(dir, KEYFRAME_DIR, `${shotId}.${extension}`)
    if (await isFile(path)) return { path, cached: false }
  }

  // ② 抽帧缓存
  const cached = join(dir, CACHE_DIR, `${shotId}.jpg`)
  if (await isFile(cached)) return { path: cached, cached: true }

  // ③ 帧目录
  const frame = join(dir, FRAME_DIR, `${shotId}.jpg`)
  if (await isFile(frame)) return { path: frame, cached: false }

  // ④ 从成片抽第一帧
  const video = await currentVideoAsset(work, shotId)
  if (video === undefined) return undefined
  let source
  try {
    source = resolveWithin(dir, video.path)
  } catch {
    return undefined
  }
  if (!await isFile(source)) return undefined
  try {
    await mkdir(join(dir, CACHE_DIR), { recursive: true })
  } catch {
    return undefined
  }
  if (!await extractFrame(source, cached)) return undefined
  return { path: cached, cached: true }
}

/**
 * 这一格的静帧来源。
 *
 * 优先用真的关键帧/帧文件；没有就用该镜的第一张参考图资产；再没有就
 * `undefined`——客户端画排版封面（镜号 + 标题 + 运镜 + 影调）。
 *
 * **不抽帧**：网格卡片不该因为看一眼就跑一次 ffmpeg。要抽帧请用
 * `resolvePoster`（那是 `/drama-desk/poster` 路由的事）。
 *
 * @param {any} work
 * @param {string} shotId
 * @returns {Promise<{kind:'file', path:string}|{kind:'asset', assetId:string}|undefined>}
 */
export async function resolvePosterSource(work, shotId) {
  if (!isSafeId(shotId)) return undefined
  const dir = work?.dir
  if (typeof dir !== 'string' || dir === '') return undefined

  for (const extension of IMAGE_EXTENSIONS) {
    const path = join(dir, KEYFRAME_DIR, `${shotId}.${extension}`)
    if (await isFile(path)) return { kind: 'file', path }
  }
  const frame = join(dir, FRAME_DIR, `${shotId}.jpg`)
  if (await isFile(frame)) return { kind: 'file', path: frame }
  const cached = join(dir, CACHE_DIR, `${shotId}.jpg`)
  if (await isFile(cached)) return { kind: 'file', path: cached }

  const shot = (Array.isArray(work?.shots) ? work.shots : []).find(entry => entry?.id === shotId)
  const references = Array.isArray(shot?.references) ? shot.references : []
  const assets = Array.isArray(work?.assets) ? work.assets : []
  const referenced = assets.filter(asset => typeof asset?.id === 'string' && references.includes(asset.id))
  const image = referenced.find(asset => asset?.type === 'reference_image')
    ?? referenced.find(asset => asset?.type === 'keyframe')
  if (image === undefined) return undefined
  return { kind: 'asset', assetId: image.id }
}

/**
 * 一批镜的封面来源——**三个目录各列一次**。
 *
 * 逐镜找封面是 72 镜 × 5 次串行探测（关键帧三种扩展名 + 帧目录 +
 * 抽帧缓存）= **360 次往返**，而那三个目录里根本没有几个文件。
 * 列一次目录就知道谁在：3 次往返回答 360 个问题。
 *
 * 优先级与 `resolvePosterSource` 完全一致（关键帧 → 帧目录 → 抽帧缓存
 * → 参考图资产），所以两者的答案不会打架。
 *
 * @param {any} work
 * @param {string[]} shotIds
 * @returns {Promise<Map<string, {kind:'file', path:string}|{kind:'asset', assetId:string}|undefined>>}
 */
export async function posterSourcesFor(work, shotIds) {
  const sources = new Map()
  const dir = work?.dir
  if (typeof dir !== 'string' || dir === '') return sources
  const ids = (Array.isArray(shotIds) ? shotIds : []).filter(id => typeof id === 'string' && id !== '')
  if (ids.length === 0) return sources

  const [keyframeNames, frameNames, cacheNames] = await Promise.all([
    listFilesIfExists(join(dir, KEYFRAME_DIR)),
    listFilesIfExists(join(dir, FRAME_DIR)),
    listFilesIfExists(join(dir, CACHE_DIR)),
  ])
  const keyframes = new Set(keyframeNames)
  const frames = new Set(frameNames)
  const caches = new Set(cacheNames)

  const assets = Array.isArray(work?.assets) ? work.assets : []
  const shotById = new Map((Array.isArray(work?.shots) ? work.shots : []).map(entry => [entry?.id, entry]))

  for (const id of ids) {
    if (!isSafeId(id)) {
      sources.set(id, undefined)
      continue
    }
    let found
    for (const extension of IMAGE_EXTENSIONS) {
      if (keyframes.has(`${id}.${extension}`)) {
        found = { kind: 'file', path: join(dir, KEYFRAME_DIR, `${id}.${extension}`) }
        break
      }
    }
    if (found === undefined && frames.has(`${id}.jpg`)) {
      found = { kind: 'file', path: join(dir, FRAME_DIR, `${id}.jpg`) }
    }
    if (found === undefined && caches.has(`${id}.jpg`)) {
      found = { kind: 'file', path: join(dir, CACHE_DIR, `${id}.jpg`) }
    }
    if (found === undefined) {
      const shot = shotById.get(id)
      const references = Array.isArray(shot?.references) ? shot.references : []
      const referenced = assets.filter(asset => typeof asset?.id === 'string' && references.includes(asset.id))
      const image = referenced.find(asset => asset?.type === 'reference_image')
        ?? referenced.find(asset?.type === 'keyframe')
      if (image !== undefined) found = { kind: 'asset', assetId: image.id }
    }
    sources.set(id, found)
  }
  return sources
}

/**
 * 用 ffmpeg 抽第一帧。
 *
 * 命令是**非交互**的：`-y` 覆盖、不问、只出一帧、输出 JPEG。
 * ffmpeg 不在 PATH 里时 `execFile` 只会带回一个错误，不会抛——这里把它
 * 变成「没抽到」。
 *
 * @returns {Promise<boolean>} 是否抽到了
 */
async function extractFrame(video, out) {
  const args = [
    '-y',
    '-ss', '0.1',
    '-i', video,
    '-frames:v', '1',
    '-vf', 'scale=768:-2',
    '-q:v', '4',
    out,
  ]
  const result = await new Promise(resolve => {
    execFile('ffmpeg', args, { timeout: FFMPEG_TIMEOUT_MS, windowsHide: true }, error => {
      resolve({ error })
    })
  })
  if (result.error !== null) return false
  return await isFile(out)
}

/** 一镜的当前视频资产（没有就 undefined）。 */
async function currentVideoAsset(work, shotId) {
  const assets = Array.isArray(work?.assets) ? work.assets : []
  const videos = assets.filter(asset => asset?.shot_id === shotId && asset?.type === 'video' && typeof asset?.path === 'string')
  if (videos.length === 0) return undefined
  const shot = (Array.isArray(work?.shots) ? work.shots : []).find(entry => entry?.id === shotId)
  const currentVersion = shot?.current_version
  const matched = videos.find(asset => versionOf(asset) === currentVersion)
  return matched ?? videos[videos.length - 1]
}

/** 资产属于第几版（`version` 字段或 `_v<NN>` 文件名）。 */
function versionOf(asset) {
  if (typeof asset?.version === 'number') return asset.version
  const match = /_v(\d+)$/.exec(typeof asset?.id === 'string' ? asset.id : '')
  if (match !== null) return Number(match[1])
  return undefined
}

/** 镜头 id 像不像 id。 */
function isSafeId(shotId) {
  return typeof shotId === 'string' && SAFE_ID.test(shotId)
}
