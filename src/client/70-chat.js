    // ── 构思会话：把**宿主自己的对话装配**嵌进侧栏 ──────────────────────────
    //
    // 设计（2026-11-22 重做，推翻了之前「自己画消息流」的做法）
    // ------------------------------------------------------------
    // 宿主的 `conversation.content` 是一个 **Component Factory**
    // （`SlotFactoryMap` 里的注释原话：「Reusable Conversation content instantiated
    // by presentation hosts」），并且明确支持两种出现形态：
    //
    //   variant: 'main'      —— 主面板那份（带头部、带宽度把手）
    //   variant: 'embedded'  —— 嵌进别处那份（**不带头部**、不带宽度把手）
    //
    // 右侧栏的「子 agent 对话」用的就是 embedded——它就是宿主自己背书的
    // 「把原生聊天嵌进侧边栏」的形态。插件照同一条路走，就能一行聊天渲染都不用写：
    //
    //   ① 自己的槽注册里声明一个 **session 作用域的子槽**
    //      ⇒ 宿主才会把 `SessionProvider` 与 `renderSlot` 这两件标准道具交给我们
    //   ② `sessions.retain(id)` 拿引用，`SessionProvider` 把这段会话**绑住**
    //   ③ `renderFactorySlot('conversation.content', { variant: 'embedded' })`
    //
    // 拿到的是宿主**自己的**一整套：消息与 markdown、每个工具的自定义卡片
    // （read / write / edit / bash / 子 agent… 全是宿主实现的）、思考折叠、
    // **提问卡片（点选即回传）**、上下文折叠、审批、队列与引导、停止与重试、
    // 以及 composer 里的**模型与思考强度选择**。
    //
    // 这扇窗只补宿主没做的三件事：
    //   · 贴住作品：会话清单按 **DSH 工作区的账本**取（所以要 Host 侧 attach）
    //   · 头部的会话切换 / 新对话 / 跳完整对话面板
    //   · 还没开会话时的空态引导
    //
    // 反面教训（为什么以前那版是错的）：自己把 `eventSource` 折叠成
    // 「我说的话 / 它说的话 / 处理过程」三种行，等于**用 300 行僭越了宿主
    // 几个包**——工具卡只有一行 `name(args)`，提问卡是个假按钮，
    // 注入的上下文糊成一屏。那不是「轻量嵌入」，那是重造一个更差的聊天。

    /** 订阅一个 ObservableSnapshot（宿主自己的增量机制），返回它当前的值。 */
    function useStore(source) {
      const subscribe = useCallback(handler => {
        if (source === undefined || source === null || typeof source.subscribe !== 'function') return () => {}
        return source.subscribe(handler)
      }, [source])
      const read = useCallback(() => {
        if (source === undefined || source === null || typeof source.getSnapshot !== 'function') return undefined
        try {
          return source.getSnapshot()
        } catch {
          return undefined
        }
      }, [source])
      if (typeof React.useSyncExternalStore === 'function') {
        return React.useSyncExternalStore(subscribe, read, read)
      }
      const [value, setValue] = useState(read)
      useEffect(() => {
        setValue(read())
        return subscribe(() => setValue(read()))
      }, [subscribe, read])
      return value
    }

    /** 稳定空值：给标准道具缺失时的兜底（换新对象会让订阅每次重连）。 */
    const EMPTY_SESSION = { blank: true, running: false, awaitingFirstTurn: false, promptAttempted: false, openState: 'cold' }

    const EMPTY_CONVERSATION = { activeTargets: new Set() }

    /** 宿主的会话服务；拿不到就返回 undefined（由调用方如实说明）。 */
    function sessionsService() {
      if (CTX === null || CTX === undefined || typeof CTX.get !== 'function') return undefined
      try {
        const service = CTX.get('sessions')
        return service !== undefined && service !== null && typeof service.retain === 'function'
          ? service
          : undefined
      } catch {
        return undefined
      }
    }

    /** 会话清单里的时间戳：「今天」只露时分，更早露月-日。拿不到就空着。 */
    function sessionStamp(createdAt) {
      if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || createdAt <= 0) return ''
      // 毫秒还是秒：宿主的 header 是毫秒，但这里不赌——小到不像毫秒就按秒算。
      const date = new Date(createdAt > 1e12 ? createdAt : createdAt * 1000)
      if (Number.isNaN(date.getTime())) return ''
      const pad = value => String(value).padStart(2, '0')
      const now = new Date()
      const sameDay = date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate()
      const clock = pad(date.getHours()) + ':' + pad(date.getMinutes())
      return sameDay ? clock : pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + clock
    }

    /**
     * 每一段会话的**标题**。
     *
     * 宿主的 `SessionHeader` 里**没有 title 字段**——标题是 `session-title` 投影的产物
     * （一条 `session/title` 事件 fold 出来，第一句话之后由宿主摘要生成）。
     * 侧栏显示的就是客户端会话清单里的 `SessionSummary.title`。
     *
     * 所以这里读**同一个来源**，而不是自己拿第一句话去摘要：
     * 清单里的标题于是永远和侧栏一致，也不会出现「插件一套、宿主一套」。
     *
     * 注意：**不要**读 `projectionValues.title` —— 列表行只带摘要子集
     * （`SessionProjectionSummaryValues`），title 是以 `SessionSummary.title`
     * 这个扁平字段出现的。`displayTitle` 也不拿来做兜底：它退化成项目目录名，
     * 同一个工作区里每段会话都会显示成同一个词。
     *
     * @returns {Record<string, string>} sessionId → 标题
     */
    function sessionTitles() {
      const service = sessionsService()
      const source = service !== undefined ? service.list : undefined
      if (source === undefined || source === null || typeof source.getSnapshot !== 'function') return {}
      let snapshot
      try {
        snapshot = source.getSnapshot()
      } catch {
        return {}
      }
      const byId = snapshot !== undefined && snapshot !== null && snapshot.byId !== undefined && snapshot.byId !== null
        ? snapshot.byId
        : {}
      const out = {}
      for (const id of Object.keys(byId)) {
        const row = byId[id]
        if (row === undefined || row === null) continue
        const durable = typeof row.title === 'string' ? row.title.trim() : ''
        if (durable !== '') {
          out[id] = durable
          continue
        }
        // 兜底：某些宿主版本把投影原样塞进 projectionValues。
        const projected = row.projectionValues !== undefined && row.projectionValues !== null
          ? row.projectionValues.title
          : undefined
        const title = projected !== undefined && projected !== null && typeof projected.title === 'string'
          ? projected.title.trim()
          : ''
        if (title !== '') out[id] = title
      }
      return out
    }

    /** 两份标题表是否等价（没变就别 setState——父组件的每次重渲染都会带上整棵子树）。 */
    function sameTitles(a, b) {
      const left = Object.keys(a)
      const right = Object.keys(b)
      if (left.length !== right.length) return false
      for (const key of left) if (a[key] !== b[key]) return false
      return true
    }

    /**
     * 会话清单里的显示名。
     *
     * 优先**标题**（和侧栏一致），其次 API 给的 `title`，最后才是 id 片段 + 创建时间。
     * 光露 id 前八位不行：`session-xxxx` 会显示成一模一样的「会话 session-」。
     */
    function sessionLabel(session, titles) {
      const id = session && typeof session.id === 'string' ? session.id : ''
      const projected = titles !== undefined && id !== '' ? titles[id] : undefined
      if (typeof projected === 'string' && projected !== '') return projected
      const title = session && typeof session.title === 'string' ? session.title.trim() : ''
      if (title !== '') return title
      const bare = id.replace(/^session-/, '')
      const stamp = sessionStamp(session ? session.createdAt : undefined)
      const name = bare === '' ? '未命名对话' : '会话 ' + bare.slice(0, 8)
      return stamp === '' ? name : name + ' · ' + stamp
    }

    /**
     * 这一个 View 槽里放什么：**固定走宿主的「对话」视图**。
     *
     * 这一格是聊天窗，不是轨迹台——轨迹在「宿主面板」那一侧看。
     * `renderSlot` 是工厂给的（`conversation.content` 的 `views` 位置）。
     */
    function DeskChatView(props) {
      return props.renderSlot('conversation.session', { view: 'chat' })
    }

    /**
     * 会话体：宿主 `conversation.content` 的 **embedded** 出现形态。
     *
     * `phase` / `hero` 决定宿主渲染哪一屏（空白首屏 / 正在接续 / 正文）。
     * 这段判定照抄宿主的 `sidebar-chat`：它是「这段会话现在是空、是刚开、
     * 还是已经有内容」的**宿主自己的**口径，我们不该另发明一套。
     */
    function DeskConversationBody(props) {
      const { sessionId, useSession, useConversation, useSessions, renderFactorySlot } = props
      // 标准道具可能因为宿主版本不同而缺席——缺席也不能让 hook 顺序变。
      const readSession = typeof useSession === 'function' ? useSession : value => value
      const readConversation = typeof useConversation === 'function' ? useConversation : value => value
      const readSessions = typeof useSessions === 'function' ? useSessions : value => value
      const session = readSession(value => value) || EMPTY_SESSION
      const conversation = readConversation(value => value) || EMPTY_CONVERSATION
      const summaryBlank = readSessions(state => (state && state.byId ? state.byId[sessionId] : undefined)?.blank)

      const active = conversation.activeTargets.size > 0
        || (session.blank !== true && session.awaitingFirstTurn !== true)
        || session.running === true
      const shellPhase = active ? 'active' : session.promptAttempted === true ? 'engaging' : 'blank'
      const settling = shellPhase === 'blank' && session.openState === 'loading' && summaryBlank !== true
      const hero = shellPhase === 'blank' && (session.openState === 'open' || summaryBlank === true)
      const phase = settling ? 'settling' : hero ? 'hero' : 'active'

      if (typeof renderFactorySlot !== 'function') {
        return h('div', { className: 'dd-chat-note' },
          '这个宿主没有提供对话装配接口（renderFactorySlot）：需要更新的 DSH 桌面版或 dsh web。')
      }
      return renderFactorySlot(
        'conversation.content',
        { variant: 'embedded', phase, hero },
        { slots: { views: DeskChatView } },
      )
    }

    /**
     * 会话切换：这个 **DSH 工作区**里的对话。
     *
     * 用原生 `<select>` 而不是自造弹出层：它会键盘可用、会跟随系统主题、
     * 在窄侧栏里也不会被裁掉。会话一多，浏览器自己会滚。
     *
     * **别的作品的对话不让选。** 会话的 `cwd` 是总根（所有作品共用同一个
     * DSH 工作区），所以清单里混着别的戏的对话；选进来就等于把一段谈
     * 《A》的对话当成《B》继续，那正是串台。归属由 Host 按各作品的
     * `state.json` 台账算（见 `service.sessionOwners`），这里只负责如实标注。
     */
    function ConceiveSessionMenu(props) {
      const { sessions, current, onPick, titles, workspaceId } = props
      const list = Array.isArray(sessions) ? sessions : []
      const hasCurrent = typeof current === 'string' && current !== ''
      const known = hasCurrent && list.some(item => item && item.id === current)
      const currentTitle = current !== undefined && titles !== undefined ? titles[current] : undefined
      const ownerName = item => (typeof item.workspaceTitle === 'string' && item.workspaceTitle !== ''
        ? item.workspaceTitle
        : String(item.workspaceId))
      const isForeign = item => item.workspaceId !== undefined && item.workspaceId !== null
        && item.workspaceId !== '' && item.workspaceId !== workspaceId
      return h('select', {
        className: 'dd-chat-session',
        value: hasCurrent ? current : '',
        disabled: !hasCurrent && !list.some(item => !isForeign(item)),
        title: '这个工作区里的对话（含你在宿主的侧栏里自己开的）；别的作品的对话不能在这里选',
        onChange: event => {
          const id = event.target.value
          if (id !== '' && typeof onPick === 'function') onPick(id)
        },
      }, [
        !hasCurrent ? h('option', { key: '__unbound', value: '', disabled: true }, '还没有本作品的对话') : null,
        // 当前这段不在清单里（清单还没刷出来）时也要有个选项，否则 select 会空值。
        hasCurrent && !known
          ? h('option', { key: '__current', value: current }, typeof currentTitle === 'string' && currentTitle !== ''
            ? currentTitle
            : '当前对话 ' + current.replace(/^session-/, '').slice(0, 8))
          : null,
        hasCurrent && list.length === 0
          ? h('option', { key: '__empty', value: '' }, '（这个工作区里只有这一段）')
          : null,
        list.map(item => h('option', {
          key: item.id,
          value: item.id,
          disabled: isForeign(item),
          title: isForeign(item)
            ? '这是「' + ownerName(item) + '」的对话：先切到那个作品再选它'
            : undefined,
        }, sessionLabel(item, titles) + (isForeign(item) ? '（属「' + ownerName(item) + '」）' : ''))),
      ])
    }

    /**
     * 构思会话窗。
     *
     * 会话**不是**这里发起的：Host 侧用 `agents.create()` 开真会话、把它挂进
     * DSH 工作区的账本、再把「这次只谈哪个项目」作为 **prompt context** 交给宿主。
     * 这扇窗负责「把那段会话显示出来 + 让人能切、能新开、能跳过去」。
     *
     * 还有一条常被忽略的：**每绑住一段会话，都要把作品范围重新钉一次**
     * （`conceive-scope`）。清单里的对话不全是工作台开的，不钉就等于让它猜。
     */
    function ConceiveChat(props) {
      const {
        sessionId, onClose, onFresh, onStart, onDraft, canStart, busy,
        workspaceId, panelControls, dshWorkspaceId, SessionProvider, renderSlot, stage = 'conceive',
      } = props
      const [activeId, setActiveId] = useState(sessionId)
      /**
       * 绑住的会话引用 **连同它属于哪一段会话**。
       *
       * 只存引用是不够的：换会话时 React 会先用**旧的**引用渲染一帧，而旧引用的
       * 释放发生在上一轮 effect 的 cleanup 里 —— 那一帧里 `SessionProvider`
       * 就会拿到一个已经 released 的引用，宿主直接抛
       * `Session reference "…" is released`。
       *
       * 所以这里记上 id，渲染时**只认 id 与当前一致的那一个**：换了会话的那一刻
       * `liveReference` 就是 null，那一帧显示「正在打开」，不会把死引用交出去。
       */
      const [bound, setBound] = useState({ id: undefined, reference: null })
      const [problem, setProblem] = useState(null)
      const [list, setList] = useState([])
      /** 标题表：sessionId → 标题（来自宿主的 title 投影，和侧栏同一来源）。 */
      const [titles, setTitles] = useState({})
      const [starting, setStarting] = useState(false)
      /** 「从零开始聊」那一颗按钮的等待态（它要多做一件事：先建草稿作品）。 */
      const [draftStarting, setDraftStarting] = useState(false)
      /** 自愈重试计数：绑定失败 → 请 Host 把这段会话恢复成活的 → 再绑一次。 */
      const [attempt, setAttempt] = useState(0)
      const repairedRef = useRef(false)
      /**
       * `onStart` 每次渲染都是新函数（父组件里的内联箭头），放进依赖会让 effect
       * 每帧重跑（retain/release 抖动）。所以走 ref：值是最新的，身份不参与依赖。
       */
      const startRef = useRef(onStart)
      startRef.current = onStart

      // 作品换了自己的会话 → 跟着走。
      useEffect(() => { setActiveId(sessionId) }, [sessionId])

      // 清单：只在**换了会话/作品**（或自愈重连过一次）时拉。它是清单，不是某一镜的
      // 判定，所以不进轮询——开会话那一次 `conceive-session` 之后会重渲染，够用。
      useEffect(() => {
        let cancelled = false
        apiGet('sessions').then(value => {
          if (!cancelled) setList(value && Array.isArray(value.sessions) ? value.sessions : [])
        }).catch(() => { if (!cancelled) setList([]) })
        return () => { cancelled = true }
      }, [sessionId, attempt])

      // **绑定**这一段会话：用宿主自己的 retain（共享它的历史开屏与增量）。
      //
      // `attempt` 是自愈重试：见下面的 catch —— 插件重装 / 宿主重启之后，
      // 这段会话可能已经不在宿主的活目录里（客户端 retain 会报
      // `sessions.retain: unknown session`），此时请 Host 走一次
      // `ensureDeskSession()`（本质是 `agents.resume`）把它带回来，再绑一次。
      useEffect(() => {
        repairedRef.current = false
        return undefined
      }, [activeId])

      useEffect(() => {
        if (activeId === undefined || activeId === null || activeId === '') {
          setBound({ id: undefined, reference: null })
          return undefined
        }
        const service = sessionsService()
        if (service === undefined) {
          setBound({ id: undefined, reference: null })
          setProblem('这个宿主没有会话服务：构思会话需要 DSH 桌面版或 dsh web。')
          return undefined
        }
        let held
        try {
          held = service.retain(activeId, { source: 'controllerOperation' })
        } catch (bad) {
          setBound({ id: undefined, reference: null })
          setProblem(bad instanceof Error ? bad.message : String(bad))
          // **一次性自愈**：只试一次，失败就如实停在这里，不循环打接口。
          if (repairedRef.current !== true && typeof startRef.current === 'function') {
            repairedRef.current = true
            Promise.resolve()
              .then(() => startRef.current())
              .then(() => setAttempt(count => count + 1))
              .catch(() => { /* 恢复不了就让它停在提示上 */ })
          }
          return undefined
        }
        setProblem(null)
        setBound({ id: activeId, reference: held })
        return () => {
          try {
            held.release()
          } catch {
            // 已经释放过：忽略。
          }
        }
      }, [activeId, attempt])

      // 标题：订阅宿主的会话清单快照，取 `title` 投影（和侧栏同一来源，见 sessionTitles）。
      //
      // 标题是**后来才有**的（第一句话之后由宿主摘要生成），所以必须订阅而不是快照一次；
      // 但表没变就**不 setState**——父组件每重渲染一次都会带上整棵子树。
      useEffect(() => {
        const service = sessionsService()
        const source = service !== undefined ? service.list : undefined
        if (source === undefined || source === null
          || typeof source.getSnapshot !== 'function' || typeof source.subscribe !== 'function') {
          setTitles(previous => (Object.keys(previous).length === 0 ? previous : {}))
          return undefined
        }
        const read = () => {
          const next = sessionTitles()
          setTitles(previous => (sameTitles(previous, next) ? previous : next))
        }
        read()
        const off = source.subscribe(read)
        return () => {
          if (typeof off === 'function') off()
        }
      }, [sessionId, attempt])

      // 只认「当前这一段」的引用：换会话时旧引用已经不可用了（见 bound 的说明）。
      const reference = bound.id === activeId ? bound.reference : null

      const snapshot = useStore(reference !== null && reference.binding ? reference.binding.session : undefined)
      const running = snapshot !== undefined && snapshot !== null && snapshot.running === true
      const openState = snapshot !== undefined && snapshot !== null ? snapshot.openState : undefined

      const hasSession = activeId !== undefined && activeId !== null && activeId !== ''

      /**
       * 这一段对话**钉在哪个作品上**。
       *
       * 为什么要在这里问，而不是开会话时问一次就完：会话窗里能选的对话不全是
       * 工作台开的——你在宿主侧栏自己开的、插件重装前开的、别的作品开的都在
       * 清单里。它们从来没有「只谈哪部戏」这句话，agent 只能猜；猜就是串台。
       *
       * 所以规矩是「**谁被显示，就给谁挂上**」：每绑住一段会话就请 Host 把
       * 当前作品的目录 ID 与作品名挂成这段会话的 prompt context（幂等）。
       *
       * `reason: 'cold'` 是正常的中间态：会话还没活过来。等 `retain()` 之后
       * 宿主把它 resume 起来（`openState === 'open'`），这个 effect 会自己再挂一次。
       */
      const [scope, setScope] = useState(null)
      const [scopeTry, setScopeTry] = useState(0)
      const [task, setTask] = useState(null)
      const [taskMessage, setTaskMessage] = useState('')
      useEffect(() => {
        let cancelled = false
        setTask(null)
        setTaskMessage('')
        if (workspaceId) apiGet('production', { workspace: workspaceId, stage })
          .then(value => { if (!cancelled) setTask(value) })
          .catch(error => { if (!cancelled) setTaskMessage(error.message) })
        return () => { cancelled = true }
      }, [workspaceId, stage])
      const askedScope = useRef('')
      useEffect(() => {
        if (!hasSession || workspaceId === undefined || workspaceId === null || workspaceId === '') {
          setScope(null)
          askedScope.current = ''
          return undefined
        }
        const alive = openState === 'open' ? 'open' : 'cold'
        const key = workspaceId + '|' + activeId + '|' + alive + '|' + stage
        if (askedScope.current === key) return undefined
        askedScope.current = key
        // 会话还冷着、而上一轮已经挂上了：范围还在这一段会话上，不必再问。
        let cancelled = false
        apiPost('conceive-scope', { workspaceId, sessionId: activeId, stage })
          .then(value => { if (!cancelled) setScope(value) })
          .catch(problem => {
            if (cancelled) return
            setScope({ ok: false, error: problem instanceof Error ? problem.message : String(problem) })
          })
        return () => { cancelled = true }
      }, [workspaceId, activeId, openState, scopeTry, stage])

      /** 没挂上时点一下就重来（宿主换了、或者会话刚活过来）。 */
      const retryScope = useCallback(() => {
        askedScope.current = ''
        setScope(null)
        setScopeTry(count => count + 1)
      }, [])

      /** 用户主动发起：真的开一段会话（此前没有会话 id）。 */
      const start = useCallback(async () => {
        if (starting || typeof onStart !== 'function') return
        setStarting(true)
        try {
          await onStart()
        } finally {
          setStarting(false)
        }
      }, [starting, onStart])

      /**
       * 还没有作品时的入口：**从零开始聊**。
       *
       * 父组件干两件事：建一个草稿作品（名字与目录 id 都是暂定的）、立刻开一段会话。
       * 命名的事往后放——聊出方向再立项，而且立项**不换这段对话**。
       */
      const draftStart = useCallback(async () => {
        if (draftStarting || typeof onDraft !== 'function') return
        setDraftStarting(true)
        try {
          await onDraft()
        } finally {
          setDraftStarting(false)
        }
      }, [draftStarting, onDraft])

      /**
       * 打开**宿主的完整对话面板**，把这段会话放进去。
       *
       * 为什么还要留这个出口：侧栏这一格是嵌进来的**窄**视图，宿主的完整面板
       * 才有轨迹 / 上下文 / 编队 / 统计这几个标签。同一段会话，两个入口。
       *
       * 顺序不能反：工作区切换会把会话选择重置掉，所以**会话要先选**，
       * 工作区随后。
       */
      const openInPanel = useCallback(() => {
        if (!hasSession) return
        const helper = CTX === null ? undefined : CTX.get('uiWorkspace')
        const layout = CTX === null ? undefined : CTX.get('layout')
        try {
          if (typeof helper?.openSession === 'function') helper.openSession(activeId)
          if (dshWorkspaceId !== undefined && dshWorkspaceId !== ''
            && typeof helper?.openWorkspace === 'function') {
            helper.openWorkspace(dshWorkspaceId, () => {})
          }
          if (typeof layout?.selectPanel === 'function') layout.selectPanel('conversation')
        } catch {
          // 打不开就算了：这扇窗里照常能聊。
        }
      }, [activeId, dshWorkspaceId, hasSession])

      // 头部**两行**：第一行是「这是什么窗 + 收 / 全屏」，第二行是「哪一段对话 + 动作」。
      //
      // 一行塞不下：460px 里塞进标题 + 会话下拉 + 两个按钮，
      // 中文标题会被压成一列（`docs/dev/rendering.md` 第 5 条）。
      // 两行反而更清楚：上一行说身份，下一行说操作。
      const head = h('div', { className: 'dd-chat-head' },
        h('div', { className: 'dd-chat-titleline' },
          h(Icon, { name: 'note', size: 14 }),
          h('span', { className: 'ch-t' }, '制作助手'),
          h('span', { className: 'ch-sub' },
            !hasSession ? '还没开始'
              : openState === 'open' ? (running ? '正在想…' : '等你说话')
                : openState === 'loading' ? '正在打开…'
                  : openState === 'error' ? '打不开这段会话'
                    : '准备中…'),
          h('span', { className: 'dd-spacer' }),
          panelControls,
          h('button', { className: 'dd-icon-btn', onClick: onClose, title: '收起这扇窗（顶栏的图标能再展开）' }, h(Icon, { name: 'close', size: 13 })),
        ),
        h('div', { className: 'dd-chat-bar' },
          h(ConceiveSessionMenu, { sessions: list, current: activeId, onPick: setActiveId, titles, workspaceId }),
          h('button', {
            className: 'dd-btn sm', onClick: onFresh, disabled: !hasSession || busy,
            title: '开一段新对话（旧的那段仍留在 DSH 的会话列表里）',
          }, '新对话'),
          h('button', {
            className: 'dd-btn sm', onClick: openInPanel, disabled: !hasSession,
            title: '在宿主的完整对话面板里打开这段会话（那边有轨迹 / 上下文 / 编队 / 统计）',
          }, '完整对话'),
        ),
      )

      /**
       * 空态：还没有会话，或者宿主不给标准道具。
       *
       * 「宿主的原生对话嵌不进来」这件事要**说清楚**，不能给一个空白框让人猜。
       */
      const emptyState = h('div', { className: 'dd-chat-empty' },
        h('div', null, '这里接的是真的 DSH 会话：'),
        h('div', null, '同一个模型与工具，按当前制作阶段选用技能。'),
        h('div', { style: { marginTop: '14px' } },
          // 还没有作品时，这颗按钮不是死的：它就是「从零开始聊」——
          // 建一个草稿作品、立刻开聊，命名的事往后放。
          h('button', {
            className: 'dd-btn primary',
            onClick: canStart ? start : draftStart,
            disabled: starting || busy || (!canStart && draftStarting) || (canStart ? false : typeof onDraft !== 'function'),
            title: canStart
              ? '开一段真的构思会话'
              : (typeof onDraft === 'function'
                ? '建一个草稿作品并立刻开聊：聊出方向之后再立项命名'
                : '先选一个作品（构思会话是挂在作品上的）'),
          }, starting || draftStarting
            ? '正在开…'
            : (canStart ? '开始对话' : '从零开始聊')),
          h('div', { style: { marginTop: '10px', color: 'var(--ink4)' } },
            canStart
              ? '开好之后，聊天界面是宿主自己的那一套。'
              : (typeof onDraft === 'function'
                ? '不用先建作品：先聊方向，聊出个大概再立项命名，对话不会因此换一段。'
                : '先选一个作品（或新建一个），构思会话是挂在作品上的。'))),
      )

      // 页面本体：绑上了会话就交给宿主渲染，否则说清楚缺什么。
      const body = !hasSession || reference === null
        ? (problem !== null
          ? h('div', { className: 'dd-chat-note', title: problem },
            h('div', null, '这段会话还没在宿主那边打开——插件重装、或 DSH 重启后会这样。'),
            h('div', { style: { marginTop: '10px', color: 'var(--ink4)', fontSize: '11px' } },
              '点「开始对话」让它重新打开；如果它已经不在了，点「新对话」。'))
          : (hasSession && openState === 'error'
            ? h('div', { className: 'dd-chat-note' }, '这段会话打不开：它在宿主那边可能已被删除或归档。')
            : (hasSession ? h('div', { className: 'dd-chat-note' }, '正在打开这段会话…') : emptyState)))
        : (typeof SessionProvider !== 'function' || typeof renderSlot !== 'function'
          ? h('div', { className: 'dd-chat-note' },
            '这个宿主没有把会话槽交给插件（SessionProvider / renderSlot 缺失）：'
            + '原生对话嵌不进来。需要更新的 DSH 桌面版，或改用「完整对话」。')
          : h('div', { className: 'dd-chat-host' },
            h(SessionProvider, { session: reference },
              renderSlot('drama-desk.conversation', {}))))

      /**
       * 范围条：**这一段对话只谈哪部戏**，一眼能看见。
       *
       * 以前这件事看不见（它只在 prompt context 里，界面上什么都没有），
       * 于是「有没有带上」「带的是不是当前这一部」全靠猜。现在把它画出来：
       * 目录 ID 是固定的那一个，作品名是人认的那一个，两个都露。
       */
      const scopeWork = scope !== null && scope.ok !== false ? scope.work : undefined
      const scopeBroken = scope !== null && scope.seeded !== true && scope.reason !== 'cold'
      const scopeOther = scope !== null && scope.match === false
      const scopeCold = scope !== null && scope.seeded !== true && scope.reason === 'cold'
      const scopeStrip = scopeWork === undefined
        ? null
        : h('div', {
          className: 'dd-chat-scope',
          'data-state': scopeOther ? 'other' : scope.ok === false || scopeBroken ? 'off' : scopeCold ? 'cold' : 'on',
          title: scopeOther
            ? '这段对话属于「' + scopeWork.title + '」（' + scopeWork.id + '），工作台现在打开的是「'
              + (scope.current !== undefined ? scope.current.title : '—') + '」：换个对话，或先切到那个作品'
            : scope.ok === false
              ? String(scope.error) + '（点一下重试）'
              : scopeBroken
                ? '宿主没接住这条 prompt context（点一下重试）；先在消息里点明 `' + scopeWork.path + '/` 更保险'
                : scopeCold
                  ? '会话一打开就会把「只谈 ' + scopeWork.title + '（' + scopeWork.id + '）」挂上去'
                  : '这段对话的每一步都带着它：只读写 `' + scopeWork.path + '/`',
          onClick: scopeBroken || scope.ok === false ? retryScope : undefined,
        },
          h(Icon, { name: 'project', size: 11 }),
          h('span', { className: 'sc-a' }, scopeOther ? '属于' : '只谈'),
          h('b', { title: scopeWork.title }, scopeWork.title),
          h('span', { className: 'sc-id' }, scopeWork.id),
          // 草稿作品：名字与目录 id 都是暂定的，别让人以为这是定下来的作品。
          scopeWork.draft === true ? h('span', { className: 'sc-draft' }, '草稿') : null,
          scopeBroken ? h('span', { className: 'sc-warn' }, '范围没挂上 · 点一下重试') : null,
          scope.ok === false ? h('span', { className: 'sc-warn' }, '问不到范围 · 点一下重试') : null,
        )

      const taskStrip = task ? h('details', { className: 'dd-production-task' },
        h('summary', null, task.label + ' · 本阶段任务'),
        h('p', null, task.task),
        h('p', { className: 'path' }, '出口：' + task.output),
        task.gaps.length ? h('ul', null, task.gaps.slice(0, 5).map((gap, index) => h('li', { key: index }, gap)),
          task.gaps.length > 5 ? h('li', null, '另有 ' + (task.gaps.length - 5) + ' 项，复制任务时包含全部') : null) : null,
        h('button', { className: 'dd-btn sm', type: 'button', onClick: async () => {
          try {
            const latest = await apiGet('production', { workspace: workspaceId, stage })
            await navigator.clipboard.writeText(latest.prompt)
            setTaskMessage('已复制，粘贴到下方对话即可继续')
          } catch (error) { setTaskMessage('复制失败：' + error.message) }
        } }, '复制阶段任务'),
      ) : null
      return h('div', { className: 'dd-chat' }, head, scopeStrip, taskStrip,
        taskMessage ? h('div', { className: 'dd-note', role: 'status', style: { padding: '8px 12px' } }, taskMessage) : null, body)
    }

    // ── 会话窗的样式 ──────────────────────────────────────────────────────
    // 消息、工具卡、提问卡、composer 的样式**都在宿主那边**——这里只有
    // 「装它的那个盒子」和三样我们自己的东西（头部、原生下拉、说明块）。

    CSS_PARTS.push(`
.dd-production-task{flex:0 0 auto;padding:10px 14px;border-bottom:1px solid var(--line);background:var(--raised);box-shadow:inset 0 1px var(--hl);font-size:12px;max-height:32vh;overflow:auto}
.dd-production-task summary{cursor:pointer;color:var(--ink2);min-height:24px}
.dd-production-task p{line-height:1.65;margin:8px 0;overflow-wrap:anywhere}
.dd-production-task ul{padding-left:18px;line-height:1.7;color:var(--sig-warn)}
/* 装宿主对话的盒子：它是一条**列向** flex 链的最后一环，必须能把高度
   交给子项（宿主自己内部才是那个滚动容器）——所以 min-height:0 不能少。 */
.dd-chat{width:100%;flex:1 1 auto;min-height:0;box-shadow:-1px 0 0 var(--line);
  background:linear-gradient(180deg,var(--panel),var(--bg));
  display:flex;flex-direction:column;overflow:hidden}
.dd-chat-host{flex:1 1 auto;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.dd-chat-host>*{flex:1 1 auto;min-height:0;min-width:0}
/* 头部：**两行**。第一行身份 + 收起 / 全屏，第二行会话选择 + 动作。
   一行塞不下 460px —— 中文标题会被压成一列（rendering.md 第 5 条）。 */
.dd-chat-head{flex:none;display:flex;flex-direction:column;gap:8px;
  padding:10px 12px;box-shadow:0 1px 0 var(--line)}
.dd-chat-titleline{display:flex;align-items:center;gap:7px;min-width:0}
.dd-chat-head .ch-t{font-size:12.5px;font-weight:600;white-space:nowrap}
.dd-chat-head .ch-sub{font-size:10.5px;color:var(--ink3);font-family:var(--f-mono);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.dd-chat-bar{display:flex;align-items:center;gap:6px;min-width:0}
.dd-chat-bar .dd-btn{flex:0 0 auto}
/* 会话切换：原生 <select>，压到与头部其它控件同一重量；宽度吃掉剩余空间。 */
.dd-chat-session{
  flex:1 1 auto;min-width:0;height:24px;padding:0 6px;border-radius:var(--rx-1);
  background:var(--sunken);color:var(--ink2);border:none;box-shadow:inset 0 0 0 .5px var(--line-2);
  font-family:inherit;font-size:11px;outline:none;text-overflow:ellipsis;
}
.dd-chat-session:focus-visible{box-shadow:inset 0 0 0 .5px var(--line-2),0 0 0 1.5px var(--hot)}
.dd-chat-session:disabled{opacity:.55}
/* 说明块：空态 / 打不开 / 宿主不给槽——都不画假界面。 */
.dd-chat-note{
  margin:auto;max-width:320px;padding:22px 16px;text-align:center;
  font-size:12.5px;line-height:1.8;color:var(--ink3);
}
/* 范围条：这一段对话**只谈哪部戏**（目录 ID + 作品名）。
   它是事实，不是装饰：以前这件事只活在 prompt context 里，界面上看不见，
   于是「带没带上」「带的是不是当前这一部」全靠猜。目录 ID 用等宽字，
   因为它是模型读写文件时认的那个名字。 */
.dd-chat-scope{
  flex:none;display:flex;align-items:center;gap:6px;min-width:0;
  padding:5px 12px;font-size:11px;line-height:1.6;color:var(--ink3);
  background:var(--sunken);box-shadow:inset 0 -1px 0 var(--line);
}
.dd-chat-scope svg{flex:none;opacity:.65}
.dd-chat-scope .sc-a{flex:none;opacity:.85}
.dd-chat-scope b{flex:0 1 auto;min-width:0;font-weight:600;color:var(--ink2);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-chat-scope .sc-id{flex:none;font-family:var(--f-mono);font-size:10.5px;color:var(--ink3)}
.dd-chat-scope .sc-id::before{content:'·';margin-right:5px;opacity:.55}
/* 草稿标记：名字与目录 id 还是暂定的。 */
.dd-chat-scope .sc-draft{
  flex:none;font-family:var(--f-gauge);font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;
  padding:1px 5px;border-radius:var(--rx-1);color:var(--ink3);box-shadow:inset 0 0 0 .5px var(--line-2);
}
.dd-chat-scope .sc-warn{margin-left:auto;flex:none;color:var(--sig-warn)}
/* 没挂上 / 属于别的作品：这也是「如实回报」，不是错误页。点一下重挂。 */
.dd-chat-scope[data-state='off']{
  background:color-mix(in srgb,var(--sig-warn) 12%,transparent);cursor:pointer;
}
.dd-chat-scope[data-state='other']{
  background:color-mix(in srgb,var(--sig-warn) 12%,transparent);
}
/* 会话还没活过来：范围挂上去了但还没生效——别装作已经生效。 */
.dd-chat-scope[data-state='cold']{opacity:.72}
/* 空态：还没有会话时的引导。 */
.dd-chat-empty{margin:auto;text-align:center;color:var(--ink3);font-size:12.5px;line-height:1.85;padding:20px 14px;max-width:300px}
`)
