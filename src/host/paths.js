/**
 * Plugin paths and resolved configuration.
 *
 * The plugin is split into a **development state** (`src/`) and a **release
 * state** (`build/`). Only the release state is shipped to the agent:
 *
 *   src/spec/     规范源码（开发对象）
 *   build/spec/   规范随包分发（运行时真源）
 *   src/skills/   Skill 源码（开发中，DSH 任何扫描根目录都看不到）
 *   build/skills/ 通过校验的 Skill（运行时唯一可见）
 *   src/tools/    体检器与编译器（随包分发，运行时直接调用）
 *
 * `scripts/build.mjs` 生成 `build/`；未构建时 `build/` 缺失，规范视图会明确
 * 告诉用户「请先运行 node scripts/build.mjs」，而不是静默显示空规范。
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Absolute path of the package root (one level above `src/host/`). */
export const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Release-state spec directory (`build/spec`) — the only spec the runtime reads. */
export const SPEC_DIR = join(PACKAGE_DIR, 'build', 'spec')

/** Release-state skill directory (`build/skills`) — the only skill root the runtime serves. */
export const SKILL_DIR = join(PACKAGE_DIR, 'build', 'skills')

/**
 * QC tools and the compiler.
 *
 * They ship with the package and are **called**, never reimplemented. The
 * release state (`build/tools`) is preferred; the source state (`src/tools`)
 * is the fallback so the plugin still runs from a checkout that was never
 * built.
 */
export const TOOLS_DIR = existsSync(join(PACKAGE_DIR, 'build', 'tools'))
  ? join(PACKAGE_DIR, 'build', 'tools')
  : join(PACKAGE_DIR, 'src', 'tools')

/**
 * The naive "Videos" default.
 *
 * Kept only as the last resort of `locations.js`; the real default follows
 * Windows' known folder, because the user may have moved it to another drive.
 */
export function defaultOutputRoot() {
  if (process.platform === 'win32') {
    const profile = process.env.USERPROFILE
    if (profile !== undefined && profile !== '') return join(profile, 'Videos')
  }
  return join(homedir(), process.platform === 'darwin' ? 'Movies' : 'Videos')
}

/**
 * Resolve the plugin configuration.
 *
 * `projectRoot` 与 `outputRoot` **留空即自动**：自动解析要问系统（用户可能把
 * 「视频」目录搬到了别的盘），所以这一步只保留用户**显式**给的值，
 * 真正的解析交给 `locations.js`（异步，见 `DramaDeskService.locations()`）。
 *
 * `model` 指向 `build/spec/models/<id>/`。
 */
export function resolveConfig(raw) {
  const config = raw !== undefined && typeof raw === 'object' && raw !== null ? raw : {}
  const text = value => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined)
  const model = text(config.model) ?? 'minimax'
  const autoRefresh = typeof config.autoRefresh === 'number' && Number.isFinite(config.autoRefresh)
    ? Math.max(0, Math.trunc(config.autoRefresh))
    : 4000
  return {
    projectRoot: text(config.projectRoot),
    outputRoot: text(config.outputRoot),
    model,
    autoRefresh,
    // 生成模型：提交生成时用谁。空 = 不由插件决定（agent 走自己的模型）。
    // 这一对是**旧字段**，留着是为了不弄坏已有的 profile；新配置走下面四条。
    generationProvider: text(config.generationProvider) ?? '',
    generationModel: text(config.generationModel) ?? '',
    // 生成通道：'' / 'inherit' = 继承宿主的连接器；否则是本插件指定的通道 id。
    // `imageModel` / `videoModel` 留空 = 用通道自己的默认。
    imageChannel: text(config.imageChannel) ?? '',
    imageModel: text(config.imageModel) ?? '',
    videoChannel: text(config.videoChannel) ?? '',
    videoModel: text(config.videoModel) ?? '',
    // 自定义通道（自治）：[{id, kind, label, driver?, model?, tool?, cli?, note?}]。
    // 只存「用什么」，不存任何密钥——密钥归宿主凭据服务。
    channels: Array.isArray(config.channels) ? config.channels : [],
    // 连接器 CLI 的路径。留空 = 自动发现（配置 → 宿主 PATH → ~/.minimax/bin → hosts/*）。
    mcodePath: text(config.mcodePath) ?? '',
    // 付费执行开关：'receipt'（默认，必须带计划摘要点名才执行）或 'off'（只出计划）。
    paidExecution: text(config.paidExecution) === 'off' ? 'off' : 'receipt',
  }
}
