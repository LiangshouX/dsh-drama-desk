    // ── assets / ledger ────────────────────────────────────────────────────
    //
    // 资产管理是工作台的主要职能之一。以前这一页是**一个只读的表格**——
    // 资产多起来之后（一百多个），没人能从里面看出「这个作品里有什么」。
    //
    // 现在有三样东西：
    //   ① **分类索引**：按类型 / 状态分组，角标上带数量与体积；
    //   ② **便捷预览**：图片资产直接有缩略图，点开就是大图；
    //   ③ **分页**：作品再大，DOM 里也只有一页那么多行。

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

    /** 一页多少行。DOM 里只留这么多节点。 */
    const ASSET_PAGE_SIZE = 50
    const LEDGER_PAGE_SIZE = 50

    /** 能出缩略图的类型。 */
    function isImageAsset(asset) {
      return asset.type === 'reference_image' || asset.type === 'keyframe'
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

    function AssetsView(props) {
      const { assets, onOpenImage, workspaceId, onGoto } = props
      const [typeFilter, setTypeFilter] = useState('')
      const [statusFilter, setStatusFilter] = useState('')
      const [query, setQuery] = useState('')
      const [needle, setNeedle] = useState('')
      const [page, setPage] = useState(0)

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

      /** 过滤后的清单。 */
      const filtered = useMemo(() => {
        const out = []
        for (const asset of rows) {
          if (typeFilter !== '' && String(asset.type || 'other') !== typeFilter) continue
          if (statusFilter === 'deprecated' && asset.status !== 'deprecated') continue
          if (statusFilter === 'missing' && asset.missing !== true) continue
          if (needle !== '') {
            const hay = [asset.id, asset.path, asset.notes, asset.role, asset.shotId]
              .filter(part => typeof part === 'string')
              .join(' ')
              .toLowerCase()
            if (!hay.includes(needle)) continue
          }
          out.push(asset)
        }
        return out
      }, [rows, typeFilter, statusFilter, needle])

      const pages = Math.max(1, Math.ceil(filtered.length / ASSET_PAGE_SIZE))
      const current = Math.min(page, pages - 1)
      const visible = filtered.slice(current * ASSET_PAGE_SIZE, (current + 1) * ASSET_PAGE_SIZE)

      // 换了筛选条件就回到第一页——否则会停在一个不存在的页码上。
      useEffect(() => { setPage(0) }, [typeFilter, statusFilter, needle])

      if (!assets) return h('div', { className: 'dd-empty' }, '正在读取资产…')

      const totals = assets.totals || {}
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

      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-toolbar' },
          h('span', { className: 'dd-chip' }, '共 ', h('b', { className: 'num' }, String(totals.count !== undefined ? totals.count : rows.length)), ' 个'),
          h('span', { className: 'dd-chip' }, '作废 ', h('b', { className: 'num' }, String(totals.deprecated !== undefined ? totals.deprecated : statusCounts.deprecated))),
          h('span', { className: 'dd-chip' }, '缺失 ', h('b', { className: 'num' }, String(totals.missing !== undefined ? totals.missing : statusCounts.missing))),
          h('span', { className: 'dd-chip' }, '占用 ', h('b', { className: 'num' }, formatBytes(totals.bytes !== undefined ? totals.bytes : 0))),
          h('span', { className: 'dd-spacer' }),
          h('input', {
            className: 'dd-input dd-asset-search',
            value: query,
            placeholder: '按 id / 路径 / 备注找…',
            onChange: event => setQuery(event.target.value),
          }),
        ),
        // 分类索引：一行类型，一行状态。
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
        ),
        h('div', { className: 'dd-scroll' },
          visible.length === 0
            ? h('div', { className: 'dd-empty' }, '这里没有资产。')
            : h('table', { className: 'dd-table dd-asset-table' },
              h('thead', null, h('tr', null,
                h('th', { className: 'th-thumb' }, ''),
                h('th', null, '资产'), h('th', null, '类型'), h('th', null, '状态'),
                h('th', { className: 'n' }, '引用'), h('th', { className: 'n' }, '尺寸'), h('th', { className: 'n' }, '体积'), h('th', null, '路径'),
              )),
              h('tbody', null, visible.map(asset => h('tr', { key: asset.id },
                h('td', { className: 'td-thumb' },
                  isImageAsset(asset) && asset.missing !== true
                    ? h('button', {
                      className: 'dd-asset-thumb',
                      type: 'button',
                      'aria-label': '打开 ' + asset.id,
                      title: '打开 ' + asset.id,
                      onClick: () => onOpenImage(asset),
                    }, h('img', {
                      src: assetImageUrl(workspaceId, asset.id),
                      alt: asset.id,
                      loading: 'lazy',
                      onError: event => { event.currentTarget.style.visibility = 'hidden' },
                    }))
                    : h('span', { className: 'dd-asset-thumb ph' }, (ASSET_TYPE_LABEL[asset.type] || asset.type || '·').slice(0, 1)),
                ),
                h('td', null, asset.id),
                h('td', null, ASSET_TYPE_LABEL[asset.type] || asset.type || '—'),
                h('td', null,
                  h('span', { style: { color: asset.status === 'deprecated' ? 'var(--warn)' : 'var(--ok)' } }, asset.status || 'active'),
                  asset.missing ? h('span', { style: { color: 'var(--danger)', marginLeft: '5px' } }, '缺失') : null,
                ),
                h('td', { className: 'n' },
                  // 引用它的镜头：**点一下就跳到那一镜**。
                  // 资产页与生成台之间本来是断的——找到问题资产，却找不到它出现在哪一镜。
                  (asset.referencedBy || []).length === 0
                    ? '—'
                    : h('span', { className: 'dd-refs' },
                      (asset.referencedBy || []).slice(0, 3).map(shotId => h('button', {
                        key: shotId,
                        className: 'dd-ref',
                        type: 'button',
                        title: '跳到 ' + shotId,
                        onClick: () => { if (typeof onGoto === 'function') onGoto('generate', shotId) },
                      }, shotId)),
                      (asset.referencedBy || []).length > 3
                        ? h('span', { className: 'dd-note' }, '+' + ((asset.referencedBy || []).length - 3))
                        : null,
                    )),
                h('td', { className: 'n' }, asset.width ? asset.width + '×' + asset.height : '—'),
                h('td', { className: 'n' }, formatBytes(asset.bytes)),
                h('td', { className: 'path', title: asset.path },
                  asset.type === 'reference_image' || asset.type === 'keyframe'
                    ? h('button', {
                      className: 'dd-btn sm ghost',
                      onClick: () => onOpenImage(asset),
                    }, asset.path || '—')
                    : (asset.path || '—')),
              ))),
            ),
        ),
        h(Pager, {
          page: current,
          pages,
          total: filtered.length,
          size: ASSET_PAGE_SIZE,
          onPage: setPage,
        }),
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
      // **整个面板崩成空白**（AGENTS.md §11⑤ 的那条教训）。
      //
      // 现在：hook 全在前，无条件跑；数据没到就早退。
      if (!ledger) return h('div', { className: 'dd-empty' }, '正在读取台账…')

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
                h('th', null, '提交时间'), h('th', null, 'task_id'),
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
                  style: {
                    color: entry.status === 'succeeded' ? 'var(--ok)'
                      : entry.status === 'failed' ? 'var(--danger)' : 'var(--warn)',
                  },
                }, entry.status || '—')),
                h('td', null, entry.model || '—'),
                h('td', { className: 'n' }, entry.duration ? entry.duration + 's' : '—'),
                h('td', { className: 'n' }, typeof entry.costUsd === 'number' ? '$' + entry.costUsd.toFixed(2) : '—'),
                h('td', { className: 'n' }, formatTime(entry.submittedAt)),
                h('td', { className: 'n', style: { color: 'var(--ink4)' } }, entry.taskId || '—'),
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
.dd-asset-search{height:26px;width:210px;flex:none}
.dd-asset-table .th-thumb{width:44px}
.dd-asset-table .td-thumb{width:44px;padding:3px 6px}
.dd-asset-thumb{
  display:block;width:36px;height:36px;border-radius:var(--rx-1);overflow:hidden;
  background:var(--sunken);box-shadow:inset 0 0 0 .5px var(--line);cursor:pointer;padding:0;
}
.dd-asset-thumb img{display:block;width:100%;height:100%;object-fit:cover}
.dd-asset-thumb.ph{
  display:grid;place-items:center;font-family:var(--f-gauge);font-size:11px;color:var(--ink4);
  cursor:default;
}
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
