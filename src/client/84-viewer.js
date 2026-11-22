    // ── image viewer（可缩放 · 可拖动 · 跟手）─────────────────────────────
    //
    // 这一层只做三件事：**测量**（图片布局框多大、视口多大）、**事件**（滚轮 /
    // 拖拽 / 键盘）、**渲染**。算术全在 `84-viewer-zoom.js`（纯函数）。
    //
    // 坐标与尺寸语义：
    //  · `zoom === 1` 是「**适配**」——布局框由 CSS 的 max-width/max-height
    //    决定，它本身就刚好放得下，所以打开即 100%。**不要**再乘一次
    //    `fitZoom(natural, viewport)`：那会把已经缩过一次的图再缩一次
    //    （实机读数 554 的盒子 × 0.79 = 439，白占两成空间）。
    //  · `pan` 是**中心相对**的偏移（图片画在视口正中）。
    //  · 钳位用**绘制尺寸 = 布局框 × zoom**；用自然尺寸算，图能被拖出可视区。
    //
    // 几条不能省的：
    //  · 尺寸用 `ResizeObserver` 观察**图片自己**读 `offsetWidth/offsetHeight`，
    //    不用 `load` 事件——缓存命中时 `load` 不再触发，尺寸停在 0，拖拽恒死。
    //  · 缩放只改 `transform`，不改 width/height（否则与 ResizeObserver 互相触发）。
    //  · 必须拒绝浏览器的原生图片拖拽（Chromium 会吞掉 move 事件）。
    //  · 拖动时直写 DOM 的 transform，React 状态每帧至多提交一次——否则不跟手。
    //  · 拖拽起点**只读**：位移是「起点 + 累计」，绝不把结果写回起点。

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
.dd-viewer-video{
  flex:1 1 auto;min-height:120px;display:flex;align-items:center;justify-content:center;
  background:#000;overflow:hidden;
}
.dd-viewer-video video{max-width:100%;max-height:100%;display:block}
`)

    /**
     * 视频资产的地址。
     *
     * 浮层的调用方是按**图片**路由拼好 src 传进来的（它不知道这里要播视频），
     * 所以 workspace 只能从 asset 或 src 的查询串里捡出来。捡不到就用传进来的
     * src——不自己拼图片 URL 是一条硬约束（≤1200px 由 Host 路由保证）。
     *
     * @param {object} asset
     * @param {string} src
     * @returns {string}
     */
    function viewerVideoSrc(asset, src) {
      const item = asset || {}
      const id = item.id || ''
      if (id === '') return src || ''
      let workspaceId = item.workspaceId || ''
      if (workspaceId === '' && typeof src === 'string' && src !== '') {
        try {
          const origin = typeof location === 'undefined' ? 'http://localhost' : location.origin
          workspaceId = new URL(src, origin).searchParams.get('workspace') || ''
        } catch (error) {
          workspaceId = ''
        }
      }
      // 拿不到 workspace 就只用 src：宁可播不了，也不自己拼一条路由。
      if (workspaceId === '') return src || ''
      return assetVideoUrl(workspaceId, id)
    }

    function ImageViewer(props) {
      const { asset, src, onClose } = props
      const item = asset || {}
      /** 视频走同一个浮层，但**不做**缩放拖动：手势监听一律不挂。 */
      const isVideo = item.type === 'video'
      const surfaceRef = useRef(null)
      const imgRef = useRef(null)
      const [zoom, setZoom] = useState(1)
      const [pan, setPan] = useState({ x: 0, y: 0 })
      /** 图片的**布局框**（CSS 适配之后的盒子）——钳位与读数都基于它。 */
      const [layout, setLayout] = useState({ width: 0, height: 0 })
      /** 原始像素——只给 1:1 的目标缩放用。 */
      const [natural, setNatural] = useState({ width: 0, height: 0 })
      /** 拖拽起点（**只读**：它持有开始那一刻的 pan 与指针）。 */
      const dragRef = useRef(null)
      /** 最新视图状态的镜像：事件里读它，不等 React 重渲染。 */
      const viewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 }, layout: { width: 0, height: 0 }, natural: { width: 0, height: 0 } })
      viewRef.current = { zoom, pan, layout, natural }
      /** 本帧待提交的视图：拖动时只写 DOM，状态交给 rAF。 */
      const pendingRef = useRef(null)
      const frameRef = useRef(0)

      /** 视口尺寸（stage 的客户区）。 */
      const viewport = useCallback(() => {
        const box = surfaceRef.current
        if (box === null) return { width: 0, height: 0 }
        return { width: box.clientWidth, height: box.clientHeight }
      }, [])

      /** 测量用的布局框；缺尺寸时按视口两倍兜底，不能把图钉死。 */
      const layoutBox = useCallback(() => safeLayoutSize(viewRef.current.layout, viewport()), [viewport])

      /** 把视图写进 DOM（拖动时每帧都调，缩放只走 transform）。 */
      const paint = useCallback((nextZoom, nextPan) => {
        const img = imgRef.current
        if (img === null) return
        img.style.transform = 'translate(' + nextPan.x + 'px,' + nextPan.y + 'px) scale(' + nextZoom + ')'
      }, [])

      /** 立即提交（缩放 / 按钮 / 松手）：撤掉本帧挂起的提交，免得旧值盖新值。 */
      const applyView = useCallback((nextZoom, nextPan) => {
        pendingRef.current = null
        if (frameRef.current !== 0) {
          if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameRef.current)
          frameRef.current = 0
        }
        setZoom(nextZoom)
        setPan(nextPan)
        paint(nextZoom, nextPan)
      }, [paint])

      /**
       * 拖动中的节流提交：画面直写 DOM 跟手，React 状态**每帧至多一次**。
       *
       * 提交读 pendingRef 而不是闭包里的值——一帧内可能来了好几个 move，
       * 要提交的是最后一个。
       */
      const schedule = useCallback((nextZoom, nextPan) => {
        paint(nextZoom, nextPan)
        pendingRef.current = { zoom: nextZoom, pan: nextPan }
        if (frameRef.current !== 0) return
        if (typeof requestAnimationFrame !== 'function') {
          const pending = pendingRef.current
          pendingRef.current = null
          setZoom(pending.zoom)
          setPan(pending.pan)
          return
        }
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = 0
          const pending = pendingRef.current
          if (pending === null) return
          pendingRef.current = null
          setZoom(pending.zoom)
          setPan(pending.pan)
        })
      }, [paint])

      /** 复位到「适配」：`zoom = 1` 就是刚好放得下，pan 归零即居中。 */
      const resetFit = useCallback(() => {
        applyView(1, clampPan({ x: 0, y: 0 }, 1, layoutBox(), viewport()))
      }, [applyView, layoutBox, viewport])

      /**
       * 按原始像素显示（1:1）。
       *
       * `zoom = 1` 是适配尺寸，所以目标是 `natural.width / layout.width`；
       * 复位到居中（1:1 之后图通常比视口大，居中才是「看全图」）。
       */
      const actualSize = useCallback(() => {
        const current = viewRef.current
        const img = imgRef.current
        const size = current.natural.width > 0
          ? current.natural
          : { width: img === null ? 0 : img.naturalWidth, height: img === null ? 0 : img.naturalHeight }
        const box = layoutBox()
        const target = zoomForActualSize(size, box)
        applyView(target, clampPan({ x: 0, y: 0 }, target, box, viewport()))
      }, [applyView, layoutBox, viewport])

      /** 以某个点为锚缩放；锚点换算到「相对视口中心」，与 pan 同坐标系。 */
      const zoomAt = useCallback((factor, clientX, clientY) => {
        const current = viewRef.current
        const box = surfaceRef.current
        let point = { x: 0, y: 0 }
        if (box !== null && typeof clientX === 'number' && typeof clientY === 'number') {
          const rect = box.getBoundingClientRect()
          point = {
            x: clientX - rect.left - rect.width / 2,
            y: clientY - rect.top - rect.height / 2,
          }
        }
        const next = zoomAroundPoint(current.zoom, current.pan, point, factor)
        // 缩放后立刻重新钳位：放大后的可拖范围变了，旧 pan 可能已经越界。
        applyView(next.zoom, clampPan(next.pan, next.zoom, layoutBox(), viewport()))
      }, [applyView, layoutBox, viewport])

      /**
       * 尺寸：`ResizeObserver` 观察**图片自己**，读布局框（`offsetWidth/offsetHeight`）。
       *
       * 不用 `load` 事件——缓存命中时它不再触发，尺寸会是 0，拖拽恒死。
       * 观察 stage（而不是图片）报的是视口尺寸，不是图片尺寸。
       * 布局框一变就重新钳一次：图换了 / 视口变小，旧 pan 可能已经越界。
       */
      useEffect(() => {
        const img = imgRef.current
        if (img === null) return undefined
        const measure = () => {
          const width = img.offsetWidth
          const height = img.offsetHeight
          const naturalWidth = img.naturalWidth || 0
          const naturalHeight = img.naturalHeight || 0
          const current = viewRef.current
          if (width > 0 && height > 0 && (width !== current.layout.width || height !== current.layout.height)) {
            setLayout({ width, height })
          }
          if (naturalWidth > 0 && naturalHeight > 0
            && (naturalWidth !== current.natural.width || naturalHeight !== current.natural.height)) {
            setNatural({ width: naturalWidth, height: naturalHeight })
          }
          if (width > 0 && height > 0) {
            const clamped = clampPan(current.pan, current.zoom, { width, height }, viewport())
            if (clamped.x !== current.pan.x || clamped.y !== current.pan.y) {
              setPan(clamped)
              paint(current.zoom, clamped)
            }
          }
        }
        measure()
        if (typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(measure)
        observer.observe(img)
        return () => observer.disconnect()
      }, [paint, viewport])

      /** 视口尺寸变了（窗口缩放 / 浮层重排）→ 重新钳一次。 */
      useEffect(() => {
        const box = surfaceRef.current
        if (box === null || typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(() => {
          const current = viewRef.current
          const view = viewport()
          const clamped = clampPan(current.pan, current.zoom, safeLayoutSize(current.layout, view), view)
          if (clamped.x !== current.pan.x || clamped.y !== current.pan.y) {
            setPan(clamped)
            paint(current.zoom, clamped)
          }
        })
        observer.observe(box)
        return () => observer.disconnect()
      }, [paint, viewport])

      /** 滚轮缩放：必须 `passive:false`，否则 `preventDefault` 无效、整页跟着滚。 */
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
       * `pointer` 与 `mouse` **双挂**：某些宿主吞掉其中一套。双挂不会出错——
       * 位移是**绝对式**（起点 + 累计），同一个物理位移算几次结果一样。
       * `move` / `up` 绑在 `window`：指针移出图片就丢事件源，拖拽半途断掉。
       */
      useEffect(() => {
        const box = surfaceRef.current
        if (box === null) return undefined

        const finish = event => {
          const drag = dragRef.current
          if (drag === null) return
          dragRef.current = null
          box.classList.remove('dragging')
          const current = viewRef.current
          const view = viewport()
          const size = safeLayoutSize(current.layout, view)
          // 松手位置未必从事件里拿得到（某些鼠标事件不带坐标），那就用最后
          // 一帧的挂起值；两者都没有时才退回已提交的 pan。
          let final = pendingRef.current === null ? current.pan : pendingRef.current.pan
          if (event !== undefined && event !== null
            && typeof event.clientX === 'number' && Number.isFinite(event.clientX)
            && Number.isFinite(event.clientY)) {
            final = clampPan(dragPan(drag, { x: event.clientX, y: event.clientY }), current.zoom, size, view)
          }
          applyView(current.zoom, final)
        }

        const onDown = event => {
          // 右键 / 中键不该开始拖拽（按下时 button 是 0 才是左键）。
          if (event.button !== 0) return
          const current = viewRef.current
          // 起点只读：本次位移永远由它 + 指针累计位移算出，结果绝不写回。
          dragRef.current = beginDrag({ x: event.clientX, y: event.clientY }, current.pan)
          box.classList.add('dragging')
        }

        const onMove = event => {
          const drag = dragRef.current
          if (drag === null) return
          const current = viewRef.current
          const view = viewport()
          const raw = dragPan(drag, { x: event.clientX, y: event.clientY })
          schedule(current.zoom, clampPan(raw, current.zoom, safeLayoutSize(current.layout, view), view))
        }

        box.addEventListener('pointerdown', onDown)
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', finish)
        window.addEventListener('pointercancel', finish)
        box.addEventListener('mousedown', onDown)
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', finish)

        return () => {
          box.removeEventListener('pointerdown', onDown)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', finish)
          window.removeEventListener('pointercancel', finish)
          box.removeEventListener('mousedown', onDown)
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', finish)
          dragRef.current = null
          box.classList.remove('dragging')
        }
      }, [applyView, schedule, viewport])

      /** 键盘：Esc 关闭、方向键平移（Shift 加大步）、+/- 缩放、0 复位、1 切 1:1。 */
      useEffect(() => {
        const onKey = event => {
          if (event.key === 'Escape') { event.stopPropagation(); onClose(); return }
          // 视频没有缩放/拖动，只留 Esc。
          if (imgRef.current === null) return
          const current = viewRef.current
          const view = viewport()
          const size = safeLayoutSize(current.layout, view)
          const step = event.shiftKey ? 120 : 60
          const nudge = (dx, dy) => {
            applyView(current.zoom, clampPan({
              x: current.pan.x + dx,
              y: current.pan.y + dy,
            }, current.zoom, size, view))
          }
          if (event.key === 'ArrowLeft') { event.preventDefault(); nudge(-step, 0) }
          else if (event.key === 'ArrowRight') { event.preventDefault(); nudge(step, 0) }
          else if (event.key === 'ArrowUp') { event.preventDefault(); nudge(0, -step) }
          else if (event.key === 'ArrowDown') { event.preventDefault(); nudge(0, step) }
          else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(ZOOM_STEP) }
          else if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomAt(1 / ZOOM_STEP) }
          else if (event.key === '0') { event.preventDefault(); resetFit() }
          else if (event.key === '1') { event.preventDefault(); actualSize() }
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [actualSize, applyView, onClose, resetFit, viewport, zoomAt])

      /** 卸载时撤掉挂起的帧，免得对已卸载的组件提交状态。 */
      useEffect(() => () => {
        if (frameRef.current !== 0 && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
        pendingRef.current = null
      }, [])

      const readout = layout.width > 0
        ? viewerReadout(zoom, layout, pan)
        : '读取中…'

      const foot = h('div', { className: 'dd-modal-foot' },
        h('span', { className: 'mf' }, '路径 ', h('b', null, item.path || '—')),
        item.source ? h('span', { className: 'mf' }, '来源 ', h('b', null, item.source)) : null,
        item.state ? h('span', { className: 'mf' }, '状态 ', h('b', null, item.state)) : null,
        item.notes ? h('span', { className: 'mf' }, '备注 ', h('b', null, item.notes)) : null,
        item.prompt
          ? h('div', { className: 'dd-modal-prompt' }, item.prompt)
          : (isVideo ? null : h('span', { className: 'mf', style: { color: 'var(--ink4)' } }, '（这张图没有登记提示词）')),
      )

      /**
       * 视频资产：同一个浮层里直接播。
       *
       * 手势一律不挂（`surfaceRef` 不绑在这个容器上，几个 effect 自然空转），
       * 头部只留关闭——给视频缩放拖动没有意义，还会和 `<video controls>` 抢指针。
       * 早退排在这里（所有 hook 之后），否则两次渲染的 hook 数不同 ⇒ React #310。
       */
      if (isVideo) {
        return h('div', {
          className: 'dd-modal-backdrop',
          onMouseDown: event => { if (event.target === event.currentTarget) onClose() },
        },
          h('div', { className: 'dd-modal', role: 'dialog', 'aria-modal': 'true' },
            h('div', { className: 'dd-modal-head' },
              h(Icon, { name: 'film', size: 14 }),
              h('span', { className: 'num', style: { fontSize: '12.5px' } }, item.id || ''),
              h('span', { className: 'dd-spacer' }),
              h('button', { className: 'dd-icon-btn', onClick: onClose, title: t('action.close', '关闭') },
                h(Icon, { name: 'close', size: 13 })),
            ),
            h('div', { className: 'dd-viewer-video' },
              h('video', {
                src: viewerVideoSrc(item, src),
                controls: true,
                preload: 'metadata',
                playsInline: true,
              }),
            ),
            foot,
          ),
        )
      }

      return h('div', {
        className: 'dd-modal-backdrop',
        onMouseDown: event => { if (event.target === event.currentTarget) onClose() },
      },
        h('div', { className: 'dd-modal', role: 'dialog', 'aria-modal': 'true' },
          h('div', { className: 'dd-modal-head' },
            h(Icon, { name: 'eye', size: 14 }),
            h('span', { className: 'num', style: { fontSize: '12.5px' } }, item.id || ''),
            h('span', { className: 'dd-spacer' }),
            // 读数既是用户反馈，也是**实机验收的读数**（适配% · 实际尺寸 · 位移）。
            h('span', { className: 'dd-zoom-readout', title: readout }, readout),
            h('button', { className: 'dd-btn sm', onClick: resetFit, title: '复位到适配尺寸（100%）' }, t('action.fit', '适应窗口')),
            h('button', { className: 'dd-btn sm', onClick: actualSize, title: '按原始像素显示（1:1）' }, t('action.actualSize', '1:1')),
            h('button', { className: 'dd-icon-btn', onClick: onClose, title: t('action.close', '关闭') },
              h(Icon, { name: 'close', size: 13 })),
          ),
          h('div', {
            className: 'dd-zoom-stage',
            ref: surfaceRef,
            title: readout,
            onDoubleClick: resetFit,
            // 拒绝浏览器的原生图片拖拽：Chromium 会吞掉 move 事件。
            onDragStart: event => event.preventDefault(),
          },
            h('img', {
              ref: imgRef,
              src: src,
              alt: item.id || '',
              draggable: false,
              style: { transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')' },
            }),
            h('div', { className: 'dd-zoom-hint' }, '滚轮缩放 · 拖动平移 · 双击复位 · 0 适配 / 1 原始像素'),
          ),
          foot,
        ),
      )
    }
