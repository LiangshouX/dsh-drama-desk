import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, rm, readFile, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { DramaDeskService } from '../src/host/service.js'
import { currentVideo } from '../src/host/media.js'
import { assemblyPlan, assemblyJob } from '../src/host/assembly.js'
import { loadWorkspace } from '../src/host/workspace.js'
import { scopePrompt } from '../src/host/conceive.js'
import { writeJsonAtomic } from '../src/host/fsx.js'
import { addProductionRecord } from '../src/host/authoring.js'
import { createServer } from 'node:http'
import { registerApi } from '../src/host/api.js'

test('final media route streams byte ranges with the correct MIME and keeps the origin fence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'drama-stream-'))
  let handler
  registerApi({ effect: run => run(), webServer: { register: entry => { handler = entry.handler; return () => {} } } }, {
    assets: async () => ({ workspace: { dir: root }, assets: [{ id: 'cut', path: 'cut.webm' }] }),
  })
  const server = createServer((req, res) => handler(req, res))
  try {
    const bytes = Buffer.from(Array.from({ length: 4096 }, (_, i) => i % 256))
    await writeFile(join(root, 'cut.webm'), bytes)
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${server.address().port}/drama-desk/video?asset=cut`
    const partial = await fetch(url, { headers: { range: 'bytes=101-117' } })
    assert.equal(partial.status, 206)
    assert.equal(partial.headers.get('content-type'), 'video/webm')
    assert.equal(partial.headers.get('content-range'), 'bytes 101-117/4096')
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), bytes.subarray(101, 118))
    const blocked = await fetch(url, { headers: { origin: 'https://foreign.example' } })
    assert.equal(blocked.status, 403)
    const invalid = await fetch(url, { headers: { range: 'bytes=9000-9100' } })
    assert.equal(invalid.status, 416)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})

test('empty works can acquire numbered scenes, stable roles, shots and registered files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'drama-authoring-'))
  const dir = join(root, 'workspaces', 'sample')
  try {
    await mkdir(dir, { recursive: true })
    await writeJsonAtomic(join(dir, 'work.json'), { work_id: 'sample', title: '测试作品' })
    const [one, two] = await Promise.all([
      addProductionRecord(dir, { kind: 'scene', fields: { title: '第一场' } }),
      addProductionRecord(dir, { kind: 'scene', fields: { title: '第二场' } }),
    ])
    assert.deepEqual([one.id, two.id], ['SC01', 'SC02'])
    await addProductionRecord(dir, { kind: 'character', id: 'narrator', fields: { name: '旁白' } })
    await assert.rejects(addProductionRecord(dir, { kind: 'prop', id: 'narrator' }), /prop_/)
    await assert.rejects(addProductionRecord(dir, { kind: 'character', id: 'narrator' }), /已存在/)
    await addProductionRecord(dir, { kind: 'shot', sceneId: 'SC02', fields: { covers: [1] } })
    await addProductionRecord(dir, { kind: 'shot', sceneId: 'SC01' })
    const work = await loadWorkspace(dir)
    assert.deepEqual(work.shots.map(row => row.id), ['SC01-SH01', 'SC02-SH01'])
    await assert.rejects(addProductionRecord(dir, { kind: 'shot', sceneId: 'SC01', fields: { description_en: 'derived' } }), /不允许/)
    await assert.rejects(addProductionRecord(dir, { kind: 'shot', sceneId: '../bad' }), /场次/)
    await writeFile(join(dir, 'brief.md'), '测试登记', 'utf8')
    const service = new DramaDeskService({ config: { projectRoot: root, outputRoot: root } })
    const record = { workspaceId: 'sample', id: 'brief', type: 'doc', path: 'brief.md' }
    const saved = await service.registerAsset(record)
    assert.equal(saved.asset.sha256.length, 64)
    await assert.rejects(service.registerAsset(record), /已登记/)
    await assert.rejects(service.registerAsset({ ...record, id: 'escape', path: '../../outside.md' }))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('current version never silently falls back to another take', () => {
  const shot = { id: 'SC01-SH01', current_version: 2 }
  const old = { id: 'old', shot_id: shot.id, type: 'video', version: 1 }
  const current = { id: 'now', shot_id: shot.id, type: 'video', path: 'videos/SC01-SH01_v02.mp4' }
  assert.equal(currentVideo({ assets: [old] }, shot), undefined)
  assert.equal(currentVideo({ assets: [old, current] }, shot), current)
  assert.equal(currentVideo({ assets: [old, { ...current, status: 'deprecated' }] }, shot), undefined)
  assert.equal(currentVideo({ assets: [current, { ...current, id: 'ambiguous' }] }, shot), undefined)
})

test('stage guidance keeps the work boundary and explicitly distinguishes preview from action', () => {
  const prompt = scopePrompt({ id: 'sample', title: '测试作品', path: 'workspaces/sample', stage: 'assemble' })
  assert.match(prompt, /drama-assemble/)
  assert.match(prompt, /只读写 `workspaces\/sample\//)
  assert.match(prompt, /视图切换不代表进度推进/)
})

const mediaAvailable = ['ffmpeg', 'ffprobe', 'python'].every(command =>
  spawnSync(command, ['-version'], { windowsHide: true }).error === undefined)

test('review → local export → playback asset → delivery, plus missing/stale/race cases', { skip: !mediaAvailable, timeout: 90000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'drama-production-'))
  const dir = join(root, 'workspaces', 'sample')
  const save = (name, doc) => writeJsonAtomic(join(dir, name), doc)
  const read = async name => JSON.parse(await readFile(join(dir, name), 'utf8'))
  try {
    await mkdir(join(dir, 'videos'), { recursive: true })
    await save('work.json', { version: '1.0', work_id: 'sample', title: '测试作品' })
    await save('state.json', { version: '1.0', work_id: 'sample', stage: 'assemble' })
    await save('scenes.json', { scenes: [{ id: 'SC01', beats: [{ action: '推门' }] }] })
    await save('characters.json', { characters: [] })
    await save('ledger.json', { entries: [] })
    const shots = ['SC01-SH01', 'SC01-SH02'].map(id => ({ id, scene: 'SC01', current_version: 2,
      status: 'succeeded', duration: 1, camera: 'Static' }))
    await save('shots.json', { shots })
    const assets = []
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i]
      const path = `videos/${shot.id}_v02.mp4`
      const args = ['-v', 'error', '-y', '-f', 'lavfi', '-i', i ? 'color=c=blue:s=90x160:r=30:d=0.5' : 'color=c=red:s=160x90:r=24:d=0.5']
      if (i) args.push('-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5', '-c:a', 'aac')
      args.push('-t', '0.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(dir, path))
      const generated = spawnSync('ffmpeg', args, { encoding: 'utf8', windowsHide: true })
      assert.equal(generated.status, 0, generated.stderr)
      assets.push({ id: shot.id + '_v02', type: 'video', shot_id: shot.id, version: 2, path, has_audio: !!i })
      assets.push({ id: shot.id + '_v01', type: 'video', shot_id: shot.id, version: 1, path: 'videos/missing-old.mp4' })
    }
    await save('assets.json', { version: '1.0', assets })
    const service = new DramaDeskService({ config: { projectRoot: root, outputRoot: root } })
    const opts = { workspaceId: 'sample' }
    assert.equal((await service.assemblyStatus(opts)).ready, false, 'unreviewed cuts blocked')
    await assert.rejects(service.approveShot({ ...opts, shotId: shots[0].id }), /复核人/)
    for (const shot of shots) {
      const before = await service.revisionOf(dir)
      await service.editVerify({ ...opts, shotId: shot.id, patch: { verdict: 'pass', reviewer: '导演' } })
      assert.notEqual(await service.revisionOf(dir), before, 'editing existing report changes revision')
      await service.approveShot({ ...opts, shotId: shot.id })
    }
    const plan = await service.assemblyStatus(opts)
    assert.equal(plan.ready, true, 'missing historical takes do not block current ones')
    const handoff = await service.productionTask({ ...opts, stage: 'assemble' })
    assert.equal(handoff.data.ready, true)
    assert.match(handoff.prompt, /drama-assemble/)
    const [first, repeated] = await Promise.all([service.assemble(opts), service.assemble(opts)])
    assert.equal(first.job.id, repeated.job.id, 'double click starts one export')
    await writeFile(join(dir, 'note.md'), '导出时登记其他资产', 'utf8')
    await service.registerAsset({ ...opts, id: 'note', type: 'doc', path: 'note.md' })
    let job
    for (let index = 0; index < 180; index++) {
      job = await assemblyJob(dir)
      if (job.status !== 'running') break
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    assert.equal(job.status, 'succeeded', job.message)
    assert.equal(job.completed, 2)
    assert.ok((await stat(join(dir, job.output))).size > 0)
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', join(dir, job.output)], { encoding: 'utf8', windowsHide: true })
    const media = JSON.parse(probe.stdout)
    const video = media.streams.find(row => row.codec_type === 'video')
    assert.equal(video.width, 1280)
    assert.equal(video.height, 720)
    assert.equal(video.r_frame_rate, '24/1')
    assert.ok(media.streams.some(row => row.codec_type === 'audio'))
    assert.ok(Number(media.format.duration) >= 0.9 && Number(media.format.duration) < 1.4)
    const registered = (await read('assets.json')).assets.find(a => a.id === job.assetId)
    assert.ok((await read('assets.json')).assets.some(a => a.id === 'note'), 'export preserves concurrently registered assets')
    assert.equal(registered.purpose, 'final')
    assert.deepEqual(registered.references, assets.filter(a => a.version === 2).map(a => a.id))
    assert.ok((await read(job.manifest)).result.sha256)
    assert.equal((await service.stageView({ ...opts, stage: 'deliver' })).data.ready, true)
    await service.confirmDelivery({ ...opts, assetId: job.assetId })
    await service.confirmDelivery({ ...opts, assetId: job.assetId })
    assert.equal((await read('state.json')).delivery_asset_id, job.assetId)
    const changed = await read('shots.json')
    changed.shots[0].current_version = 3
    await save('shots.json', changed)
    const stale = (await service.stageView({ ...opts, stage: 'deliver' })).data.finals[0]
    assert.equal(stale.stale, true)
    await assert.rejects(service.confirmDelivery({ ...opts, assetId: job.assetId }), /版本已变化/)
    const missing = await assemblyPlan(await loadWorkspace(dir))
    assert.equal(missing.ready, false)
    assert.match(missing.gaps.join(' '), /当前版本/)
    await assert.rejects(service.approveShot({ ...opts, shotId: '../escape' }), /不存在/)
    await assert.rejects(service.editShot({ ...opts, shotId: shots[0].id, patch: { status: 'verified' } }), /人工验收/)
    await writeJsonAtomic(join(dir, 'assembly', 'status.json'), { id: 'old', owner: 'other', status: 'running', workerPid: -1 })
    assert.equal((await assemblyJob(dir)).status, 'interrupted')
  } finally {
    // root is exclusively the mkdtemp fixture created above.
    await rm(root, { recursive: true, force: true })
  }
})
