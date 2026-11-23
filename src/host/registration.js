/** Register a file already inside the work, deriving its hash and actual media metadata. */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { resolveWithin, readJsonIfExists, writeJsonAtomic } from './fsx.js'
import { videoVersion } from './media.js'

const probeMedia = promisify(execFile)
const registrationWrites = new Map()

export async function registerProductionAsset(dir, input) {
  if (!/^[A-Za-z0-9_-]+$/.test(input.id ?? '')) throw new Error('资产 ID 只允许字母、数字、下划线和连字符')
  if (!['reference_image', 'keyframe', 'video', 'audio', 'prompt', 'report', 'doc'].includes(input.type)) throw new Error('未知资产类型')
  if (typeof input.path !== 'string' || !input.path || input.path.includes('\\') || input.path.startsWith('/')) throw new Error('path 必须是作品内相对路径，使用 / 分隔')
  const absolute = resolveWithin(dir, input.path)
  const info = await stat(absolute)
  if (!info.isFile()) throw new Error('资产路径不是文件')
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(absolute)) hash.update(chunk)
  const asset = { id: input.id, type: input.type, path: input.path, bytes: info.size,
    sha256: hash.digest('hex'), created_at: new Date().toISOString(), created_by: 'human',
    source: typeof input.source === 'string' && input.source ? input.source : 'local-import',
    references: [], status: 'active' }
  if (input.role) asset.role = input.role
  if (input.shotId) asset.shot_id = input.shotId
  if (input.type === 'video' || input.type === 'audio') {
    const { stdout } = await probeMedia('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', absolute],
      { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 })
    const metadata = JSON.parse(stdout)
    const video = metadata.streams.find(row => row.codec_type === 'video')
    const audio = metadata.streams.some(row => row.codec_type === 'audio')
    if (input.type === 'video' && !video) throw new Error('该文件没有视频流')
    if (input.type === 'audio' && !audio) throw new Error('该文件没有音频流')
    Object.assign(asset, { duration_sec: Number(metadata.format.duration), has_audio: audio })
    if (video) Object.assign(asset, { width: video.width, height: video.height })
    if (input.type === 'video') {
      asset.version = videoVersion({ path: input.path, version: input.version })
      if (!Number.isInteger(asset.version) || asset.version < 1) throw new Error('请登记视频版本号，或使用 _vNN.mp4 文件名')
    }
  }
  return appendRegisteredAsset(dir, asset)
}

export async function appendRegisteredAsset(dir, asset) {
  const previous = registrationWrites.get(dir) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(async () => {
    const path = join(dir, 'assets.json')
    const doc = await readJsonIfExists(path) ?? { version: '1.0', assets: [] }
    if (doc.assets.some(row => row.id === asset.id)) throw new Error('资产 ID 已登记，请使用新 ID 保留版本')
    if (asset.shot_id) {
      const shots = (await readJsonIfExists(join(dir, 'shots.json')))?.shots ?? []
      if (!shots.some(shot => shot.id === asset.shot_id)) throw new Error('资产关联的镜头不存在')
    }
    doc.assets.push(asset)
    await writeJsonAtomic(path, doc)
    return asset
  })
  registrationWrites.set(dir, next)
  try { return await next } finally { if (registrationWrites.get(dir) === next) registrationWrites.delete(dir) }
}
