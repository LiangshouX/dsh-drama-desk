# 与 DSH 宿主集成：会话、工作区、技能

> 这篇是「构思会话」与宿主能力对接的**详版参考**。纪律在 `AGENTS.md`；
> 宿主侧的通用知识见 `dsh-doc` 技能。

---

## D1 不要自己画聊天

`dsh-doc` 的 `practices.md` 说得很清楚：插件**不许**把宿主的 Client 包当模块加载，
**不许**自己折叠会话事件去仿造聊天，也**不许**用 iframe。所以「构思」用的是**真的
DSH 会话**：

```
Host:  agents.create({ sessionId, meta:{ cwd }, agentOptions })
Client: ctx.sessions.retain(id, {source:'controllerOperation'})
        → binding.session（running / blank / prompt / cancel）
        → binding.eventSource（已经折叠好的会话窗口）
```

小窗只做三件事：把窗口按「谁说的」摊开、把输入框接到 `session.prompt()`、
给一个「完整对话」按钮跳回宿主自己的面板（工具卡片、推理、审批都在那边）。

## D2 会话**必须**挂在 DSH 工作区下

只给 `meta.cwd` 而不注册工作区时，会话会变成一段**没有归处**的对话：侧栏找不到、
所属工作区的会话列表里没有，用户只能从工作台小窗看它。

> **规则：开会话之前先 `workspaceRegistry.resolveByPath()`，没有就 `create()`。**
> cwd = 短剧项目根；一个短剧项目 = 一个 DSH 工作区。
> 新开与恢复走**同一条路**（`ensureDshWorkspace()`），不要一边有一边没有。

## D3 `agents.create()` 不接受「没有模型」

它会直接拒：`AgentOptions.provider and AgentOptions.model or record a model selection`。
所以显式带上 `agentDefaultModel.currentSelection()`。

## D4 随包技能必须注册，否则等于没打包

宿主的技能发现只扫 `<root>/.dsh/skills` / `<root>/.agents/skills`——**`build/skills/` 里
躺着 8 份 SKILL.md，但 `package.json` 里没有 `bundledSkillDir`、`index.js` 也没注册
provider，这些技能从来没被加载过**。现在由 `src/host/skills.js` 用
`ctx.skills.registerProvider()` 注册。

> **注册在全局层，可见性按 cwd 判。**
>
> 宿主注册表是「全局层 + scope 层」：插件挂在宿主层 → provider 落进全局层 → 对**所有**
> 工作区的会话可见。但这些 Skill 只描述短剧流水线，只在**短剧项目总根**（D5）里有意义
> ——挂到别处等于往别人的目录里塞方法论。
>
> 所以 provider 用 `options.cwd` 过闸门：cwd 落在总根之内才贡献候选项；其他工作区返回
> **空目录**（`complete: true`——是「这里没有短剧 Skill」，不是「发现失败」，注册表因此
> 不会把目录标成不完整、不会反复重试）。加载正文（`get()`）也过同一道闸门。
>
> 总根由 service 解析（「规范只有一份」）：`skills.js` 只负责问，并按 promise 缓存，
> 避免并发查找各跑一次解析。

验证方式：在**短剧工作区**里开会话 → 技能目录里有 `drama-conceive`；在**别的**会话里
→ 看不到它。

## D5 一个工作台只有一个总根（不许碎）

默认项目根 = **`「视频」目录/DSH-DRAMA-DESK`**（`src/host/locations.js` 的 `defaultRoot`，
第一次解析时自动建出来）。所有短剧项目都是它下面的 `workspaces/<work-id>/`：

```
<「视频」目录>/DSH-DRAMA-DESK/     ← 唯一的总根 = 唯一的 DSH 工作区
├── workspaces/
│   ├── <work-id>/                 一部短剧 = 一个自包含目录
│   └── <work-id>/
└── （由插件自动创建）
```

**不要给每个项目开一个 DSH 工作区。** 侧栏碎成一堆工作区是治理灾难：用户说不清哪份
是最新的，会话也散落各处。

### 共用一个工作区 → 每段对话都要 `@` 锚定项目

共用一个工作区意味着 agent 能看见**别的**项目。所以每段构思对话的开场白第一行就是
`@workspaces/<work-id>/`，并明说「只读写这个目录、不要混用别的项目」——这就是
「防止串台」。新项目还会有额外一句「这是一个刚建的新项目，目录还是空的」。

### 「新对话」

`POST /conceive-session {fresh:true}`：收掉当前 agent、清掉 `state.json` 里的
`desk_session_id`、开一段新的。**旧会话不删**，它还留在 DSH 的会话列表里。

## D6 侧栏常驻，但会话由用户发起

- **常驻**：`chatVisible` 不看「用户点没点那个图标」。首页和 conceive 阶段这扇窗都在；
  顶栏图标只负责**收起 / 展开**（屏幕挤不下时的应急，不是唤起开关）。
- **不自动开聊**：进阶段、展开侧栏，**都不发送任何东西**。会话由用户点侧栏里的
  「开始对话」才建（`POST /conceive-session`）。「唤起即触发」看着像 AI 自己在跟自己说话。
- **开场白不丢，但换时机**：它仍然是 Host 单点生成的 `seed`，只是从「自动发一条用户
  消息」改成**搭在用户主动发出的第一条消息上**（`<system-reminder>` 框住一起送）。
  模型读得到，界面不显示。**不要**在客户端重写这段文案——那会变成第二份真相。

## D7 会话窗能复用宿主的什么、不能复用什么

插件的客户端作用域里**能**拿到（`ctx.get`）：

| 服务 | 用来做什么 |
|---|---|
| `sessions` | 保留会话、读事件流、收消息 |
| `remote` | Remote Events（提问通道） |
| **`remote.userQuestions`** | **把答案回传给 agent** |
| `uiConversation` | 宿主的会话装配：每会话绑定、快照、**原生视图** |
| `uiSession` / `slots` / `locale` | 宿主 UI 基础设施 |

**不能**拿到的：**宿主的对话渲染器**。`ctx.slots` 只有 `register` / `registerFactory` /
`inject`——**没有公开的「渲染这个槽」API**，而宿主的 `conversation.chat.node` /
`tool.call.toolview` 都是 `kind:'keyed'` 且**已被宿主占住**的条目。所以原生聊天主界面
**搬不进插件面板**。

> 于是「轻量嵌入」的可落地形态是**驱动**而不是**搬运**：插件把「这段会话 + 这个视图」
> 交给宿主，让宿主自己渲染。会话窗里的「轨迹」按钮就是这么做的：它切到宿主的**原生
> 轨迹视图**（`uiConversation.binding(sessionId).activate('trajectory')`），工具卡片、
> 推理、审批、提问卡全在那边——**不复刻，请过来**。

## D8 Cordis 对带点的服务路径有静态保护

`ctx.get('remote.userQuestions')` 会抛：

```
Error: cannot get property "remote.userQuestions" without inject
```

作用域**必须显式 inject** 那些带点的路径服务，插件的客户端清单里写：

```js
inject: ['slots', 'locale', 'remote', 'remote.userQuestions', 'uiConversation'],
```

（`ctx.get('remote')` 能拿到，但 `remote.userQuestions` 是**另一个**路径——取不到。）

## D9 推理强度是**每个模型自己的**

同一个 provider 下，A 模型给 low/high/max，B 模型只给 medium。所以档位**不能写死在
插件里**——问适配器：

```
llm.resolveModelInfo(provider, model) → { reasoning: { efforts: [{id, name}], defaultEffort } }
```

这条路径**可能去问 provider**，所以它是一条**按需**的接口（`GET /api/model-info`），
**不进轮询**：模型菜单打开时才问一次。
