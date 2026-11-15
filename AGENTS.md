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
| 读 / 推进阶段 | 阶段条 | `drama_desk_stage` | `service.stageState()` / `service.setStage()` |
| 读 / 改设置 | 设置抽屉 | `drama_desk_settings` | `service.settings()` / `service.updateSettings()` |
| 改表演 | beats 编辑器 | `drama_desk_edit_beat` | `service.editBeat()` |
| 改镜头 | 镜头字段 | `drama_desk_edit_shot` | `service.editShot()` |
| 写批注 | 批注区 | `drama_desk_annotate` | `service.annotateShot()` |
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
│   ├── build.mjs             构建 + 发布前校验（含性能闸门 --perf / --render）
│   ├── pack.mjs              打包 npm bundle → release/
│   ├── perf.mjs              Host 端延迟闸门
│   ├── render-probe.mjs      渲染开销闸门（切换延迟 / CPU / 轮询）
│   └── make_demo_work.py     生成带真实图片/视频的演示作品（落在视频目录，不入库）
├── src/
│   ├── spec/                 规范源码（core/ + models/<id>/）
│   ├── skills/<name>/SKILL.md
│   ├── tools/                体检器 + 编译器 + 驱动器（纯 stdlib 优先）
│   ├── host/                 Host service / HTTP 路由 / agent tools
│   └── client/               （预留：将来放需要构建的 Client 源码）
└── build/  release/          构建产物与发布物（都不入库）
```

### 演示作品

```bash
# 小作品（4 场 / 7 镜）：功能冒烟用
python scripts/make_demo_work.py --out "D:/Default/Videos/drama-desk-demo" --scale small

# 大作品（12 场 / 72 镜 / 569 秒）：分页、性能、规模用
python scripts/make_demo_work.py --out "D:/Default/Videos/drama-desk-demo" --scale large --force
```

生成带**真实参考图**（含一张 2048px，用来验证 ≤1200px 的显示约束）与
**真实视频**（用来验证播放器与运动层体检）的作品，落在「视频」目录下
——**不在插件仓库里**。没有真实素材时，预览与视频体检都无从检验。
大作品用来证明「按场次渲染」在真实规模下不卡。

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
| **随包工具自成一体** | `src/tools/` 缺 `compile_prompts.py` / `slim_prompt.py` / `lighting.py` / `desk_qc.py`（编译器 import 了一个没被打包的生成器，界面上的「重新编译」会直接报错） |
| **语法** | 每个 JS 文件 `node --check` 不过 |
| **运行时** | Host 半边 import 之后调 `overview()` / `rules()` / `pipeline()` / 九个 `stageView()`，形状不对或运行时报错 |

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

---

## 10. 渲染层的三条血泪教训

这三条都在 DSH Desktop 的 Electron 渲染器里真实踩过，**症状都是「DOM 在、
几何对、就是不画」**——不截图根本发现不了。

### ① 同一层叠上下文里的大模糊层会吃掉 `backdrop-filter`

`.dd-ambient` 里有三个 `56vmax` 的 `filter: blur(70px)` 光斑。
同一个层叠上下文里再给顶栏用 `backdrop-filter`，Chromium 会把该元素的
**内容层整个丢掉**——只剩背景，文字、按钮、图标全不画。

**对策**：顶栏 / 抽屉 / 浮层一律**不用 backdrop-filter**，用半透明纯色。
（`filter: blur()` 的大光斑本身可以留，它自己画得好好的——但它很贵，见 §11。）

### ② 纵向 flex 容器里的子项会被压扁

`.dd-detail-body` 是 `display:flex; flex-direction:column`。子项默认可压缩，
内容比容器高时它们会被**压扁**（而不是溢出滚动）——表现为每段只露一条缝。

**对策**：可滚动的纵向 flex 容器里，所有直接子项都要 `flex:0 0 auto`。

### ③ 渐变背景 + backdrop-filter 同元素 = 内容不画

`background: linear-gradient(...)` 与 `backdrop-filter` 同时用在同一元素上时，
Chromium 会丢内容层。纯色背景没有这个问题。

**对策**：不要在同一个元素上同时用渐变背景与 backdrop-filter。

> 通用做法：**每次改完界面都截图看一眼**。这三条的共同特征是
> 「DOM 查询能看到元素，但人眼看不到」——自动化断言查不出来，只有截图能。
> 截图必须**缩到最长边 ≤1200px** 再读（见 §4 的图片纪律）。

### ④ 祖先 `overflow:hidden` + 自身带 `filter` 的 `<img>` = 空白图片

`.dd-thumb img` 曾经带 `animation: dd-develop`（里面是 `filter: blur(10px)`）。
结果是：**参考图一片空白**——DOM 在、几何对、网络请求也成功，就是不画。

与 ①③ 同源：Chromium 在「祖先裁剪 + 自身滤镜」这一组合下会丢内容层。
淡入只用 `opacity`，**不要用 `filter`**。

> 对策：入场动画只用 `opacity` / `transform`；任何 `filter` 都不许进图片动画。

### ⑤ 纵向 flex 里的中文标题会被压成一个字一行

`.dd-stagehead` 是横向 flex。右侧一旦放了一条很宽的子元素（12 枚场次 chip），
左侧的中文标题就被压到**最小内容宽度 = 1 个字**，于是整段话竖着排。

> 对策：给文字那一侧一个下限（`min-width: 300px`），并允许换行
> （`flex-wrap: wrap`）。挤不下就换行，不许把字压成一列。

---

## 11. 性能是红线

> **插件是嵌在别人的主应用里的。** 插件慢一点，用户就会说「DSH 卡了」。
> 功能做再好也救不回来——而且这类问题**不会报错**，它只会让人觉得 DSH 变慢了。

所以性能必须有**闸门**，不能靠感觉。

### 两道闸门

```bash
node scripts/perf.mjs                      # Host 端延迟与响应体
node scripts/render-probe.mjs               # 渲染开销（切换延迟 / CPU / 轮询）
node scripts/build.mjs --perf --render      # 两道都跑，作为构建的一部分
```

`--perf` / `--render` **要 DSH 正在跑**（前者要 web 端口，后者要 DSH Desktop 窗口），
所以默认**不跑**——构建不该依赖一个正在运行的服务。

### 本机的实测基线（2026-11-16，Windows / Electron）

演示作品：72 镜 / 12 场（`demo-epic`）。

| 指标 | 预算 | 实测 |
|---|---|---|
| 一轮刷新（面板实际用的 `/snapshot`）p95 | 60 ms | **16.4 ms** |
| 端点 p95（最慢的 `assets`） | 60 ms | **53.3 ms** |
| 打开工作台的切换延迟 | 1200 ms | **353–473 ms** |
| 切走工作台 | — | 526 ms |
| 工作台净 CPU 开销（A/B 对照） | 20 % | **−7.6 %**（比会话还省） |
| 面板藏起来后的轮询次数（8 秒） | 0 次 | **0 次** |

> 切换延迟的预算**不是拍的**：同一台机器上，用户自己的「自媒体工作台」插件
> 打开耗时 **244–1136 ms**。预算定在 1200 ms =「不许比参照插件更差」。
> 换机器要重新测参照插件。
>
> `/snapshot` 的响应体随作品规模增长（72 镜 ≈ 37 KB）。它每 4 秒发一次，
> 即 ~9 KB/s。**作品的镜头数再上一个量级时，要重新量这一条。**

### 六条规矩（每条都对应一个已修掉的坑）

1. **一次刷新只发一个请求。** `/drama-desk/api/snapshot` 一次给全（顶栏 + 网格 +
   阶段条 + 设置）。四个端点就是四倍 HTTP 开销。
2. **数据没变就不重渲染。** Host 给每个视图一个 `revision`（文件 mtime + size）；
   客户端比对后**跳过 setState**。否则每几秒就把 45 个格子销毁重建一次。
3. **面板不可见就停轮询。** 宿主可能把面板留在 DOM 里只是不显示——组件不卸载，
   轮询也不会停。所以用 `IntersectionObserver` 判可见性，藏起来立刻停，
   重新可见时补一次刷新。
4. **不要用 `filter: blur()` 做全屏氛围层。** 三个 `56vmax` 的模糊光斑让渲染进程
   常驻一个核以上（实测 110 % CPU）。改成直接画径向渐变——视觉几乎一样，
   但只是一次光栅化，没有逐帧开销。
5. **不要在同一元素上同时用渐变背景与 `backdrop-filter`。** 见 §10。
6. **Host 端的重活要缓存。** 磁盘余量、资产体积这类「慢慢才变」的数，用几秒的
   TTL 缓存；每轮轮询都去 `statfs` 一遍是白费力气。

### 测的时候要小心

- **CPU 必须 A/B 对照。** DSH 的会话界面本身就在忙（流式输出、动画），
  单看一个数没有意义——**差值**才是插件的开销。
- **切换延迟要用「另一个主面板」来量**，不要点侧栏入口当开关（点它总是**选中**
  这个面板，不会收起）。
- **面板可能在 DOM 里但不可见。** 判「可见」看几何（宽高非零），不看「元素还在不在」。
- **Windows PowerShell 5.1 把没有 BOM 的 `.ps1` 当 ANSI 读。** 探针脚本里
  有中文字面量时**必须带 UTF-8 BOM**，否则直接语法错误。

### 探针自己的失败模式

探针也会骗人。它曾把「等一个永远不会出现的标志元素」当成 6 秒延迟，
把「点击了工作区标题而不是会话行」当成面板没隐藏。
**所以探针的每个判据都要能用截图或 DOM 查询独立验证**——
探针报「超预算」时，先怀疑探针。

> **更严重的一种：探针测不到，却报「通过」。**
> 标志元素的文案一改，探针就找不到面板，于是延迟测成 `-1`、
> CPU 测成 `0`——而 `-1 > 1200` 为假，于是「通过」。
> 那是把「没测」说成「没问题」。
>
> **对策（已落到代码里）**：
> ① 标志元素用**插件独占**的一行字（`AI 短剧生产线`），不要用输入框的
>    placeholder —— 改一次文案探针就瞎了；
> ② 探针**测不到就失败**：`switchAvg < 0` / `hiddenPolls < 0` 一律计入问题。

---

## 12. 阶段语义：**点节点 = 切视图，不是改状态**

> 用户的原话：「点击某个阶段的节点，直接切换过去，但为预览状态，
> 只有在该状态明确进行修改后，才会变更总体的进度状态。」

所以阶段条上有**两个**概念：

| 概念 | 存在哪 | 谁改它 |
|---|---|---|
| **已提交的阶段**（committed） | `state.json` 的 `stage` | 状态机（Host） |
| **正在看的阶段**（viewStage） | 客户端内存 | 用户点阶段节点 |

规则：

- **点阶段节点不发任何请求。** 只是换视图（`setViewStage`）。
  没有确认框，没有「再点一次」。
- 预览时阶段条上：已提交的阶段是**实心**，正在预览的是**虚线描边**，
  下面有一条「预览中 · 已提交进度仍停在 X」的横幅。
- **任何写操作**都把 `viewStage` 一起发给 Host；Host **先保存内容**，
  再尝试把 `state.json` 推进到那一阶段。
- **保存与推进分离**：前置条件不满足时**内容照样保存**，只是进度不动，
  缺口如实回报给用户。

> 回退**永远允许**（契约明写：「分镜返工要能只重做第 7 个镜头」）。
> 正向推进按契约 §11.2 逐段校验。
>
> 「已经在这一阶段」**不算**「没推进」——那说明人还在这里干活。

实现：`src/host/editors.js` 的 `commitStage()` +
`src/host/service.js` 的 `commitStageFor()` + `client.js` 的 `runEdit()`。

---

## 13. 三条新踩的坑（2026-11-16）

### ① Windows 的 `rename` 会 `EBUSY`

原子写是「写临时文件 → rename 覆盖目标」。目标文件正被别的进程打开时
（杀毒软件、索引器、文件预览、甚至另一个读者），
`rename` 会报 `EBUSY: resource busy or locked`，**整个写操作失败**。

> 对策（`src/host/fsx.js` 的 `replaceFile()`）：
> 重试几次（0 / 40 / 120 / 300 ms），仍不行就**就地覆盖**
> （`copyFile` + 删临时文件）——那不原子，但**不丢数据**。

### ② 中文 Windows 的 Python stdout 是 GBK

体检器用 `ensure_ascii=False` 打印中文 JSON，Python 按 cp936 编码写 stdout，
Node 按 UTF-8 解码 —— **每一个中文字段都变成乱码**（`无可拍动作` → `�޿��Ķ���`）。
这条直接打到界面上（表演层的问题清单）。

> 对策：所有 `execFile` 调 Python 的地方都带
> `env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }`。
> 涉及 `src/host/qc.js`、`src/host/compile.js`、`src/host/api.js`。

### ③ 随包工具必须自成一体

「重新编译」曾直接报 `ModuleNotFoundError: No module named 'slim_prompt'`：
编译器 `import` 了一个**从来没被打包**的生成器。

> 对策：
> - `src/tools/` 现在自带 `slim_prompt.py`（通用默认生成器）与 `lighting.py`
>   （光参数预设）；
> - 编译器在**找不到**生成器时**不崩**：跳过提示词生成、仍然重编译派生字段，
>   并在 JSON 里报 `note`；
> - `scripts/build.mjs` 增加了检查：随包工具缺一个就**不许发布**。

---

## 14. 目录与文件的新增

```
src/host/
  service.js     主编排（一个操作，两个调用者）
  api.js         HTTP 传输层（不含业务逻辑）
  stages.js      阶段机（顺序、前置条件、推进判定）
  stageviews.js  九个阶段的视图载荷
  editors.js     写操作 + 阶段提交
  posters.js     静帧（关键帧 / 缓存帧 / ffmpeg 抽帧）
  hostinfo.js    宿主真实配置（模型路由 / 目录选择器 / 作品列表）
  workspace.js   作品读写
  qc.js          体检器驱动
  compile.js     编译器驱动
  locations.js   路径解析（Windows 已知文件夹）
  fsx.js         文件系统助手（原子写 + Windows 重试）
src/tools/
  compile_prompts.py  编译器驱动（派生字段 + 提示词产物 + 人工覆盖）
  slim_prompt.py      通用默认提示词生成器
  lighting.py         光参数 preset
  desk_qc.py          体检器驱动
```

界面与 Host 的契约写在 `docs/API.md`——**那是接口的唯一真源**。
改接口先改它。
