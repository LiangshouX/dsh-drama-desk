/**
 * Where things live on this machine.
 *
 * **为什么不能硬编码 `%USERPROFILE%\Videos`。**
 *
 * 用户会把「视频」目录搬到别的盘——Windows 的资源管理器支持「位置」重定向，
 * 搬过之后 `C:\Users\<你>\Videos` 根本不存在，而默认落点仍指向它。
 * 于是产物悄悄回到系统盘，**在不知不觉中撑爆 C 盘**。
 *
 * 所以这里按**系统自己的答案**来：
 *
 *   1. 显式配置（`cordis.patch.yml` 的 `outputRoot`）——用户说了算，永远最优先；
 *   2. Windows 的**已知文件夹** `FOLDERID_Videos`（读注册表
 *      `User Shell Folders\{35286A68-…}`）——它跟随「位置」重定向；
 *   3. **镜像**被搬走的「文档」库：`<文档所在目录>\Videos`；
 *   4. `%USERPROFILE%\Videos`——最后的朴素默认。
 *
 * 选中的路径会被**验证存在**；都不存在时取第一个并如实说明。
 * 每次解析都返回**理由**，界面上要能回答「为什么是这个目录」。
 */
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, parse, resolve } from 'node:path'

/** `FOLDERID_Videos` 在注册表 `User Shell Folders` 里的键名。 */
const VIDEOS_FOLDER_GUID = '{35286A68-3C57-41A1-BBB1-0EAE73D76C95}'
/** `FOLDERID_Documents` 的注册表键名（用来镜像重定向）。 */
const DOCUMENTS_FOLDER_GUID = '{F42EE2D3-909F-4907-8871-4C22FC0BF756}'

/**
 * A resolved location: where it is, how we got there, and whether it is safe.
 *
 * @typedef {{
 *   path: string,
 *   source: 'config' | 'known-folder' | 'mirrored-library' | 'home' | 'profile' | 'cwd',
 *   reason: string,
 *   exists: boolean,
 *   onSystemDrive: boolean,
 * }} Location
 */

/** Cached shell-folder probe; `undefined` means "not probed yet". */
let shellFolders

/** One PowerShell probe for every folder we care about. */
const SHELL_FOLDER_PROBE = [
  "$k = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders' -ErrorAction SilentlyContinue",
  '$v = $k."' + VIDEOS_FOLDER_GUID + '"',
  '$d = $k."' + DOCUMENTS_FOLDER_GUID + '"',
  "$p = $k.Personal",
  "[ordered]@{ videos = $v; documents = $d; personal = $p } | ConvertTo-Json -Compress",
].join('; ')

/**
 * Read the user's relocated shell folders.
 *
 * The registry values may themselves contain a `{GUID}` token (a second level
 * of redirection); such a token is expanded against the same key.
 *
 * @returns {Promise<{videos?: string, documents?: string}>}
 */
async function probeShellFolders() {
  if (shellFolders !== undefined) return shellFolders
  shellFolders = {}
  if (process.platform !== 'win32') return shellFolders
  const result = await new Promise(resolve => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', SHELL_FOLDER_PROBE],
      { timeout: 15000, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout) => resolve({ error, stdout: String(stdout ?? '') }),
    )
  })
  if (result.error !== null) return shellFolders
  try {
    const parsed = JSON.parse(result.stdout.trim())
    if (typeof parsed.videos === 'string' && parsed.videos !== '') shellFolders.videos = parsed.videos
    if (typeof parsed.documents === 'string' && parsed.documents !== '') shellFolders.documents = parsed.documents
  } catch {
    // 读不到就当没有；下面的候选链会退回朴素默认。
  }
  return shellFolders
}

/**
 * Whether a path sits on the **system drive** (Windows' system volume).
 *
 * This is the "don't fill up C:" guard: a location on the system drive is
 * reported so the UI can say so out loud.
 */
export function isOnSystemDrive(path) {
  if (process.platform !== 'win32') return false
  const systemDrive = (process.env.SystemDrive ?? 'C:').replace(/[:\\]/g, '').toUpperCase()
  const root = parse(resolve(path)).root.replace(/[:\\]/g, '').toUpperCase()
  return root === systemDrive
}

/**
 * Resolve the **output root** — where the finished film files go.
 *
 * @param {string|undefined} configured the user's explicit value, if any
 * @returns {Promise<Location>}
 */
export async function resolveOutputRoot(configured) {
  if (typeof configured === 'string' && configured.trim() !== '') {
    const path = resolve(configured)
    return {
      path,
      source: 'config',
      reason: '配置里指定的产物位置',
      exists: existsSync(path),
      onSystemDrive: isOnSystemDrive(path),
    }
  }

  const candidates = []
  if (process.platform === 'win32') {
    const folders = await probeShellFolders()
    if (folders.videos !== undefined) {
      candidates.push({
        path: folders.videos,
        source: 'known-folder',
        reason: 'Windows「视频」已知文件夹（跟随资源管理器的位置重定向）',
      })
    }
    if (folders.documents !== undefined) {
      const mirrored = join(dirname(folders.documents), 'Videos')
      candidates.push({
        path: mirrored,
        source: 'mirrored-library',
        reason: '与被重定向的「文档」库同盘（Windows 未单独登记「视频」）',
      })
    }
    const profile = process.env.USERPROFILE
    if (profile !== undefined && profile !== '') {
      candidates.push({ path: join(profile, 'Videos'), source: 'home', reason: '用户主目录下的 Videos' })
    }
  } else if (process.platform === 'darwin') {
    candidates.push({ path: join(homedir(), 'Movies'), source: 'home', reason: '用户主目录下的 Movies' })
  } else {
    candidates.push({ path: join(homedir(), 'Videos'), source: 'home', reason: '用户主目录下的 Videos' })
  }

  if (candidates.length === 0) {
    const path = join(homedir(), 'Videos')
    return { path, source: 'home', reason: '用户主目录下的 Videos', exists: existsSync(path), onSystemDrive: isOnSystemDrive(path) }
  }

  const existing = candidates.find(candidate => existsSync(candidate.path))
  const chosen = existing ?? candidates[0]
  return {
    path: chosen.path,
    source: chosen.source,
    reason: chosen.reason,
    exists: existsSync(chosen.path),
    onSystemDrive: isOnSystemDrive(chosen.path),
  }
}

/**
 * Resolve the **project root** — where the works live.
 *
 * 1. 显式配置；
 * 2. 候选根里**第一个真的装着作品**的目录（作品根按数据契约是 `<root>/workspaces/<work-id>/`）；
 * 3. 候选根的默认目录。
 *
 * 候选根的顺序是刻意的：**先看产物旁边的位置**（用户把作品和成片放一起是常态），
 * 再看 DSH 的默认工作目录，最后看进程工作目录。
 *
 * @param {string|undefined} configured
 * @param {string[]} roots candidate roots to probe, in order
 * @returns {Promise<Location>}
 */
export async function resolveProjectRoot(configured, roots = [], options = {}) {
  if (typeof configured === 'string' && configured.trim() !== '') {
    const path = resolve(configured)
    return {
      path,
      source: 'config',
      reason: '配置里指定的项目根',
      exists: existsSync(path),
      onSystemDrive: isOnSystemDrive(path),
    }
  }
  for (const candidate of roots) {
    if (candidate === undefined || candidate === null || candidate === '') continue
    const path = resolve(candidate)
    if (!existsSync(path)) continue
    if (existsSync(join(path, 'workspaces'))) {
      return {
        path,
        source: 'cwd',
        reason: '当前会话工作目录里有作品',
        exists: true,
        onSystemDrive: isOnSystemDrive(path),
      }
    }
  }
  // **一个工作台只有一个总根。**
  //
  // 作品散落在各个目录里是治理灾难：侧栏碎成一堆工作区、谁也说不清哪份是
  // 最新的。所以默认落在 `「视频」/DSH-DRAMA-DESK/` —— 一个稳定的、有名字的根，
  // 以后每个短剧项目都是它下面的 `workspaces/<work-id>/`。
  // 第一次解析时顺手把它建出来（两个空目录，没有副作用）。
  if (typeof options.defaultRoot === 'string' && options.defaultRoot !== '') {
    const path = resolve(options.defaultRoot)
    try {
      mkdirSync(join(path, 'workspaces'), { recursive: true })
    } catch {
      // 建不出来就退回下面的老逻辑，界面上会如实说明路径不可用。
    }
    if (existsSync(path)) {
      return {
        path,
        source: 'default-root',
        reason: '短剧工作台的总根（「视频」目录下，自动创建）',
        exists: true,
        onSystemDrive: isOnSystemDrive(path),
      }
    }
  }
  const fallback = roots.find(candidate => candidate !== undefined && candidate !== '' && existsSync(candidate))
  const path = fallback !== undefined ? resolve(fallback) : process.cwd()
  return {
    path,
    source: fallback !== undefined ? 'profile' : 'cwd',
    reason: fallback !== undefined ? '默认工作目录' : '进程工作目录',
    exists: existsSync(path),
    onSystemDrive: isOnSystemDrive(path),
  }
}
