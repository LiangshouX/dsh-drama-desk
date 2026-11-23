/**
 * 台账：**先落账，再提交，立刻回写**。
 *
 * 为什么顺序不能换（参考包 `docs/05`）：
 *  - 先提交后落账：提交成功但进程崩了 → 任务在跑却没人知道 → 也不敢重发 → 卡死；
 *  - 提交超时不查账就重发 → **重复扣费**。
 *
 * 指纹是两个版本的：
 *  - `prompt-v1`：只哈希提示词。历史台账都是这个。
 *  - `full-v2`：把**影响产物的参数**（模型 / 分辨率 / 画幅 / 时长 / 参考图）一起哈希。
 *    只哈希提示词会漏掉「换模型或换分辨率」，表现为「已经生成过」→ 静默少出片。
 *
 * **不许直接把算法换掉**：老条目没有 v2 指纹，换算法会让历史作品全部变成「要重做」。
 * 所以每条台账都带 `fingerprint_algo`，比对时按各自的算法走。
 */
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { readJsonIfExists, writeJsonAtomic } from './fsx.js'

/** 当前新条目使用的算法版本。 */
export const FINGERPRINT_ALGO = 'full-v2'

/** 同一目录的写要串行：两个并发提交不能互相覆盖台账。 */
const writes = new Map()

/**
 * 提示词指纹（v1，历史口径）。
 *
 * @param {string} text
 * @returns {string}
 */
export function promptSha(text) {
  return createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex')
}

/**
 * 稳定序列化：键排序，值必须可 JSON 化。
 * 指纹依赖它——同样的请求必须得到同样的字符串。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  const normalize = input => {
    if (input === null || typeof input !== 'object') return input
    if (Array.isArray(input)) return input.map(normalize)
    const out = {}
    for (const key of Object.keys(input).sort()) {
      const item = input[key]
      if (item === undefined) continue
      out[key] = normalize(item)
    }
    return out
  }
  return JSON.stringify(normalize(value))
}

/**
 * full-v2 指纹：包含所有影响产物的参数。
 *
 * @param {{kind: string, prompt: string, model?: string, resolution?: string, ratio?: string,
 *   duration?: number, references?: string[], area?: string, n?: number, aspectRatio?: string}} input
 * @returns {string}
 */
export function fingerprintOf(input) {
  return createHash('sha256').update(canonicalJson({
    kind: input.kind,
    prompt: String(input.prompt ?? ''),
    model: input.model ?? null,
    resolution: input.resolution ?? null,
    ratio: input.ratio ?? null,
    duration: input.duration ?? null,
    references: Array.isArray(input.references) ? input.references.map(String) : [],
    area: input.area ?? null,
    n: input.n ?? null,
    aspectRatio: input.aspectRatio ?? null,
  }), 'utf8').digest('hex')
}

/**
 * 一条台账是否对应「同一个请求」。
 *
 * v2 条目比 v2 指纹；没有 `fingerprint_algo` 的老条目比提示词指纹（向后兼容）。
 *
 * @param {any} entry
 * @param {{fingerprint: string, promptSha: string}} candidate
 * @returns {boolean}
 */
export function entryMatches(entry, candidate) {
  if (entry?.fingerprint_algo === FINGERPRINT_ALGO && typeof entry?.fingerprint === 'string') {
    return entry.fingerprint === candidate.fingerprint
  }
  return typeof entry?.prompt_sha256 === 'string' && entry.prompt_sha256 === candidate.promptSha
}

/**
 * 读台账（缺文件 = 空台账）。
 *
 * @param {string} dir
 * @returns {Promise<{version?: string, entries: any[], totals?: any}>}
 */
export async function readLedger(dir) {
  const doc = await readJsonIfExists(join(dir, 'ledger.json'))
  if (doc === undefined || doc === null || typeof doc !== 'object') return { version: '1.0', entries: [] }
  return { ...doc, entries: Array.isArray(doc.entries) ? doc.entries : [] }
}

/**
 * 追加一条台账（串行、原子）。
 *
 * @param {string} dir
 * @param {any} entry
 */
export async function appendLedgerEntry(dir, entry) {
  return await mutateLedger(dir, doc => {
    doc.entries.push(entry)
    return entry
  })
}

/**
 * 改一条台账（按 task_id 优先，其次 shot_id / request_id + 指纹）。
 *
 * @param {string} dir
 * @param {{taskId?: string, shotId?: string, requestId?: string, fingerprint?: string}} key
 * @param {any} patch
 * @param {{status?: string, at?: string}} [trajectory]
 * @returns {Promise<any|undefined>} 改后的条目
 */
export async function patchLedgerEntry(dir, key, patch, trajectory) {
  return await mutateLedger(dir, doc => {
    const entry = findEntry(doc.entries, key)
    if (entry === undefined) return undefined
    Object.assign(entry, patch)
    if (trajectory !== undefined && trajectory.status !== undefined) {
      entry.trajectory = Array.isArray(entry.trajectory) ? entry.trajectory : []
      entry.trajectory.push({ status: trajectory.status, at: trajectory.at ?? new Date().toISOString() })
    }
    return entry
  })
}

/** 按 key 找一条台账：task_id → request_id → 指纹 → 该镜最近一条。 */
function findEntry(entries, key) {
  if (key.taskId !== undefined) {
    return entries.find(row => String(row?.task_id ?? '') === String(key.taskId))
  }
  if (key.requestId !== undefined) {
    return entries.find(row => row?.request_id === key.requestId)
  }
  if (key.fingerprint !== undefined) {
    return entries.find(row => row?.fingerprint === key.fingerprint
      && (key.shotId === undefined || row?.shot_id === key.shotId))
  }
  if (key.shotId !== undefined) {
    const rows = entries.filter(row => row?.shot_id === key.shotId)
    if (rows.length === 0) return undefined
    rows.sort((a, b) => stampOf(b) - stampOf(a))
    return rows[0]
  }
  return undefined
}

function stampOf(entry) {
  const text = entry?.succeeded_at ?? entry?.failed_at ?? entry?.last_query_at ?? entry?.submitted_at
  const value = typeof text === 'string' ? Date.parse(text) : Number.NaN
  return Number.isFinite(value) ? value : 0
}

/** 串行地读—改—写。 */
async function mutateLedger(dir, mutate) {
  const previous = writes.get(dir) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(async () => {
    const path = join(dir, 'ledger.json')
    const doc = await readLedger(dir)
    const result = await mutate(doc)
    if (result === undefined) return undefined
    if (doc.totals !== undefined && doc.totals !== null && typeof doc.totals === 'object') {
      doc.totals.tasks = doc.entries.length
      const sum = doc.entries.reduce((total, row) => total + (Number.isFinite(Number(row?.cost_usd)) ? Number(row.cost_usd) : 0), 0)
      doc.totals.cost_usd = Math.round(sum * 100) / 100
    }
    await writeJsonAtomic(path, doc)
    return result
  })
  writes.set(dir, next)
  try {
    return await next
  } finally {
    if (writes.get(dir) === next) writes.delete(dir)
  }
}
