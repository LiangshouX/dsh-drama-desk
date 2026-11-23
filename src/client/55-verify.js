    /** The verify stage: machine verdicts plus the human's call. */
    function VerifyView(props) {
      const { data, busy, actions, onOpenShot, onGoto, workspaceId } = props
      const shots = data.shots || []
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'verify',
          title: '验收',
          desc: '机器判定只作参考，判废必须人工复核（R5）。人工段填了才能把 verdict 定为 pass。',
          right: [
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(shots.length)), ' 镜待验'),
            h('span', { className: 'dd-chip' }, '通过 ', h('b', { className: 'num' },
              String(shots.filter(shot => shot.status === 'verified').length))),
          ],
        }),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            shots.length === 0
              ? h('div', { className: 'dd-empty' }, '没有需要验收的镜头')
              : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
                shots.map(shot => {
                  const report = shot.report || {}
                  const human = report.human || {}
                  const tech = report.tech || {}
                  // 判定有三个来源，大小写还不统一：报告里的 `verdict` 是大写，
                  // 体检器的 `qc.verdict` 也是大写，人工段是小写。以前这里只比小写
                  // `shot.verdict === 'fail'`，于是**大写判定一个都对不上**：
                  // 徽标无色、按钮永远是「生成台」，判废的镜头看不出该回去修。
                  const verdict = String(shot.verdict || (shot.qc && shot.qc.verdict) || '').toLowerCase()
                  const broken = verdict === 'fail' || verdict === 'warn'
                  return h('div', { className: 'dd-sec', key: shot.id },
                    h('div', { className: 'dd-sec-head', onClick: () => onOpenShot(shot.id) },
                      h('span', { className: 'num', style: { fontSize: '12px' } }, shot.id),
                      h('span', { className: 't' }, shot.title || ''),
                      h('span', { className: 'sp' }),
                      // 判废之后**下一步就是回去改**：验收页不该是终点站。
                      // 没有这条，用户看完 FAIL 只能自己找导航、自己找那一镜。
                      typeof onGoto === 'function'
                        ? h('button', {
                          className: 'dd-btn sm' + (broken ? ' primary' : ' ghost'),
                          type: 'button',
                          title: '去生成台打开 ' + shot.id + (broken ? '（把它修好）' : ''),
                          onClick: event => { event.stopPropagation(); onGoto('generate', shot.id) },
                        }, broken ? '去修这一镜' : '生成台')
                        : null,
                      h('span', {
                        className: 'dd-badge ' + (verdict === 'pass' ? 'pass' : verdict === 'fail' ? 'fail' : verdict === 'warn' ? 'warn' : ''),
                      }, shot.verdict || (shot.qc && shot.qc.verdict) || '未判'),
                    ),
                    h('div', { className: 'dd-sec-body' },
                      shot.reportStale ? h('div', { className: 'dd-warnbox' }, '机器报告属于旧版本，以下读数仅供历史参考。请对当前视频重新检查和人工复核。') : null,
                      shot.videoAssetId ? h('video', { controls: true, preload: 'none', playsInline: true,
                        src: assetVideoUrl(workspaceId, shot.videoAssetId), className: 'dd-final-player',
                        'aria-label': shot.id + ' 当前版本回看' }) : h('div', { className: 'dd-note' }, '当前版本还没有可用视频'),
                      h('div', { className: 'dd-cut-controls' },
                        h('span', { className: 'dd-badge' }, '当前 v' + (shot.currentVersion ?? '?')),
                        h('button', { className: 'dd-btn sm primary',
                          disabled: busy || !shot.videoAssetId || shot.status === 'verified',
                          onClick: () => actions.approveShot(shot.id) }, shot.status === 'verified' ? '已验收通过' : '确认本镜验收通过')),
                      /* 机器读数是**读数**，不是可改的字段——
                         之前它们跟人工判定长得一模一样，点进去才发现改不了。 */
                      h('div', { className: 'dd-grid3' },
                        h(Editable, {
                          label: '技术判定', readOnly: true,
                          value: tech.pass === true ? 'pass' : tech.pass === false ? 'fail' : '—',
                        }),
                        h(Editable, {
                          label: '实测时长', readOnly: true,
                          value: tech.durationSec ? tech.durationSec + 's' : '—',
                        }),
                        h(Editable, {
                          label: '分辨率', readOnly: true,
                          value: tech.width ? tech.width + '×' + tech.height : '—',
                        }),
                      ),
                      h('div', { className: 'dd-grid2' },
                        h(Editable, {
                          layout: 'row', label: '人工判定', labelTitle: '人工判定（verdict）',
                          value: human.verdict || '', disabled: busy,
                          placeholder: 'pass / fail / warn',
                          onSave: value => actions.editVerify(shot.id, { verdict: value }),
                        }),
                        h(Editable, {
                          layout: 'row', label: '复核人',
                          value: human.reviewer || '', disabled: busy,
                          placeholder: '姓名',
                          onSave: value => actions.editVerify(shot.id, { reviewer: value }),
                        }),
                      ),
                      h(Editable, {
                        layout: 'row', label: '人工发现的问题',
                        value: (human.issues || []).join('；'), multiline: true, disabled: busy,
                        placeholder: '用「；」分隔',
                        onSave: value => actions.editVerify(shot.id, { issues: value.split(/[；;]/).map(entry => entry.trim()).filter(Boolean) }),
                      }),
                      shot.qc && shot.qc.issues && shot.qc.issues.length > 0
                        ? h('div', null,
                          h('div', { className: 'dd-note', style: { marginBottom: '4px' } }, '机器判定的问题（仅作参考）'),
                          shot.qc.issues.map((issue, index) => h('div', { className: 'dd-issue', key: index }, '· ' + issue)),
                        )
                        : null,
                    ),
                  )
                }),
              ),
          ),
        ),
      )
    }
