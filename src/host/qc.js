/**
 * Run the shipped QC tools and normalise their results.
 *
 * The plugin **calls** the checkers, it never re-implements them: thresholds,
 * word lists and verdict lines live in `src/tools/*.py` only, so the human
 * reading the UI and the agent calling a tool judge a shot identically.
 *
 * Every runner degrades honestly: when Python (or numpy / Pillow / ffmpeg)
 * is missing, the result carries `available: false` and the reason. The UI
 * then shows "体检器不可用" instead of inventing a verdict.
 */
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { TOOLS_DIR } from './paths.js'

/** Driver that imports the shipped checkers and prints their result as JSON. */
const DRIVER = join(TOOLS_DIR, 'desk_qc.py')

/** Cached python interpreter; `undefined` means "not resolved yet". */
let pythonCommand

/** Candidate interpreters, in the order they are tried. */
const PYTHON_CANDIDATES = process.platform === 'win32'
  ? [['python', []], ['py', ['-3']]]
  : [['python3', []], ['python', []]]

/**
 * Resolve a working Python interpreter.
 *
 * @returns {Promise<{command: string, prefix: string[]}|undefined>}
 */
async function resolvePython() {
  if (pythonCommand !== undefined) return pythonCommand
  for (const [command, prefix] of PYTHON_CANDIDATES) {
    const probe = await run(command, [...prefix, '-c', 'import sys; print(sys.version_info[0])'], 8000)
    if (probe.ok && probe.code === 0) {
      pythonCommand = { command, prefix }
      return pythonCommand
    }
  }
  pythonCommand = undefined
  return undefined
}

/** Promise wrapper around execFile with a hard timeout. */
function run(command, args, timeoutMs) {
  return new Promise(resolve => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        ok: error === null,
        code: error === null ? 0 : (typeof error.code === 'number' ? error.code : 1),
        stdout: String(stdout ?? ''),
        stderr: String(stderr ?? ''),
        message: error === null ? undefined : (error instanceof Error ? error.message : String(error)),
      })
    })
  })
}

/**
 * Run the driver once and parse its JSON answer.
 *
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function drive(args, timeoutMs = 60000) {
  const python = await resolvePython()
  if (python === undefined) {
    return { ok: false, error: '体检器不可用：未找到 Python 解释器（PATH 中没有 python / py -3）' }
  }
  const result = await run(python.command, [...python.prefix, DRIVER, ...args], timeoutMs)
  const text = result.stdout.trim()
  if (text !== '') {
    try {
      const parsed = JSON.parse(text)
      if (parsed && parsed.ok === true) return { ok: true, data: parsed }
      if (parsed && typeof parsed.error === 'string') return { ok: false, error: parsed.error }
    } catch {
      // 落到下面的兜底：把原始输出当成错误信息。
    }
  }
  const detail = result.stderr.trim() !== '' ? result.stderr.trim() : (result.message ?? '未知错误')
  return { ok: false, error: `体检器执行失败（退出码 ${result.code}）：${detail}` }
}

/**
 * 剧本表演层体检（beat_qc）——按场次给出反应拍覆盖率、否定式表演、缺 delivery 等。
 *
 * @param {string} scenesPath `scenes.json` 的绝对路径
 * @param {string|undefined} sceneId 只查一个场次
 */
export async function runBeatQc(scenesPath, sceneId) {
  const args = ['beat', '--scenes', scenesPath]
  if (sceneId !== undefined) args.push('--scene', sceneId)
  return await drive(args, 30000)
}

/**
 * 画面运动质量体检（motion_qc）——近乎静止帧 / 有效运动帧 / 方向平滑 / 相机位移。
 *
 * @param {string[]} videoPaths 视频绝对路径
 */
export async function runMotionQc(videoPaths) {
  if (videoPaths.length === 0) return { ok: true, data: { reports: [] } }
  const args = ['motion']
  for (const path of videoPaths) args.push('--video', path)
  return await drive(args, 300000)
}

/**
 * 参考图质量体检（image_qc）——饱和度 / 明度 / 低饱和区 / 色彩贫乏四条判废线。
 *
 * @param {string[]} imagePaths 图片绝对路径
 */
export async function runImageQc(imagePaths) {
  if (imagePaths.length === 0) return { ok: true, data: { rows: [] } }
  const args = ['image']
  for (const path of imagePaths) args.push('--path', path)
  return await drive(args, 120000)
}
