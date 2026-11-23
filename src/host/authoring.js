/** Add source records without asking directors to hand-edit JSON skeletons. */
import { join } from 'node:path'
import { readJsonIfExists, writeJsonAtomic } from './fsx.js'
import { SCENE_EDITABLE_FIELDS, CHARACTER_EDITABLE_FIELDS } from './workspace.js'

const authoringWrites = new Map()

export async function addProductionRecord(dir, options) {
  const previous = authoringWrites.get(dir) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(() => addRecord(dir, options))
  authoringWrites.set(dir, next)
  try { return await next } finally { if (authoringWrites.get(dir) === next) authoringWrites.delete(dir) }
}

async function addRecord(dir, { kind, sceneId, id, fields = {} }) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('fields 必须是对象')
  const file = kind === 'scene' ? 'scenes.json' : kind === 'shot' ? 'shots.json'
    : kind === 'character' || kind === 'prop' ? 'characters.json' : undefined
  if (!file) throw new Error('未知记录类型')
  const key = { scene: 'scenes', shot: 'shots', character: 'characters', prop: 'props' }[kind]
  const doc = await readJsonIfExists(join(dir, file)) ?? { version: '1.0' }
  const rows = doc[key] ?? []
  if (!Array.isArray(rows)) throw new Error(`${file} 的 ${key} 必须是数组`)
  const allowed = kind === 'scene' ? SCENE_EDITABLE_FIELDS : kind === 'shot'
    ? ['title', 'duration', 'camera', 'camera_en', 'ratio', 'resolution', 'lighting', 'characters', 'covers', 'references', 'motion_action', 'notes']
    : CHARACTER_EDITABLE_FIELDS
  const unknown = Object.keys(fields).filter(name => !allowed.includes(name))
  if (unknown.length) throw new Error('不允许设置字段：' + unknown.join('、'))
  let record
  if (kind === 'scene') {
    if (rows.length >= 99) throw new Error('场次编号已达到两位数上限')
    const nextId = 'SC' + String(rows.length + 1).padStart(2, '0')
    if (id && id !== nextId) throw new Error('下一场次编号应为 ' + nextId)
    record = { id: nextId, title: '', summary: '', turn: '', characters: [], beats: [], ...fields }
  } else if (kind === 'shot') {
    const scenes = (await readJsonIfExists(join(dir, 'scenes.json')))?.scenes ?? []
    if (!scenes.some(scene => scene.id === sceneId)) throw new Error('请先选择已存在的场次')
    const count = rows.filter(shot => shot.scene === sceneId).length
    if (count >= 99) throw new Error('镜头编号已达到两位数上限')
    const nextId = sceneId + '-SH' + String(count + 1).padStart(2, '0')
    if (id && id !== nextId) throw new Error('下一镜头编号应为 ' + nextId)
    record = { id: nextId, scene: sceneId, title: '', duration: 6, camera: 'Static', ratio: '16:9',
      resolution: '768P', characters: [], current_version: 1, status: 'pending', ...fields }
  } else {
    if (!/^[a-z][a-z0-9_]*$/.test(id ?? '')) throw new Error('角色 ID 使用小写英文、数字和下划线，以字母开头')
    if (kind === 'prop' && !id.startsWith('prop_')) throw new Error('道具 ID 以 prop_ 开头')
    if ([...(doc.characters ?? []), ...(doc.props ?? [])].some(row => row.id === id)) throw new Error('角色或道具 ID 已存在')
    record = { id, name: id, states: [], reference_assets: [], ...fields }
  }
  if (rows.some(row => row.id === record.id)) throw new Error('编号已存在，请先检查记录是否连续')
  rows.push(record)
  if (kind === 'shot') {
    const scenes = (await readJsonIfExists(join(dir, 'scenes.json')))?.scenes ?? []
    const rank = new Map(scenes.map((scene, index) => [scene.id, index]))
    rows.sort((a, b) => (rank.get(a.scene) ?? 999) - (rank.get(b.scene) ?? 999)
      || String(a.id).localeCompare(String(b.id)))
  }
  doc[key] = rows
  await writeJsonAtomic(join(dir, file), doc)
  return record
}
