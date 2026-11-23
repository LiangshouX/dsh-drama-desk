/**
 * 阶段视图 —— 九个阶段各自的只读数据面板。
 *
 * 一个阶段视图回答一个问题：**「这一阶段此刻长什么样」**。界面渲染它，
 * agent 读它，两边看到的是同一份数据，所以它必须是**一份**实现。
 *
 * 三条纪律：
 *
 * 1. **只读。** 本模块不写作品目录、不推进状态机、不发起生成。
 *    （`posters.js` 的 `.frames/` 缓存是唯一的例外，见那个文件。）
 * 2. **不重述判定。** 阈值与规则正文只有一处真源（体检器与 `build/spec/`）。
 *    本模块的判定一律来自现有层：`service.beatQcFor(work)`（剧本表演层）、
 *    `service.pipeline()` 的格子（网格状态）、`service.check()`（提示词是否过期）、
 *    `stages.js` 的前置条件检查（缺口清单）。这里**一个阈值数字都没有**。
 * 3. **缺文件是空态，不是异常。** 作品还没走到某个阶段时，那个阶段的视图
 *    就是空的——界面显示「还没有」，而不是甩一个栈回溯给用户。
 */
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { readJsonIfExists, readTextIfExists, listDirIfExists, fileSize, isFile, resolveWithin, mapLimit } from './fsx.js'
import { checkPrerequisite } from './stages.js'
import { resolvePosterSource, posterSourcesFor } from './posters.js'
import { currentVideo, videoVersion } from './media.js'
import { assemblyPlan, assemblyJob, finalCuts } from './assembly.js'
import { generationBoard } from './generation.js'

/** 九个阶段视图的 kind（与数据契约 §4 的阶段枚举同序）。 */
export const STAGE_VIEWS = [
  'conceive',
  'outline',
  'characters',
  'script',
  'storyboard',
  'generate',
  'verify',
  'assemble',
  'deliver',
]

/** 提示词产物目录（相对作品目录）。 */
const PROMPT_DIR = join('prompts', 'slim')

/** 手工覆盖目录（相对作品目录）。 */
const OVERRIDE_DIR = join('prompts', 'overrides')

/** 资产提示词目录（相对作品目录）。 */
const REF_PROMPT_DIR = join('prompts', 'refs')

/**
 * 组一个阶段视图的数据。
 *
 * 返回的是 `docs/API.md` §1 里那个 kind 对应的 **data 载荷**
 * （信封 `{stage, revision, kind, data}` 由调用方套）。
 *
 * @param {{kind: string, work: any, service: any}} input
 *   kind   —— STAGE_VIEWS 里的一个
 *   work   —— `loadWorkspace(dir)` 的返回
 *   service —— DramaDeskService 实例（只读地用它的公开方法）
 * @returns {Promise<object>}
 */
export async function buildStageView(input) {
  const kind = input?.kind
  const work = input?.work
  const service = input?.service
  if (typeof kind !== 'string' || !STAGE_VIEWS.includes(kind)) {
    throw new Error(`未知阶段 ${kind}`)
  }
  if (work === undefined || work === null) throw new Error('没有可用的作品')
  switch (kind) {
    case 'conceive':
      return await conceiveView(work)
    case 'outline':
      return outlineView(work)
    case 'characters':
      return await charactersView(work)
    case 'script':
      return await scriptView(work, service)
    case 'storyboard':
      return await storyboardView(work, service)
    case 'generate':
      return await generateView(work, service)
    case 'verify':
      return await verifyView(work, service)
    case 'assemble':
      return await assembleView(work, service)
    case 'deliver':
      return await deliverView(work, service)
    default:
      throw new Error(`未知阶段 ${kind}`)
  }
}

/**
 * 读一镜的提示词产物与它的手工覆盖。
 *
 * 产物在 `prompts/slim/`，手工覆盖在 `prompts/overrides/`。
 * 覆盖存在时编译不会改写产物（见 `compile_prompts.py`），所以界面要能
 * 明确告诉导演「这一镜是手改过的」。
 *
 * @param {any} work
 * @param {string} shotId
 * @returns {Promise<{text: string|undefined, exists: boolean, path: string,
 *   overridden: boolean, overrideText: string|undefined, words: number}>}
 */
export async function readStagePrompt(work, shotId) {
  const dir = work?.dir
  const id = typeof shotId === 'string' ? shotId : ''
  const relativePath = `prompts/slim/${id}.prompt.txt`
  const relativeOverride = `prompts/overrides/${id}.prompt.txt`
  if (typeof dir !== 'string' || dir === '') {
    return {
      text: undefined,
      exists: false,
      path: relativePath,
      overridden: false,
      overrideText: undefined,
      words: 0,
    }
  }
  const text = await readTextIfExists(join(dir, PROMPT_DIR, `${id}.prompt.txt`))
  const overrideText = await readTextIfExists(join(dir, OVERRIDE_DIR, `${id}.prompt.txt`))
  return {
    text,
    exists: text !== undefined,
    path: relativePath,
    overridden: overrideText !== undefined,
    overrideText,
    words: countWords(text ?? ''),
  }
}

/**
 * 一批镜的提示词产物与人工覆盖——**一次读完**。
 *
 * 逐镜读是 144 次串行探测（72 镜 × 产物/覆盖两个目录），而覆盖目录
 * 往往是空的，那 72 次全是「文件不存在」的失败探测。失败探测也是往返，
 * 也是等待。
 *
 * 改成：两个目录各列一次（知道谁存在），只读真正存在的，而且并行读。
 * 72 镜的提示词产物：34 毫秒 → 个位数毫秒。
 *
 * @param {any} work
 * @param {string[]} shotIds
 * @returns {Promise<Map<string, {text: string|undefined, overridden: boolean, overrideText: string|undefined, words: number}>>}
 */
export async function readPromptIndex(work, shotIds) {
  const index = new Map()
  const dir = work?.dir
  if (typeof dir !== 'string' || dir === '') return index
  const ids = (Array.isArray(shotIds) ? shotIds : []).filter(id => typeof id === 'string' && id !== '')
  if (ids.length === 0) return index

  // 先列目录：知道哪些文件真的存在。
  const slimNames = new Set(await listDirIfExists(join(dir, PROMPT_DIR)))
  const overrideNames = new Set(await listDirIfExists(join(dir, OVERRIDE_DIR)))
  const wantSlim = ids.filter(id => slimNames.has(`${id}.prompt.txt`))
  const wantOverride = ids.filter(id => overrideNames.has(`${id}.prompt.txt`))

  const [slimTexts, overrideTexts] = await Promise.all([
    mapLimit(wantSlim, 16, async id => [id, await readTextIfExists(join(dir, PROMPT_DIR, `${id}.prompt.txt`))]),
    mapLimit(wantOverride, 16, async id => [id, await readTextIfExists(join(dir, OVERRIDE_DIR, `${id}.prompt.txt`))]),
  ])
  const slimMap = new Map(slimTexts)
  const overrideMap = new Map(overrideTexts)
  for (const id of ids) {
    const text = slimMap.get(id)
    const overrideText = overrideMap.get(id)
    index.set(id, {
      text,
      exists: text !== undefined,
      overridden: overrideText !== undefined,
      overrideText,
      words: countWords(text ?? ''),
    })
  }
  return index
}

/**
 * 一镜的**人话摘要** —— 「这一镜要表达什么」。
 *
 * 派生顺序（`docs/API.md` §1.5）：
 * `summary` → `description` → `motion_action` → 覆盖到的 beats 的动作行 → 空串。
 *
 * @param {any} work
 * @param {any} shot
 * @returns {string}
 */
export function shotSummary(work, shot) {
  if (shot === undefined || shot === null) return ''
  const direct = oneLine(shot.summary)
  if (direct !== '') return direct
  const description = oneLine(shot.description)
  if (description !== '') return description
  const motion = oneLine(shot.motion_action)
  if (motion !== '') return motion
  const scenes = Array.isArray(work?.scenes) ? work.scenes : []
  const scene = scenes.find(entry => entry?.id === shot.scene)
  const beats = Array.isArray(scene?.beats) ? scene.beats : []
  const covers = Array.isArray(shot.covers) ? shot.covers : []
  const parts = []
  for (const cover of covers) {
    const index = Number(cover)
    if (!Number.isInteger(index) || index < 1) continue
    const action = oneLine(beats[index - 1]?.action)
    if (action !== '') parts.push(action)
  }
  return parts.join('；')
}

// ── conceive ────────────────────────────────────────────────────────────────

/** 创意简报 + 作品元信息。 */
async function conceiveView(work) {
  const relative = 'creative/brief.md'
  const path = join(work.dir, 'creative', 'brief.md')
  const text = await readTextIfExists(path)
  const meta = work.work ?? {}
  return {
    brief: {
      exists: text !== undefined,
      path: relative,
      text: text ?? '',
      bytes: await fileSize(path),
      updatedAt: await modifiedAt(path),
    },
    work: {
      id: typeof work.id === 'string' ? work.id : (typeof meta.work_id === 'string' ? meta.work_id : ''),
      title: typeof meta.title === 'string' ? meta.title : (typeof work.title === 'string' ? work.title : ''),
      createdAt: typeof meta.created_at === 'string' ? meta.created_at : undefined,
      notes: typeof meta.notes === 'string' ? meta.notes : '',
    },
  }
}

// ── outline ─────────────────────────────────────────────────────────────────

/** 场次骨架。 */
function outlineView(work) {
  const scenes = []
  for (const scene of work.scenes ?? []) {
    scenes.push({
      id: scene?.id,
      index: scene?.index,
      act: scene?.act,
      title: scene?.title ?? '',
      function: scene?.function,
      duration: scene?.duration,
      summary: scene?.summary ?? '',
      turn: scene?.turn,
      characters: Array.isArray(scene?.characters) ? scene.characters : [],
      beatCount: Array.isArray(scene?.beats) ? scene.beats.length : 0,
    })
  }
  return { scenes }
}

// ── characters ──────────────────────────────────────────────────────────────

/** 角色卡 / 道具卡 + 每张参考图的提示词与参数。 */
async function charactersView(work) {
  const assets = Array.isArray(work.assets) ? work.assets : []
  const characters = []
  for (const character of work.characters ?? []) {
    const owned = assets.filter(asset => assetBelongsTo(asset, character?.id, character?.reference_assets))
      .sort((a, b) => Number(b.id === character?.reference_assets?.[0]) - Number(a.id === character?.reference_assets?.[0]))
    characters.push({
      id: character?.id,
      name: character?.name ?? '',
      role: character?.role,
      age: character?.age,
      appearance: character?.appearance,
      behavior: character?.behavior,
      voice: character?.voice,
      states: Array.isArray(character?.states) ? character.states : [],
      props: Array.isArray(character?.props) ? character.props : [],
      voice_desc: character?.voice_desc,
      delivery_default: character?.delivery_default,
      reference_assets: Array.isArray(character?.reference_assets) ? character.reference_assets : [],
      assets: await describeAssets(work, owned),
    })
  }
  const props = []
  for (const prop of work.props ?? []) {
    const owned = assets.filter(asset => assetBelongsTo(asset, prop?.id, prop?.reference_assets))
      .sort((a, b) => Number(b.id === prop?.reference_assets?.[0]) - Number(a.id === prop?.reference_assets?.[0]))
    props.push({
      id: prop?.id,
      name: prop?.name ?? '',
      appearance: prop?.appearance,
      owner: prop?.owner,
      reference_assets: Array.isArray(prop?.reference_assets) ? prop.reference_assets : [],
      assets: await describeAssets(work, owned),
    })
  }
  return { characters, props }
}

/**
 * 资产是不是这位角色/道具的。
 *
 * 两种登记方式都算数：`reference_assets` 里点名了它，或者它在 `assets.json`
 * 里的 `role` 就是这个角色 id。
 */
function assetBelongsTo(asset, ownerId, referenceAssets) {
  if (asset === undefined || asset === null) return false
  const references = Array.isArray(referenceAssets) ? referenceAssets : []
  if (typeof asset.id === 'string' && references.includes(asset.id)) return true
  if (typeof ownerId === 'string' && ownerId !== '' && asset.role === ownerId) return true
  return false
}

/** 资产的展示行（带提示词正文）。 */
async function describeAssets(work, assets) {
  const rows = []
  for (const asset of assets) {
    const prompt = await assetPrompt(work, asset)
    rows.push({
      id: asset?.id,
      type: asset?.type,
      path: asset?.path,
      role: asset?.role,
      state: asset?.state,
      tags: Array.isArray(asset?.tags) ? asset.tags : [],
      width: asset?.width,
      height: asset?.height,
      bytes: asset?.bytes,
      source: asset?.source,
      notes: asset?.notes,
      prompt,
      hasPrompt: prompt.trim() !== '',
      deprecated: asset?.status === 'deprecated',
    })
  }
  return rows
}

/**
 * 资产的生图提示词。
 *
 * 优先级（`docs/API.md` §1.3）：资产自身的 `prompt` 字段 →
 * `prompts/refs/<assetId>.prompt.txt` → 空串。
 */
async function assetPrompt(work, asset) {
  if (typeof asset?.prompt === 'string' && asset.prompt.trim() !== '') return asset.prompt
  const id = typeof asset?.id === 'string' ? asset.id : ''
  if (id === '') return ''
  const text = await readTextIfExists(join(work.dir, REF_PROMPT_DIR, `${id}.prompt.txt`))
  return text ?? ''
}

// ── script ──────────────────────────────────────────────────────────────────

/** 表演层：场次 + beats + 体检结论。 */
async function scriptView(work, service) {
  const beatQc = await beatQcOf(work, service)
  const scenes = []
  for (const scene of work.scenes ?? []) {
    const row = beatQc.get(scene?.id)
    scenes.push({
      id: scene?.id,
      title: scene?.title ?? '',
      duration: scene?.duration,
      summary: scene?.summary ?? '',
      qc: sceneQc(row),
      beats: (Array.isArray(scene?.beats) ? scene.beats : []).map((beat, index) => ({
        n: index + 1,
        action: beat?.action ?? '',
        speaker: beat?.speaker,
        text: beat?.text,
        mode: beat?.mode,
        delivery: beat?.delivery,
        issues: beatIssues(row, index + 1),
      })),
    })
  }
  return { scenes }
}

/** 场次级的体检摘要（数字直接来自体检器，插件不重算）。 */
function sceneQc(row) {
  if (row === undefined) {
    return {
      verdict: undefined,
      issues: [],
      reactionRate: undefined,
      silenceRatio: undefined,
      dialogueBeats: undefined,
      reactionBeats: undefined,
    }
  }
  return {
    verdict: row.verdict,
    issues: Array.isArray(row.issues) ? row.issues : [],
    reactionRate: row.reaction_rate,
    silenceRatio: row.silence_ratio,
    dialogueBeats: row.dialogue_beats,
    reactionBeats: row.reaction_beats,
  }
}

/**
 * 某一拍的体检问题。
 *
 * 全部来自 `beat_qc` 自己的逐拍分类（`anti_reaction` / `inert_action` /
 * `delivery_only` / `no_delivery` / `dup_delivery`）——插件只是把它们
 * 归拢到对应的拍上，**不重新判断任何一条**。
 */
function beatIssues(row, n) {
  if (row === undefined) return []
  const issues = []
  for (const item of row.anti_reaction ?? []) {
    if (item?.beat !== n) continue
    const words = Array.isArray(item.words) ? item.words.join('、') : ''
    issues.push(`否定式表演词：${words}`)
  }
  for (const item of row.inert_action ?? []) {
    if (item?.beat === n) issues.push('无可拍动作')
  }
  for (const item of row.delivery_only ?? []) {
    if (item?.beat === n) issues.push('只有语气没有动作')
  }
  for (const item of row.no_delivery ?? []) {
    if (item?.beat === n) issues.push('台词缺 delivery')
  }
  for (const item of row.dup_delivery ?? []) {
    const beats = Array.isArray(item?.beats) ? item.beats : []
    if (beats.includes(n)) issues.push('delivery 雷同')
  }
  return issues
}

// ── storyboard ──────────────────────────────────────────────────────────────

/** 分镜清单。 */
async function storyboardView(work, service) {
  const grid = await gridOf(work, service)
  const shots = []
  for (const shot of work.shots ?? []) {
    shots.push({
      id: shot?.id,
      scene: shot?.scene,
      index: shot?.index,
      title: shot?.title ?? '',
      duration: shot?.duration,
      ratio: shot?.ratio,
      resolution: shot?.resolution,
      model: shot?.model,
      camera: shot?.camera,
      camera_en: shot?.camera_en,
      lighting: shot?.lighting,
      characters: Array.isArray(shot?.characters) ? shot.characters : [],
      references: Array.isArray(shot?.references) ? shot.references : [],
      status: shot?.status,
      current_version: shot?.current_version,
      notes: shot?.notes ?? '',
      motion_action: shot?.motion_action ?? '',
      summary: shotSummary(work, shot),
      qc: shotQc(grid.cells.get(shot?.id)),
    })
  }
  return { shots, scenes: (work.scenes ?? []).map(scene => ({ id: scene.id, title: scene.title })) }
}

// ── generate ────────────────────────────────────────────────────────────────

/** 生成台：网格 + 产物。 */
async function generateView(work, service) {
  const grid = await gridOf(work, service)
  const beatQc = await beatQcOf(work, service)
  const promptIds = await promptIdsOf(work, service)
  // 一个提示词都没有时，「过期」没有意义，也不必为它起一个编译进程。
  const staleIds = promptIds.size === 0 ? undefined : await staleShotsOf(work, service)
  // 全片的提示词产物与人工覆盖，**一次读完**（不是逐镜两次串行探测）。
  const promptIndex = await readPromptIndex(work, (work.shots ?? []).map(entry => entry?.id))
  // 全片的封面来源，**三个目录各列一次**（不是逐镜五次串行探测）。
  const posterSources = await posterSourcesFor(work, (work.shots ?? []).map(entry => entry?.id))
  const scenes = []
  for (const scene of work.scenes ?? []) {
    const shots = []
    for (const shot of (work.shots ?? []).filter(entry => entry?.scene === scene?.id)) {
      shots.push(await generateShot(work, shot, grid, promptIds, staleIds, promptIndex, posterSources))
    }
    scenes.push({
      id: scene?.id,
      index: scene?.index,
      title: scene?.title ?? '',
      summary: scene?.summary ?? '',
      duration: scene?.duration,
      beatCount: Array.isArray(scene?.beats) ? scene.beats.length : 0,
      qc: sceneQc(beatQc.get(scene?.id)),
      shots,
    })
  }
  return {
    scenes,
    counts: grid.counts,
    // 生产看板：进度、在途、预算余量、剩余预估。与舞台视图同一份载荷，
    // 免得界面上再为「进度/开销」多发一次请求。
    board: generationBoard(work),
    specAvailable: await specAvailableOf(work, service, grid),
  }
}

/** 生成台里的一格。 */
async function generateShot(work, shot, grid, promptIds, staleIds, promptIndex, posterSources) {
  const prompt = promptIndex?.get(shot?.id) ?? await readStagePrompt(work, shot?.id)
  const video = currentVideoAsset(work, shot)
  const source = posterSources
    ? (posterSources.get(shot?.id) ?? undefined)
    : await resolvePosterSource(work, shot?.id)
  const row = {
    id: shot?.id,
    scene: shot?.scene,
    index: shot?.index,
    title: shot?.title ?? '',
    summary: shotSummary(work, shot),
    duration: shot?.duration,
    ratio: shot?.ratio,
    resolution: shot?.resolution,
    camera: shot?.camera,
    lighting: shot?.lighting,
    status: shot?.status,
    qc: shotQc(grid.cells.get(shot?.id)),
    prompt: {
      exists: promptIds.has(shot?.id) || prompt.exists,
      stale: staleIds === undefined ? undefined : staleIds.has(shot?.id),
      overridden: prompt.overridden,
      words: prompt.words,
    },
  }
  if (video !== undefined) {
    row.video = {
      assetId: video.id,
      bytes: video.bytes,
      durationSec: video.duration_sec,
      width: video.width,
      height: video.height,
    }
  }
  const poster = posterOf(shot, video, source)
  if (poster !== undefined) row.poster = poster
  return row
}

/**
 * 这一格的封面指向哪儿。
 *
 * 有真帧（关键帧/帧目录/抽帧缓存）或有成片 → `{shot}`：走
 * `/drama-desk/poster`，由它从关键帧或视频抽帧。
 * 否则用一张现成的参考图 → `{asset}`。
 * 都没有 → 不给这一项，客户端画排版封面。
 */
function posterOf(shot, video, source) {
  if (source !== undefined && source.kind === 'file') return { shot: shot?.id }
  if (video !== undefined) return { shot: shot?.id }
  if (source !== undefined && source.kind === 'asset') return { asset: source.assetId }
  return undefined
}

// ── verify ──────────────────────────────────────────────────────────────────

/** 验收：每镜的验收报告。 */
async function verifyView(work, service) {
  const grid = await gridOf(work, service)
  // 报告存在与否：**一次 readdir 拿全**，不是逐镜一次「文件不存在」的探测。
  const present = new Set(await listDirIfExists(join(work.dir, 'verify')))
  const shots = []
  for (const shot of work.shots ?? []) {
    const report = present.has(`${shot?.id}.report.json`)
      ? await readReport(work, shot?.id)
      : undefined
    const cell = grid.cells.get(shot?.id)
    shots.push({
      id: shot?.id,
      scene: shot?.scene,
      title: shot?.title ?? '',
      status: shot?.status,
      verdict: verdictOf(cell, report),
      videoAssetId: currentVideo(work, shot)?.id,
      currentVersion: shot.current_version,
      reportStale: report?.source_outdated === true,
      report: report === undefined ? undefined : describeReport(report),
      qc: shotQc(cell, report),
    })
  }
  return { shots }
}

/** 读一镜的验收报告；文件缺失或坏了都当「没有」。 */
async function readReport(work, shotId) {
  const id = typeof shotId === 'string' ? shotId : ''
  if (id === '') return undefined
  try {
    return await readJsonIfExists(join(work.dir, 'verify', `${id}.report.json`))
  } catch {
    return undefined
  }
}

/**
 * 验收报告的展示形状。
 *
 * 报告文件是数据契约 §9 的真源，字段是蛇形；界面要的是驼峰，所以这里
 * 只做**改名**，不改判定。
 */
function describeReport(report) {
  const tech = report?.tech
  const semantic = report?.semantic
  const human = report?.human
  const motion = report?.motion
  return {
    tech: tech === undefined ? undefined : {
      durationSec: pick(tech, 'duration_sec', 'durationSec'),
      width: tech.width,
      height: tech.height,
      ratioCheck: pick(tech, 'ratio_check', 'ratioCheck'),
      hasAudio: pick(tech, 'has_audio', 'hasAudio'),
      meanVolume: pick(tech, 'mean_volume', 'meanVolume'),
      maxVolume: pick(tech, 'max_volume', 'maxVolume'),
      pass: tech.pass,
    },
    semantic: semantic === undefined ? undefined : {
      note: semantic.note,
      dialogueMatch: pick(semantic, 'dialogue_match', 'dialogueMatch'),
      lipsync: semantic.lipsync,
      camera: semantic.camera,
      characterMatch: pick(semantic, 'character_match', 'characterMatch'),
    },
    human: human === undefined ? undefined : {
      verdict: human.verdict,
      reviewer: human.reviewer,
      checkedFrames: pick(human, 'checked_frames', 'checkedFrames') ?? [],
      issues: Array.isArray(human.issues) ? human.issues : [],
    },
    motion: motion === undefined ? undefined : {
      stillRatio: pick(motion, 'still_ratio', 'stillRatio'),
      motionRatio: pick(motion, 'motion_ratio', 'motionRatio', 'moving_ratio', 'movingRatio'),
      smoothness: motion.smoothness,
      amount: pick(motion, 'amount', 'total_motion_per_sec', 'totalMotionPerSec'),
      verdict: motion.verdict,
    },
  }
}

// ── assemble ────────────────────────────────────────────────────────────────

/** 装配：每镜的版本、缺口与总量。 */
async function assembleView(work, service) {
  const plan = await assemblyPlan(work)
  const job = await assemblyJob(work.dir)
  const rows = []
  for (const shot of plan.shots) {
    rows.push({ ...shot, versions: await videoVersions(work, work.shots.find(row => row.id === shot.id)) })
  }
  return { ...plan, shots: rows, job, totals: totalsOf(work), currentAssetId: job?.assetId }
}

/** 一镜登记过的所有视频版本（新的在前）。 */
async function videoVersions(work, shot) {
  const assets = Array.isArray(work?.assets) ? work.assets : []
  const id = shot?.id
  const videos = assets.filter(asset => asset?.shot_id === id && asset?.type === 'video')
  const rows = []
  for (const asset of videos) {
    rows.push({
      assetId: asset.id,
      version: videoVersion(asset),
      bytes: asset.bytes,
      durationSec: asset.duration_sec,
      width: asset.width,
      height: asset.height,
      createdAt: asset.created_at,
      source: asset.source,
      costUsd: asset.cost_usd,
      hasAudio: asset.has_audio === true,
      missing: !(await assetExists(work, asset)),
      current: currentVideo(work, shot)?.id === asset.id,
    })
  }
  rows.sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
  return rows
}

/** 资产登记的文件还在不在盘上。 */
async function assetExists(work, asset) {
  if (typeof asset?.path !== 'string' || asset.path === '') return false
  try {
    return await isFile(resolveWithin(work.dir, asset.path))
  } catch {
    return false
  }
}

/** 一镜的当前视频资产（没有就 undefined）。 */
function currentVideoAsset(work, shot) {
  return currentVideo(work, shot)
}

// ── deliver ─────────────────────────────────────────────────────────────────

/** 交付：登记成片与是否就绪。 */
async function deliverView(work, service) {
  const finals = await finalCuts(work)
  const plan = await assemblyPlan(work)
  const blockers = [...plan.gaps]
  if (!finals.some(row => row.exists && !row.stale)) blockers.push('没有可用的成片，请先完成本地装配')
  return { finals, totals: totalsOf(work), ready: blockers.length === 0, blockers }
}

// ── 共用 ────────────────────────────────────────────────────────────────────

/**
 * 网格上下文。
 *
 * 阶段视图里的状态、判定、角标**全部取自流水线的格子**——这样网格与阶段
 * 视图永远不会各说各话。网格读不出来时（作品还没到那一步）就空着。
 */
async function gridOf(work, service) {
  const empty = { cells: new Map(), scenes: new Map(), counts: emptyCounts(), specAvailable: false }
  if (service === undefined || typeof service.pipeline !== 'function') return empty
  try {
    const grid = await service.pipeline({ workspaceId: workspaceIdOf(work) })
    const cells = new Map()
    const scenes = new Map()
    for (const scene of grid?.scenes ?? []) {
      scenes.set(scene?.id, scene)
      for (const cell of scene?.shots ?? []) cells.set(cell?.id, cell)
    }
    return {
      cells,
      scenes,
      counts: grid?.counts ?? emptyCounts(),
      specAvailable: grid?.specAvailable === true,
    }
  } catch {
    return empty
  }
}

/** 剧本表演层的体检结果。 */
async function beatQcOf(work, service) {
  if (service === undefined || typeof service.beatQcFor !== 'function') return new Map()
  try {
    const rows = await service.beatQcFor(work)
    return rows instanceof Map ? rows : new Map()
  } catch {
    return new Map()
  }
}

/** 哪些镜有提示词产物。 */
async function promptIdsOf(work, service) {
  if (service !== undefined && typeof service.listPromptIds === 'function') {
    try {
      const ids = await service.listPromptIds(work.dir)
      if (ids instanceof Set) return ids
    } catch {
      // 落到下面的兜底。
    }
  }
  const names = await listDirIfExists(join(work.dir, PROMPT_DIR))
  const ids = new Set()
  for (const name of names) {
    if (!name.endsWith('.prompt.txt')) continue
    ids.add(name.slice(0, -'.prompt.txt'.length))
  }
  return ids
}

/**
 * 哪些镜的提示词产物过期了。
 *
 * 「过期」由编译器自己说（`service.check()` → `compile_prompts.py --check`，
 * 只校验不写盘）。读不到就返回 `undefined`——界面显示「未知」，不显示假的
 * 「没过期」。
 */
async function staleShotsOf(work, service) {
  if (service === undefined || typeof service.check !== 'function') return undefined
  try {
    const result = await service.check({ workspaceId: workspaceIdOf(work) })
    if (result?.ok !== true) return undefined
    return new Set(Array.isArray(result.staleShots) ? result.staleShots : [])
  } catch {
    return undefined
  }
}

/** 规范是否可用。 */
async function specAvailableOf(work, service, grid) {
  if (service !== undefined && typeof service.getSpec === 'function') {
    try {
      const spec = await service.getSpec()
      if (spec !== undefined && spec !== null) return spec.available === true
    } catch {
      // 落到下面。
    }
  }
  return grid.specAvailable
}

/** 镜头级的判定摘要。 */
function shotQc(cell, report) {
  return {
    verdict: verdictOf(cell, report),
    issues: issuesOf(cell, report),
  }
}

/**
 * 镜头判定：网格状态的大写形式。
 *
 * 网格的五种状态里只有三种是判定（`pass` / `fail` / `warn`），
 * 另外两种（未生成 / 已生成未体检）不是判定，所以没有 verdict。
 */
function verdictOf(cell, report) {
  if (report !== undefined && report.source_outdated !== true && typeof report?.verdict === 'string') {
    const verdict = report.verdict.toLowerCase()
    if (verdict === 'pass') return 'PASS'
    if (verdict === 'fail') return 'FAIL'
    if (verdict === 'warn') return 'WARN'
  }
  if (cell === undefined) return undefined
  if (cell.status === 'pass') return 'PASS'
  if (cell.status === 'fail') return 'FAIL'
  if (cell.status === 'warn') return 'WARN'
  return undefined
}

/** 镜头判定的问题清单。 */
function issuesOf(cell, report) {
  const issues = []
  for (const section of ['tech', 'semantic', 'human', 'motion']) {
    const rows = report?.[section]?.issues
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      if (typeof row === 'string' && row !== '') issues.push(row)
    }
  }
  if (issues.length === 0 && cell !== undefined) {
    for (const marker of cell.markers ?? []) {
      if (marker?.kind !== 'beat') continue
      if (typeof marker.detail === 'string' && marker.detail !== '') issues.push(marker.detail)
    }
  }
  if (issues.length === 0 && cell?.status === 'fail' && typeof cell.reason === 'string') {
    issues.push(cell.reason)
  }
  return issues
}

/**
 * 全片的总量：镜头数、秒数、花费。
 *
 * 秒数优先用成片的真实时长（登记在资产里的 `duration_sec`），没有成片时
 * 退回镜头的 `duration` 真源。花费取台账里的实际支出——重新生成不会重复计。
 */
function totalsOf(work) {
  let seconds = 0
  for (const shot of work?.shots ?? []) {
    const video = currentVideoAsset(work, shot)
    const value = Number(video?.duration_sec ?? shot?.duration)
    if (Number.isFinite(value)) seconds += value
  }
  let costUsd = 0
  for (const entry of work?.ledger ?? []) {
    const value = Number(entry?.cost_usd)
    if (Number.isFinite(value)) costUsd += value
  }
  if (costUsd === 0 && typeof work?.ledgerTotals?.cost_usd === 'number') {
    costUsd = work.ledgerTotals.cost_usd
  }
  return {
    shots: Array.isArray(work?.shots) ? work.shots.length : 0,
    seconds: round2(seconds),
    costUsd: round2(costUsd),
  }
}

/** 作品 id（给 service 用它自己的解析逻辑）。 */
function workspaceIdOf(work) {
  const id = work?.id
  return typeof id === 'string' && id !== '' ? id : undefined
}

/** 五种状态计数器，全部为零。 */
function emptyCounts() {
  return { none: 0, generated: 0, warn: 0, fail: 0, pass: 0 }
}

/** 取第一个有值的字段（蛇形/驼峰都认）。 */
function pick(source, ...keys) {
  if (source === undefined || source === null) return undefined
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key]
  }
  return undefined
}

/** 去重（保持顺序）。 */
function unique(rows) {
  const seen = new Set()
  const out = []
  for (const row of rows) {
    if (seen.has(row)) continue
    seen.add(row)
    out.push(row)
  }
  return out
}

/** 保留两位小数。 */
function round2(value) {
  return Math.round(value * 100) / 100
}

/** 折成一行（摘要要能塞进网格卡片）。 */
function oneLine(text) {
  if (typeof text !== 'string') return ''
  return text.replace(/\s+/g, ' ').trim()
}

/** 文件的修改时间；文件不存在就是 undefined。 */
async function modifiedAt(path) {
  try {
    const info = await stat(path)
    return new Date(info.mtimeMs).toISOString()
  } catch {
    return undefined
  }
}

/**
 * 提示词词数。
 *
 * 提示词正文是英文（模型要求），所以一个空白分词就是一个词；
 * 汉字按字计，免得中文正文算出个位数来。
 */
function countWords(text) {
  if (typeof text !== 'string' || text.trim() === '') return 0
  let count = 0
  for (const token of text.split(/\s+/)) {
    if (token === '') continue
    const han = token.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g)
    if (han !== null) {
      count += han.length
      const rest = token.replace(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g, ' ')
      for (const piece of rest.split(/\s+/)) {
        if (piece !== '') count += 1
      }
      continue
    }
    count += 1
  }
  return count
}
