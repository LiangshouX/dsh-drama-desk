/**
 * 驱动的三个关键层：传输判成败、指纹版本、执行落地。
 *
 * **本文件不调任何真实服务、不花钱。** 传输用本地假 CLI；执行用注册进来的
 * 假驱动（`registerDriver` 正是「插件里的插件」的入口）。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, rm, writeFile, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { McodeClient, McodeToolsError, parseJsonLoose } from '../src/host/transport/cli.js'
import { registerDriver } from '../src/host/drivers/index.js'
import { entryMatches, fingerprintOf, FINGERPRINT_ALGO, promptSha, canonicalJson } from '../src/host/ledger.js'
import { resolveConfig } from '../src/host/paths.js'
import { generationPlan } from '../src/host/generation.js'
import { executeGenerationPlan, pollGenerationTasks } from '../src/host/generation-exec.js'
import { loadWorkspace } from '../src/host/workspace.js'
import { writeJsonAtomic } from '../src/host/fsx.js'
import { characterVisual, prepareCharacterVisual, selectCharacterReference } from '../src/host/character-visual.js'
import { buildStageView } from '../src/host/stageviews.js'

function serviceWith(config) {
  return {
    config: resolveConfig(config),
    ctx: { get: () => undefined },
    check: async () => ({ staleShots: [] }),
    invalidateWork: () => {},
  }
}

// ── 传输层 ──────────────────────────────────────────────────────────────────

test('stdout 解析取「跨度最大的 JSON」，不是最后一个', () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 })
  assert.deepEqual(parseJsonLoose('log line\n{"a":{"b":[1,2]}}\ntrailing'), { a: { b: [1, 2] } })
  // 响应里内层对象也是合法 JSON：取最后一个会拿到 {"x":2}。
  assert.deepEqual(parseJsonLoose('{"success_items":[{"x":1},{"x":2}]}'), { success_items: [{ x: 1 }, { x: 2 }] })
  assert.throws(() => parseJsonLoose(''), /没有输出/)
  assert.throws(() => parseJsonLoose('not json at all'), /无法从 stdout 解析/)
})

test('三层判成败：退出码 → JSON 形状 → 业务 code', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcode-fake-'))
  try {
    const script = join(root, 'fake-cli.mjs')
    await writeFile(script, [
      'let stdin = ""',
      'process.stdin.on("data", chunk => { stdin += chunk })',
      'process.stdin.on("end", () => {',
      '  const mode = process.env.FAKE_MODE || "ok"',
      '  if (mode === "transport") process.exit(3)',
      '  if (mode === "protocol") { process.stdout.write("not json"); process.exit(0) }',
      '  if (mode === "business") { process.stdout.write(JSON.stringify({ code: 404, message: "nope" })); process.exit(0) }',
      '  process.stdout.write(JSON.stringify({ ok: true, stdin }))',
      '})',
    ].join('\n'), 'utf8')
    const shim = join(root, 'fake-mcode.cmd')
    await writeFile(shim, `@echo off\r\nnode "${script}" %*\r\n`, 'utf8')
    const ok = new McodeClient({ exe: shim, env: { ...process.env, FAKE_MODE: 'ok' } })
    const value = await ok.call('connector__x', { a: 1 })
    assert.equal(value.ok, true)
    assert.equal(value.stdin, '{"a":1}', '参数必须走 stdin（没有临时文件、没有 BOM）')
    const business = new McodeClient({ exe: shim, env: { ...process.env, FAKE_MODE: 'business' } })
    await assert.rejects(business.call('connector__x', {}), error => {
      assert.equal(error.kind, 'business')
      assert.equal(error.code, 404)
      return true
    })
    const protocol = new McodeClient({ exe: shim, env: { ...process.env, FAKE_MODE: 'protocol' } })
    await assert.rejects(protocol.call('connector__x', {}), error => error.kind === 'protocol')
    const transport = new McodeClient({ exe: shim, env: { ...process.env, FAKE_MODE: 'transport' } })
    await assert.rejects(transport.call('connector__x', {}), error => error.kind === 'transport')
    // 参数必须是对象：数组 / 标量不是合法顶层参数。
    await assert.rejects(ok.call('connector__x', []), error => error.kind === 'protocol')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// ── 指纹 ────────────────────────────────────────────────────────────────────

test('full-v2 指纹包含所有影响产物的参数，老台账按 prompt-v1 兼容', () => {
  const base = { kind: 'video', prompt: 'p', model: 'M', resolution: '768P', ratio: '16:9', duration: 6, references: ['a'] }
  const variant = patch => fingerprintOf({ ...base, ...patch })
  assert.equal(fingerprintOf(base), fingerprintOf({ ...base }), '同样的请求必须同指纹')
  for (const patch of [{ model: 'M2' }, { resolution: '2K' }, { duration: 8 }, { ratio: '9:16' }, { references: ['a', 'b'] }]) {
    assert.notEqual(variant(patch), fingerprintOf(base), '这些参数必须进指纹：' + JSON.stringify(patch))
  }
  // 老条目：只有 prompt_sha256，没有 fingerprint_algo → 用提示词比对。
  const legacy = { prompt_sha256: promptSha('p'), status: 'succeeded' }
  assert.equal(entryMatches(legacy, { fingerprint: 'whatever', promptSha: promptSha('p') }), true)
  assert.equal(entryMatches(legacy, { fingerprint: 'whatever', promptSha: promptSha('changed') }), false)
  // 新条目：按 v2 指纹比对，哪怕提示词一样。
  const modern = { fingerprint_algo: FINGERPRINT_ALGO, fingerprint: 'f1', prompt_sha256: promptSha('p') }
  assert.equal(entryMatches(modern, { fingerprint: 'f1', promptSha: promptSha('p') }), true)
  assert.equal(entryMatches(modern, { fingerprint: 'f2', promptSha: promptSha('p') }), false)
  // canonicalJson 顺序稳定。
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }))
})

// ── 执行（假驱动，不花钱）──────────────────────────────────────────────────

/** 一个最小作品：一场一镜 + 提示词 + image-requests.json。 */
async function makeWork(root, options = {}) {
  const dir = join(root, 'workspaces', 'sample')
  await mkdir(join(dir, 'prompts', 'slim'), { recursive: true })
  await mkdir(join(dir, 'refs'), { recursive: true })
  const prompt = options.prompt ?? 'a shot prompt'
  await writeFile(join(dir, 'prompts', 'slim', 'SC01-SH01.prompt.txt'), prompt, 'utf8')
  await writeFile(join(dir, 'refs', 'anchor.png'), 'fake-png-bytes', 'utf8')
  const shot = {
    id: 'SC01-SH01', scene: 'SC01', title: '镜头', duration: 6, camera: 'Static Shot',
    current_version: 0, status: 'pending', model: 'fake-model',
    references: ['anchor'],
    ...(options.shot ?? {}),
  }
  await writeJsonAtomic(join(dir, 'work.json'), { version: '1.0', work_id: 'sample', title: '测试' })
  await writeJsonAtomic(join(dir, 'state.json'), { version: '1.0', work_id: 'sample', stage: 'generate',
    budget: { cost_per_shot_usd: 0.5, cost_per_image_usd: 0.2 } })
  await writeJsonAtomic(join(dir, 'scenes.json'), { scenes: [{ id: 'SC01', index: 1, title: '一场' }] })
  await writeJsonAtomic(join(dir, 'shots.json'), { shots: [shot] })
  await writeJsonAtomic(join(dir, 'characters.json'), { characters: [] })
  await writeJsonAtomic(join(dir, 'assets.json'), { assets: [
    { id: 'anchor', type: 'reference_image', path: 'refs/anchor.png', status: 'active' },
  ] })
  await writeJsonAtomic(join(dir, 'ledger.json'), { version: '1.0', entries: [], totals: {} })
  await writeJsonAtomic(join(dir, 'image-requests.json'), { requests: [
    { id: 'img-1', prompt: 'a red boat at dawn', aspectRatio: '16:9', area: '2K', referenceAssetIds: ['anchor'] },
  ] })
  return dir
}

/** 假的图片驱动：同步返回一条结果，下载写一个文件。 */
function fakeImageDriver() {
  return {
    id: 'fake-image', driver: 'fake', kind: 'image', label: '假图片',
    async probe() { return { available: true, reason: '假驱动就绪', capabilities: { maxRequestsPerCall: 10 } } },
    async capabilities() { return { maxRequestsPerCall: 10 } },
    async submit(requests) {
      return {
        status: 'succeeded',
        items: requests.map((_request, index) => ({ nodeId: 'node-' + index, fileName: 'out.png', requestIndex: index })),
        failures: [],
        raw: {},
      }
    },
    async download(_nodeId, dest) {
      await mkdir(join(dest, '..'), { recursive: true })
      await writeFile(dest, 'downloaded-image', 'utf8')
      return { path: dest, bytes: 16 }
    },
    async upload() { return { temp_url: 'https://example.invalid/temp' } },
  }
}

/** 假的视频驱动：提交成功；可选让提交抛业务错误（验证「不重试」）。 */
function fakeVideoDriver(options = {}) {
  return {
    id: 'fake-video', driver: 'fake', kind: 'video', label: '假视频',
    async probe() { return { available: true, reason: '假驱动就绪' } },
    async capabilities() { return { models: ['fake-model'] } },
    async submit(request) {
      if (options.failSubmit === true) {
        throw new McodeToolsError('额度不足', { kind: 'business', code: 402 })
      }
      return { taskId: 'task-1', model: request.model, promptSha256: 'x', raw: {} }
    },
    async poll() { return { status: 'running', raw: {} } },
    async download() { throw new Error('本用例不下载') },
    async upload() { return { temp_url: 'https://example.invalid/temp-video' } },
  }
}

const fakeRegistry = { registered: false }

function ensureFakeDrivers(mode) {
  if (fakeRegistry.registered === mode) return
  fakeRegistry.registered = mode
  registerDriver({
    id: 'fake',
    label: '假驱动',
    build: () => ({
      image: fakeImageDriver(),
      video: fakeVideoDriver({ failSubmit: mode === 'fail' }),
    }),
  })
}

function fakeConfig(extra = {}) {
  return {
    channels: [
      { id: 'fake-image', kind: 'image', label: '假图片', driver: 'fake' },
      { id: 'fake-video', kind: 'video', label: '假视频', driver: 'fake', model: 'fake-model' },
    ],
    imageChannel: 'fake-image',
    videoChannel: 'fake-video',
    ...extra,
  }
}

test('生图执行：落账 → 提交 → 下载 → 登记，再计划就变成 skip', async () => {
  ensureFakeDrivers('ok')
  const root = await mkdtemp(join(tmpdir(), 'drama-driver-image-'))
  try {
    const dir = await makeWork(root)
    const service = serviceWith(fakeConfig())
    let work = await loadWorkspace(dir)
    const plan = await generationPlan(work, service, 'sample')
    assert.equal(plan.image.summary.submit, 1)
    const result = await executeGenerationPlan(service, { id: 'sample' }, work, {
      digest: plan.digest, approve: true, kinds: ['image'],
    })
    assert.equal(result.executed[0].status, 'succeeded')
    const ledger = JSON.parse(await readFile(join(dir, 'ledger.json'), 'utf8'))
    assert.equal(ledger.entries.length, 1)
    assert.equal(ledger.entries[0].kind, 'image')
    assert.equal(ledger.entries[0].status, 'succeeded')
    assert.equal(ledger.entries[0].fingerprint_algo, FINGERPRINT_ALGO)
    const assets = JSON.parse(await readFile(join(dir, 'assets.json'), 'utf8'))
    const image = assets.assets.find(asset => asset.type === 'reference_image' && asset.id.startsWith('img-1'))
    assert.ok(image, '产物要登记成资产')
    assert.ok((await stat(join(dir, image.path))).isFile(), '文件要真的落地')
    // 再算一次计划：同一参数 → skip（这就是「不重复扣费」）。
    work = await loadWorkspace(dir)
    const again = await generationPlan(work, service, 'sample')
    assert.equal(again.image.rows[0].action, 'skip')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('视频执行：先落账再提交，立刻回写 task_id；摘要不对就拒', async () => {
  ensureFakeDrivers('ok')
  const root = await mkdtemp(join(tmpdir(), 'drama-driver-video-'))
  try {
    const dir = await makeWork(root)
    const service = serviceWith(fakeConfig())
    const work = await loadWorkspace(dir)
    const plan = await generationPlan(work, service, 'sample')
    assert.equal(plan.video.summary.submit, 1)
    // 摘要不对（模拟「计划过期了」）→ 必须拒，且不落账。
    await assert.rejects(executeGenerationPlan(service, { id: 'sample' }, work, {
      digest: 'deadbeef', approve: true, kinds: ['video'],
    }), /计划已经变了/)
    let ledger = JSON.parse(await readFile(join(dir, 'ledger.json'), 'utf8'))
    assert.equal(ledger.entries.length, 0)
    // 正常执行。
    const result = await executeGenerationPlan(service, { id: 'sample' }, work, {
      digest: plan.digest, approve: true, kinds: ['video'],
    })
    assert.equal(result.executed[0].status, 'submitted')
    ledger = JSON.parse(await readFile(join(dir, 'ledger.json'), 'utf8'))
    assert.equal(ledger.entries.length, 1)
    assert.equal(ledger.entries[0].status, 'submitted')
    assert.equal(ledger.entries[0].task_id, 'task-1', '提交后必须立刻回写 task_id')
    assert.equal(ledger.entries[0].fingerprint_algo, FINGERPRINT_ALGO)
    // 轮询：假驱动报 running → 状态保持，不落地、不重提。
    const polled = await pollGenerationTasks(service, { id: 'sample' }, await loadWorkspace(dir))
    assert.equal(polled.results[0].status, 'running')
    ledger = JSON.parse(await readFile(join(dir, 'ledger.json'), 'utf8'))
    assert.equal(ledger.entries.length, 1, '轮询不许新增台账条目（更不许重提）')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('提交失败不自动重试：只落一条失败台账，再计划会提示先看原因', async () => {
  ensureFakeDrivers('fail')
  const root = await mkdtemp(join(tmpdir(), 'drama-driver-fail-'))
  try {
    try {
      const dir = await makeWork(root)
      const service = serviceWith(fakeConfig())
      const work = await loadWorkspace(dir)
      const plan = await generationPlan(work, service, 'sample')
      const result = await executeGenerationPlan(service, { id: 'sample' }, work, {
        digest: plan.digest, approve: true, kinds: ['video'],
      })
      assert.equal(result.executed[0].status, 'failed')
      const ledger = JSON.parse(await readFile(join(dir, 'ledger.json'), 'utf8'))
      assert.equal(ledger.entries.length, 1, '失败也只允许一条：不重试')
      assert.match(ledger.entries[0].failure, /额度不足/)
      const again = await generationPlan(await loadWorkspace(dir), service, 'sample')
      assert.match(again.video.rows[0].reasons.join(' '), /失败/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  } finally {
    ensureFakeDrivers('ok')
  }
})

test('付费执行的三道闸：approve、digest、配置开关', async () => {
  ensureFakeDrivers('ok')
  const root = await mkdtemp(join(tmpdir(), 'drama-driver-gate-'))
  try {
    const dir = await makeWork(root)
    const service = serviceWith(fakeConfig())
    const work = await loadWorkspace(dir)
    const plan = await generationPlan(work, service, 'sample')
    await assert.rejects(executeGenerationPlan(service, { id: 'sample' }, work, { digest: plan.digest }), /approve/)
    await assert.rejects(executeGenerationPlan(service, { id: 'sample' }, work, { approve: true }), /digest/)
    const off = serviceWith(fakeConfig({ paidExecution: 'off' }))
    await assert.rejects(executeGenerationPlan(off, { id: 'sample' }, work, {
      digest: (await generationPlan(work, off, 'sample')).digest, approve: true,
    }), /关闭了付费执行/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('人物形象后台：限定单图、防重复提交、保留描述、选择参考与另出候选', async () => {
  ensureFakeDrivers('ok')
  const root = await mkdtemp(join(tmpdir(), 'drama-character-visual-'))
  try {
    const dir = await makeWork(root)
    await writeJsonAtomic(join(dir, 'characters.json'), { characters: [
      { id: 'lead', name: '主角', appearance: '蓝色外套', reference_assets: [] },
      { id: 'other', name: '配角', reference_assets: [] },
    ], props: [{ id: 'clock', name: '钟表', appearance: '黄铜外壳', reference_assets: [] }] })
    const service = serviceWith(fakeConfig())
    let work = await loadWorkspace(dir)
    const info = await characterVisual(work, service, 'lead')
    assert.match(info.prompt, /蓝色外套/)
    assert.equal(info.latest, null)
    await assert.rejects(prepareCharacterVisual(work, service, 'sample', { characterId: 'missing', prompt: 'p' }), /找不到/)
    await assert.rejects(prepareCharacterVisual(work, service, 'sample', { characterId: 'lead', prompt: ' ' }), /描述/)
    await assert.rejects(generationPlan(work, service, 'sample', { imageRequests: 'img-1' }), /必须/)
    await assert.rejects(generationPlan(work, service, 'sample', { imageRequests: ['missing'] }), /不存在/)
    const input = { characterId: 'lead', prompt: '主角穿蓝色外套，单人定妆照', area: '2K', aspectRatio: '3:4' }
    const prepared = await prepareCharacterVisual(work, service, 'sample', input)
    assert.equal(prepared.plan.image.rows.length, 1, '不能夹带原有 img-1 生图任务')
    assert.equal(prepared.plan.image.rows[0].id, prepared.requestId)
    assert.equal((await loadWorkspace(dir)).ledger.length, 0, '准备不提交')
    const options = { digest: prepared.plan.digest, approve: true, kinds: ['image'], imageRequests: [prepared.requestId] }
    const competing = await Promise.allSettled([
      executeGenerationPlan(service, { id: 'sample' }, work, options),
      executeGenerationPlan(service, { id: 'sample' }, work, options),
    ])
    assert.equal(competing[0].status, 'fulfilled')
    assert.equal(competing[1].status, 'rejected')
    assert.match(competing[1].reason.message, /不要重复/)
    const result = competing[0].value
    assert.equal(result.executed.length, 1)
    assert.equal(result.executed[0].status, 'succeeded')
    work = await loadWorkspace(dir)
    const image = work.assets.find(row => row.id === result.executed[0].assetId)
    assert.equal(image.role, 'lead')
    assert.equal(image.prompt, input.prompt)
    assert.equal(work.ledger.length, 1)
    await assert.rejects(executeGenerationPlan(service, { id: 'sample' }, work, options), /计划已经变了/)
    const again = await generationPlan(work, service, 'sample', { imageRequests: [prepared.requestId] })
    assert.equal(again.image.rows[0].action, 'skip')
    assert.equal((await generationPlan(work, service, 'sample', { imageRequests: [] })).image.rows.length, 0)
    await assert.rejects(selectCharacterReference(work, { characterId: 'other', assetId: image.id }), /属于/)
    await selectCharacterReference(work, { characterId: 'lead', assetId: image.id })
    work = await loadWorkspace(dir)
    assert.deepEqual(work.characters[0].reference_assets, [image.id])
    assert.equal(work.state.stage, 'generate', '选择形象不改阶段')
    const view = await buildStageView({ kind: 'characters', work, service })
    assert.equal(view.characters[0].assets[0].id, image.id)
    const next = await prepareCharacterVisual(work, service, 'sample', input)
    assert.notEqual(next.requestId, prepared.requestId)
    assert.equal(next.plan.image.rows[0].action, 'submit', '明确另出候选可使用相同描述')
    const prop = await characterVisual(work, service, 'clock')
    assert.match(prop.prompt, /黄铜外壳/)
    assert.equal((await loadWorkspace(dir)).ledger.length, 1, '准备新候选仍不提交')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
