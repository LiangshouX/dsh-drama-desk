    // ── 首页 ───────────────────────────────────────────────────────────────

    function HomeView(props) {
      const { works, current, onPick, onCreate, onEnter, busy } = props
      const cards = works.map(work => h('button', {
        key: work.id,
        className: 'dd-work-card' + (work.id === current ? ' on' : ''),
        onClick: () => onPick(work.id),
      },
        h('div', { className: 'wt' }, work.title || work.id),
        h('div', { className: 'wi' }, work.id + ' · ' + (work.stage || '—')),
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
                  '九个阶段，一路到成片。每一阶段有自己的产物与体检线——随时能改，随时能退回重做一镜。'),
                h('div', { className: 'h3' },
                  '右边那扇窗是一个真的 AI 会话。点「开始对话」，它会把创意写进 creative/brief.md。'),
              ),
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', flex: '0 0 auto' } },
                current !== undefined
                  ? h('button', { className: 'dd-btn primary', disabled: busy, onClick: onEnter }, '进入工作台')
                  : null,
                h('button', { className: 'dd-btn', disabled: busy, onClick: onCreate }, '新建作品'),
              ),
            ),
            h('div', { className: 'dd-home-sec' },
              h('h4', null, '作品' + (works.length > 0 ? '（' + works.length + '）' : '')),
              works.length === 0
                ? h('div', { className: 'dd-note' },
                  '项目根下还没有作品。点「新建作品」建一个空骨架，或者先把右边的构思会话开起来——'
                  + '它会在你写简报时帮你把故事想清楚。')
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
