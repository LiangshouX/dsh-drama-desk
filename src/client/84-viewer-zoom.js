    // ── 图片手势的数学（纯函数 · 零 DOM 依赖）──────────────────────────────
    //
    // 「纯函数对了 ≠ 组件对了」。
    //
    // 第一版修法把算出的 pan **写回了拖拽起点**，于是又变成累加——
    // 纯数学模块的用例全绿，实机拖动才暴露（-10/-30/-60/-100 而不是
    // -10/-20/-30/-40）。所以这套算术**单独成一层**：组件只管测量与事件，
    // 算术一律问这里。
    //
    // 坐标系：**中心相对**。图片永远画在视口正中，pan 是它相对视口中心的
    // 偏移。于是「图片不离开视野」的钳位是对称的，缩放锚点也好算。

    /** 缩放范围。 */
    const ZOOM_MIN = 0.1
    const ZOOM_MAX = 16
    /** 每档的倍率（**乘性**：1.1ⁿ）。加性步进会让两端手感不一致。 */
    const ZOOM_STEP = 1.1

    /**
     * 把缩放钳进范围。
     *
     * @param {number} zoom
     * @returns {number}
     */
    function clampZoom(zoom) {
      if (!Number.isFinite(zoom)) return 1
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
    }

    /**
     * 下一档缩放（乘性步进）。
     *
     * @param {number} current 当前缩放
     * @param {number} direction 正数放大、负数缩小
     * @returns {number}
     */
    function nextZoom(current, direction) {
      const base = clampZoom(current)
      return clampZoom(direction >= 0 ? base * ZOOM_STEP : base / ZOOM_STEP)
    }

    /**
     * 缩放百分比（读数用）。
     *
     * @param {number} zoom
     * @returns {string}
     */
    function zoomPercent(zoom) {
      return Math.round(clampZoom(zoom) * 100) + '%'
    }

    /**
     * 给定缩放，图片在视口里能平移多远。
     *
     * 钳位用的是**绘制尺寸**（布局框 × zoom），不是布局框——
     * 放大之后用布局框算，图片能直接拖出屏幕。
     *
     * @param {number} zoom
     * @param {{width: number, height: number}} size 图片的自然尺寸
     * @param {{width: number, height: number}} viewport 视口尺寸
     * @returns {{maxX: number, maxY: number}}
     */
    function clampFor(zoom, size, viewport) {
      const scaledWidth = size.width * zoom
      const scaledHeight = size.height * zoom
      return {
        maxX: Math.max(0, (scaledWidth - viewport.width) / 2),
        maxY: Math.max(0, (scaledHeight - viewport.height) / 2),
      }
    }

    /**
     * 把 pan 钳回「图片永远在视野里」。
     *
     * @param {{x: number, y: number}} pan
     * @param {number} zoom
     * @param {{width: number, height: number}} size
     * @param {{width: number, height: number}} viewport
     * @returns {{x: number, y: number}}
     */
    function clampPan(pan, zoom, size, viewport) {
      const { maxX, maxY } = clampFor(zoom, size, viewport)
      return {
        x: Math.min(maxX, Math.max(-maxX, pan.x)),
        y: Math.min(maxY, Math.max(-maxY, pan.y)),
      }
    }

    /**
     * 以某个点为锚缩放：锚点下的像素保持不动。
     *
     * 锚点同步要用**实际**比值 `next / current`——钳位过之后请求值与实际值
     * 可能不同，用请求值锚点会漂一点。
     *
     * @param {number} zoom 当前缩放
     * @param {{x: number, y: number}} pan 当前位移
     * @param {{x: number, y: number}} point 锚点（相对视口中心）
     * @param {number} factor 倍率
     * @returns {{zoom: number, pan: {x: number, y: number}}}
     */
    function zoomAroundPoint(zoom, pan, point, factor) {
      const current = clampZoom(zoom)
      const next = clampZoom(current * factor)
      if (next === current) return { zoom: next, pan }
      const ratio = next / current
      return {
        zoom: next,
        pan: {
          x: point.x - (point.x - pan.x) * ratio,
          y: point.y - (point.y - pan.y) * ratio,
        },
      }
    }

    /**
     * 拖拽起点。
     *
     * 起点是**只读**的：它持有开始拖动那一刻的 pan 与指针位置，
     * 之后**永不**被本次结果覆盖（覆盖了就变成累加）。
     *
     * @param {{x: number, y: number}} pointer 指针位置
     * @param {{x: number, y: number}} pan 当时的 pan
     * @returns {{pointer: {x: number, y: number}, pan: {x: number, y: number}}}
     */
    function beginDrag(pointer, pan) {
      return {
        pointer: { x: pointer.x, y: pointer.y },
        pan: { x: pan.x, y: pan.y },
      }
    }

    /**
     * 拖拽位移：**绝对式**（起点 + 位移），不是累加。
     *
     * 累加会让 pan 平方增长，几步就撞钳位 ⇒「图片直接跳到最左边」。
     *
     * @param {{pointer: {x: number, y: number}, pan: {x: number, y: number}}} drag 起点
     * @param {{x: number, y: number}} pointer 现在的指针位置
     * @returns {{x: number, y: number}}
     */
    function dragPan(drag, pointer) {
      return {
        x: drag.pan.x + (pointer.x - drag.pointer.x),
        y: drag.pan.y + (pointer.y - drag.pointer.y),
      }
    }

    /**
     * 「适应窗口」的缩放比。
     *
     * @param {{width: number, height: number}} size 图片自然尺寸
     * @param {{width: number, height: number}} viewport 视口尺寸
     * @returns {number}
     */
    function fitZoom(size, viewport) {
      if (size.width <= 0 || size.height <= 0) return 1
      if (viewport.width <= 0 || viewport.height <= 0) return 1
      return Math.min(viewport.width / size.width, viewport.height / size.height)
    }
