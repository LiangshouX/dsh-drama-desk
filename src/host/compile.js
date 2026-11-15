/**
 * Drive the prompt compiler.
 *
 * The compiler is **the work's own** `prompts/compile_prompts.py` when it
 * exists: the six-section prompt format is model- and work-specific, so the
 * plugin must not carry a copy of it. The plugin's packaged
 * `src/tools/compile_prompts.py` is the fallback driver; it still delegates
 * the actual prompt text to a `slim_prompt.py` found in the work's toolkit
 * directory, so no prompt content is ever hard-coded here.
 *
 * The plugin never writes `shots.json` itself: derived fields are written by
 * the compiler, and only the compiler.
 */
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { isFile } from './fsx.js'
import { TOOLS_DIR } from './paths.js'

/** Resolve a working Python interpreter (same probe as the QC driver). */
async function resolvePython() {
  const candidates = process.platform === 'win32'
    ? [['python', []], ['py', ['-3']]]
    : [['python3', []], ['python', []]]
  for (const [command, prefix] of candidates) {
    const probe = await new Promise(resolve => {
      execFile(command, [...prefix, '-c', 'import sys; print(sys.version_info[0])'], { timeout: 8000, windowsHide: true }, error => {
        resolve(error === null)
      })
    })
    if (probe) return { command, prefix }
  }
  return undefined
}

/**
 * Locate the compiler and the toolkit that owns the prompt generator.
 *
 * @returns {Promise<{script: string, toolkit: string, source: string}|undefined>}
 */
export async function locateCompiler(workDir) {
  const workPrompts = join(workDir, 'prompts')
  const workScript = join(workPrompts, 'compile_prompts.py')
  if (await isFile(workScript)) {
    return { script: workScript, toolkit: workPrompts, source: 'work' }
  }
  const packaged = join(TOOLS_DIR, 'compile_prompts.py')
  if (await isFile(packaged)) {
    const toolkit = (await isFile(join(workPrompts, 'slim_prompt.py'))) ? workPrompts : TOOLS_DIR
    return { script: packaged, toolkit, source: 'plugin' }
  }
  return undefined
}

/**
 * Run the compiler.
 *
 * @param {string} workDir
 * @param {{check?: boolean, dry?: boolean, shotId?: string}} options
 */
export async function runCompile(workDir, options = {}) {
  const located = await locateCompiler(workDir)
  if (located === undefined) {
    return { ok: false, error: '找不到编译脚本：作品目录下没有 prompts/compile_prompts.py，插件包内也没有 src/tools/compile_prompts.py' }
  }
  const python = await resolvePython()
  if (python === undefined) {
    return { ok: false, error: '编译不可用：未找到 Python 解释器（PATH 中没有 python / py -3）' }
  }
  const args = [...python.prefix, located.script, '--work', workDir, '--toolkit', located.toolkit, '--json']
  if (options.check === true) args.push('--check')
  if (options.dry === true) args.push('--dry')
  if (options.shotId !== undefined) args.push('--shot', options.shotId)
  const result = await new Promise(resolve => {
    execFile(python.command, args, { timeout: 120000, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })
    })
  })
  const text = result.stdout.trim()
  let parsed
  if (text !== '') {
    try {
      parsed = JSON.parse(text.split('\n').filter(line => line.trim().startsWith('{')).pop() ?? text)
    } catch {
      parsed = undefined
    }
  }
  if (parsed === undefined || parsed.ok !== true) {
    const reason = parsed?.error ?? result.stderr.trim() ?? (result.error instanceof Error ? result.error.message : '未知错误')
    return { ok: false, error: `编译失败：${reason}` }
  }
  return {
    ok: true,
    changed: parsed.changed ?? [],
    stale: parsed.stale ?? [],
    prompts: parsed.prompts ?? 0,
    source: located.source,
    script: located.script,
  }
}
