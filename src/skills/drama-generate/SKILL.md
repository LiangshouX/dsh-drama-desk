---
name: drama-generate
description: AI 短剧/微电影的镜头生成阶段。把分镜写成 MiniMax-H3 提示词，按幂等流程提交、轮询、下载并登记视频与台账。当用户要求生成镜头视频、按分镜批量出片、提交 H3 任务、轮询生成进度或排查生成失败时使用。不用于创意讨论、剧本编写、分镜设计或成片验收。
---

# drama-generate — 镜头生成

**插件内入口（优先）**：先用 `drama_desk_production`（workspace 为当前作品 ID、stage 为 generate）与 `drama_desk_rules` 读取现状和本阶段规范。再调 **`drama_desk_generation_plan`** 拿到逐镜计划——它已经排除了「同一份提示词已经提交过」的镜头（幂等判据是提示词 sha256），并给出这一批的预计费用；**不要自己逐镜判断该不该提交**。需要新增场次/角色/镜头时用 `drama_desk_add`，真源修改用 `drama_desk_edit` / `drama_desk_edit_beat` / `drama_desk_edit_shot`，文件落地后用 `drama_desk_register_asset` 登记。以下 `python tools/drama.py` 是外部 CLI 工作区的示例；只有确认当前工作区存在它时才运行。插件包本身不分发该外部 CLI，不得猜路径或因它缺失而重复失败。

**本阶段产出**：每个镜头一条视频文件 + 提示词资产 + 台账条目。

---

## 0. 开工前（不可跳过）

```bash
python tools/drama.py next --work <work-id>
```

读返回的三样东西：

- `rules` —— **本阶段适用的硬规则**，由 CLI 从 `spec/rules.md` 按阶段筛选后注入。**不要凭记忆执行**，规则随实测更新，`drama next` 是唯一入口。
- `references` —— 需要按需加载的文件（提示词官方格式、常见错误）。**用到才读**，不要一次性全读进来。
- `skill` —— 本阶段技能（本文件）。

再读项目宪法：

```bash
python tools/drama.py constitution
```

---

## 1. 前置检查

- **先读计划**：`drama_desk_generation_plan(workspace="<work-id>", limit=10)`。
  - `action = submit` 的才是这次要提交的；`skip` 是已经付过费的（**不许重发**）；
  - `blocked` 会写清缺什么（提示词 / duration / camera）；
  - `summary.channelReady = false` 时**先说清通道不可用**，不要硬提交；
  - `summary.costUsd` 是这一批的预计费用，**报给导演等他明确授权**。
- 再核对象源：计划里的 `prompt.stale` 为真的镜头，先重新编译（`drama_desk_compile`）。
  `state.budget` 的预算与 `ledger` 的花费在 `drama_desk_generation_board` 里。
- 外部 CLI 工作区（那边自带 `drama.py`）也可以这么读：

```bash
python tools/drama.py next --work <work-id>
```

---

## 2. 参考模式选择

| 模式 | 字段 | 用途 |
|---|---|---|
| 文生视频 | 无媒体字段 | 纯场景，无角色 |
| 首帧 | `input_image` + `reference_type: "first_frame"` | 单图转视频，比例跟随图片 |
| 首+尾帧 | `input_image` + `last_frame_image` | 精确控制转场（仅 H3） |
| **多模态参考** | `reference_images` / `reference_videos` / `reference_audios` | **角色一致性首选**（仅 H3） |

**关键帧模式不能与参考集合混用。** H3-Max 只支持文生视频和首尾帧，不支持参考集合。

参考图需先上传到可访问 URL（H3 只接受 HTTPS）：

```bash
mcode-tools upload-temp-url <path> --mime-type image/png
```

预检（不产生费用）：PNG/JPG/WEBP/HEIC，≤30MB，宽高各 256–5760；首尾帧模式额外要求宽高比 0.4–2.5。

---

## 3. 写 H3 提示词

### 三段式（顺序固定）

```text
integrated_multimodal_description: [Shot 1] ...

overall_soundscape: ...

non_diegetic_music: ...
```

### 多模态参考模式（六段式）

```text
subject_definitions:
<Picture 1> ...（每张参考图一个标签）
<Subject 1> ...（主体，引用 Picture）

summary:
[reference generation] ...

retention_analysis:
<Picture 1> fully_preserved
<Subject 1> fully_preserved
...

detailed_description:
3D CG Pixar animation style, ... [Shot 1] ...

overall_soundscape:
...

non_diegetic_music:
...
```

### 写作要求

| 项 | 要求 |
|---|---|
| `[Shot 1]` 必须是 `integrated_multimodal_description:` 后的第一个词 | 结构性要求 |
| 不要在提示词里写时长和画幅 | "a 5-second film" / "in 16:9" 都是错的，用参数传 |
| 每个镜头一个主动作 + 一个主运镜 | 支撑运动不能与之竞争 |
| 运镜用官方词汇 | Push In / Pull Out / Pan / Truck / Tilt / Arc / Tracking / Static |
| **禁止写死静止** | 不写 `static camera` / `never moves` / `nothing else moves`——见下方「运动纪律」 |
| 运镜必须写幅度与速度 | `Push In with small amplitude at slow speed`；只给方向不给路径模型不会动 |
| 运动写成「部位+次数+起止状态」 | `his right wrist rotates once, rolling the pen a quarter turn`；不用情绪词 |
| 切镜时间递增 | `[Shot 2] At 00:03.500, the camera cuts to ...` |
| 说话人用 `(S1)` `(S2)` | 按实际发声顺序分配，跨镜头复用 |
| 对白用 `<d>[Chinese] 台词</d>` | 只放语言标签和台词本身，说话人 ID 和语气放在外面 |
| 可见文字用英文双引号 | `"[PRODUCT TITLE]"` 形式，不要臆造品牌 |
| **主体定义与描述的状态必须一致** | 干身不能写湿身，白天不能写夜晚——这是状态丢失的头号根因 |

完整格式规范见 `spec/references/h3-官方提示词规范.md`。

### 运动纪律（2026-11-12 实测确立，R13/R14）

**「像会动的 GIF」是本项目当前最大的质量缺口，而根因在提示词写法，不在模型。**

实测证据：44 镜中 38 镜（86%）分镜运镜写 `Static`；生成的提示词逐条以
`completely static camera` + `The camera never moves.` 结尾。
结果 5 条成片 **0 条通过运动质量验收**——SC02-SH01 的 157 个帧间位移里
**只有 1 帧**发生全局运动（t=1.79s 单帧跳变 55.5px），其余 156 帧完全不动。

**✅ A/B/C 对照实验已证实这是唯一原因**（同镜、只改提示词、H3-Max）：

| 组 | 近乎静止帧 | 有效运动帧 | 累计运动量/秒 |
|---|---|---|---|
| A 写死静止 | 94.3% | 5.7% | 5.1 |
| **B 去静止 + 明确推近** | **0.0%** | **100%** | **131.1**（↑25 倍） |
| C B + 主体动作 | 0.0% | 100% | 83.2 |

B 组目视：t=0.5s 是全景，t=4.5s 已推近到店主近景——**真实的电影运镜**。

**三条硬纪律：**

1. **不描述静止。** 要静止就干脆不写相机——写了 `static` 就是在下达静止指令。
2. **一镜只做一件事**：要么一个主动作，要么一个主运镜，**二选一**。
   实测 C 组（推近 + 手部动作同镜）推近被挤占——起始构图从中景而非全景开始，
   zoom trend 仅 +0.017（纯推近的 B 组是 +0.232）。
3. **运动要有路径、速度、幅度，还要有时间点**：
   `At 00:03.000, the camera begins a slow push forward along the counter, small amplitude,
   the framing tightening gradually from a wide view to a medium view, continuous and smooth.`

**写完提示词自查：** 找出所有表示"不动/静止/不变"的词（`static`、`never moves`、
`nothing else moves`、`completely still`），**全部删掉**。这是最高收益的一次改写。

**关键运镜镜优先用首帧图生视频**（`input_image` + `reference_type: "first_frame"`）：
把参考图裁成"这一镜的起手构图"再让它动起来，运动可控性显著高于纯参考图生成。
图生视频模式下**不要复述图里已有的东西**，只写「什么在动、怎么动、什么必须不变」。
关键运镜镜还可以用首+尾帧锁死运动起止状态（`input_image` + `last_frame_image`）。

**对照实验用 H3-Max**（约 20 秒出片，H3 是 2 分钟）：只支持文生视频与首尾帧，
不支持参考集合——适合快速验证提示词写法，不能用于量产。

### 提交前质量闸（2026-11-12 复检确立，R17）

**提示词正文必须全英文**——官方规范是「除对白、歌词、可见文字外，全部用英文」。
`overall_soundscape` / `non_diegetic_music` 也是正文，写「近景：…；远景：…」这种
中文分层是违规（45 条里 45 条都犯了，肉眼扫不出来）。可见文字（画面里的字）
用中文原文并加英文双引号：`the outer one clearly written "主角"`.

**提交前跑机器检查**（退出码非 0 不可提交）：

```bash
python workspaces/<work-id>/prompts/check_prompts_v2.py
```

它查：禁词（`static camera` / `never moves` / `voiceover` / `lips remain completely
closed` / `apron` 等）、六段式结构是否齐全、中文残留（台词除外）、
双句点、可见文字引号。

**机器查不到、必须人眼过一遍的三类硬伤**（2026-11-12 全部实测踩到）：

| 问题 | 症状 | 改法 |
|---|---|---|
| 主体指错 | `<Subject 1> is the subject of this shot.` 指向环境或道具 | 指向本镜真正在动的主体 |
| 口型性别错 | 主角（女）写成 `His lips move clearly…` | `Her lips move clearly with the words as she speaks.` |
| 模板残句自相矛盾 | `the same clothing` 与 `with the outer jacket off` 同句 | 状态用正向描述重写，删残句 |

**音色描述词逐字复用，但语气必须逐句另写**（R9，2026-11-12 修订）：

| | 内容 | 复用规则 |
|---|---|---|
| `voice_desc` | **音色**：声线质感、性别、音域 | **逐字复制**，同一角色全片一字不差 |
| `delivery_default` | **默认语气**：角色的说话习惯 | 可被本句覆盖 |
| beat 的 `delivery` | **本句语气**：情绪、语速、气口 | **每句必写，随情绪变** |

⚠️ **原写法把语气词一起复用了**——店主全片 15 句、主角 6 句全部同一口气，
听起来像有声书而不是活人在说话。**音色那句照抄，语气那句另起一行。**

正确写法（`voice_desc` 逐字一致 + `delivery` 逐句递进）：

```text
<Subject 3> (S) says: <d>[Chinese] 十九。</d> His lips move clearly with the words as
he speaks. He speaks with a thin, slightly hoarse middle-aged male voice, unhurried,
clear diction.
The delivery is a quiet prompt, like a number being checked off; the last syllable
does not lift.
```

同一镜里第二声、第三声必须换 `delivery`：

```text
... He speaks with a thin, slightly hoarse middle-aged male voice, unhurried, clear
diction.  ← 音色逐字复用，不许动

The delivery is heavier this time, with restrained anger pressing the last
syllable down.   ← 本句语气，逐句变
```

**运镜也要逐句带时间点**（R13）：`At 00:03.000, the camera begins a slow push forward…`

**画外音不要写 `voiceover`**（R3）：官方 voiceover 模板含
`lips remain completely closed`，模型照做即无口型；而且它与「绝不写 voiceover」
直接冲突。画外角色改写为 `Off screen, the brother (S) speaks: <d>[Chinese] …</d>`，
不写闭唇句即可。

详见 `spec/references/AI视频运动质量.md`。

### 口型：画内音 vs 画外音

要口型就写画内音：

```text
<Subject 1> (S1) says: <d>[Chinese] 台词。</d> His lips move clearly with the words as he speaks.
```

**绝不写**官方 voiceover 那套：

```text
... says in an off-screen voiceover: <d>[Chinese] 台词。</d>
Immediately after the complete <d> block, his lips remain completely closed ...
```

"lips remain completely closed" 是**明确指令**，模型照做就是闭着嘴念台词。实测 SH01 口型不明显、T2/T3 完全没有。

画外音只用于真正的旁白、内心独白、看不见的画外人物。

### 光参数段：视频端必须显式重建 ⚠️

**锚在生图端能继承光比，在视频端会衰减一档。** 实测 SC02-SH02 v03 首帧：
线条更硬、饱和更低、锚里的「穿堂光浮尘」消失——**角色认得出，光认不出**。

所以每条视频提示词的 `detailed_description:` 里，`[Shot 1] <画风句>` 的**下一行**必须是 `Lighting:` 段：

```
[Shot 1] Hand-drawn 2D animation film, cel-shaded flat colour areas ...
Lighting: Low afternoon sun rakes in through the aluminium-framed sliding window at frame left ...
```

写法铁律：

| 项 | 要求 |
|---|---|
| 写**光的行为** | 方向 / 性质 / 明暗比 / 轮廓光 / 反弹光 / 空气感 —— 不是 `beautiful` / `atmospheric` 这类空词 |
| 必须有**画内可见光源** | 窗、吊灯、火盆、门缝街灯；超现实片段也要自洽给出光源 |
| 冷暖对比 | 暖赭石/古金（光）↔ 半透紫灰（暗），与全片配色一致 |
| **不许平光** | `flat lighting` / `even lighting` / `no cast shadow` 一律禁——平光就是「丑」的来源 |
| 与场景锚一致 | 光源取自该镜对应的场景锚事实，不另造 |

`shots.json` 的 `lighting` 字段登记该镜用的 preset 键；提示词里的 `Lighting:` 行必须与 preset 逐字一致
（由 `check_prompts_v2.py` 对账，不一致即拦下）。本项目 preset 定义见 `prompts/lighting.py`。

### 提示词瘦身：不要复述参考图 ⚠️（2026-11-15 A/B 实测）

**参考图已经说明的事，提示词不需要再说一遍。**

v1 的 45 条视频提示词平均 664 词（带台词的镜头到 1160 词），
其中 **53% 是 `subject_definitions` 里对参考图的逐字复述**（脸、发型、服装、道具材质）。
复述有三个害处：

1. **抢解释权**——提示词与参考图不一致时，模型挑一边执行（R1 的风险源）
2. **挤掉该写的东西**——篇幅被复述占了，这一镜发生什么、什么光、什么表演反而写不进去
3. **把画面拉回"人物主导"**——这是「PPT 感」的来源

**A/B 实测（SC03-SH01，同镜同参考图，唯一变量是复述量）**

| 指标 | fat（413 词，含 218 词复述） | slim（205 词） |
|---|---|---|
| 景别 | 中近景俯视，**人物占主导** | **近景，账本是主体** |
| 运动方向平滑占比 | **4.1%**（方向抽搐） | **41.0%** |
| 有效运动帧 | 87.8% | **100.0%** |
| 近乎静止帧 | 2.4% | **0.0%** |

**瘦身后的分工**：

```
参考图 = 身份与外观（脸、发型、服装、道具、空间）
提示词 = 这一刻发生什么 + 光 + 表演 + 运镜 + 声音
```

`subject_definitions` 的正确写法：

```
<Picture 1> the ledger, exactly as shown.
<Picture 2> the girl, exactly as shown.
<Subject 1> the ledger from <Picture 1> — the same object, the same material and the same size.
<Subject 2> the girl from <Picture 2> — strictly the same person, the same face and the same clothes.
```

**实测的实现要点**：
- 画质不变，但**景别与运动品质变好**——复述越多，模型越把画面理解成"人物肖像"，越容易拍成 PPT
- 提示词总量降到 ~200 词，人能读懂、能手改（v1 的 664 词没人愿意改）
- 画外声音角色（没有参考图）要写成**独立声部**并明说"不在画面里"，
  不要塞进 `<Subject>`。v1 把画外音整句丢了，连主题句「主角，回家吃饭了」都没写进去

### 正文必须全英文 ⚠️（2026-11-15 A/B 实测）

R17「提示词正文必须全英文」**有实质价值**，但价值不在审美，在**画面内容**：

| 臂 | 结果 |
|---|---|
| slim EN | ✅ 账本上是模糊笔迹，看不出内容 |
| slim ZH | ❌ **账本上出现可辨认的汉字**（「刘文贵」等） |

中文版让模型真的去写汉字——**直接违反「那一栏永远是空的」这一剧本设计**。
→ **视频提示词正文一律用英文**；画面里必须出现的中文（如道具上的「主角」「哥哥」）用双引号原样写出。

### Camera 段要写全：起点景别 → 终点景别 → 跟住哪个动作 → 时序 ⚠️

**只写 `Push In with small amplitude at slow speed`，模型会跑成拉远。**
A/B 三臂里两臂都跑反（trend −0.323 / −0.194），只有中文臂跑对（+0.084）——
**说明这是既有缺陷，不是瘦身造成的**（v1 的短形式 Camera 段同样跑反）。

正确形式（v1 手写的 SC02-SH02 就是这个形式，而它是全片唯一通过验收的运镜镜）：

```
Camera: At 00:01.000, the camera begins a slow push in with small amplitude from the
two-shot across the counter toward the girl, the framing tightening gradually from a
medium two-shot to a medium close view of her at the ledger, continuous and smooth,
the whole shot one continuous take with no cut.
```

**要素**：① 起始景别 ② 终止景别 ③ 跟住哪个动作 ④ 起止时间点 ⑤ 连续不切

`shots.json` 的 `motion_action` / `motion_reason` 两字段已经写好了这些信息
（例：「推近跟手撤出——手走远了才需要推近补足构图」），
**但还没被用进提示词**——这是下一步要补的（45 句翻译）。

### 音色控制（7 探针实测结论）

- **每条镜头逐字复制同一段音色描述词**（`voice_desc`），不要每条现写。
- **但语气逐句另写**（`delivery`）——见上方「音色描述词逐字复用，但语气必须逐句另写」。
- `reference_audios` **不要用来做音色控制**——两种接法实测均失败（参考 201Hz 与默认仅差 0.12 半音，等于被忽略）。
- H3 原生音轨的音色**每条都不一样**（换台词/换场景/加描述词的差异都达随机波动的 2 倍以上）。**必须逐条人工比对**，跨镜头音色一致只能靠人工挑片重来。

---

## 3.5 表演纪律（2026-11-12 实测确立，R18）

> 用户判定：SC02「连喊三声十九 + 一声在」画面与声音「完全在两个宇宙」，
> 两人毫无情绪、毫无波澜、毫无动作，「只够坐在有声书的那一桌」。
> **主因在剧本层**，分镜与提示词是放大器。提示词层能救的有限——
> 剧本没写的表演，模型拍不出来。

### 提示词层能做什么（三件事）

**① 把「没动作」翻成「压住的动作」**

剧本写「她没抬眼」→ 提示词里**不能**照抄这句话，要翻成可见动作：

```text
✗ She does not look up.                    ← 明确指令：不要抬眼
✓ Her gaze rests on the ledger for a beat, then drops back to the page.
```

剧本写「笔没停」→ `The brush tip presses into the paper and stops for half a beat before it moves on.`

**② 沉默必须写成有内容的动作**

实测一镜 6.58 秒里念白只占 1.8 秒，**其余 4.8 秒是零内容沉默**。
沉默那几秒要写清楚人物在干什么：

```text
Between the second call and the third, she holds the brush suspended a hair above
the page; her breathing stops for a moment; the shopkeeper's thumb tightens on the
brush rest.
```

**③ 重复台词的语气要写成阶梯**

同一句「十九」重复三次，若语气一致 = 机器复读。三段递进：

```text
Call 1 — quiet, like a number being checked off; the last syllable does not lift.
Call 2 — heavier, with restrained anger pressing the last syllable down.
Call 3 — slow, the tail held down as if he has been waiting a long time.
```

### 提示词层做不到什么

- **写不出剧本里没有的戏。** 剧本动作行写「始终没抬眼」，提示词写得再细也是木头人。
- **别指望一镜塞下太多。** 6 秒装不下「三声 + 一声 + 反应 + 停顿」——
  加长到 8 秒，或拆成两镜。**不要塞**。
- **别在提示词里硬造运镜来救表演。** R14 说了：推近与主体动作同镜会互相竞争。

### 提交前自查

```bash
python tools/drama.py beat-qc --work <work-id> --scene SC02
```

反应拍覆盖率 <50%、有否定式表演词、台词缺 `delivery` → **先退回剧本阶段改**，
不要在提示词层硬救。体检只报问题，**怎么改成有戏是编剧的活**。

---

## 4. 提交（幂等三步，顺序不能颠倒）

H3 V2 API **没有幂等键，重复提交 = 重复扣费**。

```bash
# ① 先落台账（生成请求指纹）—— CLI 负责唯一性
python tools/drama.py task add --shot SC01-SH01 \
  --model MiniMax-H3 --resolution 768P --duration 6 --ratio 16:9 \
  --prompt-sha256 <提示词文件 sha256> --cost 0.48

# ② 提交（付费，一次）
mcode-tools connector call connector__matrix__submit_video_generation --args-file <args.json>

# ③ 立刻回写 task_id —— 中断也查得到
python tools/drama.py task record SC01-SH01 --task-id <id> --status submitted
```

**超时或网络失败时：先查台账和 provider 任务列表，绝不直接重发。**

提交前把提示词落盘并登记（命名 `<shot-id>.prompt.txt`）：

```bash
python tools/drama.py asset add prompts/SC01-SH01.prompt.txt --type prompt --shot SC01-SH01
```

**一次提交 N 个镜头，不要一个一个提交**——省时间也省上下文。

---

## 5. 轮询（单轮询器管全部）

```bash
python tools/drama.py poll --work <work-id>
```

每 30 秒查一遍所有未完成任务，全部进入终态后统一退出。

**不要**为每个任务开一个独立轮询器——实测单轮询器管 3 个任务更省资源、状态更集中。**更不要并发跑多个轮询器**，会互相覆盖台账。

H3 实测约 2 分钟/条（远快于官方文档所称 15–30 分钟）。单会话可完成 10–15 个镜头，但仍不建议一次提交 30 个以上。

---

## 6. 下载与登记

```bash
python tools/drama.py asset add videos/SC01-SH01_v01.mp4 \
  --type video --shot SC01-SH01 --task-id <id> --cost 0.48
```

视频文件名固定 `<shot-id>_v<NN>.mp4`，版本号从 01 起、只增不改，**废片也保留**（用于对比）。

---

## 7. 失败处理

| 现象 | 处理 |
|---|---|
| 提交超时 / 网络报错 | **不重发**。查台账 + provider 任务列表，确认是否已提交 |
| **提交返回 402（额度不足）** | **① 立刻清掉台账里的占位条目**（`task_id=null`、状态 `submitting` 的那条）——它会一直占住额度，不清后续提交继续被拒；**② 查清是总量还是单条**：M Plan 周额度是**总量约束**，把时长从 8 秒降到 7 秒也过不了；**③ 别反复重试**，额度不会因为重试而回来 |
| 轮询连续失败 20 次 | 停止轮询，人工介入，**不重新提交** |
| 角色一致性崩了 | 改提示词（先查主体定义与描述是否矛盾），新版本 `_v02`，旧文件保留 |
| 音色不对 | 逐条加/改音色描述词重生成；**不要**用后期变速变调去凑统一 |
| 道具跑到别处 | 给道具单独准备清晰参考图，重新生成 |
| **画面像会动的 GIF**（静止占比高 / 相机零位移） | 查提示词里有没有写死静止的词（`static` / `never moves`）→ 全部删掉 → 补明确运镜（幅度+速度+路径）与主体动作 → 重生成。**不要用后期救**（实测 tmix/插帧只会让静止占比从 61% 升到 80%/89%） |
| **画面在动但没戏**（像有声书 / 两人毫无情绪） | **先退回剧本层查**：`drama.py beat-qc`。否定式表演词要翻成压住的动作，重复台词要拆语气阶梯，沉默要写内容。提示词层只能翻译剧本，**剧本没写的表演模型拍不出来** |
| 预算超了 | 停下问人，不要自行继续 |

**生成后必跑运动质量验收**（R15）：

```bash
python tools/motion_qc.py videos/<shot-id>_v01.mp4
```

`drama verify` 已内置该判定：近乎静止帧 >70% / 有效运动帧 <40% / 累计运动量 <8/秒 → FAIL。

---

## 8. 边界

- 本阶段**只管镜头视频**。验收判定在 drama-verify，粗剪拼接在 drama-assemble。
- 提交后**立刻回写 task_id**——这是唯一的中断后恢复依据。
- 不擅自改 `shots.json` 的分镜设计来"迁就"生成结果；分镜要改就退回 storyboard 阶段。
