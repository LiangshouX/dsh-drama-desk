    // ── stage rail (console track) ────────────────────────────────────────
    //
    // 点节点 = 切视图。不发请求，不弹确认。
    // 已提交的阶段是实心的；正在预览的阶段是虚线描边。
    //
    // 形态上它是一条**轨道**：九个节点串在一条线上，线被点亮的段落就是进度。
    // 进度是**看得见的一段光**，不是几个颜色不同的小圆点。
    // 左边那格读数告诉你「现在在哪一段」，右边那格告诉你「你只是来看看」。

    function StageRail(props) {
      const { stages, committed, viewing, onPick, busy } = props
      if (!stages || stages.length === 0) return null
      const viewIndex = stages.findIndex(stage => stage.stage === viewing)
      const commitIndex = stages.findIndex(stage => stage.stage === committed)
      // 轨道点亮到「已提交」的那一段；没有已提交阶段时亮到当前查看的那一段。
      const litIndex = commitIndex >= 0 ? commitIndex : Math.max(0, viewIndex)
      const meta = STAGES.find(entry => entry.id === viewing)
      const previewing = Boolean(viewing) && viewing !== committed
      return h('div', { className: 'dd-rail' },
        h('div', { className: 'dd-rail-id' },
          h('div', { className: 'idx' },
            String(viewIndex >= 0 ? viewIndex + 1 : 1).padStart(2, '0'),
            h('em', null, ' / ' + String(stages.length).padStart(2, '0')),
          ),
          h('div', { className: 'en' }, meta ? meta.en : (viewing || '—')),
        ),
        h('div', { className: 'dd-rail-track' },
          h('div', { className: 'dd-nodes' },
            stages.map((stage, index) => {
              const isCommitted = stage.stage === committed
              const isViewing = stage.stage === viewing
              const className = 'dd-node ' + stage.state
                + (isCommitted && stage.state !== 'current' ? ' done' : '')
                + (isViewing && !isCommitted ? ' preview' : '')
              return [
                index > 0
                  ? h('span', { className: 'dd-link' + (index <= litIndex ? ' lit' : ''), key: 'sep' + stage.stage })
                  : null,
                h('button', {
                  key: stage.stage,
                  className: className,
                  disabled: busy,
                  title: (stage.requirement ? stage.requirement + '\n' : '')
                    + (isCommitted ? '当前已提交的阶段' : '点击预览这一阶段（改了东西才会推进进度）'),
                  onClick: () => onPick(stage.stage),
                },
                  h('span', { className: 'dot' }),
                  h('span', { className: 'lb' }, stage.label || stage.stage),
                ),
              ]
            }),
          ),
        ),
        previewing
          ? h('div', { className: 'dd-rail-note' },
            h('span', { className: 'pill' },
              h('span', null, '预览'),
              h('b', null, STAGE_LABEL[viewing] || viewing),
              h('span', { style: { opacity: '.7' } }, '· 进度仍停在 ' + (STAGE_LABEL[committed] || committed || '—')),
            ),
            h('button', {
              className: 'dd-btn sm',
              onClick: () => { if (committed) onPick(committed) },
              title: '回到已提交的阶段',
            }, '回到 ' + (STAGE_LABEL[committed] || committed || '当前')),
          )
          : null,
      )
    }

    // ── workspace menu (top bar) ───────────────────────────────────────────

    function WorkspaceMenu(props) {
      const { works, current, onPick, onCreate, onDraft, onClose } = props
      const ref = useRef(null)
      useEffect(() => {
        const onDown = event => { if (ref.current && !ref.current.contains(event.target)) onClose() }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
      }, [onClose])
      return h('div', { className: 'dd-menu', ref },
        h('div', { className: 'dd-menu-label' }, '作品'),
        (works || []).length === 0
          ? h('div', { className: 'dd-note', style: { padding: '4px 10px 8px' } }, '项目根下还没有作品。')
          : works.map(work => h('div', {
            key: work.id,
            className: 'dd-menu-item' + (work.id === current ? ' on' : ''),
            onClick: () => { onPick(work.id); onClose() },
          },
            h('div', { style: { minWidth: '0' } },
              h('div', { className: 'mi-title' }, work.title || work.id),
              h('div', { className: 'mi-sub' },
                work.id + ' · ' + (work.stage || '—') + ' · ' + (work.shots ?? 0) + ' 镜'
                + (work.scenes ? ' / ' + work.scenes + ' 场' : '')),
            ),
            work.id === current ? h('span', { style: { marginLeft: 'auto', color: 'var(--accent)' } }, h(Icon, { name: 'check', size: 13 })) : null,
          )),
        h('div', { className: 'dd-menu-sep' }),
        h('div', {
          className: 'dd-menu-item',
          onClick: () => { onCreate(); onClose() },
        },
          h(Icon, { name: 'plus', size: 13 }),
          h('div', null,
            h('div', { className: 'mi-title' }, '新建作品'),
            h('div', { className: 'mi-sub' }, '按数据契约建一个空作品骨架'),
          ),
        ),
        // 还没想好拍什么的时候走这一条：先开一段对话找方向，命名的事往后放。
        typeof onDraft === 'function'
          ? h('div', {
            className: 'dd-menu-item',
            onClick: () => { onDraft(); onClose() },
          },
            h(Icon, { name: 'note', size: 13 }),
            h('div', null,
              h('div', { className: 'mi-title' }, '从零开始聊'),
              h('div', { className: 'mi-sub' }, '还没想好拍什么：先聊方向，聊出来再立项命名'),
            ),
          )
          : null,
      )
    }

    /** 从作品名里搓一个像样的目录 id（只留 ascii；搓不出来就返回空串，让人手填）。 */
    function draftIdFrom(title) {
      const ascii = String(title === undefined || title === null ? '' : title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      return ascii.length >= 3 ? ascii.slice(0, 40) : ''
    }

    /**
     * 草稿横幅：**还没立项**的那一步。
     *
     * 为什么它值得占一条横幅：草稿作品的目录 id 是 `draft-<时间戳>`、名字是
     * 「未命名作品」，两个都不该跟着这部戏一辈子。而它就是「先聊后立项」这个
     * 流程里唯一需要人做决定的地方——所以放在最上面，点开就是命名。
     *
     * 立项只改名字与目录（+ 真源里的 id），**不换会话**：对话挂在 DSH 工作区上，
     * 与目录名无关。所以这里不需要「会丢对话吗」的确认框。
     */
    function DraftBanner(props) {
      const { work, busy, onRename } = props
      const [open, setOpen] = useState(false)
      const [title, setTitle] = useState('')
      const [id, setId] = useState('')
      const [touched, setTouched] = useState(false)
      const [error, setError] = useState(null)
      const [saving, setSaving] = useState(false)

      const begin = () => {
        const guess = typeof work.title === 'string' && work.title !== '未命名作品' ? work.title : ''
        setTitle(guess)
        setId(draftIdFrom(guess))
        setTouched(false)
        setError(null)
        setOpen(true)
      }
      const changeTitle = value => {
        setTitle(value)
        if (!touched) setId(draftIdFrom(value))
      }
      const submit = async () => {
        const nextTitle = title.trim()
        const nextId = (id.trim() !== '' ? id.trim() : draftIdFrom(nextTitle)).toLowerCase()
        if (nextTitle === '') { setError('先给它起个名字（这部戏叫什么）'); return }
        if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(nextId)) {
          setError('目录 id 只允许小写字母、数字与连字符（3–40 字符），例如 moon-tide')
          return
        }
        setSaving(true)
        setError(null)
        try {
          await onRename({ id: nextId, title: nextTitle })
          setOpen(false)
        } catch (problem) {
          setError(problem instanceof Error ? problem.message : String(problem))
        } finally {
          setSaving(false)
        }
      }
      const field = (label, value, onChange, onKey, extra) => h('label', { className: 'dd-draft-field' },
        h('span', { className: 'fl' }, label),
        h('input', {
          className: 'dd-draft-input',
          value,
          spellCheck: false,
          onChange: event => onChange(event.target.value),
          onKeyDown: event => {
            if (event.key === 'Enter') { event.preventDefault(); onKey() }
            if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
          },
          ...extra,
        }),
      )
      return h('div', { className: 'dd-draft' + (open ? ' open' : '') },
        h('div', { className: 'dd-draft-line' },
          h('span', { className: 'dd-draft-tag' }, '草稿'),
          h('div', { className: 'dd-draft-text' },
            h('b', null, '还没立项。'),
            '名字与目录 id 都是暂定的（',
            h('code', null, work.id),
            '）——先把方向聊出来，定了再在这里命名。'
            + '改名只动目录与标题，这段对话继续。'),
          open
            ? null
            : h('button', {
              className: 'dd-btn sm',
              onClick: begin,
              disabled: busy,
              title: '给这部戏定名字与目录 id（草稿转正）',
            }, '立项命名…'),
        ),
        open
          ? h('div', { className: 'dd-draft-form' },
            field('作品名', title, changeTitle, submit, { placeholder: '这部戏叫什么，例如「潮信」', autoFocus: true }),
            field('目录 id', id, value => { setTouched(true); setId(value) }, submit, { placeholder: 'moon-tide' }),
            h('div', { className: 'dd-draft-acts' },
              error !== null ? h('span', { className: 'dd-draft-err' }, error) : h('span', { className: 'dd-draft-hint' }, '只允许小写字母、数字与连字符，定下来就是这部戏的目录名'),
              h('button', { className: 'dd-btn sm', onClick: () => setOpen(false), disabled: saving }, '取消'),
              h('button', { className: 'dd-btn sm primary', onClick: submit, disabled: saving }, saving ? '正在立项…' : '立项'),
            ),
          )
          : null,
      )
    }

    CSS_PARTS.push(`
/* 草稿横幅：一条「还没立项」的事实 + 命名入口。它是**流程**的一部分，
   不是警告色：草稿是正常状态，只是名字还没定。 */
.dd-draft{flex:none;display:flex;flex-direction:column;gap:0;padding:0 14px;
  background:var(--sunken);box-shadow:inset 0 -1px 0 var(--line)}
.dd-draft-line{display:flex;align-items:center;gap:9px;min-height:34px;padding:6px 0;min-width:0}
.dd-draft-tag{flex:none;font-family:var(--f-gauge);font-size:9px;letter-spacing:.16em;
  text-transform:uppercase;padding:2px 6px;border-radius:var(--rx-1);color:var(--ink2);
  background:var(--raised);box-shadow:inset 0 0 0 .5px var(--line-2)}
.dd-draft-text{flex:1 1 auto;min-width:0;font-size:11.5px;line-height:1.65;color:var(--ink3)}
.dd-draft-text b{color:var(--ink2);font-weight:600}
.dd-draft-text code{font-family:var(--f-mono);font-size:10.5px}
.dd-draft .dd-btn{flex:none}
.dd-draft-form{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;
  padding:2px 0 10px;min-width:0}
.dd-draft-field{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1 1 180px}
.dd-draft-field .fl{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--ink3);font-family:var(--f-gauge)}
.dd-draft-input{
  height:26px;padding:0 8px;border-radius:var(--rx-1);border:none;outline:none;
  background:var(--sunken);color:var(--ink1);font-family:inherit;font-size:12px;
  box-shadow:inset 0 0 0 .5px var(--line-2);min-width:0;
}
.dd-draft-field:nth-child(2) .dd-draft-input{font-family:var(--f-mono);font-size:11.5px}
.dd-draft-input:focus-visible{box-shadow:inset 0 0 0 .5px var(--line-2),0 0 0 1.5px var(--hot)}
.dd-draft-acts{display:flex;align-items:center;gap:6px;flex:0 0 auto;padding-bottom:1px}
.dd-draft-err{font-size:10.5px;color:var(--sig-fail);max-width:280px}
.dd-draft-hint{font-size:10.5px;color:var(--ink4);max-width:280px}
`)
