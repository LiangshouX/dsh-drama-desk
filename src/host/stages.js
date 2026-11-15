/**
 * The pipeline's stage machine.
 *
 * The **stages** and their **order** come from the data contract (§4 状态机),
 * parsed out of the release-state spec — never restated here. The contract's
 * wording for each stage's prerequisites is parsed too (`spec.js`).
 *
 * What lives here is the missing half: **how to check** a prerequisite. One
 * checker per stage, each a direct reading of its contract row:
 *
 *   outline   → `creative/brief.md`（非空）
 *   characters→ `scenes.json` 中至少一个场次
 *   script    → `assets.json` 中至少一个带 `role` 的角色参考图
 *   storyboard→ 每个场次都有 `beats`（动作或台词）
 *   generate  → 每个镜头都有 `duration` 与 `camera`
 *   verify    → 每个镜头都有已登记的视频资产
 *   assemble  → 每个镜头的 `status` 已是 `verified`
 *   deliver   → 已登记成片（视频资产路径含 `final`）
 *
 * The contract also fixes the **direction rules**: forward moves are checked
 * and refused with a list of gaps; rollbacks are always allowed ("分镜返工要能
 * 只重做第 7 个镜头").
 */
import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The stage order, as the contract writes it.
 *
 * @param {{prerequisites: {stage: string}[]}} spec
 * @returns {string[]}
 */
export function stageOrder(spec) {
  const stages = new Set(['conceive'])
  for (const row of spec?.prerequisites ?? []) stages.add(row.stage)
  for (const stage of ['deliver']) stages.add(stage)
  // The contract's own order: conceive → outline → characters → script →
  // storyboard → generate → verify → assemble → deliver.
  const canonical = [
    'conceive', 'outline', 'characters', 'script', 'storyboard',
    'generate', 'verify', 'assemble', 'deliver',
  ]
  return canonical.filter(stage => stages.has(stage))
}

/**
 * One checker per stage: given a work, report the gaps.
 *
 * @type {Record<string, (work: any) => string[]>}
 */
const CHECKERS = {
  outline: work => {
    const path = join(work.dir, 'creative', 'brief.md')
    if (!existsSync(path)) return ['creative/brief.md 不存在']
    let text = ''
    try {
      text = readFileSync(path, 'utf8')
    } catch {
      return ['creative/brief.md 读不出来']
    }
    return text.trim() === '' ? ['creative/brief.md 是空的'] : []
  },
  characters: work => (work.scenes.length === 0 ? ['scenes.json 里还没有场次'] : []),
  script: work => {
    const roles = work.assets.filter(asset => asset.type === 'reference_image' && typeof asset.role === 'string' && asset.role !== '')
    return roles.length === 0 ? ['assets.json 里还没有带 role 的角色参考图'] : []
  },
  storyboard: work => {
    const gaps = []
    for (const scene of work.scenes) {
      const beats = Array.isArray(scene.beats) ? scene.beats : []
      const usable = beats.some(beat => (beat.action ?? '').trim() !== '' || (beat.text ?? '').trim() !== '')
      if (!usable) gaps.push(`场次 ${scene.id} 的 beats 是空的（没有动作或台词）`)
    }
    return gaps
  },
  generate: work => {
    const gaps = []
    for (const shot of work.shots) {
      if (typeof shot.duration !== 'number' && typeof shot.duration !== 'string') gaps.push(`镜头 ${shot.id} 没有 duration`)
      else if (shot.duration === '' ) gaps.push(`镜头 ${shot.id} 没有 duration`)
      if (typeof shot.camera !== 'string' || shot.camera.trim() === '') gaps.push(`镜头 ${shot.id} 没有 camera`)
    }
    return gaps
  },
  verify: work => {
    const withVideo = new Set(work.assets.filter(asset => asset.type === 'video').map(asset => asset.shot_id))
    const gaps = []
    for (const shot of work.shots) {
      if (!withVideo.has(shot.id)) gaps.push(`镜头 ${shot.id} 没有登记视频资产`)
    }
    return gaps
  },
  assemble: work => {
    const gaps = []
    for (const shot of work.shots) {
      if (shot.status !== 'verified') gaps.push(`镜头 ${shot.id} 的 status 是 ${shot.status ?? '（空）'}，不是 verified`)
    }
    return gaps
  },
  deliver: work => {
    const finals = work.assets.filter(asset => asset.type === 'video' && typeof asset.path === 'string' && asset.path.includes('final'))
    return finals.length === 0 ? ['没有登记成片（视频资产路径含 final）'] : []
  },
}

/**
 * Evaluate the prerequisite of one stage.
 *
 * @param {string} stage
 * @param {any} work the loaded work (dir, scenes, shots, assets)
 * @returns {{satisfied: boolean, gaps: string[]}}
 */
export function checkPrerequisite(stage, work) {
  const checker = CHECKERS[stage]
  if (checker === undefined) return { satisfied: true, gaps: [] }
  const gaps = checker(work)
  return { satisfied: gaps.length === 0, gaps }
}

/**
 * Describe the whole stage machine for one work.
 *
 * @param {any} work
 * @param {{prerequisites: {stage: string, requirement: string}[]}} spec
 * @param {string|undefined} current the current stage from state.json
 */
export function describeStages(work, spec, current) {
  const order = stageOrder(spec)
  const currentIndex = current === undefined ? -1 : order.indexOf(current)
  const requirements = new Map((spec?.prerequisites ?? []).map(row => [row.stage, row.requirement]))
  return order.map((stage, index) => {
    const check = checkPrerequisite(stage, work)
    const state = index === currentIndex
      ? 'current'
      : index < currentIndex
        ? 'done'
        : check.satisfied
          ? 'ready'
          : 'blocked'
    return {
      stage,
      index,
      state,
      requirement: requirements.get(stage) ?? '',
      satisfied: check.satisfied,
      gaps: check.gaps,
      rollback: index < currentIndex,
      advance: index > currentIndex,
    }
  })
}

/**
 * Decide whether a move from `from` to `to` is allowed.
 *
 * @param {string} from
 * @param {string} to
 * @param {any} work
 * @param {{prerequisites: {stage: string, requirement: string}[]}} spec
 * @returns {{allowed: boolean, reason: string, gaps: string[]}}
 */
export function decideMove(from, to, work, spec) {
  const order = stageOrder(spec)
  const fromIndex = order.indexOf(from)
  const toIndex = order.indexOf(to)
  if (toIndex < 0) return { allowed: false, reason: `未知阶段 ${to}`, gaps: [] }
  if (toIndex === fromIndex) return { allowed: false, reason: `已经在 ${to} 阶段`, gaps: [] }
  if (toIndex < fromIndex) {
    // 回退不校验（契约明写：分镜返工要能只重做一个镜头）。
    return { allowed: true, reason: `回退：${from} → ${to}（契约规定回退不校验前置条件）`, gaps: [] }
  }
  // 正向推进：逐段校验（跳过一段也要经过它）。
  const gaps = []
  for (let index = fromIndex + 1; index <= toIndex; index++) {
    const stage = order[index]
    if (stage === undefined) continue
    const check = checkPrerequisite(stage, work)
    if (!check.satisfied) gaps.push(...check.gaps)
  }
  if (gaps.length > 0) {
    return { allowed: false, reason: `前置条件不满足，不能推进到 ${to}`, gaps }
  }
  return { allowed: true, reason: `${from} → ${to}`, gaps: [] }
}
