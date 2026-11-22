# AGENTS.md — dsh-drama-desk 开发规范

> 给在这个仓库里工作的 AI Agent 与人看的**操作纪律**：只放「不照做就会出事」的规矩。
> 来龙去脉、实测数据、症状复盘都在 `docs/dev/`（见 §15 文档地图），**不要把它们搬回来**。

---

## 0. 一句话

这个仓库是**开发对象**，不是运行中的东西。
**跑起来的东西是 `release/` 里的 tarball。**

---

## 1. 安装纪律（最容易出事的一条）

> **永远不要把源码目录当安装目标。先打包，再安装 tarball。**

```bash
node scripts/build.mjs      # 构建发布态：build/spec + build/skills + build/tools
node scripts/pack.mjs       # 打包 → release/dsh-drama-desk-<version>.tgz
```

然后用 `plugin_manager` 的 `install_bundle`，`target` 指向刚打出来的 `.tgz`：

```
target: <仓库绝对路径>/release/dsh-drama-desk-<version>.tgz
```

把 `target` 指向源码目录时，profile 里留下的是**指向仓库的软链**，于是一次踩三个坑：

| 坑 | 后果 |
|---|---|
| 仓库里的一次误改**立刻**改变运行中的插件 | 分不清哪一份是发布物；线上行为不可复现 |
| 打包工具在仓库里落下 `node_modules/`、`pnpm-lock.yaml`、`__pycache__/` | 弄脏 git，源码与安装产物混在一起 |
| 目录被移动 / 删除 / 切分支 | 运行中的插件直接断掉 |

`release/` 与 `build/` 都在 `.gitignore` 里——它们是产物，不是源码。

---

## 2. 开发态 / 发布态分离（不可破）

| 目录 | 是什么 | 入库 |
|---|---|---|
| `src/` | **开发对象**（DSH 不可见）：`spec/` 规范源码、`skills/` Skill 源码、`tools/` 体检器与编译器、`host/`、`client/` | 是 |
| `build/` | **发布物**：`spec/` + `skills/` + `tools/`，`bundledSkillDir` 指向 `build/skills` | 否（gitignore） |
| `release/` | npm bundle tarball | 否（gitignore） |

- `bundledSkillDir` → **`build/skills`**，不是 `src/skills`。
- `src/skills` 不在 DSH 任何扫描根目录（`.dsh/skills` / `.agents/skills`）→ 双重隔离。
- `build/` 由 `scripts/build.mjs` 从 `src/` 生成，并跑**发布前校验**；
  校验不过 → **非 0 退出，不产出**。不要跳过校验直接 `cp`。
- DSH 的 skill 发现深度只有一层：只认 `<root>/<name>/SKILL.md`。

---

## 3. 规范只有一份

| 内容 | 真源 | 谁读它 |
|---|---|---|
| 铁律 R1–R20 | `src/spec/models/<model>/rules.md` | 插件**解析**它、Skill 引用它、agent 从它取 |
| 数据契约 / 宪法 / 验收清单 | `src/spec/core/` | 同上 |
| 体检阈值与词表 | `src/tools/*.py` | 插件**调用**体检器，不复述阈值 |

**推论（写代码时照着做）：**

- 插件里**不得**出现任何阈值数字（0.28 / 0.70 / 0.50 …）的副本。
- 插件里**不得**复述规则正文。要显示就解析 `build/spec/`（或调体检器）。
- 插件里**不得**自己实现编译或体检。要跑，跑随包分发的脚本。
- 改一处即全局生效——这是「规范只有一份」的全部意义。

---

## 4. 硬边界（违反就是设计错误）

| 边界 | 原因 |
|---|---|
| 插件**不发起付费生成** | 生成仍由 agent 走幂等三步（台账 → 提交 → 立刻回写） |
| 插件**不直接写派生字段** | `description_en` / `dialogue` 由编译生成，改了会被静默覆盖 → 界面只读 |
| 插件**不缓存业务状态** | 状态从磁盘派生；缓存由文件 mtime + size 失效 |
| **不建第二套规则** | 规则只有一处真源 |
| **任何图片显示前 ≤1200px** | 大尺寸多脸拼图会被输入审核判为敏感并**永久卡死会话**。见 `src/host/api.js` 的图片路由与 `src/tools/safe_image.py` |

**图片那条是组件级约束，不是文档备注。** 任何新增的图片显示点都必须走
`/drama-desk/image` 路由（或等价的受控组件），不允许直接塞 URL。

---

## 5. 一个操作，两个调用者

界面的每个动作与 agent 的每个工具**必须调用同一个 Host service 方法**。
禁止在 UI 路径和 tool 路径里各写一遍逻辑。

新增一个操作的正确顺序：**先在 service 上写方法 → 再挂界面 → 再挂 agent tool**。

`src/host/api.js` 的 HTTP 路由只是**传输层**：它调用那些方法，不含业务逻辑。
完整对照表（界面 / tool / service 三列）见 `docs/dev/architecture.md` §4。

---

## 6. 目录与源码布局

```
docs/{PRD,API,DETAIL}.md   产品 / 接口契约 / 详情页
docs/dev/*.md              开发参考（架构、渲染、性能、界面、宿主集成、Windows）
scripts/                   构建、打包、探针、截图、演示作品
src/{spec,skills,tools,host,client}/
tests/equivalence.mjs      等价性回归
client.js                  Client 半边——**生成物**，别手改
```

目录树全量、每个文件的职责、Client 模块怎么拼，见 `docs/dev/architecture.md`。

**改 `src/client/` 时的四条纪律（拼装器会拦）：**

1. 顺序由 `manifest.json` **显式声明**，不靠目录遍历的运气。
2. 分段里不许出现 `window.__ModuleLoader__` 或第二次 `require('react')`。
3. 分段里不许出现 `import` / `export`——它们是拼进**同一个函数作用域**的片段，
   跨模块只能靠顶格的全局名字互相调用。
4. **所有分段的顶层名字必须全局唯一**——同名就是覆盖，覆盖会变成静默 bug。
   闸门在 `build-client.mjs` 的 `declaredNames()`，它按**0–4 格缩进**认顶层声明
   （分段整体缩进 4 格；以前那个正则只认顶格，于是对客户端分段一个名字都扫不到，
   闸门等于不存在）。

**样式跟着组件走**：每块样式用 `CSS_PARTS.push()` 推给总表，实现与样式同文件。
`client.js` 是产物：改 `src/client/` → `node scripts/build-client.mjs`。

> **CSS 写在模板字符串里，注释里不许出现反引号。** 一个反引号就提前结束模板，
> 后面的 CSS 会被当成 JS：报错是 `SyntaxError: Unexpected identifier 'repeat'`
> 这种**指向 CSS 片段**的怪话，而真正的原因在几十行之前。这一条踩过三次，
> 代价是三次「构建失败 → 回头找反引号」。写 CSS 注释要引用标识符时用「」。

---

## 7. 作品数据不在这个仓库

插件**不拥有任何作品**：它只负责「读作品目录」与「写真源字段」。作品住在运行时的总根
（`<「视频」目录>/DSH-DRAMA-DESK/workspaces/<work-id>/`）下，**不在这个仓库里**。

- **别把作品名写进插件源码或规范**——`build.mjs` 会拦（`WORK_NAMES` 名单）。
  文档里举例子一律用 `<work-id>` 占位。
- **一个工作台只有一个总根**，不要给每个项目开一个 DSH 工作区。理由与细节见
  `docs/dev/dsh-integration.md` D5。
- **草稿作品也是真作品**：`work.json` 带 `draft: true`，名字与目录 id 都是暂定的
  （「未命名作品」/ `draft-<时间戳>`）。**立项 = 改目录名 + 改 `work_id`/`title`**，
  不是「另建一个再搬内容」——会话的 cwd 是总根、资产的 `path` 相对作品目录，
  两样都不受影响，所以改名**不换对话**。

---

## 8. 改完代码之后

```bash
node scripts/build-client.mjs                  # 只在改了 src/client/ 时需要（先拼）
node scripts/build.mjs                         # 构建 + 全部校验（内部会先拼再校验）
node scripts/pack.mjs                          # 重新打包
plugin_manager remove_bundle  dsh-drama-desk   # 旧版本必须先移除
plugin_manager install_bundle  <release/*.tgz> # 装新的 tarball
unlag_refresh                                  # 刷新页面（客户端半边）
```

**Host 半边不会热重载。** `unlag_refresh` 只换客户端代码；Host 的 ES 模块要等 DSH 重启
才会是新的模块代。所以：改了 `src/host/**` → 要等 DSH 重启；只改了 `client.js` → 刷新
就够；改配置（`cordis.patch.yml`）→ 插件会重启，配置立刻生效（模块代码不变）。

> 要重启 DSH 时，先确认 `cordis.patch.yml` 已保存、仓库已提交。
> 会话是持久化的（`session-persistence-jsonl`），重启后可以恢复。

**构建顺序不可反**：`client.js` 是生成物，校验它**必须在拼装之后**（`build.mjs` 内部
已经这么做了；手工分步跑时要先 `build-client.mjs`）。

---

## 9. 提交前自检

```bash
node scripts/build.mjs            # 必须通过（非 0 退出 = 不许提交）
node scripts/build.mjs --check    # 校验 build/ 与 src/ 同步
git status --short                # 不该出现 build/ release/ node_modules/ __pycache__/
```

`scripts/build.mjs` 会真的跑，不只是看语法：

- **Skill frontmatter**（kebab-case、description）与**包内路径引用**是否可达；
- **废弃路径残留**（`.drama/`、`docs/数据契约.md`）与**具体作品名**；
- **插件半边完整性**（manifest / `cordis.patch.yml` / `locale/*.json` / `icon.svg` / client 入口形态）；
- **随包工具自成一体**（缺 `compile_prompts.py` / `slim_prompt.py` / `lighting.py` /
  `desk_qc.py` 就不许发布——界面的「重新编译」会直接报错）；
- **语法**（每个 JS 文件 `node --check`）；
- **运行时冒烟**（import Host 半边，真的调 `overview()` / `rules()` / `pipeline()` /
  九个 `stageView()`）；
- **客户端 hook 顺序**（组件在最后一个 hook **之前**早退 ⇒ React #310 ⇒ 整个面板空白）；
- **等价性回归**（优化过的答案必须与优化前逐字节相同）。

> 语法通过不等于能跑：`node --check` 查不出「import 了但名字拼错」，而这类错误在插件里
> 表现为「界面读不到数据」——用户看到的是空白，不是报错。**所以构建必须真的跑一遍。**

---

## 10. 界面纪律（改 UI 之前先读这两篇）

`docs/dev/rendering.md`（Chromium / React 的坑）、`docs/dev/ui-language.md`（物质语言）。

**Chromium 侧——症状都是「DOM 在、几何对、就是不画」：**

1. 顶栏 / 抽屉 / 浮层**不用 `backdrop-filter`**（同一层叠上下文里的大模糊层会吃掉它）。
2. 可滚动的纵向 flex 容器里，直接子项一律 `flex:0 0 auto`（否则被压扁而不是滚动）。
3. 不在同一元素上同时用**渐变背景 + `backdrop-filter`**。
4. 图片入场动画**只用 `opacity` / `transform`**，任何 `filter` 都会在祖先裁剪下让图变白。
5. 横向 flex 里的中文标题要给 `min-width`，不许被压成一列。
6. 元素被包进新容器时，**主轴变了就要重写 flex 声明**；「突然不滚了」先量几何。
7. **多列字段组的列数要跟「主区多宽」走，不是跟视口走。** 右栏能拖宽、构思会话能开着，
   主区可能只剩 430px；那时 `repeat(2, minmax(0,1fr))` 会把中文压成一字一行
   （实机看到的是「pa/ss」「姓/名」）。`.dd-main` 是具名容器，用
   `@container (max-width: 560px)` 把 `.dd-grid2/.dd-grid3` 折成一列 —— 媒体查询在这里
   没用，视口一直是宽的。

**React 侧——症状都是「整个面板一片空白」：**

8. **早退必须排在所有 hook 之后**（第一次渲染没数据、第二次有了 ⇒ hook 数变了 ⇒ #310）。
9. effect 里不要引用后面才声明的 `const`（依赖数组在渲染时求值 ⇒ TDZ ⇒ 面板崩）。
10. **同一个 state 的两条异步来路要带序号。** 「切阶段 / 切作品 / 换筛选」这类
    「后发先至」的响应必须丢掉旧的（`stageSeq` 就是这么修「永远卡在正在切换」的）。

**两条硬规矩：**

- **改完界面要截图看一眼**（`scripts/shot.ps1`，最长边 ≤1200px），并且**看控制台**——
  崩掉的 panel 在画面上只是「一片空白」，很容易被当成「没数据」。
- 可编辑字段**一律用 `Editable`**，手势是：**点右上角 ✎**（点内容不进编辑）→
  **原地**展开编辑面；单行是小控件，多行是「预览 / 编辑两态 ＋ N 字 ＋ 未保存 ＋ 保存」
  的一块面，两态**同高**；只有【保存】写盘（单行 Enter、多行 Ctrl+Enter 例外，
  那是显式的），**失焦不存**，Esc 取消，`onSave` 返回 `false` 就留在编辑态。
  不要手写「读态 div → 编辑态 input → 保存 / 撤销按钮」；**也不要再弹窗改文本**——
  多行字段的编辑面就在原地，浮层只留给看（图片 / 视频）。

---

## 11. 性能是红线

**插件是嵌在别人的主应用里的。** 插件慢一点，用户就会说「DSH 卡了」——这类问题不报错，
只让人以为 DSH 变慢了。所以性能要有闸门，不能靠感觉：

```bash
node scripts/perf.mjs --base http://127.0.0.1:<宿主端口>        # Host 端延迟
node scripts/render-probe.mjs --base http://127.0.0.1:<宿主端口> # 渲染开销 / 轮询
```

预算（72 镜作品）：一轮刷新 p95 **60 ms**，端点 p95 **60 ms**，打开阶段 **400 ms**，
切换工作台 **1200 ms**，净 CPU **20 %**，面板藏起来后轮询 **0 次**。

**六条规矩：**① 一次刷新只发一个请求（`/snapshot` 一次给全）；② 数据没变就不重渲染
（比 `revision`，跳过 setState）；③ 面板不可见就停轮询（`IntersectionObserver`）；
④ 不用 `filter: blur()` 做全屏氛围层；⑤ 不给同一元素上渐变背景 + `backdrop-filter`；
⑥ Host 端的重活要缓存（几秒 TTL）。

**量之前先确认宿主没有空转**——DSH 长时间运行后 Host 进程会自旋烧掉两三个核，能把
12 ms 的量成 66 ms。归因方法、实测数据、探针的失败模式、缓存纪律（缓存**清单**，
不缓存某一镜的判定）全在 `docs/dev/performance.md`。

---

## 12. 阶段语义：**点节点 = 切视图，不是改状态**

| 概念 | 存在哪 | 谁改它 |
|---|---|---|
| **已提交的阶段**（committed） | `state.json` 的 `stage` | 状态机（Host） |
| **正在看的阶段**（viewStage） | 客户端内存 | 用户点阶段节点 |

- **点阶段节点不发任何请求**，只是换视图（`setViewStage`）；没有确认框。
- 预览时：已提交的阶段**实心**，正在预览的**虚线描边**，并有一条「预览中 · 已提交进度
  仍停在 X」的横幅。
- **任何写操作**都把 `writeStage` 一起发给 Host；Host **先保存内容**，再尝试推进阶段。
  `writeStage` = 正在看的阶段，但**正在看的是更靠前的阶段时它变成 `undefined`** ——
  否则「在角色页顺手改个错别字」会把已提交进度从 generate 悄悄退回 characters
  （实测复现过：`state.json` 的 stage 真的退回去了）。回退是显式动作，不是编辑的副作用。
- **保存与推进分离**：前置条件不满足时**内容照样保存**，缺口如实回报给用户。
- 回退**永远允许**；正向推进按契约逐段校验。「已经在这一阶段」不算「没推进」。
- **点当前所在的节点不许清载荷**（点了同一个节点 = `viewStage` 没变 = 补载荷的 effect
  永远不跑 ⇒ 卡在「正在读取」）。只有真的换阶段才清，并留一个两秒的看门狗。
- **阶段载荷的请求要带序号，过期的响应必须丢掉。** 按 F5 之后立刻点别的阶段，
  上一次请求可能**晚于**本次返回（实测 generate 2.6s vs verify 1.2s），
  `setStagePayload` 是后到覆盖先到 ⇒ 页面永远停在「正在切换到 X」。
  看门狗也判「手里有载荷」而不补请求 —— 两个坑叠起来就是一页无法自救的死屏。
  见 `loadStage` 的 `stageSeq`。

实现：`editors.js` 的 `commitStage()` + `service.js` 的 `commitStageFor()` + 客户端的 `runEdit()`。

---

## 13. Windows / 跨语言四坑

1. Windows 的 `rename` 会 `EBUSY` → 原子写要重试，最后退化为就地覆盖（`fsx.js`）。
2. 中文 Windows 的 Python stdout 是 GBK → 所有 `execFile` 调 Python 都带
   `PYTHONIOENCODING=utf-8` / `PYTHONUTF8=1`，否则中文字段全变乱码。
3. **不要用 PowerShell 改作品 JSON**（无 BOM UTF-8 会被当 ANSI 读，中文落到盘上是乱码，
   还会带上 BOM）。用 Node，或走 service 方法。
4. `.ps1` 带中文就必须带 **UTF-8 BOM**，否则 `ParserError: UnexpectedToken`。

细节见 `docs/dev/windows.md`。

---

## 14. 构思会话 = 真会话，界面用宿主自己的

- **聊天界面一行都不许自己画。** 用 `renderFactorySlot('conversation.content',
  { variant:'embedded' })` 把宿主自己的对话装配嵌进侧栏；绑会话靠
  `SessionProvider` + `sessions.retain()`。
  **不许**再用 `eventSource` 手工折叠出「消息 / 处理过程」——工具卡、提问卡、
  上下文折叠、composer 的模型与强度选择全在宿主那边，自己画只会更差。
  做法与三个必要条件见 [`docs/dev/dsh-integration.md`](docs/dev/dsh-integration.md) D1。
- **两个前置条件必须同时满足**才能嵌进来：① 槽注册里声明一个 **session 作用域的
  子槽**（宿主才发 `SessionProvider` / `renderSlot`）；② 用 `SessionProvider` 把
  `retain()` 的引用绑住。少一条，嵌进来的是空态。
- **工作区有两面，都要做对**：`workspaceRegistry.resolveByPath()` 拿到实体、
  cwd = 短剧总根、**并且 `workspace.attachSession(sessionId)` 把会话挂进账本**。
  只做前两条 = 会话掉进侧栏的「未分组」（D2）。
- **`agents.create()` 不接受「没有模型」**，显式带 `agentDefaultModel.currentSelection()`。
- **项目范围走 prompt context，且「每段会话都钉一次」**：`scopePrompt()` 生成
  「作品名 + 目录 ID + 路径」三件套，`agent.ctx.systemPrompt.context(...)` 挂到
  **这一段 agent** 上，文本传**函数**（每步重取）。入口是 `POST /conceive-scope`：
  客户端**每次绑住一段会话**都调——「开会话时装一次」不够，会话窗里还有宿主侧栏
  自己开的、插件重装前开的对话，它们从来没有过范围。**归属优先于当前作品**；
  别的作品的会话在下拉里是**禁用项**；「新对话」要把旧 id 记进 `desk_session_ids`，
  否则旧对话变成无主会话、在哪个作品下都能被选走（= 串台）。
- **随包技能必须注册**（`ctx.skills.registerProvider()`），且**按 cwd 过闸门**：
  只有落在短剧总根之内的会话才看得到这些 Skill；别处的候选目录返回**空目录**
  （`complete: true`，不是「发现失败」）。
- **带点的服务路径必须显式 inject**（`ctx.get('remote.userQuestions')` 不 inject 会抛）。
- **`retain` 失败要自愈一次**：插件重装 / DSH 重启后会话可能不在宿主的活目录里
  （`sessions.retain: unknown session`）→ 请 Host 走一次 `ensureDeskSession()`（= resume）
  → 再 retain。只试一次，别循环打接口（D7）。

会话、工作区、技能的完整规矩见 `docs/dev/dsh-integration.md`。

---

## 15. 文档地图

| 文档 | 什么时候读 |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | 产品功能、验收口径 |
| [`docs/API.md`](docs/API.md) | **接口唯一真源**——改接口先改它 |
| [`docs/DETAIL.md`](docs/DETAIL.md) | 插件详情页文案 |
| [`docs/dev/architecture.md`](docs/dev/architecture.md) | 目录树、文件职责、操作↔tool↔service 对照表、Client 拼装 |
| [`docs/dev/rendering.md`](docs/dev/rendering.md) | 改界面前；界面「不画 / 空白」时 |
| [`docs/dev/performance.md`](docs/dev/performance.md) | 动性能、加新接口、跑闸门、量到的数不对劲时 |
| [`docs/dev/ui-language.md`](docs/dev/ui-language.md) | 改视觉、加可编辑字段、动品牌标记 |
| [`docs/dev/dsh-integration.md`](docs/dev/dsh-integration.md) | 动构思会话、工作区、技能注册、宿主服务 |
| [`docs/dev/windows.md`](docs/dev/windows.md) | 文件写坏了、脚本报 `ParserError`、中文乱码 |

**维护约定**：踩到新坑，先判断它是「一条必须照做的规矩」还是「一段复盘」。
规矩写进本文（一行 + 一条链接），复盘写进 `docs/dev/` 对应的那篇。
**本文的目标是让人和 agent 花五分钟读完就能动手，不是留档。**
