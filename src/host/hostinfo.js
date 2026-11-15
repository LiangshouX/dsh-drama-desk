/**
 * 宿主的信息 —— 真实读取，不自造一份。
 *
 * 设置面板里最要紧的两件事：**宿主现在用的是哪个模型**、**宿主能不能弹
 * 原生目录对话框**。答案必须来自宿主自己：
 *
 *  - 模型：`ctx.get('llm').listProviders()` / `listModels(provider)`，
 *    以及 `ctx.get('agentDefaultModel').currentSelection()`。
 *  - 目录选择器：`ctx.get('directoryPicker').capability()`。
 *
 * 插件**不维护**一份模型清单：宿主换 provider、换模型，插件这边立刻跟着
 * 变；插件自造的那份只会骗人。
 *
 * 本模块**只读**：不写作品目录，也不改宿主配置。
 */
import { mkdir, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, parse, resolve, sep } from 'node:path'
import { readJsonIfExists } from './fsx.js'

/** 单个 provider 的模型列表最多等多久（毫秒）。 */
const MODEL_TIMEOUT_MS = 5000

/** 目录列表最多给多少项。 */
const MAX_ENTRIES = 500

/**
 * 读宿主的真实模型配置。
 *
 * provider 的模型列表**逐个 try/catch**：一个 provider 挂了（没配好、
 * 网络不通、模型目录读不出来）不能拖垮整个设置面板——它只是自己没有
 * 模型而已。每个 provider 另有 5 秒超时，一个卡死的 provider 也不能把
 * 面板卡住。
 *
 * @param {any} service DramaDeskService（它持有 `ctx` 与 `config`）
 * @returns {Promise<{
 *   providers: Array<{id:string,name:string,configured:boolean,models:Array<{id:string,name:string}>}>,
 *   hostModel: {provider:string|undefined, model:string|undefined, reasoningEffort:string|undefined},
 *   picker: {kind:'native'|'browse'},
 * }>}
 */
export async function readHostInfo(service) {
  const ctx = service?.ctx
  const llm = hostService(ctx, 'llm')
  const providers = []
  let raw = []
  if (llm !== undefined && typeof llm.listProviders === 'function') {
    try {
      raw = await llm.listProviders()
    } catch {
      raw = []
    }
  }
  for (const info of Array.isArray(raw) ? raw : []) {
    const id = typeof info?.id === 'string' ? info.id : undefined
    if (id === undefined) continue
    const listed = await listModelsOf(llm, id)
    providers.push({
      id,
      name: typeof info?.name === 'string' && info.name !== '' ? info.name : id,
      // 读得到模型目录就算配好了；读不到就是没配好——如实说，不猜。
      configured: listed.ok,
      models: listed.models,
    })
  }
  return {
    providers,
    hostModel: await readHostModel(ctx),
    picker: readPicker(ctx),
  }
}

/**
 * 打开宿主的原生目录选择器。
 *
 * 宿主没有原生对话框时返回 `{browse: true}`，客户端改用内嵌浏览器
 * （`docs/API.md` §6.1 / §6.2）。
 *
 * @param {any} service
 * @returns {Promise<{path:string|null, cancelled:boolean}|{browse:true}>}
 */
export async function pickDirectory(service) {
  const capability = capabilityOf(service)
  if (capability === undefined) return { browse: true }
  if (capability.kind !== 'native' || typeof capability.pick !== 'function') return { browse: true }
  const controller = new AbortController()
  let picked
  try {
    picked = await capability.pick(controller.signal)
  } catch (error) {
    throw new Error(`宿主目录选择器失败：${message(error)}`)
  }
  if (typeof picked !== 'string' || picked === '') return { path: null, cancelled: true }
  return { path: picked, cancelled: false }
}

/**
 * 浏览一个目录。
 *
 * 宿主能列目录（`capability().list`）就用宿主的；只有原生对话框的宿主
 * 就自己读盘（**只列子目录**，文件不列）。
 *
 * 注意：用户是在**整个文件系统**里逛，所以这里用普通的 `path.resolve`，
 * 不套 `resolveWithin`——但每个路径都先 resolve 过，`..` 不会拼出
 * 越界的路径。
 *
 * @param {any} service
 * @param {string|undefined} path
 * @returns {Promise<{path:string, home:string, crumbs:Array<{name:string,path:string}>,
 *   entries:Array<{name:string,path:string,hidden:boolean}>, truncated:boolean}>}
 */
export async function browseDirectory(service, path) {
  const capability = capabilityOf(service)
  if (capability !== undefined && typeof capability.list === 'function') {
    let listing
    try {
      listing = await capability.list(typeof path === 'string' && path !== '' ? path : undefined)
    } catch (error) {
      throw new Error(`浏览目录失败：${message(error)}`)
    }
    return normalizeListing(listing)
  }
  return await browseWithFs(path)
}

/**
 * 在某个目录下新建一个目录。
 *
 * 名字不许把目录造到父目录外面去。
 *
 * @param {any} service
 * @param {string} path 父目录
 * @param {string} name 新目录名
 * @returns {Promise<string>} 新目录的路径
 */
export async function createDirectory(service, path, name) {
  const parent = resolve(typeof path === 'string' && path !== '' ? path : homedir())
  const leaf = typeof name === 'string' ? name.trim() : ''
  if (leaf === '') throw new Error('目录名不能为空')
  const target = resolve(parent, leaf)
  const prefix = parent.endsWith(sep) ? parent : `${parent}${sep}`
  if (!target.startsWith(prefix)) throw new Error(`目录名不合法：${name}`)
  const capability = capabilityOf(service)
  if (capability !== undefined && typeof capability.createDirectory === 'function') {
    try {
      const created = await capability.createDirectory(parent, leaf)
      return typeof created === 'string' && created !== '' ? created : target
    } catch (error) {
      throw new Error(`新建目录失败：${message(error)}`)
    }
  }
  await mkdir(target, { recursive: true })
  return target
}

/**
 * 项目根下所有作品的详细清单。
 *
 * 作品列表本身由 `service.listWorkspaces()` 给（它认识作品目录的两种
 * 布局）；这里补上**从磁盘算出来**的场次数、镜头数、秒数与更新时间——
 * `state.json` 里的计数可能没写过，算出来的才是真的。
 *
 * @param {any} service
 * @returns {Promise<Array<{id:string,title:string,stage:string|undefined,scenes:number,
 *   shots:number,seconds:number,dir:string,updatedAt:string|undefined}>>}
 */
export async function listWorkspacesDetailed(service) {
  let base = []
  if (service !== undefined && typeof service.listWorkspaces === 'function') {
    try {
      base = await service.listWorkspaces()
    } catch {
      base = []
    }
  }
  const rows = []
  for (const entry of Array.isArray(base) ? base : []) {
    const dir = typeof entry?.dir === 'string' ? entry.dir : ''
    const state = await readJsonSafe(join(dir, 'state.json'))
    const scenesDoc = await readJsonSafe(join(dir, 'scenes.json'))
    const shotsDoc = await readJsonSafe(join(dir, 'shots.json'))
    const scenes = Array.isArray(scenesDoc?.scenes) ? scenesDoc.scenes : []
    const shots = Array.isArray(shotsDoc?.shots) ? shotsDoc.shots : []
    let seconds = 0
    for (const shot of shots) {
      const value = Number(shot?.duration)
      if (Number.isFinite(value)) seconds += value
    }
    rows.push({
      id: typeof entry?.id === 'string' ? entry.id : '',
      title: typeof entry?.title === 'string' ? entry.title : '',
      stage: typeof state?.stage === 'string' ? state.stage : undefined,
      scenes: scenes.length,
      shots: shots.length,
      seconds: round2(seconds),
      dir,
      updatedAt: await updatedAtOf(dir),
    })
  }
  return rows
}

// ── 内部 ────────────────────────────────────────────────────────────────────

/** 从宿主上下文取一个服务；取不到就是 undefined。 */
function hostService(ctx, key) {
  if (ctx === undefined || ctx === null) return undefined
  try {
    if (typeof ctx.get === 'function') return ctx.get(key)
    return ctx[key]
  } catch {
    return undefined
  }
}

/** 目录选择器的能力对象；宿主没有就是 undefined。 */
function capabilityOf(service) {
  const picker = hostService(service?.ctx, 'directoryPicker')
  if (picker === undefined) return undefined
  try {
    const capability = picker?.capability?.()
    if (capability === undefined || capability === null) return undefined
    return capability
  } catch {
    return undefined
  }
}

/** 宿主当前选的模型。 */
async function readHostModel(ctx) {
  const host = hostService(ctx, 'agentDefaultModel')
  let selection
  try {
    selection = host?.currentSelection?.()
  } catch {
    selection = undefined
  }
  return {
    provider: typeof selection?.provider === 'string' ? selection.provider : undefined,
    model: typeof selection?.model === 'string' ? selection.model : undefined,
    reasoningEffort: typeof selection?.reasoningEffort === 'string' ? selection.reasoningEffort : undefined,
  }
}

/** 宿主能不能弹原生目录对话框。 */
function readPicker(ctx) {
  const picker = hostService(ctx, 'directoryPicker')
  let capability
  try {
    capability = picker?.capability?.()
  } catch {
    capability = undefined
  }
  return { kind: capability?.kind === 'native' ? 'native' : 'browse' }
}

/**
 * 一个 provider 的模型列表。
 *
 * 读不出来不算失败——这个 provider 就是没有模型（或者没配好）。
 * 超时与异常都变成 `ok: false`，不影响别的 provider。
 */
async function listModelsOf(llm, id) {
  if (llm === undefined || typeof llm.listModels !== 'function') return { ok: false, models: [] }
  let rows
  try {
    rows = await withTimeout(llm.listModels(id), MODEL_TIMEOUT_MS)
  } catch {
    return { ok: false, models: [] }
  }
  const models = []
  for (const row of Array.isArray(rows) ? rows : []) {
    const modelId = typeof row?.id === 'string' ? row.id : undefined
    if (modelId === undefined) continue
    const model = {
      id: modelId,
      name: typeof row?.name === 'string' && row.name !== '' ? row.name : modelId,
    }
    if (typeof row?.description === 'string' && row.description !== '') model.description = row.description
    models.push(model)
  }
  return { ok: true, models }
}

/** 给一个 promise 加超时。 */
function withTimeout(promise, ms) {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error('读取模型列表超时')), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolvePromise(value)
      },
      error => {
        clearTimeout(timer)
        rejectPromise(error)
      },
    )
  })
}

/** 把宿主给的目录清单整理成契约里的形状。 */
function normalizeListing(listing) {
  return {
    path: typeof listing?.path === 'string' ? listing.path : '',
    home: typeof listing?.home === 'string' ? listing.home : homedir(),
    crumbs: Array.isArray(listing?.crumbs)
      ? listing.crumbs.map(entry => ({
        name: typeof entry?.name === 'string' ? entry.name : '',
        path: typeof entry?.path === 'string' ? entry.path : '',
      }))
      : [],
    entries: Array.isArray(listing?.entries)
      ? listing.entries.map(entry => ({
        name: typeof entry?.name === 'string' ? entry.name : '',
        path: typeof entry?.path === 'string' ? entry.path : '',
        hidden: entry?.hidden === true,
      }))
      : [],
    truncated: listing?.truncated === true,
  }
}

/** 自己读盘列目录（宿主只有原生对话框时的兜底）。 */
async function browseWithFs(path) {
  const target = resolve(typeof path === 'string' && path !== '' ? path : homedir())
  let entries
  try {
    entries = await readdir(target, { withFileTypes: true })
  } catch (error) {
    throw new Error(`读不了目录 ${target}：${message(error)}`)
  }
  const rows = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    rows.push({
      name: entry.name,
      path: join(target, entry.name),
      hidden: entry.name.startsWith('.'),
    })
  }
  rows.sort((a, b) => a.name.localeCompare(b.name))
  const truncated = rows.length > MAX_ENTRIES
  return {
    path: target,
    home: homedir(),
    crumbs: crumbsOf(target),
    entries: truncated ? rows.slice(0, MAX_ENTRIES) : rows,
    truncated,
  }
}

/** 从盘符根开始的祖先链。 */
function crumbsOf(target) {
  const root = parse(target).root
  const crumbs = [{ name: root.replace(/[\\/]+$/, ''), path: root }]
  const rest = target.slice(root.length).split(/[\\/]+/).filter(part => part !== '')
  let current = root
  for (const part of rest) {
    current = join(current, part)
    crumbs.push({ name: part, path: current })
  }
  return crumbs
}

/** 读一个 JSON；文件缺失或坏了都当「没有」。 */
async function readJsonSafe(path) {
  try {
    return await readJsonIfExists(path)
  } catch {
    return undefined
  }
}

/** 作品目录里最晚改动的那个 json 的时间。 */
async function updatedAtOf(dir) {
  if (typeof dir !== 'string' || dir === '') return undefined
  const names = [
    'work.json',
    'state.json',
    'scenes.json',
    'shots.json',
    'characters.json',
    'assets.json',
    'ledger.json',
  ]
  let latest = 0
  for (const name of names) {
    try {
      const info = await stat(join(dir, name))
      if (info.mtimeMs > latest) latest = info.mtimeMs
    } catch {
      // 没有这个文件就跳过。
    }
  }
  if (latest === 0) return undefined
  return new Date(latest).toISOString()
}

/** 保留两位小数。 */
function round2(value) {
  return Math.round(value * 100) / 100
}

/** 错误信息。 */
function message(error) {
  return error instanceof Error ? error.message : String(error)
}
