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
        if (!path.startsWith(`${API_PREFIX}/api/`)) {
          sendJson(res, 404, { ok: false, error: '未知接口' })
          return
        }
        const resource = path.slice(`${API_PREFIX}/api/`.length)
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
    case 'check':
      if (query.shot === undefined) throw new Error('缺少 shot 参数')
      return await service.check({ workspaceId: query.workspace, shotId: query.shot })
    default:
      throw new Error(`未知接口 ${resource}`)
  }
}

/** Write actions. */
async function runAction(service, action, body) {
  switch (action) {
    case 'edit-beat':
      return await service.editBeat({
        workspaceId: body.workspaceId,
        sceneId: body.sceneId,
        beatIndex: body.beatIndex,
        patch: body.patch,
      })
    case 'edit-shot':
      return await service.editShot({
        workspaceId: body.workspaceId,
        shotId: body.shotId,
        patch: body.patch,
      })
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

/** Content type by extension. */
function contentTypeOf(path) {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
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
        { timeout: 60000, windowsHide: true },
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
