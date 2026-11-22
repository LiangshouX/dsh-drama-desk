# 架构与源码布局

> **纪律**在 `AGENTS.md`（短，必读）；**接口契约**在 `docs/API.md`（接口唯一真源）；
> **产品功能**在 `docs/PRD.md`。本文只回答一个问题：**代码放在哪、谁调谁**。

---

## 1. 目录树

```
dsh-drama-desk/
├── package.json              插件包清单
├── cordis.patch.yml          Host patch（一条 row；config 由用户的 patch 层覆盖）
├── index.js                  Host 半边
├── client.js                 Client 半边（浏览器 bundle，**生成物**）
├── icon.svg                  插件图标
├── locale/{en,zh}.json       Plugin Manager 元信息（meta.title / meta.description）
├── docs/
│   ├── PRD.md                产品功能
│   ├── API.md                界面与 Host 的接口契约（唯一真源）
│   ├── DETAIL.md             插件详情页
│   └── dev/                  开发参考（本文所在目录）
├── scripts/
│   ├── build.mjs             构建 + 发布前校验（含性能闸门 --perf / --render）
│   ├── build-client.mjs      把 src/client/* 拼成 client.js（Client 半边的构建）
│   ├── client-smoke.mjs      客户端冒烟测试：真的跑一遍 React SSR 渲染
│   ├── pack.mjs              打包 npm bundle → release/
│   ├── perf.mjs              Host 端延迟闸门
│   ├── render-probe.mjs      渲染开销闸门（切换延迟 / CPU / 轮询）
│   ├── profile.mjs           性能归因：慢的是代码还是宿主环境
│   ├── shot.ps1              截图（渲染层陷阱只有截图能发现）
│   └── make_demo_work.py     生成带真实图片/视频的演示作品（落在视频目录，不入库）
├── tests/
│   └── equivalence.mjs       等价性回归：优化过的答案必须与优化前相同
├── src/
│   ├── spec/                 规范源码（core/ + models/<id>/）
│   ├── skills/<name>/SKILL.md
│   ├── tools/                体检器 + 编译器 + 驱动器（纯 stdlib 优先）
│   ├── host/                 Host service / HTTP 路由 / agent tools
│   └── client/               Client 半边源码
└── build/  release/          构建产物与发布物（都不入库）
```

---

## 2. Host 半边（`src/host/`）

| 文件 | 职责 |
|---|---|
| `service.js` | 主编排（「一个操作，两个调用者」的落点） |
| `api.js` | HTTP 传输层（不含业务逻辑；图片路由也在这里） |
| `stages.js` | 阶段机（顺序、前置条件、推进判定） |
| `stageviews.js` | 九个阶段的视图载荷 |
| `editors.js` | 写操作 + 阶段提交 |
| `posters.js` | 静帧（关键帧 / 缓存帧 / ffmpeg 抽帧） |
| `hostinfo.js` | 宿主真实配置（模型路由 / 目录选择器 / 作品列表） |
| `workspace.js` | 作品读写（字段白名单与写入器） |
| `qc.js` | 体检器驱动 |
| `compile.js` | 编译器驱动 |
| `locations.js` | 路径解析（Windows 已知文件夹） |
| `fsx.js` | 文件系统助手（原子写 + Windows 重试 + `mapLimit`） |
| `skills.js` | 随包技能注册（`ctx.skills.registerProvider()`） |
| `spec.js` | 解析 `build/spec/`（规则、契约、前置条件表） |

## 3. 随包工具（`src/tools/`）

| 文件 | 职责 |
|---|---|
| `compile_prompts.py` | 编译器驱动（派生字段 + 提示词产物 + 人工覆盖） |
| `slim_prompt.py` | 通用默认提示词生成器 |
| `lighting.py` | 光参数 preset |
| `desk_qc.py` | 体检器驱动 |

`src/tools/` 必须**自成一体**：编译器不能 import 一个没被打包的文件
（否则界面上的「重新编译」直接报 `ModuleNotFoundError`）。`scripts/build.mjs` 拦这一条。

---

## 4. 一个操作，两个调用者：完整对照表

界面的每个动作与 agent 的每个工具**必须调用同一个 Host service 方法**。

| 操作 | 界面 | agent tool | Host 方法 |
|---|---|---|---|
| 读流水线 | 网格 | `drama_desk_status` | `service.pipeline()` |
| 读镜详情 | 镜详情 | `drama_desk_shot` | `service.shot()` |
| 读体检 | 判定区 | `drama_desk_qc` | `service.shot()` / `service.pipeline()` |
| 读规则与依据 | 规范视图 | `drama_desk_rules` | `service.rules()` |
| 读资产 | 资产视图 | `drama_desk_assets` | `service.assets()` |
| 读台账 | 台账页 | `drama_desk_ledger` | `service.ledger()` |
| 读 / 推进阶段 | 阶段条 | `drama_desk_stage` | `service.stageState()` / `service.setStage()` |
| 读 / 改设置 | 设置抽屉 | `drama_desk_settings` | `service.settings()` / `service.updateSettings()` |
| 改表演 | beats 编辑器 | `drama_desk_edit_beat` | `service.editBeat()` |
| 改镜头 | 镜头字段 | `drama_desk_edit_shot` | `service.editShot()` |
| 写批注 | 批注区 | `drama_desk_annotate` | `service.annotateShot()` |
| 重新编译 | 按钮 | `drama_desk_compile` | `service.compile()` |
| 校验过期 | 角标 | `drama_desk_check` | `service.check()` |

HTTP 路由（`src/host/api.js`）只是**传输层**：它调用上面那些方法，不含业务逻辑。
新增一个操作的正确顺序是：先在 service 上写方法 → 再挂界面调用点 → 再挂 agent tool。

## 5. 阶段提交的实现路径

- `src/host/editors.js` 的 `commitStage()`
- `src/host/service.js` 的 `commitStageFor()`
- `src/client/` 里 `runEdit()`（写操作统一出口）

保存与推进是**分离**的：内容先落盘，再尝试推进 `state.json` 的 `stage`。
语义见 `AGENTS.md` §12「阶段语义」。

---

## 6. Client 半边：模块化源码 + 一个拼装器

`client.js` 曾经是一个 5000 行的巨无霸：九个阶段的视图、聊天、资产、图片预览、
设置抽屉全塞在一个文件里，于是三个代价同时出现：改不动、并行不了、看不见边界。

所以源码在 `src/client/`，按功能分模块；`client.js` 是**产物**：

```
src/client/
  manifest.json     拼装顺序（header + parts）
  00-header.js      设计语言与 bundle 格式说明（注释）
  10-prelude.js     React 取值与 hooks 解构
  2x-*.js           基础层：locale / API / 常量
  3x-*.js           主题与通用组件（面板、编辑）
  5x-*.js           阶段视图（九个阶段各一块）
  7x-*.js           构思会话窗
  8x-*.js           首页 / 规范 / 文档 / 资产 / 图片预览 / 设置
  90-panel.js       根组件与插件装配
```

### 四条纪律（拼装器会拦）

1. 顺序由 `manifest.json` **显式声明**，不靠目录遍历的运气。
2. 分段里**不许**出现 `window.__ModuleLoader__` 或第二次 `require('react')`
   ——它们只属于拼装器生成的壳。
3. 分段里**不许**出现 `import` / `export`——它们不是 ES 模块，是**拼进同一个
   函数作用域的片段**。跨模块只能靠**顶格的全局名字**互相调用。
4. **所有分段的顶层名字必须全局唯一。** 拼进同一作用域之后同名就是覆盖，
   而覆盖会把「A 的函数被 B 悄悄换掉」变成静默 bug。

### 样式跟着组件走

每个模块末尾用 `CSS_PARTS.push(\`…\`)` 把自己那一块的样式 push 进总表
（`CSS_PARTS` 在 `30-theme.js` 里声明）。于是改一个组件时，实现与样式在同一个
文件里被一起读到。

### 改法

```bash
node scripts/build-client.mjs           # src/client/* → client.js
node scripts/build.mjs                  # 拼装 + 全部校验（含客户端 SSR 冒烟测试）
```

**永远不要手改 `client.js`** —— 下一次构建会覆盖它。

> 与兄弟插件 `dsh-realtime-interview` 的 `scripts/build-client.mjs` 同一套做法。

### 冒烟测试需要 react / react-dom

```bash
npm install --no-save react@18 react-dom@18   # 开发期依赖，gitignore
node scripts/client-smoke.mjs
```

没装时它自己**跳过**（不是假装通过）。装了就跑三遍渲染：根面板 + 台账（有数据与
没数据两种）+ 资产 + 文本字段——组件级的错误（少一个 hook、读了一个 null 字段）
**只有真的渲染一次才会暴露**。

### 演示作品

```bash
# 小作品（4 场 / 7 镜）：功能冒烟用
python scripts/make_demo_work.py --out "D:/Default/Videos/DSH-DRAMA-DESK" --scale small

# 大作品（12 场 / 72 镜 / 569 秒）：分页、性能、规模用
python scripts/make_demo_work.py --out "D:/Default/Videos/DSH-DRAMA-DESK" --scale large --force
```

作品带**真实参考图**（含一张 2048px，用来验证 ≤1200px 的显示约束）与**真实视频**
（用来验证播放器与运动层体检），落在「视频」目录下——**不在插件仓库里**。
没有真实素材时，预览与视频体检都无从检验。

---

## 7. 构建顺序：先生成，再校验

`client.js` 是**生成物**，校验它的语法**必须在拼装之后**。反过来的话，上一轮留下的
坏产物会让这一轮的构建报一个与本次改动无关的错，而真正的问题根本没被看到。

```bash
node scripts/build-client.mjs   # 先拼
node scripts/build.mjs          # 再校验（它内部会先拼再校验）
```
