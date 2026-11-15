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
 */

import { readdir, readFile, writeFile, mkdir, rm, cp, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, resolve, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const BUILD = join(ROOT, 'build')
const SKILLS_SRC = join(SRC, 'skills')
const SPEC_SRC = join(SRC, 'spec')

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

// ---------- 4. 构建或校验 ----------
if (!onlyCheck) {
  await rm(BUILD, { recursive: true, force: true })
  await mkdir(join(BUILD, 'skills'), { recursive: true })
  await cp(SPEC_SRC, join(BUILD, 'spec'), { recursive: true })
  for (const name of skillDirs) {
    await cp(join(SKILLS_SRC, name), join(BUILD, 'skills', name), { recursive: true })
  }
  console.log(`✓ 已构建：build/skills（${skillDirs.length} 个）+ build/spec`)
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
