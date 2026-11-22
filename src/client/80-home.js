    // ── 首页 ───────────────────────────────────────────────────────────────

    function HomeView(props) {
      const { works, current, onPick, onCreate, onDraft, onEnter, busy } = props
      const cards = works.map(work => h('button', {
        key: work.id,
        className: 'dd-work-card' + (work.id === current ? ' on' : ''),
        onClick: () => onPick(work.id),
      },
        h('div', { className: 'wt' }, work.title || work.id),
        h('div', { className: 'wi' },
          work.id + ' · ' + (work.stage || '—')
          + (work.draft === true ? ' · 草稿' : '')),
        h('div', { className: 'wm' },
          h('span', null, (work.scenes ?? 0) + ' 场'),
          h('span', null, (work.shots ?? 0) + ' 镜'),
        ),
      ))
      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-home' },
            h('div', { className: 'dd-home-hero' },
              h('div', { style: { minWidth: '0', flex: '1 1 380px' } },
                h('div', { className: 'h1' }, '从一个想法开始'),
                h('div', { className: 'h2' },
                  '九个阶段，一路到成片。每一阶段有自己的产物与体检线——随时能改，随时可退回重做一镜。'),
                h('div', { className: 'h3' },
                  '还没想好拍什么？点「从零开始聊」：右边那扇窗是一段真的 AI 会话，'
                  + '先把方向聊出来，再给它命名立项。'),
              ),
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', flex: '0 0 auto' } },
                current !== undefined
                  ? h('button', { className: 'dd-btn primary', disabled: busy, onClick: onEnter }, '进入工作台')
                  : null,
                typeof onDraft === 'function'
                  ? h('button', {
                    className: current === undefined ? 'dd-btn primary' : 'dd-btn',
                    disabled: busy,
                    onClick: onDraft,
                    title: '建一个草稿作品并立刻开聊：聊出方向之后再命名立项',
                  }, '从零开始聊')
                  : null,
                h('button', { className: 'dd-btn', disabled: busy, onClick: onCreate }, '新建作品'),
              ),
            ),
            h('div', { className: 'dd-home-sec' },
              h('h4', null, '作品' + (works.length > 0 ? '（' + works.length + '）' : '')),
              works.length === 0
                ? h('div', { className: 'dd-note' },
                  '项目根下还没有作品。',
                  h('b', null, '还没想好拍什么'),
                  '就点「从零开始聊」——它建一个草稿作品并立刻开一段对话，聊出方向再立项命名'
                  + '（改名不换对话）；想直接开工就点「新建作品」建一个空骨架。')
                : h('div', { className: 'dd-works' },
                  cards,
                  h('button', { className: 'dd-work-card new', onClick: onCreate },
                    h(Icon, { name: 'plus', size: 14 }),
                    h('span', null, '新建作品'),
                  ),
                ),
            ),
          ),
        ),
      )
    }
