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

    /** 生成通道的读写片段：设置抽屉与（以后的）别处共用。 */
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
      }
    }

    /**
     * 一条生成通道的选择行。
     *
     * `inherit`（空值）是默认：**用宿主已经装好的连接器**。选了具体 id 就是
     * 本插件自己的决定（自治）。不可用的通道仍然列出来但禁用——导演要能看见
     * 「有这条通道、但现在调不动、为什么」，而不是它凭空消失。
     */
    function ChannelRow(props) {
      const { kind, label, channels, channelId, modelId, disabled, onChannel, onModel, resolved } = props
      const list = (channels || []).filter(channel => channel.kind === kind)
      const ready = resolved && resolved.available === true
      return h('div', { className: 'dd-channel' },
        h('div', { className: 'dd-channel-head' },
          h('span', { className: 'dd-channel-lb' }, label),
          ready
            ? h('span', { className: 'dd-badge pass' }, '可用')
            : h('span', { className: 'dd-badge fail' }, '不可用'),
        ),
        h('div', { className: 'dd-channel-row' },
          h('select', {
            className: 'dd-input', value: channelId || '', disabled,
            onChange: event => onChannel(event.target.value),
            'aria-label': label,
          },
            h('option', { value: '' }, '继承宿主（用宿主装好的连接器）'),
            list.map(channel => h('option', {
              key: channel.id, value: channel.id,
              // 不可用的也给选：选完能看到「为什么调不动」，比选不到好排查。
            }, channel.label + (channel.installed ? '' : '（现在不可用）'))),
          ),
          h('input', {
            className: 'dd-input', value: modelId || '', disabled,
            placeholder: '模型 id（留空用通道默认）',
            onChange: event => onModel(event.target.value),
            'aria-label': label + '模型 id',
          }),
        ),
        ready
          ? null
          : h('div', { className: 'dd-note' }, (resolved && resolved.reason) || '这条通道现在不可用'),
        ready && resolved.mode === 'inherit'
          ? h('div', { className: 'dd-note' }, '继承宿主：' + (resolved.label || '') + '（' + (resolved.tool || '未记录工具') + '）')
          : null,
      )
    }

    /**
     * 自定义通道编辑器（自治）。
     *
     * 只存「用什么」：id、种类、显示名、模型 id、可选工具名。**不存密钥**——
     * 密钥归宿主的凭据服务；插件这边只是告诉 agent「该走哪条路」。
     */
    function CustomChannelEditor(props) {
      const { channels, disabled, onChange } = props
      const [draft, setDraft] = useState({ id: '', kind: 'video', label: '', model: '' })
      const list = Array.isArray(channels) ? channels : []
      const add = () => {
        const id = draft.id.trim()
        if (id === '') return
        if (list.some(row => row.id === id)) return
        const row = { id, kind: draft.kind === 'image' ? 'image' : 'video' }
        if (draft.label.trim() !== '') row.label = draft.label.trim()
        if (draft.model.trim() !== '') row.model = draft.model.trim()
        onChange([...list, row])
        setDraft({ id: '', kind: draft.kind, label: '', model: '' })
      }
      const remove = id => onChange(list.filter(row => row.id !== id))
      return h('div', { className: 'dd-custom-ch' },
        h('div', { className: 'dd-note' }, '自定义通道（自治）：给「宿主没装的那条路」起个名字。不存密钥；提交仍由 agent 走它自己的工具。'),
        list.map(row => h('div', { className: 'dd-custom-row', key: row.id },
          h('span', { className: 'dd-badge' }, row.kind === 'image' ? '生图' : '生视频'),
          h('b', null, row.id),
          h('span', { className: 'dd-note' }, row.label || ''),
          row.model ? h('span', { className: 'dd-note' }, row.model) : null,
          h('span', { className: 'dd-spacer' }),
          h('button', { className: 'dd-icon-btn', type: 'button', disabled, title: '删掉这条通道', onClick: () => remove(row.id) }, h(Icon, { name: 'trash', size: 12 })),
        )),
        h('div', { className: 'dd-channel-row' },
          h('select', {
            className: 'dd-input', value: draft.kind, disabled,
            onChange: event => setDraft({ ...draft, kind: event.target.value }),
            'aria-label': '新通道种类',
          }, h('option', { value: 'video' }, '生视频'), h('option', { value: 'image' }, '生图')),
          h('input', {
            className: 'dd-input', value: draft.id, disabled, placeholder: '通道 id（必填，如 my-video）',
            onChange: event => setDraft({ ...draft, id: event.target.value }),
          }),
          h('input', {
            className: 'dd-input', value: draft.label, disabled, placeholder: '显示名（可选）',
            onChange: event => setDraft({ ...draft, label: event.target.value }),
          }),
          h('input', {
            className: 'dd-input', value: draft.model, disabled, placeholder: '模型 id（可选）',
            onChange: event => setDraft({ ...draft, model: event.target.value }),
          }),
          h('button', { className: 'dd-btn sm', type: 'button', disabled: disabled || draft.id.trim() === '', onClick: add }, '添加'),
        ),
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
            label: '生成模型（提交生成时用谁 · 旧字段）',
            providers,
            providerId: draft.generationProvider,
            modelId: draft.generationModel,
            disabled: busy,
            onProvider: value => setDraft(current => ({ ...current, generationProvider: value, generationModel: '' })),
            onModel: value => set('generationModel', value),
            note: '这一对是 0.2 时的字段，等价于下面的「生视频通道」；保留是为了不弄坏已有的 profile。',
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

      // ── 生成通道（生图 / 生视频）───────────────────────────────────────
      // 「继承宿主」= 用宿主已经装好的连接器；「自治」= 本插件指定或自定义一条。
      // 这里同时给出**可用性**与**为什么不可用**：通道配置最怕的就是
      // 「我配了但它其实调不动」这种沉默失败。
      // 通道列表 = 宿主探测到的 + **这次刚加进草稿的自定义通道**。
      // 只在保存后才出现在下拉里会让人以为「加了没用」。
      const probedCustom = channels ? (channels.custom || []) : []
      const draftCustom = Array.isArray(draft.channels) ? draft.channels : []
      const mergedChannels = [
        ...(channels ? (channels.connectors || []) : []),
        ...probedCustom,
        ...draftCustom
          .filter(row => !probedCustom.some(known => known.id === row.id))
          .map(row => ({ ...row, custom: true, installed: true })),
      ]
      const selection = channels ? (channels.selection || {}) : {}
      // 本地选择要**立刻**给出可用性：探测结果是「保存前的配置」的答案，
      // 拿它去标刚选的通道会显示成「不可用」——那是假的。
      const resolveLocal = (kind, channelId, modelId, hostResolved) => {
        if (channelId === '' || channelId === undefined) return hostResolved
        const hit = mergedChannels.find(row => row.id === channelId && row.kind === kind)
        if (hit === undefined) return { mode: 'custom', available: false, reason: '配置指定的通道不在可用列表里' }
        return {
          mode: 'custom',
          channel: hit.id,
          label: hit.label,
          tool: hit.tool,
          model: modelId !== '' ? modelId : hit.model,
          available: hit.installed !== false,
          reason: hit.installed === false ? (hit.reason || '这条通道现在调不动') : '本插件指定的通道（保存后生效）',
        }
      }
      const channelSection = h('div', null,
        h('h4', null, '生成通道'),
        h('div', { style: { marginTop: '9px', display: 'flex', flexDirection: 'column', gap: '12px' } },
          h(ChannelRow, {
            kind: 'image', label: '生图通道',
            channels: mergedChannels,
            channelId: draft.imageChannel, modelId: draft.imageModel, disabled: busy,
            onChannel: value => set('imageChannel', value),
            onModel: value => set('imageModel', value),
            resolved: resolveLocal('image', draft.imageChannel, draft.imageModel, selection.image),
          }),
          h(ChannelRow, {
            kind: 'video', label: '生视频通道',
            channels: mergedChannels,
            channelId: draft.videoChannel, modelId: draft.videoModel, disabled: busy,
            onChannel: value => set('videoChannel', value),
            onModel: value => set('videoModel', value),
            resolved: resolveLocal('video', draft.videoChannel, draft.videoModel, selection.video),
          }),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            h('button', {
              className: 'dd-btn sm', type: 'button', disabled: busy || typeof onRefreshChannels !== 'function',
              onClick: onRefreshChannels, title: '重新探测宿主的连接器与模型目录',
            }, '重新探测'),
            h('span', { className: 'dd-note' },
              channels ? '探测结果缓存 30 秒；连接器在不在由宿主的 subprocess 服务判定。' : '打开设置时探测一次。'),
          ),
          h(CustomChannelEditor, {
            channels: draft.channels, disabled: busy,
            onChange: value => set('channels', value),
          }),
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

    // 通道配置的样式跟着组件走。窄抽屉里下面这排输入要能折行，
    // 否则「添加自定义通道」会挤成一条读不出来的长条。
    CSS_PARTS.push(`
.dd-channel{display:flex;flex-direction:column;gap:5px;padding:9px 10px;border-radius:var(--rx-2);
  background:var(--sunken);box-shadow:var(--e-well)}
.dd-channel-head{display:flex;align-items:center;gap:8px}
.dd-channel-lb{font-size:12px;font-weight:600;color:var(--ink2)}
.dd-channel-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:2px}
.dd-custom-ch{display:flex;flex-direction:column;gap:6px;padding-top:8px;border-top:.5px solid var(--line)}
.dd-custom-row{display:flex;align-items:center;gap:7px;padding:4px 6px;border-radius:var(--rx-1);background:var(--panel-2)}
.dd-custom-row b{font-family:var(--f-mono);font-size:11px}
.dd-custom-ch .dd-channel-row{grid-template-columns:repeat(auto-fit,minmax(110px,1fr))}
@container dd-root (max-width:520px){
  .dd-channel-row{grid-template-columns:1fr}
  .dd-custom-ch .dd-channel-row{grid-template-columns:1fr}
}
`)
