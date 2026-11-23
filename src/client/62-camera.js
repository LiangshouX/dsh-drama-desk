    // ── shot detail ────────────────────────────────────────────────────────

    /** The camera fields with presets — 预置只是省事，不满足时仍然可以手填。 */
    function ShotCameraEditor(props) {
      const { shot, busy, onSave } = props
      if (!shot) return null
      const save = patch => onSave(patch)
      return h('div', { className: 'dd-grid2' },
        h(PresetField, {
          label: '运镜', value: shot.camera, options: CAMERAS, disabled: busy, allowCustom: true, wide: true,
          onSave: value => save({ camera: value }),
        }),
        h(PresetField, {
          label: '画幅', value: shot.ratio, options: RATIOS, disabled: busy, allowCustom: true,
          onSave: value => save({ ratio: value }),
        }),
        h(PresetField, {
          label: '分辨率', value: shot.resolution, options: RESOLUTIONS, disabled: busy, allowCustom: true,
          onSave: value => save({ resolution: value }),
        }),
        h(PresetField, {
          label: '时长 (s)', value: shot.duration, options: DURATIONS, disabled: busy, allowCustom: true,
          onSave: value => save({ duration: Number(value) || 0 }),
        }),
        h(Editable, {
          label: '光参数 preset', mono: true,
          value: shot.lighting ?? '', disabled: busy,
          placeholder: 'day_interior / night_face …',
          onSave: value => save({ lighting: value }),
        }),
        h(Editable, {
          label: '标题',
          value: shot.title ?? '', disabled: busy,
          onSave: value => save({ title: value }),
        }),
        h(Editable, { label: '当前视频版本', value: String(shot.current_version ?? 1), disabled: busy,
          onSave: value => save({ current_version: Number(value) }) }),
        h(Editable, { label: '覆盖的拍号', value: (shot.covers || []).join(', '), disabled: busy,
          placeholder: '1, 2, 3', onSave: value => save({ covers: value.split(/[,，\s]+/).filter(Boolean).map(Number) }) }),
        h(Editable, { label: '参考资产 ID', value: (shot.references || []).join(', '), disabled: busy,
          placeholder: '在资产页登记后填入 ID', onSave: value => save({ references: value.split(/[,，\s]+/).filter(Boolean) }) }),
        h('div', { style: { gridColumn: '1 / -1' } },
          h(Editable, {
            label: '这一镜要表达什么', title: '这一镜要表达什么（派生摘要 · 只读）',
            readOnly: true,            value: shot.summary || '',
            placeholder: '（没有摘要）',
          })),
        h('div', { style: { gridColumn: '1 / -1' } },
          h(Editable, {
            label: '这一镜的动作', title: '这一镜的动作（motion_action · 真源）',
            value: shot.motion_action ?? '', multiline: true, disabled: busy,
            placeholder: '这一镜里主体做了什么',
            onSave: value => save({ motion_action: value }),
          })),
        h('div', { style: { gridColumn: '1 / -1' } },
          h(Editable, {
            label: '备注 / 导演批注',
            value: shot.notes ?? '', multiline: true, disabled: busy,
            placeholder: '这一镜你想记住什么？',
            onSave: value => save({ notes: value }),
          })),
        h('div', { style: { gridColumn: '1 / -1' } },
          h('span', { className: 'dd-note' }, '派生字段（description_en / dialogue）只读，由编译生成')),
      )
    }
