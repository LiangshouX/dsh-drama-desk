    /** One path field: a text box, a folder picker, and why it is this path. */
    function PathRow(props) {
      const { label, value, reason, disabled, onChange, onPick } = props
      return h('div', null,
        h('div', { className: 'dd-field' },
          h('label', null, label),
          h('div', { className: 'dd-pathrow' },
            h('input', {
              className: 'num', value: value, disabled,
              onChange: event => onChange(event.target.value),
            }),
            h('button', { className: 'dd-btn', disabled, onClick: onPick }, '选择…'),
          ),
        ),
        h('div', { className: 'dd-note' }, '为什么是这里：' + (reason || '—')),
      )
    }

    /** One provider + model pair, read from the host's own model registry. */
    function ModelRow(props) {
      const { label, providers, providerId, modelId, disabled, onProvider, onModel, note } = props
      const provider = providers.find(entry => entry.id === providerId)
      const models = provider && Array.isArray(provider.models) ? provider.models : []
      const providerOptions = providers.map(entry =>
        h('option', { value: entry.id, key: entry.id }, entry.name || entry.id))
      const modelOptions = models.map(entry =>
        h('option', { value: entry.id, key: entry.id }, entry.name || entry.id))
      const listId = 'dd-models-' + (providerId || 'none')
      return h('div', null,
        h('div', { className: 'dd-field' },
          h('label', null, label),
          h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } },
            h('select', {
              className: 'dd-input', value: providerId || '', disabled,
              onChange: event => onProvider(event.target.value),
            }, h('option', { value: '' }, '（未选）'), providerOptions),
            // 模型用「可输入的组合框」：宿主不一定公布模型目录，
            // 公布了就给预置，没公布也**能手填**——不然这里就是死路。
            h('div', null,
              h('input', {
                className: 'dd-input', value: modelId || '', disabled,
                list: listId,
                placeholder: models.length === 0 ? '模型 id（可手填）' : '模型 id',
                onChange: event => onModel(event.target.value),
              }),
              h('datalist', { id: listId }, modelOptions),
            ),
          ),
        ),
        note ? h('div', { className: 'dd-note' }, note) : null,
      )
    }

    // ── settings drawer (resizable, with a real folder picker) ─────────────

    const DRAWER_WIDTH_KEY = 'dsh-drama-desk:drawer-width'

    /** 生成器设置的读写片段：设置抽屉与（以后的）别处共用。 */
    function channelDraftOf(settings) {
      const channels = settings && settings.generationChannels ? settings.generationChannels : {}
      const image = channels.image || {}
      const video = channels.video || {}
      return {
        imageChannel: image.channel || '',
        imageModel: image.model || '',
        videoChannel: video.channel || '',
        videoModel: video.model || '',
        channels: Array.isArray(channels.custom) ? channels.custom : [],
        mcodePath: channels.mcodePath || '',
        paidExecution: channels.paidExecution || 'receipt',
      }
    }

    /**
     * 一个生成器（**我们自己实现的**，不是外部软件）。
     *
     * 下拉里是生成器的**产品名**：MiniMax H3 Image / MiniMax H3 视频，
     * 以后接 Qwen Image 也只是多一个名字。这里**不出现** `mcode-tools`、
     * `connector__matrix__…` 这类实现名——那是「怎么连」，不是「用哪个」。
     * 技术细节收在下面的「诊断」折叠区。
     */
    function GeneratorRow(props) {
      const { kind, label, generators, channelId, modelId, disabled, onChannel, onModel, resolved, modelHint } = props
      const list = (generators || []).filter(item => item.kind === kind)
      const ready = resolved && resolved.available === true
      const fallback = list.find(item => item.id === (resolved && resolved.channel))
      const value = channelId || (fallback ? fallback.id : (list[0] ? list[0].id : ''))
      const options = list.length === 0 ? [{ id: '', label: '（还没有生成器）' }] : list
      return h('div', { className: 'dd-channel' },
        h('div', { className: 'dd-channel-head' },
          h('span', { className: 'dd-channel-lb' }, label),
          ready
            ? h('span', { className: 'dd-badge pass' }, '可用')
            : h('span', { className: 'dd-badge fail' }, '不可用'),
        ),
        h('div', { className: 'dd-channel-row' },
          h('select', {
            className: 'dd-input', value, disabled,
            onChange: event => onChannel(event.target.value),
            'aria-label': label,
          }, options.map(item => h('option', { key: item.id || 'none', value: item.id }, item.label || item.id))),
          h('input', {
            className: 'dd-input', value: modelId || '', disabled,
            placeholder: modelHint || '模型（留空用默认）',
            onChange: event => onModel(event.target.value),
            'aria-label': label + '模型',
          }),
        ),
        h('div', { className: 'dd-note' }, ready ? '已就绪' : ((resolved && resolved.reason) || '暂时不可用')),
      )
    }

    function SettingsDrawer(props) {
      const { settings, channels, onClose, onSave, busy, onPickFolder, onRefreshChannels } = props
      const [width, setWidth] = useState(() => {
        try {
          const stored = Number(window.localStorage.getItem(DRAWER_WIDTH_KEY))
          return Number.isFinite(stored) && stored >= 320 && stored <= 900 ? stored : 460
        } catch {
          return 460
        }
      })
      const readDraft = () => ({
        projectRoot: settings.projectRoot || '',
        outputRoot: settings.outputRoot || '',
        adapter: settings.adapter || settings.specModel || '',
        generationProvider: settings.generation ? settings.generation.provider : '',
        generationModel: settings.generation ? settings.generation.model : '',
        ...channelDraftOf(settings),
        hostProvider: settings.hostModel ? settings.hostModel.provider : '',
        hostModel: settings.hostModel ? settings.hostModel.model : '',
        autoRefresh: settings.autoRefresh || 4000,
      })
      const [draft, setDraft] = useState(readDraft)
      useEffect(() => {
        setDraft({
          projectRoot: settings.projectRoot || '',
          outputRoot: settings.outputRoot || '',
          adapter: settings.adapter || settings.specModel || '',
          generationProvider: settings.generation ? settings.generation.provider : '',
          generationModel: settings.generation ? settings.generation.model : '',
          ...channelDraftOf(settings),
          hostProvider: settings.hostModel ? settings.hostModel.provider : '',
          hostModel: settings.hostModel ? settings.hostModel.model : '',
          autoRefresh: settings.autoRefresh || 4000,
        })
      }, [settings.projectRoot, settings.outputRoot, settings.adapter, settings.specModel,
        settings.generation, settings.generationChannels, settings.hostModel, settings.autoRefresh])

      // 宽度可拖。拖的时候用 ref 记账，避免每一帧都 setState。
      const dragRef = useRef(null)
      const startResize = useCallback(event => {
        event.preventDefault()
        dragRef.current = { x: event.clientX, width }
        const onMove = move => {
          const start = dragRef.current
          if (!start) return
          setWidth(Math.min(900, Math.max(320, start.width - (move.clientX - start.x))))
        }
        const onUp = () => {
          dragRef.current = null
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          try { window.localStorage.setItem(DRAWER_WIDTH_KEY, String(width)) } catch { /* ignore */ }
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
      }, [width])

      if (!settings) return null
      const providers = settings.providers || []
      const adapters = settings.adapters || settings.specModels || []
      const picker = settings.picker || { kind: 'browse' }
      const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))

      const pathSection = h('div', null,
        h('h4', null, t('settings.paths', '路径')),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '11px', marginTop: '9px' } },
          h(PathRow, {
            label: '项目根（作品放在哪）',
            value: draft.projectRoot,
            reason: settings.projectRootReason,
            disabled: busy,
            onChange: value => set('projectRoot', value),
            onPick: () => onPickFolder('projectRoot'),
          }),
          h(PathRow, {
            label: '产物位置（成片与资产放哪）',
            value: draft.outputRoot,
            reason: settings.outputRootReason,
            disabled: busy,
            onChange: value => set('outputRoot', value),
            onPick: () => onPickFolder('outputRoot'),
          }),
          h('div', { className: 'dd-note' },
            picker.kind === 'native'
              ? '「选择…」会打开系统文件夹对话框。留空 = 自动：跟随 Windows 的「视频」已知文件夹（搬过盘也跟得住）。'
              : '这个宿主没有原生文件夹对话框，用的是内嵌浏览器。'),
        ),
      )

      const adapterOptions = adapters.map(adapter => h('option', { value: adapter.id, key: adapter.id },
        // `label` 已经含「id · 标题」；再拼一次标题会变成「… · 硬规则 R1–R20 · 硬规则 R1–R20」。
        adapter.label || adapter.id))

      const modelSection = h('div', null,
        h('h4', null, t('settings.model', '模型')),
        h('div', { style: { marginTop: '9px', display: 'flex', flexDirection: 'column', gap: '11px' } },
          h('div', null,
            h('div', { className: 'dd-field' },
              h('label', null, '规范模型适配（铁律来源）'),
              h('select', {
                className: 'dd-input', value: draft.adapter, disabled: busy,
                onChange: event => set('adapter', event.target.value),
              }, adapterOptions),
            ),
            h('div', { className: 'dd-note' }, '规范模型适配 = 规则分层里的那一份（提示词写法 / 体检项 / 接口 quirks）。'),
          ),
          h(ModelRow, {
            label: '宿主模型（这个工作台自己用谁思考）',
            providers,
            providerId: draft.hostProvider,
            modelId: draft.hostModel,
            disabled: busy,
            onProvider: value => setDraft(current => ({ ...current, hostProvider: value, hostModel: '' })),
            onModel: value => set('hostModel', value),
            note: '宿主模型由 DSH 统一管理；这里改的是全局默认模型选择。',
          }),
          h('div', { className: 'dd-note' },
            channels && channels.host
              ? (channels.host.reachable
                ? '宿主模型目录：' + (channels.host.providers || []).length + ' 条路由 · '
                  + (channels.host.modelCount || 0) + ' 个模型'
                : (channels.host.note || '宿主没有公布模型目录'))
              : '模型目录在打开设置时读取。'),
          h('div', null,
            h('div', { className: 'dd-field' },
              h('label', null, '自动刷新间隔 (ms)'),
              h('input', {
                className: 'num', type: 'number', min: '1000', step: '500',
                value: draft.autoRefresh, disabled: busy,
                onChange: event => set('autoRefresh', Number(event.target.value) || 4000),
              }),
            ),
            h('div', { className: 'dd-note' }, '0 = 关闭轮询。轮询只发一个请求；面板不可见时自动停。'),
          ),
        ),
      )

      // ── 生成器 ────────────────────────────────────────────────────────
      // 这里列的是**我们插件实现的生成器**，按产品名选：MiniMax H3 Image / MiniMax H3 视频。
      // 「继承宿主 / mcode-tools / connector__matrix__…」这些是实现细节，不进这一层；
      // 需要排查时它们都在下面的「诊断」里。
      const generators = channels
        ? [...(channels.connectors || []), ...(channels.custom || [])]
        : []
      const selection = channels ? (channels.selection || {}) : {}
      // 本地选择要**立刻**给出可用性：探测结果是「保存前的配置」的答案，
      // 拿它去标刚选的生成器会显示成「不可用」——那是假的。
      const resolveLocal = (kind, channelId, modelId, hostResolved) => {
        if (channelId === '' || channelId === undefined || channelId === 'inherit') return hostResolved
        const hit = generators.find(row => row.id === channelId && row.kind === kind)
        if (hit === undefined) return { mode: 'custom', available: false, reason: '这个生成器不在了（可能来自旧配置）' }
        return {
          mode: 'custom',
          channel: hit.id,
          label: hit.label,
          model: modelId !== '' ? modelId : hit.model,
          available: hit.available === true,
          reason: hit.available === true ? '已就绪（保存后生效）' : '暂时不可用，见诊断',
        }
      }
      const videoModels = (selection.video && selection.video.capabilities && selection.video.capabilities.models) || []
      const modelHintFor = models => (models.length === 0
        ? '模型（留空用默认）'
        : '默认 ' + models[0] + '；可填 ' + models.slice(1).join(' / '))
      const channelSection = h('div', null,
        h('h4', null, '生成器'),
        h('div', { style: { marginTop: '9px', display: 'flex', flexDirection: 'column', gap: '12px' } },
          h(GeneratorRow, {
            kind: 'image', label: '生图生成器',
            generators,
            channelId: draft.imageChannel, modelId: draft.imageModel, disabled: busy,
            onChannel: value => set('imageChannel', value),
            onModel: value => set('imageModel', value),
            resolved: resolveLocal('image', draft.imageChannel, draft.imageModel, selection.image),
            modelHint: '模型（留空用默认）',
          }),
          h(GeneratorRow, {
            kind: 'video', label: '生视频生成器',
            generators,
            channelId: draft.videoChannel, modelId: draft.videoModel, disabled: busy,
            onChannel: value => set('videoChannel', value),
            onModel: value => set('videoModel', value),
            resolved: resolveLocal('video', draft.videoChannel, draft.videoModel, selection.video),
            modelHint: modelHintFor(videoModels),
          }),
          h('div', null,
            h('div', { className: 'dd-field' },
              h('label', null, '付费执行'),
              h('select', {
                className: 'dd-input', value: draft.paidExecution, disabled: busy,
                onChange: event => set('paidExecution', event.target.value),
              },
                h('option', { value: 'receipt' }, '允许执行（必须带计划摘要）'),
                h('option', { value: 'off' }, '只出计划（不提交）'),
              ),
            ),
            h('div', { className: 'dd-note' }, '关掉时任何付费执行都会被拒绝；计划与看板不受影响。'),
          ),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            h('button', {
              className: 'dd-btn sm', type: 'button', disabled: busy || typeof onRefreshChannels !== 'function',
              onClick: onRefreshChannels, title: '重新检测生成器是否就绪',
            }, '重新检测'),
          ),
          // ── 诊断（默认收起）──────────────────────────────────────────
          // 这一块是给「它为什么不可用」用的：组件路径、认证、底层工具名。
          // 产品界面不该出现这些名字，但排查时必须看得到。
          h('details', { className: 'dd-diag' },
            h('summary', null, '诊断'),
            h('div', { className: 'dd-note' },
              '组件：',
              channels && channels.cli && channels.cli.path
                ? channels.cli.path + (channels.cli.source ? '（' + channels.cli.source + '）' : '')
                : '未找到',
              ' · 认证：',
              channels && channels.auth && channels.auth.status
                ? channels.auth.status
                : (channels && channels.auth && channels.auth.error ? '检查失败' : '未检查'),
            ),
            h('div', { className: 'dd-channel-row', style: { marginTop: '8px' } },
              h('input', {
                className: 'dd-input', value: draft.mcodePath, disabled: busy,
                placeholder: '生成组件路径（留空 = 自动；填 off = 禁用）',
                onChange: event => set('mcodePath', event.target.value),
              }),
            ),
            h('div', { className: 'dd-note' },
              '底层工具：',
              (channels && channels.connectors ? channels.connectors : [])
                .map(row => row.tool)
                .filter(Boolean)
                .join(' · ') || '（未探测到）'),
            channels && channels.auth && channels.auth.error
              ? h('div', { className: 'dd-note' }, '认证检查失败：' + channels.auth.error)
              : null,
          ),
        ),
      )

      const actions = settings.editable === false
        ? h('div', { className: 'dd-warnbox' },
          '这个 profile 没有配置编辑器：请手动改 profile 的 cordis.patch.yml 里 drama-desk 那一行。'
          + (settings.patchPath ? '（' + settings.patchPath + '）' : ''))
        : h('div', { style: { display: 'flex', gap: '8px' } },
          h('button', { className: 'dd-btn primary', disabled: busy, onClick: () => onSave(draft) }, t('action.apply', '应用')),
          h('button', { className: 'dd-btn', disabled: busy, onClick: onClose }, t('action.cancel', '取消')),
        )

      const warnings = (settings.warnings || []).map((warning, index) =>
        h('div', { key: index, className: 'dd-warnbox' }, warning))

      const body = h('div', { className: 'dd-drawer-body' },
        warnings,
        pathSection,
        modelSection,
        channelSection,
        actions,
      )

      const head = h('div', { className: 'dd-drawer-head' },
        h(Icon, { name: 'settings', size: 14 }),
        h('span', { style: { fontWeight: '600' } }, t('action.settings', '设置')),
        h('span', { className: 'dd-spacer' }),
        h('span', { className: 'dd-note' }, width + 'px · 可拖动左边缘'),
        h('button', { className: 'dd-icon-btn', onClick: onClose }, h(Icon, { name: 'close', size: 13 })),
      )

      return h('div', { className: 'dd-drawer', style: { width: width + 'px' } },
        h('div', { className: 'dd-resize', onPointerDown: startResize, title: '拖动调整宽度' }),
        head,
        body,
      )
    }

    // ── folder browser (in-drawer fallback when the host has no native picker) ──

    function FolderBrowser(props) {
      const { path, onPick, onClose } = props
      const [listing, setListing] = useState(null)
      const [error, setError] = useState(null)
      const load = useCallback(async next => {
        try {
          setError(null)
          setListing(await apiGet('browse', { path: next }))
        } catch (problem) {
          setError(problem instanceof Error ? problem.message : String(problem))
        }
      }, [])
      useEffect(() => { load(path) }, [load, path])
      if (error) return h('div', { className: 'dd-errorbox' }, error)
      if (!listing) return h('div', { className: 'dd-note' }, '正在读取目录…')
      return h('div', { className: 'dd-browser' },
        h('div', { className: 'dd-browser-path' }, listing.path || '（根）'),
        h('div', { className: 'dd-browser-list' },
          listing.entries.length === 0
            ? h('div', { className: 'dd-note', style: { padding: '10px' } }, '这里没有子目录')
            : listing.entries.map(entry => h('div', {
              key: entry.path,
              className: 'dd-browser-item',
              onClick: () => load(entry.path),
            },
              h(Icon, { name: 'folder', size: 13 }),
              h('span', { className: 'bi-n' }, entry.name),
            )),
        ),
        h('div', { style: { display: 'flex', gap: '7px', padding: '8px', borderTop: '.5px solid var(--line)' } },
          h('button', { className: 'dd-btn sm primary', onClick: () => onPick(listing.path) }, '用这个目录'),
          h('button', { className: 'dd-btn sm', onClick: onClose }, '取消'),
        ),
      )
    }

    // 生成器设置的样式跟着组件走。窄抽屉里这一行要能折成一列。
    CSS_PARTS.push(`
.dd-channel{display:flex;flex-direction:column;gap:5px;padding:9px 10px;border-radius:var(--rx-2);
  background:var(--sunken);box-shadow:var(--e-well)}
.dd-channel-head{display:flex;align-items:center;gap:8px}
.dd-channel-lb{font-size:12px;font-weight:600;color:var(--ink2)}
.dd-channel-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:2px}
/* 诊断：默认收起的技术细节（组件路径 / 认证 / 底层工具名）。 */
.dd-diag{padding-top:8px;border-top:.5px solid var(--line)}
.dd-diag summary{cursor:pointer;font-size:11.5px;color:var(--ink3);user-select:none}
.dd-diag[open] summary{color:var(--ink2);margin-bottom:6px}
@container dd-root (max-width:520px){
  .dd-channel-row{grid-template-columns:1fr}
}
`)
