/**
 * 驱动注册表 —— 「插件里的插件」的落点。
 *
 * `dsh-drama-desk` 是插件；能出图 / 出片的驱动是**可插拔的单元**：
 * 每家供应商一个驱动实现，按 id 注册，通道配置里 `driver` 字段绑定它。
 * 内置的一家是 MiniMax（`mcode-tools`）。以后接第二家，只需要：
 *
 *   ① 写一个驱动实现（`probe / capabilities / submit / poll / download`）
 *   ② `registerDriver({ id, build })`
 *   ③ 在 `channels[]` 配置里写一条 `{ id, kind, label, driver: '<新 id>' }`
 *
 * **编排层只认归一化后的请求/结果**，不认识任何供应商参数名。
 *
 * 外部子插件（真正独立的 bundle）走同一条路：等 desk 把注册表暴露成 Cordis
 * service 之后，`registerDriver()` 就是它的入口——现在先把函数与契约留在这里。
 */
import { McodeClient, resolveMcodeCli } from '../transport/cli.js'
import { createMcodeDrivers } from './mcode.js'

/** 探测结果缓存：认证与 schema 都要走 CLI，不能每几秒问一次。 */
const PROBE_TTL_MS = 30_000
const probeCache = new WeakMap()

/** 供应商驱动工厂：`build({ service, cli })` 返回 `{ image?, video? }`。 */
const factories = new Map()

/**
 * 注册一个供应商驱动（未来的外部插件入口）。
 *
 * @param {{id: string, label?: string, build: (context: {service: any, cli: {path: string, source: string}}) => {image?: any, video?: any}}} definition
 * @returns {() => void} 注销函数
 */
export function registerDriver(definition) {
  const id = typeof definition?.id === 'string' ? definition.id.trim() : ''
  if (id === '' || typeof definition?.build !== 'function') {
    throw new Error('registerDriver 需要 { id, build }')
  }
  factories.set(id, definition)
  return () => {
    if (factories.get(id) === definition) factories.delete(id)
  }
}

/** 列出已注册的驱动工厂（含内置的 mcode）。 */
export function listDriverFactories() {
  return [...factories.entries()].map(([id, definition]) => ({
    id,
    label: typeof definition?.label === 'string' ? definition.label : id,
  }))
}

// 内置：MiniMax / mcode-tools。**没有 CLI 就不构造**（它没有别的传输形态）。
registerDriver({
  id: 'mcode',
  label: 'MiniMax · mcode-tools',
  build: ({ cli }) => {
    if (cli?.path === undefined) return {}
    const client = new McodeClient({ exe: cli.path })
    return createMcodeDrivers({ client })
  },
})

/**
 * 为一个 service 构造驱动实例（按需，不缓存实例；缓存的是探测结果）。
 *
 * @param {any} service DramaDeskService
 * @returns {Promise<{drivers: Record<string, any>, cli: object, notes: string[]}>}
 */
export async function buildDrivers(service) {
  const notes = []
  const cli = await resolveMcodeCli(service, { configuredPath: service?.config?.mcodePath })
  const drivers = {}
  for (const [id, definition] of factories) {
    try {
      const built = definition.build({ service, cli })
      if (built?.image !== undefined) drivers[id + ':image'] = built.image
      if (built?.video !== undefined) drivers[id + ':video'] = built.video
    } catch (cause) {
      notes.push(`驱动 ${id} 构造失败：${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }
  return { drivers, cli, notes }
}

/** 内置通道的**静态元数据**：即使运行时组件不在，也要把「本来有这个生成器」列出来。 */
const BUILTIN_META = [
  { id: 'mcode-image', kind: 'image', label: 'MiniMax H3 Image', driver: 'mcode' },
  { id: 'mcode-video', kind: 'video', label: 'MiniMax H3 视频', driver: 'mcode' },
]

/** 用户看得懂的生成器名。 */
const KIND_LABEL = { image: '生图生成器', video: '生视频生成器' }

/**
 * 探测所有通道（内置 + 自定义），解析「生图/生视频」各自落到哪条。
 *
 * 可用性分三层，缺一层就如实标不可用并给理由：
 *  CLI 在不在 → 认证过没有 → 这条通道的工具 schema 能不能读到。
 *
 * @param {any} service
 * @param {{refresh?: boolean}} [options]
 * @returns {Promise<object>}
 */
export async function probeDrivers(service, options = {}) {
  const cached = probeCache.get(service)
  if (cached !== undefined && options.refresh !== true && Date.now() - cached.at < PROBE_TTL_MS) {
    return cached.value
  }
  const { drivers, cli, notes } = await buildDrivers(service)
  const baseReason = cli.path === undefined
    ? '找不到 mcode-tools（连接器 CLI）：试过 ' + cli.tried.join('；')
    : undefined
  const builtins = []
  for (const meta of BUILTIN_META) {
    const driver = drivers[meta.driver + ':' + meta.kind]
    const row = {
      id: meta.id,
      kind: meta.kind,
      label: meta.label,
      driver: meta.driver,
      tool: driver?.tool,
      installed: cli.path !== undefined,
      available: false,
    }
    if (driver === undefined) {
      row.reason = baseReason ?? '找不到这条通道的驱动'
      builtins.push(row)
      continue
    }
    try {
      const probe = await driver.probe()
      row.available = probe?.available === true
      row.reason = probe?.reason ?? '未返回理由'
      if (probe?.capabilities !== undefined) row.capabilities = probe.capabilities
    } catch (cause) {
      row.reason = cause instanceof Error ? cause.message : String(cause)
    }
    builtins.push(row)
  }
  // 认证：CLI 在，不代表能用。`auth status` 才是充分条件。
  let auth
  const anyDriver = drivers['mcode:video'] ?? drivers['mcode:image']
  if (anyDriver !== undefined && typeof anyDriver.probeAuth === 'function') {
    try {
      auth = await anyDriver.probeAuth()
      if (auth?.status !== 'authenticated') {
        for (const row of builtins) {
          row.available = false
          row.reason = `连接器未认证（status=${auth?.status ?? '未知'}）：先在 MiniMax Code 里登录`
        }
      }
    } catch (cause) {
      auth = { error: cause instanceof Error ? cause.message : String(cause) }
      for (const row of builtins) {
        row.available = false
        row.reason = '连接器认证检查失败：' + (auth.error ?? '未知错误')
      }
    }
  }
  const custom = []
  for (const channel of readCustomChannels(service?.config)) {
    const bound = channel.driver !== undefined ? drivers[channel.driver + ':' + channel.kind] : undefined
    if (bound !== undefined) {
      // 绑定了执行驱动的自定义通道：可用性问**它自己的驱动**，
      // 不能拿 mcode 的内置行来代表它（第二家供应商的探测逻辑不一样）。
      let available = false
      let reason = '未探测'
      let capabilities
      try {
        const probe = await bound.probe()
        available = probe?.available === true
        reason = probe?.reason ?? '未探测'
        if (probe?.capabilities !== undefined) capabilities = probe.capabilities
      } catch (cause) {
        reason = cause instanceof Error ? cause.message : String(cause)
      }
      const row = { ...channel, installed: true, available, executable: true, reason }
      if (capabilities !== undefined) row.capabilities = capabilities
      custom.push(row)
      continue
    }
    // 没有执行绑定的自定义通道：能显示、能被选中，但**不能真的出片**。
    custom.push({
      ...channel,
      installed: true,
      available: true,
      executable: false,
      reason: '自定义通道没有执行绑定（driver）：只能作为标注，驱动不会真的调它',
    })
  }
  const value = {
    builtins,
    custom,
    selection: {
      image: resolveSelection('image', [...builtins, ...custom], service?.config, drivers),
      video: resolveSelection('video', [...builtins, ...custom], service?.config, drivers),
    },
    cli: { path: cli.path, source: cli.source, tried: cli.tried },
    auth,
    notes,
  }
  probeCache.set(service, { at: Date.now(), value })
  return value
}

/** 作废探测缓存（配置改了、认证状态可能变了）。 */
export function forgetDrivers(service) {
  probeCache.delete(service)
}

/**
 * 执行时按通道 id 拿驱动实例。
 *
 * @param {any} service
 * @param {'image'|'video'} kind
 * @param {string|undefined} channelId
 * @returns {Promise<{driver: any, channel: any}>}
 */
export async function driverFor(service, kind, channelId) {
  const probed = await probeDrivers(service, { refresh: true })
  const selection = probed.selection[kind]
  if (channelId !== undefined && channelId !== '' && channelId !== 'inherit' && selection.channel !== channelId) {
    throw new Error(`通道 ${channelId} 不是当前选中的 ${kind} 通道（选中：${selection.channel ?? '继承'}）`)
  }
  if (selection.available !== true) throw new Error(selection.reason || '这条通道现在不可用')
  if (selection.executable === false) throw new Error(selection.reason || '这条通道没有执行绑定')
  const { drivers } = await buildDrivers(service)
  const driver = drivers[selection.driver + ':' + kind]
  if (driver === undefined) throw new Error(`找不到 ${kind} 驱动：${selection.driver}`)
  return { driver, channel: selection }
}

/**
 * 解析某一类生成最终落到哪条通道。
 *
 * 返回里永远带 `available` / `reason` / `executable`：
 * 不能出片时要能一句话说清是「没装 CLI」「没认证」「工具不可用」还是「没绑定驱动」。
 */
function resolveSelection(kind, channels, config, drivers) {
  const wanted = kind === 'image' ? config?.imageChannel : config?.videoChannel
  const model = kind === 'image' ? config?.imageModel : config?.videoModel
  const usable = channels.filter(channel => channel.kind === kind)
  const titled = KIND_LABEL[kind] ?? '生成器'
  // 空值 = 用**默认生成器**。不再有「继承宿主」这种面向用户的模式：
  // 生成器是我们实现的，用户在界面里选的是生成器的名字。
  const useDefault = wanted === '' || wanted === undefined || wanted === 'inherit'
  if (useDefault) {
    const candidate = usable.find(channel => channel.driver !== undefined && channel.available === true)
    if (candidate !== undefined) {
      return {
        mode: 'default',
        channel: candidate.id,
        label: candidate.label,
        tool: candidate.tool,
        driver: candidate.driver,
        model: isEmpty(model) ? candidate.model : model,
        available: true,
        executable: candidate.executable !== false,
        capabilities: candidate.capabilities,
        reason: '已就绪',
      }
    }
    const installed = usable.find(channel => channel.driver !== undefined)
    return {
      mode: 'default',
      channel: installed?.id,
      label: installed?.label,
      driver: installed?.driver,
      model: isEmpty(model) ? undefined : model,
      available: false,
      executable: false,
      reason: unavailableReason(kind, installed),
    }
  }
  const picked = usable.find(channel => channel.id === wanted)
  if (picked === undefined) {
    return {
      mode: 'custom', channel: wanted, model: isEmpty(model) ? undefined : model,
      available: false, executable: false,
      reason: `选中的生成器「${wanted}」不在了（可能来自旧配置）`,
    }
  }
  return {
    mode: 'custom',
    channel: picked.id,
    label: picked.label,
    tool: picked.tool,
    driver: picked.driver,
    model: isEmpty(model) ? picked.model : model,
    available: picked.available === true,
    executable: picked.executable !== false && picked.driver !== undefined,
    capabilities: picked.capabilities,
    reason: picked.available === true
      ? (picked.executable === false ? picked.reason : '已就绪')
      : unavailableReason(kind, picked),
  }
}

/**
 * 把底层失败翻成**用户能懂的一句话**。
 *
 * 界面不该出现 `mcode-tools` / `connector__matrix__…` 这种实现名——
 * 那是产品名与实现细节的混淆。技术细节只放在设置里的「诊断」区。
 */
function unavailableReason(kind, channel) {
  const title = KIND_LABEL[kind] ?? '生成器'
  const detail = typeof channel?.reason === 'string' ? channel.reason : ''
  if (channel === undefined) return `这个作品还没有可用的${title}`
  if (/mcode-tools|找不到|不在/.test(detail)) {
    return `${title}需要本机安装并登录 MiniMax Code（生成组件未就绪）`
  }
  if (/未认证|登录|认证/.test(detail)) return `${title}需要先登录 MiniMax Code`
  if (detail === '') return `${title}暂时不可用`
  return `${title}暂时不可用：${detail}`
}

function isEmpty(value) {
  return value === undefined || value === null || String(value) === ''
}

/** 配置里的自定义通道（形状不合法的一律丢掉，不猜）。 */
function readCustomChannels(config) {
  const raw = Array.isArray(config?.channels) ? config.channels : []
  const out = []
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue
    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    const kind = entry.kind === 'image' || entry.kind === 'video' ? entry.kind : undefined
    if (id === '' || kind === undefined) continue
    const row = { id, kind, label: typeof entry.label === 'string' && entry.label !== '' ? entry.label : id, custom: true }
    if (typeof entry.model === 'string' && entry.model !== '') row.model = entry.model
    if (typeof entry.driver === 'string' && entry.driver !== '') row.driver = entry.driver
    if (typeof entry.tool === 'string' && entry.tool !== '') row.tool = entry.tool
    if (typeof entry.cli === 'string' && entry.cli !== '') row.cli = entry.cli
    if (typeof entry.note === 'string' && entry.note !== '') row.note = entry.note
    out.push(row)
  }
  return out
}
