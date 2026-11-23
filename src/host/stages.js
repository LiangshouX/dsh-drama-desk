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
import { resolveWithin } from './fsx.js'
import { currentVideo, isFinalVideo } from './media.js'

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
    const gaps = []
    if (work.shots.length === 0) gaps.push('还没有分镜')
    for (const shot of work.shots) {
      const video = currentVideo(work, shot)
      if (!video) gaps.push(`镜头 ${shot.id} 的当前版本没有唯一有效的视频资产`)
      else {
        try { if (!existsSync(resolveWithin(work.dir, video.path))) gaps.push(`镜头 ${shot.id} 的当前视频文件不存在`) }
        catch { gaps.push(`镜头 ${shot.id} 的当前视频路径无效`) }
      }
    }
    return gaps
  },
  assemble: work => {
    const gaps = []
    if (work.shots.length === 0) gaps.push('还没有分镜')
    for (const shot of work.shots) {
      if (shot.status !== 'verified') gaps.push(`镜头 ${shot.id} 的 status 是 ${shot.status ?? '（空）'}，不是 verified`)
    }
    return gaps
  },
  deliver: work => {
    const finals = work.assets.filter(isFinalVideo).filter(asset => {
      try { return existsSync(resolveWithin(work.dir, asset.path)) } catch { return false }
    })
    return finals.length === 0 ? ['没有已登记且文件存在的成片'] : []
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
 * 把一长串缺口收成**一句能读的话**。
 *
 * 72 镜的作品里，装配前置一次能产出上百条缺口：71 镜 ×（「status 不是 verified」
 * + 「没有唯一有效的视频资产」）。原样塞进 toast 或一句错误里，用户读到的是一堵
 * 没有重点的墙 —— 实测串出来 4000 多字符，toast 直接盖住整个面板。
 *
 * 所以：**去重 → 留前几条当例子 → 说清还有多少、涉及多少个镜头 / 场次**。
 * 完整清单仍然留在阶段页里（那里是列表，读得下）。
 *
 * @param {string[]} gaps
 * @param {{limit?: number}} [options]
 * @returns {string} 空数组返回空字符串
 */
export function summarizeGaps(gaps, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 3
  const unique = [...new Set((Array.isArray(gaps) ? gaps : []).map(String).filter(text => text.trim() !== ''))]
  if (unique.length === 0) return ''
  if (unique.length <= limit) return unique.join('；')
  const named = new Set()
  for (const gap of unique) {
    const match = /(?:镜头|场次)\s+([^\s，,。；;]+)/.exec(gap)
    if (match !== null) named.add(match[1])
  }
  const more = unique.length - limit
  const tail = named.size > 0
    ? `；……另有 ${more} 处（涉及 ${named.size} 个镜头 / 场次，完整清单在阶段页）`
    : `；……另有 ${more} 处`
  return unique.slice(0, limit).join('；') + tail
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
