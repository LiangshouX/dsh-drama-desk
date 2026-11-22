    /** The script stage: the performance layer. 每一拍都可增删改移。 */
    function ScriptView(props) {
      const { data, busy, actions } = props
      const scenes = data.scenes || []
      const [activeId, setActiveId] = useState(scenes.length > 0 ? scenes[0].id : '')
      useEffect(() => {
        if (scenes.length === 0) { setActiveId(''); return }
        if (!scenes.some(scene => scene.id === activeId)) setActiveId(scenes[0].id)
      }, [scenes.map(scene => scene.id).join(',')])
      const scene = scenes.find(entry => entry.id === activeId)
      const sceneStrip = h('div', { className: 'dd-strip' },
        scenes.map(entry => h('div', {
          key: entry.id,
          className: 'dd-scene-cell' + (entry.id === activeId ? ' on' : ''),
          onClick: () => setActiveId(entry.id),
        },
          h('span', { className: 'sid' }, entry.id),
          h('span', { className: 'nm' }, entry.title || '（无标题）'),
          h('span', { className: 'ct' }, (entry.beats || []).length + '拍'),
          entry.qc && entry.qc.verdict === 'FAIL'
            ? h('span', { className: 'dot fail' })
            : entry.qc && entry.qc.verdict === 'WARN'
              ? h('span', { className: 'dot warn' })
              : entry.qc
                ? h('span', { className: 'dot ok' })
                : null,
        )),
      )
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'script',
          title: '表演层',
          desc: 'script 阶段的出口是 scenes.json 的 beats[]：动作行、台词、语气。铁律 R18 管的就是这一层。',
          right: [
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(scenes.length)), ' 场'),
            scene ? h('span', { className: 'dd-chip' }, scene.id, ' · ', h('b', { className: 'num' }, String((scene.beats || []).length)), ' 拍') : null,
          ],
        }),
        h('div', { className: 'dd-toolbar', style: { paddingTop: '7px', paddingBottom: '7px' } },
          sceneStrip,
        ),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            !scene
              ? h('div', { className: 'dd-empty' }, '还没有场次')
              : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
                scene.qc
                  ? h('div', {
                    className: scene.qc.verdict === 'FAIL' ? 'dd-errorbox' : scene.qc.verdict === 'WARN' ? 'dd-warnbox' : 'dd-okbox',
                  },
                    h('div', null, '表演层体检：', h('b', null, scene.qc.verdict || '—')),
                    scene.qc.issues && scene.qc.issues.length > 0
                      ? h('ul', { style: { margin: '6px 0 0', paddingLeft: '18px' } },
                        scene.qc.issues.map((issue, index) => h('li', { key: index }, issue)))
                      : null,
                    h('div', { style: { marginTop: '6px', fontSize: '11px', opacity: '.8' } },
                      '反应拍覆盖率 ' + formatNumber(scene.qc.reactionRate, 2)
                      + ' · 沉默占比 ' + formatNumber(scene.qc.silenceRatio, 2)
                      + ' · 台词拍 ' + scene.qc.dialogueBeats + ' / 反应拍 ' + scene.qc.reactionBeats),
                  )
                  : null,
                h('div', { className: 'dd-beats' },
                  (scene.beats || []).map((beat, index) => h(BeatEditor, {
                    key: (scene.id || '') + ':' + index,
                    beat,
                    index: index + 1,
                    issues: beat.issues,
                    disabled: busy,
                    onSave: patch => actions.editBeat(scene.id, { op: 'patch', beatIndex: index + 1, patch }),
                    onInsert: () => actions.editBeat(scene.id, { op: 'insert', beatIndex: index + 1 }),
                    onDelete: () => actions.editBeat(scene.id, { op: 'delete', beatIndex: index + 1 }),
                    onMove: delta => actions.editBeat(scene.id, { op: 'move', beatIndex: index + 1, toIndex: index + 1 + delta }),
                  })),
                ),
                h('div', { style: { display: 'flex', gap: '7px' } },
                  h('button', {
                    className: 'dd-btn', disabled: busy,
                    onClick: () => actions.editBeat(scene.id, { op: 'insert', beatIndex: (scene.beats || []).length }),
                  }, h(Icon, { name: 'plus', size: 12 }), ' 追加一拍'),
                ),
              ),
          ),
        ),
      )
    }
