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

    /**
     * 一块可调宽度的侧栏。
     *
     * @param {{storageKey?: string, initial?: number, min?: number, max?: number}} options
     * @returns {{width: number, full: boolean, panelRef: object, style: object, startResize: Function, toggleFull: Function, onCloseFull: Function}}
     */
    function usePanelWidth(options = {}) {
      const { storageKey, initial = 420, min = PANEL_MIN, max = PANEL_MAX } = options
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
      const panelRef = useRef(null)
      const dragRef = useRef(null)

      const clamp = useCallback(value => Math.min(max, Math.max(min, value)), [max, min])

      const startResize = useCallback(event => {
        event.preventDefault()
        const box = panelRef.current
        if (box === null) return
        const start = { x: event.clientX, width: box.getBoundingClientRect().width }
        dragRef.current = start

        const onMove = move => {
          const from = dragRef.current
          if (from === null) return
          // 右侧栏的把手在**左**边：往左拖 = 变宽。
          const next = clamp(from.width - (move.clientX - from.x))
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
          if (from === null) return
          const final = clamp(Number.parseFloat(box.style.width) || from.width)
          box.style.width = ''
          box.style.maxWidth = ''
          setWidth(final)
          if (typeof storageKey === 'string') {
            try { window.localStorage.setItem(storageKey, String(final)) } catch { /* 存不下就算了 */ }
          }
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
      }, [clamp, storageKey])

      const toggleFull = useCallback(() => setFull(value => !value), [])

      const style = full
        ? undefined
        : { width: width + 'px', maxWidth: width + 'px' }

      return { width, full, panelRef, style, startResize, toggleFull }
    }

    // ── 侧栏的样式 ────────────────────────────────────────────────────────
    CSS_PARTS.push(`
/* ── 可调宽度的侧栏 ───────────────────────────────────────────────────── */
.dd-side{position:relative;flex:0 0 auto;display:flex;flex-direction:column;min-height:0;overflow:hidden;
  /* 宽度由 usePanelWidth 写成行内值；给个兜底下限，
     免得某次渲染丢了行内宽度就把侧栏压扁（320 = PANEL_MIN）。 */
  min-width:320px;
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
/* 把手：左边缘一条 7px 的热区，视觉上是一条发丝线。 */
.dd-side-resize{
  position:absolute;left:-3px;top:0;bottom:0;width:7px;z-index:21;cursor:col-resize;
  display:flex;align-items:center;justify-content:center;
}
.dd-side-resize::after{
  content:'';width:2px;height:26px;border-radius:2px;background:var(--line-2);
  transition:background var(--t-fast) var(--ease),height var(--t-fast) var(--ease);
}
.dd-side-resize:hover::after{background:var(--hot-line);height:44px}
.dd-side-resize:focus-visible::after{background:var(--hot);height:44px}
/* 全屏时没有把手——它已经占满整块工作台了。 */
.dd-side.full .dd-side-resize{display:none}
/* 宽度读数：拖动时挂在把手上。 */
.dd-side-size{
  position:absolute;left:6px;top:8px;z-index:22;pointer-events:none;
  font-family:var(--f-mono);font-size:10px;color:var(--ink3);
  padding:2px 6px;border-radius:var(--rx-1);background:var(--sunken);
  box-shadow:inset 0 0 0 .5px var(--line);white-space:nowrap;
}
`)
