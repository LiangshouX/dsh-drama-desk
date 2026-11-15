/**
 * The agent-facing tools.
 *
 * Every tool is a **thin** wrapper over one `DramaDeskService` method — the
 * same method the UI button calls. That is the "一个操作，两个调用者" rule
 * (PRD §8.6): the human's button and the agent's tool must not drift apart,
 * because the whole point of the plugin is that both judge a shot the same way.
 *
 * Tools are registered with a `when` guard: they only appear in a step when a
 * work is actually configured, so a session that never touches the drama desk
 * does not carry ten extra tool schemas.
 */
import { STATUS_LABELS } from './service.js'

/** Remove `undefined` members so the value is lossless JSON. */
function clean(value) {
  if (Array.isArray(value)) return value.map(clean)
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue
      out[key] = clean(item)
    }
    return out
  }
  return value
}

/** The output contract shared by every tool: an open JSON object. */
const JSON_OBJECT_OUTPUT = {
  schema: { type: 'object', additionalProperties: true },
  render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
}

/**
 * Build one tool definition.
 *
 * `parameters` is written in the author-facing shape (a property map whose
 * entries carry `required: true`) and compiled here into the **raw JSON
 * Schema** the model actually sees — the same projection the Harness's own
 * `defineTool` helper performs, without taking on that dependency.
 */
function tool(name, description, parameters, execute) {
  const properties = {}
  const required = []
  for (const [key, spec] of Object.entries(parameters)) {
    const { required: isRequired, ...rest } = spec
    properties[key] = rest
    if (isRequired === true) required.push(key)
  }
  return {
    name,
    description,
    parameters: {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
      additionalProperties: true,
    },
    output: JSON_OBJECT_OUTPUT,
    execute: async (args, exec) => clean(await execute(args, exec)),
  }
}

/**
 * Register the drama desk tools on the Host.
 *
 * @param {object} ctx
 * @param {DramaDeskService} service
 * @returns {() => void} disposer for every registration
 */
export function registerTools(ctx, service) {
  /** Only offer the tools when there is something to look at. */
  const when = async () => {
    try {
      const rows = await service.listWorkspaces()
      return rows.length > 0
    } catch {
      return false
    }
  }

  const workspaceProperty = {
    type: 'string',
    description: '作品 id；省略则用当前选中的作品。',
  }

  const definitions = [
    tool(
      'drama_desk_status',
      '读短剧流水线状态：作品、阶段、场次×镜头网格与每个镜头的体检状态（未生成/已生成未体检/WARN/FAIL/通过）。先看这个。',
      { workspace: workspaceProperty },
      async args => await service.pipeline({ workspaceId: args.workspace }),
    ),
    tool(
      'drama_desk_shot',
      '读一个镜头的完整详情：该镜覆盖的 beats（表演层真源）、镜头字段、六段提示词预览、参考图、四个体检器结果、此刻生效的规则与依据。',
      {
        workspace: workspaceProperty,
        shot: { type: 'string', description: '镜头 id，例如 SC02-SH01。', required: true },
      },
      async args => await service.shot({ workspaceId: args.workspace, shotId: args.shot }),
    ),
    tool(
      'drama_desk_qc',
      '跑体检并给出逐项判定：阈值、当前值、差多少。scene 省略时给全片。',
      {
        workspace: workspaceProperty,
        scene: { type: 'string', description: '场次 id；省略则给全片体检结果。' },
        shot: { type: 'string', description: '镜头 id；给了就只查这一镜。' },
      },
      async args => {
        if (args.shot !== undefined) {
          const detail = await service.shot({ workspaceId: args.workspace, shotId: args.shot })
          return { shot: args.shot, qc: detail.qc, report: detail.report }
        }
        const pipeline = await service.pipeline({ workspaceId: args.workspace })
        const scenes = pipeline.scenes
          .filter(scene => args.scene === undefined || scene.id === args.scene)
          .map(scene => ({
            scene: scene.id,
            title: scene.title,
            verdict: scene.qc?.verdict,
            issues: scene.qc?.issues ?? [],
            reactionRate: scene.qc?.reactionRate,
            silenceRatio: scene.qc?.silenceRatio,
          }))
        return {
          scenes,
          counts: pipeline.counts,
          statusLabels: STATUS_LABELS,
          note: 'scene 层的判定来自 beat_qc（剧本表演层）；画面运动层与参考图层需要在镜详情里逐镜触发。',
        }
      },
    ),
    tool(
      'drama_desk_rules',
      '读规范：铁律 R1–R20 及其依据、适用阶段、创作宪法、数据契约与验收清单。规则真源在插件包的 spec/ 里，不在本文正文。',
      {
        stage: { type: 'string', description: '按阶段筛选（conceive/outline/characters/script/storyboard/generate/verify/assemble/deliver）。' },
      },
      async args => await service.rules({ stage: args.stage }),
    ),
    tool(
      'drama_desk_assets',
      '读资产索引：每个资产的状态（含 deprecated 与作废原因）、引用关系、存储占用。资产只增不删。',
      { workspace: workspaceProperty },
      async args => await service.assets({ workspaceId: args.workspace }),
    ),
    tool(
      'drama_desk_ledger',
      '读生成台账：每条任务的 submitting→submitted→running→succeeded 轨迹、费用、耗时、产物链接。这是幂等三步的可视化。',
      { workspace: workspaceProperty },
      async args => await service.ledger({ workspaceId: args.workspace }),
    ),
    tool(
      'drama_desk_stage',
      '读或推进流水线阶段：当前阶段、每个阶段的前置条件（来自数据契约）与缺口。给 stage 即推进/回退；前置条件不满足会被拒绝并列出缺口，回退总是允许。',
      {
        workspace: workspaceProperty,
        stage: { type: 'string', description: '目标阶段（conceive/outline/characters/script/storyboard/generate/verify/assemble/deliver）。省略则只读。' },
      },
      async args => {
        if (args.stage === undefined) return await service.stageState({ workspaceId: args.workspace })
        return await service.setStage({ workspaceId: args.workspace, stage: args.stage })
      },
    ),
    tool(
      'drama_desk_settings',
      '读插件设置：项目根、产物位置（及其解析理由）、规范模型适配、宿主当前模型；给 projectRoot/outputRoot/model 则写入设置。',
      {
        workspace: workspaceProperty,
        projectRoot: { type: 'string', description: '新项目根（作品所在目录）。' },
        outputRoot: { type: 'string', description: '新产物位置。' },
        model: { type: 'string', description: '规范分层里的模型适配 id。' },
      },
      async args => {
        if (args.projectRoot === undefined && args.outputRoot === undefined && args.model === undefined) {
          return await service.settings({ workspaceId: args.workspace })
        }
        return await service.updateSettings({
          projectRoot: args.projectRoot,
          outputRoot: args.outputRoot,
          model: args.model,
        })
      },
    ),
    tool(
      'drama_desk_edit_beat',
      '改一个 beat（表演层真源）：动作行 / 台词 / 语气 / delivery。改完立刻能重跑体检。',
      {
        workspace: workspaceProperty,
        scene: { type: 'string', description: '场次 id。', required: true },
        beat: { type: 'number', description: 'beat 序号（从 1 开始）。', required: true },
        patch: {
          type: 'object',
          description: '要替换的字段，例如 {"action":"…","delivery":"…"}。',
          required: true,
          additionalProperties: true,
        },
      },
      async args => await service.editBeat({
        workspaceId: args.workspace,
        sceneId: args.scene,
        beatIndex: args.beat,
        patch: args.patch,
      }),
    ),
    tool(
      'drama_desk_edit_shot',
      '改一个镜头的真源字段（机位 / 时长 / 光参数 / 运镜 / 参考图绑定）。派生字段（description_en、dialogue）不可改，会被编译覆盖。',
      {
        workspace: workspaceProperty,
        shot: { type: 'string', description: '镜头 id。', required: true },
        patch: {
          type: 'object',
          description: '要替换的字段，例如 {"camera":"Push In","duration":8}。',
          required: true,
          additionalProperties: true,
        },
      },
      async args => await service.editShot({
        workspaceId: args.workspace,
        shotId: args.shot,
        patch: args.patch,
      }),
    ),
    tool(
      'drama_desk_compile',
      '重新编译提示词产物（零成本，不花钱）。编译后返回哪些镜头的产物变了，以及哪些产物已过期。',
      {
        workspace: workspaceProperty,
        shot: { type: 'string', description: '只编译这一镜；省略则编译全片。' },
        check: { type: 'boolean', description: '只校验不写盘（报告哪些已过期）。' },
        dry: { type: 'boolean', description: '只预览差异不写盘。' },
      },
      async args => await service.compile({
        workspaceId: args.workspace,
        shotId: args.shot,
        check: args.check === true,
        dry: args.dry === true,
      }),
    ),
    tool(
      'drama_desk_check',
      '校验某个镜头的产物是否已过期（真源改了但产物没重编译）。',
      {
        workspace: workspaceProperty,
        shot: { type: 'string', description: '镜头 id。', required: true },
      },
      async args => await service.check({ workspaceId: args.workspace, shotId: args.shot }),
    ),
    tool(
      'drama_desk_annotate',
      '写导演对某一镜的批注（落在该镜的 notes 字段，是真源）。',
      {
        workspace: workspaceProperty,
        shot: { type: 'string', description: '镜头 id。', required: true },
        note: { type: 'string', description: '批注正文；空字符串表示清空。', required: true },
      },
      async args => await service.annotateShot({
        workspaceId: args.workspace,
        shotId: args.shot,
        note: args.note,
      }),
    ),
  ]

  const disposers = definitions.map(definition => ctx.tools.register(definition, { when }))
  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}
