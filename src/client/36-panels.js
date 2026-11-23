    // ── 侧栏：宽度可调 ────────────────────────────────────────────────────
    //
    // 右侧栏（镜详情 / 构思会话）以前是**固定宽度**的（`clamp()`），
    // 局促的时候看不全，又没法调。
    //
    // 现在：拖左边缘改宽度，有**最小宽度**与**最大宽度**；拖到最大还不够看时，
    // 可以**全屏**——不是占满浏览器，而是占满**导演工作台**这一块。
    //
    // 性能：拖动时**直写 DOM 的 width**，React 状态每帧至多提交一次。
    // 否则每挪一像素都要重渲染整棵面板树（72 个镜头卡片销毁重建）——
    // 插件是嵌在别人的主应用里的，这种开销用户会直接归咎于 DSH。

    /** 侧栏宽度的最小/最大值。 */
    const PANEL_MIN = 320
    const PANEL_MAX = 1200
    /** 拖动时至少还给主区留这么多，否则侧栏能把内容挤没。 */
    const PANEL_KEEP = 360

    /** Measure the plugin itself: the host sidebar can consume much of the viewport. */
    function useDeskWidth(rootRef) {
      const [available, setAvailable] = useState(1200)
      useEffect(() => {
        const element = rootRef.current
        if (!element) return undefined
        const measure = () => setAvailable(Math.round(element.getBoundingClientRect().width))
        measure()
        if (typeof ResizeObserver === 'undefined') {
          window.addEventListener('resize', measure)
          return () => window.removeEventListener('resize', measure)
        }
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
      }, [rootRef])
      return available
    }

    /**
     * 一块可调宽度的侧栏。
     *
     * @param {{storageKey?: string, initial?: number, min?: number, max?: number, label?: string}} options
     */
    function usePanelWidth(options = {}) {
      const { storageKey, initial = 420, min = PANEL_MIN, max = PANEL_MAX, label = '侧栏' } = options
      const [width, setWidth] = useState(() => {
        if (typeof storageKey === 'string') {
          try {
            const stored = Number(window.localStorage.getItem(storageKey))
            if (Number.isFinite(stored) && stored >= min && stored <= max) return stored
          } catch { /* localStorage 不可用就用默认值 */ }
        }
        return initial
      })
      const [full, setFull] = useState(false)
      /** 拖动中：只给读数用（读数条要亮起来）。 */
      const [dragging, setDragging] = useState(false)
      const panelRef = useRef(null)
      const dragRef = useRef(null)
      const widthRef = useRef(width)
      widthRef.current = width
      const fullRef = useRef(full)
      fullRef.current = full

      const clamp = useCallback(value => Math.min(max, Math.max(min, value)), [max, min])

      /**
       * 这次拖动实际能到多宽。
       *
       * 上限不能只看常量：侧栏是 flex 子项，父容器的宽度才是硬边界。
       * 以前只按 `PANEL_MAX` 钳位，窗口窄的时候能拖到把主区挤成负宽度。
       */
      const limit = useCallback(() => {
        const box = panelRef.current
        const parent = box === null ? null : box.parentElement
        const available = parent === null ? window.innerWidth : parent.getBoundingClientRect().width
        const reserved = parent === null ? 0 : Array.from(parent.children)
          .filter(child => child !== box && (child.classList.contains('dd-side') || child.classList.contains('dd-nav'))
            && !child.classList.contains('full') && !child.classList.contains('overlay'))
          .reduce((sum, child) => sum + child.getBoundingClientRect().width, 0)
        return Math.max(min, Math.min(max, Math.round(available - reserved - PANEL_KEEP)))
      }, [max, min])

      const remember = useCallback(value => {
        if (typeof storageKey !== 'string') return
        try { window.localStorage.setItem(storageKey, String(value)) } catch { /* 存不下就算了 */ }
      }, [storageKey])

      const startResize = useCallback(event => {
        event.preventDefault()
        const box = panelRef.current
        if (box === null) return
        const start = { x: event.clientX, width: box.getBoundingClientRect().width }
        dragRef.current = start
        const hardMax = limit()
        setDragging(true)
        try {
          if (typeof box.setPointerCapture === 'function' && typeof event.pointerId === 'number') {
            box.setPointerCapture(event.pointerId)
          }
        } catch { /* 指针已经没了 */ }

        const onMove = move => {
          const from = dragRef.current
          if (from === null) return
          // 右侧栏的把手在**左**边：往左拖 = 变宽。
          const next = Math.min(hardMax, Math.max(min, Math.round(from.width - (move.clientX - from.x))))
          // 直写 DOM：这一帧就动，不等 React。
          box.style.width = next + 'px'
          box.style.maxWidth = next + 'px'
        }
        const onUp = () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
          const from = dragRef.current
          dragRef.current = null
          setDragging(false)
          if (from === null) return
          const final = Math.min(hardMax, Math.max(min,
            Number.parseFloat(box.style.width) || from.width))
          box.style.width = ''
          box.style.maxWidth = ''
          setWidth(final)
          remember(final)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
      }, [limit, min, remember])

      /**
       * 键盘调宽。
       *
       * 把手是 `role="separator"`：它是**控件**，不是装饰。以前它只能拖，
       * 于是用键盘的人完全够不到「把侧栏放宽」这件事。
       */
      const nudge = useCallback(delta => {
        const next = clamp(widthRef.current + delta)
        setWidth(next)
        remember(next)
      }, [clamp, remember])

      /** 双击把手 = 回到默认宽度（每条侧栏各自的 `initial`）。 */
      const resetWidth = useCallback(() => {
        setWidth(initial)
        remember(initial)
      }, [initial, remember])

      const toggleFull = useCallback(() => setFull(value => !value), [])
      const exitFull = useCallback(() => setFull(false), [])

      // 全屏时 Esc 退出。全屏把导航也盖住了，必须有一条**不用找按钮**的退路。
      useEffect(() => {
        if (!full) return undefined
        const onKey = event => {
          if (event.key !== 'Escape') return
          // 别的浮层（放大编辑窗口 / 图片查看器）自己会处理 Esc：它们开着时不要抢。
          if (document.querySelector('.dd-tf-overlay,.dd-modal-backdrop') !== null) return
          event.stopPropagation()
          setFull(false)
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [full])

      const style = full
        ? undefined
        : { width: Math.min(width, options.maxAvailable ?? width) + 'px', maxWidth: Math.min(width, options.maxAvailable ?? width) + 'px' }

      const resizeProps = full
        ? {}
        : {
          onPointerDown: startResize,
          onDoubleClick: resetWidth,
          onKeyDown: event => {
            if (event.key === 'ArrowLeft') { event.preventDefault(); nudge(event.shiftKey ? 80 : 20) }
            else if (event.key === 'ArrowRight') { event.preventDefault(); nudge(event.shiftKey ? -80 : -20) }
            else if (event.key === 'Home') { event.preventDefault(); nudge(-max) }
            else if (event.key === 'End') { event.preventDefault(); nudge(max) }
          },
          role: 'separator',
          tabIndex: 0,
          'aria-label': '调整' + label + '宽度',
          'aria-orientation': 'vertical',
          'aria-valuenow': width,
          'aria-valuemin': min,
          'aria-valuemax': max,
          title: '拖动改宽度（双击回到默认；方向键微调）· ' + width + 'px',
        }

      return {
        width, full, dragging, panelRef, style, min, max,
        startResize, toggleFull, exitFull, resizeProps,
      }
    }

    // ── 侧栏的样式 ────────────────────────────────────────────────────────
    CSS_PARTS.push(`
/* ── 可调宽度的侧栏 ───────────────────────────────────────────────────── */
.dd-side{position:relative;flex:0 0 auto;display:flex;flex-direction:column;min-height:0;overflow:hidden;
  /* 宽度由 usePanelWidth 写成行内值；给个兜底下限，
     免得某次渲染丢了行内宽度就把侧栏压扁（320 = PANEL_MIN）。 */
  min-width:320px;
  transition:box-shadow var(--t-fast) var(--ease);
}
.dd-side>.dd-inspector,.dd-side>.dd-chat{
  width:100%;max-width:none;min-width:0;
  /* **这里必须把 flex 改回 1 1 auto。**
     基类的 .dd-chat / .dd-inspector 带着 flex:0 0 auto —— 那是给
     **行**向 flex 用的（管的是宽度）。侧栏现在是**列**向 flex 的子项，
     同一个声明落到**高度**上，于是它**不许收缩**：消息流被撑到内容高度、
     自己的 overflow:auto 永远用不上，输入框被顶到视口外面去。
     （这是本轮把侧栏包进 .dd-side 时踩的坑，实机才看得出来。）
  */
  flex:1 1 auto;min-height:0;overflow:hidden;
}
.dd-side.full{
  position:absolute;inset:0;width:auto;max-width:none;z-index:6;
  box-shadow:0 0 0 1px var(--line),var(--e-4);
}
.dd-side.overlay{position:absolute;inset:0 0 0 auto;z-index:5;width:min(100%,460px)!important;max-width:100%!important;min-width:0;
  background:var(--bg);box-shadow:var(--e-pop);border-left:1px solid var(--line)}
.dd-side.overlay .dd-side-resize{display:none}
/* 把手：左边缘一条 9px 的热区，视觉上是一条发丝线。
   热区要比发丝线宽得多——抓一条 2px 的线是件很累的事。 */
.dd-side-resize{
  position:absolute;left:-4px;top:0;bottom:0;width:9px;z-index:21;cursor:col-resize;
  display:flex;align-items:center;justify-content:center;
  outline:none;
}
.dd-side-resize::after{
  content:'';width:2px;height:26px;border-radius:2px;background:var(--line-2);
  transition:background var(--t-fast) var(--ease),height var(--t-fast) var(--ease);
}
.dd-side-resize:hover::after{background:var(--hot-line);height:44px}
.dd-side-resize:focus-visible::after{background:var(--hot);height:44px}
/* 拖动中：把手整条亮起来，明确「现在在改宽度」。 */
.dd-side[data-resizing='true'] .dd-side-resize::after{background:var(--hot);height:64px}
.dd-side[data-resizing='true']{box-shadow:inset 1px 0 0 var(--hot-line)}
/* 全屏时没有把手——它已经占满整块工作台了。 */
.dd-side.full .dd-side-resize{display:none}
/* 宽度读数：拖动时挂在把手上。 */
.dd-side-size{
  position:absolute;left:8px;top:8px;z-index:22;pointer-events:none;
  font-family:var(--f-mono);font-size:10px;color:var(--ink);
  padding:2px 6px;border-radius:var(--rx-1);background:var(--raised);
  box-shadow:inset 0 0 0 .5px var(--line-2),var(--e-1);white-space:nowrap;
}
`)
