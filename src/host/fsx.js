/**
 * Filesystem helpers shared by the Host half.
 *
 * Every read of project data goes through here so that:
 *  - a missing file is a value, never a thrown error (the UI must show an
 *    empty state, not a stack trace);
 *  - a write is atomic (write to a sibling temp file, then rename), so a
 *    crash mid-write cannot leave a half-written `scenes.json` behind;
 *  - JSON carries a trailing newline and keeps its original key order, so a
 *    human diff of a真源 file stays readable.
 */
import { readFile, writeFile, rename, mkdir, readdir, stat, copyFile, rm } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

/** Read a UTF-8 text file; return `undefined` when it does not exist. */
export async function readTextIfExists(path) {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (isAbsent(error)) return undefined
    throw error
  }
}

/** Read and parse a JSON file; return `undefined` when it does not exist. */
export async function readJsonIfExists(path) {
  const text = await readTextIfExists(path)
  if (text === undefined) return undefined
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${path} 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Write a text file atomically, creating parent directories as needed. */
export async function writeTextAtomic(path, text) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  await writeFile(temporary, text, 'utf8')
  await replaceFile(temporary, path)
}

/**
 * Put `temporary` in place of `path`.
 *
 * Windows 的 `rename` 在目标文件正被别的进程打开时（杀毒软件、索引器、
 * 文件预览、甚至另一个读者）会报 `EBUSY` / `EPERM`。那是**暂时**的：
 * 重试几次就成了。
 *
 * 重试仍然不行，就退回到「就地覆盖」——那不原子，但**不丢数据**。
 * 半写的文件比拿不到数据的界面好得多。
 */
async function replaceFile(temporary, path) {
  const delays = [0, 40, 120, 300]
  for (const delay of delays) {
    if (delay > 0) await sleep(delay)
    try {
      await rename(temporary, path)
      return
    } catch (error) {
      if (!isBusy(error)) throw error
    }
  }
  await copyFile(temporary, path)
  await rm(temporary, { force: true })
}

/** Whether an error is Windows'「文件正忙」. */
function isBusy(error) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  return error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES'
}

/** A short sleep. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Write a JSON file atomically, pretty-printed with a trailing newline. */
export async function writeJsonAtomic(path, value) {
  await writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`)
}

/** List directory entries as plain names; return `[]` when the directory is absent. */
export async function listDirIfExists(path) {
  try {
    return await readdir(path)
  } catch (error) {
    if (isAbsent(error)) return []
    throw error
  }
}

/**
 * List the **regular files** in a directory; `[]` when the directory is absent.
 *
 * 与 `listDirIfExists` 的区别：这里**不含子目录**。
 * 「这个路径上是不是有一个文件」用目录清单回答，比一次 `stat` 便宜，
 * 而且一次清单就能回答很多个路径的问题。
 *
 * @param {string} path
 * @returns {Promise<string[]>}
 */
export async function listFilesIfExists(path) {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    return entries.filter(entry => entry.isFile()).map(entry => entry.name)
  } catch (error) {
    if (isAbsent(error)) return []
    throw error
  }
}

/** Whether a path exists and is a directory. */
export async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

/** Whether a path exists and is a regular file. */
export async function isFile(path) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

/** Size of a file in bytes, or `undefined` when it does not exist. */
export async function fileSize(path) {
  try {
    return (await stat(path)).size
  } catch {
    return undefined
  }
}

/**
 * Resolve `relative` against `base` and refuse anything that escapes `base`.
 *
 * This is the fence for every path that reaches the plugin from the browser:
 * a crafted `../../` can never read outside the project root.
 */
export function resolveWithin(base, relative) {
  const root = resolve(base)
  const target = resolve(root, relative)
  const rootText = root.endsWith(sep) ? root : `${root}${sep}`
  const comparable = process.platform === 'win32'
    ? { root: rootText.toLowerCase(), target: target.toLowerCase() }
    : { root: rootText, target }
  if (comparable.target !== root.replace(/[\\/]+$/, '') && !comparable.target.startsWith(comparable.root)) {
    throw new Error(`路径越界：${relative}`)
  }
  return target
}

/** Whether an error is an "absent path" error from node:fs. */
export function isAbsent(error) {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

/** Join path segments with the platform separator. */
export function joinPath(...parts) {
  return join(...parts)
}

/**
 * Map over `items` with a bounded number of concurrent workers.
 *
 * **为什么要有上限。** 一次 `Promise.all` 把上百个文件系统探测同时丢出去，
 * 会把 libuv 的线程池打满——线程池是**共享**的，宿主应用自己的文件操作
 * 会排在我们的队列后面（§11 的规矩：插件不能给别人的应用添麻烦）。
 * 一个有上限的池既比串行快得多，又不会挤占线程池。
 *
 * 结果按输入顺序返回。
 *
 * @param {any[]} items
 * @param {number} limit 同时进行的最大数量
 * @param {(item: any, index: number) => Promise<any>} worker
 * @returns {Promise<any[]>}
 */
export async function mapLimit(items, limit, worker) {
  const list = Array.isArray(items) ? items : []
  const results = new Array(list.length)
  if (list.length === 0) return results
  const width = Math.max(1, Math.min(Math.trunc(limit) || 1, list.length))
  let cursor = 0
  const run = async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= list.length) return
      results[index] = await worker(list[index], index)
    }
  }
  await Promise.all(Array.from({ length: width }, run))
  return results
}
