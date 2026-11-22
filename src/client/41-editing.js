    // ══ 文本编辑组件（统一）═══════════════════════════════════════════════
    //
    // 这一块是**整个工作台唯一的改法**（`docs/dev/ui-language.md` U6）。
    // 规则来自长期记忆里的《文本编辑组件最佳实践》，但**载体换了**：
    // 最佳实践原本把它装在一个放大弹窗里，这里改成**就地展开的编辑面**——
    // 用户明确说过「不需要弹出弹窗这个动作」，而弹窗里真正有用的那套东西
    // （预览/编辑两态、恒定尺寸、字数、显式保存、未保存拦截）与弹窗无关，可以照搬。
    //
    // 手势：
    //   · **点内容不进编辑。** 进编辑只有一个入口：内容右上角那枚 ✎。
    //   · **单行字段**（音色 / 时长 / 标题）继续用一行小控件原地改：那就是它的尺寸。
    //   · **多行字段**展开成一块**编辑面**：头部（预览 | 编辑 · N 字 · 未保存 · 保存 · 关闭）
    //     ＋ 正文（编辑 = 保真源码，预览 = markdown 渲染）。
    //   · **两态尺寸恒定**：预览与编辑共用同一个高度，切换**不跳**。
    //     高度在打开那一刻定下：`clamp(4 行, 读态高度, 视口 85%)`。
    //   · **只有【保存】才写盘**（单选行里 Enter 也算显式动作；多行 Ctrl+Enter）。
    //     **失焦不存**——焦点离开只是焦点离开，不是一个决定。Esc 取消。
    //   · **未保存关不掉，但一定给出路**：警告条 + 「放弃修改」。
    //   · **存不上就留在原地**：`onSave` 返回 `false` = 没存上，草稿一个字不丢。
    //
    // 历史（别再来一遍）：上一版把编辑做成「裸 textarea 原地换掉读态」，
    // 锁死在高 44px 的盒子里内滚，或者反过来被压到 329px —— 那正是用户说的
    // 「很垃圾的小区域多行编辑组件」。

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
     * 读态 → 点右上角 ✎ → 原地展开编辑面（多行）或一行小控件（单行）
     * → 【保存】写盘 / 【关闭】或 Esc 取消。
     */
    function Editable(props) {
      const {
        label, labelTitle, value, onSave, multiline, disabled, readOnly,
        placeholder, type, layout, serif, mono, className, style, title,
        markdown, editSignal, emptyHint,
      } = props
      const canEdit = !readOnly && !disabled && typeof onSave === 'function'
      const [editing, setEditing] = useState(false)
      const [draft, setDraft] = useState(value ?? '')
      /** 多行编辑面的高度：打开时量一次，预览/编辑共用 ⇒ 两态不跳。 */
      const [surfaceH, setSurfaceH] = useState(0)
      /** 多行编辑面里的两态。 */
      const [mode, setMode] = useState('edit')
      const [saving, setSaving] = useState(false)
      const [failed, setFailed] = useState(false)
      const [warned, setWarned] = useState(false)
      const boxRef = useRef(null)
      const nodeRef = useRef(null)
      const editingRef = useRef(false)
      const savingRef = useRef(false)
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

      const current = value === undefined || value === null ? '' : String(value)
      const empty = current === ''
      const dirty = draft !== current
      // 读态默认按 markdown 渲染（多行才渲染：单行没有 markdown 可言）。
      const useMarkdown = markdown === undefined ? multiline === true : markdown === true

      /**
       * 进入编辑。
       *
       * 多行要顺手定下**编辑面的高度**：地板 4 行（一行 22px 左右）、
       * 天花板视口的 85%，并且**不低于读态现在的高度**——
       * 短字段展开成一块能写的地方，长文档进去之后不会被压小。
       */
      const begin = () => {
        if (!canEdit || editingRef.current) return
        const box = boxRef.current
        const readH = box === null ? 0 : Math.round(box.getBoundingClientRect().height)
        const vh = window.innerHeight || 800
        setSurfaceH(Math.round(Math.min(Math.max(readH, 160), vh * 0.85)))
        setMode('edit')
        setWarned(false)
        setFailed(false)
        editingRef.current = true
        setEditing(true)
      }

      // 焦点：进编辑就交给正文，光标放到末尾；**不要**让浏览器把页面滚过去。
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
      }, [editing, mode])

      // **从外部进入编辑态**：空态的「写第一版」按钮靠它。
      const signalRef = useRef(editSignal)
      useEffect(() => {
        if (editSignal === undefined || editSignal === signalRef.current) return
        signalRef.current = editSignal
        if (editingRef.current) return
        begin()
        // begin 只依赖 canEdit 与读态几何；信号变化才是触发点。
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [editSignal])

      const closeEditor = () => {
        editingRef.current = false
        setEditing(false)
        setWarned(false)
        setFailed(false)
      }

      /**
       * 写盘。**只有这里会写**：【保存】、单行 Enter、多行 Ctrl+Enter。
       * 失焦不写 —— 焦点离开只是焦点离开，不是一个决定。
       */
      const commit = async () => {
        if (!editingRef.current || savingRef.current) return
        if (draft === current) { closeEditor(); return }
        savingRef.current = true
        setSaving(true)
        setFailed(false)
        try {
          const result = await onSave(draft)
          if (result === false) {
            // 没存上就不许退出编辑态：草稿全在，再点一次保存就行。
            setFailed(true)
            return
          }
          // 存好了就收起编辑面：读态本身就是预览。
          closeEditor()
        } finally {
          savingRef.current = false
          setSaving(false)
        }
      }

      /** 取消：草稿丢掉，回到读态。 */
      const cancel = () => {
        if (!editingRef.current) return
        setDraft(current)
        closeEditor()
      }

      /** 关闭：有未保存改动就先警告（关不掉，但给出路）。 */
      const requestClose = () => {
        if (draft !== current) { setWarned(true); return }
        closeEditor()
      }

      const onKeyDown = event => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          if (draft !== current) { setWarned(true); return }
          cancel()
        } else if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) {
          // 键盘上的「显式保存」：单行 Enter、多行 Ctrl+Enter。
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
        + (className ? ' ' + className : '')
      const head = label
        ? h('div', { className: 'dd-ed-lab', title: labelTitle || undefined }, label)
        : null
      const hint = canEdit ? '点右上角的 ✎ 编辑' : undefined

      // ── 多行：编辑面（预览 / 编辑两态，尺寸恒定）──────────────────────
      if (editing && multiline) {
        const chip = (key, text) => h('button', {
          key,
          type: 'button',
          'aria-pressed': mode === key,
          className: 'dd-tf-chip' + (mode === key ? ' on' : ''),
          onClick: () => setMode(key),
        }, text)
        return h('div', { className: cls + ' live', style },
          head,
          h('div', { className: 'dd-live' },
            h('div', { className: 'dd-live-head' },
              h('div', { className: 'dd-tf-seg' }, chip('preview', '预览'), chip('edit', '编辑')),
              h('span', { className: 'dd-live-meta num' }, draft.length + ' 字'),
              dirty ? h('span', { className: 'dd-live-dirty' }, '未保存') : null,
              h('span', { className: 'dd-spacer' }),
              // **只有真改了才有【保存】**：没改就不该有一个按钮等着被误点。
              h('button', {
                className: 'dd-btn sm primary', type: 'button',
                disabled: saving || !dirty,
                title: dirty ? '保存（Ctrl+Enter）' : '还没有改动',
                onClick: () => { void commit() },
              }, saving ? '保存中…' : '保存'),
              h('button', {
                className: 'dd-icon-btn', type: 'button',
                title: '关闭（有未保存的改动会先问你）',
                onClick: requestClose,
              }, h(Icon, { name: 'close', size: 13 })),
            ),
            warned
              ? h('div', { className: 'dd-live-warn' },
                h('span', null, '有未保存的改动。'),
                h('span', { className: 'dd-spacer' }),
                h('button', {
                  className: 'dd-btn sm', type: 'button', title: '丢掉这次修改',
                  onClick: cancel,
                }, '放弃修改'),
                h('button', {
                  className: 'dd-btn sm primary', type: 'button', disabled: saving,
                  onClick: () => { void commit() },
                }, '保存'))
              : null,
            failed
              ? h('div', { className: 'dd-live-fail' },
                h('span', null, '没存上。改动还在——再点一次保存，或者先复制走。'))
              : null,
            // 两态共用这一个盒子：高度固定 ⇒ 预览/编辑切换时**一动不动**。
            h('div', {
              className: 'dd-live-body' + (mode === 'edit' ? ' src' : ' md'),
              style: surfaceH > 0 ? { height: surfaceH + 'px' } : undefined,
            },
              mode === 'edit'
                ? h('textarea', {
                  ref: nodeRef,
                  className: 'dd-live-area' + (serif ? ' serif' : '') + (mono ? ' mono' : ''),
                  value: draft, placeholder, spellCheck: false,
                  onChange: event => setDraft(event.target.value),
                  onKeyDown,
                })
                : h('div', { className: 'dd-md' },
                  draft.trim() === ''
                    ? h('span', { className: 'dd-tf-empty' }, placeholder ?? '（空）')
                    : h(MarkdownLite, { text: draft }))),
          ),
        )
      }

      if (editing) {
        // ── 单行：一行小控件原地改（这就是它的尺寸）────────────────────
        return h('div', { className: cls, style },
          head,
          h('div', { className: 'dd-ed-box editing', ref: boxRef },
            h('div', { className: 'dd-ed-edit acting' + (serif ? ' serif' : '') + (mono ? ' mono' : '') + (failed ? ' failed' : '') },
              h('input', {
                ref: nodeRef, type: type ?? 'text', value: draft, placeholder,
                onChange: event => setDraft(event.target.value),
                onKeyDown,
              }),
              h('span', { className: 'dd-ed-acts' },
                h('button', {
                  className: 'dd-ed-act ok', type: 'button',
                  disabled: saving || !dirty,
                  title: saving ? '保存中…' : (dirty ? '保存（Enter）' : '还没有改动'),
                  onMouseDown: event => event.preventDefault(),
                  onClick: () => { void commit() },
                }, h(Icon, { name: 'check', size: 11 })),
                h('button', {
                  className: 'dd-ed-act no', type: 'button', title: '取消（Esc）',
                  onMouseDown: event => event.preventDefault(),
                  onClick: cancel,
                }, h(Icon, { name: 'close', size: 11 })),
              ),
            ),
            failed ? h('span', { className: 'dd-ed-fail' }, '没存上，改动还在') : null,
          ),
        )
      }

      // ── 读态：就是内容。点它什么都不发生；进编辑只有右上角那枚 ✎ ──────
      return h('div', { className: cls, style },
        head,
        h('div', { className: 'dd-ed-box', ref: boxRef },
          h('div', {
            className: 'dd-ed-val' + (empty ? ' empty' : '') + (useMarkdown ? ' md' : ''),
            title: title || hint,
          }, h(EditableRead, { text: current, markdown: useMarkdown, placeholder, emptyHint })),
          canEdit
            ? h('div', { className: 'dd-tf-tools' },
              h('button', {
                className: 'dd-tf-edit',
                type: 'button',
                title: '编辑（原地改；点内容不会进编辑）',
                'aria-label': '编辑' + (typeof label === 'string' && label !== '' ? '：' + label : ''),
                onMouseDown: event => event.preventDefault(),
                onClick: event => { event.stopPropagation(); begin() },
              }, h(Icon, { name: 'edit', size: 12 })),
            )
            : null,
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
    // 注意：这段是模板字符串，注释里**不许出现反引号**（会提前结束模板）。
    CSS_PARTS.push(`
/* ── 文本编辑组件 ─────────────────────────────────────────────────────── */
.dd-ed{display:flex;flex-direction:column;gap:2px;min-width:0;position:relative}
.dd-ed.row{display:grid;grid-template-columns:var(--ed-lab,116px) minmax(0,1fr);gap:14px;align-items:baseline}
.dd-ed-lab{
  font-family:var(--f-gauge);font-size:10px;color:var(--ink3);
  letter-spacing:.1em;text-transform:uppercase;line-height:1.5;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.dd-ed-box{position:relative;min-width:0;border-radius:var(--rx-1)}
.dd-ed-val{
  font-size:12.5px;line-height:1.65;color:var(--ink);
  padding:3px 7px;
  min-height:28px;border-radius:var(--rx-1);
  white-space:pre-wrap;word-break:break-word;
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease);
}
.dd-ed.multi .dd-ed-val{min-height:44px}
.dd-ed-val.empty{color:var(--ink4)}
.dd-ed.serif .dd-ed-val{font-family:var(--serif);font-size:15px;line-height:1.5}
.dd-ed.mono .dd-ed-val{font-family:var(--f-mono);font-size:11.5px}
.dd-ed.multi.serif .dd-ed-val{min-height:78px}
.dd-ed.multi.mono .dd-ed-val{min-height:56px}
.dd-ed-val.md{white-space:normal}
.dd-md{font-size:12.5px;line-height:1.7;color:var(--ink);min-width:0}
.dd-ed.serif .dd-md{font-family:var(--serif);font-size:14.5px;line-height:1.65}
.dd-tf-empty{color:var(--ink4)}
.dd-tf-text{white-space:pre-wrap}

/* 进编辑的唯一入口：右上角那枚 ✎。常驻（不是悬停才出现——那就等于把「怎么改」藏起来），
   但安静：默认 45% 透明度，悬停/聚焦才亮。 */
.dd-tf-tools{
  position:absolute;top:1px;right:1px;z-index:2;
  display:flex;align-items:center;gap:2px;
  opacity:.45;transition:opacity var(--t-fast) var(--ease);
}
.dd-ed-box:hover .dd-tf-tools,.dd-tf-tools:focus-within{opacity:1}
.dd-tf-edit{
  width:20px;height:20px;border-radius:var(--rx-1);
  display:grid;place-items:center;color:var(--ink3);
  background:color-mix(in srgb,var(--raised) 88%,transparent);
  box-shadow:inset 0 0 0 .5px var(--line);
  transition:color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-tf-edit:hover{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
/* 给右上角留位：常驻留，所以读态与编辑态的可用宽度一致 ⇒ 不跳。 */
.dd-ed:not(.readonly) .dd-ed-val{padding-right:48px}
.dd-ed:not(.readonly) .dd-ed-edit input{padding-right:48px}

/* ── 多行：就地展开的编辑面（预览 / 编辑两态，尺寸恒定）────────────── */
.dd-live{
  border-radius:var(--rx-2);
  background:var(--sunken);
  box-shadow:inset 0 0 0 .5px var(--line),0 1px 0 color-mix(in srgb,var(--hot) 22%,transparent);
  overflow:hidden;
}
.dd-live-head{
  display:flex;align-items:center;gap:9px;flex-wrap:wrap;
  padding:6px 8px 6px 9px;min-width:0;
  box-shadow:0 -1px 0 var(--line) inset;
}
.dd-live-meta{font-size:10.5px;color:var(--ink3)}
.dd-live-dirty{
  font-size:10px;color:var(--warn);padding:1px 7px;border-radius:999px;
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--warn) 42%,transparent);
}
.dd-tf-seg{display:flex;gap:2px;padding:2px;background:var(--panel);border-radius:var(--rx-1);box-shadow:var(--e-well)}
.dd-tf-chip{
  padding:2px 9px;border-radius:var(--rx-1);font-size:11px;color:var(--ink3);
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease);
}
.dd-tf-chip.on{color:var(--ink);background:var(--raised);box-shadow:var(--e-1)}
/* **两态共用同一个盒子**：高度由行内 style 给定（打开那一刻量出来的），
   预览与编辑都装在里面 ⇒ 切换时窗口一动不动。 */
.dd-live-body{
  overflow:auto;min-width:0;
  background:var(--panel);
  box-shadow:inset 0 .5px 0 var(--line);
}
.dd-live-body.md{padding:14px 16px}
.dd-live-area{
  display:block;width:100%;height:100%;resize:none;border:none;outline:none;
  background:transparent;color:var(--ink);
  font-family:var(--f-mono);font-size:12.5px;line-height:1.8;padding:12px 14px;white-space:pre-wrap;
  box-sizing:border-box;
}
.dd-live-area.serif{font-family:var(--serif);font-size:14.5px;line-height:1.65}
.dd-live-area.mono{font-family:var(--f-mono);font-size:12px}
.dd-live-warn,.dd-live-fail{
  display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:11.5px;
}
.dd-live-warn{color:var(--warn);background:color-mix(in srgb,var(--warn) 10%,transparent);
  box-shadow:inset 0 .5px 0 color-mix(in srgb,var(--warn) 30%,transparent)}
.dd-live-fail{color:var(--sig-fail);background:color-mix(in srgb,var(--sig-fail) 10%,transparent);
  box-shadow:inset 0 .5px 0 color-mix(in srgb,var(--sig-fail) 30%,transparent)}

/* ── 单行：一行小控件 ─────────────────────────────────────────────────── */
.dd-ed-edit{position:relative;display:block}
.dd-ed-edit input{
  display:block;width:100%;background:var(--sunken);border:none;
  box-shadow:var(--e-well);border-radius:var(--rx-1);color:var(--ink);
  font-family:inherit;font-size:12.5px;line-height:1.65;padding:3px 7px;outline:none;
  box-sizing:border-box;height:28px;
  transition:box-shadow var(--t-fast) var(--ease);
}
.dd-ed-edit.serif input{font-family:var(--serif);font-size:15px}
.dd-ed-edit.mono input{font-family:var(--f-mono);font-size:11.5px}
.dd-ed-edit input:focus{box-shadow:var(--e-well),0 0 0 1.5px var(--hot)}
.dd-ed-edit.failed input{box-shadow:var(--e-well),0 0 0 1.5px var(--sig-fail)}
.dd-ed-acts{position:absolute;top:4px;right:5px;display:flex;gap:3px}
.dd-ed-act{
  width:20px;height:20px;border-radius:var(--rx-1);display:grid;place-items:center;
  color:var(--ink4);box-shadow:inset 0 0 0 .5px var(--line);
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
/* 没改动 / 保存中：按钮在，但不可点。**不是消失**——消失会让人以为功能没了。 */
.dd-ed-act:disabled{opacity:.32;cursor:default}
.dd-ed-act.no:hover{color:var(--sig-fail);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-fail) 45%,transparent)}
.dd-ed-act.ok:not(:disabled){color:var(--sig-pass)}
.dd-ed-act.ok:not(:disabled):hover{background:color-mix(in srgb,var(--sig-pass) 14%,transparent)}
/* 存不上：一条贴着正文的细提示，**不撑高整块**。 */
.dd-ed-fail{
  position:absolute;left:0;top:100%;z-index:2;
  font-size:10.5px;color:var(--sig-fail);white-space:nowrap;
  padding:1px 5px;border-radius:var(--rx-1);
  background:color-mix(in srgb,var(--sig-fail) 12%,var(--panel));
}
`)
