    /** The generate stage: scene navigation + the wall. */
    function GenerateView(props) {
      const { data, selectedShot, onSelectShot, busy, actions, workspaceId, onOpenImage, onSceneChange, onGenerationPlan } = props
      const scenes = data.scenes || []
      const [sceneId, setSceneId] = useState('')
      const [filter, setFilter] = useState('all')
      const [query, setQuery] = useState('')
      const [overview, setOverview] = useState(false)

      const counts = data.counts || {}
      const needle = query.trim().toLowerCase()

      /** Filter one scene's shots. */
      const visibleShots = scene => (scene.shots || []).filter(shot => {
        if (needle !== '' && !((shot.id + ' ' + (shot.title || '') + ' ' + (shot.summary || '')).toLowerCase().includes(needle))) return false
        if (filter === 'failed') return shot.status === 'fail' || shot.status === 'warn'
        if (filter === 'generated') return shot.status !== 'none'
        if (filter === 'pending') return shot.status === 'none'
        return true
      })

      const filteredScenes = scenes.map(scene => ({ ...scene, shots: visibleShots(scene) })).filter(scene => scene.shots.length > 0)

      // 默认落在「第一场有问题的戏」上——导演先看要救的地方。
      useEffect(() => {
        if (scenes.length === 0) { setSceneId(''); return }
        if (sceneId && scenes.some(scene => scene.id === sceneId)) return
        const troubled = filteredScenes.find(scene => scene.shots.some(shot => shot.status === 'fail' || shot.status === 'warn'))
        const first = filteredScenes[0] || scenes[0]
        setSceneId((troubled || first).id)
      }, [scenes.map(scene => scene.id).join(','), filter, query])

      const activeScene = scenes.find(scene => scene.id === sceneId)
      const activeIndex = scenes.findIndex(scene => scene.id === sceneId)
      const totalShots = scenes.reduce((sum, scene) => sum + (scene.shots || []).length, 0)
      const shownShots = activeScene ? visibleShots(activeScene) : []

      // 把「现在在看哪一场」报给上层：右栏在没有选中镜头时要有内容可看，
      // 而不是一句「在网格里点一镜」这种说明书。
      useEffect(() => {
        if (onSceneChange) onSceneChange(activeScene || null)
      }, [activeScene ? activeScene.id : '', onSceneChange])

      const strip = h('div', { className: 'dd-strip' },
        scenes.map(scene => {
          const bad = (scene.shots || []).filter(shot => shot.status === 'fail').length
          const warn = (scene.shots || []).filter(shot => shot.status === 'warn').length
          return h('div', {
            key: scene.id,
            className: 'dd-scene-cell' + (scene.id === sceneId ? ' on' : ''),
            title: scene.title || scene.id,
            onClick: () => { setSceneId(scene.id); setOverview(false) },
          },
            h('span', { className: 'sid' }, scene.id),
            h('span', { className: 'nm' }, scene.title || '（无标题）'),
            h('span', { className: 'ct' }, (scene.shots || []).length + '镜'),
            bad > 0 ? h('span', { className: 'dot fail' }) : warn > 0 ? h('span', { className: 'dot warn' }) : h('span', { className: 'dot ok' }),
          )
        }),
      )

      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'generate',
          title: '生成台',
          desc: '网格里的颜色是体检器自己的判定。',
          left: [
            h('span', { className: 'dd-readout' }, h('b', { className: 'num' }, String(totalShots)), ' 镜'),
            h('span', { className: 'dd-readout' }, h('b', { className: 'num' }, String(scenes.length)), ' 场'),
          ],
          right: [
            h('div', { className: 'dd-seg' },
              h('button', { className: filter === 'all' ? 'on' : '', onClick: () => setFilter('all') }, '全部'),
              h('button', { className: filter === 'failed' ? 'on' : '', onClick: () => setFilter('failed') }, '问题'),
              h('button', { className: filter === 'pending' ? 'on' : '', onClick: () => setFilter('pending') }, '未生成'),
              h('button', { className: filter === 'generated' ? 'on' : '', onClick: () => setFilter('generated') }, '已生成'),
            ),
            h('input', {
              className: 'dd-input', value: query, placeholder: '搜索镜号 / 标题 / 内容…',
              onChange: event => setQuery(event.target.value),
            }),
            h('div', { className: 'dd-seg' },
              h('button', { className: !overview ? 'on' : '', onClick: () => setOverview(false) }, '分场'),
              h('button', { className: overview ? 'on' : '', onClick: () => setOverview(true) }, '总览'),
            ),
          ],
        }),
        // ── 生产看板 ────────────────────────────────────────────────────
        // 「做到哪儿了、花了多少」不该去台账页才能拼出来：放在生成台顶上，
        // 一眼扫到进度、在途、预算余量与剩余预估。
        data.board ? h(GenerationBoard, { board: data.board, busy, onPlan: onGenerationPlan }) : null,
        h('div', { className: 'dd-strip-nav' },
          h('button', {
            className: 'dd-icon-btn', disabled: activeIndex <= 0,
            onClick: () => setSceneId(scenes[Math.max(0, activeIndex - 1)].id),
            title: '上一场',
          }, h(Icon, { name: 'chevLeft', size: 13 })),
          strip,
          h('button', {
            className: 'dd-icon-btn', disabled: activeIndex < 0 || activeIndex >= scenes.length - 1,
            onClick: () => setSceneId(scenes[Math.min(scenes.length - 1, activeIndex + 1)].id),
            title: '下一场',
          }, h(Icon, { name: 'chevron', size: 13 })),
        ),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            overview
              ? h('div', null,
                filteredScenes.length === 0
                  ? h('div', { className: 'dd-empty' }, '没有符合条件的镜头')
                  : filteredScenes.map(scene => h('div', { key: scene.id, style: { marginBottom: '18px' } },
                    h('div', { className: 'dd-sceneplate' },
                      h('div', { className: 'sp-id' }, scene.id),
                      h('div', { className: 'sp-main' },
                        h('div', { className: 'sp-title' }, scene.title || ''),
                        h('div', { className: 'sp-sum' }, scene.summary || ''),
                      ),
                      h('div', { className: 'sp-meta' },
                        h('span', { className: 'num' },
                          (scene.shots || []).length + ' 镜 · ' + (scene.duration || 0) + 's'),
                      ),
                    ),
                    h('table', { className: 'dd-table' },
                      h('thead', null, h('tr', null,
                        h('th', null, '镜号'), h('th', null, '标题'), h('th', null, '内容'),
                        h('th', { className: 'n' }, '时长'), h('th', null, '运镜'), h('th', null, '状态'),
                      )),
                      h('tbody', null, scene.shots.map(shot => h('tr', {
                        key: shot.id,
                        className: shot.id === selectedShot ? 'on' : '',
                        onClick: () => onSelectShot(shot.id),
                        style: { cursor: 'pointer' },
                      },
                        h('td', { className: 'n' }, shot.id),
                        h('td', null, shot.title || '—'),
                        h('td', { style: { color: 'var(--ink2)', maxWidth: '420px' } }, shot.summary || '—'),
                        h('td', { className: 'n' }, shot.duration ? shot.duration + 's' : '—'),
                        h('td', { className: 'num' }, shot.camera || '—'),
                        h('td', null, (() => {
                          const signal = shotSignal(shot)
                          return h('span', { className: 'dd-badge ' + signal.key }, signal.label)
                        })()),
                      ))),
                    ),
                  )),
                )
              : activeScene
                ? h('div', null,
                  h('div', { className: 'dd-sceneplate' },
                    h('div', { className: 'sp-id' }, activeScene.id),
                    h('div', { className: 'sp-main' },
                      h('div', { className: 'sp-title' }, activeScene.title || '（无标题）'),
                      h('div', { className: 'sp-sum' }, activeScene.summary || ''),
                    ),
                    h('div', { className: 'sp-meta' },
                      activeScene.qc
                        ? h('span', {
                          className: 'dd-badge ' + (activeScene.qc.verdict === 'FAIL' ? 'fail' : activeScene.qc.verdict === 'WARN' ? 'warn' : 'pass'),
                          title: (activeScene.qc.issues || []).join('；'),
                        }, '表演层 ' + activeScene.qc.verdict)
                        : null,
                      h('span', { className: 'num' },
                        (activeScene.shots || []).length + ' 镜 · ' + (activeScene.duration || 0) + 's'),
                    ),
                  ),
                  shownShots.length === 0
                    ? h('div', { className: 'dd-empty' }, '这一场没有符合筛选条件的镜头')
                    : h('div', { className: 'dd-wall' },
                      shownShots.map((shot, shotIndex) => h(ShotCard, {
                        key: shot.id,
                        shot,
                        index: shotIndex,
                        workspaceId,
                        selected: shot.id === selectedShot,
                        onSelect: onSelectShot,
                      })),
                    ),
                )
                : h('div', { className: 'dd-empty' }, '这个作品还没有镜头'),
          ),
        ),
      )
    }

    /**
     * 生成台顶上的**生产看板**。
     *
     * 它回答三件事，全部来自 Host 的 `generationBoard()`（不从台账页借算）：
     * 做到哪儿了（已生成 / 待登记 / 在途 / 失败 / 未开工）、花了多少（预算余量）、
     * 剩下的还要多少（按单价与实测速度推算）。
     *
     * 「待登记」单独一档：任务成功但文件还没下载登记时，网格里仍然没有画面——
     * 那是**真实存在的一步**，混进「已生成」会让进度说谎。
     */
    function GenerationBoard(props) {
      const { board, busy, onPlan } = props
      const counts = board.counts || {}
      const budget = board.budget || {}
      const forecast = board.forecast || {}
      const speed = board.speed || {}
      const total = Math.max(1, counts.total || 0)
      const donePct = ((counts.done || 0) / total) * 100
      const pendingPct = ((counts.pending || 0) / total) * 100
      const money = value => (typeof value === 'number' ? formatUsd(value) : '—')
      const flying = Array.isArray(board.inFlight) ? board.inFlight : []
      return h('div', { className: 'dd-board' },
        h('div', { className: 'dd-board-p' },
          h('div', { className: 'dd-board-line' },
            h('span', { className: 'dd-board-pct' }, board.progress + '%'),
            h('span', { className: 'dd-board-cap' },
              '已生成 ' + (counts.done || 0) + ' / ' + (counts.total || 0) + ' 镜'),
            h('span', { className: 'dd-board-rest' },
              (counts.pending ? counts.pending + ' 待登记 · ' : '')
              + (counts.inFlight ? counts.inFlight + ' 在途 · ' : '')
              + (counts.failed ? counts.failed + ' 失败 · ' : '')
              + (counts.todo || 0) + ' 未开工'),
          ),
          h('div', { className: 'dd-board-bar', role: 'img', 'aria-label': '生成进度 ' + board.progress + '%' },
            h('i', { style: { width: Math.max(0, Math.min(100, donePct)) + '%' } }),
            pendingPct > 0 ? h('i', { className: 'pending', style: { width: Math.min(100, pendingPct) + '%' } }) : null,
          ),
        ),
        h('div', { className: 'dd-board-money' },
          h('div', null, '已花 ', h('b', null, money(budget.spentUsd)),
            budget.limitUsd === undefined ? ' · 未设预算' : ' / ' + money(budget.limitUsd),
            budget.remainingUsd === undefined ? '' : ' · 余 ' + money(budget.remainingUsd)),
          h('div', null,
            (forecast.shotsLeft || 0) + ' 镜没出',
            forecast.costUsd === undefined ? '' : ' ≈ ' + money(forecast.costUsd),
            forecast.seconds === undefined ? '' : ' · 约 ' + formatSeconds(forecast.seconds)),
          h('div', { className: 'dd-note', title: forecast.basis || '' },
            '均价 ' + money(budget.perShotUsd)
            + (speed.avgSecondsPerShot ? ' · 实测 ' + formatSeconds(speed.avgSecondsPerShot) + '/镜' : '')),
        ),
        h('div', { className: 'dd-board-actions' },
          flying.length > 0
            ? h('div', { className: 'dd-board-fly', title: flying.map(entry => entry.shotId + ' · ' + entry.status).join('\n') },
              h('span', { className: 'dd-led gen' }),
              h('span', null, '在途 ' + flying.length + ' · '
                + flying.slice(0, 2).map(entry => entry.shotId + ' ' + formatSeconds(entry.elapsedSec || 0)).join('、')))
            : null,
          h('button', {
            className: 'dd-btn sm primary', disabled: busy === true,
            title: '算出下一批该提交哪些镜、预计花多少、哪些已经在跑（不会提交任何东西）',
            onClick: () => { if (typeof onPlan === 'function') onPlan(10) },
          }, '生成计划'),
        ),
      )
    }

    /**
     * 生成计划浮层：逐镜「该提交 / 已在跑别重发 / 缺什么」。
     *
     * **它不提交任何东西。** 导演看完，要么把提交清单复制给 agent 走幂等三步，
     * 要么自己回去改提示词。幂等判据是提示词 sha256——台账里同一条指纹意味着
     * 同一个请求，重发就是重复付费。
     */
    function GenerationPlanDrawer(props) {
      const { plan, busy, onClose, onRefresh, onCopy } = props
      const summary = plan ? (plan.summary || {}) : null
      const rows = plan && Array.isArray(plan.rows) ? plan.rows : []
      const actionLabel = { submit: '该提交', skip: '已在跑', blocked: '缺东西' }
      const actionTone = { submit: 'pass', skip: 'warn', blocked: 'fail' }
      const submits = rows.filter(row => row.action === 'submit')
      const copyList = () => {
        const lines = [
          '生成计划 · ' + (plan.workspace ? plan.workspace.id : ''),
          '通道：' + (plan.channel ? (plan.channel.label || plan.channel.channel || '未选') : '未选')
            + (plan.channel && plan.channel.model ? ' · ' + plan.channel.model : ''),
          '该提交 ' + submits.length + ' 镜，预计 ' + (summary && summary.costUsd !== undefined ? formatUsd(summary.costUsd) : '未定价')
            + '，素材时长合计 ' + formatSeconds(summary ? summary.seconds : undefined),
          ...submits.map((row, index) => [
            (index + 1) + '. ' + row.id + ' ' + (row.title || ''),
            '   时长 ' + (row.request.duration ?? '?') + 's · 画幅 ' + (row.request.ratio ?? '?')
              + ' · 参考图 ' + row.request.referenceCount + ' · 提示词 sha ' + (row.prompt.sha256 || '').slice(0, 12),
          ].join('\n')),
          '',
          '提交前先用 drama_desk_generation_plan 复核；提交后按幂等三步回写台账。',
        ]
        onCopy(lines.join('\n'))
      }
      return h('div', { className: 'dd-drawer dd-plan' },
        h('div', { className: 'dd-drawer-head' },
          h(Icon, { name: 'note', size: 14 }),
          h('span', { style: { fontWeight: '600' } }, '生成计划'),
          h('span', { className: 'dd-spacer' }),
          h('button', { className: 'dd-btn sm', disabled: busy, onClick: onRefresh, title: '重新计算（提示词或台账可能刚变）' }, busy ? '计算中…' : '重新计算'),
          h('button', { className: 'dd-icon-btn', onClick: onClose, title: '关闭' }, h(Icon, { name: 'close', size: 13 })),
        ),
        h('div', { className: 'dd-drawer-body' },
          !plan
            ? h('div', { className: 'dd-note' }, busy ? '正在计算…' : '还没有计划')
            : h('div', null,
              summary && summary.channelReady === false
                ? h('div', { className: 'dd-warnbox' },
                  h('b', null, '这条通道现在调不动：'),
                  summary.channelReason || '没有可用的生视频通道',
                  h('div', { className: 'dd-note' }, '计划本身仍然有效：该提交哪些镜、要花多少都算好了。设置 → 生成通道里可以换成自定义通道。'))
                : null,
              h('div', { className: 'dd-plan-sum' },
                h('span', { className: 'dd-badge pass' }, '该提交 ' + (summary ? summary.submit : 0)),
                h('span', { className: 'dd-badge warn' }, '已在跑 ' + (summary ? summary.skip : 0)),
                h('span', { className: 'dd-badge fail' }, '缺东西 ' + (summary ? summary.blocked : 0)),
                h('span', { className: 'dd-spacer' }),
                h('span', { className: 'num' },
                  '预计 ' + (summary && summary.costUsd !== undefined ? formatUsd(summary.costUsd) : '未定价')
                  + ' · 素材 ' + formatSeconds(summary ? summary.seconds : undefined)),
              ),
              h('div', { className: 'dd-note' }, summary ? summary.note : ''),
              h('div', { className: 'dd-plan-actions' },
                h('button', { className: 'dd-btn sm primary', disabled: submits.length === 0, onClick: copyList }, '复制提交清单'),
                h('button', { className: 'dd-btn sm', disabled: !plan, onClick: () => onCopy(JSON.stringify({ channel: plan.channel, summary, submits }, null, 2)) }, '复制 JSON'),
                h('span', { className: 'dd-note' }, '复制给制作助手，由它按幂等三步提交；插件自己不发起付费生成。'),
              ),
              h('div', { className: 'dd-plan-table' },
                h('table', { className: 'dd-table' },
                  h('thead', null, h('tr', null,
                    h('th', null, '镜号'), h('th', null, '动作'), h('th', null, '为什么'), h('th', { className: 'n' }, '费用'))),
                  h('tbody', null, rows.map(row => h('tr', { key: row.id },
                    h('td', { className: 'n' }, row.id),
                    h('td', null, h('span', { className: 'dd-badge ' + (actionTone[row.action] || '') }, actionLabel[row.action] || row.action)),
                    h('td', { className: 'dd-plan-why' },
                      (row.reasons || []).join('；') || '可以直接提交',
                      row.prompt && row.prompt.stale ? h('span', { className: 'dd-badge warn' }, '过期') : null),
                    h('td', { className: 'n' }, row.request && row.request.costUsd !== undefined ? formatUsd(row.request.costUsd) : '—'),
                  ))),
                ),
              ),
            ),
        ),
      )
    }

    CSS_PARTS.push(`
.dd-board{display:flex;align-items:stretch;gap:14px;padding:11px 20px;flex:none;flex-wrap:wrap;
  border-bottom:.5px solid var(--line);background:linear-gradient(180deg,color-mix(in srgb,var(--hot) 4%,var(--panel)),transparent)}
.dd-board-p{flex:1 1 260px;min-width:0}
.dd-board-line{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.dd-board-pct{font-family:var(--f-mono);font-size:16px;font-weight:600;color:var(--ink);letter-spacing:-.03em}
.dd-board-cap{font-size:12px;color:var(--ink2)}
.dd-board-rest{font-size:11px;color:var(--ink3);font-family:var(--f-mono)}
.dd-board-bar{position:relative;height:6px;border-radius:3px;background:var(--sunken);box-shadow:var(--e-well);margin-top:7px;overflow:hidden}
.dd-board-bar i{position:absolute;inset:0 auto 0 0;background:var(--hot);border-radius:3px;transition:width var(--t-mid) var(--ease)}
.dd-board-bar i.pending{background:color-mix(in srgb,var(--sig-fly) 70%,transparent);left:auto;right:0}
.dd-board-money{flex:0 1 300px;min-width:200px;font-size:11.5px;color:var(--ink2);font-family:var(--f-mono);display:flex;flex-direction:column;gap:3px;justify-content:center}
.dd-board-money b{color:var(--ink);font-weight:600}
.dd-board-actions{display:flex;align-items:center;gap:10px;flex:0 0 auto}
.dd-board-fly{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--sig-fly);font-family:var(--f-mono);white-space:nowrap}
.dd-plan{width:min(720px,94%)}
.dd-plan-sum{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 6px}
.dd-plan-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0}
.dd-plan-table{overflow-x:auto;max-width:100%}
.dd-plan-table table{min-width:520px}
.dd-plan-why{color:var(--ink2);font-size:11.5px;line-height:1.5}
@container dd-root (max-width:760px){
  .dd-board{padding:9px 14px;gap:9px}
  .dd-board-money{flex:1 1 100%}
}
`)
