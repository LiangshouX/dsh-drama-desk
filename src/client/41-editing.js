    // ══ 文本编辑组件（统一）═══════════════════════════════════════════════
    //
    // 这一块是**整个工作台唯一的改法**（AGENTS.md §16⑦）。规则来自长期记忆里的
    // 《文本编辑组件最佳实践》，逐条落在这里：
    //
    //   · **读态是内容**，不是表单控件：多行文本按 **markdown** 渲染，读起来是
    //     给人看的（这一条是本轮整改的主诉）。
    //   · **编辑态原地接管**同一块地方：两态尺寸恒定 ⇒ 页面不跳。
    //     「不跳」靠三件事：① 读态与编辑态的字号/行高/内边距**完全一致**；
    //     ② 进入编辑时**量一下读态有多高**，编辑框就用这个高度；
    //     ③ 聚焦用 `preventScroll`，不让浏览器把页面顶下去。
    //   · **真改了才有保存**：失焦即存；只敲空格又删回去不算改动。
    //   · **字数算草稿**，编辑时实时变。
    //   · **未保存关不掉，但一定给出路**（放大窗口里）。
    //   · **字少的地方可以放大**：长文本在放大窗口里改，舒服。

    /**
     * 放大窗口的宿主。
     *
     * 字段们只管喊一声「我要开一个放大窗口」，由**根组件**统一渲染——
     * 这样浮层永远在根上，不会被中间容器的 `overflow` 裁掉，
     * 也不会被别的东西盖住。
     */
    let TEXT_DIALOG_HOST = null

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
     * 读态 → 点它 → 编辑态**原地接管**。两态之间不换位置、不换尺寸。
     * 多行的文本还会多一枚「放大」按钮：在放大窗口里改长文，比在两厘米高
     * 的小框里改舒服得多。
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
      const [editHeight, setEditHeight] = useState(undefined)
      const nodeRef = useRef(null)
      const boxRef = useRef(null)
      const editingRef = useRef(false)
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
      // 放大按钮：多行默认给，单行可以显式要。
      const canExpand = expandable === undefined ? multiline === true : expandable === true

      const begin = () => {
        if (!canEdit || editingRef.current) return
        editingRef.current = true
        // **量一下读态有多高**：编辑框就用这个高度接管 ⇒ 页面不跳。
        const box = boxRef.current
        const measured = box === null ? 0 : Math.round(box.getBoundingClientRect().height)
        setEditHeight(measured > 0 ? measured : undefined)
        setEditing(true)
      }

      // **从外部进入编辑态**：空态的「写第一版」按钮靠它。
      //
      // 信号值一变就进编辑态；相同���号重复触发不会重置正在写的草稿。
      const signalRef = useRef(editSignal)
      useEffect(() => {
        if (editSignal === undefined || editSignal === signalRef.current) return
        signalRef.current = editSignal
        if (!editingRef.current) begin()
        // begin 只依赖 canEdit；这里刻意不把它列进依赖——信号变化才是触发点。
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [editSignal])

      const commit = () => {
        if (!editingRef.current) return
        editingRef.current = false
        setEditing(false)
        if (draft !== current) onSave(draft)
      }

      const cancel = () => {
        if (!editingRef.current) return
        editingRef.current = false
        setDraft(current)
        setEditing(false)
      }

      const onKeyDown = event => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          cancel()
        } else if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          commit()
        }
      }

      /** 打开放大窗口：把当前值带过去，在那里改。 */
      const enlarge = () => {
        openTextDialog({
          title: typeof label === 'string' && label !== '' ? label : (labelTitle ?? '编辑'),
          value: current,
          placeholder,
          serif,
          mono,
          onSave: next => { onSave(next) },
        })
      }

      const cls = 'dd-ed'
        + (layout === 'row' ? ' row' : '')
        + (serif ? ' serif' : '')
        + (mono ? ' mono' : '')
        + (multiline ? ' multi' : '')
        + (canEdit ? '' : ' readonly')
        + (className ? ' ' + className : '')
      const head = label
        ? h('div', { className: 'dd-ed-lab', title: labelTitle || undefined }, label)
        : null

      if (!editing) {
        // **读态就是读态。**
        //
        // 点内容**不**跳进编辑态——这是本轮整改的第一条：
        // 「预览的时候长一个样，点击直接就进入了编辑模式，页面还一直跳」。
        // 误触一次就进编辑、页面又跳一下，是最让人烦躁的那种体验。
        //
        // 所以编辑**必须手动触发**：右上角那枚 ✎ 按钮（就地改）
        // 或 ⤢ 按钮（放大窗口里改）。按钮常驻、只是安静（低透明度），
        // 悬停才亮——它不能藏到「只有鼠标刚好扫过去」才出现。
        return h('div', { className: cls, style },
          head,
          h('div', {
            className: 'dd-ed-box',
            ref: boxRef,
          },
            h('div', {
              className: 'dd-ed-val' + (empty ? ' empty' : '') + (useMarkdown ? ' md' : ''),
              title: title || (canEdit ? '这里可以编辑 · 用右上角的 ✎ 或 ⤢ 手动触发' : undefined),
            }, h(EditableRead, { text: current, markdown: useMarkdown, placeholder, emptyHint })),
            canEdit
              ? h('div', { className: 'dd-tf-tools' },
                h('button', {
                  className: 'dd-tf-edit',
                  type: 'button',
                  title: '编辑这一项（点内容不会进编辑）',
                  'aria-label': '编辑' + (typeof label === 'string' && label !== '' ? '：' + label : ''),
                  onMouseDown: event => event.preventDefault(),
                  onClick: event => { event.stopPropagation(); begin() },
                }, h(Icon, { name: 'edit', size: 12 })),
                canExpand
                  ? h('button', {
                    className: 'dd-tf-expand',
                    type: 'button',
                    title: '放大编辑（长文本在这里改更舒服）',
                    'aria-label': '放大编辑',
                    onMouseDown: event => event.preventDefault(),
                    onClick: event => { event.stopPropagation(); enlarge() },
                  }, h(Icon, { name: 'expand', size: 12 }))
                  : null,
              )
              : null,
          ),
        )
      }

      return h('div', { className: cls, style },
        head,
        h('div', {
          className: 'dd-ed-box editing',
          ref: boxRef,
        },
          h('div', {
            className: 'dd-ed-edit acting'
              + (serif ? ' serif' : '')
              + (mono ? ' mono' : ''),
            style: editHeight === undefined ? undefined : { height: editHeight + 'px' },
          },
            multiline
              ? h('textarea', {
                ref: nodeRef, value: draft, placeholder, spellCheck: false,
                style: editHeight === undefined ? undefined : { height: editHeight + 'px' },
                onChange: event => setDraft(event.target.value),
                onKeyDown, onBlur: commit,
              })
              : h('input', {
                ref: nodeRef, type: type ?? 'text', value: draft, placeholder,
                onChange: event => setDraft(event.target.value),
                onKeyDown, onBlur: commit,
              }),
            h('span', { className: 'dd-ed-acts' },
              h('button', {
                className: 'dd-ed-act ok', type: 'button', title: '保存（失焦或 Enter）',
                onMouseDown: event => event.preventDefault(),
                onClick: commit,
              }, h(Icon, { name: 'check', size: 11 })),
              h('button', {
                className: 'dd-ed-act no', type: 'button', title: '撤销（Esc）',
                onMouseDown: event => event.preventDefault(),
                onClick: cancel,
              }, h(Icon, { name: 'close', size: 11 })),
            ),
          ),
          // 字数：算**草稿**，编辑时实时变；只在这里出现。
          h('span', { className: 'dd-tf-count' }, draft.length + ' 字'),
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
      const { title, value, onSave, onClose, placeholder, serif, mono } = props
      const [mode, setMode] = useState('preview')
      const [draft, setDraft] = useState(value ?? '')
      const [busy, setBusy] = useState(false)
      const [warned, setWarned] = useState(false)
      const warnTimer = useRef(undefined)
      const text = value ?? ''
      const dirty = draft !== text

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

      const commit = async () => {
        if (!dirty || busy) return
        setBusy(true)
        try {
          const ok = await onSave(draft)
          if (ok === false) return
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
          h('span', null, '请先保存，或放弃这次修改。'),
          h('button', {
            type: 'button', className: 'dd-btn sm',
            title: '丢掉这次修改，关闭窗口',
            onClick: onClose,
          }, '放弃修改'))
        : null

      const head = h('div', { className: 'dd-tf-head' },
        h('span', { className: 'dd-tf-title' }, title || '编辑'),
        h('span', { className: 'dd-tf-meta num' }, draft.length + ' 字'),
        dirty ? h('span', { className: 'dd-tf-dirty' }, '未保存') : null,
        h('span', { className: 'dd-spacer' }),
        h('div', { className: 'dd-tf-seg' }, chip('preview', '预览'), chip('edit', '编辑')),
        // **只有真改了才有【保存】**：没改就不该有一个按钮等着被误点。
        mode === 'edit' && dirty
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
    CSS_PARTS.push(`
/* ── 文本编辑组件 ─────────────────────────────────────────────────────── */
.dd-ed{display:flex;flex-direction:column;gap:2px;min-width:0;position:relative}
.dd-ed.row{display:grid;grid-template-columns:var(--ed-lab,116px) minmax(0,1fr);gap:14px;align-items:baseline}
.dd-ed-lab{
  font-family:var(--f-gauge);font-size:10px;color:var(--ink3);
  letter-spacing:.1em;text-transform:uppercase;line-height:1.5;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
/* 读态与编辑态的**排版度量必须完全一致**（字号/行高/内边距），
   否则切换时盒子会变高变低——这就是「页面一直跳」的根源。 */
.dd-ed-box{position:relative;min-width:0}
.dd-ed-val{
  font-size:12.5px;line-height:1.65;color:var(--ink);
  padding:3px 7px;margin-left:-7px;
  min-height:28px;border-radius:var(--rx-1);
  border-bottom:.5px dashed transparent;cursor:text;
  white-space:pre-wrap;word-break:break-word;
  transition:border-color var(--t-fast) var(--ease),color var(--t-fast) var(--ease),background var(--t-fast) var(--ease);
}
/* 多行字段：读态与编辑态的**最小高度相同** ⇒ 切换时高度不变。
   （以前读态 21px、编辑态 66px —— 那个 45px 的差就是「页面一直跳」的来源。） */
.dd-ed.multi .dd-ed-val{min-height:44px}
.dd-ed-val:hover{border-bottom-color:var(--hot-line);background:color-mix(in srgb,var(--hot) 7%,transparent)}
.dd-ed-val.empty{color:var(--ink4)}
.dd-ed.readonly .dd-ed-val{cursor:default}
.dd-ed.readonly .dd-ed-val:hover{border-bottom-color:transparent;background:transparent}
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

/* 编辑入口：**常驻、安静**。
   它不能只在悬停时才出现——那等于把「怎么改」藏起来；
   但它也不该抢戏：默认低透明度，悬停/聚焦才亮。
   点内容**不会**进编辑态（见 41-editing.js 的注释）。 */
.dd-tf-tools{
  position:absolute;top:1px;right:1px;z-index:2;
  display:flex;align-items:center;gap:2px;
  opacity:.34;transition:opacity var(--t-fast) var(--ease);
}
.dd-ed-box:hover .dd-tf-tools,.dd-tf-tools:focus-within{opacity:1}
.dd-tf-edit,.dd-tf-expand{
  width:20px;height:20px;border-radius:var(--rx-1);
  display:grid;place-items:center;color:var(--ink3);
  background:color-mix(in srgb,var(--raised) 88%,transparent);
  box-shadow:inset 0 0 0 .5px var(--line);
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-tf-edit:hover{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-tf-expand:hover{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
/* 读态的值域不再假装可点：光标是选字，不是「点这里改」。 */
.dd-ed-val{cursor:text}
.dd-ed.readonly .dd-ed-val{cursor:default}
/* 给右上角那两枚按钮**留位**：否则它们会压在正文上。
   留位是**常驻**的（不是悬停才留），所以读态与编辑态的宽度一致 ⇒ 不跳。 */
.dd-ed:not(.readonly) .dd-ed-val{padding-right:48px}
.dd-ed:not(.readonly) .dd-ed-edit input,
.dd-ed:not(.readonly) .dd-ed-edit textarea{padding-right:48px}

/* 编辑态：与读态同一套度量，只是多了个内阴影。 */
.dd-ed-edit{position:relative;display:block}
.dd-ed-edit input,.dd-ed-edit textarea{
  display:block;width:100%;background:var(--sunken);border:none;
  box-shadow:var(--e-well);border-radius:var(--rx-1);color:var(--ink);
  font-family:inherit;font-size:12.5px;line-height:1.65;padding:3px 7px;outline:none;
  overflow:auto;resize:none;white-space:pre-wrap;
  transition:box-shadow var(--t-fast) var(--ease);
}
.dd-ed-edit input{height:28px}
.dd-ed.multi .dd-ed-edit textarea{min-height:44px}
.dd-ed-edit.serif input,.dd-ed-edit.serif textarea{font-family:var(--serif);font-size:15px;line-height:1.5}
.dd-ed-edit.mono input,.dd-ed-edit.mono textarea{font-family:var(--f-mono);font-size:11.5px}
.dd-ed-edit.serif textarea{min-height:52px}
.dd-ed-edit.mono textarea{min-height:38px}
.dd-ed-edit input:focus,.dd-ed-edit textarea:focus{box-shadow:var(--e-well),0 0 0 1.5px var(--hot)}
.dd-ed-acts{position:absolute;top:3px;right:5px;display:flex;gap:3px}
.dd-ed-act{
  width:20px;height:20px;border-radius:var(--rx-1);display:grid;place-items:center;
  color:var(--ink4);box-shadow:inset 0 0 0 .5px var(--line);
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-ed-act:hover{color:var(--ink);background:var(--panel-2)}
.dd-ed-act.ok:hover{color:var(--sig-pass);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-pass) 45%,transparent)}
.dd-ed-act.no:hover{color:var(--sig-fail);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-fail) 45%,transparent)}
/* 字数：算草稿，只在编辑时出现。 */
.dd-tf-count{
  position:absolute;left:6px;bottom:-15px;font-family:var(--f-mono);font-size:10px;
  color:var(--ink4);pointer-events:none;
}
.dd-ed-box.editing{margin-bottom:15px}

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
`)
