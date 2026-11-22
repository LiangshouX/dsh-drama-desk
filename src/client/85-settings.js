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

    function SettingsDrawer(props) {
      const { settings, onClose, onSave, busy, onPickFolder } = props
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
          hostProvider: settings.hostModel ? settings.hostModel.provider : '',
          hostModel: settings.hostModel ? settings.hostModel.model : '',
          autoRefresh: settings.autoRefresh || 4000,
        })
      }, [settings.projectRoot, settings.outputRoot, settings.adapter, settings.specModel,
        settings.generation, settings.hostModel, settings.autoRefresh])

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
        (adapter.label || adapter.id) + (adapter.title && adapter.title !== adapter.id ? ' · ' + adapter.title : '')))

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
            label: '生成模型（提交生成时用谁）',
            providers,
            providerId: draft.generationProvider,
            modelId: draft.generationModel,
            disabled: busy,
            onProvider: value => setDraft(current => ({ ...current, generationProvider: value, generationModel: '' })),
            onModel: value => set('generationModel', value),
            note: '这里列的是宿主已经配好的模型路由，不需要在本插件里再存一份 API key。',
          }),
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
