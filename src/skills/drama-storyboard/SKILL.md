---
name: drama-storyboard
description: AI 短剧/微电影的分镜阶段。把场次拆成镜头，逐镜定义时长、景别机位、参考资产绑定、角色状态与音频分层，产出 shots.json。当用户要拆分镜、排机位、规划镜头时长、绑定参考图或设计音轨分层时使用。不用于结构分场、角色美术、剧本台词、提示词写作或提交生成。
---

# drama-storyboard — 分镜表

**本阶段产出**：`workspaces/<work-id>/shots.json`（镜头清单）。

场次是叙事单位，镜头是拍摄单位。这一阶段把前者拆成后者，并且把**参考资产、角色状态、音轨需求**逐镜确定下来——因为这些一旦在生成阶段才发现缺失，返工的是钱。

---

## 0. 开工前

```bash
python tools/drama.py next --work <work-id>
python tools/drama.py constitution
python tools/drama.py scenes read --work <work-id>
python tools/drama.py characters read --work <work-id>
```

---

## 1. 场次 → 镜头

一场戏拆成 **2–5 个镜头**。拆镜原则：

- **一个镜头 = 一个主动作 + 一个主运镜**
- 支撑运动不能与之竞争（既推近又环绕 = 模型会乱）
- 场次里的**每个 beat 都要落到某个镜头**——不许有 beat 落空

镜头 id 规则：`SC01-SH01`、`SC01-SH02`……场次内连续编号，不跳号。

---

## 2. 景别与机位

**景别**：wide / full / medium / close / extreme close

**机位只用官方词汇**：Push In / Pull Out / Pan / Truck / Tilt / Arc / Tracking / Static

| 需求 | 组合 |
|---|---|
| 建立空间关系 | wide + Static |
| 情绪逼近 | medium + slow Push In |
| 交代道具细节 | close + Static |
| 空间关系改变 | Truck |
| 主体离开 | Pull Out |

**连续性**：同一场次内相邻镜头保持视线方向一致（180 度线）。跳轴会让观众瞬间失去方位感——这是短剧最容易犯的错，因为观众在竖屏手机上没时间重新建立空间。

---

## 3. 时长

- 纯动作镜头：**3–5 秒**
- 台词镜头：台词字数 ÷ 4.5 + 1 秒余量
- 场次内镜头时长之和 ≈ 场次 `duration`（±15%）

**关于 H3 的时长参数**：实测跑过 **5 秒与 6 秒**（音色实验用的 6 秒），**更短或更长的档位未验证**。所以：

- 分镜里按镜头节奏排时长，**不要在分镜里写死提交参数**
- 提交时实际用的 `duration` 以 API 为准，生成后由 verify 阶段核对实际时长偏差 ≤ 0.5s
- 需要短镜头时，**先用一个镜头验证该档位**，别一次压 30 个

---

## 4. 参考资产绑定

每个 shot 的 `references` 里**只能放同一 state 的参考图**。

绑定规则：

- 一个角色在一镜里只能有一个 state 的图
- 角色状态变了 → **换图，不是加图**
- 关键道具单独绑它的参考图
- 每个 id 都必须已在 `assets.json` 登记，且出现在 `characters[].reference_assets` 或 `props[].reference_assets` 里

同时写角色状态：

```json
"characters": [{"role": "aling", "state": "dry"}],
"references": ["aling_dry_full", "prop_benmingqi"]
```

> 为什么这么严：同一镜头混合互斥 state 的参考图，模型会取平均或偏向其一，状态就丢了。而状态丢失是**唯一真源级**的失败——三组对照实验证实，改对提示词里的主体定义后，参考图怎么配都正确；反过来，改对参考图但提示词自相矛盾，状态照样丢。**提示词与参考图必须同时对。**

---

## 5. 音频三层

```json
"audio": {
  "voiceover": false,
  "soundscape": "近景：笔尖划纸、纸页翻动；中景：街上脚步；远景：风铃",
  "music": "无"
}
```

- `soundscape` **至少两层**（近景 + 远景），只写能听见的
- `music` 克制，情绪推进时才进；多数镜头写"无"
- `voiceover: true` 时要说明画面里的角色嘴唇不动

## 5.1 光参数登记

每个镜头还要登记 `"lighting": "<preset 键>"`——这一镜用哪套光。

**为什么在分镜阶段定**：风格锚在生图端能继承光比，在 **H3 视频端会衰减一档**（实测线条更硬、
饱和更低、锚里的浮尘消失）。光必须在视频提示词里显式重建，而重建成什么样，取决于这一镜的
时间/空间/景别——这些是分镜阶段才知道的事。留给 generate 阶段临场决定 = 每镜各写各的，全片不一致。

- preset 键的含义与正文见 `prompts/lighting.py`（本项目）
- 通用项目：写清「时间 + 空间 + 主光方向 + 空气感」四要素即可
- 校验：`check_prompts_v2.py` 会核对提示词的 `Lighting:` 行与 preset 逐字一致

---

## 6. 与 H3 参数对齐

- `ratio`：**整片统一**（竖屏 9:16 / 横屏 16:9），不要一镜一变
  ⚠️ 实测只跑过 **16:9**；用 9:16 之前先用一个镜头验证
- `resolution`：768P
- `duration`：见 §3

---

## 7. 检查清单

镜头表**自读一遍**：

- 能讲出故事吗？
- 每个镜头的动作，能用**一个提示词**表达吗？（两三个动作塞一镜 = 生成时必糊）
- 有没有镜头的 `references` 混了 state？
- **连续镜头**的 state 对得上吗？（上一镜干身，下镜不能突然湿身）
- 场次 `duration` 和镜头时长之和差多少？
- 场次里的角色是不是都进了镜头的 `characters`？
- 有没有 beat 落空（beats 里的动作没被任何镜头覆盖）？
- 每一场的第一镜是不是建立了空间关系？

---

## 8. 落盘与交接

```bash
python tools/drama.py shots write
python tools/drama.py advance --stage generate --note "N 个镜头就绪"
```

---

## 9. 边界

- **不写提示词正文**——那是 generate 阶段。
- **不提交生成**。
- 不改场次结构与台词——要改就退回 script。
- 不在分镜阶段讨论音轨合成与 BGM（assemble 阶段）。
