// Correctness: the optimised answers must be IDENTICAL to the unoptimised ones.
// Every optimisation is a change of *how* we ask, never of *what* we answer.
//
//   node tests/equivalence.mjs
//
// 需要一个演示作品（`python scripts/make_demo_work.py --out … --scale large`）。
// 没有作品时它**跳过**，而不是假装通过。
import assert from 'node:assert/strict'
import { DramaDeskService } from '../src/host/service.js'
import { readPromptIndex, readStagePrompt } from '../src/host/stageviews.js'
import { posterSourcesFor, resolvePosterSource } from '../src/host/posters.js'
import { loadWorkspace } from '../src/host/workspace.js'

const service = new DramaDeskService({ config: { projectRoot: '', outputRoot: '', model: 'minimax', autoRefresh: 4000 } })
const ws = await service.resolveWorkspace('demo-epic')
if (ws === undefined) {
  console.log('跳过：没有演示作品（先跑 python scripts/make_demo_work.py --out … --scale large）')
  process.exit(0)
}
const work = await loadWorkspace(ws.dir)
const ids = work.shots.map(s => s.id)

console.log('1. batch prompt index == per-shot prompt reads')
const index = await readPromptIndex(work, ids)
for (const id of ids) {
  const one = await readStagePrompt(work, id)
  const many = index.get(id)
  assert.equal(many.exists, one.exists, `exists ${id}`)
  assert.equal(many.overridden, one.overridden, `overridden ${id}`)
  assert.equal(many.text, one.text, `text ${id}`)
  assert.equal(many.overrideText, one.overrideText, `overrideText ${id}`)
  assert.equal(many.words, one.words, `words ${id}`)
}
console.log(`   OK (${ids.length} shots)`)

console.log('2. batch poster sources == per-shot poster resolution')
const sources = await posterSourcesFor(work, ids)
for (const id of ids) {
  const one = await resolvePosterSource(work, id)
  const many = sources.get(id)
  assert.deepEqual(many, one, `poster ${id}`)
}
console.log(`   OK (${ids.length} shots)`)

console.log('3. cached check() == fresh check()')
const fresh = new DramaDeskService({ config: { projectRoot: '', outputRoot: '', model: 'minimax', autoRefresh: 4000 } })
const a = await fresh.check({ workspaceId: 'demo-epic' })
const b = await service.check({ workspaceId: 'demo-epic' })   // cached
assert.deepEqual(b.staleShots, a.staleShots, 'staleShots')
assert.equal(b.ok, a.ok, 'ok')
console.log(`   OK (${a.staleShots.length} stale shots)`)

console.log('3b. a cached full list answers a SINGLE-shot question correctly')
// 回归测试：缓存曾经存的是「某一镜的判定」，于是 A 镜的答案被卖给了 B 镜。
// 缓存必须是「清单」，单镜判定由清单现算。
for (const id of a.staleShots.slice(0, 5)) {
  const one = await service.check({ workspaceId: 'demo-epic', shotId: id })
  assert.equal(one.stale, true, `stale flag for ${id}`)
  assert.equal(one.shotId, id, `shotId echoed for ${id}`)
}
const notStale = await fresh.check({ workspaceId: 'demo-epic' })
const cleanShot = 'SC01-SH01'
if (!notStale.staleShots.includes(cleanShot)) {
  const one = await service.check({ workspaceId: 'demo-epic', shotId: cleanShot })
  assert.equal(one.stale, false, `stale flag for ${cleanShot}`)
}
console.log('   OK')

console.log('4. check() cache is dropped when the work changes')
service.invalidateWork(ws.dir)
const c = await service.check({ workspaceId: 'demo-epic' })
assert.deepEqual(c.staleShots, a.staleShots, 'staleShots after invalidate')
console.log('   OK')

console.log('5. pipeline() payload identical between a cold and a warm service')
const cold = new DramaDeskService({ config: { projectRoot: '', outputRoot: '', model: 'minimax', autoRefresh: 4000 } })
const coldPipeline = await cold.pipeline({ workspaceId: 'demo-epic' })
const warmPipeline = await service.pipeline({ workspaceId: 'demo-epic' })
assert.deepEqual(warmPipeline, coldPipeline, 'pipeline payload')
console.log('   OK')

console.log('6. assets() payload identical between a cold and a warm service')
const coldAssets = await cold.assets({ workspaceId: 'demo-epic' })
const warmAssets = await service.assets({ workspaceId: 'demo-epic' })
assert.deepEqual(warmAssets, coldAssets, 'assets payload')
console.log('   OK')

console.log('7. stage views identical between a cold and a warm service')
for (const stage of ['generate', 'verify', 'storyboard', 'script']) {
  const coldView = await cold.stageView({ workspaceId: 'demo-epic', stage })
  const warmView = await service.stageView({ workspaceId: 'demo-epic', stage })
  assert.deepEqual(warmView, coldView, `stage ${stage}`)
}
console.log('   OK (4 stages)')

console.log('8. the workspace list is still correct after the TTL cache')
const list = await service.listWorkspaces()
// **别断言「正好 3 个作品」**：作品住在运行时的总根里，用户随时会新建一个
// （「从零开始聊」就会建草稿）。断言数量等于把「用户加了作品」变成「构建失败」。
// 这里只断言与等价性相关的事实：非空、id 唯一、回归用的那份在场。
assert.ok(list.length >= 1, 'workspace count')
assert.equal(new Set(list.map(w => w.id)).size, list.length, 'workspace ids are unique')
assert.ok(list.some(w => w.id === 'demo-epic'), 'demo-epic present')
console.log('   OK (' + list.length + ' workspaces)')

console.log('\nAll equivalence checks passed.')
