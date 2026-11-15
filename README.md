# dsh-drama-desk

> **AI 短剧生产流水线的方法论，以及它的两个前端。**
>
> - `skills/` —— **给 agent 读**：每阶段"该做什么"
> - 插件（Client UI）—— **给人读**：现在是什么状态、能决定什么
> - `spec/` 与 `tools/` —— 两者共用的规范真源与可执行形式

仓库名 `dsh-drama-desk`（导演台）；包名 `dsh-drama-desk`。

---

## 这个仓库是什么

不是"一个更好的出图器"，也不是"生成器的 UI 包装"。

2026-10 至 11 的实测结论是：**在提示词工程与画风锚定上的投入，天花板比预想低得多。**
所以这个仓库的价值不在"让模型生成得更好"，而在**让规范变得可见、可改、可取舍**。

生成仍然由 agent 调 CLI / Connector 完成，并走幂等三步（台账 → 提交 → 立刻回写）。
本仓库不发起付费生成。

---

## 目录

```
dsh-drama-desk/
├── package.json            插件包清单（待写）
├── cordis.patch.yml        Host 侧 patch（待写）
├── index.js                Host service（待写）
├── client.js               Client UI（待写）
├── locale/  docs/DETAIL.md  icon.svg
│
├── skills/                 ★ Skill 形态
│   ├── drama-conceive/  drama-outline/  drama-characters/
│   ├── drama-script/    drama-storyboard/  drama-generate/
│   ├── minimax-drama/    （verify / assemble / deliver 三阶段）
│   └── imagecraft/       生图方法论（锚点纪律 / 影调光位 / 探针验证）
│
├── spec/                   ★ 规范唯一真源（Skill 与插件共用）
│   ├── rules.md            R1–R20 铁律
│   ├── constitution.md     创作宪法（项目级；作品级可覆盖）
│   ├── 数据契约.md          命名规范 / 资产索引 / 状态机 / 幂等规则
│   ├── 验收清单.md
│   ├── templates/          4 个阶段模板
│   └── references/         规则依据、失败模式、官方规范
│
└── tools/                  ★ 规范的可执行形式
    ├── motion_qc.py        画面运动体检器
    ├── beat_qc.py          剧本表演体检器
    ├── image_qc.py         参考图质量体检器
    └── compile_prompts.py  真源 → 提示词产物（--dry / --check）
```

**作品数据不在这个仓库。** 那是"用这套方法论做的一个作品"：
见 `QwenVideo4T/workspaces/<work-id>/`。

---

## Skill 如何被 DSH 加载

DSH 的 skill 提供方（`@deepseek-ai/dsh-skill-filesystem`）有一个 `bundledSkillDir` 字段：
**配置后按 rank 600 扫描"随包提供的" skill 根目录** —— 装插件即得 Skill，无需另装。

在 `cordis.patch.yml` 里配置（字段属于 `@deepseek-ai/dsh-skill-filesystem`）：

```yaml
- name: '@deepseek-ai/dsh-skill'
- name: '@deepseek-ai/dsh-skill-filesystem'
  providerName: filesystem
  bundledSkillDir: <插件包内 skills/ 的绝对路径>
```

> ⚠️ **发现深度只有一层**：只识别 `<root>/<name>/SKILL.md` 与 `<root>/<name>.md`，
> **忽略嵌套的 `**/SKILL.md`**。所以布局必须是 `skills/<name>/SKILL.md`，
> 不能是 `skills/drama/<name>/SKILL.md`。
>
> 完整根目录优先级见该包的 README（`custom` rank 300 也可以指向仓库的 skills/）。

---

## 两条不能破的纪律

1. **幂等三步**：台账 → 提交 → 立刻回写。模型接口无幂等键，重复提交 = 重复扣费。
   任何"重出"都必须走这条路，不能只做一层 UI 防护。

2. **图片 ≤1200px 才能进上下文**：大尺寸多脸拼图会被输入审核判为敏感并**永久卡死会话**
   （每轮重放历史、每轮被拒、重试无用）。已因此报废 3 个会话。
   **插件的每个图片显示点都是潜在的事故点** —— 这条要写成组件级强制约束，不是文档备注。

---

## 配套工作区

`DSH-DRAMA-DESK-ROOT/`（本仓库的上一级）是开发工作区：

| 目录 | 内容 |
|---|---|
| `dsh-drama-desk/` | ★ 本仓库（插件代码 + Skill + 规范） |
| `reference/` | 从 QwenVideo4T 搬来的**只读参照物**：作品样例（12 场 / 45 镜 / 132 资产 / 45 条成品提示词）与全量清单 `MANIFEST.json` |
| `PRD.md` | 产品需求文档（信息架构、真源分层、待探索问题） |

`reference/` 不进 git——它是开发对照材料，不是发布物。

---

## 相关文档

- **PRD**：`../PRD.md` —— 目标、信息架构、真源分层、待共同探索的问题
- **数据契约**：`spec/数据契约.md` —— 命名规范 / 资产索引 / 状态机 / 幂等规则
- **铁律**：`spec/rules.md` —— R1–R20
- **DSH 插件开发**：`dsh-doc` 技能的 `references/plugin-development.md` 与 `references/ui-plugin.md`
