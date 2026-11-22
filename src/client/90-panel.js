    // ── root ───────────────────────────────────────────────────────────────

    function DramaDesk() {
      const [overview, setOverview] = useState(null)
      const [pipeline, setPipeline] = useState(null)
      const [stages, setStages] = useState(null)
      const [settings, setSettings] = useState(null)
      const [stagePayload, setStagePayload] = useState(null)
      /**
       * 阶段载荷读失败了。
       *
       * 没有它，「读不到」和「正在读」分不开：切阶段时 `setStagePayload(null)`
       * 与 effect 里 `loadStage()` 之间存在**一帧**的空档，那一帧里
       * 界面既没有数据、也还没开始读——以前就是在这里漏出了
       * 「正在看的阶段：generate；拿到载荷的阶段：还没有」这种内部状态。
       * 现在这个空档由「**正在切换**」接管，只有真的失败了才走错误态。
       */
      const [stageError, setStageError] = useState(null)
      /**
       * 阶段载荷**迟迟不来**（请求丢了 / 被掐了）。
       *
       * 没有它，一次没回来的请求就让面板永远停在「正在读取」——
       * 用户看到的是一个转圈的面板，既没有内容也没有退路。
       * 超过两秒还没拿到，就把「重新读取」摆出来，并自动补一次请求。
       */
      const [stageStalled, setStageStalled] = useState(false)
      const [detail, setDetail] = useState(null)
      const [detailLoading, setDetailLoading] = useState(false)
      const [spec, setSpec] = useState(null)
      const [assets, setAssets] = useState(null)
      const [ledger, setLedger] = useState(null)
      const [view, setView] = useState('stage')
      const [specTab, setSpecTab] = useState('rules')
      const [specStage, setSpecStage] = useState('')
      const [selectedShot, setSelectedShot] = useState(null)
      /** 生成台当前在看哪一场。右栏在没有选中镜头时靠它显示场次概览。 */
      const [activeScene, setActiveScene] = useState(null)
      const [workspaceId, setWorkspaceId] = useState('')
      const [viewStage, setViewStage] = useState('')
      const [busy, setBusy] = useState(false)
      const [toast, setToast] = useState(null)
      const [viewer, setViewer] = useState(null)
      /**
       * 放大编辑窗口的请求。
       *
       * 字段们（Editable）不自己渲染浮层——它们只喊一声，**根组件**统一渲染。
       * 这样浮层永远在根上：不被任何中间容器的 `overflow` 裁掉，也不被
       * 别的浮层盖住。
       */
      const [textDialog, setTextDialog] = useState(null)
      useEffect(() => {
        TEXT_DIALOG_HOST = setTextDialog
        return () => { TEXT_DIALOG_HOST = null }
      }, [])

      // ── 侧栏宽度 ────────────────────────────────────────────────────────
      // 右侧两块（镜详情 / 构思会话）各自记住自己的宽度。
      const inspector = usePanelWidth({ storageKey: 'dsh-drama-desk:inspector-width', initial: 420 })
      const chatPanel = usePanelWidth({ storageKey: 'dsh-drama-desk:chat-width', initial: 460 })

      /** 侧栏右上角那枚「全屏」：占满导演工作台这一块，不是占满浏览器。 */
      const fullToggle = (panel, label) => h('button', {
        className: 'dd-icon-btn' + (panel.full ? ' on' : ''),
        type: 'button',
        title: panel.full ? '退出全屏' : label + '全屏（占满工作台）',
        'aria-label': panel.full ? '退出全屏' : label + '全屏',
        onClick: panel.toggleFull,
      }, h(Icon, { name: panel.full ? 'back' : 'expand', size: 13 }))

      const inspectorControls = fullToggle(inspector, '镜详情')
      const chatControls = fullToggle(chatPanel, '会话')
      const [drawer, setDrawer] = useState(false)
      const [fullSettings, setFullSettings] = useState(null)
      const [browseTarget, setBrowseTarget] = useState(null)
      /** null = 自动（作品还是空的就显示首页）；true / false = 用户自己定的。 */
      const [homeMode, setHomeMode] = useState(null)
      /**
       * 构思会话侧栏是否被手动收起。
       *
       * **默认 false = 常驻**：创意阶段不需要点顶栏图标才看得见这扇窗。
       * 收起只是给空间不够时用的，不是「唤起」的前置条件。
       */
      const [chatCollapsed, setChatCollapsed] = useState(false)
      const [conceive, setConceive] = useState(null)
      const [workMenu, setWorkMenu] = useState(false)
      const [newWork, setNewWork] = useState(null)
      const searchRef = useRef(null)
      const toastTimer = useRef(null)
      /** The last revision seen per polled view; unchanged means "don't re-render". */
      const revisions = useRef({})
      /** The pipeline revision the current stage view was built from. */
      const stageRevision = useRef(null)
      /** Whether the panel is actually on screen. The host may keep it mounted but hidden. */
      const visibleRef = useRef(true)
      const rootRef = useRef(null)

      const say = useCallback((message, kind) => {
        setToast(message === undefined ? null : { message, kind })
        if (toastTimer.current) clearTimeout(toastTimer.current)
        if (message !== undefined) {
          toastTimer.current = setTimeout(() => setToast(null), kind === 'err' ? 7000 : 3200)
        }
      }, [])

      // ── polling ───────────────────────────────────────────────────────────
      const reload = useCallback(async () => {
        try {
          const workspace = workspaceId
          // **一次往返**：面板每几秒问一次「现在什么样」，
          // 四个请求就是四倍 HTTP 开销。这里一个端点给全。
          const snapshot = await apiGet('snapshot', { workspace })
          const data = snapshot.overview
          const grid = snapshot.pipeline
          const rail = snapshot.stages
          const config = snapshot.settings
          // **版本号**：数据没变就不重渲染。
          //
          // 面板每几秒轮询一次。如果每次都 setState，React 会重建整棵面板树
          // ——几十个格子销毁再创建、入场动画重播——插件就在给宿主应用收税。
          // 版本号没变 = 一个字节都没变 = 一个格子都不用动。
          const apply = (key, value, setter) => {
            if (value !== null && value !== undefined && typeof value.revision === 'string') {
              if (revisions.current[key] === value.revision) return
              revisions.current[key] = value.revision
            }
            setter(value)
          }
          apply('overview', data, setOverview)
          apply('pipeline', grid, setPipeline)
          apply('stages', rail, setStages)
          apply('settings', config, setSettings)
          const nextWorkspace = workspace || (data.workspaces && data.workspaces[0] ? data.workspaces[0].id : '')
          if (!workspace && nextWorkspace) setWorkspaceId(nextWorkspace)
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
        }
      }, [workspaceId, say])
      useEffect(() => { reload() }, [reload])

      // 面板是否真的在屏幕上。宿主可能把面板留在 DOM 里只是不显示——
      // 那样组件不卸载、轮询也不会停。所以要自己判。
      //
      // 重新可见时**立刻补一次**刷新：藏了多久，回来就该是当下的状态，
      // 而不是最多再等一个轮询周期。
      useEffect(() => {
        const root = rootRef.current
        if (root === null || typeof IntersectionObserver === 'undefined') return undefined
        let wasVisible = true
        const observer = new IntersectionObserver(entries => {
          const visible = entries.some(entry => entry.isIntersecting)
          const becameVisible = visible && !wasVisible
          visibleRef.current = visible
          wasVisible = visible
          if (becameVisible) reload()
        }, { threshold: 0 })
        observer.observe(root)
        return () => observer.disconnect()
      }, [reload])

      // 自动刷新：状态从磁盘派生，界面必须自己跟上。
      //
      // **红线**：插件嵌在别人的主应用里，后台轮询不能变成对方的负担。
      // 所以：
      //   · 面板不可见（切到别的面板 / 窗口最小化）→ 立刻停；
      //   · 轮询间隔由 Host 配置给出（autoRefresh，0 = 关）；
      //   · 一次刷新只发**一个**请求（/snapshot 一次给全）。
      const autoRefreshMs = overview && overview.autoRefresh ? overview.autoRefresh : 0
      useEffect(() => {
        if (!autoRefreshMs || autoRefreshMs < 1000) return undefined
        const tick = () => {
          if (document.visibilityState === 'hidden') return
          if (!visibleRef.current) return
          reload()
        }
        const timer = setInterval(tick, autoRefreshMs)
        const onVisible = () => { if (document.visibilityState === 'visible') tick() }
        document.addEventListener('visibilitychange', onVisible)
        return () => {
          clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisible)
        }
      }, [autoRefreshMs, reload])

      // ── stage view ────────────────────────────────────────────────────────
      const loadStage = useCallback(async stage => {
        if (!stage) return
        setStageError(null)
        try {
          const payload = await apiGet('stage', { workspace: workspaceId, stage })
          setStagePayload(payload)
          stageRevision.current = payload && payload.revision ? payload.revision : null
        } catch (problem) {
          setStageError(problem instanceof Error ? problem.message : String(problem))
          say(problem instanceof Error ? problem.message : String(problem), 'err')
        }
      }, [workspaceId, say])

      const committed = stages ? (stages.committed || stages.current || stages.stage) : undefined

      // 已提交的阶段变了 → 预览阶段跟着回到它。
      useEffect(() => {
        if (!committed) return
        if (viewStage === '') { setViewStage(committed); return }
      }, [committed])

      // 阶段视图：切阶段就换数据；真源变了（轮询发现）就换数据。
      useEffect(() => {
        if (view !== 'stage') return
        if (viewStage === '') return
        loadStage(viewStage)
      }, [view, viewStage, workspaceId])

      useEffect(() => {
        if (view !== 'stage' || !pipeline || viewStage === '') return
        if (stageRevision.current === pipeline.revision) return
        loadStage(viewStage)
      }, [view, pipeline, viewStage])

      useEffect(() => {
        if (view === 'spec' && !spec) {
          apiGet('rules').then(setSpec).catch(problem => say(problem.message, 'err'))
        }
        if (view === 'assets' && !assets) {
          apiGet('assets', { workspace: workspaceId }).then(setAssets).catch(problem => say(problem.message, 'err'))
        }
        if (view === 'ledger' && !ledger) {
          apiGet('ledger', { workspace: workspaceId }).then(setLedger).catch(problem => say(problem.message, 'err'))
        }
      }, [view, spec, assets, ledger, workspaceId, say])

      // ── shot detail ───────────────────────────────────────────────────────
      const openShot = useCallback(async shotId => {
        setSelectedShot(shotId)
        setDetailLoading(true)
        try {
          setDetail(await apiGet('shot', { workspace: workspaceId, shot: shotId }))
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
          setDetail(null)
        } finally {
          setDetailLoading(false)
        }
      }, [workspaceId, say])

      const refreshDetail = useCallback(async () => {
        if (!selectedShot) return
        try {
          setDetail(await apiGet('shot', { workspace: workspaceId, shot: selectedShot }))
        } catch { /* 保留旧详情 */ }
      }, [workspaceId, selectedShot])

      /**
       * Every write goes through here.
       *
       * The write carries the **previewed stage**. The Host saves the content
       * and *then* tries to move the committed stage to it. If the contract's
       * prerequisites block the move, the content is still saved and the
       * reason is reported — 保存与推进**分离**。
       */
      const runEdit = useCallback(async (label, task) => {
        setBusy(true)
        try {
          const result = await task()
          await reload()
          await refreshDetail()
          const stage = result && result.stage
          if (stage && stage.advanced === false) {
            const gaps = stage.gaps && stage.gaps.length > 0 ? '（' + stage.gaps.join('；') + '）' : ''
            say(label + ' · 已保存，但进度未推进：' + (stage.reason || '前置条件不满足') + gaps, 'err')
          } else if (stage && stage.advanced === true) {
            say(label + ' · 已保存，进度推进到 ' + stage.to, 'ok')
          } else {
            say(label, 'ok')
          }
          return result
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
          return undefined
        } finally {
          setBusy(false)
        }
      }, [reload, refreshDetail, say])

      const actions = useMemo(() => ({
        editScene: (sceneId, patch) => runEdit('场次已保存', () => apiPost('edit-scene', {
          workspaceId, sceneId, patch, stage: viewStage,
        })),
        editCharacter: (characterId, patch) => runEdit('角色卡已保存', () => apiPost('edit-character', {
          workspaceId, characterId, patch, stage: viewStage,
        })),
        editBrief: text => runEdit('简报已保存', () => apiPost('edit-brief', {
          workspaceId, text, stage: viewStage,
        })),
        editAsset: (assetId, patch) => runEdit('资产已保存', () => apiPost('edit-asset', {
          workspaceId, assetId, patch, stage: viewStage,
        })),
        editVerify: (shotId, patch) => runEdit('验收已保存', () => apiPost('edit-verify', {
          workspaceId, shotId, patch, stage: viewStage,
        })),
        editShot: (shotId, patch) => runEdit('镜头已保存', () => apiPost('edit-shot', {
          workspaceId, shotId, patch, stage: viewStage,
        })),
        editBeat: (sceneId, request) => runEdit('表演层已保存', () => apiPost('edit-beat', {
          workspaceId, sceneId, stage: viewStage, ...request,
        })),
        annotate: (shotId, note) => runEdit('批注已保存', () => apiPost('annotate-shot', {
          workspaceId, shotId, note, stage: viewStage,
        })),
        savePrompt: (shotId, text) => runEdit('提示词已保存（重新编译会保留你的版本）', () => apiPost('prompt', {
          workspaceId, shotId, text, stage: viewStage,
        })),
        resetPrompt: shotId => runEdit('已丢弃手工改写', () => apiPost('prompt-reset', {
          workspaceId, shotId, stage: viewStage,
        })),
        compileShot: (shotId, checkOnly) => runEdit(
          checkOnly ? '' : '已编译提示词产物',
          async () => {
            const value = await apiPost('compile', { workspaceId, shotId, check: checkOnly === true })
            if (value && value.ok === false) throw new Error(value.error || '编译失败')
            if (checkOnly === true) {
              const stale = value && value.stale ? value.stale : []
              say(stale.length > 0 ? '产物已过期：' + stale.join('、') : '产物与真源一致', stale.length > 0 ? 'err' : 'ok')
            } else {
              const overridden = value && value.overridden ? value.overridden : []
              say('已编译 ' + (value ? value.prompts : 0) + ' 条产物'
                + (overridden.length > 0 ? '；' + overridden.length + ' 镜有手工改写，已保留' : ''), 'ok')
            }
            return value
          },
        ),
      }), [runEdit, workspaceId, viewStage, say])

      // ── settings ──────────────────────────────────────────────────────────
      const saveSettings = useCallback(async draft => {
        await runEdit('设置已保存', () => apiPost('update-settings', {
          projectRoot: draft.projectRoot,
          outputRoot: draft.outputRoot,
          adapter: draft.adapter,
          generationProvider: draft.generationProvider,
          generationModel: draft.generationModel,
          hostProvider: draft.hostProvider,
          hostModel: draft.hostModel,
          autoRefresh: draft.autoRefresh,
        }))
        setDrawer(false)
      }, [runEdit])

      const pickFolder = useCallback(async target => {
        try {
          const result = await apiPost('pick-folder', { target })
          if (result && result.browse === true) {
            setBrowseTarget({ target, path: undefined })
            return
          }
          if (!result || result.cancelled === true) return
          if (result.path) {
            await apiPost('update-settings', target === 'projectRoot'
              ? { projectRoot: result.path }
              : { outputRoot: result.path })
            await reload()
            say(target === 'projectRoot' ? '项目根已设为 ' + result.path : '产物位置已设为 ' + result.path, 'ok')
          }
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
        }
      }, [reload, say])

      /**
       * Open the settings drawer.
       *
       * The polled snapshot carries the **light** settings (paths, adapter,
       * host model). The model catalogue is asked for separately, because
       * listing a provider's models can reach the provider — that is not
       * something to do every few seconds behind the user's back.
       */
      const openDrawer = useCallback(() => {
        setDrawer(true)
        apiGet('settings', { workspace: workspaceId, full: '1' })
          .then(setFullSettings)
          .catch(problem => say(problem instanceof Error ? problem.message : String(problem), 'err'))
      }, [workspaceId, say])

      /**
       * 打开（必要时开设）这个作品的**构思会话**。
       *
       * 会话由 Host 用 `agents.create()` 开成真的 agent 会话（真模型、真工具、
       * `drama-conceive` 技能），id 记在 `state.json` 上——所以换天回来、
       * 换一台机器，还是同一段构思对话。
       *
       * 注意：**进入阶段不会自动走到这里。** 侧栏是常驻的，会话却由用户
       * 主动发起——点侧栏里的「开始对话」才真的建这段会话。
       */
      const openConceive = useCallback(async fresh => {
        if (!workspaceId) {
          say('先选一个作品，或者新建一个——构思会话是挂在作品上的', 'err')
          return
        }
        try {
          const result = await apiPost('conceive-session', { workspaceId, fresh: fresh === true })
          setConceive(result)
          if (fresh === true) say('新对话已开始（旧的那段还在 DSH 的会话列表里）', 'ok')
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
        }
      }, [workspaceId, say])

      // 换了作品 → 重新问一次这个作品的构思会话还在不在（不创建）。
      useEffect(() => {
        if (!workspaceId) {
          setConceive(null)
          return undefined
        }
        let cancelled = false
        apiGet('conceive-session', { workspace: workspaceId })
          .then(value => { if (!cancelled) setConceive(value) })
          .catch(() => { if (!cancelled) setConceive(null) })
        return () => { cancelled = true }
      }, [workspaceId])

      const createWork = useCallback(async () => {
        const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
        const id = 'work-' + stamp
        try {
          await apiPost('workspace', { action: 'create', id, title: '新作品 · ' + id })
          await reload()
          setWorkspaceId(id)
          setSelectedShot(null)
          setDetail(null)
          setAssets(null)
          setLedger(null)
          say('已创建作品 ' + id + '（标题可以在 work.json 里改）', 'ok')
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
        }
      }, [reload, say])

      // ── keyboard ──────────────────────────────────────────────────────────
      useEffect(() => {
        const onKey = event => {
          const target = event.target
          const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
          if (typing) return
          if (event.key === '/') { event.preventDefault(); searchRef.current && searchRef.current.focus(); return }
          if (event.key === 'Escape') { setViewer(null); setDrawer(false); setWorkMenu(false); setBrowseTarget(null); return }
          if (!pipeline) return
          const cells = []
          for (const scene of pipeline.scenes) for (const cell of scene.shots) cells.push(cell)
          const index = cells.findIndex(cell => cell.id === selectedShot)
          if (event.key === 'j' || event.key === 'J') {
            event.preventDefault()
            const next = cells[Math.min(cells.length - 1, index + 1)] || cells[0]
            if (next) openShot(next.id)
            return
          }
          if (event.key === 'k' || event.key === 'K') {
            event.preventDefault()
            const next = cells[Math.max(0, index - 1)] || cells[0]
            if (next) openShot(next.id)
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [pipeline, selectedShot, openShot])

      /**
       * 跨页跳转到某个阶段（可选带上一镜）。
       *
       * 这是「页面之间不割裂」的那根线：资产页里点一个被引用的镜头、
       * 台账页里点一条任务的镜头、规范页里点某个阶段的适用阶段——
       * 都应该**直接落到那一镜上**，而不是把用户丢回阶段首页让他自己找。
       *
       * 阶段切换的规矩与阶段条一样（AGENTS.md §12）：**只有真的换阶段才清载荷**。
       */
      const gotoStage = useCallback((stage, shotId) => {
        if (!stage) return
        setView('stage')
        setHomeMode(false)
        if (stage !== viewStage) {
          setViewStage(stage)
          setStagePayload(null)
          setStageError(null)
          stageRevision.current = null
        }
        if (shotId !== undefined && shotId !== '') openShot(shotId)
      }, [viewStage, openShot])

      const counts = pipeline ? (pipeline.counts || { fail: 0, warn: 0, generated: 0, pass: 0, none: 0 }) : { fail: 0, warn: 0, generated: 0, pass: 0, none: 0 }
      const nav = [
        { id: 'home', glyph: 'grid', label: '首页' },
        { id: 'stage', glyph: 'film', label: '工作台', badge: counts.fail },
        { id: 'spec', glyph: 'spec', label: '规范' },
        { id: 'assets', glyph: 'asset', label: '资产' },
        { id: 'ledger', glyph: 'ledger', label: '台账' },
      ]
      const railStages = stages
        ? (stages.stages || []).map(entry => ({ ...entry, label: STAGE_LABEL[entry.stage] || entry.stage }))
        : []
      const currentWork = overview && overview.workspaces
        ? overview.workspaces.find(work => work.id === workspaceId)
        : undefined

      // 首页出现在两种时候：没有作品，或者这个作品**还没开始设计**。
      const freshWork = currentWork === undefined
        || ((currentWork.shots ?? 0) === 0 && (currentWork.scenes ?? 0) === 0)
      const showHome = view === 'stage' && (homeMode === null ? freshWork : homeMode)
      // 侧栏**常驻**：创意阶段（含首页）不需要点顶栏图标才看得见这扇窗。
      // `chatCollapsed` 只在屏幕挤不下时手动收起，不是「唤起」的前置条件。
      const chatVisible = !chatCollapsed && (showHome || (view === 'stage' && viewStage === 'conceive'))

      const stageData = stagePayload ? stagePayload.data : undefined
      // 用**载荷自己的阶段**来选组件：这样即使 viewStage 刚变、请求还在路上，
      // 也不会出现「已经拿到数据却什么都不显示」的空档。
      const shownStage = stagePayload ? (stagePayload.stage || stagePayload.kind) : viewStage
      const switching = stagePayload !== null && shownStage !== viewStage

      /**
       * 阶段视图的**看门狗**。
       *
       * 请求会丢：浏览器掐掉后台标签的请求、网络抖一下、宿主刚好在忙。
       * 没有看门狗，丢一次请求面板就永远停在「正在读取」——
       * 用户面前是一个转圈的页面，既没有内容也没有退路。
       *
       * 所以：两秒还没拿到载荷，就把「重新读取」摆出来，并**自动补一次**。
       *
       * （这两个 effect 必须放在 `showHome` **之后**——effect 的依赖数组
       * 在渲染时求值，而 `showHome` 是后面才声明的 const。
       * 放在前面会撞上「Cannot access 'showHome' before initialization」，
       * 整个面板直接崩掉。）
       */
      useEffect(() => {
        if (view !== 'stage' || showHome || viewStage === '') {
          setStageStalled(false)
          return
        }
        if (stagePayload !== null || stageError) {
          setStageStalled(false)
          return
        }
        const timer = setTimeout(() => setStageStalled(true), 2000)
        return () => clearTimeout(timer)
      }, [view, showHome, viewStage, stagePayload, stageError])

      // 看门狗响了：补一次请求（载荷到了就自己回到正常态）。
      useEffect(() => {
        if (!stageStalled) return
        loadStage(viewStage)
      }, [stageStalled, viewStage, loadStage])

      // 右栏没有选中镜头时显示什么。
      //
      // 以前这里写的是「在网格里点一镜」——一句说明书，占掉半屏。
      // 现在它给**这一场的概览**：场次是什么、多少镜、哪几镜有问题。
      // 概览里的每一行都能点，点了就切到那一镜。
      const inspectorSheet = useMemo(() => {
        if (viewStage === 'generate' && activeScene) {
          return {
            id: activeScene.id,
            title: activeScene.title,
            summary: activeScene.summary,
            duration: activeScene.duration,
            shots: activeScene.shots || [],
          }
        }
        if (viewStage === 'storyboard' && stageData && Array.isArray(stageData.shots)) {
          return {
            id: '',
            title: '分镜清单',
            summary: '这一阶段的全部镜头。',
            duration: undefined,
            shots: stageData.shots,
          }
        }
        return null
      }, [viewStage, activeScene, stageData])

      return h('div', { className: 'dd', ref: rootRef },
        h('style', null, CSS_PARTS.join('\n')),
        h('div', { className: 'dd-ambient', 'aria-hidden': 'true' }),
        h('div', { className: 'dd-texture', 'aria-hidden': 'true' }),
        // ── masthead ───────────────────────────────────────────────────────
        h('div', { className: 'dd-mast' },
          h('div', { className: 'dd-brand' },
            h('button', {
              className: 'dd-brand-mark',
              onClick: () => { setHomeMode(true); setView('stage') },
              title: '回到首页',
              'aria-label': '回到首页',
            }, h(DramaDeskMark, { size: 24 })),
            h('div', null,
              h('div', { className: 'dd-brand-name' }, t('brand.title', '导演工作台')),
              h('div', { className: 'dd-brand-sub' }, t('brand.subtitle', 'AI 短剧生产线')),
            ),
          ),
          h('span', { className: 'dd-mast-sep' }),
          h('div', { className: 'dd-work' },
            h(Icon, { name: 'project', size: 13 }),
            h('div', {
              className: 'dd-work-trigger',
              onClick: () => setWorkMenu(!workMenu),
              title: '切换作品 / 新建作品',
            },
              h('span', { className: 'dd-work-label' }, '作品'),
              h('span', { className: 'dd-work-title' }, currentWork ? (currentWork.title || currentWork.id) : '没有作品'),
              currentWork && currentWork.shots
                ? h('span', { className: 'dd-work-sub' }, currentWork.shots + ' 镜')
                : null,
            ),
            h('span', { className: 'dd-work-caret' }, h(Icon, { name: 'down', size: 12 })),
            workMenu
              ? h(WorkspaceMenu, {
                works: overview ? overview.workspaces : [],
                current: workspaceId,
                onPick: id => {
                  setWorkspaceId(id)
                  setSelectedShot(null); setDetail(null); setAssets(null); setLedger(null)
                  setHomeMode(null)
                  stageRevision.current = null
                },
                onCreate: createWork,
                onClose: () => setWorkMenu(false),
              })
              : null,
          ),
          // 灯条：导演唯一需要「一眼扫到」的东西。四段灯 + 读数，嵌在一块凹槽里。
          h('div', { className: 'dd-tally' },
            h('div', { className: 'dd-tally-cell', title: '体检判定 FAIL 的镜头' },
              h('span', { className: 'dd-led fail' }), h('b', null, String(counts.fail || 0)), h('span', { className: 'lb' }, 'Fail')),
            h('div', { className: 'dd-tally-cell', title: '体检判定 WARN 的镜头' },
              h('span', { className: 'dd-led warn' }), h('b', null, String(counts.warn || 0)), h('span', { className: 'lb' }, 'Warn')),
            h('div', { className: 'dd-tally-cell', title: '已生成但还没有体检' },
              h('span', { className: 'dd-led gen' }), h('b', null, String(counts.generated || 0)), h('span', { className: 'lb' }, 'Queued')),
            h('div', { className: 'dd-tally-cell', title: '体检通过的镜头' },
              h('span', { className: 'dd-led pass' }), h('b', null, String(counts.pass || 0)), h('span', { className: 'lb' }, 'Pass')),
          ),
          h('div', { className: 'dd-mast-right' },
            overview
              ? h('span', {
                className: 'dd-chip click dd-readout-path',
                title: '产物位置：' + overview.outputRoot + '\n' + (overview.outputRootReason || '') + '\n点击改设置',
                onClick: openDrawer,
              },
                h(Icon, { name: 'asset', size: 12 }),
                h('span', { className: 'path' }, overview.outputRoot),
              )
              : null,
            overview && overview.disk
              ? h('span', { className: 'dd-chip dd-readout-disk', title: '磁盘占用' },
                h('b', { className: 'num' }, Math.round(overview.disk.ratio * 100) + '%'),
                h('span', { className: 'num' }, '剩 ' + formatBytes(overview.disk.free)),
              )
              : null,
            h('button', {
              className: 'dd-icon-btn' + (chatVisible ? ' on' : ''),
              onClick: () => setChatCollapsed(collapsed => !collapsed),
              title: chatVisible ? '收起构思会话' : '展开构思会话',
            }, h(Icon, { name: 'note', size: 14 })),
            h('button', { className: 'dd-icon-btn', onClick: reload, title: t('action.refresh', '刷新') }, h(Icon, { name: 'refresh', size: 14 })),
            h('button', { className: 'dd-icon-btn', onClick: openDrawer, title: t('action.settings', '设置') }, h(Icon, { name: 'settings', size: 14 })),
          ),
        ),
        // ── stage rail ────────────────────────────────────────────────────
        h(StageRail, {
          stages: railStages,
          committed,
          viewing: viewStage,
          busy,
          onPick: stage => {
            // **点节点 = 切视图。** 不确认、不改状态。
            setView('stage')
            setHomeMode(false)
            // **点当前所在的阶段，不许清载荷。**
            //
            // 清了载荷就得有人补回来，而补载荷的 effect 只在
            // `viewStage` **变了**的时候才跑。点同一个节点 = 没变 =
            // 永远不补 —— 于是面板卡在「正在读取」直到天荒地老。
            //
            // 这条坑踩过一次：探针连点两下阶段节点，第二下就白了。
            if (stage === viewStage) {
              // 载荷真的不在（刚才那次请求丢了），补一次；否则什么都不做。
              if (!stagePayload) loadStage(stage)
              return
            }
            setViewStage(stage)
            setStagePayload(null)
            setStageError(null)
            stageRevision.current = null
          },
        }),
        // ── body ──────────────────────────────────────────────────────────
        h('div', { className: 'dd-body' },
          h('div', { className: 'dd-nav' },
            nav.map(item => h('button', {
              key: item.id,
              className: 'dd-nav-btn' + (
                item.id === 'home'
                  ? (showHome ? ' on' : '')
                  : (!showHome && view === item.id ? ' on' : '')
              ),
              onClick: () => {
                if (item.id === 'home') { setView('stage'); setHomeMode(true); return }
                if (item.id === 'stage') setHomeMode(false)
                setView(item.id)
              },
              title: item.label,
            },
              h(Icon, { name: item.glyph, size: 17 }),
              h('span', { className: 'lbl' }, item.label),
              item.badge > 0 ? h('span', { className: 'badge' }, String(item.badge)) : null,
            )),
            h('span', { className: 'dd-spacer' }),
            h('button', {
              className: 'dd-nav-btn' + (drawer ? ' on' : ''),
              onClick: openDrawer,
              title: t('action.settings', '设置'),
            },
              h(Icon, { name: 'settings', size: 17 }),
              h('span', { className: 'lbl' }, '设置'),
            ),
          ),
          h('div', { style: { flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
            view === 'stage' && showHome
              ? h(HomeView, {
                works: overview ? overview.workspaces : [],
                current: workspaceId,
                busy,
                onPick: id => {
                  setWorkspaceId(id)
                  setHomeMode(null)
                  setSelectedShot(null); setDetail(null); setAssets(null); setLedger(null)
                  stageRevision.current = null
                },
                onCreate: createWork,
                onEnter: () => setHomeMode(false),
              })
              : null,
            view === 'stage' && !showHome
              ? (stageError && stageData === undefined
                ? h('div', { className: 'dd-empty' },
                  h('div', { className: 'dd-empty-title' }, (STAGE_LABEL[viewStage] || viewStage) + '阶段读不到'),
                  h('div', null, stageError),
                  h('div', { style: { marginTop: '12px' } },
                    h('button', {
                      className: 'dd-btn primary',
                      onClick: () => { setStagePayload(null); setStageError(null); stageRevision.current = null; loadStage(viewStage) },
                    }, '重新读取')))
                : stageData === undefined || switching
                  ? h('div', { className: 'dd-stagewait' },
                    h('div', { className: 'dd-stagewait-mark' }, h(Icon, { name: 'film', size: 18 })),
                    h('div', { className: 'dd-stagewait-title' },
                      switching
                        ? '正在切换到 ' + (STAGE_LABEL[viewStage] || viewStage)
                        : '正在读取 ' + (STAGE_LABEL[viewStage] || viewStage)),
                    h('div', { className: 'dd-stagewait-bar' }, h('span', null)),
                    // 载荷迟迟不来：给一条**退路**。否则用户面前只有一个
                    // 永远转圈的页面，既没有内容也没有按钮。
                    stageStalled && !switching
                      ? h('div', { className: 'dd-stagewait-actions' },
                        h('button', {
                          className: 'dd-btn sm',
                          onClick: () => { setStagePayload(null); setStageError(null); stageRevision.current = null; loadStage(viewStage) },
                        }, '重新读取'))
                      : null,
                  )
                  : null)
              : null,
              view === 'stage' && !showHome && stageData !== undefined && !switching
                ? (shownStage === 'conceive'
                  ? h(ConceiveView, { data: stageData, busy, actions })
                  : shownStage === 'outline'
                    ? h(OutlineView, { data: stageData, busy, actions, onGoto: stage => {
                      // 「去改表演」：换阶段。同样地，**没换就不清载荷**。
                      if (stage === viewStage) return
                      setViewStage(stage)
                      setStagePayload(null)
                      setStageError(null)
                      stageRevision.current = null
                    } })
                    : shownStage === 'characters'
                      ? h(CharactersView, { data: stageData, busy, actions, workspaceId, onOpenImage: asset => setViewer(asset) })
                      : shownStage === 'script'
                        ? h(ScriptView, { data: stageData, busy, actions })
                        : shownStage === 'storyboard'
                          ? h(StoryboardView, { data: stageData, busy, actions, onOpenShot: openShot })
                          : shownStage === 'generate'
                            ? h(GenerateView, {
                              data: stageData, busy, actions, workspaceId,
                              selectedShot, onSelectShot: openShot,
                              onOpenImage: asset => setViewer(asset),
                              onSceneChange: setActiveScene,
                            })
                            : shownStage === 'verify'
                              ? h(VerifyView, { data: stageData, busy, actions, onOpenShot: openShot })
                              : shownStage === 'assemble'
                                ? h(AssembleView, { data: stageData, onOpenShot: openShot })
                                : h(DeliverView, { data: stageData }))
                : null,
            view === 'spec' ? h(SpecView, { spec, tab: specTab, onTab: setSpecTab, stage: specStage, onStage: setSpecStage, onGoto: gotoStage }) : null,
            view === 'assets' ? h(AssetsView, { assets, workspaceId, onOpenImage: asset => setViewer(asset), onGoto: gotoStage }) : null,
            view === 'ledger' ? h(LedgerView, { ledger, onGoto: gotoStage }) : null,
          ),
          (view === 'stage' && !showHome && (viewStage === 'generate' || viewStage === 'storyboard'))
            ? h('div', {
              className: 'dd-side' + (inspector.full ? ' full' : ''),
              ref: inspector.panelRef,
              style: inspector.style,
            },
              h(ShotDetail, {
                detail,
                loading: detailLoading,
                busy,
                actions,
                workspaceId,
                sheet: inspectorSheet,
                onSelectShot: openShot,
                onClose: () => { setSelectedShot(null); setDetail(null) },
                onOpenImage: asset => setViewer(asset),
                panelControls: inspectorControls,
              }),
              inspector.full ? null : h('div', {
                className: 'dd-side-resize',
                onPointerDown: inspector.startResize,
                title: '拖动调整宽度（' + inspector.width + 'px）',
                role: 'separator',
                'aria-label': '调整侧栏宽度',
              }),
            )
            : null,
          // ── 构思会话（右栏）────────────────────────────────────────────
          // 首页和 conceive 阶段都在，因为「想创意」不是一次性动作，
          // 是一个持续的过程：想 → 写简报 → 改简报，都在同一段对话里。
          chatVisible
            ? h('div', {
              className: 'dd-side' + (chatPanel.full ? ' full' : ''),
              ref: chatPanel.panelRef,
              style: chatPanel.style,
            },
              h(ConceiveChat, {
                sessionId: conceive && conceive.sessionId ? conceive.sessionId : undefined,
                seed: conceive && conceive.seed ? conceive.seed : undefined,
                busy,
                settings,
                canStart: workspaceId !== '',
                onStart: () => openConceive(false),
                onClose: () => setChatCollapsed(true),
                onFresh: () => openConceive(true),
                panelControls: chatControls,
                onGoto: gotoStage,
              }),
              chatPanel.full ? null : h('div', {
                className: 'dd-side-resize',
                onPointerDown: chatPanel.startResize,
                title: '拖动调整宽度（' + chatPanel.width + 'px）',
                role: 'separator',
                'aria-label': '调整侧栏宽度',
              }),
            )
            : null,
        ),
        // ── settings drawer ───────────────────────────────────────────────
        drawer
          ? h(SettingsDrawer, {
            settings,
            busy,
            onClose: () => { setDrawer(false); setBrowseTarget(null) },
            onSave: saveSettings,
            onPickFolder: pickFolder,
          })
          : null,
        browseTarget
          ? h('div', {
            style: {
              position: 'absolute', inset: '0', zIndex: '21', display: 'grid', placeItems: 'center',
              background: 'color-mix(in srgb, var(--bg) 40%, rgba(0,0,0,.75))',
            },
          },
            h('div', { style: { width: 'min(560px,92vw)' } },
              h(FolderBrowser, {
                path: browseTarget.path,
                onPick: path => {
                  const target = browseTarget.target
                  setBrowseTarget(null)
                  apiPost('update-settings', target === 'projectRoot' ? { projectRoot: path } : { outputRoot: path })
                    .then(() => { reload(); say('已设为 ' + path, 'ok') })
                    .catch(problem => say(problem.message, 'err'))
                },
                onClose: () => setBrowseTarget(null),
              })),
            )
          : null,
        // ── toast ─────────────────────────────────────────────────────────
        toast
          ? h('div', { className: 'dd-toast ' + (toast.kind || '') }, toast.message)
          : null,
        // ── viewer ────────────────────────────────────────────────────────
        viewer
          ? h(ImageViewer, {
            asset: viewer,
            src: assetImageUrl(workspaceId, viewer.id),
            onClose: () => setViewer(null),
          })
          : null,
        // ── 放大编辑窗口 ──────────────────────────────────────────────────
        // 浮层里最后渲染 ⇒ 它在最上面。
        textDialog
          ? h(TextDialog, {
            title: textDialog.title,
            value: textDialog.value,
            placeholder: textDialog.placeholder,
            serif: textDialog.serif,
            mono: textDialog.mono,
            onSave: textDialog.onSave,
            onClose: () => setTextDialog(null),
          })
          : null,
      )
    }

    /**
     * The sidebar glyph — 三格.
     *
     * 侧栏是 16px：胶片的片孔在那里会糊成一团，整条片子变成一块深色方块
     * （比邻居的线描重得多）。所以侧栏用**减法**——同一条片上的那三格：
     * 两头空心，中间实心（正在产的那一镜）。
     *
     * 单色（currentColor），与侧栏其它插件同一重量。
     */
    function DramaDeskIcon(props) {
      const size = props.size ?? 18
      return h('svg', {
        width: size, height: size, viewBox: '0 0 64 64', fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true,
        style: { display: 'block', pointerEvents: 'none' },
      }, [
        h('g', { key: 'frames', stroke: 'currentColor', strokeWidth: 3.6, strokeLinejoin: 'round' }, [
          h('path', { key: 'l', d: FILM_GRID_L }),
          h('path', { key: 'r', d: FILM_GRID_R }),
        ]),
        h('path', { key: 'lit', d: FILM_GRID_M, fill: 'currentColor' }),
      ])
    }

    /**
     * 自检出口：把内部组件交给**冒烟测试**渲染。
     *
     * 只有 `globalThis.__DRAMA_DESK_SELF_CHECK__` 为真时才挂出来——而那个标志
     * 只有 `scripts/client-smoke.mjs` 会设（它把 bundle 跑在一个**独立的
     * VM 沙箱**里，沙箱的 globalThis 与页面互不相干）。所以生产环境里
     * 这里什么都不做，也不往 window 上挂任何东西。
     *
     * 为什么要它：组件级的错误（少一个 hook、读了一个 null 字段）**只有真的
     * 渲染一次才会暴露**。根组件的 SSR 冒烟测试够不到那些需要特定数据的分支
     * （台账、资产），于是它们只能靠人肉点——而人肉点会漏。
     */
    if (typeof globalThis !== 'undefined' && globalThis.__DRAMA_DESK_SELF_CHECK__ === true) {
      globalThis.__DRAMA_DESK_INTERNALS__ = {
        Editable, TextDialog, LedgerView, AssetsView, ImageViewer, ConceiveChat, MarkdownLite,
      }
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        CTX = ctx
        try {
          ctx.effect(() => ctx.locale.register(LOCALE_NS, DICT), 'drama-desk: dictionaries')
          const translate = ctx.locale.bind(LOCALE_NS)
          t = (key, fallback) => {
            try {
              const value = translate(key)
              return typeof value === 'string' && value !== '' ? value : fallback
            } catch {
              return fallback
            }
          }
        } catch {
          t = (key, fallback) => fallback
        }

        // The panel itself: a root-scoped keyed slot. Clicking the sidebar
        // entry selects this panel.
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
        }, DramaDesk))

        // The sidebar entry, level with the other plugin entries.
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 6,
          label: () => t('brand.title', '导演工作台'),
        }, DramaDeskIcon))
      },
    }
