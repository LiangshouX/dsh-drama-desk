/**
 * The drama desk service — **one** implementation of every operation.
 *
 * Product rule (PRD §8.6): "一个操作，两个调用者" — the Host service method is
 * written once; the UI button and the agent tool both call it. No logic is
 * duplicated in the HTTP layer or in the tool layer.
 *
 * The service never becomes a second source of truth:
 *  - all state is read from the work's JSON files;
 *  - derived fields are never written directly (only the compiler writes them);
 *  - the parsed-file cache is invalidated by the file's own mtime and size,
 *    so it can never disagree with the disk.
 */
import { stat, statfs } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { readJsonIfExists, readTextIfExists, isFile, resolveWithin, writeJsonAtomic, listDirIfExists } from './fsx.js'
import { discoverWorkspaces, loadWorkspace, writeSceneBeats, writeShotFields, DERIVED_SHOT_FIELDS } from './workspace.js'
import { loadSpec, STAGES } from './spec.js'
import { runBeatQc, runMotionQc, runImageQc } from './qc.js'
import { runCompile } from './compile.js'
import { judgeRule } from './applicability.js'
import { resolveConfig, SPEC_DIR } from './paths.js'
import { resolveOutputRoot, resolveProjectRoot } from './locations.js'
import { describeStages, decideMove, stageOrder } from './stages.js'

/** The five QC colours, in the order the PRD defines them. */
export const STATUS_ORDER = ['none', 'generated', 'warn', 'fail', 'pass']

/**
 * How long the disk/asset figures stay cached.
 *
 * The top bar polls every few seconds; walking the assets tree and asking the
 * filesystem for free space on every poll is wasted work. Four seconds of
 * staleness on a number that moves slowly is a good trade.
 */
const DISK_CACHE_MS = 4000

/** Human labels for the five statuses. */
export const STATUS_LABELS = {
  none: '未生成',
  generated: '已生成未体检',
  warn: '有 WARN',
  fail: 'FAIL',
  pass: '通过',
}

/** Camera fields that mean "the camera does not move". */
const STATIC_CAMERA = /\bstatic\b|\blocked off\b|\bfixed\b/i

/** Camera fields that name an actual move. */
const MOVING_CAMERA = /push|pull|tilt|pan|truck|dolly|crane|arc|handheld|shake|zoom/i

export class DramaDeskService {
  /**
   * @param {object} options
   * @param {object} options.config resolved plugin config
   * @param {object} [options.ctx] the plugin context (optional services are used when present)
   */
  constructor(options) {
    this.config = resolveConfig(options.config)
    this.ctx = options.ctx
    /** Parsed-file cache: path → {mtimeMs, size, value}. Invalidated by the file itself. */
    this.cache = new Map()
    /** The work currently selected in the UI; `undefined` means "the first one". */
    this.selectedWorkspaceId = undefined
    /** Last spec load, keyed by model id. */
    this.specCache = new Map()
    /** Resolved locations, cached for the process lifetime. */
    this.locationCache = undefined
    /** Short-lived caches for the figures the top bar polls. */
    this.diskCache = undefined
    this.outputCache = undefined
    this.adapterCache = undefined
  }

  // ── locations ────────────────────────────────────────────────────────────

  /**
   * Where the project and the output live.
   *
   * Resolution order and the reasoning behind it live in `locations.js`; the
   * answer is cached because it costs one shell probe and cannot change while
   * the plugin runs.
   */
  async locations() {
    if (this.locationCache !== undefined) return this.locationCache
    const output = await resolveOutputRoot(this.config.outputRoot)
    const outputParent = dirname(output.path)
    const candidates = [
      this.ctx?.get?.('workingDirectory')?.defaultDirectory,
      process.cwd(),
      outputParent,
    ]
    const project = await resolveProjectRoot(this.config.projectRoot, candidates)
    this.locationCache = { project, output }
    return this.locationCache
  }

  /** The resolved project root. */
  async projectRoot() {
    return (await this.locations()).project.path
  }

  /** The resolved output root. */
  async outputRoot() {
    return (await this.locations()).output.path
  }

  // ── cache ────────────────────────────────────────────────────────────────

  /**
   * Read a JSON file through the derived cache.
   *
   * The cache entry carries the file's mtime and size; a changed file is read
   * again, so the cache can never become a second truth.
   */
  async cachedJson(path) {
    let info
    try {
      info = await stat(path)
    } catch {
      this.cache.delete(path)
      return undefined
    }
    const hit = this.cache.get(path)
    if (hit !== undefined && hit.mtimeMs === info.mtimeMs && hit.size === info.size) {
      return hit.value
    }
    const value = await readJsonIfExists(path)
    this.cache.set(path, { mtimeMs: info.mtimeMs, size: info.size, value })
    return value
  }

  /** Invalidate every cached read of one work directory. */
  invalidateWork(dir) {
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(dir)) this.cache.delete(key)
    }
  }

  // ── workspaces ───────────────────────────────────────────────────────────

  /** List the works discovered under the configured project root. */
  async listWorkspaces() {
    const found = await discoverWorkspaces(await this.projectRoot())
    const rows = []
    for (const entry of found) {
      const work = await this.cachedJson(join(entry.dir, 'work.json'))
      const state = await this.cachedJson(join(entry.dir, 'state.json'))
      rows.push({
        id: entry.id !== '' ? entry.id : (typeof work?.work_id === 'string' ? work.work_id : 'work'),
        dir: entry.dir,
        title: typeof work?.title === 'string' && work.title !== '' ? work.title : entry.id,
        stage: typeof state?.stage === 'string' ? state.stage : undefined,
        shots: typeof state?.shots_total === 'number' ? state.shots_total : undefined,
        scenes: typeof state?.scenes_total === 'number' ? state.scenes_total : undefined,
      })
    }
    return rows
  }

  /** Resolve the workspace a call refers to; `undefined` selects the first one. */
  async resolveWorkspace(workspaceId) {
    const rows = await this.listWorkspaces()
    if (rows.length === 0) return undefined
    if (workspaceId === undefined || workspaceId === null || workspaceId === '') {
      const remembered = rows.find(row => row.id === this.selectedWorkspaceId)
      return remembered ?? rows[0]
    }
    return rows.find(row => row.id === workspaceId) ?? rows[0]
  }

  // ── overview ─────────────────────────────────────────────────────────────

  /**
   * Everything the panel needs, in **one** round trip.
   *
   * The panel polls. Four endpoints means four HTTP round trips, four
   * JSON bodies to parse, four chances to interleave with the host
   * application's own traffic. One endpoint means one.
   *
   * Each section keeps its own `revision`, so the client can skip the
   * re-render of the parts that didn't change.
   */
  async snapshot(options = {}) {
    const [overview, pipeline, stages, settings] = await Promise.all([
      this.overview(),
      this.pipeline(options),
      this.stageState(options),
      this.settings(options),
    ])
    return { overview, pipeline, stages, settings }
  }

  /**
   * A cheap revision of the work's data.
   *
   * The panel polls every few seconds. If the answer were rebuilt into a new
   * object every time, the client would re-render the whole grid each round —
   * 45 cells destroyed and recreated, animations replayed, for **no change**.
   *
   * So the Host publishes a revision: the mtime + size of every file the
   * views depend on. The client compares it and **skips the re-render** when
   * nothing moved. That is the difference between a panel that costs nothing
   * and one that taxes the host application every few seconds.
   *
   * @param {string} dir the work directory
   * @returns {Promise<string>}
   */
  async revisionOf(dir) {
    const parts = []
    const files = [
      'work.json', 'state.json', 'scenes.json', 'shots.json',
      'characters.json', 'assets.json', 'ledger.json',
    ]
    for (const name of files) {
      try {
        const info = await stat(join(dir, name))
        parts.push(`${name}:${info.mtimeMs}:${info.size}`)
      } catch {
        parts.push(`${name}:-`)
      }
    }
    // 提示词产物与验收报告也会改变判定，所以它们的数量进版本号。
    parts.push(`prompts:${(await listDirIfExists(join(dir, 'prompts', 'slim'))).length}`)
    parts.push(`verify:${(await listDirIfExists(join(dir, 'verify'))).length}`)
    return parts.join('|')
  }

  /** Everything the top bar needs: paths, disk, works, spec availability. */
  async overview() {
    const workspaces = await this.listWorkspaces()
    const spec = await this.getSpec()
    const locations = await this.locations()
    const disk = await this.diskUsage(locations.output.path)
    const output = await this.outputUsage()
    return {
      projectRoot: locations.project.path,
      projectRootReason: locations.project.reason,
      projectRootSource: locations.project.source,
      outputRoot: locations.output.path,
      outputRootReason: locations.output.reason,
      outputRootSource: locations.output.source,
      // 顶栏会在每一轮轮询里被重新 setState。版本号让客户端能在
      // 「什么都没变」时**一次都不重渲染**——插件不给人添麻烦。
      revision: [
        locations.project.path,
        locations.output.path,
        this.config.model,
        spec.available ? 'spec' : 'nospec',
        workspaces.map(work => `${work.id}:${work.stage ?? ''}:${work.shots ?? ''}`).join(','),
      ].join('|'),
      onSystemDrive: {
        project: locations.project.onSystemDrive,
        output: locations.output.onSystemDrive,
      },
      warnings: buildLocationWarnings(locations),
      model: this.config.model,
      autoRefresh: this.config.autoRefresh,
      workspaces,
      selected: this.selectedWorkspaceId,
      specAvailable: spec.available,
      specHint: spec.available
        ? undefined
        : '规范未构建：请在插件仓库运行 node scripts/build.mjs（build/spec 缺失）',
      disk,
      output,
    }
  }

  /**
   * Free / total space of the volume that holds the output root.
   *
   * The output root may not exist yet (the user has not produced anything);
   * in that case the nearest existing ancestor carries the same volume, so
   * the number the director reads is still the right one.
   *
   * **Cached briefly.** Disk free space moves slowly; the top bar polls this
   * every few seconds, and a `statfs` per poll is wasted work on a busy disk.
   */
  async diskUsage(path) {
    const now = Date.now()
    const cached = this.diskCache
    if (cached !== undefined && cached.path === path && now - cached.at < DISK_CACHE_MS) {
      return cached.value
    }
    let target = path
    for (let depth = 0; depth < 32; depth++) {
      try {
        const info = await statfs(target)
        const total = Number(info.blocks) * Number(info.bsize)
        const free = Number(info.bavail) * Number(info.bsize)
        const used = Math.max(0, total - free)
        const value = {
          path,
          measuredAt: target,
          total,
          free,
          used,
          ratio: total > 0 ? used / total : 0,
        }
        this.diskCache = { path, at: now, value }
        return value
      } catch {
        const parent = dirname(target)
        if (parent === target) return undefined
        target = parent
      }
    }
    return undefined
  }

  /**
   * How much the current work occupies under its `assets/` directory.
   *
   * The walk is O(assets) and the top bar polls it, so the result is cached
   * with the same short TTL as the disk figure. A stale-by-4s number is fine;
   * re-walking 132 files on every poll is not.
   */
  async outputUsage() {
    const workspace = await this.resolveWorkspace(undefined)
    if (workspace === undefined) return undefined
    const now = Date.now()
    const cached = this.outputCache
    if (cached !== undefined && cached.key === workspace.dir && now - cached.at < DISK_CACHE_MS) {
      return cached.value
    }
    const root = join(workspace.dir, 'assets')
    let bytes = 0
    let files = 0
    const walk = async dir => {
      const { readdir } = await import('node:fs/promises')
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(path)
          continue
        }
        try {
          bytes += (await stat(path)).size
          files += 1
        } catch {
          // 读不到就跳过。
        }
      }
    }
    await walk(root)
    const value = { root, bytes, files }
    this.outputCache = { key: workspace.dir, at: now, value }
    return value
  }

  // ── spec ─────────────────────────────────────────────────────────────────

  /** Load (and cache) the release-state spec for the configured model. */
  async getSpec() {
    const model = this.config.model
    const hit = this.specCache.get(model)
    if (hit !== undefined) return hit
    const spec = await loadSpec(model)
    this.specCache.set(model, spec)
    return spec
  }

  // ── pipeline ─────────────────────────────────────────────────────────────

  /**
   * The pipeline grid: rows are scenes, columns are shots.
   *
   * Cell colour comes from the checkers' own verdict lines (PRD §6.1):
   *   灰 未生成      台账无记录
   *   蓝 已生成未体检  有产物，无报告
   *   黄 有 WARN     主判据过、次判据未过
   *   红 FAIL        任一 FAIL 线未过
   *   绿 通过        全部判定线过
   */
  async pipeline(options = {}) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) {
      return { workspace: undefined, scenes: [], counts: emptyCounts(), specAvailable: false }
    }
    this.selectedWorkspaceId = workspace.id
    const data = await this.loadWork(workspace.dir)
    const beatQc = await this.beatQcFor(data)
    const spec = await this.getSpec()
    const byScene = new Map()
    for (const shot of data.shots) {
      const list = byScene.get(shot.scene) ?? []
      list.push(shot)
      byScene.set(shot.scene, list)
    }
    const scenes = []
    const counts = emptyCounts()
    // 提示词产物是否存在：一次 readdir 拿全，不是每镜一次 stat。
    const promptIds = new Set(await this.listPromptIds(data.dir))
    for (const scene of data.scenes) {
      const sceneQc = beatQc.get(scene.id)
      const shots = []
      for (const shot of (byScene.get(scene.id) ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
        const cell = await this.buildCell(data, scene, shot, sceneQc, promptIds.has(shot.id))
        counts[cell.status] = (counts[cell.status] ?? 0) + 1
        shots.push(cell)
      }
      scenes.push({
        id: scene.id,
        index: scene.index,
        title: scene.title ?? '',
        function: scene.function,
        duration: scene.duration,
        summary: scene.summary,
        beatCount: Array.isArray(scene.beats) ? scene.beats.length : 0,
        qc: sceneQc === undefined ? undefined : {
          verdict: sceneQc.verdict,
          issues: sceneQc.issues,
          reactionRate: sceneQc.reaction_rate,
          silenceRatio: sceneQc.silence_ratio,
          dialogueBeats: sceneQc.dialogue_beats,
          reactionBeats: sceneQc.reaction_beats,
        },
        shots,
      })
    }
    return {
      workspace: { id: workspace.id, title: workspace.title, dir: workspace.dir },
      revision: await this.revisionOf(workspace.dir),
      stage: data.state?.stage,
      stages: STAGES,
      scenes,
      counts,
      specAvailable: spec.available,
    }
  }

  /**
   * The ids of the shots that have a prompt artifact.
   *
   * One `readdir` instead of one `stat` per shot: the grid polls, and 45 stats
   * per poll is the kind of thing that makes a plugin feel heavy.
   *
   * @param {string} dir the work directory
   * @returns {Promise<Set<string>>}
   */
  async listPromptIds(dir) {
    const slim = join(dir, 'prompts', 'slim')
    const names = await listDirIfExists(slim)
    const ids = new Set()
    for (const name of names) {
      if (!name.endsWith('.prompt.txt')) continue
      ids.add(name.slice(0, -'.prompt.txt'.length))
    }
    return ids
  }

  /** Build one grid cell: status, reason, and the markers a director needs. */
  async buildCell(data, scene, shot, sceneQc, promptExists) {
    const ledger = newestLedgerFor(data.ledger, shot.id)
    const report = await this.cachedJson(join(data.dir, 'verify', `${shot.id}.report.json`))
    const markers = []
    let status = 'none'
    let reason = '台账无记录'
    if (ledger !== undefined) {
      status = 'generated'
      reason = '已生成，尚无体检报告'
      if (report !== undefined && typeof report.verdict === 'string') {
        const verdict = report.verdict.toLowerCase()
        if (verdict === 'pass') {
          status = 'pass'
          reason = '验收报告判定通过'
        } else if (verdict === 'fail') {
          status = 'fail'
          reason = `验收报告判定失败：${summarizeIssues(report.tech ?? report.semantic ?? report.human)}`
        } else if (verdict === 'warn') {
          status = 'warn'
          reason = '验收报告判定 WARN'
        }
      }
    }
    if (sceneQc !== undefined && sceneQc.verdict === 'FAIL') {
      markers.push({ kind: 'beat', label: '表演层 FAIL', detail: truncate(sceneQc.issues.join('；'), 120) })
    }
    if (typeof shot.status === 'string' && shot.status !== '' && shot.status !== 'succeeded') {
      markers.push({ kind: 'status', label: shot.status, detail: '' })
    }
    if (typeof shot.notes === 'string' && shot.notes.trim() !== '') {
      markers.push({ kind: 'notes', label: '有批注', detail: truncate(shot.notes.trim(), 120) })
    }
    if (!promptExists) markers.push({ kind: 'prompt', label: '无提示词产物', detail: '' })
    const references = Array.isArray(shot.references) ? shot.references : []
    return {
      id: shot.id,
      index: shot.index,
      title: shot.title ?? '',
      duration: shot.duration,
      camera: shot.camera,
      status,
      statusLabel: STATUS_LABELS[status],
      reason,
      markers,
      referenceCount: references.length,
      hasPrompt: promptExists,
      ledgerStatus: ledger?.status,
      costUsd: ledger?.cost_usd,
    }
  }

  // ── shot detail ──────────────────────────────────────────────────────────

  /**
   * One shot in full: 真源 (beats, camera fields), 产物 (prompt, frames),
   * 判定 (checkers), 规则 (rules in force).
   */
  async shot(options) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) throw new Error('没有可用的作品：projectRoot 下没有找到作品目录')
    const data = await this.loadWork(workspace.dir)
    const shot = data.shots.find(entry => entry.id === options.shotId)
    if (shot === undefined) throw new Error(`镜头 ${options.shotId} 不存在`)
    const scene = data.scenes.find(entry => entry.id === shot.scene)
    const beatQc = await this.beatQcFor(data)
    const sceneQc = beatQc.get(shot.scene)
    const promptText = await readTextIfExists(join(data.dir, 'prompts', 'slim', `${shot.id}.prompt.txt`))
    const report = await this.cachedJson(join(data.dir, 'verify', `${shot.id}.report.json`))
    const spec = await this.getSpec()
    const subject = this.buildSubject(data, scene, shot, promptText, report)
    const rules = spec.rules.map(rule => {
      const judged = judgeRule(rule, subject)
      return {
        id: rule.id,
        title: rule.title,
        stages: rule.stages,
        evidence: rule.evidence,
        evidenceLabel: rule.evidenceLabel,
        body: rule.body,
        applicable: judged.applicable,
        reason: judged.reason,
      }
    })
    const qc = await this.shotQc(data, scene, shot, sceneQc, subject)
    const assets = await this.assetsOf(data, shot)
    return {
      workspace: { id: workspace.id, title: workspace.title, dir: workspace.dir },
      shot: {
        ...shot,
        derivedFields: DERIVED_SHOT_FIELDS,
      },
      scene: scene === undefined ? undefined : {
        id: scene.id,
        title: scene.title,
        duration: scene.duration,
        summary: scene.summary,
        beats: scene.beats ?? [],
      },
      prompt: promptText === undefined ? undefined : {
        text: promptText,
        sections: splitPromptSections(promptText),
        path: relative(data.dir, join(data.dir, 'prompts', 'slim', `${shot.id}.prompt.txt`)),
      },
      report: report ?? undefined,
      qc,
      rules,
      assets,
      ledger: newestLedgerFor(data.ledger, shot.id),
    }
  }

  /** Build the predicate subject used by the rule applicability layer. */
  buildSubject(data, scene, shot, promptText, report) {
    const sceneBeats = Array.isArray(scene?.beats) ? scene.beats : []
    const covers = Array.isArray(shot.covers) ? shot.covers : []
    const beats = covers
      .map(index => sceneBeats[index - 1])
      .filter(beat => beat !== undefined)
    const dialogue = Array.isArray(shot.dialogue)
      ? shot.dialogue
      : beats.filter(beat => beat.mode === 'dialogue' || beat.mode === 'voiceover')
    const camera = typeof shot.camera === 'string' ? shot.camera : ''
    const motion = typeof shot.motion_action === 'string' ? shot.motion_action : ''
    const references = Array.isArray(shot.references) ? shot.references : []
    const imageAssets = data.assets.filter(asset => asset.id !== undefined && references.includes(asset.id))
    const videoAssets = data.assets.filter(asset => asset.shot_id === shot.id && asset.type === 'video')
    return {
      shot,
      scene,
      beats,
      dialogue,
      prompt: promptText,
      promptMentionsStatic: promptText !== undefined
        && /static camera|never moves|nothing else moves|completely static/i.test(promptText),
      hasImage: imageAssets.length > 0,
      hasVideo: videoAssets.length > 0,
      hasQc: report !== undefined,
      ledger: newestLedgerFor(data.ledger, shot.id),
      cameraMove: MOVING_CAMERA.test(camera) && !STATIC_CAMERA.test(camera),
      bigAction: motion.trim() !== '' && /走|起身|转身|推|拉|递|放|拿起|放下|坐下|站起|转身|伸手/.test(motion),
    }
  }

  /** The QC section of a shot: report + beat layer + motion layer + reference images. */
  async shotQc(data, scene, shot, sceneQc, subject) {
    const layers = []
    if (sceneQc !== undefined) {
      layers.push({
        checker: 'beat_qc',
        title: '剧本表演层',
        scope: scene?.id,
        verdict: sceneQc.verdict,
        metrics: [
          { name: '反应拍覆盖率', value: sceneQc.reaction_rate, threshold: '≥ 0.50' },
          { name: '沉默占比', value: sceneQc.silence_ratio, threshold: '参考' },
          { name: '台词拍', value: sceneQc.dialogue_beats, threshold: '—' },
          { name: '反应拍', value: sceneQc.reaction_beats, threshold: '—' },
        ],
        issues: sceneQc.issues,
        available: true,
      })
    } else {
      layers.push({
        checker: 'beat_qc',
        title: '剧本表演层',
        scope: scene?.id,
        verdict: undefined,
        metrics: [],
        issues: [],
        available: false,
        unavailableReason: '本镜所属场次没有体检结果',
      })
    }
    const videos = data.assets.filter(asset => asset.shot_id === shot.id && asset.type === 'video' && typeof asset.path === 'string')
    const existingVideos = []
    for (const asset of videos) {
      if (await isFile(resolveWithin(data.dir, asset.path))) existingVideos.push(asset)
    }
    if (existingVideos.length > 0) {
      const paths = existingVideos.map(asset => resolveWithin(data.dir, asset.path))
      const result = await runMotionQc(paths)
      if (result.ok) {
        for (const report of result.data.reports) {
          if (report.verdict === 'ERROR') {
            layers.push({
              checker: 'motion_qc',
              title: '画面运动质量',
              scope: report.video,
              verdict: undefined,
              metrics: [],
              issues: [],
              available: false,
              unavailableReason: `体检失败：${(report.issues ?? []).join('；')}`,
            })
            continue
          }
          layers.push({
            checker: 'motion_qc',
            title: '画面运动质量',
            scope: report.video,
            verdict: report.verdict,
            metrics: [
              { name: '近乎静止帧', value: report.still_ratio, threshold: '≤ 0.70' },
              { name: '有效运动帧', value: report.moving_ratio, threshold: '≥ 0.40' },
              { name: '累计运动量/秒', value: report.total_motion_per_sec, threshold: '≥ 8.0' },
              { name: '方向平滑占比', value: report.smoothness, threshold: '≥ 0.30（仅参考）' },
            ],
            issues: report.issues ?? [],
            available: true,
          })
        }
      } else {
        layers.push({
          checker: 'motion_qc',
          title: '画面运动质量',
          scope: existingVideos[0].path,
          verdict: undefined,
          metrics: [],
          issues: [],
          available: false,
          unavailableReason: result.error,
        })
      }
    }
    const images = data.assets.filter(asset => asset.shot_id === shot.id && asset.type === 'reference_image' && typeof asset.path === 'string')
    if (images.length > 0) {
      const result = await runImageQc(images.map(asset => resolveWithin(data.dir, asset.path)))
      if (result.ok) {
        for (const row of result.data.rows) {
          layers.push({
            checker: 'image_qc',
            title: '参考图质量',
            scope: row.file,
            verdict: (row.verdicts ?? []).length === 0 ? 'pass' : 'fail',
            metrics: [
              { name: '平均饱和度', value: row.sat_mean, threshold: '≥ 0.28' },
              { name: '平均明度', value: row.value_mean, threshold: '≤ 195' },
              { name: '低饱和区 p10', value: row.sat_p10, threshold: '≥ 0.05' },
              { name: '色彩贫乏度', value: row.colorfulness, threshold: '≥ 0.12' },
            ],
            issues: row.verdicts ?? [],
            available: true,
          })
        }
      } else {
        layers.push({
          checker: 'image_qc',
          title: '参考图质量',
          scope: images.map(asset => asset.id).join(', '),
          verdict: undefined,
          metrics: [],
          issues: [],
          available: false,
          unavailableReason: result.error,
        })
      }
    }
    return {
      layers,
      subject: {
        dialogueBeats: subject.dialogue.length,
        cameraMove: subject.cameraMove,
        bigAction: subject.bigAction,
        hasVideo: subject.hasVideo,
        hasImage: subject.hasImage,
      },
    }
  }

  // ── rules ────────────────────────────────────────────────────────────────

  /** The contract view: every rule, its evidence, and where it applies. */
  async rules(options = {}) {
    const spec = await this.getSpec()
    const stage = options.stage
    const rules = spec.rules.map(rule => ({
      id: rule.id,
      title: rule.title,
      stages: rule.stages,
      evidence: rule.evidence,
      evidenceLabel: rule.evidenceLabel,
      body: rule.body,
      inStage: stage === undefined || rule.stages.includes(stage),
    }))
    return {
      available: spec.available,
      model: spec.model,
      hint: spec.available ? undefined : '规范未构建：请在插件仓库运行 node scripts/build.mjs',
      rules,
      constitution: spec.constitution,
      contract: spec.contract,
      checklist: spec.checklist,
      sources: spec.sources,
    }
  }

  // ── assets ───────────────────────────────────────────────────────────────

  /** The asset index, with the reference graph and storage cost. */
  async assets(options = {}) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) return { workspace: undefined, assets: [], totals: undefined }
    const data = await this.loadWork(workspace.dir)
    const rows = []
    for (const asset of data.assets) {
      let missing = true
      if (typeof asset.path === 'string' && asset.path !== '') {
        missing = !await isFile(resolveWithin(data.dir, asset.path))
      }
      rows.push({
        id: asset.id,
        type: asset.type,
        path: asset.path,
        status: asset.status ?? 'active',
        role: asset.role,
        state: asset.state,
        shotId: asset.shot_id,
        bytes: asset.bytes,
        width: asset.width,
        height: asset.height,
        ratio: asset.ratio,
        sha256: asset.sha256,
        createdAt: asset.created_at,
        deprecatedReason: asset.deprecated_reason,
        notes: asset.notes,
        referencedBy: data.shots
          .filter(shot => Array.isArray(shot.references) && shot.references.includes(asset.id))
          .map(shot => shot.id),
        missing,
      })
    }
    const totals = {
      count: rows.length,
      bytes: rows.reduce((sum, row) => sum + (typeof row.bytes === 'number' ? row.bytes : 0), 0),
      deprecated: rows.filter(row => row.status === 'deprecated').length,
      missing: rows.filter(row => row.missing).length,
    }
    return { workspace: { id: workspace.id, title: workspace.title, dir: workspace.dir }, assets: rows, totals }
  }

  /** The assets one shot references or owns. */
  async assetsOf(data, shot) {
    const references = Array.isArray(shot.references) ? shot.references : []
    return data.assets
      .filter(asset => (asset.id !== undefined && references.includes(asset.id)) || asset.shot_id === shot.id)
      .map(asset => ({
        id: asset.id,
        type: asset.type,
        path: asset.path,
        status: asset.status ?? 'active',
        role: asset.role,
        bytes: asset.bytes,
        width: asset.width,
        height: asset.height,
        shotId: asset.shot_id,
        deprecatedReason: asset.deprecated_reason,
      }))
  }

  // ── ledger ───────────────────────────────────────────────────────────────

  /** The generation ledger: every task, its cost, and its state. */
  async ledger(options = {}) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) return { workspace: undefined, entries: [], totals: undefined }
    const data = await this.loadWork(workspace.dir)
    const entries = data.ledger.map(entry => ({
      taskId: entry.task_id,
      shotId: entry.shot_id,
      model: entry.model,
      resolution: entry.resolution,
      duration: entry.duration,
      ratio: entry.ratio,
      status: entry.status,
      submittedAt: entry.submitted_at,
      lastQueryAt: entry.last_query_at,
      costUsd: entry.cost_usd,
      nodeId: entry.node_id,
      outputPath: entry.output_path,
      referenceCount: Array.isArray(entry.references) ? entry.references.length : 0,
      promptSha256: entry.prompt_sha256,
    }))
    const cost = entries.reduce((sum, entry) => sum + (typeof entry.costUsd === 'number' ? entry.costUsd : 0), 0)
    return {
      workspace: { id: workspace.id, title: workspace.title, dir: workspace.dir },
      entries,
      totals: {
        ...(data.ledgerTotals ?? {}),
        costUsd: cost,
        tasks: entries.length,
      },
      budget: data.state?.budget,
    }
  }

  // ── stage machine ────────────────────────────────────────────────────────

  /**
   * The stage machine for one work: where it is, what each stage needs.
   *
   * The stage list and the prerequisite wording come from the data contract;
   * the "satisfied / gaps" answers come from `stages.js`.
   */
  async stageState(options = {}) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) return { workspace: undefined, stages: [], current: undefined }
    const data = await this.loadWork(workspace.dir)
    const spec = await this.getSpec()
    const current = typeof data.state?.stage === 'string' ? data.state.stage : undefined
    return {
      workspace: { id: workspace.id, title: workspace.title, dir: workspace.dir },
      revision: await this.revisionOf(workspace.dir),
      stage: data.state?.stage,
      stages: describeStages(data, spec, current),
      order: stageOrder(spec),
      updatedAt: data.state?.updated_at,
    }
  }

  /**
   * Move the work to another stage.
   *
   * Forward moves are checked against the contract's prerequisites and refused
   * with the concrete gaps; rollbacks are always allowed (the contract says so
   * out loud). `state.json` is the state layer — the CLI owns it, so the
   * plugin writes it the same way the CLI would, and nothing else.
   */
  async setStage(options) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) throw new Error('没有可用的作品')
    const data = await this.loadWork(workspace.dir)
    const spec = await this.getSpec()
    const from = typeof data.state?.stage === 'string' ? data.state.stage : 'conceive'
    const to = options.stage
    const decision = decideMove(from, to, data, spec)
    if (!decision.allowed) {
      const error = new Error(decision.reason)
      error.gaps = decision.gaps
      throw error
    }
    const state = data.state ?? { version: '1.0', work_id: workspace.id }
    const next = {
      ...state,
      stage: to,
      updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    }
    await writeJsonAtomic(join(workspace.dir, 'state.json'), next)
    this.invalidateWork(workspace.dir)
    return { ok: true, from, to, reason: decision.reason, gaps: decision.gaps }
  }

  // ── settings ─────────────────────────────────────────────────────────────

  /**
   * The plugin's own settings, plus what the host contributes.
   *
   * The host's model selection comes from `agentDefaultModel` (the same
   * service the composer uses), so the panel shows the model the agent is
   * actually running — not a copy the plugin maintains.
   */
  async settings(options = {}) {
    const locations = await this.locations()
    const spec = await this.getSpec()
    const host = this.ctx?.get?.('agentDefaultModel')
    let model = undefined
    try {
      model = host?.currentSelection?.()
    } catch {
      model = undefined
    }
    const editor = this.ctx?.get?.('configEditor')
    const entry = this.ctx?.fiber?.entry
    const adapters = await this.listModelAdapters()
    return {
      projectRoot: locations.project.path,
      projectRootReason: locations.project.reason,
      outputRoot: locations.output.path,
      outputRootReason: locations.output.reason,
      // 同 overview：设置面板几乎不变，版本号让客户端跳过重渲染。
      revision: [
        locations.project.path,
        locations.output.path,
        this.config.model,
        adapters.map(adapter => adapter.id).join(','),
        model === undefined ? 'nomodel' : `${model.provider}/${model.model}/${model.reasoningEffort ?? ''}`,
        editor !== undefined && entry !== undefined ? 'editable' : 'readonly',
      ].join('|'),
      onSystemDrive: {
        project: locations.project.onSystemDrive,
        output: locations.output.onSystemDrive,
      },
      specModel: this.config.model,
      specModels: adapters,
      hostModel: model === undefined ? undefined : {
        provider: model.provider,
        model: model.model,
        reasoningEffort: model.reasoningEffort,
      },
      specAvailable: spec.available,
      editable: editor !== undefined && entry !== undefined,
      patchPath: this.ctx?.get?.('profileContext')?.patchPath,
      warnings: buildLocationWarnings(locations),
    }
  }

  /** The model adapters shipped in `build/spec/models/`. */
  async listModelAdapters() {
    const now = Date.now()
    const cached = this.adapterCache
    if (cached !== undefined && now - cached.at < DISK_CACHE_MS) return cached.value
    const dir = join(SPEC_DIR, 'models')
    const names = await listDirIfExists(dir)
    const rows = []
    for (const name of names.sort()) {
      const rules = await readTextIfExists(join(dir, name, 'rules.md'))
      const title = rules === undefined ? undefined : (/^#\s+(.+)$/m.exec(rules)?.[1])
      rows.push({ id: name, title: title ?? name, rules: rules !== undefined })
    }
    this.adapterCache = { at: now, value: rows }
    return rows
  }

  /**
   * Change the plugin's settings.
   *
   * The write goes through the Host's **config editor** when the profile has
   * one: it validates against the plugin's schema, writes the profile's own
   * patch layer (so a plugin upgrade never overwrites it) and reloads the
   * plugin. Without an editor the panel shows the snippet to paste instead of
   * pretending it saved.
   */
  async updateSettings(options) {
    const editor = this.ctx?.get?.('configEditor')
    const entry = this.ctx?.fiber?.entry
    if (editor === undefined || entry === undefined) {
      throw new Error('这个 profile 没有配置编辑器（configEditor）：请手动改 profile 的 cordis.patch.yml 里 drama-desk 那一行')
    }
    const patch = {}
    if (options.projectRoot !== undefined) patch.projectRoot = String(options.projectRoot)
    if (options.outputRoot !== undefined) patch.outputRoot = String(options.outputRoot)
    if (options.model !== undefined) patch.model = String(options.model)
    if (Object.keys(patch).length === 0) throw new Error('没有要改的项')
    await editor.edit(entry, current => ({ ...current, ...patch }))
    // The editor restarts the plugin, which rebuilds the service with the new
    // config. The in-memory location cache is therefore stale on purpose.
    this.locationCache = undefined
    return { ok: true, patch }
  }

  // ── edits ────────────────────────────────────────────────────────────────

  /**
   * Edit one beat of one scene — the 表演层真源.
   *
   * The patch replaces the named fields of one beat; nothing else in
   * `scenes.json` is touched.
   */
  async editBeat(options) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) throw new Error('没有可用的作品')
    const data = await this.loadWork(workspace.dir)
    const scene = data.scenes.find(entry => entry.id === options.sceneId)
    if (scene === undefined) throw new Error(`场次 ${options.sceneId} 不存在`)
    const index = Number(options.beatIndex)
    if (!Number.isInteger(index) || index < 1 || index > (scene.beats?.length ?? 0)) {
      throw new Error(`beat 序号越界：${options.beatIndex}（该场次共 ${scene.beats?.length ?? 0} 拍）`)
    }
    const patch = options.patch
    if (patch === undefined || typeof patch !== 'object' || patch === null) {
      throw new Error('缺少 patch')
    }
    const beats = JSON.parse(JSON.stringify(scene.beats))
    beats[index - 1] = { ...beats[index - 1], ...patch }
    await writeSceneBeats(workspace.dir, options.sceneId, beats)
    this.invalidateWork(workspace.dir)
    return { ok: true, sceneId: options.sceneId, beatIndex: index, beats }
  }

  /** Edit the 分镜层真源 fields of one shot. */
  async editShot(options) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) throw new Error('没有可用的作品')
    const patch = options.patch
    if (patch === undefined || typeof patch !== 'object' || patch === null) {
      throw new Error('缺少 patch')
    }
    await writeShotFields(workspace.dir, options.shotId, patch)
    this.invalidateWork(workspace.dir)
    return { ok: true, shotId: options.shotId, patch }
  }

  /**
   * The director's own note on one shot.
   *
   * It lives in the shot's `notes` field — the data contract's own place for
   * a shot's remarks, already read by the pipeline grid. No new file, no new
   * schema: the annotation is真源 like everything else in `shots.json`.
   */
  async annotateShot(options) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) throw new Error('没有可用的作品')
    const note = typeof options.note === 'string' ? options.note : ''
    await writeShotFields(workspace.dir, options.shotId, { notes: note })
    this.invalidateWork(workspace.dir)
    return { ok: true, shotId: options.shotId, notes: note }
  }

  // ── compile / check ──────────────────────────────────────────────────────

  /**
   * Recompile the prompt artifacts.
   *
   * Cost is zero and the action is explicit (PRD §6.2): the compiler writes
   * the derived fields and the `.prompt.txt` artifacts, and the answer says
   * which shots changed.
   */
  async compile(options = {}) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) throw new Error('没有可用的作品')
    const result = await runCompile(workspace.dir, {
      check: options.check === true,
      dry: options.dry === true,
      shotId: options.shotId,
    })
    if (result.ok) this.invalidateWork(workspace.dir)
    return result
  }

  /** Whether one shot's prompt artifact is still in sync with the真源. */
  async check(options) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) throw new Error('没有可用的作品')
    const result = await runCompile(workspace.dir, { check: true, shotId: options.shotId })
    if (!result.ok) return { ok: false, error: result.error }
    const stale = (result.stale ?? []).includes(options.shotId)
    return {
      ok: true,
      shotId: options.shotId,
      stale,
      changed: (result.changed ?? []).includes(options.shotId),
      staleShots: result.stale ?? [],
    }
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** Load one work's files through the derived cache. */
  async loadWork(dir) {
    const [work, state, scenesDoc, shotsDoc, charactersDoc, assetsDoc, ledgerDoc] = await Promise.all([
      this.cachedJson(join(dir, 'work.json')),
      this.cachedJson(join(dir, 'state.json')),
      this.cachedJson(join(dir, 'scenes.json')),
      this.cachedJson(join(dir, 'shots.json')),
      this.cachedJson(join(dir, 'characters.json')),
      this.cachedJson(join(dir, 'assets.json')),
      this.cachedJson(join(dir, 'ledger.json')),
    ])
    return {
      dir,
      work,
      state,
      scenes: Array.isArray(scenesDoc?.scenes) ? scenesDoc.scenes : [],
      shots: Array.isArray(shotsDoc?.shots) ? shotsDoc.shots : [],
      characters: Array.isArray(charactersDoc?.characters) ? charactersDoc.characters : [],
      assets: Array.isArray(assetsDoc?.assets) ? assetsDoc.assets : [],
      ledger: Array.isArray(ledgerDoc?.entries) ? ledgerDoc.entries : [],
      ledgerTotals: ledgerDoc?.totals,
    }
  }

  /** Run (and cache) the beat layer over one work's scenes. */
  async beatQcFor(data) {
    const scenesPath = join(data.dir, 'scenes.json')
    let info
    try {
      info = await stat(scenesPath)
    } catch {
      return new Map()
    }
    const key = `beatqc:${scenesPath}`
    const hit = this.cache.get(key)
    if (hit !== undefined && hit.mtimeMs === info.mtimeMs && hit.size === info.size) {
      return hit.value
    }
    const result = await runBeatQc(scenesPath)
    const rows = new Map()
    if (result.ok) {
      for (const row of result.data.scenes ?? []) rows.set(row.scene, row)
    }
    this.cache.set(key, { mtimeMs: info.mtimeMs, size: info.size, value: rows })
    return rows
  }
}

/** The newest ledger entry for one shot. */
function newestLedgerFor(ledger, shotId) {
  const rows = ledger.filter(entry => entry.shot_id === shotId)
  if (rows.length === 0) return undefined
  return rows[rows.length - 1]
}

/** The five status counters, all zero. */
function emptyCounts() {
  return { none: 0, generated: 0, warn: 0, fail: 0, pass: 0 }
}

/**
 * The storage guard: say out loud when a location sits on the system drive.
 *
 * 成片很占地方，落在系统盘上会在不知不觉中撑爆 C 盘 —— 这是「设置产物位置」
 * 这件事的全部动机，所以它必须是界面上一句看得见的话，而不是文档备注。
 */
function buildLocationWarnings(locations) {
  const warnings = []
  if (locations.output.onSystemDrive) {
    warnings.push(`产物位置在系统盘（${locations.output.path}）：成片很占地方，建议改到其他盘（编辑 profile 的 cordis.patch.yml 里的 outputRoot）`)
  }
  if (locations.project.onSystemDrive) {
    warnings.push(`项目根在系统盘（${locations.project.path}）：作品数据与参考图会持续累积，建议改到其他盘`)
  }
  if (!locations.output.exists) {
    warnings.push(`产物位置还不存在（${locations.output.path}）：第一次生成时会自动创建`)
  }
  return warnings
}

/** Shorten a long piece of text for a grid cell tooltip. */
function truncate(text, limit) {
  const value = String(text ?? '')
  return value.length <= limit ? value : `${value.slice(0, limit)}…`
}

/** One-line summary of a verification report section. */
function summarizeIssues(section) {
  if (section === undefined || section === null) return '无明细'
  if (typeof section === 'string') return section
  if (Array.isArray(section.issues)) return section.issues.join('；')
  if (typeof section.verdict === 'string') return section.verdict
  return JSON.stringify(section).slice(0, 160)
}

/** Whether the scene layer already produced a QC result for this shot. */

/**
 * Split a six-section prompt artifact into its named sections.
 *
 * The section headers are fixed by the prompt format:
 * `subject_definitions` / `summary` / `retention_analysis` /
 * `detailed_description` / `overall_soundscape` / `non_diegetic_music`.
 */
export function splitPromptSections(text) {
  const headers = [
    'subject_definitions',
    'summary',
    'retention_analysis',
    'detailed_description',
    'overall_soundscape',
    'non_diegetic_music',
  ]
  const sections = []
  for (const header of headers) {
    const marker = `${header}:`
    const start = text.indexOf(marker)
    if (start < 0) continue
    const from = start + marker.length
    let end = text.length
    for (const other of headers) {
      if (other === header) continue
      const at = text.indexOf(`${other}:`, from)
      if (at >= 0 && at < end) end = at
    }
    sections.push({ name: header, text: text.slice(from, end).trim() })
  }
  return sections
}
