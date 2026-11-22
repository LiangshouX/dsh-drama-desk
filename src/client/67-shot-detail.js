    /** The shot detail column: 真源、产物、判定、依据，同屏。 */
    function ShotDetail(props) {
      const { detail, loading, onClose, busy, actions, workspaceId, onOpenImage, sheet, onSelectShot, panelControls } = props
      if (loading) return h('div', { className: 'dd-inspector' }, h('div', { className: 'dd-empty' }, '正在读取镜头…'))
      if (!detail) {
        // 没有选中镜头时，右栏**不写说明书**——它给这一场的概览：
        // 场次是什么、有多少镜、每一镜什么状态。点一行就切到那一镜。
        if (!sheet || !sheet.shots || sheet.shots.length === 0) {
          return h('div', { className: 'dd-inspector' }, h('div', { className: 'dd-empty' }, '这个阶段还没有镜头'))
        }
        const shots = sheet.shots || []
        const bad = shots.filter(shot => shot.status === 'fail' || shot.status === 'warn').length
        return h('div', { className: 'dd-inspector' },
          h('div', { className: 'dd-inspector-head' },
            h('span', { className: 'id' }, sheet.id || 'SCENE'),
            h('span', { className: 'ttl' }, sheet.title || '概览'),
            h('span', { className: 'dd-spacer' }),
            panelControls,
          ),
          h('div', { className: 'dd-inspector-body' },
            h('div', { className: 'dd-sheet' },
              h('div', { className: 'dd-sheet-head' },
                sheet.id ? h('div', { className: 'sid' }, sheet.id) : null,
                h('div', { className: 'ttl' }, sheet.title || '（无标题）'),
                sheet.summary ? h('div', { className: 'sum' }, sheet.summary) : null,
              ),
              h('div', { className: 'dd-sheet-stats' },
                h('div', { className: 'dd-sheet-stat' },
                  h('div', { className: 'v' }, String(shots.length)),
                  h('div', { className: 'k' }, 'SHOTS')),
                h('div', { className: 'dd-sheet-stat' },
                  h('div', { className: 'v' }, String((sheet.duration || 0) + 's')),
                  h('div', { className: 'k' }, 'DURATION')),
                h('div', { className: 'dd-sheet-stat' },
                  h('div', { className: 'v', style: { color: bad > 0 ? 'var(--sig-warn)' : 'var(--sig-pass)' } }, String(bad)),
                  h('div', { className: 'k' }, 'ATTENTION')),
              ),
              h('div', { className: 'dd-sheet-list' },
                shots.map(shot => {
                  const signal = shotSignal(shot)
                  return h('div', {
                    key: shot.id,
                    className: 'dd-sheet-row',
                    onClick: () => { if (onSelectShot) onSelectShot(shot.id) },
                    title: '打开 ' + shot.id,
                  },
                    h('span', { className: 'id' }, shot.id),
                    h('span', { className: 'nm' }, shot.title || '（无标题）'),
                    h('span', { className: 'st ' + signal.key }),
                  )
                }),
              ),
            ),
          ),
        )
      }
      const shot = detail.shot
      const scene = detail.scene
      const beats = scene && Array.isArray(scene.beats) ? scene.beats : []
      const covered = new Set((shot.covers || []).map(index => index))
      const images = (detail.assets || []).filter(asset => asset.type === 'reference_image' || asset.type === 'keyframe')
      const videos = (detail.assets || []).filter(asset => asset.type === 'video')
      return h('div', { className: 'dd-inspector' },
        h('div', { className: 'dd-inspector-head' },
          h('span', { className: 'id' }, shot.id),
          h('span', { className: 'ttl' }, shot.title || ''),
          h('span', { className: 'dd-spacer' }),
          panelControls,
          h('button', { className: 'dd-icon-btn', onClick: onClose, title: t('action.close', '关闭') }, h(Icon, { name: 'close', size: 13 })),
        ),
        h('div', { className: 'dd-inspector-body' },
          h(Section, { title: t('section.camera', '镜头'), tag: t('tag.source', '真源'), tagKind: 'src', defaultOpen: true },
            h(ShotCameraEditor, { shot, busy, onSave: patch => actions.editShot(shot.id, patch) }),
          ),
          h(Section, { title: t('section.beats', '表演'), tag: t('tag.source', '真源'), tagKind: 'src', defaultOpen: false },
            beats.length === 0
              ? h('div', { className: 'dd-note' }, '该场次没有 beats')
              : h('div', { className: 'dd-beats' },
                beats.map((beat, index) => h(BeatEditor, {
                  key: index,
                  beat,
                  index: index + 1,
                  covered: covered.has(index + 1),
                  disabled: busy,
                  onSave: patch => actions.editBeat(scene.id, { op: 'patch', beatIndex: index + 1, patch }),
                  onInsert: () => actions.editBeat(scene.id, { op: 'insert', beatIndex: index + 1 }),
                  onDelete: () => actions.editBeat(scene.id, { op: 'delete', beatIndex: index + 1 }),
                  onMove: delta => actions.editBeat(scene.id, { op: 'move', beatIndex: index + 1, toIndex: index + 1 + delta }),
                })),
              ),
            ),
          h(Section, { title: t('section.note', '批注'), tag: t('tag.source', '真源'), tagKind: 'src', defaultOpen: false },
            h(Editable, {
              label: '这一镜你想记住什么？', value: shot.notes, multiline: true, disabled: busy,
              placeholder: '（空）',
              onSave: value => actions.annotate(shot.id, value),
            }),
          ),
          h(Section, { title: t('section.prompt', '提示词'), tag: t('tag.artifact', '产物'), tagKind: 'out', defaultOpen: false },
            h(PromptEditor, { shot, prompt: detail.prompt, busy, actions }),
          ),
          h(Section, { title: t('section.verdict', '判定'), tag: '体检器', defaultOpen: true },
            (detail.qc ? detail.qc.layers : []).map(layer => h('div', { key: layer.checker + ':' + layer.scope },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '5px' } },
                h('span', { style: { fontSize: '11.5px', fontWeight: '600' } }, layer.title),
                h('span', { className: 'num', style: { fontSize: '10px', color: 'var(--ink4)' } }, layer.scope || ''),
                h('span', { className: 'dd-spacer' }),
                layer.available
                  ? h('span', {
                    className: 'dd-badge ' + (layer.verdict === 'FAIL' ? 'fail' : layer.verdict === 'WARN' ? 'warn' : 'pass'),
                  }, layer.verdict || '')
                  : h('span', { className: 'dd-note' }, '不可用'),
              ),
              layer.available
                ? h('div', null,
                  (layer.metrics || []).map(metric => h(MetricRow, {
                    key: metric.name,
                    name: metric.name,
                    value: formatNumber(metric.value, typeof metric.value === 'number' && !Number.isInteger(metric.value) ? 3 : 0),
                    threshold: metric.threshold,
                  })),
                  (layer.issues || []).map((issue, index) => h('div', {
                    className: 'dd-issue' + (layer.verdict === 'WARN' ? ' warn' : ''), key: index,
                  }, '· ' + issue)),
                )
                : h('div', { className: 'dd-warnbox' }, layer.unavailableReason || '体检器不可用'),
            )),
            detail.report
              ? h('div', null,
                h('div', { style: { marginTop: '8px', fontSize: '11.5px', fontWeight: '600' } }, '验收报告'),
                h('div', { className: 'dd-note' }, 'verdict: ' + (detail.report.verdict || '—')),
              )
              : null,
          ),
          h(Section, { title: t('section.reference', '参照'), tag: '只读', defaultOpen: true },
            videos.length > 0
              ? videos.map(video => h('div', { key: video.id, style: { marginBottom: '9px' } },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' } },
                  h(Icon, { name: 'film', size: 13 }),
                  h('span', { className: 'num', style: { fontSize: '11px' } }, video.id),
                ),
                h('video', {
                  className: 'dd-video',
                  src: assetVideoUrl(workspaceId, video.id),
                  controls: true,
                  preload: 'metadata',
                  playsInline: true,
                }),
              ))
              : null,
            images.length === 0
              ? h('div', { className: 'dd-note' }, '这一镜没有登记参考图')
              : h('div', { className: 'dd-thumbs' },
                images.map(asset => h(AssetThumb, {
                  key: asset.id,
                  asset,
                  workspaceId,
                  onOpen: () => onOpenImage(asset),
                })),
              ),
          ),
          h(Section, { title: t('section.rules', '规则'), tag: '只读', defaultOpen: false },
            h('div', { className: 'dd-note' }, '此刻生效的规则（与结论同屏）'),
            (detail.rules || []).map(rule => h(RuleCard, { key: rule.id, rule })),
          ),
        ),
      )
    }
