/** Character design: prepare a single-image request, then explicitly choose a reference. */
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { readJsonIfExists, writeJsonAtomic, resolveWithin, isFile } from './fsx.js'
import { writeCharacterFields } from './workspace.js'
import { probeChannels, generationPlan } from './generation.js'

const writes = new Map()

function ownerOf(work, id) {
  const entry = [...(work.characters ?? []), ...(work.props ?? [])].find(row => row.id === id)
  if (!entry) throw new Error('找不到这位人物或道具，请刷新后重试')
  return entry
}

export async function characterVisual(work, service, characterId) {
  const entry = ownerOf(work, characterId)
  const isProp = (work.props ?? []).some(row => row.id === characterId)
  const prompt = [
    isProp ? '为影视作品设计道具参考图。' : '为影视作品设计人物定妆照，单人，全身，面部清晰。',
    '主体：' + (entry.name || entry.id) + (entry.age ? '，' + entry.age : ''),
    entry.appearance ? '外形与服装：' + entry.appearance : '',
    '中性背景，均匀柔光，完整展示主体，保持外形与服装细节一致，画面中不出现文字。',
  ].filter(Boolean).join('\n')
  const requests = (await readJsonIfExists(join(work.dir, 'image-requests.json')))?.requests ?? []
  const latest = requests.filter(row => row.purpose === 'character-visual' && row.role === characterId).at(-1)
  const ledger = latest ? (work.ledger ?? []).filter(row => row.kind === 'image' && row.request_id === latest.id).at(-1) : undefined
  const channels = await probeChannels(service, { host: false })
  return { characterId, prompt, generator: channels.selection.image,
    paidExecution: service.config?.paidExecution !== 'off',
    latest: latest ? { request: latest, status: ledger?.status ?? 'prepared',
      assetId: ledger?.asset_id, error: ledger?.failure } : null }
}

/** Serialize request edits only; never queue paid execution. */
async function mutate(dir, action) {
  const previous = writes.get(dir) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(action)
  writes.set(dir, next)
  try { return await next } finally { if (writes.get(dir) === next) writes.delete(dir) }
}

export async function prepareCharacterVisual(work, service, workspaceId, input) {
  ownerOf(work, input.characterId)
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : ''
  if (!prompt) throw new Error('请先描述希望生成的形象')
  const area = input.area ?? '2K'
  const aspectRatio = input.aspectRatio ?? '3:4'
  if (!['1K', '2K', '4K'].includes(area)) throw new Error('请选择支持的图片清晰度')
  if (!['1:1', '3:4', '4:3', '9:16', '16:9'].includes(aspectRatio)) throw new Error('请选择支持的图片比例')
  const id = 'look-' + randomUUID()
  await mutate(work.dir, async () => {
    const path = join(work.dir, 'image-requests.json')
    const doc = await readJsonIfExists(path) ?? { version: '1.0', requests: [] }
    if (!Array.isArray(doc.requests)) throw new Error('图片任务清单无法读取，请先修复后重试')
    doc.requests.push({ id, prompt, area, aspectRatio, count: 1, role: input.characterId,
      purpose: 'character-visual', referenceAssetIds: [], created_at: new Date().toISOString() })
    await writeJsonAtomic(path, doc)
  })
  service.invalidateWork(work.dir)
  return { requestId: id, plan: await generationPlan(work, service, workspaceId, { imageRequests: [id], includePrompts: true }) }
}

export async function selectCharacterReference(work, input) {
  const entry = ownerOf(work, input.characterId)
  const asset = (work.assets ?? []).find(row => row.id === input.assetId)
  if (!asset || asset.type !== 'reference_image' || asset.status === 'deprecated'
    || (asset.role !== entry.id && !(entry.reference_assets ?? []).includes(asset.id))) {
    throw new Error('请选择属于这位人物或道具的有效参考图')
  }
  if (!await isFile(resolveWithin(work.dir, asset.path))) throw new Error('这张图片文件已丢失，无法设为参考图')
  await writeCharacterFields(work.dir, entry.id, { reference_assets: [asset.id] })
  return { ok: true, characterId: entry.id, assetId: asset.id }
}
