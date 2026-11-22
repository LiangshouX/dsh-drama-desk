    /**
     * 提示词是**产物**，但它也是**可改的文本**。
     *
     * 「重新编译 / 校验过期 / 丢弃手工改写」是**动作**，留在工具条上；
     * 「编辑」不是动作，是**另一种看法**——所以它用统一的文本编辑组件
     * （`Editable`）：点那些字就地编辑，失焦即存，长文在放大窗口里改。
     *
     * 提示词**不开 markdown**：它是给模型看的源码，要原样读出来；
     * 按 markdown 渲染会把它的换行结构吃掉。
     */
    function PromptEditor(props) {
      const { shot, prompt, busy, actions } = props
      const text = prompt && prompt.text ? prompt.text : ''
      const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } },
        h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center' } },
          h('button', { className: 'dd-btn sm', disabled: busy, onClick: () => actions.compileShot(shot.id, true) }, '校验过期'),
          h('button', { className: 'dd-btn sm', disabled: busy, onClick: () => actions.compileShot(shot.id, false) }, '重新编译'),
          prompt && prompt.overridden
            ? h('button', {
              className: 'dd-btn sm danger', disabled: busy,
              title: '丢弃手工改写，重新按真源编译',
              onClick: () => actions.resetPrompt(shot.id),
            }, '丢弃手工改写')
            : null,
          h('span', { className: 'dd-spacer' }),
          h('span', { className: 'dd-note' }, words ? words + ' 词' : '无产物'),
          prompt && prompt.stale ? h('span', { className: 'dd-badge warn' }, '已过期') : null,
          prompt && prompt.overridden ? h('span', { className: 'dd-badge' }, '手工改写') : null,
        ),
        prompt && prompt.overridden
          ? h('div', { className: 'dd-okbox' }, '这一镜的提示词有人工改写。重新编译会保留你的版本；要回到自动生成，点「丢弃手工改写」。')
          : null,
        text !== ''
          ? h(Editable, {
            label: '提示词',
            labelTitle: '这一镜的提示词产物（可改；重新编译会保留你的版本）',
            value: text,
            multiline: true,
            mono: true,
            markdown: false,
            disabled: busy,
            onSave: value => actions.savePrompt(shot.id, value),
          })
          : h('div', { className: 'dd-note' }, '还没有提示词产物。点「重新编译」按真源生成。'),
      )
    }
