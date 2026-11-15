#!/usr/bin/env node
/**
 * 打包发布物。
 *
 *   node scripts/pack.mjs          # 构建 + 打包 → release/dsh-drama-desk-<version>.tgz
 *   node scripts/pack.mjs --pack   # 只打包（不重新构建）
 *
 * **为什么要有这一步**（AGENTS.md §安装纪律）：
 *
 * `plugin_manager install_bundle` 指向**源码目录**时，profile 里留下的是指向
 * 仓库的软链。于是：
 *   · 仓库里的一次误改会**立刻**改变运行中的插件（好，但让人分不清哪一份是发布物）；
 *   · 打包工具（pnpm / npm）会在仓库里落下 `node_modules/`、`pnpm-lock.yaml`、
 *     `__pycache__/` 之类的杂物，**弄脏 git**，把「源码」和「安装产物」混在一个目录；
 *   · 一旦目录被移动或删除，运行中的插件就断了。
 *
 * 所以：**发布物是一个 tarball，安装的是 tarball，不是源码目录。**
 * `release/` 不入库（见 .gitignore），它是唯一被安装的东西。
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, readdir, stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE = join(ROOT, 'release')
const onlyPack = process.argv.includes('--pack')

/** Run one command, streaming nothing, and fail loudly. */
function run(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, shell: process.platform === 'win32', stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} ${args.join(' ')} 退出码 ${code}`))
    })
  })
}

/** The package version, read from the manifest. */
async function readVersion() {
  const manifest = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'))
  return manifest.version ?? '0.0.0'
}

async function main() {
  if (!onlyPack) {
    console.log('› 构建发布态（spec / skills / tools）')
    await run(process.execPath, [join(ROOT, 'scripts', 'build.mjs')], ROOT)
  }

  if (!existsSync(join(ROOT, 'build', 'spec'))) {
    throw new Error('build/spec 不存在：先运行 node scripts/build.mjs')
  }

  await rm(RELEASE, { recursive: true, force: true })
  await mkdir(RELEASE, { recursive: true })

  const version = await readVersion()
  console.log('› 打包 npm bundle → release/')
  await run('npm', ['pack', '--pack-destination', RELEASE, '--silent'], ROOT)

  const files = await readdir(RELEASE)
  const tarball = files.find(name => name.endsWith('.tgz'))
  if (tarball === undefined) {
    throw new Error(`打包失败：${RELEASE} 里没有 .tgz`)
  }
  const info = await stat(join(RELEASE, tarball))
  console.log(`\n✓ 发布物：release/${tarball}（${(info.size / 1024).toFixed(1)} KiB，版本 ${version}）`)
  console.log('  安装它：')
  console.log(`    plugin_manager install_bundle  target: ${join(RELEASE, tarball)}`)
  console.log('  不要把源码目录当安装目标（见 AGENTS.md §安装纪律）。')
}

main().catch(error => {
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
