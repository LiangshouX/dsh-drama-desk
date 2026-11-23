    /** Final cuts can be watched, downloaded and explicitly accepted. */
    function DeliverView(props) {
      const { data, workspaceId, busy, actions, onGoto } = props
      const [selectedId, setSelectedId] = useState(null)
      const [playbackError, setPlaybackError] = useState(false)
      const finals = data.finals || []
      const selected = finals.find(row => row.assetId === selectedId) || finals.find(row => row.exists) || finals[0]
      useEffect(() => { setPlaybackError(false) }, [selected && selected.assetId, workspaceId])
      return h('div', { className: 'dd-main' },
        h(StageHeader, { stage: 'deliver', title: '交付', desc: '回看成片、核对来源，再确认这一版。',
          right: h('span', { className: 'dd-chip' }, finals.length + ' 版成片') }),
        h('div', { className: 'dd-scroll' }, h('div', { className: 'dd-grid' },
          selected ? h('section', { className: 'dd-sec' },
            h('div', { className: 'dd-sec-head' }, h('span', { className: 't' }, selected.confirmed ? '已确认交付' : '成片回看'),
              h('span', { className: 'sp' }), h('span', { className: 'num' }, selected.assetId)),
            h('div', { className: 'dd-sec-body' },
              selected.exists ? h('video', { key: workspaceId + ':' + selected.assetId,
                className: 'dd-final-player', src: assetVideoUrl(workspaceId, selected.assetId),
                controls: true, preload: 'metadata', playsInline: true, 'aria-label': '成片回看',
                onError: () => setPlaybackError(true) }) : h('div', { className: 'dd-warnbox' }, '文件已丢失，请重新装配。'),
              playbackError ? h('div', { className: 'dd-warnbox' }, '浏览器未能播放此格式，可下载到本地播放器回看。') : null,
              selected.stale ? h('div', { className: 'dd-warnbox' }, '源镜头已变化。这一版保留供比较，请重新装配后交付。') : null,
              h('p', { className: 'dd-note' }, (selected.durationSec ? formatNumber(selected.durationSec, 2) + 's · ' : '')
                + (selected.width ? selected.width + '×' + selected.height + ' · ' : '')
                + formatBytes(selected.bytes) + ' · ' + formatTime(selected.createdAt)),
              h('p', { className: 'path', style: { overflowWrap: 'anywhere' } }, selected.path),
              h('div', { className: 'dd-cut-controls' },
                h('button', { className: 'dd-btn primary', disabled: busy || !data.ready || !selected.exists || selected.stale || selected.confirmed,
                  onClick: () => actions.confirmDelivery(selected.assetId) }, selected.confirmed ? '这一版已确认' : '确认这一版交付'),
                selected.exists ? h('a', { className: 'dd-btn', href: assetVideoUrl(workspaceId, selected.assetId), download: selected.assetId + '.mp4' }, '下载成片') : null,
                h('button', { className: 'dd-btn', onClick: () => onGoto('assemble') }, '返回装配'))))
            : h('div', { className: 'dd-empty' }, h('div', { className: 'dd-empty-title' }, '还没有成片'),
              h('p', null, '验收通过后，在装配页导出第一版本地粗剪。'),
              h('button', { className: 'dd-btn primary', onClick: () => onGoto('assemble') }, '前往装配')),
          data.blockers && data.blockers.length ? h('details', { className: 'dd-warnbox' },
            h('summary', null, '交付前还有 ' + data.blockers.length + ' 项待完成'),
            h('ul', null, data.blockers.map((blocker, index) => h('li', { key: index }, blocker)))) : null,
          finals.length > 1 ? h('div', { className: 'dd-sec' }, h('div', { className: 'dd-sec-head' }, '历史成片'),
            h('div', { className: 'dd-sec-body dd-final-history' }, finals.map(final => h('button', {
              key: final.assetId, className: 'dd-btn' + (selected && final.assetId === selected.assetId ? ' primary' : ''),
              onClick: () => setSelectedId(final.assetId), title: final.path,
            }, final.assetId + (final.confirmed ? ' · 已交付' : final.stale ? ' · 来源已变' : !final.exists ? ' · 丢失' : ''))))) : null,
        )),
      )
    }

    CSS_PARTS.push(`
.dd-final-player{display:block;width:100%;max-height:52vh;background:#080a0d;border-radius:var(--rx-sm);margin-bottom:12px}
.dd-final-history{display:flex;flex-wrap:wrap;gap:8px}
.dd-final-history .dd-btn{max-width:100%;overflow-wrap:anywhere;white-space:normal}
`)
