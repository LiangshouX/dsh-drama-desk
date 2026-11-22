    // ── the generate stage: the shot wall ──────────────────────────────────

    /**
     * One shot on the wall.
     *
     * 导演纵览全片时真正要读的是三件事：**这一镜是什么**（标题）、**它在讲什么**
     * （内容摘要）、**它现在什么状态**（颜色）。所以卡片上必须有静帧或者
     * 排版封面——一个只有编号的方块对导演毫无意义。
     */
    function ShotCard(props) {
      const { shot, selected, onSelect, workspaceId, index } = props
      const [failed, setFailed] = useState(false)
      const signal = shotSignal(shot)
      const poster = shot.poster
      const posterSrc = failed || poster === undefined
        ? undefined
        : poster.asset
          ? assetImageUrl(workspaceId, poster.asset)
          : posterUrl(workspaceId, shot.id)
      const marks = shot.markers || []
      return h('button', {
        className: 'dd-monitor' + (selected ? ' on' : ''),
        onClick: () => onSelect(shot.id),
        title: shot.id + ' · ' + (shot.title || '') + '\n' + signal.label,
        style: index === undefined ? undefined : { animationDelay: Math.min(index, 14) * 26 + 'ms' },
      },
        h('div', { className: 'screen' },
          posterSrc
            ? h('img', {
              src: posterSrc, alt: shot.id, loading: 'lazy',
              onError: () => setFailed(true),
            })
            : null,
          (!posterSrc || failed)
            ? h('div', { className: 'typo' },
              h('div', { className: 'big' }, shot.id),
              h('div', { className: 'cam' }, shot.camera || shot.lighting || '—'),
            )
            : null,
          h('div', { className: 'veil' }),
          h('div', { className: 'topline' },
            h('span', { className: 'sid' }, shot.id),
            h('span', { className: 'pill ' + signal.key }, h('i', null), signal.label),
          ),
          marks.length > 0
            ? h('div', { className: 'marks' },
              marks.slice(0, 3).map((mark, markIndex) => h('span', {
                key: markIndex,
                className: 'mark' + (mark.kind === 'beat' ? ' beat' : mark.kind === 'notes' ? ' notes' : mark.kind === 'prompt' ? ' prompt' : ''),
              }, mark.label)))
            : null,
        ),
        h('div', { className: 'cap' },
          h('div', { className: 't' }, shot.title || '（无标题）'),
          h('div', { className: 's' }, shot.summary || '（没有内容摘要）'),
          h('div', { className: 'm' },
            h('span', null, h('b', null, shot.duration ? shot.duration + 's' : '—')),
            h('span', null, shot.camera || '—'),
            shot.ratio ? h('span', null, shot.ratio) : null,
          ),
        ),
      )
    }
