    /** The verify stage: machine verdicts plus the human's call. */
    function VerifyView(props) {
      const { data, busy, actions, onOpenShot } = props
      const shots = data.shots || []
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'verify',
          title: '验收',
          desc: '机器判定只作参考，判废必须人工复核（R5）。人工段填了才能把 verdict 定为 pass。',
          right: [
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(shots.length)), ' 镜待验'),
            h('span', { className: 'dd-chip' }, '通过 ', h('b', { className: 'num' },
              String(shots.filter(shot => shot.verdict === 'pass').length))),
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
                  return h('div', { className: 'dd-sec', key: shot.id },
                    h('div', { className: 'dd-sec-head', onClick: () => onOpenShot(shot.id) },
                      h('span', { className: 'num', style: { fontSize: '12px' } }, shot.id),
                      h('span', { className: 't' }, shot.title || ''),
                      h('span', { className: 'sp' }),
                      h('span', {
                        className: 'dd-badge ' + (shot.verdict === 'pass' ? 'pass' : shot.verdict === 'fail' ? 'fail' : shot.verdict === 'warn' ? 'warn' : ''),
                      }, shot.verdict || '未判'),
                    ),
                    h('div', { className: 'dd-sec-body' },
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
