#!/usr/bin/env node
/** Isolated interactive preview. Uses a fixture under workspace tmp; never the installed plugin. */
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { DramaDeskService } from '../src/host/service.js'
import { registerApi } from '../src/host/api.js'
import { readJsonIfExists, writeJsonAtomic } from '../src/host/fsx.js'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(repo, '..', 'tmp', 'production-preview')
const dir = join(root, 'workspaces', 'sample')
const require = createRequire(import.meta.url)
const port = Number(process.env.DRAMA_PREVIEW_PORT || 3082)
await mkdir(join(dir, 'videos'), { recursive: true })
if (!await readJsonIfExists(join(dir, 'work.json'))) {
  await mkdir(join(dir, 'creative'), { recursive: true })
  await writeFile(join(dir, 'creative', 'brief.md'), '# 制作验证样片\n\n两镜测试：一段无声、一段有声。仅用于本地功能验证。\n')
  const shots = []
  const assets = []
  for (let index = 1; index <= 2; index++) {
    const id = 'SC01-SH0' + index
    const path = `videos/${id}_v01.mp4`
    const args = ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${index === 1 ? '0x24445c' : '0x925c35'}:s=320x180:r=24:d=2`]
    if (index === 2) args.push('-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'aac')
    args.push('-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(dir, path))
    const result = spawnSync('ffmpeg', args, { encoding: 'utf8', windowsHide: true })
    if (result.status !== 0) throw new Error(result.stderr)
    shots.push({ id, scene: 'SC01', title: index === 1 ? '无声片段 · 冷色' : '有声片段 · 暖色',
      camera: 'Static', camera_en: 'Static', covers: [index], duration: 2, ratio: '16:9', resolution: '768P',
      current_version: 1, status: 'verified', verified_asset_id: id + '_v01', references: [] })
    assets.push({ id: id + '_v01', shot_id: id, type: 'video', path, version: 1, width: 320, height: 180,
      duration_sec: 2, has_audio: index === 2, source: 'local-test-fixture', cost_usd: 0 })
    await writeJsonAtomic(join(dir, 'verify', id + '.report.json'), { shot_id: id,
      human: { verdict: 'pass', reviewer: '自动化测试样片', video_asset_id: id + '_v01', current_version: 1 } })
  }
  await writeJsonAtomic(join(dir, 'state.json'), { version: '1.0', work_id: 'sample', stage: 'assemble' })
  await writeJsonAtomic(join(dir, 'scenes.json'), { scenes: [{ id: 'SC01', title: '制作链路验证', summary: '仅用于本地测试',
    characters: [], beats: [{ action: '推开门', action_en: 'Opens the door' }, { action: '走进房间', action_en: 'Enters the room' }] }] })
  await writeJsonAtomic(join(dir, 'characters.json'), { characters: [], props: [] })
  await writeJsonAtomic(join(dir, 'shots.json'), { shots })
  await writeJsonAtomic(join(dir, 'assets.json'), { version: '1.0', assets })
  await writeJsonAtomic(join(dir, 'ledger.json'), { entries: [] })
  await writeJsonAtomic(join(dir, 'work.json'), { work_id: 'sample', title: '制作验证样片' })
}
const service = new DramaDeskService({ config: { projectRoot: root, outputRoot: root } })
let apiHandler
registerApi({ effect: callback => callback(), webServer: { register: row => { apiHandler = row.handler; return () => {} } } }, service)
const bootstrap = `
let main;
const previewContext={effect:run=>run(),locale:{register:()=>()=>{},bind:()=>()=>undefined},slots:{inject:(name,run)=>run(),register:(spec,component)=>{if(spec.name==='main')main=component;return()=>{}}}};
window.__ModuleLoader__={load:definition=>definition.factory(name=>{if(name==='react')return React;throw new Error(name)}).apply(previewContext)};
`;
const html = `<!doctype html><html lang="zh-CN" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>导演工作台 v0.2 独立验证</title>
<style>html,body{margin:0;height:100%;font-family:Segoe UI,sans-serif}body{display:flex;flex-direction:column;background:#11151d;color:#e8ecf3;--dsw-alias-bg-base:#11151d;--dsw-alias-label-primary:#e8ecf3;--dsw-alias-label-secondary:#b1b9c9;--dsw-alias-label-tertiary:#929db0;--dsw-alias-label-caption:#8b93a4;--dsw-alias-link:#7aaaff}html[data-theme=light] body{background:#f5f6f8;color:#172230;--dsw-alias-bg-base:#f5f6f8;--dsw-alias-label-primary:#172230;--dsw-alias-label-secondary:#49566a;--dsw-alias-label-tertiary:#657286;--dsw-alias-label-caption:#657286;--dsw-alias-link:#225fbe}#preview{flex:1;min-height:0;padding:8px}.devbar{font-size:12px;padding:8px 16px;display:flex;gap:12px;align-items:center}button{font:inherit}input,select,textarea{font:inherit}</style>
</head><body><div class="devbar">独立验证 · 合成测试素材 <button onclick="document.documentElement.dataset.theme='dark'">暗色</button><button onclick="document.documentElement.dataset.theme='light'">亮色</button></div><div id="preview"></div>
<script src="/react.js"></script><script src="/react-dom.js"></script><script>${bootstrap}</script><script src="/client.js"></script><script>ReactDOM.createRoot(document.getElementById('preview')).render(React.createElement(main,{}))</script></body></html>`
const runtime = name => join(dirname(require.resolve(name + '/package.json')), 'umd', name + '.development.js')
const files = new Map([['/react.js', runtime('react')], ['/react-dom.js', runtime('react-dom')], ['/client.js', join(repo, 'client.js')]])
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname
    if (path.startsWith('/drama-desk/')) { await apiHandler(req, res); return }
    if (path === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); return }
    if (files.has(path)) { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); res.end(await readFile(files.get(path))); return }
    res.writeHead(404); res.end()
  } catch (error) { if (!res.headersSent) res.writeHead(500); res.end(error.message) }
})
server.listen(port, '127.0.0.1', () => console.log(`独立验证：http://127.0.0.1:${port}/；数据：${root}`))
