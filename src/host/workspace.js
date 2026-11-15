/**
 * Workspace discovery and the in-memory model of one work.
 *
 * A **workspace** is one work directory holding the真源 JSON files:
 *
 *   <projectRoot>/workspaces/<work-id>/
 *     work.json        作品元信息
 *     state.json       状态机位置（阶段、预算）
 *     scenes.json      场次表（表演层真源：beats）
 *     shots.json       分镜表（分镜层真源：镜头字段）
 *     characters.json  角色表
 *     assets.json      资产索引（只增不删）
 *     ledger.json      生成台账（幂等三步的记账）
 *     prompts/slim/    提示词产物（可丢弃、可重编译）
 *     verify/          验收报告
 *
 * The plugin never writes these files directly: it goes through the work's own
 * CLI / compile scripts for derived fields, and only edits真源 fields
 * (beats, shot fields) in place.
 */
import { join } from 'node:path'
import {
  readJsonIfExists,
  readTextIfExists,
  writeJsonAtomic,
  writeTextAtomic,
  listDirIfExists,
  isDirectory,
} from './fsx.js'

/** Files that make a directory recognisable as a work directory. */
const WORK_MARKERS = ['work.json', 'scenes.json', 'shots.json']

/**
 * Discover every work under `projectRoot`.
 *
 * Both layouts are accepted: the contract layout (`workspaces/<work-id>/`) and
 * a work directory used directly as the project root. The first one wins
 * when both are present, because that is the layout the data contract defines.
 */
export async function discoverWorkspaces(projectRoot) {
  const found = []
  const workspacesDir = join(projectRoot, 'workspaces')
  const names = await listDirIfExists(workspacesDir)
  for (const name of names.sort()) {
    const dir = join(workspacesDir, name)
    if (!await isDirectory(dir)) continue
    if (!await looksLikeWork(dir)) continue
    found.push({ id: name, dir })
  }
  if (found.length === 0 && await looksLikeWork(projectRoot)) {
    found.push({ id: '', dir: projectRoot })
  }
  return found
}

/** Whether a directory holds at least one work marker file. */
async function looksLikeWork(dir) {
  for (const marker of WORK_MARKERS) {
    if (await readJsonIfExists(join(dir, marker)) !== undefined) return true
  }
  return false
}

/**
 * Read one work into memory.
 *
 * Every file is optional: a work that has not reached the storyboard stage
 * simply has no `shots.json`. Missing files become `undefined`, never throws.
 */
export async function loadWorkspace(dir) {
  const [work, state, scenesDoc, shotsDoc, charactersDoc, assetsDoc, ledgerDoc] = await Promise.all([
    readJsonIfExists(join(dir, 'work.json')),
    readJsonIfExists(join(dir, 'state.json')),
    readJsonIfExists(join(dir, 'scenes.json')),
    readJsonIfExists(join(dir, 'shots.json')),
    readJsonIfExists(join(dir, 'characters.json')),
    readJsonIfExists(join(dir, 'assets.json')),
    readJsonIfExists(join(dir, 'ledger.json')),
  ])
  const constitution = await readTextIfExists(join(dir, 'constitution.md'))
  const versions = await readTextIfExists(join(dir, 'VERSIONS.md'))
  const scenes = Array.isArray(scenesDoc?.scenes) ? scenesDoc.scenes : []
  const shots = Array.isArray(shotsDoc?.shots) ? shotsDoc.shots : []
  const characters = Array.isArray(charactersDoc?.characters) ? charactersDoc.characters : []
  const props = Array.isArray(charactersDoc?.props) ? charactersDoc.props : []
  const assets = Array.isArray(assetsDoc?.assets) ? assetsDoc.assets : []
  const ledger = Array.isArray(ledgerDoc?.entries) ? ledgerDoc.entries : []
  return {
    dir,
    id: typeof work?.work_id === 'string' ? work.work_id : (typeof state?.work_id === 'string' ? state.work_id : ''),
    title: typeof work?.title === 'string' ? work.title : '',
    work,
    state,
    scenes,
    shots,
    characters,
    props,
    assets,
    ledger,
    ledgerTotals: ledgerDoc?.totals,
    shotsRevision: typeof shotsDoc?.revision === 'string' ? shotsDoc.revision : undefined,
    constitution,
    versions,
  }
}

/**
 * Write the真源 beats of one scene back to `scenes.json`.
 *
 * Only the `beats` array of one scene is replaced; every other scene and
 * every other field of `scenes.json` is left byte-identical.
 */
export async function writeSceneBeats(dir, sceneId, beats) {
  const path = join(dir, 'scenes.json')
  const doc = await readJsonIfExists(path)
  if (doc === undefined) throw new Error(`${path} 不存在，无法写入`)
  const index = (doc.scenes ?? []).findIndex(scene => scene.id === sceneId)
  if (index < 0) throw new Error(`场次 ${sceneId} 不存在`)
  doc.scenes[index].beats = beats
  await writeJsonAtomic(path, doc)
}

/**
 * Write selected真源 fields of one shot back to `shots.json`.
 *
 * Refuses derived fields: `description_en` and `dialogue` are compile
 * outputs (see `compile_prompts.py`), and editing them would be silently
 * overwritten. The refusal is explicit so the user learns where truth lives.
 */
export const DERIVED_SHOT_FIELDS = ['description_en', 'dialogue']

export async function writeShotFields(dir, shotId, patch) {
  const path = join(dir, 'shots.json')
  const doc = await readJsonIfExists(path)
  if (doc === undefined) throw new Error(`${path} 不存在，无法写入`)
  const index = (doc.shots ?? []).findIndex(shot => shot.id === shotId)
  if (index < 0) throw new Error(`镜头 ${shotId} 不存在`)
  const derived = Object.keys(patch).filter(key => DERIVED_SHOT_FIELDS.includes(key))
  if (derived.length > 0) {
    throw new Error(`派生字段不可编辑：${derived.join('、')}（由编译生成，改了会被覆盖）`)
  }
  Object.assign(doc.shots[index], patch)
  await writeJsonAtomic(path, doc)
}

// ── 字段白名单与写入器（docs/API.md §8）─────────────────────────────────
//
// 导演能改哪些字段，是契约写死的（API.md §8.1）。插件只**执行**这份白名单，
// 不自己发明一份：名单就在这里，改契约就改这里。

/** 场次骨架可编辑字段（API.md §8.1 `edit-scene`）。 */
export const SCENE_EDITABLE_FIELDS = [
  'title', 'act', 'function', 'duration', 'summary', 'turn', 'characters',
]

/** 角色卡 / 道具卡可编辑字段（API.md §8.1 `edit-character`）。 */
export const CHARACTER_EDITABLE_FIELDS = [
  'name', 'role', 'age', 'appearance', 'behavior', 'voice',
  'states', 'props', 'reference_assets', 'voice_desc', 'delivery_default', 'prompt_label',
]

/** 资产可编辑字段（API.md §8.1 `edit-asset`）。 */
export const ASSET_EDITABLE_FIELDS = ['prompt', 'notes', 'state', 'tags', 'role']

/** 验收报告 `human` 段可编辑字段（数据契约 §9）。 */
export const VERIFY_HUMAN_FIELDS = ['verdict', 'reviewer', 'checked_frames', 'issues', 'note']

/** 表演层一拍可编辑字段（数据契约 §6）。 */
export const BEAT_EDITABLE_FIELDS = [
  'action', 'speaker', 'text', 'mode', 'delivery', 'delivery_en',
]

/**
 * Check a patch against a field whitelist.
 *
 * 三种拒绝都是**显式**的，因为它们都是「看起来改成了、其实没改」的陷阱：
 *  - **派生字段**（`description_en` / `dialogue`）由编译器拥有，写了会被覆盖；
 *  - **未知字段**直接丢掉的话，导演会以为改动生效了；
 *  - **空 patch**没有可保存的东西。
 *
 * @param {Record<string, unknown>} patch
 * @param {string[]} allowed 允许改的字段
 * @param {string} label 出错时说的对象（场次 / 角色 / 资产 / 拍 …）
 * @returns {Record<string, unknown>} 通过检查的 patch
 */
export function assertEditableFields(patch, allowed, label) {
  if (patch === undefined || patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('缺少 patch')
  }
  const keys = Object.keys(patch)
  if (keys.length === 0) throw new Error('没有要改的字段')
  const derived = keys.filter(key => DERIVED_SHOT_FIELDS.includes(key))
  if (derived.length > 0) {
    throw new Error(`派生字段不可编辑：${derived.join('、')}（由编译生成，改了会被覆盖）`)
  }
  const unknown = keys.filter(key => !allowed.includes(key))
  if (unknown.length > 0) {
    throw new Error(`未知字段：${unknown.join('、')}（${label}只允许改：${allowed.join('、')}）`)
  }
  return patch
}

/**
 * Write the editable fields of one scene back to `scenes.json`.
 *
 * Only the named fields of one scene change; every other field of that scene
 * and every other scene stays byte-identical.
 *
 * @param {string} dir
 * @param {string} sceneId
 * @param {Record<string, unknown>} patch
 * @returns {Promise<any>} the saved scene record
 */
export async function writeSceneFields(dir, sceneId, patch) {
  assertEditableFields(patch, SCENE_EDITABLE_FIELDS, '场次')
  const path = join(dir, 'scenes.json')
  const doc = await readJsonIfExists(path)
  if (doc === undefined) throw new Error(`${path} 不存在，无法写入`)
  const index = (doc.scenes ?? []).findIndex(scene => scene.id === sceneId)
  if (index < 0) throw new Error(`场次 ${sceneId} 不存在`)
  Object.assign(doc.scenes[index], patch)
  await writeJsonAtomic(path, doc)
  return doc.scenes[index]
}

/**
 * Write the editable fields of one character **or** one prop card.
 *
 * The two live in the same file (`characters.json`) under `characters` and
 * `props`, so one writer serves both; the id decides which list it is in.
 *
 * @param {string} dir
 * @param {string} characterId
 * @param {Record<string, unknown>} patch
 * @returns {Promise<any>} the saved character / prop record
 */
export async function writeCharacterFields(dir, characterId, patch) {
  assertEditableFields(patch, CHARACTER_EDITABLE_FIELDS, '角色')
  const path = join(dir, 'characters.json')
  const doc = await readJsonIfExists(path)
  if (doc === undefined) throw new Error(`${path} 不存在，无法写入`)
  const characters = Array.isArray(doc.characters) ? doc.characters : []
  const props = Array.isArray(doc.props) ? doc.props : []
  let target = characters.find(entry => entry.id === characterId)
  if (target === undefined) target = props.find(entry => entry.id === characterId)
  if (target === undefined) throw new Error(`角色或道具 ${characterId} 不存在`)
  Object.assign(target, patch)
  await writeJsonAtomic(path, doc)
  return target
}

/**
 * Write the editable fields of one asset back to `assets.json`.
 *
 * `assets.json` is append-only in the sense that records are never removed;
 * this only edits the notes-like fields of one record.
 *
 * @param {string} dir
 * @param {string} assetId
 * @param {Record<string, unknown>} patch
 * @returns {Promise<any>} the saved asset record
 */
export async function writeAssetFields(dir, assetId, patch) {
  assertEditableFields(patch, ASSET_EDITABLE_FIELDS, '资产')
  const path = join(dir, 'assets.json')
  const doc = await readJsonIfExists(path)
  if (doc === undefined) throw new Error(`${path} 不存在，无法写入`)
  const assets = Array.isArray(doc.assets) ? doc.assets : []
  const target = assets.find(entry => entry.id === assetId)
  if (target === undefined) throw new Error(`资产 ${assetId} 不存在`)
  Object.assign(target, patch)
  await writeJsonAtomic(path, doc)
  return target
}

/**
 * Write the `human` section of one verify report.
 *
 * The report is written by `drama verify` (the `tech` section) and by the
 * human reviewer (the `human` section). Only the `human` section is touched;
 * `tech` and `semantic` stay exactly as the tools left them.
 *
 * @param {string} dir
 * @param {string} shotId
 * @param {Record<string, unknown>} patch
 * @returns {Promise<any>} the saved `human` section
 */
export async function writeVerifyHuman(dir, shotId, patch) {
  assertEditableFields(patch, VERIFY_HUMAN_FIELDS, '验收报告的 human 段')
  const path = join(dir, 'verify', `${shotId}.report.json`)
  const doc = await readJsonIfExists(path)
  if (doc === undefined) throw new Error(`验收报告不存在：verify/${shotId}.report.json`)
  const human = { ...(doc.human ?? {}), ...patch }
  doc.human = human
  await writeJsonAtomic(path, doc)
  return human
}

/**
 * Write the creative brief (`creative/brief.md`).
 *
 * The brief is the conceive stage's only product; it is a plain text file,
 * so it is written as-is (no normalisation, no reformatting).
 *
 * @param {string} dir
 * @param {string} text
 * @returns {Promise<{path: string, bytes: number, words: number}>}
 */
export async function writeBrief(dir, text) {
  if (typeof text !== 'string') throw new Error('简报正文必须是字符串')
  const path = join(dir, 'creative', 'brief.md')
  await writeTextAtomic(path, text)
  return {
    path: 'creative/brief.md',
    bytes: Buffer.byteLength(text, 'utf8'),
    words: countWords(text),
  }
}

/** How many whitespace-separated tokens a text holds. */
export function countWords(text) {
  const trimmed = String(text ?? '').trim()
  if (trimmed === '') return 0
  return trimmed.split(/\s+/).length
}
