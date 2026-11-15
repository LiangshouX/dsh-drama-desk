# AGENTS.md — dsh-drama-desk 开发规范

> 给在这个仓库里工作的 AI Agent 与人看的**操作纪律**。
> 产品定位见 `../PRD.md`；插件自己的架构说明见 `README.md`。

---

## 一句话

这个仓库是**开发对象**，不是运行中的东西。
**跑起来的东西是 `release/` 里的 tarball。**

---

## 1. 安装纪律（最容易出事的一条）

### 规则

> **永远不要把源码目录当安装目标。**
> 先打包，再安装 tarball。

```bash
node scripts/build.mjs      # 构建发布态：build/spec + build/skills + build/tools
node scripts/pack.mjs       # 打包 → release/dsh-drama-desk-<version>.tgz
```

然后用 `plugin_manager` 的 `install_bundle`，`target` 指向那个 `.tgz`：

```
target: D:\Code\Node\DSH-DRAMA-DESK-ROOT\dsh-drama-desk\release\dsh-drama-desk-0.1.0.tgz
```

### 为什么

把 `target` 指向源码目录（`.../dsh-drama-desk`）时，profile 里留下的是**指向仓库的软链**，
于是同时踩三个坑：

| 坑 | 后果 |
|---|---|
| 仓库里的一次误改**立刻**改变运行中的插件 | 分不清哪一份是发布物；线上行为不可复现 |
| 打包工具在仓库里落下 `node_modules/`、`pnpm-lock.yaml`、`__pycache__/` | **弄脏 git**，源码与安装产物混在一个目录 |
| 目录被移动/删除/切分支 | 运行中的插件直接断掉 |

`release/` 与 `build/` 都在 `.gitignore` 里 —— 它们是产物，不是源码。
仓库里只该有源码。

### 改了源码之后

```bash
node scripts/pack.mjs          # 重新打包
plugin_manager remove_bundle  dsh-drama-desk
plugin_manager install_bundle  <release/*.tgz>
```

然后**刷新 DSH 页面**（`unlag_refresh`）。注意：**Host 半边不会热重载**——
改 `src/host/**` 要等 DSH 重启才生效；只改 `client.js` 刷新就够。
细节见 §9。

---

## 2. 开发态 / 发布态分离（不可破）

```
src/       ← 开发对象（DSH 不可见）
  spec/      规范源码
  skills/    Skill 源码（开发中的 Skill 永远不被 agent 调到）
  tools/     体检器 + 编译器 + 驱动器
  host/      Host 半边源码
build/     ← 发布物（gitignore）
  spec/      规范随包分发
  skills/    通过校验的 Skill（bundledSkillDir 指向这里）
  tools/     体检器 + 编译器
release/   ← npm bundle tarball（gitignore）
```

- `bundledSkillDir` → **`build/skills`**，不是 `src/skills`。
- `src/skills` 不在 DSH 任何扫描根目录（`.dsh/skills` / `.agents/skills`）→ 双重隔离。
- `build/` 由 `scripts/build.mjs` 从 `src/` 生成，并跑**发布前校验**。
- 校验不过 → **非 0 退出，不产出**。不要跳过校验直接 `cp`。

> DSH 的 skill 发现深度只有一层：只认 `<root>/<name>/SKILL.md`。
> 布局必须是 `build/skills/<name>/SKILL.md`。

---

## 3. 规范只有一份

| 内容 | 真源 | 谁读它 |
|---|---|---|
| 铁律 R1–R20 | `src/spec/models/<model>/rules.md` | 插件**解析**它、Skill 引用它、agent 从它取 |
| 数据契约 / 宪法 / 验收清单 | `src/spec/core/` | 同上 |
| 体检阈值与词表 | `src/tools/*.py` | 插件**调用**体检器，不复述阈值 |

**推论（写代码时照着做）：**

- 插件里**不得**出现任何阈值数字（0.28 / 0.70 / 0.50 …）的副本。
  要显示阈值，就从体检器/规范里解析出来。
- 插件里**不得**复述规则正文。要显示规则正文，就解析 `build/spec/`。
- 插件里**不得**自己实现编译或体检。要跑，跑随包分发的脚本。
- 改一处即全局生效 —— 这是「规范只有一份」的全部意义。

---

## 4. 硬边界（违反就是设计错误）

| 边界 | 原因 |
|---|---|
| 插件**不发起付费生成** | 生成仍由 agent 走幂等三步（台账 → 提交 → 立刻回写） |
| 插件**不直接写派生字段** | `description_en` / `dialogue` 由编译生成，改了会被覆盖 → 界面只读 |
| 插件**不缓存业务状态** | 状态从磁盘派生；缓存由文件 mtime + size 失效 |
| **任何图片显示前 ≤1200px** | 大尺寸多脸拼图会被输入审核判为敏感并**永久卡死会话**（已发生 3 次）。见 `src/host/api.js` 的图片路由与 `src/tools/safe_image.py` |
| 派生字段在界面上只读 | 改派生字段会被编译静默覆盖 |
| 不建第二套规则 | 规则只有一处真源 |

**图片那条是组件级约束，不是文档备注。** 任何新增的图片显示点都必须走
`/drama-desk/image` 路由（或等价的受控组件），不允许直接塞 URL。

---

## 5. 一个操作，两个调用者

界面的每个动作与 agent 的每个工具**必须调用同一个 Host service 方法**。
禁止在 UI 路径和 tool 路径里各写一遍逻辑。

| 操作 | 界面 | agent tool | Host 方法 |
|---|---|---|---|
| 读流水线 | 网格 | `drama_desk_status` | `service.pipeline()` |
| 读镜详情 | 镜详情 | `drama_desk_shot` | `service.shot()` |
| 读体检 | 判定区 | `drama_desk_qc` | `service.shot()` / `service.pipeline()` |
| 读规则与依据 | 规范视图 | `drama_desk_rules` | `service.rules()` |
| 读资产 | 资产视图 | `drama_desk_assets` | `service.assets()` |
| 读台账 | 台账页 | `drama_desk_ledger` | `service.ledger()` |
| 改表演 | beats 编辑器 | `drama_desk_edit_beat` | `service.editBeat()` |
| 改镜头 | 镜头字段 | `drama_desk_edit_shot` | `service.editShot()` |
| 重新编译 | 按钮 | `drama_desk_compile` | `service.compile()` |
| 校验过期 | 角标 | `drama_desk_check` | `service.check()` |

HTTP 路由（`src/host/api.js`）只是**传输层**：它调用上面那些方法，不含业务逻辑。

---

## 6. 目录约定

```
dsh-drama-desk/
├── package.json              插件包清单
├── cordis.patch.yml          Host patch（一条 row；config 由用户的 patch 层覆盖）
├── index.js                  Host 半边
├── client.js                 Client 半边（浏览器 bundle，无构建步骤）
├── icon.svg                  插件图标
├── locale/{en,zh}.json       Plugin Manager 元信息（meta.title / meta.description）
├── docs/DETAIL.md            插件详情页
├── scripts/
│   ├── build.mjs             构建 + 发布前校验
│   └── pack.mjs              打包 npm bundle → release/
├── src/
│   ├── spec/                 规范源码（core/ + models/<id>/）
│   ├── skills/<name>/SKILL.md
│   ├── tools/                体检器 + 编译器 + 驱动器（纯 stdlib 优先）
│   ├── host/                 Host service / HTTP 路由 / agent tools
│   └── client/               （预留：将来放需要构建的 Client 源码）
└── build/  release/          构建产物与发布物（都不入库）
```

---

## 7. 提交前自检

```bash
node scripts/build.mjs            # 必须通过（非 0 退出 = 不许提交）
node scripts/build.mjs --check    # 校验 build/ 是否与 src/ 同步
git status --short                # 不该出现 build/ release/ node_modules/ __pycache__/
```

`scripts/build.mjs` 会检查：

| 检查 | 拦什么 |
|---|---|
| Skill frontmatter | name 不是 kebab-case、description 缺失 |
| 包内路径引用 | Skill 正文里引用了不存在的 `spec/` / `tools/` 路径 |
| 废弃路径残留 | `.drama/`、`docs/数据契约.md` 这类旧路径 |
| 具体作品名 | 把某一个作品当通用规则写进来 |
| 插件半边完整性 | manifest 字段、`cordis.patch.yml`、`locale/*.json`、`icon.svg`、client 入口形态 |
| **语法** | 每个 JS 文件 `node --check` 不过 |
| **运行时** | Host 半边 import 之后调 `overview()` / `rules()` / `pipeline()`，形状不对或运行时报错 |

> 最后两条是**血的教训**：曾经一次编辑把两行 `import` 粘成了一行，
> 一次把 `dirname` 从 import 里删掉了。`node --check` 只查语法，查不出后者；
> 两者在插件里都表现为「界面读不到数据」——用户看到的是空白，不是报错。
> 所以**构建必须真的跑一遍**。

---

## 8. 作品数据不在这个仓库

`reference/` 是**参照物**（一个真实作品的全量样例），不在插件仓库里。
插件只管「读作品目录」与「写真源字段」，不拥有任何作品。

**别把作品名写进插件源码或规范** —— `build.mjs` 会拦（`WORK_NAMES` 名单）。

---

## 9. 改完代码之后

```bash
node scripts/pack.mjs                          # 重新打包
plugin_manager remove_bundle  dsh-drama-desk   # 旧版本必须先移除
plugin_manager install_bundle  <release/*.tgz> # 装新的 tarball
unlag_refresh                                  # 刷新页面（客户端半边）
```

**Host 半边不会热重载。** `unlag_refresh` 只换客户端代码；
Host 的 ES 模块要等 DSH 重启才会是新的模块代。所以：

- 改了 `src/host/**` → 界面上的 Host 行为要等 DSH 重启才变；
- 只改了 `client.js` → 刷新页面就够；
- 改配置（`cordis.patch.yml`）→ 插件会重启，**配置立刻生效**（模块代码不变）。

> 实在需要重启 DSH 时，先确认 `cordis.patch.yml` 已保存、仓库已提交。
> 会话是持久化的（`session-persistence-jsonl`），重启后可以恢复。

