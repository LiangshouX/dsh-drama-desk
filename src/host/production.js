/** Stage handoffs are facts plus a draft instruction; never an automatic model call. */
import { checkPrerequisite } from './stages.js'

export const PRODUCTION_STAGES = {
  conceive: { label: '创意', skill: 'drama-conceive', output: 'creative/brief.md', task: '一起明确故事的核心冲突、人物欲望、观众与片长，再写创意简报。' },
  outline: { label: '大纲', skill: 'drama-outline', output: 'scenes.json', task: '依据简报设计场次骨架，让每一场推动冲突或改变人物处境。' },
  characters: { label: '角色', skill: 'drama-characters', output: 'characters.json、已登记的角色参考图', task: '沿用场次中的角色 ID，完善角色卡、状态与参考图方案。' },
  script: { label: '剧本', skill: 'drama-script', output: 'scenes.json 的 beats[]', task: '逐场完成可表演的动作、台词、反应与语气，并检查表演层。' },
  storyboard: { label: '分镜', skill: 'drama-storyboard', output: 'shots.json', task: '将 beats 拆为连续镜头，补齐时长、机位、画幅、光与参考图绑定。' },
  generate: { label: '生成', skill: 'drama-generate', output: '视频资产、提示词、ledger.json', task: '先用 drama_desk_generation_plan 拿到逐镜动作与预计费用（它按提示词指纹排除了重复提交），再核对提示词过期与参考图；把「要提交哪些镜、预计花多少」报给导演，得到明确授权后才走台账→提交→立刻回写。' },
  verify: { label: '验收', skill: 'drama-verify', output: 'verify/<shot-id>.report.json', task: '逐镜检查当前版本，记录技术与内容问题；辅助导演复核，不代替人作人工通过决定。' },
  assemble: { label: '装配', skill: 'drama-assemble', output: 'assembly/<任务>/job.json、finals/<任务>.mp4', task: '检查已验收镜头的当前版本与音轨，说明装配缺口；用本地装配工具输出顺切粗剪。' },
  deliver: { label: '交付', skill: 'drama-deliver', output: 'assets.json 的成片资产、state.json 的交付记录', task: '核对成片文件、源镜头版本、时长、画幅与声音，列出待复核项；导演回看认可后再确认交付。' },
}

export function productionTaskFor(workspace, work, stage) {
  const meta = PRODUCTION_STAGES[stage]
  if (!meta) throw new Error(`未知阶段 ${stage}`)
  const gaps = checkPrerequisite(stage, work).gaps
  return {
    stage, ...meta, gaps,
    prompt: [
      `请继续「${workspace.title || workspace.id}」的${meta.label}阶段，作品目录 ID：${workspace.id}。`,
      `使用 ${meta.skill} 技能。${meta.task}`,
      `先用 drama_desk_production(workspace="${workspace.id}", stage="${stage}") 读取当前状态与缺口，再读本阶段规范和作品文件。`,
      `本阶段出口：${meta.output}。`,
      gaps.length ? `已知前置缺口：\n${gaps.map(g => '- ' + g).join('\n')}` : '当前阶段前置条件已满足。',
      '只操作当前作品目录。若技能提到的 CLI 不存在，使用已注册的 drama_desk_* 工具；缺能力时如实报告，不猜命令，不新造状态文件。',
      '先复用已有产物，保留历史版本。付费生成必须先取得导演明确授权，并走台账→提交→立刻回写。',
    ].join('\n\n'),
  }
}
