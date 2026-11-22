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
    //
    // 尺寸语义（这里曾经错成「缩了两次」）：
    //  · `layout` 是**布局框**——CSS 的 max-width/max-height 已经把图压到刚好
    //    放得下，它本身就是「适配尺寸」。
    //  · `zoom === 1` 表示「适配」，**不是**「原始像素」。所以这里没有
    //    `fitZoom`：再乘一次 viewport/natural 就是把已缩过一次的图又缩一次，
    //    屏幕上只剩「刚好放得下」的八成，还白占了空间。
    //  · 钳位与读数一律用**绘制尺寸 = layout × zoom**，不用 natural——
    //    两者差的那 20%~26% 正是「图片能被拖出可视区」的来源。
    //  · `natural` 只在一个地方用得着：1:1 的目标缩放 = natural.width / layout.width。

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
     * 屏幕上的**绘制尺寸**：布局框 × zoom。
     *
     * 钳位、读数都该用它。用自然尺寸算，图能直接拖出屏幕。
     *
     * @param {number} zoom
     * @param {{width: number, height: number}} layout 布局框（CSS 适配之后的盒子）
     * @returns {{width: number, height: number}}
     */
    function drawnSize(zoom, layout) {
      return { width: layout.width * zoom, height: layout.height * zoom }
    }

    /**
     * 布局框的兜底。
     *
     * 图还没解码 / 还没布局时 `offsetWidth` 是 0。拿 0 当尺寸会把可拖范围钳成 0
     * （图片被钉死在原地），所以按视口两倍兜底；真正的尺寸到了，组件会再钳一次。
     *
     * @param {{width: number, height: number}} layout
     * @param {{width: number, height: number}} viewport
     * @returns {{width: number, height: number}}
     */
    function safeLayoutSize(layout, viewport) {
      if (layout && layout.width > 0 && layout.height > 0) {
        return { width: layout.width, height: layout.height }
      }
      const width = viewport && viewport.width > 0 ? viewport.width : 0
      const height = viewport && viewport.height > 0 ? viewport.height : 0
      return { width: width * 2, height: height * 2 }
    }

    /**
     * 给定缩放，图片在视口里能平移多远。
     *
     * 钳位用的是**绘制尺寸**（布局框 × zoom），不是布局框——
     * 放大之后用布局框算，图片能直接拖出屏幕。
     *
     * @param {number} zoom
     * @param {{width: number, height: number}} layout 布局框
     * @param {{width: number, height: number}} viewport 视口尺寸
     * @returns {{maxX: number, maxY: number}}
     */
    function clampFor(zoom, layout, viewport) {
      const drawn = drawnSize(zoom, layout)
      return {
        maxX: Math.max(0, (drawn.width - viewport.width) / 2),
        maxY: Math.max(0, (drawn.height - viewport.height) / 2),
      }
    }

    /**
     * 把 pan 钳回「图片永远在视野里」。
     *
     * 图比视口小的时候 maxX / maxY 是 0，pan 恒为 {0,0}——也就是居中。
     *
     * @param {{x: number, y: number}} pan
     * @param {number} zoom
     * @param {{width: number, height: number}} layout
     * @param {{width: number, height: number}} viewport
     * @returns {{x: number, y: number}}
     */
    function clampPan(pan, zoom, layout, viewport) {
      const { maxX, maxY } = clampFor(zoom, layout, viewport)
      return {
        x: Math.min(maxX, Math.max(-maxX, pan.x)),
        y: Math.min(maxY, Math.max(-maxY, pan.y)),
      }
    }

    /**
     * 以某个点为锚缩放：锚点下的像素保持不动。
     *
     * 锚点同步要用**实际**比值 `next / current`——钳位过之后请求值与实际值
     * 可能不同，用请求值锚点会漂一点。返回的 pan 还可能被调用方再钳一次。
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
      if (next === current) return { zoom: next, pan: { x: pan.x, y: pan.y } }
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
     * 1:1 的目标缩放。
     *
     * 1:1 要的是「原始像素」，而 `zoom = 1` 是「适配」——所以目标是
     * `natural.width / layout.width`，不是 1。拿不到尺寸就退回适配。
     *
     * @param {{width: number, height: number}} natural 原始像素
     * @param {{width: number, height: number}} layout 布局框
     * @returns {number}
     */
    function zoomForActualSize(natural, layout) {
      if (!natural || !layout) return 1
      if (natural.width <= 0 || layout.width <= 0) return 1
      return clampZoom(natural.width / layout.width)
    }

    /**
     * 读数：`适配 N% · 实际 W×H · 位移 x, y`。
     *
     * 「适配 N%」是 zoom 的百分比（100% = 刚好放得下），「实际 W×H」是**屏幕上**
     * 的绘制尺寸——别拿自然尺寸冒充实际尺寸，实机验收读的就是这一行。
     *
     * @param {number} zoom
     * @param {{width: number, height: number}} layout
     * @param {{x: number, y: number}} pan
     * @returns {string}
     */
    function viewerReadout(zoom, layout, pan) {
      const drawn = drawnSize(clampZoom(zoom), layout)
      return '适配 ' + zoomPercent(zoom)
        + ' · 实际 ' + Math.round(drawn.width) + '×' + Math.round(drawn.height)
        + ' · 位移 ' + Math.round(pan.x) + ', ' + Math.round(pan.y)
    }
