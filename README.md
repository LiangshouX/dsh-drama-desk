# dsh-drama-desk

> **AI 短剧生产流水线的方法论，以及它的两个前端。**
>
> - `skills/` —— **给 agent 读**：每阶段"该做什么"
> - 插件（Client UI）—— **给人读**：现在是什么状态、能决定什么
> - `spec/` 与 `tools/` —— 两者共用的规范真源与可执行形式

包名 `dsh-drama-desk`。产品需求见 `../PRD.md`。

---

## 这个仓库是什么

不是"一个更好的出图器"，也不是"生成器的 UI 包装"。

2026-10 至 11 的实测结论：**在提示词工程与画风锚定上的投入，天花板比预想低得多。**
所以这个仓库的价值不在"让模型生成得更好"，而在**让规范变得可见、可改、可取舍**。

生成仍由 agent 调 CLI / Connector 完成，并走幂等三步（台账 → 提交 → 立刻回写）。
本仓库不发起付费生成。

---

## 目录

```
dsh-drama-desk/
├── package.json              插件包清单
├── cordis.patch.yml          Host patch（含 bundledSkillDir 配置）
├── scripts/build.mjs         ★ 构建 + 发布前校验
│
├── src/                      ← 开发对象（DSH 不可见）
│   ├── spec/
│   │   ├── core/             模型无关：契约·宪法·表演纪律·模板·依据·验收清单
│   │   └── models/<id>/      模型专属：规则·提示词写法·体检项·接口 quirks
│   ├── skills/<name>/SKILL.md   Skill 源码（薄）
│   ├── tools/                规范的可执行形式（体检器 + 编译器）
│   ├── host/                 Host service
│   └── client/               Client UI
│
└── build/                    ← 发布物（gitignore）
    ├── skills/               通过校验的 Skill（bundledSkillDir 指向这里）
    └── spec/                 规范随包分发
```

**作品数据不在这个仓库。** 那是"用这套方法论做的一个作品"。

---

## 三条关键机制

### ① 开发态 / 发布态分离

Skill 是**被开发的对象**，不是被调用的产品。开发到一半的 Skill 被 agent 调到，
是这类仓库最典型的翻车方式。

- `bundledSkillDir` → **`build/skills`**，不是 `src/skills`
- `src/skills` 不在 DSH 任何扫描根目录（`.dsh/skills` / `.agents/skills`）→ 双重隔离
- `build/` 由 `scripts/build.mjs` 生成，并跑**发布前校验**：
  frontmatter 合法、包内路径引用可达、无废弃路径残留、无具体作品名

```bash
node scripts/build.mjs           # 构建
node scripts/build.mjs --check   # 校验 build/ 是否与 src/ 同步
```

> ⚠️ DSH 的 skill 发现深度只有一层：只认 `<root>/<name>/SKILL.md`，
> **忽略嵌套的 `**/SKILL.md`**。所以布局必须是 `build/skills/<name>/SKILL.md`。

### ② spec 分层 + 逻辑路径

```
spec/core/        模型无关：数据契约·宪法·表演纪律·模板·依据·验收清单
spec/models/<id>/ 模型专属：规则·提示词写法·体检项·接口 quirks
```

Skill 正文里写**稳定的逻辑路径**，实际解析随当前模型而变——**换模型时 Skill 正文一个字都不用改**：

| 逻辑路径 | 解析到 |
|---|---|
| `spec/rules.md` | `spec/models/<当前模型>/rules.md` |
| `spec/references/*` | `spec/core/references/*` |
| `spec/templates/*` | `spec/core/templates/*` |
| `spec/数据契约.md` | `spec/core/数据契约.md` |

**规则按「阶段 × 模型」双维筛选**——同一阶段在不同模型下生效的规则可以不同。

### ③ Skill 要薄

Skill 正文**不复述规则**，只声明"去哪拿"。规则改一处即全局生效；
agent 走渐进披露（要什么取什么）。

---

## 模型配置

| 层 | 内容 |
|---|---|
| **继承宿主（推荐）** | 优先读取 DSH 已配置的模型与凭据，用户零配置 |
| **自定义添加** | 在插件设置里添加其他供应商的模型适配 |

**阶段**：v0.1–v0.2 只做一套并跑通；**等第二个模型接入时再抽适配层接口**
（只为一个模型设计抽象层，往往会设计错）。

---

## 两条不能破的纪律

1. **幂等三步**：台账 → 提交 → 立刻回写。模型接口无幂等键，重复提交 = 重复扣费。
   任何"重出"都必须走这条路，不能只做一层 UI 防护。

2. **图片 ≤1200px 才能进上下文**：大尺寸多脸拼图会被输入审核判为敏感并**永久卡死会话**
   （每轮重放历史、每轮被拒、重试无用）。已因此报废 3 个会话。
   **插件的每个图片显示点都是潜在的事故点** —— 写成组件级强制约束，不是文档备注。

---

## 配套工作区

`DSH-DRAMA-DESK-ROOT/`（本仓库的上一级）：

| 目录 | 内容 |
|---|---|
| `dsh-drama-desk/` | ★ 本仓库 |
| `reference/` | 开发参照物（真实样例与全量清单），**不入库** |
| `PRD.md` | 产品需求文档 |

---

## 相关文档

- **PRD**：`../PRD.md` —— 定位、旅程、界面设计规范、技术架构、路线图
- **数据契约**：`src/spec/core/数据契约.md`
- **铁律**：`src/spec/models/minimax/rules.md`
- **DSH 插件开发**：`dsh-doc` 技能的 `references/plugin-development.md` 与 `references/ui-plugin.md`
