    // ── image viewer（可缩放 · 可拖动 · 跟手）─────────────────────────────
    //
    // 这一层只做三件事：**测量**（图片多大、视口多大）、**事件**（滚轮 / 拖拽）、
    // **渲染**。算术全在 `84-viewer-zoom.js`（纯函数）。
    //
    // 几条不能省的：
    //  · 尺寸用 `ResizeObserver` 读，**不用 `load` 事件**——缓存命中时 `load`
    //    不再触发，尺寸停在 0，拖拽范围被钉死。
    //  · 缩放只改 `transform`，**不改 width/height**（否则与 ResizeObserver
    //    互相触发）。
    //  · 必须**拒绝浏览器的原生图片拖拽**（Chromium 会吞掉 move 事件）。
    //  · 拖动时**直写 DOM 的 transform**，React 状态每帧至多提交一次——
    //    否则「不跟手」。

    /** 图片预览的样式（跟着组件走）。 */
    CSS_PARTS.push(`
.dd-zoom-stage{
  flex:1 1 auto;min-height:120px;overflow:hidden;position:relative;
  cursor:grab;touch-action:none;user-select:none;
  display:flex;align-items:center;justify-content:center;background:var(--sunken);
}
.dd-zoom-stage.dragging{cursor:grabbing}
.dd-zoom-stage img{
  max-width:100%;max-height:100%;display:block;user-select:none;-webkit-user-drag:none;
  transform-origin:center center;will-change:transform;
}
.dd-zoom-readout{
  font-family:var(--f-mono);font-size:10.5px;color:var(--ink3);
  padding:2px 7px;border-radius:var(--rx-1);background:var(--sunken);
  box-shadow:inset 0 0 0 .5px var(--line);
}
.dd-zoom-hint{
  position:absolute;left:50%;bottom:10px;transform:translateX(-50%);
  font-size:10.5px;color:var(--ink4);pointer-events:none;white-space:nowrap;
}
`)

    function ImageViewer(props) {
      const { asset, src, onClose } = props
      const surfaceRef = useRef(null)
      const imgRef = useRef(null)
      const [zoom, setZoom] = useState(1)
      const [pan, setPan] = useState({ x: 0, y: 0 })
      const [natural, setNatural] = useState({ width: 0, height: 0 })
      /** 拖拽起点（**只读**：它持有开始那一刻的 pan 与指针）。 */
      const dragRef = useRef(null)
      /** 最新视图状态的引用：拖拽过程中读它，不等 React 重渲染。 */
      const viewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 }, natural: { width: 0, height: 0 } })
      viewRef.current = { zoom, pan, natural }
      /** 拖动时直写 DOM 的 transform；这一帧就动。 */
      const paintRef = useRef(null)
      const frameRef = useRef(0)

      /** 视口尺寸（surface 的客户区）。 */
      const viewport = useCallback(() => {
        const box = surfaceRef.current
        if (box === null) return { width: 0, height: 0 }
        return { width: box.clientWidth, height: box.clientHeight }
      }, [])

      /** 把当前视图写进 DOM（拖动时每帧都调）。 */
      const paint = useCallback((nextZoom, nextPan) => {
        const img = imgRef.current
        if (img === null) return
        img.style.transform = 'translate(' + nextPan.x + 'px,' + nextPan.y + 'px) scale(' + nextZoom + ')'
      }, [])

      /**
       * 拖动时的节流提交：**每帧至多一次** React 状态更新。
       *
       * 画面靠直写 DOM 跟手；状态只是给读数与松手后的最终值用的。
       */
      const schedule = useCallback((nextZoom, nextPan) => {
        paint(nextZoom, nextPan)
        if (frameRef.current !== 0) return
        const commit = () => {
          frameRef.current = 0
          setZoom(nextZoom)
          setPan(nextPan)
        }
        if (typeof requestAnimationFrame === 'function') frameRef.current = requestAnimationFrame(commit)
        else commit()
      }, [paint])

      /** 适应窗口。 */
      const applyFit = useCallback(() => {
        const size = viewRef.current.natural
        const box = viewport()
        const next = fitZoom(size, box)
        const clamped = clampPan({ x: 0, y: 0 }, next, size, box)
        setZoom(next)
        setPan(clamped)
        paint(next, clamped)
      }, [paint, viewport])

      /**
       * 尺寸：`ResizeObserver` 观察**图片自己**。
       *
       * 不用 `load` 事件——缓存命中时它不再触发，尺寸会是 0，拖拽恒死。
       * 观察表面（而不是图片）报的是视口尺寸，不是图片尺寸。
       */
      useEffect(() => {
        const img = imgRef.current
        if (img === null) return undefined
        const measure = () => {
          const width = img.naturalWidth || img.width || 0
          const height = img.naturalHeight || img.height || 0
          if (width === 0 || height === 0) return
          const current = viewRef.current
          if (current.natural.width === width && current.natural.height === height) return
          setNatural({ width, height })
          // 第一次量到尺寸 → 适应窗口。
          if (current.natural.width === 0) {
            const box = viewport()
            const next = fitZoom({ width, height }, box)
            setZoom(next)
            setPan({ x: 0, y: 0 })
          }
        }
        measure()
        if (typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(measure)
        observer.observe(img)
        return () => observer.disconnect()
      }, [viewport])

      /** 视口尺寸变了 → 重新钳一次（图片不许跑出视野）。 */
      useEffect(() => {
        const box = surfaceRef.current
        if (box === null || typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(() => {
          const current = viewRef.current
          const clamped = clampPan(current.pan, current.zoom, current.natural, viewport())
          if (clamped.x !== current.pan.x || clamped.y !== current.pan.y) {
            setPan(clamped)
            paint(current.zoom, clamped)
          }
        })
        observer.observe(box)
        return () => observer.disconnect()
      }, [paint, viewport])

      /** 以某个点为锚缩放。 */
      const zoomAt = useCallback((factor, clientX, clientY) => {
        const current = viewRef.current
        const box = surfaceRef.current
        let point = { x: 0, y: 0 }
        if (box !== null && clientX !== undefined && clientY !== undefined) {
          const rect = box.getBoundingClientRect()
          // 锚点换算到「相对视口中心」——pan 的坐标系是中心相对的。
          point = {
            x: clientX - rect.left - rect.width / 2,
            y: clientY - rect.top - rect.height / 2,
          }
        }
        const next = zoomAroundPoint(current.zoom, current.pan, point, factor)
        const clamped = clampPan(next.pan, next.zoom, current.natural, viewport())
        setZoom(next.zoom)
        setPan(clamped)
        paint(next.zoom, clamped)
      }, [paint, viewport])

      /** 滚轮缩放：必须 `passive:false`，否则 `preventDefault` 无效、页面跟着滚。 */
      useEffect(() => {
        const box = surfaceRef.current
        if (box === null) return undefined
        const onWheel = event => {
          event.preventDefault()
          zoomAt(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, event.clientX, event.clientY)
        }
        box.addEventListener('wheel', onWheel, { passive: false })
        return () => box.removeEventListener('wheel', onWheel)
      }, [zoomAt])

      /**
       * 拖动。
       *
       * `pointer` 与 `mouse` **双挂**：某些宿主吞掉其中一套。
       * 双挂不会出错——pan 是**绝对式**的，同一个物理位移算两次结果一样。
       *
       * `move` / `up` 绑在 `window` 上：指针移出图片就会丢事件源，拖拽半途断掉。
       */
      useEffect(() => {
        const box = surfaceRef.current
        if (box === null) return undefined

        const onDown = event => {
          if (event.button !== 0) return
          const current = viewRef.current
          dragRef.current = beginDrag({ x: event.clientX, y: event.clientY }, current.pan)
          box.classList.add('dragging')
        }
        const onMove = event => {
          const drag = dragRef.current
          if (drag === null) return
          const current = viewRef.current
          const raw = dragPan(drag, { x: event.clientX, y: event.clientY })
          const clamped = clampPan(raw, current.zoom, current.natural, viewport())
          schedule(current.zoom, clamped)
        }
        const onUp = () => {
          if (dragRef.current === null) return
          dragRef.current = null
          box.classList.remove('dragging')
          // 拖动结束：把最终值提交进 state，并把读数同步到画面。
          const current = viewRef.current
          const clamped = clampPan(current.pan, current.zoom, current.natural, viewport())
          setPan(clamped)
          paint(current.zoom, clamped)
        }

        box.addEventListener('pointerdown', onDown)
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
        box.addEventListener('mousedown', onDown)
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)

        return () => {
          box.removeEventListener('pointerdown', onDown)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
          box.removeEventListener('mousedown', onDown)
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }
      }, [paint, schedule, viewport])

      /** 键盘：Esc 关闭、方向键平移、+/- 缩放。 */
      useEffect(() => {
        const onKey = event => {
          if (event.key === 'Escape') { event.stopPropagation(); onClose(); return }
          const step = event.shiftKey ? 120 : 60
          const current = viewRef.current
          if (event.key === 'ArrowLeft') { event.preventDefault(); setPan(clampPan({ x: current.pan.x - step, y: current.pan.y }, current.zoom, current.natural, viewport())) }
          else if (event.key === 'ArrowRight') { event.preventDefault(); setPan(clampPan({ x: current.pan.x + step, y: current.pan.y }, current.zoom, current.natural, viewport())) }
          else if (event.key === 'ArrowUp') { event.preventDefault(); setPan(clampPan({ x: current.pan.x, y: current.pan.y - step }, current.zoom, current.natural, viewport())) }
          else if (event.key === 'ArrowDown') { event.preventDefault(); setPan(clampPan({ x: current.pan.x, y: current.pan.y + step }, current.zoom, current.natural, viewport())) }
          else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(ZOOM_STEP) }
          else if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomAt(1 / ZOOM_STEP) }
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [onClose, viewport, zoomAt])

      const item = asset || {}
      const readout = natural.width
        ? natural.width + '×' + natural.height + ' · ' + zoomPercent(zoom) + ' · ' + Math.round(pan.x) + ', ' + Math.round(pan.y)
        : '读取中…'

      return h('div', {
        className: 'dd-modal-backdrop',
        onMouseDown: event => { if (event.target === event.currentTarget) onClose() },
      },
        h('div', { className: 'dd-modal', role: 'dialog', 'aria-modal': 'true' },
          h('div', { className: 'dd-modal-head' },
            h(Icon, { name: 'eye', size: 14 }),
            h('span', { className: 'num', style: { fontSize: '12.5px' } }, item.id || ''),
            h('span', { className: 'dd-spacer' }),
            // 读数既是用户反馈，也是**实机验收的读数**（缩放% · 位移）。
            h('span', { className: 'dd-zoom-readout', title: readout }, readout),
            h('button', { className: 'dd-btn sm', onClick: applyFit, title: '缩放到刚好放得下' }, t('action.fit', '适应窗口')),
            h('button', {
              className: 'dd-btn sm',
              title: '按原始像素显示',
              onClick: () => {
                const current = viewRef.current
                const clamped = clampPan({ x: 0, y: 0 }, 1, current.natural, viewport())
                setZoom(1)
                setPan(clamped)
                paint(1, clamped)
              },
            }, t('action.actualSize', '1:1')),
            h('button', { className: 'dd-icon-btn', onClick: onClose, title: t('action.close', '关闭') },
              h(Icon, { name: 'close', size: 13 })),
          ),
          h('div', {
            className: 'dd-zoom-stage',
            ref: surfaceRef,
            title: readout,
            onDoubleClick: applyFit,
            // 拒绝浏览器的原生图片拖拽：Chromium 会吞掉 move 事件。
            onDragStart: event => event.preventDefault(),
          },
            h('img', {
              ref: imgRef,
              src: props.src,
              alt: item.id || '',
              draggable: false,
              style: { transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')' },
            }),
            h('div', { className: 'dd-zoom-hint' }, '滚轮缩放 · 拖动平移 · 双击适应窗口'),
          ),
          h('div', { className: 'dd-modal-foot' },
            h('span', { className: 'mf' }, '路径 ', h('b', null, item.path || '—')),
            item.source ? h('span', { className: 'mf' }, '来源 ', h('b', null, item.source)) : null,
            item.state ? h('span', { className: 'mf' }, '状态 ', h('b', null, item.state)) : null,
            item.notes ? h('span', { className: 'mf' }, '备注 ', h('b', null, item.notes)) : null,
            item.prompt
              ? h('div', { className: 'dd-modal-prompt' }, item.prompt)
              : h('span', { className: 'mf', style: { color: 'var(--ink4)' } }, '（这张图没有登记提示词）'),
          ),
        ),
      )
    }
