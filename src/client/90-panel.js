    // ── root ───────────────────────────────────────────────────────────────

    function DramaDesk(props) {
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
      const rootRef = useRef(null)
      const deskWidth = useDeskWidth(rootRef)
      const narrowDesk = deskWidth < 760
      // 文本编辑**不再有浮层**：多行字段在原地展开一块编辑面（见 41-editing.js）。
      // 用户明确否掉了「点击 → 弹出窗口」这个动作，浮层以及它的宿主全删了。
      // 面板根组件因此也不再需要「替字段渲染弹窗」的那套间接层。

      // ── 侧栏宽度 ────────────────────────────────────────────────────────
      // 右侧两块（镜详情 / 构思会话）各自记住自己的宽度。
      const inspector = usePanelWidth({ storageKey: 'dsh-drama-desk:inspector-width', initial: 420, label: '镜详情', maxAvailable: Math.max(320, deskWidth - 424) })
      const chatPanel = usePanelWidth({ storageKey: 'dsh-drama-desk:chat-width', initial: 460, label: '制作助手', maxAvailable: Math.max(320, deskWidth - 424) })

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
       * 构思会话侧栏：**用户有没有亲口说过要它**。
       *
       * `null` = 还没有主见，按场景自动（首页与创意阶段常驻，别处收着）；
       * `true` / `false` = 用户自己点过顶栏那枚图标，从此听他的，并记住。
       *
       * 为什么不能只用「按场景」：`!chatCollapsed && (首页 || 创意阶段)` 会做出一个
       * **死按钮**——在角色/生成/资产页按下「展开构思会话」，state 确实翻转了，
       * 面板却仍被那个条件挡着，屏幕上什么都不会发生。用户点两下就学会了「别点它」。
       *
       * 也不能反过来「一律常驻」：生成阶段本来就有镜详情（默认 420–570px），
       * 再叠一扇 460px 的会话窗，主区会被压成一条缝。所以是**按需**。
       */
      const [chatWanted, setChatWanted] = useState(() => {
        try {
          const stored = window.localStorage.getItem('dsh-drama-desk:chat-open')
          if (stored === '1') return true
          if (stored === '0') return false
        } catch { /* localStorage 不可用就按自动来 */ }
        return null
      })
      const [conceive, setConceive] = useState(null)
      /**
       * 构思会话的**两条异步来路**（「换作品 → 问」与「开会话」）共用这一个序号：
       * 后发先至的响应必须能被认出来。`conceiveFor` 记着当前 conceive 是给哪个
       * 作品的，换作品时先清空，绝不把上一部戏的会话顶着显示。
       */
      const conceiveSeq = useRef(0)
      const conceiveFor = useRef('')
      const [conceiveTick, setConceiveTick] = useState(0)
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
      /**
       * 阶段载荷的请求序号。
       *
       * **过期的响应必须丢掉。** 阶段视图是按「载荷自己的 stage」决定画什么的，
       * 而 `setStagePayload` 是后到的覆盖先到的：在生成台按 F5 之后立刻点「验收」，
       * 生成台那次请求（实测 2.6s）会**晚于**验收那次（1.2s）返回，把载荷盖回 generate，
       * 于是 `shownStage !== viewStage` 恒成立 —— 页面永远停在「正在切换到 验收」，
       * 连「重新读取」的兜底都不出现（它挂在 `!switching` 上）。
       *
       * 这是实测复现出来的，不是理论：网络面板里 verify 两次 200、随后界面不动。
       */
      const stageSeq = useRef(0)
      const loadStage = useCallback(async stage => {
        if (!stage) return
        const seq = stageSeq.current + 1
        stageSeq.current = seq
        setStageError(null)
        try {
          const payload = await apiGet('stage', { workspace: workspaceId, stage })
          if (seq !== stageSeq.current) return
          setStagePayload(payload)
          stageRevision.current = payload && payload.revision ? payload.revision : null
        } catch (problem) {
          if (seq !== stageSeq.current) return
          setStageError(problem instanceof Error ? problem.message : String(problem))
          say(problem instanceof Error ? problem.message : String(problem), 'err')
        }
      }, [workspaceId, say])

      const committed = stages ? (stages.committed || stages.current || stages.stage) : undefined

      /**
       * 写操作要带的阶段：**正在看的阶段**，但**不许把已提交的进度往回带**。
       *
       * 契约 §11.2 说「回退总是允许」——那条针对的是**显式**回退（分镜返工要能只重做
       * 第 7 个镜头）。可这里每一次编辑都会顺手把 `viewStage` 一起发给 Host。
       * 于是「在角色阶段看一眼、顺手改了个错别字」会把已提交进度从 generate
       * **悄悄退回** characters：用户没看到任何提示，下游产物却全成了「过期」。
       * 这是实测出来的（改一次角色卡，state.json 的 stage 就从 generate 变回 characters）。
       *
       * 所以：往回写的时候**不带阶段**，只存内容。要回退是用户的显式动作
       * （让 agent 走 `drama_desk_stage`），不是点一下角色卡片的副作用。
       */
      const writeStage = useMemo(() => {
        if (!stages || viewStage === '') return viewStage
        const rows = stages.stages || []
        const indexOf = stage => rows.findIndex(row => row.stage === stage)
        const from = indexOf(committed)
        const to = indexOf(viewStage)
        if (from < 0 || to < 0) return viewStage
        return to < from ? undefined : viewStage
      }, [stages, committed, viewStage])

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
        if (deskWidth < inspector.width + chatPanel.width + 424) setChatWanted(false)
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
      }, [workspaceId, say, deskWidth, inspector.width, chatPanel.width])

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
            // **一句话，不是一堵墙。** 缺口可能上百条（72 镜里 71 镜没验收），
            // Host 已经给了收好的 `gapsSummary`；只有旧载荷没有它时才退回去自己拼。
            const gaps = stage.gapsSummary
              ? '（' + stage.gapsSummary + '）'
              : (stage.gaps && stage.gaps.length > 0 ? '（' + stage.gaps.slice(0, 3).join('；')
                + (stage.gaps.length > 3 ? '；……另有 ' + (stage.gaps.length - 3) + ' 处' : '') + '）' : '')
            say(label + ' · 已保存，但进度未推进：' + (stage.reason || '前置条件不满足') + gaps, 'err')
          } else if (stage && stage.advanced === true) {
            // 已经在这一阶段时说「推进到 X」是在说假话：什么都没往前。
            say(stage.from === stage.to
              ? label + ' · 进度仍在 ' + stage.to
              : label + ' · 已保存，进度推进到 ' + stage.to, 'ok')
          } else {
            say(label, 'ok')
          }
          return result
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
          // **`false` = 没存上。** 编辑组件靠它决定「留在编辑态还是退出」——
          // 返回 undefined 的话，存失败会被当成成功，草稿就这么没了。
          return false
        } finally {
          setBusy(false)
        }
      }, [reload, refreshDetail, say])

      const actions = useMemo(() => ({
        registerAsset: record => runEdit('本地资产已登记', () => apiPost('register-asset', { workspaceId, ...record })),
        addRecord: (kind, record) => runEdit('已新增记录', () => apiPost('add-record', { workspaceId, kind, ...record, stage: writeStage })),
        assemble: profile => runEdit('本地装配已开始', () => apiPost('assemble', { workspaceId, profile })),
        approveShot: shotId => runEdit('本镜已验收通过', () => apiPost('approve-shot', { workspaceId, shotId })),
        confirmDelivery: assetId => runEdit('已确认交付', () => apiPost('confirm-delivery', { workspaceId, assetId })),
        editScene: (sceneId, patch) => runEdit('场次已保存', () => apiPost('edit-scene', {
          workspaceId, sceneId, patch, stage: writeStage,
        })),
        editCharacter: (characterId, patch) => runEdit('角色卡已保存', () => apiPost('edit-character', {
          workspaceId, characterId, patch, stage: writeStage,
        })),
        editBrief: text => runEdit('简报已保存', () => apiPost('edit-brief', {
          workspaceId, text, stage: writeStage,
        })),
        editAsset: (assetId, patch) => runEdit('资产已保存', () => apiPost('edit-asset', {
          workspaceId, assetId, patch, stage: writeStage,
        })),
        editVerify: (shotId, patch) => runEdit('验收已保存', () => apiPost('edit-verify', {
          workspaceId, shotId, patch, stage: writeStage,
        })),
        editShot: (shotId, patch) => runEdit('镜头已保存', () => apiPost('edit-shot', {
          workspaceId, shotId, patch, stage: writeStage,
        })),
        editBeat: (sceneId, request) => runEdit('表演层已保存', () => apiPost('edit-beat', {
          workspaceId, sceneId, stage: writeStage, ...request,
        })),
        annotate: (shotId, note) => runEdit('批注已保存', () => apiPost('annotate-shot', {
          workspaceId, shotId, note, stage: writeStage,
        })),
        savePrompt: (shotId, text) => runEdit('提示词已保存（重新编译会保留你的版本）', () => apiPost('prompt', {
          workspaceId, shotId, text, stage: writeStage,
        })),
        resetPrompt: shotId => runEdit('已丢弃手工改写', () => apiPost('prompt-reset', {
          workspaceId, shotId, stage: writeStage,
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
      }), [runEdit, workspaceId, writeStage, say])

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
       * `targetId` 是给「从零开始聊」用的：那一步刚刚建了一个草稿作品，
       * `workspaceId` 的 state 还没重新渲染，闭包里的旧值会是空串。
       */
      const openConceive = useCallback(async (fresh, targetId) => {
        const id = typeof targetId === 'string' && targetId !== '' ? targetId : workspaceId
        if (!id) {
          say('先选一个作品；还没想好拍什么就点「从零开始聊」——先聊方向，聊完再立项命名', 'err')
          return
        }
        // 开会话也是一条**异步来路**：它在飞的这段时间里，「换作品 → 问会话」那条
        // GET 可能先回来（那时磁盘上还没有会话）并把结果盖掉。序号在这里的作用与
        // 它在阶段载荷上的作用一样：**后发先至的结果必须能被认出来并丢掉**。
        const seq = (conceiveSeq.current += 1)
        try {
          const result = await apiPost('conceive-session', { workspaceId: id, fresh: fresh === true })
          if (seq === conceiveSeq.current) {
            setConceive(result)
          } else {
            // 期间有更晚的请求：不抢写，请它按磁盘再核一次。
            setConceiveTick(count => count + 1)
          }
          if (fresh === true) say('新对话已开始（旧的那段还在 DSH 的会话列表里）', 'ok')
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
        }
      }, [workspaceId, say])

      // 换了作品 → 重新问一次这个作品的构思会话还在不在（不创建）。
      //
      // **先清空再问。** 不清的话，在响应回来之前 `conceive` 还挂着**上一部戏**的
      // 会话 id，会话窗就会把别人的对话显示成这一部的（实测：切到新建的草稿作品，
      // 右栏还在放 demo-epic 的那段对话，范围条也还写着 demo-epic）。宁可闪一下
      // 「还没开始」，也不能显示错的那一段。
      useEffect(() => {
        if (conceiveFor.current !== workspaceId) {
          conceiveFor.current = workspaceId
          setConceive(null)
        }
        if (!workspaceId) return undefined
        const seq = (conceiveSeq.current += 1)
        let cancelled = false
        apiGet('conceive-session', { workspace: workspaceId })
          .then(value => { if (!cancelled && seq === conceiveSeq.current) setConceive(value) })
          .catch(() => { if (!cancelled && seq === conceiveSeq.current) setConceive(null) })
        return () => { cancelled = true }
      }, [workspaceId, conceiveTick])

      /**
       * 换作品：视图状态跟着那部戏走。
       *
       * 以前只换 id，`viewStage` 留着上一部戏的阶段——切到一部还停在「创意」的
       * 新作品，顶栏却写着「预览 生成 · 已提交进度仍停在 创意」，
       * 看起来像坏了。**阶段是每部戏自己的**，换戏就该回到它的已提交阶段。
       *
       * @param {string} id 作品 id
       * @param {string} [stage] 明确指定要看哪个阶段（新建的空骨架恒为 conceive）
       */
      const switchWork = useCallback((id, stage) => {
        setWorkspaceId(id)
        setSelectedShot(null)
        setDetail(null)
        setAssets(null)
        setLedger(null)
        setHomeMode(null)
        stageRevision.current = null
        if (typeof stage === 'string' && stage !== '') {
          setViewStage(stage)
          return
        }
        const rows = overview !== null && overview !== undefined && Array.isArray(overview.workspaces)
          ? overview.workspaces
          : []
        const next = rows.find(row => row.id === id)
        setViewStage(next !== undefined && typeof next.stage === 'string' && next.stage !== '' ? next.stage : '')
      }, [overview])

      const createWork = useCallback(async () => {
        const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
        const id = 'work-' + stamp
        try {
          await apiPost('workspace', { action: 'create', id, title: '新作品 · ' + id })
          await reload()
          switchWork(id, 'conceive')
          say('已创建作品 ' + id + '（标题可以在 work.json 里改）', 'ok')
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
        }
      }, [reload, say, switchWork])

      /**
       * **从零开始聊**：还没有作品、也还没想好拍什么。
       *
       * 老路是「先建一个空骨架，再开对话」——于是你得先给一个还不存在的故事
       * 起一个 `work-202611221430` 这样的 id，才能开始想它。顺序是反的。
       *
       * 现在：建一个**草稿作品**（名字「未命名作品」，id 暂定 `draft-<时间戳>`），
       * 立刻开一段构思会话，范围文案会明说「草稿、还没立项、先别急着写文件」。
       * 聊出方向之后点「立项命名」（`renameWork`）：改目录名与标题，**同一段对话继续**。
       */
      const startDraft = useCallback(async () => {
        try {
          const created = await apiPost('workspace', { action: 'create', draft: true })
          await reload()
          switchWork(created.id, 'conceive')
          // 用户点这个入口的意图就是「现在开聊」——所以会话直接开，不等第二次点击。
          setChatWanted(true)
          try { window.localStorage.setItem('dsh-drama-desk:chat-open', '1') } catch { /* 存不下就算了 */ }
          await openConceive(false, created.id)
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
        }
      }, [openConceive, reload, say, switchWork])

      /**
       * **立项**：给这个作品定名字与目录 ID（草稿转正）。
       *
       * 改名只动目录名与 `work.json`/`state.json` 里的身份：会话挂在 DSH 工作区
       * 上、cwd 是总根，跟目录名无关，所以**这段对话不换**，接着聊。
       */
      const renameWork = useCallback(async patch => {
        if (!workspaceId) return
        const result = await apiPost('workspace', {
          action: 'rename',
          workspaceId,
          id: patch && patch.id ? patch.id : undefined,
          title: patch && patch.title ? patch.title : undefined,
        })
        await reload()
        setWorkspaceId(result.id)
        stageRevision.current = null
        say('已立项：' + (result.title || result.id) + '（' + result.id + '）', 'ok')
        return result
      }, [reload, say, workspaceId])

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
      /**
       * 跳转要能**回得来**。
       *
       * 「页面之间割裂」有一半是**有去无回**：从资产页点一个镜号落到生成台，
       * 想回资产页得自己找导航——而且那边的筛选与页码已经没了。
       * 这里记下「跳之前站在哪儿」，顶栏给一枚「返回」。
       */
      const [jumpTrail, setJumpTrail] = useState([])
      const pushTrail = useCallback(entry => {
        setJumpTrail(trail => {
          const last = trail[trail.length - 1]
          if (last !== undefined && last.view === entry.view && last.viewStage === entry.viewStage) return trail
          return [...trail, entry].slice(-8)
        })
      }, [])

      /**
       * 回到上一处。
       *
       * 只有真的换阶段才清载荷（与阶段条同一条规矩，见 AGENTS.md §12）。
       */
      const goBack = useCallback(() => {
        const last = jumpTrail[jumpTrail.length - 1]
        if (last === undefined) return
        setJumpTrail(trail => trail.slice(0, -1))
        setView(last.view)
        if (last.view !== 'stage') return
        setHomeMode(false)
        if (last.viewStage !== '' && last.viewStage !== viewStage) {
          setViewStage(last.viewStage)
          setStagePayload(null)
          setStageError(null)
          stageRevision.current = null
        }
        if (last.shot !== null && last.shot !== undefined && last.shot !== '') openShot(last.shot)
        else { setSelectedShot(null); setDetail(null) }
      }, [jumpTrail, viewStage, openShot])

      const gotoStage = useCallback((stage, shotId) => {
        if (!stage) return
        // 跳之前先记下自己站在哪儿（同一处不重复记）。
        if (view !== 'stage' || stage !== viewStage) pushTrail({ view, viewStage, shot: selectedShot })
        setView('stage')
        setHomeMode(false)
        if (stage !== viewStage) {
          setViewStage(stage)
          setStagePayload(null)
          setStageError(null)
          stageRevision.current = null
        }
        if (shotId !== undefined && shotId !== '') openShot(shotId)
      }, [pushTrail, selectedShot, view, viewStage, openShot])

      /** 切到菜单页（资产 / 台账 / 规范…），同样记一条来路。 */
      const gotoView = useCallback(next => {
        if (next === view) return
        pushTrail({ view, viewStage, shot: selectedShot })
        setView(next)
      }, [pushTrail, selectedShot, view, viewStage])

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
      // 构思会话出现在哪儿：**用户说过就听用户的**，没说就按场景。
      //
      // 自动的部分只在「对话本身就是这页的事」的地方（首页 / 创意阶段）默认展开；
      // 生成阶段本来就有镜详情，再叠一扇默认展开的会话窗会把主区压成一条缝。
      // 而那枚图标在**任何**页面都能把窗叫出来——叫出来之后就一直跟着，
      // 于是它再也不是死按钮。
      const chatAuto = showHome || (view === 'stage' && viewStage === 'conceive')
      const chatVisible = chatWanted === null ? chatAuto : chatWanted
      const inspectorWanted = view === 'stage' && !showHome
        && (selectedShot !== null || (!narrowDesk && (viewStage === 'generate' || viewStage === 'storyboard')))
      const inspectorVisible = inspectorWanted
        && (!chatVisible || (!narrowDesk && deskWidth >= inspector.width + chatPanel.width + 424))

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
        if (stageError) {
          setStageStalled(false)
          return
        }
        // **「载荷的 stage 不是正在看的那个」也算没到位。**
        // 以前这里写的是 `stagePayload !== null` 就直接 return：于是「手里握着上一阶段的
        // 载荷、新阶段的请求永远看不到结果」这种卡死状态，看门狗反而是关着的 ——
        // 页面永远停在「正在切换」，连一个「重新读取」都不给。
        const shown = stagePayload === null ? null : (stagePayload.stage || stagePayload.kind)
        if (shown === viewStage) {
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
              currentWork && currentWork.draft === true
                ? h('span', { className: 'dd-work-draft', title: '草稿作品：还没立项，名字与目录 id 都是暂定的' }, '草稿')
                : null,
              currentWork && currentWork.shots
                ? h('span', { className: 'dd-work-sub' }, currentWork.shots + ' 镜')
                : null,
            ),
            h('span', { className: 'dd-work-caret' }, h(Icon, { name: 'down', size: 12 })),
            workMenu
              ? h(WorkspaceMenu, {
                works: overview ? overview.workspaces : [],
                current: workspaceId,
                onPick: switchWork,
                onCreate: createWork,
                onDraft: startDraft,
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
            // **返回**：从哪儿跳过来的，就回哪儿去。
            // 有了它，「点一个镜号跨到别的页」不再是单向门。
            jumpTrail.length > 0
              ? h('button', {
                className: 'dd-chip click dd-back',
                type: 'button',
                title: '回到上一处（' + (jumpTrail[jumpTrail.length - 1].view === 'stage'
                  ? (STAGE_LABEL[jumpTrail[jumpTrail.length - 1].viewStage] || '工作台')
                  : ({ home: '首页', spec: '规范', assets: '资产', ledger: '台账' }[jumpTrail[jumpTrail.length - 1].view] || '上一处'))
                  + (jumpTrail[jumpTrail.length - 1].shot ? ' · ' + jumpTrail[jumpTrail.length - 1].shot : '') + '）',
                onClick: goBack,
              },
                h(Icon, { name: 'back', size: 11 }),
                h('span', null, '返回'),
              )
              : null,
            h('button', {
              className: 'dd-btn sm' + (chatVisible ? ' on' : ''),
              type: 'button',
              onClick: () => {
                const next = !chatVisible
                if (next) inspector.exitFull()
                setChatWanted(next)
                try { window.localStorage.setItem('dsh-drama-desk:chat-open', next ? '1' : '0') } catch { /* 存不下就算了 */ }
              },
              title: chatVisible ? '收起制作助手' : '展开制作助手 · 继续当前阶段',
            }, h(Icon, { name: 'note', size: 14 }), h('span', { style: { marginLeft: '5px', fontSize: '11px' } }, '制作助手')),
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
        // ── 草稿横幅 ──────────────────────────────────────────────────────
        // 还是草稿的作品（从零开始聊建出来的）要**一眼看出「还没立项」**，
        // 并且在这里给出定名与定目录 id 的那一步。首页/工作台都在它下面。
        currentWork !== undefined && currentWork.draft === true
          ? h(DraftBanner, { work: currentWork, busy, onRename: renameWork })
          : null,
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
                if (item.id === 'home') { gotoView('stage'); setHomeMode(true); return }
                if (item.id === 'stage') setHomeMode(false)
                gotoView(item.id)
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
                onPick: switchWork,
                onCreate: createWork,
                onDraft: startDraft,
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
                    // 注意这里是 `stageStalled` 而不是 `stageStalled && !switching`：
                    // 「卡在切换中」正是最需要这条退路的情形，而旧写法恰好把它藏起来。
                    stageStalled
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
                          ? h(StoryboardView, { data: stageData, busy, actions, onOpenShot: openShot, onGoto: gotoStage })
                          : shownStage === 'generate'
                            ? h(GenerateView, {
                              data: stageData, busy, actions, workspaceId,
                              selectedShot, onSelectShot: openShot,
                              onOpenImage: asset => setViewer(asset),
                              onSceneChange: setActiveScene,
                            })
                            : shownStage === 'verify'
                              ? h(VerifyView, { data: stageData, busy, actions, workspaceId, onOpenShot: openShot, onGoto: gotoStage })
                              : shownStage === 'assemble'
                                ? h(AssembleView, { data: stageData, busy, actions, onOpenShot: openShot, onGoto: gotoStage })
                                : h(DeliverView, { data: stageData, busy, actions, workspaceId, onGoto: gotoStage }))
                : null,
            view === 'spec' ? h(SpecView, { spec, tab: specTab, onTab: setSpecTab, stage: specStage, onStage: setSpecStage, onGoto: gotoStage }) : null,
            view === 'assets' ? h(AssetsView, { assets, workspaceId, busy, actions, onOpenImage: asset => setViewer(asset), onGoto: gotoStage }) : null,
            view === 'ledger' ? h(LedgerView, { ledger, onGoto: gotoStage }) : null,
          ),
          // ── 镜详情（右栏）─────────────────────────────────────────────
          // **任何阶段都能看镜头详情**，只要选中了一镜。
          //
          // 以前这里写死了 `(viewStage === 'generate' || 'storyboard')`：在验收页
          // 点一个镜号，`openShot()` 真的发了请求、也真的拿到了详情，**面板却不渲染** ——
          // 屏幕上什么都没发生。那是「页面之间联动性差」最典型的一种：
          // 界面自己知道该给你看什么，只是没画出来。
          //
          // 生成 / 分镜两页即使没选镜也要开：那里默认显示「这一场的概览」。
          inspectorWanted
            ? h('div', {
              className: 'dd-side' + (inspector.full ? ' full' : narrowDesk ? ' overlay' : ''),
              ref: inspector.panelRef,
              style: { ...inspector.style, ...(inspectorVisible ? {} : { display: 'none' }) },
              'data-resizing': inspector.dragging ? 'true' : 'false',
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
              inspector.dragging
                ? h('span', { className: 'dd-side-size' }, inspector.width + 'px')
                : null,
              inspector.full ? null : h('div', {
                className: 'dd-side-resize',
                ...inspector.resizeProps,
              }),
            )
            : null,
          // ── 构思会话（右栏）────────────────────────────────────────────
          // 首页和 conceive 阶段都在，因为「想创意」不是一次性动作，
          // 是一个持续的过程：想 → 写简报 → 改简报，都在同一段对话里。
          chatVisible
            ? h('div', {
              className: 'dd-side' + (chatPanel.full ? ' full' : narrowDesk ? ' overlay' : ''),
              ref: chatPanel.panelRef,
              style: chatPanel.style,
              'data-resizing': chatPanel.dragging ? 'true' : 'false',
            },
              h(ConceiveChat, {
                stage: viewStage || 'conceive',
                sessionId: conceive && conceive.sessionId ? conceive.sessionId : undefined,
                busy,
                canStart: workspaceId !== '',
                // **范围钉在哪个作品上**：会话窗每绑住一段会话就请 Host 把这个
                // 作品的目录 ID 与作品名挂成它的 prompt context（见 conceive-scope）。
                workspaceId,
                onStart: () => openConceive(false),
                // 还没有作品时，空态那颗按钮变成「从零开始聊」：建草稿 + 直接开聊。
                onDraft: startDraft,
                onClose: () => {
                  setChatWanted(false)
                  try { window.localStorage.setItem('dsh-drama-desk:chat-open', '0') } catch { /* 存不下就算了 */ }
                },
                onFresh: () => openConceive(true),
                panelControls: chatControls,
                dshWorkspaceId: conceive && conceive.dshWorkspace ? conceive.dshWorkspace.id : undefined,
                // 这两样是**宿主发给槽占位者**的标准道具（见 apply 里 main 的
                // `children` 声明）：只有声明了 session 作用域的子槽，宿主才会把
                // `SessionProvider` 与 `renderSlot` 交过来——原生对话就靠它嵌进来。
                SessionProvider: props === undefined ? undefined : props.SessionProvider,
                renderSlot: props === undefined ? undefined : props.renderSlot,
              }),
              chatPanel.dragging
                ? h('span', { className: 'dd-side-size' }, chatPanel.width + 'px')
                : null,
              chatPanel.full ? null : h('div', {
                className: 'dd-side-resize',
                ...chatPanel.resizeProps,
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
        Editable, LedgerView, AssetsView, ImageViewer, ConceiveChat, MarkdownLite,
        OutlineView, CharactersView, StoryboardView, VerifyView, AssembleView, DeliverView,
        ConceiveSessionMenu,
      }
    }

    return {
      inject: ['slots', 'locale', 'sessions', 'remote', 'remote.userQuestions', 'uiConversation'],
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
        //
        // **`children` 里那条 session 作用域的子槽是功能性的，不是装饰**：
        // 只有声明了非 root 作用域的子槽，宿主的渲染器才会把 `SessionProvider`
        // 与 `renderSlot` 交给这个占位者（见 ui-renderer 的 `standardKit`）。
        // 没有它们就绑不住「这一段会话」，宿主的原生对话也就嵌不进来。
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          children: { 'drama-desk.conversation': { kind: 'single', scope: 'session' } },
        }, DramaDesk))

        // 那一格子槽里放什么：宿主 `conversation.content` 工厂的 embedded 形态。
        ctx.slots.inject('drama-desk.conversation', () => ctx.slots.register({
          name: 'drama-desk.conversation',
        }, DeskConversationBody))

        // The sidebar entry, level with the other plugin entries.
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 6,
          label: () => t('brand.title', '导演工作台'),
        }, DramaDeskIcon))
      },
    }
