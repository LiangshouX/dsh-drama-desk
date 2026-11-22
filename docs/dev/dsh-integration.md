# 与 DSH 宿主集成：会话、工作区、技能

> 这篇是「构思会话」与宿主能力对接的**详版参考**。纪律在 `AGENTS.md`；
> 宿主侧的通用知识见 `dsh-doc` 技能。

---

## D1 复用宿主的对话装配，不自己画聊天

「构思」是**真的 DSH 会话**，界面是**宿主自己的对话装配**：

```
Host:   agents.create({ sessionId, meta:{ cwd }, agentOptions })
Client: ctx.sessions.retain(id, { source:'controllerOperation' })
        → SessionProvider session={reference}
        → renderFactorySlot('conversation.content', { variant:'embedded', phase, hero })
```

`conversation.content` 是宿主 `SlotFactoryMap` 里登记的 **Component Factory**
（原话：「Reusable Conversation content instantiated by presentation hosts」），
两种出现形态：

| variant | 外形 | 谁在用 |
|---|---|---|
| `main` | 带头部、带宽度把手、带视图标签 | 宿主的主面板 |
| **`embedded`** | **不带头部、不带宽度把手**，其余完全一样 | 宿主右侧栏的子 agent 对话；**我们的构思窗** |

拿到的就是宿主那一整套，**一行渲染都不用写**：

- 消息与 markdown（表格、代码块、列表、**文件引用 chip**，点了走宿主自己的预览）
- 每个工具的自定义卡片（`tool.call.toolview` 按 wire name 分派）
- 思考折叠、上下文折叠（注入的 prompt context 会折成一行「上下文」）
- **提问卡片**（`ask_user_question` 的卡片与回传通道都归宿主）
- 审批、队列 / 引导、停止 / 重试、出错与重发
- composer 里的**模型与思考强度选择**（这也是为什么插件不再自己画模型菜单）

> **不要再自己折叠 `eventSource` 去画消息流。** 2026-11-22 之前那版就是这么做的：
> 用 `eventSource` 拼出「我说的话 / 它说的话 / 处理过程」三种行。结果工具卡退化成
> `name(args)` 一行、提问卡是个点了没反应的假按钮、注入的上下文糊成一屏——
> 那是**用三百行僭越了宿主几个包**，比宿主差得多。

### 嵌入的三个必要条件（缺一不可）

1. **槽占位者要在自己的注册里声明一个 session 作用域的子槽**：

   ```js
   ctx.slots.register({
     name: 'main', key: PANEL_ID,
     children: { 'drama-desk.conversation': { kind:'single', scope:'session' } },
   }, DramaDesk)
   ```

   宿主渲染器的 `standardKit` 只在「子槽里有非 root 作用域」时才发给占位者
   `SessionProvider` 与 `renderSlot`。少了这条，绑不住会话，嵌进来的是空态。

2. **`sessions.retain(id)` 的引用交给 `SessionProvider session={…}`**。宿主靠它把
   「这一段会话」bind 进作用域，工厂的 `session-maybe` 作用域才解析得到。

3. **`renderFactorySlot` 是标准道具，任何占位者都有**（`boundRenderFactorySlot`），
   不需要声明。工厂的 `views` 位置用 `slots: { views: … }` 固定成宿主的「对话」视图，
   不让宿主记住的「上次看的是轨迹」把这一格换成轨迹台。

`phase`（`settling` / `hero` / `active`）照抄宿主的 `sidebar-chat`：由
`useSession` / `useConversation` / `useSessions` 三个标准道具推出。那是宿主判定
「这段会话是空、是刚开、还是已有内容」的口径，别另发明。

## D2 会话必须挂进工作区的**账本**

DSH 的工作区有两个面，**只做前一半等于没做**：

| 面 | 含义 | 漏了会怎样 |
|---|---|---|
| `path` + 会话 `cwd` | 会话的工作目录落在工作区目录下 | 侧栏里找不到它 |
| **`sessionIds`** | 工作区**自己的会话账本**（有序） | **它会掉进「未分组」** |

用户报的「会话没落在固定工作区、跑到未分组去了」就是第二种：cwd 对了，
但账本里没有它。

> **规则：`workspaceRegistry.resolveByPath()` 拿到 Workspace 实体 → 开会话 →
> `workspace.attachSession(sessionId)`。新开与恢复**都要**。**
> cwd = 短剧项目总根（D5）；一个工作台 = 一个 DSH 工作区。
> `attachSession` 失败**不许**影响「这段会话能聊」——它是第二位的。

`GET /api/sessions`（会话切换清单）也照**账本**取：先看 `workspace.sessionIds`，
拿不到账本才退回 cwd 前缀匹配。这样清单和宿主侧栏是**同一个口径**。

## D3 `agents.create()` 不接受「没有模型」

它会直接拒：`AgentOptions.provider and AgentOptions.model or record a model selection`。
所以显式带上 `agentDefaultModel.currentSelection()`。

会话开起来之后，**换模型 / 换思考强度由宿主的 composer 负责**（它写的是同一条
`agentDefaultModel` 真源），插件不再自己维护一个模型菜单。

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

### 共用一个工作区 → 项目范围走 **prompt context**，不塞用户消息

共用一个工作区意味着 agent 能看见**别的**项目。所以每段构思对话都得先钉死
「这次只谈 `workspaces/<work-id>/`」。

**这件事交给宿主的 prompt registry，不要塞进用户的第一条消息。**

```
agent.ctx.systemPrompt.context({ name:'drama-desk/project', order:40, text, required:true })
  ↑ 首选：进模型历史（宿主把本次所有 context 合成一条 user-role 消息，对话流里不显示正文）
agent.ctx.systemPrompt.section({ … })   ← 退一步：进 system prompt，看不见但一定读得到
```

注册在**这个 agent 自己的作用域**上（`agent.ctx`），所以只有这一段会话带着它；
disposer 交给 `ctx.effect`，作用域一收跟着走。

> 以前那段话是 `<system-reminder>` 包着搭在用户第一条消息上、再由客户端抹掉的——
> 那是**给模型看的说明冒充了人说的话**，对话流里会露出一整坨 instruction。
>
> **实测（2026-11-22，重启后）**：新建会话 `seeded:true`；问「这次对话只谈哪个目录」，
> 答 `workspaces/demo-epic/` —— 上下文真的到了模型，而对话流里一个字都看不见。
> 它在会话日志里是一条和宿主 `reme-memory` / `runtime-context` **合并**的
> `user/message`；宿主只给自己的 producer 列名（「上下文注入 reme-memory」），
> 我们这条不列名 —— 这正是要的效果。

### 「新对话」

`POST /conceive-session {fresh:true}`：收掉当前 agent、清掉 `state.json` 里的
`desk_session_id`、开一段新的。**旧会话不删**，它还留在 DSH 的会话列表里
（也还在工作区账本里）。

## D6 侧栏常驻，但会话由用户发起

- **常驻**：`chatVisible` 不看「用户点没点那个图标」。首页和 conceive 阶段这扇窗都在；
  顶栏图标只负责**收起 / 展开**（屏幕挤不下时的应急，不是唤起开关）。
- **不自动开聊**：进阶段、展开侧栏，**都不发送任何东西**。会话由用户点侧栏里的
  「开始对话」才建（`POST /conceive-session`）。
- **开场白不进对话流**：它由 Host 单点生成（`seedPrompt()`），以 prompt context 的
  形式交给宿主（见 D5）。客户端**不再**拼这段文案——那会变成第二份真相。

## D7 会话窗能复用宿主的什么

插件的客户端作用域里**能**拿到（`ctx.get`）与**能**渲染的：

| 能力 | 用来做什么 |
|---|---|
| `sessions` | `retain()` 保留会话；`SessionProvider` 要的就是它的引用 |
| **`renderFactorySlot('conversation.content')`** | **渲染宿主自己的对话装配**（D1） |
| `uiConversation` | 宿主的会话装配：每会话绑定、快照、原生视图 |
| `uiWorkspace` | 跳「完整对话」：`openSession()` → `openWorkspace()` → `selectPanel('conversation')` |
| `layout` / `slots` / `locale` | 宿主 UI 基础设施 |

**拿不到的**：宿主的 **slot 渲染器**（`ctx.slots` 只有 `register` / `registerFactory` /
`inject`）。所以 `conversation.chat.node` / `tool.call.toolview` 这些 keyed 条目
搬不走——**但也不用搬**：`conversation.content` 工厂会在我们这棵子树里把它们全渲染出来。

> 「完整对话」按钮仍然保留：侧栏这一格是**窄**视图，宿主的主面板才有
> 轨迹 / 上下文 / 编队 / 统计四个标签。同一段会话，两个入口。
> 顺序不能反：**先 `openSession()`，再 `openWorkspace()`**——工作区切换会把会话选择
> 重置掉，反过来面板会停在空态。

### 绑不上要**自愈一次**，不要停在报错上

`ctx.sessions.list()` 与 `retain()` 认的是宿主**当前活着的会话目录**，不是磁盘上的全部。
所以「插件重装 / DSH 重启」之后，`state.json` 里记的那段会话可能暂时不在目录里，
`retain` 会抛：

```
sessions.retain: unknown session <id>
```

宿主的 `agents.resume()` 能把它带回来。所以客户端的做法是：**retain 失败 → 请 Host
走一次 `ensureDeskSession()`（等价于 resume）→ 再 retain 一次**。只试一次，失败就停在
一句人话上（「这段会话还没在宿主那边打开」），不循环打接口。

> 实测（2026-11-22）：重装插件后 `GET /api/sessions` 只剩 `e7df07d0`；打开面板时
> 自愈跑了一次，`5dd2b109` 回到目录，对话直接出现，用户看不到任何报错。

**同一个原因也解释了会话下拉为什么有时候少几项**：清单来自 `sessions.list()`，
没被加载过的会话不在里面（这是宿主的口径，不是插件丢数据）。

## D8 Cordis 对带点的服务路径有静态保护

`ctx.get('remote.userQuestions')` 会抛：

```
Error: cannot get property "remote.userQuestions" without inject
```

作用域**必须显式 inject** 那些带点的路径服务，插件的客户端清单里写：

```js
inject: ['slots', 'locale', 'sessions', 'remote', 'remote.userQuestions', 'uiConversation'],
```

（`ctx.get('remote')` 能拿到，但 `remote.userQuestions` 是**另一个**路径——取不到。）

`remote.userQuestions` 现在**不用了**：提问卡片与答案回传都归宿主（D1）。留着注入是
为了让「宿主版本没有这条通道」时插件还能启动，不再自己接答案。

## D9 推理强度是**每个模型自己的**（宿主已接管）

同一个 provider 下，A 模型给 low/high/max，B 模型只给 medium。所以档位不能写死：

```
llm.resolveModelInfo(provider, model) → { reasoning: { efforts: [{id, name}], defaultEffort } }
```

`GET /api/model-info` 仍然在（按需，不进轮询：这条路径可能去问 provider）。
但**客户端不再自己画档位下拉**——宿主的 composer 里那个「模型 · 强度」按钮就是它，
写的是同一条 `agentDefaultModel` 真源。插件自己再画一份只会多出第二套不一致的控件。
