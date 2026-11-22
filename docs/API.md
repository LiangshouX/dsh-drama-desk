# Host ⇄ Client 契约

> 这份文件是**接口的唯一真源**。Host 半边（`src/host/**`）与 Client 半边
> （`client.js`）各自照它实现；改接口先改这里。
>
> 路由前缀：`/drama-desk/api`（JSON）与 `/drama-desk/<asset>`（二进制）。
> 传输层只做搬运，业务逻辑全在 `src/host/service.js` 的方法里
> （见 `AGENTS.md` §5「一个操作，两个调用者」）。

---

## 0. 通用约定

### 0.1 包封

```jsonc
// 成功
{ "ok": true, "data": { /* ... */ } }
// 失败
{ "ok": false, "error": "人话原因", "gaps": ["可选的缺口列表"] }
```

客户端 `apiGet` / `apiPost` 已经把 `data` 拆出来；`ok === false` 直接抛
`new Error(body.error)`。

### 0.2 查询参数

| 参数 | 必填 | 说明 |
|---|---|---|
| `workspace` | 否 | 作品 id。缺省用服务端记住的 `selectedWorkspaceId`。 |
| `stage` | 按端点 | 阶段名（见 §1 阶段枚举）。 |

### 0.3 revision（防重渲染）

每个返回视图都带一个 `revision` 字符串。客户端比对后**相同就跳过 setState**。
revision 由**文件 mtime + size** 派生，不含时间戳，所以「什么都没变」时它不变。

| 视图 | revision 覆盖的文件 |
|---|---|
| `overview` | 路径解析结果 + 配置 + 作品列表 |
| `pipeline` | `work.json` `state.json` `scenes.json` `shots.json` `characters.json` `assets.json` `ledger.json` + 提示词产物数 + 体检器数 |
| `stages` | 同上 |
| `settings` | 配置 + provider 列表 + 宿主模型 |
| `stage` | 该阶段触及的文件（见各阶段定义） |
| `shot` | `shots.json` + `scenes.json` + 该镜的提示词 + 体检结果 |
| `sessions` | 短剧项目总根之内的会话清单（见 §7.5）——**不带 revision**：它是宿主的会话目录，不是磁盘派生的 |

### 0.4 阶段枚举

```
conceive → outline → characters → script → storyboard
         → generate → verify → assemble → deliver
```

顺序来自数据契约 §4，由 `src/host/stages.js` 的 `stageOrder(spec)` 解析。

---

## 1. 阶段视图：`GET /stage`

```
GET /drama-desk/api/stage?workspace=<id>&stage=<stage>
```

返回：

```jsonc
{
  "ok": true,
  "data": {
    "stage": "characters",
    "revision": "characters.json:1234:5678",
    "kind": "characters",     // 与 stage 同名，客户端据此选组件
    "data": { /* 见下 */ }
  }
}
```

`kind` 的九种取值与 `data` 的形状：

### 1.1 `conceive` —— 创意简报

```jsonc
{
  "kind": "conceive",
  "revision": "creative/brief.md:1234:890",
  "data": {
    "brief": {
      "exists": true,
      "path": "creative/brief.md",
      "text": "# 简报…",
      "bytes": 1234,
      "updatedAt": "2026-11-15T10:00:00Z"
    },
    "work": { "id": "<work-id>", "title": "「示例作品」",
              "createdAt": "…", "notes": "" }
  }
}
```

### 1.2 `outline` —— 场次骨架

```jsonc
{
  "kind": "outline",
  "revision": "scenes.json:…",
  "data": {
    "scenes": [
      {
        "id": "SC01", "index": 1, "act": 1,
        "title": "旧物店清晨",
        "function": "建置",
        "duration": 20,
        "summary": "…",
        "turn": "…",
        "characters": ["aling", "shopkeeper"],
        "beatCount": 3
      }
    ]
  }
}
```

### 1.3 `characters` —— 角色卡 / 道具卡 + **每张参考图的提示词与参数**

```jsonc
{
  "kind": "characters",
  "revision": "characters.json:…|assets.json:…",
  "data": {
    "characters": [
      {
        "id": "aling", "name": "阿铃", "role": "主角",
        "age": "17-18",
        "appearance": "…", "behavior": "…", "voice": "…",
        "states": ["dry"], "props": ["prop_bell"],
        "voice_desc": "…", "delivery_default": "…",
        "reference_assets": ["aling_dry_full"],
        "assets": [
          {
            "id": "aling_dry_full",
            "type": "reference_image",
            "path": "refs/aling_dry_full.png",
            "role": "aling", "state": "dry",
            "tags": ["full", "front"],
            "width": 1792, "height": 2400, "bytes": 5767159,
            "source": "minimax-h3-image",
            "notes": "湿身状态基准参考图",
            "prompt": "该图对应的生图提示词正文",
            "hasPrompt": true,
            "deprecated": false
          }
        ]
      }
    ],
    "props": [
      { "id": "prop_bell", "name": "铜铃", "appearance": "…",
        "owner": "aling", "reference_assets": ["prop_bell"],
        "assets": [ /* 同上 */ ] }
    ]
  }
}
```

- `prompt` 的来源优先级：① 资产自身的 `prompt` 字段 → ②
  `<work>/prompts/refs/<assetId>.prompt.txt` → ③ 空串。
- 没有提示词时 `hasPrompt:false`，界面显示「无提示词」而不是空白。

### 1.4 `script` —— 表演层（beats）

```jsonc
{
  "kind": "script",
  "revision": "scenes.json:…",
  "data": {
    "scenes": [
      {
        "id": "SC02", "title": "柜台后擦账本", "duration": 21,
        "summary": "…",
        "qc": { "verdict": "FAIL", "issues": ["…"], "reactionRate": 0.5,
                "silenceRatio": 0.4, "dialogueBeats": 3, "reactionBeats": 2 },
        "beats": [
          {
            "n": 1,
            "action": "…", "speaker": "shopkeeper", "text": "十九。",
            "mode": "dialogue", "delivery": "第一声，轻…",
            "issues": ["否定式表演词：始终没抬眼"]
          }
        ]
      }
    ]
  }
}
```

`issues` 来自体检器（`beat_qc`），**阈值不在插件里**。

### 1.5 `storyboard` —— 分镜清单

```jsonc
{
  "kind": "storyboard",
  "revision": "shots.json:…|scenes.json:…",
  "data": {
    "shots": [
      {
        "id": "SC01-SH01", "scene": "SC01", "index": 1,
        "title": "抽屉里的旧契",
        "duration": 5, "ratio": "16:9", "resolution": "768P",
        "model": "MiniMax-H3",
        "camera": "Push In", "camera_en": "…",
        "lighting": "day_paper",
        "characters": ["aling"], "references": ["hero_face"],
        "status": "succeeded", "current_version": 1,
        "notes": "…", "motion_action": "…",
        "summary": "这一镜要表达什么（人话摘要）",
        "qc": { "verdict": "PASS", "issues": [] }
      }
    ]
  }
}
```

`summary` 的派生顺序：① `shot.summary` → ② `shot.description` →
③ `motion_action` → ④ 覆盖到的 beats 的 `action` 拼接 → ⑤ 空串。

### 1.6 `generate` —— 生成台（网格 + 产物）

```jsonc
{
  "kind": "generate",
  "revision": "…",
  "data": {
    "scenes": [
      {
        "id": "SC01", "index": 1, "title": "…",
        "summary": "…", "duration": 20, "beatCount": 3,
        "qc": { "verdict": "…", "issues": [] },
        "shots": [
          {
            "id": "SC01-SH01", "scene": "SC01", "index": 1,
            "title": "抽屉里的旧契",
            "summary": "这一镜要表达什么",
            "duration": 5, "ratio": "16:9", "resolution": "768P",
            "camera": "Push In", "lighting": "day_paper",
            "status": "succeeded",
            "qc": { "verdict": "PASS", "issues": [] },
            "prompt": { "exists": true, "stale": false, "overridden": false,
                        "words": 210 },
            "video": { "assetId": "SC01-SH01_v01", "bytes": 995608,
                       "durationSec": 5.167, "width": 1344, "height": 768 },
            "poster": { "asset": "hero_face" }   // 或 { "shot": "SC01-SH01" }
          }
        ]
      }
    ],
    "counts": { "none": 3, "generated": 1, "warn": 0, "fail": 1, "pass": 2 },
    "specAvailable": true
  }
}
```

- `poster`：`{shot}` 表示走 `/drama-desk/poster`（从关键帧或视频抽帧）；
  `{asset}` 表示直接用现成图片资产当封面；两者都缺则客户端画排版封面。
- `prompt.words`：提示词词数（前端显示体量）。
- `video`：该镜当前版本的视频资产摘要；没有则省略。

### 1.7 `verify` —— 验收

```jsonc
{
  "kind": "verify",
  "revision": "verify/:…|shots.json:…|assets.json:…",
  "data": {
    "shots": [
      {
        "id": "SC01-SH01", "scene": "SC01", "title": "…",
        "status": "verified",
        "verdict": "pass",
        "report": {
          "tech": { "durationSec": 5.167, "width": 1344, "height": 768,
                    "ratioCheck": "16:9", "hasAudio": true,
                    "meanVolume": "-18.6dB", "maxVolume": "-0.7dB",
                    "pass": true },
          "semantic": { "note": "…", "dialogueMatch": true,
                        "lipsync": "unclear", "camera": "…",
                        "characterMatch": true },
          "human": { "verdict": "pass", "reviewer": "QWQ",
                     "checkedFrames": ["first", "last"],
                     "issues": [] },
          "motion": { "stillRatio": 0.0, "motionRatio": 0.97,
                      "smoothness": 0.43, "amount": 119.96,
                      "verdict": "PASS" }
        },
        "qc": { "verdict": "PASS", "issues": [] }
      }
    ]
  }
}
```

`human` 段**必须人工填写**才能把 `verdict` 定为 `pass`（契约 §9）。

### 1.8 `assemble` —— 装配

```jsonc
{
  "kind": "assemble",
  "revision": "assets.json:…|ledger.json:…|shots.json:…",
  "data": {
    "shots": [
      { "id": "SC01-SH01", "scene": "SC01", "title": "…",
        "status": "verified", "duration": 5,
        "versions": [ { "assetId": "SC01-SH01_v01", "version": 1,
                        "bytes": 995608, "durationSec": 5.167,
                        "width": 1344, "height": 768,
                        "createdAt": "…", "source": "MiniMax-H3",
                        "costUsd": 0.40, "current": true } ],
        "hasAudio": true, "gap": false }
    ],
    "totals": { "shots": 7, "seconds": 45.2, "costUsd": 2.8 },
    "gaps": ["SC03-SH01 没有视频资产"]
  }
}
```

### 1.9 `deliver` —— 交付

```jsonc
{
  "kind": "deliver",
  "revision": "assets.json:…|ledger.json:…",
  "data": {
    "finals": [
      { "assetId": "SC01-SH01_final", "path": "videos/…_final.mp4",
        "bytes": 995608, "durationSec": 5.167, "costUsd": 0.40,
        "createdAt": "…" }
    ],
    "totals": { "shots": 7, "seconds": 45.2, "costUsd": 2.8 },
    "ready": false,
    "blockers": ["没有登记成片（视频资产路径含 final）"]
  }
}
```

---

## 2. 阶段预览与提交（**核心语义**）

### 2.1 规则

> **点阶段节点 = 切视图，不改状态。只有在该阶段里改了东西，才把进度状态推进到那一阶段。**

所以：

- 客户端**不**在切阶段时调用 `set-stage`。
- 客户端维护两个概念：
  - `committedStage` —— 服务端 `state.json` 里的阶段（真相）。
  - `viewStage` —— 当前正在看的阶段（本地状态，可能是预览）。
- 任何**写操作**（改 beat / 改镜 / 改场景 / 改角色 / 改简报 / 改提示词 / 写批注 /
  写验收）成功后，客户端把 `viewStage` 作为 `stage` 一起发给 Host；
  Host 在写盘之后**尝试**把 `state.json` 的阶段推进到该阶段。

### 2.2 推进的判定

- **回退**（`viewStage` 在 `committedStage` 之前）：契约明写「允许回退」，直接推进。
- **正向**：按契约 §11.2 逐段校验前置条件。**不满足也照样保存内容**，
  只是阶段不推进，并在返回里说明原因：

```jsonc
{
  "ok": true,
  "data": {
    "saved": true,
    "stage": { "from": "generate", "to": "outline",
               "advanced": false,
               "reason": "前置条件不满足，不能推进到 outline",
               "gaps": ["creative/brief.md 是空的"] }
  }
}
```

> 保存与推进**分离**：内容永远不因为状态机被挡而丢失。

### 2.3 阶段条

`GET /stages`（在 `/snapshot` 里）返回：

```jsonc
{
  "ok": true,
  "data": {
    "committed": "generate",
    "order": ["conceive", "outline", "…"],
    "stages": [
      { "stage": "generate", "index": 5, "state": "current",
        "requirement": "每个镜头都有 duration 与 camera",
        "satisfied": true, "gaps": [], "rollback": false, "advance": false }
    ]
  }
}
```

客户端渲染规则：

- `state === 'current'` → 实心高亮（**已提交的进度**）。
- `viewStage !== committedStage` 时，被预览的那一枚 → **描边高亮** +
  一枚「预览中」提示；旁边的已提交阶段保持实心。
- 预览态下不弹确认框、不发请求。**没有第二次点击。**

---

## 3. 产物与媒体

### 3.1 图片：`GET /drama-desk/image?workspace=&asset=<id>`

返回 JPEG/PNG，**最长边 ≤1200px**（服务端强制，见 `src/tools/safe_image.py`）。
响应头带 `x-image-max-edge: 1200`。

### 3.2 视频：`GET /drama-desk/video?workspace=&asset=<id>`

支持 HTTP Range（`206 Partial Content`），可以拖动进度条。

### 3.3 封面：`GET /drama-desk/poster?workspace=&shot=<shotId>`

给网格用的静帧。解析顺序：

1. `<work>/keyframes/<shotId>.{png,jpg,jpeg}`
2. `<work>/.frames/<shotId>.jpg`
3. `<work>/frames/<shotId>.jpg`
4. 该镜的视频资产 → **ffmpeg 抽第 1 帧**（`-ss 0.1`），缓存到
   `<work>/.frames/<shotId>.jpg`
5. 都没有 → `404`，客户端画排版封面（镜号 + 标题 + 运镜 + 影调）。

> `.frames/` 是**缓存目录**，不是资产，不需要登记进 `assets.json`。
> 缓存命中后直接读文件，不再跑 ffmpeg。

---

## 4. 提示词

### 4.1 读：`GET /prompt?workspace=&shot=<shotId>`

```jsonc
{
  "ok": true,
  "data": {
    "shotId": "SC01-SH01",
    "path": "prompts/slim/SC01-SH01.prompt.txt",
    "text": "subject_definitions:\n…",
    "exists": true,
    "stale": false,          // 与真源不一致（编译会改写）
    "overridden": false,     // 存在手工覆盖文件
    "words": 210,
    "generated": "…",        // 按真源编译出来的版本（供对比）
    "generatedWords": 210
  }
}
```

### 4.2 写：`POST /prompt`

```jsonc
// 请求
{ "workspaceId": "demo-pawnshop", "shotId": "SC01-SH01",
  "text": "……" }

// 响应
{ "ok": true, "data": { "saved": true, "overridden": true, "words": 214 } }
```

写入两处：

1. `<work>/prompts/slim/<shotId>.prompt.txt` —— 产物本体，界面立刻能看到。
2. `<work>/prompts/overrides/<shotId>.prompt.txt` —— **手工覆盖**，
   编译时优先于自动生成（见 `src/tools/compile_prompts.py`）。

### 4.3 丢弃手工覆盖：`POST /prompt-reset`

```jsonc
{ "workspaceId": "…", "shotId": "…" } → { "ok": true, "data": { "reset": true } }
```

删掉 `prompts/overrides/<shotId>.prompt.txt`，并重编译该镜（用真源）。

### 4.4 编译：`POST /compile`（已有）

```jsonc
{ "workspaceId": "…", "shotId": "…"(可选), "check": false, "dry": false }
→ { "ok": true, "data": {
    "changed": ["SC01-SH01"], "stale": [], "prompts": 7,
    "overridden": ["SC02-SH01"], "source": "plugin", "script": "…" } }
```

- `overridden` 列出**因为有手工覆盖而没有被改写**的镜。
- **找不到提示词生成器时不能崩**：返回 `{ ok: false, error: "…没有找到提示词生成器…" }`
  （而不是 Python traceback）。

---

## 5. 设置

### 5.1 读：`GET /settings`（也在 `/snapshot` 里）

```jsonc
{
  "ok": true,
  "data": {
    "projectRoot": "D:/Default/Videos/drama-desk-demo",
    "projectRootReason": "配置里指定的",
    "projectRootSource": "config",
    "outputRoot": "D:/Default/Videos",
    "outputRootReason": "Windows「视频」已知文件夹",
    "outputRootSource": "known-folder",
    "onSystemDrive": { "project": false, "output": false },
    "adapter": "minimax",              // 规范模型适配（铁律来源）
    "adapters": [
      { "id": "minimax", "label": "MiniMax H3",
        "rules": "build/spec/models/minimax/rules.md", "available": true }
    ],
    "generation": { "provider": "minimax", "model": "MiniMax-H3" },
    "providers": [
      { "id": "deepseek", "name": "DeepSeek", "configured": true,
        "models": [ { "id": "deepseek-chat", "name": "DeepSeek Chat" } ] }
    ],
    "hostModel": { "provider": "deepseek", "model": "deepseek-chat",
                   "reasoningEffort": undefined },
    "picker": { "kind": "native" },     // 或 { "kind": "browse" }
    "autoRefresh": 4000,
    "revision": "…"
  }
}
```

- `providers` 来自宿主的 `ctx.llm.listProviders()` / `listModels(provider)`，
  **真实读取宿主已配置的模型**，不是插件自造的一份。
- `hostModel` 来自 `ctx.get('agentDefaultModel').currentSelection()`。
- `picker.kind` 来自 `ctx.get('directoryPicker').capability().kind`。

### 5.2 写：`POST /update-settings`

```jsonc
{ "projectRoot": "…", "outputRoot": "…", "adapter": "minimax",
  "generationProvider": "minimax", "generationModel": "MiniMax-H3",
  "hostProvider": "deepseek", "hostModel": "deepseek-chat",
  "hostReasoningEffort": "high",
  "autoRefresh": 4000 }
```

- 路径 / adapter / generation / autoRefresh → 走 `configEditor.edit()` 写插件配置。
- host 模型 → 走 `ctx.get('agentDefaultModel').saveSelection()`。
- `hostReasoningEffort` → 同一个 `saveSelection()` 的 `reasoningEffort`。
  **没给就保持原样**（以前只写 provider/model，把用户在 DSH 里选好的推理等级
  悄悄抹掉了）；给空串表示「回到模型默认」。

---

## 6. 目录选择

### 6.1 原生选择器：`POST /pick-folder`

```jsonc
{ "target": "projectRoot" }   // 或 "outputRoot"
→ { "ok": true, "data": { "path": "D:/…", "cancelled": false } }
```

宿主有原生对话框时（`capability().kind === 'native'`）弹原生对话框。
**没有原生对话框时**返回 `{ "browse": true }`，客户端改用 §6.2 的内嵌浏览器。

### 6.2 内嵌浏览器：`GET /browse?path=<dir>`

```jsonc
{ "ok": true, "data": {
  "path": "D:/Default",
  "home": "C:/Users/X-L-S",
  "crumbs": [ { "name": "D:", "path": "D:/" } ],
  "entries": [ { "name": "Videos", "path": "D:/Default/Videos", "hidden": false } ],
  "truncated": false } }
```

### 6.3 新建目录：`POST /create-directory`

```jsonc
{ "path": "D:/Default/Videos", "name": "短剧" }
→ { "ok": true, "data": { "path": "D:/Default/Videos/短剧" } }
```

---

## 7. 作品

### 7.1 列表

`GET /workspaces`，或在 `/snapshot` 的 `overview.workspaces` 里：

```jsonc
[ { "id": "<work-id>", "title": "「示例作品」",
  "stage": "generate", "scenes": 4, "shots": 7, "seconds": 45,
  "dir": "D:/…/workspaces/<work-id>",
  "updatedAt": "2026-11-15T10:00:00Z" } ]
```

### 7.2 新建：`POST /workspace`

```jsonc
{ "action": "create", "id": "my-drama-20261116", "title": "我的短剧" }
→ { "ok": true, "data": { "id": "my-drama-20261116", "dir": "…" } }
```

新建的骨架（按契约 §1.2）：`work.json` `state.json`（stage=conceive）
`scenes.json` `characters.json` `shots.json` `assets.json` `ledger.json`
+ `creative/brief.md`（空）。

### 7.3 选择：`POST /workspace` `{ "action": "select", "id": "…" }`

---

## 7.5 构思会话：`/conceive-session`

> 「构思」不是一次性动作，是一个**持续的过程**：首页、conceive 阶段、写简报、
> 改简报，都在同一段对话里继续。所以这里给的是**一段真实 DSH 会话**，
> 不是插件自己画的聊天框。

### 读：`GET /conceive-session?workspace=<id>`

```jsonc
{
  "ok": true,
  "data": {
    "sessionId": "b70fd3e4-…",      // 还没有会话时缺省
    "live": true,                   // Host 上有活的 agent 才接得住消息
    "cwd": "D:/Default/Videos/drama-desk-demo",
    "workspacePath": "D:/Default/Videos/drama-desk-demo",
    "seed": "用 `drama-conceive` 技能开始…"   // 开场白，客户端随用户的第一条消息送出
  }
}
```

### 建：`POST /conceive-session` `{ "workspaceId": "…", "fresh"?: true }`

同上形状，外加 `created: true|false`。**幂等**：已有会话就恢复它（`agents.resume`），
活的就直接返回。

`fresh: true` = 开一段新对话：收掉当前 agent、清掉 `desk_session_id`、重开。
**旧会话不删**（它还留在 DSH 的会话列表里）。

### 工作区里的会话清单：`GET /sessions?workspace=<id>`

```jsonc
{
  "ok": true,
  "data": {
    "sessions": [
      { "id": "24eaed05-…", "title": "", "cwd": "D:/Default/Videos/DSH-DRAMA-DESK", "createdAt": 1794771973604 }
    ]
  }
}
```

- 只列 **cwd 落在短剧项目总根之内**的会话（AGENTS.md §15⑥：一个短剧项目 =
  一个 DSH 工作区）。别的项目的会话不混进来。
- 客户端**拿不到**完整会话目录（`ctx.sessions` 的客户端门面没有 `list`），
  所以这一条由 Host 半边出：`ctx.get('sessions').list()`。
- 用途：构思会话窗的「选择对话」——对话固定发生在这个工作区里，
  于是「换一个对话」就是在**这一个工作区**里换。
- 按 `createdAt` 倒序。宿主没有 `sessions` 服务时返回空数组（不是报错）。

### 开场白（`seed`）的第一行是锚

```
@workspaces/<work-id>/

用 `drama-conceive` 技能继续「…」的构思（目录 `workspaces/<work-id>/`）。
…
⚠️ 这个工作区里还有别的短剧项目：只读写 `workspaces/<work-id>/` 下的文件…
```

一个总根 = 一个 DSH 工作区，所有项目共用它，所以每段对话都要先用 `@路径`
把「这次只谈哪个项目」钉死——否则会串台。

### 开场白什么时候到

开场白的内容由 Host 单点生成（`src/host/conceive.js` 的 `seedMessage()`），
客户端**不自造第二份**。它是**上下文**、不是发言：

- 客户端进入阶段**不发送**任何东西——侧栏常驻，会话由用户点「开始对话」发起；
- 用户主动发出的**第一条**消息会带上这段开场白：用 `<system-reminder>` 框住，
  一起送出。模型读得到，界面上不显示（客户端在渲染前抹掉这个框）；
- 已经说过话的会话不再重复带（避免每条消息都拖一段前缀）。

### 硬规则

1. **会话必须挂在 DSH 工作区下。** 只给 `meta.cwd` 而工作区不存在时，
   这段对话在侧栏里找不到、在工作区的会话列表里也没有——
   用户只能从工作台的小窗看它。所以开会话之前先
   `workspaceRegistry.resolveByPath(projectRoot)`，没有就 `create()`。
2. **cwd = 短剧项目根**（不是作品目录），会话的 path 参数因此写成
   `workspaces/<work-id>/creative/brief.md`。一个短剧项目 = 一个 DSH 工作区。
3. **模型必须显式带上**：`agents.create()` 不接受「没有模型」，会直接拒
   `AgentOptions.provider and AgentOptions.model or record a model selection`。
   取 `agentDefaultModel.currentSelection()`。
4. **会话 id 记在作品的 `state.json`** 的 `desk_session_id` 上——关掉 DSH、
   换天回来还是同一段对话。
5. **技能由插件自己提供**：`ctx.skills.registerProvider()` 把
   `build/skills/*/SKILL.md` 注册进宿主技能目录（否则 `drama-conceive`
   这些名字对任何 agent 都不可达）。
   注册落在全局层，但 provider 用 `options.cwd` 过闸门：
   **只有 cwd 落在短剧项目总根之内的会话**能看到这些技能，
   其他工作区返回空目录。

---

## 8. 编辑端点

全部是 `POST`，统一请求形状：

```jsonc
{ "workspaceId": "…", "stage": "<viewStage>" }
```

`stage` 可选；给了就按 §2.2 尝试推进阶段。

| 端点 | 请求 | 作用 |
|---|---|---|
| `edit-beat` | `{sceneId, op:"patch"\|"insert"\|"delete"\|"move", beatIndex, toIndex?, patch?}` | 改 / 增 / 删 / 移一拍 |
| `edit-shot` | `{shotId, patch}` | 改镜头字段（**拒绝** `description_en` / `dialogue`） |
| `edit-scene` | `{sceneId, patch}` | 改场次骨架字段 |
| `edit-character` | `{characterId, patch}` | 改角色卡 / 道具卡字段 |
| `edit-brief` | `{text}` | 改 `creative/brief.md` |
| `edit-asset` | `{assetId, patch}` | 改资产的 `prompt` / `notes` / `state` / `tags` |
| `edit-verify` | `{shotId, patch}` | 改验收报告的 `human` 段 |
| `annotate-shot` | `{shotId, note}` | 写导演批注 |
| `prompt` | `{shotId, text}` | 写提示词（见 §4.2） |
| `prompt-reset` | `{shotId}` | 丢弃手工覆盖（见 §4.3） |

### 8.1 字段白名单

`edit-shot` 允许：`title` `duration` `ratio` `resolution` `model` `camera`
`camera_en` `lighting` `characters` `references` `notes` `status`
`motion_action` `motion_reason` `summary`。

`edit-scene` 允许：`title` `act` `function` `duration` `summary` `turn`
`characters`。

`edit-character` 允许：`name` `role` `age` `appearance` `behavior` `voice`
`states` `props` `reference_assets` `voice_desc` `delivery_default`
`prompt_label`（英文提示词标签）。

`edit-asset` 允许：`prompt` `notes` `state` `tags` `role`。

**派生字段不可写**：`description_en` `dialogue`（编译产物，改了会被覆盖）。

---

## 9. 预设（前端用，Host 只提供数据）

镜头的标准设定。**这些是取值枚举，不是规则**，写在客户端常量里：

| 字段 | 预置 |
|---|---|
| `ratio` | `16:9` `9:16` `1:1` `4:3` `3:2` `2.39:1` `21:9` `5:4` |
| `resolution` | `768P` `1080P` `2K` `4K` |
| `camera` | `Static Shot` `Push In` `Pull Out` `Zoom In` `Zoom Out` `Pan Left` `Pan Right` `Truck Left` `Truck Right` `Tilt Up` `Tilt Down` `Pedestal Up` `Pedestal Down` `Arc Shot` `Tracking Shot` `Shake Slightly` `POV` `Roll Clockwise` `Roll Counterclockwise` |
| `duration` | `4` `5` `6` `8` `10` `12` `15`（H3 合法区间 4–15，整数） |

> 预置只是**方便**，不满足时仍可手填。预置来自 H3 官方规格（见
> `build/spec/core/references/h3-官方提示词规范.md` §3.3 运镜词汇表）。

---

## 10. 错误约定

| 情况 | HTTP | `error` |
|---|---|---|
| 作品不存在 | 404 | `没有可用的作品` |
| 阶段未知 | 400 | `未知阶段 xxx` |
| 字段是派生字段 | 400 | `description_en 是派生字段，改它会被编译覆盖` |
| beat 序号越界 | 400 | `beat 序号越界：…` |
| 目录选择被取消 | 200 | — （`data.cancelled: true`） |
| 编译找不到生成器 | 200 | `data.ok:false` + `error`（**不是** traceback） |

---

## 11. 统计：`GET /stats`

给性能探针用（`scripts/render-probe.mjs`）。返回每个资源的请求次数。

```jsonc
{ "ok": true, "data": { "snapshot": 143, "overview": 24, "pipeline": 26 } }
```
