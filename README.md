# dsh-drama-desk

> **AI 短剧生产流水线的方法论，以及它的两个前端。**
>
> - `skills/` —— **给 agent 读**：每阶段"该做什么"
> - 插件（Client UI）—— **给人读**：现在是什么状态、能决定什么
> - `spec/` 与 `tools/` —— 两者共用的规范真源与可执行形式

包名 `dsh-drama-desk`。产品需求见 `../PRD.md`。**开发纪律见 `AGENTS.md`。**

---

## 这个仓库是什么

不是"一个更好的出图器"，也不是"生成器的 UI 包装"。

2026-10 至 11 的实测结论：**在提示词工程与画风锚定上的投入，天花板比预想低得多。**
所以这个仓库的价值不在"让模型生成得更好"，而在**让规范变得可见、可改、可取舍**。

生成仍由 agent 调 CLI / Connector 完成，并走幂等三步（台账 → 提交 → 立刻回写）。
本仓库不发起付费生成。

**入口**：DSH 左侧栏的插件区（与「自媒体工作台」同级），点开是一整块工作台。

---

## 目录

```
dsh-drama-desk/
├── package.json              插件包清单
├── cordis.patch.yml          Host patch（含 config）
├── index.js                  Host 半边（service + HTTP 路由 + agent 工具）
├── client.js                 Client 半边（浏览器 bundle，无构建步骤）
├── icon.svg  locale/  docs/  显示元信息
├── AGENTS.md                 ★ 开发纪律（安装方式、硬边界、检查清单）
├── scripts/
│   ├── build.mjs             构建 + 发布前校验（语法 + 运行时冒烟）
│   └── pack.mjs              打包 npm bundle → release/
│
├── src/                      ← 开发对象（DSH 不可见）
│   ├── spec/
│   │   ├── core/             模型无关：契约·宪法·表演纪律·模板·依据·验收清单
│   │   └── models/<id>/      模型专属：规则·提示词写法·体检项·接口 quirks
│   ├── skills/<name>/SKILL.md   Skill 源码（薄）
│   ├── tools/                体检器 + 编译器 + 驱动器
│   ├── host/                 Host service / HTTP 路由 / agent 工具
│   └── client/               （预留：将来放需要构建的 Client 源码）
│
└── build/  release/          发布物（gitignore）
    ├── skills/               通过校验的 Skill（bundledSkillDir 指向这里）
    ├── spec/                 规范随包分发
    └── tools/                体检器与编译器
```

**作品数据不在这个仓库。** 那是"用这套方法论做的一个作品"。

---

## 三条关键机制

### ① 开发态 / 发布态分离

Skill 是**被开发的对象**，不是被调用的产品。开发到一半的 Skill 被 agent 调到，
是这类仓库最典型的翻车方式。

- `bundledSkillDir` → **`build/skills`**，不是 `src/skills`
- `src/skills` 不在 DSH 任何扫描根目录（`.dsh/skills` / `.agents/skills`）→ 双重隔离
- `build/` 由 `scripts/build.mjs` 从 `src/` 生成，并跑**发布前校验**：
  frontmatter 合法、包内路径引用可达、无废弃路径残留、无具体作品名、
  **每个 JS 文件语法可解析**、**Host 半边能真的 import 并跑一遍**

```bash
node scripts/build.mjs           # 构建 + 校验
node scripts/pack.mjs            # 构建 + 打包 → release/*.tgz
node scripts/build.mjs --check   # 校验 build/ 是否与 src/ 同步
```

> ⚠️ DSH 的 skill 发现深度只有一层：只认 `<root>/<name>/SKILL.md`。
> **忽略嵌套的 `**/SKILL.md`**。所以布局必须是 `build/skills/<name>/SKILL.md`。

### ② 一个操作，两个调用者

界面的每个动作和 agent 的每个工具**调同一个 Host service 方法**：

| 操作 | 界面 | agent tool |
|---|---|---|
| 读流水线 | 网格 | `drama_desk_status` |
| 读镜详情 | 镜详情 | `drama_desk_shot` |
| 读体检 | 判定区 | `drama_desk_qc` |
| 读规则与依据 | 规范视图 | `drama_desk_rules` |
| 读资产 | 资产视图 | `drama_desk_assets` |
| 读台账 | 台账页 | `drama_desk_ledger` |
| 改表演（beats） | beats 编辑器 | `drama_desk_edit_beat` |
| 改镜头参数 | 镜头字段 | `drama_desk_edit_shot` |
| 重新编译 | 按钮 | `drama_desk_compile` |
| 校验产物是否过期 | 角标 | `drama_desk_check` |

否则人和 agent 对"合不合格"的判断会分叉——插件就成了新的信息分裂源。

### ③ 规范只有一份

```
spec/core/        模型无关：数据契约·宪法·表演纪律·模板·依据·验收清单
spec/models/<id>/ 模型专属：规则·提示词写法·体检器·端点
```

插件**解析** `build/spec/` 得到规则、依据、适用阶段；**不复述**任何一个阈值。
Skill 正文只写"去哪拿"。改一处即全局生效。

---

## 路径解析（为什么不能硬编码 `C:\Users\<你>\Videos`）

用户会把「视频」目录搬到别的盘——Windows 的资源管理器支持「位置」重定向，
搬过之后默认路径根本不存在，产物会**悄悄落回系统盘**。

所以插件按**系统自己的答案**来：

1. 显式配置（`cordis.patch.yml` 的 `outputRoot`）——永远最优先；
2. **Windows 已知文件夹** `FOLDERID_Videos`（跟随「位置」重定向）；
3. 镜像被搬走的「文档」库：`<文档所在目录>\Videos`；
4. `%USERPROFILE%\Videos`——最后的朴素默认。

项目根同理（会话工作目录 → 产物旁边的目录 → DSH 默认目录）。
界面「项目」页写清**当前解析到哪个路径、为什么是它**，并在路径落在系统盘时**明说**——
成片很占地方，系统盘会被不知不觉撑爆。

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
   实现见 `src/host/api.js` 的图片路由与 `src/tools/safe_image.py`。

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
- **开发纪律**：`AGENTS.md` —— 安装方式、硬边界、提交前检查清单
- **数据契约**：`src/spec/core/数据契约.md`
- **铁律**：`src/spec/models/minimax/rules.md`
- **DSH 插件开发**：`dsh-doc` 技能的 `references/plugin-development.md` 与 `references/ui-plugin.md`
