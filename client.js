/*!
 * dsh-drama-desk — client half (browser bundle).
 *
 * The workbench for an AI short-drama production line: a pipeline grid whose
 * cell colour is the checker's own verdict, a shot detail that puts 真源,
 * 产物, 判定 and 规则 side by side, and the contract / assets / ledger views
 * that make the invisible rules visible.
 *
 * Bundle format: the official DSH client-bundle shape — a lazy-CJS closure
 * registered with window.__ModuleLoader__.load({ id, factory }). `react` is
 * resolved from the shell's module table at runtime; everything else is
 * inlined, so the plugin carries no build step and no runtime dependency.
 */
window.__ModuleLoader__.load({
  id: 'dsh-drama-desk',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useMemo, useRef } = React

    // ── design tokens ──────────────────────────────────────────────────────
    // Host tokens carry the theme; the plugin only adds the semantic QC
    // colours and the geometry the PRD fixes. Semantic colours are used for
    // 体检状态 only — they are never mixed with the brand accent.
    const CSS = `
.dd-root{
  --dd-canvas:var(--dsw-alias-bg-base,#0d0f13);
  --dd-surface:var(--dsw-alias-bg-layer-1,#14171d);
  --dd-raised:var(--dsw-alias-bg-layer-2,#1b1f27);
  --dd-overlay:var(--dsw-alias-bg-overlay,#22262f);
  --dd-line:var(--dsw-alias-border-l1,#262b34);
  --dd-line-strong:var(--dsw-alias-border-l2,#39404c);
  --dd-accent:var(--dsw-alias-brand-primary,#3d9be9);
  --dd-text:var(--dsw-alias-label-primary,#e6e8ec);
  --dd-text-dim:var(--dsw-alias-label-secondary,#9aa2b1);
  --dd-none-fg:var(--dsw-alias-label-secondary,#7c8494);--dd-none-bg:rgba(124,132,148,.14);
  --dd-gen-fg:var(--dsw-alias-state-idle-primary,#4c8dff);--dd-gen-bg:rgba(76,141,255,.16);
  --dd-warn-fg:var(--dsw-alias-state-warn-primary,#d8a13f);--dd-warn-bg:rgba(216,161,63,.18);
  --dd-fail-fg:var(--dsw-alias-state-error-primary,#e5484d);--dd-fail-bg:rgba(229,72,77,.20);
  --dd-pass-fg:var(--dsw-alias-state-success-primary,#30a46c);--dd-pass-bg:rgba(48,164,108,.16);
  --dd-mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
  font-family:system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  color:var(--dd-text);
  background:var(--dd-canvas);
  border:1px solid var(--dd-line);
  border-radius:10px;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  font-size:13px;
  line-height:1.5;
  width:100%;
  height:100%;
  min-height:0;
  box-sizing:border-box;
}
.dd-root *{box-sizing:border-box}
.dd-num{font-family:var(--dd-mono);font-variant-numeric:tabular-nums}
.dd-root button{font:inherit;color:inherit;background:none;border:none;cursor:pointer;padding:0}
.dd-root button:disabled{opacity:.45;cursor:not-allowed}

/* header bar */
.dd-bar{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--dd-surface);border-bottom:1px solid var(--dd-line);flex:none;flex-wrap:wrap}
.dd-bar-title{display:flex;align-items:center;gap:8px;font-weight:600;letter-spacing:.02em}
.dd-bar-title span.glyph{color:var(--dd-accent);font-size:14px}
.dd-bar-sep{width:1px;height:16px;background:var(--dd-line-strong)}
.dd-chip{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;border:1px solid var(--dd-line-strong);background:var(--dd-raised);font-size:11.5px;color:var(--dd-text-dim);white-space:nowrap}
.dd-chip b{color:var(--dd-text);font-weight:600}
.dd-dot{width:7px;height:7px;border-radius:50%;flex:none}
.dd-select{background:var(--dd-raised);border:1px solid var(--dd-line-strong);border-radius:8px;color:var(--dd-text);padding:3px 8px;font-size:12px;max-width:220px}
.dd-btn{padding:3px 10px;border-radius:8px;border:1px solid var(--dd-line-strong);background:var(--dd-raised);font-size:12px;white-space:nowrap;transition:border-color 140ms cubic-bezier(.2,0,0,1),color 140ms cubic-bezier(.2,0,0,1)}
.dd-btn:hover:not(:disabled){border-color:var(--dd-accent);color:var(--dd-accent)}
.dd-btn.dd-btn-accent{background:var(--dd-accent);border-color:var(--dd-accent);color:var(--dd-canvas);font-weight:600}
.dd-btn.dd-btn-danger{border-color:var(--dd-fail-fg);color:var(--dd-fail-fg)}

/* stage bar */
.dd-stages{display:flex;align-items:center;gap:2px;flex-wrap:wrap;padding:6px 12px;background:var(--dd-canvas);border-bottom:1px solid var(--dd-line);flex:none}
.dd-stage{padding:1px 7px;border-radius:6px;font-size:11px;color:var(--dd-text-dim);border:1px solid transparent}
.dd-stage.done{color:var(--dd-text-dim);border-color:var(--dd-line)}
.dd-stage.current{color:var(--dd-accent);border-color:var(--dd-accent);background:rgba(61,155,233,.10);font-weight:600}
.dd-stage-arrow{color:var(--dd-line-strong);font-size:10px}

/* body */
.dd-body{display:flex;min-height:0;flex:1 1 auto;overflow:hidden}
.dd-nav{width:126px;min-width:126px;flex:0 0 126px;border-right:1px solid var(--dd-line);background:var(--dd-surface);padding:6px;display:flex;flex-direction:column;gap:2px;overflow:hidden}
.dd-nav-item{display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:8px;font-size:12.5px;color:var(--dd-text-dim);text-align:left;width:100%;white-space:nowrap;transition:background 140ms cubic-bezier(.2,0,0,1),color 140ms cubic-bezier(.2,0,0,1)}
.dd-nav-item:hover{background:var(--dd-raised);color:var(--dd-text)}
.dd-nav-item.active{background:var(--dd-raised);color:var(--dd-accent);box-shadow:inset 2px 0 0 var(--dd-accent)}
.dd-nav-item .glyph{width:14px;text-align:center;opacity:.85}
.dd-nav-item .badge{margin-left:auto;font-size:10px;color:var(--dd-fail-fg);font-family:var(--dd-mono)}
.dd-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;overflow:hidden}

/* pipeline */
.dd-toolbar{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--dd-line);flex:none;flex-wrap:wrap}
.dd-seg{display:inline-flex;border:1px solid var(--dd-line-strong);border-radius:8px;overflow:hidden;flex:none}
.dd-seg button{padding:2px 9px;font-size:11.5px;color:var(--dd-text-dim);border-right:1px solid var(--dd-line-strong);white-space:nowrap}
.dd-seg button:last-child{border-right:none}
/* 选中态：描边 + 加重，而不是「强调色实心填充」——
   强调色在某些主题里接近黑（浅色主题），实心填充会让标签消失。 */
.dd-seg button.on{background:var(--dd-raised);color:var(--dd-accent);border-color:var(--dd-accent);font-weight:600;box-shadow:inset 0 0 0 1px var(--dd-accent)}
.dd-search{background:var(--dd-raised);border:1px solid var(--dd-line-strong);border-radius:8px;color:var(--dd-text);padding:3px 8px;font-size:12px;width:150px}
.dd-grid-wrap{flex:1 1 auto;overflow:auto;padding:8px 10px 14px}
.dd-scene{display:grid;grid-template-columns:150px 1fr;gap:8px;align-items:start;padding:5px 0;border-bottom:1px dashed var(--dd-line)}
.dd-scene:last-child{border-bottom:none}
.dd-scene-label{padding-top:2px;min-width:0}
.dd-scene-id{font-family:var(--dd-mono);font-size:11px;color:var(--dd-text-dim)}
.dd-scene-title{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-scene-meta{font-size:10.5px;color:var(--dd-text-dim);display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.dd-scene-qc{font-size:10.5px;padding:0 5px;border-radius:5px;border:1px solid var(--dd-line-strong)}
.dd-scene-qc.fail{color:var(--dd-fail-fg);border-color:var(--dd-fail-fg);background:var(--dd-fail-bg)}
.dd-scene-qc.pass{color:var(--dd-pass-fg);border-color:var(--dd-pass-fg);background:var(--dd-pass-bg)}
.dd-cells{display:flex;flex-wrap:wrap;gap:4px;align-items:flex-start}
.dd-cell{position:relative;border-radius:6px;border:1px solid var(--dd-none-fg);background:var(--dd-none-bg);transition:transform 120ms cubic-bezier(.2,0,0,1),box-shadow 120ms cubic-bezier(.2,0,0,1);display:flex;align-items:center;justify-content:center;font-family:var(--dd-mono);font-size:9.5px;color:var(--dd-text-dim)}
.dd-cell[data-status="generated"]{border-color:var(--dd-gen-fg);background:var(--dd-gen-bg)}
.dd-cell[data-status="warn"]{border-color:var(--dd-warn-fg);background:var(--dd-warn-bg)}
.dd-cell[data-status="fail"]{border-color:var(--dd-fail-fg);background:var(--dd-fail-bg);color:var(--dd-fail-fg)}
.dd-cell[data-status="pass"]{border-color:var(--dd-pass-fg);background:var(--dd-pass-bg)}
.dd-cell:hover{transform:translateY(-1px)}
.dd-cell.selected{box-shadow:0 0 0 2px var(--dd-accent);color:var(--dd-text)}
.dd-cell.dim{opacity:.25}
.dd-cell-mark{position:absolute;top:-3px;right:-3px;width:7px;height:7px;border-radius:50%;background:var(--dd-warn-fg);border:1px solid var(--dd-canvas)}
.dd-cell-mark.beat{background:var(--dd-fail-fg)}
.dd-cell-mark.notes{background:var(--dd-accent)}

/* shot detail */
.dd-detail{width:clamp(340px,42%,540px);flex:none;border-left:1px solid var(--dd-line);background:var(--dd-surface);display:flex;flex-direction:column;min-height:0}
.dd-detail-head{padding:8px 12px;border-bottom:1px solid var(--dd-line);display:flex;align-items:center;gap:8px;flex:none}
.dd-detail-body{overflow:auto;padding:10px 12px 20px;display:flex;flex-direction:column;gap:12px}
.dd-sec{border:1px solid var(--dd-line);border-radius:10px;background:var(--dd-canvas);overflow:hidden}
.dd-sec-head{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--dd-surface);cursor:pointer;user-select:none}
.dd-sec-head .tag{font-size:10px;padding:0 6px;border-radius:5px;border:1px solid var(--dd-line-strong);color:var(--dd-text-dim)}
.dd-sec-head .tag.src{border-color:var(--dd-accent);color:var(--dd-accent)}
.dd-sec-head .tag.derived{border-color:var(--dd-warn-fg);color:var(--dd-warn-fg)}
.dd-sec-head .tag.out{border-color:var(--dd-pass-fg);color:var(--dd-pass-fg)}
.dd-sec-head .spacer{flex:1}
.dd-sec-body{padding:8px 10px;display:flex;flex-direction:column;gap:8px}
.dd-field{display:grid;grid-template-columns:96px 1fr;gap:8px;align-items:baseline;font-size:12px}
.dd-field dt{color:var(--dd-text-dim);font-size:11.5px}
.dd-field dd{margin:0;word-break:break-word}
.dd-beats{display:flex;flex-direction:column;gap:6px}
.dd-beat{border:1px solid var(--dd-line);border-radius:8px;padding:6px 8px;background:var(--dd-surface)}
.dd-beat-head{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dd-text-dim);margin-bottom:4px}
.dd-beat textarea{width:100%;min-height:44px;background:var(--dd-canvas);border:1px solid var(--dd-line-strong);border-radius:7px;color:var(--dd-text);padding:5px 7px;font:inherit;font-size:12px;resize:vertical}
.dd-beat textarea:focus{outline:none;border-color:var(--dd-accent)}
.dd-beat .speaker{color:var(--dd-accent)}
.dd-metric{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:baseline;font-size:11.5px;padding:2px 0}
.dd-metric .name{color:var(--dd-text-dim)}
.dd-metric .val{font-family:var(--dd-mono);font-variant-numeric:tabular-nums}
.dd-metric .thr{font-family:var(--dd-mono);font-size:10.5px;color:var(--dd-text-dim)}
.dd-issue{font-size:11.5px;color:var(--dd-fail-fg);display:flex;gap:6px}
.dd-issue.warn{color:var(--dd-warn-fg)}
.dd-prompt{font-family:var(--dd-mono);font-size:11px;white-space:pre-wrap;word-break:break-word;background:var(--dd-canvas);border:1px solid var(--dd-line);border-radius:8px;padding:8px;max-height:280px;overflow:auto;color:var(--dd-text-dim)}
.dd-prompt-sec{border-top:1px dashed var(--dd-line);padding-top:6px;margin-top:6px}
.dd-prompt-sec:first-child{border-top:none;padding-top:0;margin-top:0}
.dd-prompt-sec h5{margin:0 0 3px;font-size:10.5px;color:var(--dd-accent);font-family:var(--dd-mono);font-weight:600}
.dd-rule{border:1px solid var(--dd-line);border-radius:8px;overflow:hidden}
.dd-rule-head{display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--dd-surface);cursor:pointer;user-select:none;font-size:12px}
.dd-rule-head .rid{font-family:var(--dd-mono);font-size:10.5px;color:var(--dd-accent);min-width:34px}
.dd-rule-head .rstage{margin-left:auto;font-size:10px;color:var(--dd-text-dim)}
.dd-rule-body{padding:6px 9px;font-size:11.5px;color:var(--dd-text-dim);white-space:pre-wrap;background:var(--dd-canvas)}
.dd-rule.applicable{border-color:var(--dd-accent)}
.dd-rule.applicable .rid{color:var(--dd-accent);font-weight:700}

/* tables */
.dd-table{width:100%;border-collapse:collapse;font-size:11.5px}
.dd-table th{text-align:left;font-weight:500;color:var(--dd-text-dim);padding:4px 7px;border-bottom:1px solid var(--dd-line-strong);position:sticky;top:0;background:var(--dd-surface);z-index:1}
.dd-table td{padding:4px 7px;border-bottom:1px solid var(--dd-line);vertical-align:top}
.dd-table tr:hover td{background:var(--dd-raised)}
.dd-table td.num{font-family:var(--dd-mono);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.dd-scroll{overflow:auto;flex:1 1 auto;min-height:0}

/* thumbs */
.dd-thumbs{display:flex;flex-wrap:wrap;gap:8px}
.dd-thumb{width:104px;cursor:pointer;border-radius:8px;overflow:hidden;border:1px solid var(--dd-line-strong);background:var(--dd-raised);position:relative}
.dd-thumb img{display:block;width:100%;height:76px;object-fit:cover}
.dd-thumb .cap{font-size:10px;padding:3px 5px;color:var(--dd-text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-thumb.dep{border-color:var(--dd-warn-fg)}
.dd-thumb .dep-mark{position:absolute;top:4px;left:4px;background:var(--dd-warn-fg);color:#1a1206;font-size:9px;padding:0 4px;border-radius:4px;font-weight:600}
.dd-thumb.missing{opacity:.45}

/* image viewer */
.dd-viewer{position:fixed;inset:0;background:rgba(6,8,11,.92);z-index:2147483000;display:flex;flex-direction:column}
.dd-viewer-bar{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--dd-surface);border-bottom:1px solid var(--dd-line);color:var(--dd-text)}
.dd-viewer-stage{flex:1 1 auto;overflow:hidden;position:relative;cursor:grab;display:flex;align-items:center;justify-content:center}
.dd-viewer-stage.dragging{cursor:grabbing}
.dd-viewer-stage img{max-width:none;transform-origin:0 0;position:absolute;left:0;top:0;user-select:none;-webkit-user-drag:none}
.dd-viewer-hint{position:absolute;right:10px;bottom:8px;font-size:11px;color:var(--dd-text-dim);background:rgba(0,0,0,.4);padding:3px 8px;border-radius:6px}

/* misc */
.dd-empty{padding:22px;text-align:center;color:var(--dd-text-dim);font-size:12px}
.dd-note{font-size:11px;color:var(--dd-text-dim);padding:4px 0}
.dd-error{background:var(--dd-fail-bg);border:1px solid var(--dd-fail-fg);color:var(--dd-fail-fg);border-radius:8px;padding:6px 9px;font-size:11.5px;white-space:pre-wrap}
.dd-warnbox{background:var(--dd-warn-bg);border:1px solid var(--dd-warn-fg);color:var(--dd-warn-fg);border-radius:8px;padding:6px 9px;font-size:11.5px}
.dd-doc{font-size:12px;line-height:1.65;color:var(--dd-text-dim);white-space:pre-wrap}
.dd-doc h4{margin:12px 0 4px;color:var(--dd-text);font-size:12.5px}
.dd-doc h5{margin:8px 0 3px;color:var(--dd-text);font-size:12px}
.dd-doc ul{margin:4px 0;padding-left:18px}
.dd-doc li{margin:1px 0}
.dd-doc code{font-family:var(--dd-mono);font-size:11px;background:var(--dd-raised);padding:0 3px;border-radius:4px}
.dd-tabs{display:flex;gap:4px;padding:6px 10px;border-bottom:1px solid var(--dd-line);flex:none}
.dd-tab{padding:3px 10px;border-radius:8px;font-size:12px;color:var(--dd-text-dim);border:1px solid transparent}
.dd-tab.on{color:var(--dd-accent);border-color:var(--dd-accent);background:var(--dd-raised);font-weight:600}
.dd-kv{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px}
.dd-kv .k{color:var(--dd-text-dim)}
`

    // ── locale ────────────────────────────────────────────────────────────
    // Visible UI text goes through the Client locale service. The dictionary
    // lives here (the Client half cannot import the package's JSON), and the
    // package's `locale/*.json` carries only the Plugin Manager metadata.
    const LOCALE_NS = 'drama-desk'
    /** The panel id: the sidebar entry's id and the `main` slot's key. */
    const PANEL_ID = 'drama-desk'
    const DICT = {
      zh: {
        'nav.title': '短剧工作台',
        'nav.project': '项目',
        'nav.pipeline': '流水线',
        'nav.spec': '规范',
        'nav.assets': '资产',
        'nav.ledger': '台账',
        'tab.rules': '铁律',
        'tab.constitution': '创作宪法',
        'tab.contract': '数据契约',
        'tab.checklist': '验收清单',
        'action.refresh': '刷新',
        'action.close': '关闭',
        'action.recompile': '重新编译',
        'action.checkStale': '校验是否过期',
        'action.save': '保存',
        'action.fit': '适应窗口',
        'action.actualSize': '1:1',
        'filter.all': '全部',
        'filter.failed': '失败项',
        'filter.generated': '已生成',
        'density.comfortable': '舒适',
        'density.compact': '紧凑',
        'status.none': '未生成',
        'status.generated': '已生成未体检',
        'status.warn': 'WARN',
        'status.fail': 'FAIL',
        'status.pass': '通过',
        'tag.source': '真源',
        'tag.artifact': '产物',
        'section.camera': '镜头',
        'section.beats': '表演 · beats',
        'section.prompt': '提示词',
        'section.reference': '参照',
        'section.verdict': '判定',
        'section.rules': '规则',
        'empty.pipeline': '正在读取流水线…',
        'empty.shot': '在左侧网格里点一个镜头',
        'empty.noShot': '没有符合条件的镜头',
      },
      en: {
        'nav.title': 'Drama desk',
        'nav.project': 'Project',
        'nav.pipeline': 'Pipeline',
        'nav.spec': 'Spec',
        'nav.assets': 'Assets',
        'nav.ledger': 'Ledger',
        'tab.rules': 'Rules',
        'tab.constitution': 'Constitution',
        'tab.contract': 'Contract',
        'tab.checklist': 'Checklist',
        'action.refresh': 'Refresh',
        'action.close': 'Close',
        'action.recompile': 'Recompile',
        'action.checkStale': 'Check stale',
        'action.save': 'Save',
        'action.fit': 'Fit',
        'action.actualSize': '1:1',
        'filter.all': 'All',
        'filter.failed': 'Failures',
        'filter.generated': 'Generated',
        'density.comfortable': 'Comfortable',
        'density.compact': 'Compact',
        'status.none': 'Not generated',
        'status.generated': 'Generated, not checked',
        'status.warn': 'WARN',
        'status.fail': 'FAIL',
        'status.pass': 'Pass',
        'tag.source': 'Source',
        'tag.artifact': 'Artifact',
        'section.camera': 'Camera',
        'section.beats': 'Performance · beats',
        'section.prompt': 'Prompt',
        'section.reference': 'References',
        'section.verdict': 'Verdict',
        'section.rules': 'Rules',
        'empty.pipeline': 'Loading the pipeline…',
        'empty.shot': 'Pick a shot in the grid',
        'empty.noShot': 'No shot matches the filter',
      },
    }

    /** Translate one key; falls back to the caller's own text. */
    let t = (key, fallback) => fallback

    // ── API layer ──────────────────────────────────────────────────────────
    // The browser talks to the Host over one prefix route. Every call is a
    // thin wrapper over one Host service method — the same method the agent
    // tool calls, so the two never disagree.
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

    // ── small helpers ──────────────────────────────────────────────────────
    const STATUS_ORDER = ['none', 'generated', 'warn', 'fail', 'pass']
    const STATUS_TEXT = {
      none: '未生成',
      generated: '已生成未体检',
      warn: 'WARN',
      fail: 'FAIL',
      pass: '通过',
    }
    const STATUS_VAR = {
      none: ['--dd-none-fg', '--dd-none-bg'],
      generated: ['--dd-gen-fg', '--dd-gen-bg'],
      warn: ['--dd-warn-fg', '--dd-warn-bg'],
      fail: ['--dd-fail-fg', '--dd-fail-bg'],
      pass: ['--dd-pass-fg', '--dd-pass-bg'],
    }

    function statusColor(status, kind) {
      const pair = STATUS_VAR[status] || STATUS_VAR.none
      return 'var(' + pair[kind === 'bg' ? 1 : 0] + ')'
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

    // ── image viewer (PRD §7.3) ────────────────────────────────────────────
    // 单击放大；按住左键拖动平移；滚轮以光标为锚点缩放；双击在「适应窗口」与
    // 「1:1 像素」之间切换；ESC 关闭；方向键平移；+/- 缩放。
    function ImageViewer(props) {
      const containerRef = useRef(null)
      const [scale, setScale] = useState(1)
      const [offset, setOffset] = useState({ x: 0, y: 0 })
      const [natural, setNatural] = useState({ width: 0, height: 0 })
      const [fit, setFit] = useState(true)
      const dragRef = useRef(null)

      const computeFit = useCallback((width, height) => {
        const box = containerRef.current
        if (!box || width === 0 || height === 0) return 1
        return Math.min((box.clientWidth - 32) / width, (box.clientHeight - 32) / height)
      }, [])

      const applyFit = useCallback(() => {
        const next = computeFit(natural.width, natural.height)
        setScale(next)
        setOffset({ x: 0, y: 0 })
      }, [computeFit, natural])

      const onLoad = useCallback(event => {
        const img = event.currentTarget
        const size = { width: img.naturalWidth, height: img.naturalHeight }
        setNatural(size)
        const box = containerRef.current
        if (box) {
          const next = Math.min((box.clientWidth - 32) / size.width, (box.clientHeight - 32) / size.height)
          setScale(next)
          setOffset({ x: (box.clientWidth - size.width * next) / 2, y: (box.clientHeight - size.height * next) / 2 })
        }
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
        event.currentTarget.classList.add('dragging')
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
        event.currentTarget.classList.remove('dragging')
      }, [])

      const onDoubleClick = useCallback(() => {
        if (fit) {
          setScale(1)
          setOffset({ x: 0, y: 0 })
        } else {
          applyFit()
        }
        setFit(!fit)
      }, [fit, applyFit])

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
          h('span', { className: 'dd-num' }, props.title || ''),
          h('span', { className: 'dd-num', style: { color: 'var(--dd-text-dim)', fontSize: '11px' } },
            natural.width ? natural.width + '×' + natural.height : ''),
          h('span', { className: 'dd-num', style: { color: 'var(--dd-text-dim)', fontSize: '11px' } },
            Math.round(scale * 100) + '%'),
          h('span', { style: { flex: '1' } }),
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
          onDoubleClick: onDoubleClick,
        },
          h('img', { src: props.src, alt: props.title || '', onLoad: onLoad }),
          h('div', { className: 'dd-viewer-hint' }, '拖动平移 · 滚轮以光标为锚点缩放 · 双击切换 1:1'),
        ),
      )
    }

    // ── reusable pieces ────────────────────────────────────────────────────
    function Section(props) {
      const [open, setOpen] = useState(props.defaultOpen === true)
      return h('div', { className: 'dd-sec' },
        h('div', { className: 'dd-sec-head', onClick: () => setOpen(!open) },
          h('span', { style: { fontWeight: '600', fontSize: '12px' } }, props.title),
          props.tag ? h('span', { className: 'dd-tag ' + (props.tagKind || '') }, props.tag) : null,
          h('span', { className: 'spacer' }),
          h('span', { style: { color: 'var(--dd-text-dim)', fontSize: '11px' } }, open ? '▾' : '▸'),
        ),
        open ? h('div', { className: 'dd-sec-body' }, props.children) : null,
      )
    }

    function Field(props) {
      return h('dl', { className: 'dd-field' },
        h('dt', null, props.label),
        h('dd', { className: props.mono ? 'dd-num' : undefined }, props.children),
      )
    }

    function MetricRow(props) {
      const failed = props.failed === true
      return h('div', { className: 'dd-metric' },
        h('span', { className: 'name' }, props.name),
        h('span', { className: 'val', style: { color: failed ? 'var(--dd-fail-fg)' : 'var(--dd-text)' } }, props.value),
        h('span', { className: 'thr' }, props.threshold),
      )
    }

    // ── pipeline view ──────────────────────────────────────────────────────
    function PipelineView(props) {
      const { pipeline, selectedShotId, onSelectShot, density, onDensity, filter, onFilter, query, onQuery, searchRef } = props
      if (!pipeline) return h('div', { className: 'dd-empty' }, t('empty.pipeline', '正在读取流水线…'))
      const counts = pipeline.counts || { none: 0, generated: 0, warn: 0, fail: 0, pass: 0 }
      const cellSize = density === 'compact' ? 20 : 30
      const needle = query.trim().toLowerCase()
      const scenes = pipeline.scenes
        .map(scene => {
          const shots = scene.shots.filter(cell => {
            if (needle === '') return true
            return (cell.id + ' ' + (cell.title || '')).toLowerCase().includes(needle)
          })
          if (filter === 'failed') {
            return { ...scene, shots: shots.filter(c => c.status === 'fail' || c.status === 'warn') }
          }
          if (filter === 'generated') {
            return { ...scene, shots: shots.filter(c => c.status !== 'none') }
          }
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
            className: 'dd-search',
            ref: searchRef,
            placeholder: '搜索镜头…  (/)',
            value: query,
            onChange: event => onQuery(event.target.value),
          }),
          h('span', { style: { flex: '1' } }),
          h('span', { className: 'dd-chip' },
            h('span', { className: 'dd-dot', style: { background: 'var(--dd-fail-fg)' } }),
            h('b', { className: 'dd-num' }, String(counts.fail || 0)), ' FAIL'),
          h('span', { className: 'dd-chip' },
            h('span', { className: 'dd-dot', style: { background: 'var(--dd-warn-fg)' } }),
            h('b', { className: 'dd-num' }, String(counts.warn || 0)), ' WARN'),
          h('span', { className: 'dd-chip' },
            h('span', { className: 'dd-dot', style: { background: 'var(--dd-gen-fg)' } }),
            h('b', { className: 'dd-num' }, String(counts.generated || 0)), ' 未体检'),
          h('span', { className: 'dd-chip' },
            h('span', { className: 'dd-dot', style: { background: 'var(--dd-pass-fg)' } }),
            h('b', { className: 'dd-num' }, String(counts.pass || 0)), ' 通过'),
          h('div', { className: 'dd-seg' },
            h('button', { className: density === 'comfortable' ? 'on' : '', onClick: () => onDensity('comfortable') }, t('density.comfortable', '舒适')),
            h('button', { className: density === 'compact' ? 'on' : '', onClick: () => onDensity('compact') }, t('density.compact', '紧凑')),
          ),
        ),
        h('div', { className: 'dd-grid-wrap' },
          scenes.length === 0
            ? h('div', { className: 'dd-empty' }, t('empty.noShot', '没有符合条件的镜头'))
            : scenes.map(scene => h('div', { className: 'dd-scene', key: scene.id },
              h('div', { className: 'dd-scene-label' },
                h('div', { className: 'dd-scene-id' }, scene.id),
                h('div', { className: 'dd-scene-title', title: scene.title }, scene.title || '（无标题）'),
                h('div', { className: 'dd-scene-meta' },
                  h('span', { className: 'dd-num' }, scene.shots.length + ' 镜'),
                  scene.duration ? h('span', { className: 'dd-num' }, scene.duration + 's') : null,
                  scene.qc
                    ? h('span', { className: 'dd-scene-qc ' + (scene.qc.verdict === 'FAIL' ? 'fail' : 'pass') },
                        scene.qc.verdict === 'FAIL' ? '表演层 FAIL' : '表演层 ' + scene.qc.verdict)
                    : null,
                ),
              ),
              h('div', { className: 'dd-cells' },
                scene.shots.map(cell => h('button', {
                  key: cell.id,
                  className: 'dd-cell' + (cell.id === selectedShotId ? ' selected' : ''),
                  'data-status': cell.status,
                  title: cell.id + ' · ' + (cell.title || '') + ' · ' + (STATUS_TEXT[cell.status] || cell.status) + '\n' + cell.reason,
                  style: { width: cellSize + 'px', height: cellSize + 'px' },
                  onClick: () => onSelectShot(cell.id),
                },
                  density === 'comfortable' ? h('span', { className: 'dd-num' }, String(cell.index ?? '')) : null,
                  cell.markers && cell.markers.length > 0
                    ? h('span', { className: 'dd-cell-mark ' + (cell.markers[0].kind === 'beat' ? 'beat' : cell.markers[0].kind === 'notes' ? 'notes' : '') })
                    : null,
                )),
              ),
            )),
        ),
      )
    }

    // ── shot detail ────────────────────────────────────────────────────────
    function ShotDetail(props) {
      const { detail, loading, onClose, onEditBeat, onCompile, onCheck, busy } = props
      if (loading) return h('div', { className: 'dd-detail' }, h('div', { className: 'dd-empty' }, '正在读取镜头…'))
      if (!detail) return h('div', { className: 'dd-detail' }, h('div', { className: 'dd-empty' }, t('empty.shot', '在左侧网格里点一个镜头')))
      const shot = detail.shot
      const scene = detail.scene
      const beats = scene && Array.isArray(scene.beats) ? scene.beats : []
      const covered = new Set((shot.covers || []).map(i => i))
      return h('div', { className: 'dd-detail' },
        h('div', { className: 'dd-detail-head' },
          h('span', { className: 'dd-num', style: { fontWeight: '600' } }, shot.id),
          h('span', { style: { flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, shot.title || ''),
          h('button', { className: 'dd-btn', onClick: onClose }, t('action.close', '关闭')),
        ),
        h('div', { className: 'dd-detail-body' },
          // 镜头（真源）
          h(Section, { title: t('section.camera', '镜头'), tag: t('tag.source', '真源'), tagKind: 'src', defaultOpen: true },
            h(Field, { label: '时长', mono: true }, (shot.duration ?? '—') + ' s'),
            h(Field, { label: '运镜' }, shot.camera || '—'),
            h(Field, { label: '光参数' }, shot.lighting || '—'),
            h(Field, { label: '比例 / 分辨率' }, [shot.ratio, shot.resolution].filter(Boolean).join(' · ') || '—'),
            h(Field, { label: '参考图', mono: true }, (shot.references || []).length + ' 张'),
            h(Field, { label: '状态' }, shot.status || '—'),
            shot.notes
              ? h('div', { className: 'dd-note', style: { marginTop: '4px' } }, '批注：' + shot.notes)
              : null,
          ),
          // 表演（真源）
          h(Section, {
            title: t('section.beats', '表演 · beats'),
            tag: t('tag.source', '真源'),
            tagKind: 'src',
            defaultOpen: true,
          },
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
          // 提示词（产物）
          h(Section, {
            title: t('section.prompt', '提示词'),
            tag: t('tag.artifact', '产物'),
            tagKind: 'out',
            defaultOpen: false,
          },
            h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
              h('button', { className: 'dd-btn', disabled: busy, onClick: () => onCompile(shot.id, true) }, t('action.recompile', '重新编译')),
              h('button', { className: 'dd-btn', disabled: busy, onClick: () => onCheck(shot.id) }, t('action.checkStale', '校验是否过期')),
            ),
            detail.prompt
              ? h('div', { className: 'dd-prompt' },
                (detail.prompt.sections || []).map(section => h('div', { className: 'dd-prompt-sec', key: section.name },
                  h('h5', null, section.name + ':'),
                  section.text,
                )))
              : h('div', { className: 'dd-note' }, '还没有提示词产物（运行「重新编译」生成）'),
          ),
          // 判定
          h(Section, { title: t('section.verdict', '判定'), tag: '体检器', defaultOpen: true },
            detail.qc.layers.map(layer => h('div', { key: layer.checker + ':' + layer.scope },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' } },
                h('span', { style: { fontSize: '11.5px', fontWeight: '600' } }, layer.title),
                h('span', { className: 'dd-num', style: { fontSize: '10.5px', color: 'var(--dd-text-dim)' } }, layer.scope || ''),
                h('span', { style: { flex: '1' } }),
                layer.available
                  ? h('span', {
                    className: 'dd-scene-qc ' + (layer.verdict === 'FAIL' ? 'fail' : layer.verdict === 'pass' || layer.verdict === 'PASS' ? 'pass' : ''),
                    style: { color: layer.verdict === 'FAIL' ? 'var(--dd-fail-fg)' : layer.verdict === 'WARN' ? 'var(--dd-warn-fg)' : 'var(--dd-pass-fg)' },
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
                  (layer.issues || []).map((issue, i) => h('div', { className: 'dd-issue' + (layer.verdict === 'WARN' ? ' warn' : ''), key: i },
                    '• ' + issue)),
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
          // 参照
          h(Section, { title: t('section.reference', '参照'), tag: '只读', defaultOpen: false },
            (detail.assets || []).length === 0
              ? h('div', { className: 'dd-note' }, '这一镜没有登记资产')
              : h('div', { className: 'dd-thumbs' },
                detail.assets.map(asset => h(AssetThumb, {
                  key: asset.id,
                  asset,
                  workspaceId: detail.workspace ? detail.workspace.id : undefined,
                  onOpen: props.onOpenImage,
                })),
              ),
          ),
          // 规则
          h(Section, { title: t('section.rules', '规则'), tag: '只读', defaultOpen: false },
            h('div', { className: 'dd-note' }, '此刻生效的规则（与结论同屏）'),
            (detail.rules || []).map(rule => h(RuleCard, { key: rule.id, rule })),
          ),
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
      return h('div', { className: 'dd-beat', style: covered ? undefined : { opacity: '.6' } },
        h('div', { className: 'dd-beat-head' },
          h('span', { className: 'dd-num' }, '#' + index),
          beat.speaker ? h('span', { className: 'speaker' }, beat.speaker) : null,
          beat.mode ? h('span', null, beat.mode) : null,
          covered ? h('span', { style: { color: 'var(--dd-accent)' } }, '本镜覆盖') : h('span', null, '本镜未覆盖'),
        ),
        h('textarea', {
          value: action,
          disabled: disabled,
          placeholder: '动作行',
          onChange: event => setAction(event.target.value),
        }),
        beat.speaker
          ? h('textarea', {
            value: text,
            disabled: disabled,
            placeholder: '台词',
            onChange: event => setText(event.target.value),
          })
          : null,
        beat.speaker
          ? h('textarea', {
            value: delivery,
            disabled: disabled,
            placeholder: '语气（delivery）',
            onChange: event => setDelivery(event.target.value),
          })
          : null,
        dirty
          ? h('div', { style: { display: 'flex', gap: '6px', marginTop: '5px' } },
            h('button', { className: 'dd-btn dd-btn-accent', disabled: disabled, onClick: save }, t('action.save', '保存')),
            h('button', {
              className: 'dd-btn',
              disabled: disabled,
              onClick: () => {
                setAction(beat.action || '')
                setText(beat.text || '')
                setDelivery(beat.delivery || '')
              },
            }, '撤销'),
          )
          : null,
      )
    }

    function AssetThumb(props) {
      const { asset, workspaceId, onOpen } = props
      const isImage = asset.type === 'reference_image' || asset.type === 'keyframe'
      const [failed, setFailed] = useState(false)
      return h('div', {
        className: 'dd-thumb' + (asset.status === 'deprecated' ? ' dep' : '') + (asset.missing ? ' missing' : ''),
        onClick: () => { if (isImage && !asset.missing) onOpen(asset) },
        title: asset.path || asset.id,
      },
        asset.status === 'deprecated' ? h('span', { className: 'dep-mark' }, '作废') : null,
        isImage && !asset.missing
          ? h('img', {
            src: assetImageUrl(workspaceId, asset.id),
            alt: asset.id,
            loading: 'lazy',
            onError: () => setFailed(true),
          })
          : h('div', { style: { height: '76px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--dd-text-dim)' } },
            asset.missing ? '文件缺失' : (failed ? '无法显示' : asset.type || 'asset')),
        h('div', { className: 'cap', title: asset.id }, asset.id),
      )
    }

    function RuleCard(props) {
      const { rule } = props
      const [open, setOpen] = useState(false)
      return h('div', { className: 'dd-rule' + (rule.applicable ? ' applicable' : '') },
        h('div', { className: 'dd-rule-head', onClick: () => setOpen(!open) },
          h('span', { className: 'rid' }, rule.id),
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, rule.title),
          h('span', { className: 'rstage' }, (rule.stages || []).join(' · ')),
          h('span', { style: { color: 'var(--dd-text-dim)', fontSize: '10px' } }, open ? '▾' : '▸'),
        ),
        open
          ? h('div', { className: 'dd-rule-body' },
            rule.evidence ? h('div', null, (rule.evidenceLabel ? rule.evidenceLabel + '：' : '') + rule.evidence) : null,
            rule.evidence ? h('div', { style: { marginTop: '6px' } }, rule.body) : h('div', null, rule.body),
            rule.applicable
              ? h('div', { style: { marginTop: '6px', color: 'var(--dd-accent)' } }, '对本镜生效')
              : h('div', { style: { marginTop: '6px', color: 'var(--dd-text-dim)' } }, rule.reason || '不适用'),
          )
          : null,
      )
    }

    // ── spec view ──────────────────────────────────────────────────────────
    function SpecView(props) {
      const { spec, tab, onTab } = props
      const [stage, setStage] = useState('')
      const [expanded, setExpanded] = useState({})
      if (!spec) return h('div', { className: 'dd-empty' }, '正在读取规范…')
      if (!spec.available) {
        return h('div', { className: 'dd-grid-wrap' },
          h('div', { className: 'dd-warnbox' }, spec.hint || '规范未构建'),
          h('div', { className: 'dd-note' }, '规范是唯一真源。缺了它，界面上的「依据」就没有出处。'),
        )
      }
      const stages = ['conceive', 'outline', 'characters', 'script', 'storyboard', 'generate', 'verify', 'assemble', 'deliver']
      const rules = spec.rules.filter(rule => stage === '' || rule.inStage)
      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-tabs' },
          h('button', { className: 'dd-tab' + (tab === 'rules' ? ' on' : ''), onClick: () => onTab('rules') }, t('tab.rules', '铁律')),
          h('button', { className: 'dd-tab' + (tab === 'constitution' ? ' on' : ''), onClick: () => onTab('constitution') }, t('tab.constitution', '创作宪法')),
          h('button', { className: 'dd-tab' + (tab === 'contract' ? ' on' : ''), onClick: () => onTab('contract') }, t('tab.contract', '数据契约')),
          h('button', { className: 'dd-tab' + (tab === 'checklist' ? ' on' : ''), onClick: () => onTab('checklist') }, t('tab.checklist', '验收清单')),
          h('span', { style: { flex: '1' } }),
          tab === 'rules'
            ? h('select', { className: 'dd-select', value: stage, onChange: e => setStage(e.target.value) },
              h('option', { value: '' }, '全部阶段'),
              stages.map(s => h('option', { value: s, key: s }, s)))
            : null,
        ),
        h('div', { className: 'dd-scroll', style: { padding: '10px 12px 20px' } },
          tab === 'rules'
            ? h('div', null,
              h('div', { className: 'dd-note' }, '来源：' + (spec.sources && spec.sources.rules ? spec.sources.rules : '') + '（规则真源，界面不复述）'),
              rules.map(rule => h(RuleCard, {
                key: rule.id,
                rule: {
                  id: rule.id,
                  title: rule.title,
                  stages: rule.stages,
                  evidence: rule.evidence,
                  evidenceLabel: rule.evidenceLabel,
                  body: rule.body,
                  applicable: undefined,
                  reason: '',
                },
              })),
            )
            : h(DocView, { sections: spec[tab] || [] }),
        ),
      )
    }

    /** Render a parsed markdown section tree (constitution / contract / checklist). */
    function DocView(props) {
      return h('div', { className: 'dd-doc' },
        (props.sections || []).map((section, index) => h('div', { key: index },
          h('h4', null, section.heading),
          section.body ? h(MarkdownLite, { text: section.body }) : null,
          section.children && section.children.length > 0
            ? h('div', { style: { paddingLeft: '12px' } }, h(DocView, { sections: section.children }))
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
            blocks.push(h('table', { className: 'dd-table', key: 't' + blocks.length },
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
          blocks.push(h('pre', { key: 'c' + blocks.length, style: { fontFamily: 'var(--dd-mono)', fontSize: '11px', background: 'var(--dd-raised)', padding: '6px 8px', borderRadius: '7px', overflow: 'auto' } }, code.join('\n')))
          continue
        }
        if (line.trim() === '') { i++; continue }
        const paragraph = []
        while (i < lines.length && lines[i].trim() !== '' && !/^\s*(\||[-*]\s|```)/.test(lines[i])) {
          paragraph.push(lines[i])
          i++
        }
        blocks.push(h('p', { key: 'p' + blocks.length, style: { margin: '3px 0' } }, paragraph.join(' ')))
      }
      return h('div', null, blocks)
    }

    // ── assets view ────────────────────────────────────────────────────────
    function AssetsView(props) {
      const { assets, onOpenImage } = props
      if (!assets) return h('div', { className: 'dd-empty' }, '正在读取资产…')
      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-toolbar' },
          h('span', { className: 'dd-chip' }, '共 ', h('b', { className: 'dd-num' }, String(assets.totals ? assets.totals.count : 0)), ' 个资产'),
          h('span', { className: 'dd-chip' }, '作废 ', h('b', { className: 'dd-num' }, String(assets.totals ? assets.totals.deprecated : 0))),
          h('span', { className: 'dd-chip' }, '缺失 ', h('b', { className: 'dd-num' }, String(assets.totals ? assets.totals.missing : 0))),
          h('span', { className: 'dd-chip' }, '占用 ', h('b', { className: 'dd-num' }, formatBytes(assets.totals ? assets.totals.bytes : 0))),
          h('span', { style: { flex: '1' } }),
          h('span', { className: 'dd-note' }, '资产只增不删：作废的标 deprecated 并保留路径指向归档'),
        ),
        h('div', { className: 'dd-scroll' },
          h('table', { className: 'dd-table' },
            h('thead', null, h('tr', null,
              h('th', null, '资产'), h('th', null, '类型'), h('th', null, '状态'),
              h('th', null, '引用'), h('th', { className: 'num' }, '尺寸'), h('th', { className: 'num' }, '体积'), h('th', null, '路径'),
            )),
            h('tbody', null, assets.assets.map(asset => h('tr', { key: asset.id },
              h('td', null, asset.id),
              h('td', null, asset.type || '—'),
              h('td', null,
                h('span', {
                  style: {
                    color: asset.status === 'deprecated' ? 'var(--dd-warn-fg)' : 'var(--dd-pass-fg)',
                    fontSize: '11px',
                  },
                }, asset.status || 'active'),
                asset.missing ? h('span', { style: { color: 'var(--dd-fail-fg)', fontSize: '11px', marginLeft: '4px' } }, '缺失') : null,
              ),
              h('td', { className: 'num' }, (asset.referencedBy || []).length),
              h('td', { className: 'num' }, asset.width ? asset.width + '×' + asset.height : '—'),
              h('td', { className: 'num' }, formatBytes(asset.bytes)),
              h('td', { style: { color: 'var(--dd-text-dim)', fontSize: '10.5px', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, asset.path || '—'),
            ))),
          ),
        ),
      )
    }

    // ── ledger view ────────────────────────────────────────────────────────
    function LedgerView(props) {
      const { ledger } = props
      if (!ledger) return h('div', { className: 'dd-empty' }, '正在读取台账…')
      const totals = ledger.totals || {}
      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-toolbar' },
          h('span', { className: 'dd-chip' }, '任务 ', h('b', { className: 'dd-num' }, String(totals.tasks || 0))),
          h('span', { className: 'dd-chip' }, '花费 ', h('b', { className: 'dd-num' }, '$' + formatNumber(totals.costUsd || 0, 2))),
          ledger.budget
            ? h('span', { className: 'dd-chip' }, '预算 ', h('b', { className: 'dd-num' }, '$' + formatNumber(ledger.budget.limit_usd || 0, 2)),
              ' · 已用 ', h('b', { className: 'dd-num' }, '$' + formatNumber(ledger.budget.spent_usd || 0, 2)))
            : null,
          h('span', { style: { flex: '1' } }),
          h('span', { className: 'dd-note' }, '幂等三步：台账 → 提交 → 立刻回写'),
        ),
        h('div', { className: 'dd-scroll' },
          h('table', { className: 'dd-table' },
            h('thead', null, h('tr', null,
              h('th', null, '镜头'), h('th', null, '状态'), h('th', null, '模型'),
              h('th', { className: 'num' }, '时长'), h('th', { className: 'num' }, '费用'),
              h('th', null, '提交时间'), h('th', null, 'task_id'),
            )),
            h('tbody', null, ledger.entries.map(entry => h('tr', { key: (entry.taskId || '') + (entry.shotId || '') + (entry.submittedAt || '') },
              h('td', { className: 'num' }, entry.shotId || '—'),
              h('td', null, h('span', {
                style: {
                  color: entry.status === 'succeeded' ? 'var(--dd-pass-fg)'
                    : entry.status === 'failed' ? 'var(--dd-fail-fg)'
                      : 'var(--dd-warn-fg)',
                },
              }, entry.status || '—')),
              h('td', null, entry.model || '—'),
              h('td', { className: 'num' }, entry.duration ? entry.duration + 's' : '—'),
              h('td', { className: 'num' }, typeof entry.costUsd === 'number' ? '$' + entry.costUsd.toFixed(2) : '—'),
              h('td', { className: 'num' }, formatTime(entry.submittedAt)),
              h('td', { className: 'num', style: { color: 'var(--dd-text-dim)' } }, entry.taskId || '—'),
            ))),
          ),
        ),
      )
    }

    // ── project view ───────────────────────────────────────────────────────
    function ProjectView(props) {
      const { overview, onRefresh } = props
      if (!overview) return h('div', { className: 'dd-empty' }, '正在读取…')
      const disk = overview.disk
      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-scroll', style: { padding: '12px 14px 24px' } },
          (overview.warnings || []).map((warning, index) => h('div', {
            key: index,
            className: 'dd-warnbox',
            style: { marginBottom: '8px' },
          }, warning)),
          h('div', { className: 'dd-sec', style: { marginBottom: '10px' } },
            h('div', { className: 'dd-sec-head' }, h('span', { style: { fontWeight: '600', fontSize: '12px' } }, '路径')),
            h('div', { className: 'dd-sec-body' },
              h(Field, { label: '项目根', mono: true }, overview.projectRoot),
              h('div', { className: 'dd-note', style: { marginTop: '-4px', marginBottom: '4px' } },
                '为什么是这里：' + (overview.projectRootReason || '—')),
              h(Field, { label: '产物位置', mono: true }, overview.outputRoot),
              h('div', { className: 'dd-note', style: { marginTop: '-4px', marginBottom: '4px' } },
                '为什么是这里：' + (overview.outputRootReason || '—')),
              h(Field, { label: '模型适配', mono: true }, overview.model),
              h('div', { className: 'dd-note' },
                '改路径：编辑 profile 的 cordis.patch.yml 里 drama-desk 这一行的 projectRoot / outputRoot'),
            ),
          ),
          disk
            ? h('div', { className: 'dd-sec', style: { marginBottom: '10px' } },
              h('div', { className: 'dd-sec-head' }, h('span', { style: { fontWeight: '600', fontSize: '12px' } }, '磁盘占用')),
              h('div', { className: 'dd-sec-body' },
                h('div', { style: { height: '8px', borderRadius: '4px', background: 'var(--dd-raised)', overflow: 'hidden' } },
                  h('div', {
                    style: {
                      width: Math.min(100, Math.round(disk.ratio * 100)) + '%',
                      height: '100%',
                      background: disk.ratio > 0.9 ? 'var(--dd-fail-fg)' : disk.ratio > 0.75 ? 'var(--dd-warn-fg)' : 'var(--dd-pass-fg)',
                    },
                  }),
                ),
                h('div', { className: 'dd-note' },
                  '已用 ', h('b', { className: 'dd-num' }, formatBytes(disk.used)),
                  ' / 共 ', h('b', { className: 'dd-num' }, formatBytes(disk.total)),
                  ' · 剩余 ', h('b', { className: 'dd-num' }, formatBytes(disk.free))),
              ),
            )
            : null,
          overview.output
            ? h('div', { className: 'dd-sec' },
              h('div', { className: 'dd-sec-head' }, h('span', { style: { fontWeight: '600', fontSize: '12px' } }, '本作品产物')),
              h('div', { className: 'dd-sec-body' },
                h(Field, { label: '目录', mono: true }, overview.output.root),
                h(Field, { label: '文件数', mono: true }, String(overview.output.files)),
                h(Field, { label: '体积', mono: true }, formatBytes(overview.output.bytes)),
              ),
            )
            : null,
        ),
      )
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
      const [view, setView] = useState('pipeline')
      const [specTab, setSpecTab] = useState('rules')
      const [selectedShot, setSelectedShot] = useState(null)
      const [workspaceId, setWorkspaceId] = useState('')
      const [density, setDensity] = useState('comfortable')
      const [filter, setFilter] = useState('all')
      const [query, setQuery] = useState('')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(null)
      const [notice, setNotice] = useState(null)
      const [viewer, setViewer] = useState(null)
      const [expanded, setExpanded] = useState(true)
      const searchRef = useRef(null)

      const reload = useCallback(async () => {
        try {
          const data = await apiGet('overview')
          setOverview(data)
          const nextWorkspace = workspaceId || (data.workspaces && data.workspaces[0] ? data.workspaces[0].id : '')
          if (!workspaceId && nextWorkspace) setWorkspaceId(nextWorkspace)
          const grid = await apiGet('pipeline', { workspace: nextWorkspace })
          setPipeline(grid)
          setError(null)
        } catch (problem) {
          setError(problem instanceof Error ? problem.message : String(problem))
        }
      }, [workspaceId])

      useEffect(() => { reload() }, [reload])

      useEffect(() => {
        if (view === 'spec' && !spec) {
          apiGet('rules').then(setSpec).catch(problem => setError(problem.message))
        }
        if (view === 'assets' && !assets) {
          apiGet('assets', { workspace: workspaceId }).then(setAssets).catch(problem => setError(problem.message))
        }
        if (view === 'ledger' && !ledger) {
          apiGet('ledger', { workspace: workspaceId }).then(setLedger).catch(problem => setError(problem.message))
        }
      }, [view, spec, assets, ledger, workspaceId])

      const openShot = useCallback(async shotId => {
        setSelectedShot(shotId)
        setDetailLoading(true)
        try {
          const data = await apiGet('shot', { workspace: workspaceId, shot: shotId })
          setDetail(data)
          setError(null)
        } catch (problem) {
          setError(problem instanceof Error ? problem.message : String(problem))
          setDetail(null)
        } finally {
          setDetailLoading(false)
        }
      }, [workspaceId])

      const withBusy = useCallback(async (task, successMessage) => {
        setBusy(true)
        setNotice(null)
        try {
          const result = await task()
          setError(null)
          if (successMessage) setNotice(successMessage(result))
          await reload()
          return result
        } catch (problem) {
          setError(problem instanceof Error ? problem.message : String(problem))
          return undefined
        } finally {
          setBusy(false)
        }
      }, [reload])

      const saveBeat = useCallback(async (sceneId, beatIndex, patch) => {
        await withBusy(async () => await apiPost('edit-beat', {
          workspaceId, sceneId, beatIndex, patch,
        }), () => '已保存 beat #' + beatIndex + '（真源）')
        if (selectedShot) {
          const data = await apiGet('shot', { workspace: workspaceId, shot: selectedShot })
          setDetail(data)
        }
      }, [withBusy, workspaceId, selectedShot])

      const compileShot = useCallback(async (shotId, checkOnly) => {
        const result = await withBusy(async () => await apiPost('compile', {
          workspaceId, shotId, check: checkOnly === true,
        }), value => {
          if (value && value.ok === false) return '编译失败：' + value.error
          const stale = value && value.stale ? value.stale : []
          const changed = value && value.changed ? value.changed : []
          if (checkOnly) {
            return stale.length > 0
              ? '产物已过期：' + stale.join('、')
              : '产物与真源一致'
          }
          return '已编译：' + (value ? value.prompts : 0) + ' 条产物；变更 ' + changed.length + ' 镜'
        })
        return result
      }, [withBusy, workspaceId])

      const checkShot = useCallback(async shotId => {
        await withBusy(async () => await apiGet('check', { workspace: workspaceId, shot: shotId }),
        value => (value && value.stale ? '产物已过期（真源改了但没重编译）' : '产物与真源一致'))
      }, [withBusy, workspaceId])

      // 键盘：1–9 切镜、J/K 上下、/ 搜索、Enter 打开、F 聚焦失败项
      useEffect(() => {
        const onKey = event => {
          const target = event.target
          const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
          if (typing) return
          if (event.key === '/') { event.preventDefault(); searchRef.current && searchRef.current.focus(); return }
          if (event.key === 'f' || event.key === 'F') { setFilter('failed'); return }
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
      const currentStage = pipeline ? pipeline.stage : undefined

      return h('div', { className: 'dd-root' },
        h('style', null, CSS),
        // ── header ───────────────────────────────────────────────────────
        h('div', { className: 'dd-bar' },
          h('button', {
            className: 'dd-bar-title',
            onClick: () => setExpanded(!expanded),
            title: expanded ? '收起工作台' : '展开工作台',
            'aria-label': expanded ? '收起工作台' : '展开工作台',
            'aria-expanded': expanded,
          },
            h('span', { className: 'glyph' }, '⊞'),
            h('span', null, '流水线'),
          ),
          h('span', { className: 'dd-bar-sep' }),
          overview && overview.workspaces && overview.workspaces.length > 0
            ? h('select', {
              className: 'dd-select',
              value: workspaceId,
              onChange: event => { setWorkspaceId(event.target.value); setSelectedShot(null); setDetail(null); setAssets(null); setLedger(null) },
            }, overview.workspaces.map(work => h('option', { value: work.id, key: work.id }, work.title || work.id)))
            : null,
          pipeline
            ? h('span', { className: 'dd-chip' },
              h('b', { className: 'dd-num' }, String(pipeline.scenes.length)), ' 场 × ',
              h('b', { className: 'dd-num' }, String(counts.none + counts.generated + counts.warn + counts.fail + counts.pass)), ' 镜')
            : null,
          h('span', { className: 'dd-chip' },
            h('span', { className: 'dd-dot', style: { background: 'var(--dd-fail-fg)' } }),
            h('b', { className: 'dd-num' }, String(counts.fail)), ' FAIL'),
          h('span', { className: 'dd-chip' },
            h('span', { className: 'dd-dot', style: { background: 'var(--dd-warn-fg)' } }),
            h('b', { className: 'dd-num' }, String(counts.warn)), ' WARN'),
          h('span', { className: 'dd-chip' },
            h('span', { className: 'dd-dot', style: { background: 'var(--dd-gen-fg)' } }),
            h('b', { className: 'dd-num' }, String(counts.generated)), ' 未体检'),
          h('span', { className: 'dd-chip' },
            h('span', { className: 'dd-dot', style: { background: 'var(--dd-pass-fg)' } }),
            h('b', { className: 'dd-num' }, String(counts.pass)), ' 通过'),
          h('span', { style: { flex: '1' } }),
          overview
            ? h('span', { className: 'dd-chip', title: '产物位置：' + overview.outputRoot + '\n' + (overview.outputRootReason || '') },
              '📁 ', h('span', { className: 'dd-num', style: { maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                overview.outputRoot))
            : null,
          overview
            ? h('span', { className: 'dd-chip', title: '模型适配：' + overview.model }, '⬢ ', overview.model)
            : null,
          overview && overview.disk
            ? h('span', { className: 'dd-chip', title: '磁盘占用' },
              '▓', h('b', { className: 'dd-num' }, Math.round(overview.disk.ratio * 100) + '%'),
              h('span', { className: 'dd-num', style: { color: 'var(--dd-text-dim)' } }, ' 剩余 ' + formatBytes(overview.disk.free)))
            : null,
          h('button', { className: 'dd-btn', onClick: reload }, t('action.refresh', '刷新')),
        ),
        // ── stage bar ────────────────────────────────────────────────────
        expanded && pipeline
          ? h('div', { className: 'dd-stages' },
            (pipeline.stages || []).map((stage, index, list) => {
              const state = currentStage === stage ? 'current'
                : (currentStage && list.indexOf(currentStage) > index ? 'done' : '')
              return h(React.Fragment, { key: stage },
                index > 0 ? h('span', { className: 'dd-stage-arrow' }, '→') : null,
                h('span', { className: 'dd-stage ' + state }, stage),
              )
            }),
          )
          : null,
        // ── body ─────────────────────────────────────────────────────────
        expanded
          ? h('div', { className: 'dd-body' },
            h('div', { className: 'dd-nav' },
              h('button', { className: 'dd-nav-item' + (view === 'project' ? ' active' : ''), onClick: () => setView('project') },
                h('span', { className: 'glyph' }, '🗂'), h('span', null, t('nav.project', '项目'))),
              h('button', { className: 'dd-nav-item' + (view === 'pipeline' ? ' active' : ''), onClick: () => setView('pipeline') },
                h('span', { className: 'glyph' }, '⊞'), h('span', null, t('nav.pipeline', '流水线')),
                counts.fail > 0 ? h('span', { className: 'badge dd-num' }, String(counts.fail)) : null),
              h('button', { className: 'dd-nav-item' + (view === 'spec' ? ' active' : ''), onClick: () => setView('spec') },
                h('span', { className: 'glyph' }, '◈'), h('span', null, t('nav.spec', '规范'))),
              h('button', { className: 'dd-nav-item' + (view === 'assets' ? ' active' : ''), onClick: () => setView('assets') },
                h('span', { className: 'glyph' }, '▣'), h('span', null, t('nav.assets', '资产'))),
              h('button', { className: 'dd-nav-item' + (view === 'ledger' ? ' active' : ''), onClick: () => setView('ledger') },
                h('span', { className: 'glyph' }, '⌘'), h('span', null, t('nav.ledger', '台账'))),
            ),
            h('div', { style: { flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
              view === 'project' ? h(ProjectView, { overview, onRefresh: reload }) : null,
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
              view === 'spec' ? h(SpecView, { spec, tab: specTab, onTab: setSpecTab }) : null,
              view === 'assets' ? h(AssetsView, { assets, onOpenImage: asset => setViewer(asset) }) : null,
              view === 'ledger' ? h(LedgerView, { ledger }) : null,
              error
                ? h('div', { className: 'dd-error', style: { margin: '8px 10px' } }, error)
                : null,
              notice
                ? h('div', { className: 'dd-note', style: { margin: '4px 10px' } }, notice)
                : null,
            ),
            view === 'pipeline'
              ? h(ShotDetail, {
                detail,
                loading: detailLoading,
                busy,
                onClose: () => { setSelectedShot(null); setDetail(null) },
                onEditBeat: saveBeat,
                onCompile: compileShot,
                onCheck: checkShot,
                onOpenImage: asset => setViewer(asset),
              })
              : null,
          )
          : null,
        viewer
          ? h(ImageViewer, {
            src: assetImageUrl(workspaceId, viewer.id),
            title: viewer.id,
            onClose: () => setViewer(null),
          })
          : null,
      )
    }

    // ── sidebar glyph ─────────────────────────────────────────────────────
    // The panel list draws the icon from this component; the host theme's
    // currentColor carries the tint.
    function DramaDeskIcon(props) {
      const size = props.size ?? 18
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 16 16',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': true,
        style: { display: 'block', pointerEvents: 'none' },
      }, [
        h('rect', { key: 'frame', x: 1.5, y: 2.5, width: 13, height: 11, rx: 2, stroke: 'currentColor', strokeWidth: 1.4 }),
        h('rect', { key: 'ok1', x: 3.5, y: 5, width: 2.5, height: 2.5, rx: 0.8, fill: 'currentColor', stroke: 'none', opacity: 0.75 }),
        h('rect', { key: 'ok2', x: 3.5, y: 9, width: 2.5, height: 2.5, rx: 0.8, fill: 'currentColor', stroke: 'none', opacity: 0.75 }),
        h('rect', { key: 'warn', x: 7, y: 5, width: 2.5, height: 2.5, rx: 0.8, fill: 'currentColor', stroke: 'none', opacity: 0.45 }),
        h('rect', { key: 'fail', x: 7, y: 9, width: 2.5, height: 2.5, rx: 0.8, fill: 'currentColor', stroke: 'none', opacity: 0.45 }),
        h('circle', { key: 'focus', cx: 12.2, cy: 10.2, r: 2.6, stroke: 'currentColor', strokeWidth: 1.4 }),
      ])
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // Register the visible UI text with the Client locale service, then
        // bind it. A locale service that refuses the namespace (an older
        // runtime, a namespace already taken) leaves the built-in text in
        // place — the desk must still work.
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
          label: () => t('nav.title', '短剧工作台'),
        }, DramaDeskIcon))
      },
    }
  },
})
