---
name: minimax-drama
description: AI 短剧/微电影工作区的过渡技能，覆盖 verify、assemble、deliver 三个尚未拆分独立技能的阶段——技术参数自动验收与人工语义复核、ffmpeg 粗剪拼接与音轨分层、成片输出与归档。当工作区处于验收、剪辑或交付阶段时使用。conceive、outline、characters、script、storyboard、generate 阶段请改用对应的 drama-* 独立技能。
---

# minimax-drama — 过渡技能（3 个未拆分阶段）

> **这是过渡形态。** 整条流水线正在按阶段拆成独立技能，拆分后每个阶段只加载自己那一份。
>
> | 阶段 | 技能 | 状态 |
> |---|---|---|
> | conceive | `drama-conceive` | ✅ 已拆分 |
> | outline | `drama-outline` | ✅ 已拆分 |
> | characters | `drama-characters` | ✅ 已拆分 |
> | script | `drama-script` | ✅ 已拆分 |
> | storyboard | `drama-storyboard` | ✅ 已拆分 |
> | generate | `drama-generate` | ✅ 已拆分 |
> | verify | minimax-drama | ⏳ 待拆 |
> | assemble | minimax-drama | ⏳ 待拆 |
> | deliver | minimax-drama | ⏳ 待拆 |
>
> **开工第一步永远是** `python tools/drama.py next --work <id>`——它会告诉你该加载哪个技能、该遵守哪几条铁律、前置条件是否满足。`rules` 与 `references` 由 CLI 注入，不要凭记忆执行。

---

## 1. 硬规则去哪了

R1–R12 全部迁到 `spec/rules.md`（唯一真源），由 CLI 按阶段筛选后注入：

```bash
python tools/drama.py rules --stage verify
python tools/drama.py rules --ids R5,R12
```

改规则只改 `spec/rules.md`，不动任何 SKILL.md。

---

## 2. 阶段细则

### verify — 验收

**A 组 技术参数（可判废）**

```bash
python tools/drama.py verify videos/SC01-SH01_v01.mp4
```

| 检查项 | 通过标准 |
|---|---|
| 实际时长 | 与计划偏差 ≤ 0.5s |
| 分辨率 | 等于计划档位 |
| 宽高比 | 等于计划（偏差 ≤ 0.02） |
| 编码 | H.264/HEVC，无异常帧 |
| 音频流 | 必须存在 |
| 非静音 | mean_volume > -45dB |

A 组任一不通过 → 直接判废，不做人工评审。

**B 组 语义判定（仅作参考）**

用 `videos_understand` 检查：对白是否逐字一致、发声者是否正确、环境音是否匹配、口型是否同步、相机运动、年龄。**机器判定绝不作唯一判据**——实测中它对相机运动的判定不自洽，还会把人描述成与参考图不符的年龄。

**B 组不能只看一个工具（R19，2026-11-12 实测两个方向的误判）**

| 检查什么 | 用哪个工具 | 为什么 |
|---|---|---|
| 人声对白 | `listen_audio` | 逐字转写 |
| **音效 / 环境音** | **`videos_understand`** | ASR 会漏检音效 |
| **有没有对白** | **`listen_audio` 严格轮** | 宽松轮在低音量音轨上会**编造内容** |

**低音量镜头必须双轮 ASR**：

- 宽松轮（要人声 + 环境音）→ 查「听到了什么内容」
- 严格轮（只要人声、禁推测）→ 验「到底有没有人声」

```text
宽松轮 prompt：逐字转写这段中文音频里的所有人声对白，并单独列出听到的环境音与音效。如果没有人声对白，请明确说明「无对白」。
严格轮 prompt：只转写这段音频中真实存在的人声对白，逐字输出。如果确实没有人声，请只输出三个字：无对白。不要推测、不要解释、不要描述环境音。
```

**实测**：SH01 v03 宽松轮输出「照相机快门声 + 老照相馆旁白」，严格轮返回「无对白」——宽松轮是幻觉。
反过来 SH03 v03 的 ASR 只听到「脚步声」，但 `videos_understand` 明确听到了担子卸下、豆腐落台、布面摩擦三类音效——**ASR 漏检了**。
**两边都要跑，冲突时以严格轮（人声有无）与语义核查（音效）为准。**

**语义核查用平台视频 URL，不要用临时上传的 URL**——后者会长时间排队甚至超时
（实测本地 temp_url 版本 300 秒超时，同一视频换平台 URL 一次成功）。

**C 组 人工判定（必须）**

人工看首/中/尾三帧，确认：身份特征（发型/脸型/服装/体型）、服装状态（湿身镜头必须湿）、道具位置、**口型符合预期**、跨镜头是同一人、情绪到位、达到"生产可用级别"。

**机器与人工冲突时以人工为准。**

音色验收：**逐条人工比对**，不要相信机器测出的 F0 结论（伴奏会污染测量）。

### assemble — 粗剪

- ffmpeg 拼接片段、统一分辨率与帧率、混音轨、烧字幕
- 音轨分层：H3 原生音轨（对白+环境音）→ 独立 TTS（旁白）→ BGM
- **不要用后期变速变调去凑音色统一**——那会毁掉音质，且掩盖真实的不一致
- 字幕用 SRT，时间轴对齐镜头切点

### deliver — 输出与归档

- 成片命名 `<work-id>_final_v<NN>.mp4`
- 更新 `work.json` 的 `delivered_at`
- 运行 `python tools/drama.py verify-index --work <id>` 确认工作区完整

---

## 3. 数据契约

完整契约见 `spec/数据契约.md`。核心：

- 作品 `<slug>-<yyyyMMdd>`，场次 `SC01`，镜头 `SC01-SH03`，资产 `<shot-id>_v<NN>.<ext>`
- **版本号只增不改，废片也保留**（用于对比）
- `assets.json` 是唯一登记册，**未登记 = 不存在**
- `ledger.json` 是幂等核心，提交前先落台账
- `state.json` 由 CLI 独占写入，Agent 不手改
- 每次改动后运行 `drama verify-index` 校验完整性

---

## 4. 环境与坑位

| 坑 | 表现 | 解法 |
|---|---|---|
| PowerShell 下 `//` 不是合法 Python 注释 | SyntaxError | 用 `#` |
| subprocess 调 `mcode-tools`（.cmd 包装器） | WinError 2 | 加 `shell=True`，用 `shutil.which` 定位 |
| PowerShell `ConvertTo-Json` + `Set-Content` | 多行字符串转义坏、带 BOM | **JSON 一律用 Python `json.dump` 生成** |
| `$ErrorActionPreference = 'Stop'` | node 警告走 stderr 被当致命错误 | 保持 `Continue` |
| 控制台中文显示乱码 | GBK 显示问题 | 文件本身 UTF-8 正常，别误判 |
| 忘记登记资产 | 下游找不到上游 | 用 `drama asset add` |

---

## 5. 当前未解缺口

- **BGM**：MiniMax 付费 Music API 已于 2026-08-20 对新用户关闭。备选：MiniMax Music 3 开源权重、免版权曲库。**量产前必须解决。**
- **口型 + 确定性音色无法兼得**：独立 TTS 音色确定但丢失 H3 口型同步；能否让 H3 对外部音频对口型未验证。
- **角色年龄**：参考图人物偏少年相，模型会跟着走。
- **H3 竖屏 9:16**：实测只跑过 16:9，量产前需验证。
