    // ── stage views ────────────────────────────────────────────────────────

    /**
     * 阶段台头（deck）。
     *
     * 以前这里有一条「标题条」加一条「工具条」，两道横栏把内容压成两指宽。
     * 现在合成**一条**：左边是这一阶段是什么，右边是此刻要用的动作。
     * 中间那句说明只留一行，念完就够。
     */
    function StageHeader(props) {
      const { stage, title, desc, left, right } = props
      const index = STAGES.findIndex(entry => entry.id === stage)
      return h('div', { className: 'dd-deck' },
        h('div', { className: 'dd-deck-id' },
          h('span', { className: 'sn3' },
            String(index >= 0 ? index + 1 : 1).padStart(2, '0') + ' / ' + String(STAGES.length).padStart(2, '0')),
          h('span', { className: 'st3' }, title),
          left ? h('span', { className: 'deck-left' }, left) : null,
          desc ? h('span', { className: 'sd3', title: desc }, desc) : null,
        ),
        right ? h('div', { className: 'dd-deck-tools' }, right) : null,
      )
    }

    function AddRecordForm(props) {
      const { kinds, scenes = [], busy, actions } = props
      const [kind, setKind] = useState(kinds[0])
      const [title, setTitle] = useState('')
      const [id, setId] = useState('')
      const [scene, setScene] = useState('')
      const selectedScene = scenes.some(row => row.id === scene) ? scene : scenes[0] && scenes[0].id
      const labels = { scene: '场次', character: '角色', prop: '道具', shot: '镜头' }
      return h('details', { className: 'dd-add-record' },
        h('summary', null, '+ 新增' + kinds.map(value => labels[value]).join(' / ')),
        h('form', { className: 'dd-cut-controls', onSubmit: async event => {
          event.preventDefault()
          const result = await actions.addRecord(kind, { id: id || undefined, sceneId: selectedScene,
            fields: kind === 'character' || kind === 'prop' ? { name: title } : { title } })
          if (result !== false) { setTitle(''); setId('') }
        } },
          kinds.length > 1 ? h('label', null, '类型', h('select', { value: kind, onChange: event => setKind(event.target.value), disabled: busy },
            kinds.map(value => h('option', { key: value, value }, labels[value])))) : null,
          kind === 'shot' ? h('label', null, '场次', h('select', { value: selectedScene || '', disabled: busy, required: true,
            onChange: event => setScene(event.target.value) }, h('option', { value: '', disabled: true }, '先创建场次'),
            scenes.map(row => h('option', { key: row.id, value: row.id }, row.id + ' · ' + (row.title || '未命名'))))) : null,
          kind === 'character' || kind === 'prop' ? h('label', null, '目录 ID', h('input', { value: id, required: true,
            placeholder: kind === 'prop' ? 'prop_letter' : 'narrator', pattern: '[a-z][a-z0-9_]*', disabled: busy,
            onChange: event => setId(event.target.value) })) : null,
          h('label', null, '名称', h('input', { value: title, required: true, disabled: busy, onChange: event => setTitle(event.target.value) })),
          h('button', { className: 'dd-btn primary', disabled: busy || (kind === 'shot' && !selectedScene), type: 'submit' }, '创建' + labels[kind]),
        ))
    }

    CSS_PARTS.push(`
.dd-add-record{padding:10px 14px;background:var(--raised);border:1px solid var(--line);border-radius:var(--rx-sm);box-shadow:inset 0 1px var(--hl);margin-bottom:12px;font-size:12px}
.dd-add-record summary{cursor:pointer;color:var(--ink2);min-height:24px;line-height:24px}
.dd-add-record input{min-width:100px;max-width:100%;background:var(--raised);color:var(--ink);border:1px solid var(--line);border-radius:var(--rx-sm);padding:8px}
`)

    /**
     * 创意简报：一份**文档**，也是这一阶段唯一能改的东西。
     *
     * 简报用**统一的文本编辑组件**（`Editable`）：读态是 markdown 排版的正文，
     * 点那段字就地编辑（失焦即存），长文在**放大窗口**里改。
     *
     * 以前这里自己手写了一套编辑器（读态/编辑态两套 DOM + 两套状态），
     * 结果就是「每处各写一套」——跳、抖、和别处不一致。
     */
    function ConceiveView(props) {
      const { data, busy, actions } = props
      const brief = data.brief || {}
      const work = data.work || {}
      const text = brief.text || ''
      /** 空态那枚「写第一版简报」按钮靠它把字段推进编辑态（**手动触发**）。 */
      const [signal, setSignal] = useState(0)

      const meta = [
        h('span', { className: 'dd-chip' }, '作品 ', h('b', null, work.title || '—')),
        h('span', { className: 'dd-chip' }, 'id ', h('b', { className: 'num' }, work.id || '—')),
        brief.updatedAt ? h('span', { className: 'dd-chip' }, '更新 ', h('b', { className: 'num' }, formatTime(brief.updatedAt))) : null,
        brief.bytes ? h('span', { className: 'dd-chip' }, '简报 ', h('b', { className: 'num' }, formatBytes(brief.bytes))) : null,
      ]
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'conceive',
          title: '创意简报',
          desc: 'conceive 阶段的唯一产物：creative/brief.md。下游的每一场戏都从这里长出来。',
          right: meta,
        }),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            brief.exists
              ? null
              : h('div', { className: 'dd-empty', style: { padding: '38px 20px' } },
                h('div', { className: 'dd-empty-title' }, '还没有简报'),
                h('div', null, 'conceive 的出口是 creative/brief.md。写下来，它就存在了。'),
                h('div', { style: { marginTop: '14px' } },
                  h('button', {
                    className: 'dd-btn primary', disabled: busy,
                    onClick: () => setSignal(signal + 1),
                  }, '写第一版简报'))),
            h(Editable, {
              label: '简报',
              labelTitle: 'creative/brief.md（markdown）',
              value: text,
              multiline: true,
              serif: true,
              markdown: true,
              disabled: busy,
              placeholder: '# 简报\n\n一句话故事…',
              editSignal: signal,
              emptyHint: h('span', { className: 'dd-tf-empty' }, '（空）'),
              onSave: value => actions.editBrief(value),
            }),
          ),
        ),
      )
    }
