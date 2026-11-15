/**
 * dsh-drama-desk — Host half.
 *
 * 把 AI 短剧生产流水线里那些只存在于代码、JSON 和 agent 脑子里的规范，
 * 变成一个**人能读、能改、能做取舍的工作台**。
 *
 * 这个文件只做三件事：
 *
 *  1. 建立 **DramaDeskService** —— 所有操作的唯一实现（读流水线、读镜详情、
 *     跑体检、读规范、读资产、读台账、改 beats、改镜头字段、重新编译、校验过期）。
 *  2. 把同一批操作暴露给 **浏览器**（`/drama-desk/api/…`）。
 *  3. 把同一批操作暴露给 **agent**（`drama_desk_*` 工具）。
 *
 * 2 和 3 都调用 1 —— 「一个操作，两个调用者」。人和 agent 对「合不合格」的
 * 判断必须一致，否则插件就是新的信息分裂源。
 *
 * 硬边界（不可破）：
 *  - 插件**不发起付费生成**；生成仍由 agent 走幂等三步。
 *  - 插件**不自己实现编译与体检**；它调用随包分发的体检器与编译脚本。
 *  - 插件**不直接写派生字段**；`description_en` / `dialogue` 由编译生成。
 *  - **任何图片显示前 ≤1200px**；见 `src/host/api.js` 的图片路由。
 */
import { DramaDeskService } from './src/host/service.js'
import { registerApi } from './src/host/api.js'
import { registerTools } from './src/host/tools.js'

/** Plugin identity for cordis rows and client-modules keying. */
export const name = 'dsh-drama-desk'

/** Services required before mounting: the tool registry and the HTTP carrier. */
export const inject = ['tools', 'webServer']

/**
 * Mount the plugin.
 *
 * @param {object} ctx the plugin context
 * @param {object} config the row's config (see cordis.patch.yml)
 */
export function apply(ctx, config) {
  const service = new DramaDeskService({ config, ctx })

  // The HTTP surface: one prefix, read model + write model + the safe image route.
  ctx.effect(() => registerApi(ctx, service), 'dsh-drama-desk: API routes')

  // The agent tools: the same service methods, under model-facing names.
  ctx.effect(() => registerTools(ctx, service), 'dsh-drama-desk: agent tools')

  // Expose the service for other plugins on the same context. Cordis warns
  // about unknown context members in some builds; the tools and the HTTP route
  // are the supported surface, so a refusal here is not fatal.
  try {
    ctx.dramaDesk = service
  } catch {
    // A context that refuses the assignment simply does not publish the service.
  }
}
