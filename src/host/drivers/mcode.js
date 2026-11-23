/**
 * MiniMax 驱动（`mcode-tools` 的适配层）。
 *
 * 这一层把**供应商语言**（`area` / `aspect_ratio` / `input_image` / `task_id`）
 * 全部收在里面，对外只给归一化的请求与结果。
 *
 * 两条纪律来自参考实测：
 *  1. **生图是同步的**（返回即出图），**生视频是异步两段式**（submit → poll）。
 *  2. **计费不幂等**：本驱动**不做**确认、不做重试、不记账——
 *     那是编排层（`generation-exec.js`）与调用方的事。
 */
import { McodeToolsError, MCODE_TOOLS, sha256 } from '../transport/cli.js'

const IMAGE_LABEL = 'MiniMax H3 Image'
const VIDEO_LABEL = 'MiniMax H3 视频'

/**
 * 造一对驱动（图片 / 视频），共用同一个 CLI 客户端。
 *
 * @param {{client: any}} options
 */
export function createMcodeDrivers(options) {
  const client = options.client
  return {
    image: createImageDriver(client),
    video: createVideoDriver(client),
  }
}

function createImageDriver(client) {
  let capabilities
  return {
    id: 'mcode-image',
    driver: 'mcode',
    kind: 'image',
    label: IMAGE_LABEL,
    tool: MCODE_TOOLS.generateImage,

    /** 能力：**从 schema 读**，不手抄（上传上限随服务变）。 */
    async capabilities() {
      if (capabilities !== undefined) return capabilities
      const schema = await client.schema(MCODE_TOOLS.generateImage)
      const properties = schema?.input_schema?.properties ?? {}
      const item = properties?.requests?.items?.properties ?? {}
      capabilities = {
        maxRequestsPerCall: properties?.requests?.maxItems ?? 10,
        maxImagesPerRequest: item?.n?.maximum ?? 10,
        maxReferenceImages: item?.reference_images?.maxItems ?? 16,
        area: item?.area?.enum ?? [],
        outputFormat: item?.output_format?.enum ?? [],
        async: false,
        note: 'area 不写默认 4K（成本陷阱）；参考图顺序 = 图号。',
      }
      return capabilities
    },

    /** 可用性：能读到本工具的 schema 就算这条能力可用（认证由注册表另判）。 */
    async probe() {
      try {
        const capabilities = await this.capabilities()
        return { available: true, reason: '已就绪', capabilities }
      } catch (cause) {
        return { available: false, reason: cause instanceof Error ? cause.message : String(cause) }
      }
    },

    /** 认证状态（注册表用它把「组件在」升级成「真能用」）。 */
    probeAuth: () => client.authStatus(),

    /**
     * 提交一批生图（**同步**，一次 ≤10 条）。
     *
     * @param {Array<{prompt: string, references?: Array<{source?: string, url?: string, mimeType?: string}>, aspectRatio?: string, area?: string, n?: number, outputFile?: string, outputFormat?: string}>} requests
     */
    async submit(requests) {
      if (!Array.isArray(requests) || requests.length === 0) {
        throw new McodeToolsError('生图请求不能为空', { kind: 'protocol', tool: MCODE_TOOLS.generateImage })
      }
      const caps = await this.capabilities()
      if (requests.length > caps.maxRequestsPerCall) {
        throw new McodeToolsError(
          `生图一次最多 ${caps.maxRequestsPerCall} 条（本次 ${requests.length} 条）：请分批`,
          { kind: 'protocol', tool: MCODE_TOOLS.generateImage },
        )
      }
      const payload = { requests: [] }
      for (const request of requests) {
        const item = { prompt: String(request.prompt ?? '') }
        const references = Array.isArray(request.references) ? request.references : []
        if (references.length > 0) {
          item.reference_images = []
          for (const reference of references) {
            item.reference_images.push(await toMediaRef(client, reference))
          }
        }
        if (request.aspectRatio !== undefined) item.aspect_ratio = request.aspectRatio
        if (request.area !== undefined) item.area = request.area
        if (request.n !== undefined) item.n = request.n
        if (request.outputFile !== undefined) item.output_file = request.outputFile
        if (request.outputFormat !== undefined) item.output_format = request.outputFormat
        payload.requests.push(item)
      }
      const raw = await client.call(MCODE_TOOLS.generateImage, payload, { timeoutMs: 1_800_000 })
      return normalizeImageResult(raw)
    },

    /** node_id → 本地文件。 */
    download: (nodeId, dest) => client.downloadAsset(nodeId, dest),
  }
}

function createVideoDriver(client) {
  let capabilities
  return {
    id: 'mcode-video',
    driver: 'mcode',
    kind: 'video',
    label: VIDEO_LABEL,
    tool: MCODE_TOOLS.submitVideo,
    queryTool: MCODE_TOOLS.queryVideo,

    async capabilities() {
      if (capabilities !== undefined) return capabilities
      const schema = await client.schema(MCODE_TOOLS.submitVideo)
      const properties = schema?.input_schema?.properties ?? {}
      capabilities = {
        models: properties?.model?.enum ?? [],
        promptMaxLength: properties?.prompt?.maxLength ?? null,
        ratio: properties?.ratio?.enum ?? [],
        resolution: properties?.resolution?.enum ?? [],
        async: true,
        note: 'H3 / H3-Max 有原生音轨；Hailuo-2.3 静音。成片只保留 7 天。',
      }
      return capabilities
    },

    /** 可用性：能读到提交工具的 schema 才算可用。 */
    async probe() {
      try {
        const capabilities = await this.capabilities()
        return { available: true, reason: '已就绪', capabilities }
      } catch (cause) {
        return { available: false, reason: cause instanceof Error ? cause.message : String(cause) }
      }
    },

    probeAuth: () => client.authStatus(),

    /**
     * 提交一个视频任务（**一次一个**）。
     *
     * @param {{prompt: string, model: string, durationSeconds?: number, resolution?: string, ratio?: string,
     *          inputImage?: {source?: string, url?: string, mimeType?: string},
     *          lastFrameImage?: {source?: string, url?: string, mimeType?: string},
     *          referenceImages?: Array<{source?: string, url?: string, mimeType?: string}>}} request
     */
    async submit(request) {
      const payload = { prompt: String(request.prompt ?? ''), model: request.model }
      if (request.durationSeconds !== undefined) payload.duration = request.durationSeconds
      if (request.ratio !== undefined) payload.ratio = request.ratio
      if (request.resolution !== undefined) payload.resolution = request.resolution
      if (request.inputImage !== undefined) payload.input_image = await toMediaRef(client, request.inputImage)
      if (request.lastFrameImage !== undefined) payload.last_frame_image = await toMediaRef(client, request.lastFrameImage)
      if (Array.isArray(request.referenceImages) && request.referenceImages.length > 0) {
        payload.reference_images = []
        for (const reference of request.referenceImages) {
          payload.reference_images.push(await toMediaRef(client, reference))
        }
      }
      const raw = await client.call(MCODE_TOOLS.submitVideo, payload, { timeoutMs: 300_000 })
      const taskId = raw?.task_id ?? raw?.taskId ?? raw?.id ?? ''
      if (taskId === '') {
        // 提交成功却没拿到 task_id：既不能轮询，也不能在中断后恢复。
        throw new McodeToolsError('视频提交返回里没有 task_id：无法轮询与恢复', {
          kind: 'protocol', tool: MCODE_TOOLS.submitVideo,
        })
      }
      return { taskId: String(taskId), model: request.model, promptSha256: sha256(request.prompt), raw }
    },

    /** 查任务。`model` 必须与提交时**同一个**。 */
    async poll(taskId, model) {
      const raw = await client.call(MCODE_TOOLS.queryVideo, { task_id: String(taskId), model }, { timeoutMs: 120_000 })
      return normalizeVideoState(raw)
    },

    download: (nodeId, dest) => client.downloadAsset(nodeId, dest),
  }
}

/**
 * 本地路径 → temp_url（约 1 小时过期）。已经是 URL 的直接用。
 */
async function toMediaRef(client, reference) {
  let url = typeof reference?.url === 'string' && reference.url !== '' ? reference.url : undefined
  if (url === undefined) {
    const source = typeof reference?.source === 'string' ? reference.source : ''
    if (source === '') throw new McodeToolsError('媒体引用既没有 url 也没有本地路径', { kind: 'protocol' })
    const uploaded = await client.uploadLocal(source, reference.mimeType)
    url = uploaded.temp_url ?? uploaded.url
  }
  const entry = { url }
  if (typeof reference?.mimeType === 'string' && reference.mimeType !== '') entry.mime_type = reference.mimeType
  return entry
}

/**
 * 生图结果归一化：`{success_items:[{node_id,file_name}], failed_items:[…]}`。
 *
 * 一条 request 的参考图不可达 → **那一条**失败，不是整批失败。
 */
export function normalizeImageResult(raw) {
  const successRaw = raw?.success_items ?? raw?.successItems ?? []
  const failedRaw = raw?.failed_items ?? raw?.failedItems ?? raw?.failures ?? []
  const items = (Array.isArray(successRaw) ? successRaw : []).map((entry, index) => ({
    nodeId: entry?.node_id ?? entry?.nodeId ?? '',
    fileName: entry?.file_name ?? entry?.fileName ?? '',
    requestIndex: typeof entry?.request_index === 'number' ? entry.request_index : index,
  })).filter(item => item.nodeId !== '')
  const failures = (Array.isArray(failedRaw) ? failedRaw : []).map((entry, index) => ({
    requestIndex: typeof entry?.index === 'number' ? entry.index : index,
    message: entry?.message ?? entry?.error ?? entry?.reason ?? '未知错误',
  }))
  const status = failures.length === 0 && items.length > 0
    ? 'succeeded'
    : (items.length > 0 ? 'partial' : 'failed')
  return { status, items, failures, raw }
}

/** 视频状态归一化：供应商换状态词时，编排层不用改。 */
export function normalizeVideoState(raw) {
  const status = String(raw?.status ?? raw?.state ?? '').toLowerCase()
  const known = new Set(['queued', 'running', 'succeeded', 'failed', 'cancelled'])
  return {
    status: known.has(status) ? status : 'unknown',
    nodeId: raw?.node_id ?? raw?.nodeId ?? undefined,
    fileName: raw?.file_name ?? raw?.fileName ?? undefined,
    failure: raw?.failure ?? raw?.error ?? raw?.message ?? undefined,
    raw,
  }
}

function sha256Prompt(text) {
  return sha256(String(text))
}
