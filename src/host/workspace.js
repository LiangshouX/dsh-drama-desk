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
