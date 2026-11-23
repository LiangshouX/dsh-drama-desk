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
import { stat, statfs, mkdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { readJsonIfExists, readTextIfExists, isFile, isDirectory, resolveWithin, writeJsonAtomic, writeTextAtomic, listDirIfExists, mapLimit, renamePath } from './fsx.js'
import { discoverWorkspaces, loadWorkspace, writeSceneBeats, writeShotFields, DERIVED_SHOT_FIELDS } from './workspace.js'
import { loadSpec, STAGES } from './spec.js'
import { runBeatQc, runMotionQc, runImageQc } from './qc.js'
import { runCompile } from './compile.js'
import { judgeRule } from './applicability.js'
import { resolveConfig, SPEC_DIR } from './paths.js'
import { resolveOutputRoot, resolveProjectRoot } from './locations.js'
import { describeStages, decideMove, stageOrder } from './stages.js'
import {
  attachDeskSession, deskSessionState, ensureDeskSession, installScope, watchAgentBirth,
  SESSION_FIELD, SESSION_LIST_FIELD,
} from './conceive.js'
import { buildStageView, readStagePrompt, shotSummary, STAGE_VIEWS } from './stageviews.js'
import { resolvePoster, resolvePosterSource } from './posters.js'
import { assemblyPlan, assemblyJob, startAssembly, finalCuts } from './assembly.js'
import { currentVideo, videoVersion } from './media.js'
import { productionTaskFor } from './production.js'
import { addProductionRecord } from './authoring.js'
import { registerProductionAsset } from './registration.js'
import {
  readHostInfo,
  pickDirectory,
  browseDirectory,
  createDirectory,
  listWorkspacesDetailed,
} from './hostinfo.js'
import {
  commitStage,
  editSceneFields,
  editCharacterFields,
  editBrief,
  editAssetFields,
  editVerifyReport,
  editBeatOp,
  writePromptOverride,
  resetPromptOverride,
} from './editors.js'

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

/**
 * How long the discovered work list stays cached.
 *
 * 一轮快照要问四次「有哪些作品」（顶栏、流水线、阶段条、设置），
 * 而每一次都是一次目录遍历。四十多次往返，问的还是同一份答案。
 *
 * 一秒：够把一轮快照里的四次问合成一次；又远小于面板的轮询间隔，
 * 所以新作品最多晚一轮出现——和面板自己的刷新节奏一样，看不出差别。
 */
const WORKSPACE_CACHE_MS = 1000

/**
 * 会话→作品归属台账的缓存时长。
 *
 * 它只在「绑定一段会话」和「拉一次会话清单」时被问，几秒内答案不会变；
 * 而每一次都要读每个作品的 `state.json`（作品数 × 一个小文件）。三秒足够
 * 把一次绑定里的两问合成一次，又短到「刚开的新对话」下一轮就认得出。
 */
const OWNER_CACHE_MS = 3000

/**
 * How many asset existence probes run at once.
 *
 * 够快（有上限的并发把「一问一答」变成「几轮往返」），又不至于把
 * **宿主共享的** libuv 线程池打满——插件是嵌在别人的应用里的（`AGENTS.md` §11）。
 */
const ASSET_PROBE_CONCURRENCY = 32

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
    /** The discovered work list, cached for one second (see `listWorkspaces`). */
    this.workspaceCache = undefined
    /** 会话→作品的归属台账（见 `sessionOwners`）。 */
    this.ownerCache = undefined
    /** 还没出生（没有 agent）的会话欠着的那份作品范围（见 `conceiveScope`）。 */
    this.coldScopes = new Map()
    /** `agent/created` 监听器的 disposer（`watchAgentBirth`）。 */
    this.agentWatch = undefined
    /** The "are the prompt artifacts stale" answer, keyed by the source fingerprint. */
    this.checkCache = undefined
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
    const project = await resolveProjectRoot(this.config.projectRoot, candidates, {
      // 一个工作台只有一个总根：「视频」目录下的 DSH-DRAMA-DESK。
      defaultRoot: join(output.path, 'DSH-DRAMA-DESK'),
    })
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
    // 作品变了：作品清单与「产物是否过期」的答案都可能变了。
    // 前者由 TTL 兜底，后者**没有 TTL**——它按真源指纹缓存，
    // 而真源变了指纹就变了；这里清掉是为了覆盖「只改了产物」的情况。
    this.workspaceCache = undefined
    this.checkCache = undefined
    // 「这段会话是哪部戏的」也跟着作品走：刚开的新对话要立刻认得出。
    this.ownerCache = undefined
  }

  // ── workspaces ───────────────────────────────────────────────────────────

  /**
   * List the works discovered under the configured project root.
   *
   * **短 TTL 的原因是「一次快照里问了好几遍」**，不是「磁盘慢」。
   * 一轮快照会问四次：顶栏、流水线、阶段条各一次。每一遍都要一次 readdir
   * 加三次目录探测加两次文件读取——四遍就是四十多次往返，而它们问的
   * 是同一份答案。
   *
   * 所以结果按 **TTL** 短暂缓存：一秒。一秒之内（也就是一轮快照之内）
   * 四次问共用一次；一秒之外（面板每 4 秒轮询一次）一定重算。
   * 新作品最多晚一轮轮询出现——和面板的刷新节奏一样，看不见差别。
   */
  async listWorkspaces() {
    const now = Date.now()
    const cached = this.workspaceCache
    if (cached !== undefined && now - cached.at < WORKSPACE_CACHE_MS) {
      return cached.value
    }
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
        // 草稿：还没立项的作品（见 `createWorkspace` 的 `draft`）。名字与目录 ID 都是
        // **暂定**的，界面要如实标出来，并给一个「立项命名」的出口。
        draft: work?.draft === true,
      })
    }
    this.workspaceCache = { at: now, value: rows }
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
    // An explicit but stale id must never redirect a write into another work.
    return rows.find(row => row.id === workspaceId)
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
      'creative/brief.md', 'assembly/status.json',
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
    for (const folder of ['prompts/slim', 'prompts/overrides', 'verify']) {
      const names = (await listDirIfExists(join(dir, folder))).sort()
      const revisions = await mapLimit(names, 32, async name => {
        try {
          const info = await stat(join(dir, folder, name))
          return `${name}:${info.mtimeMs}:${info.size}`
        } catch { return `${name}:-` }
      })
      parts.push(`${folder}:${revisions.join(',')}`)
    }
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
    // 验收报告同理：一次 readdir 拿全，不是每镜一次「文件不存在」的探测。
    const reportIds = await this.verifyReportIds(data.dir)
    for (const scene of data.scenes) {
      const sceneQc = beatQc.get(scene.id)
      const shots = []
      for (const shot of (byScene.get(scene.id) ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
        const cell = await this.buildCell(data, scene, shot, sceneQc, promptIds.has(shot.id), reportIds.has(shot.id))
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

  /**
   * The ids of the shots that have a verification report on disk.
   *
   * 网格要给每一格一个判定，于是每一格都要问「这一镜的报告在不在」。
   * 逐镜问就是 **72 次文件探测**——而报告其实只有几份，剩下六成多
   * 都是「文件不存在」的失败探测。失败探测也是往返，也是等待。
   *
   * 所以：**一次 readdir 拿全**，然后只对真正存在的报告做读取。
   * 新报告出现时 `revisionOf()` 的 `verify:<n>` 会变，客户端因此重新拉，
   * 下一轮就会读到它——不需要在这一轮里赌。
   *
   * @param {string} dir the work directory
   * @returns {Promise<Set<string>>}
   */
  async verifyReportIds(dir) {
    const names = await listDirIfExists(join(dir, 'verify'))
    const ids = new Set()
    for (const name of names) {
      if (!name.endsWith('.report.json')) continue
      ids.add(name.slice(0, -'.report.json'.length))
    }
    return ids
  }

  /** Build one grid cell: status, reason, and the markers a director needs. */
  async buildCell(data, scene, shot, sceneQc, promptExists, reportExists) {
    const ledger = newestLedgerFor(data.ledger, shot.id)
    const video = currentVideo(data, shot)
    const report = reportExists
      ? await this.cachedJson(join(data.dir, 'verify', `${shot.id}.report.json`))
      : undefined
    const markers = []
    let status = 'none'
    let reason = '台账无记录'
    if (video !== undefined || ledger !== undefined) {
      status = 'generated'
      reason = '已生成，尚无体检报告'
      if (video !== undefined && report !== undefined && report.source_outdated !== true && typeof report.verdict === 'string') {
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
      if (video && shot.status === 'verified' && report?.human?.video_asset_id === video.id) {
        status = 'pass'
        reason = '导演已确认当前视频版本验收通过'
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
        // 这一镜「要表达什么」是**派生**的：summary → description → motion_action
        // → 覆盖到的 beats 的动作行。界面读它来显示，编辑改的是契约里的
        // motion_action（真源字段），不是派生字段。
        summary: shotSummary(data, shot),
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
    // 「这个文件还在吗」要问磁盘一次——但**不能一问一答地串行问**。
    //
    // 资产多的时候（演示作品 101 个），串行就是 101 次往返，一次往返
    // 一毫秒就是一百毫秒。有上限的并发池把等待压到几次往返的量，
    // 同时又不会把宿主的线程池打满（见 `fsx.js` 的 `mapLimit`）。
    const rows = await mapLimit(data.assets, ASSET_PROBE_CONCURRENCY, async asset => {
      let missing = true
      if (typeof asset.path === 'string' && asset.path !== '') {
        missing = !await isFile(resolveWithin(data.dir, asset.path))
      }
      return {
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
      }
    })
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
        version: videoVersion(asset),
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
      // **已提交的阶段**——面板据此区分「已提交的进度」与「正在预览的视图」。
      committed: current,
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
   * 一个模型的**能力清单**（主要是推理强度档位）。
   *
   * 推理等级**是每个模型自己的**：同一个 provider 下，A 模型给 low/high/max，
   * B 模型只给 medium。所以档位不能写死在插件里——**问适配器**。
   *
   * `llm.resolveModelInfo()` 正是干这个的（它可能去问 provider），
   * 所以这是一条**按需**的路径：模型菜单打开时才调，不进轮询。
   *
   * @param {{provider?: string, model?: string}} options
   * @returns {Promise<{provider?: string, model?: string, efforts: Array<{id: string, name: string, description?: string}>, defaultEffort?: string, available: boolean}>}
   */
  async modelInfo(options = {}) {
    const provider = typeof options.provider === 'string' ? options.provider : undefined
    const model = typeof options.model === 'string' ? options.model : undefined
    const empty = { provider, model, efforts: [], available: false }
    if (provider === undefined || model === undefined) return empty
    const llm = this.ctx?.get?.('llm')
    if (llm === undefined || typeof llm.resolveModelInfo !== 'function') return empty
    let resolved
    try {
      resolved = await llm.resolveModelInfo(provider, model)
    } catch {
      return empty
    }
    const reasoning = resolved && resolved.reasoning ? resolved.reasoning : undefined
    const efforts = reasoning && Array.isArray(reasoning.efforts) ? reasoning.efforts : []
    return {
      provider,
      model,
      available: efforts.length > 0,
      efforts: efforts
        .filter(entry => entry !== null && typeof entry === 'object' && typeof entry.id === 'string')
        .map(entry => ({
          id: entry.id,
          name: typeof entry.name === 'string' && entry.name !== '' ? entry.name : entry.id,
          description: typeof entry.description === 'string' && entry.description !== '' ? entry.description : undefined,
        })),
      defaultEffort: reasoning && typeof reasoning.defaultEffort === 'string' ? reasoning.defaultEffort : undefined,
    }
  }

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
    // 宿主真实配置：模型路由、密钥状态、目录选择器。
    //
    // **轻量路径**（轮询用的那个）只读 provider 名单与宿主模型——列模型目录
    // 可能要去问 provider，那不是每几秒该做的事。设置抽屉打开时才走 full。
    const providers = await this.providerList(options.full === true)
    const picker = this.pickerCapability()
    const hostModel = model === undefined
      ? undefined
      : { provider: model.provider, model: model.model, reasoningEffort: model.reasoningEffort }
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
      // 规范适配：铁律来源。adapters 是 build/spec/models/<id>/ 里的那几份。
      adapter: this.config.model,
      adapters: adapters.map(adapter => ({
        ...adapter,
        label: adapter.title !== undefined && adapter.title !== adapter.id
          ? adapter.id + ' · ' + adapter.title
          : adapter.id,
      })),
      // 生成模型：提交生成时用谁。它是**插件自己的配置**，不是宿主的默认模型。
      generation: {
        provider: this.config.generationProvider ?? '',
        model: this.config.generationModel ?? '',
      },
      providers,
      picker,
      hostModel,
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
   * The provider list, read from the **host's own** model registry.
   *
   * Light mode (the polled path) asks only for the route names — that is an
   * in-memory registry read. Full mode also lists each provider's models,
   * which may reach the provider itself, so it is only used when the settings
   * drawer asks for it.
   */
  async providerList(full) {
    if (full === true) {
      try {
        const info = await readHostInfo(this)
        return info.providers ?? []
      } catch {
        return []
      }
    }
    const llm = this.ctx?.get?.('llm')
    if (llm === undefined || typeof llm.listProviders !== 'function') return []
    try {
      const rows = llm.listProviders()
      if (!Array.isArray(rows)) return []
      return rows.map(row => ({ id: row.id, name: row.name ?? row.id, configured: false, models: [] }))
    } catch {
      return []
    }
  }

  /** Whether the host can open a native folder picker. */
  pickerCapability() {
    const picker = this.ctx?.get?.('directoryPicker')
    try {
      const capability = picker?.capability?.()
      const kind = capability?.kind === 'native' ? 'native' : 'browse'
      return { kind }
    } catch {
      return { kind: 'browse' }
    }
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
    if (options.adapter !== undefined) patch.model = String(options.adapter)
    else if (options.model !== undefined) patch.model = String(options.model)
    if (options.generationProvider !== undefined) patch.generationProvider = String(options.generationProvider)
    if (options.generationModel !== undefined) patch.generationModel = String(options.generationModel)
    if (options.autoRefresh !== undefined) patch.autoRefresh = Number(options.autoRefresh) || 0
    if (Object.keys(patch).length > 0) {
      await editor.edit(entry, current => ({ ...current, ...patch }))
      // The editor restarts the plugin, which rebuilds the service with the new
      // config. The in-memory location cache is therefore stale on purpose.
      this.locationCache = undefined
    }
    // 宿主模型走宿主自己的服务（与 DSH 其它地方的默认模型选择同一个真源）。
    let hostModel
    if (options.hostProvider !== undefined || options.hostModel !== undefined || options.hostReasoningEffort !== undefined) {
      const host = this.ctx?.get?.('agentDefaultModel')
      if (host === undefined || typeof host.saveSelection !== 'function') {
        throw new Error('这个宿主没有 agentDefaultModel 服务：无法改宿主模型')
      }
      const current = host.currentSelection?.() ?? {}
      hostModel = {
        provider: options.hostProvider !== undefined ? String(options.hostProvider) : current.provider,
        model: options.hostModel !== undefined ? String(options.hostModel) : current.model,
      }
      if (hostModel.provider === undefined || hostModel.model === undefined) {
        throw new Error('宿主模型需要同时给出 provider 与 model')
      }
      // 推理强度：**没给就保持原样**。
      //
      // 以前这里只写 provider/model，把 reasoningEffort 丢了——用户在 DSH 里
      // 选好的推理等级被一次「换个模型」悄悄抹掉。
      if (options.hostReasoningEffort !== undefined) {
        const effort = String(options.hostReasoningEffort).trim()
        if (effort === '') delete hostModel.reasoningEffort
        else hostModel.reasoningEffort = effort
      } else if (typeof current.reasoningEffort === 'string' && current.reasoningEffort !== '') {
        hostModel.reasoningEffort = current.reasoningEffort
      }
      await host.saveSelection(hostModel)
    }
    return { ok: true, patch, hostModel }
  }

  /**
   * 这个短剧工作区里的**会话清单**。
   *
   * 构思会话窗要能「选择对话」——而对话固定发生在**同一个 DSH 工作区**里
   * （`AGENTS.md` §7：一个短剧项目 = 一个 DSH 工作区）。所以这里列出
   * **cwd 落在短剧项目总根之内**的那些会话，别把别的项目的会话混进来。
   *
   * Host 半边才有完整的会话目录（`ctx.sessions.list()`），客户端拿不到。
   *
   * @param {{workspace?: string}} options
   * @returns {Promise<{sessions: Array<{id: string, title: string, cwd: string, createdAt: number}>}>}
   */
  async sessions(options = {}) {
    const store = this.ctx?.get?.('sessions')
    if (store === undefined || store === null || typeof store.list !== 'function') {
      return { sessions: [] }
    }
    const locations = await this.locations()
    const root = locations.project.path
    const fold = value => (process.platform === 'win32' ? value.toLowerCase() : value)
    const rootFolded = fold(root)
    // **先按工作区的账本**：DSH 侧栏就是把「DSH-DRAMA-DESK」这一组按 `sessionIds`
    // 分出来的，我们照同一个口径取，才是「对话都在这个固定工作区里」。
    // 账本拿不到时退回 cwd 前缀匹配（旧宿主 / 注册表没起来）。
    const workspace = await this.resolveDshWorkspace()
    const account = workspace !== undefined && Array.isArray(workspace.sessionIds)
      ? new Set(workspace.sessionIds.map(id => String(id)))
      : undefined
    // 归属：这段对话是哪部戏的。**cwd 分不出来**（所有作品共用总根），
    // 只有作品自己的 `state.json` 说得清。界面靠它把「别的作品的对话」
    // 标出来并不让选中——选错了就是串台（见 70-chat.js 的会话下拉）。
    const owners = await this.sessionOwners()
    const rows = await this.listWorkspaces()
    const titleOf = id => {
      const row = rows.find(one => one.id === id)
      return row !== undefined ? row.title : id
    }
    const out = []
    for (const session of store.list()) {
      const header = session && session.header ? session.header : undefined
      const id = String(session?.id ?? header?.id ?? '')
      if (id === '') continue
      const cwd = header && typeof header.cwd === 'string' ? header.cwd : ''
      if (account !== undefined) {
        if (!account.has(id)) continue
      } else {
        if (cwd === '') continue
        // 只收**总根之内**的会话（含总根本身）。
        const cwdFolded = fold(cwd)
        if (cwdFolded !== rootFolded && !cwdFolded.startsWith(rootFolded + '/') && !cwdFolded.startsWith(rootFolded + '\\')) {
          continue
        }
      }
      const ownerId = owners.get(id)
      out.push({
        id,
        title: typeof header?.title === 'string' ? header.title : '',
        cwd,
        createdAt: typeof header?.createdAt === 'number' ? header.createdAt : 0,
        // 缺省 = 不知道它是哪部戏的（例如你在宿主侧栏直接开的对话）：
        // 那种会话可以被任何作品「接住」，挂上当前作品的范围。
        workspaceId: ownerId,
        workspaceTitle: ownerId === undefined ? undefined : titleOf(ownerId),
      })
    }
    out.sort((a, b) => b.createdAt - a.createdAt)
    return { sessions: out }
  }

  // ── edits ────────────────────────────────────────────────────────────────

  /**
   * Edit one beat of one scene — the 表演层真源.
   *
   * Four operations, one writer: `patch` replaces fields, `insert` adds a beat,
   * `delete` removes one, `move` reorders. Nothing else in `scenes.json` moves.
   */
  async editBeat(options) {
    const workspace = await this.requireWorkspace(options)
    const op = typeof options.op === 'string' ? options.op : 'patch'
    const result = await editBeatOp(workspace.dir, options.sceneId, {
      op,
      beatIndex: Number(options.beatIndex),
      toIndex: options.toIndex === undefined ? undefined : Number(options.toIndex),
      patch: options.patch,
    })
    this.invalidateWork(workspace.dir)
    return {
      ok: true,
      saved: true,
      sceneId: options.sceneId,
      op,
      beatIndex: result.beatIndex,
      beats: result.beats,
      stage: await this.commitStageFor(options, workspace),
    }
  }

  /** Edit the 分镜层真源 fields of one shot. */
  async editShot(options) {
    const workspace = await this.requireWorkspace(options)
    const patch = { ...options.patch }
    if (patch.status === 'verified') throw new Error('请通过人工验收确认动作设置 verified')
    if (patch.covers !== undefined) {
      const work = await loadWorkspace(workspace.dir)
      const shot = work.shots.find(row => row.id === options.shotId)
      const scene = work.scenes.find(row => row.id === shot?.scene)
      const count = scene?.beats?.length ?? 0
      if (!Array.isArray(patch.covers) || patch.covers.some(n => !Number.isInteger(n) || n < 1 || n > count)) {
        throw new Error('覆盖的拍号必须是当前场次已有的正整数拍号')
      }
      patch.covers = [...new Set(patch.covers)]
    }
    if (patch.current_version !== undefined) {
      const work = await loadWorkspace(workspace.dir)
      const shot = work.shots.find(row => row.id === options.shotId)
      if (!shot) throw new Error('镜头不存在')
      const version = Number(patch.current_version)
      if (!Number.isInteger(version) || version < 1) throw new Error('当前版本必须是正整数')
      const asset = currentVideo(work, { ...shot, current_version: version })
      if (!asset || !await isFile(resolveWithin(workspace.dir, asset.path))) throw new Error('该版本没有唯一有效的视频文件，请先在资产页登记')
      patch.current_version = version
      if (Number(shot.current_version) !== version || ['pending', 'failed', 'submitted'].includes(shot.status)) {
        patch.status = 'succeeded'
        patch.verified_asset_id = null
      }
      if (Number(shot.current_version) !== version) {
        const reportPath = resolveWithin(workspace.dir, `verify/${shot.id}.report.json`)
        const report = await readJsonIfExists(reportPath)
        if (report) { report.source_outdated = true; await writeJsonAtomic(reportPath, report) }
      }
    }
    await writeShotFields(workspace.dir, options.shotId, patch)
    this.invalidateWork(workspace.dir)
    return { ok: true, saved: true, shotId: options.shotId, patch, stage: await this.commitStageFor(options, workspace) }
  }

  /**
   * The director's own note on one shot.
   *
   * It lives in the shot's `notes` field — the data contract's own place for
   * a shot's remarks, already read by the pipeline grid. No new file, no new
   * schema: the annotation is真源 like everything else in `shots.json`.
   */
  async annotateShot(options) {
    const workspace = await this.requireWorkspace(options)
    const note = typeof options.note === 'string' ? options.note : ''
    await writeShotFields(workspace.dir, options.shotId, { notes: note })
    this.invalidateWork(workspace.dir)
    return { ok: true, saved: true, shotId: options.shotId, notes: note, stage: await this.commitStageFor(options, workspace) }
  }

  // ── stage views ───────────────────────────────────────────────────────────

  /**
   * One stage's own view of the work.
   *
   * 每个阶段都有自己的数据契约出口，所以每个阶段也该有自己的呈现：
   * 创意看简报，角色看角色卡与每张参考图的提示词，剧本看表演，分镜看机位，
   * 生成看网格与产物，验收看报告，装配看版本，交付看成片。
   *
   * 载荷由 `stageviews.js` 组装；**判断不在这里做**——判定、阈值、规则
   * 都来自已有的层（体检器 / 网格格子 / 规范）。
   */
  async stageView(options = {}) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) throw new Error('没有可用的作品')
    const kind = typeof options.stage === 'string' ? options.stage : 'generate'
    if (!STAGE_VIEWS.includes(kind)) throw new Error(`未知阶段 ${kind}`)
    const work = await loadWorkspace(workspace.dir)
    const payload = await buildStageView({ kind, work, service: this })
    return {
      workspace: { id: workspace.id, title: workspace.title, dir: workspace.dir },
      stage: kind,
      kind,
      revision: await this.revisionOf(workspace.dir),
      data: payload,
    }
  }

  // ── posters ──────────────────────────────────────────────────────────────

  /**
   * The still frame for one shot — keyframe, cached frame, or a grab from the
   * shot's own video.
   *
   * 网格里的每一格都要看得见这一镜是什么。抽帧走 ffmpeg，结果缓存在作品目录
   * 的 `.frames/` 里（那是**缓存**，不是资产，不需要登记）。
   */
  async posterPath(options = {}) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) return undefined
    const data = await this.loadWork(workspace.dir)
    const poster = await resolvePoster(data, options.shotId)
    if (poster === undefined) return undefined
    return { path: poster.path, cached: poster.cached }
  }

  // ── prompts ───────────────────────────────────────────────────────────────

  /**
   * One shot's prompt artifact, plus whether it is still in sync with the真源.
   *
   * 「过期」由编译器自己说（`--check`），界面不复述任何规则。
   */
  async prompt(options = {}) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) throw new Error('没有可用的作品')
    const data = await this.loadWork(workspace.dir)
    const shot = data.shots.find(entry => entry.id === options.shotId)
    if (shot === undefined) throw new Error(`镜头 ${options.shotId} 不存在`)
    const artifact = await readStagePrompt(data, options.shotId)
    let stale
    try {
      const check = await this.check({ workspaceId: workspace.id, shotId: options.shotId })
      stale = check.ok === true ? check.stale : undefined
    } catch {
      stale = undefined
    }
    return {
      shotId: options.shotId,
      path: artifact.path,
      text: artifact.text,
      exists: artifact.exists,
      overridden: artifact.overridden,
      words: artifact.words,
      stale,
    }
  }

  /**
   * Write a hand-edited prompt.
   *
   * 人工改写的提示词写在两处：产物本体（界面立刻看得到）与 `prompts/overrides/`
   * （编译器尊重它，所以下一次「重新编译」不会把人的劳动悄悄冲掉）。
   */
  async savePrompt(options = {}) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) throw new Error('没有可用的作品')
    const text = typeof options.text === 'string' ? options.text : ''
    const saved = await writePromptOverride(workspace.dir, options.shotId, text)
    this.invalidateWork(workspace.dir)
    const stage = await this.commitStageFor(options, workspace)
    return { ok: true, saved: true, shotId: options.shotId, words: saved.words, stage }
  }

  /** Drop the hand edit and go back to what the compiler makes of the真源. */
  async resetPrompt(options = {}) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) throw new Error('没有可用的作品')
    const reset = await resetPromptOverride(workspace.dir, options.shotId)
    this.invalidateWork(workspace.dir)
    const compiled = await this.compile({ workspaceId: workspace.id, shotId: options.shotId })
    const stage = await this.commitStageFor(options, workspace)
    return {
      ok: true,
      reset: reset.reset === true,
      compiled: compiled.ok === true,
      error: compiled.ok === true ? undefined : compiled.error,
      stage,
    }
  }

  // ── the editors ───────────────────────────────────────────────────────────
  //
  // 每个写操作都做同一件事：**先保存内容，再尝试把已提交的阶段推进到
  // 用户正在工作的那一阶段**。保存与推进分离——前置条件不满足时内容照样
  // 留下来，只是进度不动，缺口如实回报。

  async editScene(options = {}) {
    const workspace = await this.requireWorkspace(options)
    const saved = await editSceneFields(workspace.dir, options.sceneId, options.patch ?? {})
    this.invalidateWork(workspace.dir)
    return { ok: true, saved: true, sceneId: options.sceneId, scene: saved, stage: await this.commitStageFor(options, workspace) }
  }

  async editCharacter(options = {}) {
    const workspace = await this.requireWorkspace(options)
    const saved = await editCharacterFields(workspace.dir, options.characterId, options.patch ?? {})
    this.invalidateWork(workspace.dir)
    return { ok: true, saved: true, characterId: options.characterId, character: saved, stage: await this.commitStageFor(options, workspace) }
  }

  async editBrief(options = {}) {
    const workspace = await this.requireWorkspace(options)
    const saved = await editBrief(workspace.dir, typeof options.text === 'string' ? options.text : '')
    this.invalidateWork(workspace.dir)
    return { ok: true, saved: true, brief: saved, stage: await this.commitStageFor(options, workspace) }
  }

  async editAsset(options = {}) {
    const workspace = await this.requireWorkspace(options)
    const saved = await editAssetFields(workspace.dir, options.assetId, options.patch ?? {})
    this.invalidateWork(workspace.dir)
    return { ok: true, saved: true, assetId: options.assetId, asset: saved, stage: await this.commitStageFor(options, workspace) }
  }

  async editVerify(options = {}) {
    const workspace = await this.requireWorkspace(options)
    if (options.patch?.verdict !== undefined && !['', 'pass', 'warn', 'fail'].includes(options.patch.verdict)) {
      throw new Error('人工判定只能是 pass / warn / fail')
    }
    const work = await loadWorkspace(workspace.dir)
    const shot = work.shots.find(row => row.id === options.shotId)
    if (!shot) throw new Error('镜头不存在')
    const video = currentVideo(work, shot)
    if (!video) throw new Error('当前镜头没有唯一有效的视频版本')
    const path = resolveWithin(workspace.dir, `verify/${shot.id}.report.json`)
    if (!await isFile(path)) {
      await writeJsonAtomic(path, { shot_id: shot.id, human: {} })
    }
    const previous = await readJsonIfExists(path)
    if (previous?.human?.video_asset_id && (previous.human.video_asset_id !== video.id
      || Number(previous.human.current_version) !== Number(shot.current_version))) {
      previous.human = {}
      await writeJsonAtomic(path, previous)
    }
    const saved = await editVerifyReport(workspace.dir, options.shotId, options.patch ?? {})
    const report = await readJsonIfExists(path)
    report.human.video_asset_id = video.id
    report.human.current_version = shot.current_version
    await writeJsonAtomic(path, report)
    if (shot.status === 'verified') {
      await writeShotFields(workspace.dir, shot.id, { status: 'succeeded', verified_asset_id: null })
    }
    this.invalidateWork(workspace.dir)
    return { ok: true, saved: true, shotId: options.shotId, report: saved, stage: await this.commitStageFor(options, workspace) }
  }

  async approveShot(options = {}) {
    const workspace = await this.requireWorkspace(options)
    const work = await loadWorkspace(workspace.dir)
    const shot = work.shots.find(row => row.id === options.shotId)
    if (!shot) throw new Error('镜头不存在')
    const video = currentVideo(work, shot)
    if (!video || !await isFile(resolveWithin(workspace.dir, video.path))) throw new Error('当前视频文件不可用')
    const report = await readJsonIfExists(resolveWithin(workspace.dir, `verify/${shot.id}.report.json`))
    if (String(report?.human?.verdict).toLowerCase() !== 'pass' || !String(report?.human?.reviewer ?? '').trim()) {
      throw new Error('请先填写人工判定 pass 与复核人，再确认验收')
    }
    if (report.human.video_asset_id !== video.id || Number(report.human.current_version) !== Number(shot.current_version)) {
      throw new Error('人工复核对应的版本已改变，请重新回看并填写人工判定')
    }
    await writeShotFields(workspace.dir, shot.id, { status: 'verified', verified_asset_id: video.id })
    this.invalidateWork(workspace.dir)
    return { ok: true, saved: true, shotId: shot.id }
  }

  async addRecord(options = {}) {
    const workspace = await this.requireWorkspace(options)
    const record = await addProductionRecord(workspace.dir, options)
    this.invalidateWork(workspace.dir)
    return { ok: true, saved: true, record, stage: await this.commitStageFor(options, workspace) }
  }

  async registerAsset(options = {}) {
    const workspace = await this.requireWorkspace(options)
    const asset = await registerProductionAsset(workspace.dir, options)
    if (asset.type === 'video' && asset.shot_id) {
      const work = await loadWorkspace(workspace.dir)
      const shot = work.shots.find(row => row.id === asset.shot_id)
      if (shot && currentVideo(work, shot)?.id === asset.id && ['pending', 'failed'].includes(shot.status)) {
        await writeShotFields(workspace.dir, shot.id, { status: 'succeeded' })
      }
    }
    this.invalidateWork(workspace.dir)
    return { ok: true, saved: true, asset }
  }

  async productionTask(options = {}) {
    const workspace = await this.requireWorkspace(options)
    const work = await loadWorkspace(workspace.dir)
    const stage = options.stage ?? work.state?.stage ?? 'conceive'
    return { ...productionTaskFor(workspace, work, stage),
      workspace: { id: workspace.id, title: workspace.title },
      data: (await this.stageView({ workspaceId: workspace.id, stage })).data }
  }

  async assemblyStatus(options = {}) {
    const workspace = await this.requireWorkspace(options)
    return { ...(await assemblyPlan(await loadWorkspace(workspace.dir))), job: await assemblyJob(workspace.dir) }
  }

  async assemble(options = {}) {
    const workspace = await this.requireWorkspace(options)
    return startAssembly(this, workspace, options.profile)
  }

  async confirmDelivery(options = {}) {
    const workspace = await this.requireWorkspace(options)
    const work = await loadWorkspace(workspace.dir)
    const final = (await finalCuts(work)).find(row => row.assetId === options.assetId)
    if (!final?.exists) throw new Error('成片文件不存在或已作废')
    if (final.stale) throw new Error('成片引用的镜头版本已变化，请重新装配')
    const spec = await this.getSpec()
    const decision = decideMove(work.state?.stage ?? 'conceive', 'deliver', work, spec)
    if (work.state?.stage !== 'deliver' && !decision.allowed) throw new Error(decision.reason + '：' + decision.gaps.join('；'))
    const plan = await assemblyPlan(work)
    if (!plan.ready) throw new Error('当前镜头还未就绪：' + plan.gaps.join('；'))
    if (work.state?.stage === 'deliver' && work.state?.delivery_asset_id === final.assetId) return { ok: true, saved: true }
    await writeJsonAtomic(join(workspace.dir, 'state.json'), { ...work.state, stage: 'deliver',
      delivery_asset_id: final.assetId, delivered_at: new Date().toISOString() })
    this.invalidateWork(workspace.dir)
    return { ok: true, saved: true, assetId: final.assetId }
  }

  /** Resolve the workspace or fail with the message the UI shows. */
  async requireWorkspace(options = {}) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) throw new Error('没有可用的作品')
    return workspace
  }

  /**
   * Move the committed stage to the stage the human just worked in.
   *
   * 契约允许回退（"分镜返工要能只重做第 7 个镜头"），所以回退总是成立；
   * 正向推进按契约 §11.2 校验，不满足就**不推进**，但内容已经保存。
   */
  async commitStageFor(options = {}, workspace) {
    const stage = typeof options.stage === 'string' ? options.stage : undefined
    if (stage === undefined || !STAGE_VIEWS.includes(stage)) return undefined
    const work = await loadWorkspace(workspace.dir)
    const spec = await this.getSpec()
    const result = await commitStage({
      dir: workspace.dir,
      state: work.state,
      work,
      spec,
      stage,
    })
    if (result.advanced) this.invalidateWork(workspace.dir)
    return result
  }

  // ── works ─────────────────────────────────────────────────────────────────

  /** Every work under the project root, with the figures the picker shows. */
  async workspaces(options = {}) {
    const rows = await listWorkspacesDetailed(this)
    return { workspaces: rows, selected: this.selectedWorkspaceId }
  }

  /**
   * Create one work, following the data contract's directory layout.
   *
   * An empty work is still a valid work: the contract's seven state files plus
   * an empty brief. Everything else is filled in by the stages.
   *
   * `draft: true` = **草稿作品**：还没想好要拍什么，先有个落脚的地方聊天找方向。
   * 名字与目录 ID 都是暂定的（`draft-<时间戳>` / 「未命名作品」），聊出方向之后
   * 由导演**立项改名**（见 `renameWorkspace`）。会话与目录名无关，所以改名不会
   * 打断正在进行的对话——这也是为什么敢先给一个临时 id。
   */
  async createWorkspace(options = {}) {
    const draft = options.draft === true
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
    const id = typeof options.id === 'string' && options.id.trim() !== ''
      ? options.id.trim()
      : (draft ? 'draft-' + stamp : '')
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(id)) {
      throw new Error('作品 id 不合法：只允许小写字母、数字与连字符（3–40 字符）')
    }
    const locations = await this.locations()
    const root = locations.project.path
    const dir = join(root, 'workspaces', id)
    if (await isFile(join(dir, 'work.json'))) throw new Error(`作品 ${id} 已经存在`)
    const title = typeof options.title === 'string' && options.title !== ''
      ? options.title
      : (draft ? '未命名作品' : id)
    await mkdir(join(dir, 'creative'), { recursive: true })
    await writeJsonAtomic(join(dir, 'work.json'), {
      version: '1.0',
      work_id: id,
      title,
      created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      created_by: 'human',
      notes: '',
      ...(draft ? { draft: true } : {}),
    })
    await writeJsonAtomic(join(dir, 'state.json'), {
      version: '1.0',
      work_id: id,
      stage: 'conceive',
      updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      shots_total: 0,
      shots_done: 0,
      shots_failed: 0,
    })
    await writeJsonAtomic(join(dir, 'scenes.json'), { version: '1.0', scenes: [] })
    await writeJsonAtomic(join(dir, 'characters.json'), { version: '1.0', characters: [], props: [] })
    await writeJsonAtomic(join(dir, 'shots.json'), { version: '1.0', shots: [] })
    await writeJsonAtomic(join(dir, 'assets.json'), { version: '1.0', assets: [] })
    await writeJsonAtomic(join(dir, 'ledger.json'), { version: '1.0', entries: [], totals: { cost_usd: 0, tasks: 0, succeeded: 0, failed: 0 } })
    await writeTextAtomic(join(dir, 'creative', 'brief.md'), '# 简报\n\n')
    this.selectedWorkspaceId = id
    return { ok: true, id, dir, draft }
  }

  /**
   * **立项**：给一个作品定名字与目录 ID。草稿作品靠它转正。
   *
   * 为什么是「改目录名」而不是「另建一个作品再搬内容」：
   *   · 会话与目录名**无关**（agent 的 cwd 是总根），所以改名不会打断正在进行的
   *     那段构思对话——这正是「先聊后立项」成立的前提；
   *   · 一个作品 = 一个目录（`AGENTS.md` §7）这条语义不动，不需要第二份台账；
   *   · 资产路径是**相对作品目录**的（`resolveWithin(workspace.dir, …)`），
   *     改目录名不动里面的引用。
   *
   * 不做「复制再删」的退路：半途失败会把一个作品拆成两半，比报错糟得多。
   * 改不动就如实报错，原样留在旧目录（见 `fsx.renamePath`）。
   *
   * @param {{workspaceId?: string, id?: string, title?: string}} options
   */
  async renameWorkspace(options = {}) {
    // **不用 `requireWorkspace`**：它找不到就退回首件作品——改名可不能改错人。
    const rows = await this.listWorkspaces()
    const workspace = rows.find(row => row.id === options.workspaceId)
    if (workspace === undefined) throw new Error(`没有作品 ${options.workspaceId === undefined ? '' : options.workspaceId}`)
    const oldId = workspace.id
    const oldDir = workspace.dir
    const wanted = typeof options.id === 'string' && options.id.trim() !== '' ? options.id.trim() : oldId
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(wanted)) {
      throw new Error('作品 id 不合法：只允许小写字母、数字与连字符（3–40 字符）')
    }
    const title = typeof options.title === 'string' && options.title.trim() !== ''
      ? options.title.trim()
      : undefined
    const changing = wanted !== oldId
    const target = join(await this.projectRoot(), 'workspaces', wanted)
    if (changing && await isDirectory(target)) throw new Error(`workspaces/${wanted} 已经存在，换一个 id`)
    if (changing) await renamePath(oldDir, target)
    const dir = changing ? target : oldDir

    // 身份写在两个真源里：`work.json`（名字与 id）与 `state.json`（id）。
    const work = (await readJsonIfExists(join(dir, 'work.json'))) ?? {}
    const nextWork = { ...work, work_id: wanted, title: title !== undefined ? title : (work.title || wanted) }
    delete nextWork.draft
    await writeJsonAtomic(join(dir, 'work.json'), nextWork)
    const state = await readJsonIfExists(join(dir, 'state.json'))
    if (state !== undefined) await writeJsonAtomic(join(dir, 'state.json'), { ...state, work_id: wanted })

    this.invalidateWork(oldDir)
    this.invalidateWork(dir)
    this.selectedWorkspaceId = wanted
    return { ok: true, id: wanted, title: nextWork.title, dir, renamed: changing, from: oldId }
  }

  // ── directories ───────────────────────────────────────────────────────────

  /** Open the host's folder picker, or say the host has none. */
  async pickFolder(options = {}) {
    const result = await pickDirectory(this)
    if (result.browse === true) return { browse: true, target: options.target }
    return { path: result.path ?? null, cancelled: result.cancelled === true }
  }

  /** List a directory (the in-drawer fallback). */
  async browse(options = {}) {
    return await browseDirectory(this, options.path)
  }

  /** Create a directory (the in-drawer fallback's "new folder" button). */
  async makeDirectory(options = {}) {
    const path = await createDirectory(this, options.path, options.name)
    return { path }
  }

  // ── 构思会话 ──────────────────────────────────────────────────────────────

  /**
   * 这个作品的「构思会话」。
   *
   * 构思不是一次性的动作，是一个**持续的过程**：第一阶段的节点、写简报、
   * 改简报，都在同一段对话里继续。所以这里只做两件事——
   *   `create: false`（默认）→ 报当前状态，不建会话；
   *   `create: true`         → 拿到一个**活的**会话（必要时开一段新的）。
   *
   * 会话是真 agent：真模型、真工具、`drama-conceive` 技能由 `skills.js` 提供，
   * 工作目录就是这个作品的目录，所以它能直接写 `creative/brief.md`。
   */
  async conceiveSession(options = {}) {
    const workspace = await this.requireWorkspace(options)
    const locations = await this.locations()
    const projectRoot = locations.project.path
    // 这个短剧项目对应的 **DSH 工作区**。
    //
    // 客户端要跳到宿主的完整对话面板时，光给 sessionId 不够——宿主得先
    // **选中工作区**，否则对话面板停在「选择一个工作区开始」的空态。
    const dshWorkspace = await this.dshWorkspace()
    const isNew = await this.isFreshWork(workspace)
    if (options.create !== true) {
      const state = await deskSessionState(this, workspace)
      // 旧版本开的会话没进工作区账本（用户报的「未分组」）：
      // 这里补一次，幂等，**只在确实缺的时候写**。
      if (state.sessionId !== undefined) {
        const raw = await this.resolveDshWorkspace()
        const accounted = raw !== undefined && Array.isArray(raw.sessionIds)
          ? raw.sessionIds.map(id => String(id)).includes(state.sessionId)
          : true
        if (!accounted) await attachDeskSession(raw, state.sessionId)
      }
      return { ...state, workspacePath: projectRoot, dshWorkspace }
    }
    const result = await ensureDeskSession(this, workspace, { fresh: options.fresh === true })
    // **作品范围交给宿主的 prompt context**，不塞进用户的第一条消息。
    // 这里挂一次，是为了「开会话就能立刻聊」；真正保证整段对话都不串台的，
    // 是客户端每次绑定会话时再调的 `conceiveScope()`（见那个方法）。
    const install = installScope(this, result.sessionId, await this.scopeOf(workspace, isNew))
    return { ...result, workspacePath: projectRoot, dshWorkspace, seeded: install.seeded, seedReason: install.reason }
  }

  /**
   * 一个作品的**范围记录**（交给 prompt context 的那份事实）。
   *
   * 目录 ID 与作品名必须同时出现，而且对应关系不能变：ID 是模型读写文件时
   * 认的那个，作品名是跟导演说话时用的那个。路径给**相对总根**的形式，
   * 因为 agent 的 cwd 就是总根（`AGENTS.md` §7：一个工作台一个总根）。
   *
   * @param {{id: string, dir: string, title?: string}} workspace
   * @param {boolean} [fresh] 是不是「刚建、还没开始设计」
   */
  async scopeOf(workspace, fresh) {
    const locations = await this.locations()
    const projectRoot = locations.project.path
    const isNew = fresh === undefined ? await this.isFreshWork(workspace) : fresh === true
    const path = relative(projectRoot, workspace.dir).split('\\').join('/')
    return {
      id: workspace.id,
      title: workspace.title !== undefined && workspace.title !== '' ? workspace.title : workspace.id,
      path: path === '' ? '.' : path,
      fresh: isNew,
      draft: workspace.draft === true,
    }
  }

  /**
   * **按会话钉住作品范围**：把「只谈这个作品（目录 ID + 作品名）」挂到这一段
   * DSH 会话上，此后它的每一步请求都带着它。
   *
   * 为什么不是「开会话时装一次」：会话窗的「选择对话」里，除了这里开的会话，
   * 还有**用户在宿主侧栏自己开的**、**插件重装前开的**、**别的作品开的**——
   * 它们从来没有过范围，agent 只能猜。猜就会串台。所以规矩是：**谁被显示，
   * 就给谁挂上**，而且客户端每次绑定会话时都会再挂一次（幂等）。
   *
   * 会话的归属以 `state.json` 的 `desk_session_id(s)` 台账为准：一段会话如果
   * 属于**别的作品**，就按它自己的作品挂（`match: false` 如实回报），绝不把
   * 当前作品的范围盖到别人的对话上——那会把一段谈 A 的对话引到 B 去。
   *
   * @param {{workspaceId?: string, sessionId?: string}} options
   */
  async conceiveScope(options = {}) {
    const sessionId = typeof options.sessionId === 'string' ? options.sessionId : ''
    if (sessionId === '') throw new Error('缺少 sessionId 参数')
    const requested = await this.requireWorkspace(options)
    const owners = await this.sessionOwners()
    const ownerId = owners.get(sessionId)
    const owner = ownerId === undefined
      ? undefined
      : await this.resolveWorkspace(ownerId)
    const target = owner !== undefined ? owner : requested
    const scope = await this.scopeOf(target)
    if (target.id === requested.id && STAGE_VIEWS.includes(options.stage)) scope.stage = options.stage
    const install = installScope(this, sessionId, scope)
    // 冷会话：agent 还不存在（要等用户说出第一句话，宿主才会造出来）。
    // 那就先记下来，等 `agent/created` 一到就挂——否则第一条消息正是没带范围的那条。
    watchAgentBirth(this)
    if (this.coldScopes === undefined) this.coldScopes = new Map()
    if (install.seeded === true) this.coldScopes.delete(sessionId)
    else this.coldScopes.set(sessionId, scope)
    return {
      ok: true,
      // 这一段会话实际钉在哪个作品上。
      work: { id: scope.id, title: scope.title, path: scope.path, draft: scope.draft === true },
      // 工作台此刻打开的是哪个作品（两者不同 = 这段对话不是这一部戏的）。
      current: { id: requested.id, title: requested.title },
      match: target.id === requested.id,
      seeded: install.seeded,
      reason: install.reason,
    }
  }

  /**
   * 会话 → 作品的归属台账。
   *
   * 宿主的会话 `cwd` 是**总根**（所有作品同一个工作区），从 cwd 分不出作品；
   * 唯一说得清的是作品自己的 `state.json`：`desk_session_id` 是现在用的那一段，
   * `desk_session_ids` 是用过的全部。两个都算。
   *
   * 短 TTL：一次绑定/一次清单问一遍，几秒内不会变。写操作会 `invalidateWork`
   * 把它清掉，所以「刚开的新对话」不会晚一轮才被认出来。
   *
   * @returns {Promise<Map<string, string>>} sessionId → 作品 id
   */
  async sessionOwners() {
    const now = Date.now()
    const cached = this.ownerCache
    if (cached !== undefined && now - cached.at < OWNER_CACHE_MS) return cached.value
    const map = new Map()
    const found = await discoverWorkspaces(await this.projectRoot())
    for (const entry of found) {
      const [work, state] = await Promise.all([
        this.cachedJson(join(entry.dir, 'work.json')),
        this.cachedJson(join(entry.dir, 'state.json')),
      ])
      const id = entry.id !== '' ? entry.id : (typeof work?.work_id === 'string' ? work.work_id : 'work')
      const seen = new Set()
      const take = value => {
        if (typeof value !== 'string' || value === '' || seen.has(value)) return
        seen.add(value)
        map.set(value, id)
      }
      take(state?.[SESSION_FIELD])
      if (Array.isArray(state?.[SESSION_LIST_FIELD])) {
        for (const one of state[SESSION_LIST_FIELD]) take(one)
      }
    }
    this.ownerCache = { at: now, value: map }
    return map
  }

  /**
   * 作品根对应的 **Workspace 实体**（不是包装过的 `{id, path}`）。
   *
   * 只有拿到实体才有 `sessionIds`（会话账本）与 `attachSession()`——
   * 本文件里凡是「把会话挂进工作区」或「按工作区分组」都得走它。
   *
   * @returns {Promise<object|undefined>}
   */
  async resolveDshWorkspace() {
    const locations = await this.locations()
    const registry = this.ctx?.get?.('workspaceRegistry')
    if (registry === undefined || registry === null || typeof registry.resolveByPath !== 'function') return undefined
    try {
      const found = await registry.resolveByPath(locations.project.path)
      return found === null ? undefined : found
    } catch {
      return undefined
    }
  }

  /**
   * 这个工作台挂在哪个 **DSH 工作区**下面（客户端跳宿主对话面板时要它的 id）。
   *
   * **一个工作台 = 一个 DSH 工作区**（总根 `「视频」/DSH-DRAMA-DESK`），
   * 所有短剧项目都是它下面的子目录（`AGENTS.md` §7）——不要给每个项目开一个。
   * 因此每一段构思会话的 cwd 都是这个总根，并且都要 `attachSession()` 进账本。
   *
   * @returns {Promise<{id: string, path: string}|undefined>}
   */
  async dshWorkspace() {
    const locations = await this.locations()
    const found = await this.resolveDshWorkspace()
    if (found === undefined || found === null) return undefined
    return { id: String(found.id ?? ''), path: String(found.path ?? locations.project.path) }
  }

  /** 这个作品是不是「刚建、还没开始设计」。开场白要据此说不同的话。 */
  async isFreshWork(workspace) {
    const data = await this.loadWork(workspace.dir)
    if (data.scenes.length > 0 || data.shots.length > 0) return false
    const brief = await readTextIfExists(join(workspace.dir, 'creative', 'brief.md'))
    return brief === undefined || brief.replace(/^#\s*/, '').trim().length < 8
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

  /**
   * Whether one shot's prompt artifact is still in sync with the真源.
   *
   * 校验要**跑一遍编译器**（Python 子进程），一次几百毫秒。而这条路径上
   * 有三处会问它：生成台每开一次（哪些镜过期了）、镜详情每开一次
   * （这一镜过期了没）、`drama_desk_check` 工具每调一次。
   *
   * 结果按**真源的指纹**缓存：真源没动，答案就不可能动。
   * 指纹是 `scenes.json` 与 `shots.json` 的 mtime + size——与
   * `beatQcFor` 用的是同一把尺子（它也缓存表演层体检）。
   *
   * 产物或人工覆盖被改动时怎么办？那些改动都经过本插件（编译、改写），
   * 而插件的每一次写都会调 `invalidateWork()`，它顺手把这个缓存清掉。
   * 于是：**产物变了 → 缓存失效 → 下一次重算**，不多算也不错算。
   *
   * **缓存的是「清单」，不是「某一镜的判定」。** 后者会把 A 镜的答案
   * 卖给 B 镜——那是一个静默的错误，比慢更糟。
   */
  async check(options) {
    const workspace = await this.resolveWorkspace(options.workspaceId)
    if (workspace === undefined) throw new Error('没有可用的作品')
    const fingerprint = await this.sourceFingerprint(workspace.dir)
    let raw = this.checkCache
    if (raw === undefined || raw.key !== fingerprint) {
      const result = await runCompile(workspace.dir, { check: true })
      if (!result.ok) return { ok: false, error: result.error }
      // **只缓存与镜无关的部分。**
      //
      // 缓存整个 answer 是错的：answer 里的 `stale` / `changed` 是
      // **这一镜**的判定，把它们缓存起来就等于把 A 镜的答案卖给了 B 镜。
      // 缓存的必须是「哪些镜过期了」这份**清单**，单镜的判定由它现算。
      raw = {
        key: fingerprint,
        stale: result.stale ?? [],
        changed: result.changed ?? [],
        overridden: result.overridden ?? [],
      }
      this.checkCache = raw
    }
    const shotId = options.shotId
    return {
      ok: true,
      shotId,
      stale: shotId === undefined ? false : raw.stale.includes(shotId),
      changed: shotId === undefined ? false : raw.changed.includes(shotId),
      staleShots: raw.stale,
      overridden: raw.overridden,
    }
  }

  /**
   * The fingerprint of a work's真源: `scenes.json` + `shots.json`.
   *
   * 只看真源，不看产物——产物变了会走 `invalidateWork()`，不会走到这里。
   *
   * @param {string} dir the work directory
   * @returns {Promise<string>}
   */
  async sourceFingerprint(dir) {
    const parts = []
    for (const name of ['scenes.json', 'shots.json']) {
      try {
        const info = await stat(join(dir, name))
        parts.push(`${name}:${info.mtimeMs}:${info.size}`)
      } catch {
        parts.push(`${name}:-`)
      }
    }
    return parts.join('|')
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
