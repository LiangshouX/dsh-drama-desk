    // ── assets / ledger ────────────────────────────────────────────────────
    //
    // 资产管理是工作台的主要职能之一。很长一段时间里这一页是**一个只读的表格**——
    // 资产多起来之后（一百多个），没人能从里面看出「这个作品里有什么」。
    //
    // 现在它按资产管理的四件事组织：
    //   ① **分类索引**：类型 / 状态 / 场次→镜号 三个维度，角标上带数量与体积；
    //   ② **便捷预览**：表格里有缩略图，图墙给一整面画面，点开就是浮层；
    //      文本类资产**不在这里读文件**（客户端没有读文本的接口），
    //      给的是「去那一镜处理它」的直达入口——预览一个提示词，
    //      有意义的是它将被怎么改，不是它此刻的字节；
    //   ③ **详情**：点一行，表格下方给出完整的 id / 路径 / 哈希 / 全部引用；
    //   ④ **排序与分页**：DOM 里只有当前这一页。
    //
    // 性能铁律（`docs/dev/performance.md`）：这一页**只渲染当前页**。
    // 五千个资产时在 render 里 map 全表 = 五千个 React 元素，
    // 面板会先卡后崩——而插件是嵌在用户主应用里的，用户只会说「DSH 卡了」。

    /** 资产类型的中文名。看不认识的类型就原样显示，不猜。 */
    const ASSET_TYPE_LABEL = {
      reference_image: '参考图',
      keyframe: '关键帧',
      prompt: '提示词',
      video: '视频',
      audio: '音频',
      report: '报告',
      doc: '文档',
    }

    /** 资产状态的中文名。分类索引、表格、详情条共用这一张表。 */
    const ASSET_STATUS_LABEL = {
      active: '在用',
      deprecated: '作废',
    }

    /** 一页多少行。DOM 里只留这么多节点。 */
    const ASSET_PAGE_SIZE = 50
    const LEDGER_PAGE_SIZE = 50
    /** 图墙一页多少格。格子比行矮，一页可以多给一些，但仍然是一页。 */
    const ASSET_WALL_SIZE = 30

    /**
     * 排序下拉的选项。
     *
     * `default` 是**服务端顺序**（= 文件清单顺序），也是打开这一页时的样子：
     * 没有理由的地方就不要替用户排。
     */
    const ASSET_SORT_LABEL = {
      default: '默认顺序',
      type: '按类型',
      bytes: '按体积',
      time: '按时间',
      shot: '按镜号',
    }

    /** 能出缩略图的类型。 */
    function isImageAsset(asset) {
      return asset.type === 'reference_image' || asset.type === 'keyframe'
    }

    /** 视频资产。浮层由 `84-viewer.js` 负责 `<video>`，这里只负责把 asset 递过去。 */
    function isVideoAsset(asset) {
      return asset.type === 'video'
    }

    /**
     * 镜号里的场次：`SC01-SH03` → `SC01`。
     *
     * 用 `indexOf('-')` 而不是切前四位——镜号格式一改（`SC1-SH3`、`S01-SH003`），
     * 写死的长度就会**静默**分错组：界面上看不出错，只是场次少了几个。
     */
    function shotSceneOf(shotId) {
      if (typeof shotId !== 'string' || shotId === '') return ''
      const at = shotId.indexOf('-')
      return at > 0 ? shotId.slice(0, at) : shotId
    }

    /** 镜号排序：空镜号排最后（没有镜号的资产不属于任何一镜，不该抢在开头）。 */
    function compareShotIds(a, b) {
      if (a === b) return 0
      if (a === '') return 1
      if (b === '') return -1
      return a.localeCompare(b, 'en', { numeric: true })
    }

    /**
     * 这个资产能不能出像素。返回 `'image'` / `'video'` / `''`。
     *
     * 图墙靠它筛。**文件缺失的资产不进图墙**——一格黑框比「缺失」两个字更难懂。
     */
    function assetPixelKind(asset) {
      if (asset === null || typeof asset !== 'object' || asset.missing === true) return ''
      if (isImageAsset(asset)) return 'image'
      if (isVideoAsset(asset)) return 'video'
      return ''
    }

    /**
     * 一个资产这一行能做什么。
     *
     * 文本类资产（提示词 / 报告 / 文档）**不在资产页里读文件内容**：
     * 客户端没有读文本的接口，硬读只会造出第三个真源。这里给的是
     * 「去那一镜处理它」的直达入口——权限、校验、幂等都在各自的阶段里。
     */
    function assetActionOf(asset) {
      const pixel = assetPixelKind(asset)
      if (pixel === 'image') {
        return { kind: 'image', label: '预览', icon: 'eye', hint: '在浮层里看大图' }
      }
      if (pixel === 'video') {
        return { kind: 'video', label: '播放', icon: 'play', hint: '在浮层里播放这段视频' }
      }
      if (asset === null || typeof asset !== 'object' || asset.missing === true) return null
      if (asset.type === 'prompt') {
        return {
          kind: 'goto', label: '去生成台', icon: 'film', stage: 'generate', shotId: asset.shotId,
          hint: '去生成台改这一镜的提示词（资产页不读文本）',
        }
      }
      if (asset.type === 'report') {
        return {
          kind: 'goto', label: '去验收', icon: 'check', stage: 'verify', shotId: asset.shotId,
          hint: '去验收台看这一镜的报告（资产页不读文本）',
        }
      }
      if (asset.type === 'doc') {
        return {
          kind: 'goto', label: '去构思', icon: 'edit', stage: 'conceive', shotId: '',
          hint: '在创意阶段编辑（资产页不读文本内容）',
        }
      }
      return null
    }

    /** 资产状态的短名。 */
    function assetStatusLabel(asset) {
      const key = String((asset && asset.status) || 'active')
      return ASSET_STATUS_LABEL[key] || key
    }

    /**
     * 资产状态的语义色（`dd-badge` 的键）。
     *
     * 之前这里写的是 `var(--warn)` / `var(--ok)` / `var(--danger)`——这**三个变量
     * 在这套主题里根本不存在**，于是颜色被静默丢掉（表现为「和正文一个颜色」，
     * 不是报错）。主题里的真名是 `--sig-*`，而 `dd-badge` 已经把语义映射好了。
     */
    function assetStatusTone(asset) {
      const key = String((asset && asset.status) || 'active')
      if (key === 'active') return 'pass'
      if (key === 'deprecated') return 'warn'
      return 'none'
    }

    /**
     * 排序比较器。
     *
     * 体积与时间都**从大到新**：找资产时想看的总是「最大的那个」「最新的那个」。
     * 类型与镜号相同时用 id 清位，免得顺序随机跳（排序不稳定 = 翻页时行会串）。
     */
    function assetSortCompare(sort, a, b) {
      if (sort === 'bytes') {
        return (typeof b.bytes === 'number' ? b.bytes : 0) - (typeof a.bytes === 'number' ? a.bytes : 0)
      }
      if (sort === 'time') {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      }
      if (sort === 'type') {
        const left = String(a.type || '')
        const right = String(b.type || '')
        return left === right ? String(a.id || '').localeCompare(String(b.id || '')) : left.localeCompare(right)
      }
      if (sort === 'shot') {
        const left = typeof a.shotId === 'string' ? a.shotId : ''
        const right = typeof b.shotId === 'string' ? b.shotId : ''
        return left === right ? String(a.id || '').localeCompare(String(b.id || '')) : compareShotIds(left, right)
      }
      return 0
    }

    /**
     * 台账状态 → 语义色。
     *
     * 颜色跟**判定**走（`dd-badge` 的那几个键）。不在表里的 status 用灰——
     * 给不认识的状态编一个颜色，就是在替服务端说它没说的话。
     */
    const LEDGER_STATUS_TONE = {
      succeeded: 'pass',
      failed: 'fail',
      submitted: 'generated',
      running: 'generated',
      pending: 'warn',
      deprecated: 'none',
    }

    function ledgerStatusTone(status) {
      return LEDGER_STATUS_TONE[String(status || '')] || 'none'
    }

    /** 毫秒 → `42s` / `3m 05s` / `1h 20m` 这种短读数。 */
    function formatSpan(ms) {
      const total = Math.round(ms / 1000)
      if (total < 60) return total + 's'
      const minutes = Math.floor(total / 60)
      if (minutes < 60) return minutes + 'm ' + String(total % 60).padStart(2, '0') + 's'
      const hours = Math.floor(minutes / 60)
      return hours + 'h ' + String(minutes % 60).padStart(2, '0') + 'm'
    }

    /**
     * 一次生成花了多久。
     *
     * **台账里没有 `succeeded_at`**：`src/host/service.js` 的 `ledger()` 只把
     * `submitted_at` 与 `last_query_at` 交给客户端。所以这里不编造完成时刻——
     * 用「提交 → 末次查询」这段**真实**时间，读数前面标 `≈`，列头写明它是什么。
     * 不是 succeeded 的条目没有这段（还在跑 / 失败了），一律显示 —。
     */
    function ledgerElapsed(entry) {
      if (entry === null || typeof entry !== 'object' || entry.status !== 'succeeded') return ''
      const from = Date.parse(entry.submittedAt || '')
      const to = Date.parse(entry.lastQueryAt || '')
      if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return ''
      return '≈ ' + formatSpan(to - from)
    }

    /**
     * 一个「上一页 / 下一页」的分页条。
     *
     * @param {{page: number, pages: number, total: number, size: number, onPage: Function}} props
     */
    function Pager(props) {
      const { page, pages, total, size, onPage } = props
      if (total === 0) return null
      const from = page * size + 1
      const to = Math.min(total, (page + 1) * size)
      return h('div', { className: 'dd-pager' },
        h('span', { className: 'dd-note num' }, from + '–' + to + ' / ' + total + ' 条'),
        h('span', { className: 'dd-spacer' }),
        h('button', {
          className: 'dd-btn sm', disabled: page <= 0, onClick: () => onPage(page - 1),
        }, '上一页'),
        h('span', { className: 'dd-note num' }, (page + 1) + ' / ' + pages),
        h('button', {
          className: 'dd-btn sm', disabled: page >= pages - 1, onClick: () => onPage(page + 1),
        }, '下一页'),
      )
    }

    function RegisterAssetForm(props) {
      const { actions, busy } = props
      const [record, setRecord] = useState({ id: '', type: 'reference_image', path: '', role: '', shotId: '', version: '' })
      const setField = (key, value) => setRecord(previous => ({ ...previous, [key]: value }))
      return h('details', { className: 'dd-add-record' }, h('summary', null, '+ 登记作品内文件'),
        h('p', { className: 'dd-note' }, '先把文件放入作品目录，再登记相对路径。视频登记后，在镜头详情选择当前版本。'),
        h('form', { className: 'dd-cut-controls', onSubmit: async event => {
          event.preventDefault()
          const result = await actions.registerAsset({ ...record, role: record.role || undefined,
            shotId: record.shotId || undefined, version: record.version ? Number(record.version) : undefined })
          if (result !== false) setRecord(previous => ({ ...previous, id: '', path: '' }))
        } },
          h('label', null, '类型', h('select', { value: record.type, disabled: busy, onChange: event => setField('type', event.target.value) },
            Object.keys(ASSET_TYPE_LABEL).map(type => h('option', { key: type, value: type }, ASSET_TYPE_LABEL[type])))),
          ['id', 'path', 'role', 'shotId', 'version'].map(key => h('label', { key },
            ({ id: '资产 ID', path: '相对路径', role: '角色 ID（可选）', shotId: '镜头 ID（可选）', version: '版本（视频）' })[key],
            h('input', { value: record[key], disabled: busy, required: key === 'id' || key === 'path',
              placeholder: key === 'path' ? 'refs/character.png' : undefined,
              onChange: event => setField(key, event.target.value) }))),
          h('button', { className: 'dd-btn primary', type: 'submit', disabled: busy }, '登记文件')))
    }

    function AssetsView(props) {
      const { assets, onOpenImage, workspaceId, onGoto, busy, actions } = props
      const [typeFilter, setTypeFilter] = useState('')
      const [statusFilter, setStatusFilter] = useState('')
      const [query, setQuery] = useState('')
      const [needle, setNeedle] = useState('')
      const [page, setPage] = useState(0)
      // 视图 / 排序 / 镜头维度 / 选中行：它们**都是筛选状态**，换一个就回第一页。
      const [viewMode, setViewMode] = useState('table')
      const [sort, setSort] = useState('default')
      const [sceneFilter, setSceneFilter] = useState('')
      const [shotFilter, setShotFilter] = useState('')
      const [selectedId, setSelectedId] = useState('')

      // 搜索**防抖**：每敲一个键都重算整张表是白费力气。
      useEffect(() => {
        const timer = setTimeout(() => setNeedle(query.trim().toLowerCase()), 180)
        return () => clearTimeout(timer)
      }, [query])

      const rows = assets && Array.isArray(assets.assets) ? assets.assets : []

      /** 分类索引：每类的数量与体积。**一次算完**，不要每次渲染重算。 */
      const groups = useMemo(() => {
        const map = new Map()
        for (const asset of rows) {
          const key = String(asset.type || 'other')
          const entry = map.get(key) ?? { type: key, count: 0, bytes: 0 }
          entry.count += 1
          entry.bytes += typeof asset.bytes === 'number' ? asset.bytes : 0
          map.set(key, entry)
        }
        const list = [...map.values()]
        list.sort((a, b) => b.count - a.count)
        return list
      }, [rows])

      const statusCounts = useMemo(() => ({
        deprecated: rows.filter(row => row.status === 'deprecated').length,
        missing: rows.filter(row => row.missing === true).length,
      }), [rows])

      /**
       * 镜头维度：场次 → 镜号 → 数量 / 体积。
       *
       * 一百多个资产里七十多个带镜号。**不能把镜号直接铺成一行 chip**：
       * 那行会变成一堵墙，比列表还难找。所以索引只做到场次，
       * 镜号等选中场次之后再展开（见下面的 `sceneFilter` 两层）。
       */
      const shotIndex = useMemo(() => {
        const scenes = new Map()
        let total = 0
        for (const asset of rows) {
          if (typeof asset.shotId !== 'string' || asset.shotId === '') continue
          total += 1
          const scene = shotSceneOf(asset.shotId)
          let group = scenes.get(scene)
          if (group === undefined) {
            group = { scene: scene, count: 0, bytes: 0, shots: new Map() }
            scenes.set(scene, group)
          }
          group.count += 1
          group.bytes += typeof asset.bytes === 'number' ? asset.bytes : 0
          group.shots.set(asset.shotId, (group.shots.get(asset.shotId) || 0) + 1)
        }
        const list = [...scenes.values()]
        list.sort((a, b) => compareShotIds(a.scene, b.scene))
        for (const group of list) {
          group.shots = [...group.shots.entries()]
            .sort((a, b) => compareShotIds(a[0], b[0]))
            .map(pair => ({ shot: pair[0], count: pair[1] }))
        }
        return { scenes: list, total: total }
      }, [rows])

      /**
       * 过滤 + 排序。**全表只在这一次扫**；之后的一切都只看 `visible`。
       *
       * `out` 是新数组，所以 `sort` 不会动到 props 里那份清单
       * （原地排序 props 是「翻一次页顺序就变了」的经典来源）。
       */
      const ordered = useMemo(() => {
        const out = []
        for (const asset of rows) {
          if (typeFilter !== '' && String(asset.type || 'other') !== typeFilter) continue
          if (statusFilter === 'deprecated' && asset.status !== 'deprecated') continue
          if (statusFilter === 'missing' && asset.missing !== true) continue
          if (sceneFilter !== '') {
            if (shotSceneOf(asset.shotId) !== sceneFilter) continue
            if (shotFilter !== '' && asset.shotId !== shotFilter) continue
          }
          if (needle !== '') {
            const hay = [asset.id, asset.path, asset.notes, asset.role, asset.shotId]
              .filter(part => typeof part === 'string')
              .join(' ')
              .toLowerCase()
            if (!hay.includes(needle)) continue
          }
          out.push(asset)
        }
        if (sort === 'default') return out
        out.sort((a, b) => assetSortCompare(sort, a, b))
        return out
      }, [rows, typeFilter, statusFilter, needle, sceneFilter, shotFilter, sort])

      /** 图墙只收能出像素的资产：文本资产在图墙里没有位置。 */
      const listed = useMemo(
        () => (viewMode === 'wall' ? ordered.filter(asset => assetPixelKind(asset) !== '') : ordered),
        [ordered, viewMode],
      )

      const size = viewMode === 'wall' ? ASSET_WALL_SIZE : ASSET_PAGE_SIZE
      const pages = Math.max(1, Math.ceil(listed.length / size))
      const current = Math.min(page, pages - 1)
      /** 真正会被渲染的那**一页**。全表到这里为止。 */
      const visible = useMemo(
        () => listed.slice(current * size, (current + 1) * size),
        [listed, current, size],
      )

      /** 选中的资产（详情条用）。按 id 回查，筛选变了它也能继续显示。 */
      const selected = useMemo(
        () => (selectedId === '' ? null : rows.find(asset => asset.id === selectedId) || null),
        [rows, selectedId],
      )

      // 换了筛选条件就回到第一页——否则会停在一个不存在的页码上。
      useEffect(() => {
        setPage(0)
      }, [typeFilter, statusFilter, needle, sort, viewMode, sceneFilter, shotFilter])

      if (!assets) return h('div', { className: 'dd-empty' }, '正在读取资产…')

      const totals = assets.totals || {}
      const sceneGroup = sceneFilter === '' ? undefined : shotIndex.scenes.find(group => group.scene === sceneFilter)
      const sceneShots = sceneGroup ? sceneGroup.shots : []

      const typeChip = (key, label, count, bytes) => h('button', {
        key: key,
        className: 'dd-facet' + (typeFilter === key ? ' on' : ''),
        type: 'button',
        title: key === '' ? '全部类型' : label + ' · ' + count + ' 个 · ' + formatBytes(bytes),
        onClick: () => setTypeFilter(typeFilter === key && key !== '' ? '' : key),
      },
        h('span', { className: 'nm' }, label),
        h('span', { className: 'ct num' }, String(count)),
        key !== '' && bytes > 0 ? h('span', { className: 'by num' }, formatBytes(bytes)) : null,
      )

      const statusChip = (key, label, count) => h('button', {
        key: key,
        className: 'dd-facet' + (statusFilter === key ? ' on' : ''),
        type: 'button',
        onClick: () => setStatusFilter(statusFilter === key ? '' : key),
      },
        h('span', { className: 'nm' }, label),
        h('span', { className: 'ct num' }, String(count)),
      )

      // 点缩略图 / 「预览」：选中 + 打开浮层。
      // `stopPropagation` 让「点行选中」不跟缩略图抢事件——一格缩略图里点两下
      // 出两种结果，用户会以为界面坏了。
      const openAsset = (event, asset) => {
        if (event) event.stopPropagation()
        setSelectedId(asset.id)
        if (typeof onOpenImage === 'function') onOpenImage(asset)
      }

      const jumpTo = (event, stage, shotId) => {
        if (event) event.stopPropagation()
        if (typeof onGoto === 'function') onGoto(stage, shotId)
      }

      /** 表格第一格：能出像素的给缩略图（视频用海报帧），否则给一个类型字。 */
      const thumbCell = asset => {
        const pixel = assetPixelKind(asset)
        let src = ''
        if (pixel === 'image') src = assetImageUrl(workspaceId, asset.id)
        if (pixel === 'video' && typeof asset.shotId === 'string' && asset.shotId !== '') {
          // 视频封面走 `/drama-desk/poster`：它是**受控路由**（≤1200px），
          // 而且不发整个视频文件——表格里滚过 3 个视频不该拉 500MB。
          src = posterUrl(workspaceId, asset.shotId)
        }
        if (src === '') {
          return h('span', { className: 'dd-asset-thumb ph' },
            (ASSET_TYPE_LABEL[asset.type] || asset.type || '·').slice(0, 1))
        }
        return h('button', {
          className: 'dd-asset-thumb' + (pixel === 'video' ? ' is-video' : ''),
          type: 'button',
          'aria-label': (pixel === 'video' ? '播放 ' : '打开 ') + asset.id,
          title: (pixel === 'video' ? '播放 ' : '打开 ') + asset.id,
          onClick: event => openAsset(event, asset),
        },
          h('img', {
            src: src,
            alt: asset.id,
            loading: 'lazy',
            onError: event => { event.currentTarget.style.visibility = 'hidden' },
          }),
          pixel === 'video' ? h('span', { className: 'dd-asset-thumb-play', 'aria-hidden': true }, '▶') : null,
        )
      }

      /** 「预览 / 去处理」这一列：每个资产只有**一个**明确的下一步。 */
      const actionCell = asset => {
        const action = assetActionOf(asset)
        if (action === null) {
          return h('span', { className: 'dd-note' }, asset.missing === true ? '文件缺失' : '—')
        }
        return h('button', {
          className: 'dd-btn sm ghost dd-go-btn',
          type: 'button',
          title: action.hint + (action.shotId ? ' · ' + action.shotId : ''),
          onClick: action.kind === 'goto'
            ? event => jumpTo(event, action.stage, action.shotId)
            : event => openAsset(event, asset),
        },
          h(Icon, { name: action.icon, size: 12 }),
          action.label,
        )
      }

      /** 引用它的镜头：**点一下就跳到那一镜**。 */
      const refsCell = asset => {
        const refs = Array.isArray(asset.referencedBy) ? asset.referencedBy : []
        if (refs.length === 0) return '—'
        return h('span', { className: 'dd-refs' },
          refs.slice(0, 3).map(shotId => h('button', {
            key: shotId,
            className: 'dd-ref',
            type: 'button',
            title: '跳到 ' + shotId,
            onClick: event => jumpTo(event, 'generate', shotId),
          }, shotId)),
          refs.length > 3 ? h('span', { className: 'dd-note' }, '+' + (refs.length - 3)) : null,
        )
      }

      /** 图墙的一格。只收像素资产，所以点下去一定是开浮层。 */
      const wallTile = asset => {
        const pixel = assetPixelKind(asset)
        let src = ''
        if (pixel === 'image') src = assetImageUrl(workspaceId, asset.id)
        if (pixel === 'video' && typeof asset.shotId === 'string' && asset.shotId !== '') {
          src = posterUrl(workspaceId, asset.shotId)
        }
        return h('button', {
          key: asset.id,
          className: 'dd-asset-tile'
            + (asset.status === 'deprecated' ? ' dep' : '')
            + (selectedId === asset.id ? ' on' : ''),
          type: 'button',
          title: asset.id + (asset.path ? '\n' + asset.path : ''),
          onClick: () => openAsset(null, asset),
        },
          h('span', { className: 'dd-asset-tile-frame' },
            src === '' ? null : h('img', {
              src: src,
              alt: asset.id,
              loading: 'lazy',
              onError: event => { event.currentTarget.style.visibility = 'hidden' },
            }),
            pixel === 'video' ? h('span', { className: 'dd-asset-tile-play', 'aria-hidden': true }, h(Icon, { name: 'play', size: 18 })) : null,
            asset.status === 'deprecated' ? h('span', { className: 'dd-asset-tile-mark' }, '作废') : null,
          ),
          h('span', { className: 'dd-asset-tile-cap' }, asset.id),
        )
      }

      const sceneChips = shotIndex.scenes.map(group => h('button', {
        key: group.scene,
        className: 'dd-facet scene' + (sceneFilter === group.scene ? ' on' : ''),
        type: 'button',
        title: group.scene + ' · ' + group.count + ' 个资产 · ' + formatBytes(group.bytes) + '（点一下展开镜号）',
        onClick: () => {
          setSceneFilter(sceneFilter === group.scene ? '' : group.scene)
          setShotFilter('')
        },
      },
        h('span', { className: 'nm' }, group.scene),
        h('span', { className: 'ct num' }, String(group.count)),
      ))

      const shotChips = sceneShots.map(group => h('button', {
        key: group.shot,
        className: 'dd-facet' + (shotFilter === group.shot ? ' on' : ''),
        type: 'button',
        title: group.shot + ' · ' + group.count + ' 个资产',
        onClick: () => setShotFilter(shotFilter === group.shot ? '' : group.shot),
      },
        h('span', { className: 'nm' }, group.shot),
        h('span', { className: 'ct num' }, String(group.count)),
      ))

      const table = h('table', { className: 'dd-table dd-asset-table' },
        h('thead', null, h('tr', null,
          h('th', { className: 'th-thumb' }, ''),
          h('th', null, '资产'), h('th', null, '类型'), h('th', null, '状态'),
          h('th', { className: 'n' }, '镜号'), h('th', { className: 'n' }, '引用'),
          h('th', { className: 'n' }, '尺寸'), h('th', { className: 'n' }, '体积'),
          h('th', null, '路径'), h('th', null, '预览 / 去处理'),
        )),
        h('tbody', null, visible.map(asset => h('tr', {
          key: asset.id,
          className: 'dd-asset-row' + (selectedId === asset.id ? ' on' : ''),
          title: '点这一行看完整的 id / 路径 / 哈希 / 引用',
          onClick: () => setSelectedId(asset.id),
        },
          h('td', { className: 'td-thumb' }, thumbCell(asset)),
          h('td', { title: asset.id }, asset.id),
          h('td', null, ASSET_TYPE_LABEL[asset.type] || asset.type || '—'),
          h('td', null,
            h('span', { className: 'dd-badge ' + assetStatusTone(asset) }, assetStatusLabel(asset)),
            asset.missing === true ? h('span', { className: 'dd-badge fail', style: { marginLeft: '5px' } }, '缺失') : null,
          ),
          h('td', { className: 'n' },
            // 资产属于哪一镜：点一下就落到那一镜。
            typeof asset.shotId === 'string' && asset.shotId !== ''
              ? h('button', {
                className: 'dd-ref',
                type: 'button',
                title: '跳到 ' + asset.shotId,
                onClick: event => jumpTo(event, 'generate', asset.shotId),
              }, asset.shotId)
              : '—'),
          h('td', { className: 'n' }, refsCell(asset)),
          h('td', { className: 'n' }, asset.width ? asset.width + '×' + asset.height : '—'),
          h('td', { className: 'n' }, formatBytes(asset.bytes)),
          h('td', { className: 'path', title: asset.path || '' },
            assetPixelKind(asset) === ''
              ? (asset.path || '—')
              : h('button', {
                className: 'dd-path-open',
                type: 'button',
                title: '打开 ' + asset.id,
                onClick: event => openAsset(event, asset),
              }, asset.path || '—')),
          h('td', { className: 'td-go' }, actionCell(asset)),
        ))),
      )

      const wall = h('div', { className: 'dd-asset-wall-hold' },
        h('div', { className: 'dd-asset-wall' }, visible.map(wallTile)),
      )

      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-toolbar' },
          h('span', { className: 'dd-chip' }, '共 ', h('b', { className: 'num' }, String(totals.count !== undefined ? totals.count : rows.length)), ' 个'),
          h('span', { className: 'dd-chip' }, '作废 ', h('b', { className: 'num' }, String(totals.deprecated !== undefined ? totals.deprecated : statusCounts.deprecated))),
          h('span', { className: 'dd-chip' }, '缺失 ', h('b', { className: 'num' }, String(totals.missing !== undefined ? totals.missing : statusCounts.missing))),
          h('span', { className: 'dd-chip' }, '占用 ', h('b', { className: 'num' }, formatBytes(totals.bytes !== undefined ? totals.bytes : 0))),
          h('span', { className: 'dd-spacer' }),
          // 表格 / 图墙。图墙是「便捷预览」的主要答案：
          // 一百个资产在表格里根本看不出作品长什么样。
          h('div', { className: 'dd-seg' },
            h('button', {
              className: viewMode === 'table' ? 'on' : '',
              type: 'button',
              title: '表格：字段、引用、完整信息',
              onClick: () => setViewMode('table'),
            }, '表格'),
            h('button', {
              className: viewMode === 'wall' ? 'on' : '',
              type: 'button',
              title: '图墙：只看能出画面的资产',
              onClick: () => setViewMode('wall'),
            }, '图墙'),
          ),
          h('select', {
            className: 'dd-input dd-asset-sort',
            value: sort,
            title: '排序',
            onChange: event => setSort(event.target.value),
          }, Object.keys(ASSET_SORT_LABEL).map(key => h('option', { key: key, value: key }, ASSET_SORT_LABEL[key]))),
          h('input', {
            className: 'dd-input dd-asset-search',
            value: query,
            placeholder: '按 id / 路径 / 备注找…',
            onChange: event => setQuery(event.target.value),
          }),
        ),
        // 分类索引：类型、状态、镜头（场次 → 镜号）三行。
        h('div', { className: 'dd-facets' },
          h('div', { className: 'dd-facet-row' },
            h('span', { className: 'dd-facet-lab' }, '类型'),
            typeChip('', '全部', rows.length, 0),
            groups.map(group => typeChip(
              group.type,
              ASSET_TYPE_LABEL[group.type] || group.type,
              group.count,
              group.bytes,
            )),
          ),
          h('div', { className: 'dd-facet-row' },
            h('span', { className: 'dd-facet-lab' }, '状态'),
            statusChip('', '全部', rows.length),
            statusChip('deprecated', '作废', statusCounts.deprecated),
            statusChip('missing', '缺失', statusCounts.missing),
          ),
          // 镜头：先铺场次（十二个左右），选中一场才展开它的镜号。
          // 七十多个镜号一次铺出来，这一行就变成一堵墙——比列表更难找。
          h('div', { className: 'dd-facet-row' },
            h('span', { className: 'dd-facet-lab' }, '镜头'),
            h('button', {
              className: 'dd-facet' + (sceneFilter === '' ? ' on' : ''),
              type: 'button',
              title: '所有带镜号的资产',
              onClick: () => { setSceneFilter(''); setShotFilter('') },
            },
              h('span', { className: 'nm' }, '全部'),
              h('span', { className: 'ct num' }, String(shotIndex.total)),
            ),
            sceneChips,
            shotIndex.total === 0
              ? h('span', { className: 'dd-note' }, '这批资产还没有镜号')
              : null,
            sceneFilter === '' && shotIndex.total > 0
              ? h('span', { className: 'dd-note dd-facet-hint' }, '点场次展开镜号')
              : null,
          ),
          sceneFilter === '' ? null : h('div', { className: 'dd-facet-row' },
            h('span', { className: 'dd-facet-lab' }, '镜号'),
            h('button', {
              className: 'dd-facet' + (shotFilter === '' ? ' on' : ''),
              type: 'button',
              title: '这一场的全部资产',
              onClick: () => setShotFilter(''),
            },
              h('span', { className: 'nm' }, sceneFilter + ' 全镜'),
              h('span', { className: 'ct num' }, String(sceneGroup ? sceneGroup.count : 0)),
            ),
            shotChips,
          ),
        ),
        h('div', { className: 'dd-scroll' },
          actions ? h(RegisterAssetForm, { actions, busy }) : null,
          visible.length === 0
            ? h('div', { className: 'dd-empty' },
              viewMode === 'wall' ? '当前筛选下没有能出画面的资产。' : '这里没有资产。')
            : (viewMode === 'wall' ? wall : table),
        ),
        // 详情条：表格里被截断的那些值，在这里**完整**给出来。
        // 它挂在滚动区外面（flex:none），所以翻页时它不跟着滚走。
        selected === null ? null : h(AssetDetail, {
          key: selected.id,
          asset: selected,
          onClear: () => setSelectedId(''),
          onOpenImage: onOpenImage,
          onGoto: onGoto,
        }),
        h(Pager, {
          page: current,
          pages: pages,
          total: listed.length,
          size: size,
          onPage: setPage,
        }),
      )
    }

    /**
     * 选中一行的**详情条**。
     *
     * 表格里每个字段都被截断（路径、引用只给前三个），而「这个文件到底是什么」
     * 恰恰要靠完整值回答：路径要能整条选中复制，sha256 要能拿去比对，
     * referencedBy 要能看全（换一张参考图之前，得知道动它会碰到哪几镜）。
     *
     * 没有 hook：它是纯展示，挂在哪一页都不影响 hook 数。
     */
    function AssetDetail(props) {
      const { asset, onClear, onOpenImage, onGoto } = props
      if (asset === null || asset === undefined) return null
      const action = assetActionOf(asset)
      const refs = Array.isArray(asset.referencedBy) ? asset.referencedBy : []
      const cell = (label, value, options) => h('div', {
        className: 'dd-asset-detail-cell' + (options && options.wide ? ' wide' : ''),
      },
        h('span', { className: 'k' }, label),
        h('span', { className: 'v' + (options && options.mono ? ' mono' : '') }, value),
      )
      return h('div', { className: 'dd-asset-detail' },
        h('div', { className: 'dd-asset-detail-head' },
          h('span', { className: 'dd-asset-detail-title', title: asset.id }, asset.id),
          h('span', { className: 'dd-badge ' + assetStatusTone(asset) }, assetStatusLabel(asset)),
          asset.missing === true ? h('span', { className: 'dd-badge fail' }, '缺失') : null,
          h('span', { className: 'dd-note' }, ASSET_TYPE_LABEL[asset.type] || asset.type || '资产'),
          h('span', { className: 'dd-spacer' }),
          action === null ? null : h('button', {
            className: 'dd-btn sm dd-go-btn',
            type: 'button',
            title: action.hint + (action.shotId ? ' · ' + action.shotId : ''),
            onClick: () => {
              if (action.kind === 'goto') {
                if (typeof onGoto === 'function') onGoto(action.stage, action.shotId)
              } else if (typeof onOpenImage === 'function') {
                onOpenImage(asset)
              }
            },
          }, h(Icon, { name: action.icon, size: 12 }), action.label),
          h('button', { className: 'dd-btn sm ghost', type: 'button', onClick: onClear }, '收起'),
        ),
        h('div', { className: 'dd-asset-detail-grid' },
          // id 在头里已经显示过一次，但那里会被省略号截断；这一格保证**完整**的 id
          // 能整条选中（拿去搜、拿去贴进命令里）。
          cell('id', asset.id || '—', { mono: true, wide: true }),
          cell('路径', asset.path || '—', { mono: true, wide: true }),
          cell('sha256 前 12 位', typeof asset.sha256 === 'string' ? asset.sha256.slice(0, 12) : '—', { mono: true }),
          cell('创建时间', formatTime(asset.createdAt), { mono: true }),
          cell('体积', formatBytes(asset.bytes), { mono: true }),
          cell('尺寸', asset.width ? asset.width + '×' + asset.height : '—', { mono: true }),
          cell('镜号', asset.shotId || '—', { mono: true }),
          cell('角色', asset.role || '—', { mono: true }),
          cell('备注', asset.notes || '—', { wide: true }),
          refs.length === 0
            ? cell('引用', '—')
            : h('div', { className: 'dd-asset-detail-cell wide' },
              h('span', { className: 'k' }, '引用它的镜头（' + refs.length + '）'),
              h('span', { className: 'v' },
                h('span', { className: 'dd-refs' },
                  refs.map(shotId => h('button', {
                    key: shotId,
                    className: 'dd-ref',
                    type: 'button',
                    title: '跳到 ' + shotId,
                    onClick: () => { if (typeof onGoto === 'function') onGoto('generate', shotId) },
                  }, shotId)),
                ),
              ),
            ),
        ),
      )
    }

    function LedgerView(props) {
      const { ledger, onGoto } = props
      const [statusFilter, setStatusFilter] = useState('')
      const [page, setPage] = useState(0)
      const totals = ledger && ledger.totals ? ledger.totals : {}
      const entries = ledger && Array.isArray(ledger.entries) ? ledger.entries : []

      const groups = useMemo(() => {
        const map = new Map()
        for (const entry of entries) {
          const key = String(entry.status || 'unknown')
          map.set(key, (map.get(key) || 0) + 1)
        }
        return [...map.entries()].sort((a, b) => b[1] - a[1])
      }, [entries])

      const filtered = useMemo(() => {
        if (statusFilter === '') return entries
        return entries.filter(entry => String(entry.status || 'unknown') === statusFilter)
      }, [entries, statusFilter])

      const pages = Math.max(1, Math.ceil(filtered.length / LEDGER_PAGE_SIZE))
      const current = Math.min(page, pages - 1)
      const visible = filtered.slice(current * LEDGER_PAGE_SIZE, (current + 1) * LEDGER_PAGE_SIZE)
      useEffect(() => { setPage(0) }, [statusFilter])

      // **早退必须在所有 hook 之后。**
      //
      // 以前这里写着「`if (!ledger) return …`」然后才写 `useMemo`——
      // 于是第一次渲染（还没数据）hook 少两个，第二次渲染（数据到了）hook 多两个，
      // React 直接报 #310（渲染的 hook 比上一次多），
      // **整个面板崩成空白**（`docs/dev/rendering.md` R7 的那条教训）。
      //
      // 现在：hook 全在前，无条件跑；数据没到就早退。
      if (!ledger) return h('div', { className: 'dd-empty' }, '正在读取台账…')

      // 开销：按模型分组 + 预算燃烧。台账页不只需要明细，
      // 导演还要能一眼回答「钱花在哪、还剩多少」。
      const byModel = Array.isArray(ledger.byModel) ? ledger.byModel : []
      const budget = ledger.budget
      const spent = typeof totals.costUsd === 'number' ? totals.costUsd : 0
      const limit = budget && typeof budget.limit_usd === 'number' ? budget.limit_usd : undefined
      const burn = limit === undefined || limit <= 0 ? (spent > 0 ? 100 : 0) : Math.min(100, (spent / limit) * 100)
      const maxModelCost = byModel.reduce((max, row) => Math.max(max, typeof row.costUsd === 'number' ? row.costUsd : 0), 0)
      const costPanel = h('div', { className: 'dd-cost' },
        h('div', { className: 'dd-cost-main' },
          h('div', { className: 'dd-cost-line' },
            h('span', { className: 'dd-cost-spent' }, formatUsd(spent)),
            h('span', { className: 'dd-note' },
              limit === undefined ? '未设预算上限' : ' / ' + formatUsd(limit) + ' 预算'),
            h('span', { className: 'dd-spacer' }),
            h('span', { className: 'dd-note' },
              limit === undefined
                ? ''
                : '余 ' + formatUsd(Math.max(0, limit - spent))
                  + (spent > limit ? ' · 已超支' : '')),
          ),
          h('div', { className: 'dd-cost-bar' + (spent > (limit || Infinity) ? ' over' : '') },
            h('i', { style: { width: burn + '%' } }),
          ),
        ),
        byModel.length === 0
          ? h('div', { className: 'dd-note' }, '还没有可分组的花费')
          : h('div', { className: 'dd-cost-models' },
            byModel.map(row => h('div', { className: 'dd-cost-model', key: row.model },
              h('span', { className: 'cm-name' }, row.model),
              h('span', { className: 'cm-bar' },
                h('i', { style: { width: (maxModelCost <= 0 ? 0 : (row.costUsd / maxModelCost) * 100) + '%' } })),
              h('span', { className: 'cm-num' }, formatUsd(row.costUsd)),
              h('span', { className: 'dd-note' }, row.tasks + ' 条'),
            )),
          ),
      )

      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-toolbar' },
          h('span', { className: 'dd-chip' }, '任务 ', h('b', { className: 'num' }, String(totals.tasks !== undefined ? totals.tasks : entries.length))),
          h('span', { className: 'dd-chip' }, '花费 ', h('b', { className: 'num' }, '$' + formatNumber(totals.costUsd || 0, 2))),
          ledger.budget
            ? h('span', { className: 'dd-chip' }, '预算 ', h('b', { className: 'num' }, '$' + formatNumber(ledger.budget.limit_usd || 0, 2)),
              ' · 已用 ', h('b', { className: 'num' }, '$' + formatNumber(ledger.budget.spent_usd || 0, 2)))
            : null,
          h('span', { className: 'dd-spacer' }),
          h('span', { className: 'dd-note' }, '幂等三步：台账 → 提交 → 立刻回写'),
        ),
        costPanel,
        h('div', { className: 'dd-facets' },
          h('div', { className: 'dd-facet-row' },
            h('span', { className: 'dd-facet-lab' }, '状态'),
            h('button', {
              className: 'dd-facet' + (statusFilter === '' ? ' on' : ''), type: 'button',
              onClick: () => setStatusFilter(''),
            }, h('span', { className: 'nm' }, '全部'), h('span', { className: 'ct num' }, String(entries.length))),
            groups.map(([key, count]) => h('button', {
              key: key,
              className: 'dd-facet' + (statusFilter === key ? ' on' : ''), type: 'button',
              onClick: () => setStatusFilter(statusFilter === key ? '' : key),
            }, h('span', { className: 'nm' }, key), h('span', { className: 'ct num' }, String(count)))),
          ),
        ),
        h('div', { className: 'dd-scroll' },
          visible.length === 0
            ? h('div', { className: 'dd-empty' }, '台账是空的。')
            : h('table', { className: 'dd-table' },
              h('thead', null, h('tr', null,
                h('th', null, '镜头'), h('th', null, '状态'), h('th', null, '模型'),
                h('th', { className: 'n' }, '时长'), h('th', { className: 'n' }, '费用'),
                h('th', null, '提交时间'),
                // 台账里**没有完成时刻**（服务端只回 submitted_at / last_query_at），
                // 所以这一列是「提交 → 末次查询」的真实时间，不是编出来的耗时。
                h('th', { className: 'n', title: '提交 → 末次查询（台账没有 succeeded_at）' }, '耗时'),
                h('th', null, 'task_id'),
                h('th', null, '下一步'),
              )),
              h('tbody', null, visible.map(entry => h('tr', { key: (entry.taskId || '') + (entry.shotId || '') + (entry.submittedAt || '') },
                h('td', { className: 'n' },
                  // 台账上的镜头**点一下就跳到那一镜**——台账与生成台之间不该是断的。
                  entry.shotId
                    ? h('button', {
                      className: 'dd-ref',
                      type: 'button',
                      title: '跳到 ' + entry.shotId,
                      onClick: () => { if (typeof onGoto === 'function') onGoto('generate', entry.shotId) },
                    }, entry.shotId)
                    : '—'),
                h('td', null, h('span', {
                  className: 'dd-badge ' + ledgerStatusTone(entry.status),
                }, entry.status || '—')),
                h('td', null, entry.model || '—'),
                h('td', { className: 'n' }, entry.duration ? entry.duration + 's' : '—'),
                h('td', { className: 'n' }, typeof entry.costUsd === 'number' ? '$' + entry.costUsd.toFixed(2) : '—'),
                h('td', { className: 'n' }, formatTime(entry.submittedAt)),
                h('td', { className: 'n', title: '提交 → 末次查询' }, ledgerElapsed(entry) || '—'),
                h('td', { className: 'n', style: { color: 'var(--ink4)' } }, entry.taskId || '—'),
                // 生成完的那一镜，下一步是**验收**——台账不该把人丢回阶段首页。
                h('td', null,
                  entry.shotId
                    ? h('button', {
                      className: 'dd-ref',
                      type: 'button',
                      title: '去验收 ' + entry.shotId,
                      onClick: () => { if (typeof onGoto === 'function') onGoto('verify', entry.shotId) },
                    }, '去验收')
                    : '—'),
              ))),
            ),
        ),
        h(Pager, {
          page: current,
          pages,
          total: filtered.length,
          size: LEDGER_PAGE_SIZE,
          onPage: setPage,
        }),
      )
    }

    // ── 资产页的样式 ──────────────────────────────────────────────────────
    CSS_PARTS.push(`
/* ── 台账开销 ─────────────────────────────────────────────────────────── */
.dd-cost{display:flex;gap:16px;padding:9px 20px 10px;flex:none;flex-wrap:wrap;
  box-shadow:0 1px 0 var(--line) inset}
.dd-cost-main{flex:1 1 240px;min-width:0;display:flex;flex-direction:column;gap:5px}
.dd-cost-line{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}
.dd-cost-spent{font-family:var(--f-mono);font-size:15px;font-weight:600;color:var(--ink);letter-spacing:-.02em}
.dd-cost-bar{position:relative;height:5px;border-radius:3px;background:var(--sunken);box-shadow:var(--e-well);overflow:hidden}
.dd-cost-bar i{position:absolute;inset:0 auto 0 0;background:var(--hot);border-radius:3px;transition:width var(--t-mid) var(--ease)}
.dd-cost-bar.over i{background:var(--sig-fail)}
.dd-cost-models{flex:1 1 300px;min-width:220px;display:flex;flex-direction:column;gap:3px}
.dd-cost-model{display:grid;grid-template-columns:minmax(0,1fr) 70px 64px auto;align-items:center;gap:8px;font-size:11px}
.dd-cost-model .cm-name{font-family:var(--f-mono);color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-cost-model .cm-bar{position:relative;height:4px;border-radius:2px;background:var(--sunken);overflow:hidden}
.dd-cost-model .cm-bar i{position:absolute;inset:0 auto 0 0;background:color-mix(in srgb,var(--hot) 70%,transparent);border-radius:2px}
.dd-cost-model .cm-num{font-family:var(--f-mono);color:var(--ink);text-align:right}
@container dd-root (max-width:760px){
  .dd-cost{gap:9px;padding:8px 14px}
  .dd-cost-model{grid-template-columns:minmax(0,1fr) 56px 60px}
}
/* ── 分类索引 ─────────────────────────────────────────────────────────── */
.dd-facets{display:flex;flex-direction:column;gap:6px;padding:9px 20px 8px;flex:none}
.dd-facets>*{flex:0 0 auto}
.dd-facet-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.dd-facet-lab{
  font-family:var(--f-gauge);font-size:9px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--ink4);flex:none;width:28px;
}
.dd-facet{
  display:inline-flex;align-items:baseline;gap:6px;padding:3px 9px;border-radius:999px;
  font-size:11.5px;color:var(--ink3);box-shadow:inset 0 0 0 .5px var(--line);
  transition:color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease),background var(--t-fast) var(--ease);
}
.dd-facet:hover{color:var(--ink);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-facet.on{color:var(--ink);background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--hot-line)}
.dd-facet .ct{font-family:var(--f-mono);font-size:10.5px;color:var(--ink4)}
.dd-facet.on .ct{color:var(--hot)}
.dd-facet .by{font-family:var(--f-mono);font-size:10px;color:var(--ink4)}
/* 场次 chip 的编号是「坐标」，用等宽字体；提示文字不许把这一行撑宽。 */
.dd-facet.scene .nm{font-family:var(--f-mono);font-size:10.5px}
.dd-facet-hint{flex:0 0 auto;padding-left:2px}
/* 排序 / 搜索 / 视图切换。 */
.dd-asset-search{height:26px;width:210px;flex:none}
.dd-asset-sort{height:26px;width:120px;min-width:0;flex:none}
/* ── 资产表 ───────────────────────────────────────────────────────────── */
.dd-asset-table .th-thumb{width:44px}
.dd-asset-table .td-thumb{width:44px;padding:3px 6px}
.dd-asset-thumb{
  position:relative;display:block;width:36px;height:36px;border-radius:var(--rx-1);overflow:hidden;
  background:var(--sunken);box-shadow:inset 0 0 0 .5px var(--line);cursor:pointer;padding:0;
}
.dd-asset-thumb img{display:block;width:100%;height:100%;object-fit:cover}
.dd-asset-thumb.ph{
  display:grid;place-items:center;font-family:var(--f-gauge);font-size:11px;color:var(--ink4);
  cursor:default;
}
/* 视频缩略图上的播放角标：一眼看出这一格点下去是播，不是看。 */
.dd-asset-thumb-play{
  position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:10px;
  background:linear-gradient(180deg,transparent 38%,rgba(0,0,0,.55));pointer-events:none;
  text-shadow:0 1px 2px rgba(0,0,0,.8);
}
/* 行 = 可选中：点行出详情，点缩略图开浮层（缩略图自己 stopPropagation）。 */
.dd-asset-row{cursor:pointer}
.dd-asset-row.on,.dd-asset-row.on:hover{background:var(--hot-2)}
.td-go{padding:6px 12px;white-space:nowrap}
.dd-go-btn{display:inline-flex;align-items:center;gap:5px;padding:0 8px}
/* 路径本身是个入口（图片/视频），但长得像文字：它不该在表格里抢走注意力。 */
.dd-path-open{
  display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--ink3);font-size:11px;text-align:left;
}
.dd-path-open:hover{color:var(--hot);text-decoration:underline}
/* ── 图墙 ─────────────────────────────────────────────────────────────── */
.dd-asset-wall-hold{padding:14px 20px 26px}
.dd-asset-wall{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(104px,1fr))}
/* 上面那行是**兜底**；下面这条把列数压在 4–6 之间（一屏 4～6 列自适应）：
   6 列时每格刚好分到 (100% - 5×gap)/6，再宽也不会多出第七列。
   max()/百分比万一被浏览器丢掉，整条声明作废，上面那条还在。 */
.dd-asset-wall{grid-template-columns:repeat(auto-fill,minmax(max(88px,calc((100% - 50px)/6)),1fr))}
.dd-asset-tile{display:flex;flex-direction:column;gap:5px;min-width:0;text-align:left}
.dd-asset-tile-frame{
  position:relative;display:block;aspect-ratio:16/9;border-radius:var(--rx-2);overflow:hidden;
  background:var(--sunken);box-shadow:inset 0 0 0 .5px var(--line);
  transition:transform var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-asset-tile:hover .dd-asset-tile-frame{transform:translateY(-2px);box-shadow:var(--e-4)}
.dd-asset-tile.on .dd-asset-tile-frame{box-shadow:inset 0 0 0 1.5px var(--hot)}
.dd-asset-tile.dep .dd-asset-tile-frame{opacity:.55}
.dd-asset-tile-frame img{display:block;width:100%;height:100%;object-fit:cover}
.dd-asset-tile-play{
  position:absolute;inset:0;display:grid;place-items:center;color:#fff;pointer-events:none;
  background:radial-gradient(circle at 50% 50%,rgba(0,0,0,.5),transparent 62%);
}
.dd-asset-tile-mark{
  position:absolute;left:5px;top:4px;font-size:9px;letter-spacing:.08em;color:#fff;
  padding:1px 5px;border-radius:999px;background:var(--sig-warn);pointer-events:none;
}
.dd-asset-tile-cap{
  font-family:var(--f-mono);font-size:10px;color:var(--ink3);padding:0 2px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* ── 详情条 ───────────────────────────────────────────────────────────── */
.dd-asset-detail{
  flex:0 0 auto;max-height:158px;overflow:auto;padding:9px 20px 10px;
  box-shadow:0 -1px 0 var(--line);background:var(--panel-2);
}
.dd-asset-detail-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;min-width:0}
/* 标题能收缩（长 id 省略号），右边那几枚按钮不收缩——顺序反过来就是按钮被挤成一条线。 */
.dd-asset-detail-head .dd-badge,
.dd-asset-detail-head .dd-btn,
.dd-asset-detail-head>.dd-note{flex:0 0 auto}
.dd-asset-detail-title{
  font-family:var(--f-mono);font-size:11.5px;color:var(--ink);min-width:0;max-width:52%;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto;
}
.dd-asset-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:4px 16px}
.dd-asset-detail-cell{display:flex;flex-direction:column;gap:1px;min-width:0}
.dd-asset-detail-cell.wide{grid-column:1 / -1}
.dd-asset-detail-cell .k{
  font-family:var(--f-gauge);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink4);
}
.dd-asset-detail-cell .v{
  font-size:11.5px;color:var(--ink2);min-width:0;overflow-wrap:anywhere;
  /* 路径 / 哈希要能整条选中复制——这是详情条存在的理由之一。 */
  user-select:text;-webkit-user-select:text;
}
.dd-asset-detail-cell .v.mono{font-family:var(--f-mono);font-size:11px}
/* 分页条。 */
.dd-pager{
  display:flex;align-items:center;gap:8px;padding:8px 20px;flex:none;
  box-shadow:0 -1px 0 var(--line);background:var(--panel);
}
.dd-pager>*{flex:0 0 auto}
/* 跨页引用：镜头号点一下就跳到那一镜。 */
.dd-refs{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.dd-ref{
  font-family:var(--f-mono);font-size:10.5px;color:var(--ink3);
  padding:1px 6px;border-radius:var(--rx-1);box-shadow:inset 0 0 0 .5px var(--line);
}
.dd-ref:hover{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
`)
