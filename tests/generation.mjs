/**
 * 生成控制面：进度 / 开销 / 计划 / 通道探测。
 *
 * 这一组断言守的是三件「错了会花钱」的事：
 *  1. 已提交过的镜**不许**再出现在「该提交」里（幂等判据是提示词指纹）；
 *  2. 进度不许把「任务成功但还没下载登记」算成「已生成」；
 *  3. 通道不可用时，计划仍然要算得出来——整批给一条警告，而不是把每一镜都标成阻塞。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generationBoard, generationPlan, probeChannels } from '../src/host/generation.js'
import { resolveConfig } from '../src/host/paths.js'
import { writeJsonAtomic } from '../src/host/fsx.js'
import { loadWorkspace } from '../src/host/workspace.js'

const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex')

/** 宿主什么都不提供的 service：用来量「继承不到通道」时的行为。 */
function bareService(config = {}) {
  return {
    config: resolveConfig(config),
    ctx: { get: () => undefined },
    check: async () => ({ staleShots: [] }),
  }
}

async function makeWork(root) {
  const dir = join(root, 'workspaces', 'sample')
  await mkdir(join(dir, 'prompts', 'slim'), { recursive: true })
  await mkdir(join(dir, 'videos'), { recursive: true })
  await writeFile(join(dir, 'videos', 'SC01-SH01_v01.mp4'), 'fake-video', 'utf8')
  const shots = [
    { id: 'SC01-SH01', scene: 'SC01', title: '已出片', duration: 4, camera: 'Static Shot', current_version: 1, status: 'verified' },
    { id: 'SC01-SH02', scene: 'SC01', title: '已生成未登记', duration: 6, camera: 'Push In', current_version: 1, status: 'succeeded' },
    { id: 'SC01-SH03', scene: 'SC01', title: '在途', duration: 6, camera: 'Pull Out', current_version: 1, status: 'submitted' },
    { id: 'SC01-SH04', scene: 'SC01', title: '还没做', duration: 8, camera: 'Tracking Shot', current_version: 1, status: 'pending' },
    { id: 'SC01-SH05', scene: 'SC01', title: '没有提示词', duration: 5, camera: 'Pan Left', current_version: 1, status: 'pending' },
  ]
  const prompts = new Map()
  for (const shot of shots.slice(0, 4)) {
    const text = 'PROMPT FOR ' + shot.id
    prompts.set(shot.id, text)
    await writeFile(join(dir, 'prompts', 'slim', shot.id + '.prompt.txt'), text, 'utf8')
  }
  const ledger = {
    version: '1.0',
    entries: [
      { task_id: 't1', shot_id: 'SC01-SH01', status: 'succeeded', prompt_sha256: sha256(prompts.get('SC01-SH01')),
        submitted_at: '2026-01-01T00:00:00Z', cost_usd: 0.32,
        trajectory: [{ status: 'submitted', at: '2026-01-01T00:00:00Z' }, { status: 'succeeded', at: '2026-01-01T00:02:00Z' }] },
      { task_id: 't2', shot_id: 'SC01-SH02', status: 'succeeded', prompt_sha256: sha256(prompts.get('SC01-SH02')),
        submitted_at: '2026-01-01T01:00:00Z', cost_usd: 0.48,
        trajectory: [{ status: 'submitted', at: '2026-01-01T01:00:00Z' }, { status: 'succeeded', at: '2026-01-01T01:03:00Z' }] },
      { task_id: 't3', shot_id: 'SC01-SH03', status: 'submitted', prompt_sha256: sha256(prompts.get('SC01-SH03')),
        submitted_at: '2026-01-01T02:00:00Z', cost_usd: 0.48,
        trajectory: [{ status: 'submitted', at: '2026-01-01T02:00:00Z' }] },
    ],
  }
  await writeJsonAtomic(join(dir, 'work.json'), { version: '1.0', work_id: 'sample', title: '测试作品' })
  await writeJsonAtomic(join(dir, 'state.json'), {
    version: '1.0', work_id: 'sample', stage: 'generate',
    budget: { limit_usd: 10, cost_per_shot_usd: 0.4 },
  })
  await writeJsonAtomic(join(dir, 'scenes.json'), { scenes: [{ id: 'SC01', index: 1, title: '第一场' }] })
  await writeJsonAtomic(join(dir, 'shots.json'), { shots })
  await writeJsonAtomic(join(dir, 'characters.json'), { characters: [] })
  await writeJsonAtomic(join(dir, 'assets.json'), {
    assets: [
      { id: 'SC01-SH01_v01', type: 'video', path: 'videos/SC01-SH01_v01.mp4', shot_id: 'SC01-SH01', version: 1, status: 'active' },
      { id: 'char_face', type: 'reference_image', path: 'refs/face.png', status: 'active' },
      { id: 'SC01-SH01_key', type: 'keyframe', path: 'keyframes/key.png', shot_id: 'SC01-SH01', status: 'active' },
    ],
  })
  await writeJsonAtomic(join(dir, 'ledger.json'), ledger)
  return dir
}

test('the board separates "finished take" from "task succeeded but not downloaded"', async () => {
  const root = await mkdtemp(join(tmpdir(), 'drama-gen-'))
  try {
    const dir = await makeWork(root)
    const work = await loadWorkspace(dir)
    const board = generationBoard(work)
    assert.deepEqual(board.counts, { total: 5, done: 1, pending: 1, inFlight: 1, failed: 0, todo: 2 })
    assert.equal(board.progress, 20, 'progress counts finished takes only')
    assert.equal(board.budget.spentUsd, 1.28)
    assert.equal(board.budget.limitUsd, 10)
    assert.equal(board.budget.remainingUsd, 8.72)
    assert.equal(board.budget.perShotUsd, 0.4)
    assert.equal(board.forecast.shotsLeft, 2, 'pending is not counted as "still to generate"')
    assert.equal(board.forecast.costUsd, 0.8)
    // 已完成的轨迹：00:00→00:02（120s）与 01:00→01:03（180s）⇒ 平均 150s
    assert.equal(board.speed.avgSecondsPerShot, 150)
    assert.equal(board.inFlight.length, 1)
    assert.equal(board.inFlight[0].shotId, 'SC01-SH03')
    assert.equal(board.images.references, 1)
    assert.equal(board.images.shotsWithKeyframe, 1)
    assert.equal(board.scenes[0].done, 1)
    assert.equal(board.scenes[0].pending, 1)
    assert.equal(board.scenes[0].todo, 2)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the plan never re-submits a shot whose prompt fingerprint is already in the ledger', async () => {
  const root = await mkdtemp(join(tmpdir(), 'drama-plan-'))
  try {
    const dir = await makeWork(root)
    const work = await loadWorkspace(dir)
    const service = bareService()
    const plan = await generationPlan(work, service, 'sample')
    const byId = new Map(plan.rows.map(row => [row.id, row]))
    assert.equal(byId.get('SC01-SH01').action, 'skip', 'succeeded with the same prompt = do not resubmit')
    assert.equal(byId.get('SC01-SH02').action, 'skip', 'succeeded but not downloaded is still "already paid"')
    assert.equal(byId.get('SC01-SH03').action, 'skip', 'in-flight must not be resubmitted')
    assert.equal(byId.get('SC01-SH04').action, 'submit')
    assert.equal(byId.get('SC01-SH05').action, 'blocked', 'no prompt = cannot submit')
    assert.match(byId.get('SC01-SH05').reasons.join(' '), /提示词/)
    assert.equal(plan.summary.submit, 1)
    assert.equal(plan.summary.skip, 3)
    assert.equal(plan.summary.blocked, 1)
    assert.equal(plan.summary.costUsd, 0.4)
    assert.equal(plan.summary.seconds, 8)
    // 通道探测在测试环境里必然不可用（没有宿主 subprocess），但**不许**把行标成阻塞。
    assert.equal(plan.summary.channelReady, false)
    assert.match(plan.summary.channelReason, /mcode-tools|通道/)
    assert.equal(byId.get('SC01-SH04').reasons.some(text => /通道/.test(text)), false,
      'channel availability is a batch warning, not a per-shot blocker')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a changed prompt on a shot that already has output is a new submission, not a skip', async () => {
  const root = await mkdtemp(join(tmpdir(), 'drama-plan2-'))
  try {
    const dir = await makeWork(root)
    await writeFile(join(dir, 'prompts', 'slim', 'SC01-SH01.prompt.txt'), 'A NEW PROMPT', 'utf8')
    const work = await loadWorkspace(dir)
    const plan = await generationPlan(work, bareService(), 'sample')
    const row = plan.rows.find(entry => entry.id === 'SC01-SH01')
    assert.equal(row.action, 'submit')
    assert.match(row.reasons.join(' '), /提示词|版本/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the plan can be capped to a batch size', async () => {
  const root = await mkdtemp(join(tmpdir(), 'drama-plan3-'))
  try {
    const dir = await makeWork(root)
    const work = await loadWorkspace(dir)
    const plan = await generationPlan(work, bareService(), 'sample', { limit: 1 })
    assert.equal(plan.summary.submit, 1)
    assert.equal(plan.summary.capped, true)
    // 截断的是**这一批**：算到 1 镜要提交就停，后面的镜不再逐条评估。
    // 界面据此把「还有更多」显示成「本次只算前 1 镜」。
    assert.ok(plan.rows.length <= 5)
    assert.equal(plan.rows.filter(row => row.action === 'submit').length, 1)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the settings HTTP action forwards the generation channel fields', async () => {
  // 传输层是薄包装——但它有一张**白名单**。漏一个字段的后果是「界面上改了、
  // 保存也返回成功、配置里却没有」这种沉默失败。这条测试就守这一层。
  const { createServer } = await import('node:http')
  const { registerApi } = await import('../src/host/api.js')
  let handler
  let received
  registerApi({ effect: run => run(), webServer: { register: entry => { handler = entry.handler; return () => {} } } }, {
    updateSettings: async patch => { received = patch; return { ok: true, saved: true } },
  })
  const server = createServer((req, res) => handler(req, res))
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${server.address().port}/drama-desk/api/update-settings`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        imageChannel: 'connector-image', imageModel: 'img-1',
        videoChannel: 'my-video', videoModel: 'vid-1',
        channels: [{ id: 'my-video', kind: 'video', label: '自制' }],
      }),
    })
    assert.equal(response.status, 200)
    await response.json()
    assert.equal(received.imageChannel, 'connector-image')
    assert.equal(received.imageModel, 'img-1')
    assert.equal(received.videoChannel, 'my-video')
    assert.equal(received.videoModel, 'vid-1')
    assert.deepEqual(received.channels, [{ id: 'my-video', kind: 'video', label: '自制' }])
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})

test('channel probing inherits the host, explains a missing connector, and honours a custom channel', async () => {
  const inherited = await probeChannels(bareService(), { refresh: true })
  assert.equal(inherited.selection.video.mode, 'inherit')
  assert.equal(inherited.selection.video.available, false)
  assert.match(inherited.selection.video.reason, /mcode-tools/)
  assert.equal(inherited.connectors.length, 2)
  assert.ok(inherited.connectors.every(channel => channel.installed === false))

  const custom = await probeChannels(bareService({
    videoChannel: 'my-video',
    videoModel: 'my-model-1',
    channels: [{ id: 'my-video', kind: 'video', label: '自制通道', model: 'default-model' }],
  }), { refresh: true })
  assert.equal(custom.selection.video.mode, 'custom')
  assert.equal(custom.selection.video.available, true)
  assert.equal(custom.selection.video.model, 'my-model-1', 'the explicit model wins over the channel default')
  assert.equal(custom.selection.video.channel, 'my-video')
})
