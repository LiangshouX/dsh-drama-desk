/*!
 * dsh-drama-desk — client half (browser bundle).
 *
 * 导演工作台 —— AI 短剧生产流水线的工作台。
 *
 * 设计语言：**导播台 / 监视器**。深石墨蓝的层次、发光的状态灯（tally）、
 * 发丝级分隔线、等宽数字读数、胶片齿孔。字面用宿主的品牌字族（Montserrat）
 * 与代码字族，所以它看起来是「原生」而不是「嵌进来的一个网页」。
 *
 * 三条产品纪律（都写在代码里，不是写在文档里）：
 *
 *  ① **点阶段节点 = 切视图，不改状态。** 只有在该阶段里改了东西，
 *     总体进度才推进到那一阶段。没有第二次点击，没有「你确定吗」。
 *  ② **每个阶段有自己的数据契约视图。** 创意看简报，角色看角色卡与
 *     每张参考图的提示词，剧本看表演，分镜看机位，生成看网格与产物，
 *     验收看报告，装配看版本，交付看成片。
 *  ③ **网格里的每一格，颜色就是体检器自己的判定**，并且**看得见这一镜
 *     要表达什么**——没有缩略图的方块对导演毫无意义。
 *
 * Bundle format: the official DSH client-bundle shape — a lazy-CJS closure
 * registered with window.__ModuleLoader__.load({ id, factory }). `react` comes
 * from the browser module table at runtime; everything else is inlined, so the
 * plugin carries no build step and no runtime dependency.
 */
window.__ModuleLoader__.load({
  id: 'dsh-drama-desk',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useMemo, useRef } = React

    // ── locale ────────────────────────────────────────────────────────────
    const LOCALE_NS = 'dsh-drama-desk'
    /** The panel id: the sidebar entry's id and the `main` slot's key. */
    const PANEL_ID = 'drama-desk'

    const DICT = {
      zh: {
        'brand.title': '导演工作台',
        'brand.subtitle': 'AI 短剧生产线',
        'nav.pipeline': '流水线',
        'nav.spec': '规范',
        'nav.assets': '资产',
        'nav.ledger': '台账',
        'nav.project': '项目',
        'tab.rules': '铁律',
        'tab.constitution': '创作宪法',
        'tab.contract': '数据契约',
        'tab.checklist': '验收清单',
        'action.refresh': '刷新',
        'action.close': '关闭',
        'action.recompile': '重新编译',
        'action.checkStale': '校验过期',
        'action.save': '保存',
        'action.cancel': '取消',
        'action.fit': '适应窗口',
        'action.actualSize': '1:1',
        'action.apply': '应用',
        'action.advance': '推进到',
        'action.rollback': '回退到',
        'action.annotate': '写批注',
        'action.settings': '设置',
        'filter.all': '全部',
        'filter.failed': '失败项',
        'filter.generated': '已生成',
        'density.comfortable': '舒适',
        'density.compact': '紧凑',
        'status.none': '未生成',
        'status.generated': '未体检',
        'status.warn': 'WARN',
        'status.fail': 'FAIL',
        'status.pass': '通过',
        'tag.source': '真源',
        'tag.artifact': '产物',
        'section.camera': '镜头',
        'section.beats': '表演',
        'section.prompt': '提示词',
        'section.reference': '参照',
        'section.verdict': '判定',
        'section.rules': '规则',
        'section.note': '批注',
        'empty.pipeline': '正在读取流水线…',
        'empty.shot': '在网格里点一镜',
        'empty.noShot': '没有符合条件的镜头',
        'settings.paths': '路径',
        'settings.model': '模型',
        'settings.stage': '阶段',
      },
      en: {
        'brand.title': 'Director desk',
        'brand.subtitle': 'AI short-drama line',
        'nav.pipeline': 'Pipeline',
        'nav.spec': 'Spec',
        'nav.assets': 'Assets',
        'nav.ledger': 'Ledger',
        'nav.project': 'Project',
        'tab.rules': 'Rules',
        'tab.constitution': 'Constitution',
        'tab.contract': 'Contract',
        'tab.checklist': 'Checklist',
        'action.refresh': 'Refresh',
        'action.close': 'Close',
        'action.recompile': 'Recompile',
        'action.checkStale': 'Check stale',
        'action.save': 'Save',
        'action.cancel': 'Cancel',
        'action.fit': 'Fit',
        'action.actualSize': '1:1',
        'action.apply': 'Apply',
        'action.advance': 'Advance to',
        'action.rollback': 'Roll back to',
        'action.annotate': 'Annotate',
        'action.settings': 'Settings',
        'filter.all': 'All',
        'filter.failed': 'Failures',
        'filter.generated': 'Generated',
        'density.comfortable': 'Comfortable',
        'density.compact': 'Compact',
        'status.none': 'Not generated',
        'status.generated': 'Not checked',
        'status.warn': 'WARN',
        'status.fail': 'FAIL',
        'status.pass': 'Pass',
        'tag.source': 'Source',
        'tag.artifact': 'Artifact',
        'section.camera': 'Camera',
        'section.beats': 'Performance',
        'section.prompt': 'Prompt',
        'section.reference': 'References',
        'section.verdict': 'Verdict',
        'section.rules': 'Rules',
        'section.note': 'Note',
        'empty.pipeline': 'Loading the pipeline…',
        'empty.shot': 'Pick a shot in the grid',
        'empty.noShot': 'No shot matches the filter',
        'settings.paths': 'Paths',
        'settings.model': 'Model',
        'settings.stage': 'Stage',
      },
    }

    /** Translate one key; falls back to the caller's own text. */
    let t = (key, fallback) => fallback

    // ── API layer ──────────────────────────────────────────────────────────
    const API_BASE = '/drama-desk/api'

    async function apiGet(resource, params) {
      const url = new URL(API_BASE + '/' + resource, location.origin)
      if (params) {
        for (const key of Object.keys(params)) {
          const value = params[key]
          if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
        }
      }
      const response = await fetch(url.toString(), { headers: { accept: 'application/json' } })
      const body = await response.json().catch(() => ({ ok: false, error: '响应不是 JSON' }))
      if (!response.ok || body.ok === false) throw new Error(body.error || ('HTTP ' + response.status))
      return body.data
    }

    async function apiPost(action, payload) {
      const response = await fetch(API_BASE + '/' + action, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload || {}),
      })
      const body = await response.json().catch(() => ({ ok: false, error: '响应不是 JSON' }))
      if (!response.ok || body.ok === false) throw new Error(body.error || ('HTTP ' + response.status))
      return body.data
    }

    /** URL of one asset's **safe** preview (the Host route guarantees ≤1200px). */
    function assetImageUrl(workspaceId, assetId) {
      const url = new URL('/drama-desk/image', location.origin)
      if (workspaceId) url.searchParams.set('workspace', workspaceId)
      url.searchParams.set('asset', assetId)
      return url.toString()
    }

    /** URL of one video asset (the Host route answers with HTTP Range). */
    function assetVideoUrl(workspaceId, assetId) {
      const url = new URL('/drama-desk/video', location.origin)
      if (workspaceId) url.searchParams.set('workspace', workspaceId)
      url.searchParams.set('asset', assetId)
      return url.toString()
    }

    /** URL of one shot's still frame (keyframe, cached frame, or video grab). */
    function posterUrl(workspaceId, shotId) {
      const url = new URL('/drama-desk/poster', location.origin)
      if (workspaceId) url.searchParams.set('workspace', workspaceId)
      url.searchParams.set('shot', shotId)
      return url.toString()
    }

    // ── domain constants ───────────────────────────────────────────────────
    //
    // 这些是**取值枚举**，不是规则。规则的唯一真源在 build/spec/。
    // 预置只是省事：不满足时仍然可以手填。

    const STAGES = [
      { id: 'conceive', label: '创意', en: 'conceive' },
      { id: 'outline', label: '大纲', en: 'outline' },
      { id: 'characters', label: '角色', en: 'characters' },
      { id: 'script', label: '剧本', en: 'script' },
      { id: 'storyboard', label: '分镜', en: 'storyboard' },
      { id: 'generate', label: '生成', en: 'generate' },
      { id: 'verify', label: '验收', en: 'verify' },
      { id: 'assemble', label: '装配', en: 'assemble' },
      { id: 'deliver', label: '交付', en: 'deliver' },
    ]

    const STAGE_LABEL = STAGES.reduce((acc, stage) => {
      acc[stage.id] = stage.label
      return acc
    }, {})

    const RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:2', '2.39:1', '21:9', '5:4']
    const RESOLUTIONS = ['768P', '1080P', '2K', '4K']
    const CAMERAS = [
      'Static Shot', 'Push In', 'Pull Out', 'Zoom In', 'Zoom Out',
      'Pan Left', 'Pan Right', 'Truck Left', 'Truck Right',
      'Tilt Up', 'Tilt Down', 'Pedestal Up', 'Pedestal Down',
      'Arc Shot', 'Tracking Shot', 'Shake Slightly', 'POV',
      'Roll Clockwise', 'Roll Counterclockwise',
    ]
    const DURATIONS = [4, 5, 6, 7, 8, 10, 12, 15]

    // ── design tokens ──────────────────────────────────────────────────────
    // 颜色全部走宿主的语义 token，插件不发明品牌色——它要和宿主一起亮/暗切换。
    // 卡片与背景同色，区分靠 0.5px 发丝描边 + 分层 elevation。
    const CSS = `
.dd{
  --ink:var(--dsw-alias-label-primary,#e8ecf3);
  --ink2:var(--dsw-alias-label-secondary,#98a1b3);
  --ink3:var(--dsw-alias-label-tertiary,#6b7488);
  --ink4:var(--dsw-alias-label-caption,#8b93a4);
  --on-primary:var(--dsw-alias-label-primary-inverted,#0b0e13);
  --primary:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#3d9be9));
  --primary-hover:var(--dsw-alias-button-primary-hover,#5aacf0);
  --accent:var(--dsw-alias-link,#7aaaff);
  --line:var(--dsw-alias-border-l2,rgba(255,255,255,.12));
  --line-strong:var(--dsw-alias-border-l4,rgba(255,255,255,.2));
  --hover:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));
  --active:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.14));
  --bg:var(--dsw-alias-bg-base,#0b0e13);
  --card:var(--dsw-alias-bg-layer-2,#181d26);
  --glass:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 72%,transparent);
  --danger:var(--dsw-alias-state-error-primary,#ef4d52);
  --ok:var(--dsw-alias-state-success-primary,#31b272);
  --warn:var(--dsw-alias-state-warn-primary,#e0a23c);
  --draft:var(--dsw-alias-state-idle-primary,#4c8dff);
  --r-xs:var(--dsw-radius-xs,4px);
  --r-sm:var(--dsw-radius-sm,8px);
  --r-md:var(--dsw-radius-md,12px);
  --r-lg:var(--dsw-radius-lg,16px);
  --r-xl:var(--dsw-radius-xl,20px);
  --r-panel:var(--dsw-radius-panel,28px);
  --ease:cubic-bezier(.2,.8,.2,1);
  --pop:cubic-bezier(.2,1.3,.4,1);
  --serif:"Songti SC","STSong","Noto Serif SC","Source Han Serif SC",Georgia,serif;
  --latin-serif:"Iowan Old Style","Palatino",Georgia,"Songti SC",serif;
  --elev:var(--dsw-elevation-stroke,0 0 0 .5px var(--dsw-elevation-stroke-color,var(--line-strong))),0 4px 16px 0 rgba(0,0,0,.03),0 0 24px 0 rgba(0,0,0,.03);
  --elev-panel:var(--dsw-elevation-stroke,0 0 0 .5px var(--dsw-elevation-stroke-color,var(--line-strong))),0 3px 8px 0 rgba(0,0,0,.03);
  --elev-prominent:var(--dsw-elevation-stroke,0 0 0 .5px var(--dsw-elevation-stroke-color,var(--line-strong))),0 3px 8px 0 rgba(0,0,0,.04),0 0 20px 0 rgba(0,0,0,.05);
  font-family:var(--dsw-font-family,system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);
  font-size:13px;line-height:20px;
  -webkit-font-smoothing:antialiased;
  color:var(--ink);background:var(--bg);
  border:.5px solid var(--line);border-radius:var(--r-lg);
  overflow:hidden;display:flex;flex-direction:column;
  width:100%;height:100%;min-height:0;box-sizing:border-box;
  position:relative;isolation:isolate;
  container:dd-root / inline-size;
}
.dd *{box-sizing:border-box}
.dd button{font:inherit;color:inherit;background:none;border:none;cursor:pointer;padding:0}
.dd button:disabled{opacity:.4;cursor:not-allowed}
.dd input,.dd textarea,.dd select{font:inherit;color:inherit}
.dd .num{font-family:var(--latin-serif);font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.dd .display{font-family:var(--dsw-font-family-brand,"Montserrat",system-ui,sans-serif);font-weight:300;letter-spacing:-.015em}
.dd :focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* ── ambient light (atmosphere without noise) ─────────────────────────── */
 /* 三个 56vmax 的 filter:blur(70px) 光斑曾经让渲染进程常驻一个核以上——
    每个模糊层都是独立合成层，动画让它每帧重算。改成**直接画径向渐变**：
    视觉几乎一样（渐变自带柔和衰减），但只是一次光栅化，没有任何逐帧开销。 */
.dd-ambient{
  position:absolute;inset:0;overflow:clip;pointer-events:none;z-index:0;
  background:
    radial-gradient(58vmax 58vmax at 12% 8%,  color-mix(in srgb,#d9e4ff 34%,transparent), transparent 62%),
    radial-gradient(48vmax 48vmax at 92% 14%, color-mix(in srgb,#f6e2ef 30%,transparent), transparent 60%),
    radial-gradient(52vmax 52vmax at 60% 108%,color-mix(in srgb,#e2f3e0 28%,transparent), transparent 62%);
}

/* ── top bar ─────────────────────────────────────────────────────────── */
.dd-top{
  display:flex;align-items:center;gap:16px;padding:0 18px;height:56px;flex:none;z-index:3;
  /* 这里**不用 backdrop-filter**：.dd-ambient 里有 56vmax 的大模糊层，
     Chromium 在同一层叠上下文里做 backdrop 采样时会把该元素的内容层整个丢掉
     （DOM 在、几何对、就是不画）。半透明纯色是可靠的等价做法。 */
  background:color-mix(in srgb,var(--card) 88%,transparent);
  border-bottom:.5px solid var(--line);
}
.dd-mark{display:flex;align-items:center;gap:10px;flex:none}
.dd-mark-glyph{
  width:30px;height:30px;border-radius:var(--r-md);display:grid;place-items:center;flex:none;
  background:color-mix(in srgb,var(--card) 86%,transparent);box-shadow:var(--elev-panel);
  color:var(--accent);
}
.dd-mark-title{font-family:var(--dsw-font-family-brand,"Montserrat",system-ui,sans-serif);font-weight:500;font-size:15px;letter-spacing:-.01em;line-height:1.15}
.dd-mark-sub{font-size:10px;color:var(--ink3);letter-spacing:.14em;text-transform:uppercase;margin-top:1px}
.dd-tally{display:flex;align-items:center;gap:14px;flex:none}
.dd-tally-item{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink3);white-space:nowrap}
.dd-led{width:8px;height:8px;border-radius:50%;flex:none;background:var(--ink3)}
.dd-led.fail{background:var(--danger);box-shadow:0 0 8px color-mix(in srgb,var(--danger) 55%,transparent)}
.dd-led.warn{background:var(--warn);box-shadow:0 0 8px color-mix(in srgb,var(--warn) 50%,transparent)}
.dd-led.gen{background:var(--draft)}
.dd-led.pass{background:var(--ok)}
.dd-tally-item b{font-family:var(--latin-serif);font-size:15px;color:var(--ink);font-weight:400;font-variant-numeric:tabular-nums}
.dd-top-right{margin-left:auto;display:flex;align-items:center;gap:8px;flex:none}
.dd-chip{
  display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 11px;border-radius:var(--r-md);
  background:color-mix(in srgb,var(--card) 72%,transparent);border:.5px solid var(--line);
  font-size:11.5px;color:var(--ink3);max-width:280px;overflow:hidden;white-space:nowrap;
}
.dd-chip b{color:var(--ink);font-weight:500}
.dd-chip.click{cursor:pointer;transition:border-color .18s var(--ease),color .18s var(--ease)}
.dd-chip.click:hover{border-color:var(--accent);color:var(--ink)}
.dd-icon-btn{
  width:30px;height:30px;border-radius:var(--r-md);display:grid;place-items:center;flex:none;
  border:.5px solid var(--line);background:color-mix(in srgb,var(--card) 72%,transparent);color:var(--ink2);
  transition:color .18s var(--ease),border-color .18s var(--ease),background .18s var(--ease);
}
.dd-icon-btn:hover{color:var(--accent);border-color:var(--accent)}
.dd-icon-btn:active{transform:scale(.96)}
.dd-icon-btn.on{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}

/* ── workspace picker (top bar) ─────────────────────────────────────── */
.dd-work{
  position:relative;display:flex;align-items:center;gap:8px;height:32px;padding:0 10px 0 11px;
  border-radius:var(--r-md);background:var(--glass);border:.5px solid var(--line);box-shadow:var(--elev-panel);
  transition:border-color .18s var(--ease),background .18s var(--ease);
}
.dd-work:hover{border-color:var(--accent)}
.dd-work-trigger{display:flex;align-items:center;gap:8px;cursor:pointer;min-width:0}
.dd-work-label{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink4);flex:none}
.dd-work-title{font-size:13px;font-weight:500;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-work-sub{font-size:10.5px;color:var(--ink4);font-family:var(--latin-serif)}
.dd-work-caret{color:var(--ink3);flex:none}
.dd-menu{
  position:absolute;top:calc(100% + 6px);left:0;z-index:40;min-width:330px;max-width:440px;
  background:var(--card);border:.5px solid var(--line-strong);border-radius:var(--r-md);
  box-shadow:var(--elev-prominent);padding:6px;animation:dd-pop .18s var(--pop) both;
}
.dd-menu-item{
  display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--r-sm);cursor:pointer;
  transition:background .14s var(--ease);
}
.dd-menu-item:hover{background:var(--hover)}
.dd-menu-item.on{background:color-mix(in srgb,var(--accent) 14%,transparent)}
.dd-menu-item .mi-title{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-menu-item .mi-sub{font-size:10.5px;color:var(--ink4);font-family:var(--latin-serif);margin-top:1px}
.dd-menu-sep{height:.5px;background:var(--line);margin:5px 4px}
.dd-menu-label{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink4);padding:6px 10px 3px}

/* ── stage rail ──────────────────────────────────────────────────────── */
.dd-rail{
  display:flex;align-items:center;gap:0;padding:9px 18px;flex:none;z-index:2;
  background:var(--bg);border-bottom:.5px solid var(--line);overflow-x:auto;scrollbar-width:none;
}
.dd-rail::-webkit-scrollbar{display:none}
.dd-stage{
  display:flex;align-items:center;gap:7px;padding:5px 12px;border-radius:var(--r-sm);flex:none;
  font-size:12px;color:var(--ink3);border:.5px solid transparent;cursor:pointer;white-space:nowrap;
  transition:color .18s var(--ease),background .18s var(--ease),border-color .18s var(--ease);
}
.dd-stage:hover{color:var(--ink);background:var(--hover)}
.dd-stage i{width:9px;height:9px;border-radius:50%;background:transparent;box-shadow:inset 0 0 0 1px var(--line-strong);transition:background .3s var(--ease),box-shadow .3s var(--ease);flex:none}
.dd-stage .sn{font-family:var(--latin-serif);font-size:11px}
.dd-stage .sl{font-family:var(--dsw-font-family-brand,"Montserrat",system-ui,sans-serif);font-size:11px;letter-spacing:.04em}
.dd-stage.done{color:var(--ink2)}
.dd-stage.done i{background:var(--ok);box-shadow:none}
.dd-stage.ready{color:var(--ink)}
.dd-stage.ready i{background:var(--accent);box-shadow:0 0 9px color-mix(in srgb,var(--accent) 55%,transparent);animation:dd-breathe 1.4s ease-in-out infinite}
.dd-stage.current{background:color-mix(in srgb,var(--primary) 18%,transparent);border-color:var(--primary);color:var(--ink);font-weight:500}
.dd-stage.current i{background:var(--primary);box-shadow:0 0 9px color-mix(in srgb,var(--primary) 55%,transparent);animation:none}
.dd-stage.preview{border-color:var(--accent);border-style:dashed;color:var(--accent)}
.dd-stage.preview i{background:var(--accent);box-shadow:none}
.dd-stage.blocked{color:var(--ink3)}
.dd-stage.blocked i{background:var(--danger);opacity:.5;box-shadow:none}
.dd-rail-sep{width:14px;height:1px;background:var(--line);flex:none}
@keyframes dd-breathe{50%{opacity:.5}}

/* ── preview banner ──────────────────────────────────────────────────── */
.dd-previewbar{
  display:flex;align-items:center;gap:10px;padding:6px 18px;flex:none;z-index:2;
  background:color-mix(in srgb,var(--accent) 9%,var(--bg));
  border-bottom:.5px solid var(--line);font-size:11.5px;color:var(--ink2);
}
.dd-previewbar .tag{
  font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);
  border:.5px solid color-mix(in srgb,var(--accent) 45%,transparent);border-radius:999px;padding:1px 8px;
}
.dd-previewbar b{color:var(--ink);font-weight:500}

/* ── body ────────────────────────────────────────────────────────────── */
.dd-body{display:flex;min-height:0;flex:1 1 auto;overflow:hidden;position:relative;z-index:1}
.dd-nav{
  width:60px;flex:0 0 60px;border-right:.5px solid var(--line);background:color-mix(in srgb,var(--bg) 70%,transparent);
  display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 0;
}
.dd-nav-btn{
  width:48px;height:48px;border-radius:var(--r-md);display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:3px;color:var(--ink3);position:relative;
  transition:color .18s var(--ease),background .18s var(--ease);
}
.dd-nav-btn:hover{color:var(--ink);background:var(--hover)}
.dd-nav-btn.on{color:var(--accent);background:var(--hover)}
.dd-nav-btn.on::before{
  content:'';position:absolute;left:-6px;top:13px;bottom:13px;width:2px;border-radius:2px;
  background:var(--accent);box-shadow:0 0 9px var(--accent);
}
.dd-nav-btn .lbl{font-size:9.5px;letter-spacing:.06em;line-height:1}
.dd-nav-btn .badge{
  position:absolute;top:3px;right:3px;min-width:15px;height:15px;border-radius:8px;padding:0 4px;
  background:var(--danger);color:#fff;font-size:9.5px;font-family:var(--latin-serif);
  display:grid;place-items:center;
}
.dd-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;overflow:hidden}

/* ── toolbar ─────────────────────────────────────────────────────────── */
.dd-toolbar{
  display:flex;align-items:center;gap:10px;padding:9px 18px;flex:none;flex-wrap:wrap;
  border-bottom:.5px solid var(--line);background:var(--bg);
}
.dd-seg{display:inline-flex;border:.5px solid var(--line);border-radius:var(--r-sm);overflow:hidden;flex:none;background:var(--glass)}
.dd-seg button{padding:4px 11px;font-size:11.5px;color:var(--ink3);border-right:.5px solid var(--line);white-space:nowrap;transition:background .15s,color .15s}
.dd-seg button:last-child{border-right:none}
.dd-seg button:hover{color:var(--ink);background:var(--hover)}
.dd-seg button.on{background:var(--primary);color:var(--on-primary);font-weight:500}
.dd-input{
  height:30px;padding:0 11px;border-radius:var(--r-sm);background:var(--glass);border:.5px solid var(--line);
  color:var(--ink);font-size:12.5px;outline:none;transition:border-color .18s var(--ease),box-shadow .18s var(--ease);
}
.dd-input:focus{border-color:var(--accent);box-shadow:0 0 0 1px var(--ink)}
.dd-input option{background:var(--card)}
.dd-btn{
  height:30px;padding:0 13px;border-radius:var(--r-sm);border:.5px solid var(--line);background:var(--glass);
  font-size:12.5px;color:var(--ink2);white-space:nowrap;
  transition:color .16s var(--ease),border-color .16s var(--ease),background .16s var(--ease);
}
.dd-btn:hover:not(:disabled){color:var(--ink);border-color:var(--accent)}
.dd-btn:active:not(:disabled){transform:scale(.97)}
.dd-btn.sm{height:26px;padding:0 10px;font-size:11.5px;border-radius:var(--r-xs)}
.dd-btn.primary{background:var(--primary);border-color:var(--primary);color:var(--on-primary);font-weight:500}
.dd-btn.primary:hover:not(:disabled){background:var(--primary-hover);border-color:var(--primary-hover)}
.dd-btn.danger{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 40%,transparent)}
.dd-btn.danger:hover:not(:disabled){background:color-mix(in srgb,var(--danger) 12%,transparent);border-color:var(--danger)}
.dd-btn.ghost{background:transparent}
.dd-spacer{flex:1}

/* ── scene strip (film perforations) ─────────────────────────────────── */
.dd-strip{display:flex;align-items:center;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0;max-width:100%}
.dd-strip::-webkit-scrollbar{display:none}
.dd-strip-chip{
  display:flex;align-items:center;gap:7px;padding:4px 10px;border-radius:var(--r-xs);flex:none;cursor:pointer;
  border:.5px solid var(--line);background:var(--card);font-size:11.5px;color:var(--ink3);
  transition:border-color .16s var(--ease),color .16s var(--ease),background .16s var(--ease);
}
.dd-strip-chip:hover{color:var(--ink);border-color:var(--line-strong)}
.dd-strip-chip.on{border-color:var(--accent);color:var(--ink);background:color-mix(in srgb,var(--accent) 12%,var(--card))}
.dd-strip-chip .sid{font-family:var(--latin-serif);font-size:10.5px;letter-spacing:.04em}
.dd-strip-chip .sn2{font-family:var(--latin-serif);font-size:10px;color:var(--ink4)}
.dd-strip-chip .dot{width:6px;height:6px;border-radius:50%;flex:none}
.dd-strip-chip .dot.fail{background:var(--danger)}
.dd-strip-chip .dot.warn{background:var(--warn)}
.dd-strip-chip .dot.ok{background:var(--ok)}

/* ── stage view shell ────────────────────────────────────────────────── */
.dd-scroll{overflow:auto;flex:1 1 auto;min-height:0}
.dd-grid{padding:16px 20px 34px;max-width:1560px;margin:0 auto}
.dd-stagehead{
  display:flex;align-items:flex-start;gap:16px;padding:16px 20px 14px;border-bottom:.5px solid var(--line);
  background:linear-gradient(180deg,color-mix(in srgb,var(--card) 55%,transparent),transparent);
  /* 标题这一侧**不许被挤成竖排**：中文的最小内容宽度是 1 个字，
     一旦被压窄，整段话会一个字一行。给它一个下限，挤不下就换行。 */
  flex-wrap:wrap;
}
.dd-stagehead > div:first-child{flex:1 1 auto;min-width:300px}
.dd-stagehead .sn3{font-family:var(--latin-serif);font-size:11px;letter-spacing:.16em;color:var(--ink4);text-transform:uppercase}
.dd-stagehead .st3{font-family:var(--serif);font-size:21px;font-weight:600;letter-spacing:.01em;margin-top:2px}
.dd-stagehead .sd3{font-size:12px;color:var(--ink3);margin-top:4px;max-width:760px;line-height:1.65}
.dd-stagehead .sr3{margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;min-width:0;max-width:100%}
.dd-outline-list{display:flex;flex-direction:column;gap:10px}
.dd-outline-row{
  display:grid;grid-template-columns:132px minmax(0,1fr) 190px;gap:16px;align-items:start;
  border:.5px solid var(--line);border-radius:var(--r-lg);background:var(--card);padding:12px 14px;
  box-shadow:var(--elev-panel);
}
.dd-outline-row .oid{font-family:var(--latin-serif);font-size:12px;color:var(--ink4);letter-spacing:.06em}
.dd-outline-row .otitle{font-family:var(--serif);font-size:15px;font-weight:600}
.dd-outline-row .osum{font-size:12.5px;color:var(--ink2);line-height:1.65;margin-top:3px}
.dd-outline-row .ometa{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}

/* ── character cards ─────────────────────────────────────────────────── */
.dd-cast{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}
.dd-cast-card{
  border:.5px solid var(--line);border-radius:var(--r-lg);background:var(--card);overflow:hidden;
  box-shadow:var(--elev-panel);display:flex;flex-direction:column;
}
.dd-cast-top{display:flex;gap:12px;padding:13px 14px;align-items:flex-start}
.dd-cast-portrait{
  width:76px;height:96px;border-radius:var(--r-md);overflow:hidden;flex:none;background:var(--bg);
  border:.5px solid var(--line);position:relative;
}
.dd-cast-portrait img{width:100%;height:100%;object-fit:cover;display:block}
.dd-cast-portrait .ph{
  width:100%;height:100%;display:grid;place-items:center;font-size:10px;color:var(--ink4);
  background:repeating-linear-gradient(135deg,transparent 0 6px,color-mix(in srgb,var(--ink4) 9%,transparent) 6px 7px);
}
.dd-cast-name{font-family:var(--serif);font-size:16px;font-weight:600;display:flex;align-items:center;gap:8px}
.dd-cast-role{font-size:11.5px;color:var(--ink3);margin-top:2px}
.dd-cast-body{padding:0 14px 13px;display:flex;flex-direction:column;gap:9px}
.dd-cast-body>*{flex:0 0 auto}
.dd-cast-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 12px}
.dd-refgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:9px}
.dd-refcard{border:.5px solid var(--line);border-radius:var(--r-md);overflow:hidden;background:var(--bg)}
.dd-refcard .rhead{display:flex;align-items:center;gap:7px;padding:6px 8px;border-bottom:.5px solid var(--line)}
.dd-refcard .rhead .rid{font-family:var(--latin-serif);font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-refcard .rbody{padding:7px 8px;font-size:11px;color:var(--ink3);line-height:1.6}
.dd-refcard .rbody .rp{font-family:var(--latin-serif);font-size:10.5px;color:var(--ink4);word-break:break-word;max-height:110px;overflow:auto;white-space:pre-wrap}

/* ── generate grid ───────────────────────────────────────────────────── */
.dd-wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:14px}
.dd-wall.dense{grid-template-columns:repeat(auto-fill,minmax(178px,1fr));gap:10px}
.dd-shotcard{
  position:relative;border-radius:var(--r-lg);overflow:hidden;cursor:pointer;
  border:.5px solid var(--line-strong);background:var(--card);box-shadow:var(--elev-panel);
  transition:transform .22s var(--pop),box-shadow .22s var(--ease),border-color .22s var(--ease);
  display:flex;flex-direction:column;
}
.dd-shotcard:hover{transform:translateY(-4px);box-shadow:var(--elev-prominent);border-color:var(--accent);z-index:2}
.dd-shotcard.on{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent),0 0 22px color-mix(in srgb,var(--accent) 30%,transparent);z-index:3}
.dd-shotcard .poster{
  position:relative;aspect-ratio:16/9;overflow:hidden;background:var(--bg);
  border-bottom:.5px solid var(--line);
}
.dd-shotcard .poster img{width:100%;height:100%;object-fit:cover;display:block}
/* 排版封面：没有静帧时，一个镜头仍然要说清「它是什么」。
   斜向网点 + 巨大镜号 + 中文标题 —— 这是导演纵览时唯一读到的两件事。 */
.dd-shotcard .typo{
  position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;
  padding:9px 11px;
  background:
    repeating-linear-gradient(135deg,transparent 0 7px,color-mix(in srgb,var(--ink) 5%,transparent) 7px 8px),
    radial-gradient(120% 120% at 88% 6%,color-mix(in srgb,var(--accent) 22%,transparent),transparent 60%),
    var(--bg);
}
.dd-shotcard .typo .big{
  font-family:var(--latin-serif);font-size:34px;line-height:1;font-weight:400;
  color:color-mix(in srgb,var(--ink) 34%,transparent);letter-spacing:-.02em;
}
.dd-shotcard .typo .cam{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink4);font-family:var(--latin-serif)}
.dd-shotcard .topline{
  position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:7px;padding:7px 9px;
  background:linear-gradient(180deg,rgba(0,0,0,.55),transparent);font-size:10.5px;
}
.dd-shotcard .topline .sid{font-family:var(--latin-serif);letter-spacing:.06em;color:var(--ink)}
.dd-shotcard .topline .pill{
  margin-left:auto;font-size:9.5px;letter-spacing:.06em;padding:1px 7px;border-radius:999px;
  border:.5px solid currentColor;opacity:.92;
}
.dd-shotcard .pill.none{color:var(--ink3)}
.dd-shotcard .pill.generated{color:var(--draft)}
.dd-shotcard .pill.warn{color:var(--warn)}
.dd-shotcard .pill.fail{color:var(--danger)}
.dd-shotcard .pill.pass{color:var(--ok)}
.dd-shotcard .cap{padding:9px 11px 10px;display:flex;flex-direction:column;gap:4px}
.dd-shotcard .cap .t{font-family:var(--serif);font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-shotcard .cap .s{
  font-size:11.5px;color:var(--ink2);line-height:1.55;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:35px;
}
.dd-shotcard .cap .m{display:flex;gap:9px;font-size:10.5px;color:var(--ink4);font-family:var(--latin-serif)}
.dd-shotcard .marks{position:absolute;left:9px;bottom:52px;display:flex;gap:4px}
.dd-shotcard .mark{
  font-size:9px;padding:1px 6px;border-radius:999px;background:rgba(0,0,0,.5);border:.5px solid var(--line-strong);
  color:var(--ink2);backdrop-filter:none;
}
.dd-shotcard .mark.beat{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 50%,transparent)}
.dd-shotcard .mark.notes{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 50%,transparent)}
.dd-shotcard .mark.prompt{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 50%,transparent)}

/* ── detail column ───────────────────────────────────────────────────── */
.dd-detail{
  width:clamp(360px,40%,560px);flex:0 0 auto;border-left:.5px solid var(--line);
  background:color-mix(in srgb,var(--bg) 88%,transparent);
  display:flex;flex-direction:column;min-height:0;
}
.dd-detail-head{
  padding:11px 16px;border-bottom:.5px solid var(--line);display:flex;align-items:center;gap:10px;flex:none;
}
.dd-detail-head .id{font-family:var(--latin-serif);font-size:13px;font-weight:600}
.dd-detail-head .ttl{font-size:12.5px;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-detail-body{overflow:auto;padding:14px 16px 30px;display:flex;flex-direction:column;gap:11px}
/* 关键：纵向 flex 容器里，子项默认可压缩 —— 内容比容器高时它们会被压扁
   （而不是溢出滚动）。详情面板的每一段都必须保持自己的高度。 */
.dd-detail-body>*{flex:0 0 auto}
.dd-sec{border:.5px solid var(--line);border-radius:var(--r-lg);background:var(--bg);overflow:hidden;box-shadow:var(--elev-panel)}
.dd-sec-head{
  display:flex;align-items:center;gap:9px;padding:9px 13px;cursor:pointer;user-select:none;
  background:color-mix(in srgb,var(--card) 62%,transparent);transition:background .16s var(--ease);
}.dd-sec-head:hover{background:var(--card)}
.dd-sec-head .t{font-size:12.5px;font-weight:500}
.dd-sec-head .sp{flex:1}
.dd-tag{font-size:10px;padding:2px 8px;border-radius:999px;border:.5px solid var(--line);color:var(--ink3);letter-spacing:.05em}
.dd-tag.src{border-color:color-mix(in srgb,var(--accent) 45%,transparent);color:var(--accent)}
.dd-tag.out{border-color:color-mix(in srgb,var(--ok) 40%,transparent);color:var(--ok)}
.dd-sec-body{padding:11px 13px;display:flex;flex-direction:column;gap:10px}
.dd-sec-body>*{flex:0 0 auto}

.dd-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.dd-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.dd-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.dd-field label{font-size:10px;color:var(--ink4);letter-spacing:.07em;text-transform:uppercase}
.dd-field input,.dd-field select,.dd-field textarea{
  height:30px;padding:0 10px;border-radius:var(--r-sm);background:var(--card);border:.5px solid var(--line);
  color:var(--ink);font-size:12.5px;outline:none;width:100%;
  transition:border-color .18s var(--ease),box-shadow .18s var(--ease);
}
.dd-field textarea{height:auto;min-height:64px;padding:8px 10px;resize:vertical;line-height:1.65}
.dd-field input:focus,.dd-field select:focus,.dd-field textarea:focus{border-color:var(--accent);box-shadow:0 0 0 1px var(--ink)}
.dd-field select option{background:var(--card)}
.dd-field .preset{display:flex;gap:5px;flex-wrap:wrap}
.dd-field .preset button{
  height:26px;padding:0 9px;border-radius:var(--r-xs);border:.5px solid var(--line);background:var(--card);
  font-size:11px;color:var(--ink3);font-family:var(--latin-serif);
  transition:color .15s var(--ease),border-color .15s var(--ease),background .15s var(--ease);
}
.dd-field .preset button:hover{color:var(--ink);border-color:var(--accent)}
.dd-field .preset button.on{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}

.dd-beats{display:flex;flex-direction:column;gap:8px}
.dd-beats>*{flex:0 0 auto}
.dd-beat{border:.5px solid var(--line);border-radius:var(--r-md);background:var(--card);overflow:hidden;box-shadow:var(--elev-panel)}
.dd-beat-head{display:flex;align-items:center;gap:9px;padding:7px 11px;font-size:11px;color:var(--ink4);border-bottom:.5px solid var(--line)}
.dd-beat-head .n{font-family:var(--latin-serif)}
.dd-beat-head .sp{font-size:10px;color:var(--ok)}
.dd-beat.outside{opacity:.62}
.dd-beat-body{padding:9px 11px;display:flex;flex-direction:column;gap:7px}
.dd-beat-body textarea{
  width:100%;min-height:40px;background:var(--bg);border:.5px solid var(--line);border-radius:var(--r-sm);
  color:var(--ink);padding:7px 9px;font-size:12.5px;resize:vertical;line-height:1.65;outline:none;
  transition:border-color .18s var(--ease);
}
.dd-beat-body textarea:focus{border-color:var(--accent)}
.dd-beat-body .lab{font-size:10px;color:var(--ink4);letter-spacing:.07em;text-transform:uppercase}
.dd-beat-foot{display:flex;gap:7px;align-items:center;flex-wrap:wrap}

.dd-metric{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:baseline;font-size:12px;padding:1px 0}
.dd-metric .n{color:var(--ink2)}
.dd-metric .v{font-family:var(--latin-serif);font-size:13.5px;font-variant-numeric:tabular-nums}
.dd-metric .th{font-family:var(--latin-serif);font-size:11px;color:var(--ink4)}
.dd-issue{font-size:12px;color:var(--danger);display:flex;gap:7px;line-height:1.55}
.dd-issue.warn{color:var(--warn)}
.dd-issue.info{color:var(--ink2)}

.dd-prompt{
  font-family:var(--latin-serif);font-size:12px;white-space:pre-wrap;word-break:break-word;
  background:var(--card);border:.5px solid var(--line);border-radius:var(--r-md);padding:12px;
  max-height:320px;overflow:auto;color:var(--ink2);line-height:1.7;
}
.dd-prompt-sec+.dd-prompt-sec{margin-top:10px;padding-top:10px;border-top:.5px dashed var(--line)}
.dd-prompt-sec h5{margin:0 0 5px;font-size:10.5px;color:var(--accent);font-family:var(--latin-serif);letter-spacing:.06em}
.dd-prompt-edit{
  width:100%;min-height:260px;background:var(--card);border:.5px solid var(--line);border-radius:var(--r-md);
  padding:12px;font-family:var(--latin-serif);font-size:12px;line-height:1.7;color:var(--ink);resize:vertical;outline:none;
}
.dd-prompt-edit:focus{border-color:var(--accent);box-shadow:0 0 0 1px var(--ink)}

.dd-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.dd-thumb-wrap{position:relative}
.dd-thumb{
  border-radius:var(--r-md);overflow:hidden;border:.5px solid var(--line);background:var(--card);
  cursor:pointer;box-shadow:var(--elev-panel);
  transition:transform .3s var(--pop),box-shadow .25s var(--ease),border-color .25s var(--ease);
}
.dd-thumb:hover{transform:translateY(-3px) rotate(-.6deg);box-shadow:var(--elev-prominent);border-color:var(--accent);z-index:2}
/* 关键：这里**不能有 filter**。
   Chromium 在「overflow:hidden 的祖先 + 自身带 filter 的 img」上会丢掉图片的内容层
   —— DOM 在、几何对、就是不画（参考图一片空白）。淡入只用 opacity。 */
.dd-thumb img{display:block;width:100%;height:88px;object-fit:cover;animation:dd-fadein .28s var(--ease) both}
@keyframes dd-fadein{from{opacity:0}to{opacity:1}}
.dd-thumb .cap{font-size:10px;padding:5px 7px;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-thumb.dep{border-color:color-mix(in srgb,var(--warn) 55%,transparent)}
.dd-thumb .dep-mark{
  position:absolute;top:6px;left:6px;background:var(--warn);color:#161006;
  font-size:9.5px;padding:1px 6px;border-radius:999px;font-weight:600;z-index:2;
}
.dd-thumb.missing{opacity:.4;cursor:not-allowed}
.dd-thumb .ph{
  height:88px;display:grid;place-items:center;font-size:10.5px;color:var(--ink4);
  background:repeating-linear-gradient(135deg,transparent 0 6px,color-mix(in srgb,var(--ink4) 10%,transparent) 6px 7px);
}
.dd-video{width:100%;border-radius:var(--r-md);background:#000;border:.5px solid var(--line);display:block;box-shadow:var(--elev-panel)}

.dd-rule{border:.5px solid var(--line);border-radius:var(--r-md);overflow:hidden;background:var(--card)}
.dd-rule.on{border-color:color-mix(in srgb,var(--accent) 50%,transparent)}
.dd-rule-head{display:flex;align-items:center;gap:10px;padding:8px 11px;cursor:pointer;user-select:none;font-size:12.5px}
.dd-rule-head .rid{font-family:var(--latin-serif);font-size:11.5px;color:var(--accent);min-width:32px}
.dd-rule.on .rid{font-weight:700}
.dd-rule-head .st{margin-left:auto;font-size:10.5px;color:var(--ink4);font-family:var(--latin-serif);white-space:nowrap}
.dd-rule-body{padding:9px 12px;font-size:12px;color:var(--ink2);white-space:pre-wrap;line-height:1.7;background:var(--bg)}
.dd-rule-body .ev{color:var(--ink)}

/* ── tables ──────────────────────────────────────────────────────────── */
.dd-table{width:100%;border-collapse:collapse;font-size:12px}
.dd-table th{
  text-align:left;font-weight:400;color:var(--ink3);padding:9px 12px;
  border-bottom:.5px solid var(--line-strong);position:sticky;top:0;background:var(--card);z-index:1;
}
.dd-table td{padding:7px 12px;border-bottom:.5px solid var(--line);vertical-align:middle}
.dd-table tbody tr{transition:background .12s}
.dd-table tbody tr:hover{background:var(--hover)}
.dd-table td.n{font-family:var(--latin-serif);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap;font-size:12.5px}
.dd-table td.path{color:var(--ink4);font-size:11px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-table tr.on{background:color-mix(in srgb,var(--accent) 12%,transparent)}

/* ── doc view ────────────────────────────────────────────────────────── */
.dd-doc{font-size:13px;line-height:1.8;color:var(--ink2);max-width:920px}
.dd-doc h4{margin:20px 0 7px;color:var(--ink);font-family:var(--dsw-font-family-brand,"Montserrat",system-ui,sans-serif);font-weight:300;font-size:17px;letter-spacing:-.015em}
.dd-doc h5{margin:13px 0 4px;color:var(--ink);font-size:13px}
.dd-doc ul{margin:6px 0;padding-left:19px}
.dd-doc li{margin:2px 0}
.dd-doc code{font-family:var(--latin-serif);font-size:11.5px;background:var(--card);padding:1px 6px;border-radius:var(--r-xs)}
.dd-doc p{margin:6px 0}
.dd-rule-list{border:.5px solid var(--line);border-radius:var(--r-lg);overflow:hidden;background:var(--bg);box-shadow:var(--elev-panel)}
.dd-rule-row{
  display:grid;grid-template-columns:46px 1fr auto;gap:14px;align-items:start;
  padding:11px 14px;border-bottom:.5px solid var(--line);cursor:pointer;
  transition:background .14s var(--ease);
}
.dd-rule-row:hover{background:var(--hover)}
.dd-rule-row .rid{font-family:var(--latin-serif);font-size:12px;color:var(--accent);font-weight:600}
.dd-rule-row .ti{font-size:13px}
.dd-rule-row .st{font-size:11px;color:var(--ink4);text-align:right;white-space:nowrap}

/* ── drawer (settings) ───────────────────────────────────────────────── */
.dd-drawer{
  position:absolute;top:0;right:0;bottom:0;width:min(460px,90%);z-index:20;
  background:color-mix(in srgb,var(--card) 97%,transparent);
  border-left:.5px solid var(--line-strong);box-shadow:-24px 0 60px rgba(0,0,0,.28);
  display:flex;flex-direction:column;animation:dd-dock-in .3s cubic-bezier(.2,1,.3,1) both;
}
@keyframes dd-dock-in{from{opacity:0;transform:translateX(20px)}}
.dd-drawer-head{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:.5px solid var(--line);flex:none}
.dd-drawer-body{overflow:auto;padding:16px;display:flex;flex-direction:column;gap:18px}
.dd-drawer-body>*{flex:0 0 auto}
.dd-drawer h4{margin:0;font-size:10.5px;font-family:var(--dsw-font-family-brand,"Montserrat",system-ui,sans-serif);font-weight:500;letter-spacing:.12em;color:var(--ink4);text-transform:uppercase}
.dd-note{font-size:11.5px;color:var(--ink4);line-height:1.65}
.dd-warnbox{
  background:color-mix(in srgb,var(--warn) 10%,transparent);
  border:.5px solid color-mix(in srgb,var(--warn) 40%,transparent);
  color:var(--warn);border-radius:var(--r-md);padding:9px 11px;font-size:12px;line-height:1.65;
}
.dd-errorbox{
  background:color-mix(in srgb,var(--danger) 10%,transparent);
  border:.5px solid color-mix(in srgb,var(--danger) 40%,transparent);
  color:var(--danger);border-radius:var(--r-md);padding:9px 11px;font-size:12px;line-height:1.65;
}
.dd-okbox{
  background:color-mix(in srgb,var(--ok) 10%,transparent);
  border:.5px solid color-mix(in srgb,var(--ok) 40%,transparent);
  color:var(--ok);border-radius:var(--r-md);padding:9px 11px;font-size:12px;line-height:1.65;
}
.dd-kv{display:grid;grid-template-columns:auto 1fr;gap:5px 14px;font-size:12px;align-items:baseline}
.dd-kv .k{color:var(--ink4);white-space:nowrap}
.dd-kv .v{font-family:var(--latin-serif);font-size:11.5px;word-break:break-all}
/* 拖动把手：抽屉宽度可调。宽度记在 localStorage 里，下次还在。 */
.dd-resize{
  position:absolute;left:-3px;top:0;bottom:0;width:7px;cursor:col-resize;z-index:21;
}
.dd-resize::after{
  content:'';position:absolute;left:3px;top:50%;transform:translateY(-50%);width:1px;height:44px;
  background:var(--line-strong);border-radius:1px;transition:background .16s var(--ease),height .16s var(--ease);
}
.dd-resize:hover::after,.dd-resize.active::after{background:var(--accent);height:84px}
.dd-pathrow{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center}

/* ── modal (lightbox) ────────────────────────────────────────────────── */
.dd-modal-backdrop{
  position:fixed;inset:0;z-index:2147483000;background:rgba(4,6,9,.82);
  display:grid;place-items:center;padding:28px;animation:dd-fade .16s var(--ease) both;
}
@keyframes dd-fade{from{opacity:0}}
.dd-modal{
  position:relative;display:flex;flex-direction:column;max-width:min(1180px,94vw);max-height:88vh;
  background:var(--card);border:.5px solid var(--line-strong);border-radius:var(--r-xl);
  box-shadow:0 30px 90px rgba(0,0,0,.55);overflow:hidden;animation:dd-rise .22s var(--pop) both;
}
@keyframes dd-rise{from{opacity:0;transform:translateY(10px) scale(.985)}}
.dd-modal-head{display:flex;align-items:center;gap:10px;padding:10px 13px;border-bottom:.5px solid var(--line);flex:none}
.dd-modal-stage{
  flex:1 1 auto;min-height:120px;overflow:hidden;position:relative;cursor:grab;
  display:flex;align-items:center;justify-content:center;background:var(--bg);
}
.dd-modal-stage.drag{cursor:grabbing}
.dd-modal-stage img{max-width:100%;max-height:100%;object-fit:contain;display:block;user-select:none}
.dd-modal-foot{
  padding:9px 13px;border-top:.5px solid var(--line);font-size:11.5px;color:var(--ink3);
  display:flex;gap:14px;align-items:center;flex-wrap:wrap;max-height:120px;overflow:auto;flex:none;
}
.dd-modal-foot .mf{white-space:nowrap}
.dd-modal-foot .mf b{color:var(--ink);font-weight:500;font-family:var(--latin-serif)}
.dd-modal-prompt{
  font-family:var(--latin-serif);font-size:11px;color:var(--ink4);white-space:pre-wrap;word-break:break-word;
  width:100%;line-height:1.6;max-height:190px;overflow:auto;
}

/* ── folder browser (in-drawer) ──────────────────────────────────────── */
.dd-browser{border:.5px solid var(--line);border-radius:var(--r-md);overflow:hidden;background:var(--bg)}
.dd-browser-path{padding:6px 9px;border-bottom:.5px solid var(--line);font-family:var(--latin-serif);font-size:11px;color:var(--ink3);word-break:break-all}
.dd-browser-list{max-height:230px;overflow:auto}
.dd-browser-item{padding:5px 10px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:8px}
.dd-browser-item:hover{background:var(--hover)}
.dd-browser-item .bi-n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── empty / toast ───────────────────────────────────────────────────── */
.dd-empty{padding:56px 20px;text-align:center;color:var(--ink3);font-size:13px}
.dd-empty-title{font-size:17px;color:var(--ink2);margin-bottom:5px}
.dd-toast{
  position:absolute;left:50%;bottom:20px;transform:translateX(-50%);z-index:25;
  background:var(--card);border:.5px solid var(--line-strong);border-radius:var(--r-md);
  padding:9px 15px;font-size:12.5px;color:var(--ink);box-shadow:var(--elev-prominent);
  animation:dd-toast .25s var(--ease) both;max-width:82%;
}
@keyframes dd-toast{from{opacity:0;transform:translate(-50%,14px) scale(.96)}}
.dd-toast.err{border-color:var(--danger);color:var(--danger)}
.dd-toast.ok{border-color:var(--ok);color:var(--ok)}

/* ── 首页 / 作品卡 ───────────────────────────────────────────────────── */
.dd-home{padding:26px 22px 40px;max-width:1280px;margin:0 auto}
.dd-home-hero{
  display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;
  padding:22px 24px;border:.5px solid var(--line);border-radius:var(--r-xl);
  background:
    radial-gradient(120% 140% at 100% 0%, color-mix(in srgb,var(--accent) 14%,transparent), transparent 62%),
    color-mix(in srgb,var(--card) 70%,transparent);
  box-shadow:var(--elev-panel);
}
.dd-home-hero .h1{font-family:var(--serif);font-size:26px;font-weight:600;letter-spacing:.01em}
.dd-home-hero .h2{font-size:13px;color:var(--ink2);line-height:1.75;margin-top:8px;max-width:640px}
.dd-home-hero .h3{font-size:11.5px;color:var(--ink4);margin-top:10px;line-height:1.7}
.dd-home-sec{margin-top:22px}
.dd-home-sec h4{
  margin:0 0 10px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink4);
  font-family:var(--dsw-font-family-brand,"Montserrat",system-ui,sans-serif);font-weight:500;
}
.dd-works{display:grid;grid-template-columns:repeat(auto-fill,minmax(258px,1fr));gap:12px}
.dd-work-card{
  position:relative;text-align:left;padding:13px 15px;border:.5px solid var(--line);border-radius:var(--r-lg);
  background:var(--card);box-shadow:var(--elev-panel);cursor:pointer;
  transition:transform .2s var(--pop),box-shadow .2s var(--ease),border-color .2s var(--ease);
}
.dd-work-card:hover{transform:translateY(-3px);box-shadow:var(--elev-prominent);border-color:var(--accent)}
.dd-work-card.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.dd-work-card .wt{font-family:var(--serif);font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-work-card .wi{font-family:var(--latin-serif);font-size:10.5px;color:var(--ink4);margin-top:3px}
.dd-work-card .wm{display:flex;gap:9px;margin-top:9px;font-size:11px;color:var(--ink3);font-family:var(--latin-serif)}
.dd-work-card.new{
  display:flex;align-items:center;justify-content:center;gap:8px;min-height:96px;
  border-style:dashed;color:var(--ink3);background:transparent;
}
.dd-work-card.new:hover{color:var(--accent)}

/* ── 构思会话（右栏） ─────────────────────────────────────────────────── */
.dd-chat{
  width:clamp(340px,34%,460px);flex:0 0 auto;border-left:.5px solid var(--line);
  background:color-mix(in srgb,var(--bg) 90%,transparent);
  display:flex;flex-direction:column;min-height:0;
}
.dd-chat-head{
  display:flex;align-items:center;gap:9px;padding:10px 13px;border-bottom:.5px solid var(--line);flex:none;
}
.dd-chat-head .ch-t{font-size:12.5px;font-weight:600}
.dd-chat-head .ch-sub{font-size:10.5px;color:var(--ink4);font-family:var(--latin-serif)}
.dd-chat-flow{flex:1 1 auto;overflow:auto;padding:13px;display:flex;flex-direction:column;gap:11px;min-height:0}
.dd-chat-flow>*{flex:0 0 auto}
.dd-msg{display:flex;flex-direction:column;gap:4px;max-width:100%}
.dd-msg .who{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink4)}
.dd-msg .body{
  font-size:12.5px;line-height:1.72;white-space:pre-wrap;word-break:break-word;
  padding:9px 12px;border-radius:var(--r-md);border:.5px solid var(--line);background:var(--card);color:var(--ink);
}
.dd-msg.user{align-items:flex-end}
.dd-msg.user .body{background:color-mix(in srgb,var(--accent) 16%,var(--card));border-color:color-mix(in srgb,var(--accent) 34%,transparent)}
.dd-msg.tool .body{
  font-family:var(--latin-serif);font-size:11px;color:var(--ink3);background:transparent;
  border-style:dashed;padding:5px 9px;
}
.dd-msg.err .body{border-color:var(--danger);color:var(--danger);background:color-mix(in srgb,var(--danger) 9%,transparent)}
.dd-chat-empty{
  margin:auto;text-align:center;color:var(--ink3);font-size:12px;line-height:1.8;padding:20px 12px;max-width:300px;
}
.dd-chat-composer{
  flex:none;border-top:.5px solid var(--line);padding:10px 11px 11px;display:flex;flex-direction:column;gap:7px;
}
.dd-chat-composer textarea{
  width:100%;min-height:64px;max-height:170px;resize:vertical;padding:9px 11px;
  border-radius:var(--r-md);border:.5px solid var(--line);background:var(--card);color:var(--ink);
  font-size:12.5px;line-height:1.65;outline:none;
}
.dd-chat-composer textarea:focus{border-color:var(--accent);box-shadow:0 0 0 1px var(--ink)}
.dd-chat-composer .row{display:flex;gap:7px;align-items:center}
.dd-chat-composer .hint{font-size:10.5px;color:var(--ink4);line-height:1.5}

/* ── narrow panel ─────────────────────────────────────────────────────── */
@container dd-root (max-width: 1080px){
  .dd-home{padding:18px 16px 30px}
  .dd-home-hero{padding:16px 18px;gap:14px}
  .dd-home-hero .h1{font-size:21px}
  .dd-home-hero .h2{font-size:12.5px}
  .dd-works{grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}
  .dd-chat{width:clamp(320px,40%,420px)}
}
@container dd-root (max-width: 900px){
  .dd-detail{width:clamp(320px,46%,460px)}
  .dd-outline-row{grid-template-columns:112px minmax(0,1fr)}
}
@container dd-root (max-width: 700px){
  .dd-tally{display:none}
  .dd-outline-row{grid-template-columns:1fr}
}
@media (prefers-reduced-motion: reduce){
  .dd *,.dd *::before,.dd *::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important}
}
`
    // ── helpers ────────────────────────────────────────────────────────────
    const STATUS_TEXT = {
      none: '未生成',
      generated: '未体检',
      warn: 'WARN',
      fail: 'FAIL',
      pass: '通过',
    }

    function formatBytes(bytes) {
      if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '—'
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
      return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
    }

    function formatNumber(value, digits) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      return value.toFixed(digits === undefined ? 3 : digits)
    }

    function formatTime(value) {
      if (typeof value !== 'string' || value === '') return '—'
      return value.replace('T', ' ').replace('Z', '')
    }

    /** Small inline glyph set — 24×24 grid, stroke 1.6, round caps (host convention). */
    function Icon(props) {
      const size = props.size ?? 16
      const paths = {
        grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
        spec: 'M6 3h9l3 3v15H6zM14 3v4h4M9 12h6M9 16h4',
        asset: 'M4 5h16v14H4zM4 16l5-4.5 4 3.5 3-2.5 4 3.5M16 9.5a1 1 0 1 0 0 .01',
        ledger: 'M5 3h10v18H5zM8 7h4M8 11h4M8 15h4M18 8h-1M18 12h-1M18 16h-1',
        project: 'M3 5h6l2 2h10v12H3z',
        refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
        settings: 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
        close: 'M6 6l12 12M18 6L6 18',
        chevron: 'M9 5l7 7-7 7',
        chevLeft: 'M15 5l-7 7 7 7',
        note: 'M4 4h16v11H9l-5 4z',
        film: 'M3 4h18v16H3zM7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4',
        play: 'M8 5.5v13l11-6.5z',
        plus: 'M12 5v14M5 12h14',
        trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
        up: 'M12 19V5M6 11l6-6 6 6',
        down: 'M12 5v14M6 13l6 6 6-6',
        folder: 'M3 6h6l2 2h10v12H3z',
        check: 'M4 12.5l5 5L20 6.5',
        eye: 'M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
        copy: 'M8 8h11v12H8zM5 16V4h11',
        star: 'M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.9l6-.8z',
        back: 'M20 12H4M10 6l-6 6 6 6',
      }
      const d = paths[props.name] ?? paths.grid
      const filled = props.name === 'play' || props.name === 'star'
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24',
        fill: filled ? 'currentColor' : 'none',
        stroke: filled ? 'none' : 'currentColor',
        strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
        xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true,
        style: { display: 'block', pointerEvents: 'none' },
      }, [
        h('path', { key: 'p', d }),
      ])
    }

    // ── small pieces ───────────────────────────────────────────────────────

    function Section(props) {
      const [open, setOpen] = useState(props.defaultOpen === true)
      return h('div', { className: 'dd-sec' },
        h('div', { className: 'dd-sec-head', onClick: () => setOpen(!open) },
          h('span', { className: 't' }, props.title),
          props.tag ? h('span', { className: 'dd-tag ' + (props.tagKind || '') }, props.tag) : null,
          h('span', { className: 'sp' }),
          props.badge ? h('span', { className: 'dd-badge' }, props.badge) : null,
          h('span', { style: { color: 'var(--ink4)', fontSize: '10px', transform: 'rotate(' + (open ? 90 : 0) + 'deg)', transition: 'transform 180ms cubic-bezier(.2,0,0,1)' } },
            h(Icon, { name: 'chevron', size: 12 })),
        ),
        open ? h('div', { className: 'dd-sec-body' }, props.children) : null,
      )
    }

    function Field(props) {
      return h('div', { className: 'dd-field' },
        h('label', null, props.label),
        props.children,
      )
    }

    function MetricRow(props) {
      return h('div', { className: 'dd-metric' },
        h('span', { className: 'n' }, props.name),
        h('span', { className: 'v', style: { color: props.failed ? 'var(--danger)' : 'var(--ink)' } }, props.value),
        h('span', { className: 'th' }, props.threshold),
      )
    }

    /**
     * An inline editable value: read mode shows the text, edit mode shows an
     * input. Every stage view uses it, so 「改东西」在哪个阶段都一样顺手。
     */
    function Inline(props) {
      const { label, value, multiline, disabled, onSave, placeholder, type } = props
      const [editing, setEditing] = useState(false)
      const [draft, setDraft] = useState(value ?? '')
      useEffect(() => { setDraft(value ?? '') }, [value])
      const commit = () => {
        setEditing(false)
        if (String(draft) !== String(value ?? '')) onSave(draft)
      }
      if (!editing) {
        return h('div', { className: 'dd-field', style: props.style },
          h('label', null, label),
          h('div', {
            role: 'button', tabIndex: 0,
            style: {
              minHeight: '30px', padding: '6px 10px', borderRadius: 'var(--r-sm)',
              border: '.5px solid transparent', background: 'var(--card)', color: 'var(--ink)',
              fontSize: '12.5px', lineHeight: '1.55', cursor: disabled ? 'default' : 'text',
              whiteSpace: multiline ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              opacity: value === undefined || value === null || value === '' ? '.55' : '1',
            },
            title: disabled ? undefined : '点击编辑',
            onClick: () => { if (!disabled) setEditing(true) },
          }, value === undefined || value === null || value === '' ? (placeholder ?? '（空）') : String(value)),
        )
      }
      return h('div', { className: 'dd-field', style: props.style },
        h('label', null, label),
        multiline
          ? h('textarea', {
            value: draft, autoFocus: true, placeholder,
            onChange: event => setDraft(event.target.value),
            onKeyDown: event => {
              if (event.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) commit()
            },
          })
          : h('input', {
            value: draft, autoFocus: true, type: type ?? 'text', placeholder,
            onChange: event => setDraft(event.target.value),
            onKeyDown: event => {
              if (event.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
              if (event.key === 'Enter') commit()
            },
          }),
        h('div', { style: { display: 'flex', gap: '6px' } },
          h('button', { className: 'dd-btn sm primary', onClick: commit }, '保存'),
          h('button', { className: 'dd-btn sm', onClick: () => { setDraft(value ?? ''); setEditing(false) } }, '撤销'),
        ),
      )
    }

    /** A row of preset chips + a free-text escape hatch. */
    function PresetField(props) {
      const { label, value, options, onSave, disabled, allowCustom } = props
      const [custom, setCustom] = useState(false)
      const [draft, setDraft] = useState(value ?? '')
      useEffect(() => { setDraft(value ?? '') }, [value])
      const known = options.map(option => String(option))
      const isKnown = known.includes(String(value))
      return h('div', { className: 'dd-field' },
        h('label', null, label),
        h('div', { className: 'preset' },
          options.map(option => h('button', {
            key: String(option),
            className: String(value) === String(option) ? 'on' : '',
            disabled,
            onClick: () => { setCustom(false); if (String(value) !== String(option)) onSave(option) },
          }, String(option))),
          allowCustom
            ? h('button', {
              className: isKnown ? '' : 'on',
              disabled,
              onClick: () => setCustom(!custom),
            }, '自定义…')
            : null,
        ),
        (!isKnown || custom)
          ? h('input', {
            className: 'num', value: draft, disabled, placeholder: '自定义值',
            onChange: event => setDraft(event.target.value),
            onKeyDown: event => {
              if (event.key === 'Enter') { setCustom(false); if (draft !== String(value ?? '')) onSave(draft) }
            },
            onBlur: () => { if (custom && draft !== String(value ?? '')) { onSave(draft); setCustom(false) } },
          })
          : null,
      )
    }

    // ── stage rail (preview semantics) ─────────────────────────────────────
    //
    // 点节点 = 切视图。不发请求，不弹确认。
    // 已提交的阶段是实心的；正在预览的阶段是虚线描边。
    function StageRail(props) {
      const { stages, committed, viewing, onPick, busy } = props
      if (!stages || stages.length === 0) return null
      return h('div', { className: 'dd-rail' },
        stages.map((stage, index) => {
          const isCommitted = stage.stage === committed
          const isViewing = stage.stage === viewing
          const className = 'dd-stage ' + stage.state
            + (isCommitted && stage.state !== 'current' ? ' done' : '')
            + (isViewing && !isCommitted ? ' preview' : '')
          return [
            index > 0 ? h('span', { className: 'dd-rail-sep', key: 'sep' + stage.stage }) : null,
            h('button', {
              key: stage.stage,
              className: className,
              disabled: busy,
              title: (stage.requirement ? stage.requirement + '\n' : '')
                + (isCommitted ? '当前已提交的阶段' : '点击预览这一阶段（改了东西才会推进进度）'),
              onClick: () => onPick(stage.stage),
            },
              h('i', null),
              h('span', { className: 'sl' }, stage.label || stage.stage),
            ),
          ]
        }),
      )
    }

    /** The banner that says 「你正在预览，不是真的回退了」。 */
    function PreviewBar(props) {
      const { viewing, committed, requirement, onBack } = props
      if (!viewing || viewing === committed) return null
      return h('div', { className: 'dd-previewbar' },
        h('span', { className: 'tag' }, '预览'),
        h('span', null, '正在预览 ', h('b', null, viewing), ' 阶段'),
        h('span', { style: { color: 'var(--ink4)' } }, '· 已提交进度仍停在 ', h('b', null, committed || '—')),
        requirement ? h('span', { style: { color: 'var(--ink4)' } }, '· ' + requirement) : null,
        h('span', { className: 'dd-spacer' }),
        h('button', { className: 'dd-btn sm', onClick: onBack }, '回到 ' + (committed || '当前') + ' 阶段'),
      )
    }

    // ── workspace menu (top bar) ───────────────────────────────────────────
    function WorkspaceMenu(props) {
      const { works, current, onPick, onCreate, onClose } = props
      const ref = useRef(null)
      useEffect(() => {
        const onDown = event => { if (ref.current && !ref.current.contains(event.target)) onClose() }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
      }, [onClose])
      return h('div', { className: 'dd-menu', ref },
        h('div', { className: 'dd-menu-label' }, '作品'),
        (works || []).length === 0
          ? h('div', { className: 'dd-note', style: { padding: '4px 10px 8px' } }, '项目根下还没有作品。')
          : works.map(work => h('div', {
            key: work.id,
            className: 'dd-menu-item' + (work.id === current ? ' on' : ''),
            onClick: () => { onPick(work.id); onClose() },
          },
            h('div', { style: { minWidth: '0' } },
              h('div', { className: 'mi-title' }, work.title || work.id),
              h('div', { className: 'mi-sub' },
                work.id + ' · ' + (work.stage || '—') + ' · ' + (work.shots ?? 0) + ' 镜'
                + (work.scenes ? ' / ' + work.scenes + ' 场' : '')),
            ),
            work.id === current ? h('span', { style: { marginLeft: 'auto', color: 'var(--accent)' } }, h(Icon, { name: 'check', size: 13 })) : null,
          )),
        h('div', { className: 'dd-menu-sep' }),
        h('div', {
          className: 'dd-menu-item',
          onClick: () => { onCreate(); onClose() },
        },
          h(Icon, { name: 'plus', size: 13 }),
          h('div', null,
            h('div', { className: 'mi-title' }, '新建作品'),
            h('div', { className: 'mi-sub' }, '按数据契约建一个空作品骨架'),
          ),
        ),
      )
    }

    // ── stage views ────────────────────────────────────────────────────────

    function StageHeader(props) {
      const { stage, title, desc, right } = props
      const meta = STAGES.find(entry => entry.id === stage)
      return h('div', { className: 'dd-stagehead' },
        h('div', { style: { minWidth: '0' } },
          h('div', { className: 'sn3' }, (meta ? meta.en : stage) + ' · ' + (meta ? meta.label : '')),
          h('div', { className: 'st3' }, title),
          desc ? h('div', { className: 'sd3' }, desc) : null,
        ),
        right ? h('div', { className: 'sr3' }, right) : null,
      )
    }

    /** The creative brief: a document, and the one thing you can rewrite here. */
    function ConceiveView(props) {
      const { data, busy, actions } = props
      const brief = data.brief || {}
      const work = data.work || {}
      const [editing, setEditing] = useState(false)
      const [draft, setDraft] = useState(brief.text || '')
      useEffect(() => { setDraft(brief.text || '') }, [brief.text])
      const meta = [
        h('span', { className: 'dd-chip' }, '作品 ', h('b', null, work.title || '—')),
        h('span', { className: 'dd-chip' }, 'id ', h('b', { className: 'num' }, work.id || '—')),
        brief.updatedAt ? h('span', { className: 'dd-chip' }, '更新 ', h('b', { className: 'num' }, formatTime(brief.updatedAt))) : null,
        brief.bytes ? h('span', { className: 'dd-chip' }, '简报 ', h('b', { className: 'num' }, formatBytes(brief.bytes))) : null,
      ]
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'conceive',
          title: '创意简报',
          desc: 'conceive 阶段的唯一产物：creative/brief.md。下游的每一场戏都从这里长出来。',
          right: [
            ...meta,
            editing
              ? h('button', {
                className: 'dd-btn primary', disabled: busy,
                onClick: () => { actions.editBrief(draft); setEditing(false) },
              }, '保存简报')
              : h('button', { className: 'dd-btn', disabled: busy, onClick: () => setEditing(true) }, brief.exists ? '编辑简报' : '写第一版简报'),
          ],
        }),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            brief.exists
              ? h('div', { className: 'dd-doc' },
                editing
                  ? h('textarea', {
                    className: 'dd-prompt-edit', value: draft, autoFocus: true,
                    placeholder: '# 简报\n\n一句话故事…',
                    onChange: event => setDraft(event.target.value),
                  })
                  : h(MarkdownLite, { text: brief.text || '' }),
              )
              : h('div', { className: 'dd-empty' },
                h('div', { className: 'dd-empty-title' }, '还没有简报'),
                h('div', null, 'conceive 的出口是 creative/brief.md。写下来，它就存在了。')),
          ),
        ),
      )
    }

    /** The outline: the scene skeleton. Every field here is 真源. */
    function OutlineView(props) {
      const { data, busy, actions, onGoto } = props
      const scenes = data.scenes || []
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'outline',
          title: '场次骨架',
          desc: 'outline 阶段的出口是 scenes.json 的场次骨架：每一场要发生什么、多长、谁在场、结束时什么变了。',
          right: [
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(scenes.length)), ' 场'),
            h('span', { className: 'dd-chip' }, '总时长 ', h('b', { className: 'num' },
              String(scenes.reduce((sum, scene) => sum + (typeof scene.duration === 'number' ? scene.duration : 0), 0)) + 's')),
          ],
        }),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            scenes.length === 0
              ? h('div', { className: 'dd-empty' }, '还没有场次')
              : h('div', { className: 'dd-outline-list' },
                scenes.map(scene => h('div', { className: 'dd-outline-row', key: scene.id },
                  h('div', null,
                    h('div', { className: 'oid' }, scene.id),
                    h('div', { className: 'dd-ometa' },
                      h('span', { className: 'dd-badge' }, scene.function || '—'),
                      scene.act ? h('span', { className: 'dd-badge' }, '第 ' + scene.act + ' 幕') : null,
                    ),
                  ),
                  h('div', { style: { minWidth: '0' } },
                    h(Inline, {
                      label: '场次标题', value: scene.title, disabled: busy,
                      placeholder: '（无标题）',
                      onSave: value => actions.editScene(scene.id, { title: value }),
                    }),
                    h(Inline, {
                      label: '这一场发生了什么', value: scene.summary, multiline: true, disabled: busy,
                      placeholder: '一句话说明',
                      style: { marginTop: '8px' },
                      onSave: value => actions.editScene(scene.id, { summary: value }),
                    }),
                    h(Inline, {
                      label: '结束时什么变了（turn）', value: scene.turn, multiline: true, disabled: busy,
                      placeholder: '（可空）',
                      style: { marginTop: '8px' },
                      onSave: value => actions.editScene(scene.id, { turn: value }),
                    }),
                  ),
                  h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                    h(Inline, {
                      label: '场次功能', value: scene.function, disabled: busy,
                      onSave: value => actions.editScene(scene.id, { function: value }),
                    }),
                    h(Inline, {
                      label: '时长 (s)', value: scene.duration, type: 'number', disabled: busy,
                      onSave: value => actions.editScene(scene.id, { duration: Number(value) || 0 }),
                    }),
                    h(Inline, {
                      label: '在场角色', value: (scene.characters || []).join(', '), disabled: busy,
                      placeholder: '角色 id，逗号分隔',
                      onSave: value => actions.editScene(scene.id, {
                        characters: value.split(/[,，\s]+/).map(entry => entry.trim()).filter(Boolean),
                      }),
                    }),
                    h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' } },
                      h('span', { className: 'dd-note' }, scene.beatCount + ' 拍'),
                      h('button', { className: 'dd-btn sm', onClick: () => onGoto('script') }, '去改表演'),
                    ),
                  ),
                )),
              ),
          ),
        ),
      )
    }

    /**
     * The characters stage. 每张参考图都带自己的提示词与参数 ——
     * 这是未来「人工介入重新生成」的前提。
     */
    function CharactersView(props) {
      const { data, busy, actions, onOpenImage } = props
      const characters = data.characters || []
      const props_ = data.props || []
      const renderCard = (entry, kind) => {
        const assets = entry.assets || []
        return h('div', { className: 'dd-cast-card', key: entry.id },
          h('div', { className: 'dd-cast-top' },
            h('div', { className: 'dd-cast-portrait' },
              assets.length > 0 && assets[0].type === 'reference_image'
                ? h('img', {
                  src: assetImageUrl(props.workspaceId, assets[0].id),
                  alt: entry.id,
                  loading: 'lazy',
                  onError: event => { event.currentTarget.style.display = 'none' },
                })
                : h('div', { className: 'ph' }, kind === 'prop' ? '道具' : '无参考图'),
            ),
            h('div', { style: { minWidth: '0', flex: '1' } },
              h('div', { className: 'dd-cast-name' }, entry.name || entry.id),
              h('div', { className: 'dd-cast-role' }, (entry.role || '—') + (entry.age ? ' · ' + entry.age : '')),
              h('div', { style: { marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' } },
                (entry.states || []).map(state => h('span', { className: 'dd-badge', key: state }, state)),
                (entry.props || []).map(prop => h('span', { className: 'dd-badge', key: prop }, prop)),
              ),
            ),
          ),
          h('div', { className: 'dd-cast-body' },
            h('div', { className: 'dd-cast-fields' },
              h(Inline, {
                label: '外貌', value: entry.appearance, multiline: true, disabled: busy,
                onSave: value => actions.editCharacter(entry.id, { appearance: value }),
              }),
              h(Inline, {
                label: '可被拍到的动作', value: entry.behavior, multiline: true, disabled: busy,
                onSave: value => actions.editCharacter(entry.id, { behavior: value }),
              }),
              h(Inline, {
                label: '说话方式', value: entry.voice, multiline: true, disabled: busy,
                onSave: value => actions.editCharacter(entry.id, { voice: value }),
              }),
              h(Inline, {
                label: '音色（逐字复用）', value: entry.voice_desc, multiline: true, disabled: busy,
                placeholder: 'English voice timbre…',
                onSave: value => actions.editCharacter(entry.id, { voice_desc: value }),
              }),
              h(Inline, {
                label: '默认语气', value: entry.delivery_default, multiline: true, disabled: busy,
                onSave: value => actions.editCharacter(entry.id, { delivery_default: value }),
              }),
            ),
            assets.length > 0
              ? h('div', null,
                h('div', { className: 'dd-note', style: { marginBottom: '6px' } }, '参考图 · 提示词 · 参数'),
                h('div', { className: 'dd-refgrid' },
                  assets.map(asset => h('div', { className: 'dd-refcard', key: asset.id },
                    h('div', { className: 'rhead' },
                      h('span', { className: 'rid' }, asset.id),
                      asset.state ? h('span', { className: 'dd-badge' }, asset.state) : null,
                    ),
                    asset.type === 'reference_image'
                      ? h('button', {
                        style: { display: 'block', width: '100%', padding: '0', border: 'none', cursor: 'pointer' },
                        'aria-label': '打开参考图 ' + asset.id,
                        title: '打开 ' + asset.id,
                        onClick: () => onOpenImage(asset),
                      }, h('img', {
                        src: assetImageUrl(props.workspaceId, asset.id),
                        alt: asset.id,
                        loading: 'lazy',
                        style: { display: 'block', width: '100%', height: '112px', objectFit: 'cover' },
                        onError: event => { event.currentTarget.style.display = 'none' },
                      }))
                      : null,
                    h('div', { className: 'rbody' },
                      h('div', null, asset.width ? asset.width + '×' + asset.height + ' · ' : '', asset.source || '—'),
                      asset.hasPrompt
                        ? h('div', { className: 'rp', style: { marginTop: '5px' } }, asset.prompt)
                        : h('div', { className: 'rp', style: { marginTop: '5px', color: 'var(--ink4)' } }, '（没有登记生图提示词）'),
                    ),
                  )),
                ),
              )
              : h('div', { className: 'dd-note' }, '没有登记参考图。生图阶段的参考图必须登记进 assets.json，否则模型无从「取身份」。'),
          ),
        )
      }
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'characters',
          title: '角色与道具',
          desc: 'characters 阶段的出口是 characters.json：角色卡、道具卡，以及每张参考图的身份承诺。',
          right: [
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(characters.length)), ' 角色'),
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(props_.length)), ' 道具'),
          ],
        }),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            characters.length === 0 && props_.length === 0
              ? h('div', { className: 'dd-empty' }, '还没有角色卡')
              : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } },
                characters.length > 0
                  ? h('div', { className: 'dd-cast' }, characters.map(entry => renderCard(entry, 'character')))
                  : null,
                props_.length > 0
                  ? h('div', null,
                    h('div', { className: 'dd-note', style: { marginBottom: '8px' } }, '道具'),
                    h('div', { className: 'dd-cast' }, props_.map(entry => renderCard(entry, 'prop'))),
                  )
                  : null,
              ),
          ),
        ),
      )
    }

    /** The script stage: the performance layer. 每一拍都可增删改移。 */
    function ScriptView(props) {
      const { data, busy, actions } = props
      const scenes = data.scenes || []
      const [activeId, setActiveId] = useState(scenes.length > 0 ? scenes[0].id : '')
      useEffect(() => {
        if (scenes.length === 0) { setActiveId(''); return }
        if (!scenes.some(scene => scene.id === activeId)) setActiveId(scenes[0].id)
      }, [scenes.map(scene => scene.id).join(',')])
      const scene = scenes.find(entry => entry.id === activeId)
      const sceneStrip = h('div', { className: 'dd-strip' },
        scenes.map(entry => h('div', {
          key: entry.id,
          className: 'dd-strip-chip' + (entry.id === activeId ? ' on' : ''),
          onClick: () => setActiveId(entry.id),
        },
          h('span', { className: 'sid' }, entry.id),
          h('span', { className: 'sn2' }, (entry.beats || []).length + '拍'),
          entry.qc && entry.qc.verdict === 'FAIL'
            ? h('span', { className: 'dot fail' })
            : entry.qc && entry.qc.verdict === 'WARN'
              ? h('span', { className: 'dot warn' })
              : entry.qc
                ? h('span', { className: 'dot ok' })
                : null,
        )),
      )
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'script',
          title: '表演层',
          desc: 'script 阶段的出口是 scenes.json 的 beats[]：动作行、台词、语气。铁律 R18 管的就是这一层。',
          right: [
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(scenes.length)), ' 场'),
            scene ? h('span', { className: 'dd-chip' }, scene.id, ' · ', h('b', { className: 'num' }, String((scene.beats || []).length)), ' 拍') : null,
          ],
        }),
        h('div', { className: 'dd-toolbar', style: { paddingTop: '7px', paddingBottom: '7px' } },
          sceneStrip,
        ),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            !scene
              ? h('div', { className: 'dd-empty' }, '还没有场次')
              : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
                scene.qc
                  ? h('div', {
                    className: scene.qc.verdict === 'FAIL' ? 'dd-errorbox' : scene.qc.verdict === 'WARN' ? 'dd-warnbox' : 'dd-okbox',
                  },
                    h('div', null, '表演层体检：', h('b', null, scene.qc.verdict || '—')),
                    scene.qc.issues && scene.qc.issues.length > 0
                      ? h('ul', { style: { margin: '6px 0 0', paddingLeft: '18px' } },
                        scene.qc.issues.map((issue, index) => h('li', { key: index }, issue)))
                      : null,
                    h('div', { style: { marginTop: '6px', fontSize: '11px', opacity: '.8' } },
                      '反应拍覆盖率 ' + formatNumber(scene.qc.reactionRate, 2)
                      + ' · 沉默占比 ' + formatNumber(scene.qc.silenceRatio, 2)
                      + ' · 台词拍 ' + scene.qc.dialogueBeats + ' / 反应拍 ' + scene.qc.reactionBeats),
                  )
                  : null,
                h('div', { className: 'dd-beats' },
                  (scene.beats || []).map((beat, index) => h(BeatEditor, {
                    key: (scene.id || '') + ':' + index,
                    beat,
                    index: index + 1,
                    issues: beat.issues,
                    disabled: busy,
                    onSave: patch => actions.editBeat(scene.id, { op: 'patch', beatIndex: index + 1, patch }),
                    onInsert: () => actions.editBeat(scene.id, { op: 'insert', beatIndex: index + 1 }),
                    onDelete: () => actions.editBeat(scene.id, { op: 'delete', beatIndex: index + 1 }),
                    onMove: delta => actions.editBeat(scene.id, { op: 'move', beatIndex: index + 1, toIndex: index + 1 + delta }),
                  })),
                ),
                h('div', { style: { display: 'flex', gap: '7px' } },
                  h('button', {
                    className: 'dd-btn', disabled: busy,
                    onClick: () => actions.editBeat(scene.id, { op: 'insert', beatIndex: (scene.beats || []).length }),
                  }, h(Icon, { name: 'plus', size: 12 }), ' 追加一拍'),
                ),
              ),
          ),
        ),
      )
    }

    /** The storyboard stage: the shot list with machine-friendly camera fields. */
    function StoryboardView(props) {
      const { data, busy, actions, onOpenShot } = props
      const shots = data.shots || []
      const [openId, setOpenId] = useState(null)
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'storyboard',
          title: '分镜清单',
          desc: 'storyboard 阶段的出口是 shots.json：机位、时长、画幅、参考图。每一条都会被编译成一条提示词。',
          right: [
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(shots.length)), ' 镜'),
            h('span', { className: 'dd-chip' }, '总时长 ', h('b', { className: 'num' },
              String(shots.reduce((sum, shot) => sum + (typeof shot.duration === 'number' ? shot.duration : 0), 0)) + 's')),
          ],
        }),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            shots.length === 0
              ? h('div', { className: 'dd-empty' }, '还没有镜头')
              : h('table', { className: 'dd-table' },
                h('thead', null, h('tr', null,
                  h('th', null, '镜头'), h('th', null, '标题'), h('th', null, '内容'),
                  h('th', { className: 'n' }, '时长'), h('th', null, '运镜'),
                  h('th', null, '画幅'), h('th', null, '光'),
                  h('th', null, ''),
                )),
                h('tbody', null, shots.map(shot => h('tr', {
                  key: shot.id,
                  className: openId === shot.id ? 'on' : '',
                  onClick: () => setOpenId(openId === shot.id ? null : shot.id),
                },
                  h('td', { className: 'n' }, shot.id),
                  h('td', null, shot.title || '—'),
                  h('td', { style: { color: 'var(--ink2)', maxWidth: '320px' } }, shot.summary || '—'),
                  h('td', { className: 'n' }, shot.duration ? shot.duration + 's' : '—'),
                  h('td', { className: 'num' }, shot.camera || '—'),
                  h('td', { className: 'num' }, (shot.ratio || '—') + ' · ' + (shot.resolution || '—')),
                  h('td', { className: 'num' }, shot.lighting || '—'),
                  h('td', null, h('button', {
                    className: 'dd-btn sm',
                    onClick: event => { event.stopPropagation(); onOpenShot(shot.id) },
                  }, '打开')),
                ))),
              ),
            openId
              ? h('div', { style: { marginTop: '14px' } },
                h(ShotCameraEditor, {
                  shot: shots.find(shot => shot.id === openId),
                  busy,
                  onSave: patch => actions.editShot(openId, patch),
                }),
              )
              : null,
          ),
        ),
      )
    }

    /** The verify stage: machine verdicts plus the human's call. */
    function VerifyView(props) {
      const { data, busy, actions, onOpenShot } = props
      const shots = data.shots || []
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'verify',
          title: '验收',
          desc: '机器判定只作参考，判废必须人工复核（R5）。人工段填了才能把 verdict 定为 pass。',
          right: [
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(shots.length)), ' 镜待验'),
            h('span', { className: 'dd-chip' }, '通过 ', h('b', { className: 'num' },
              String(shots.filter(shot => shot.verdict === 'pass').length))),
          ],
        }),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            shots.length === 0
              ? h('div', { className: 'dd-empty' }, '没有需要验收的镜头')
              : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
                shots.map(shot => {
                  const report = shot.report || {}
                  const human = report.human || {}
                  const tech = report.tech || {}
                  return h('div', { className: 'dd-sec', key: shot.id },
                    h('div', { className: 'dd-sec-head', onClick: () => onOpenShot(shot.id) },
                      h('span', { className: 'num', style: { fontSize: '12px' } }, shot.id),
                      h('span', { className: 't' }, shot.title || ''),
                      h('span', { className: 'sp' }),
                      h('span', {
                        className: 'dd-badge ' + (shot.verdict === 'pass' ? 'pass' : shot.verdict === 'fail' ? 'fail' : shot.verdict === 'warn' ? 'warn' : ''),
                      }, shot.verdict || '未判'),
                    ),
                    h('div', { className: 'dd-sec-body' },
                      h('div', { className: 'dd-grid3' },
                        h(Inline, {
                          label: '技术判定', value: tech.pass === true ? 'pass' : tech.pass === false ? 'fail' : '—',
                          disabled: busy,
                        }),
                        h(Inline, {
                          label: '实测时长', value: tech.durationSec ? tech.durationSec + 's' : '—',
                          disabled: busy,
                        }),
                        h(Inline, {
                          label: '分辨率', value: tech.width ? tech.width + '×' + tech.height : '—',
                          disabled: busy,
                        }),
                      ),
                      h('div', { className: 'dd-grid2' },
                        h(Inline, {
                          label: '人工判定（verdict）', value: human.verdict || '', disabled: busy,
                          placeholder: 'pass / fail / warn',
                          onSave: value => actions.editVerify(shot.id, { verdict: value }),
                        }),
                        h(Inline, {
                          label: '复核人', value: human.reviewer || '', disabled: busy,
                          placeholder: '姓名',
                          onSave: value => actions.editVerify(shot.id, { reviewer: value }),
                        }),
                      ),
                      h(Inline, {
                        label: '人工发现的问题', value: (human.issues || []).join('；'), multiline: true, disabled: busy,
                        placeholder: '用「；」分隔',
                        onSave: value => actions.editVerify(shot.id, { issues: value.split(/[；;]/).map(entry => entry.trim()).filter(Boolean) }),
                      }),
                      shot.qc && shot.qc.issues && shot.qc.issues.length > 0
                        ? h('div', null,
                          h('div', { className: 'dd-note', style: { marginBottom: '4px' } }, '机器判定的问题（仅作参考）'),
                          shot.qc.issues.map((issue, index) => h('div', { className: 'dd-issue', key: index }, '· ' + issue)),
                        )
                        : null,
                    ),
                  )
                }),
              ),
          ),
        ),
      )
    }

    /** The assemble stage: versions, gaps, cost. */
    function AssembleView(props) {
      const { data, onOpenShot } = props
      const shots = data.shots || []
      const totals = data.totals || {}
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'assemble',
          title: '装配',
          desc: '把每镜的当前版本按顺序接起来：缺哪一镜、哪一镜没有声音、总共多少钱。',
          right: [
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(totals.shots ?? shots.length)), ' 镜'),
            h('span', { className: 'dd-chip' }, '总时长 ', h('b', { className: 'num' }, (totals.seconds ?? 0) + 's')),
            h('span', { className: 'dd-chip' }, '花费 ', h('b', { className: 'num' }, '$' + formatNumber(totals.costUsd ?? 0, 2))),
          ],
        }),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            data.gaps && data.gaps.length > 0
              ? h('div', { className: 'dd-warnbox', style: { marginBottom: '12px' } },
                h('div', null, '还差：'),
                h('ul', { style: { margin: '5px 0 0', paddingLeft: '18px' } },
                  data.gaps.map((gap, index) => h('li', { key: index }, gap))),
              )
              : null,
            shots.length === 0
              ? h('div', { className: 'dd-empty' }, '没有镜头')
              : h('table', { className: 'dd-table' },
                h('thead', null, h('tr', null,
                  h('th', null, '镜头'), h('th', null, '标题'), h('th', { className: 'n' }, '时长'),
                  h('th', null, '版本'), h('th', null, '音轨'), h('th', { className: 'n' }, '费用'), h('th', null, ''),
                )),
                h('tbody', null, shots.map(shot => h('tr', { key: shot.id },
                  h('td', { className: 'n' }, shot.id),
                  h('td', null, shot.title || '—'),
                  h('td', { className: 'n' }, shot.duration ? shot.duration + 's' : '—'),
                  h('td', null, (shot.versions || []).map(version =>
                    h('span', {
                      key: version.assetId,
                      className: 'dd-badge',
                      style: version.current ? { color: 'var(--ok)', borderColor: 'color-mix(in srgb,var(--ok) 40%,transparent)' } : undefined,
                      title: version.createdAt + ' · ' + formatBytes(version.bytes),
                    }, 'v' + version.version + (version.current ? ' · 当前' : '')))),
                  h('td', null, shot.hasAudio ? '有' : h('span', { style: { color: 'var(--danger)' } }, '缺')),
                  h('td', { className: 'n' }, shot.costUsd ? '$' + shot.costUsd.toFixed(2) : '—'),
                  h('td', null, h('button', { className: 'dd-btn sm', onClick: () => onOpenShot(shot.id) }, '打开')),
                ))),
              ),
          ),
        ),
      )
    }

    /** The deliver stage: the final cut. */
    function DeliverView(props) {
      const { data } = props
      const finals = data.finals || []
      const totals = data.totals || {}
      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'deliver',
          title: '交付',
          desc: '成片登记：视频资产路径里带 final 的那一条，就是这一版交付物。',
          right: [
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(finals.length)), ' 条成片'),
            h('span', { className: 'dd-chip' }, '总时长 ', h('b', { className: 'num' }, (totals.seconds ?? 0) + 's')),
            h('span', { className: 'dd-chip' }, '花费 ', h('b', { className: 'num' }, '$' + formatNumber(totals.costUsd ?? 0, 2))),
          ],
        }),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            data.ready === false && data.blockers && data.blockers.length > 0
              ? h('div', { className: 'dd-warnbox', style: { marginBottom: '12px' } },
                h('div', null, '还不能交付：'),
                h('ul', { style: { margin: '5px 0 0', paddingLeft: '18px' } },
                  data.blockers.map((blocker, index) => h('li', { key: index }, blocker))),
              )
              : null,
            finals.length === 0
              ? h('div', { className: 'dd-empty' },
                h('div', { className: 'dd-empty-title' }, '还没有成片'),
                h('div', null, '成片是视频资产里路径含 final 的那一条。'))
              : h('table', { className: 'dd-table' },
                h('thead', null, h('tr', null,
                  h('th', null, '成片'), h('th', null, '路径'), h('th', { className: 'n' }, '时长'),
                  h('th', { className: 'n' }, '体积'), h('th', { className: 'n' }, '费用'), h('th', null, '登记时间'),
                )),
                h('tbody', null, finals.map(final => h('tr', { key: final.assetId },
                  h('td', null, final.assetId),
                  h('td', { className: 'path', title: final.path }, final.path || '—'),
                  h('td', { className: 'n' }, final.durationSec ? final.durationSec + 's' : '—'),
                  h('td', { className: 'n' }, formatBytes(final.bytes)),
                  h('td', { className: 'n' }, final.costUsd ? '$' + final.costUsd.toFixed(2) : '—'),
                  h('td', { className: 'n' }, formatTime(final.createdAt)),
                ))),
              ),
          ),
        ),
      )
    }

    // ── the generate stage: the shot wall ──────────────────────────────────

    /**
     * One shot on the wall.
     *
     * 导演纵览全片时真正要读的是三件事：**这一镜是什么**（标题）、**它在讲什么**
     * （内容摘要）、**它现在什么状态**（颜色）。所以卡片上必须有静帧或者
     * 排版封面——一个只有编号的方块对导演毫无意义。
     */
    function ShotCard(props) {
      const { shot, selected, onSelect, workspaceId } = props
      const [failed, setFailed] = useState(false)
      const status = shot.status ?? 'none'
      const poster = shot.poster
      const posterSrc = failed || poster === undefined
        ? undefined
        : poster.asset
          ? assetImageUrl(workspaceId, poster.asset)
          : posterUrl(workspaceId, shot.id)
      const marks = shot.markers || []
      return h('button', {
        className: 'dd-shotcard' + (selected ? ' on' : ''),
        onClick: () => onSelect(shot.id),
        title: shot.id + ' · ' + (shot.title || '') + '\n' + (STATUS_TEXT[status] || status),
      },
        h('div', { className: 'poster' },
          posterSrc
            ? h('img', {
              src: posterSrc, alt: shot.id, loading: 'lazy',
              onError: () => setFailed(true),
            })
            : null,
          (!posterSrc || failed)
            ? h('div', { className: 'typo' },
              h('div', { className: 'big' }, shot.id),
              h('div', { className: 'cam' }, shot.camera || shot.lighting || '—'),
            )
            : null,
          h('div', { className: 'topline' },
            h('span', { className: 'sid' }, shot.id),
            h('span', { className: 'pill ' + status }, STATUS_TEXT[status] ?? status),
          ),
          marks.length > 0
            ? h('div', { className: 'marks' },
              marks.slice(0, 3).map((mark, index) => h('span', {
                key: index,
                className: 'mark' + (mark.kind === 'beat' ? ' beat' : mark.kind === 'notes' ? ' notes' : mark.kind === 'prompt' ? ' prompt' : ''),
              }, mark.label)))
            : null,
        ),
        h('div', { className: 'cap' },
          h('div', { className: 't' }, shot.title || '（无标题）'),
          h('div', { className: 's' }, shot.summary || '（没有内容摘要）'),
          h('div', { className: 'm' },
            h('span', null, shot.duration ? shot.duration + 's' : '—'),
            h('span', null, shot.camera || '—'),
            shot.ratio ? h('span', null, shot.ratio) : null,
          ),
        ),
      )
    }

    /** The generate stage: scene navigation + the wall. */
    function GenerateView(props) {
      const { data, selectedShot, onSelectShot, busy, actions, workspaceId, onOpenImage } = props
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

      const strip = h('div', { className: 'dd-strip' },
        scenes.map(scene => {
          const bad = (scene.shots || []).filter(shot => shot.status === 'fail').length
          const warn = (scene.shots || []).filter(shot => shot.status === 'warn').length
          return h('div', {
            key: scene.id,
            className: 'dd-strip-chip' + (scene.id === sceneId ? ' on' : ''),
            title: scene.title || scene.id,
            onClick: () => { setSceneId(scene.id); setOverview(false) },
          },
            h('span', { className: 'sid' }, scene.id),
            h('span', { className: 'sn2' }, (scene.shots || []).length + '镜'),
            bad > 0 ? h('span', { className: 'dot fail' }) : warn > 0 ? h('span', { className: 'dot warn' }) : h('span', { className: 'dot ok' }),
          )
        }),
      )

      return h('div', { className: 'dd-main' },
        h(StageHeader, {
          stage: 'generate',
          title: '生成台',
          desc: '生成阶段的出口是视频资产 + 提示词资产 + 台账。网格里的颜色是体检器自己的判定。',
          right: [
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(totalShots)), ' 镜'),
            h('span', { className: 'dd-chip' }, h('b', { className: 'num' }, String(scenes.length)), ' 场'),
          ],
        }),
        h('div', { className: 'dd-toolbar' },
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
          h('span', { className: 'dd-spacer' }),
          h('div', { className: 'dd-seg' },
            h('button', { className: !overview ? 'on' : '', onClick: () => setOverview(false) }, '分场'),
            h('button', { className: overview ? 'on' : '', onClick: () => setOverview(true) }, '总览'),
          ),
        ),
        !overview
          ? h('div', { className: 'dd-toolbar', style: { paddingTop: '7px', paddingBottom: '7px' } },
            h('button', {
              className: 'dd-icon-btn', disabled: activeIndex <= 0,
              onClick: () => setSceneId(scenes[Math.max(0, activeIndex - 1)].id),
            }, h(Icon, { name: 'chevLeft', size: 13 })),
            h('div', { style: { minWidth: '0', flex: '1' } }, strip),
            h('button', {
              className: 'dd-icon-btn', disabled: activeIndex < 0 || activeIndex >= scenes.length - 1,
              onClick: () => setSceneId(scenes[Math.min(scenes.length - 1, activeIndex + 1)].id),
            }, h(Icon, { name: 'chevron', size: 13 })),
          )
          : null,
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            overview
              ? h('div', null,
                filteredScenes.length === 0
                  ? h('div', { className: 'dd-empty' }, '没有符合条件的镜头')
                  : filteredScenes.map(scene => h('div', { key: scene.id, style: { marginBottom: '16px' } },
                    h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '7px' } },
                      h('span', { className: 'num', style: { fontSize: '11px', color: 'var(--ink4)' } }, scene.id),
                      h('span', { style: { fontFamily: 'var(--serif)', fontSize: '14px', fontWeight: '600' } }, scene.title || ''),
                      h('span', { className: 'dd-note' }, scene.summary || ''),
                      h('span', { className: 'dd-spacer' }),
                      h('span', { className: 'num', style: { fontSize: '11px', color: 'var(--ink4)' } },
                        (scene.shots || []).length + ' 镜 · ' + (scene.duration || 0) + 's'),
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
                        h('td', null, h('span', {
                          className: 'dd-badge ' + (shot.status === 'fail' ? 'fail' : shot.status === 'warn' ? 'warn' : shot.status === 'pass' ? 'pass' : ''),
                        }, STATUS_TEXT[shot.status] ?? shot.status)),
                      ))),
                    ),
                  )),
                )
              : activeScene
                ? h('div', null,
                  h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '11px' } },
                    h('span', { className: 'num', style: { fontSize: '11.5px', color: 'var(--ink4)', letterSpacing: '.08em' } }, activeScene.id),
                    h('span', { style: { fontFamily: 'var(--serif)', fontSize: '17px', fontWeight: '600' } }, activeScene.title || '（无标题）'),
                    h('span', { className: 'dd-note', style: { maxWidth: '560px' } }, activeScene.summary || ''),
                    h('span', { className: 'dd-spacer' }),
                    activeScene.qc
                      ? h('span', {
                        className: 'dd-badge ' + (activeScene.qc.verdict === 'FAIL' ? 'fail' : activeScene.qc.verdict === 'WARN' ? 'warn' : 'pass'),
                        title: (activeScene.qc.issues || []).join('；'),
                      }, '表演层 ' + activeScene.qc.verdict)
                      : null,
                    h('span', { className: 'dd-note' }, (activeScene.shots || []).length + ' 镜 · ' + (activeScene.duration || 0) + 's'),
                  ),
                  shownShots.length === 0
                    ? h('div', { className: 'dd-empty' }, '这一场没有符合筛选条件的镜头')
                    : h('div', { className: 'dd-wall' },
                      shownShots.map(shot => h(ShotCard, {
                        key: shot.id,
                        shot,
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

    // ── shot detail ────────────────────────────────────────────────────────

    /** The camera fields with presets — 预置只是省事，不满足时仍然可以手填。 */
    function ShotCameraEditor(props) {
      const { shot, busy, onSave } = props
      if (!shot) return null
      const save = patch => onSave(patch)
      return h('div', { className: 'dd-grid2' },
        h(PresetField, {
          label: '运镜', value: shot.camera, options: CAMERAS, disabled: busy, allowCustom: true,
          onSave: value => save({ camera: value }),
        }),
        h(PresetField, {
          label: '画幅', value: shot.ratio, options: RATIOS, disabled: busy, allowCustom: true,
          onSave: value => save({ ratio: value }),
        }),
        h(PresetField, {
          label: '分辨率', value: shot.resolution, options: RESOLUTIONS, disabled: busy, allowCustom: true,
          onSave: value => save({ resolution: value }),
        }),
        h(PresetField, {
          label: '时长 (s)', value: shot.duration, options: DURATIONS, disabled: busy, allowCustom: true,
          onSave: value => save({ duration: Number(value) || 0 }),
        }),
        h(Field, { label: '光参数 preset' },
          h('input', {
            className: 'num', value: shot.lighting ?? '', disabled: busy,
            placeholder: 'day_interior / night_face …',
            onChange: event => save({ lighting: event.target.value }),
          })),
        h(Field, { label: '标题' },
          h('input', {
            value: shot.title ?? '', disabled: busy,
            onChange: event => save({ title: event.target.value }),
          })),
        h('div', { style: { gridColumn: '1 / -1' } },
          h(Field, { label: '这一镜要表达什么（派生摘要）' },
            h('div', {
              style: {
                minHeight: '30px', padding: '6px 10px', borderRadius: 'var(--r-sm)',
                background: 'var(--card)', color: 'var(--ink2)', fontSize: '12.5px',
                lineHeight: '1.55', whiteSpace: 'pre-wrap',
                opacity: shot.summary ? '1' : '.55',
              },
            }, shot.summary || '（没有摘要）'))),
        h('div', { style: { gridColumn: '1 / -1' } },
          h(Field, { label: '这一镜的动作（motion_action · 真源）' },
            h('textarea', {
              value: shot.motion_action ?? '', disabled: busy,
              placeholder: '这一镜里主体做了什么',
              onChange: event => save({ motion_action: event.target.value }),
            }))),
        h('div', { style: { gridColumn: '1 / -1' } },
          h(Field, { label: '备注 / 导演批注' },
            h('textarea', {
              value: shot.notes ?? '', disabled: busy,
              placeholder: '这一镜你想记住什么？',
              onChange: event => save({ notes: event.target.value }),
            }))),
        h('div', { style: { gridColumn: '1 / -1' } },
          h('span', { className: 'dd-note' }, '派生字段（description_en / dialogue）只读，由编译生成')),
      )
    }

    function BeatEditor(props) {
      const { beat, index, issues, disabled, onSave, onInsert, onDelete, onMove } = props
      const [action, setAction] = useState(beat.action || '')
      const [text, setText] = useState(beat.text || '')
      const [delivery, setDelivery] = useState(beat.delivery || '')
      const [mode, setMode] = useState(beat.mode || '')
      const dirty = action !== (beat.action || '')
        || text !== (beat.text || '')
        || delivery !== (beat.delivery || '')
        || mode !== (beat.mode || '')
      useEffect(() => {
        setAction(beat.action || '')
        setText(beat.text || '')
        setDelivery(beat.delivery || '')
        setMode(beat.mode || '')
      }, [beat.action, beat.text, beat.delivery, beat.mode])
      const save = () => {
        const patch = {}
        if (action !== (beat.action || '')) patch.action = action
        if (text !== (beat.text || '')) patch.text = text
        if (delivery !== (beat.delivery || '')) patch.delivery = delivery
        if (mode !== (beat.mode || '')) patch.mode = mode === '' ? null : mode
        if (Object.keys(patch).length > 0) onSave(patch)
      }
      const hasDialogue = mode === 'dialogue' || mode === 'voiceover'
      return h('div', { className: 'dd-beat' },
        h('div', { className: 'dd-beat-head' },
          h('span', { className: 'n' }, '#' + index),
          beat.speaker ? h('span', { style: { color: 'var(--accent)' } }, beat.speaker) : null,
          mode ? h('span', null, mode) : null,
          h('span', { className: 'dd-spacer' }),
          h('button', { className: 'dd-btn sm ghost', disabled: disabled, title: '上移', onClick: () => onMove(-1) }, h(Icon, { name: 'up', size: 11 })),
          h('button', { className: 'dd-btn sm ghost', disabled: disabled, title: '下移', onClick: () => onMove(1) }, h(Icon, { name: 'down', size: 11 })),
          h('button', { className: 'dd-btn sm ghost', disabled: disabled, title: '在后面插入一拍', onClick: onInsert }, h(Icon, { name: 'plus', size: 11 })),
          h('button', { className: 'dd-btn sm ghost danger', disabled: disabled, title: '删除这一拍', onClick: onDelete }, h(Icon, { name: 'trash', size: 11 })),
        ),
        h('div', { className: 'dd-beat-body' },
          h('div', { className: 'lab' }, '动作行'),
          h('textarea', { value: action, disabled: disabled, onChange: event => setAction(event.target.value) }),
          h('div', { className: 'lab' }, '这一拍是'),
          h('div', { className: 'preset' },
            [['', '无台词'], ['dialogue', '画内音（要口型）'], ['voiceover', '画外音']].map(option =>
              h('button', {
                key: option[0],
                className: (beat.mode || '') === option[0] ? 'on' : '',
                disabled,
                onClick: () => setMode(option[0]),
              }, option[1]))),
          hasDialogue
            ? h('div', null,
              h('div', { className: 'lab' }, '台词'),
              h('textarea', { value: text, disabled: disabled, onChange: event => setText(event.target.value) }),
              h('div', { className: 'lab', style: { marginTop: '2px' } }, '语气 delivery（本句的情绪 + 语速 + 气口）'),
              h('textarea', { value: delivery, disabled: disabled, onChange: event => setDelivery(event.target.value) }),
            )
            : null,
          issues && issues.length > 0
            ? h('div', null, issues.map((issue, i) => h('div', { className: 'dd-issue', key: i }, '· ' + issue)))
            : null,
          dirty
            ? h('div', { className: 'dd-beat-foot' },
              h('button', { className: 'dd-btn sm primary', disabled: disabled, onClick: save }, '保存'),
              h('button', {
                className: 'dd-btn sm', disabled: disabled,
                onClick: () => {
                  setAction(beat.action || '')
                  setText(beat.text || '')
                  setDelivery(beat.delivery || '')
                  setMode(beat.mode || '')
                },
              }, '撤销'),
            )
            : null,
        ),
      )
    }

    /** The prompt: an artifact you can read, edit, and re-run. */
    function PromptEditor(props) {
      const { shot, prompt, busy, actions } = props
      const [editing, setEditing] = useState(false)
      const [draft, setDraft] = useState('')
      useEffect(() => {
        setDraft(prompt ? prompt.text || '' : '')
      }, [prompt ? prompt.text : ''])
      const words = prompt && prompt.text ? prompt.text.trim().split(/\s+/).length : 0
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } },
        h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center' } },
          h('button', { className: 'dd-btn sm', disabled: busy, onClick: () => actions.compileShot(shot.id, true) }, '校验过期'),
          h('button', { className: 'dd-btn sm', disabled: busy, onClick: () => actions.compileShot(shot.id, false) }, '重新编译'),
          editing
            ? h('button', {
              className: 'dd-btn sm primary', disabled: busy,
              onClick: () => { actions.savePrompt(shot.id, draft); setEditing(false) },
            }, '保存提示词')
            : h('button', {
              className: 'dd-btn sm', disabled: busy || !prompt,
              onClick: () => { setDraft(prompt ? prompt.text || '' : ''); setEditing(true) },
            }, '编辑'),
          prompt && prompt.overridden
            ? h('button', {
              className: 'dd-btn sm danger', disabled: busy,
              title: '丢弃手工改写，重新按真源编译',
              onClick: () => actions.resetPrompt(shot.id),
            }, '丢弃手工改写')
            : null,
          h('span', { className: 'dd-spacer' }),
          h('span', { className: 'dd-note' }, words ? words + ' 词' : '无产物'),
          prompt && prompt.stale ? h('span', { className: 'dd-badge warn' }, '已过期') : null,
          prompt && prompt.overridden ? h('span', { className: 'dd-badge' }, '手工改写') : null,
        ),
        prompt && prompt.overridden
          ? h('div', { className: 'dd-okbox' }, '这一镜的提示词有人工改写。重新编译会保留你的版本；要回到自动生成，点「丢弃手工改写」。')
          : null,
        editing
          ? h('textarea', {
            className: 'dd-prompt-edit', value: draft, autoFocus: true,
            onChange: event => setDraft(event.target.value),
          })
          : prompt && prompt.text
            ? h('div', { className: 'dd-prompt' }, prompt.text)
            : h('div', { className: 'dd-note' }, '还没有提示词产物。点「重新编译」按真源生成。'),
      )
    }

    function AssetThumb(props) {
      const { asset, workspaceId, onOpen } = props
      const isImage = asset.type === 'reference_image' || asset.type === 'keyframe'
      const [failed, setFailed] = useState(false)
      return h('div', { className: 'dd-thumb-wrap' },
        h('div', {
          className: 'dd-thumb' + (asset.status === 'deprecated' ? ' dep' : '') + (asset.missing ? ' missing' : ''),
          role: 'button',
          tabIndex: 0,
          'aria-label': '打开 ' + asset.id,
          onClick: () => { if (isImage && !asset.missing && !failed) onOpen(asset) },
          title: asset.path || asset.id,
        },
          asset.status === 'deprecated' ? h('span', { className: 'dep-mark' }, '作废') : null,
          isImage && !asset.missing
            ? h('img', {
              src: assetImageUrl(workspaceId, asset.id), alt: asset.id, loading: 'lazy',
              onError: () => setFailed(true),
            })
            : h('div', { className: 'ph' }, asset.missing ? '文件缺失' : (failed ? '无法显示' : (asset.type || 'asset'))),
          h('div', { className: 'cap', title: asset.id }, asset.id),
        ),
      )
    }

    function RuleCard(props) {
      const { rule } = props
      const [open, setOpen] = useState(false)
      return h('div', { className: 'dd-rule' + (rule.applicable ? ' on' : '') },
        h('div', { className: 'dd-rule-head', onClick: () => setOpen(!open) },
          h('span', { className: 'rid' }, rule.id),
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, rule.title),
          h('span', { className: 'st' }, (rule.stages || []).join(' · ')),
        ),
        open
          ? h('div', { className: 'dd-rule-body' },
            rule.evidence ? h('div', { className: 'ev' }, (rule.evidenceLabel ? rule.evidenceLabel + '：' : '') + rule.evidence) : null,
            rule.evidence ? h('div', { style: { marginTop: '7px' } }, rule.body) : h('div', null, rule.body),
            h('div', { style: { marginTop: '7px', color: rule.applicable ? 'var(--accent)' : 'var(--ink4)' } },
              rule.applicable ? '对本镜生效' : (rule.reason || '不适用')),
          )
          : null,
      )
    }

    /** The shot detail column: 真源、产物、判定、依据，同屏。 */
    function ShotDetail(props) {
      const { detail, loading, onClose, busy, actions, workspaceId, onOpenImage } = props
      if (loading) return h('div', { className: 'dd-detail' }, h('div', { className: 'dd-empty' }, '正在读取镜头…'))
      if (!detail) return h('div', { className: 'dd-detail' }, h('div', { className: 'dd-empty' }, t('empty.shot', '在网格里点一镜')))
      const shot = detail.shot
      const scene = detail.scene
      const beats = scene && Array.isArray(scene.beats) ? scene.beats : []
      const covered = new Set((shot.covers || []).map(index => index))
      const images = (detail.assets || []).filter(asset => asset.type === 'reference_image' || asset.type === 'keyframe')
      const videos = (detail.assets || []).filter(asset => asset.type === 'video')
      return h('div', { className: 'dd-detail' },
        h('div', { className: 'dd-detail-head' },
          h('span', { className: 'id' }, shot.id),
          h('span', { className: 'ttl' }, shot.title || ''),
          h('span', { className: 'dd-spacer' }),
          h('button', { className: 'dd-icon-btn', onClick: onClose, title: t('action.close', '关闭') }, h(Icon, { name: 'close', size: 13 })),
        ),
        h('div', { className: 'dd-detail-body' },
          h(Section, { title: t('section.camera', '镜头'), tag: t('tag.source', '真源'), tagKind: 'src', defaultOpen: true },
            h(ShotCameraEditor, { shot, busy, onSave: patch => actions.editShot(shot.id, patch) }),
          ),
          h(Section, { title: t('section.beats', '表演'), tag: t('tag.source', '真源'), tagKind: 'src', defaultOpen: false },
            beats.length === 0
              ? h('div', { className: 'dd-note' }, '该场次没有 beats')
              : h('div', { className: 'dd-beats' },
                beats.map((beat, index) => h(BeatEditor, {
                  key: index,
                  beat,
                  index: index + 1,
                  covered: covered.has(index + 1),
                  disabled: busy,
                  onSave: patch => actions.editBeat(scene.id, { op: 'patch', beatIndex: index + 1, patch }),
                  onInsert: () => actions.editBeat(scene.id, { op: 'insert', beatIndex: index + 1 }),
                  onDelete: () => actions.editBeat(scene.id, { op: 'delete', beatIndex: index + 1 }),
                  onMove: delta => actions.editBeat(scene.id, { op: 'move', beatIndex: index + 1, toIndex: index + 1 + delta }),
                })),
              ),
            ),
          h(Section, { title: t('section.note', '批注'), tag: t('tag.source', '真源'), tagKind: 'src', defaultOpen: false },
            h(Inline, {
              label: '这一镜你想记住什么？', value: shot.notes, multiline: true, disabled: busy,
              placeholder: '（空）',
              onSave: value => actions.annotate(shot.id, value),
            }),
          ),
          h(Section, { title: t('section.prompt', '提示词'), tag: t('tag.artifact', '产物'), tagKind: 'out', defaultOpen: false },
            h(PromptEditor, { shot, prompt: detail.prompt, busy, actions }),
          ),
          h(Section, { title: t('section.verdict', '判定'), tag: '体检器', defaultOpen: true },
            (detail.qc ? detail.qc.layers : []).map(layer => h('div', { key: layer.checker + ':' + layer.scope },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '5px' } },
                h('span', { style: { fontSize: '11.5px', fontWeight: '600' } }, layer.title),
                h('span', { className: 'num', style: { fontSize: '10px', color: 'var(--ink4)' } }, layer.scope || ''),
                h('span', { className: 'dd-spacer' }),
                layer.available
                  ? h('span', {
                    className: 'dd-badge ' + (layer.verdict === 'FAIL' ? 'fail' : layer.verdict === 'WARN' ? 'warn' : 'pass'),
                  }, layer.verdict || '')
                  : h('span', { className: 'dd-note' }, '不可用'),
              ),
              layer.available
                ? h('div', null,
                  (layer.metrics || []).map(metric => h(MetricRow, {
                    key: metric.name,
                    name: metric.name,
                    value: formatNumber(metric.value, typeof metric.value === 'number' && !Number.isInteger(metric.value) ? 3 : 0),
                    threshold: metric.threshold,
                  })),
                  (layer.issues || []).map((issue, index) => h('div', {
                    className: 'dd-issue' + (layer.verdict === 'WARN' ? ' warn' : ''), key: index,
                  }, '· ' + issue)),
                )
                : h('div', { className: 'dd-warnbox' }, layer.unavailableReason || '体检器不可用'),
            )),
            detail.report
              ? h('div', null,
                h('div', { style: { marginTop: '8px', fontSize: '11.5px', fontWeight: '600' } }, '验收报告'),
                h('div', { className: 'dd-note' }, 'verdict: ' + (detail.report.verdict || '—')),
              )
              : null,
          ),
          h(Section, { title: t('section.reference', '参照'), tag: '只读', defaultOpen: true },
            videos.length > 0
              ? videos.map(video => h('div', { key: video.id, style: { marginBottom: '9px' } },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' } },
                  h(Icon, { name: 'film', size: 13 }),
                  h('span', { className: 'num', style: { fontSize: '11px' } }, video.id),
                ),
                h('video', {
                  className: 'dd-video',
                  src: assetVideoUrl(workspaceId, video.id),
                  controls: true,
                  preload: 'metadata',
                  playsInline: true,
                }),
              ))
              : null,
            images.length === 0
              ? h('div', { className: 'dd-note' }, '这一镜没有登记参考图')
              : h('div', { className: 'dd-thumbs' },
                images.map(asset => h(AssetThumb, {
                  key: asset.id,
                  asset,
                  workspaceId,
                  onOpen: () => onOpenImage(asset),
                })),
              ),
          ),
          h(Section, { title: t('section.rules', '规则'), tag: '只读', defaultOpen: false },
            h('div', { className: 'dd-note' }, '此刻生效的规则（与结论同屏）'),
            (detail.rules || []).map(rule => h(RuleCard, { key: rule.id, rule })),
          ),
        ),
      )
    }

    // ── 宿主客户端服务的接线 ───────────────────────────────────────────────
    //
    // Client 半边拿不到 `ctx`，只有 `apply(ctx)` 拿得到。把 ctx 记在这里，
    // 组件才用得上 `sessions` / `uiWorkspace` / `layout` 这些宿主服务。
    let CTX = null

    /** 订阅一个 ObservableSnapshot（宿主自己的增量机制），返回它当前的值。 */
    function useStore(source) {
      const subscribe = useCallback(handler => {
        if (source === undefined || source === null || typeof source.subscribe !== 'function') return () => {}
        return source.subscribe(handler)
      }, [source])
      const read = useCallback(() => {
        if (source === undefined || source === null || typeof source.getSnapshot !== 'function') return undefined
        try {
          return source.getSnapshot()
        } catch {
          return undefined
        }
      }, [source])
      if (typeof React.useSyncExternalStore === 'function') {
        return React.useSyncExternalStore(subscribe, read, read)
      }
      const [value, setValue] = useState(read)
      useEffect(() => {
        setValue(read())
        return subscribe(() => setValue(read()))
      }, [subscribe, read])
      return value
    }

    /** 一条消息里所有 text 块的纯文本。 */
    function textOf(message) {
      if (message === undefined || message === null) return ''
      const content = message.content
      if (!Array.isArray(content)) return typeof message.text === 'string' ? message.text : ''
      const parts = []
      for (const block of content) {
        if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
          parts.push(block.text)
        }
      }
      return parts.join('')
    }

    /** 一条消息里调用了哪些工具（assistant 消息的工具调用藏在 content 块里）。 */
    function toolsOf(message) {
      const content = message === undefined || message === null ? undefined : message.content
      if (!Array.isArray(content)) return []
      const names = []
      for (const block of content) {
        if (block !== null && typeof block === 'object' && block.type === 'tool-call' && typeof block.name === 'string') {
          names.push(block.name)
        }
      }
      return names
    }

    /**
     * 抹掉宿主注入的上下文块。
     *
     * DSH 会把 `[system-reminder]`、记忆检索结果这类东西拼进**用户消息**里，
     * 宿主的对话面板会把它们折叠成「上下文」节点；我们这扇小窗没有那套节点，
     * 所以直接抹掉——导演想看的是自己说的话，不是系统提示。
     */
    function stripInjected(text) {
      return String(text ?? '')
        .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
        .replace(/\[system-reminder\][\s\S]*$/m, '')
        .trim()
    }

    /** 一条对话行。太长的（比如宿主注入的上下文）折起来，别把输入框顶走。 */
    function MsgRow(props) {
      const { kind, text } = props
      const [open, setOpen] = useState(false)
      const long = kind !== 'tool' && typeof text === 'string' && text.length > 420
      const shown = long && !open ? text.slice(0, 420) + '…' : text
      return h('div', { className: 'dd-msg ' + kind },
        h('div', { className: 'who' },
          kind === 'user' ? '我' : kind === 'assistant' ? 'AI' : kind === 'tool' ? '工具' : '出错'),
        h('div', { className: 'body' }, shown),
        long
          ? h('button', {
            className: 'dd-btn sm ghost',
            style: { alignSelf: 'flex-start' },
            onClick: () => setOpen(!open),
          }, open ? '收起' : '展开全文')
          : null,
      )
    }

    /**
     * 构思会话面板。
     *
     * **它不画一个仿造的聊天界面。** 会话是真的（真模型、真工具、
     * `drama-conceive` 技能、工作目录就是这个作品目录），这里只把
     * 宿主已经折叠好的会话窗口按「谁说的」摊开，并把输入框接到
     * `session.prompt()` 上。要看完整对话（工具卡片、推理、审批），
     * 一个按钮跳回宿主自己的对话面板。
     */
    function ConceiveChat(props) {
      const { sessionId, seed, onClose, onFresh, busy } = props
      const [reference, setReference] = useState(null)
      const [error, setError] = useState(null)
      const [draft, setDraft] = useState('')
      const seeded = useRef(false)
      const flowRef = useRef(null)

      useEffect(() => {
        if (!sessionId) return undefined
        const sessions = CTX ? CTX.get('sessions') : undefined
        if (sessions === undefined || sessions === null || typeof sessions.retain !== 'function') {
          setError('这个宿主没有 sessions 服务：构思会话需要 DSH 桌面版或 dsh web。')
          return undefined
        }
        let current
        try {
          current = sessions.retain(sessionId, { source: 'controllerOperation' })
        } catch (problem) {
          setError(problem instanceof Error ? problem.message : String(problem))
          return undefined
        }
        seeded.current = false
        setReference(current)
        setError(null)
        return () => {
          try {
            current.release()
          } catch {
            // 引用已经释放过：忽略。
          }
          setReference(null)
        }
      }, [sessionId])

      const binding = reference === null ? undefined : reference.binding
      const snapshot = useStore(binding === undefined ? undefined : binding.session)
      const window_ = useStore(binding === undefined ? undefined : binding.eventSource)

      // 第一次打开且这段会话还是空白 → 把开场白发出去（只发一次）。
      useEffect(() => {
        if (binding === undefined || seeded.current) return
        if (snapshot === undefined || snapshot.blank !== true) return
        if (typeof seed !== 'string' || seed === '') return
        seeded.current = true
        const session = binding.session
        if (session === undefined || typeof session.prompt !== 'function') return
        Promise.resolve(session.prompt([{ type: 'text', text: seed }], 'queue')).catch(() => {
          seeded.current = false
        })
      }, [binding, snapshot, seed])

      const rows = useMemo(() => {
        const entries = window_ !== undefined && Array.isArray(window_.entries) ? window_.entries : []
        const out = []
        let streaming = ''
        for (const entry of entries) {
          if (entry === null || typeof entry !== 'object') continue
          if (entry.type === 'transient') {
            const chunk = entry.event && entry.event.data ? entry.event.data.chunk : undefined
            if (chunk !== undefined && chunk !== null && chunk.type === 'text-delta' && typeof chunk.text === 'string') {
              streaming += chunk.text
            }
            continue
          }
          const event = entry.event
          if (event === undefined || event === null) continue
          if (event.type === 'user/message') {
            const text = stripInjected(textOf(event.data))
            if (text !== '') out.push({ kind: 'user', text, key: 'u' + event.seq })
          } else if (event.type === 'assistant/message') {
            const message = event.data ? event.data.message : undefined
            const text = textOf(message)
            const calls = toolsOf(message)
            // 只带工具调用的步骤也要露一行：否则导演看到的是「AI 一句话没说就停了」。
            if (text !== '') out.push({ kind: 'assistant', text, key: 'a' + event.seq })
            else if (calls.length > 0) out.push({ kind: 'tool', text: '调用 ' + calls.join(' · '), key: 'a' + event.seq })
          } else if (event.type === 'tool/call') {
            const name = event.data ? event.data.name : undefined
            if (typeof name === 'string' && name !== '') out.push({ kind: 'tool', text: name, key: 't' + event.seq })
          } else if (event.type === 'turn/end') {
            const reason = event.data ? event.data.reason : undefined
            if (reason !== undefined && reason !== null && reason.kind === 'error') {
              const why = reason.error && typeof reason.error.message === 'string' ? reason.error.message : '这一轮失败了'
              out.push({ kind: 'err', text: why, key: 'e' + event.seq })
            }
          }
        }
        if (streaming !== '') out.push({ kind: 'assistant', text: streaming, key: 'live' })
        return out
      }, [window_])

      const running = snapshot !== undefined && snapshot.running === true
      const openState = snapshot === undefined ? undefined : snapshot.openState

      // 新消息进来 → 滚到底。不这么做的话，AI 说完话你还停在几句之前。
      useEffect(() => {
        const element = flowRef.current
        if (element === null) return
        element.scrollTop = element.scrollHeight
      }, [rows])

      const send = useCallback(async () => {
        const text = draft.trim()
        if (text === '' || binding === undefined) return
        setDraft('')
        setError(null)
        try {
          const result = await binding.session.prompt([{ type: 'text', text }], 'queue')
          if (result !== undefined && result !== null && result.ok === false) {
            setError(result.error && result.error.message ? result.error.message : '发送失败')
          }
        } catch (problem) {
          setError(problem instanceof Error ? problem.message : String(problem))
        }
      }, [draft, binding])

      const stop = useCallback(() => {
        if (binding === undefined) return
        Promise.resolve(binding.session.cancel()).catch(() => {})
      }, [binding])

      const openInPanel = useCallback(() => {
        const helper = CTX ? CTX.get('uiWorkspace') : undefined
        const layout = CTX ? CTX.get('layout') : undefined
        try {
          if (helper !== undefined && helper !== null && typeof helper.openSession === 'function') helper.openSession(sessionId)
          if (layout !== undefined && layout !== null && typeof layout.selectPanel === 'function') layout.selectPanel('conversation')
        } catch {
          // 打不开就算了：面板里这段对话照常能聊。
        }
      }, [sessionId])

      const head = h('div', { className: 'dd-chat-head' },
        h(Icon, { name: 'note', size: 14 }),
        h('div', { style: { minWidth: '0' } },
          h('div', { className: 'ch-t' }, '构思会话'),
          h('div', { className: 'ch-sub' },
            openState === 'open' ? (running ? '正在想…' : '等你说话')
              : openState === 'loading' ? '正在打开…'
                : openState === 'error' ? '打不开这段会话'
                  : '准备中…'),
        ),
        h('span', { className: 'dd-spacer' }),
        h('button', { className: 'dd-btn sm', onClick: onFresh, title: '开一段新对话（旧的那段仍留在 DSH 的会话列表里）' }, '新对话'),
        h('button', { className: 'dd-btn sm', onClick: openInPanel, title: '在宿主的对话面板里打开完整聊天' }, '完整对话'),
        h('button', { className: 'dd-icon-btn', onClick: onClose, title: '收起' }, h(Icon, { name: 'close', size: 13 })),
      )

      const flow = h('div', { className: 'dd-chat-flow', ref: flowRef },
        rows.length === 0
          ? h('div', { className: 'dd-chat-empty' },
            h('div', null, '这里接的是**真的** DSH 会话：'),
            h('div', null, '同一个模型、同一套工具、加载了 `drama-conceive` 技能。'),
            h('div', { style: { marginTop: '8px', color: 'var(--ink4)' } }, '它会把创意写进 creative/brief.md，你改一句它就改一句。'))
          : rows.map(row => h(MsgRow, { key: row.key, kind: row.kind, text: row.text })),
        error !== null
          ? h('div', { className: 'dd-msg err' }, h('div', { className: 'body' }, error))
          : null,
      )

      const composer = h('div', { className: 'dd-chat-composer' },
        h('textarea', {
          value: draft, placeholder: '跟它说你想拍什么…（Enter 发送，Shift+Enter 换行）',
          disabled: busy || binding === undefined,
          onChange: event => setDraft(event.target.value),
          onKeyDown: event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          },
        }),
        h('div', { className: 'row' },
          running
            ? h('button', { className: 'dd-btn sm danger', onClick: stop }, '停止')
            : h('button', { className: 'dd-btn sm primary', onClick: send, disabled: draft.trim() === '' }, '发送'),
          h('span', { className: 'dd-spacer' }),
          h('span', { className: 'hint' }, sessionId === undefined ? '' : sessionId.slice(0, 8)),
        ),
      )

      return h('div', { className: 'dd-chat' }, head, flow, composer)
    }

    // ── 首页 ───────────────────────────────────────────────────────────────

    function HomeView(props) {
      const { works, current, onPick, onCreate, onEnter, busy } = props
      const cards = works.map(work => h('button', {
        key: work.id,
        className: 'dd-work-card' + (work.id === current ? ' on' : ''),
        onClick: () => onPick(work.id),
      },
        h('div', { className: 'wt' }, work.title || work.id),
        h('div', { className: 'wi' }, work.id + ' · ' + (work.stage || '—')),
        h('div', { className: 'wm' },
          h('span', null, (work.scenes ?? 0) + ' 场'),
          h('span', null, (work.shots ?? 0) + ' 镜'),
        ),
      ))
      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-home' },
            h('div', { className: 'dd-home-hero' },
              h('div', { style: { minWidth: '0', flex: '1 1 380px' } },
                h('div', { className: 'h1' }, '从一个想法开始'),
                h('div', { className: 'h2' },
                  '导演工作台把 AI 短剧的九个阶段摊开：创意、大纲、角色、剧本、分镜、生成、验收、装配、交付。'
                  + '每个阶段有自己的产物与体检线，你随时能改，随时能退回去重做一镜。'),
                h('div', { className: 'h3' },
                  '右边那扇窗是一个**真的** AI 会话——加载了 conceive 阶段的技能，'
                  + '它会把创意写进 creative/brief.md。你可以一直跟它聊，这一阶段是持续的过程。'),
              ),
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', flex: '0 0 auto' } },
                current !== undefined
                  ? h('button', { className: 'dd-btn primary', disabled: busy, onClick: onEnter }, '进入工作台')
                  : null,
                h('button', { className: 'dd-btn', disabled: busy, onClick: onCreate }, '新建作品'),
              ),
            ),
            h('div', { className: 'dd-home-sec' },
              h('h4', null, '作品' + (works.length > 0 ? '（' + works.length + '）' : '')),
              works.length === 0
                ? h('div', { className: 'dd-note' },
                  '项目根下还没有作品。点「新建作品」建一个空骨架，或者先把右边的构思会话开起来——'
                  + '它会在你写简报时帮你把故事想清楚。')
                : h('div', { className: 'dd-works' },
                  cards,
                  h('button', { className: 'dd-work-card new', onClick: onCreate },
                    h(Icon, { name: 'plus', size: 14 }),
                    h('span', null, '新建作品'),
                  ),
                ),
            ),
          ),
        ),
      )
    }

    // ── spec view ──────────────────────────────────────────────────────────
    function SpecView(props) {
      const { spec, tab, onTab, stage, onStage } = props
      const [openRule, setOpenRule] = useState(null)
      if (!spec) return h('div', { className: 'dd-empty' }, '正在读取规范…')
      if (!spec.available) {
        return h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            h('div', { className: 'dd-warnbox' }, spec.hint || '规范未构建'),
            h('div', { className: 'dd-note' }, '规范是唯一真源。缺了它，界面上的「依据」就没有出处。'),
          ))
      }
      const rules = spec.rules.filter(rule => !stage || rule.inStage)
      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-toolbar' },
          h('div', { className: 'dd-seg' },
            h('button', { className: tab === 'rules' ? 'on' : '', onClick: () => onTab('rules') }, t('tab.rules', '铁律')),
            h('button', { className: tab === 'constitution' ? 'on' : '', onClick: () => onTab('constitution') }, t('tab.constitution', '创作宪法')),
            h('button', { className: tab === 'contract' ? 'on' : '', onClick: () => onTab('contract') }, t('tab.contract', '数据契约')),
            h('button', { className: tab === 'checklist' ? 'on' : '', onClick: () => onTab('checklist') }, t('tab.checklist', '验收清单')),
          ),
          h('span', { className: 'dd-spacer' }),
          tab === 'rules'
            ? h('select', { className: 'dd-input', value: stage, onChange: event => onStage(event.target.value) },
              h('option', { value: '' }, '全部阶段'),
              STAGES.map(entry => h('option', { value: entry.id, key: entry.id }, entry.en)))
            : null,
        ),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            tab === 'rules'
              ? h('div', null,
                h('div', { className: 'dd-note', style: { marginBottom: '9px' } },
                  '来源：' + (spec.sources && spec.sources.rules ? spec.sources.rules : '') + '（规则真源，界面不复述）'),
                h('div', { className: 'dd-rule-list' },
                  rules.map(rule => h('div', { key: rule.id },
                    h('div', {
                      className: 'dd-rule-row',
                      onClick: () => setOpenRule(openRule === rule.id ? null : rule.id),
                    },
                      h('span', { className: 'rid' }, rule.id),
                      h('span', { className: 'ti' }, rule.title),
                      h('span', { className: 'st' }, (rule.stages || []).join(' · ')),
                    ),
                    openRule === rule.id
                      ? h('div', { className: 'dd-rule-body' },
                        rule.evidence ? h('div', { className: 'ev' }, (rule.evidenceLabel ? rule.evidenceLabel + '：' : '') + rule.evidence) : null,
                        rule.evidence ? h('div', { style: { marginTop: '7px' } }, rule.body) : h('div', null, rule.body),
                      )
                      : null,
                  )),
                ),
              )
              : h(DocView, { sections: spec[tab] || [] }),
          ),
        ),
      )
    }

    /** Render a parsed markdown section tree. */
    function DocView(props) {
      return h('div', { className: 'dd-doc' },
        (props.sections || []).map((section, index) => h('div', { key: index },
          h('h4', null, section.heading),
          section.body ? h(MarkdownLite, { text: section.body }) : null,
          section.children && section.children.length > 0
            ? h('div', { style: { paddingLeft: '14px', borderLeft: '.5px solid var(--line)' } }, h(DocView, { sections: section.children }))
            : null,
        )),
      )
    }

    /** A deliberately small markdown renderer: paragraphs, bullets, tables, code. */
    function MarkdownLite(props) {
      const lines = String(props.text || '').split(/\r?\n/)
      const blocks = []
      let i = 0
      while (i < lines.length) {
        const line = lines[i]
        if (/^\s*\|/.test(line)) {
          const rows = []
          while (i < lines.length && /^\s*\|/.test(lines[i])) {
            rows.push(lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim()))
            i++
          }
          const head = rows.find(row => !row.every(cell => /^:?-{2,}:?$/.test(cell)))
          const body = rows.filter(row => row !== head && !row.every(cell => /^:?-{2,}:?$/.test(cell)))
          if (head) {
            blocks.push(h('table', { className: 'dd-table', key: 't' + blocks.length, style: { margin: '8px 0' } },
              h('thead', null, h('tr', null, head.map((cell, index) => h('th', { key: index }, cell)))),
              h('tbody', null, body.map((row, index) => h('tr', { key: index }, row.map((cell, cellIndex) => h('td', { key: cellIndex }, cell))))),
            ))
          }
          continue
        }
        if (/^\s*[-*]\s+/.test(line)) {
          const items = []
          while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
            items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
            i++
          }
          blocks.push(h('ul', { key: 'u' + blocks.length }, items.map((item, index) => h('li', { key: index }, item))))
          continue
        }
        if (/^\s*#{1,4}\s+/.test(line)) {
          const level = /^\s*(#{1,4})\s+/.exec(line)[1].length
          blocks.push(h(level === 1 ? 'h4' : 'h5', { key: 'hd' + blocks.length }, line.replace(/^\s*#{1,4}\s+/, '')))
          i++
          continue
        }
        if (/^\s*```/.test(line)) {
          const code = []
          i++
          while (i < lines.length && !/^\s*```/.test(lines[i])) { code.push(lines[i]); i++ }
          i++
          blocks.push(h('pre', {
            key: 'c' + blocks.length,
            style: {
              fontFamily: 'var(--latin-serif)', fontSize: '11px', background: 'var(--card)',
              padding: '9px 11px', borderRadius: '9px', overflow: 'auto', border: '.5px solid var(--line)',
            },
          }, code.join('\n')))
          continue
        }
        if (line.trim() === '') { i++; continue }
        const paragraph = []
        while (i < lines.length && lines[i].trim() !== '' && !/^\s*(\||[-*]\s|```|#{1,4}\s)/.test(lines[i])) {
          paragraph.push(lines[i])
          i++
        }
        blocks.push(h('p', { key: 'p' + blocks.length, style: { margin: '5px 0' } }, paragraph.join(' ')))
      }
      return h('div', null, blocks)
    }

    // ── assets / ledger ────────────────────────────────────────────────────
    function AssetsView(props) {
      const { assets, onOpenImage, workspaceId } = props
      if (!assets) return h('div', { className: 'dd-empty' }, '正在读取资产…')
      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-toolbar' },
          h('span', { className: 'dd-chip' }, '共 ', h('b', { className: 'num' }, String(assets.totals ? assets.totals.count : 0)), ' 个'),
          h('span', { className: 'dd-chip' }, '作废 ', h('b', { className: 'num' }, String(assets.totals ? assets.totals.deprecated : 0))),
          h('span', { className: 'dd-chip' }, '缺失 ', h('b', { className: 'num' }, String(assets.totals ? assets.totals.missing : 0))),
          h('span', { className: 'dd-chip' }, '占用 ', h('b', { className: 'num' }, formatBytes(assets.totals ? assets.totals.bytes : 0))),
          h('span', { className: 'dd-spacer' }),
          h('span', { className: 'dd-note' }, '资产只增不删：作废的标 deprecated 并保留路径指向归档'),
        ),
        h('div', { className: 'dd-scroll' },
          h('table', { className: 'dd-table' },
            h('thead', null, h('tr', null,
              h('th', null, '资产'), h('th', null, '类型'), h('th', null, '状态'),
              h('th', { className: 'n' }, '引用'), h('th', { className: 'n' }, '尺寸'), h('th', { className: 'n' }, '体积'), h('th', null, '路径'),
            )),
            h('tbody', null, assets.assets.map(asset => h('tr', { key: asset.id },
              h('td', null, asset.id),
              h('td', null, asset.type || '—'),
              h('td', null,
                h('span', { style: { color: asset.status === 'deprecated' ? 'var(--warn)' : 'var(--ok)' } }, asset.status || 'active'),
                asset.missing ? h('span', { style: { color: 'var(--danger)', marginLeft: '5px' } }, '缺失') : null,
              ),
              h('td', { className: 'n' }, (asset.referencedBy || []).length),
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
      )
    }

    function LedgerView(props) {
      const { ledger } = props
      if (!ledger) return h('div', { className: 'dd-empty' }, '正在读取台账…')
      const totals = ledger.totals || {}
      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-toolbar' },
          h('span', { className: 'dd-chip' }, '任务 ', h('b', { className: 'num' }, String(totals.tasks || 0))),
          h('span', { className: 'dd-chip' }, '花费 ', h('b', { className: 'num' }, '$' + formatNumber(totals.costUsd || 0, 2))),
          ledger.budget
            ? h('span', { className: 'dd-chip' }, '预算 ', h('b', { className: 'num' }, '$' + formatNumber(ledger.budget.limit_usd || 0, 2)),
              ' · 已用 ', h('b', { className: 'num' }, '$' + formatNumber(ledger.budget.spent_usd || 0, 2)))
            : null,
          h('span', { className: 'dd-spacer' }),
          h('span', { className: 'dd-note' }, '幂等三步：台账 → 提交 → 立刻回写'),
        ),
        h('div', { className: 'dd-scroll' },
          h('table', { className: 'dd-table' },
            h('thead', null, h('tr', null,
              h('th', null, '镜头'), h('th', null, '状态'), h('th', null, '模型'),
              h('th', { className: 'n' }, '时长'), h('th', { className: 'n' }, '费用'),
              h('th', null, '提交时间'), h('th', null, 'task_id'),
            )),
            h('tbody', null, ledger.entries.map(entry => h('tr', { key: (entry.taskId || '') + (entry.shotId || '') + (entry.submittedAt || '') },
              h('td', { className: 'n' }, entry.shotId || '—'),
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
      )
    }

    // ── image viewer (a real dialog, not a full-screen takeover) ───────────
    function ImageViewer(props) {
      const containerRef = useRef(null)
      const [scale, setScale] = useState(1)
      const [offset, setOffset] = useState({ x: 0, y: 0 })
      const [natural, setNatural] = useState({ width: 0, height: 0 })
      const dragRef = useRef(null)

      const applyFit = useCallback(() => {
        const box = containerRef.current
        if (!box || natural.width === 0) return
        const next = Math.min(box.clientWidth / natural.width, box.clientHeight / natural.height)
        setScale(next)
        setOffset({ x: (box.clientWidth - natural.width * next) / 2, y: (box.clientHeight - natural.height * next) / 2 })
      }, [natural])

      const onLoad = useCallback(event => {
        const img = event.currentTarget
        const size = { width: img.naturalWidth, height: img.naturalHeight }
        setNatural(size)
        const box = containerRef.current
        if (!box) return
        const next = Math.min(box.clientWidth / size.width, box.clientHeight / size.height)
        setScale(next)
        setOffset({ x: (box.clientWidth - size.width * next) / 2, y: (box.clientHeight - size.height * next) / 2 })
      }, [])

      const zoomAt = useCallback((factor, clientX, clientY) => {
        setScale(previous => {
          const next = Math.min(6, Math.max(0.05, previous * factor))
          const box = containerRef.current
          if (!box || clientX === undefined) return next
          const rect = box.getBoundingClientRect()
          const px = clientX - rect.left
          const py = clientY - rect.top
          setOffset(current => ({
            x: px - (px - current.x) * (next / previous),
            y: py - (py - current.y) * (next / previous),
          }))
          return next
        })
      }, [])

      const onWheel = useCallback(event => {
        event.preventDefault()
        zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX, event.clientY)
      }, [zoomAt])

      const onPointerDown = useCallback(event => {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y }
        event.currentTarget.classList.add('drag')
      }, [offset.x, offset.y])

      const onPointerMove = useCallback(event => {
        const drag = dragRef.current
        if (!drag) return
        setOffset({ x: event.clientX - drag.x, y: event.clientY - drag.y })
      }, [])

      const endDrag = useCallback(event => {
        dragRef.current = null
        if (event.currentTarget.hasPointerCapture && event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        event.currentTarget.classList.remove('drag')
      }, [])

      useEffect(() => {
        const onKey = event => {
          if (event.key === 'Escape') { event.stopPropagation(); props.onClose() }
          else if (event.key === 'ArrowLeft') setOffset(o => ({ x: o.x - 60, y: o.y }))
          else if (event.key === 'ArrowRight') setOffset(o => ({ x: o.x + 60, y: o.y }))
          else if (event.key === 'ArrowUp') setOffset(o => ({ x: o.x, y: o.y - 60 }))
          else if (event.key === 'ArrowDown') setOffset(o => ({ x: o.x, y: o.y + 60 }))
          else if (event.key === '+' || event.key === '=') zoomAt(1.2)
          else if (event.key === '-' || event.key === '_') zoomAt(1 / 1.2)
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [props, zoomAt])

      const asset = props.asset || {}
      return h('div', {
        className: 'dd-modal-backdrop',
        onMouseDown: event => { if (event.target === event.currentTarget) props.onClose() },
      },
        h('div', { className: 'dd-modal', role: 'dialog', 'aria-modal': 'true' },
          h('div', { className: 'dd-modal-head' },
            h(Icon, { name: 'eye', size: 14 }),
            h('span', { className: 'num', style: { fontSize: '12.5px' } }, asset.id || ''),
            h('span', { className: 'dd-spacer' }),
            natural.width
              ? h('span', { className: 'num', style: { fontSize: '11px', color: 'var(--ink4)' } },
                natural.width + '×' + natural.height + ' · ' + Math.round(scale * 100) + '%')
              : null,
            h('button', { className: 'dd-btn sm', onClick: applyFit }, t('action.fit', '适应窗口')),
            h('button', {
              className: 'dd-btn sm',
              onClick: () => { setScale(1); setOffset({ x: 0, y: 0 }) },
            }, t('action.actualSize', '1:1')),
            h('button', { className: 'dd-icon-btn', onClick: props.onClose, title: t('action.close', '关闭') },
              h(Icon, { name: 'close', size: 13 })),
          ),
          h('div', {
            className: 'dd-modal-stage',
            ref: containerRef,
            onWheel: onWheel,
            onPointerDown: onPointerDown,
            onPointerMove: onPointerMove,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            onDoubleClick: applyFit,
          },
            h('img', {
              src: props.src, alt: asset.id || '', onLoad: onLoad,
              style: { transform: 'translate(' + offset.x + 'px,' + offset.y + 'px) scale(' + scale + ')' },
            }),
          ),
          h('div', { className: 'dd-modal-foot' },
            h('span', { className: 'mf' }, '路径 ', h('b', null, asset.path || '—')),
            asset.source ? h('span', { className: 'mf' }, '来源 ', h('b', null, asset.source)) : null,
            asset.state ? h('span', { className: 'mf' }, '状态 ', h('b', null, asset.state)) : null,
            asset.notes ? h('span', { className: 'mf' }, '备注 ', h('b', null, asset.notes)) : null,
            asset.prompt
              ? h('div', { className: 'dd-modal-prompt' }, asset.prompt)
              : h('span', { className: 'mf', style: { color: 'var(--ink4)' } }, '（这张图没有登记提示词）'),
          ),
        ),
      )
    }

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
            note: '这里列的是宿主**已经配好**的模型路由，不需要在本插件里再存一份 API key。',
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

    // ── root ───────────────────────────────────────────────────────────────
    function DramaDesk() {
      const [overview, setOverview] = useState(null)
      const [pipeline, setPipeline] = useState(null)
      const [stages, setStages] = useState(null)
      const [settings, setSettings] = useState(null)
      const [stagePayload, setStagePayload] = useState(null)
      const [stageLoading, setStageLoading] = useState(false)
      const [detail, setDetail] = useState(null)
      const [detailLoading, setDetailLoading] = useState(false)
      const [spec, setSpec] = useState(null)
      const [assets, setAssets] = useState(null)
      const [ledger, setLedger] = useState(null)
      const [view, setView] = useState('stage')
      const [specTab, setSpecTab] = useState('rules')
      const [specStage, setSpecStage] = useState('')
      const [selectedShot, setSelectedShot] = useState(null)
      const [workspaceId, setWorkspaceId] = useState('')
      const [viewStage, setViewStage] = useState('')
      const [busy, setBusy] = useState(false)
      const [toast, setToast] = useState(null)
      const [viewer, setViewer] = useState(null)
      const [drawer, setDrawer] = useState(false)
      const [fullSettings, setFullSettings] = useState(null)
      const [browseTarget, setBrowseTarget] = useState(null)
      /** null = 自动（作品还是空的就显示首页）；true / false = 用户自己定的。 */
      const [homeMode, setHomeMode] = useState(null)
      const [chatOpen, setChatOpen] = useState(false)
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
        setStageLoading(true)
        try {
          const payload = await apiGet('stage', { workspace: workspaceId, stage })
          setStagePayload(payload)
          stageRevision.current = payload && payload.revision ? payload.revision : null
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
        } finally {
          setStageLoading(false)
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
       */
      const openConceive = useCallback(async fresh => {
        setChatOpen(true)
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
      const chatVisible = chatOpen && (showHome || (view === 'stage' && viewStage === 'conceive'))

      const stageData = stagePayload ? stagePayload.data : undefined
      // 用**载荷自己的阶段**来选组件：这样即使 viewStage 刚变、请求还在路上，
      // 也不会出现「已经拿到数据却什么都不显示」的空档。
      const shownStage = stagePayload ? (stagePayload.stage || stagePayload.kind) : viewStage
      const switching = stagePayload !== null && shownStage !== viewStage

      return h('div', { className: 'dd', ref: rootRef },
        h('style', null, CSS),
        h('div', { className: 'dd-ambient', 'aria-hidden': 'true' }),
        // ── top bar ───────────────────────────────────────────────────────
        h('div', { className: 'dd-top' },
          h('div', { className: 'dd-mark' },
            h('button', {
              className: 'dd-mark-glyph',
              onClick: () => { setHomeMode(true); setView('stage') },
              title: '回到首页',
              'aria-label': '回到首页',
            }, h(Icon, { name: 'grid', size: 15 })),
            h('div', null,
              h('div', { className: 'dd-mark-title' }, t('brand.title', '导演工作台')),
              h('div', { className: 'dd-mark-sub' }, t('brand.subtitle', 'AI 短剧生产线')),
            ),
          ),
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
                ? h('span', { className: 'dd-work-sub' }, currentWork.shots + '镜')
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
          h('div', { className: 'dd-tally' },
            h('span', { className: 'dd-tally-item' }, h('span', { className: 'dd-led fail' }), h('b', null, String(counts.fail || 0)), 'FAIL'),
            h('span', { className: 'dd-tally-item' }, h('span', { className: 'dd-led warn' }), h('b', null, String(counts.warn || 0)), 'WARN'),
            h('span', { className: 'dd-tally-item' }, h('span', { className: 'dd-led gen' }), h('b', null, String(counts.generated || 0)), '未体检'),
            h('span', { className: 'dd-tally-item' }, h('span', { className: 'dd-led pass' }), h('b', null, String(counts.pass || 0)), '通过'),
          ),
          h('div', { className: 'dd-top-right' },
            overview
              ? h('span', {
                className: 'dd-chip click',
                title: '产物位置：' + overview.outputRoot + '\n' + (overview.outputRootReason || '') + '\n点击改设置',
                onClick: openDrawer,
              },
                h(Icon, { name: 'asset', size: 12 }),
                h('span', { className: 'num', style: { maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis' } }, overview.outputRoot),
              )
              : null,
            overview && overview.disk
              ? h('span', { className: 'dd-chip', title: '磁盘占用' },
                h('b', { className: 'num' }, Math.round(overview.disk.ratio * 100) + '%'),
                h('span', { className: 'num', style: { color: 'var(--ink4)' } }, '剩 ' + formatBytes(overview.disk.free)),
              )
              : null,
            h('button', {
              className: 'dd-icon-btn' + (chatVisible ? ' on' : ''),
              onClick: () => { if (chatOpen) setChatOpen(false); else openConceive() },
              title: chatOpen ? '收起构思会话' : '构思会话（真的 AI，加载 conceive 技能）',
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
            setViewStage(stage)
            setView('stage')
            setHomeMode(false)
            setStagePayload(null)
            stageRevision.current = null
          },
        }),
        h(PreviewBar, {
          viewing: viewStage,
          committed,
          requirement: railStages.find(entry => entry.stage === viewStage)
            ? railStages.find(entry => entry.stage === viewStage).requirement
            : undefined,
          onBack: () => { setViewStage(committed || ''); setStagePayload(null); stageRevision.current = null },
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
              ? stageLoading && !stagePayload
                ? h('div', { className: 'dd-empty' }, '正在读取 ' + (STAGE_LABEL[viewStage] || viewStage) + ' 阶段…')
                : stageData === undefined
                  ? h('div', { className: 'dd-empty' },
                    h('div', { className: 'dd-empty-title' }, '这一阶段还没有数据'),
                    h('div', null, '正在看的阶段：' + (viewStage || '—')
                      + '；拿到载荷的阶段：' + (stagePayload ? (stagePayload.stage || stagePayload.kind || '—') : '还没有')),
                    h('div', { style: { marginTop: '10px' } },
                      h('button', {
                        className: 'dd-btn',
                        onClick: () => { setStagePayload(null); stageRevision.current = null; loadStage(viewStage) },
                      }, '重新读取')))
                  : switching
                    ? h('div', { className: 'dd-empty' }, '正在切换到 ' + (STAGE_LABEL[viewStage] || viewStage) + '…')
                    : null
              : null,
              view === 'stage' && !showHome && stageData !== undefined && !switching
                ? (shownStage === 'conceive'
                  ? h(ConceiveView, { data: stageData, busy, actions })
                  : shownStage === 'outline'
                    ? h(OutlineView, { data: stageData, busy, actions, onGoto: stage => { setViewStage(stage); setStagePayload(null); stageRevision.current = null } })
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
                            })
                            : shownStage === 'verify'
                              ? h(VerifyView, { data: stageData, busy, actions, onOpenShot: openShot })
                              : shownStage === 'assemble'
                                ? h(AssembleView, { data: stageData, onOpenShot: openShot })
                                : h(DeliverView, { data: stageData }))
                : null,
            view === 'spec' ? h(SpecView, { spec, tab: specTab, onTab: setSpecTab, stage: specStage, onStage: setSpecStage }) : null,
            view === 'assets' ? h(AssetsView, { assets, workspaceId, onOpenImage: asset => setViewer(asset) }) : null,
            view === 'ledger' ? h(LedgerView, { ledger }) : null,
          ),
          (view === 'stage' && !showHome && (viewStage === 'generate' || viewStage === 'storyboard'))
            ? h(ShotDetail, {
              detail,
              loading: detailLoading,
              busy,
              actions,
              workspaceId,
              onClose: () => { setSelectedShot(null); setDetail(null) },
              onOpenImage: asset => setViewer(asset),
            })
            : null,
          // ── 构思会话（右栏）────────────────────────────────────────────
          // 首页和 conceive 阶段都在，因为「想创意」不是一次性动作，
          // 是一个持续的过程：想 → 写简报 → 改简报，都在同一段对话里。
          chatVisible
            ? h(ConceiveChat, {
              sessionId: conceive && conceive.sessionId ? conceive.sessionId : undefined,
              seed: conceive && conceive.seed ? conceive.seed : undefined,
              busy,
              onClose: () => setChatOpen(false),
              onFresh: () => openConceive(true),
            })
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
              background: 'rgba(4,6,9,.6)',
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

    /** The sidebar glyph. */
    function DramaDeskIcon(props) {
      const size = props.size ?? 18
      return h('svg', {
        width: size, height: size, viewBox: '0 0 20 20', fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true,
        style: { display: 'block', pointerEvents: 'none' },
      }, [
        h('rect', { key: 'a', x: 2, y: 3, width: 16, height: 14, rx: 2.5, stroke: 'currentColor', strokeWidth: 1.5 }),
        h('rect', { key: 'b', x: 5, y: 6, width: 4, height: 4, rx: 1, fill: 'currentColor', opacity: 0.85 }),
        h('rect', { key: 'c', x: 11, y: 6, width: 4, height: 4, rx: 1, fill: 'currentColor', opacity: 0.4 }),
        h('rect', { key: 'd', x: 5, y: 12, width: 4, height: 4, rx: 1, fill: 'currentColor', opacity: 0.85 }),
        h('circle', { key: 'e', cx: 13, cy: 14, r: 2.6, stroke: 'currentColor', strokeWidth: 1.5 }),
      ])
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
  },
})
