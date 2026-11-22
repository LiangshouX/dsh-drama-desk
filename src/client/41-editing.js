    // ══ 文本编辑组件（统一）═══════════════════════════════════════════════
    //
    // 这一块是**整个工作台唯一的改法**（`docs/dev/ui-language.md` U6）。规则来自长期记忆里的
    // 《文本编辑组件最佳实践》，逐条落在这里：
    //
    //   · **读态就是内容**：多行文本按 **markdown** 渲染，读起来是给人看的。
    //   · **一种手势，一个入口**：点那段字就改。以前是「✎ 就地改」+「⤢ 放大」两枚并排的
    //     20px 小按钮、默认 34% 透明度 —— 记忆里反模式表的第一条正是「两个同义按钮让人
    //     怀疑它们不是一回事」，而 34% 透明度等于把「怎么改」藏起来。用户第二次说
    //     「手感不好」，指的就是这个：内容看着能点，点了没反应。
    //   · **两态几何完全一致 ⇒ 页面不跳**。上一版是**假达标**：编辑态多一条
    //     `.dd-ed-box.editing{margin-bottom:15px}`（下方所有内容整体下移 15px），
    //     读态多一条 `margin-left:-7px`（正文左右横移 7px）。两条都是实测量出来的跳动。
    //   · **编辑框随内容长高，不内滚**。锁死成读态高度 + 内部滚动条 = 在 44px 的窗口里
    //     改三百字；外层面板本身也能滚 ⇒ 两层滚动条叠在一起。这是「手感不好」最直接的来源。
    //   · **长文档不就地改**。markdown 渲染高度与源码高度天然不同（简报实测 1025px vs
    //     1424px），就地换态必跳。超过阈值改成「点内容 → 放大窗口」，窗口里两态尺寸恒定。
    //   · **真改了才存**：失焦 / Enter 保存，Esc 还原；只敲空格又删回去不算改动。
    //   · **保存失败留在原地**：`onSave` 返回 `false` = 没存上，草稿一个字都不丢。

    /**
     * 放大窗口的宿主。
     *
     * 字段们只管喊一声「我要开一个放大窗口」，由**根组件**统一渲染——
     * 这样浮层永远在根上，不会被中间容器的 `overflow` 裁掉，
     * 也不会被别的东西盖住。
     */
    let TEXT_DIALOG_HOST = null

    /**
     * 超过这个字数就不再就地改。
     *
     * 为什么有阈值而不是一律就地改：长文本的 markdown 渲染版面与源码版面差得很远，
     * 就地换态一定跳（简报实测：渲染 1025px / 源码 1424px）。跳到放大窗口里改，
     * 窗口自身的两态尺寸是恒定的（记忆 R2），跳动的根源被移走了，而不是被掩盖。
     */
    const TEXT_INLINE_LIMIT = 600

    /** 请根组件开一个放大编辑窗口。 */
    function openTextDialog(spec) {
      if (TEXT_DIALOG_HOST === null) return
      TEXT_DIALOG_HOST(spec)
    }

    /** 读态的内容：markdown 或纯文本。 */
    function EditableRead(props) {
      const { text, markdown, placeholder, emptyHint } = props
      if (text === '') {
        // 空值：占位文案，或者调用方给的一段说明（比「（空）」有用得多）。
        if (emptyHint !== undefined && emptyHint !== null) return emptyHint
        return h('span', { className: 'dd-tf-empty' }, placeholder ?? '（空）')
      }
      if (markdown) return h('div', { className: 'dd-md' }, h(MarkdownLite, { text }))
      return h('span', { className: 'dd-tf-text' }, text)
    }

    /**
     * 一个可编辑的文本字段。
     *
     * 短字段：点内容 → 原地编辑（几何不变、随内容长高），右上角的 ⤢ 是**可选**的放大路径。
     * 长字段：点内容 → 放大窗口（那里才有两态恒定的版面）。
     */
    function Editable(props) {
      const {
        label, labelTitle, value, onSave, multiline, disabled, readOnly,
        placeholder, type, layout, serif, mono, className, style, title,
        markdown, expandable, editSignal, emptyHint,
      } = props
      const canEdit = !readOnly && !disabled && typeof onSave === 'function'
      const [editing, setEditing] = useState(false)
      const [draft, setDraft] = useState(value ?? '')
      const [failed, setFailed] = useState(false)
      const boxRef = useRef(null)
      const nodeRef = useRef(null)
      const editingRef = useRef(false)
      /** 读态量出来的高度：编辑框的**地板**（内容再少也不比读态矮）。 */
      const floorRef = useRef(0)
      // 服务端最后一次给的值：用来判断「服务器真的变了」，
      // 而不是「我这边重新渲染了」。**外部刷新不许冲掉正在改的草稿。**
      const serverRef = useRef(value ?? '')

      useEffect(() => {
        const incoming = value ?? ''
        if (String(incoming) !== String(serverRef.current)) {
          serverRef.current = incoming
          if (!editingRef.current) setDraft(incoming)
        }
      }, [value])

      // 聚焦：把光标放到末尾，但**不要**让浏览器把页面滚过去。
      useEffect(() => {
        if (!editing || !nodeRef.current) return
        const node = nodeRef.current
        try {
          const end = node.value.length
          node.setSelectionRange(end, end)
        } catch { /* 某些 input 类型不支持选区，忽略 */ }
        try {
          node.focus({ preventScroll: true })
        } catch {
          node.focus()
        }
      }, [editing])

      const current = value === undefined || value === null ? '' : String(value)
      const empty = current === ''
      const dirty = draft !== current
      // 读态默认按 markdown 渲染（多行才渲染：单行没有 markdown 可言）。
      const useMarkdown = markdown === undefined ? multiline === true : markdown === true
      // 长文档：不给就地编辑这条路（必跳），一律走放大窗口。
      const longText = current.length > TEXT_INLINE_LIMIT
      // 放大按钮：短的多行字段给一枚可选的「放大」；长的整个面就是入口，不用再给按钮。
      const canExpand = !longText && (expandable === undefined ? multiline === true : expandable === true)

      /** 量一下读态有多高：编辑框以它为地板，内容多了再长。 */
      const measureFloor = () => {
        const box = boxRef.current
        floorRef.current = box === null ? 0 : Math.round(box.getBoundingClientRect().height)
      }

      const begin = () => {
        if (!canEdit || editingRef.current) return
        editingRef.current = true
        measureFloor()
        setFailed(false)
        setEditing(true)
      }

      /** 打开放大窗口：把当前值带过去，在那里改。 */
      const enlarge = () => {
        measureFloor()
        openTextDialog({
          title: typeof label === 'string' && label !== '' ? label : (labelTitle ?? '编辑'),
          value: current,
          placeholder,
          serif,
          mono,
          // 空字段直接进编辑态（面对空纸不知道要干什么），有内容先看成品。
          initialMode: current.trim() === '' ? 'edit' : 'preview',
          // **把成功/失败如实带回来。** 以前这里写成 `next => { onSave(next) }`，
          // 箭头函数没有 return ⇒ 永远拿不到结果 ⇒ 存失败了窗口也照样说「存好了」。
          onSave: async next => {
            const result = await onSave(next)
            return result !== false
          },
        })
      }

      /**
       * 点内容要干什么。
       *
       * 长文档 → 放大窗口；短字段 → 就地改。
       * 两个守卫：① 用户正在**选字**（比如要复制）时不许进编辑；
       * ② 不可编辑的字段什么都不做（它连光标都不该变成 text）。
       */
      const surfaceClick = () => {
        if (!canEdit) return
        const selection = typeof window.getSelection === 'function' ? window.getSelection() : null
        if (selection !== null && selection.isCollapsed !== true) {
          const box = boxRef.current
          const anchor = selection.anchorNode
          if (box !== null && anchor !== null && anchor !== undefined && box.contains(anchor)) return
        }
        if (longText) { enlarge(); return }
        begin()
      }

      // **从外部进入编辑态**：空态的「写第一版」按钮靠它。
      //
      // 信号值一变就进编辑态；相同信号重复触发不会重置正在写的草稿。
      const signalRef = useRef(editSignal)
      useEffect(() => {
        if (editSignal === undefined || editSignal === signalRef.current) return
        signalRef.current = editSignal
        if (editingRef.current) return
        if (longText) { enlarge(); return }
        begin()
        // begin / enlarge 只依赖 canEdit 与长度；信号变化才是触发点。
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [editSignal])

      /**
       * 编辑框的高度：**地板是读态高度，上限是内容高度**（超过半屏才允许内滚）。
       *
       * `scrollHeight` 与元素当前高度无关，所以不必先 `height:'auto'` 再量——
       * 那样会在每帧多一次强制布局（打字时肉眼可见的涩）。
       */
      React.useLayoutEffect(() => {
        if (!editing) return
        const node = nodeRef.current
        if (node === null || node.tagName !== 'TEXTAREA') return
        const cap = Math.max(140, Math.round((window.innerHeight || 800) * 0.45))
        const need = node.scrollHeight
        const height = Math.min(cap, Math.max(need, floorRef.current))
        node.style.height = height + 'px'
        node.style.overflowY = need > cap ? 'auto' : 'hidden'
      }, [editing, draft])

      const commit = async () => {
        if (!editingRef.current) return
        if (draft === current) {
          editingRef.current = false
          setEditing(false)
          return
        }
        const result = await onSave(draft)
        if (result === false) {
          // **没存上就不许退出编辑态**：草稿全在，再点一次保存就行。
          setFailed(true)
          return
        }
        setFailed(false)
        editingRef.current = false
        setEditing(false)
      }

      const cancel = () => {
        if (!editingRef.current) return
        editingRef.current = false
        setDraft(current)
        setFailed(false)
        setEditing(false)
      }

      const onKeyDown = event => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          cancel()
        } else if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          void commit()
        }
      }

      const cls = 'dd-ed'
        + (layout === 'row' ? ' row' : '')
        + (serif ? ' serif' : '')
        + (mono ? ' mono' : '')
        + (multiline ? ' multi' : '')
        + (canEdit ? '' : ' readonly')
        + (longText ? ' longtext' : '')
        + (className ? ' ' + className : '')
      const head = label
        ? h('div', { className: 'dd-ed-lab', title: labelTitle || undefined }, label)
        : null
      const hint = canEdit
        ? (longText ? '点一下，在放大窗口里改' : '点一下就能改')
        : undefined

      if (!editing) {
        // **读态就是读态，但它自己是入口。**
        //
        // 「点内容不跳进编辑」那条规矩是为了治「页面一直跳」，不是为了让内容变成死的。
        // 跳动的根因已经修掉了（两态几何完全一致），于是可以把直接的手势还回来。
        const boxProps = {
          className: 'dd-ed-box' + (canEdit ? ' can' : ''),
          ref: boxRef,
          onClick: surfaceClick,
          title: title || hint,
        }
        // 长文档整个面就是唯一入口 ⇒ 它必须能用键盘打开。
        if (longText && canEdit) {
          boxProps.role = 'button'
          boxProps.tabIndex = 0
          boxProps.onKeyDown = event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); enlarge() }
          }
        }
        return h('div', { className: cls, style },
          head,
          h('div', boxProps,
            h('div', {
              className: 'dd-ed-val' + (empty ? ' empty' : '') + (useMarkdown ? ' md' : ''),
            }, h(EditableRead, { text: current, markdown: useMarkdown, placeholder, emptyHint })),
            canExpand
              ? h('div', { className: 'dd-tf-tools' },
                h('button', {
                  className: 'dd-tf-expand',
                  type: 'button',
                  title: '放大编辑（长文本在这里改更舒服）',
                  'aria-label': '放大编辑' + (typeof label === 'string' && label !== '' ? '：' + label : ''),
                  onMouseDown: event => event.preventDefault(),
                  onClick: event => { event.stopPropagation(); enlarge() },
                }, h(Icon, { name: 'expand', size: 12 })),
              )
              : null,
          ),
        )
      }

      return h('div', { className: cls, style },
        head,
        h('div', { className: 'dd-ed-box editing', ref: boxRef },
          h('div', {
            className: 'dd-ed-edit acting'
              + (serif ? ' serif' : '')
              + (mono ? ' mono' : '')
              + (failed ? ' failed' : ''),
          },
            multiline
              ? h('textarea', {
                ref: nodeRef, value: draft, placeholder, spellCheck: false,
                onChange: event => setDraft(event.target.value),
                onKeyDown, onBlur: () => { void commit() },
              })
              : h('input', {
                ref: nodeRef, type: type ?? 'text', value: draft, placeholder,
                onChange: event => setDraft(event.target.value),
                onKeyDown, onBlur: () => { void commit() },
              }),
            h('span', { className: 'dd-ed-acts' },
              h('button', {
                className: 'dd-ed-act ok', type: 'button',
                title: '保存（失焦、Enter 或 Ctrl+Enter）',
                onMouseDown: event => event.preventDefault(),
                onClick: () => { void commit() },
              }, h(Icon, { name: 'check', size: 11 })),
              h('button', {
                className: 'dd-ed-act no', type: 'button', title: '撤销（Esc）',
                onMouseDown: event => event.preventDefault(),
                onClick: cancel,
              }, h(Icon, { name: 'close', size: 11 })),
            ),
          ),
          // 字数：算**草稿**，编辑时实时变。
          // 它落在正文右侧那条**常驻留白**里（读态与编辑态都留着 48px），
          // 所以既不压在字上，也不占新的高度 ⇒ 不跳。
          multiline ? h('span', { className: 'dd-tf-count' }, draft.length + ' 字') : null,
          failed
            ? h('span', { className: 'dd-ed-fail' }, '没存上，改动还在')
            : null,
        ),
      )
    }

    /**
     * 放大编辑窗口。
     *
     * 一块占满可用高度的纸：上面是头部（标题 / 字数 / 未保存 / 预览·编辑 / 保存），
     * 下面是正文。**两态共用同一个盒子**（`flex:1 1 auto` + `minHeight:0`），
     * 所以从预览切到编辑，窗口不会「呼吸」。
     *
     * 关闭守卫：Esc / 点遮罩 / 【关闭】走**同一条判定**——有未保存改动就关不掉，
     * 但一定给出路（琥珀警告条 + 「放弃修改」）。
     */
    function TextDialog(props) {
      const { title, value, onSave, onClose, placeholder, serif, mono, initialMode } = props
      const text = value ?? ''
      const [mode, setMode] = useState(initialMode === 'edit' ? 'edit' : 'preview')
      const [draft, setDraft] = useState(text)
      /**
       * **已保存的基线。**
       *
       * 以前这里直接拿 prop `value` 当基线，而 `value` 是**打开那一刻的快照**——
       * 于是存成功之后 `dirty` 永远还是 true：头部一直挂着「未保存」，
       * 而【保存】按钮只在编辑态出现 ⇒ 窗口里再没有任何出口，
       * 只能点「放弃修改」把刚存好的东西再丢一次。这条是实测出来的死锁。
       */
      const [baseline, setBaseline] = useState(text)
      const [busy, setBusy] = useState(false)
      const [failed, setFailed] = useState(false)
      const [warned, setWarned] = useState(false)
      const warnTimer = useRef(undefined)
      const areaRef = useRef(null)
      const dirty = draft !== baseline

      const warnUnsaved = () => {
        setWarned(true)
        if (warnTimer.current !== undefined) clearTimeout(warnTimer.current)
        warnTimer.current = setTimeout(() => setWarned(false), 2600)
      }

      // Esc 只挂一次，用 ref 读最新状态（每次输入都重挂是常见的陈旧闭包坑）。
      const latest = useRef({ dirty, mode })
      latest.current = { dirty, mode }
      const requestClose = useCallback(() => {
        if (latest.current.dirty) { warnUnsaved(); return }
        onClose()
      }, [onClose])
      const requestCloseRef = useRef(requestClose)
      requestCloseRef.current = requestClose
      useEffect(() => {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined
        const handler = event => {
          if (event.key === 'Escape') { event.stopPropagation(); requestCloseRef.current() }
        }
        window.addEventListener('keydown', handler, true)
        return () => window.removeEventListener('keydown', handler, true)
      }, [])

      // 切到编辑态就把焦点交给正文：不抢焦点的话用户得再点一次。
      useEffect(() => {
        if (mode !== 'edit' || areaRef.current === null) return
        try { areaRef.current.focus({ preventScroll: true }) } catch { areaRef.current.focus() }
      }, [mode])

      const commit = async () => {
        if (busy) return
        if (draft === baseline) { setMode('preview'); return }
        setBusy(true)
        setFailed(false)
        try {
          const ok = await onSave(draft)
          if (ok === false) {
            // 没存上：留在编辑态，草稿一个字都不丢，给出原因而不是静默回到预览。
            setFailed(true)
            return
          }
          setBaseline(draft)
          setMode('preview')
        } finally {
          setBusy(false)
        }
      }

      const chip = (key, label) => h('button', {
        key,
        type: 'button',
        'aria-pressed': mode === key,
        className: 'dd-tf-chip' + (mode === key ? ' on' : ''),
        onClick: () => setMode(key),
      }, label)

      const body = mode === 'edit'
        ? h('textarea', {
          ref: areaRef,
          className: 'dd-tf-area' + (serif ? ' serif' : '') + (mono ? ' mono' : ''),
          value: draft, placeholder, spellCheck: false,
          onChange: event => setDraft(event.target.value),
          onKeyDown: event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void commit() }
          },
        })
        : h('div', { className: 'dd-tf-paper' },
          draft.trim() === ''
            ? h('span', { className: 'dd-tf-empty' }, '（空）')
            : h('div', { className: 'dd-md' }, h(MarkdownLite, { text: draft })))

      const warnStrip = warned
        ? h('div', { className: 'dd-tf-warn' },
          h('span', null, '有未保存的改动。先保存，或者放弃这次修改。'),
          h('button', {
            type: 'button', className: 'dd-btn sm',
            title: '丢掉这次修改，关闭窗口',
            onClick: onClose,
          }, '放弃修改'))
        : null
      const failStrip = failed
        ? h('div', { className: 'dd-tf-fail' },
          h('span', null, '没存上。改动还在——再点一次保存，或者先复制走。'),
          h('button', {
            type: 'button', className: 'dd-btn sm',
            title: '重试保存',
            onClick: () => { void commit() },
          }, '重试'))
        : null

      const head = h('div', { className: 'dd-tf-head' },
        h('span', { className: 'dd-tf-title' }, title || '编辑'),
        // 字数常驻头部、算草稿、两态都在（记忆 R5）。
        h('span', { className: 'dd-tf-meta num' }, draft.length + ' 字'),
        dirty ? h('span', { className: 'dd-tf-dirty' }, '未保存') : null,
        h('span', { className: 'dd-spacer' }),
        h('div', { className: 'dd-tf-seg' }, chip('preview', '预览'), chip('edit', '编辑')),
        // **只有真改了才有【保存】**：没改就不该有一个按钮等着被误点（记忆 R4）。
        dirty
          ? h('button', {
            type: 'button', className: 'dd-btn sm primary', disabled: busy,
            onClick: () => { void commit() },
          }, busy ? '保存中…' : '保存')
          : null,
        h('button', {
          type: 'button', className: 'dd-icon-btn', title: '关闭',
          onClick: requestClose,
        }, h(Icon, { name: 'close', size: 13 })),
      )

      return h('div', {
        className: 'dd-tf-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': title || '编辑',
        onMouseDown: event => { if (event.target === event.currentTarget) requestClose() },
      },
        h('div', {
          className: 'dd-tf-card' + (warned ? ' warned' : ''),
        },
          head,
          warnStrip,
          failStrip,
          h('div', { className: 'dd-tf-body' }, body),
        ),
      )
    }

    /**
     * A row of preset chips + a free-text escape hatch.
     *
     * 预置只是省事：不满足时仍然可以手填。
     * 手填的那条路**失焦即存**——以前它只在 `custom` 为真时才存，
     * 于是「值不在预置里」的情况改完一松手就没了。
     */
    function PresetField(props) {
      const { label, value, options, onSave, disabled, allowCustom, wide } = props
      const [custom, setCustom] = useState(false)
      const [draft, setDraft] = useState(value ?? '')
      useEffect(() => { setDraft(value ?? '') }, [value])
      const known = options.map(option => String(option))
      const isKnown = known.includes(String(value))
      const showInput = allowCustom && (custom || !isKnown)
      const commitCustom = () => {
        setCustom(false)
        if (draft !== String(value ?? '')) onSave(draft)
      }
      return h('div', { className: 'dd-field' + (wide ? ' wide' : '') },
        h('label', null, label),
        h('div', { className: 'preset' },
          options.map(option => h('button', {
            key: String(option),
            className: String(value) === String(option) ? 'on' : '',
            disabled,
            onClick: () => { setCustom(false); if (String(value) !== String(option)) onSave(option) },
          }, String(option))),
          allowCustom
            ? h('button', {
              className: isKnown ? '' : 'on',
              disabled,
              title: '不满足预置？手填一个',
              onClick: () => setCustom(!custom),
            }, '自定义…')
            : null,
        ),
        showInput
          ? h('input', {
            className: 'num', value: draft, disabled, placeholder: '自定义值',
            onChange: event => setDraft(event.target.value),
            onKeyDown: event => {
              if (event.key === 'Enter') { event.preventDefault(); commitCustom() }
              if (event.key === 'Escape') { event.preventDefault(); setDraft(value ?? ''); setCustom(false) }
            },
            onBlur: commitCustom,
          })
          : null,
      )
    }

    // ── 文本编辑组件的样式 ────────────────────────────────────────────────
    // 放在组件旁边，而不是散在 30-theme.js 里——样式跟着组件走，改一处就够。
    //
    // **两态几何一致**是这一块的验收标准，不是审美偏好：
    // 下面每一条「读态有、编辑态也有」的声明，都是为了切换时不产生任何位移。
    // 实测过两次翻车：`margin-bottom:15px` 让下方内容整体下移 15px；
    // `margin-left:-7px` 让正文左右横移 7px。
    CSS_PARTS.push(`
/* ── 文本编辑组件 ─────────────────────────────────────────────────────── */
.dd-ed{display:flex;flex-direction:column;gap:2px;min-width:0;position:relative}
.dd-ed.row{display:grid;grid-template-columns:var(--ed-lab,116px) minmax(0,1fr);gap:14px;align-items:baseline}
.dd-ed-lab{
  font-family:var(--f-gauge);font-size:10px;color:var(--ink3);
  letter-spacing:.1em;text-transform:uppercase;line-height:1.5;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
/* 读态与编辑态的**排版度量必须完全一致**（字号/行高/内边距/宽度），
   否则切换时盒子会变高变低——这就是「页面一直跳」的根源。 */
.dd-ed-box{position:relative;min-width:0;border-radius:var(--rx-1)}
.dd-ed-box.can{cursor:text}
.dd-ed-val{
  font-size:12.5px;line-height:1.65;color:var(--ink);
  padding:3px 7px;
  min-height:28px;border-radius:var(--rx-1);
  border-bottom:.5px dashed transparent;cursor:text;
  white-space:pre-wrap;word-break:break-word;
  transition:border-color var(--t-fast) var(--ease),color var(--t-fast) var(--ease),background var(--t-fast) var(--ease);
}
/* 多行字段：读态与编辑态的**最小高度相同** ⇒ 切换时高度不变。 */
.dd-ed.multi .dd-ed-val{min-height:44px}
.dd-ed-box.can:hover .dd-ed-val{border-bottom-color:var(--hot-line);background:color-mix(in srgb,var(--hot) 6%,transparent)}
.dd-ed-val.empty{color:var(--ink4)}
.dd-ed.readonly .dd-ed-val,.dd-ed.readonly .dd-ed-box{cursor:default}
.dd-ed.readonly .dd-ed-box:hover .dd-ed-val{border-bottom-color:transparent;background:transparent}
.dd-ed.serif .dd-ed-val{font-family:var(--serif);font-size:15px;line-height:1.5}
.dd-ed.mono .dd-ed-val{font-family:var(--f-mono);font-size:11.5px}
.dd-ed.multi.serif .dd-ed-val{min-height:78px}
.dd-ed.multi.mono .dd-ed-val{min-height:56px}

/* 读态里的 markdown：给人看的排版，不是源码。
   元素级的排版住在 82-docs.js（跟着渲染器走），这里只管外壳。 */
.dd-ed-val.md{white-space:normal}
.dd-md{font-size:12.5px;line-height:1.7;color:var(--ink);min-width:0}
.dd-ed.serif .dd-md{font-family:var(--serif);font-size:14.5px;line-height:1.65}
.dd-tf-empty{color:var(--ink4)}
.dd-tf-text{white-space:pre-wrap}

/* 可选的放大入口：**常驻、安静**，悬停才亮。
   它现在只是一个「另一条路」——主路是点内容。 */
.dd-tf-tools{
  position:absolute;top:1px;right:1px;z-index:2;
  display:flex;align-items:center;gap:2px;
  opacity:.4;transition:opacity var(--t-fast) var(--ease);
}
.dd-ed-box:hover .dd-tf-tools,.dd-tf-tools:focus-within{opacity:1}
.dd-tf-expand{
  width:20px;height:20px;border-radius:var(--rx-1);
  display:grid;place-items:center;color:var(--ink3);
  background:color-mix(in srgb,var(--raised) 88%,transparent);
  box-shadow:inset 0 0 0 .5px var(--line);
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-tf-expand:hover{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
/* 给右上角留位：**常驻**留（不是悬停才留），所以读态与编辑态的可用宽度一致 ⇒ 不跳。 */
.dd-ed:not(.readonly) .dd-ed-val{padding-right:48px}
.dd-ed:not(.readonly) .dd-ed-edit input,
.dd-ed:not(.readonly) .dd-ed-edit textarea{padding-right:48px}
/* 长文档：整块面就是入口，给一点「这是一张纸」的暗示。 */
.dd-ed.longtext .dd-ed-box.can:hover .dd-ed-val{background:color-mix(in srgb,var(--hot) 4%,transparent)}
.dd-ed.longtext .dd-ed-box.can:focus-visible{outline:none;box-shadow:0 0 0 1.5px var(--hot)}

/* 编辑态：与读态同一套度量，只是多了个内阴影。 */
.dd-ed-edit{position:relative;display:block}
.dd-ed-edit input,.dd-ed-edit textarea{
  display:block;width:100%;background:var(--sunken);border:none;
  box-shadow:var(--e-well);border-radius:var(--rx-1);color:var(--ink);
  font-family:inherit;font-size:12.5px;line-height:1.65;padding:3px 7px;outline:none;
  box-sizing:border-box;resize:none;white-space:pre-wrap;
  transition:box-shadow var(--t-fast) var(--ease);
}
.dd-ed-edit input{height:28px}
.dd-ed.multi .dd-ed-edit textarea{min-height:44px}
.dd-ed-edit.serif input,.dd-ed-edit.serif textarea{font-family:var(--serif);font-size:15px;line-height:1.5}
.dd-ed-edit.mono input,.dd-ed-edit.mono textarea{font-family:var(--f-mono);font-size:11.5px}
.dd-ed-edit.serif textarea{min-height:52px}
.dd-ed-edit.mono textarea{min-height:38px}
.dd-ed-edit input:focus,.dd-ed-edit textarea:focus{box-shadow:var(--e-well),0 0 0 1.5px var(--hot)}
.dd-ed-edit.failed textarea,.dd-ed-edit.failed input{box-shadow:var(--e-well),0 0 0 1.5px var(--sig-fail)}
.dd-ed-acts{position:absolute;top:3px;right:5px;display:flex;gap:3px}
.dd-ed-act{
  width:20px;height:20px;border-radius:var(--rx-1);display:grid;place-items:center;
  color:var(--ink4);box-shadow:inset 0 0 0 .5px var(--line);
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-ed-act:hover{color:var(--ink);background:var(--panel-2)}
.dd-ed-act.ok:hover{color:var(--sig-pass);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-pass) 45%,transparent)}
.dd-ed-act.no:hover{color:var(--sig-fail);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-fail) 45%,transparent)}
/* 字数：算草稿，编辑时实时变。
   位置在正文右侧那条**常驻留白**里（48px），所以不压字、不占高度 ⇒ 不跳。 */
.dd-tf-count{
  position:absolute;right:8px;bottom:3px;pointer-events:none;
  font-family:var(--f-mono);font-size:10px;color:var(--ink4);
  padding:0 4px;border-radius:var(--rx-1);
  background:color-mix(in srgb,var(--sunken) 88%,transparent);
}
/* 存不上：一条贴着正文的细提示，**不再撑高整块**（以前它靠 margin 腾地方）。 */
.dd-ed-fail{
  position:absolute;left:0;top:100%;z-index:2;
  font-size:10.5px;color:var(--sig-fail);white-space:nowrap;
  padding:1px 5px;border-radius:var(--rx-1);
  background:color-mix(in srgb,var(--sig-fail) 12%,var(--panel));
}

/* ── 放大编辑窗口 ─────────────────────────────────────────────────────── */
.dd-tf-overlay{
  position:fixed;inset:0;z-index:120;display:grid;place-items:center;
  background:color-mix(in srgb,var(--bg) 40%,rgba(0,0,0,.72));
}
.dd-tf-card{
  width:min(1080px,100%);height:min(88vh,940px);max-height:calc(100vh - 40px);
  display:flex;flex-direction:column;gap:12px;padding:18px 20px 20px;
  border-radius:var(--rx-3);background:var(--raised);box-shadow:var(--e-4);
  transition:box-shadow 200ms var(--ease);
}
.dd-tf-card.warned{box-shadow:var(--e-4),0 0 0 3px color-mix(in srgb,var(--warn) 26%,transparent)}
.dd-tf-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}
.dd-tf-title{font-size:14px;font-weight:600;color:var(--ink)}
.dd-tf-meta{font-size:11px;color:var(--ink3)}
.dd-tf-dirty{
  font-size:10.5px;color:var(--warn);padding:2px 7px;border-radius:999px;
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--warn) 40%,transparent);
}
.dd-tf-seg{display:flex;gap:2px;padding:2px;background:var(--sunken);border-radius:var(--rx-1);box-shadow:var(--e-well)}
.dd-tf-chip{
  padding:3px 10px;border-radius:var(--rx-1);font-size:11.5px;color:var(--ink3);
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease);
}
.dd-tf-chip.on{color:var(--ink);background:var(--raised);box-shadow:var(--e-1)}
.dd-tf-body{flex:1 1 auto;min-height:0;display:flex;overflow:hidden}
.dd-tf-paper{
  flex:1 1 auto;min-height:0;overflow:auto;padding:22px 26px;
  background:var(--panel);border-radius:var(--rx-2);box-shadow:inset 0 0 0 .5px var(--line);
}
.dd-tf-area{
  flex:1 1 auto;min-height:0;width:100%;resize:none;overflow:auto;
  background:var(--panel);color:var(--ink);border:none;outline:none;
  box-shadow:inset 0 0 0 .5px var(--line);border-radius:var(--rx-2);
  font-family:var(--f-mono);font-size:12.5px;line-height:1.8;padding:18px 20px;white-space:pre-wrap;
}
.dd-tf-area.serif{font-family:var(--serif);font-size:14.5px}
.dd-tf-area.mono{font-family:var(--f-mono);font-size:12px}
.dd-tf-warn{
  display:flex;align-items:center;gap:10px;padding:7px 11px;border-radius:var(--rx-1);
  font-size:12px;color:var(--warn);
  background:color-mix(in srgb,var(--warn) 10%,transparent);
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--warn) 35%,transparent);
}
.dd-tf-fail{
  display:flex;align-items:center;gap:10px;padding:7px 11px;border-radius:var(--rx-1);
  font-size:12px;color:var(--sig-fail);
  background:color-mix(in srgb,var(--sig-fail) 10%,transparent);
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-fail) 35%,transparent);
}
`)
