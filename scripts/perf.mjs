#!/usr/bin/env node
/**
 * 性能闸门。
 *
 *   node scripts/perf.mjs                    # 测本机正在跑的 DSH
 *   node scripts/perf.mjs --base <url>       # 指定地址
 *   node scripts/perf.mjs --budget 60        # 自定义预算（毫秒）
 *
 * **为什么要有这个**：插件是**嵌在别人的主应用里**的。别人的应用每帧、每次点击
 * 都要争资源；插件慢一点，用户就会说「DSH 卡了」。功能做再好也救不回来。
 *
 * 所以性能是**红线**，必须能被自动测出来，而不是靠感觉。
 *
 * 测什么
 * ------
 * 1. **端点延迟**：每个读接口的 p50 / p95 / max。顶栏每 4 秒轮询一轮，
 *    所以这些接口必须**快到可以忽略**。
 * 2. **一轮刷新的总成本**：四个接口并发时的一轮耗时（这才是真实成本）。
 * 3. **响应体大小**：接口返回多少 KB。界面每次刷新都要 JSON.parse。
 *
 * 判定
 * ------
 * 任一读接口 p95 超过预算 → 非 0 退出 → 构建失败。
 */

import { performance } from 'node:perf_hooks'

const args = process.argv.slice(2)
const baseIndex = args.indexOf('--base')
const budgetIndex = args.indexOf('--budget')
const base = baseIndex >= 0 ? args[budgetIndex >= 0 ? budgetIndex + 1 : baseIndex + 1] : 'http://127.0.0.1:13144'
const budget = budgetIndex >= 0 ? Number(args[budgetIndex + 1]) : 60
const rounds = 12

/**
 * The read endpoints the workbench polls, and how much of them it asks for.
 *
 * `budget` 可以按端点单独定：被**轮询**的端点必须快到可以忽略（60 ms）；
 * 被**点击**触发的端点（阶段视图）慢一点没关系，但不能慢到让人等。
 *
 * 阶段视图以前**不在这个表里**——于是它 350 毫秒的成本（其中 268 毫秒
 * 是每次开阶段都起一个 Python 子进程）从来没被量过。加进来，是为了让它
 * 也有一道闸门。
 */
const ENDPOINTS = [
  { path: '/drama-desk/api/snapshot', label: 'snapshot' },
  { path: '/drama-desk/api/overview', label: 'overview' },
  { path: '/drama-desk/api/pipeline', label: 'pipeline' },
  { path: '/drama-desk/api/stages', label: 'stages' },
  { path: '/drama-desk/api/settings', label: 'settings' },
  { path: '/drama-desk/api/rules', label: 'rules' },
  { path: '/drama-desk/api/assets', label: 'assets' },
  { path: '/drama-desk/api/ledger', label: 'ledger' },
  // 打开「生成」阶段时面板真正调用的那一个——最重的一个阶段视图。
  { path: '/drama-desk/api/stage?stage=generate', label: 'stage(generate)', budget: 400 },
]

/** One timed request. */
async function timed(path) {
  const started = performance.now()
  const response = await fetch(base + path, { headers: { accept: 'application/json' } })
  const body = await response.text()
  const elapsed = performance.now() - started
  if (!response.ok) throw new Error(`${path} → HTTP ${response.status}: ${body.slice(0, 120)}`)
  return { elapsed, bytes: Buffer.byteLength(body) }
}

/** Percentile of a sorted array. */
function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]
}

async function main() {
  console.log(`性能闸门 · ${base} · 预算 ${budget} ms (p95) · 每端点 ${rounds} 轮\n`)
  try {
    await timed('/drama-desk/api/overview')
  } catch (error) {
    console.error(`✗ 连不上 DSH：${error.message}`)
    console.error('  先启动 DSH（dsh web），再跑这个闸门。')
    process.exit(1)
  }

  const problems = []
  const cold = []
  console.log('端点                p50     p95     max     体积   冷启动')
  console.log('─'.repeat(66))
  for (const endpoint of ENDPOINTS) {
    // **第一轮是冷的**：插件刚装完 / DSH 刚重启时，缓存是空的，
    // 体检器要起子进程、磁盘要 statfs、抽帧要跑 ffmpeg。
    // 那一次的成本**不是**用户感知的轮询开销（它发生在面板挂载那一刻），
    // 把它算进 p95 只会让闸门随机失败。所以单独量、单独报、不计入判定。
    const warmup = await timed(endpoint.path)
    const times = []
    let bytes = warmup.bytes
    for (let round = 0; round < rounds; round++) {
      const result = await timed(endpoint.path)
      times.push(result.elapsed)
      bytes = result.bytes
    }
    const p50 = percentile(times, 50)
    const p95 = percentile(times, 95)
    const max = Math.max(...times)
    const kb = (bytes / 1024).toFixed(1)
    const limit = endpoint.budget ?? budget
    const flag = p95 > limit ? ' ← 超预算' : ''
    console.log(
      `${endpoint.label.padEnd(18)} ${p50.toFixed(1).padStart(5)}  ${p95.toFixed(1).padStart(5)}  ${max.toFixed(1).padStart(5)}  ${kb.padStart(6)} KB  ${warmup.elapsed.toFixed(0).padStart(5)} ms${flag}`,
    )
    if (warmup.elapsed > limit * 5) cold.push(`${endpoint.label} 冷启动 ${warmup.elapsed.toFixed(0)} ms`)
    if (p95 > limit) {
      problems.push(`${endpoint.label} 的 p95 = ${p95.toFixed(1)} ms > 预算 ${limit} ms`)
    }
    if (bytes > 512 * 1024) {
      problems.push(`${endpoint.label} 的响应体 ${kb} KB 过大（> 512 KB）`)
    }
  }

  // 一轮刷新的真实成本：**面板轮询走的就是这一个端点**（snapshot）。
  const round = []
  for (let i = 0; i < rounds; i++) {
    const started = performance.now()
    await timed('/drama-desk/api/snapshot')
    round.push(performance.now() - started)
  }
  const roundP95 = percentile(round, 95)
  console.log('─'.repeat(58))
  console.log(
    `一轮刷新（面板实际用的）   p50 ${percentile(round, 50).toFixed(1)} ms   p95 ${roundP95.toFixed(1)} ms`,
  )
  if (roundP95 > budget) {
    problems.push(`一轮刷新的 p95 = ${roundP95.toFixed(1)} ms > 预算 ${budget} ms`)
  }

  console.log('')
  if (cold.length > 0) {
    console.log('  冷启动（不计入判定）：' + cold.join('、'))
    console.log('  —— 这些发生在插件刚装完 / DSH 刚重启的那一刻，不是轮询开销。')
  }
  if (problems.length > 0) {
    console.error(`✗ ${problems.length} 项超预算：`)
    for (const problem of problems) console.error(`   ${problem}`)
    console.error('\n插件是嵌在别人的应用里的 —— 这类开销会变成「DSH 卡了」。')
    process.exit(1)
  }
  console.log('✓ 性能闸门通过')
}

main().catch(error => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
