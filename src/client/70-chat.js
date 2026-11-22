    // ── 宿主客户端服务的接线 ───────────────────────────────────────────────
    //
    // Client 半边拿不到 `ctx`，只有 `apply(ctx)` 拿得到。把 ctx 记在这里，
    // 组件才用得上 `sessions` / `uiWorkspace` / `layout` 这些宿主服务。

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

    /** 一条消息里所有 text 块的纯文本。 */
    function textOf(message) {
      if (message === undefined || message === null) return ''
      const content = message.content
      if (!Array.isArray(content)) return typeof message.text === 'string' ? message.text : ''
      const parts = []
      for (const block of content) {
        if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
          parts.push(block.text)
        }
      }
      return parts.join('')
    }

    /** 一条消息里调用了哪些工具（assistant 消息的工具调用藏在 content 块里）。 */
    function toolsOf(message) {
      const content = message === undefined || message === null ? undefined : message.content
      if (!Array.isArray(content)) return []
      const names = []
      for (const block of content) {
        if (block !== null && typeof block === 'object' && block.type === 'tool-call' && typeof block.name === 'string') {
          names.push(block.name)
        }
      }
      return names
    }

    /** 一条消息里的推理文本（宿主的「轨迹」视图里叫 reasoning）。 */
    function reasoningOf(message) {
      const content = message === undefined || message === null ? undefined : message.content
      if (!Array.isArray(content)) return ''
      const parts = []
      for (const block of content) {
        if (block !== null && typeof block === 'object' && block.type === 'reasoning' && typeof block.text === 'string') {
          parts.push(block.text)
        }
      }
      return parts.join('\n')
    }

    /**
     * 抹掉宿主注入的上下文块。
     *
     * DSH 会把 `[system-reminder]`、记忆检索结果这类东西拼进**用户消息**里，
     * 宿主的对话面板会把它们折叠成「上下文」节点；我们这扇小窗没有那套节点，
     * 所以直接抹掉——导演想看的是自己说的话，不是系统提示。
     *
     * 同一个框也用来**藏**我们自己的开场白：它跟着用户的第一条消息一起送，
     * 模型读得到，界面上不显示（见 `ConceiveChat` 里的 `seedPending`）。
     */
    function stripInjected(text) {
      return String(text ?? '')
        .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
        .replace(/\[system-reminder\][\s\S]*$/m, '')
        .trim()
    }

    /** 一条对话行。太长的（比如宿主注入的上下文）折起来，别把输入框顶走。 */
    function MsgRow(props) {
      const { kind, text } = props
      const [open, setOpen] = useState(false)
      const long = kind !== 'tool' && typeof text === 'string' && text.length > 420
      const shown = long && !open ? text.slice(0, 420) + '…' : text
      return h('div', { className: 'dd-msg ' + kind },
        h('div', { className: 'who' },
          kind === 'user' ? '我' : kind === 'assistant' ? 'AI' : kind === 'tool' ? '工具' : '出错'),
        h('div', { className: 'body' }, shown),
        long
          ? h('button', {
            className: 'dd-btn sm ghost',
            style: { alignSelf: 'flex-start' },
            onClick: () => setOpen(!open),
          }, open ? '收起' : '展开全文')
          : null,
      )
    }

    /**
     * 「处理过程」：一组工具调用 / 推理，**默认折叠**。
     *
     * 这是宿主对话面板里「轨迹」视图的轻量版。折叠起来是因为导演要的是
     * 「它说了什么」，不是「它调了七次工具」；但那七次工具调用**必须能看见**
     * ——「AI 一句话没说就停了」是最让人困惑的现象。
     */
    function ChatProcess(props) {
      const { steps } = props
      const [open, setOpen] = useState(false)
      if (!Array.isArray(steps) || steps.length === 0) return null
      const running = steps.some(step => step.status === 'run')
      const failed = steps.some(step => step.status === 'fail')
      return h('div', { className: 'dd-process' + (open ? ' open' : '') },
        h('button', {
          className: 'dd-process-head',
          type: 'button',
          onClick: () => setOpen(!open),
          title: open ? '收起处理过程' : '展开处理过程',
        },
          h(Icon, { name: 'chevron', size: 12 }),
          h('span', null, running ? '正在处理…' : '处理过程'),
          h('span', { className: 'dd-process-count num' }, steps.length + ' 步'),
          failed ? h('span', { className: 'dd-badge fail' }, '有失败') : null,
        ),
        open
          ? h('div', { className: 'dd-process-body' },
            steps.map(step => h('div', { key: step.key, className: 'dd-process-step ' + step.status },
              h('span', { className: 'dot ' + step.status }),
              h('span', { className: 'nm' }, step.name),
              step.detail ? h('span', { className: 'dt' }, step.detail) : null,
              // 这一步改的文件：**看得见**，不用去目录里翻 mtime。
              step.path ? h('span', { className: 'dp' }, '改 ' + step.path) : null,
            )))
          : null,
      )
    }

    /**
     * 模型 / 推理强度。
     *
     * 复用宿主的**同一个真源**（`agentDefaultModel`）——不是插件自己存一份。
     * 改的是**宿主的默认选择**，所以对**新开的会话**生效；当前这段会话
     * 用的是它自己开起来时的模型（界面里写清楚了，不含糊）。
     */
    function ChatModelMenu(props) {
      const { hostModel, providers, onChange, onClose } = props
      const [open, setOpen] = useState(false)
      const [effort, setEffort] = useState(hostModel && hostModel.reasoningEffort ? hostModel.reasoningEffort : '')
      useEffect(() => {
        setEffort(hostModel && hostModel.reasoningEffort ? hostModel.reasoningEffort : '')
      }, [hostModel && hostModel.reasoningEffort])
      const model = hostModel && hostModel.model ? hostModel.model : '—'
      const level = hostModel && hostModel.reasoningEffort ? hostModel.reasoningEffort : '默认'
      const list = Array.isArray(providers) ? providers : []

      const panel = open
        ? h('div', { className: 'dd-pop' },
          h('div', { className: 'dd-pop-title' }, '模型（宿主的默认选择）'),
          list.length === 0
            ? h('div', { className: 'dd-note' }, '这个宿主没有公布模型目录。')
            : list.map(provider => h('div', { key: provider.id, className: 'dd-pop-group' },
              h('div', { className: 'dd-pop-lab' }, provider.name || provider.id),
              (provider.models || []).map(entry => h('button', {
                key: entry.id,
                className: 'dd-pop-item' + (hostModel && hostModel.model === entry.id ? ' on' : ''),
                onClick: () => { onChange(provider.id, entry.id, effort); setOpen(false) },
              }, entry.name || entry.id)),
            )),
          h('div', { className: 'dd-pop-title' }, '推理强度'),
          h('div', { className: 'dd-pop-row' },
            h('input', {
              className: 'num', value: effort, placeholder: '留空 = 模型默认',
              onChange: event => setEffort(event.target.value),
              onKeyDown: event => {
                if (event.key === 'Enter') { event.preventDefault(); onChange(hostModel ? hostModel.provider : '', hostModel ? hostModel.model : '', effort); setOpen(false) }
                if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
              },
            }),
            h('button', {
              className: 'dd-btn sm primary',
              onClick: () => { onChange(hostModel ? hostModel.provider : '', hostModel ? hostModel.model : '', effort); setOpen(false) },
            }, '应用'),
          ),
          h('div', { className: 'dd-note' }, '改的是**宿主的默认选择**：新开的会话会用它。当前这段会话仍用开起来时的模型。'),
        )
        : null

      return h('div', { className: 'dd-pop-wrap' },
        h('button', {
          className: 'dd-chip click dd-chat-model',
          type: 'button',
          title: '模型与推理强度',
          onClick: () => setOpen(value => !value),
        }, h(Icon, { name: 'settings', size: 12 }), h('span', null, model), h('span', { className: 'lv' }, '· ' + level)),
        panel,
      )
    }

    /**
     * 会话选择：同一�� DSH 工作区里的会话。
     *
     * 对话是**固定在一个工作区**里发生的（一个短剧项目 = 一个 DSH 工作区），
     * 所以这里列的就是那个工作区里的会话——不是全局的会话列表。
     */
    function ChatSessionMenu(props) {
      const { sessions, current, onPick, onClose } = props
      const [open, setOpen] = useState(false)
      const list = Array.isArray(sessions) ? sessions : []
      const panel = open
        ? h('div', { className: 'dd-pop' },
          h('div', { className: 'dd-pop-title' }, '这个作品里的对话'),
          list.length === 0
            ? h('div', { className: 'dd-note' }, '这个工作区里还没有别的会话。')
            : list.map(entry => h('button', {
              key: entry.id,
              className: 'dd-pop-item' + (entry.id === current ? ' on' : ''),
              onClick: () => { onPick(entry.id); setOpen(false) },
            },
              h('span', { className: 'nm' }, entry.title || '（未命名会话）'),
              h('span', { className: 'dt num' }, entry.id.slice(0, 8)),
            )),
        )
        : null
      return h('div', { className: 'dd-pop-wrap' },
        h('button', {
          className: 'dd-btn sm',
          type: 'button',
          title: '切换对话（同一个短剧工作区里的会话）',
          onClick: () => setOpen(value => !value),
        }, '对话'),
        panel,
      )
    }

    /**
     * Agent 向用户提问。
     *
     * 宿主有一套成熟的提问交互（`ask_user_question` 工具 + 它的卡片）。
     * 插件这扇小窗**不重复造**那套轮子：它把问题**显示出来**，并把回答
     * 交给真正能生效的通道——宿主对话面板里的那张原生卡片。
     *
     * 找不到可用通道时，按钮是**明确指向宿主**的，不是点了没反应。
     */
    function ChatQuestion(props) {
      const { question, options, onOpenHost } = props
      const [picked, setPicked] = useState([])
      const [copied, setCopied] = useState(false)
      const toggle = label => {
        setPicked(current => current.includes(label)
          ? current.filter(item => item !== label)
          : current.concat(label))
        setCopied(false)
      }
      const answerText = picked.join('；')
      const copy = () => {
        if (answerText === '') return
        try {
          if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
            void navigator.clipboard.writeText(answerText)
          }
        } catch {
          // 剪贴板不可用就算了：下面那行字还能手动选中复制。
        }
        setCopied(true)
      }
      return h('div', { className: 'dd-question' },
        h('div', { className: 'dd-question-head' },
          h(Icon, { name: 'note', size: 13 }),
          h('span', null, 'AI 需要你回答'),
        ),
        h('div', { className: 'dd-question-text' }, question),
        options.length > 0
          ? h('div', { className: 'dd-question-opts' },
            options.map(option => h('button', {
              key: option.label || option,
              className: 'dd-question-opt' + (picked.includes(option.label || option) ? ' on' : ''),
              type: 'button',
              onClick: () => toggle(option.label || option),
            },
              h('span', { className: 'nm' }, option.label || option),
              option.description ? h('span', { className: 'dt' }, option.description) : null,
            )))
          : null,
        picked.length > 0
          ? h('div', { className: 'dd-question-answer' },
            h('span', { className: 'dd-note' }, '你的选择：'),
            h('span', { className: 'dd-question-answer-text' }, answerText))
          : null,
        h('div', { className: 'dd-question-foot' },
          h('button', {
            className: 'dd-btn sm',
            type: 'button',
            disabled: picked.length === 0,
            onClick: copy,
          }, copied ? '已复制' : '复制答案'),
          h('button', {
            className: 'dd-btn sm primary',
            type: 'button',
            title: '在宿主自己的对话面板里回答（那里有原生的提问卡片，答案才能真正回传）',
            onClick: onOpenHost,
          }, '在完整对话里回答'),
        ),
        h('div', { className: 'dd-note dd-question-hint' },
          '答案要由宿主的提问卡片回传（它才接得上 agent 的等待）；这扇窗负责让你看见问题、选好答案。'),
      )
    }

    /**
     * 构思会话面板。
     *
     * **它不画一个仿造的聊天界面。** 会话是真的（真模型、真工具、
     * `drama-conceive` 技能、工作目录就是这个作品目录），这里把
     * 宿主已经折叠好的会话窗口按「谁说的」摊开，并把输入框接到
     * `session.prompt()` 上。要看完整对话（工具卡片、推理、审批），
     * 一个按钮跳回宿主自己的对话面板。
     *
     * 复用宿主能力的三处：**模型与推理强度**（同一个 `agentDefaultModel` 真源）、
     * **会话目录**（Host 半边按工作区过滤过的清单）、
     * **处理过程与提问**（宿主事件流里的工具调用与提问，按可折叠 / 可回答呈现）。
     */
    function ConceiveChat(props) {
      const {
        sessionId, seed, onClose, onFresh, onStart, canStart, busy,
        settings, panelControls, onSwitchSession, onGoto,
      } = props
      const [reference, setReference] = useState(null)
      const [error, setError] = useState(null)
      const [draft, setDraft] = useState('')
      const [starting, setStarting] = useState(false)
      /** 这段会话的「开场白」送出去了没有（送过就不再重复）。 */
      const seeded = useRef(false)
      const flowRef = useRef(null)
      /** 面板当前在看哪一段会话（默认是这个作品的构思会话）。 */
      const [viewSession, setViewSession] = useState(sessionId)
      /** 这个短剧工作区里的会话清单。 */
      const [sessionList, setSessionList] = useState([])

      useEffect(() => { setViewSession(sessionId) }, [sessionId])

      // 会话清单：只在窗口打开时拉一次（它是**清单**，不是某一镜的判定）。
      useEffect(() => {
        let cancelled = false
        apiGet('sessions').then(value => {
          if (cancelled) return
          setSessionList(value && Array.isArray(value.sessions) ? value.sessions : [])
        }).catch(() => { if (!cancelled) setSessionList([]) })
        return () => { cancelled = true }
      }, [])

      const activeId = viewSession
      useEffect(() => {
        if (!activeId) return undefined
        const sessions = CTX ? CTX.get('sessions') : undefined
        if (sessions === undefined || sessions === null || typeof sessions.retain !== 'function') {
          setError('这个宿主没有 sessions 服务：构思会话需要 DSH 桌面版或 dsh web。')
          return undefined
        }
        let current
        try {
          current = sessions.retain(activeId, { source: 'controllerOperation' })
        } catch (problem) {
          setError(problem instanceof Error ? problem.message : String(problem))
          return undefined
        }
        seeded.current = false
        setReference(current)
        setError(null)
        return () => {
          try {
            current.release()
          } catch {
            // 引用已经释放过：忽略。
          }
          setReference(null)
        }
      }, [activeId])

      const binding = reference === null ? undefined : reference.binding
      const snapshot = useStore(binding === undefined ? undefined : binding.session)
      const window_ = useStore(binding === undefined ? undefined : binding.eventSource)

      /**
       * 抹掉**我们自己的开场白**。
       *
       * 开场白是**上下文**，不是用户说的话。宿主可能把它拆成独立的一条用户
       * 消息（那样 `<system-reminder>` 的标签就跟着不见了，`stripInjected` 抓不到）。
       * 所以这里按**原文精确剔除**——只剔除我们自己塞进去的那一段。
       *
       * @param {string} text
       * @returns {string}
       */
      const stripSeed = useCallback(text => {
        let out = String(text ?? '')
        if (typeof seed === 'string' && seed !== '') {
          out = out.split(seed).join('')
        }
        return out.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim()
      }, [seed])

      /**
       * 事件流 → 界面上的行。
       *
       * 三种行：**消息**（我说的话 / 它说的话）、**处理过程**（一组工具调用与推理，
       * 默认折叠）、**提问**（Agent 要人回答）。
       */
      const rows = useMemo(() => {
        const entries = window_ !== undefined && Array.isArray(window_.entries) ? window_.entries : []
        const out = []
        let streaming = ''
        let process = null
        const flush = () => {
          if (process !== null) { out.push(process); process = null }
        }
        const pushStep = step => {
          if (process === null) {
            process = { kind: 'process', key: 'p' + step.key, steps: [step] }
            return
          }
          process.steps.push(step)
        }
        const findStep = callId => {
          const pools = [process]
          for (const row of out) if (row.kind === 'process') pools.push(row)
          for (const pool of pools) {
            if (pool === null || pool === undefined) continue
            for (const step of pool.steps) if (step.callId === callId) return step
          }
          return undefined
        }

        for (const entry of entries) {
          if (entry === null || typeof entry !== 'object') continue
          if (entry.type === 'transient') {
            const chunk = entry.event && entry.event.data ? entry.event.data.chunk : undefined
            if (chunk !== undefined && chunk !== null && chunk.type === 'text-delta' && typeof chunk.text === 'string') {
              streaming += chunk.text
            }
            continue
          }
          const event = entry.event
          if (event === undefined || event === null) continue

          if (event.type === 'user/message') {
            flush()
            const text = stripSeed(stripInjected(textOf(event.data)))
            if (text !== '') out.push({ kind: 'user', text, key: 'u' + event.seq })
            continue
          }

          if (event.type === 'assistant/message') {
            const message = event.data ? event.data.message : undefined
            const text = textOf(message)
            const thinking = reasoningOf(message)
            if (thinking !== '') {
              pushStep({ key: 'r' + event.seq, name: '思考', detail: thinking.slice(0, 120), status: 'done' })
            }
            if (text !== '') {
              flush()
              out.push({ kind: 'assistant', text, key: 'a' + event.seq })
            }
            continue
          }

          if (event.type === 'tool/call') {
            const data = event.data || {}
            const name = typeof data.name === 'string' ? data.name : 'tool'
            const args = typeof data.arguments === 'string' ? data.arguments : ''
            // **Agent 向用户提问**：单独成一张卡，不混进「处理过程」。
            if (name === 'ask_user_question') {
              flush()
              const parsed = parseQuestion(args)
              out.push({
                kind: 'question',
                key: 'q' + event.seq,
                callId: data.callId,
                question: parsed.question,
                options: parsed.options,
              })
              continue
            }
            pushStep({
              key: 't' + event.seq,
              callId: data.callId,
              name,
              detail: args.slice(0, 90),
              status: 'run',
              // **这一步改了哪个文件。**
              //
              // 「看不到产出的资产改动」是用户点名的一条痛点：agent 改完了东西，
              // 侧栏里**一个字都没留下**——你只能去作品目录里翻 mtime。
              // 工具调用的参数里就有路径，直接读出来。
              path: writtenPathOf(name, args),
            })
            continue
          }

          if (event.type === 'tool/result') {
            const data = event.data || {}
            const callId = data.message && typeof data.message.toolCallId === 'string' ? data.message.toolCallId : undefined
            const step = findStep(callId)
            if (step !== undefined) step.status = data.error ? 'fail' : 'done'
            continue
          }

          if (event.type === 'turn/end') {
            flush()
            const reason = event.data ? event.data.reason : undefined
            if (reason !== undefined && reason !== null && reason.kind === 'error') {
              const why = reason.error && typeof reason.error.message === 'string' ? reason.error.message : '这一轮失败了'
              out.push({ kind: 'err', text: why, key: 'e' + event.seq })
            }
            continue
          }
        }
        if (streaming !== '') out.push({ kind: 'assistant', text: streaming, key: 'live' })
        flush()
        return out
      }, [window_, stripSeed])

      const running = snapshot !== undefined && snapshot.running === true
      const openState = snapshot === undefined ? undefined : snapshot.openState

      /**
       * **这一轮对话改掉了哪些文件。**
       *
       * 「看不到产出的资产改动」是用户点名的一条痛点：agent 改完了东西，
       * 侧栏里一个字都没留下。工具调用里有路径，这里把它们收成一张清单，
       * 摆在消息流的最上面——**改了什么，一眼就看到**。
       */
      const changedPaths = useMemo(() => {
        const seen = new Set()
        const out = []
        for (const row of rows) {
          if (row.kind !== 'process') continue
          for (const step of row.steps) {
            if (step.path === undefined || seen.has(step.path)) continue
            seen.add(step.path)
            out.push(step.path)
          }
        }
        return out
      }, [rows])

      // 新消息进来 → 滚到底。不这么做的话，AI 说完话你还停在几句之前。
      useEffect(() => {
        const element = flowRef.current
        if (element === null) return
        element.scrollTop = element.scrollHeight
      }, [rows])

      /**
       * 开场白（`@workspaces/<id>/` 锚 + `drama-conceive` 技能 + 防串台约束）
       * 还没送出去，而且这段会话里**你还没说过话**——那就把它搭在**第一条
       * 用户消息**上一起送。
       *
       * 为什么不是「一开侧栏就自动发」：那是替用户开了个头，看着像 AI 自己
       * 在跟自己说话。开场白是上下文，不是发言——它该跟着你真正说的第一句走。
       */
      const seedPending = seeded.current === false
        && typeof seed === 'string' && seed !== ''
        && activeId === sessionId
        && !rows.some(row => row.kind === 'user')

      const send = useCallback(async () => {
        const text = draft.trim()
        if (text === '' || binding === undefined) return
        setDraft('')
        setError(null)
        // 用 `<system-reminder>` 框住：模型读得到，界面不显示（stripInjected 抹掉）。
        const payload = seedPending
          ? '<system-reminder>\n' + seed + '\n</system-reminder>\n\n' + text
          : text
        seeded.current = true
        try {
          const result = await binding.session.prompt([{ type: 'text', text: payload }], 'queue')
          if (result !== undefined && result !== null && result.ok === false) {
            seeded.current = false
            setError(result.error && result.error.message ? result.error.message : '发送失败')
          }
        } catch (problem) {
          seeded.current = false
          setError(problem instanceof Error ? problem.message : String(problem))
        }
      }, [draft, binding, seed, seedPending])

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

      const stop = useCallback(() => {
        if (binding === undefined) return
        Promise.resolve(binding.session.cancel()).catch(() => {})
      }, [binding])

      const openInPanel = useCallback(() => {
        const helper = CTX ? CTX.get('uiWorkspace') : undefined
        const layout = CTX ? CTX.get('layout') : undefined
        try {
          if (helper !== undefined && helper !== null && typeof helper.openSession === 'function') helper.openSession(activeId)
          if (layout !== undefined && layout !== null && typeof layout.selectPanel === 'function') layout.selectPanel('conversation')
        } catch {
          // 打不开就算了：面板里这段对话照常能聊。
        }
      }, [activeId])

      /** 改宿主默认模型（模型 + 推理强度）。 */
      const changeModel = useCallback(async (provider, model, effort) => {
        try {
          await apiPost('update-settings', {
            hostProvider: provider,
            hostModel: model,
            hostReasoningEffort: effort,
          })
          say('已改宿主默认模型：新开的会话会用它', 'ok')
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
        }
      }, [])

      const hasSession = activeId !== undefined
      const hostModel = settings ? settings.hostModel : undefined
      const providers = settings ? settings.providers : undefined

      /**
       * 打开一个被改过的文件 → 落到它**能被看见**的那个阶段。
       *
       * 这就是「页面联动」在聊天窗里的样子：agent 改完 `creative/brief.md`，
       * 你在消息流里点一下「改 creative/brief.md」，**直接落到创意阶段的简报**——
       * 而不是自己再去找一遍那个文件在哪个视图里。
       */
      const onOpenPath = useCallback(path => {
        if (typeof onGoto !== 'function') return
        const p = String(path ?? '').replace(/\\/g, '/')
        const stage = p.includes('creative/') || p.includes('brief.md') ? 'conceive'
          : p.includes('characters') ? 'characters'
            : p.includes('scenes') ? 'script'
              : p.includes('shots') ? 'storyboard'
                : p.includes('refs/') ? 'characters'
                  : 'generate'
        onGoto(stage)
      }, [onGoto])

      const head = h('div', { className: 'dd-chat-head' },
        h(Icon, { name: 'note', size: 14 }),
        h('div', { className: 'dd-chat-title' },
          h('div', { className: 'ch-t' }, '构思会话'),
          h('div', { className: 'ch-sub' },
            !hasSession ? '还没开始——点下面「开始对话」'
              : openState === 'open' ? (running ? '正在想…' : '等你说话')
                : openState === 'loading' ? '正在打开…'
                  : openState === 'error' ? '打不开这段会话'
                    : '准备中…'),
        ),
        h('span', { className: 'dd-spacer' }),
        hostModel
          ? h(ChatModelMenu, {
            hostModel,
            providers,
            onChange: changeModel,
          })
          : null,
        h(ChatSessionMenu, {
          sessions: sessionList,
          current: activeId,
          onPick: id => setViewSession(id),
        }),
        h('button', {
          className: 'dd-btn sm', onClick: onFresh, disabled: !hasSession || busy,
          title: '开一段新对话（旧的那段仍留在 DSH 的会话列表里）',
        }, '新对话'),
        h('button', {
          className: 'dd-btn sm', onClick: openInPanel, disabled: !hasSession,
          title: '在宿主的对话面板里打开完整聊天',
        }, '完整对话'),
        panelControls,
        h('button', { className: 'dd-icon-btn', onClick: onClose, title: '收起这扇窗（顶栏的图标能再展开）' }, h(Icon, { name: 'close', size: 13 })),
      )

      const flow = h('div', { className: 'dd-chat-flow', ref: flowRef },
        // 本轮改动：摆在最上面，**改了什么一眼就看到**。
        changedPaths.length > 0
          ? h('div', { className: 'dd-changed' },
            h('div', { className: 'dd-changed-head' },
              h(Icon, { name: 'edit', size: 12 }),
              h('span', null, '这一轮改掉了'),
              h('span', { className: 'ct num' }, String(changedPaths.length)),
              h('span', { className: 'dd-spacer' }),
              h('span', { className: 'dd-note' }, '点一下去看')),
            h('div', { className: 'dd-changed-list' },
              changedPaths.map(path => h('button', {
                key: path,
                className: 'dd-changed-item',
                type: 'button',
                title: path,
                onClick: () => onOpenPath(path),
              }, path))),
          )
          : null,
        rows.length === 0
          ? h('div', { className: 'dd-chat-empty' },
            h('div', null, '这里接的是真的 DSH 会话：'),
            h('div', null, '同一个模型、同一套工具、加载了 `drama-conceive` 技能。'),
            hasSession
              ? h('div', { style: { marginTop: '8px', color: 'var(--ink4)' } }, '它会把创意写进 creative/brief.md，你改一句它就改一句。')
              : h('div', { style: { marginTop: '14px' } },
                h('button', {
                  className: 'dd-btn primary', onClick: start,
                  disabled: starting || busy || !canStart,
                  title: canStart ? '开一段真的构思会话' : '先选一个作品（构思会话是挂在作品上的）',
                }, starting ? '正在开…' : '开始对话'),
                h('div', { style: { marginTop: '10px', color: 'var(--ink4)' } },
                  canStart
                    ? '会话由你发起：开好之后你说的话，它会写进 creative/brief.md。'
                    : '先选一个作品（或新建一个），构思会话是挂在作品上的。')))
          : rows.map(row => {
            if (row.kind === 'process') return h(ChatProcess, { key: row.key, steps: row.steps })
            if (row.kind === 'question') {
              return h(ChatQuestion, {
                key: row.key,
                question: row.question,
                options: row.options,
                onOpenHost: openInPanel,
              })
            }
            return h(MsgRow, { key: row.key, kind: row.kind, text: row.text })
          }),
        error !== null
          ? h('div', { className: 'dd-msg err' }, h('div', { className: 'body' }, error))
          : null,
      )

      const composer = h('div', { className: 'dd-chat-composer' },
        h('textarea', {
          value: draft,
          placeholder: hasSession
            ? '跟它说你想拍什么…（Enter 发送，Shift+Enter 换行）'
            : '先点「开始对话」开一段会话，然后就能跟它说了…',
          disabled: busy || binding === undefined,
          onChange: event => setDraft(event.target.value),
          onKeyDown: event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          },
        }),
        h('div', { className: 'row' },
          running
            ? h('button', { className: 'dd-btn sm danger', onClick: stop }, '停止')
            : h('button', { className: 'dd-btn sm primary', onClick: send, disabled: draft.trim() === '' || binding === undefined }, '发送'),
          h('span', { className: 'dd-spacer' }),
          h('span', { className: 'hint' }, activeId === undefined ? '' : activeId.slice(0, 8)),
        ),
      )

      return h('div', { className: 'dd-chat' }, head, flow, composer)
    }

    /**
     * 这个工具调用**写了哪个文件**。
     *
     * 宿主那几个写文件的工具（`write` / `edit` / `multi_edit` / `create_directory`…）
     * 都把路径放在参数里，键名不统一（`path` / `file_path` / `path`…），
     * 所以这里**认工具 + 扫参数**两条路都走。
     *
     * 认不出来就返回 `undefined`——**不猜**：编一个路径出来比没有更糟。
     *
     * @param {string} name 工具名
     * @param {string} args 参数（JSON 字符串）
     * @returns {string|undefined}
     */
    function writtenPathOf(name, args) {
      const writers = ['write', 'edit', 'multi_edit', 'create_directory', 'apply_patch', 'write_file']
      if (!writers.includes(name)) return undefined
      let parsed
      try {
        parsed = JSON.parse(String(args ?? ''))
      } catch {
        return undefined
      }
      if (parsed === null || typeof parsed !== 'object') return undefined
      for (const key of ['path', 'file_path', 'filePath', 'target', 'absolute_path']) {
        const value = parsed[key]
        if (typeof value === 'string' && value !== '') return value
      }
      return undefined
    }

    /**
     * 解析 `ask_user_question` 的参数。
     *
     * 参数是**工具自己约定的形状**，所以这里**容错**：认不出来就给一句原文，
     * 绝不假装解析成功。
     *
     * @param {string} args
     * @returns {{question: string, options: Array<{label: string, description?: string}>}}
     */
    function parseQuestion(args) {
      const fallback = { question: String(args ?? '').slice(0, 400), options: [] }
      let parsed
      try {
        parsed = JSON.parse(String(args ?? ''))
      } catch {
        return fallback
      }
      if (parsed === null || typeof parsed !== 'object') return fallback
      const questions = Array.isArray(parsed.questions) ? parsed.questions : []
      if (questions.length === 0) return fallback
      const first = questions[0]
      if (first === null || typeof first !== 'object') return fallback
      const options = Array.isArray(first.options)
        ? first.options
          .filter(option => option !== null && typeof option === 'object' && typeof option.label === 'string')
          .map(option => ({ label: option.label, description: typeof option.description === 'string' ? option.description : undefined }))
        : []
      const text = typeof first.question === 'string' ? first.question : ''
      const header = typeof first.header === 'string' ? first.header : ''
      const detail = typeof first.detail === 'string' ? first.detail : ''
      const question = [header, text, detail].filter(part => part !== '').join(' · ')
      return { question: question === '' ? fallback.question : question, options }
    }

    // ── 构思会话窗的样式 ──────────────────────────────────────────────────
    CSS_PARTS.push(`
/* ── 构思会话窗 ───────────────────────────────────────────────────────── */
/* 头部挤不下时**换行**，绝不把中文标题压成一列（AGENTS.md §10⑤）。 */
.dd-chat-head{display:flex;align-items:center;gap:9px;padding:11px 14px;box-shadow:0 1px 0 var(--line);flex:none;flex-wrap:wrap}
.dd-chat-title{flex:1 1 132px;min-width:132px}
.dd-chat-title .ch-t{font-size:12.5px;font-weight:600}
.dd-chat-title .ch-sub{font-size:10.5px;color:var(--ink3);font-family:var(--f-mono)}
/* 处理过程：默认折叠，但**必须看得见**（「AI 一句话没说就停了」最让人困惑）。 */
.dd-process{
  border-radius:var(--rx-2);background:var(--panel-2);overflow:hidden;
  box-shadow:inset 0 0 0 .5px var(--line);
}
.dd-process-head{
  display:flex;align-items:center;gap:7px;width:100%;padding:6px 10px;
  font-size:11.5px;color:var(--ink3);text-align:left;
}
.dd-process-head:hover{color:var(--ink)}
.dd-process-head .dd-icon-btn,.dd-process-head svg{transition:transform var(--t-fast) var(--ease)}
.dd-process.open .dd-process-head>svg:first-child{transform:rotate(90deg)}
.dd-process-count{margin-left:auto;font-size:10px;color:var(--ink4)}
.dd-process-body{display:flex;flex-direction:column;gap:3px;padding:2px 10px 8px}
.dd-process-body>*{flex:0 0 auto}
.dd-process-step{display:flex;align-items:baseline;gap:7px;font-size:11px;color:var(--ink3)}
.dd-process-step .dot{width:5px;height:5px;border-radius:50%;flex:none;background:var(--ink4)}
.dd-process-step .dot.done{background:var(--sig-pass)}
.dd-process-step .dot.run{background:var(--hot)}
.dd-process-step .dot.fail{background:var(--sig-fail)}
.dd-process-step .nm{font-family:var(--f-mono);font-size:10.5px;color:var(--ink2)}
.dd-process-step .dt{
  font-family:var(--f-mono);font-size:10px;color:var(--ink4);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;
}

/* 弹出层（模型 / 会话）：贴在触发器下面。 */
.dd-pop-wrap{position:relative;flex:none}
.dd-pop{
  position:absolute;right:0;top:calc(100% + 6px);z-index:30;width:min(300px,78vw);
  display:flex;flex-direction:column;gap:4px;padding:9px 10px;
  border-radius:var(--rx-2);background:var(--raised);box-shadow:var(--e-4);
  max-height:min(420px,60vh);overflow:auto;
}
.dd-pop>*{flex:0 0 auto}
.dd-pop-title{
  font-family:var(--f-gauge);font-size:9px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--ink3);padding:4px 2px 1px;
}
.dd-pop-lab{font-size:11px;color:var(--ink3);padding:3px 2px}
.dd-pop-item{
  display:flex;align-items:baseline;gap:8px;width:100%;padding:5px 8px;border-radius:var(--rx-1);
  font-size:12px;color:var(--ink2);text-align:left;
}
.dd-pop-item:hover{background:var(--sunken);color:var(--ink)}
.dd-pop-item.on{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-pop-item .nm{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-pop-item .dt{font-family:var(--f-mono);font-size:10px;color:var(--ink4);flex:none}
.dd-pop-row{display:flex;gap:6px;align-items:center}
.dd-pop-row input{
  flex:1 1 auto;min-width:0;height:26px;padding:0 9px;border-radius:var(--rx-1);
  background:var(--sunken);box-shadow:var(--e-well);border:none;outline:none;
  font-family:var(--f-mono);font-size:11.5px;color:var(--ink);
}
.dd-chat-model{gap:6px;max-width:150px;min-width:0}
.dd-chat-model>span:not(.lv){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-chat-model .lv{font-family:var(--f-mono);font-size:10px;color:var(--ink4);flex:none}

/* Agent 向用户提问。 */
.dd-question{
  border-radius:var(--rx-2);padding:10px 12px;display:flex;flex-direction:column;gap:8px;
  background:color-mix(in srgb,var(--hot) 8%,var(--raised));
  box-shadow:inset 0 0 0 .5px var(--hot-line);
}
.dd-question>*{flex:0 0 auto}
.dd-question-head{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--hot);font-weight:600}
.dd-question-text{font-size:12.5px;line-height:1.7;color:var(--ink)}
.dd-question-opts{display:flex;flex-direction:column;gap:5px}
.dd-question-opt{
  display:flex;flex-direction:column;gap:2px;align-items:flex-start;text-align:left;
  padding:6px 9px;border-radius:var(--rx-1);
  box-shadow:inset 0 0 0 .5px var(--line);font-size:12px;color:var(--ink2);
}
.dd-question-opt:hover{color:var(--ink);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-question-opt.on{color:var(--ink);box-shadow:inset 0 0 0 1px var(--hot-line);background:color-mix(in srgb,var(--hot) 10%,transparent)}
.dd-question-opt .nm{font-weight:600}
.dd-question-opt .dt{font-size:11px;color:var(--ink3)}
.dd-question-foot{display:flex;gap:7px;align-items:center}
.dd-question-answer{display:flex;align-items:baseline;gap:6px;min-width:0}
.dd-question-answer-text{
  font-size:12px;color:var(--ink);min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.dd-question-hint{font-size:10.5px;line-height:1.6}

/* **本轮改动**：agent 改了什么，摆在消息流的最上面。 */
.dd-changed{
  display:flex;flex-direction:column;gap:6px;padding:9px 11px;border-radius:var(--rx-2);
  background:color-mix(in srgb,var(--sig-pass) 7%,var(--raised));
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-pass) 30%,transparent);
}
.dd-changed>*{flex:0 0 auto}
.dd-changed-head{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--ink2)}
.dd-changed-head .ct{font-family:var(--f-mono);font-size:10.5px;color:var(--sig-pass)}
.dd-changed-list{display:flex;flex-direction:column;gap:3px}
.dd-changed-item{
  display:block;width:100%;text-align:left;padding:3px 7px;border-radius:var(--rx-1);
  font-family:var(--f-mono);font-size:10.5px;color:var(--ink3);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.dd-changed-item:hover{color:var(--hot);background:var(--sunken)}
/* 处理过程里那一行的「改了哪个文件」。 */
.dd-process-step .dp{
  font-family:var(--f-mono);font-size:10px;color:var(--sig-pass);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;
}
`)
