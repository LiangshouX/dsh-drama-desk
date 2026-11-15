#!/usr/bin/env node
/**
 * 构建与发布前校验。
 *
 *   node scripts/build.mjs            # 构建到 build/
 *   node scripts/build.mjs --check    # 只校验 build/ 是否与 src/ 一致
 *
 * 为什么有这一步
 * --------------
 * Skill 是**被开发的对象**，不是被调用的产品。开发到一半的 Skill 被 agent 调到，
 * 是这类仓库最典型的翻车方式。所以：
 *
 *   src/skills/   开发态，DSH 任何扫描根目录都看不到（不在 .dsh/skills、.agents/skills）
 *   build/skills/ 发布态，bundledSkillDir 指向这里
 *
 * 校验项（任一不过 → 非 0 退出，不产出）：
 *   1. 每个 skill 有合法 frontmatter（name kebab-case、description 非空）
 *   2. skill 正文里引用的 spec/ 与 tools/ 路径都真实存在
 *   3. 没有指向已废弃路径的残留（.drama/、docs/数据契约.md 等）
 *   4. 没有把具体作品名当通用规则写进来
 *   5. 插件半边（manifest / patch / host / client / locale / icon）齐全且合法
 */

import { readdir, readFile, writeFile, mkdir, rm, cp, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname, resolve, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const BUILD = join(ROOT, 'build')
const SKILLS_SRC = join(SRC, 'skills')
const SPEC_SRC = join(SRC, 'spec')
const TOOLS_SRC = join(SRC, 'tools')

const onlyCheck = process.argv.includes('--check')

/** 递归列出文件 */
async function walk(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else out.push(p)
  }
  return out
}

/** 解析 YAML frontmatter（只需 name / description，够用） */
function parseFrontmatter(text) {
  // 统一换行 + 去 BOM + 去前导空行
  const t = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/^\s*\n/, '')
  if (!t.startsWith('---')) return null
  const end = t.indexOf('\n---', 3)
  if (end === -1) return null
  const block = t.slice(3, end)
  const fm = {}
  for (const line of block.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (m) fm[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return fm
}

/**
 * 逻辑路径 → 实际路径。
 *
 * Skill 正文里写**稳定的逻辑路径**（如 `spec/rules.md`），
 * 实际解析随当前模型而变。这样换模型时 Skill 正文一个字都不用改。
 */
function resolveSpecPath(ref, modelId = 'minimax') {
  const cands = []
  if (ref === 'spec/rules.md') {
    cands.push(join(SPEC_SRC, 'models', modelId, 'rules.md'))
  }
  if (ref.startsWith('spec/references/')) {
    cands.push(join(SPEC_SRC, 'core', ref.slice('spec/'.length)))
  }
  if (ref.startsWith('spec/templates/')) {
    cands.push(join(SPEC_SRC, 'core', ref.slice('spec/'.length)))
  }
  if (ref === 'spec/数据契约.md' || ref === 'spec/验收清单.md' || ref === 'spec/constitution.md') {
    cands.push(join(SPEC_SRC, 'core', ref.slice('spec/'.length)))
  }
  cands.push(join(SPEC_SRC, ref.slice('spec/'.length)))
  cands.push(join(SRC, ref))
  return cands
}

const problems = []
const note = (msg) => problems.push(msg)

// ---------- 1. 校验 skill ----------
const skillDirs = existsSync(SKILLS_SRC)
  ? (await readdir(SKILLS_SRC, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  : []

if (skillDirs.length === 0) note('src/skills/ 为空：没有可发布的 Skill')

for (const name of skillDirs) {
  const file = join(SKILLS_SRC, name, 'SKILL.md')
  if (!existsSync(file)) {
    note(`skills/${name}/SKILL.md 不存在（DSH 只认 <root>/<name>/SKILL.md，且发现深度只有一层）`)
    continue
  }
  const text = await readFile(file, 'utf8')
  const fm = parseFrontmatter(text)
  if (!fm) {
    note(`skills/${name}/SKILL.md 缺少 frontmatter`)
  } else {
    if (!fm.name) note(`skills/${name}/SKILL.md 缺 name`)
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.name))
      note(`skills/${name}/SKILL.md 的 name="${fm.name}" 不是 kebab-case`)
    if (!fm.description) note(`skills/${name}/SKILL.md 缺 description`)
  }

  // 正文里的路径引用必须可达。
  // 只校验**指向包内**的引用（spec/、tools/）；作品侧路径（scenes.json、shots.json…）
  // 是运行时相对作品目录的，由 Host service 解析，不在这里校验。
  const PKG_PREFIXES = ['spec/', 'tools/']
  for (const m of text.matchAll(/`([A-Za-z0-9_./一-鿿-]+\.(?:md|py|json))`/g)) {
    const ref = m[1]
    if (ref.startsWith('http')) continue
    if (!PKG_PREFIXES.some((p) => ref.startsWith(p))) continue
    const cands = resolveSpecPath(ref)
    if (!cands.some(existsSync)) {
      note(`skills/${name}/SKILL.md 引用了不存在的包内路径：${ref}`)
    }
  }
}

// ---------- 2. 已废弃路径 / 具体作品名 ----------
const DEPRECATED_PATHS = ['.drama/', 'docs/数据契约.md', 'tools/drama/']
const WORK_NAMES = ['拾音斋', '名字典当行', 'QwenVideo4T', 'name-pawnshop']

for (const f of await walk(SRC)) {
  if (extname(f) !== '.md') continue
  const text = await readFile(f, 'utf8')
  for (const p of DEPRECATED_PATHS) {
    if (text.includes(p)) note(`${relative(ROOT, f)} 仍引用已废弃路径 "${p}"`)
  }
  for (const w of WORK_NAMES) {
    if (text.includes(w)) note(`${relative(ROOT, f)} 含有具体作品名 "${w}"（会干扰后续调研）`)
  }
}

// ---------- 3. spec 分层完整性 ----------
if (!existsSync(join(SPEC_SRC, 'core'))) note('spec/core/ 缺失：模型无关的规范应放这里')
const modelDirs = existsSync(join(SPEC_SRC, 'models'))
  ? (await readdir(join(SPEC_SRC, 'models'), { withFileTypes: true }))
      .filter((e) => e.isDirectory()).map((e) => e.name)
  : []
if (modelDirs.length === 0) note('spec/models/ 下没有任何模型适配目录')

// ---------- 3b. 插件半边（manifest / patch / host / client / locale / icon） ----------
async function checkPluginHalf() {
  const manifestPath = join(ROOT, 'package.json')
  if (!existsSync(manifestPath)) {
    note('package.json 缺失：插件不是包，装不上')
    return
  }
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    note(`package.json 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
    return
  }
  if (manifest.name !== 'dsh-drama-desk') note(`包名应为 dsh-drama-desk，当前是 ${manifest.name}`)
  if (manifest.type !== 'module') note('package.json 的 type 必须是 module（Host 半边是 ESM）')
  const exportsField = manifest.exports ?? {}
  for (const key of ['.', './client', './locale/*.json', './icon']) {
    if (exportsField[key] === undefined) note(`package.json 缺少 exports["${key}"]`)
  }
  if (manifest.dsh?.bundle?.patch === undefined) note('package.json 缺少 dsh.bundle.patch')
  if (manifest.dsh?.client?.platform !== 'web') note("dsh.client.platform 必须是 'web'")
  if (manifest.dsh?.client?.inject === undefined) note('dsh.client.inject 未声明')

  for (const file of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg']) {
    if (!existsSync(join(ROOT, file))) note(`缺少 ${file}`)
  }
  const icon = await stat(join(ROOT, 'icon.svg')).catch(() => undefined)
  if (icon !== undefined && icon.size > 256 * 1024) note('icon.svg 超过 256 KiB')

  for (const locale of ['en', 'zh']) {
    const path = join(ROOT, 'locale', `${locale}.json`)
    if (!existsSync(path)) {
      note(`缺少 locale/${locale}.json`)
      continue
    }
    let doc
    try {
      doc = JSON.parse(await readFile(path, 'utf8'))
    } catch (error) {
      note(`locale/${locale}.json 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    if (typeof doc?.meta?.title !== 'string' || doc.meta.title === '') note(`locale/${locale}.json 缺少 meta.title`)
    if (typeof doc?.meta?.description !== 'string' || doc.meta.description === '') note(`locale/${locale}.json 缺少 meta.description`)
    if (doc?.meta?.detail !== undefined && !existsSync(join(ROOT, doc.meta.detail))) {
      note(`locale/${locale}.json 的 meta.detail 指向不存在的文件：${doc.meta.detail}`)
    }
  }

  const hostDir = join(SRC, 'host')
  if (!existsSync(hostDir)) note('src/host/ 缺失：Host 半边没有源码')
  for (const file of ['index.js', 'client.js']) {
    const path = join(ROOT, file)
    if (!existsSync(path)) continue
    const text = await readFile(path, 'utf8')
    if (file === 'index.js' && !/export\s+(async\s+)?function\s+apply\s*\(/.test(text)) {
      note('index.js 必须导出 apply(ctx, config)')
    }
    if (file === 'client.js' && !text.includes('window.__ModuleLoader__.load')) {
      note('client.js 必须通过 window.__ModuleLoader__.load 注册工厂')
    }
    if (file === 'client.js' && !text.includes("require('react')")) {
      note('client.js 必须从模块表取 react（require(\'react\')）')
    }
  }

  // **随包工具必须自成一体。**
  //
  // 曾经「重新编译」直接报 `ModuleNotFoundError: No module named 'slim_prompt'`：
  // 编译器 import 了一个从来没被打包的生成器。这一条把那条坑钉死。
  const toolsSrc = join(SRC, 'tools')
  for (const file of ['compile_prompts.py', 'slim_prompt.py', 'lighting.py', 'desk_qc.py']) {
    if (!existsSync(join(toolsSrc, file))) {
      note(`src/tools/${file} 缺失：编译器/体检器必须随包自带（没有它，界面上的「重新编译」会直接报错）`)
    }
  }
}

/**
 * 语法检查：每个 JS 文件都要能被解析。
 *
 * 这不是形式主义——曾经有一次编辑把两行 `import` 粘成了一行，
 * 插件在 Host 里直接抛 SyntaxError，而界面只显示「读不到数据」。
 * 语法错误必须在**构建时**拦住，而不是在用户面前。
 */
async function checkSyntax() {
  const targets = [join(ROOT, 'index.js'), join(ROOT, 'client.js')]
  const hostDir = join(SRC, 'host')
  if (existsSync(hostDir)) {
    for (const entry of await readdir(hostDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.js')) targets.push(join(hostDir, entry.name))
    }
  }
  for (const target of targets) {
    if (!existsSync(target)) continue
    const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' })
    if (result.status !== 0) {
      const detail = String(result.stderr ?? '').split('\n').slice(0, 6).join('\n')
      note(`${relative(ROOT, target)} 语法错误：\n${detail}`)
    }
  }
}

/**
 * 运行时冒烟测试：**真的 import 一次，并把关键方法调一遍**。
 *
 * `node --check` 只查语法，查不出「import 了但名字拼错」这种错误——
 * 那类错误在插件里表现为「界面读不到数据」，用户看到的是空白而不是报错。
 * 所以这里要**跑**：import Host 半边 → 建 service → 调 overview / rules / pipeline。
 *
 * 这一步不需要作品目录：没有作品时这些方法返回空列表，正是要验的形状。
 */
async function checkRuntime() {
  const servicePath = join(SRC, 'host', 'service.js')
  if (!existsSync(servicePath)) return
  const script = `
import { DramaDeskService } from ${JSON.stringify(pathToFileUrl(servicePath))}
const service = new DramaDeskService({ config: {} })
const overview = await service.overview()
if (typeof overview.outputRoot !== 'string' || overview.outputRoot === '') throw new Error('overview().outputRoot 不对')
if (typeof overview.projectRoot !== 'string' || overview.projectRoot === '') throw new Error('overview().projectRoot 不对')
if (!Array.isArray(overview.warnings)) throw new Error('overview().warnings 不是数组')
const rules = await service.rules({})
if (!Array.isArray(rules.rules)) throw new Error('rules().rules 不是数组')
const pipeline = await service.pipeline({})
if (!Array.isArray(pipeline.scenes)) throw new Error('pipeline().scenes 不是数组')
const spec = await service.getSpec()
if (typeof spec.available !== 'boolean') throw new Error('getSpec() 形状不对')
// 阶段视图：九个阶段都要能被组装出来，形状不能是空的。
// （没有作品时跳过——冒烟测试不该依赖用户的数据。）
if (Array.isArray(overview.workspaces) && overview.workspaces.length > 0) {
  for (const kind of ['conceive','outline','characters','script','storyboard','generate','verify','assemble','deliver']) {
    const view = await service.stageView({ stage: kind })
    if (view.kind !== kind) throw new Error('stageView(' + kind + ') 的 kind 不对')
    if (view.data === undefined || view.data === null) throw new Error('stageView(' + kind + ') 没有 data')
  }
}
const settings = await service.settings({})
if (!Array.isArray(settings.adapters)) throw new Error('settings().adapters 不是数组')
if (settings.picker === undefined) throw new Error('settings().picker 缺失')
console.log('runtime smoke ok')
`
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 60000 })
  if (result.status !== 0) {
    const detail = String(result.stderr ?? '').split('\n').filter(line => line.trim() !== '').slice(0, 8).join('\n')
    note(`Host 半边运行时冒烟测试失败：\n${detail}`)
  }
}

/** Convert a path into a file URL usable in an ESM import specifier. */
function pathToFileUrl(path) {
  return new URL(`file:///${path.replace(/\\/g, '/').replace(/^\/+/, '')}`).href
}

/**
 * 性能闸门（可选）。
 *
 *   node scripts/build.mjs --perf          # 跑（需要 DSH 正在跑）
 *   node scripts/build.mjs --perf <url>    # 跑，指定地址
 *   node scripts/build.mjs --render        # 跑渲染开销闸门（需要 DSH Desktop 在跑）
 *
 * 插件是**嵌在别人的主应用里**的：插件慢一点，用户就会说「DSH 卡了」。
 * 性能是红线，所以它要有闸门，而不是靠感觉。
 *
 * 没开 --perf / --render 时**不跑**——构建不该依赖一个正在运行的服务。
 */
async function checkPerformance(argv) {
  const perfIndex = argv.indexOf('--perf')
  const renderIndex = argv.indexOf('--render')
  if (perfIndex >= 0) {
    const script = join(ROOT, 'scripts', 'perf.mjs')
    if (!existsSync(script)) {
      note('scripts/perf.mjs 不存在：性能闸门无法运行')
    } else {
      const url = argv[perfIndex + 1] !== undefined && !argv[perfIndex + 1].startsWith('--') ? argv[perfIndex + 1] : undefined
      const result = spawnSync(process.execPath, [script, ...(url === undefined ? [] : ['--base', url])], {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 180000,
      })
      process.stdout.write(result.stdout ?? '')
      if (result.stderr !== undefined && result.stderr !== '') process.stderr.write(result.stderr)
      if (result.status !== 0) note('性能闸门未通过：见上面的测量结果')
    }
  }
  if (renderIndex >= 0) {
    const script = join(ROOT, 'scripts', 'render-probe.mjs')
    if (!existsSync(script)) {
      note('scripts/render-probe.mjs 不存在：渲染开销闸门无法运行')
    } else {
      const result = spawnSync(process.execPath, [script], {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 300000,
      })
      process.stdout.write(result.stdout ?? '')
      if (result.stderr !== undefined && result.stderr !== '') process.stderr.write(result.stderr)
      if (result.status !== 0) note('渲染开销闸门未通过：见上面的测量结果')
    }
  }
}

await checkPluginHalf()
await checkSyntax()
await checkPerformance(process.argv.slice(2))

// ---------- 4. 构建或校验 ----------
if (!onlyCheck) {
  await rm(BUILD, { recursive: true, force: true })
  await mkdir(join(BUILD, 'skills'), { recursive: true })
  await cp(SPEC_SRC, join(BUILD, 'spec'), { recursive: true })
  if (existsSync(TOOLS_SRC)) await cp(TOOLS_SRC, join(BUILD, 'tools'), { recursive: true })
  // Python 的字节码缓存不是发布物：它会随机器而变，还会弄脏包。
  await rm(join(BUILD, 'tools', '__pycache__'), { recursive: true, force: true })
  for (const name of skillDirs) {
    await cp(join(SKILLS_SRC, name), join(BUILD, 'skills', name), { recursive: true })
  }
  console.log(`✓ 已构建：build/skills（${skillDirs.length} 个）+ build/spec + build/tools`)
  await checkRuntime()
} else {
  // 校验 build/ 与 src/ 是否同步
  const srcFiles = (await walk(SKILLS_SRC)).map((f) => relative(SKILLS_SRC, f)).sort()
  const buildFiles = (await walk(join(BUILD, 'skills'))).map((f) => relative(join(BUILD, 'skills'), f)).sort()
  const same = JSON.stringify(srcFiles) === JSON.stringify(buildFiles)
  console.log(same ? '✓ build/skills 与 src/skills 一致' : '✗ build/ 已过期：请运行 node scripts/build.mjs')
  if (!same) problems.push('build/ 与 src/ 不同步')
}

// ---------- 5. 报告 ----------
if (problems.length) {
  console.error(`\n✗ ${problems.length} 个问题：`)
  for (const p of problems) console.error('   ' + p)
  process.exit(1)
}
console.log('\n✓ 全部校验通过')
