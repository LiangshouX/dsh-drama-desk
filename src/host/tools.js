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
    tool('drama_desk_register_asset', '登记作品目录内已经存在的文件。实际计算哈希；视频音频用 ffprobe 实测。只追加资产，不发起生成，不自动切当前视频版本。', {
      workspace: workspaceProperty, id: { type: 'string', required: true }, type: { type: 'string', required: true },
      path: { type: 'string', required: true }, role: { type: 'string' }, shotId: { type: 'string' },
      version: { type: 'number' }, source: { type: 'string' },
    }, async args => await service.registerAsset({ ...args, workspaceId: args.workspace })),
    tool('drama_desk_edit', '编辑简报、场次、角色或资产的真源字段；与界面共用保存方法。', {
      workspace: workspaceProperty, kind: { type: 'string', enum: ['brief', 'scene', 'character', 'asset'], required: true },
      id: { type: 'string' }, patch: { type: 'object', additionalProperties: true }, text: { type: 'string' },
    }, async args => {
      const base = { workspaceId: args.workspace, patch: args.patch }
      if (args.kind === 'brief') return await service.editBrief({ ...base, text: args.text })
      if (args.kind === 'scene') return await service.editScene({ ...base, sceneId: args.id })
      if (args.kind === 'character') return await service.editCharacter({ ...base, characterId: args.id })
      if (args.kind === 'asset') return await service.editAsset({ ...base, assetId: args.id })
      throw new Error('未知编辑类型')
    }),
    tool('drama_desk_add', '新增场次、角色、道具或镜头。编号由 Host 连续分配；不删除历史记录、不写派生字段。后续字段修改用已有编辑工具。', {
      workspace: workspaceProperty, kind: { type: 'string', enum: ['scene', 'character', 'prop', 'shot'], required: true },
      sceneId: { type: 'string', description: '新增镜头时必填，已有场次 ID。' },
      id: { type: 'string', description: '角色或道具的稳定 ID；场次和镜头省略，自动编号。' },
      fields: { type: 'object', additionalProperties: true, description: '真源字段，不能包含派生字段、状态或当前版本。' },
    }, async args => await service.addRecord({ workspaceId: args.workspace, kind: args.kind, sceneId: args.sceneId, id: args.id, fields: args.fields })),
    tool('drama_desk_production', '读一个制作阶段的任务、技能、出口、缺口与实际载荷。只读，不发消息、不推进阶段。', {
      workspace: workspaceProperty, stage: { type: 'string', description: '九个制作阶段之一；省略用已提交阶段。' },
    }, async args => await service.productionTask({ workspaceId: args.workspace, stage: args.stage })),
    tool('drama_desk_assemble', '本地 FFmpeg 顺切粗剪，不发起付费生成。只有已验收且当前版本完整时可运行。返回任务；用 production 的 assemble 阶段查看进度。', {
      workspace: workspaceProperty, profile: { type: 'string', enum: ['landscape', 'portrait', 'square'] },
    }, async args => await service.assemble({ workspaceId: args.workspace, profile: args.profile })),
    tool('drama_desk_review', '读写本镜人工复核。填写意见不等于通过；只有导演明确确认通过后才设置 approve=true。', {
      workspace: workspaceProperty, shot: { type: 'string', required: true },
      patch: { type: 'object', additionalProperties: true }, approve: { type: 'boolean' },
    }, async args => args.approve === true
      ? await service.approveShot({ workspaceId: args.workspace, shotId: args.shot })
      : await service.editVerify({ workspaceId: args.workspace, shotId: args.shot, patch: args.patch })),
    tool('drama_desk_deliver', '导演回看认可后确认一条成片交付，拒绝文件缺失或源版本过期的成片。', {
      workspace: workspaceProperty, asset: { type: 'string', required: true },
    }, async args => await service.confirmDelivery({ workspaceId: args.workspace, assetId: args.asset })),
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
      '读生成台账：每条任务的 submitting→submitted→running→succeeded 轨迹、费用、耗时、产物链接，以及按模型 / 状态分组的开销。这是幂等三步的可视化。',
      { workspace: workspaceProperty },
      async args => await service.ledger({ workspaceId: args.workspace }),
    ),
    tool(
      'drama_desk_channels',
      '读可用的生成通道：宿主的连接器（生图 / 生视频）与插件自定义通道，以及「现在这条通道能不能用、为什么不能」。只读，不提交任何生成。',
      { refresh: { type: 'boolean', description: 'true = 重新探测（默认用 30 秒缓存）。' } },
      async args => await service.channels({ refresh: args.refresh === true }),
    ),
    tool(
      'drama_desk_generation_plan',
      '生成计划：逐镜给出「该提交 / 已在跑别重发 / 缺什么」、幂等判据（提示词 sha256）、预计费用与请求参数。只读，不发起付费生成；提交仍由 agent 走幂等三步。',
      {
        workspace: workspaceProperty,
        shots: { type: 'array', items: { type: 'string' }, description: '只算这些镜；省略 = 全片。' },
        limit: { type: 'number', description: '最多算几镜要提交（分批提交时用）。' },
      },
      async args => await service.generationPlan({
        workspaceId: args.workspace,
        shots: Array.isArray(args.shots) ? args.shots : undefined,
        limit: args.limit,
      }),
    ),
    tool(
      'drama_desk_generation_board',
      '生成进度与开销看板：逐场进度、在途任务、预算余量、剩余费用与时长预估、参考图数量。只读。',
      { workspace: workspaceProperty },
      async args => await service.generationBoard({ workspaceId: args.workspace }),
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
      '读插件设置：项目根、产物位置（及其解析理由）、规范模型适配、宿主当前模型、生图 / 生视频通道。给 projectRoot/outputRoot/model/imageChannel/videoChannel 等则写入设置。',
      {
        workspace: workspaceProperty,
        projectRoot: { type: 'string', description: '新项目根（作品所在目录）。' },
        outputRoot: { type: 'string', description: '新产物位置。' },
        model: { type: 'string', description: '规范分层里的模型适配 id。' },
        imageChannel: { type: 'string', description: "生图通道 id；'' 或 'inherit' = 继承宿主的连接器。" },
        imageModel: { type: 'string', description: '生图模型 id；空 = 用通道自己的默认。' },
        videoChannel: { type: 'string', description: "生视频通道 id；'' 或 'inherit' = 继承宿主的连接器。" },
        videoModel: { type: 'string', description: '生视频模型 id；空 = 用通道自己的默认。' },
      },
      async args => {
        const writes = ['projectRoot', 'outputRoot', 'model', 'imageChannel', 'imageModel', 'videoChannel', 'videoModel']
        if (!writes.some(key => args[key] !== undefined)) {
          return await service.settings({ workspaceId: args.workspace })
        }
        const patch = {}
        for (const key of writes) if (args[key] !== undefined) patch[key] = args[key]
        return await service.updateSettings(patch)
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
