/**
 * The **write side** of the Host half: every edit the director can make.
 *
 * Everything here follows the same three rules:
 *
 *  1. **只改被点名的那一个字段。** Read the whole JSON, mutate one record,
 *     write it back atomically. Every other field of that record — and
 *     every other record in the file — stays byte-identical.
 *  2. **派生字段是编译器拥有的。** `description_en` / `dialogue` are compile
 *     outputs; writing them is refused by name instead of being silently
 *     overwritten later.
 *  3. **路径永远出不了作品目录。** Every id that becomes a file name is
 *     fenced by a regex before it is used in a path.
 *
 * The stage machine has its own rule (docs/API.md §2.2): a write is never
 * lost because the stage machine refused the move. `commitStage` therefore
 * **never throws** — it reports whether the stage moved and why not.
 */
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { readJsonIfExists, writeJsonAtomic, writeTextAtomic, isAbsent } from './fsx.js'
import {
  writeSceneBeats,
  writeSceneFields,
  writeCharacterFields,
  writeAssetFields,
  writeVerifyHuman,
  writeBrief,
  assertEditableFields,
  countWords,
  BEAT_EDITABLE_FIELDS,
} from './workspace.js'
import { decideMove, summarizeGaps } from './stages.js'

/**
 * Ids that end up in a file name must look like this.
 *
 * No separators, no dots, no `..` — the fence between "a director typed an
 * id" and "the plugin wrote outside the work directory".
 */
const SAFE_ID = /^[A-Za-z0-9_-]+$/

/** The two modes a beat may declare for its line (data contract §6). */
const DIALOGUE_MODES = ['dialogue', 'voiceover']

// ── 阶段推进（docs/API.md §2.2）─────────────────────────────────────────

/**
 * Advance the committed stage to `stage`, but never fail the caller's write.
 *
 * Semantics (docs/API.md §2.2):
 *  - a ROLLBACK (target earlier than the current stage) is always allowed
 *    (the contract says rollbacks are free);
 *  - a FORWARD move is checked against the contract's prerequisites;
 *  - when the check fails the content is STILL saved — only the stage does not
 *    move, and the reason + gaps are reported back.
 *
 * @param {{dir: string, state: any, work: any, spec: any, stage: string}} input
 *   dir   — the work directory
 *   state — the current state.json document
 *   work  — the loaded work (for checkPrerequisite)
 *   spec  — the parsed spec (for decideMove)
 *   stage — the target stage id
 * @returns {Promise<{from: string, to: string, advanced: boolean,
 *   reason: string, gaps: string[], gapsSummary: string}>}
 */
export async function commitStage(input) {
  const dir = input?.dir
  if (typeof dir !== 'string' || dir === '') throw new Error('缺少作品目录')
  const to = input?.stage
  if (typeof to !== 'string' || to === '') throw new Error('缺少目标阶段')
  // state.json 是阶段层的真源；调用方给了就用它，没给就从盘上读。
  const state = input.state ?? (await readJsonIfExists(join(dir, 'state.json'))) ?? {}
  const from = typeof state.stage === 'string' && state.stage !== '' ? state.stage : 'conceive'
  const work = input.work ?? { dir }
  const spec = input.spec ?? {}
  // **已经在这一阶段**：内容保存了，进度也没变——那不是「没推进」，
  // 那就是「还在这里」。说成「没推进」会让人以为白干了。
  if (from === to) {
    return { from, to, advanced: true, reason: `已经在 ${to} 阶段（内容已保存）`, gaps: [], gapsSummary: '' }
  }
  const decision = decideMove(from, to, work, spec)
  if (!decision.allowed) {
    // 不推进，也不改 state.json —— 内容照旧保存，缺口说清楚。
    // `gaps` 是全量（agent 与阶段页要它）；`gapsSummary` 是给 toast 的一句话，
    // 上百条缺口逐条串出来会把界面盖住（见 stages.js 的 summarizeGaps）。
    const gaps = decision.gaps ?? []
    return { from, to, advanced: false, reason: decision.reason, gaps, gapsSummary: summarizeGaps(gaps) }
  }
  const next = {
    ...state,
    stage: to,
    updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  }
  if (next.work_id === undefined && typeof input.work?.id === 'string') {
    next.work_id = input.work.id
  }
  await writeJsonAtomic(join(dir, 'state.json'), next)
  const advancedGaps = decision.gaps ?? []
  return { from, to, advanced: true, reason: decision.reason, gaps: advancedGaps, gapsSummary: summarizeGaps(advancedGaps) }
}

// ── 字段编辑器（docs/API.md §8）─────────────────────────────────────────

/**
 * Edit the skeleton fields of one scene.
 *
 * @param {string} dir
 * @param {string} sceneId
 * @param {Record<string, unknown>} patch  // title|act|function|duration|summary|turn|characters
 * @returns {Promise<any>} the saved scene record
 */
export async function editSceneFields(dir, sceneId, patch) {
  return writeSceneFields(dir, sceneId, patch)
}

/**
 * Edit one character card **or** one prop card.
 *
 * @param {string} dir
 * @param {string} characterId   // a character id OR a prop id
 * @param {Record<string, unknown>} patch
 *   // name|role|age|appearance|behavior|voice|states|props|reference_assets
 *   // |voice_desc|delivery_default|prompt_label
 * @returns {Promise<any>} the saved character / prop record
 */
export async function editCharacterFields(dir, characterId, patch) {
  return writeCharacterFields(dir, characterId, patch)
}

/**
 * Write `creative/brief.md`.
 *
 * @param {string} dir
 * @param {string} text
 * @returns {Promise<{path: string, bytes: number, words: number}>}
 */
export async function editBrief(dir, text) {
  return writeBrief(dir, text)
}

/**
 * Patch one asset's editable fields inside assets.json.
 *
 * @param {string} dir
 * @param {string} assetId
 * @param {Record<string, unknown>} patch  // prompt|notes|state|tags|role
 * @returns {Promise<any>} the saved asset record
 */
export async function editAssetFields(dir, assetId, patch) {
  return writeAssetFields(dir, assetId, patch)
}

/**
 * Patch the `human` section of a verify report.
 *
 * @param {string} dir
 * @param {string} shotId
 * @param {Record<string, unknown>} patch  // verdict|reviewer|checked_frames|issues|note
 * @returns {Promise<any>} the saved `human` section
 */
export async function editVerifyReport(dir, shotId, patch) {
  return writeVerifyHuman(dir, shotId, patch)
}

// ── 表演层（数据契约 §6）────────────────────────────────────────────────

/**
 * Beat operations on one scene's `beats[]`.
 *
 *  patch  — replace the named beat's fields (allowed: action, speaker, text, mode, delivery, delivery_en)
 *  insert — insert a new beat at `toIndex` (1-based; default = append at end)
 *  delete — remove the beat at `beatIndex`
 *  move   — move the beat at `beatIndex` to `toIndex`
 *
 * @param {string} dir
 * @param {string} sceneId
 * @param {{op:'patch'|'insert'|'delete'|'move', beatIndex:number, toIndex?:number,
 *          patch?:Record<string, unknown>}} request
 * @returns {Promise<{sceneId:string, op:string, beatIndex:number, beats:any[]}>}
 */
export async function editBeatOp(dir, sceneId, request) {
  const op = request?.op
  if (op !== 'patch' && op !== 'insert' && op !== 'delete' && op !== 'move') {
    throw new Error(`未知的 beat 操作：${op ?? '（空）'}（可用：patch / insert / delete / move）`)
  }
  const path = join(dir, 'scenes.json')
  const doc = await readJsonIfExists(path)
  if (doc === undefined) throw new Error(`${path} 不存在，无法写入`)
  const scene = (doc.scenes ?? []).find(entry => entry.id === sceneId)
  if (scene === undefined) throw new Error(`场次 ${sceneId} 不存在`)
  const beats = Array.isArray(scene.beats) ? JSON.parse(JSON.stringify(scene.beats)) : []
  const total = beats.length
  let beatIndex = 0

  if (op === 'patch') {
    beatIndex = assertBeatIndex(request.beatIndex, total)
    const patch = request.patch
    assertEditableFields(patch, BEAT_EDITABLE_FIELDS, '拍')
    const next = { ...beats[beatIndex - 1], ...patch }
    if ('mode' in patch) next.mode = normalizeMode(patch.mode)
    assertDelivery(next)
    beats[beatIndex - 1] = next
  } else if (op === 'insert') {
    const toIndex = request.toIndex === undefined || request.toIndex === null
      ? total + 1
      : Number(request.toIndex)
    if (!Number.isInteger(toIndex) || toIndex < 1 || toIndex > total + 1) {
      throw new Error(`beat 序号越界：${request.toIndex}（该场次共 ${total} 拍）`)
    }
    const patch = request.patch
    if (patch !== undefined && patch !== null) {
      assertEditableFields(patch, BEAT_EDITABLE_FIELDS, '拍')
    }
    const beat = { ...(patch ?? {}) }
    // 新拍一律带 `mode`（没有台词就是 null），与契约 §6 的拍形态一致。
    beat.mode = 'mode' in beat ? normalizeMode(beat.mode) : null
    assertDelivery(beat)
    beats.splice(toIndex - 1, 0, beat)
    beatIndex = toIndex
  } else if (op === 'delete') {
    beatIndex = assertBeatIndex(request.beatIndex, total)
    beats.splice(beatIndex - 1, 1)
  } else {
    beatIndex = assertBeatIndex(request.beatIndex, total)
    const toIndex = Number(request.toIndex)
    if (!Number.isInteger(toIndex) || toIndex < 1 || toIndex > total) {
      throw new Error(`beat 序号越界：${request.toIndex}（该场次共 ${total} 拍）`)
    }
    const [moved] = beats.splice(beatIndex - 1, 1)
    beats.splice(toIndex - 1, 0, moved)
    beatIndex = toIndex
  }

  await writeSceneBeats(dir, sceneId, beats)
  return { sceneId, op, beatIndex, beats }
}

/**
 * Check a 1-based beat index against the number of beats in the scene.
 *
 * @param {number|undefined} index
 * @param {number} total
 * @returns {number} the checked index
 */
function assertBeatIndex(index, total) {
  const value = Number(index)
  if (!Number.isInteger(value) || value < 1 || value > total) {
    throw new Error(`beat 序号越界：${index}（该场次共 ${total} 拍）`)
  }
  return value
}

/**
 * Normalize and check a beat's `mode`.
 *
 * @param {unknown} mode
 * @returns {'dialogue'|'voiceover'|null}
 */
function normalizeMode(mode) {
  if (mode === undefined || mode === null) return null
  if (typeof mode === 'string' && DIALOGUE_MODES.includes(mode)) return mode
  throw new Error(`beat 的 mode 只能是 dialogue / voiceover / null（收到：${JSON.stringify(mode)}）`)
}

/**
 * A beat that speaks must carry its语气阶梯 (data contract §6).
 *
 * @param {any} beat
 */
function assertDelivery(beat) {
  if (beat.mode !== 'dialogue' && beat.mode !== 'voiceover') return
  const delivery = beat.delivery
  if (typeof delivery !== 'string' || delivery.trim() === '') {
    throw new Error('台词拍必须有 delivery（本句的语气阶梯）')
  }
}

// ── 提示词（docs/API.md §4.2 / §4.3）──────────────────────────────────

/**
 * Write one shot's manual prompt override + the artifact.
 *
 * 两处都写（API.md §4.2）：
 *  1. `prompts/slim/<shotId>.prompt.txt` —— 产物本体，界面立刻能看到；
 *  2. `prompts/overrides/<shotId>.prompt.txt` —— 手工覆盖，编译时优先。
 *
 * @param {string} dir
 * @param {string} shotId
 * @param {string} text
 * @returns {Promise<{shotId:string, path:string, overridePath:string, words:number}>}
 */
export async function writePromptOverride(dir, shotId, text) {
  assertSafeId(shotId, '镜头 id')
  if (typeof text !== 'string') throw new Error('提示词正文必须是字符串')
  await writeTextAtomic(join(dir, 'prompts', 'slim', `${shotId}.prompt.txt`), text)
  await writeTextAtomic(join(dir, 'prompts', 'overrides', `${shotId}.prompt.txt`), text)
  return {
    shotId,
    path: `prompts/slim/${shotId}.prompt.txt`,
    overridePath: `prompts/overrides/${shotId}.prompt.txt`,
    words: countWords(text),
  }
}

/**
 * Delete the manual override for one shot.
 *
 * 只删覆盖文件：产物本体留给编译重建（API.md §4.3 的「重编译」是
 * `service.compile()` 的活，不在这里偷偷做）。
 *
 * @param {string} dir
 * @param {string} shotId
 * @returns {Promise<{shotId:string, reset:boolean}>}
 *   `reset` is `true` when an override file was actually removed; `false`
 *   means there was nothing to remove (already clean).
 */
export async function resetPromptOverride(dir, shotId) {
  assertSafeId(shotId, '镜头 id')
  const path = join(dir, 'prompts', 'overrides', `${shotId}.prompt.txt`)
  let reset = false
  try {
    await rm(path)
    reset = true
  } catch (error) {
    if (!isAbsent(error)) throw error
  }
  return { shotId, reset }
}

/**
 * Refuse an id that would escape the work directory.
 *
 * @param {unknown} id
 * @param {string} label
 * @returns {string} the checked id
 */
function assertSafeId(id, label) {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) {
    throw new Error(`${label} 不合法：${id}（只允许字母、数字、下划线与连字符）`)
  }
  return id
}
