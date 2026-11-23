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
| `model-info` | 一个模型的推理强度档位（见 §5.3）——**按需**：可能去问 provider，不进轮询 |

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
               "gaps": ["creative/brief.md 是空的"],
               "gapsSummary": "creative/brief.md 是空的" }
  }
}
```

> 保存与推进**分离**：内容永远不因为状态机被挡而丢失。
>
> `gaps` 是**全量**清单（agent 与阶段页要它）；`gapsSummary` 是同一批缺口的
> **一句话摘要**（去重，留前三条，末尾说清还有多少、涉及几个镜头 / 场次）。
> 72 镜的作品里缺口能上百条，toast 只该显示摘要——完整清单在阶段页里。

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
    "generationChannels": {
      "image": { "channel": "", "model": "" },      // "" / "inherit" = 继承宿主
      "video": { "channel": "connector-video", "model": "MiniMax-H3" },
      "custom": [ { "id": "my-video", "kind": "video", "label": "自制通道" } ]
    },
    "providers": [
      { "id": "deepseek", "name": "DeepSeek", "configured": true, "status": "active",
        "models": [ { "id": "deepseek-chat", "name": "DeepSeek Chat" } ] },
      { "id": "openai", "name": "openai", "configured": false, "status": "not-configured",
        "models": [] }
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
  **真实读取宿主已配置的模型**，不是插件自造的一份。`status: "not-configured"`
  的那些来自 `listConfigurableProviders()`：宿主声明过、但还没激活（没密钥 / 没启用）。
- `hostModel` 来自 `ctx.get('agentDefaultModel').currentSelection()`。
- `picker.kind` 来自 `ctx.get('directoryPicker').capability().kind`。
- **模型目录只在 `?full=1` 时读取**（设置抽屉打开时）：`listModels` 可能要去问
  provider，不能塞进每几秒一次的轮询。轮询拿到的是轻量版（只有 id / name）。
- `generationChannels` 是**配置值**；「这条通道现在能不能用、为什么不能」由
  `/channels` 现探——探测要读 PATH 与宿主模型目录，不属于设置读取。

### 5.2 写：`POST /update-settings`

```jsonc
{ "projectRoot": "…", "outputRoot": "…", "adapter": "minimax",
  "generationProvider": "minimax", "generationModel": "MiniMax-H3",
  "imageChannel": "", "imageModel": "",
  "videoChannel": "connector-video", "videoModel": "MiniMax-H3",
  "channels": [ { "id": "my-video", "kind": "video", "label": "自制通道", "model": "…" } ],
  "hostProvider": "deepseek", "hostModel": "deepseek-chat",
  "hostReasoningEffort": "high",
  "autoRefresh": 4000 }
```

- 路径 / adapter / 生成通道 / autoRefresh → 走 `configEditor.edit()` 写插件配置。
- `imageChannel` / `videoChannel`：`""` 或 `"inherit"` = **继承宿主**（用宿主已装好的
  连接器）；具体 id = 本插件指定的通道（自治）。`*Model` 留空 = 用通道自己的默认。
- `channels` 是自定义通道数组；**不存任何密钥**——密钥归宿主的凭据服务。
- 写完会作废通道探测缓存：配置改了，「这条通道可用吗」必须是新答案。
- host 模型 → 走 `ctx.get('agentDefaultModel').saveSelection()`。
- `hostReasoningEffort` → 同一个 `saveSelection()` 的 `reasoningEffort`。
  **没给就保持原样**（以前只写 provider/model，把用户在 DSH 里选好的推理等级
  悄悄抹掉了）；给空串表示「回到模型默认」。

### 5.3 一个模型的推理档位：`GET /model-info?provider=&model=`

```jsonc
{
  "ok": true,
  "data": {
    "provider": "m-plan",
    "model": "MiniMax-M3.1-Flash",
    "available": true,
    "efforts": [ { "id": "low", "name": "低" }, { "id": "high", "name": "高" } ],
    "defaultEffort": "high"
  }
}
```

推理等级**是每个模型自己的**（同一个 provider 下，A 模型给 low/high/max，
B 模型只给 medium），所以档位不能写死在插件里——问适配器：
`llm.resolveModelInfo(provider, model)`。

这条路径**可能去问 provider**，所以它是**按需**的：模型菜单打开时才问一次，
**不进轮询**。宿主没有这个模型 / 没答上来时，`efforts` 为空、`available: false`
（不是报错）。

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
  "draft": false,
  "updatedAt": "2026-11-15T10:00:00Z" } ]
```

`draft: true` = **草稿作品**：还没立项，名字（「未命名作品」）与目录 id
（`draft-<时间戳>`）都是暂定的。界面要标出来，并给一个「立项命名」的出口。

### 7.2 新建：`POST /workspace`

```jsonc
{ "action": "create", "id": "my-drama-20261116", "title": "我的短剧" }
→ { "ok": true, "data": { "id": "my-drama-20261116", "dir": "…", "draft": false } }

// 从零开始：不给 id / title，给 draft
{ "action": "create", "draft": true }
→ { "ok": true, "data": { "id": "draft-202611221430", "dir": "…", "draft": true } }
```

新建的骨架（按契约 §1.2）：`work.json` `state.json`（stage=conceive）
`scenes.json` `characters.json` `shots.json` `assets.json` `ledger.json`
+ `creative/brief.md`（空）。`draft: true` 时 `work.json` 多一个 `draft: true`。

### 7.3 立项（改名）：`POST /workspace` `{ "action": "rename", … }`

```jsonc
{ "action": "rename", "workspaceId": "draft-202611221430",
  "id": "moon-tide", "title": "潮信" }
→ { "ok": true, "data": { "id": "moon-tide", "title": "潮信",
                          "dir": "D:/…/workspaces/moon-tide",
                          "renamed": true, "from": "draft-202611221430" } }
```

- **改目录名**（不是另建一个再搬内容）：`workspaces/draft-…` → `workspaces/moon-tide`，
  同时改 `work.json` 的 `work_id`/`title`（并去掉 `draft`）与 `state.json` 的 `work_id`。
- **会话不受影响**：会话挂在 DSH 工作区上、cwd 是总根，与目录名无关，
  所以 `state.json` 的 `desk_session_id` 原样跟过去 —— 「先聊后立项」靠的就是这条。
- **资产不受影响**：资产的 `path` 相对**作品目录**，改目录名不动里面的引用。
- `id` 省略 = 只改标题（`renamed:false`）。撞名 / 不合法 / 作品不存在都如实报错；
  改不动目录就原样留在旧目录（`renamePath` 只重试「文件正忙」，不做「复制再删」，
  半途失败会把一个作品拆成两半）。

### 7.4 选择：`POST /workspace` `{ "action": "select", "id": "…" }`

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
    "cwd": "D:/Default/Videos/DSH-DRAMA-DESK",
    "workspacePath": "D:/Default/Videos/DSH-DRAMA-DESK",
    "dshWorkspace": { "id": "39be1fd2-…", "path": "D:/Default/Videos/DSH-DRAMA-DESK" }
  }
}
```

### 建：`POST /conceive-session` `{ "workspaceId": "…", "fresh"?: true }`

同上形状，外加：

| 字段 | 含义 |
|---|---|
| `created` | `true` 这一段是刚开的，`false` 是恢复/复用 |
| `attached` | **会话已挂进工作区的会话账本**（`sessionIds`）。`false` = 分组没成功，但会话照样能聊 |
| `seeded` | **作品范围已挂成这段会话的 prompt context**。`false` = 没挂上（`seedReason` 说原因），界面要如实提示 |
| `seedReason` | `'cold'` / `'host'` / `'rejected'`，见 `POST /conceive-scope` |

**幂等**：已有会话就恢复它（`agents.resume`），活的就直接返回。

`fresh: true` = 开一段新对话：收掉当前 agent、清掉 `desk_session_id`、重开。
**旧会话不删**（它还留在 DSH 的会话列表里），并**留在 `desk_session_ids` 里**——
那是「这段对话是哪部戏的」的台账（见上面的 `GET /sessions`）。

### 工作区里的会话清单：`GET /sessions?workspace=<id>`

```jsonc
{
  "ok": true,
  "data": {
    "sessions": [
      {
        "id": "24eaed05-…",
        "title": "",
        "cwd": "D:/Default/Videos/DSH-DRAMA-DESK",
        "createdAt": 1794771973604,
        "workspaceId": "demo-epic",        // 这一段是哪部戏的；缺省 = 不知道
        "workspaceTitle": "演示 · 潮信"
      }
    ]
  }
}
```

- **先按工作区的会话账本取**（`workspace.sessionIds`）——DSH 侧栏就是这么分组
  「DSH-DRAMA-DESK」这一组的，我们照同一个口径，才不会出现「侧栏里有、选不到」。
  拿不到账本（旧宿主 / 注册表没起来）才退回 **cwd 前缀匹配**。
- **`workspaceId` 是归属，不是 cwd**：会话的 cwd 是**总根**，所有作品共用，
  从它分不出作品。归属只认各作品 `state.json` 里的 `desk_session_id` /
  `desk_session_ids`（见 `service.sessionOwners`）。缺省 = 不知道（例如你在宿主
  侧栏直接开的对话）——那种会话**可以被当前作品接住**，挂上它的范围。
- 客户端**拿不到**完整会话目录（`ctx.sessions` 的客户端门面没有 `list`），
  所以这一条由 Host 半边出：`ctx.get('sessions').list()`。
- 用途：构思会话窗的「选择对话」——对话固定发生在这个工作区里，
  于是「换一个对话」就是在**这一个工作区**里换。
  **别的作品的对话在界面上是禁用项**（标注「属「演示 · 潮信」」）：
  选进来就等于把一段谈 A 的对话当 B 继续，那正是串台。
- **`title` 一般是空的，这不是 bug**：宿主的 `SessionHeader` 里**没有标题字段**——
  标题是 `session-title` 投影的产物（第一句话之后由宿主摘要生成）。
  客户端显示标题时读的是**宿主会话清单里的 `SessionSummary.title`**
  （`ctx.sessions.list` 快照，和侧栏同一来源），拿不到才退回 `会话 <id> · 时间`。
  所以别在这里自己拿第一句话摘要，会变成第二套标题。
- 按 `createdAt` 倒序。宿主没有 `sessions` 服务时返回空数组（不是报错）。

### 项目范围：每段会话都钉住「只谈哪个作品」

```markdown
# 当前作品（整段对话的固定范围）

- 作品名：「<作品名>」
- 目录 ID：`<work-id>`
- 路径：`workspaces/<work-id>/`（在本次工作区的总根之下）

这一页打开的就是「<作品名>」，它的目录 ID 是 `<work-id>`——这个对应关系不会变。
**只读写 `workspaces/<work-id>/` 下的文件**：不要读、不要改总根下别的目录，
也不要把别的作品的角色、剧情、镜头混进来。别的目录就是别的戏。

继续「<作品名>」的构思时用 `drama-conceive` 技能；要改稿就先读 `workspaces/<work-id>/` 里的文件。
```

**草稿作品（`draft: true`）多一段**，而且它与「刚建的新项目」那句不冲突：

```markdown
- 状态：**草稿（还没立项）** —— 名字与目录 ID 都是暂定的

这是一个**刚起的草稿**：导演还没想好要拍什么，先开了这段对话找方向。
所以先别急着写文件——把方向聊清楚（问三到五个真正影响故事的问题）。
方向定了导演会**立项命名**：那之后这一段换成正式的目录与名字，对话继续，不用重开。
在那之前，别把这个临时 ID 当成作品的正式身份到处引用。
```

一个总根 = 一个 DSH 工作区，所有项目共用它，所以每段对话都得钉死「这次只谈哪个项目」
——否则会串台。**作品名（人认的）与目录 ID（模型读写文件时认的）必须同时出现，
且对应关系不许变。**

**这段文字是给模型的，不是给导演的**，所以它走宿主的 prompt registry：

| 顺序 | 通道 | 表现 |
|---|---|---|
| ① | `agent.ctx.systemPrompt.context({ name:'drama-desk/project', order:40, text, required:true })` | 进模型历史：宿主把**本次所有** context 合成一条 user-role 消息（`<system-reminder>` 开头），对话流里**不显示正文** |
| ② | `agent.ctx.systemPrompt.section({ … })` | 进 system prompt：看不见，但模型一定读得到 |

注册在**这个 agent 自己的作用域**上，所以只有这一段会话带着它。

- **`text` 传的是函数，不是字符串**（宿主的类型是 `string | ((context) => string)`）：
  每一步装配都重取，改个作品名、题材变了，整段对话跟着走，不会停在开话时那一版。
- **谁被显示，就给谁挂上**——不是「开会话时装一次」。会话窗「选择对话」里的会话
  不全是工作台开的（你在宿主侧栏自己开的、插件重装前开的都在），那些从来没有过范围。
- **挂的位置是可跨插件重载的**：disposer 记在 `agent[Symbol.for('dsh-drama-desk/scope')]`
  上。宿主的 prompt registry 是进程级的——插件重装后我们这一代模块的 Map 全没了，
  而 agent 与它身上那条旧注册还活着；没有这个记号，重装后就会撞名字挂不上。
- **冷会话欠着**：会话还没有 agent 时（刚建的作品、宿主归档后又点开的对话），
  范围先记进 `coldScopes`，等宿主的 `agent/created` 一到就挂——那钩子**绝不抛**
  （它在宿主的会话创建链上，抛出去等于让一段对话开不起来）。

> **实测（2026-11-22，DSH 重启后）**：新建会话回报 `seeded:true`；问它
> 「这次对话只谈哪个项目的目录」，它答 `workspaces/demo-epic/` —— 说明上下文真的
> 到了模型。会话日志里它在 `seq 12` 的 `user/message` 中，和宿主的
> `reme-memory` / `runtime-context` **合并在同一条**里。
>
> **实测（2026-11-22 晚，改成「按会话挂」之后）**：拿一段**不是这次开的**会话
> （`demo-pawnshop` 的构思会话）直接问「作品名 / 目录 ID / 你只允许读哪个目录」，
> 它答「演示 · 当铺的旧契」/ `demo-pawnshop` / `workspaces/demo-pawnshop/`，
> 用时 1 秒、没调工具——范围确实每一步都在。
>
> 对话流里**看不到正文**（宿主只给自家 producer 列名——`上下文注入 reme-memory`、
> `上下文注入 runtime-context`，我们这条不列名）。所以**界面上另外画了一条范围条**
> （侧栏会话窗顶部的「只谈 演示 · 潮信 · demo-epic」）：模型读得到，导演看得见，
> 但别指望在对话流里找到它。
>
> 早期版本把它用 `<system-reminder>` 包着搭在用户第一条消息上、再由客户端抹掉，
> 结果是对话流里露出一整坨 instruction——那条路径**已废弃**（`seed` 字段也随之下线）。

### 按会话钉住范围：`POST /conceive-scope` `{ "workspaceId": "…", "sessionId": "…" }`

```jsonc
{
  "ok": true,
  "data": {
    "work": { "id": "demo-epic", "title": "演示 · 潮信", "path": "workspaces/demo-epic" },
    "current": { "id": "demo-pawnshop", "title": "演示 · 当铺的旧契" },
    "match": false,
    "seeded": true
  }
}
```

| 字段 | 含义 |
|---|---|
| `work` | 这一段会话**实际钉在**哪个作品上 |
| `current` | 工作台此刻打开的是哪个作品 |
| `match` | 两者是否同一个。`false` = 这段对话不是这一部戏的，界面要如实说 |
| `seeded` | 挂上了没有 |
| `reason` | `'cold'`（agent 还没出生，已记账等 `agent/created`）/ `'host'`（没有 systemPrompt）/ `'rejected'`（两条通道都拒了） |

- **幂等**：同一段会话反复调只换文本，不重复注册。
- **不写盘、不开会话**：它只给这段 agent 挂一段 prompt context。
- 客户端在**每次绑住一段会话**时调它（换作品、换对话、会话从冷变活各一次）。
- **归属优先于当前**：如果这段会话按台账属于**别的作品**，就按它自己的作品挂
  （`match:false`），绝不把当前作品的范围盖到别人的对话上——那会把一段谈 A 的
  对话引到 B 去。归属的出处是各作品 `state.json` 的
  `desk_session_id` 与 `desk_session_ids`（后者是新对话留下的历史，见 §7.5 的建会话）。

### 硬规则

1. **会话必须挂进工作区的会话账本。** 工作区有两个面：`path`（cwd 落在其下）与
   `sessionIds`（账本）。只做前者，会话会掉进侧栏的**「未分组」**——这正是用户报过的
   那个问题。所以 `resolveByPath()` 拿到 Workspace 实体后，**新开与恢复都要
   `workspace.attachSession(sessionId)`**；失败不许影响「这段会话能聊」。
2. **cwd = 短剧项目总根**（不是作品目录），会话的 path 参数因此写成
   `workspaces/<work-id>/creative/brief.md`。一个工作台 = 一个 DSH 工作区。
3. **模型必须显式带上**：`agents.create()` 不接受「没有模型」，会直接拒
   `AgentOptions.provider and AgentOptions.model or record a model selection`。
   取 `agentDefaultModel.currentSelection()`。开起来之后换模型 / 强度交给宿主的 composer。
4. **会话 id 记在作品的 `state.json`** 的 `desk_session_id` 上——关掉 DSH、
   换天回来还是同一段对话。
5. **技能由插件自己提供**：`ctx.skills.registerProvider()` 把
   `build/skills/*/SKILL.md` 注册进宿主技能目录（否则 `drama-conceive`
   这些名字对任何 agent 都不可达）。
   注册落在全局层，但 provider 用 `options.cwd` 过闸门：
   **只有 cwd 落在短剧项目总根之内的会话**能看到这些技能，
   其他工作区返回空目录。
6. **聊天界面用宿主的**：`renderFactorySlot('conversation.content', { variant:'embedded' })`。
   细节见 `docs/dev/dsh-integration.md` D1。

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
# 本地装配与制作任务（新增接口）

- `POST /api/add-record {workspaceId,kind,sceneId?,id?,fields?,stage?}` → `service.addRecord()`。kind=scene/character/prop/shot；场次与镜头自动连续编号，镜头按场次和镜号排序，角色 ID 固定且唯一。只添加真源字段；状态、派生字段拒写。界面新增表单和 `drama_desk_add` 共用此方法。
- `POST /api/register-asset {workspaceId,id,type,path,role?,shotId?,version?,source?}` → `service.registerAsset()`。只登记作品内已经存在的文件，计算实际 SHA256 与大小；视频音频由 ffprobe 实测。已有 ID 拒绝覆盖。`drama_desk_register_asset` 与资产页共用此方法。
- `drama_desk_edit` 是 brief/scene/character/asset 字段编辑的 agent 入口，分别调用既有编辑 service。`edit-shot` 切 current_version 时检查已登记的视频与文件，切换后清除旧验收状态；verified 只能由显式验收动作设置。
- `POST /api/approve-shot {workspaceId,shotId}` → `service.approveShot()`；对等工具 `drama_desk_review(approve=true)`。人工 pass、真实复核人、当前版本文件与人工复核版本必须齐备。

- `GET /api/production?workspace=…&stage=…` → `service.productionTask()`，只读返回本阶段的任务说明、出口文件、前置缺口与可复制的助手指令。不发消息、不推进阶段。
- `POST /api/assemble {workspaceId, profile}` → `service.assemble()`；profile 为 `landscape`（1280×720）、`portrait`（720×1280）、`square`（1080×1080），默认 landscape。只使用已验收镜头的当前有效版本，按 shots.json 顺序，本地 FFmpeg 统一为 24fps H.264/AAC 并顺切，缺音轨补静音。立即返回 `{ok, job}`；进度从 assemble 阶段载荷 `job` 读取。重复点击在同一进程内复用运行中任务。无网络生成、无费用。
- assemble 阶段新增 `ready / job / currentAssetId / gaps / warnings`；每镜新增 `videoAssetId / path / gapReasons / costUsd`。缺失历史版本不阻塞当前版本；缺失、作废或无法确定的当前版本阻塞装配。
- deliver 阶段的成片新增 `exists / stale / manifest / width / height`。新成片以 `purpose: final` 标识；兼容历史路径含 final 的资产，作废资产不作交付物。播放器使用既有 `/drama-desk/video`。
- `POST /api/confirm-delivery {workspaceId, assetId}` → `service.confirmDelivery()`；确认一条存在且来源未过期的成片，遵守原有逐阶段前置校验，记录 `state.json.delivery_asset_id` 并推进 deliver。重复确认同一成片幂等。
- agent 对等工具：`drama_desk_production`（stage 可选）、`drama_desk_assemble`（profile 可选）、`drama_desk_deliver`（asset 必填）。

# 生成控制面（0.3）

三件事：**能出片的通道是哪条**、**做到哪儿花了多少**、**下一批该提交什么**。
三者都只读：**插件不发起付费生成**，提交仍由 agent 走幂等三步。

## 通道：`GET /api/channels?host=1&refresh=1`

```jsonc
{
  "ok": true,
  "data": {
    "host": { "providers": [ { "id": "deepseek-account", "models": 4 } ],
              "reachable": true, "modelCount": 4 },
    "connectors": [
      { "id": "connector-image", "kind": "image", "label": "MiniMax H3 · 图片（连接器）",
        "tool": "connector__matrix__generate_image", "installed": false,
        "reason": "找不到 mcode-tools（连接器 CLI）：这条通道现在调不动" },
      { "id": "connector-video", "kind": "video", "…": "…" }
    ],
    "custom": [ { "id": "my-video", "kind": "video", "label": "自制通道", "installed": true } ],
    "selection": {
      "image": { "mode": "inherit", "available": false, "reason": "…" },
      "video": { "mode": "custom", "channel": "my-video", "available": true, "model": "…" }
    }
  }
}
```

- `mode: "inherit"` = **继承宿主**（用宿主已装好的连接器）；`"custom"` = 本插件指定的通道。
- `installed` 由宿主的 `subprocess.resolveExecutable("mcode-tools")` 判定；宿主没有
  `subprocess` 服务时**不猜**——如实标为不可用并给出理由。
- **`available` 与 `reason` 必须成对出现**：配置管理最怕「我配了但它其实调不动」。
- 结果按 service 缓存 30 秒；`refresh=1` 强制重探。

## 看板：`GET /api/generation-board?workspace=`

```jsonc
{
  "ok": true,
  "data": {
    "board": {
      "counts": { "total": 72, "done": 3, "pending": 3, "inFlight": 0, "failed": 0, "todo": 66 },
      "progress": 4,
      "budget": { "limitUsd": 30, "spentUsd": 2.24, "remainingUsd": 27.76, "perShotUsd": 0.4 },
      "forecast": { "shotsLeft": 66, "costUsd": 26.4, "seconds": 5544 },
      "speed": { "completed": 5, "avgSecondsPerShot": 84, "avgCostUsd": 0.448 },
      "images": { "references": 16, "keyframes": 6, "shotsWithKeyframe": 3 },
      "scenes": [ { "id": "SC01", "done": 1, "pending": 0, "todo": 5, "costUsd": 0.32 } ],
      "inFlight": [ { "shotId": "SC02-SH04", "status": "running", "elapsedSec": 120 } ],
      "recent": [ { "shotId": "SC07-SH02", "status": "succeeded", "seconds": 120 } ]
    }
  }
}
```

**口径（错了就是说谎）：**

| 计数 | 含义 |
|---|---|
| `done` | 有**当前视频资产**（能回看）。任务成功不等于这一条 |
| `pending` | 任务已成功 / 镜状态已生成，但还没下载登记成本地视频 |
| `inFlight` | 台账 `submitting / submitted / running` |
| `failed` | 台账 `failed`（且没有可用成片） |
| `todo` | 其余 |

- `progress = done / total`；`pending` 不算完成。
- 耗时从台账 `trajectory` 的 `submitted → succeeded/failed` 算；台账没有
  `succeeded_at` 时**不许**拿「现在」当完成时刻。
- 看板同时挂在生成阶段的载荷里（`stage=generate` 的 `board`），不额外发请求。

## 计划：`GET /api/generation-plan?workspace=&shots=&limit=`

```jsonc
{
  "ok": true,
  "data": {
    "channel": { "mode": "inherit", "available": false, "reason": "…" },
    "rows": [
      { "id": "SC01-SH01", "action": "skip",
        "reasons": ["同一份提示词已经生成过"], 
        "prompt": { "exists": true, "sha256": "f5f5…", "stale": false },
        "ledger": { "status": "succeeded", "promptSha256": "f5f5…" },
        "request": { "model": "MiniMax-H3", "duration": 4, "ratio": "16:9", "costUsd": 0.4 } }
    ],
    "summary": { "submit": 5, "skip": 1, "blocked": 0, "capped": true,
                 "channelReady": false, "channelReason": "…", "costUsd": 2, "seconds": 38 }
  }
}
```

- `action`：`submit` 该提交 / `skip` 已在跑或已成功（**同一份提示词不许重发**）/
  `blocked` 缺提示词、缺 `duration`、缺 `camera`。
- **幂等判据是提示词 sha256**：当前产物（人工覆盖优先）的指纹 == 台账那条的
  `prompt_sha256` ⇒ 同一个请求。指纹变了就是一次新的提交。
- `limit` 只截断**这一批**（算够 N 镜要提交就停），`capped: true` 表示还有更多。
- **通道不可用不逐镜阻塞**：计划内容仍成立，整批给一条 `channelReady / channelReason`。
- agent 对等工具：`drama_desk_channels`、`drama_desk_generation_board`、
  `drama_desk_generation_plan`。台账 `GET /api/ledger` 另增 `byModel` / `byStatus` 分组。
