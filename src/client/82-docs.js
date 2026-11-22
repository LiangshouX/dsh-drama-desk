    /** Render a parsed markdown section tree. */
    function DocView(props) {
      return h('div', { className: 'dd-doc' },
        (props.sections || []).map((section, index) => h('div', { key: index },
          h('h4', null, section.heading),
          section.body ? h(MarkdownLite, { text: section.body }) : null,
          section.children && section.children.length > 0
            ? h('div', { style: { paddingLeft: '14px', borderLeft: '.5px solid var(--line)' } }, h(DocView, { sections: section.children }))
            : null,
        )),
      )
    }

    /**
     * 行内标记：`code` / **粗体** / *斜体*。
     *
     * 返回的是**元素数组**（不是字符串），所以 React 能正确地渲染它。
     *
     * @param {string} text 一行纯文本
     * @returns {Array<string|object>}
     */
    function mdInline(text) {
      const source = String(text ?? '')
      const pieces = []
      const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*)/g
      let last = 0
      let key = 0
      let match
      while ((match = pattern.exec(source)) !== null) {
        if (match.index > last) pieces.push(source.slice(last, match.index))
        const token = match[0]
        if (token.startsWith('`')) {
          pieces.push(h('code', { key: 'i' + (key++), className: 'md-code' }, token.slice(1, -1)))
        } else if (token.startsWith('**') || token.startsWith('__')) {
          pieces.push(h('strong', { key: 'i' + (key++), className: 'md-strong' }, token.slice(2, -2)))
        } else {
          pieces.push(h('em', { key: 'i' + (key++), className: 'md-em' }, token.slice(1, -1)))
        }
        last = match.index + token.length
      }
      if (last < source.length) pieces.push(source.slice(last))
      return pieces
    }

    /**
     * 一个 markdown 渲染器：小，但**够读**。
     *
     * 够读的意思是：标题、段落、列表（含**折行续接**）、有序列表、引用、
     * 表格、代码块、分隔线，以及行内的 `code` / **粗体** / *斜体*。
     *
     * 「列表项折行」这一条是照着《文本编辑组件最佳实践》来的：说明类文本里
     * 一条 bullet 经常被手工折成两行（第二行缩进两个空格）。不接上的话，
     * 它会被渲染成一段独立的段落——读起来像「这条 bullet 后面跟了一句无关的话」。
     *
     * @param {{text?: string}} props
     */
    function MarkdownLite(props) {
      const lines = String(props.text ?? '').split(/\r?\n/)
      const blocks = []
      let i = 0
      /** 上一块是不是列表——用来接住被折行的续行。 */
      let listOpen = false

      while (i < lines.length) {
        const line = lines[i]

        // 空行
        if (line.trim() === '') { listOpen = false; i++; continue }

        // 代码块
        if (/^\s*```/.test(line)) {
          listOpen = false
          const code = []
          i++
          while (i < lines.length && !/^\s*```/.test(lines[i])) { code.push(lines[i]); i++ }
          i++
          blocks.push(h('pre', { key: 'c' + blocks.length, className: 'md-pre' }, code.join('\n')))
          continue
        }

        // 表格
        if (/^\s*\|/.test(line)) {
          listOpen = false
          const rows = []
          while (i < lines.length && /^\s*\|/.test(lines[i])) {
            rows.push(lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim()))
            i++
          }
          const isDivider = row => row.every(cell => /^:?-{2,}:?$/.test(cell))
          const head = rows.find(row => !isDivider(row))
          const body = rows.filter(row => row !== head && !isDivider(row))
          if (head !== undefined) {
            blocks.push(h('table', { className: 'dd-table md-table', key: 't' + blocks.length },
              h('thead', null, h('tr', null, head.map((cell, index) => h('th', { key: index }, mdInline(cell))))),
              h('tbody', null, body.map((row, index) => h('tr', { key: index },
                row.map((cell, cellIndex) => h('td', { key: cellIndex }, mdInline(cell)))))),
            ))
          }
          continue
        }

        // 分隔线
        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
          listOpen = false
          blocks.push(h('hr', { key: 'hr' + blocks.length }))
          i++
          continue
        }

        // 标题
        const heading = /^\s*(#{1,4})\s+(.*)$/.exec(line)
        if (heading !== null) {
          listOpen = false
          const level = heading[1].length
          blocks.push(h(level <= 2 ? 'h4' : 'h5', { key: 'hd' + blocks.length, className: 'md-h' }, mdInline(heading[2])))
          i++
          continue
        }

        // 引用
        if (/^\s*>\s?/.test(line)) {
          listOpen = false
          const quoted = []
          while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
            quoted.push(lines[i].replace(/^\s*>\s?/, ''))
            i++
          }
          blocks.push(h('blockquote', { key: 'q' + blocks.length, className: 'md-quote' },
            h('p', null, mdInline(quoted.join(' ')))))
          continue
        }

        // 列表（无序 / 有序）
        const bullet = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
        if (bullet !== null) {
          const ordered = /\d/.test(bullet[2])
          const items = []
          while (i < lines.length) {
            const entry = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i])
            if (entry === null) break
            items.push(entry[3])
            i++
            // **折行续接**：缩进两格以上的行是上一条的续行。
            while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
              items[items.length - 1] += ' ' + lines[i].trim()
              i++
            }
          }
          blocks.push(h(ordered ? 'ol' : 'ul', { key: 'l' + blocks.length, className: 'md-list' },
            items.map((item, index) => h('li', { key: index }, mdInline(item)))))
          listOpen = true
          continue
        }

        // 段落：连续的普通行合成一段。
        const paragraph = []
        while (i < lines.length
          && lines[i].trim() !== ''
          && !/^\s*(\||[-*+]\s|\d+[.)]\s|```|#{1,4}\s|>\s?)/.test(lines[i])) {
          paragraph.push(lines[i].trim())
          i++
        }
        listOpen = false
        if (paragraph.length === 0) { i++; continue }
        blocks.push(h('p', { key: 'p' + blocks.length, className: 'md-p' }, mdInline(paragraph.join(' '))))
      }
      void listOpen
      return h('div', { className: 'md-root' }, blocks)
    }

    // ── markdown 的排版 ──────────────────────────────────────────────────
    // 样式跟着渲染器走：读态预览、规范视图、放大窗口共用同一套排版。
    CSS_PARTS.push(`
.md-root{min-width:0}
.md-root>*:first-child{margin-top:0}
.md-root>*:last-child{margin-bottom:0}
.md-p{margin:.4em 0;font-size:12.5px;line-height:1.75;color:var(--ink2)}
.md-h{font-size:13.5px;font-weight:600;margin:.75em 0 .3em;color:var(--ink);line-height:1.4}
.md-root h5.md-h{font-size:12.5px}
.md-list{margin:.4em 0;padding-left:1.45em}
.md-list li{margin:.18em 0;font-size:12.5px;line-height:1.75;color:var(--ink2)}
.md-quote{
  border-left:2px solid var(--hot);margin:.55em 0;padding:.1em 0 .1em .75em;color:var(--ink2);
}
.md-quote p{margin:0;font-size:12.5px;line-height:1.75}
.md-pre{
  font-family:var(--f-mono);font-size:11px;line-height:1.6;background:var(--sunken);
  padding:9px 11px;border-radius:var(--rx-1);overflow:auto;margin:.55em 0;
  box-shadow:inset 0 0 0 .5px var(--line);white-space:pre;
}
.md-table{margin:.55em 0;font-size:11.5px}
.md-code{font-family:var(--f-mono);font-size:.92em;background:var(--sunken);padding:.1em .35em;border-radius:4px}
.md-strong{color:var(--ink);font-weight:600}
.md-em{color:var(--ink3)}
.md-root hr{border:0;border-top:.5px solid var(--line);margin:.8em 0}
`)
