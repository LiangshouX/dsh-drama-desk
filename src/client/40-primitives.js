    // ── helpers ────────────────────────────────────────────────────────────

    const STATUS_TEXT = {
      none: '未生成',
      generated: '未体检',
      warn: 'WARN',
      fail: 'FAIL',
      pass: '通过',
    }

    /**
     * 一格镜头的**信号灯**。
     *
     * 这里其实有两套词，混在一起界面就成了乱的：
     *
     *  · **生产状态**（真源）：pending / submitted / succeeded / failed /
     *    verified / deprecated —— 这一镜到底做出来没有。
     *  · **体检判定**（体检器）：PASS / WARN / FAIL —— 这一镜拍得好不好。
     *
     * 灯的颜色跟**判定**走（导播台的颜色就是判定），生产状态只决定
     * 「还没拍」还是「拍了还没验」。两者分开，格子才不会说谎。
     */
    function shotSignal(shot) {
      const verdict = shot && shot.qc && shot.qc.verdict
        ? String(shot.qc.verdict).toUpperCase()
        : ''
      const status = String((shot && shot.status) || '')
      if (verdict === 'FAIL') return { key: 'fail', label: 'FAIL' }
      if (verdict === 'WARN') return { key: 'warn', label: 'WARN' }
      if (verdict === 'PASS') return { key: 'pass', label: '通过' }
      if (status === 'failed') return { key: 'fail', label: '生成失败' }
      if (status === 'deprecated') return { key: 'none', label: '已作废' }
      if (status === 'submitted') return { key: 'generated', label: '生成中' }
      if (status === 'succeeded' || status === 'verified') return { key: 'generated', label: '未体检' }
      return { key: 'none', label: '未生成' }
    }

    function formatBytes(bytes) {
      if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '—'
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
      return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
    }

    function formatNumber(value, digits) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      return value.toFixed(digits === undefined ? 3 : digits)
    }

    function formatTime(value) {
      if (typeof value !== 'string' || value === '') return '—'
      return value.replace('T', ' ').replace('Z', '')
    }

    /** 钱：预算与花费都是美元，两位小数就够（单镜 0.08–0.88）。 */
    function formatUsd(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      return '$' + (Math.round(value * 100) / 100).toFixed(2)
    }

    /** 时长：秒 → 「38 秒 / 12 分 / 1 小时 32 分」。给人读的时间，不是毫秒。 */
    function formatSeconds(seconds) {
      if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '—'
      const total = Math.round(seconds)
      if (total < 60) return total + ' 秒'
      const minutes = Math.round(total / 60)
      if (minutes < 60) return minutes + ' 分'
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      return hours + ' 小时' + (rest > 0 ? ' ' + rest + ' 分' : '')
    }

    /** Small inline glyph set — 24×24 grid, stroke 1.6, round caps (host convention). */
    function Icon(props) {
      const size = props.size ?? 16
      const paths = {
        grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
        spec: 'M6 3h9l3 3v15H6zM14 3v4h4M9 12h6M9 16h4',
        asset: 'M4 5h16v14H4zM4 16l5-4.5 4 3.5 3-2.5 4 3.5M16 9.5a1 1 0 1 0 0 .01',
        ledger: 'M5 3h10v18H5zM8 7h4M8 11h4M8 15h4M18 8h-1M18 12h-1M18 16h-1',
        project: 'M3 5h6l2 2h10v12H3z',
        refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
        settings: 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
        close: 'M6 6l12 12M18 6L6 18',
        chevron: 'M9 5l7 7-7 7',
        chevLeft: 'M15 5l-7 7 7 7',
        note: 'M4 4h16v11H9l-5 4z',
        film: 'M3 4h18v16H3zM7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4',
        play: 'M8 5.5v13l11-6.5z',
        plus: 'M12 5v14M5 12h14',
        trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
        up: 'M12 19V5M6 11l6-6 6 6',
        down: 'M12 5v14M6 13l6 6 6-6',
        folder: 'M3 6h6l2 2h10v12H3z',
        check: 'M4 12.5l5 5L20 6.5',
        eye: 'M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
        copy: 'M8 8h11v12H8zM5 16V4h11',
        star: 'M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.9l6-.8z',
        back: 'M20 12H4M10 6l-6 6 6 6',
        // 「放大编辑」：四角张开的取景框——比「放大镜」更直白地说是放大。
        expand: 'M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5',
        // 铅笔：编辑入口。它比「修改」两个字更安静，也比「点我」更明确。
        edit: 'M4 20l1-4.5L15.5 5 19 8.5 8.5 12 4 4zM13.5 7l3.5 3.5',
      }
      const d = paths[props.name] ?? paths.grid
      const filled = props.name === 'play' || props.name === 'star'
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24',
        fill: filled ? 'currentColor' : 'none',
        stroke: filled ? 'none' : 'currentColor',
        strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
        xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true,
        style: { display: 'block', pointerEvents: 'none' },
      }, [
        h('path', { key: 'p', d }),
      ])
    }

    // ── 品牌标记：胶片三格 ───────────────────────────────────────────────
    //
    // 一条胶片：厚片身、顶边四枚片孔、中间三个画格——
    // **中间那格亮着琥珀色**，正是正在产的那一镜。
    //
    // 这套几何与 `icon.svg`（插件列表里那张）**同源**：三处（插件管理器 /
    // 侧栏 / 工作台顶栏）共用同一个标志，不各画各的。
    //
    //   冷蓝 = 片身        暖琥珀 = 正在产的那一格
    //
    // 镂空（片孔、两头的画格）用 **evenodd 子路径**一次画完：
    // 插件管理器把 icon.svg 当 <img> 渲染，那条路上 mask 不保险。

    const FILM_STRIP = 'M11.00 10.00H53.00A8 8 0 0 1 61.00 18.00V46.00A8 8 0 0 1 53.00 54.00H11.00A8 8 0 0 1 3.00 46.00V18.00A8 8 0 0 1 11.00 10.00Z'
      + ' M10.00 15.00H15.00A2 2 0 0 1 17.00 17.00V21.00A2 2 0 0 1 15.00 23.00H10.00A2 2 0 0 1 8.00 21.00V17.00A2 2 0 0 1 10.00 15.00Z'
      + ' M23.00 15.00H28.00A2 2 0 0 1 30.00 17.00V21.00A2 2 0 0 1 28.00 23.00H23.00A2 2 0 0 1 21.00 21.00V17.00A2 2 0 0 1 23.00 15.00Z'
      + ' M36.00 15.00H41.00A2 2 0 0 1 43.00 17.00V21.00A2 2 0 0 1 41.00 23.00H36.00A2 2 0 0 1 34.00 21.00V17.00A2 2 0 0 1 36.00 15.00Z'
      + ' M49.00 15.00H54.00A2 2 0 0 1 56.00 17.00V21.00A2 2 0 0 1 54.00 23.00H49.00A2 2 0 0 1 47.00 21.00V17.00A2 2 0 0 1 49.00 15.00Z'
      + ' M10.00 28.00H18.00A3 3 0 0 1 21.00 31.00V43.00A3 3 0 0 1 18.00 46.00H10.00A3 3 0 0 1 7.00 43.00V31.00A3 3 0 0 1 10.00 28.00Z'
      + ' M46.00 28.00H54.00A3 3 0 0 1 57.00 31.00V43.00A3 3 0 0 1 54.00 46.00H46.00A3 3 0 0 1 43.00 43.00V31.00A3 3 0 0 1 46.00 28.00Z'

    const FILM_FRAME = 'M28.00 28.00H36.00A3 3 0 0 1 39.00 31.00V43.00A3 3 0 0 1 36.00 46.00H28.00A3 3 0 0 1 25.00 43.00V31.00A3 3 0 0 1 28.00 28.00Z'

    /* 侧栏的小尺寸减法：同一条片上的**那三格**——两头空心，中间实心。
       16px 下胶片的片孔会糊掉，所以减法砍到「三格 + 哪一格在产」，
       重量也和邻居（1.6 线描）对得上。 */

    const FILM_GRID_L = 'M8.00 22.00H16.00A4 4 0 0 1 20.00 26.00V36.00A4 4 0 0 1 16.00 40.00H8.00A4 4 0 0 1 4.00 36.00V26.00A4 4 0 0 1 8.00 22.00Z'

    const FILM_GRID_M = 'M28.00 22.00H36.00A4 4 0 0 1 40.00 26.00V36.00A4 4 0 0 1 36.00 40.00H28.00A4 4 0 0 1 24.00 36.00V26.00A4 4 0 0 1 28.00 22.00Z'

    const FILM_GRID_R = 'M48.00 22.00H56.00A4 4 0 0 1 60.00 26.00V36.00A4 4 0 0 1 56.00 40.00H48.00A4 4 0 0 1 44.00 36.00V26.00A4 4 0 0 1 48.00 22.00Z'

    /** 品牌标记（64 网格）——顶栏的「导演工作台」标识：整条胶片。 */
    function DramaDeskMark(props) {
      const size = props.size ?? 22
      return h('svg', {
        width: size, height: size, viewBox: '0 0 64 64',
        xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true,
        style: { display: 'block', pointerEvents: 'none' },
      }, [
        h('path', { key: 'strip', d: FILM_STRIP, fill: 'var(--brand-blue)', fillRule: 'evenodd' }),
        h('path', { key: 'lit', d: FILM_FRAME, fill: 'var(--brand-amber)' }),
      ])
    }

    // ── small pieces ───────────────────────────────────────────────────────

    function Section(props) {
      const [open, setOpen] = useState(props.defaultOpen === true)
      return h('div', { className: 'dd-sec' },
        h('div', { className: 'dd-sec-head', onClick: () => setOpen(!open) },
          h('span', { className: 't' }, props.title),
          props.tag ? h('span', { className: 'dd-tag ' + (props.tagKind || '') }, props.tag) : null,
          h('span', { className: 'sp' }),
          props.badge ? h('span', { className: 'dd-badge' }, props.badge) : null,
          h('span', { style: { color: 'var(--ink4)', fontSize: '10px', transform: 'rotate(' + (open ? 90 : 0) + 'deg)', transition: 'transform 180ms cubic-bezier(.2,0,0,1)' } },
            h(Icon, { name: 'chevron', size: 12 })),
        ),
        open ? h('div', { className: 'dd-sec-body' }, props.children) : null,
      )
    }

    function MetricRow(props) {
      return h('div', { className: 'dd-metric' },
        h('span', { className: 'n' }, props.name),
        h('span', { className: 'v', style: { color: props.failed ? 'var(--danger)' : 'var(--ink)' } }, props.value),
        h('span', { className: 'th' }, props.threshold),
      )
    }
