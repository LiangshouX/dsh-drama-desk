    /** Local rough cut with a durable job and an explicit readiness check. */
    function AssembleView(props) {
      const { data, onOpenShot, onGoto, busy, actions } = props
      const [profile, setProfile] = useState('landscape')
      const shots = data.shots || []
      const totals = data.totals || {}
      const job = data.job
      const running = job && job.status === 'running'
      return h('div', { className: 'dd-main' },
        h(StageHeader, { stage: 'assemble', title: '装配', desc: '按分镜顺序连接已验收的当前版本，生成本地粗剪。',
          right: [h('span', { className: 'dd-chip', key: 'shots' }, shots.length + ' 镜'),
            h('span', { className: 'dd-chip', key: 'seconds' }, (totals.seconds ?? 0) + 's'),
            h('span', { className: 'dd-chip', key: 'cost' }, '$' + formatNumber(totals.costUsd ?? 0, 2))] }),
        h('div', { className: 'dd-scroll' }, h('div', { className: 'dd-grid' },
          h('section', { className: 'dd-sec' },
            h('div', { className: 'dd-sec-head' }, h('span', { className: 't' }, '本地顺切粗剪'),
              h('span', { className: 'sp' }), h('span', { className: 'dd-badge' }, 'FFmpeg · 零生成费用')),
            h('div', { className: 'dd-sec-body' },
              h('p', { className: 'dd-note' }, '保留整段视频与原声，统一为 24fps；画幅不符时留黑边，无音轨时补静音。每次输出新版本。'),
              h('div', { className: 'dd-cut-controls' },
                h('label', null, '输出画幅 ', h('select', { value: profile, disabled: busy || running,
                  onChange: event => setProfile(event.target.value), 'aria-label': '输出画幅' },
                  h('option', { value: 'landscape' }, '横屏 16:9 · 1280×720'),
                  h('option', { value: 'portrait' }, '竖屏 9:16 · 720×1280'),
                  h('option', { value: 'square' }, '方形 1:1 · 1080×1080'))),
                h('button', { className: 'dd-btn primary', disabled: busy || running || !data.ready,
                  onClick: () => actions.assemble(profile) }, running ? '正在本地装配…' : '导出本地粗剪'),
                h('button', { className: 'dd-btn', onClick: () => onGoto('deliver') }, '查看成片')),
              job ? h('div', { className: 'dd-cut-progress', role: 'status', 'aria-live': 'polite' },
                h('div', null, job.status === 'failed' || job.status === 'interrupted' ? '装配未完成 · ' + job.message : job.message),
                running ? h('progress', { max: job.total || 1, value: job.completed || 0, 'aria-label': '装配镜头进度' }) : null,
                job.status === 'succeeded' ? h('button', { className: 'dd-btn sm', onClick: () => onGoto('deliver') }, '回看这一版') : null) : null)),
          data.gaps && data.gaps.length ? h('div', { className: 'dd-warnbox' },
            h('b', null, '还差 ' + data.gaps.length + ' 项'),
            h('ul', null, data.gaps.slice(0, 6).map((gap, i) => h('li', { key: i }, gap))),
            data.gaps.length > 6 ? h('details', null, h('summary', null, '其余缺口'),
              h('ul', null, data.gaps.slice(6).map((gap, i) => h('li', { key: i }, gap)))) : null,
            h('button', { className: 'dd-btn sm', onClick: () => onGoto('verify') }, '前往验收')) : null,
          data.warnings && data.warnings.length ? h('details', { className: 'dd-note' },
            h('summary', null, '音轨提醒 · ' + data.warnings.length + ' 项'),
            h('ul', null, data.warnings.map((warning, i) => h('li', { key: i }, warning)))) : null,
          shots.length === 0 ? h('div', { className: 'dd-empty' }, '还没有分镜。先完成分镜与镜头验收，再来装配。')
            : h('div', { className: 'dd-cut-table' }, h('table', { className: 'dd-table' },
              h('thead', null, h('tr', null, ['顺序 / 镜头', '内容', '当前版本', '音轨登记', '状态', ''].map(label => h('th', { key: label }, label)))),
              h('tbody', null, shots.map((shot, index) => h('tr', { key: shot.id },
                h('td', { className: 'n' }, String(index + 1).padStart(2, '0') + ' · ' + shot.id),
                h('td', null, shot.title || '—'), h('td', { className: 'n' }, 'v' + (shot.version ?? '?')),
                h('td', null, shot.hasAudio ? '有' : '待实测'),
                h('td', null, h('span', { className: 'dd-badge ' + (shot.gap ? 'fail' : shot.status === 'verified' ? 'pass' : 'warn'),
                  title: (shot.gapReasons || []).join('；') }, shot.gap ? '缺素材' : shot.status === 'verified' ? '已验收' : '待验收')),
                h('td', null, h('button', { className: 'dd-btn sm', onClick: () => onOpenShot(shot.id) }, '打开镜头'))))))),
        )),
      )
    }

    CSS_PARTS.push(`
.dd-cut-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0}
.dd-cut-controls label{display:flex;align-items:center;gap:8px;color:var(--ink2);font-size:12px}
.dd-cut-controls select{max-width:100%;background:var(--raised);color:var(--ink);border:1px solid var(--line);border-radius:var(--rx-sm);padding:8px}
.dd-cut-progress{border-top:1px solid var(--line);padding-top:12px;font-size:12px;line-height:1.7;overflow-wrap:anywhere}
.dd-cut-progress progress{width:100%;height:8px;accent-color:var(--hot);margin:10px 0}
.dd-cut-table{overflow-x:auto;max-width:100%}
.dd-cut-table table{min-width:550px}
@container (max-width:560px){.dd-cut-controls{align-items:stretch;flex-direction:column}.dd-cut-controls label{flex-wrap:wrap}}
`)
