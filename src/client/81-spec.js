    // ── spec view ──────────────────────────────────────────────────────────

    function SpecView(props) {
      const { spec, tab, onTab, stage, onStage, onGoto } = props
      const [openRule, setOpenRule] = useState(null)
      if (!spec) return h('div', { className: 'dd-empty' }, '正在读取规范…')
      if (!spec.available) {
        return h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            h('div', { className: 'dd-warnbox' }, spec.hint || '规范未构建'),
            h('div', { className: 'dd-note' }, '规范是唯一真源。缺了它，界面上的「依据」就没有出处。'),
          ))
      }
      const rules = spec.rules.filter(rule => !stage || rule.inStage)
      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-toolbar' },
          h('div', { className: 'dd-seg' },
            h('button', { className: tab === 'rules' ? 'on' : '', onClick: () => onTab('rules') }, t('tab.rules', '铁律')),
            h('button', { className: tab === 'constitution' ? 'on' : '', onClick: () => onTab('constitution') }, t('tab.constitution', '创作宪法')),
            h('button', { className: tab === 'contract' ? 'on' : '', onClick: () => onTab('contract') }, t('tab.contract', '数据契约')),
            h('button', { className: tab === 'checklist' ? 'on' : '', onClick: () => onTab('checklist') }, t('tab.checklist', '验收清单')),
          ),
          h('span', { className: 'dd-spacer' }),
          tab === 'rules'
            ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px' } },
              h('select', { className: 'dd-input', value: stage, onChange: event => onStage(event.target.value) },
                h('option', { value: '' }, '全部阶段'),
                STAGES.map(entry => h('option', { value: entry.id, key: entry.id }, entry.en))),
              // 规范与阶段之间也该连着：看完一条铁律，直接去它管的那个阶段。
              stage !== '' && typeof onGoto === 'function'
                ? h('button', {
                  className: 'dd-btn sm',
                  type: 'button',
                  title: '去「' + (STAGE_LABEL[stage] || stage) + '」阶段',
                  onClick: () => onGoto(stage),
                }, '去这个阶段')
                : null,
            )
            : null,
        ),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            tab === 'rules'
              ? h('div', null,
                h('div', { className: 'dd-note', style: { marginBottom: '9px' } },
                  '来源：' + (spec.sources && spec.sources.rules ? spec.sources.rules : '') + '（规则真源，界面不复述）'),
                h('div', { className: 'dd-rule-list' },
                  rules.map(rule => h('div', { key: rule.id },
                    h('div', {
                      className: 'dd-rule-row',
                      onClick: () => setOpenRule(openRule === rule.id ? null : rule.id),
                    },
                      h('span', { className: 'rid' }, rule.id),
                      h('span', { className: 'ti' }, rule.title),
                      // 规则上写着它管哪几个阶段——那几段就该能点过去。
                      // 看完一条铁律接着去它管的那个阶段，是这一页最自然的下一步。
                      h('span', { className: 'st' },
                        (rule.stages || []).length === 0
                          ? '—'
                          : (rule.stages || []).map(stage => (typeof onGoto === 'function'
                            ? h('button', {
                              key: stage,
                              className: 'dd-ref',
                              type: 'button',
                              title: '去「' + (STAGE_LABEL[stage] || stage) + '」阶段',
                              onClick: event => { event.stopPropagation(); onGoto(stage) },
                            }, STAGE_LABEL[stage] || stage)
                            : h('span', { key: stage, className: 'dd-ref' }, STAGE_LABEL[stage] || stage)))),
                    ),
                    openRule === rule.id
                      ? h('div', { className: 'dd-rule-body' },
                        rule.evidence ? h('div', { className: 'ev' }, (rule.evidenceLabel ? rule.evidenceLabel + '：' : '') + rule.evidence) : null,
                        rule.evidence ? h('div', { style: { marginTop: '7px' } }, rule.body) : h('div', null, rule.body),
                      )
                      : null,
                  )),
                ),
              )
              : h(DocView, { sections: spec[tab] || [] }),
          ),
        ),
      )
    }
