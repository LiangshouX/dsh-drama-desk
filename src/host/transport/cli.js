/**
 * 传输层：调 `mcode-tools`（MiniMax Code 的原生能力网关）。
 *
 * 这一层只做四件事：**找到它、送出去、拿回来、判成败**。
 * 业务语义（幂等、预算、提示词规范）不在这里。
 *
 * ── 这台机器上实测出来的硬事实（2026-11-24，Windows 11 / Node 22）──────
 *
 * 1. **`mcode-tools` 不在 PATH 上。** 它在
 *    `%USERPROFILE%\.minimax\bin\mcode-tools.cmd` 与
 *    `%USERPROFILE%\.minimax\bin\hosts\<host>\mcode-tools.cmd` 两处。
 *    宿主的 `subprocess.resolveExecutable()` 只查 PATH，所以**会误报「没有」**——
 *    这是 0.3.x 把通道标成不可用的真实原因。这里负责多路发现并记录来源。
 *
 * 2. **Windows 上 `.cmd` 必须 `shell: true`。** Node ≥ 18.20.2 起
 *    `spawn('.cmd', ..., { shell: false })` 直接抛 `EINVAL`。
 *
 * 3. **`shell: true` 之后参数不能带路径**（cmd.exe 会在空格处截断）。
 *    所以 connector 参数一律走 **stdin**（`--args-file -`）：没有临时文件、
 *    没有 BOM、没有引号问题。`upload_temp_url` 的那个路径参数是唯一例外——
 *    它是 CLI 的普通位置参数，且由我们引号包好。
 *
 * 4. **stderr 有 node 警告，不算失败。** 每次调用都有 UNDICI 的 experimental 警告。
 *    判成败只看三层：退出码 → stdout 是合法 JSON → 业务体 `code === 0`。
 *
 * 5. **退出码 0 不等于业务成功。** 查一个不存在的视频任务会返回
 *    `{"code":404,...}` 但退出码是 0。只判退出码的实现会拿着不存在的 task 继续跑。
 *
 * 6. **stdout 是「若干行日志 + 一个 JSON」**，而且不能取「最后一个 JSON」
 *    （响应里的内层对象也是合法 JSON）。取**跨度最大**的那一个。
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/** 三类失败。**类别决定能不能重试**——付费提交只有 transport 层能重试。 */
export class McodeToolsError extends Error {
  /**
   * @param {string} message
   * @param {{kind?: 'transport'|'protocol'|'business', code?: number, stdout?: string, stderr?: string, exitCode?: number, tool?: string}} [details]
   */
  constructor(message, details = {}) {
    super(message)
    this.name = 'McodeToolsError'
    this.kind = details.kind ?? 'transport'
    this.code = details.code
    this.stdout = details.stdout
    this.stderr = details.stderr
    this.exitCode = details.exitCode
    this.tool = details.tool
  }
}

const DEFAULT_TIMEOUT_MS = 120_000
const IS_WIN = process.platform === 'win32'

/** 内置工具名（来自随包技能的实测，不是猜的）。 */
export const MCODE_TOOLS = {
  generateImage: 'connector__matrix__generate_image',
  enhanceImage: 'connector__matrix__enhance_image',
  submitVideo: 'connector__matrix__submit_video_generation',
  queryVideo: 'connector__matrix__query_video_generation',
}

/**
 * 定位 `mcode-tools`，并**说清用的是哪一条路**。
 *
 * 顺序：配置里写死的 → 宿主的 PATH 解析 → `~/.minimax/bin/` →
 * `~/.minimax/bin/hosts/<host>/`（取最新那个 host 目录）。
 * 最后一条是这台机器上的实际位置；前两条是「正式安装到 PATH」的机器。
 *
 * @param {any} service DramaDeskService
 * @param {{configuredPath?: string}} [options]
 * @returns {Promise<{path?: string, source?: string, tried: string[]}>}
 */
export async function resolveMcodeCli(service, options = {}) {
  const tried = []
  const configured = typeof options.configuredPath === 'string' ? options.configuredPath.trim() : ''
  // `off` = 显式禁用：只出计划、不碰任何外部程序（没有装 MiniMax Code 的机器、
  // 或者测试环境都用它）。它比「找不到就当没有」更强：**连探测都不做**。
  if (configured.toLowerCase() === 'off') {
    return { tried: ['配置 mcodePath=off：连接器 CLI 已被显式禁用'] }
  }
  if (configured !== '') {
    tried.push('配置 mcodePath: ' + configured)
    if (await isFile(configured)) return { path: configured, source: 'config', tried }
  }
  // 宿主自己的 PATH 解析：它知道宿主终端环境里的 PATH。
  const subprocess = service?.ctx?.get?.('subprocess')
  if (subprocess !== undefined && typeof subprocess?.resolveExecutable === 'function') {
    try {
      const found = await subprocess.resolveExecutable('mcode-tools')
      if (typeof found === 'string' && found !== '') {
        tried.push('宿主 PATH: ' + found)
        return { path: found, source: 'host-path', tried }
      }
      tried.push('宿主 PATH: 未命中')
    } catch {
      tried.push('宿主 PATH: 解析失败')
    }
  } else {
    tried.push('宿主没有 subprocess 服务')
  }
  const home = homedir()
  const direct = join(home, '.minimax', 'bin', IS_WIN ? 'mcode-tools.cmd' : 'mcode-tools')
  if (await isFile(direct)) return { path: direct, source: 'minimax-bin', tried }
  tried.push('~/.minimax/bin/mcode-tools(.cmd): 不存在')
  // 每个 MiniMax Code 版本一个 host 目录：取**最新修改**的那个。
  const hostsDir = join(home, '.minimax', 'bin', 'hosts')
  let hosts = []
  try {
    hosts = await readdir(hostsDir, { withFileTypes: true })
  } catch {
    tried.push('~/.minimax/bin/hosts: 不存在')
    return { tried }
  }
  const candidates = []
  for (const entry of hosts) {
    if (!entry.isDirectory()) continue
    const file = join(hostsDir, entry.name, IS_WIN ? 'mcode-tools.cmd' : 'mcode-tools')
    if (!(await isFile(file))) continue
    try {
      const info = await stat(file)
      candidates.push({ file, mtime: info.mtimeMs })
    } catch {
      // 读不到就跳过：它只是**一个**候选。
    }
  }
  if (candidates.length === 0) {
    tried.push('~/.minimax/bin/hosts/*/mcode-tools(.cmd): 不存在')
    return { tried }
  }
  candidates.sort((a, b) => b.mtime - a.mtime)
  tried.push('~/.minimax/bin/hosts/*: ' + candidates.length + ' 个候选，用最新的 ' + candidates[0].file)
  return { path: candidates[0].file, source: 'minimax-hosts', tried }
}

async function isFile(path) {
  try {
    const info = await stat(path)
    return info.isFile()
  } catch {
    return false
  }
}

/**
 * 执行一次 CLI。
 *
 * @param {string} exe
 * @param {string[]} args 不含可执行文件
 * @param {{stdin?: string, timeoutMs?: number, cwd?: string, env?: NodeJS.ProcessEnv}} [options]
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export function runCli(exe, args, options = {}) {
  const { stdin, timeoutMs = DEFAULT_TIMEOUT_MS, cwd, env } = options
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(exe, args, {
        cwd,
        env: env ?? process.env,
        // Windows 的 .cmd 包装器必须走 shell（见文件头第 2 条）。
        shell: IS_WIN,
        windowsHide: true,
      })
    } catch (cause) {
      reject(new McodeToolsError(`mcode-tools 启动失败：${cause.message}`, { kind: 'transport' }))
      return
    }
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      reject(new McodeToolsError(`mcode-tools 超时（${timeoutMs}ms）：${args.join(' ')}`, {
        kind: 'transport', stdout, stderr,
      }))
    }, timeoutMs)
    child.stdout?.on('data', chunk => { stdout += chunk })
    child.stderr?.on('data', chunk => { stderr += chunk })
    child.on('error', cause => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new McodeToolsError(`mcode-tools 进程错误：${cause.message}`, { kind: 'transport', stderr }))
    })
    child.on('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code ?? -1 })
    })
    if (child.stdin) {
      // CLI 提前退出时写 stdin 会 EPIPE；那不是业务错误，忽略。
      child.stdin.on('error', () => {})
      child.stdin.end(stdin ?? '')
    }
  })
}

/**
 * 从 stdout 里取出最外层的业务 JSON。
 *
 * @param {string} text
 * @returns {any}
 */
export function parseJsonLoose(text) {
  const trimmed = String(text ?? '').trim()
  if (trimmed === '') {
    throw new McodeToolsError('mcode-tools 没有输出任何内容', { kind: 'protocol', stdout: text })
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    // 落到慢路径：日志与 JSON 混在一起。
  }
  let best
  let bestSpan = -1
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i]
    if (ch !== '{' && ch !== '[') continue
    let end = -1
    try {
      end = scanJsonEnd(trimmed, i)
    } catch {
      end = -1
    }
    if (end > i && end - i > bestSpan) {
      bestSpan = end - i
      best = trimmed.slice(i, end)
    }
  }
  if (best === undefined) {
    throw new McodeToolsError('无法从 stdout 解析出 JSON', { kind: 'protocol', stdout: text })
  }
  return JSON.parse(best)
}

/** 手写扫描器：只跟踪字符串态与转义，不校验结构（大 stdout 上比反复 parse 快）。 */
function scanJsonEnd(text, start) {
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === open) { depth += 1; continue }
    if (ch === close) {
      depth -= 1
      if (depth === 0) return i + 1
    }
  }
  throw new Error('unterminated json')
}

/**
 * 一个 mcode-tools 的薄客户端：只做传输与判成败。
 */
export class McodeClient {
  /**
   * @param {{exe: string, env?: NodeJS.ProcessEnv, timeoutMs?: number}} options
   */
  constructor(options) {
    this.exe = options.exe
    this.env = options.env ?? process.env
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async exec(args, options = {}) {
    return runCli(this.exe, args, {
      stdin: options.stdin,
      timeoutMs: options.timeoutMs ?? this.timeoutMs,
      cwd: options.cwd,
      env: this.env,
    })
  }

  /**
   * 调一个 connector 工具。**三层判成败**。
   *
   * @param {string} toolName
   * @param {object} args 必须是 JSON 对象
   * @param {{timeoutMs?: number}} [options]
   */
  async call(toolName, args, options = {}) {
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      throw new McodeToolsError(`connector 参数必须是 JSON 对象：${toolName}`, { kind: 'protocol', tool: toolName })
    }
    const cliArgs = ['connector', 'call', toolName, '--args-file', '-']
    const { stdout, stderr, exitCode } = await this.exec(cliArgs, {
      stdin: JSON.stringify(args),
      timeoutMs: options.timeoutMs,
    })
    if (exitCode !== 0) {
      throw new McodeToolsError(
        `mcode-tools 退出码 ${exitCode}：${firstLine(stderr) || firstLine(stdout) || '(无输出)'}`,
        { kind: 'transport', stdout, stderr, exitCode, tool: toolName },
      )
    }
    let payload
    try {
      payload = parseJsonLoose(stdout)
    } catch {
      throw new McodeToolsError('mcode-tools 输出无法解析为 JSON', {
        kind: 'protocol', stdout, stderr, exitCode, tool: toolName,
      })
    }
    if (payload !== null && typeof payload === 'object' && 'code' in payload && payload.code !== 0) {
      throw new McodeToolsError(
        `connector 业务失败（code=${payload.code}）：${payload.message ?? '未知'}`,
        { kind: 'business', code: payload.code, stdout, stderr, exitCode, tool: toolName },
      )
    }
    return payload
  }

  /** 认证状态。`status === 'authenticated'` 才算通道可用。 */
  async authStatus() {
    const { stdout, stderr, exitCode } = await this.exec(['auth', 'status'], { timeoutMs: 60_000 })
    if (exitCode !== 0) {
      throw new McodeToolsError(`auth status 失败（exit=${exitCode}）：${firstLine(stderr) || firstLine(stdout)}`, {
        kind: 'transport', stdout, stderr, exitCode,
      })
    }
    return parseJsonLoose(stdout)
  }

  /** 工具目录（发现用）。 */
  async catalog(keyword) {
    const args = ['connector', 'tools']
    if (typeof keyword === 'string' && keyword !== '') args.push('--keyword', keyword)
    const { stdout, exitCode, stderr } = await this.exec(args)
    if (exitCode !== 0) {
      throw new McodeToolsError(`connector tools 失败（exit=${exitCode}）：${firstLine(stderr)}`, {
        kind: 'transport', stdout, stderr, exitCode,
      })
    }
    return parseJsonLoose(stdout)
  }

  /** 单个工具的 schema —— 参数名与上限**从 schema 读，不手抄**。 */
  async schema(toolName) {
    const { stdout, exitCode, stderr } = await this.exec(['connector', 'tool', toolName])
    if (exitCode !== 0) {
      throw new McodeToolsError(`connector tool 失败（exit=${exitCode}）：${firstLine(stderr)}`, {
        kind: 'transport', stdout, stderr, exitCode, tool: toolName,
      })
    }
    return parseJsonLoose(stdout)
  }

  /**
   * 本地文件 → 临时 URL（约 1 小时过期）。
   *
   * @param {string} filePath
   * @param {string} [mimeType]
   */
  async uploadLocal(filePath, mimeType) {
    if (!existsSync(filePath)) {
      throw new McodeToolsError(`要上传的素材不存在：${filePath}`, { kind: 'protocol' })
    }
    // 路径作为位置参数会被 cmd.exe 看到：引号包住，内部双引号转义。
    const quoted = '"' + String(filePath).replace(/"/g, '""') + '"'
    const args = ['upload_temp_url', quoted]
    if (mimeType !== undefined) args.push('--mime-type', mimeType)
    const { stdout, stderr, exitCode } = await this.exec(args, { timeoutMs: 300_000 })
    if (exitCode !== 0) {
      throw new McodeToolsError(`upload_temp_url 失败（exit=${exitCode}）：${firstLine(stderr) || firstLine(stdout)}`, {
        kind: 'transport', stdout, stderr, exitCode,
      })
    }
    const payload = parseJsonLoose(stdout)
    const url = payload?.temp_url ?? payload?.url ?? payload?.download_url
    if (typeof url !== 'string' || url === '') {
      throw new McodeToolsError('upload_temp_url 没返回 URL', { kind: 'protocol', stdout, stderr })
    }
    return payload
  }

  /** node_id → 短时下载 URL。URL 过期再调一次，**不要重查任务**。 */
  async assetUrl(nodeId) {
    const { stdout, stderr, exitCode } = await this.exec(['get_asset_url', String(nodeId)], { timeoutMs: 120_000 })
    if (exitCode !== 0) {
      throw new McodeToolsError(`get_asset_url 失败（exit=${exitCode}）：${firstLine(stderr) || firstLine(stdout)}`, {
        kind: 'transport', stdout, stderr, exitCode,
      })
    }
    const payload = parseJsonLoose(stdout)
    const url = payload?.download_url ?? payload?.url
    if (typeof url !== 'string' || url === '') {
      throw new McodeToolsError('get_asset_url 没返回 URL', { kind: 'protocol', stdout, stderr })
    }
    return payload
  }

  /** node_id → 本地文件（流式，**不把整片读进内存**）。 */
  async downloadAsset(nodeId, dest) {
    const { download_url } = await this.assetUrl(nodeId)
    return await downloadToFile(download_url, dest)
  }
}

/**
 * URL → 本地文件（流式）。
 *
 * @param {string} url
 * @param {string} dest
 * @returns {Promise<{path: string, bytes: number}>}
 */
export async function downloadToFile(url, dest) {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
  if (!response.ok) {
    throw new McodeToolsError(`下载失败（HTTP ${response.status}）：${url}`, { kind: 'transport' })
  }
  await mkdir(dirname(dest), { recursive: true })
  let bytes = 0
  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length
      callback(null, chunk)
    },
  })
  await pipeline(Readable.fromWeb(response.body), counter, createWriteStream(dest))
  return { path: dest, bytes }
}

/** sha256（提示词 / 参数指纹）。 */
export function sha256(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex')
}

function firstLine(text) {
  return String(text ?? '').trim().split('\n')[0] ?? ''
}
