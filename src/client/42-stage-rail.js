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
      const { works, current, onPick, onCreate, onClose } = props
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
      )
    }
