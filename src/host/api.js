/**
 * The browser-facing HTTP surface.
 *
 * Two routes, both under one prefix:
 *
 *   GET  /drama-desk/api/<resource>[?…]   JSON — the read model
 *   POST /drama-desk/api/<action>          JSON — the write model
 *   GET  /drama-desk/image?…               image bytes, **always ≤1200px**
 *
 * The route is a transport, not a second implementation: every handler calls
 * the same `DramaDeskService` method the agent tool calls.
 *
 * Trust fence: the request must come from a loopback authority, must not be
 * cross-site, and — when it carries an `Origin` — must come from the same
 * authority it claims. This mirrors the semantics the Host's own API gateway
 * applies, so the plugin does not open a wider door than the host already has.
 */
import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { pipeline as streamPipeline } from 'node:stream/promises'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TOOLS_DIR } from './paths.js'
import { resolveWithin } from './fsx.js'

/** The route prefix the plugin owns. */
export const API_PREFIX = '/drama-desk'

/** Longest edge an image may have before it is shown to a human. */
export const MAX_IMAGE_EDGE = 1200

/** Read one request header. */
function header(headers, name) {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

/** Parse an authority into a URL-ish object, or `undefined`. */
function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

/** Whether a hostname is a loopback name or address. */
function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]' || hostname === '::1') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/**
 * Whether a request may use the plugin's routes.
 *
 * @param {import('node:http').IncomingMessage} req
 */
export function isTrustedRequest(req) {
  const host = header(req.headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname)) return false
  if (header(req.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(req.headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** Write a JSON response. */
function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.length),
    'cache-control': 'no-store',
  })
  res.end(body)
}

/** Read a JSON request body (bounded). */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 4 * 1024 * 1024) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * Register the plugin's routes on the Host web server.
 *
 * @param {object} ctx the plugin context
 * @param {DramaDeskService} service
 */
export function registerApi(ctx, service) {
  /**
   * Request counters — so 「面板藏起来之后轮询停了」是**测出来的**，
   * 不是「应该会停」。
   */
  const counters = { total: 0, byResource: new Map(), startedAt: Date.now() }
  const count = resource => {
    counters.total += 1
    counters.byResource.set(resource, (counters.byResource.get(resource) ?? 0) + 1)
  }
  return ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: async (req, res) => {
      if (!isTrustedRequest(req)) {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('forbidden')
        return
      }
      const url = new URL(req.url ?? '/', 'http://dsh.internal')
      const path = url.pathname
      try {
        if (path.startsWith(`${API_PREFIX}/image`)) {
          await serveImage(service, url, res)
          return
        }
        if (path.startsWith(`${API_PREFIX}/poster`)) {
          await servePoster(service, url, res)
          return
        }
        if (path.startsWith(`${API_PREFIX}/video`)) {
          await serveVideo(service, url, req, res)
          return
        }
        if (!path.startsWith(`${API_PREFIX}/api/`)) {
          sendJson(res, 404, { ok: false, error: '未知接口' })
          return
        }
        const resource = path.slice(`${API_PREFIX}/api/`.length)
        if (resource === 'stats') {
          sendJson(res, 200, {
            ok: true,
            data: {
              total: counters.total,
              byResource: Object.fromEntries(counters.byResource),
              startedAt: counters.startedAt,
              uptimeMs: Date.now() - counters.startedAt,
            },
          })
          return
        }
        count(resource)
        if (req.method === 'GET') {
          const query = Object.fromEntries(url.searchParams.entries())
          sendJson(res, 200, { ok: true, data: await readResource(service, resource, query) })
          return
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req)
          sendJson(res, 200, { ok: true, data: await runAction(service, resource, body) })
          return
        }
        res.writeHead(405, { allow: 'GET, POST' })
        res.end()
      } catch (error) {
        if (res.headersSent) { res.destroy(); return }
        const message = error instanceof Error ? error.message : String(error)
        sendJson(res, 400, { ok: false, error: message })
      }
    },
  }), 'dsh-drama-desk: API routes')
}

/** Read-only resources. */
async function readResource(service, resource, query) {
  switch (resource) {
    case 'overview':
      return await service.overview()
    case 'production':
      return await service.productionTask({ workspaceId: query.workspace, stage: query.stage })
    case 'pipeline':
      return await service.pipeline({ workspaceId: query.workspace })
    case 'shot':
      if (query.shot === undefined) throw new Error('缺少 shot 参数')
      return await service.shot({ workspaceId: query.workspace, shotId: query.shot })
    case 'rules':
      return await service.rules({ stage: query.stage })
    case 'assets':
      return await service.assets({ workspaceId: query.workspace })
    case 'ledger':
      return await service.ledger({ workspaceId: query.workspace })
    case 'channels':
      // 生成通道探测：设置抽屉打开时问一次（host=1 时才去问宿主的模型目录）。
      return await service.channels({ refresh: query.refresh === '1', host: query.host !== '0' })
    case 'generation-board':
      return await service.generationBoard({ workspaceId: query.workspace })
    case 'generation-plan':
      return await service.generationPlan({
        workspaceId: query.workspace,
        shots: typeof query.shots === 'string' && query.shots !== '' ? query.shots.split(',') : undefined,
        limit: query.limit === undefined ? undefined : Number(query.limit),
        includePrompts: query.prompts === '1',
      })
    case 'stages':
      return await service.stageState({ workspaceId: query.workspace })
    case 'settings':
      return await service.settings({ workspaceId: query.workspace, full: query.full === '1' })
    case 'check':
      if (query.shot === undefined) throw new Error('缺少 shot 参数')
      return await service.check({ workspaceId: query.workspace, shotId: query.shot })
    case 'snapshot':
      // **轮询用这一个端点**：面板每几秒问一次「现在什么样」，
      // 四个请求就是四倍往返与四倍 HTTP 开销。这里一次给全。
      return await service.snapshot({ workspaceId: query.workspace })
    case 'stage':
      if (query.stage === undefined) throw new Error('缺少 stage 参数')
      return await service.stageView({ workspaceId: query.workspace, stage: query.stage })
    case 'prompt':
      if (query.shot === undefined) throw new Error('缺少 shot 参数')
      return await service.prompt({ workspaceId: query.workspace, shotId: query.shot })
    case 'workspaces':
      return await service.workspaces({ workspaceId: query.workspace })
    case 'browse':
      return await service.browse({ path: query.path })
    case 'conceive-session':
      return await service.conceiveSession({ workspaceId: query.workspace })
    case 'sessions':
      // 这个短剧工作区里的会话清单（构思会话窗的「选择对话」用）。
      return await service.sessions({ workspaceId: query.workspace })
    case 'model-info':
      // 一个模型的推理强度档位（模型菜单打开时按需问一次）。
      if (query.provider === undefined || query.model === undefined) {
        throw new Error('缺少 provider 或 model 参数')
      }
      return await service.modelInfo({ provider: query.provider, model: query.model })
    default:
      throw new Error(`未知接口 ${resource}`)
  }
}

/** Write actions. */
async function runAction(service, action, body) {
  switch (action) {
    case 'register-asset':
      return await service.registerAsset({ workspaceId: body.workspaceId, id: body.id, type: body.type, path: body.path,
        role: body.role, shotId: body.shotId, version: body.version, source: body.source })
    case 'add-record':
      return await service.addRecord({ workspaceId: body.workspaceId, kind: body.kind, sceneId: body.sceneId,
        id: body.id, fields: body.fields, stage: body.stage })
    case 'assemble':
      return await service.assemble({ workspaceId: body.workspaceId, profile: body.profile })
    case 'approve-shot':
      return await service.approveShot({ workspaceId: body.workspaceId, shotId: body.shotId })
    case 'confirm-delivery':
      return await service.confirmDelivery({ workspaceId: body.workspaceId, assetId: body.assetId })
    case 'edit-beat':
      return await service.editBeat({
        workspaceId: body.workspaceId,
        sceneId: body.sceneId,
        op: body.op,
        beatIndex: body.beatIndex,
        toIndex: body.toIndex,
        patch: body.patch,
        stage: body.stage,
      })
    case 'edit-shot':
      return await service.editShot({
        workspaceId: body.workspaceId,
        shotId: body.shotId,
        patch: body.patch,
        stage: body.stage,
      })
    case 'edit-scene':
      return await service.editScene({
        workspaceId: body.workspaceId,
        sceneId: body.sceneId,
        patch: body.patch,
        stage: body.stage,
      })
    case 'edit-character':
      return await service.editCharacter({
        workspaceId: body.workspaceId,
        characterId: body.characterId,
        patch: body.patch,
        stage: body.stage,
      })
    case 'edit-brief':
      return await service.editBrief({
        workspaceId: body.workspaceId,
        text: body.text,
        stage: body.stage,
      })
    case 'edit-asset':
      return await service.editAsset({
        workspaceId: body.workspaceId,
        assetId: body.assetId,
        patch: body.patch,
        stage: body.stage,
      })
    case 'edit-verify':
      return await service.editVerify({
        workspaceId: body.workspaceId,
        shotId: body.shotId,
        patch: body.patch,
        stage: body.stage,
      })
    case 'annotate-shot':
      return await service.annotateShot({
        workspaceId: body.workspaceId,
        shotId: body.shotId,
        note: body.note,
        stage: body.stage,
      })
    case 'prompt':
      return await service.savePrompt({
        workspaceId: body.workspaceId,
        shotId: body.shotId,
        text: body.text,
        stage: body.stage,
      })
    case 'prompt-reset':
      return await service.resetPrompt({
        workspaceId: body.workspaceId,
        shotId: body.shotId,
        stage: body.stage,
      })
    case 'pick-folder':
      return await service.pickFolder({ target: body.target })
    case 'conceive-session':
      return await service.conceiveSession({ workspaceId: body.workspaceId, create: true, fresh: body.fresh === true })
    case 'conceive-scope':
      // 按会话钉住作品范围：客户端每绑定一段会话就调一次（幂等）。
      // 不创建会话、不写盘——它只给这一段 agent 挂一段 prompt context。
      return await service.conceiveScope({ workspaceId: body.workspaceId, sessionId: body.sessionId, stage: body.stage })
    case 'create-directory':
      return await service.makeDirectory({ path: body.path, name: body.name })
    case 'workspace':
      if (body.action === 'create') {
        return await service.createWorkspace({ id: body.id, title: body.title, draft: body.draft === true })
      }
      if (body.action === 'rename') {
        // 立项：给草稿（或任何作品）定名字与目录 ID。
        return await service.renameWorkspace({ workspaceId: body.workspaceId, id: body.id, title: body.title })
      }
      if (body.action === 'select') {
        return { ok: true, selected: body.id }
      }
      throw new Error(`未知作品操作 ${body.action}`)
    case 'set-stage':
      return await service.setStage({
        workspaceId: body.workspaceId,
        stage: body.stage,
      })
    case 'update-settings':
      return await service.updateSettings({
        projectRoot: body.projectRoot,
        outputRoot: body.outputRoot,
        adapter: body.adapter,
        model: body.model,
        generationProvider: body.generationProvider,
        generationModel: body.generationModel,
        imageChannel: body.imageChannel,
        imageModel: body.imageModel,
        videoChannel: body.videoChannel,
        videoModel: body.videoModel,
        channels: body.channels,
        mcodePath: body.mcodePath,
        paidExecution: body.paidExecution,
        hostProvider: body.hostProvider,
        hostModel: body.hostModel,
        hostReasoningEffort: body.hostReasoningEffort,
        autoRefresh: body.autoRefresh,
      })
    case 'execute-generation':
      // **会花钱**：必须带计划摘要与 approve。传输层不替它做决定。
      return await service.executeGeneration({
        workspaceId: body.workspaceId,
        digest: body.digest,
        approve: body.approve === true,
        kinds: Array.isArray(body.kinds) ? body.kinds : undefined,
        shots: Array.isArray(body.shots) ? body.shots : undefined,
        limit: body.limit,
      })
    case 'poll-generation':
      return await service.pollGeneration({ workspaceId: body.workspaceId })
    case 'compile':
      return await service.compile({
        workspaceId: body.workspaceId,
        shotId: body.shotId,
        check: body.check === true,
        dry: body.dry === true,
      })
    default:
      throw new Error(`未知操作 ${action}`)
  }
}

/**
 * Serve one image asset, **never larger than 1200px on the long edge**.
 *
 * The asset is addressed by id, never by path, so the browser cannot ask for
 * an arbitrary file. A source image already within the limit is served as is;
 * a larger one is downscaled first. If the downscaler is unavailable the
 * request fails loudly instead of serving an oversized image — the discipline
 * is a component-level constraint, not a preference.
 */
async function serveImage(service, url, res) {
  const assetId = url.searchParams.get('asset')
  const workspaceId = url.searchParams.get('workspace') ?? undefined
  if (assetId === null) {
    sendJson(res, 400, { ok: false, error: '缺少 asset 参数' })
    return
  }
  const listing = await service.assets({ workspaceId })
  const asset = listing.assets.find(row => row.id === assetId)
  if (asset === undefined) {
    sendJson(res, 404, { ok: false, error: `资产 ${assetId} 不存在` })
    return
  }
  if (typeof asset.path !== 'string' || asset.path === '') {
    sendJson(res, 404, { ok: false, error: `资产 ${assetId} 没有文件路径` })
    return
  }
  const absolute = resolveWithin(listing.workspace.dir, asset.path)
  let info
  try {
    info = await stat(absolute)
  } catch {
    sendJson(res, 404, { ok: false, error: `资产 ${assetId} 的文件不存在：${asset.path}` })
    return
  }
  const sourceWidth = typeof asset.width === 'number' ? asset.width : undefined
  const sourceHeight = typeof asset.height === 'number' ? asset.height : undefined
  const known = sourceWidth !== undefined && sourceHeight !== undefined
  const oversized = known ? Math.max(sourceWidth, sourceHeight) > MAX_IMAGE_EDGE : true
  if (!oversized) {
    const body = await readFile(absolute)
    res.writeHead(200, {
      'content-type': contentTypeOf(absolute),
      'content-length': String(body.length),
      'cache-control': 'no-store',
      'x-image-max-edge': String(MAX_IMAGE_EDGE),
    })
    res.end(body)
    return
  }
  const scaled = await downscale(absolute)
  if (scaled === undefined) {
    sendJson(res, 409, {
      ok: false,
      error: `图片超过 ${MAX_IMAGE_EDGE}px，按会话安全约束不予直接显示（原始尺寸 ${sourceWidth ?? '未知'}×${sourceHeight ?? '未知'}）。请用外部工具查看，或安装 Pillow 后重试。`,
      maxEdge: MAX_IMAGE_EDGE,
    })
    return
  }
  res.writeHead(200, {
    'content-type': 'image/jpeg',
    'content-length': String(scaled.bytes.length),
    'cache-control': 'no-store',
    'x-image-max-edge': String(MAX_IMAGE_EDGE),
    'x-image-scaled-from': `${scaled.sourceWidth ?? '?'}x${scaled.sourceHeight ?? '?'}`,
  })
  res.end(scaled.bytes)
}

/**
 * Serve one shot's still frame — keyframe, cached frame, or a grab from the
 * shot's own video.
 *
 * The frame is produced by the Host (which knows the work) and cached in the
 * work's `.frames/` directory. It is a **cache**, not an asset: nothing is
 * registered, nothing is written into `assets.json`.
 */
async function servePoster(service, url, res) {
  const shotId = url.searchParams.get('shot')
  const workspaceId = url.searchParams.get('workspace') ?? undefined
  if (shotId === null) {
    sendJson(res, 400, { ok: false, error: '缺少 shot 参数' })
    return
  }
  const poster = await service.posterPath({ workspaceId, shotId })
  if (poster === undefined) {
    sendJson(res, 404, { ok: false, error: `镜头 ${shotId} 没有静帧` })
    return
  }
  let body
  try {
    body = await readFile(poster.path)
  } catch {
    sendJson(res, 404, { ok: false, error: `镜头 ${shotId} 的静帧读不出来` })
    return
  }
  res.writeHead(200, {
    'content-type': 'image/jpeg',
    'content-length': String(body.length),
    'cache-control': 'no-store',
    'x-poster-cached': poster.cached === true ? '1' : '0',
  })
  res.end(body)
}

/** Content type by extension. */
function contentTypeOf(path) {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

/** Video content type by extension. */
function videoTypeOf(path) {
  const lower = path.toLowerCase()
  if (lower.endsWith('.webm')) return 'video/webm'
  if (lower.endsWith('.mov') || lower.endsWith('.qt')) return 'video/quicktime'
  if (lower.endsWith('.mkv')) return 'video/x-matroska'
  if (lower.endsWith('.m4v')) return 'video/mp4'
  return 'video/mp4'
}

/**
 * Serve one video asset, with HTTP Range so the browser can scrub.
 *
 * The same fence as the image route: the asset is addressed by **id**, never by
 * path, and the resolved path must stay inside the work directory.
 */
async function serveVideo(service, url, req, res) {
  const assetId = url.searchParams.get('asset')
  const workspaceId = url.searchParams.get('workspace') ?? undefined
  if (assetId === null) {
    sendJson(res, 400, { ok: false, error: '缺少 asset 参数' })
    return
  }
  const listing = await service.assets({ workspaceId })
  const asset = listing.assets.find(row => row.id === assetId)
  if (asset === undefined) {
    sendJson(res, 404, { ok: false, error: `资产 ${assetId} 不存在` })
    return
  }
  if (typeof asset.path !== 'string' || asset.path === '') {
    sendJson(res, 404, { ok: false, error: `资产 ${assetId} 没有文件路径` })
    return
  }
  const absolute = resolveWithin(listing.workspace.dir, asset.path)
  let info
  try {
    info = await stat(absolute)
  } catch {
    sendJson(res, 404, { ok: false, error: `资产 ${assetId} 的文件不存在：${asset.path}` })
    return
  }
  const type = videoTypeOf(absolute)
  const range = parseRange(header(req.headers, 'range'), info.size)
  if (range?.unsatisfiable) {
    res.writeHead(416, { ...VIDEO_HEADERS, 'content-range': `bytes */${info.size}` })
    res.end()
    return
  }
  if (range === null) {
    res.writeHead(200, { ...VIDEO_HEADERS, 'content-type': type, 'content-length': String(info.size) })
    await streamPipeline(createReadStream(absolute), res)
    return
  }
  const start = range.start
  const end = range.end
  res.writeHead(206, {
    ...VIDEO_HEADERS,
    'content-type': type,
    'content-range': `bytes ${start}-${end}/${info.size}`,
    'content-length': String(end - start + 1),
  })
  await streamPipeline(createReadStream(absolute, { start, end }), res)
}

/** Headers every video response carries. */
const VIDEO_HEADERS = {
  'content-type': 'video/mp4',
  'accept-ranges': 'bytes',
  'cache-control': 'no-store',
}

/**
 * Parse a single `Range: bytes=…` header against a known size.
 *
 * @param {string|undefined} raw
 * @param {number} size
 * @returns {{start: number, end: number}|{unsatisfiable: true}|null}
 */
function parseRange(raw, size) {
  if (raw === undefined) return null
  const match = /^bytes=(.+)$/i.exec(raw.trim())
  if (match === null) return null
  const spec = match[1].split(',')[0].trim()
  if (spec === '') return null
  if (spec.startsWith('-')) {
    const suffix = Number(spec.slice(1))
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    if (suffix >= size) return { start: 0, end: size - 1 }
    return { start: size - suffix, end: size - 1 }
  }
  const dash = spec.indexOf('-')
  if (dash === -1) return null
  const start = spec.slice(0, dash) === '' ? 0 : Number(spec.slice(0, dash))
  const end = spec.slice(dash + 1) === '' ? size - 1 : Number(spec.slice(dash + 1))
  if (!Number.isInteger(start) || start < 0 || !Number.isInteger(end)) return null
  if (start >= size) return { unsatisfiable: true }
  return { start, end: Math.min(end, size - 1) }
}

/**
 * Downscale one image to ≤1200px using the packaged helper.
 *
 * @returns {Promise<{bytes: Buffer, sourceWidth?: number, sourceHeight?: number}|undefined>}
 */
async function downscale(absolute) {
  const python = await resolvePython()
  if (python === undefined) return undefined
  const directory = await mkdtemp(join(tmpdir(), 'drama-desk-'))
  const target = join(directory, 'preview.jpg')
  try {
    const result = await new Promise(resolve => {
      execFile(
        python.command,
        [...python.prefix, join(TOOLS_DIR, 'safe_image.py'), '--in', absolute, '--out', target, '--max', String(MAX_IMAGE_EDGE)],
        {
          timeout: 60000,
          windowsHide: true,
          // 中文 Windows 的 Python 默认用 GBK 写 stdout，中文会变成乱码。
          env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
        },
        (error, stdout) => resolve({ error, stdout: String(stdout ?? '') }),
      )
    })
    if (result.error !== null) return undefined
    let parsed
    try {
      parsed = JSON.parse(result.stdout.trim())
    } catch {
      return undefined
    }
    if (parsed?.ok !== true) return undefined
    return {
      bytes: await readFile(target),
      sourceWidth: parsed.sourceWidth,
      sourceHeight: parsed.sourceHeight,
    }
  } catch {
    return undefined
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

/** Resolve a working Python interpreter. */
async function resolvePython() {
  const candidates = process.platform === 'win32'
    ? [['python', []], ['py', ['-3']]]
    : [['python3', []], ['python', []]]
  for (const [command, prefix] of candidates) {
    const ok = await new Promise(resolve => {
      execFile(command, [...prefix, '-c', 'import sys; print(sys.version_info[0])'], { timeout: 8000, windowsHide: true }, error => {
        resolve(error === null)
      })
    })
    if (ok) return { command, prefix }
  }
  return undefined
}
