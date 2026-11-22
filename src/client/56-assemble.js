    /** The assemble stage: versions, gaps, cost. */
    function AssembleView(props) {
      const { data, onOpenShot } = props
      const shots = data.shots || []
      const totals = data.totals || {}
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'assemble',
          title: '装配',
          desc: '把每镜的当前版本按顺序接起来：缺哪一镜、哪一镜没有声音、总共多少钱。',
          right: [
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(totals.shots ?? shots.length)), ' 镜'),
            h('span', { className: 'dd-chip' }, '总时长 ', h('b', { className: 'num' }, (totals.seconds ?? 0) + 's')),
            h('span', { className: 'dd-chip' }, '花费 ', h('b', { className: 'num' }, '$' + formatNumber(totals.costUsd ?? 0, 2))),
          ],
        }),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            data.gaps && data.gaps.length > 0
              ? h('div', { className: 'dd-warnbox', style: { marginBottom: '12px' } },
                h('div', null, '还差：'),
                h('ul', { style: { margin: '5px 0 0', paddingLeft: '18px' } },
                  data.gaps.map((gap, index) => h('li', { key: index }, gap))),
              )
              : null,
            shots.length === 0
              ? h('div', { className: 'dd-empty' }, '没有镜头')
              : h('table', { className: 'dd-table' },
                h('thead', null, h('tr', null,
                  h('th', null, '镜头'), h('th', null, '标题'), h('th', { className: 'n' }, '时长'),
                  h('th', null, '版本'), h('th', null, '音轨'), h('th', { className: 'n' }, '费用'), h('th', null, ''),
                )),
                h('tbody', null, shots.map(shot => h('tr', { key: shot.id },
                  h('td', { className: 'n' }, shot.id),
                  h('td', null, shot.title || '—'),
                  h('td', { className: 'n' }, shot.duration ? shot.duration + 's' : '—'),
                  h('td', null, (shot.versions || []).map(version =>
                    h('span', {
                      key: version.assetId,
                      className: 'dd-badge',
                      style: version.current ? { color: 'var(--ok)', borderColor: 'color-mix(in srgb,var(--ok) 40%,transparent)' } : undefined,
                      title: version.createdAt + ' · ' + formatBytes(version.bytes),
                    }, 'v' + version.version + (version.current ? ' · 当前' : '')))),
                  h('td', null, shot.hasAudio ? '有' : h('span', { style: { color: 'var(--danger)' } }, '缺')),
                  h('td', { className: 'n' }, shot.costUsd ? '$' + shot.costUsd.toFixed(2) : '—'),
                  h('td', null, h('button', { className: 'dd-btn sm', onClick: () => onOpenShot(shot.id) }, '打开')),
                ))),
              ),
          ),
        ),
      )
    }
