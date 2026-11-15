/*!
 * dsh-drama-desk — client half (browser bundle).
 *
 * 导演工作台 —— AI 短剧生产流水线的工作台。
 *
 * 设计语言：**导播台 / 监视器**。深石墨蓝的层次、发光的状态灯（tally）、
 * 发丝级分隔线、等宽数字读数。字面用宿主的品牌字族（Montserrat）与代码字族，
 * 所以它看起来是「原生」而不是「嵌进来的一个网页」。
 *
 * 一句话：**网格上的每一格，颜色就是体检器自己的判定**；
 * 点开一镜，**依据与结论同屏**——不只是「FAIL」，还有「0.279 < 0.28，差 0.001」。
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
.dd-work{
  display:flex;align-items:center;gap:8px;height:32px;padding:0 12px;border-radius:var(--r-md);
  background:var(--glass);border:.5px solid var(--line);box-shadow:var(--elev-panel);
  transition:border-color .18s var(--ease),background .18s var(--ease);
}
.dd-work:hover{border-color:var(--accent)}
.dd-work select{background:none;border:none;outline:none;font-size:13px;font-weight:500;max-width:190px;cursor:pointer}
.dd-work option{background:var(--card);color:var(--ink)}
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

/* ── stage rail ──────────────────────────────────────────────────────── */
.dd-rail{
  display:flex;align-items:center;gap:0;padding:10px 18px;flex:none;z-index:2;
  background:var(--bg);border-bottom:.5px solid var(--line);overflow-x:auto;scrollbar-width:none;
}
.dd-rail::-webkit-scrollbar{display:none}
.dd-stage{
  display:flex;align-items:center;gap:7px;padding:5px 12px;border-radius:var(--r-sm);flex:none;
  font-size:12px;color:var(--ink3);border:.5px solid transparent;cursor:pointer;white-space:nowrap;
  transition:color .18s var(--ease),background .18s var(--ease),border-color .18s var(--ease);
}
.dd-stage:hover{color:var(--ink);background:var(--hover)}
.dd-stage i{width:12px;height:12px;border-radius:50%;background:transparent;box-shadow:inset 0 0 0 1px var(--line-strong);transition:background .3s var(--ease),box-shadow .3s var(--ease)}
.dd-stage.done{color:var(--ink2)}
.dd-stage.done i{background:var(--ok);box-shadow:none}
.dd-stage.ready{color:var(--ink)}
.dd-stage.ready i{background:var(--accent);box-shadow:0 0 9px color-mix(in srgb,var(--accent) 55%,transparent);animation:dd-breathe 1.4s ease-in-out infinite}
.dd-stage.current{background:var(--primary);border-color:var(--primary);color:var(--on-primary);font-weight:500}
.dd-stage.current i{background:var(--on-primary);box-shadow:none;animation:none}
.dd-stage.blocked{color:var(--ink3)}
.dd-stage.blocked i{background:var(--danger);opacity:.55;box-shadow:none}
.dd-rail-sep{width:16px;height:1px;background:var(--line);flex:none}
@keyframes dd-breathe{50%{opacity:.5}}

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
  display:flex;align-items:center;gap:10px;padding:10px 18px;flex:none;
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
.dd-btn.primary{background:var(--primary);border-color:var(--primary);color:var(--on-primary);font-weight:500}
.dd-btn.primary:hover:not(:disabled){background:var(--primary-hover);border-color:var(--primary-hover)}
.dd-btn.danger{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 40%,transparent)}
.dd-btn.danger:hover:not(:disabled){background:color-mix(in srgb,var(--danger) 12%,transparent);border-color:var(--danger)}
.dd-spacer{flex:1}

/* ── pipeline ────────────────────────────────────────────────────────── */
.dd-scroll{overflow:auto;flex:1 1 auto;min-height:0}
.dd-grid{padding:14px 20px 32px;max-width:1500px;margin:0 auto}
.dd-scene{
  display:grid;grid-template-columns:172px 1fr;gap:20px;align-items:start;
  padding:13px 0;border-bottom:.5px solid var(--line);
  animation:dd-rise .6s var(--ease) both;
}
.dd-scene:last-child{border-bottom:none}
@keyframes dd-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.dd-scene-head{min-width:0}
.dd-scene-id{font-family:var(--latin-serif);font-size:11.5px;color:var(--ink4);letter-spacing:.08em}
.dd-scene-title{font-size:13.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
.dd-scene-meta{display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap}
.dd-scene-meta .num{font-size:11.5px;color:var(--ink4)}
.dd-badge{
  font-size:10.5px;padding:2px 8px;border-radius:999px;border:.5px solid var(--line);
  color:var(--ink3);display:inline-flex;align-items:center;gap:5px;
}
.dd-badge.fail{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 40%,transparent);background:color-mix(in srgb,var(--danger) 10%,transparent)}
.dd-badge.pass{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 35%,transparent)}
.dd-badge.warn{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 35%,transparent);background:color-mix(in srgb,var(--warn) 10%,transparent)}
.dd-cells{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.dd-cell{
  position:relative;border-radius:var(--r-xs);border:.5px solid var(--line-strong);background:var(--card);
  font-family:var(--latin-serif);font-size:11px;color:var(--ink3);overflow:visible;
  transition:transform .2s var(--pop),box-shadow .25s var(--ease),border-color .25s var(--ease),background .25s var(--ease);
}
.dd-cell:hover{transform:translateY(-3px) scale(1.04);box-shadow:var(--elev-prominent);z-index:3}
.dd-cell[data-status="generated"]{border-color:color-mix(in srgb,var(--draft) 55%,transparent);background:color-mix(in srgb,var(--draft) 14%,transparent);color:var(--draft)}
.dd-cell[data-status="warn"]{border-color:color-mix(in srgb,var(--warn) 60%,transparent);background:color-mix(in srgb,var(--warn) 16%,transparent);color:var(--warn)}
.dd-cell[data-status="fail"]{border-color:var(--danger);background:color-mix(in srgb,var(--danger) 22%,transparent);color:var(--danger);box-shadow:0 0 14px color-mix(in srgb,var(--danger) 26%,transparent)}
.dd-cell[data-status="pass"]{border-color:color-mix(in srgb,var(--ok) 55%,transparent);background:color-mix(in srgb,var(--ok) 14%,transparent);color:var(--ok)}
.dd-cell.on{box-shadow:0 0 0 2px var(--accent),0 0 16px color-mix(in srgb,var(--accent) 36%,transparent);color:var(--ink);z-index:4}
.dd-cell-mark{position:absolute;top:-3px;right:-3px;width:9px;height:9px;border-radius:50%;background:var(--warn);border:1.5px solid var(--bg)}
.dd-cell-mark.beat{background:var(--danger)}
.dd-cell-mark.note{background:var(--accent)}

/* ── detail column ───────────────────────────────────────────────────── */
.dd-detail{
  width:clamp(360px,40%,520px);flex:0 0 auto;border-left:.5px solid var(--line);
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

.dd-beats{display:flex;flex-direction:column;gap:8px}
.dd-beats>*{flex:0 0 auto}
.dd-beat{border:.5px solid var(--line);border-radius:var(--r-md);background:var(--card);overflow:hidden;box-shadow:var(--elev-panel)}
.dd-beat-head{display:flex;align-items:center;gap:9px;padding:7px 11px;font-size:11px;color:var(--ink4);border-bottom:.5px solid var(--line)}
.dd-beat-head .n{font-family:var(--latin-serif)}
.dd-beat-head .sp{font-size:10px;color:var(--ok)}
.dd-beat.outside{opacity:.6}
.dd-beat-body{padding:9px 11px;display:flex;flex-direction:column;gap:7px}
.dd-beat-body textarea{
  width:100%;min-height:40px;background:var(--bg);border:.5px solid var(--line);border-radius:var(--r-sm);
  color:var(--ink);padding:7px 9px;font-size:12.5px;resize:vertical;line-height:1.65;outline:none;
  transition:border-color .18s var(--ease);
}
.dd-beat-body textarea:focus{border-color:var(--accent)}
.dd-beat-body .lab{font-size:10px;color:var(--ink4);letter-spacing:.07em;text-transform:uppercase}
.dd-beat-foot{display:flex;gap:7px;align-items:center}

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

.dd-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:10px}
.dd-thumb-wrap{position:relative}
.dd-thumb{
  border-radius:var(--r-md);overflow:hidden;border:.5px solid var(--line);background:var(--card);
  cursor:pointer;box-shadow:var(--elev-panel);
  transition:transform .35s var(--pop),box-shadow .25s var(--ease),border-color .25s var(--ease);
}
.dd-thumb:hover{transform:translateY(-3px) rotate(-.8deg);box-shadow:var(--elev-prominent);border-color:var(--accent);z-index:2}
.dd-thumb img{display:block;width:100%;height:74px;object-fit:cover;animation:dd-develop .9s var(--ease) both}
@keyframes dd-develop{from{opacity:0;filter:blur(10px);transform:scale(1.03)}}
.dd-thumb .cap{font-size:10px;padding:5px 7px;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-thumb.dep{border-color:color-mix(in srgb,var(--warn) 55%,transparent)}
.dd-thumb .dep-mark{
  position:absolute;top:6px;left:6px;background:var(--warn);color:#161006;
  font-size:9.5px;padding:1px 6px;border-radius:999px;font-weight:600;z-index:2;
}
.dd-thumb.missing{opacity:.4;cursor:not-allowed}
.dd-thumb .ph{height:74px;display:grid;place-items:center;font-size:10.5px;color:var(--ink4)}
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
.dd-rule-row .st{font-family:var(--latin-serif);font-size:11px;color:var(--ink4);text-align:right;white-space:nowrap}

/* ── drawer ──────────────────────────────────────────────────────────── */
.dd-drawer{
  position:absolute;top:0;right:0;bottom:0;width:min(430px,88%);z-index:20;
  background:color-mix(in srgb,var(--card) 97%,transparent);
  border-left:.5px solid var(--line-strong);box-shadow:-24px 0 60px rgba(0,0,0,.28);
  display:flex;flex-direction:column;animation:dd-dock-in .3s cubic-bezier(.2,1,.3,1) both;
}
@keyframes dd-dock-in{from{opacity:0;transform:translateX(20px)}}
.dd-drawer-head{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:.5px solid var(--line)}
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

/* ── popover ─────────────────────────────────────────────────────────── */
.dd-pop{
  position:fixed;z-index:30;min-width:250px;max-width:360px;
  background:var(--card);
  border:.5px solid var(--line-strong);border-radius:var(--r-md);
  box-shadow:var(--elev-prominent);padding:12px;animation:dd-pop .2s var(--pop) both;
}
@keyframes dd-pop{from{opacity:0;transform:scale(.94) translateY(10px)}}
.dd-pop h5{margin:0 0 6px;font-size:13px;color:var(--ink);font-weight:500}
.dd-pop .req{font-size:12px;color:var(--ink2);line-height:1.65;margin-bottom:9px}
.dd-pop ul{margin:0;padding-left:17px;font-size:11.5px;color:var(--danger);line-height:1.65}

/* ── viewer ──────────────────────────────────────────────────────────── */
.dd-viewer{
  position:fixed;inset:0;z-index:2147483000;background:rgba(5,7,10,.94);
  display:flex;flex-direction:column;animation:dd-fade .2s var(--ease) both;
}
@keyframes dd-fade{from{opacity:0}}
.dd-viewer-bar{
  display:flex;align-items:center;gap:12px;padding:11px 15px;background:var(--card);
  border-bottom:.5px solid var(--line);color:var(--ink);flex:none;
}
.dd-viewer-stage{flex:1 1 auto;overflow:hidden;position:relative;cursor:grab;display:flex;align-items:center;justify-content:center}
.dd-viewer-stage.drag{cursor:grabbing}
.dd-viewer-stage img{max-width:none;transform-origin:0 0;position:absolute;left:0;top:0;user-select:none}
.dd-viewer-hint{position:absolute;right:16px;bottom:14px;font-size:11.5px;color:var(--ink2);background:rgba(0,0,0,.45);padding:5px 11px;border-radius:var(--r-sm)}

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

/* ── narrow panel: 容器查询（宿主宽度不由本插件决定）─────────────────── */
@container dd-root (max-width: 900px){
  .dd-detail{width:clamp(320px,46%,440px)}
  .dd-scene{grid-template-columns:132px 1fr;gap:14px}
}
@container dd-root (max-width: 700px){
  .dd-tally{display:none}
  .dd-scene{grid-template-columns:1fr;gap:8px}
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
        note: 'M4 4h16v11H9l-5 4z',
        film: 'M3 4h18v16H3zM7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4',
        play: 'M8 5.5v13l11-6.5z',
      }
      const d = paths[props.name] ?? paths.grid
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24',
        fill: props.name === 'play' ? 'currentColor' : 'none',
        stroke: props.name === 'play' ? 'none' : 'currentColor',
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
          h('span', { style: { color: 'var(--dd-faint)', fontSize: '10px', transform: 'rotate(' + (open ? 90 : 0) + 'deg)', transition: 'transform 180ms cubic-bezier(.2,0,0,1)' } },
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
        h('span', { className: 'v', style: { color: props.failed ? 'var(--dd-tally-fail)' : 'var(--dd-text)' } }, props.value),
        h('span', { className: 'th' }, props.threshold),
      )
    }

    // ── stage rail (interactive) ───────────────────────────────────────────
    function StageRail(props) {
      const { stages, current, onPick, busy } = props
      if (!stages || stages.length === 0) return null
      return h('div', { className: 'dd-rail' },
        stages.map((stage, index) => [
          index > 0 ? h('span', { className: 'dd-rail-sep', key: 'sep' + stage.stage }) : null,
          h('button', {
            key: stage.stage,
            className: 'dd-stage ' + stage.state,
            disabled: busy,
            title: stage.requirement ? '推进到 ' + stage.stage + '：' + stage.requirement : stage.stage,
            onClick: event => onPick(stage, event.currentTarget),
          },
            h('span', { className: 'dd-stage-dot' }),
            h('span', null, stage.stage),
          ),
        ]),
      )
    }

    // ── pipeline view ──────────────────────────────────────────────────────
    function PipelineView(props) {
      const { pipeline, selectedShotId, onSelectShot, density, onDensity, filter, onFilter, query, onQuery, searchRef } = props
      if (!pipeline) return h('div', { className: 'dd-empty' }, t('empty.pipeline', '正在读取流水线…'))
      const counts = pipeline.counts || { none: 0, generated: 0, warn: 0, fail: 0, pass: 0 }
      const cellSize = density === 'compact' ? 22 : 32
      const needle = query.trim().toLowerCase()
      const scenes = pipeline.scenes
        .map(scene => {
          let shots = scene.shots.filter(cell => needle === ''
            || (cell.id + ' ' + (cell.title || '')).toLowerCase().includes(needle))
          if (filter === 'failed') shots = shots.filter(c => c.status === 'fail' || c.status === 'warn')
          if (filter === 'generated') shots = shots.filter(c => c.status !== 'none')
          return { ...scene, shots }
        })
        .filter(scene => scene.shots.length > 0)
      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-toolbar' },
          h('div', { className: 'dd-seg' },
            h('button', { className: filter === 'all' ? 'on' : '', onClick: () => onFilter('all') }, t('filter.all', '全部')),
            h('button', { className: filter === 'failed' ? 'on' : '', onClick: () => onFilter('failed') }, t('filter.failed', '失败项')),
            h('button', { className: filter === 'generated' ? 'on' : '', onClick: () => onFilter('generated') }, t('filter.generated', '已生成')),
          ),
          h('input', {
            className: 'dd-input', ref: searchRef, placeholder: '搜索镜头…  (/)',
            value: query, onChange: event => onQuery(event.target.value),
          }),
          h('span', { className: 'dd-spacer' }),
          h('div', { className: 'dd-seg' },
            h('button', { className: density === 'comfortable' ? 'on' : '', onClick: () => onDensity('comfortable') }, t('density.comfortable', '舒适')),
            h('button', { className: density === 'compact' ? 'on' : '', onClick: () => onDensity('compact') }, t('density.compact', '紧凑')),
          ),
        ),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            scenes.length === 0
              ? h('div', { className: 'dd-empty' }, t('empty.noShot', '没有符合条件的镜头'))
              : scenes.map((scene, index) => h('div', {
                className: 'dd-scene',
                key: scene.id,
                style: { animationDelay: Math.min(index * 26, 260) + 'ms' },
              },
                h('div', { className: 'dd-scene-head' },
                  h('div', { className: 'dd-scene-id' }, scene.id),
                  h('div', { className: 'dd-scene-title', title: scene.title }, scene.title || '（无标题）'),
                  h('div', { className: 'dd-scene-meta' },
                    h('span', { className: 'num' }, scene.shots.length + ' 镜'),
                    scene.duration ? h('span', { className: 'num' }, scene.duration + 's') : null,
                    scene.qc
                      ? h('span', { className: 'dd-badge ' + (scene.qc.verdict === 'FAIL' ? 'fail' : 'pass') },
                        scene.qc.verdict === 'FAIL' ? '表演层 FAIL' : '表演层 ' + scene.qc.verdict)
                      : null,
                  ),
                ),
                h('div', { className: 'dd-cells' },
                  scene.shots.map(cell => h('button', {
                    key: cell.id,
                    className: 'dd-cell' + (cell.id === selectedShotId ? ' on' : ''),
                    'data-status': cell.status,
                    title: cell.id + ' · ' + (cell.title || '') + '\n' + (STATUS_TEXT[cell.status] || cell.status) + '\n' + cell.reason,
                    style: { width: cellSize + 'px', height: cellSize + 'px' },
                    onClick: () => onSelectShot(cell.id),
                  },
                    density === 'comfortable' ? h('span', { className: 'num' }, String(cell.index ?? '')) : null,
                    cell.markers && cell.markers.length > 0
                      ? h('span', { className: 'dd-cell-mark ' + (cell.markers[0].kind === 'beat' ? 'beat' : cell.markers[0].kind === 'notes' ? 'note' : '') })
                      : null,
                  )),
                ),
              )),
          ),
        ),
      )
    }

    // ── shot detail ────────────────────────────────────────────────────────
    function ShotDetail(props) {
      const { detail, loading, onClose, onEditBeat, onEditShot, onAnnotate, onCompile, onCheck, onOpenImage, onOpenVideo, busy } = props
      if (loading) return h('div', { className: 'dd-detail' }, h('div', { className: 'dd-empty' }, '正在读取镜头…'))
      if (!detail) return h('div', { className: 'dd-detail' }, h('div', { className: 'dd-empty' }, t('empty.shot', '在网格里点一镜')))
      const shot = detail.shot
      const scene = detail.scene
      const beats = scene && Array.isArray(scene.beats) ? scene.beats : []
      const covered = new Set((shot.covers || []).map(i => i))
      const images = (detail.assets || []).filter(a => a.type === 'reference_image' || a.type === 'keyframe')
      const videos = (detail.assets || []).filter(a => a.type === 'video')
      return h('div', { className: 'dd-detail' },
        h('div', { className: 'dd-detail-head' },
          h('span', { className: 'id' }, shot.id),
          h('span', { className: 'ttl' }, shot.title || ''),
          h('span', { className: 'dd-spacer' }),
          h('button', { className: 'dd-icon-btn', onClick: onClose, title: t('action.close', '关闭') }, h(Icon, { name: 'close', size: 13 })),
        ),
        h('div', { className: 'dd-detail-body' },
          // ── 镜头（真源，可编辑）
          h(Section, { title: t('section.camera', '镜头'), tag: t('tag.source', '真源'), tagKind: 'src', defaultOpen: true },
            h(CameraEditor, { shot, busy, onSave: patch => onEditShot(shot.id, patch) }),
          ),
          // ── 表演（真源，可编辑）
          h(Section, { title: t('section.beats', '表演'), tag: t('tag.source', '真源'), tagKind: 'src', defaultOpen: true },
            beats.length === 0
              ? h('div', { className: 'dd-note' }, '该场次没有 beats')
              : h('div', { className: 'dd-beats' },
                beats.map((beat, index) => h(BeatEditor, {
                  key: index,
                  beat,
                  index: index + 1,
                  covered: covered.has(index + 1),
                  disabled: busy,
                  onSave: patch => onEditBeat(scene.id, index + 1, patch),
                })),
              ),
          ),
          // ── 批注（真源）
          h(Section, { title: t('section.note', '批注'), tag: t('tag.source', '真源'), tagKind: 'src', defaultOpen: false },
            h(NoteEditor, { shot, busy, onSave: note => onAnnotate(shot.id, note) }),
          ),
          // ── 提示词（产物，只读）
          h(Section, {
            title: t('section.prompt', '提示词'),
            tag: t('tag.artifact', '产物'),
            tagKind: 'out',
            defaultOpen: false,
          },
            h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap' } },
              h('button', { className: 'dd-btn', disabled: busy, onClick: () => onCompile(shot.id, true) }, t('action.recompile', '重新编译')),
              h('button', { className: 'dd-btn', disabled: busy, onClick: () => onCheck(shot.id) }, t('action.checkStale', '校验过期')),
            ),
            detail.prompt
              ? h('div', { className: 'dd-prompt' },
                (detail.prompt.sections || []).map(section => h('div', { className: 'dd-prompt-sec', key: section.name },
                  h('h5', null, section.name + ':'),
                  section.text,
                )))
              : h('div', { className: 'dd-note' }, '还没有提示词产物（运行「重新编译」生成）'),
          ),
          // ── 判定
          h(Section, { title: t('section.verdict', '判定'), tag: '体检器', defaultOpen: true },
            detail.qc.layers.map(layer => h('div', { key: layer.checker + ':' + layer.scope },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '5px' } },
                h('span', { style: { fontSize: '11.5px', fontWeight: '600' } }, layer.title),
                h('span', { className: 'num', style: { fontSize: '10px', color: 'var(--dd-faint)' } }, layer.scope || ''),
                h('span', { className: 'dd-spacer' }),
                layer.available
                  ? h('span', {
                    className: 'dd-badge ' + (layer.verdict === 'FAIL' ? 'fail' : layer.verdict === 'WARN' ? '' : 'pass'),
                    style: layer.verdict === 'WARN' ? { color: 'var(--dd-tally-warn)', borderColor: 'color-mix(in srgb,var(--dd-tally-warn) 45%,transparent)' } : undefined,
                  }, layer.verdict || '')
                  : h('span', { className: 'dd-note' }, '不可用'),
              ),
              layer.available
                ? h('div', null,
                  layer.metrics.map(metric => h(MetricRow, {
                    key: metric.name,
                    name: metric.name,
                    value: formatNumber(metric.value, typeof metric.value === 'number' && !Number.isInteger(metric.value) ? 3 : 0),
                    threshold: metric.threshold,
                  })),
                  (layer.issues || []).map((issue, i) => h('div', {
                    className: 'dd-issue' + (layer.verdict === 'WARN' ? ' warn' : ''), key: i,
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
          // ── 参照
          h(Section, { title: t('section.reference', '参照'), tag: '只读', defaultOpen: true },
            videos.length > 0
              ? videos.map(video => h('div', { key: video.id, style: { marginBottom: '9px' } },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' } },
                  h(Icon, { name: 'film', size: 13 }),
                  h('span', { className: 'num', style: { fontSize: '11px' } }, video.id),
                ),
                h('video', {
                  className: 'dd-video',
                  src: onOpenVideo ? onOpenVideo(video) : undefined,
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
                  workspaceId: detail.workspace ? detail.workspace.id : undefined,
                  onOpen: () => onOpenImage(asset),
                })),
              ),
          ),
          // ── 规则
          h(Section, { title: t('section.rules', '规则'), tag: '只读', defaultOpen: false },
            h('div', { className: 'dd-note' }, '此刻生效的规则（与结论同屏）'),
            (detail.rules || []).map(rule => h(RuleCard, { key: rule.id, rule })),
          ),
        ),
      )
    }

    /** The shot's camera fields — 真源, edited in place. */
    function CameraEditor(props) {
      const { shot, busy, onSave } = props
      const [fields, setFields] = useState({
        duration: shot.duration ?? '',
        camera: shot.camera ?? '',
        lighting: shot.lighting ?? '',
        ratio: shot.ratio ?? '',
        resolution: shot.resolution ?? '',
      })
      const [dirty, setDirty] = useState(false)
      useEffect(() => {
        setFields({
          duration: shot.duration ?? '',
          camera: shot.camera ?? '',
          lighting: shot.lighting ?? '',
          ratio: shot.ratio ?? '',
          resolution: shot.resolution ?? '',
        })
        setDirty(false)
      }, [shot.duration, shot.camera, shot.lighting, shot.ratio, shot.resolution])
      const set = (key, value) => { setFields(current => ({ ...current, [key]: value })); setDirty(true) }
      const save = () => {
        const patch = {}
        if (String(fields.duration) !== String(shot.duration ?? '')) patch.duration = Number(fields.duration)
        if (fields.camera !== (shot.camera ?? '')) patch.camera = fields.camera
        if (fields.lighting !== (shot.lighting ?? '')) patch.lighting = fields.lighting
        if (fields.ratio !== (shot.ratio ?? '')) patch.ratio = fields.ratio
        if (fields.resolution !== (shot.resolution ?? '')) patch.resolution = fields.resolution
        if (Object.keys(patch).length > 0) onSave(patch)
        setDirty(false)
      }
      return h('div', { className: 'dd-grid2' },
        h(Field, { label: '时长 (s)' },
          h('input', {
            className: 'num', type: 'number', min: '1', max: '15', value: fields.duration,
            disabled: busy, onChange: event => set('duration', event.target.value),
          })),
        h(Field, { label: '运镜' },
          h('input', {
            className: 'num', value: fields.camera, disabled: busy,
            placeholder: 'Push In / Static Shot', onChange: event => set('camera', event.target.value),
          })),
        h(Field, { label: '光参数' },
          h('input', {
            className: 'num', value: fields.lighting, disabled: busy,
            placeholder: 'day_interior', onChange: event => set('lighting', event.target.value),
          })),
        h(Field, { label: '比例 / 分辨率' },
          h('div', { style: { display: 'flex', gap: '6px' } },
            h('input', { className: 'num', value: fields.ratio, disabled: busy, onChange: event => set('ratio', event.target.value) }),
            h('input', { className: 'num', value: fields.resolution, disabled: busy, onChange: event => set('resolution', event.target.value) }),
          )),
        h('div', { style: { gridColumn: '1 / -1', display: 'flex', gap: '7px', alignItems: 'center' } },
          dirty
            ? h('button', { className: 'dd-btn primary', disabled: busy, onClick: save }, t('action.save', '保存'))
            : null,
          h('span', { className: 'dd-note' }, '派生字段（description_en / dialogue）只读，由编译生成'),
        ),
      )
    }

    function BeatEditor(props) {
      const { beat, index, covered, disabled, onSave } = props
      const [action, setAction] = useState(beat.action || '')
      const [text, setText] = useState(beat.text || '')
      const [delivery, setDelivery] = useState(beat.delivery || '')
      const dirty = action !== (beat.action || '')
        || text !== (beat.text || '')
        || delivery !== (beat.delivery || '')
      useEffect(() => {
        setAction(beat.action || '')
        setText(beat.text || '')
        setDelivery(beat.delivery || '')
      }, [beat.action, beat.text, beat.delivery])
      const save = () => {
        const patch = {}
        if (action !== (beat.action || '')) patch.action = action
        if (text !== (beat.text || '')) patch.text = text
        if (delivery !== (beat.delivery || '')) patch.delivery = delivery
        if (Object.keys(patch).length > 0) onSave(patch)
      }
      return h('div', { className: 'dd-beat' + (covered ? '' : ' outside') },
        h('div', { className: 'dd-beat-head' },
          h('span', { className: 'n' }, '#' + index),
          beat.speaker ? h('span', { style: { color: 'var(--dd-accent)' } }, beat.speaker) : null,
          beat.mode ? h('span', null, beat.mode) : null,
          h('span', { className: 'dd-spacer' }),
          covered ? h('span', { className: 'sp' }, '本镜覆盖') : h('span', null, '本镜未覆盖'),
        ),
        h('div', { className: 'dd-beat-body' },
          h('div', { className: 'lab' }, '动作行'),
          h('textarea', { value: action, disabled: disabled, onChange: event => setAction(event.target.value) }),
          beat.speaker
            ? h('div', null,
              h('div', { className: 'lab' }, '台词'),
              h('textarea', { value: text, disabled: disabled, onChange: event => setText(event.target.value) }),
              h('div', { className: 'lab', style: { marginTop: '2px' } }, '语气 delivery'),
              h('textarea', { value: delivery, disabled: disabled, onChange: event => setDelivery(event.target.value) }),
            )
            : null,
          dirty
            ? h('div', { className: 'dd-beat-foot' },
              h('button', { className: 'dd-btn primary', disabled: disabled, onClick: save }, t('action.save', '保存')),
              h('button', {
                className: 'dd-btn', disabled: disabled,
                onClick: () => {
                  setAction(beat.action || '')
                  setText(beat.text || '')
                  setDelivery(beat.delivery || '')
                },
              }, '撤销'),
            )
            : null,
        ),
      )
    }

    function NoteEditor(props) {
      const { shot, busy, onSave } = props
      const [note, setNote] = useState(shot.notes || '')
      const dirty = note !== (shot.notes || '')
      useEffect(() => { setNote(shot.notes || '') }, [shot.notes])
      return h('div', null,
        h('textarea', {
          value: note, disabled: busy, placeholder: '这一镜你想记住什么？',
          style: {
            width: '100%', minHeight: '72px', background: 'var(--dd-panel)', border: '1px solid var(--dd-line-2)',
            borderRadius: '9px', color: 'var(--dd-text)', padding: '8px 10px', fontSize: '12px', resize: 'vertical',
            outline: 'none', lineHeight: '1.65',
          },
          onChange: event => setNote(event.target.value),
        }),
        dirty
          ? h('div', { style: { display: 'flex', gap: '7px', marginTop: '7px' } },
            h('button', { className: 'dd-btn primary', disabled: busy, onClick: () => onSave(note) }, t('action.save', '保存')),
            h('button', { className: 'dd-btn', disabled: busy, onClick: () => setNote(shot.notes || '') }, '撤销'),
          )
          : null,
      )
    }

    function AssetThumb(props) {
      const { asset, workspaceId, onOpen } = props
      const isImage = asset.type === 'reference_image' || asset.type === 'keyframe'
      const [failed, setFailed] = useState(false)
      return h('div', { className: 'dd-thumb-wrap' },
        h('div', {
          className: 'dd-thumb' + (asset.status === 'deprecated' ? ' dep' : '') + (asset.missing ? ' missing' : ''),
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
            h('div', {
              style: {
                marginTop: '7px',
                color: rule.applicable ? 'var(--dd-accent)' : 'var(--dd-faint)',
              },
            }, rule.applicable ? '对本镜生效' : (rule.reason || '不适用')),
          )
          : null,
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
      const stages = ['conceive', 'outline', 'characters', 'script', 'storyboard', 'generate', 'verify', 'assemble', 'deliver']
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
              stages.map(s => h('option', { value: s, key: s }, s)))
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
            ? h('div', { style: { paddingLeft: '14px', borderLeft: '1px solid var(--dd-line)' } }, h(DocView, { sections: section.children }))
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
            rows.push(lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()))
            i++
          }
          const head = rows.find(r => !r.every(c => /^:?-{2,}:?$/.test(c)))
          const body = rows.filter(r => r !== head && !r.every(c => /^:?-{2,}:?$/.test(c)))
          if (head) {
            blocks.push(h('table', { className: 'dd-table', key: 't' + blocks.length, style: { margin: '8px 0' } },
              h('thead', null, h('tr', null, head.map((c, ci) => h('th', { key: ci }, c)))),
              h('tbody', null, body.map((row, ri) => h('tr', { key: ri }, row.map((c, ci) => h('td', { key: ci }, c))))),
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
          blocks.push(h('ul', { key: 'u' + blocks.length }, items.map((item, ii) => h('li', { key: ii }, item))))
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
              fontFamily: 'var(--dd-mono)', fontSize: '11px', background: 'var(--dd-panel-2)',
              padding: '9px 11px', borderRadius: '9px', overflow: 'auto', border: '1px solid var(--dd-line)',
            },
          }, code.join('\n')))
          continue
        }
        if (line.trim() === '') { i++; continue }
        const paragraph = []
        while (i < lines.length && lines[i].trim() !== '' && !/^\s*(\||[-*]\s|```)/.test(lines[i])) {
          paragraph.push(lines[i])
          i++
        }
        blocks.push(h('p', { key: 'p' + blocks.length, style: { margin: '5px 0' } }, paragraph.join(' ')))
      }
      return h('div', null, blocks)
    }

    // ── assets / ledger ────────────────────────────────────────────────────
    function AssetsView(props) {
      const { assets, onOpenImage } = props
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
                h('span', { style: { color: asset.status === 'deprecated' ? 'var(--dd-tally-warn)' : 'var(--dd-tally-pass)' } },
                  asset.status || 'active'),
                asset.missing ? h('span', { style: { color: 'var(--dd-tally-fail)', marginLeft: '5px' } }, '缺失') : null,
              ),
              h('td', { className: 'n' }, (asset.referencedBy || []).length),
              h('td', { className: 'n' }, asset.width ? asset.width + '×' + asset.height : '—'),
              h('td', { className: 'n' }, formatBytes(asset.bytes)),
              h('td', { className: 'path', title: asset.path }, asset.path || '—'),
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
                  color: entry.status === 'succeeded' ? 'var(--dd-tally-pass)'
                    : entry.status === 'failed' ? 'var(--dd-tally-fail)' : 'var(--dd-tally-warn)',
                },
              }, entry.status || '—')),
              h('td', null, entry.model || '—'),
              h('td', { className: 'n' }, entry.duration ? entry.duration + 's' : '—'),
              h('td', { className: 'n' }, typeof entry.costUsd === 'number' ? '$' + entry.costUsd.toFixed(2) : '—'),
              h('td', { className: 'n' }, formatTime(entry.submittedAt)),
              h('td', { className: 'n', style: { color: 'var(--dd-faint)' } }, entry.taskId || '—'),
            ))),
          ),
        ),
      )
    }

    // ── settings drawer ────────────────────────────────────────────────────
    function SettingsDrawer(props) {
      const { settings, onClose, onSave, busy } = props
      const [draft, setDraft] = useState({
        projectRoot: settings.projectRoot || '',
        outputRoot: settings.outputRoot || '',
        model: settings.specModel || '',
      })
      useEffect(() => {
        setDraft({
          projectRoot: settings.projectRoot || '',
          outputRoot: settings.outputRoot || '',
          model: settings.specModel || '',
        })
      }, [settings.projectRoot, settings.outputRoot, settings.specModel])
      if (!settings) return null
      return h('div', { className: 'dd-drawer' },
        h('div', { className: 'dd-drawer-head' },
          h('span', { style: { fontWeight: '600' } }, t('action.settings', '设置')),
          h('span', { className: 'dd-spacer' }),
          h('button', { className: 'dd-icon-btn', onClick: onClose }, h(Icon, { name: 'close', size: 13 })),
        ),
        h('div', { className: 'dd-drawer-body' },
          (settings.warnings || []).map((warning, index) => h('div', { key: index, className: 'dd-warnbox', style: { marginBottom: '8px' } }, warning)),
          h('div', null,
            h('h4', null, t('settings.paths', '路径')),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '9px' } },
              h(Field, { label: '项目根' },
                h('input', {
                  className: 'num', value: draft.projectRoot, disabled: busy,
                  onChange: event => setDraft(current => ({ ...current, projectRoot: event.target.value })),
                })),
              h('div', { className: 'dd-note' }, '为什么是这里：' + (settings.projectRootReason || '—')),
              h(Field, { label: '产物位置' },
                h('input', {
                  className: 'num', value: draft.outputRoot, disabled: busy,
                  onChange: event => setDraft(current => ({ ...current, outputRoot: event.target.value })),
                })),
              h('div', { className: 'dd-note' }, '为什么是这里：' + (settings.outputRootReason || '—')),
              h('div', { className: 'dd-note' },
                '留空 = 自动：跟随 Windows 的「视频」已知文件夹（搬过盘也跟得住）。'),
            ),
          ),
          h('div', null,
            h('h4', null, t('settings.model', '模型')),
            h('div', { style: { marginTop: '9px', display: 'flex', flexDirection: 'column', gap: '9px' } },
              h(Field, { label: '规范模型适配' },
                h('select', {
                  value: draft.model, disabled: busy,
                  onChange: event => setDraft(current => ({ ...current, model: event.target.value })),
                },
                  (settings.specModels || []).map(model => h('option', { value: model.id, key: model.id }, model.id + (model.title && model.title !== model.id ? ' · ' + model.title : ''))),
                )),
              settings.hostModel
                ? h('div', { className: 'dd-kv' },
                  h('span', { className: 'k' }, '宿主模型'),
                  h('span', { className: 'v' }, settings.hostModel.provider + ' / ' + settings.hostModel.model),
                )
                : null,
              h('div', { className: 'dd-note' }, '规范模型适配 = 规则分层里的那一份（提示词写法 / 体检项 / 接口 quirks）。宿主模型由 DSH 统一管理。'),
            ),
          ),
          settings.editable
            ? h('div', { style: { display: 'flex', gap: '8px' } },
              h('button', {
                className: 'dd-btn primary', disabled: busy,
                onClick: () => onSave(draft),
              }, t('action.apply', '应用')),
              h('button', { className: 'dd-btn', disabled: busy, onClick: onClose }, t('action.cancel', '取消')),
            )
            : h('div', { className: 'dd-warnbox' },
              '这个 profile 没有配置编辑器：请手动改 profile 的 cordis.patch.yml 里 drama-desk 那一行。'
              + (settings.patchPath ? '（' + settings.patchPath + '）' : '')),
        ),
      )
    }

    // ── image viewer (PRD §7.3) ────────────────────────────────────────────
    function ImageViewer(props) {
      const containerRef = useRef(null)
      const [scale, setScale] = useState(1)
      const [offset, setOffset] = useState({ x: 0, y: 0 })
      const [natural, setNatural] = useState({ width: 0, height: 0 })
      const [fit, setFit] = useState(true)
      const dragRef = useRef(null)

      const applyFit = useCallback(() => {
        const box = containerRef.current
        if (!box || natural.width === 0) return
        const next = Math.min((box.clientWidth - 40) / natural.width, (box.clientHeight - 40) / natural.height)
        setScale(next)
        setOffset({ x: (box.clientWidth - natural.width * next) / 2, y: (box.clientHeight - natural.height * next) / 2 })
      }, [natural])

      const onLoad = useCallback(event => {
        const img = event.currentTarget
        const size = { width: img.naturalWidth, height: img.naturalHeight }
        setNatural(size)
        const box = containerRef.current
        if (!box) return
        const next = Math.min((box.clientWidth - 40) / size.width, (box.clientHeight - 40) / size.height)
        setScale(next)
        setOffset({ x: (box.clientWidth - size.width * next) / 2, y: (box.clientHeight - size.height * next) / 2 })
      }, [])

      const zoomAt = useCallback((factor, clientX, clientY) => {
        setScale(previous => {
          const next = Math.min(8, Math.max(0.05, previous * factor))
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

      return h('div', { className: 'dd-viewer', role: 'dialog', 'aria-modal': 'true' },
        h('div', { className: 'dd-viewer-bar' },
          h('span', { className: 'num' }, props.title || ''),
          h('span', { className: 'num', style: { color: 'var(--dd-dim)', fontSize: '11px' } },
            natural.width ? natural.width + '×' + natural.height : ''),
          h('span', { className: 'num', style: { color: 'var(--dd-dim)', fontSize: '11px' } }, Math.round(scale * 100) + '%'),
          h('span', { className: 'dd-spacer' }),
          h('button', { className: 'dd-btn', onClick: () => { applyFit(); setFit(true) } }, t('action.fit', '适应窗口')),
          h('button', { className: 'dd-btn', onClick: () => { setScale(1); setOffset({ x: 0, y: 0 }); setFit(false) } }, t('action.actualSize', '1:1')),
          h('button', { className: 'dd-btn', onClick: props.onClose }, t('action.close', '关闭 (Esc)')),
        ),
        h('div', {
          className: 'dd-viewer-stage',
          ref: containerRef,
          onWheel: onWheel,
          onPointerDown: onPointerDown,
          onPointerMove: onPointerMove,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
          onDoubleClick: () => {
            if (fit) { setScale(1); setOffset({ x: 0, y: 0 }) } else { applyFit() }
            setFit(!fit)
          },
        },
          h('img', { src: props.src, alt: props.title || '', onLoad: onLoad }),
          h('div', { className: 'dd-viewer-hint' }, '拖动平移 · 滚轮以光标为锚点缩放 · 双击切 1:1'),
        ),
      )
    }

    // ── sidebar glyph ──────────────────────────────────────────────────────
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

    // ── root ───────────────────────────────────────────────────────────────
    function DramaDesk() {
      const [overview, setOverview] = useState(null)
      const [pipeline, setPipeline] = useState(null)
      const [detail, setDetail] = useState(null)
      const [detailLoading, setDetailLoading] = useState(false)
      const [spec, setSpec] = useState(null)
      const [assets, setAssets] = useState(null)
      const [ledger, setLedger] = useState(null)
      const [stages, setStages] = useState(null)
      const [settings, setSettings] = useState(null)
      const [view, setView] = useState('pipeline')
      const [specTab, setSpecTab] = useState('rules')
      const [specStage, setSpecStage] = useState('')
      const [selectedShot, setSelectedShot] = useState(null)
      const [workspaceId, setWorkspaceId] = useState('')
      const [density, setDensity] = useState('comfortable')
      const [filter, setFilter] = useState('all')
      const [query, setQuery] = useState('')
      const [busy, setBusy] = useState(false)
      const [toast, setToast] = useState(null)
      const [viewer, setViewer] = useState(null)
      const [drawer, setDrawer] = useState(false)
      const [stagePop, setStagePop] = useState(null)
      const searchRef = useRef(null)
      const toastTimer = useRef(null)
      /** The last pipeline revision we rendered; unchanged means "don't re-render". */
      const pipelineRevision = useRef(null)
      /** The last revision seen per polled view; unchanged means "don't re-render". */
      const revisions = useRef({})
      /** Whether the panel is actually on screen. The host may keep it mounted but hidden. */
      const visibleRef = useRef(true)
      const rootRef = useRef(null)

      const say = useCallback((message, kind) => {
        setToast(message === undefined ? null : { message, kind })
        if (toastTimer.current) clearTimeout(toastTimer.current)
        if (message !== undefined) {
          toastTimer.current = setTimeout(() => setToast(null), kind === 'err' ? 6000 : 3200)
        }
      }, [])

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
          // ——45 个格子销毁再创建、入场动画重播——插件就在给宿主应用收税。
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
      //
      // 「不可见」用 IntersectionObserver 判：宿主可能把面板留在 DOM 里
      // 只是不显示（那样组件不卸载，轮询也不会停）——所以不能只靠卸载。
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

      const withBusy = useCallback(async (task, onOk) => {
        setBusy(true)
        try {
          const result = await task()
          if (onOk) onOk(result)
          await reload()
          return result
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
          return undefined
        } finally {
          setBusy(false)
        }
      }, [reload, say])

      const saveBeat = useCallback(async (sceneId, beatIndex, patch) => {
        await withBusy(
          () => apiPost('edit-beat', { workspaceId, sceneId, beatIndex, patch }),
          () => say('已保存 beat #' + beatIndex, 'ok'),
        )
        if (selectedShot) {
          try {
            setDetail(await apiGet('shot', { workspace: workspaceId, shot: selectedShot }))
          } catch { /* 保留旧详情 */ }
        }
      }, [withBusy, workspaceId, selectedShot, say])

      const saveShot = useCallback(async (shotId, patch) => {
        await withBusy(
          () => apiPost('edit-shot', { workspaceId, shotId, patch }),
          () => say('已保存镜头字段', 'ok'),
        )
        if (selectedShot) {
          try {
            setDetail(await apiGet('shot', { workspace: workspaceId, shot: selectedShot }))
          } catch { /* 保留旧详情 */ }
        }
      }, [withBusy, workspaceId, selectedShot, say])

      const saveNote = useCallback(async (shotId, note) => {
        await withBusy(
          () => apiPost('annotate-shot', { workspaceId, shotId, note }),
          () => say('已保存批注', 'ok'),
        )
        if (selectedShot) {
          try {
            setDetail(await apiGet('shot', { workspace: workspaceId, shot: selectedShot }))
          } catch { /* 保留旧详情 */ }
        }
      }, [withBusy, workspaceId, selectedShot, say])

      const compileShot = useCallback(async (shotId, checkOnly) => {
        await withBusy(
          () => apiPost('compile', { workspaceId, shotId, check: checkOnly === true }),
          value => {
            if (value && value.ok === false) { say('编译失败：' + value.error, 'err'); return }
            const stale = value && value.stale ? value.stale : []
            const changed = value && value.changed ? value.changed : []
            if (checkOnly) {
              say(stale.length > 0 ? '产物已过期：' + stale.join('、') : '产物与真源一致', stale.length > 0 ? 'err' : 'ok')
            } else {
              say('已编译 ' + (value ? value.prompts : 0) + ' 条产物；变更 ' + changed.length + ' 镜', 'ok')
            }
          },
        )
      }, [withBusy, workspaceId, say])

      const checkShot = useCallback(async shotId => {
        await withBusy(
          () => apiGet('check', { workspace: workspaceId, shot: shotId }),
          value => say(value && value.stale ? '产物已过期（真源改了但没重编译）' : '产物与真源一致', value && value.stale ? 'err' : 'ok'),
        )
      }, [withBusy, workspaceId, say])

      const moveStage = useCallback(async stage => {
        setStagePop(null)
        await withBusy(
          () => apiPost('set-stage', { workspaceId, stage }),
          value => say(value ? '已推进到 ' + value.to : '已切换阶段', 'ok'),
        )
      }, [withBusy, workspaceId, say])

      const saveSettings = useCallback(async draft => {
        await withBusy(
          () => apiPost('update-settings', {
            projectRoot: draft.projectRoot,
            outputRoot: draft.outputRoot,
            model: draft.model,
          }),
          () => { say('设置已保存，插件已重启', 'ok'); setDrawer(false) },
        )
      }, [withBusy, say])

      // 键盘：1–9 切镜、J/K 上下、/ 搜索、F 聚焦失败项
      useEffect(() => {
        const onKey = event => {
          const target = event.target
          const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
          if (typing) return
          if (event.key === '/') { event.preventDefault(); searchRef.current && searchRef.current.focus(); return }
          if (event.key === 'f' || event.key === 'F') { setFilter('failed'); return }
          if (event.key === 'Escape') { setViewer(null); setDrawer(false); setStagePop(null); return }
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
            return
          }
          if (/^[1-9]$/.test(event.key)) {
            event.preventDefault()
            const next = cells[Number(event.key) - 1]
            if (next) openShot(next.id)
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [pipeline, selectedShot, openShot])

      const counts = pipeline ? (pipeline.counts || { fail: 0, warn: 0, generated: 0, pass: 0, none: 0 }) : { fail: 0, warn: 0, generated: 0, pass: 0, none: 0 }
      const nav = [
        { id: 'pipeline', glyph: 'grid', label: t('nav.pipeline', '流水线'), badge: counts.fail },
        { id: 'spec', glyph: 'spec', label: t('nav.spec', '规范') },
        { id: 'assets', glyph: 'asset', label: t('nav.assets', '资产') },
        { id: 'ledger', glyph: 'ledger', label: t('nav.ledger', '台账') },
      ]

      return h('div', { className: 'dd', ref: rootRef },
        h('style', null, CSS),
        h('div', { className: 'dd-ambient', 'aria-hidden': 'true' }),
        // ── top bar ───────────────────────────────────────────────────────
        h('div', { className: 'dd-top' },
          h('div', { className: 'dd-mark' },
            h('div', { className: 'dd-mark-glyph' }, h(Icon, { name: 'grid', size: 15 })),
            h('div', null,
              h('div', { className: 'dd-mark-title' }, t('brand.title', '导演工作台')),
              h('div', { className: 'dd-mark-sub' }, t('brand.subtitle', 'AI 短剧生产线')),
            ),
          ),
          h('div', { className: 'dd-work' },
            h(Icon, { name: 'project', size: 13 }),
            overview && overview.workspaces && overview.workspaces.length > 0
              ? h('select', {
                value: workspaceId,
                onChange: event => {
                  setWorkspaceId(event.target.value)
                  setSelectedShot(null); setDetail(null); setAssets(null); setLedger(null)
                },
              }, overview.workspaces.map(work => h('option', { value: work.id, key: work.id }, work.title || work.id)))
              : h('span', { className: 'num', style: { fontSize: '11px' } }, '没有作品'),
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
                onClick: () => setDrawer(true),
              },
                h(Icon, { name: 'asset', size: 12 }),
                h('span', { className: 'num', style: { maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis' } }, overview.outputRoot),
              )
              : null,
            overview
              ? h('span', { className: 'dd-chip', title: '模型适配：' + overview.model },
                h('span', { style: { color: 'var(--dd-accent)' } }, '⬢'), overview.model)
              : null,
            overview && overview.disk
              ? h('span', { className: 'dd-chip', title: '磁盘占用' },
                h('b', { className: 'num' }, Math.round(overview.disk.ratio * 100) + '%'),
                h('span', { className: 'num', style: { color: 'var(--dd-faint)' } }, '剩 ' + formatBytes(overview.disk.free)),
              )
              : null,
            h('button', { className: 'dd-icon-btn', onClick: reload, title: t('action.refresh', '刷新') }, h(Icon, { name: 'refresh', size: 14 })),
            h('button', { className: 'dd-icon-btn', onClick: () => setDrawer(true), title: t('action.settings', '设置') }, h(Icon, { name: 'settings', size: 14 })),
          ),
        ),
        // ── stage rail ────────────────────────────────────────────────────
        h(StageRail, {
          stages: stages ? stages.stages : [],
          current: stages ? stages.current : undefined,
          busy,
          onPick: (stage, anchor) => setStagePop({ stage, anchor }),
        }),
        // ── body ──────────────────────────────────────────────────────────
        h('div', { className: 'dd-body' },
          h('div', { className: 'dd-nav' },
            nav.map(item => h('button', {
              key: item.id,
              className: 'dd-nav-btn' + (view === item.id ? ' on' : ''),
              onClick: () => setView(item.id),
              title: item.label,
            },
              h(Icon, { name: item.glyph, size: 17 }),
              h('span', { className: 'lbl' }, item.label),
              item.badge > 0 ? h('span', { className: 'badge' }, String(item.badge)) : null,
            )),
            h('span', { className: 'dd-spacer' }),
            h('button', {
              className: 'dd-nav-btn' + (drawer ? ' on' : ''),
              onClick: () => setDrawer(true),
              title: t('action.settings', '设置'),
            },
              h(Icon, { name: 'settings', size: 17 }),
              h('span', { className: 'lbl' }, '设置'),
            ),
          ),
          h('div', { style: { flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
            view === 'pipeline'
              ? h(PipelineView, {
                pipeline,
                selectedShotId: selectedShot,
                onSelectShot: openShot,
                density,
                onDensity: setDensity,
                filter,
                onFilter: setFilter,
                query,
                onQuery: setQuery,
                searchRef,
              })
              : null,
            view === 'spec' ? h(SpecView, { spec, tab: specTab, onTab: setSpecTab, stage: specStage, onStage: setSpecStage }) : null,
            view === 'assets' ? h(AssetsView, { assets, onOpenImage: asset => setViewer(asset) }) : null,
            view === 'ledger' ? h(LedgerView, { ledger }) : null,
          ),
          view === 'pipeline'
            ? h(ShotDetail, {
              detail,
              loading: detailLoading,
              busy,
              onClose: () => { setSelectedShot(null); setDetail(null) },
              onEditBeat: saveBeat,
              onEditShot: saveShot,
              onAnnotate: saveNote,
              onCompile: compileShot,
              onCheck: checkShot,
              onOpenImage: asset => setViewer(asset),
              onOpenVideo: asset => assetVideoUrl(workspaceId, asset.id),
            })
            : null,
        ),
        // ── stage popover ─────────────────────────────────────────────────
        stagePop
          ? h(StagePopover, {
            stage: stagePop.stage,
            onClose: () => setStagePop(null),
            onConfirm: () => moveStage(stagePop.stage.stage),
            busy,
          })
          : null,
        // ── settings drawer ───────────────────────────────────────────────
        drawer
          ? h(SettingsDrawer, {
            settings,
            busy,
            onClose: () => setDrawer(false),
            onSave: saveSettings,
          })
          : null,
        // ── toast ─────────────────────────────────────────────────────────
        toast
          ? h('div', { className: 'dd-toast ' + (toast.kind || '') }, toast.message)
          : null,
        // ── viewer ────────────────────────────────────────────────────────
        viewer
          ? h(ImageViewer, {
            src: assetImageUrl(workspaceId, viewer.id),
            title: viewer.id,
            onClose: () => setViewer(null),
          })
          : null,
      )
    }

    /** The popover for one stage: what it needs, and the button that moves it. */
    function StagePopover(props) {
      const { stage, onClose, onConfirm, busy } = props
      const ref = useRef(null)
      useEffect(() => {
        const onDown = event => { if (ref.current && !ref.current.contains(event.target)) onClose() }
        const onKey = event => { if (event.key === 'Escape') onClose() }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('mousedown', onDown)
          document.removeEventListener('keydown', onKey)
        }
      }, [onClose])
      const blocked = stage.state === 'blocked'
      const canMove = stage.state !== 'current' && !blocked
      return h('div', {
        ref,
        className: 'dd-pop',
        style: { position: 'fixed', left: '50%', top: '104px', transform: 'translateX(-50%)' },
      },
        h('h5', null, stage.stage),
        h('div', { className: 'req' }, stage.requirement || '（契约没有为这一段写前置条件）'),
        blocked && stage.gaps.length > 0
          ? h('div', null,
            h('div', { className: 'dd-note', style: { marginBottom: '4px' } }, '还差：'),
            h('ul', null, stage.gaps.map((gap, index) => h('li', { key: index }, gap))),
          )
          : null,
        h('div', { style: { display: 'flex', gap: '7px', marginTop: '9px' } },
          h('button', {
            className: 'dd-btn primary', disabled: busy || !canMove,
            onClick: onConfirm,
          }, stage.rollback ? '回退到 ' + stage.stage : '推进到 ' + stage.stage),
          h('button', { className: 'dd-btn', onClick: onClose }, t('action.cancel', '取消')),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
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
