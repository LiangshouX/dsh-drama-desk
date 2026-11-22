#!/usr/bin/env node
/**
 * 性能归因：慢的是**我们的代码**，还是**宿主环境**？
 *
 *   node scripts/profile.mjs
 *
 * **为什么需要它**：端点在 DSH Host 里量出 66 ms，而同样的代码挂在
 * 一个普通 Node 服务器上只量出 12 ms。差的那六倍不在插件手里——
 * 但只有这样量一次才能**证明**它不在，而不是猜。
 *
 * 所以这个脚本做两件事：
 *   ① **就地**量一遍 service 的每个方法（进程内，没有 HTTP 开销）；
 *   ② 把**同一个** service 挂在一个普通 `http.createServer` 上量一遍。
 *
 * 两次的差就是 HTTP 传输的代价；再与 `perf.mjs` 在 DSH Host 里量的数比，
 * 就能分清「代码慢」与「环境慢」。
 *
 * **量之前先看宿主进程在不在空转**（见 `docs/dev/performance.md` P6）——
 * 一个空转的宿主能把 12 ms 的代码量成 66 ms。
 */

import { performance } from 'node:perf_hooks'
import http from 'node:http'
import { DramaDeskService } from '../src/host/service.js'

const CONFIG = { projectRoot: '', outputRoot: '', model: 'minimax', autoRefresh: 4000 }
const service = new DramaDeskService({ config: CONFIG })

/** Percentile of a sorted array. */
function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]
}

async function bench(label, fn, rounds = 12) {
  await fn() // warm up: the first call is cold and is not the steady state
  const times = []
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now()
    await fn()
    times.push(performance.now() - t0)
  }
  const p50 = percentile(times, 50)
  const p95 = percentile(times, 95)
  console.log(`  ${label.padEnd(28)} p50 ${p50.toFixed(2).padStart(7)} ms   p95 ${p95.toFixed(2).padStart(7)} ms`)
  return p50
}

console.log('=== ① 就地：service 方法本身（进程内，没有 HTTP 开销）===\n')
await bench('overview()', () => service.overview())
await bench('pipeline()', () => service.pipeline({ workspaceId: 'demo-epic' }))
await bench('assets()', () => service.assets({ workspaceId: 'demo-epic' }))
await bench('stageState()', () => service.stageState({ workspaceId: 'demo-epic' }))
await bench('settings()', () => service.settings({}))
await bench('ledger()', () => service.ledger({ workspaceId: 'demo-epic' }))
await bench('snapshot()', () => service.snapshot({ workspaceId: 'demo-epic' }))
await bench('stageView(generate)', () => service.stageView({ workspaceId: 'demo-epic', stage: 'generate' }))

console.log('\n=== ② 同一个 service 挂在普通 http 服务器上 ===\n')

const server = http.createServer(async (req, res) => {
  const path = req.url.split('?')[0].replace('/api/', '')
  const query = Object.fromEntries(new URL(req.url, 'http://x').searchParams)
  const method = { stages: 'stageState' }[path] ?? path
  let payload
  try {
    if (path === 'stats') payload = { ok: true, data: { total: 1 } }
    else if (path === 'stage') payload = { ok: true, data: await service.stageView({ workspaceId: query.workspace, stage: query.stage }) }
    else payload = { ok: true, data: await service[method]({ workspaceId: query.workspace }) }
  } catch (error) {
    payload = { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  res.writeHead(200, { 'content-type': 'application/json', 'content-length': String(body.length) })
  res.end(body)
})

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const agent = new http.Agent({ keepAlive: true, maxSockets: 1 })

function probe(path) {
  return new Promise((resolvePromise, reject) => {
    const t0 = performance.now()
    const req = http.request({ hostname: '127.0.0.1', port, path, agent }, res => {
      const ttfb = performance.now() - t0
      let bytes = 0
      res.on('data', chunk => { bytes += chunk.length })
      res.on('end', () => resolvePromise({ ttfb, total: performance.now() - t0, bytes }))
    })
    req.on('error', reject)
    req.end()
  })
}

for (const path of ['/api/snapshot', '/api/pipeline', '/api/assets', '/api/stage?stage=generate']) {
  await probe(path)
  const rows = []
  for (let i = 0; i < 9; i++) rows.push(await probe(path))
  const mid = rows.sort((a, b) => a.ttfb - b.ttfb)[Math.floor(rows.length / 2)]
  console.log(`  ${path.replace('/api/', '').padEnd(28)} ttfb ${mid.ttfb.toFixed(2).padStart(7)} ms   ${(mid.bytes / 1024).toFixed(1).padStart(6)} KB`)
}

server.close()
console.log('\n把这几个数与 `node scripts/perf.mjs --base <宿主端口>` 的数比一比：')
console.log('  差得多  → 宿主环境在拖后腿（先看宿主进程有没有空转）')
console.log('  差不多  → 瓶颈在插件里（本表 ① 那一列就是元凶）')
