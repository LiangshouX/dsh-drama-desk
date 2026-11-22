    /** The deliver stage: the final cut. */
    function DeliverView(props) {
      const { data } = props
      const finals = data.finals || []
      const totals = data.totals || {}
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'deliver',
          title: '交付',
          desc: '成片登记：视频资产路径里带 final 的那一条，就是这一版交付物。',
          right: [
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(finals.length)), ' 条成片'),
            h('span', { className: 'dd-chip' }, '总时长 ', h('b', { className: 'num' }, (totals.seconds ?? 0) + 's')),
            h('span', { className: 'dd-chip' }, '花费 ', h('b', { className: 'num' }, '$' + formatNumber(totals.costUsd ?? 0, 2))),
          ],
        }),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            data.ready === false && data.blockers && data.blockers.length > 0
              ? h('div', { className: 'dd-warnbox', style: { marginBottom: '12px' } },
                h('div', null, '还不能交付：'),
                h('ul', { style: { margin: '5px 0 0', paddingLeft: '18px' } },
                  data.blockers.map((blocker, index) => h('li', { key: index }, blocker))),
              )
              : null,
            finals.length === 0
              ? h('div', { className: 'dd-empty' },
                h('div', { className: 'dd-empty-title' }, '还没有成片'),
                h('div', null, '成片是视频资产里路径含 final 的那一条。'))
              : h('table', { className: 'dd-table' },
                h('thead', null, h('tr', null,
                  h('th', null, '成片'), h('th', null, '路径'), h('th', { className: 'n' }, '时长'),
                  h('th', { className: 'n' }, '体积'), h('th', { className: 'n' }, '费用'), h('th', null, '登记时间'),
                )),
                h('tbody', null, finals.map(final => h('tr', { key: final.assetId },
                  h('td', null, final.assetId),
                  h('td', { className: 'path', title: final.path }, final.path || '—'),
                  h('td', { className: 'n' }, final.durationSec ? final.durationSec + 's' : '—'),
                  h('td', { className: 'n' }, formatBytes(final.bytes)),
                  h('td', { className: 'n' }, final.costUsd ? '$' + final.costUsd.toFixed(2) : '—'),
                  h('td', { className: 'n' }, formatTime(final.createdAt)),
                ))),
              ),
          ),
        ),
      )
    }
