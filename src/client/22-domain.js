    // ── domain constants ───────────────────────────────────────────────────
    //
    // 这些是**取值枚举**，不是规则。规则的唯一真源在 build/spec/。
    // 预置只是省事：不满足时仍然可以手填。

    const STAGES = [
      { id: 'conceive', label: '创意', en: 'conceive' },
      { id: 'outline', label: '大纲', en: 'outline' },
      { id: 'characters', label: '角色', en: 'characters' },
      { id: 'script', label: '剧本', en: 'script' },
      { id: 'storyboard', label: '分镜', en: 'storyboard' },
      { id: 'generate', label: '生成', en: 'generate' },
      { id: 'verify', label: '验收', en: 'verify' },
      { id: 'assemble', label: '装配', en: 'assemble' },
      { id: 'deliver', label: '交付', en: 'deliver' },
    ]

    const STAGE_LABEL = STAGES.reduce((acc, stage) => {
      acc[stage.id] = stage.label
      return acc
    }, {})

    const RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:2', '2.39:1', '21:9', '5:4']

    const RESOLUTIONS = ['768P', '1080P', '2K', '4K']

    const CAMERAS = [
      'Static Shot', 'Push In', 'Pull Out', 'Zoom In', 'Zoom Out',
      'Pan Left', 'Pan Right', 'Truck Left', 'Truck Right',
      'Tilt Up', 'Tilt Down', 'Pedestal Up', 'Pedestal Down',
      'Arc Shot', 'Tracking Shot', 'Shake Slightly', 'POV',
      'Roll Clockwise', 'Roll Counterclockwise',
    ]

    const DURATIONS = [4, 5, 6, 7, 8, 10, 12, 15]
