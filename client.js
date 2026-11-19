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
// ── design tokens ──────────────────────────────────────────────────────
    //
    // 一套为「导播台」量身定制的物质语言。四件事决定它长什么样：
    //
    //  ① **字分四份，各司其职。**
    //     仪表（Bahnschrift，DIN 骨架）只出现在纯拉丁的编号与微标签上；
    //     正文与中文标题交给 Noto Sans SC / Segoe UI Variable；
    //     读数用 Cascadia Mono（等宽＝仪表读数）；只有「简报、台词、镜名」
    //     这类文学内容才配衬线。中英混排时 Latin 与 CJK 各取所长。
    //
    //  ② **深浅不是「亮一点」。**
    //     每一层都带**顶光**（inset 1px 高光）与**落影**，才像一块被加工过的
    //     金属面板，而不是一张画在纸上的卡片。
    //
    //  ③ **信号盘是导播台自有的。**
    //     红＝FAIL，琥珀＝WARN，绿＝PASS，青＝在途，空＝未生成。
    //     它们**刻意不与宿主 UI 的强调色同族**——信号灯是给人从远处一眼读的，
    //     不能和链接、悬停、选中混在一起。
    //
    //  ④ **能用形与位说清的，不写小字说明。**
    //
    const CSS = `
.dd{
  /* ══ signal palette（导播台自有信号灯）══════════════════════════════ */
  --sig-fail:#e8535c;
  --sig-warn:#d99328;
  --sig-pass:#2aa06b;
  --sig-fly:#3aa2cf;
  --sig-none:#798294;

  /* ══ ink ═════════════════════════════════════════════════════════════ */
  --ink:var(--dsw-alias-label-primary,#e8ecf3);
  --ink2:var(--dsw-alias-label-secondary,#98a1b3);
  --ink3:var(--dsw-alias-label-tertiary,#6b7488);
  --ink4:var(--dsw-alias-label-caption,#8b93a4);
  --on-primary:var(--dsw-alias-label-primary-inverted,#0b0e13);
  --hot:var(--dsw-alias-link,#7aaaff);
  --hot-2:color-mix(in srgb,var(--hot) 16%,transparent);
  --hot-line:color-mix(in srgb,var(--hot) 52%,transparent);

  /* ══ surfaces ════════════════════════════════════════════════════════ */
  --bg:var(--dsw-alias-bg-base,#ffffff);
  --panel:color-mix(in srgb,var(--ink) 1.5%,var(--bg));
  --panel-2:color-mix(in srgb,var(--ink) 3.2%,var(--bg));
  --raised:color-mix(in srgb,var(--ink) 4.8%,var(--bg));
  --sunken:color-mix(in srgb,var(--ink) 7%,var(--bg));
  --line:color-mix(in srgb,var(--ink) 10%,transparent);
  --line-2:color-mix(in srgb,var(--ink) 17%,transparent);
  --hl:rgba(255,255,255,.9);
  --sh:color-mix(in srgb,var(--ink) 13%,transparent);
  --sh-soft:color-mix(in srgb,var(--ink) 6%,transparent);
  --key:#c8d9ff;
  --ember:#ffd7a3;

  /* ══ type ════════════════════════════════════════════════════════════ */
  --f-ui:"Segoe UI Variable Text","Segoe UI","Noto Sans SC","PingFang SC","Microsoft YaHei UI",system-ui,sans-serif;
  --f-display:"Noto Sans SC","Segoe UI Variable Display","PingFang SC","Microsoft YaHei UI",system-ui,sans-serif;
  --f-gauge:"Bahnschrift","Segoe UI Variable Display","DIN Alternate","Noto Sans SC",system-ui,sans-serif;
  --f-mono:"Cascadia Mono","Cascadia Code","SF Mono","JetBrains Mono",Consolas,ui-monospace,monospace;
  --serif:"Noto Serif SC","Source Han Serif SC",Georgia,"Songti SC",serif;
  --latin-serif:var(--f-mono);

  /* ══ geometry ═════════════════════════════════════════════════════════ */
  --rx-1:6px; --rx-2:10px; --rx-3:14px; --rx-4:18px; --rx-5:24px;
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:34px;

  /* ══ elevation ════════════════════════════════════════════════════════ */
  --e-1:0 1px 2px var(--sh-soft);
  --e-2:0 0 0 .5px var(--line),inset 0 1px 0 var(--hl);
  --e-3:0 2px 6px -1px var(--sh-soft),0 0 0 .5px var(--line),inset 0 1px 0 var(--hl);
  --e-4:0 12px 28px -14px var(--sh),0 2px 6px -2px var(--sh-soft),0 0 0 .5px var(--line-2),inset 0 1px 0 var(--hl);
  --e-pop:0 28px 64px -22px rgba(0,0,0,.6),0 0 0 .5px var(--line-2),inset 0 1px 0 var(--hl);
  --e-well:inset 0 1px 3px var(--sh-soft),inset 0 0 0 .5px var(--line);

  /* ══ motion ═══════════════════════════════════════════════════════════ */
  --ease:cubic-bezier(.22,.61,.36,1);
  --ease-out:cubic-bezier(.16,1,.3,1);
  --spring:cubic-bezier(.34,1.42,.64,1);
  --t-fast:120ms; --t-mid:200ms; --t-slow:360ms;

  font-family:var(--f-ui);
  font-size:13px;line-height:1.55;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
  color:var(--ink);background:var(--bg);
  border:.5px solid var(--line);
  border-radius:var(--rx-4);
  overflow:hidden;display:flex;flex-direction:column;
  width:100%;height:100%;min-height:0;box-sizing:border-box;
  position:relative;isolation:isolate;
  container:dd-root / inline-size;
}
/* 兼容别名：少量行内样式还在用旧名字。把它们指到新体系上，
   这样「只有一套 token」这条纪律不会被一行漏改破坏。 */
.dd{
  --r-xs:var(--rx-1); --r-sm:var(--rx-2); --r-md:var(--rx-3);
  --r-lg:var(--rx-4); --r-xl:var(--rx-5); --r-panel:var(--rx-5);
  --card:var(--raised);
  --glass:var(--panel-2);
  --accent:var(--hot);
  --draft:var(--sig-fly);
  --primary:var(--dsw-alias-button-primary-fill,#3d9be9);
  --primary-hover:var(--dsw-alias-button-primary-hover,#5aacf0);
  --elev:var(--e-3); --elev-panel:var(--e-2); --elev-prominent:var(--e-4);
}
/* 暗色主题：顶光变成一线冷白，落影变深——同一块板子，换一种打光。 */
body[data-ds-dark-theme] .dd{
  --bg:var(--dsw-alias-bg-base,#151517);
  --panel:color-mix(in srgb,var(--ink) 2.4%,var(--bg));
  --panel-2:color-mix(in srgb,var(--ink) 5%,var(--bg));
  --raised:color-mix(in srgb,var(--ink) 7.5%,var(--bg));
  --sunken:color-mix(in srgb,#000 46%,var(--bg));
  --line:color-mix(in srgb,var(--ink) 9%,transparent);
  --line-2:color-mix(in srgb,var(--ink) 16%,transparent);
  --hl:rgba(255,255,255,.062);
  --sh:rgba(0,0,0,.62);
  --sh-soft:rgba(0,0,0,.42);
  --key:#9fbcff;
  --ember:#ffc98d;
  --sig-fail:#f4606a; --sig-warn:#e3a13a; --sig-pass:#38bd85; --sig-fly:#4fb6e2; --sig-none:#6d7585;
  /* 暗处更要靠光影分层：落影更深、顶光更亮、发丝线更清楚。 */
  --e-3:0 4px 12px -4px rgba(0,0,0,.62),0 0 0 .5px var(--line-2),inset 0 1px 0 var(--hl);
  --e-4:0 18px 40px -18px rgba(0,0,0,.86),0 4px 10px -4px rgba(0,0,0,.55),0 0 0 .5px var(--line-2),inset 0 1px 0 var(--hl);
  /* 暗处才看得见颗粒；亮色下重了就成脏纸。 */
  --grain:.038;
}
.dd{--grain:.016}
.dd::after{opacity:var(--grain)}
.dd *{box-sizing:border-box}
.dd button{font:inherit;color:inherit;background:none;border:none;cursor:pointer;padding:0}
.dd button:disabled{opacity:.36;cursor:not-allowed}
.dd input,.dd textarea,.dd select{font:inherit;color:inherit}
.dd .num{font-family:var(--f-mono);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
/* 仪表微标签：纯拉丁、全大写、宽字距。中文不用它——那是另一种排版。 */
.dd .gauge{
  font-family:var(--f-gauge);font-weight:500;font-size:9.5px;
  letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);
}
.dd :focus-visible{outline:2px solid var(--hot);outline-offset:2px;border-radius:var(--rx-1)}

/* ── atmosphere ───────────────────────────────────────────────────────── */
/* 两盏灯：左上一道冷的主光，右下一抹钨丝的暖反射。再加一层极细的网格，
   像校准过的台面。全部是**静态渐变**——一次光栅化，没有逐帧开销。 */
.dd-ambient{
  position:absolute;inset:0;overflow:clip;pointer-events:none;z-index:0;
  background:
    radial-gradient(105% 78% at 4% -14%, color-mix(in srgb,var(--key) 22%,transparent), transparent 56%),
    radial-gradient(78% 66% at 106% 112%, color-mix(in srgb,var(--ember) 13%,transparent), transparent 60%),
    linear-gradient(180deg, color-mix(in srgb,var(--key) 6%,transparent), transparent 30%);
}
.dd-texture{
  position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.55;
  background-image:
    linear-gradient(to right, var(--line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--line) 1px, transparent 1px);
  background-size:56px 56px;
  -webkit-mask-image:radial-gradient(130% 105% at 50% -8%,#000 0%,transparent 70%);
  mask-image:radial-gradient(130% 105% at 50% -8%,#000 0%,transparent 70%);
}
/* 胶片颗粒：给整块面板一层极细的噪点，避免大面积渐变显得「塑料」。
   亮色主题下要更轻——重了就变成脏纸。 */
.dd::after{
  content:'';position:absolute;inset:0;z-index:60;pointer-events:none;opacity:var(--grain);
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
  background-size:140px 140px;
}

/* ── masthead ────────────────────────────────────────────────────────── */
.dd-mast{
  display:flex;align-items:center;gap:14px;padding:0 16px;height:54px;flex:none;z-index:3;
  /* 顶栏**不用 backdrop-filter**：同层叠上下文里有大模糊层时，Chromium
     会把这个元素的内容层整个丢掉（DOM 在、几何对、就是不画）。 */
  background:linear-gradient(180deg,var(--panel-2),var(--panel));
  box-shadow:0 1px 0 var(--hl) inset,0 1px 0 var(--line),0 6px 18px -12px var(--sh);
}
.dd-brand{display:flex;align-items:center;gap:10px;flex:none}
.dd-brand-mark{
  width:30px;height:30px;border-radius:var(--rx-2);display:grid;place-items:center;flex:none;
  background:linear-gradient(160deg,var(--raised),var(--sunken));
  box-shadow:var(--e-3);color:var(--hot);
}
.dd-brand-mark svg{filter:none}
.dd-brand-name{
  font-family:var(--f-display);font-weight:600;font-size:14.5px;
  letter-spacing:.01em;line-height:1.15;color:var(--ink);
}
.dd-brand-sub{
  font-size:9.5px;letter-spacing:.2em;color:var(--ink3);margin-top:2px;line-height:1;
}
.dd-mast-sep{width:1px;height:22px;background:var(--line);flex:none}

/* 作品牌：像监视器上贴的场次条 */
.dd-work{
  position:relative;display:flex;align-items:center;gap:9px;height:36px;padding:0 9px 0 11px;
  border-radius:var(--rx-2);background:var(--raised);box-shadow:var(--e-2);
  flex:0 1 auto;min-width:148px;
  transition:box-shadow var(--t-mid) var(--ease),transform var(--t-mid) var(--ease);
}
.dd-work:hover{box-shadow:var(--e-4);transform:translateY(-1px)}
.dd-work-trigger{display:flex;align-items:baseline;gap:8px;cursor:pointer;min-width:0}
.dd-work-label{
  font-family:var(--f-gauge);font-size:9px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--ink3);flex:none;align-self:center;
}
.dd-work-title{
  font-family:var(--f-display);font-size:13.5px;font-weight:600;letter-spacing:.01em;
  max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.dd-work-sub{font-family:var(--f-mono);font-size:10.5px;color:var(--ink3);letter-spacing:-.02em;white-space:nowrap;flex:none}
.dd-work-caret{color:var(--ink3);flex:none;align-self:center}
.dd-menu{
  position:absolute;top:calc(100% + 7px);left:0;z-index:40;min-width:330px;max-width:440px;
  background:var(--raised);border-radius:var(--rx-3);box-shadow:var(--e-pop);padding:6px;
  animation:dd-pop var(--t-mid) var(--spring) both;
}
@keyframes dd-pop{from{opacity:0;transform:translateY(-6px) scale(.98)}}
.dd-menu-item{
  display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--rx-1);cursor:pointer;
  transition:background var(--t-fast) var(--ease);
}
.dd-menu-item:hover{background:var(--hover)}
.dd-menu-item.on{background:var(--hot-2)}
.dd-menu-item .mi-title{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-menu-item .mi-sub{font-size:10.5px;color:var(--ink3);font-family:var(--f-mono);margin-top:2px}
.dd-menu-sep{height:.5px;background:var(--line);margin:5px 4px}
.dd-menu-label{font-family:var(--f-gauge);font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink3);padding:7px 10px 4px}

/* ── tally instrument ────────────────────────────────────────────────── */
/* 一块内嵌的灯条：四段灯 + 读数。这是导演唯一需要「一眼扫到」的东西。 */
.dd-tally{
  display:flex;align-items:stretch;gap:1px;height:32px;padding:3px;flex:none;
  border-radius:var(--rx-2);background:var(--sunken);box-shadow:var(--e-well);
}
.dd-tally-cell{
  display:flex;align-items:center;gap:6px;padding:0 8px;border-radius:var(--rx-1);
  transition:background var(--t-fast) var(--ease);
}
.dd-tally-cell:hover{background:var(--panel-2)}
.dd-tally-cell b{
  font-family:var(--f-mono);font-size:13px;font-weight:600;color:var(--ink);
  font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1;
}
.dd-tally-cell span.lb{
  font-family:var(--f-gauge);font-size:9px;letter-spacing:.13em;text-transform:uppercase;
  color:var(--ink3);line-height:1;
}
.dd-led{width:7px;height:7px;border-radius:50%;flex:none;background:var(--sig-none);position:relative}
.dd-led.fail{background:var(--sig-fail);box-shadow:0 0 9px color-mix(in srgb,var(--sig-fail) 62%,transparent)}
.dd-led.warn{background:var(--sig-warn);box-shadow:0 0 9px color-mix(in srgb,var(--sig-warn) 52%,transparent)}
.dd-led.gen{background:var(--sig-fly);box-shadow:0 0 8px color-mix(in srgb,var(--sig-fly) 44%,transparent)}
.dd-led.pass{background:var(--sig-pass);box-shadow:0 0 8px color-mix(in srgb,var(--sig-pass) 44%,transparent)}

.dd-mast-right{margin-left:auto;display:flex;align-items:center;gap:8px;flex:none}
/* 读数条：顶栏的路径/磁盘/各阶段计数都走它——安静、内嵌、不抢戏。 */
.dd-readout,.dd-chip{
  display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:var(--rx-2);
  font-family:var(--f-mono);font-size:10.5px;color:var(--ink3);letter-spacing:-.01em;
  background:var(--sunken);box-shadow:var(--e-well);max-width:250px;white-space:nowrap;
}
.dd-readout b,.dd-chip b{color:var(--ink2);font-weight:600}
.dd-readout.click,.dd-chip.click{cursor:pointer;transition:color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease)}
.dd-readout.click:hover,.dd-chip.click:hover{color:var(--ink);box-shadow:var(--e-well),0 0 0 1px var(--hot-line)}
.dd-readout .path,.dd-chip .path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}

/* ── icon buttons ────────────────────────────────────────────────────── */
.dd-icon-btn{
  width:30px;height:30px;border-radius:var(--rx-2);display:grid;place-items:center;flex:none;
  background:var(--raised);box-shadow:var(--e-2);color:var(--ink2);
  transition:color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease),transform var(--t-fast) var(--ease);
}
.dd-icon-btn:hover:not(:disabled){color:var(--hot);box-shadow:var(--e-4);transform:translateY(-1px)}
.dd-icon-btn:active:not(:disabled){transform:translateY(0) scale(.97);box-shadow:var(--e-1)}
.dd-icon-btn.on{
  background:linear-gradient(180deg,color-mix(in srgb,var(--hot) 22%,var(--raised)),var(--raised));
  box-shadow:var(--e-2),inset 0 0 0 1px var(--hot-line);color:var(--hot);
}
/* 小一号的图标按钮：放在一条紧凑的行里（拍头、卡片角标）。 */
.dd-icon-btn.sm{width:23px;height:23px;border-radius:var(--rx-1)}
.dd-icon-btn.ghost{background:transparent;box-shadow:none}
.dd-icon-btn.ghost:hover:not(:disabled){background:var(--panel-2);box-shadow:none;transform:none}

/* ── stage rail (console track) ──────────────────────────────────────── */
/* 一条贯穿的轨道 + 九个节点。进度不是「几个彩色圆点」，是**轨道被点亮的那一段**。 */
.dd-rail{
  display:flex;align-items:stretch;gap:14px;padding:0 16px;height:54px;flex:none;z-index:2;
  background:var(--panel);box-shadow:0 1px 0 var(--line),0 6px 16px -14px var(--sh);
}
.dd-rail-id{
  display:flex;flex-direction:column;justify-content:center;gap:3px;flex:none;padding-right:14px;
  border-right:.5px solid var(--line);
}
.dd-rail-id .idx{
  font-family:var(--f-mono);font-size:15px;font-weight:600;letter-spacing:-.04em;
  color:var(--ink);line-height:1;font-variant-numeric:tabular-nums;
}
.dd-rail-id .idx em{font-style:normal;color:var(--ink3);font-size:10px;letter-spacing:0}
.dd-rail-id .en{font-family:var(--f-gauge);font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink3);line-height:1}
.dd-rail-track{
  position:relative;flex:1 1 auto;min-width:0;display:flex;align-items:flex-start;
  padding:9px 0 0;overflow-x:auto;scrollbar-width:none;
}
.dd-rail-track::-webkit-scrollbar{display:none}
.dd-nodes{position:relative;display:flex;align-items:flex-start;gap:0;padding:0 2px;width:100%;min-width:max-content}
/* 连接段：轨道上被点亮的那些短线。 */
.dd-link{flex:1 1 0;min-width:16px;height:36px;position:relative}
.dd-link::before{
  content:'';position:absolute;left:0;right:0;top:4.5px;height:1px;background:var(--line-2);
  transition:background var(--t-slow) var(--ease),box-shadow var(--t-slow) var(--ease);
}
.dd-link.lit::before{
  background:var(--hot);box-shadow:0 0 9px color-mix(in srgb,var(--hot) 46%,transparent);
}
.dd-node{
  display:flex;flex-direction:column;align-items:center;gap:7px;height:36px;padding:0 11px;flex:none;
  background:none;cursor:pointer;
  transition:color var(--t-mid) var(--ease);
}
.dd-node .dot{
  width:10px;height:10px;border-radius:50%;flex:none;background:transparent;
  box-shadow:inset 0 0 0 1.5px var(--line-2);
  transition:background var(--t-mid) var(--ease),box-shadow var(--t-mid) var(--ease),transform var(--t-mid) var(--ease);
}
.dd-node .lb{
  font-size:12px;color:var(--ink3);letter-spacing:.02em;white-space:nowrap;line-height:1.5;
  transition:color var(--t-mid) var(--ease);
}
.dd-node:hover .lb{color:var(--ink2)}
.dd-node:hover .dot{box-shadow:inset 0 0 0 1.5px var(--ink3)}
.dd-node.done .dot{background:var(--hot);box-shadow:0 0 8px color-mix(in srgb,var(--hot) 40%,transparent)}
.dd-node.done .lb{color:var(--ink2)}
.dd-node.ready .dot{background:var(--sig-fly);box-shadow:0 0 8px color-mix(in srgb,var(--sig-fly) 44%,transparent)}
.dd-node.ready .lb{color:var(--ink)}
.dd-node.current .dot{
  background:var(--hot);transform:scale(1.25);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--hot) 20%,transparent),0 0 14px color-mix(in srgb,var(--hot) 62%,transparent);
}
.dd-node.current .lb{color:var(--ink);font-weight:600}
.dd-node.preview .dot{
  background:transparent;box-shadow:inset 0 0 0 1.5px var(--hot);
  animation:dd-pulse 1.8s var(--ease) infinite;
}
.dd-node.preview .lb{color:var(--hot);font-weight:600}
.dd-node.blocked .dot{background:transparent;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--sig-fail) 60%,transparent)}
@keyframes dd-pulse{50%{box-shadow:inset 0 0 0 1.5px var(--hot),0 0 12px color-mix(in srgb,var(--hot) 60%,transparent)}}
.dd-rail-note{
  display:flex;align-items:center;gap:8px;flex:none;padding-left:14px;
  border-left:.5px solid var(--line);
}
.dd-rail-note .pill{
  display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:var(--rx-1);
  font-size:11px;color:var(--hot);background:var(--hot-2);
  box-shadow:inset 0 0 0 1px var(--hot-line);
}
.dd-rail-note .pill b{color:var(--ink);font-weight:600}

/* ── body shell ──────────────────────────────────────────────────────── */
.dd-body{display:flex;min-height:0;flex:1 1 auto;overflow:hidden;position:relative;z-index:1}
.dd-nav{
  width:58px;flex:0 0 58px;box-shadow:1px 0 0 var(--line);
  background:linear-gradient(180deg,var(--panel),var(--bg));
  display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 0;
}
.dd-nav-btn{
  width:46px;height:46px;border-radius:var(--rx-2);display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:4px;color:var(--ink3);position:relative;
  transition:color var(--t-mid) var(--ease),background var(--t-mid) var(--ease),box-shadow var(--t-mid) var(--ease);
}
.dd-nav-btn:hover{color:var(--ink2);background:var(--panel-2)}
.dd-nav-btn.on{
  color:var(--hot);background:var(--raised);box-shadow:var(--e-2);
}
.dd-nav-btn.on::before{
  content:'';position:absolute;left:-6px;top:12px;bottom:12px;width:2.5px;border-radius:2px;
  background:var(--hot);box-shadow:0 0 10px var(--hot);
}
.dd-nav-btn .lbl{font-size:9.5px;letter-spacing:.04em;line-height:1}
.dd-nav-btn .badge{
  position:absolute;top:2px;right:2px;min-width:15px;height:15px;border-radius:8px;padding:0 4px;
  background:var(--sig-fail);color:#fff;font-size:9px;font-family:var(--f-mono);
  display:grid;place-items:center;box-shadow:0 0 0 2px var(--bg);
}
.dd-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;overflow:hidden}

/* ── filter band（规范 / 资产 / 台账的次级筛选条）───────────────────── */
.dd-toolbar{
  display:flex;align-items:center;gap:10px;padding:10px 20px;flex:none;flex-wrap:wrap;
  box-shadow:0 1px 0 var(--line);background:var(--panel);
}

/* ── deck (stage header + controls, fused into one band) ─────────────── */
.dd-deck{
  display:flex;align-items:center;gap:16px;padding:13px 20px;flex:none;flex-wrap:wrap;
  border-bottom:.5px solid var(--line);
  background:linear-gradient(180deg,var(--panel),transparent);
}
.dd-deck-id{display:flex;align-items:baseline;gap:10px;min-width:0;flex:1 1 auto;flex-wrap:wrap}
.dd-deck-id .sn3{font-family:var(--f-mono);font-size:10.5px;color:var(--ink3);letter-spacing:.06em;flex:none}
.dd-deck-id .st3{
  font-family:var(--f-display);font-size:21px;font-weight:600;letter-spacing:.01em;
  line-height:1.2;white-space:nowrap;
}
.dd-deck-id .deck-left{display:inline-flex;align-items:center;gap:6px;flex:none}
.dd-deck-id .deck-left .dd-readout{height:26px}
.dd-deck-id .sd3{
  font-size:12.5px;color:var(--ink2);line-height:1.6;flex:1 1 260px;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.dd-deck-tools{display:flex;align-items:center;gap:8px;flex:0 1 auto;min-width:0;flex-wrap:wrap;justify-content:flex-end}

/* ── filmstrip (scene timeline) ──────────────────────────────────────── */
/* 一条真的胶片：上下有齿孔，中间是格子。选中的一格抬起并亮起。 */
.dd-strip{
  display:flex;align-items:stretch;gap:0;padding:8px 20px 10px;flex:none;
  overflow-x:auto;scrollbar-width:none;
  background:
    repeating-linear-gradient(90deg,var(--line) 0 6px,transparent 6px 14px) top/auto 3px no-repeat,
    repeating-linear-gradient(90deg,var(--line) 0 6px,transparent 6px 14px) bottom/auto 3px no-repeat,
    linear-gradient(180deg,var(--panel),transparent);
  border-bottom:.5px solid var(--line);
}
.dd-strip::-webkit-scrollbar{display:none}
.dd-scene-cell{
  display:flex;align-items:center;gap:9px;padding:7px 13px;flex:none;cursor:pointer;
  border-radius:var(--rx-2);background:var(--raised);box-shadow:var(--e-2);
  transition:box-shadow var(--t-mid) var(--ease),transform var(--t-mid) var(--ease),color var(--t-mid) var(--ease);
  margin-right:6px;color:var(--ink3);
}
.dd-scene-cell:hover{color:var(--ink2);box-shadow:var(--e-4);transform:translateY(-1px)}
.dd-scene-cell.on{
  color:var(--ink);box-shadow:var(--e-4),inset 0 0 0 1px var(--hot-line);
  background:linear-gradient(180deg,color-mix(in srgb,var(--hot) 12%,var(--raised)),var(--raised));
}
.dd-scene-cell .sid{
  font-family:var(--f-mono);font-size:10.5px;letter-spacing:.02em;color:var(--ink3);
}
.dd-scene-cell.on .sid{color:var(--hot)}
.dd-scene-cell .nm{
  font-family:var(--f-display);font-size:12.5px;font-weight:500;max-width:150px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.dd-scene-cell .ct{font-family:var(--f-mono);font-size:10px;color:var(--ink3)}
.dd-scene-cell .dot{width:6px;height:6px;border-radius:50%;flex:none}
.dd-scene-cell .dot.fail{background:var(--sig-fail);box-shadow:0 0 7px color-mix(in srgb,var(--sig-fail) 55%,transparent)}
.dd-scene-cell .dot.warn{background:var(--sig-warn);box-shadow:0 0 7px color-mix(in srgb,var(--sig-warn) 50%,transparent)}
.dd-scene-cell .dot.ok{background:var(--sig-pass)}
.dd-strip-nav{display:flex;align-items:center;gap:6px;flex:none;padding:8px 20px;background:var(--panel)}

/* ── segmented control ───────────────────────────────────────────────── */
.dd-seg{
  display:inline-flex;padding:2px;border-radius:var(--rx-2);flex:none;
  background:var(--sunken);box-shadow:var(--e-well);gap:2px;
}
.dd-seg button{
  height:24px;padding:0 11px;border-radius:var(--rx-1);font-size:11.5px;color:var(--ink3);
  white-space:nowrap;transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-seg button:hover{color:var(--ink2)}
.dd-seg button.on{
  color:var(--ink);background:var(--raised);box-shadow:var(--e-2);font-weight:500;
}

/* ── inputs ──────────────────────────────────────────────────────────── */
.dd-input{
  height:30px;padding:0 11px;border-radius:var(--rx-2);background:var(--sunken);
  border:none;box-shadow:var(--e-well);color:var(--ink);font-size:12.5px;outline:none;
  min-width:150px;flex:1 1 180px;max-width:260px;
  transition:box-shadow var(--t-fast) var(--ease);
}
.dd-input::placeholder{color:var(--ink3)}
.dd-input:focus{box-shadow:var(--e-well),0 0 0 1.5px var(--hot)}
.dd-input option{background:var(--raised);color:var(--ink)}
/* 原生下拉框自带一套外观（箭头、圆角、内边距），跟这块板子不是一个世界。
   换成自己画的小箭头，它才像面板的一部分。 */
select.dd-input{
  appearance:none;-webkit-appearance:none;padding-right:28px;cursor:pointer;
  background-image:
    linear-gradient(45deg,transparent 50%,var(--ink3) 50%),
    linear-gradient(135deg,var(--ink3) 50%,transparent 50%);
  background-position:calc(100% - 15px) 13px,calc(100% - 10px) 13px;
  background-size:5px 5px,5px 5px;
  background-repeat:no-repeat;
}

/* ── buttons ─────────────────────────────────────────────────────────── */
.dd-btn{
  height:30px;padding:0 13px;border-radius:var(--rx-2);background:var(--raised);box-shadow:var(--e-2);
  font-size:12.5px;color:var(--ink2);white-space:nowrap;
  transition:color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease),transform var(--t-fast) var(--ease);
}
.dd-btn:hover:not(:disabled){color:var(--ink);box-shadow:var(--e-4);transform:translateY(-1px)}
.dd-btn:active:not(:disabled){transform:translateY(0) scale(.985);box-shadow:var(--e-1)}
.dd-btn.sm{height:25px;padding:0 10px;font-size:11.5px;border-radius:var(--rx-1)}
.dd-btn.primary{
  background:linear-gradient(180deg,var(--dsw-alias-button-primary-fill,var(--primary,#3d9be9)),var(--dsw-alias-button-primary-fill,var(--primary,#3d9be9)));
  color:var(--on-primary);font-weight:600;
  box-shadow:0 1px 0 rgba(255,255,255,.16) inset,0 0 0 .5px var(--line-2),0 2px 8px -2px var(--sh);
}
.dd-btn.primary:hover:not(:disabled){
  background:linear-gradient(180deg,var(--dsw-alias-button-primary-hover,var(--primary-hover,#5aacf0)),var(--dsw-alias-button-primary-hover,var(--primary-hover,#5aacf0)));
  color:var(--on-primary);box-shadow:0 1px 0 rgba(255,255,255,.2) inset,0 0 0 .5px var(--line-2),0 8px 20px -8px var(--sh);
}
.dd-btn.danger{color:var(--sig-fail);box-shadow:var(--e-2),inset 0 0 0 1px color-mix(in srgb,var(--sig-fail) 32%,transparent)}
.dd-btn.danger:hover:not(:disabled){color:var(--sig-fail);box-shadow:var(--e-4),inset 0 0 0 1px color-mix(in srgb,var(--sig-fail) 55%,transparent)}
.dd-btn.ghost{background:transparent;box-shadow:none}
.dd-btn.ghost:hover:not(:disabled){background:var(--panel-2);box-shadow:none;transform:none}
.dd-spacer{flex:1}

/* ── scroll & stage floor ────────────────────────────────────────────── */
.dd-scroll{overflow:auto;flex:1 1 auto;min-height:0}
.dd-grid{padding:18px 20px 40px;max-width:1680px;margin:0 auto}

/* ── outline ─────────────────────────────────────────────────────────── */
.dd-outline-list{display:flex;flex-direction:column;gap:10px}
.dd-outline-list>*{flex:0 0 auto}
.dd-outline-row{
  display:grid;grid-template-columns:104px minmax(0,1fr) 236px;gap:18px;align-items:start;
  border-radius:var(--rx-3);background:var(--raised);padding:12px 14px;
  box-shadow:var(--e-3);transition:box-shadow var(--t-mid) var(--ease);
}
.dd-outline-row:hover{box-shadow:var(--e-4)}
.dd-outline-row .oid{font-family:var(--f-mono);font-size:11px;color:var(--ink3);letter-spacing:.04em;padding-top:2px}
.dd-outline-row .ometa{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}
/* 场次骨架读起来要像**一张分场表**，不是像一排表单：
   左边是编号，中间是三行「标签 — 内容」，右边是元信息。 */
.dd-outline-body{display:flex;flex-direction:column;gap:8px;min-width:0}
.dd-outline-body>*{flex:0 0 auto}
.dd-outline-body .dd-ed{--ed-lab:104px}
.dd-outline-meta{display:flex;flex-direction:column;gap:8px;min-width:0}
.dd-outline-meta>*{flex:0 0 auto}
.dd-outline-meta .dd-ed{--ed-lab:52px}
.dd-outline-foot{display:flex;gap:7px;align-items:center;margin-top:1px}

/* ── character cards ─────────────────────────────────────────────────── */
.dd-cast{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}
.dd-cast-card{
  border-radius:var(--rx-3);background:var(--raised);overflow:hidden;
  box-shadow:var(--e-3);display:flex;flex-direction:column;
  transition:box-shadow var(--t-mid) var(--ease),transform var(--t-mid) var(--ease);
}
.dd-cast-card:hover{box-shadow:var(--e-4);transform:translateY(-2px)}
.dd-cast-top{display:flex;gap:13px;padding:14px 15px;align-items:flex-start}
.dd-cast-portrait{
  width:76px;height:96px;border-radius:var(--rx-2);overflow:hidden;flex:none;background:var(--sunken);
  box-shadow:var(--e-2);position:relative;
}
.dd-cast-portrait img{width:100%;height:100%;object-fit:cover;display:block}
.dd-cast-portrait .ph{
  width:100%;height:100%;display:grid;place-items:center;font-size:10px;color:var(--ink3);
  background:repeating-linear-gradient(135deg,transparent 0 6px,var(--line) 6px 7px);
}
.dd-cast-name{font-family:var(--serif);font-size:16.5px;font-weight:600;display:flex;align-items:center;gap:8px;line-height:1.35}
.dd-cast-role{font-size:11.5px;color:var(--ink3);margin-top:3px}
.dd-cast-body{padding:0 15px 14px;display:flex;flex-direction:column;gap:9px}
.dd-cast-body>*{flex:0 0 auto}
.dd-cast-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(232px,1fr));gap:10px 16px}
.dd-cast-fields .dd-ed{--ed-lab:44px}
.dd-refgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:9px}
.dd-refcard{border-radius:var(--rx-2);overflow:hidden;background:var(--panel-2);box-shadow:var(--e-2)}
.dd-refcard .rhead{display:flex;gap:7px;padding:7px 9px;border-bottom:.5px solid var(--line)}
.dd-refcard .rhead .rid{font-family:var(--f-mono);font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-refcard .rbody{padding:8px 9px;font-size:11.5px;color:var(--ink3);line-height:1.65}
.dd-refcard .rbody .rp{font-family:var(--f-mono);font-size:10.5px;color:var(--ink3);word-break:break-word;max-height:110px;overflow:auto;white-space:pre-wrap}

/* ── the wall（监视器墙）────────────────────────────────────────────── */
.dd-wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(208px,1fr));gap:14px}
.dd-wall.dense{grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px}
.dd-monitor{
  position:relative;border-radius:var(--rx-3);overflow:hidden;cursor:pointer;text-align:left;
  background:var(--raised);box-shadow:var(--e-3);
  display:flex;flex-direction:column;
  transition:transform var(--t-mid) var(--ease-out),box-shadow var(--t-mid) var(--ease),outline-color var(--t-mid) var(--ease);
  outline:.5px solid transparent;outline-offset:-.5px;
  animation:dd-rise var(--t-slow) var(--ease-out) both;
}
@keyframes dd-rise{from{opacity:0;transform:translateY(10px)}}
.dd-monitor:hover{
  transform:translateY(-4px);box-shadow:var(--e-4),0 0 0 1px var(--hot-line);
  outline-color:var(--hot-line);z-index:2;
}
.dd-monitor.on{
  outline-color:var(--hot);outline-width:1.5px;
  box-shadow:var(--e-4),0 0 0 3px color-mix(in srgb,var(--hot) 16%,transparent),0 0 30px -6px color-mix(in srgb,var(--hot) 40%,transparent);
  z-index:3;
}
/* 画面：像监视器——内陷的边框 + 一点点暗角 */
.dd-monitor .screen{
  position:relative;aspect-ratio:16/9;overflow:hidden;background:var(--sunken);
  box-shadow:inset 0 0 0 .5px var(--line),inset 0 1px 10px rgba(0,0,0,.28);
}
.dd-monitor .screen img{
  width:100%;height:100%;object-fit:cover;display:block;
  transition:transform var(--t-slow) var(--ease-out);
}
.dd-monitor:hover .screen img{transform:scale(1.035)}
.dd-monitor .veil{
  position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(120% 100% at 50% 40%,transparent 52%,rgba(0,0,0,.22) 100%);
}
/* 排版封面：没有静帧时，一个镜头仍然要说清「它是什么」。 */
.dd-monitor .typo{
  position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;
  padding:10px 12px;
  background:
    repeating-linear-gradient(135deg,transparent 0 8px,var(--line) 8px 9px),
    radial-gradient(120% 120% at 88% 4%,var(--hot-2),transparent 58%),
    var(--sunken);
}
.dd-monitor .typo .big{
  font-family:var(--f-mono);font-size:30px;line-height:1;font-weight:600;
  color:color-mix(in srgb,var(--ink) 42%,transparent);letter-spacing:-.04em;
}
.dd-monitor .typo .cam{
  font-family:var(--f-gauge);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);
}
.dd-monitor .topline{
  position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:7px;padding:8px 9px;
  font-size:10.5px;pointer-events:none;
}
.dd-monitor .topline .sid{
  font-family:var(--f-mono);letter-spacing:.02em;color:var(--ink);
  padding:2px 7px;border-radius:var(--rx-1);
  background:color-mix(in srgb,var(--bg) 86%,transparent);
  box-shadow:inset 0 0 0 .5px var(--line-2),0 1px 4px rgba(0,0,0,.3);
}
.dd-monitor .topline .pill{
  margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-size:9.5px;
  letter-spacing:.04em;padding:2px 8px;border-radius:999px;
  background:color-mix(in srgb,var(--bg) 86%,transparent);
  box-shadow:inset 0 0 0 .5px currentColor;
}
.dd-monitor .pill.none{color:var(--sig-none)}
.dd-monitor .pill.generated{color:var(--sig-fly)}
.dd-monitor .pill.warn{color:var(--sig-warn)}
.dd-monitor .pill.fail{color:var(--sig-fail)}
.dd-monitor .pill.pass{color:var(--sig-pass)}
.dd-monitor .topline .pill i{width:5px;height:5px;border-radius:50%;background:currentColor;flex:none}
.dd-monitor .marks{position:absolute;left:9px;bottom:9px;display:flex;gap:4px;pointer-events:none}
.dd-monitor .mark{
  font-size:9px;padding:1px 6px;border-radius:var(--rx-1);
  background:color-mix(in srgb,var(--bg) 86%,transparent);box-shadow:inset 0 0 0 .5px var(--line-2);
  color:var(--ink2);
}
.dd-monitor .mark.beat{color:var(--sig-fail);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-fail) 52%,transparent)}
.dd-monitor .mark.notes{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-monitor .mark.prompt{color:var(--sig-warn);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-warn) 52%,transparent)}
.dd-monitor .cap{padding:11px 12px 12px;display:flex;flex-direction:column;gap:5px}
.dd-monitor .cap .t{
  font-family:var(--serif);font-size:14.5px;font-weight:600;line-height:1.35;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.dd-monitor .cap .s{
  font-size:12px;color:var(--ink2);line-height:1.6;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:38px;
}
.dd-monitor .cap .m{
  display:flex;gap:10px;font-family:var(--f-mono);font-size:10.5px;color:var(--ink3);
  letter-spacing:-.02em;padding-top:3px;
}
.dd-monitor .cap .m b{color:var(--ink2);font-weight:500}

/* ── scene plate（一场的门牌）────────────────────────────────────────── */
.dd-sceneplate{
  display:flex;align-items:flex-start;gap:15px;margin-bottom:16px;padding:15px 17px;
  border-radius:var(--rx-3);background:var(--raised);box-shadow:var(--e-3);
  position:relative;overflow:hidden;flex-wrap:wrap;
}
.dd-sceneplate::before{
  content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
  background:linear-gradient(180deg,var(--hot),color-mix(in srgb,var(--hot) 18%,transparent));
}
.dd-sceneplate .sp-id{
  font-family:var(--f-mono);font-size:11px;color:var(--hot);letter-spacing:.06em;
  padding-top:5px;flex:none;
}
.dd-sceneplate .sp-main{flex:1 1 260px;min-width:0}
.dd-sceneplate .sp-title{font-family:var(--serif);font-size:19px;font-weight:600;line-height:1.35}
.dd-sceneplate .sp-sum{font-size:12.5px;color:var(--ink2);line-height:1.7;margin-top:5px;max-width:780px}
.dd-sceneplate .sp-meta{display:flex;align-items:center;gap:10px;flex:none;padding-top:4px;margin-left:auto}
.dd-sceneplate .sp-meta .num{font-size:11px;color:var(--ink3)}

/* ── inspector ───────────────────────────────────────────────────────── */
.dd-inspector{
  width:clamp(300px,32%,480px);flex:0 0 auto;box-shadow:-1px 0 0 var(--line);
  background:linear-gradient(180deg,var(--panel),var(--bg));
  display:flex;flex-direction:column;min-height:0;
}
.dd-inspector-head{
  padding:12px 16px;box-shadow:0 1px 0 var(--line);display:flex;align-items:center;gap:10px;flex:none;
}
.dd-inspector-head .id{font-family:var(--f-mono);font-size:12.5px;font-weight:600;letter-spacing:.02em}
.dd-inspector-head .ttl{
  font-family:var(--serif);font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;
}
.dd-inspector-body{overflow:auto;padding:14px 16px 34px;display:flex;flex-direction:column;gap:12px}
.dd-inspector-body>*{flex:0 0 auto}

/* 场次概览（没有选中镜头时的默认内容——不给「点一镜」这种说明书） */
.dd-sheet{border-radius:var(--rx-3);background:var(--raised);box-shadow:var(--e-3);overflow:hidden}
.dd-sheet-head{padding:14px 15px 13px;box-shadow:0 1px 0 var(--line)}
.dd-sheet-head .sid{font-family:var(--f-mono);font-size:10.5px;color:var(--hot);letter-spacing:.06em}
.dd-sheet-head .ttl{font-family:var(--serif);font-size:17px;font-weight:600;margin-top:4px;line-height:1.35}
.dd-sheet-head .sum{font-size:12.5px;color:var(--ink2);line-height:1.7;margin-top:7px}
.dd-sheet-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(74px,1fr));gap:1px;background:var(--line)}
.dd-sheet-stat{background:var(--raised);padding:10px 12px}
.dd-sheet-stat .v{font-family:var(--f-mono);font-size:17px;font-weight:600;letter-spacing:-.04em;color:var(--ink);line-height:1.1}
.dd-sheet-stat .k{font-family:var(--f-gauge);font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);margin-top:4px}
.dd-sheet-list{display:flex;flex-direction:column}
.dd-sheet-row{
  display:grid;grid-template-columns:auto 1fr auto;gap:11px;align-items:center;
  padding:9px 14px;box-shadow:0 1px 0 var(--line);cursor:pointer;
  transition:background var(--t-fast) var(--ease);
}
.dd-sheet-row:hover{background:var(--panel-2)}
.dd-sheet-row.on{background:var(--hot-2)}
.dd-sheet-row .id{font-family:var(--f-mono);font-size:10.5px;color:var(--ink3)}
.dd-sheet-row .nm{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-sheet-row .st{width:7px;height:7px;border-radius:50%;flex:none}
.dd-sheet-row .st.fail{background:var(--sig-fail)}
.dd-sheet-row .st.warn{background:var(--sig-warn)}
.dd-sheet-row .st.pass{background:var(--sig-pass)}
.dd-sheet-row .st.none{background:var(--sig-none)}
.dd-sheet-row .st.generated{background:var(--sig-fly)}

/* ── sections ────────────────────────────────────────────────────────── */
.dd-sec{border-radius:var(--rx-3);background:var(--raised);overflow:hidden;box-shadow:var(--e-3)}
.dd-sec-head{
  display:flex;align-items:center;gap:9px;padding:10px 13px;cursor:pointer;user-select:none;
  box-shadow:0 1px 0 var(--line);
  transition:background var(--t-fast) var(--ease);
}
.dd-sec-head:hover{background:var(--panel-2)}
.dd-sec-head .t{font-size:12.5px;font-weight:600;letter-spacing:.01em}
.dd-sec-head .sp{flex:1}
.dd-sec-head .chev{
  color:var(--ink3);display:grid;place-items:center;
  transition:transform var(--t-mid) var(--ease);
}
.dd-tag{
  font-family:var(--f-gauge);font-size:9px;letter-spacing:.12em;text-transform:uppercase;
  padding:2px 8px;border-radius:999px;color:var(--ink3);box-shadow:inset 0 0 0 .5px var(--line-2);
}
.dd-tag.src{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-tag.out{color:var(--sig-pass);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-pass) 42%,transparent)}
.dd-sec-body{padding:12px 13px;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 0 var(--line)}
.dd-sec-body>*{flex:0 0 auto}

.dd-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dd-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.dd-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.dd-field.wide{grid-column:1 / -1}
.dd-field label{
  font-family:var(--f-gauge);font-size:10px;color:var(--ink3);letter-spacing:.1em;text-transform:uppercase;
  line-height:1.4;
}
.dd-field input,.dd-field select,.dd-field textarea{
  height:31px;padding:0 11px;border-radius:var(--rx-2);background:var(--sunken);
  border:none;box-shadow:var(--e-well);color:var(--ink);font-size:12.5px;outline:none;width:100%;
  transition:box-shadow var(--t-fast) var(--ease);
}
.dd-field textarea{height:auto;min-height:64px;padding:9px 11px;resize:vertical;line-height:1.7}
.dd-field input:focus,.dd-field select:focus,.dd-field textarea:focus{box-shadow:var(--e-well),0 0 0 1.5px var(--hot)}
.dd-field select option{background:var(--raised);color:var(--ink)}
.dd-field .preset{display:flex;gap:5px;flex-wrap:wrap}
.dd-field .preset button{
  height:26px;padding:0 9px;border-radius:var(--rx-1);background:var(--panel-2);box-shadow:inset 0 0 0 .5px var(--line);
  font-size:11px;color:var(--ink3);font-family:var(--f-mono);
  transition:color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-field .preset button:hover{color:var(--ink);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-field .preset button.on{background:var(--hot);box-shadow:none;color:#fff}

/* ── inline editing（读态是内容，不是表单）──────────────────────────────── */
/* 读态：**没有** sunken 盒子、**没有**描边、**没有**「保存 / 撤销」按钮行。
   只有悬停时浮现的一条虚线——那是「这里可以改」的暗示。
   编辑态把同一块地方换成输入框（位置不变、行高不变），**失焦即存**：
   Enter 提交（多行是 Ctrl+Enter），Esc 撤销。
   右上角那两枚小图标只是保险——点了也能存 / 能撤，但不必点。 */
.dd-ed{display:flex;flex-direction:column;gap:2px;min-width:0;position:relative}
.dd-ed.row{display:grid;grid-template-columns:var(--ed-lab,116px) minmax(0,1fr);gap:14px;align-items:baseline}
.dd-ed-lab{
  font-family:var(--f-gauge);font-size:10px;color:var(--ink3);
  letter-spacing:.1em;text-transform:uppercase;line-height:1.5;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.dd-ed-val{
  font-size:12.5px;line-height:1.65;color:var(--ink);
  padding:2px 6px 3px;margin-left:-6px;
  min-height:21px;border-radius:var(--rx-1);
  border-bottom:.5px dashed transparent;cursor:text;
  white-space:pre-wrap;word-break:break-word;
  transition:border-color var(--t-fast) var(--ease),color var(--t-fast) var(--ease),background var(--t-fast) var(--ease);
}
/* 悬停时**看得见**「这里可以改」：一条暖色的虚线 + 一点点底色。
   以前只有 0.5px 的灰虚线，缩到 1200 宽就彻底看不见了——
   于是用户只能挨个点过去试。 */
.dd-ed-val:hover{border-bottom-color:var(--hot-line);background:color-mix(in srgb,var(--hot) 7%,transparent)}
.dd-ed-val.empty{color:var(--ink4)}
.dd-ed.readonly .dd-ed-val{cursor:default}
.dd-ed.readonly .dd-ed-val:hover{border-bottom-color:transparent;background:transparent}
.dd-ed.serif .dd-ed-val{font-family:var(--serif);font-size:15px;line-height:1.5}
.dd-ed.mono .dd-ed-val{font-family:var(--f-mono);font-size:11.5px}
.dd-ed-edit{position:relative;display:block}
.dd-ed-edit input,.dd-ed-edit textarea{
  display:block;width:100%;background:var(--sunken);border:none;
  box-shadow:var(--e-well);border-radius:var(--rx-2);color:var(--ink);
  font-family:inherit;font-size:12.5px;line-height:1.65;padding:6px 10px;outline:none;
  transition:box-shadow var(--t-fast) var(--ease);
}
.dd-ed-edit input{height:30px;padding-top:0;padding-bottom:0}
.dd-ed-edit textarea{min-height:66px;resize:vertical}
.dd-ed-edit.serif input,.dd-ed-edit.serif textarea{font-family:var(--serif);font-size:15px;line-height:1.5}
.dd-ed-edit.mono input,.dd-ed-edit.mono textarea{font-family:var(--f-mono);font-size:11.5px}
.dd-ed-edit input:focus,.dd-ed-edit textarea:focus{box-shadow:var(--e-well),0 0 0 1.5px var(--hot)}
.dd-ed-edit.acting input,.dd-ed-edit.acting textarea{padding-right:48px}
.dd-ed-acts{position:absolute;top:4px;right:5px;display:flex;gap:3px}
.dd-ed-act{
  width:20px;height:20px;border-radius:var(--rx-1);display:grid;place-items:center;
  color:var(--ink4);box-shadow:inset 0 0 0 .5px var(--line);
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-ed-act:hover{color:var(--ink);background:var(--panel-2)}
.dd-ed-act.ok:hover{color:var(--sig-pass);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-pass) 45%,transparent)}
.dd-ed-act.no:hover{color:var(--sig-fail);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-fail) 45%,transparent)}

.dd-beats{display:flex;flex-direction:column;gap:8px}
.dd-beats>*{flex:0 0 auto}
.dd-beat{border-radius:var(--rx-2);background:var(--panel-2);overflow:hidden;box-shadow:var(--e-2)}
.dd-beat-head{display:flex;align-items:center;gap:9px;padding:7px 11px;font-size:11px;color:var(--ink3);box-shadow:0 1px 0 var(--line)}
.dd-beat-head .n{font-family:var(--f-mono);color:var(--ink2)}
.dd-beat-head .who{color:var(--hot);font-size:11.5px}
.dd-beat-head .sp{font-family:var(--f-mono);font-size:10px;color:var(--sig-pass)}
.dd-beat.outside{opacity:.6}
.dd-beat-body{padding:9px 11px 11px;display:flex;flex-direction:column;gap:9px}
.dd-beat-body>*{flex:0 0 auto}
.dd-beat-body .lab{font-family:var(--f-gauge);font-size:9px;color:var(--ink3);letter-spacing:.14em;text-transform:uppercase}
/* 这一拍是：**三个选项**，不是三个长句子。之前这一段没有样式，
   三个按钮挤成一行「无台词动画内音（要口型）画外音」，看不出哪个是哪个。 */
.dd-beat-kind{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.dd-beat-kind .preset{display:flex;gap:5px;flex-wrap:wrap}
.dd-beat-kind .preset button{
  height:24px;padding:0 10px;border-radius:var(--rx-1);background:var(--raised);
  box-shadow:inset 0 0 0 .5px var(--line);font-size:11px;color:var(--ink3);white-space:nowrap;
  transition:color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease),background var(--t-fast) var(--ease);
}
.dd-beat-kind .preset button:hover{color:var(--ink);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-beat-kind .preset button.on{background:var(--hot);box-shadow:none;color:#fff}
.dd-beat-acts{display:flex;gap:2px;align-items:center}

.dd-metric{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:baseline;font-size:12px;padding:2px 0}
.dd-metric .n{color:var(--ink2)}
.dd-metric .v{font-family:var(--f-mono);font-size:13px;font-variant-numeric:tabular-nums;letter-spacing:-.03em}
.dd-metric .th{font-family:var(--f-mono);font-size:10.5px;color:var(--ink3)}
.dd-issue{font-size:12px;color:var(--sig-fail);display:flex;gap:7px;line-height:1.6}
.dd-issue.warn{color:var(--sig-warn)}
.dd-issue.info{color:var(--ink2)}

.dd-prompt{
  font-family:var(--f-mono);font-size:11.5px;white-space:pre-wrap;word-break:break-word;
  background:var(--sunken);border-radius:var(--rx-2);box-shadow:var(--e-well);padding:12px;
  max-height:320px;overflow:auto;color:var(--ink2);line-height:1.75;
}
/* 点一下就能改：产物是**可改的文本**，不是一张只读截图。 */
.dd-prompt.editable{cursor:text;transition:box-shadow var(--t-fast) var(--ease)}
.dd-prompt.editable:hover{box-shadow:var(--e-well),0 0 0 1px var(--hot-line)}
.dd-prompt-sec+.dd-prompt-sec{margin-top:10px;padding-top:10px;box-shadow:0 -1px 0 var(--line)}
.dd-prompt-sec h5{margin:0 0 5px;font-family:var(--f-gauge);font-size:9.5px;color:var(--hot);letter-spacing:.16em;text-transform:uppercase}
.dd-prompt-edit{
  width:100%;min-height:260px;background:var(--sunken);border-radius:var(--rx-2);box-shadow:var(--e-well);
  padding:12px;font-family:var(--f-mono);font-size:11.5px;line-height:1.75;color:var(--ink);resize:vertical;outline:none;
}
.dd-prompt-edit:focus{box-shadow:var(--e-well),0 0 0 1.5px var(--hot)}
/* 就地编辑提示词：输入框原地接管，右上角两枚小图标是「保险」。 */
.dd-prompt-edit-wrap{position:relative;display:block}
.dd-prompt-edit-wrap .dd-prompt-edit{padding-right:44px}
.dd-prompt-acts{position:absolute;top:8px;right:8px;display:flex;gap:3px}

.dd-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.dd-thumb-wrap{position:relative}
.dd-thumb{
  border-radius:var(--rx-2);overflow:hidden;background:var(--panel-2);box-shadow:var(--e-2);
  cursor:pointer;
  transition:transform var(--t-slow) var(--ease-out),box-shadow var(--t-mid) var(--ease);
}
.dd-thumb:hover{transform:translateY(-3px) rotate(-.5deg);box-shadow:var(--e-4);z-index:2}
/* 关键：图片动画里**不能有 filter**。Chromium 在「overflow:hidden 的祖先 +
   自身带 filter 的 img」上会丢掉图片的内容层——DOM 在、几何对、就是不画。
   淡入只用 opacity。 */
.dd-thumb img{display:block;width:100%;height:88px;object-fit:cover;animation:dd-fadein var(--t-slow) var(--ease) both}
@keyframes dd-fadein{from{opacity:0}to{opacity:1}}
.dd-thumb .cap{font-size:10px;padding:6px 8px;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-thumb.dep{box-shadow:var(--e-2),inset 0 0 0 1px color-mix(in srgb,var(--sig-warn) 55%,transparent)}
.dd-thumb .dep-mark{
  position:absolute;top:6px;left:6px;background:var(--sig-warn);color:#161006;
  font-size:9.5px;padding:1px 6px;border-radius:999px;font-weight:600;z-index:2;
}
.dd-thumb.missing{opacity:.4;cursor:not-allowed}
.dd-thumb .ph{
  height:88px;display:grid;place-items:center;font-size:10.5px;color:var(--ink3);
  background:repeating-linear-gradient(135deg,transparent 0 6px,var(--line) 6px 7px);
}
.dd-video{width:100%;border-radius:var(--rx-2);background:#000;box-shadow:var(--e-3);display:block}

.dd-rule{border-radius:var(--rx-2);overflow:hidden;background:var(--panel-2);box-shadow:var(--e-2)}
.dd-rule.on{box-shadow:var(--e-2),inset 0 0 0 1px var(--hot-line)}
.dd-rule-head{display:flex;align-items:center;gap:10px;padding:9px 11px;cursor:pointer;user-select:none;font-size:12.5px}
.dd-rule-head .rid{font-family:var(--f-mono);font-size:11.5px;color:var(--hot);min-width:34px}
.dd-rule.on .rid{font-weight:700}
.dd-rule-head .st{margin-left:auto;font-size:10.5px;color:var(--ink3);font-family:var(--f-mono);white-space:nowrap}
.dd-rule-body{padding:10px 12px;font-size:12px;color:var(--ink2);white-space:pre-wrap;line-height:1.75;background:var(--sunken)}
.dd-rule-body .ev{color:var(--ink)}

/* ── tables ──────────────────────────────────────────────────────────── */
.dd-table{width:100%;border-collapse:collapse;font-size:12px}
.dd-table th{
  text-align:left;font-weight:500;color:var(--ink3);padding:9px 12px;
  box-shadow:0 1px 0 var(--line-2);position:sticky;top:0;background:var(--panel-2);z-index:1;
  font-family:var(--f-gauge);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;
}
.dd-table td{padding:8px 12px;box-shadow:0 1px 0 var(--line);vertical-align:middle}
.dd-table tbody tr{transition:background var(--t-fast) var(--ease)}
.dd-table tbody tr:hover{background:var(--panel-2)}
.dd-table td.n{font-family:var(--f-mono);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap;font-size:12px;letter-spacing:-.03em}
.dd-table td.path{color:var(--ink3);font-size:11px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-table tr.on{background:var(--hot-2)}
.dd-badge{
  display:inline-flex;align-items:center;gap:5px;font-family:var(--f-gauge);font-size:9.5px;
  letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border-radius:999px;
  box-shadow:inset 0 0 0 .5px currentColor;color:var(--ink3);
}
.dd-badge.fail{color:var(--sig-fail)}
.dd-badge.warn{color:var(--sig-warn)}
.dd-badge.pass{color:var(--sig-pass)}
.dd-badge.generated{color:var(--sig-fly)}
.dd-badge.none{color:var(--sig-none)}

/* ── doc view ────────────────────────────────────────────────────────── */
.dd-doc{font-size:13.5px;line-height:1.85;color:var(--ink2);max-width:940px}
/* 简报也是**可改的文本**：点一下就地编辑，失焦即存。 */
.dd-doc.editable{cursor:text;border-radius:var(--rx-2);transition:box-shadow var(--t-fast) var(--ease)}
.dd-doc.editable:hover{box-shadow:0 0 0 1px var(--hot-line)}
.dd-doc h4{
  margin:22px 0 8px;color:var(--ink);font-family:var(--f-display);font-weight:600;
  font-size:18px;letter-spacing:-.01em;
}
.dd-doc h5{margin:14px 0 5px;color:var(--ink);font-size:13.5px;font-weight:600}
.dd-doc ul{margin:7px 0;padding-left:20px}
.dd-doc li{margin:3px 0}
.dd-doc code{font-family:var(--f-mono);font-size:11.5px;background:var(--panel-2);padding:2px 6px;border-radius:var(--rx-1)}
.dd-doc p{margin:7px 0}
.dd-rule-list{border-radius:var(--rx-3);overflow:hidden;background:var(--raised);box-shadow:var(--e-3)}
.dd-rule-row{
  display:grid;grid-template-columns:48px 1fr auto;gap:14px;align-items:start;
  padding:12px 15px;box-shadow:0 1px 0 var(--line);cursor:pointer;
  transition:background var(--t-fast) var(--ease);
}
.dd-rule-row:hover{background:var(--panel-2)}
.dd-rule-row .rid{font-family:var(--f-mono);font-size:12px;color:var(--hot);font-weight:600}
.dd-rule-row .ti{font-size:13px}
.dd-rule-row .st{font-size:11px;color:var(--ink3);text-align:right;white-space:nowrap}

/* ── drawer ──────────────────────────────────────────────────────────── */
.dd-drawer{
  position:absolute;top:0;right:0;bottom:0;width:min(460px,90%);z-index:20;
  background:var(--raised);
  box-shadow:-1px 0 0 var(--line-2),-30px 0 70px -20px rgba(0,0,0,.55);
  display:flex;flex-direction:column;animation:dd-dock-in var(--t-slow) var(--ease-out) both;
}
@keyframes dd-dock-in{from{opacity:0;transform:translateX(24px)}}
.dd-drawer-head{display:flex;align-items:center;gap:10px;padding:14px 16px;box-shadow:0 1px 0 var(--line);flex:none}
.dd-drawer-body{overflow:auto;padding:16px;display:flex;flex-direction:column;gap:20px}
.dd-drawer-body>*{flex:0 0 auto}
.dd-drawer h4{
  margin:0;font-family:var(--f-gauge);font-size:9.5px;font-weight:500;letter-spacing:.18em;
  color:var(--ink3);text-transform:uppercase;
}
.dd-note{font-size:11.5px;color:var(--ink3);line-height:1.7}
.dd-warnbox{
  background:color-mix(in srgb,var(--sig-warn) 10%,transparent);
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-warn) 40%,transparent);
  color:var(--sig-warn);border-radius:var(--rx-2);padding:10px 12px;font-size:12px;line-height:1.7;
}
.dd-errorbox{
  background:color-mix(in srgb,var(--sig-fail) 10%,transparent);
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-fail) 40%,transparent);
  color:var(--sig-fail);border-radius:var(--rx-2);padding:10px 12px;font-size:12px;line-height:1.7;
}
.dd-okbox{
  background:color-mix(in srgb,var(--sig-pass) 10%,transparent);
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-pass) 40%,transparent);
  color:var(--sig-pass);border-radius:var(--rx-2);padding:10px 12px;font-size:12px;line-height:1.7;
}
.dd-kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:12px;align-items:baseline}
.dd-kv .k{color:var(--ink3);white-space:nowrap}
.dd-kv .v{font-family:var(--f-mono);font-size:11px;word-break:break-all}
/* 拖动把手：抽屉宽度可调。宽度记在 localStorage 里，下次还在。 */
.dd-resize{position:absolute;left:-3px;top:0;bottom:0;width:7px;cursor:col-resize;z-index:21}
.dd-resize::after{
  content:'';position:absolute;left:3px;top:50%;transform:translateY(-50%);width:1px;height:44px;
  background:var(--line-2);border-radius:1px;transition:background var(--t-fast) var(--ease),height var(--t-fast) var(--ease);
}
.dd-resize:hover::after,.dd-resize.active::after{background:var(--hot);height:84px}
.dd-pathrow{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center}

/* ── modal ───────────────────────────────────────────────────────────── */
.dd-modal-backdrop{
  position:fixed;inset:0;z-index:2147483000;
  background:color-mix(in srgb,var(--bg) 38%,rgba(0,0,0,.88));
  display:grid;place-items:center;padding:28px;animation:dd-fade var(--t-mid) var(--ease) both;
}
@keyframes dd-fade{from{opacity:0}}
.dd-modal{
  position:relative;display:flex;flex-direction:column;max-width:min(1180px,94vw);max-height:88vh;
  background:var(--raised);border-radius:var(--rx-4);box-shadow:var(--e-pop);overflow:hidden;
  animation:dd-rise var(--t-mid) var(--spring) both;
}
.dd-modal-head{display:flex;align-items:center;gap:10px;padding:10px 13px;box-shadow:0 1px 0 var(--line);flex:none}
.dd-modal-stage{
  flex:1 1 auto;min-height:120px;overflow:hidden;position:relative;cursor:grab;
  display:flex;align-items:center;justify-content:center;background:var(--sunken);
}
.dd-modal-stage.drag{cursor:grabbing}
.dd-modal-stage img{max-width:100%;max-height:100%;object-fit:contain;display:block;user-select:none}
.dd-modal-foot{
  padding:10px 13px;box-shadow:0 -1px 0 var(--line);font-size:11.5px;color:var(--ink3);
  display:flex;gap:14px;align-items:center;flex-wrap:wrap;max-height:120px;overflow:auto;flex:none;
}
.dd-modal-foot .mf{white-space:nowrap}
.dd-modal-foot .mf b{color:var(--ink);font-weight:500;font-family:var(--f-mono)}
.dd-modal-prompt{
  font-family:var(--f-mono);font-size:11px;color:var(--ink3);white-space:pre-wrap;word-break:break-word;
  width:100%;line-height:1.65;max-height:190px;overflow:auto;
}

/* ── folder browser ──────────────────────────────────────────────────── */
.dd-browser{border-radius:var(--rx-2);overflow:hidden;background:var(--sunken);box-shadow:var(--e-2)}
.dd-browser-path{padding:7px 10px;box-shadow:0 1px 0 var(--line);font-family:var(--f-mono);font-size:11px;color:var(--ink3);word-break:break-all}
.dd-browser-list{max-height:230px;overflow:auto}
.dd-browser-item{padding:6px 11px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:8px}
.dd-browser-item:hover{background:var(--hover)}
.dd-browser-item .bi-n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── empty / toast ───────────────────────────────────────────────────── */
.dd-empty{padding:64px 20px;text-align:center;color:var(--ink3);font-size:13px;line-height:1.8}
.dd-empty-title{font-family:var(--f-display);font-size:17px;color:var(--ink2);margin-bottom:6px;font-weight:600}
/* 切阶段时的那一帧。安静、居中、有呼吸感——不要在这一帧里
   冒出任何内部状态名（阶段 id、载荷状态）。 */
.dd-stagewait{
  margin:auto;display:flex;flex-direction:column;align-items:center;gap:12px;
  padding:60px 20px;color:var(--ink3);
}
.dd-stagewait-mark{
  width:44px;height:44px;border-radius:var(--rx-3);display:grid;place-items:center;
  background:var(--raised);box-shadow:var(--e-3);color:var(--ink3);
  animation:dd-breathe 1.6s var(--ease) infinite;
}
@keyframes dd-breathe{50%{opacity:.45}}
.dd-stagewait-title{font-size:13.5px;color:var(--ink2);letter-spacing:.02em}
.dd-stagewait-bar{
  width:180px;height:2px;border-radius:2px;overflow:hidden;background:var(--sunken);
  box-shadow:inset 0 0 0 .5px var(--line);
}
.dd-stagewait-bar span{
  display:block;width:40%;height:100%;border-radius:2px;background:var(--hot);
  animation:dd-scan 1.3s var(--ease) infinite;
}
@keyframes dd-scan{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
.dd-stagewait-actions{display:flex;gap:7px;margin-top:2px}
.dd-toast{
  position:absolute;left:50%;bottom:24px;transform:translateX(-50%);z-index:25;
  background:var(--raised);border-radius:var(--rx-2);padding:10px 16px;font-size:12.5px;color:var(--ink);
  box-shadow:var(--e-pop);animation:dd-toast var(--t-mid) var(--ease-out) both;max-width:82%;
}
@keyframes dd-toast{from{opacity:0;transform:translate(-50%,14px) scale(.96)}}
.dd-toast.err{box-shadow:var(--e-pop),inset 0 0 0 1px var(--sig-fail);color:var(--sig-fail)}
.dd-toast.ok{box-shadow:var(--e-pop),inset 0 0 0 1px var(--sig-pass);color:var(--sig-pass)}

/* ── home ────────────────────────────────────────────────────────────── */
.dd-home{padding:28px 24px 44px;max-width:1320px;margin:0 auto}
.dd-home-hero{
  display:flex;align-items:flex-start;gap:22px;flex-wrap:wrap;
  padding:26px 26px;border-radius:var(--rx-4);background:var(--raised);box-shadow:var(--e-3);
  position:relative;overflow:hidden;
}
.dd-home-hero::before{
  content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(110% 130% at 100% 0%,var(--hot-2),transparent 58%);
}
.dd-home-hero .h1{
  font-family:var(--f-display);font-size:27px;font-weight:600;letter-spacing:.01em;line-height:1.25;
  position:relative;
}
.dd-home-hero .h2{font-size:13.5px;color:var(--ink2);line-height:1.8;margin-top:9px;max-width:660px;position:relative}
.dd-home-hero .h3{font-size:12.5px;color:var(--ink3);line-height:1.75;margin-top:7px;max-width:620px;position:relative}
.dd-home-sec{margin-top:24px}
.dd-home-sec h4{
  margin:0 0 11px;font-family:var(--f-gauge);font-size:9.5px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--ink3);font-weight:500;
}
.dd-works{display:grid;grid-template-columns:repeat(auto-fill,minmax(262px,1fr));gap:13px}
.dd-work-card{
  position:relative;text-align:left;padding:14px 16px;border-radius:var(--rx-3);
  background:var(--raised);box-shadow:var(--e-3);cursor:pointer;
  transition:transform var(--t-mid) var(--ease-out),box-shadow var(--t-mid) var(--ease);
}
.dd-work-card:hover{transform:translateY(-3px);box-shadow:var(--e-4),0 0 0 1px var(--hot-line)}
.dd-work-card.on{box-shadow:var(--e-4),0 0 0 1.5px var(--hot)}
.dd-work-card .wt{font-family:var(--serif);font-size:15.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-work-card .wi{font-family:var(--f-mono);font-size:10.5px;color:var(--ink3);margin-top:4px}
.dd-work-card .wm{display:flex;gap:10px;margin-top:10px;font-size:11px;color:var(--ink3);font-family:var(--f-mono)}
.dd-work-card.new{
  display:flex;align-items:center;justify-content:center;gap:8px;min-height:100px;
  background:transparent;box-shadow:inset 0 0 0 1px var(--line-2);color:var(--ink3);
}
.dd-work-card.new:hover{color:var(--hot);box-shadow:inset 0 0 0 1px var(--hot-line)}

/* ── conceive chat ───────────────────────────────────────────────────── */
.dd-chat{
  width:clamp(340px,32%,460px);flex:0 0 auto;box-shadow:-1px 0 0 var(--line);
  background:linear-gradient(180deg,var(--panel),var(--bg));
  display:flex;flex-direction:column;min-height:0;
}
.dd-chat-head{display:flex;align-items:center;gap:9px;padding:11px 14px;box-shadow:0 1px 0 var(--line);flex:none}
.dd-chat-head .ch-t{font-size:12.5px;font-weight:600}
.dd-chat-head .ch-sub{font-size:10.5px;color:var(--ink3);font-family:var(--f-mono)}
.dd-chat-flow{flex:1 1 auto;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px;min-height:0}
.dd-chat-flow>*{flex:0 0 auto}
.dd-msg{display:flex;flex-direction:column;gap:5px;max-width:100%}
.dd-msg .who{font-family:var(--f-gauge);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3)}
.dd-msg .body{
  font-size:13px;line-height:1.78;white-space:pre-wrap;word-break:break-word;
  padding:10px 13px;border-radius:var(--rx-3);background:var(--raised);box-shadow:var(--e-2);color:var(--ink);
}
.dd-msg.user{align-items:flex-end}
.dd-msg.user .body{background:linear-gradient(180deg,color-mix(in srgb,var(--hot) 16%,var(--raised)),var(--raised));box-shadow:var(--e-2),inset 0 0 0 1px var(--hot-line)}
.dd-msg.tool .body{
  font-family:var(--f-mono);font-size:11px;color:var(--ink3);background:transparent;
  box-shadow:inset 0 0 0 .5px var(--line-2);padding:6px 10px;
}
.dd-msg.err .body{box-shadow:var(--e-2),inset 0 0 0 1px color-mix(in srgb,var(--sig-fail) 55%,transparent);color:var(--sig-fail)}
.dd-chat-empty{margin:auto;text-align:center;color:var(--ink3);font-size:12.5px;line-height:1.85;padding:20px 14px;max-width:300px}
.dd-chat-composer{flex:none;box-shadow:0 -1px 0 var(--line);padding:11px 12px 12px;display:flex;flex-direction:column;gap:8px}
.dd-chat-composer textarea{
  width:100%;min-height:64px;max-height:170px;resize:vertical;padding:10px 12px;
  border-radius:var(--rx-3);background:var(--sunken);border:none;box-shadow:var(--e-well);color:var(--ink);
  font-size:13px;line-height:1.7;outline:none;
}
.dd-chat-composer textarea:focus{box-shadow:var(--e-well),0 0 0 1.5px var(--hot)}
.dd-chat-composer .row{display:flex;gap:7px;align-items:center}
.dd-chat-composer .hint{font-size:10.5px;color:var(--ink3);line-height:1.5}

/* ── responsive ──────────────────────────────────────────────────────── */
@container dd-root (max-width: 1240px){
  .dd-home{padding:20px 18px 32px}
  .dd-home-hero{padding:18px 20px;gap:16px}
  .dd-home-hero .h1{font-size:22px}
  .dd-works{grid-template-columns:repeat(auto-fill,minmax(214px,1fr))}
  .dd-chat{width:clamp(320px,38%,420px)}
  /* 窄台面时台头折成两行：上是「这是什么阶段」，下边是「此刻能做什么」。 */
  .dd-deck{flex-direction:column;align-items:stretch;gap:11px}
  .dd-deck-tools{justify-content:flex-start}
  .dd-deck-id .sd3{display:none}
  /* 产物路径与磁盘余量是次要信息（设置里都有）：窄台面时先让位，
     把宽度留给作品名与灯条——那两样是导演真正在看的。 */
  .dd-readout-path,.dd-readout-disk{display:none}
}
@container dd-root (max-width: 940px){
  .dd-inspector{width:clamp(300px,34%,420px)}
  .dd-outline-row{grid-template-columns:96px minmax(0,1fr)}
  .dd-outline-meta{grid-column:1 / -1;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px 16px;align-items:start}
  .dd-outline-foot{grid-column:1 / -1}
  .dd-wall{grid-template-columns:repeat(auto-fill,minmax(196px,1fr))}
}
@container dd-root (max-width: 760px){
  .dd-tally-cell span.lb{display:none}
  .dd-outline-row{grid-template-columns:1fr}
  .dd-outline-body .dd-ed{--ed-lab:108px}
  .dd-outline-meta{grid-template-columns:1fr}
  .dd-wall{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
}
@container dd-root (max-width: 620px){
  .dd-tally{display:none}
  .dd-inspector{width:clamp(300px,58%,400px)}
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

    /**
     * 一格镜头的**信号灯**。
     *
     * 这里其实有两套词，混在一起界面就成了乱的：
     *
     *  · **生产状态**（真源）：pending / submitted / succeeded / failed /
     *    verified / deprecated —— 这一镜到底做出来没有。
     *  · **体检判定**（体检器）：PASS / WARN / FAIL —— 这一镜拍得好不好。
     *
     * 灯的颜色跟**判定**走（导播台的颜色就是判定），生产状态只决定
     * 「还没拍」还是「拍了还没验」。两者分开，格子才不会说谎。
     */
    function shotSignal(shot) {
      const verdict = shot && shot.qc && shot.qc.verdict
        ? String(shot.qc.verdict).toUpperCase()
        : ''
      const status = String((shot && shot.status) || '')
      if (verdict === 'FAIL') return { key: 'fail', label: 'FAIL' }
      if (verdict === 'WARN') return { key: 'warn', label: 'WARN' }
      if (verdict === 'PASS') return { key: 'pass', label: '通过' }
      if (status === 'failed') return { key: 'fail', label: '生成失败' }
      if (status === 'deprecated') return { key: 'none', label: '已作废' }
      if (status === 'submitted') return { key: 'generated', label: '生成中' }
      if (status === 'succeeded' || status === 'verified') return { key: 'generated', label: '未体检' }
      return { key: 'none', label: '未生成' }
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
        // 光圈：六片叶子。这枚印记是工作台的脸——远看就知道是「镜头」。
        aperture: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM14.31 8 20.05 17.94M9.69 8h11.48M7.38 12 13.12 2.06M9.69 16 3.95 6.06M14.31 16H2.83M16.62 12 10.88 21.94',
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

    function MetricRow(props) {
      return h('div', { className: 'dd-metric' },
        h('span', { className: 'n' }, props.name),
        h('span', { className: 'v', style: { color: props.failed ? 'var(--danger)' : 'var(--ink)' } }, props.value),
        h('span', { className: 'th' }, props.threshold),
      )
    }

    /**
     * An inline editable value — 整个工作台改东西只有这一种手势。
     *
     * **读态是内容，不是表单控件。** 没有 sunken 盒子、没有描边、
     * 没有「保存 / 撤销」按钮行——那三样曾经把一屏大纲吃掉一半。
     * 读态只有一条悬停才浮现的虚线，意思是「这里可以改」。
     *
     * **编辑态是同一块地方。** 输入框原地接管（位置不变、行高不变），
     * 所以从读到写没有跳动。
     *
     * **失焦即存。** Enter 提交（多行是 Ctrl+Enter），Esc 撤销。
     * 右上角那两枚小图标只是保险：点了也能存 / 能撤，但不必点。
     *
     * 只读字段（`readOnly`）不假装可编辑：没有虚线、没有手型光标。
     */
    function Editable(props) {
      const {
        label, value, multiline, disabled, onSave, placeholder, type,
        layout, serif, mono, className, style, title, labelTitle, readOnly,
      } = props
      const canEdit = !readOnly && !disabled && typeof onSave === 'function'
      const [editing, setEditing] = useState(false)
      const [draft, setDraft] = useState(value ?? '')
      const nodeRef = useRef(null)
      const editingRef = useRef(false)
      // 服务端最后一次给的值：用来判断「服务器真的变了」，
      // 而不是「我这边重新渲染了」。
      const serverRef = useRef(value ?? '')

      useEffect(() => {
        const incoming = value ?? ''
        if (String(incoming) !== String(serverRef.current)) {
          serverRef.current = incoming
          if (!editingRef.current) setDraft(incoming)
        }
      }, [value])

      useEffect(() => {
        if (!editing || !nodeRef.current) return
        const node = nodeRef.current
        try {
          const end = node.value.length
          node.setSelectionRange(end, end)
        } catch { /* 某些 input 类型不支持选区，忽略 */ }
      }, [editing])

      const current = value === undefined || value === null ? '' : String(value)
      const empty = current === ''
      const begin = () => {
        if (!canEdit || editingRef.current) return
        editingRef.current = true
        setEditing(true)
      }
      const commit = () => {
        if (!editingRef.current) return
        editingRef.current = false
        setEditing(false)
        if (draft !== current) onSave(draft)
      }
      const cancel = () => {
        if (!editingRef.current) return
        editingRef.current = false
        setDraft(current)
        setEditing(false)
      }
      const onKeyDown = event => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          cancel()
        } else if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          commit()
        }
      }

      const cls = 'dd-ed'
        + (layout === 'row' ? ' row' : '')
        + (serif ? ' serif' : '')
        + (mono ? ' mono' : '')
        + (canEdit ? '' : ' readonly')
        + (className ? ' ' + className : '')
      const head = label
        ? h('div', { className: 'dd-ed-lab', title: labelTitle || undefined }, label)
        : null

      if (!editing) {
        return h('div', { className: cls, style },
          head,
          h('div', {
            className: 'dd-ed-val' + (empty ? ' empty' : ''),
            role: canEdit ? 'button' : undefined,
            tabIndex: canEdit ? 0 : undefined,
            title: canEdit ? '点击编辑 · 失焦即存' : (title || undefined),
            onClick: canEdit ? begin : undefined,
            onKeyDown: canEdit
              ? event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  begin()
                }
              }
              : undefined,
          }, empty ? (placeholder ?? '（空）') : current),
        )
      }

      return h('div', { className: cls, style },
        head,
        h('div', {
          className: 'dd-ed-edit acting'
            + (serif ? ' serif' : '')
            + (mono ? ' mono' : ''),
        },
          multiline
            ? h('textarea', {
              ref: nodeRef, value: draft, placeholder, autoFocus: true,
              onChange: event => setDraft(event.target.value),
              onKeyDown, onBlur: commit,
            })
            : h('input', {
              ref: nodeRef, type: type ?? 'text', value: draft, placeholder, autoFocus: true,
              onChange: event => setDraft(event.target.value),
              onKeyDown, onBlur: commit,
            }),
          h('span', { className: 'dd-ed-acts' },
            h('button', {
              className: 'dd-ed-act ok', type: 'button', title: '保存（失焦或 Enter）',
              onMouseDown: event => event.preventDefault(),
              onClick: commit,
            }, h(Icon, { name: 'check', size: 11 })),
            h('button', {
              className: 'dd-ed-act no', type: 'button', title: '撤销（Esc）',
              onMouseDown: event => event.preventDefault(),
              onClick: cancel,
            }, h(Icon, { name: 'close', size: 11 })),
          ),
        ),
      )
    }

    /**
     * A row of preset chips + a free-text escape hatch.
     *
     * 预置只是省事：不满足时仍然可以手填。
     * 手填的那条路**失焦即存**——以前它只在 `custom` 为真时才存，
     * 于是「值不在预置里」的情况改完一松手就没了。
     */
    function PresetField(props) {
      const { label, value, options, onSave, disabled, allowCustom, wide } = props
      const [custom, setCustom] = useState(false)
      const [draft, setDraft] = useState(value ?? '')
      useEffect(() => { setDraft(value ?? '') }, [value])
      const known = options.map(option => String(option))
      const isKnown = known.includes(String(value))
      const showInput = allowCustom && (custom || !isKnown)
      const commitCustom = () => {
        setCustom(false)
        if (draft !== String(value ?? '')) onSave(draft)
      }
      return h('div', { className: 'dd-field' + (wide ? ' wide' : '') },
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
              title: '不满足预置？手填一个',
              onClick: () => setCustom(!custom),
            }, '自定义…')
            : null,
        ),
        showInput
          ? h('input', {
            className: 'num', value: draft, disabled, placeholder: '自定义值',
            onChange: event => setDraft(event.target.value),
            onKeyDown: event => {
              if (event.key === 'Enter') { event.preventDefault(); commitCustom() }
              if (event.key === 'Escape') { event.preventDefault(); setDraft(value ?? ''); setCustom(false) }
            },
            onBlur: commitCustom,
          })
          : null,
      )
    }

    // ── stage rail (console track) ────────────────────────────────────────
    //
    // 点节点 = 切视图。不发请求，不弹确认。
    // 已提交的阶段是实心的；正在预览的阶段是虚线描边。
    //
    // 形态上它是一条**轨道**：九个节点串在一条线上，线被点亮的段落就是进度。
    // 进度是**看得见的一段光**，不是几个颜色不同的小圆点。
    // 左边那格读数告诉你「现在在哪一段」，右边那格告诉你「你只是来看看」。
    function StageRail(props) {
      const { stages, committed, viewing, onPick, busy } = props
      if (!stages || stages.length === 0) return null
      const viewIndex = stages.findIndex(stage => stage.stage === viewing)
      const commitIndex = stages.findIndex(stage => stage.stage === committed)
      // 轨道点亮到「已提交」的那一段；没有已提交阶段时亮到当前查看的那一段。
      const litIndex = commitIndex >= 0 ? commitIndex : Math.max(0, viewIndex)
      const meta = STAGES.find(entry => entry.id === viewing)
      const previewing = Boolean(viewing) && viewing !== committed
      return h('div', { className: 'dd-rail' },
        h('div', { className: 'dd-rail-id' },
          h('div', { className: 'idx' },
            String(viewIndex >= 0 ? viewIndex + 1 : 1).padStart(2, '0'),
            h('em', null, ' / ' + String(stages.length).padStart(2, '0')),
          ),
          h('div', { className: 'en' }, meta ? meta.en : (viewing || '—')),
        ),
        h('div', { className: 'dd-rail-track' },
          h('div', { className: 'dd-nodes' },
            stages.map((stage, index) => {
              const isCommitted = stage.stage === committed
              const isViewing = stage.stage === viewing
              const className = 'dd-node ' + stage.state
                + (isCommitted && stage.state !== 'current' ? ' done' : '')
                + (isViewing && !isCommitted ? ' preview' : '')
              return [
                index > 0
                  ? h('span', { className: 'dd-link' + (index <= litIndex ? ' lit' : ''), key: 'sep' + stage.stage })
                  : null,
                h('button', {
                  key: stage.stage,
                  className: className,
                  disabled: busy,
                  title: (stage.requirement ? stage.requirement + '\n' : '')
                    + (isCommitted ? '当前已提交的阶段' : '点击预览这一阶段（改了东西才会推进进度）'),
                  onClick: () => onPick(stage.stage),
                },
                  h('span', { className: 'dot' }),
                  h('span', { className: 'lb' }, stage.label || stage.stage),
                ),
              ]
            }),
          ),
        ),
        previewing
          ? h('div', { className: 'dd-rail-note' },
            h('span', { className: 'pill' },
              h('span', null, '预览'),
              h('b', null, STAGE_LABEL[viewing] || viewing),
              h('span', { style: { opacity: '.7' } }, '· 进度仍停在 ' + (STAGE_LABEL[committed] || committed || '—')),
            ),
            h('button', {
              className: 'dd-btn sm',
              onClick: () => { if (committed) onPick(committed) },
              title: '回到已提交的阶段',
            }, '回到 ' + (STAGE_LABEL[committed] || committed || '当前')),
          )
          : null,
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

    /**
     * 阶段台头（deck）。
     *
     * 以前这里有一条「标题条」加一条「工具条」，两道横栏把内容压成两指宽。
     * 现在合成**一条**：左边是这一阶段是什么，右边是此刻要用的动作。
     * 中间那句说明只留一行，念完就够。
     */
    function StageHeader(props) {
      const { stage, title, desc, left, right } = props
      const index = STAGES.findIndex(entry => entry.id === stage)
      return h('div', { className: 'dd-deck' },
        h('div', { className: 'dd-deck-id' },
          h('span', { className: 'sn3' },
            String(index >= 0 ? index + 1 : 1).padStart(2, '0') + ' / ' + String(STAGES.length).padStart(2, '0')),
          h('span', { className: 'st3' }, title),
          left ? h('span', { className: 'deck-left' }, left) : null,
          desc ? h('span', { className: 'sd3', title: desc }, desc) : null,
        ),
        right ? h('div', { className: 'dd-deck-tools' }, right) : null,
      )
    }

    /**
     * The creative brief: a document, and the one thing you can rewrite here.
     *
     * 简报也是**可就地编辑的文本**：点那段字，textarea 原地接管，
     * 失焦即存。以前是「编辑简报」按钮 + 整页变 textarea + 「保存简报」按钮。
     */
    function ConceiveView(props) {
      const { data, busy, actions } = props
      const brief = data.brief || {}
      const work = data.work || {}
      const [editing, setEditing] = useState(false)
      const [draft, setDraft] = useState(brief.text || '')
      const editingRef = useRef(false)
      useEffect(() => { if (!editingRef.current) setDraft(brief.text || '') }, [brief.text])
      const begin = () => {
        if (busy || editingRef.current) return
        editingRef.current = true
        setDraft(brief.text || '')
        setEditing(true)
      }
      const commit = () => {
        if (!editingRef.current) return
        editingRef.current = false
        setEditing(false)
        if (draft !== (brief.text || '')) actions.editBrief(draft)
      }
      const cancel = () => {
        if (!editingRef.current) return
        editingRef.current = false
        setDraft(brief.text || '')
        setEditing(false)
      }
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
          right: meta,
        }),
        h('div', { className: 'dd-scroll' },
          h('div', { className: 'dd-grid' },
            brief.exists || editing
              ? h('div', { className: 'dd-doc' },
                editing
                  ? h('div', { className: 'dd-prompt-edit-wrap' },
                    h('textarea', {
                      className: 'dd-prompt-edit', value: draft, autoFocus: true,
                      placeholder: '# 简报\n\n一句话故事…',
                      onChange: event => setDraft(event.target.value),
                      onBlur: commit,
                      onKeyDown: event => {
                        if (event.key === 'Escape') { event.preventDefault(); cancel() }
                        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); commit() }
                      },
                    }),
                    h('span', { className: 'dd-prompt-acts' },
                      h('button', {
                        className: 'dd-ed-act ok', type: 'button', title: '保存（失焦或 Ctrl+Enter）',
                        onMouseDown: event => event.preventDefault(),
                        onClick: commit,
                      }, h(Icon, { name: 'check', size: 11 })),
                      h('button', {
                        className: 'dd-ed-act no', type: 'button', title: '撤销（Esc）',
                        onMouseDown: event => event.preventDefault(),
                        onClick: cancel,
                      }, h(Icon, { name: 'close', size: 11 })),
                    ),
                  )
                  : h('div', {
                    className: 'dd-doc editable', role: 'button', tabIndex: 0,
                    title: '点击就地编辑 · 失焦即存',
                    onClick: begin,
                    onKeyDown: event => { if (event.key === 'Enter') { event.preventDefault(); begin() } },
                  }, h(MarkdownLite, { text: brief.text || '' })),
              )
              : h('div', { className: 'dd-empty' },
                h('div', { className: 'dd-empty-title' }, '还没有简报'),
                h('div', null, 'conceive 的出口是 creative/brief.md。写下来，它就存在了。'),
                h('div', { style: { marginTop: '14px' } },
                  h('button', { className: 'dd-btn primary', disabled: busy, onClick: begin }, '写第一版简报')),
              ),
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
                  h('div', { className: 'dd-outline-body' },
                    h(Editable, {
                      layout: 'row', serif: true,
                      label: '场次标题', value: scene.title, disabled: busy,
                      placeholder: '（无标题）',
                      onSave: value => actions.editScene(scene.id, { title: value }),
                    }),
                    h(Editable, {
                      layout: 'row',
                      label: '这一场发生了什么', value: scene.summary, multiline: true, disabled: busy,
                      placeholder: '一句话说明',
                      onSave: value => actions.editScene(scene.id, { summary: value }),
                    }),
                    h(Editable, {
                      layout: 'row',
                      label: '结束时什么变了', labelTitle: '结束时什么变了（TURN）',
                      value: scene.turn, multiline: true, disabled: busy,
                      placeholder: '（可空）',
                      onSave: value => actions.editScene(scene.id, { turn: value }),
                    }),
                  ),
                  h('div', { className: 'dd-outline-meta' },
                    h(Editable, {
                      layout: 'row',
                      label: '功能', labelTitle: '场次功能',
                      value: scene.function, disabled: busy,
                      onSave: value => actions.editScene(scene.id, { function: value }),
                    }),
                    h(Editable, {
                      layout: 'row',
                      label: '时长 s', labelTitle: '时长（秒）',
                      value: scene.duration, type: 'number', disabled: busy,
                      onSave: value => actions.editScene(scene.id, { duration: Number(value) || 0 }),
                    }),
                    h(Editable, {
                      layout: 'row',
                      label: '在场', labelTitle: '在场角色',
                      value: (scene.characters || []).join(', '), disabled: busy,
                      placeholder: '角色 id，逗号分隔',
                      onSave: value => actions.editScene(scene.id, {
                        characters: value.split(/[,，\s]+/).map(entry => entry.trim()).filter(Boolean),
                      }),
                    }),
                    h('div', { className: 'dd-outline-foot' },
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
              h(Editable, {
                layout: 'row', label: '外貌', labelTitle: '外貌',
                value: entry.appearance, multiline: true, disabled: busy,
                onSave: value => actions.editCharacter(entry.id, { appearance: value }),
              }),
              h(Editable, {
                layout: 'row', label: '动作', labelTitle: '可被拍到的动作',
                value: entry.behavior, multiline: true, disabled: busy,
                onSave: value => actions.editCharacter(entry.id, { behavior: value }),
              }),
              h(Editable, {
                layout: 'row', label: '说话', labelTitle: '说话方式',
                value: entry.voice, multiline: true, disabled: busy,
                onSave: value => actions.editCharacter(entry.id, { voice: value }),
              }),
              h(Editable, {
                layout: 'row', label: '音色', labelTitle: '音色（逐字复用）',
                value: entry.voice_desc, multiline: true, disabled: busy,
                placeholder: 'English voice timbre…',
                onSave: value => actions.editCharacter(entry.id, { voice_desc: value }),
              }),
              h(Editable, {
                layout: 'row', label: '语气', labelTitle: '默认语气',
                value: entry.delivery_default, multiline: true, disabled: busy,
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
          className: 'dd-scene-cell' + (entry.id === activeId ? ' on' : ''),
          onClick: () => setActiveId(entry.id),
        },
          h('span', { className: 'sid' }, entry.id),
          h('span', { className: 'nm' }, entry.title || '（无标题）'),
          h('span', { className: 'ct' }, (entry.beats || []).length + '拍'),
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
                      /* 机器读数是**读数**，不是可改的字段——
                         之前它们跟人工判定长得一模一样，点进去才发现改不了。 */
                      h('div', { className: 'dd-grid3' },
                        h(Editable, {
                          label: '技术判定', readOnly: true,
                          value: tech.pass === true ? 'pass' : tech.pass === false ? 'fail' : '—',
                        }),
                        h(Editable, {
                          label: '实测时长', readOnly: true,
                          value: tech.durationSec ? tech.durationSec + 's' : '—',
                        }),
                        h(Editable, {
                          label: '分辨率', readOnly: true,
                          value: tech.width ? tech.width + '×' + tech.height : '—',
                        }),
                      ),
                      h('div', { className: 'dd-grid2' },
                        h(Editable, {
                          layout: 'row', label: '人工判定', labelTitle: '人工判定（verdict）',
                          value: human.verdict || '', disabled: busy,
                          placeholder: 'pass / fail / warn',
                          onSave: value => actions.editVerify(shot.id, { verdict: value }),
                        }),
                        h(Editable, {
                          layout: 'row', label: '复核人',
                          value: human.reviewer || '', disabled: busy,
                          placeholder: '姓名',
                          onSave: value => actions.editVerify(shot.id, { reviewer: value }),
                        }),
                      ),
                      h(Editable, {
                        layout: 'row', label: '人工发现的问题',
                        value: (human.issues || []).join('；'), multiline: true, disabled: busy,
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
      const { shot, selected, onSelect, workspaceId, index } = props
      const [failed, setFailed] = useState(false)
      const signal = shotSignal(shot)
      const poster = shot.poster
      const posterSrc = failed || poster === undefined
        ? undefined
        : poster.asset
          ? assetImageUrl(workspaceId, poster.asset)
          : posterUrl(workspaceId, shot.id)
      const marks = shot.markers || []
      return h('button', {
        className: 'dd-monitor' + (selected ? ' on' : ''),
        onClick: () => onSelect(shot.id),
        title: shot.id + ' · ' + (shot.title || '') + '\n' + signal.label,
        style: index === undefined ? undefined : { animationDelay: Math.min(index, 14) * 26 + 'ms' },
      },
        h('div', { className: 'screen' },
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
          h('div', { className: 'veil' }),
          h('div', { className: 'topline' },
            h('span', { className: 'sid' }, shot.id),
            h('span', { className: 'pill ' + signal.key }, h('i', null), signal.label),
          ),
          marks.length > 0
            ? h('div', { className: 'marks' },
              marks.slice(0, 3).map((mark, markIndex) => h('span', {
                key: markIndex,
                className: 'mark' + (mark.kind === 'beat' ? ' beat' : mark.kind === 'notes' ? ' notes' : mark.kind === 'prompt' ? ' prompt' : ''),
              }, mark.label)))
            : null,
        ),
        h('div', { className: 'cap' },
          h('div', { className: 't' }, shot.title || '（无标题）'),
          h('div', { className: 's' }, shot.summary || '（没有内容摘要）'),
          h('div', { className: 'm' },
            h('span', null, h('b', null, shot.duration ? shot.duration + 's' : '—')),
            h('span', null, shot.camera || '—'),
            shot.ratio ? h('span', null, shot.ratio) : null,
          ),
        ),
      )
    }

    /** The generate stage: scene navigation + the wall. */
    function GenerateView(props) {
      const { data, selectedShot, onSelectShot, busy, actions, workspaceId, onOpenImage, onSceneChange } = props
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

    // ── shot detail ────────────────────────────────────────────────────────

    /** The camera fields with presets — 预置只是省事，不满足时仍然可以手填。 */
    function ShotCameraEditor(props) {
      const { shot, busy, onSave } = props
      if (!shot) return null
      const save = patch => onSave(patch)
      return h('div', { className: 'dd-grid2' },
        h(PresetField, {
          label: '运镜', value: shot.camera, options: CAMERAS, disabled: busy, allowCustom: true, wide: true,
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
        h(Editable, {
          label: '光参数 preset', mono: true,
          value: shot.lighting ?? '', disabled: busy,
          placeholder: 'day_interior / night_face …',
          onSave: value => save({ lighting: value }),
        }),
        h(Editable, {
          label: '标题',
          value: shot.title ?? '', disabled: busy,
          onSave: value => save({ title: value }),
        }),
        h('div', { style: { gridColumn: '1 / -1' } },
          h(Editable, {
            label: '这一镜要表达什么', title: '这一镜要表达什么（派生摘要 · 只读）',
            readOnly: true,            value: shot.summary || '',
            placeholder: '（没有摘要）',
          })),
        h('div', { style: { gridColumn: '1 / -1' } },
          h(Editable, {
            label: '这一镜的动作', title: '这一镜的动作（motion_action · 真源）',
            value: shot.motion_action ?? '', multiline: true, disabled: busy,
            placeholder: '这一镜里主体做了什么',
            onSave: value => save({ motion_action: value }),
          })),
        h('div', { style: { gridColumn: '1 / -1' } },
          h(Editable, {
            label: '备注 / 导演批注',
            value: shot.notes ?? '', multiline: true, disabled: busy,
            placeholder: '这一镜你想记住什么？',
            onSave: value => save({ notes: value }),
          })),
        h('div', { style: { gridColumn: '1 / -1' } },
          h('span', { className: 'dd-note' }, '派生字段（description_en / dialogue）只读，由编译生成')),
      )
    }

    /**
     * 一拍 = 动作行 + 这一拍是不是有台词 + 台词 + 语气。
     *
     * 改东西只有一种手势：**点那段字，就地编辑，失焦即存**。
     * 之前这里是三个常驻输入框 + 一对【保存】【撤销】按钮，
     * 一屏拍位全是框与按钮，读起来像表单而不是剧本。
     *
     * `mode` 有个契约上的硬约束（数据契约 §6）：台词拍必须带语气阶梯。
     * 所以选「画内音 / 画外音」时，若语气还是空的，**mode 先不落盘**——
     * 等语气填上了，mode 与语气一起存。否则用户会先撞上一句报错，
     * 而界面又没有地方让他补语气。
     */
    function BeatEditor(props) {
      const { beat, index, issues, disabled, onSave, onInsert, onDelete, onMove } = props
      const [mode, setMode] = useState(beat.mode || '')
      useEffect(() => { setMode(beat.mode || '') }, [beat.mode])

      const wantsDialogue = mode === 'dialogue' || mode === 'voiceover'

      /**
       * 把一次编辑落盘。mode 与 delivery **必须同时**满足契约，
       * 所以这里统一判断：语气齐了才带着 mode 一起写。
       *
       * `nextMode` 是给「刚点了选项」用的——那一刻 setState 还没生效，
       * 直接读 state 会读到旧值。
       */
      const commit = (patch, nextMode) => {
        const wanted = nextMode === undefined ? mode : nextMode
        const wantsTalk = wanted === 'dialogue' || wanted === 'voiceover'
        const next = { ...patch }
        if (wanted !== (beat.mode || '')) {
          if (!wantsTalk) {
            next.mode = null
          } else {
            const delivery = next.delivery !== undefined ? next.delivery : (beat.delivery || '')
            if (String(delivery).trim() !== '') next.mode = wanted
          }
        }
        if (Object.keys(next).length === 0) return
        onSave(next)
      }

      return h('div', { className: 'dd-beat' },
        h('div', { className: 'dd-beat-head' },
          h('span', { className: 'n' }, '#' + index),
          beat.speaker ? h('span', { className: 'who' }, beat.speaker) : null,
          h('span', { className: 'dd-spacer' }),
          h('div', { className: 'dd-beat-acts' },
            h('button', { className: 'dd-icon-btn sm ghost', disabled: disabled, title: '上移这一拍', onClick: () => onMove(-1) }, h(Icon, { name: 'up', size: 12 })),
            h('button', { className: 'dd-icon-btn sm ghost', disabled: disabled, title: '下移这一拍', onClick: () => onMove(1) }, h(Icon, { name: 'down', size: 12 })),
            h('button', { className: 'dd-icon-btn sm ghost', disabled: disabled, title: '在后面插入一拍', onClick: onInsert }, h(Icon, { name: 'plus', size: 12 })),
            h('button', { className: 'dd-icon-btn sm ghost', disabled: disabled, title: '删除这一拍', onClick: onDelete }, h(Icon, { name: 'trash', size: 12 })),
          ),
        ),
        h('div', { className: 'dd-beat-body' },
          h(Editable, {
            label: '动作行', value: beat.action || '', multiline: true, disabled,
            placeholder: '这一拍主体做了什么',
            onSave: value => commit({ action: value }),
          }),
          h('div', { className: 'dd-beat-kind' },
            h('span', { className: 'lab' }, '这一拍是'),
            h('div', { className: 'preset' },
              [['', '无台词'], ['dialogue', '画内音（要口型）'], ['voiceover', '画外音']].map(option =>
                h('button', {
                  key: option[0],
                  className: mode === option[0] ? 'on' : '',
                  disabled,
                  onClick: () => {
                    if (mode === option[0]) return
                    setMode(option[0])
                    commit({}, option[0])
                  },
                }, option[1]))),
          ),
          wantsDialogue
            ? h(Editable, {
              label: '台词', value: beat.text || '', multiline: true, disabled,
              placeholder: '这一拍说出口的话',
              onSave: value => commit({ text: value }),
            })
            : null,
          wantsDialogue
            ? h(Editable, {
              label: '语气', labelTitle: '语气 delivery（本句的情绪 + 语速 + 气口）',
              value: beat.delivery || '', multiline: true, disabled,
              placeholder: '本句的情绪 + 语速 + 气口',
              onSave: value => commit({ delivery: value }),
            })
            : null,
          issues && issues.length > 0
            ? h('div', null, issues.map((issue, i) => h('div', { className: 'dd-issue', key: i }, '· ' + issue)))
            : null,
        ),
      )
    }

    /**
     * 提示词是**产物**，但它也是**可改的文本**。
     *
     * 以前是「编辑」按钮 → 整块变textarea → 「保存提示词」按钮。
     * 现在是：点那些字，就地编辑，失焦即存。
     * 「重新编译 / 校验过期 / 丢弃手工改写」是**动作**，留在工具条上；
     * 「编辑」不是动作，是**另一种看法**，所以它不该占一个按钮位。
     */
    function PromptEditor(props) {
      const { shot, prompt, busy, actions } = props
      const [editing, setEditing] = useState(false)
      const [draft, setDraft] = useState('')
      const editingRef = useRef(false)
      useEffect(() => {
        if (!editingRef.current) setDraft(prompt ? prompt.text || '' : '')
      }, [prompt ? prompt.text : ''])
      const words = prompt && prompt.text ? prompt.text.trim().split(/\s+/).length : 0
      const begin = () => {
        if (busy || editingRef.current) return
        editingRef.current = true
        setDraft(prompt ? prompt.text || '' : '')
        setEditing(true)
      }
      const commit = () => {
        if (!editingRef.current) return
        editingRef.current = false
        setEditing(false)
        actions.savePrompt(shot.id, draft)
      }
      const cancel = () => {
        if (!editingRef.current) return
        editingRef.current = false
        setDraft(prompt ? prompt.text || '' : '')
        setEditing(false)
      }
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } },
        h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center' } },
          h('button', { className: 'dd-btn sm', disabled: busy, onClick: () => actions.compileShot(shot.id, true) }, '校验过期'),
          h('button', { className: 'dd-btn sm', disabled: busy, onClick: () => actions.compileShot(shot.id, false) }, '重新编译'),
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
          ? h('div', { className: 'dd-prompt-edit-wrap' },
            h('textarea', {
              className: 'dd-prompt-edit', value: draft, autoFocus: true,
              onChange: event => setDraft(event.target.value),
              onBlur: commit,
              onKeyDown: event => {
                if (event.key === 'Escape') { event.preventDefault(); cancel() }
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); commit() }
              },
            }),
            h('span', { className: 'dd-prompt-acts' },
              h('button', {
                className: 'dd-ed-act ok', type: 'button', title: '保存（失焦或 Ctrl+Enter）',
                onMouseDown: event => event.preventDefault(),
                onClick: commit,
              }, h(Icon, { name: 'check', size: 11 })),
              h('button', {
                className: 'dd-ed-act no', type: 'button', title: '撤销（Esc）',
                onMouseDown: event => event.preventDefault(),
                onClick: cancel,
              }, h(Icon, { name: 'close', size: 11 })),
            ),
          )
          : prompt && prompt.text
            ? h('div', {
              className: 'dd-prompt editable', role: 'button', tabIndex: 0,
              title: '点击就地编辑 · 失焦即存',
              onClick: begin,
              onKeyDown: event => {
                if (event.key === 'Enter') { event.preventDefault(); begin() }
              },
            }, prompt.text)
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
      const { detail, loading, onClose, busy, actions, workspaceId, onOpenImage, sheet, onSelectShot } = props
      if (loading) return h('div', { className: 'dd-inspector' }, h('div', { className: 'dd-empty' }, '正在读取镜头…'))
      if (!detail) {
        // 没有选中镜头时，右栏**不写说明书**——它给这一场的概览：
        // 场次是什么、有多少镜、每一镜什么状态。点一行就切到那一镜。
        if (!sheet || !sheet.shots || sheet.shots.length === 0) {
          return h('div', { className: 'dd-inspector' }, h('div', { className: 'dd-empty' }, '这个阶段还没有镜头'))
        }
        const shots = sheet.shots || []
        const bad = shots.filter(shot => shot.status === 'fail' || shot.status === 'warn').length
        return h('div', { className: 'dd-inspector' },
          h('div', { className: 'dd-inspector-head' },
            h('span', { className: 'id' }, sheet.id || 'SCENE'),
            h('span', { className: 'ttl' }, sheet.title || '概览'),
          ),
          h('div', { className: 'dd-inspector-body' },
            h('div', { className: 'dd-sheet' },
              h('div', { className: 'dd-sheet-head' },
                sheet.id ? h('div', { className: 'sid' }, sheet.id) : null,
                h('div', { className: 'ttl' }, sheet.title || '（无标题）'),
                sheet.summary ? h('div', { className: 'sum' }, sheet.summary) : null,
              ),
              h('div', { className: 'dd-sheet-stats' },
                h('div', { className: 'dd-sheet-stat' },
                  h('div', { className: 'v' }, String(shots.length)),
                  h('div', { className: 'k' }, 'SHOTS')),
                h('div', { className: 'dd-sheet-stat' },
                  h('div', { className: 'v' }, String((sheet.duration || 0) + 's')),
                  h('div', { className: 'k' }, 'DURATION')),
                h('div', { className: 'dd-sheet-stat' },
                  h('div', { className: 'v', style: { color: bad > 0 ? 'var(--sig-warn)' : 'var(--sig-pass)' } }, String(bad)),
                  h('div', { className: 'k' }, 'ATTENTION')),
              ),
              h('div', { className: 'dd-sheet-list' },
                shots.map(shot => {
                  const signal = shotSignal(shot)
                  return h('div', {
                    key: shot.id,
                    className: 'dd-sheet-row',
                    onClick: () => { if (onSelectShot) onSelectShot(shot.id) },
                    title: '打开 ' + shot.id,
                  },
                    h('span', { className: 'id' }, shot.id),
                    h('span', { className: 'nm' }, shot.title || '（无标题）'),
                    h('span', { className: 'st ' + signal.key }),
                  )
                }),
              ),
            ),
          ),
        )
      }
      const shot = detail.shot
      const scene = detail.scene
      const beats = scene && Array.isArray(scene.beats) ? scene.beats : []
      const covered = new Set((shot.covers || []).map(index => index))
      const images = (detail.assets || []).filter(asset => asset.type === 'reference_image' || asset.type === 'keyframe')
      const videos = (detail.assets || []).filter(asset => asset.type === 'video')
      return h('div', { className: 'dd-inspector' },
        h('div', { className: 'dd-inspector-head' },
          h('span', { className: 'id' }, shot.id),
          h('span', { className: 'ttl' }, shot.title || ''),
          h('span', { className: 'dd-spacer' }),
          h('button', { className: 'dd-icon-btn', onClick: onClose, title: t('action.close', '关闭') }, h(Icon, { name: 'close', size: 13 })),
        ),
        h('div', { className: 'dd-inspector-body' },
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
            h(Editable, {
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
     *
     * 同一个框也用来**藏**我们自己的开场白：它跟着用户的第一条消息一起送，
     * 模型读得到，界面上不显示（见 `ConceiveChat` 里的 `seedPending`）。
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
      const { sessionId, seed, onClose, onFresh, onStart, canStart, busy } = props
      const [reference, setReference] = useState(null)
      const [error, setError] = useState(null)
      const [draft, setDraft] = useState('')
      const [starting, setStarting] = useState(false)
      /** 这段会话的「开场白」送出去了没有（送过就不再重复）。 */
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

      /**
       * 开场白（`@workspaces/<id>/` 锚 + `drama-conceive` 技能 + 防串台约束）
       * 还没送出去，而且这段会话里**你还没说过话**——那就把它搭在**第一条
       * 用户消息**上一起送。
       *
       * 为什么不是「一开侧栏就自动发」：那是替用户开了个头，看着像 AI 自己
       * 在跟自己说话。开场白是上下文，不是发言——它该跟着你真正说的第一句走。
       */
      const seedPending = seeded.current === false
        && typeof seed === 'string' && seed !== ''
        && !rows.some(row => row.kind === 'user')

      const send = useCallback(async () => {
        const text = draft.trim()
        if (text === '' || binding === undefined) return
        setDraft('')
        setError(null)
        // 用 `<system-reminder>` 框住：模型读得到，界面不显示（stripInjected 抹掉）。
        const payload = seedPending
          ? '<system-reminder>\n' + seed + '\n</system-reminder>\n\n' + text
          : text
        seeded.current = true
        try {
          const result = await binding.session.prompt([{ type: 'text', text: payload }], 'queue')
          if (result !== undefined && result !== null && result.ok === false) {
            seeded.current = false
            setError(result.error && result.error.message ? result.error.message : '发送失败')
          }
        } catch (problem) {
          seeded.current = false
          setError(problem instanceof Error ? problem.message : String(problem))
        }
      }, [draft, binding, seed, seedPending])

      /** 用户主动发起：真的开一段会话（此前没有会话 id）。 */
      const start = useCallback(async () => {
        if (starting || typeof onStart !== 'function') return
        setStarting(true)
        try {
          await onStart()
        } finally {
          setStarting(false)
        }
      }, [starting, onStart])

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

      const hasSession = sessionId !== undefined

      const head = h('div', { className: 'dd-chat-head' },
        h(Icon, { name: 'note', size: 14 }),
        h('div', { style: { minWidth: '0' } },
          h('div', { className: 'ch-t' }, '构思会话'),
          h('div', { className: 'ch-sub' },
            !hasSession ? '还没开始——点下面「开始对话」'
              : openState === 'open' ? (running ? '正在想…' : '等你说话')
                : openState === 'loading' ? '正在打开…'
                  : openState === 'error' ? '打不开这段会话'
                    : '准备中…'),
        ),
        h('span', { className: 'dd-spacer' }),
        h('button', {
          className: 'dd-btn sm', onClick: onFresh, disabled: !hasSession || busy,
          title: '开一段新对话（旧的那段仍留在 DSH 的会话列表里）',
        }, '新对话'),
        h('button', {
          className: 'dd-btn sm', onClick: openInPanel, disabled: !hasSession,
          title: '在宿主的对话面板里打开完整聊天',
        }, '完整对话'),
        h('button', { className: 'dd-icon-btn', onClick: onClose, title: '收起这扇窗（顶栏的图标能再展开）' }, h(Icon, { name: 'close', size: 13 })),
      )

      const flow = h('div', { className: 'dd-chat-flow', ref: flowRef },
        rows.length === 0
          ? h('div', { className: 'dd-chat-empty' },
            h('div', null, '这里接的是真的 DSH 会话：'),
            h('div', null, '同一个模型、同一套工具、加载了 `drama-conceive` 技能。'),
            hasSession
              ? h('div', { style: { marginTop: '8px', color: 'var(--ink4)' } }, '它会把创意写进 creative/brief.md，你改一句它就改一句。')
              : h('div', { style: { marginTop: '14px' } },
                h('button', {
                  className: 'dd-btn primary', onClick: start,
                  disabled: starting || busy || !canStart,
                  title: canStart ? '开一段真的构思会话' : '先选一个作品（构思会话是挂在作品上的）',
                }, starting ? '正在开…' : '开始对话'),
                h('div', { style: { marginTop: '10px', color: 'var(--ink4)' } },
                  canStart
                    ? '会话由你发起：开好之后你说的话，它会写进 creative/brief.md。'
                    : '先选一个作品（或新建一个），构思会话是挂在作品上的。')))
          : rows.map(row => h(MsgRow, { key: row.key, kind: row.kind, text: row.text })),
        error !== null
          ? h('div', { className: 'dd-msg err' }, h('div', { className: 'body' }, error))
          : null,
      )

      const composer = h('div', { className: 'dd-chat-composer' },
        h('textarea', {
          value: draft,
          placeholder: hasSession
            ? '跟它说你想拍什么…（Enter 发送，Shift+Enter 换行）'
            : '先点「开始对话」开一段会话，然后就能跟它说了…',
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
            : h('button', { className: 'dd-btn sm primary', onClick: send, disabled: draft.trim() === '' || binding === undefined }, '发送'),
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
                  '九个阶段，一路到成片。每一阶段有自己的产物与体检线——随时能改，随时能退回重做一镜。'),
                h('div', { className: 'h3' },
                  '右边那扇窗是一个真的 AI 会话。点「开始对话」，它会把创意写进 creative/brief.md。'),
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
        h('style', null, CSS),
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
            }, h(Icon, { name: 'aperture', size: 17 })),
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
              sheet: inspectorSheet,
              onSelectShot: openShot,
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
              canStart: workspaceId !== '',
              onStart: () => openConceive(false),
              onClose: () => setChatCollapsed(true),
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

    /** The sidebar glyph — an iris. 六片叶子，远看就知道是「镜头」。 */
    function DramaDeskIcon(props) {
      const size = props.size ?? 18
      return h('svg', {
        width: size, height: size, viewBox: '0 0 20 20', fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true,
        style: { display: 'block', pointerEvents: 'none' },
      }, [
        h('circle', { key: 'a', cx: 10, cy: 10, r: 7.4, stroke: 'currentColor', strokeWidth: 1.4 }),
        h('path', {
          key: 'b', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round',
          d: 'M11.6 5.4 15.8 12.8M8.4 5.4 18.2 5.4M6.6 8.6 10.8 1.6M8.4 14.6 3.6 7.6M11.6 14.6 1.8 14.6M13.4 11.4 9.2 18.4',
        }),
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
