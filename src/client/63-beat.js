    /**
     * 一拍 = 动作行 + 这一拍是不是有台词 + 台词 + 语气。
     *
     * 改东西只有一种手势：**点那段字，就地编辑，失焦即存**。
     * 之前这里是三个常驻输入框 + 一对【保存】【撤销】按钮，
     * 一屏拍位全是框与按钮，读起来像表单而不是剧本。
     *
     * `mode` 有个契约上的硬约束（数据契约 §6）：台词拍必须带语气阶梯。
     * 所以选「画内音 / 画外音」时，若语气还是空的，**mode 先不落盘**——
     * 等语气填上了，mode 与语气一起存。否则用户会先撞上一句报错，
     * 而界面又没有地方让他补语气。
     */
    function BeatEditor(props) {
      const { beat, index, issues, disabled, onSave, onInsert, onDelete, onMove } = props
      const [mode, setMode] = useState(beat.mode || '')
      useEffect(() => { setMode(beat.mode || '') }, [beat.mode])

      const wantsDialogue = mode === 'dialogue' || mode === 'voiceover'

      /**
       * 把一次编辑落盘。mode 与 delivery **必须同时**满足契约，
       * 所以这里统一判断：语气齐了才带着 mode 一起写。
       *
       * `nextMode` 是给「刚点了选项」用的——那一刻 setState 还没生效，
       * 直接读 state 会读到旧值。
       */
      const commit = (patch, nextMode) => {
        const wanted = nextMode === undefined ? mode : nextMode
        const wantsTalk = wanted === 'dialogue' || wanted === 'voiceover'
        const next = { ...patch }
        if (wanted !== (beat.mode || '')) {
          if (!wantsTalk) {
            next.mode = null
          } else {
            const delivery = next.delivery !== undefined ? next.delivery : (beat.delivery || '')
            if (String(delivery).trim() !== '') next.mode = wanted
          }
        }
        if (Object.keys(next).length === 0) return undefined
        // **把结果原样交回去**：编辑器靠 `false` 判断「没存上，别退出编辑态」。
        return onSave(next)
      }

      return h('div', { className: 'dd-beat' },
        h('div', { className: 'dd-beat-head' },
          h('span', { className: 'n' }, '#' + index),
          beat.speaker ? h('span', { className: 'who' }, beat.speaker) : null,
          h('span', { className: 'dd-spacer' }),
          h('div', { className: 'dd-beat-acts' },
            h('button', { className: 'dd-icon-btn sm ghost', disabled: disabled, title: '上移这一拍', onClick: () => onMove(-1) }, h(Icon, { name: 'up', size: 12 })),
            h('button', { className: 'dd-icon-btn sm ghost', disabled: disabled, title: '下移这一拍', onClick: () => onMove(1) }, h(Icon, { name: 'down', size: 12 })),
            h('button', { className: 'dd-icon-btn sm ghost', disabled: disabled, title: '在后面插入一拍', onClick: onInsert }, h(Icon, { name: 'plus', size: 12 })),
            h('button', { className: 'dd-icon-btn sm ghost', disabled: disabled, title: '删除这一拍', onClick: onDelete }, h(Icon, { name: 'trash', size: 12 })),
          ),
        ),
        h('div', { className: 'dd-beat-body' },
          h(Editable, {
            label: '动作行', value: beat.action || '', multiline: true, disabled,
            placeholder: '这一拍主体做了什么',
            onSave: value => commit({ action: value }),
          }),
          h('div', { className: 'dd-beat-kind' },
            h('span', { className: 'lab' }, '这一拍是'),
            h('div', { className: 'preset' },
              [['', '无台词'], ['dialogue', '画内音（要口型）'], ['voiceover', '画外音']].map(option =>
                h('button', {
                  key: option[0],
                  className: mode === option[0] ? 'on' : '',
                  disabled,
                  onClick: () => {
                    if (mode === option[0]) return
                    setMode(option[0])
                    commit({}, option[0])
                  },
                }, option[1]))),
          ),
          wantsDialogue
            ? h(Editable, {
              label: '台词', value: beat.text || '', multiline: true, disabled,
              // 台词是**作品内容**：用文学字族（`docs/dev/ui-language.md` U1）。
              serif: true,
              placeholder: '这一拍说出口的话',
              onSave: value => commit({ text: value }),
            })
            : null,
          wantsDialogue
            ? h(Editable, {
              label: '语气', labelTitle: '语气 delivery（本句的情绪 + 语速 + 气口）',
              value: beat.delivery || '', multiline: true, disabled,
              placeholder: '本句的情绪 + 语速 + 气口',
              onSave: value => commit({ delivery: value }),
            })
            : null,
          issues && issues.length > 0
            ? h('div', null, issues.map((issue, i) => h('div', { className: 'dd-issue', key: i }, '· ' + issue)))
            : null,
        ),
      )
    }
