/*!
 * dsh-drama-desk — client half (browser bundle) 的**源码**。
 *
 * 这个文件本身不参与运行：它只说明「客户端半边是什么」，真正的代码按功能
 * 分在同目录的各个文件里，由 scripts/build-client.mjs 拼成 client.js。
 * 拼装顺序见 manifest.json。
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
/*!
 * dsh-drama-desk — client half (browser bundle).
 *
 * ⚠ 这个文件是**生成物**：源码在 src/client/，由 scripts/build-client.mjs 拼装。
 *   要改界面请改 src/client/*.js，改这里会在下一次构建时被覆盖。
 *
 * 设计语言与 bundle 格式的完整说明在 src/client/00-header.js。
 */
window.__ModuleLoader__.load({
  id: 'dsh-drama-desk',
  factory: (require) => {
    const React = require('react')

    const h = React.createElement

    const { useState, useEffect, useCallback, useMemo, useRef } = React

    let CTX = null

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

  /* ══ brand（Logo 的两色：冷蓝片身 · 暖琥珀在产的那一格）══════════════
     与 icon.svg 里的两个色值一一对应。标志是产品的一部分，
     不随主题换色——所以这两支颜色是**常量**，不是语义 token。 */
  --brand-blue:#2F6BE0;
  --brand-amber:#F5A524;

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
.dd-brand{
  display:flex;align-items:center;gap:10px;flex:none
}
/* 品牌标记的底板。标记本身是彩色的（冷蓝 + 暖琥珀），不跟 --hot 走——
   标志是产品的一部分，不随主题换色。 */
.dd-brand-mark{
  width:32px;height:32px;border-radius:var(--rx-2);display:grid;place-items:center;flex:none;
  background:linear-gradient(160deg,var(--raised),var(--sunken));
  box-shadow:var(--e-3);
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

/* ── inline editing ───────────────────────────────────────────────────── */
/* 文本编辑组件的样式**住在组件旁边**（41-editing.js），不在这儿。
   理由：改一个组件时，样式与实现应该在同一个文件里被一起读到。 */

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

    /**
     * 样式的装配口。
     *
     * 基础样式是上面那一大段；**每个功能模块把自己的样式 push 进来**，
     * 于是「样式跟着组件走」：改一个组件时，实现与样式在同一个文件里。
     *
     * 顺序即优先级：模块在 manifest 里的位置决定它的样式排在后面还是前面。
     */
    const CSS_PARTS = [CSS]

    // ── 侧栏：宽度可调 ────────────────────────────────────────────────────
    //
    // 右侧栏（镜详情 / 构思会话）以前是**固定宽度**的（`clamp()`），
    // 局促的时候看不全，又没法调。
    //
    // 现在：拖左边缘改宽度，有**最小宽度**与**最大宽度**；拖到最大还不够看时，
    // 可以**全屏**——不是占满浏览器，而是占满**导演工作台**这一块。
    //
    // 性能：拖动时**直写 DOM 的 width**，React 状态每帧至多提交一次。
    // 否则每挪一像素都要重渲染整棵面板树（72 个镜头卡片销毁重建）——
    // 插件是嵌在别人的主应用里的，这种开销用户会直接归咎于 DSH。

    /** 侧栏宽度的最小/最大值。 */
    const PANEL_MIN = 320
    const PANEL_MAX = 1200

    /**
     * 一块可调宽度的侧栏。
     *
     * @param {{storageKey?: string, initial?: number, min?: number, max?: number}} options
     * @returns {{width: number, full: boolean, panelRef: object, style: object, startResize: Function, toggleFull: Function, onCloseFull: Function}}
     */
    function usePanelWidth(options = {}) {
      const { storageKey, initial = 420, min = PANEL_MIN, max = PANEL_MAX } = options
      const [width, setWidth] = useState(() => {
        if (typeof storageKey === 'string') {
          try {
            const stored = Number(window.localStorage.getItem(storageKey))
            if (Number.isFinite(stored) && stored >= min && stored <= max) return stored
          } catch { /* localStorage 不可用就用默认值 */ }
        }
        return initial
      })
      const [full, setFull] = useState(false)
      const panelRef = useRef(null)
      const dragRef = useRef(null)

      const clamp = useCallback(value => Math.min(max, Math.max(min, value)), [max, min])

      const startResize = useCallback(event => {
        event.preventDefault()
        const box = panelRef.current
        if (box === null) return
        const start = { x: event.clientX, width: box.getBoundingClientRect().width }
        dragRef.current = start

        const onMove = move => {
          const from = dragRef.current
          if (from === null) return
          // 右侧栏的把手在**左**边：往左拖 = 变宽。
          const next = clamp(from.width - (move.clientX - from.x))
          // 直写 DOM：这一帧就动，不等 React。
          box.style.width = next + 'px'
          box.style.maxWidth = next + 'px'
        }
        const onUp = () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
          const from = dragRef.current
          dragRef.current = null
          if (from === null) return
          const final = clamp(Number.parseFloat(box.style.width) || from.width)
          box.style.width = ''
          box.style.maxWidth = ''
          setWidth(final)
          if (typeof storageKey === 'string') {
            try { window.localStorage.setItem(storageKey, String(final)) } catch { /* 存不下就算了 */ }
          }
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
      }, [clamp, storageKey])

      const toggleFull = useCallback(() => setFull(value => !value), [])

      const style = full
        ? undefined
        : { width: width + 'px', maxWidth: width + 'px' }

      return { width, full, panelRef, style, startResize, toggleFull }
    }

    // ── 侧栏的样式 ────────────────────────────────────────────────────────
    CSS_PARTS.push(`
/* ── 可调宽度的侧栏 ───────────────────────────────────────────────────── */
.dd-side{position:relative;flex:0 0 auto;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.dd-side>.dd-inspector,.dd-side>.dd-chat{
  width:100%;max-width:none;min-width:0;
  /* **这里必须把 flex 改回 1 1 auto。**
     基类的 .dd-chat / .dd-inspector 带着 flex:0 0 auto —— 那是给
     **行**向 flex 用的（管的是宽度）。侧栏现在是**列**向 flex 的子项，
     同一个声明落到**高度**上，于是它**不许收缩**：消息流被撑到内容高度、
     自己的 overflow:auto 永远用不上，输入框被顶到视口外面去。
     （这是本轮把侧栏包进 .dd-side 时踩的坑，实机才看得出来。）
  */
  flex:1 1 auto;min-height:0;overflow:hidden;
}
.dd-side.full{
  position:absolute;inset:0;width:auto;max-width:none;z-index:6;
  box-shadow:0 0 0 1px var(--line),var(--e-4);
}
/* 把手：左边缘一条 7px 的热区，视觉上是一条发丝线。 */
.dd-side-resize{
  position:absolute;left:-3px;top:0;bottom:0;width:7px;z-index:21;cursor:col-resize;
  display:flex;align-items:center;justify-content:center;
}
.dd-side-resize::after{
  content:'';width:2px;height:26px;border-radius:2px;background:var(--line-2);
  transition:background var(--t-fast) var(--ease),height var(--t-fast) var(--ease);
}
.dd-side-resize:hover::after{background:var(--hot-line);height:44px}
.dd-side-resize:focus-visible::after{background:var(--hot);height:44px}
/* 全屏时没有把手——它已经占满整块工作台了。 */
.dd-side.full .dd-side-resize{display:none}
/* 宽度读数：拖动时挂在把手上。 */
.dd-side-size{
  position:absolute;left:6px;top:8px;z-index:22;pointer-events:none;
  font-family:var(--f-mono);font-size:10px;color:var(--ink3);
  padding:2px 6px;border-radius:var(--rx-1);background:var(--sunken);
  box-shadow:inset 0 0 0 .5px var(--line);white-space:nowrap;
}
`)

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
        // 「放大编辑」：四角张开的取景框——比「放大镜」更直白地说是放大。
        expand: 'M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5',
        // 铅笔：编辑入口。它比「修改」两个字更安静，也比「点我」更明确。
        edit: 'M4 20l1-4.5L15.5 5 19 8.5 8.5 12 4 4zM13.5 7l3.5 3.5',
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

    // ── 品牌标记：胶片三格 ───────────────────────────────────────────────
    //
    // 一条胶片：厚片身、顶边四枚片孔、中间三个画格——
    // **中间那格亮着琥珀色**，正是正在产的那一镜。
    //
    // 这套几何与 `icon.svg`（插件列表里那张）**同源**：三处（插件管理器 /
    // 侧栏 / 工作台顶栏）共用同一个标志，不各画各的。
    //
    //   冷蓝 = 片身        暖琥珀 = 正在产的那一格
    //
    // 镂空（片孔、两头的画格）用 **evenodd 子路径**一次画完：
    // 插件管理器把 icon.svg 当 <img> 渲染，那条路上 mask 不保险。

    const FILM_STRIP = 'M11.00 10.00H53.00A8 8 0 0 1 61.00 18.00V46.00A8 8 0 0 1 53.00 54.00H11.00A8 8 0 0 1 3.00 46.00V18.00A8 8 0 0 1 11.00 10.00Z'
      + ' M10.00 15.00H15.00A2 2 0 0 1 17.00 17.00V21.00A2 2 0 0 1 15.00 23.00H10.00A2 2 0 0 1 8.00 21.00V17.00A2 2 0 0 1 10.00 15.00Z'
      + ' M23.00 15.00H28.00A2 2 0 0 1 30.00 17.00V21.00A2 2 0 0 1 28.00 23.00H23.00A2 2 0 0 1 21.00 21.00V17.00A2 2 0 0 1 23.00 15.00Z'
      + ' M36.00 15.00H41.00A2 2 0 0 1 43.00 17.00V21.00A2 2 0 0 1 41.00 23.00H36.00A2 2 0 0 1 34.00 21.00V17.00A2 2 0 0 1 36.00 15.00Z'
      + ' M49.00 15.00H54.00A2 2 0 0 1 56.00 17.00V21.00A2 2 0 0 1 54.00 23.00H49.00A2 2 0 0 1 47.00 21.00V17.00A2 2 0 0 1 49.00 15.00Z'
      + ' M10.00 28.00H18.00A3 3 0 0 1 21.00 31.00V43.00A3 3 0 0 1 18.00 46.00H10.00A3 3 0 0 1 7.00 43.00V31.00A3 3 0 0 1 10.00 28.00Z'
      + ' M46.00 28.00H54.00A3 3 0 0 1 57.00 31.00V43.00A3 3 0 0 1 54.00 46.00H46.00A3 3 0 0 1 43.00 43.00V31.00A3 3 0 0 1 46.00 28.00Z'

    const FILM_FRAME = 'M28.00 28.00H36.00A3 3 0 0 1 39.00 31.00V43.00A3 3 0 0 1 36.00 46.00H28.00A3 3 0 0 1 25.00 43.00V31.00A3 3 0 0 1 28.00 28.00Z'

    /* 侧栏的小尺寸减法：同一条片上的**那三格**——两头空心，中间实心。
       16px 下胶片的片孔会糊掉，所以减法砍到「三格 + 哪一格在产」，
       重量也和邻居（1.6 线描）对得上。 */

    const FILM_GRID_L = 'M8.00 22.00H16.00A4 4 0 0 1 20.00 26.00V36.00A4 4 0 0 1 16.00 40.00H8.00A4 4 0 0 1 4.00 36.00V26.00A4 4 0 0 1 8.00 22.00Z'

    const FILM_GRID_M = 'M28.00 22.00H36.00A4 4 0 0 1 40.00 26.00V36.00A4 4 0 0 1 36.00 40.00H28.00A4 4 0 0 1 24.00 36.00V26.00A4 4 0 0 1 28.00 22.00Z'

    const FILM_GRID_R = 'M48.00 22.00H56.00A4 4 0 0 1 60.00 26.00V36.00A4 4 0 0 1 56.00 40.00H48.00A4 4 0 0 1 44.00 36.00V26.00A4 4 0 0 1 48.00 22.00Z'

    /** 品牌标记（64 网格）——顶栏的「导演工作台」标识：整条胶片。 */
    function DramaDeskMark(props) {
      const size = props.size ?? 22
      return h('svg', {
        width: size, height: size, viewBox: '0 0 64 64',
        xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true,
        style: { display: 'block', pointerEvents: 'none' },
      }, [
        h('path', { key: 'strip', d: FILM_STRIP, fill: 'var(--brand-blue)', fillRule: 'evenodd' }),
        h('path', { key: 'lit', d: FILM_FRAME, fill: 'var(--brand-amber)' }),
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

    // ══ 文本编辑组件（统一）═══════════════════════════════════════════════
    //
    // 这一块是**整个工作台唯一的改法**（`docs/dev/ui-language.md` U6）。规则来自长期记忆里的
    // 《文本编辑组件最佳实践》，逐条落在这里：
    //
    //   · **读态是内容**，不是表单控件：多行文本按 **markdown** 渲染，读起来是
    //     给人看的（这一条是本轮整改的主诉）。
    //   · **编辑态原地接管**同一块地方：两态尺寸恒定 ⇒ 页面不跳。
    //     「不跳」靠三件事：① 读态与编辑态的字号/行高/内边距**完全一致**；
    //     ② 进入编辑时**量一下读态有多高**，编辑框就用这个高度；
    //     ③ 聚焦用 `preventScroll`，不让浏览器把页面顶下去。
    //   · **真改了才有保存**：失焦即存；只敲空格又删回去不算改动。
    //   · **字数算草稿**，编辑时实时变。
    //   · **未保存关不掉，但一定给出路**（放大窗口里）。
    //   · **字少的地方可以放大**：长文本在放大窗口里改，舒服。

    /**
     * 放大窗口的宿主。
     *
     * 字段们只管喊一声「我要开一个放大窗口」，由**根组件**统一渲染——
     * 这样浮层永远在根上，不会被中间容器的 `overflow` 裁掉，
     * 也不会被别的东西盖住。
     */
    let TEXT_DIALOG_HOST = null

    /** 请根组件开一个放大编辑窗口。 */
    function openTextDialog(spec) {
      if (TEXT_DIALOG_HOST === null) return
      TEXT_DIALOG_HOST(spec)
    }

    /** 读态的内容：markdown 或纯文本。 */
    function EditableRead(props) {
      const { text, markdown, placeholder, emptyHint } = props
      if (text === '') {
        // 空值：占位文案，或者调用方给的一段说明（比「（空）」有用得多）。
        if (emptyHint !== undefined && emptyHint !== null) return emptyHint
        return h('span', { className: 'dd-tf-empty' }, placeholder ?? '（空）')
      }
      if (markdown) return h('div', { className: 'dd-md' }, h(MarkdownLite, { text }))
      return h('span', { className: 'dd-tf-text' }, text)
    }

    /**
     * 一个可编辑的文本字段。
     *
     * 读态 → 点它 → 编辑态**原地接管**。两态之间不换位置、不换尺寸。
     * 多行的文本还会多一枚「放大」按钮：在放大窗口里改长文，比在两厘米高
     * 的小框里改舒服得多。
     */
    function Editable(props) {
      const {
        label, labelTitle, value, onSave, multiline, disabled, readOnly,
        placeholder, type, layout, serif, mono, className, style, title,
        markdown, expandable, editSignal, emptyHint,
      } = props
      const canEdit = !readOnly && !disabled && typeof onSave === 'function'
      const [editing, setEditing] = useState(false)
      const [draft, setDraft] = useState(value ?? '')
      const [editHeight, setEditHeight] = useState(undefined)
      const nodeRef = useRef(null)
      const boxRef = useRef(null)
      const editingRef = useRef(false)
      // 服务端最后一次给的值：用来判断「服务器真的变了」，
      // 而不是「我这边重新渲染了」。**外部刷新不许冲掉正在改的草稿。**
      const serverRef = useRef(value ?? '')

      useEffect(() => {
        const incoming = value ?? ''
        if (String(incoming) !== String(serverRef.current)) {
          serverRef.current = incoming
          if (!editingRef.current) setDraft(incoming)
        }
      }, [value])

      // 聚焦：把光标放到末尾，但**不要**让浏览器把页面滚过去。
      useEffect(() => {
        if (!editing || !nodeRef.current) return
        const node = nodeRef.current
        try {
          const end = node.value.length
          node.setSelectionRange(end, end)
        } catch { /* 某些 input 类型不支持选区，忽略 */ }
        try {
          node.focus({ preventScroll: true })
        } catch {
          node.focus()
        }
      }, [editing])

      const current = value === undefined || value === null ? '' : String(value)
      const empty = current === ''
      const dirty = draft !== current
      // 读态默认按 markdown 渲染（多行才渲染：单行没有 markdown 可言）。
      const useMarkdown = markdown === undefined ? multiline === true : markdown === true
      // 放大按钮：多行默认给，单行可以显式要。
      const canExpand = expandable === undefined ? multiline === true : expandable === true

      const begin = () => {
        if (!canEdit || editingRef.current) return
        editingRef.current = true
        // **量一下读态有多高**：编辑框就用这个高度接管 ⇒ 页面不跳。
        const box = boxRef.current
        const measured = box === null ? 0 : Math.round(box.getBoundingClientRect().height)
        setEditHeight(measured > 0 ? measured : undefined)
        setEditing(true)
      }

      // **从外部进入编辑态**：空态的「写第一版」按钮靠它。
      //
      // 信号值一变就进编辑态；相同���号重复触发不会重置正在写的草稿。
      const signalRef = useRef(editSignal)
      useEffect(() => {
        if (editSignal === undefined || editSignal === signalRef.current) return
        signalRef.current = editSignal
        if (!editingRef.current) begin()
        // begin 只依赖 canEdit；这里刻意不把它列进依赖——信号变化才是触发点。
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [editSignal])

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

      /** 打开放大窗口：把当前值带过去，在那里改。 */
      const enlarge = () => {
        openTextDialog({
          title: typeof label === 'string' && label !== '' ? label : (labelTitle ?? '编辑'),
          value: current,
          placeholder,
          serif,
          mono,
          onSave: next => { onSave(next) },
        })
      }

      const cls = 'dd-ed'
        + (layout === 'row' ? ' row' : '')
        + (serif ? ' serif' : '')
        + (mono ? ' mono' : '')
        + (multiline ? ' multi' : '')
        + (canEdit ? '' : ' readonly')
        + (className ? ' ' + className : '')
      const head = label
        ? h('div', { className: 'dd-ed-lab', title: labelTitle || undefined }, label)
        : null

      if (!editing) {
        // **读态就是读态。**
        //
        // 点内容**不**跳进编辑态——这是本轮整改的第一条：
        // 「预览的时候长一个样，点击直接就进入了编辑模式，页面还一直跳」。
        // 误触一次就进编辑、页面又跳一下，是最让人烦躁的那种体验。
        //
        // 所以编辑**必须手动触发**：右上角那枚 ✎ 按钮（就地改）
        // 或 ⤢ 按钮（放大窗口里改）。按钮常驻、只是安静（低透明度），
        // 悬停才亮——它不能藏到「只有鼠标刚好扫过去」才出现。
        return h('div', { className: cls, style },
          head,
          h('div', {
            className: 'dd-ed-box',
            ref: boxRef,
          },
            h('div', {
              className: 'dd-ed-val' + (empty ? ' empty' : '') + (useMarkdown ? ' md' : ''),
              title: title || (canEdit ? '这里可以编辑 · 用右上角的 ✎ 或 ⤢ 手动触发' : undefined),
            }, h(EditableRead, { text: current, markdown: useMarkdown, placeholder, emptyHint })),
            canEdit
              ? h('div', { className: 'dd-tf-tools' },
                h('button', {
                  className: 'dd-tf-edit',
                  type: 'button',
                  title: '编辑这一项（点内容不会进编辑）',
                  'aria-label': '编辑' + (typeof label === 'string' && label !== '' ? '：' + label : ''),
                  onMouseDown: event => event.preventDefault(),
                  onClick: event => { event.stopPropagation(); begin() },
                }, h(Icon, { name: 'edit', size: 12 })),
                canExpand
                  ? h('button', {
                    className: 'dd-tf-expand',
                    type: 'button',
                    title: '放大编辑（长文本在这里改更舒服）',
                    'aria-label': '放大编辑',
                    onMouseDown: event => event.preventDefault(),
                    onClick: event => { event.stopPropagation(); enlarge() },
                  }, h(Icon, { name: 'expand', size: 12 }))
                  : null,
              )
              : null,
          ),
        )
      }

      return h('div', { className: cls, style },
        head,
        h('div', {
          className: 'dd-ed-box editing',
          ref: boxRef,
        },
          h('div', {
            className: 'dd-ed-edit acting'
              + (serif ? ' serif' : '')
              + (mono ? ' mono' : ''),
            style: editHeight === undefined ? undefined : { height: editHeight + 'px' },
          },
            multiline
              ? h('textarea', {
                ref: nodeRef, value: draft, placeholder, spellCheck: false,
                style: editHeight === undefined ? undefined : { height: editHeight + 'px' },
                onChange: event => setDraft(event.target.value),
                onKeyDown, onBlur: commit,
              })
              : h('input', {
                ref: nodeRef, type: type ?? 'text', value: draft, placeholder,
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
          // 字数：算**草稿**，编辑时实时变；只在这里出现。
          h('span', { className: 'dd-tf-count' }, draft.length + ' 字'),
        ),
      )
    }

    /**
     * 放大编辑窗口。
     *
     * 一块占满可用高度的纸：上面是头部（标题 / 字数 / 未保存 / 预览·编辑 / 保存），
     * 下面是正文。**两态共用同一个盒子**（`flex:1 1 auto` + `minHeight:0`），
     * 所以从预览切到编辑，窗口不会「呼吸」。
     *
     * 关闭守卫：Esc / 点遮罩 / 【关闭】走**同一条判定**——有未保存改动就关不掉，
     * 但一定给出路（琥珀警告条 + 「放弃修改」）。
     */
    function TextDialog(props) {
      const { title, value, onSave, onClose, placeholder, serif, mono } = props
      const [mode, setMode] = useState('preview')
      const [draft, setDraft] = useState(value ?? '')
      const [busy, setBusy] = useState(false)
      const [warned, setWarned] = useState(false)
      const warnTimer = useRef(undefined)
      const text = value ?? ''
      const dirty = draft !== text

      const warnUnsaved = () => {
        setWarned(true)
        if (warnTimer.current !== undefined) clearTimeout(warnTimer.current)
        warnTimer.current = setTimeout(() => setWarned(false), 2600)
      }

      // Esc 只挂一次，用 ref 读最新状态（每次输入都重挂是常见的陈旧闭包坑）。
      const latest = useRef({ dirty, mode })
      latest.current = { dirty, mode }
      const requestClose = useCallback(() => {
        if (latest.current.dirty) { warnUnsaved(); return }
        onClose()
      }, [onClose])
      const requestCloseRef = useRef(requestClose)
      requestCloseRef.current = requestClose
      useEffect(() => {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined
        const handler = event => {
          if (event.key === 'Escape') { event.stopPropagation(); requestCloseRef.current() }
        }
        window.addEventListener('keydown', handler, true)
        return () => window.removeEventListener('keydown', handler, true)
      }, [])

      const commit = async () => {
        if (!dirty || busy) return
        setBusy(true)
        try {
          const ok = await onSave(draft)
          if (ok === false) return
          setMode('preview')
        } finally {
          setBusy(false)
        }
      }

      const chip = (key, label) => h('button', {
        key,
        type: 'button',
        'aria-pressed': mode === key,
        className: 'dd-tf-chip' + (mode === key ? ' on' : ''),
        onClick: () => setMode(key),
      }, label)

      const body = mode === 'edit'
        ? h('textarea', {
          className: 'dd-tf-area' + (serif ? ' serif' : '') + (mono ? ' mono' : ''),
          value: draft, placeholder, spellCheck: false,
          onChange: event => setDraft(event.target.value),
          onKeyDown: event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void commit() }
          },
        })
        : h('div', { className: 'dd-tf-paper' },
          draft.trim() === ''
            ? h('span', { className: 'dd-tf-empty' }, '（空）')
            : h('div', { className: 'dd-md' }, h(MarkdownLite, { text: draft })))

      const warnStrip = warned
        ? h('div', { className: 'dd-tf-warn' },
          h('span', null, '请先保存，或放弃这次修改。'),
          h('button', {
            type: 'button', className: 'dd-btn sm',
            title: '丢掉这次修改，关闭窗口',
            onClick: onClose,
          }, '放弃修改'))
        : null

      const head = h('div', { className: 'dd-tf-head' },
        h('span', { className: 'dd-tf-title' }, title || '编辑'),
        h('span', { className: 'dd-tf-meta num' }, draft.length + ' 字'),
        dirty ? h('span', { className: 'dd-tf-dirty' }, '未保存') : null,
        h('span', { className: 'dd-spacer' }),
        h('div', { className: 'dd-tf-seg' }, chip('preview', '预览'), chip('edit', '编辑')),
        // **只有真改了才有【保存】**：没改就不该有一个按钮等着被误点。
        mode === 'edit' && dirty
          ? h('button', {
            type: 'button', className: 'dd-btn sm primary', disabled: busy,
            onClick: () => { void commit() },
          }, busy ? '保存中…' : '保存')
          : null,
        h('button', {
          type: 'button', className: 'dd-icon-btn', title: '关闭',
          onClick: requestClose,
        }, h(Icon, { name: 'close', size: 13 })),
      )

      return h('div', {
        className: 'dd-tf-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': title || '编辑',
        onMouseDown: event => { if (event.target === event.currentTarget) requestClose() },
      },
        h('div', {
          className: 'dd-tf-card' + (warned ? ' warned' : ''),
        },
          head,
          warnStrip,
          h('div', { className: 'dd-tf-body' }, body),
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

    // ── 文本编辑组件的样式 ────────────────────────────────────────────────
    // 放在组件旁边，而不是散在 30-theme.js 里——样式跟着组件走，改一处就够。
    CSS_PARTS.push(`
/* ── 文本编辑组件 ─────────────────────────────────────────────────────── */
.dd-ed{display:flex;flex-direction:column;gap:2px;min-width:0;position:relative}
.dd-ed.row{display:grid;grid-template-columns:var(--ed-lab,116px) minmax(0,1fr);gap:14px;align-items:baseline}
.dd-ed-lab{
  font-family:var(--f-gauge);font-size:10px;color:var(--ink3);
  letter-spacing:.1em;text-transform:uppercase;line-height:1.5;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
/* 读态与编辑态的**排版度量必须完全一致**（字号/行高/内边距），
   否则切换时盒子会变高变低——这就是「页面一直跳」的根源。 */
.dd-ed-box{position:relative;min-width:0}
.dd-ed-val{
  font-size:12.5px;line-height:1.65;color:var(--ink);
  padding:3px 7px;margin-left:-7px;
  min-height:28px;border-radius:var(--rx-1);
  border-bottom:.5px dashed transparent;cursor:text;
  white-space:pre-wrap;word-break:break-word;
  transition:border-color var(--t-fast) var(--ease),color var(--t-fast) var(--ease),background var(--t-fast) var(--ease);
}
/* 多行字段：读态与编辑态的**最小高度相同** ⇒ 切换时高度不变。
   （以前读态 21px、编辑态 66px —— 那个 45px 的差就是「页面一直跳」的来源。） */
.dd-ed.multi .dd-ed-val{min-height:44px}
.dd-ed-val:hover{border-bottom-color:var(--hot-line);background:color-mix(in srgb,var(--hot) 7%,transparent)}
.dd-ed-val.empty{color:var(--ink4)}
.dd-ed.readonly .dd-ed-val{cursor:default}
.dd-ed.readonly .dd-ed-val:hover{border-bottom-color:transparent;background:transparent}
.dd-ed.serif .dd-ed-val{font-family:var(--serif);font-size:15px;line-height:1.5}
.dd-ed.mono .dd-ed-val{font-family:var(--f-mono);font-size:11.5px}
.dd-ed.multi.serif .dd-ed-val{min-height:78px}
.dd-ed.multi.mono .dd-ed-val{min-height:56px}

/* 读态里的 markdown：给人看的排版，不是源码。
   元素级的排版住在 82-docs.js（跟着渲染器走），这里只管外壳。 */
.dd-ed-val.md{white-space:normal}
.dd-md{font-size:12.5px;line-height:1.7;color:var(--ink);min-width:0}
.dd-ed.serif .dd-md{font-family:var(--serif);font-size:14.5px;line-height:1.65}
.dd-tf-empty{color:var(--ink4)}
.dd-tf-text{white-space:pre-wrap}

/* 编辑入口：**常驻、安静**。
   它不能只在悬停时才出现——那等于把「怎么改」藏起来；
   但它也不该抢戏：默认低透明度，悬停/聚焦才亮。
   点内容**不会**进编辑态（见 41-editing.js 的注释）。 */
.dd-tf-tools{
  position:absolute;top:1px;right:1px;z-index:2;
  display:flex;align-items:center;gap:2px;
  opacity:.34;transition:opacity var(--t-fast) var(--ease);
}
.dd-ed-box:hover .dd-tf-tools,.dd-tf-tools:focus-within{opacity:1}
.dd-tf-edit,.dd-tf-expand{
  width:20px;height:20px;border-radius:var(--rx-1);
  display:grid;place-items:center;color:var(--ink3);
  background:color-mix(in srgb,var(--raised) 88%,transparent);
  box-shadow:inset 0 0 0 .5px var(--line);
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-tf-edit:hover{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-tf-expand:hover{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
/* 读态的值域不再假装可点：光标是选字，不是「点这里改」。 */
.dd-ed-val{cursor:text}
.dd-ed.readonly .dd-ed-val{cursor:default}
/* 给右上角那两枚按钮**留位**：否则它们会压在正文上。
   留位是**常驻**的（不是悬停才留），所以读态与编辑态的宽度一致 ⇒ 不跳。 */
.dd-ed:not(.readonly) .dd-ed-val{padding-right:48px}
.dd-ed:not(.readonly) .dd-ed-edit input,
.dd-ed:not(.readonly) .dd-ed-edit textarea{padding-right:48px}

/* 编辑态：与读态同一套度量，只是多了个内阴影。 */
.dd-ed-edit{position:relative;display:block}
.dd-ed-edit input,.dd-ed-edit textarea{
  display:block;width:100%;background:var(--sunken);border:none;
  box-shadow:var(--e-well);border-radius:var(--rx-1);color:var(--ink);
  font-family:inherit;font-size:12.5px;line-height:1.65;padding:3px 7px;outline:none;
  overflow:auto;resize:none;white-space:pre-wrap;
  transition:box-shadow var(--t-fast) var(--ease);
}
.dd-ed-edit input{height:28px}
.dd-ed.multi .dd-ed-edit textarea{min-height:44px}
.dd-ed-edit.serif input,.dd-ed-edit.serif textarea{font-family:var(--serif);font-size:15px;line-height:1.5}
.dd-ed-edit.mono input,.dd-ed-edit.mono textarea{font-family:var(--f-mono);font-size:11.5px}
.dd-ed-edit.serif textarea{min-height:52px}
.dd-ed-edit.mono textarea{min-height:38px}
.dd-ed-edit input:focus,.dd-ed-edit textarea:focus{box-shadow:var(--e-well),0 0 0 1.5px var(--hot)}
.dd-ed-acts{position:absolute;top:3px;right:5px;display:flex;gap:3px}
.dd-ed-act{
  width:20px;height:20px;border-radius:var(--rx-1);display:grid;place-items:center;
  color:var(--ink4);box-shadow:inset 0 0 0 .5px var(--line);
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-ed-act:hover{color:var(--ink);background:var(--panel-2)}
.dd-ed-act.ok:hover{color:var(--sig-pass);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-pass) 45%,transparent)}
.dd-ed-act.no:hover{color:var(--sig-fail);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-fail) 45%,transparent)}
/* 字数：算草稿，只在编辑时出现。 */
.dd-tf-count{
  position:absolute;left:6px;bottom:-15px;font-family:var(--f-mono);font-size:10px;
  color:var(--ink4);pointer-events:none;
}
.dd-ed-box.editing{margin-bottom:15px}

/* ── 放大编辑窗口 ─────────────────────────────────────────────────────── */
.dd-tf-overlay{
  position:fixed;inset:0;z-index:120;display:grid;place-items:center;
  background:color-mix(in srgb,var(--bg) 40%,rgba(0,0,0,.72));
}
.dd-tf-card{
  width:min(1080px,100%);height:min(88vh,940px);max-height:calc(100vh - 40px);
  display:flex;flex-direction:column;gap:12px;padding:18px 20px 20px;
  border-radius:var(--rx-3);background:var(--raised);box-shadow:var(--e-4);
  transition:box-shadow 200ms var(--ease);
}
.dd-tf-card.warned{box-shadow:var(--e-4),0 0 0 3px color-mix(in srgb,var(--warn) 26%,transparent)}
.dd-tf-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}
.dd-tf-title{font-size:14px;font-weight:600;color:var(--ink)}
.dd-tf-meta{font-size:11px;color:var(--ink3)}
.dd-tf-dirty{
  font-size:10.5px;color:var(--warn);padding:2px 7px;border-radius:999px;
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--warn) 40%,transparent);
}
.dd-tf-seg{display:flex;gap:2px;padding:2px;background:var(--sunken);border-radius:var(--rx-1);box-shadow:var(--e-well)}
.dd-tf-chip{
  padding:3px 10px;border-radius:var(--rx-1);font-size:11.5px;color:var(--ink3);
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease);
}
.dd-tf-chip.on{color:var(--ink);background:var(--raised);box-shadow:var(--e-1)}
.dd-tf-body{flex:1 1 auto;min-height:0;display:flex;overflow:hidden}
.dd-tf-paper{
  flex:1 1 auto;min-height:0;overflow:auto;padding:22px 26px;
  background:var(--panel);border-radius:var(--rx-2);box-shadow:inset 0 0 0 .5px var(--line);
}
.dd-tf-area{
  flex:1 1 auto;min-height:0;width:100%;resize:none;overflow:auto;
  background:var(--panel);color:var(--ink);border:none;outline:none;
  box-shadow:inset 0 0 0 .5px var(--line);border-radius:var(--rx-2);
  font-family:var(--f-mono);font-size:12.5px;line-height:1.8;padding:18px 20px;white-space:pre-wrap;
}
.dd-tf-area.serif{font-family:var(--serif);font-size:14.5px}
.dd-tf-area.mono{font-family:var(--f-mono);font-size:12px}
.dd-tf-warn{
  display:flex;align-items:center;gap:10px;padding:7px 11px;border-radius:var(--rx-1);
  font-size:12px;color:var(--warn);
  background:color-mix(in srgb,var(--warn) 10%,transparent);
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--warn) 35%,transparent);
}
`)

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
     * 创意简报：一份**文档**，也是这一阶段唯一能改的东西。
     *
     * 简报用**统一的文本编辑组件**（`Editable`）：读态是 markdown 排版的正文，
     * 点那段字就地编辑（失焦即存），长文在**放大窗口**里改。
     *
     * 以前这里自己手写了一套编辑器（读态/编辑态两套 DOM + 两套状态），
     * 结果就是「每处各写一套」——跳、抖、和别处不一致。
     */
    function ConceiveView(props) {
      const { data, busy, actions } = props
      const brief = data.brief || {}
      const work = data.work || {}
      const text = brief.text || ''
      /** 空态那枚「写第一版简报」按钮靠它把字段推进编辑态（**手动触发**）。 */
      const [signal, setSignal] = useState(0)

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
            brief.exists
              ? null
              : h('div', { className: 'dd-empty', style: { padding: '38px 20px' } },
                h('div', { className: 'dd-empty-title' }, '还没有简报'),
                h('div', null, 'conceive 的出口是 creative/brief.md。写下来，它就存在了。'),
                h('div', { style: { marginTop: '14px' } },
                  h('button', {
                    className: 'dd-btn primary', disabled: busy,
                    onClick: () => setSignal(signal + 1),
                  }, '写第一版简报'))),
            h(Editable, {
              label: '简报',
              labelTitle: 'creative/brief.md（markdown）',
              value: text,
              multiline: true,
              serif: true,
              markdown: true,
              disabled: busy,
              placeholder: '# 简报\n\n一句话故事…',
              editSignal: signal,
              emptyHint: h('span', { className: 'dd-tf-empty' }, '（空）'),
              onSave: value => actions.editBrief(value),
            }),
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
                        // 参考图的生图提示词是**只读展示**（不是这一阶段能改的字段），
                        // 但排版要与别处的 markdown 读态一致——否则同一段字两种长相。
                        ? h('div', { className: 'rp dd-md', style: { marginTop: '5px' } }, h(MarkdownLite, { text: asset.prompt }))
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
              // 台词是**作品内容**：用文学字族（`docs/dev/ui-language.md` U1）。
              serif: true,
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
     * 「重新编译 / 校验过期 / 丢弃手工改写」是**动作**，留在工具条上；
     * 「编辑」不是动作，是**另一种看法**——所以它用统一的文本编辑组件
     * （`Editable`）：点那些字就地编辑，失焦即存，长文在放大窗口里改。
     *
     * 提示词**不开 markdown**：它是给模型看的源码，要原样读出来；
     * 按 markdown 渲染会把它的换行结构吃掉。
     */
    function PromptEditor(props) {
      const { shot, prompt, busy, actions } = props
      const text = prompt && prompt.text ? prompt.text : ''
      const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length
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
        text !== ''
          ? h(Editable, {
            label: '提示词',
            labelTitle: '这一镜的提示词产物（可改；重新编译会保留你的版本）',
            value: text,
            multiline: true,
            mono: true,
            markdown: false,
            disabled: busy,
            onSave: value => actions.savePrompt(shot.id, value),
          })
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
      const { detail, loading, onClose, busy, actions, workspaceId, onOpenImage, sheet, onSelectShot, panelControls } = props
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
            h('span', { className: 'dd-spacer' }),
            panelControls,
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
          panelControls,
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

    /** 一条消息里的推理文本（宿主的「轨迹」视图里叫 reasoning）。 */
    function reasoningOf(message) {
      const content = message === undefined || message === null ? undefined : message.content
      if (!Array.isArray(content)) return ''
      const parts = []
      for (const block of content) {
        if (block !== null && typeof block === 'object' && block.type === 'reasoning' && typeof block.text === 'string') {
          parts.push(block.text)
        }
      }
      return parts.join('\n')
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

    /**
     * 这条用户消息是不是**注入的上下文**（而不是人写的话）。
     *
     * 判据刻意保守：以 markdown 一级标题开头、且明显很长。
     * 人写的话极少长这样；认错了也只是多一次点击展开。
     *
     * @param {string} text
     * @returns {boolean}
     */
    function isInjectedContext(text) {
      const value = String(text ?? '')
      if (value.length < 200) return false
      return /^#{1,3}\s+\S/.test(value)
    }

    /**
     * 一条对话行。
     *
     * `kind === 'context'` 是**注入的上下文**（长期记忆、别的插件塞的资料）——
     * 它不是人写的话，所以**默认折起来**，只露一个标题。
     */
    function MsgRow(props) {
      const { kind, text } = props
      const [open, setOpen] = useState(false)
      const isContext = kind === 'context'
      const long = kind !== 'tool' && typeof text === 'string' && text.length > 420
      const title = isContext ? (String(text).split('\n')[0].replace(/^#+\s*/, '') || '上下文') : ''
      const shown = isContext
        ? (open ? text : '')
        : (long && !open ? text.slice(0, 420) + '…' : text)
      return h('div', { className: 'dd-msg ' + kind },
        h('div', { className: 'who' },
          isContext ? '上下文' : kind === 'user' ? '我' : kind === 'assistant' ? 'AI' : kind === 'tool' ? '工具' : '出错'),
        isContext
          ? h('button', {
            className: 'dd-ctx-head',
            type: 'button',
            title: '宿主注入的上下文（默认折起）',
            onClick: () => setOpen(!open),
          },
            h(Icon, { name: 'chevron', size: 12 }),
            h('span', { className: 'nm' }, title),
            h('span', { className: 'dd-note' }, open ? '收起' : '展开'),
          )
          : null,
        isContext
          ? (open ? h('div', { className: 'body' }, shown) : null)
          : h('div', { className: 'body' }, shown),
        long && !isContext
          ? h('button', {
            className: 'dd-btn sm ghost',
            style: { alignSelf: 'flex-start' },
            onClick: () => setOpen(!open),
          }, open ? '收起' : '展开全文')
          : null,
      )
    }

    /**
     * 「处理过程」：一组工具调用 / 推理，**默认折叠**。
     *
     * 这是宿主对话面板里「轨迹」视图的轻量版。折叠起来是因为导演要的是
     * 「它说了什么」，不是「它调了七次工具」；但那七次工具调用**必须能看见**
     * ——「AI 一句话没说就停了」是最让人困惑的现象。
     */
    function ChatProcess(props) {
      const { steps } = props
      const [open, setOpen] = useState(false)
      if (!Array.isArray(steps) || steps.length === 0) return null
      const running = steps.some(step => step.status === 'run')
      const failed = steps.some(step => step.status === 'fail')
      return h('div', { className: 'dd-process' + (open ? ' open' : '') },
        h('button', {
          className: 'dd-process-head',
          type: 'button',
          onClick: () => setOpen(!open),
          title: open ? '收起处理过程' : '展开处理过程',
        },
          h(Icon, { name: 'chevron', size: 12 }),
          h('span', null, running ? '正在处理…' : '处理过程'),
          h('span', { className: 'dd-process-count num' }, steps.length + ' 步'),
          failed ? h('span', { className: 'dd-badge fail' }, '有失败') : null,
        ),
        open
          ? h('div', { className: 'dd-process-body' },
            steps.map(step => h('div', { key: step.key, className: 'dd-process-step ' + step.status },
              h('span', { className: 'dot ' + step.status }),
              h('span', { className: 'nm' }, step.name),
              step.detail ? h('span', { className: 'dt' }, step.detail) : null,
              // 这一步改的文件：**看得见**，不用去目录里翻 mtime。
              step.path ? h('span', { className: 'dp' }, '改 ' + step.path) : null,
            )))
          : null,
      )
    }

    /**
     * 模型 / 推理强度。
     *
     * 复用宿主的**同一个真源**（`agentDefaultModel`）——不是插件自己存一份。
     * 改的是**宿主的默认选择**，所以对**新开的会话**生效；当前这段会话
     * 用的是它自己开起来时的模型（界面里写清楚了，不含糊）。
     *
     * 形状是**一个两字段的表单**：先选模型、再选档位、最后「应用」——
     * 而不是「一点就立刻写宿主」。理由：档位是**每个模型自己的**，
     * 换了模型而档位还留着，宿主会拒（不支持的 effort 在发请求前就被拒）。
     * 所以两边一起选、一起应用。
     */
    function ChatModelMenu(props) {
      const { hostModel, providers, onChange, onClose } = props
      const [open, setOpen] = useState(false)
      /** 菜单里**正在挑**的选择（还没写进宿主）。 */
      const [pickedProvider, setPickedProvider] = useState('')
      const [pickedModel, setPickedModel] = useState('')
      const [pickedEffort, setPickedEffort] = useState('')
      /** 当前选中的**那个模型**的推理档位目录（按需问宿主一次）。 */
      const [efforts, setEfforts] = useState([])
      const [effortsFor, setEffortsFor] = useState('')
      const list = Array.isArray(providers) ? providers : []

      const hostProvider = hostModel && hostModel.provider ? hostModel.provider : ''
      const hostModelId = hostModel && hostModel.model ? hostModel.model : ''
      const hostEffort = hostModel && hostModel.reasoningEffort ? hostModel.reasoningEffort : ''

      // 菜单打开时，先把「正在挑的」对齐到宿主当前的选择。
      useEffect(() => {
        if (!open) return
        setPickedProvider(hostProvider)
        setPickedModel(hostModelId)
        setPickedEffort(hostEffort)
      }, [open, hostProvider, hostModelId, hostEffort])

      const catalogKey = pickedProvider !== '' && pickedModel !== '' ? pickedProvider + '/' + pickedModel : ''

      // 问一次「这个模型有哪些档位」。
      //
      // **档位是每个模型自己的**（同一个 provider 下，A 模型给 low/high/max，
      // B 模型只给 medium），所以不能写死——**问适配器**（`llm.resolveModelInfo`）。
      // 这条路径可能去问 provider，所以**按需**：菜单开着才问，不进轮询。
      useEffect(() => {
        if (!open || catalogKey === '' || catalogKey === effortsFor) return
        let cancelled = false
        const [provider, model] = catalogKey.split('/')
        apiGet('model-info', { provider, model })
          .then(value => {
            if (cancelled) return
            setEffortsFor(catalogKey)
            setEfforts(value && Array.isArray(value.efforts) ? value.efforts : [])
          })
          .catch(() => {
            if (cancelled) return
            setEffortsFor(catalogKey)
            setEfforts([])
          })
        return () => { cancelled = true }
      }, [open, catalogKey, effortsFor])

      // 换模型 → 档位重来（旧的档位可能不支持）。
      const chooseModel = (providerId, modelId) => {
        setPickedProvider(providerId)
        setPickedModel(modelId)
        setPickedEffort('')
      }

      const apply = () => {
        if (pickedProvider === '' || pickedModel === '') return
        onChange(pickedProvider, pickedModel, pickedEffort)
        setOpen(false)
      }

      const modelLabel = hostModelId === '' ? '—' : hostModelId
      const levelLabel = hostEffort === '' ? '默认' : hostEffort

      const panel = open
        ? h('div', { className: 'dd-pop' },
          h('div', { className: 'dd-pop-title' }, '模型（宿主的默认选择）'),
          list.length === 0
            ? h('div', { className: 'dd-note' }, '这个宿主没有公布模型目录。')
            : list.map(entry => h('div', { key: entry.id, className: 'dd-pop-group' },
              h('div', { className: 'dd-pop-lab' }, entry.name || entry.id),
              (entry.models || []).map(model => h('button', {
                key: model.id,
                type: 'button',
                className: 'dd-pop-item' + (pickedProvider === entry.id && pickedModel === model.id ? ' on' : ''),
                onClick: () => chooseModel(entry.id, model.id),
              }, model.name || model.id)),
            )),
          h('div', { className: 'dd-pop-title' }, '推理强度'),
          // 档位来自**这个模型自己的目录**（问适配器，不写死）。
          efforts.length > 0
            ? h('div', { className: 'dd-pop-efforts' },
              efforts.map(entry => h('button', {
                key: entry.id,
                className: 'dd-pop-effort' + (pickedEffort === entry.id ? ' on' : ''),
                type: 'button',
                title: entry.description,
                onClick: () => setPickedEffort(entry.id),
              },
                h('span', { className: 'nm' }, entry.name),
                h('span', { className: 'id num' }, entry.id),
              )),
              h('button', {
                className: 'dd-pop-effort' + (pickedEffort === '' ? ' on' : ''),
                type: 'button',
                title: '让模型用它自己的默认档位',
                onClick: () => setPickedEffort(''),
              }, h('span', { className: 'nm' }, '默认')),
            )
            : h('div', { className: 'dd-note' },
              catalogKey === '' ? '先选一个模型。' : '这个模型没有公布推理档位（或者宿主没答上来）。'),
          h('div', { className: 'dd-pop-foot' },
            h('button', {
              className: 'dd-btn sm primary',
              type: 'button',
              disabled: pickedProvider === '' || pickedModel === '',
              onClick: apply,
            }, '应用'),
            h('button', { className: 'dd-btn sm', type: 'button', onClick: () => setOpen(false) }, '取消'),
          ),
          h('div', { className: 'dd-note' }, '改的是**宿主的默认选择**：新开的会话会用它。当前这段会话仍用开起来时的模型。'),
        )
        : null

      return h('div', { className: 'dd-pop-wrap' },
        h('button', {
          className: 'dd-chip click dd-chat-model',
          type: 'button',
          title: '模型与推理强度',
          onClick: () => setOpen(value => !value),
        }, h(Icon, { name: 'settings', size: 12 }), h('span', null, modelLabel), h('span', { className: 'lv' }, '· ' + levelLabel)),
        panel,
      )
    }

    /**
     * 会话选择：同一�� DSH 工作区里的会话。
     *
     * 对话是**固定在一个工作区**里发生的（一个短剧项目 = 一个 DSH 工作区），
     * 所以这里列的就是那个工作区里的会话——不是全局的会话列表。
     */
    function ChatSessionMenu(props) {
      const { sessions, current, onPick, onClose } = props
      const [open, setOpen] = useState(false)
      const list = Array.isArray(sessions) ? sessions : []
      const panel = open
        ? h('div', { className: 'dd-pop' },
          h('div', { className: 'dd-pop-title' }, '这个作品里的对话'),
          list.length === 0
            ? h('div', { className: 'dd-note' }, '这个工作区里还没有别的会话。')
            : list.map(entry => h('button', {
              key: entry.id,
              className: 'dd-pop-item' + (entry.id === current ? ' on' : ''),
              onClick: () => { onPick(entry.id); setOpen(false) },
            },
              h('span', { className: 'nm' }, entry.title || '（未命名会话）'),
              h('span', { className: 'dt num' }, entry.id.slice(0, 8)),
            )),
        )
        : null
      return h('div', { className: 'dd-pop-wrap' },
        h('button', {
          className: 'dd-btn sm',
          type: 'button',
          title: '切换对话（同一个短剧工作区里的会话）',
          onClick: () => setOpen(value => !value),
        }, '对话'),
        panel,
      )
    }

    /**
     * Agent 向用户提问。
     *
     * **回答是直接回传给 agent 的**，走宿主那条 Remote 通道：
     * `ctx.remote.userQuestions.answer(sessionId, callId, { answers: [{ id, selected }] })`。
     * 这不是插件自己造的路——**就是宿主对话面板用的那一条**
     * （`docs/dev/dsh-integration.md` D1：不许自己折叠会话事件去仿造宿主的行为）。
     *
     * 通道不在（老宿主 / 没有那个服务）时，退回「复制答案 + 去完整对话里答」，
     * **而不是**留一个点了没反应的按钮。
     */
    function ChatQuestion(props) {
      const { question, options, items, callId, sessionId, onOpenHost } = props
      const [picked, setPicked] = useState({})
      const [copied, setCopied] = useState(false)
      const [state, setState] = useState('idle')
      const list = Array.isArray(items) && items.length > 0 ? items : [{ id: '', question, options }]

      const toggle = (itemId, label) => {
        setCopied(false)
        setPicked(current => {
          const chosen = current[itemId] ?? []
          return {
            ...current,
            [itemId]: chosen.includes(label)
              ? chosen.filter(item => item !== label)
              : chosen.concat(label),
          }
        })
      }

      const answerText = Object.keys(picked)
        .map(itemId => picked[itemId].join('；'))
        .filter(text => text !== '')
        .join(' / ')

      const copy = () => {
        if (answerText === '') return
        try {
          if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
            void navigator.clipboard.writeText(answerText)
          }
        } catch {
          // 剪贴板不可用就算了：下面那行字还能手动选中复制。
        }
        setCopied(true)
      }

      /** 把答案回传给 agent。 */
      const submit = async () => {
        // 宿主的回答通道：`remote.userQuestions.answer(sessionId, callId, { answers })`。
        // 插件在作用域里**显式 inject** 了它（见 90-panel.js 的 inject 列表）——
        // Cordis 对带点的服务路径有静态保护，不 inject 就取不到。
        let channel
        try {
          const remote = CTX ? CTX.get('remote') : undefined
          channel = remote !== undefined && remote !== null ? remote.userQuestions : undefined
        } catch {
          channel = undefined
        }
        if (channel === undefined || typeof channel.answer !== 'function') {
          setState('nochannel')
          return
        }
        const answers = list
          .filter(item => (picked[item.id] ?? []).length > 0)
          .map(item => ({ id: item.id, selected: picked[item.id] }))
        if (answers.length === 0) return
        setState('sending')
        try {
          await channel.answer(sessionId, callId, { answers })
          setState('sent')
        } catch {
          setState('failed')
        }
      }

      const canSubmit = list.some(item => (picked[item.id] ?? []).length > 0)

      return h('div', { className: 'dd-question' },
        h('div', { className: 'dd-question-head' },
          h(Icon, { name: 'note', size: 13 }),
          h('span', null, 'AI 需要你回答'),
        ),
        list.map((item, index) => h('div', { key: item.id || ('q' + index), className: 'dd-question-item' },
          list.length > 1 ? h('div', { className: 'dd-question-q' }, item.question) : null,
          (item.options || []).length > 0
            ? h('div', { className: 'dd-question-opts' },
              item.options.map(option => h('button', {
                key: option.label,
                className: 'dd-question-opt' + ((picked[item.id] ?? []).includes(option.label) ? ' on' : ''),
                type: 'button',
                onClick: () => toggle(item.id, option.label),
              },
                h('span', { className: 'nm' }, option.label),
                option.description ? h('span', { className: 'dt' }, option.description) : null,
              )))
            : null,
        )),
        answerText !== ''
          ? h('div', { className: 'dd-question-answer' },
            h('span', { className: 'dd-note' }, '你的选择：'),
            h('span', { className: 'dd-question-answer-text' }, answerText))
          : null,
        h('div', { className: 'dd-question-foot' },
          h('button', {
            className: 'dd-btn sm primary',
            type: 'button',
            disabled: !canSubmit || state === 'sending' || state === 'sent',
            onClick: () => { void submit() },
          }, state === 'sending' ? '回传中…' : state === 'sent' ? '已回传' : '回传答案'),
          h('button', {
            className: 'dd-btn sm',
            type: 'button',
            disabled: !canSubmit,
            onClick: copy,
          }, copied ? '已复制' : '复制答案'),
          h('button', {
            className: 'dd-btn sm',
            type: 'button',
            title: '在宿主自己的对话面板里回答（那里有原生的提问卡片）',
            onClick: onOpenHost,
          }, '在完整对话里回答'),
        ),
        state === 'sent'
          ? h('div', { className: 'dd-note dd-question-hint' }, '答案已经回传给 agent 了。')
          : state === 'failed'
            ? h('div', { className: 'dd-note dd-question-hint' }, '回传没成功（agent 可能已经不等了）。可以复制答案，去完整对话里回。')
            : state === 'nochannel'
              ? h('div', { className: 'dd-note dd-question-hint' }, '这个宿主没有把提问的回答通道开给插件，所以这里只能复制答案、去完整对话里回。')
              : null,
      )
    }

    /**
     * 构思会话面板。
     *
     * **它不画一个仿造的聊天界面。** 会话是真的（真模型、真工具、
     * `drama-conceive` 技能、工作目录就是这个作品目录），这里把
     * 宿主已经折叠好的会话窗口按「谁说的」摊开，并把输入框接到
     * `session.prompt()` 上。要看完整对话（工具卡片、推理、审批），
     * 一个按钮跳回宿主自己的对话面板。
     *
     * 复用宿主能力的三处：**模型与推理强度**（同一个 `agentDefaultModel` 真源）、
     * **会话目录**（Host 半边按工作区过滤过的清单）、
     * **处理过程与提问**（宿主事件流里的工具调用与提问，按可折叠 / 可回答呈现）。
     */
    function ConceiveChat(props) {
      const {
        sessionId, seed, onClose, onFresh, onStart, canStart, busy,
        settings, panelControls, onSwitchSession, onGoto, dshWorkspaceId,
      } = props
      const [reference, setReference] = useState(null)
      const [error, setError] = useState(null)
      const [draft, setDraft] = useState('')
      const [starting, setStarting] = useState(false)
      /** 这段会话的「开场白」送出去了没有（送过就不再重复）。 */
      const seeded = useRef(false)
      const flowRef = useRef(null)
      /** 面板当前在看哪一段会话（默认是这个作品的构思会话）。 */
      const [viewSession, setViewSession] = useState(sessionId)
      /** 这个短剧工作区里的会话清单。 */
      const [sessionList, setSessionList] = useState([])

      useEffect(() => { setViewSession(sessionId) }, [sessionId])

      // 会话清单：只在窗口打开时拉一次（它是**清单**，不是某一镜的判定）。
      useEffect(() => {
        let cancelled = false
        apiGet('sessions').then(value => {
          if (cancelled) return
          setSessionList(value && Array.isArray(value.sessions) ? value.sessions : [])
        }).catch(() => { if (!cancelled) setSessionList([]) })
        return () => { cancelled = true }
      }, [])

      const activeId = viewSession
      useEffect(() => {
        if (!activeId) return undefined
        const sessions = CTX ? CTX.get('sessions') : undefined
        if (sessions === undefined || sessions === null || typeof sessions.retain !== 'function') {
          setError('这个宿主没有 sessions 服务：构思会话需要 DSH 桌面版或 dsh web。')
          return undefined
        }
        let current
        try {
          current = sessions.retain(activeId, { source: 'controllerOperation' })
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
      }, [activeId])

      const binding = reference === null ? undefined : reference.binding
      const snapshot = useStore(binding === undefined ? undefined : binding.session)
      const window_ = useStore(binding === undefined ? undefined : binding.eventSource)

      /**
       * 抹掉**我们自己的开场白**。
       *
       * 开场白是**上下文**，不是用户说的话。宿主可能把它拆成独立的一条用户
       * 消息（那样 `<system-reminder>` 的标签就跟着不见了，`stripInjected` 抓不到）。
       * 所以这里按**原文精确剔除**——只剔除我们自己塞进去的那一段。
       *
       * @param {string} text
       * @returns {string}
       */
      const stripSeed = useCallback(text => {
        let out = String(text ?? '')
        if (typeof seed === 'string' && seed !== '') {
          out = out.split(seed).join('')
        }
        return out.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim()
      }, [seed])

      /**
       * 事件流 → 界面上的行。
       *
       * 三种行：**消息**（我说的话 / 它说的话）、**处理过程**（一组工具调用与推理，
       * 默认折叠）、**提问**（Agent 要人回答）。
       */
      const rows = useMemo(() => {
        const entries = window_ !== undefined && Array.isArray(window_.entries) ? window_.entries : []
        const out = []
        let streaming = ''
        let process = null
        const flush = () => {
          if (process !== null) { out.push(process); process = null }
        }
        const pushStep = step => {
          if (process === null) {
            process = { kind: 'process', key: 'p' + step.key, steps: [step] }
            return
          }
          process.steps.push(step)
        }
        const findStep = callId => {
          const pools = [process]
          for (const row of out) if (row.kind === 'process') pools.push(row)
          for (const pool of pools) {
            if (pool === null || pool === undefined) continue
            for (const step of pool.steps) if (step.callId === callId) return step
          }
          return undefined
        }

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
            flush()
            const text = stripSeed(stripInjected(textOf(event.data)))
            if (text === '') continue
            // **注入的上下文要折起来。**
            //
            // 宿主（ReMe 的长期记忆、其它插件注入的资料）会把上下文**作为一条
            // 用户消息**塞进来。宿主自己的对话面板会把它折成「上下文」节点，
            // 我们这扇小窗没有那套节点——于是用户看到的是一整屏记忆原文，
            // 自己的话被埋在下面。
            //
            // 判据要**保守**：以 markdown 一级标题开头、且明显很长——
            // 人写的话极少长这样。认错了也只是多一次点击展开。
            if (isInjectedContext(text)) {
              out.push({ kind: 'context', text, key: 'c' + event.seq })
              continue
            }
            out.push({ kind: 'user', text, key: 'u' + event.seq })
            continue
          }

          if (event.type === 'assistant/message') {
            const message = event.data ? event.data.message : undefined
            const text = textOf(message)
            const thinking = reasoningOf(message)
            if (thinking !== '') {
              pushStep({ key: 'r' + event.seq, name: '思考', detail: thinking.slice(0, 120), status: 'done' })
            }
            if (text !== '') {
              flush()
              out.push({ kind: 'assistant', text, key: 'a' + event.seq })
            }
            continue
          }

          if (event.type === 'tool/call') {
            const data = event.data || {}
            const name = typeof data.name === 'string' ? data.name : 'tool'
            const args = typeof data.arguments === 'string' ? data.arguments : ''
            // **Agent 向用户提问**：单独成一张卡，不混进「处理过程」。
            if (name === 'ask_user_question') {
              flush()
              const parsed = parseQuestion(args)
              out.push({
                kind: 'question',
                key: 'q' + event.seq,
                callId: data.callId,
                question: parsed.question,
                options: parsed.options,
                items: parsed.items,
              })
              continue
            }
            pushStep({
              key: 't' + event.seq,
              callId: data.callId,
              name,
              detail: args.slice(0, 90),
              status: 'run',
              // **这一步改了哪个文件。**
              //
              // 「看不到产出的资产改动」是用户点名的一条痛点：agent 改完了东西，
              // 侧栏里**一个字都没留下**——你只能去作品目录里翻 mtime。
              // 工具调用的参数里就有路径，直接读出来。
              path: writtenPathOf(name, args),
            })
            continue
          }

          if (event.type === 'tool/result') {
            const data = event.data || {}
            const callId = data.message && typeof data.message.toolCallId === 'string' ? data.message.toolCallId : undefined
            const step = findStep(callId)
            if (step !== undefined) step.status = data.error ? 'fail' : 'done'
            continue
          }

          if (event.type === 'turn/end') {
            flush()
            const reason = event.data ? event.data.reason : undefined
            if (reason !== undefined && reason !== null && reason.kind === 'error') {
              const why = reason.error && typeof reason.error.message === 'string' ? reason.error.message : '这一轮失败了'
              out.push({ kind: 'err', text: why, key: 'e' + event.seq })
            }
            continue
          }
        }
        if (streaming !== '') out.push({ kind: 'assistant', text: streaming, key: 'live' })
        flush()
        return out
      }, [window_, stripSeed])

      const running = snapshot !== undefined && snapshot.running === true
      const openState = snapshot === undefined ? undefined : snapshot.openState

      /**
       * **这一轮对话改掉了哪些文件。**
       *
       * 「看不到产出的资产改动」是用户点名的一条痛点：agent 改完了东西，
       * 侧栏里一个字都没留下。工具调用里有路径，这里把它们收成一张清单，
       * 摆在消息流的最上面——**改了什么，一眼就看到**。
       */
      const changedPaths = useMemo(() => {
        const seen = new Set()
        const out = []
        for (const row of rows) {
          if (row.kind !== 'process') continue
          for (const step of row.steps) {
            if (step.path === undefined || seen.has(step.path)) continue
            seen.add(step.path)
            out.push(step.path)
          }
        }
        return out
      }, [rows])

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
        && activeId === sessionId
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

      /**
       * 宿主某个**视图**的槽 id。
       *
       * `binding.activate()` 认的是**槽 id**（`conversation.view` 的条目 id），
       * 而 `uiConversation.views` 那边给的是**目标名**——两者不是一回事，
       * 写死一个字符串就是猜。所以从槽注册表里取：
       * `ctx.slots.entriesOfSlot('conversation.view')` → `options.id`。
       *
       * @param {string} want 目标名的一小段（大小写无关）
       * @returns {string|undefined}
       */
      const resolveViewId = useCallback((want) => {
        try {
          const slots = CTX ? CTX.get('slots') : undefined
          if (slots === undefined || slots === null || typeof slots.entriesOfSlot !== 'function') return undefined
          const entries = slots.entriesOfSlot('conversation.view')
          for (const entry of entries) {
            const id = entry && entry.options ? entry.options.id : undefined
            if (typeof id === 'string' && id.toLowerCase().includes(want)) return id
          }
        } catch {
          // 取不到就用默认视图。
        }
        return undefined
      }, [])

      /**
       * 打开宿主的完整对话面板；带 `view` 时**先切到宿主自己的那个视图**。
       *
       * 这就是「把 DSH 原生的聊天主界面轻量嵌入」在这套架构里**能做到的形态**：
       * 宿主没有公开的槽渲染 API（`ctx.slots` 只有 register / registerFactory /
       * inject），所以插件**搬不动**它那些渲染器；但宿主的**会话装配**
       * （`ctx.uiConversation`）是可达的——插件可以把「这段会话、这个视图」
       * 交给宿主，让宿主自己渲染。
       *
       * 于是：会话窗里点「轨迹」→ 宿主打开**这段会话的原生轨迹视图**。
       * 那份轨迹（工具卡片、推理、审批、提问卡）比我们这扇小窗渲染得好得多，
       * 所以**不复刻它，而是把它请过来**。
       */
      const openInPanel = useCallback((view) => {
        if (view !== undefined && activeId !== undefined) {
          try {
            const uc = CTX ? CTX.get('uiConversation') : undefined
            const binding = uc !== undefined && uc !== null && typeof uc.binding === 'function'
              ? uc.binding(activeId)
              : undefined
            if (binding !== undefined && binding !== null && typeof binding.activate === 'function') {
              // **视图 id 从槽注册表取**，不写死。
              //
              // `activate()` 认的是 `conversation.view` 的**条目 id**，
              // 而 `uiConversation.views` 给的是**目标名**——两者不是一回事。
              // `ctx.slots.entriesOfSlot('conversation.view')` → `options.id` 才是对的。
              const viewId = resolveViewId(view)
              binding.activate(viewId === undefined ? view : viewId)
            }
          } catch {
            // 切不过去就算了：面板照常能打开，只是停在默认视图。
          }
        }
        const helper = CTX ? CTX.get('uiWorkspace') : undefined
        const layout = CTX ? CTX.get('layout') : undefined
        try {
          // **先选工作区，再开会话。**
          //
          // 只调 `openSession` 的话，宿主不知道该选哪个工作区——
          // 对话面板会停在「选择一个工作区开始」的空态。
          //
          // `openWorkspace(id, beforeOpen)` 的第二个参数是**宿主的钩子**
          // （它拿 `nextId` 去做草稿搬迁）。把「打开我们这段会话」挂在这个钩子里：
          // 工作区被选上的同时，会话也被打开——只调 `openSession` 的话，
          // 宿主不知道该选哪个工作区，对话面板会停在「选择一个工作区开始」。
          const workspaceId = dshWorkspaceId
          if (workspaceId !== undefined && workspaceId !== ''
            && helper !== undefined && helper !== null && typeof helper.openWorkspace === 'function') {
            // **先开会话，再选工作区。**
            //
            // `openWorkspace(id, beforeOpen)` 的第二个参数是**宿主的钩子**
            // （它拿 `nextId` 去做草稿搬迁），不是「替我打开某个会话」。
            // 真正把会话放进面板的是 `openSession`。
            //
            // 顺序也不能反：工作区切换会把会话选择重置掉，所以**会话要先选**，
            // 工作区随后（工作区里就这一个会话时，宿主的默认也是它）。
            if (typeof helper.openSession === 'function') helper.openSession(activeId)
            helper.openWorkspace(workspaceId, () => {})
          } else if (helper !== undefined && helper !== null && typeof helper.openSession === 'function') {
            helper.openSession(activeId)
          }
          if (layout !== undefined && layout !== null && typeof layout.selectPanel === 'function') layout.selectPanel('conversation')
        } catch {
          // 打不开就算了：面板里这段对话照常能聊。
        }
      }, [activeId, dshWorkspaceId])

      /** 改宿主默认模型（模型 + 推理强度）。 */
      const changeModel = useCallback(async (provider, model, effort) => {
        try {
          await apiPost('update-settings', {
            hostProvider: provider,
            hostModel: model,
            hostReasoningEffort: effort,
          })
          say('已改宿主默认模型：新开的会话会用它', 'ok')
        } catch (problem) {
          say(problem instanceof Error ? problem.message : String(problem), 'err')
        }
      }, [])

      const hasSession = activeId !== undefined
      const hostModel = settings ? settings.hostModel : undefined
      const providers = settings ? settings.providers : undefined

      /**
       * 打开一个被改过的文件 → 落到它**能被看见**的那个阶段。
       *
       * 这就是「页面联动」在聊天窗里的样子：agent 改完 `creative/brief.md`，
       * 你在消息流里点一下「改 creative/brief.md」，**直接落到创意阶段的简报**——
       * 而不是自己再去找一遍那个文件在哪个视图里。
       */
      const onOpenPath = useCallback(path => {
        if (typeof onGoto !== 'function') return
        const p = String(path ?? '').replace(/\\/g, '/')
        const stage = p.includes('creative/') || p.includes('brief.md') ? 'conceive'
          : p.includes('characters') ? 'characters'
            : p.includes('scenes') ? 'script'
              : p.includes('shots') ? 'storyboard'
                : p.includes('refs/') ? 'characters'
                  : 'generate'
        onGoto(stage)
      }, [onGoto])

      const head = h('div', { className: 'dd-chat-head' },
        h(Icon, { name: 'note', size: 14 }),
        h('div', { className: 'dd-chat-title' },
          h('div', { className: 'ch-t' }, '构思会话'),
          h('div', { className: 'ch-sub' },
            !hasSession ? '还没开始——点下面「开始对话」'
              : openState === 'open' ? (running ? '正在想…' : '等你说话')
                : openState === 'loading' ? '正在打开…'
                  : openState === 'error' ? '打不开这段会话'
                    : '准备中…'),
        ),
        h('span', { className: 'dd-spacer' }),
        hostModel
          ? h(ChatModelMenu, {
            hostModel,
            providers,
            onChange: changeModel,
          })
          : null,
        h(ChatSessionMenu, {
          sessions: sessionList,
          current: activeId,
          onPick: id => setViewSession(id),
        }),
        h('button', {
          className: 'dd-btn sm', onClick: onFresh, disabled: !hasSession || busy,
          title: '开一段新对话（旧的那段仍留在 DSH 的会话列表里）',
        }, '新对话'),
        h('button', {
          className: 'dd-btn sm', onClick: () => openInPanel('trajectory'), disabled: !hasSession,
          title: '打开宿主的原生轨迹视图（工具卡片、推理、审批都在那边）',
        }, '轨迹'),
        h('button', {
          className: 'dd-btn sm', onClick: () => openInPanel(), disabled: !hasSession,
          title: '在宿主的对话面板里打开完整聊天',
        }, '完整对话'),
        panelControls,
        h('button', { className: 'dd-icon-btn', onClick: onClose, title: '收起这扇窗（顶栏的图标能再展开）' }, h(Icon, { name: 'close', size: 13 })),
      )

      const flow = h('div', { className: 'dd-chat-flow', ref: flowRef },
        // 本轮改动：摆在最上面，**改了什么一眼就看到**。
        changedPaths.length > 0
          ? h('div', { className: 'dd-changed' },
            h('div', { className: 'dd-changed-head' },
              h(Icon, { name: 'edit', size: 12 }),
              h('span', null, '这一轮改掉了'),
              h('span', { className: 'ct num' }, String(changedPaths.length)),
              h('span', { className: 'dd-spacer' }),
              h('span', { className: 'dd-note' }, '点一下去看')),
            h('div', { className: 'dd-changed-list' },
              changedPaths.map(path => h('button', {
                key: path,
                className: 'dd-changed-item',
                type: 'button',
                title: path,
                onClick: () => onOpenPath(path),
              }, path))),
          )
          : null,
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
          : rows.map(row => {
            if (row.kind === 'process') return h(ChatProcess, { key: row.key, steps: row.steps })
            if (row.kind === 'question') {
              return h(ChatQuestion, {
                key: row.key,
                question: row.question,
                options: row.options,
                items: row.items,
                callId: row.callId,
                sessionId: activeId,
                onOpenHost: openInPanel,
              })
            }
            return h(MsgRow, { key: row.key, kind: row.kind, text: row.text })
          }),
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
          h('span', { className: 'hint' }, activeId === undefined ? '' : activeId.slice(0, 8)),
        ),
      )

      return h('div', { className: 'dd-chat' }, head, flow, composer)
    }

    /**
     * 这个工具调用**写了哪个文件**。
     *
     * 宿主那几个写文件的工具（`write` / `edit` / `multi_edit` / `create_directory`…）
     * 都把路径放在参数里，键名不统一（`path` / `file_path` / `path`…），
     * 所以这里**认工具 + 扫参数**两条路都走。
     *
     * 认不出来就返回 `undefined`——**不猜**：编一个路径出来比没有更糟。
     *
     * @param {string} name 工具名
     * @param {string} args 参数（JSON 字符串）
     * @returns {string|undefined}
     */
    function writtenPathOf(name, args) {
      const writers = ['write', 'edit', 'multi_edit', 'create_directory', 'apply_patch', 'write_file']
      if (!writers.includes(name)) return undefined
      let parsed
      try {
        parsed = JSON.parse(String(args ?? ''))
      } catch {
        return undefined
      }
      if (parsed === null || typeof parsed !== 'object') return undefined
      for (const key of ['path', 'file_path', 'filePath', 'target', 'absolute_path']) {
        const value = parsed[key]
        if (typeof value === 'string' && value !== '') return value
      }
      return undefined
    }

    /**
     * 解析 `ask_user_question` 的参数。
     *
     * 参数是**工具自己约定的形状**，所以这里**容错**：认不出来就给一句原文，
     * 绝不假装解析成功。
     *
     * 回传答案要用到**每个问题的 id**（`answers: [{ id, selected }]`），
     * 所以这里把 id 一起解析出来。
     *
     * @param {string} args
     * @returns {{question: string, options: Array<{label: string, description?: string}>, items: Array<{id: string, question: string, options: Array<{label: string}>}>}}
     */
    function parseQuestion(args) {
      const fallback = { question: String(args ?? '').slice(0, 400), options: [], items: [] }
      let parsed
      try {
        parsed = JSON.parse(String(args ?? ''))
      } catch {
        return fallback
      }
      if (parsed === null || typeof parsed !== 'object') return fallback
      const questions = Array.isArray(parsed.questions) ? parsed.questions : []
      if (questions.length === 0) return fallback

      const items = []
      for (const entry of questions) {
        if (entry === null || typeof entry !== 'object') continue
        const options = Array.isArray(entry.options)
          ? entry.options
            .filter(option => option !== null && typeof option === 'object' && typeof option.label === 'string')
            .map(option => ({ label: option.label, description: typeof option.description === 'string' ? option.description : undefined }))
          : []
        const parts = [
          typeof entry.header === 'string' ? entry.header : '',
          typeof entry.question === 'string' ? entry.question : '',
          typeof entry.detail === 'string' ? entry.detail : '',
        ].filter(part => part !== '')
        items.push({
          id: typeof entry.id === 'string' ? entry.id : '',
          question: parts.join(' · '),
          options,
        })
      }
      if (items.length === 0) return fallback
      const first = items[0]
      return { question: first.question === '' ? fallback.question : first.question, options: first.options, items }
    }

    // ── 构思会话窗的样式 ──────────────────────────────────────────────────
    CSS_PARTS.push(`
/* ── 构思会话窗 ───────────────────────────────────────────────────────── */
/* 头部挤不下时**换行**，绝不把中文标题压成一列（docs/dev/rendering.md R5）。 */
.dd-chat-head{display:flex;align-items:center;gap:9px;padding:11px 14px;box-shadow:0 1px 0 var(--line);flex:none;flex-wrap:wrap}
.dd-chat-title{flex:1 1 132px;min-width:132px}
.dd-chat-title .ch-t{font-size:12.5px;font-weight:600}
.dd-chat-title .ch-sub{font-size:10.5px;color:var(--ink3);font-family:var(--f-mono)}
/* 处理过程：默认折叠，但**必须看得见**（「AI 一句话没说就停了」最让人困惑）。 */
.dd-process{
  border-radius:var(--rx-2);background:var(--panel-2);overflow:hidden;
  box-shadow:inset 0 0 0 .5px var(--line);
}
.dd-process-head{
  display:flex;align-items:center;gap:7px;width:100%;padding:6px 10px;
  font-size:11.5px;color:var(--ink3);text-align:left;
}
.dd-process-head:hover{color:var(--ink)}
.dd-process-head .dd-icon-btn,.dd-process-head svg{transition:transform var(--t-fast) var(--ease)}
.dd-process.open .dd-process-head>svg:first-child{transform:rotate(90deg)}
.dd-process-count{margin-left:auto;font-size:10px;color:var(--ink4)}
.dd-process-body{display:flex;flex-direction:column;gap:3px;padding:2px 10px 8px}
.dd-process-body>*{flex:0 0 auto}
.dd-process-step{display:flex;align-items:baseline;gap:7px;font-size:11px;color:var(--ink3)}
.dd-process-step .dot{width:5px;height:5px;border-radius:50%;flex:none;background:var(--ink4)}
.dd-process-step .dot.done{background:var(--sig-pass)}
.dd-process-step .dot.run{background:var(--hot)}
.dd-process-step .dot.fail{background:var(--sig-fail)}
.dd-process-step .nm{font-family:var(--f-mono);font-size:10.5px;color:var(--ink2)}
.dd-process-step .dt{
  font-family:var(--f-mono);font-size:10px;color:var(--ink4);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;
}

/* 弹出层（模型 / 会话）：贴在触发器下面。 */
.dd-pop-wrap{position:relative;flex:none}
.dd-pop{
  position:absolute;right:0;top:calc(100% + 6px);z-index:30;width:min(300px,78vw);
  display:flex;flex-direction:column;gap:4px;padding:9px 10px;
  border-radius:var(--rx-2);background:var(--raised);box-shadow:var(--e-4);
  max-height:min(420px,60vh);overflow:auto;
}
.dd-pop>*{flex:0 0 auto}
.dd-pop-title{
  font-family:var(--f-gauge);font-size:9px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--ink3);padding:4px 2px 1px;
}
.dd-pop-lab{font-size:11px;color:var(--ink3);padding:3px 2px}
.dd-pop-item{
  display:flex;align-items:baseline;gap:8px;width:100%;padding:5px 8px;border-radius:var(--rx-1);
  font-size:12px;color:var(--ink2);text-align:left;
}
.dd-pop-item:hover{background:var(--sunken);color:var(--ink)}
.dd-pop-item.on{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-pop-item .nm{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-pop-item .dt{font-family:var(--f-mono);font-size:10px;color:var(--ink4);flex:none}
.dd-pop-row{display:flex;gap:6px;align-items:center}
.dd-pop-row input{
  flex:1 1 auto;min-width:0;height:26px;padding:0 9px;border-radius:var(--rx-1);
  background:var(--sunken);box-shadow:var(--e-well);border:none;outline:none;
  font-family:var(--f-mono);font-size:11.5px;color:var(--ink);
}
/* 推理档位：按**当前模型自己的目录**列出来，不写死。 */
.dd-pop-efforts{display:flex;flex-direction:column;gap:2px}
.dd-pop-effort{
  display:flex;align-items:baseline;gap:8px;width:100%;padding:5px 8px;border-radius:var(--rx-1);
  text-align:left;font-size:12px;color:var(--ink2);
}
.dd-pop-effort:hover{background:var(--sunken);color:var(--ink)}
.dd-pop-effort.on{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-pop-effort .nm{flex:1 1 auto;min-width:0}
.dd-pop-effort .id{font-size:10px;color:var(--ink4);flex:none}
.dd-pop-foot{display:flex;gap:7px;align-items:center;margin-top:6px;padding-top:6px;box-shadow:0 -1px 0 var(--line)}
.dd-chat-model{gap:6px;max-width:150px;min-width:0}
.dd-chat-model>span:not(.lv){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-chat-model .lv{font-family:var(--f-mono);font-size:10px;color:var(--ink4);flex:none}

/* 注入的上下文：默认只露一个标题，像宿主对话面板的「上下文」节点。 */
.dd-msg.context{background:transparent;box-shadow:none;padding:0}
.dd-msg.context .who{color:var(--ink4)}
.dd-ctx-head{
  display:flex;align-items:center;gap:7px;width:100%;padding:5px 9px;
  border-radius:var(--rx-1);font-size:11px;color:var(--ink3);text-align:left;
  box-shadow:inset 0 0 0 .5px var(--line);background:var(--panel-2);
}
.dd-ctx-head:hover{color:var(--ink);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-ctx-head .nm{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-msg.context .body{
  margin-top:5px;box-shadow:inset 0 0 0 .5px var(--line);background:var(--panel-2);
  font-size:11.5px;color:var(--ink3);max-height:280px;overflow:auto;
}
/* Agent 向用户提问。 */
.dd-question{
  border-radius:var(--rx-2);padding:10px 12px;display:flex;flex-direction:column;gap:8px;
  background:color-mix(in srgb,var(--hot) 8%,var(--raised));
  box-shadow:inset 0 0 0 .5px var(--hot-line);
}
.dd-question>*{flex:0 0 auto}
.dd-question-head{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--hot);font-weight:600}
.dd-question-text{font-size:12.5px;line-height:1.7;color:var(--ink)}
.dd-question-item{display:flex;flex-direction:column;gap:6px}
.dd-question-q{font-size:12.5px;line-height:1.7;color:var(--ink)}
.dd-question-opts{display:flex;flex-direction:column;gap:5px}
.dd-question-opt{
  display:flex;flex-direction:column;gap:2px;align-items:flex-start;text-align:left;
  padding:6px 9px;border-radius:var(--rx-1);
  box-shadow:inset 0 0 0 .5px var(--line);font-size:12px;color:var(--ink2);
}
.dd-question-opt:hover{color:var(--ink);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-question-opt.on{color:var(--ink);box-shadow:inset 0 0 0 1px var(--hot-line);background:color-mix(in srgb,var(--hot) 10%,transparent)}
.dd-question-opt .nm{font-weight:600}
.dd-question-opt .dt{font-size:11px;color:var(--ink3)}
.dd-question-foot{display:flex;gap:7px;align-items:center}
.dd-question-answer{display:flex;align-items:baseline;gap:6px;min-width:0}
.dd-question-answer-text{
  font-size:12px;color:var(--ink);min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.dd-question-hint{font-size:10.5px;line-height:1.6}

/* **本轮改动**：agent 改了什么，摆在消息流的最上面。 */
.dd-changed{
  display:flex;flex-direction:column;gap:6px;padding:9px 11px;border-radius:var(--rx-2);
  background:color-mix(in srgb,var(--sig-pass) 7%,var(--raised));
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-pass) 30%,transparent);
}
.dd-changed>*{flex:0 0 auto}
.dd-changed-head{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--ink2)}
.dd-changed-head .ct{font-family:var(--f-mono);font-size:10.5px;color:var(--sig-pass)}
.dd-changed-list{display:flex;flex-direction:column;gap:3px}
.dd-changed-item{
  display:block;width:100%;text-align:left;padding:3px 7px;border-radius:var(--rx-1);
  font-family:var(--f-mono);font-size:10.5px;color:var(--ink3);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.dd-changed-item:hover{color:var(--hot);background:var(--sunken)}
/* 处理过程里那一行的「改了哪个文件」。 */
.dd-process-step .dp{
  font-family:var(--f-mono);font-size:10px;color:var(--sig-pass);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;
}
`)

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
      const { spec, tab, onTab, stage, onStage, onGoto } = props
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
            ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px' } },
              h('select', { className: 'dd-input', value: stage, onChange: event => onStage(event.target.value) },
                h('option', { value: '' }, '全部阶段'),
                STAGES.map(entry => h('option', { value: entry.id, key: entry.id }, entry.en))),
              // 规范与阶段之间也该连着：看完一条铁律，直接去它管的那个阶段。
              stage !== '' && typeof onGoto === 'function'
                ? h('button', {
                  className: 'dd-btn sm',
                  type: 'button',
                  title: '去「' + (STAGE_LABEL[stage] || stage) + '」阶段',
                  onClick: () => onGoto(stage),
                }, '去这个阶段')
                : null,
            )
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

    /**
     * 行内标记：`code` / **粗体** / *斜体*。
     *
     * 返回的是**元素数组**（不是字符串），所以 React 能正确地渲染它。
     *
     * @param {string} text 一行纯文本
     * @returns {Array<string|object>}
     */
    function mdInline(text) {
      const source = String(text ?? '')
      const pieces = []
      const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*)/g
      let last = 0
      let key = 0
      let match
      while ((match = pattern.exec(source)) !== null) {
        if (match.index > last) pieces.push(source.slice(last, match.index))
        const token = match[0]
        if (token.startsWith('`')) {
          pieces.push(h('code', { key: 'i' + (key++), className: 'md-code' }, token.slice(1, -1)))
        } else if (token.startsWith('**') || token.startsWith('__')) {
          pieces.push(h('strong', { key: 'i' + (key++), className: 'md-strong' }, token.slice(2, -2)))
        } else {
          pieces.push(h('em', { key: 'i' + (key++), className: 'md-em' }, token.slice(1, -1)))
        }
        last = match.index + token.length
      }
      if (last < source.length) pieces.push(source.slice(last))
      return pieces
    }

    /**
     * 一个 markdown 渲染器：小，但**够读**。
     *
     * 够读的意思是：标题、段落、列表（含**折行续接**）、有序列表、引用、
     * 表格、代码块、分隔线，以及行内的 `code` / **粗体** / *斜体*。
     *
     * 「列表项折行」这一条是照着《文本编辑组件最佳实践》来的：说明类文本里
     * 一条 bullet 经常被手工折成两行（第二行缩进两个空格）。不接上的话，
     * 它会被渲染成一段独立的段落——读起来像「这条 bullet 后面跟了一句无关的话」。
     *
     * @param {{text?: string}} props
     */
    function MarkdownLite(props) {
      const lines = String(props.text ?? '').split(/\r?\n/)
      const blocks = []
      let i = 0
      /** 上一块是不是列表——用来接住被折行的续行。 */
      let listOpen = false

      while (i < lines.length) {
        const line = lines[i]

        // 空行
        if (line.trim() === '') { listOpen = false; i++; continue }

        // 代码块
        if (/^\s*```/.test(line)) {
          listOpen = false
          const code = []
          i++
          while (i < lines.length && !/^\s*```/.test(lines[i])) { code.push(lines[i]); i++ }
          i++
          blocks.push(h('pre', { key: 'c' + blocks.length, className: 'md-pre' }, code.join('\n')))
          continue
        }

        // 表格
        if (/^\s*\|/.test(line)) {
          listOpen = false
          const rows = []
          while (i < lines.length && /^\s*\|/.test(lines[i])) {
            rows.push(lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim()))
            i++
          }
          const isDivider = row => row.every(cell => /^:?-{2,}:?$/.test(cell))
          const head = rows.find(row => !isDivider(row))
          const body = rows.filter(row => row !== head && !isDivider(row))
          if (head !== undefined) {
            blocks.push(h('table', { className: 'dd-table md-table', key: 't' + blocks.length },
              h('thead', null, h('tr', null, head.map((cell, index) => h('th', { key: index }, mdInline(cell))))),
              h('tbody', null, body.map((row, index) => h('tr', { key: index },
                row.map((cell, cellIndex) => h('td', { key: cellIndex }, mdInline(cell)))))),
            ))
          }
          continue
        }

        // 分隔线
        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
          listOpen = false
          blocks.push(h('hr', { key: 'hr' + blocks.length }))
          i++
          continue
        }

        // 标题
        const heading = /^\s*(#{1,4})\s+(.*)$/.exec(line)
        if (heading !== null) {
          listOpen = false
          const level = heading[1].length
          blocks.push(h(level <= 2 ? 'h4' : 'h5', { key: 'hd' + blocks.length, className: 'md-h' }, mdInline(heading[2])))
          i++
          continue
        }

        // 引用
        if (/^\s*>\s?/.test(line)) {
          listOpen = false
          const quoted = []
          while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
            quoted.push(lines[i].replace(/^\s*>\s?/, ''))
            i++
          }
          blocks.push(h('blockquote', { key: 'q' + blocks.length, className: 'md-quote' },
            h('p', null, mdInline(quoted.join(' ')))))
          continue
        }

        // 列表（无序 / 有序）
        const bullet = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
        if (bullet !== null) {
          const ordered = /\d/.test(bullet[2])
          const items = []
          while (i < lines.length) {
            const entry = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i])
            if (entry === null) break
            items.push(entry[3])
            i++
            // **折行续接**：缩进两格以上的行是上一条的续行。
            while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
              items[items.length - 1] += ' ' + lines[i].trim()
              i++
            }
          }
          blocks.push(h(ordered ? 'ol' : 'ul', { key: 'l' + blocks.length, className: 'md-list' },
            items.map((item, index) => h('li', { key: index }, mdInline(item)))))
          listOpen = true
          continue
        }

        // 段落：连续的普通行合成一段。
        const paragraph = []
        while (i < lines.length
          && lines[i].trim() !== ''
          && !/^\s*(\||[-*+]\s|\d+[.)]\s|```|#{1,4}\s|>\s?)/.test(lines[i])) {
          paragraph.push(lines[i].trim())
          i++
        }
        listOpen = false
        if (paragraph.length === 0) { i++; continue }
        blocks.push(h('p', { key: 'p' + blocks.length, className: 'md-p' }, mdInline(paragraph.join(' '))))
      }
      void listOpen
      return h('div', { className: 'md-root' }, blocks)
    }

    // ── markdown 的排版 ──────────────────────────────────────────────────
    // 样式跟着渲染器走：读态预览、规范视图、放大窗口共用同一套排版。
    CSS_PARTS.push(`
.md-root{min-width:0}
.md-root>*:first-child{margin-top:0}
.md-root>*:last-child{margin-bottom:0}
.md-p{margin:.4em 0;font-size:12.5px;line-height:1.75;color:var(--ink2)}
.md-h{font-size:13.5px;font-weight:600;margin:.75em 0 .3em;color:var(--ink);line-height:1.4}
.md-root h5.md-h{font-size:12.5px}
.md-list{margin:.4em 0;padding-left:1.45em}
.md-list li{margin:.18em 0;font-size:12.5px;line-height:1.75;color:var(--ink2)}
.md-quote{
  border-left:2px solid var(--hot);margin:.55em 0;padding:.1em 0 .1em .75em;color:var(--ink2);
}
.md-quote p{margin:0;font-size:12.5px;line-height:1.75}
.md-pre{
  font-family:var(--f-mono);font-size:11px;line-height:1.6;background:var(--sunken);
  padding:9px 11px;border-radius:var(--rx-1);overflow:auto;margin:.55em 0;
  box-shadow:inset 0 0 0 .5px var(--line);white-space:pre;
}
.md-table{margin:.55em 0;font-size:11.5px}
.md-code{font-family:var(--f-mono);font-size:.92em;background:var(--sunken);padding:.1em .35em;border-radius:4px}
.md-strong{color:var(--ink);font-weight:600}
.md-em{color:var(--ink3)}
.md-root hr{border:0;border-top:.5px solid var(--line);margin:.8em 0}
`)

    // ── assets / ledger ────────────────────────────────────────────────────
    //
    // 资产管理是工作台的主要职能之一。以前这一页是**一个只读的表格**——
    // 资产多起来之后（一百多个），没人能从里面看出「这个作品里有什么」。
    //
    // 现在有三样东西：
    //   ① **分类索引**：按类型 / 状态分组，角标上带数量与体积；
    //   ② **便捷预览**：图片资产直接有缩略图，点开就是大图；
    //   ③ **分页**：作品再大，DOM 里也只有一页那么多行。

    /** 资产类型的中文名。看不认识的类型就原样显示，不猜。 */
    const ASSET_TYPE_LABEL = {
      reference_image: '参考图',
      keyframe: '关键帧',
      prompt: '提示词',
      video: '视频',
      audio: '音频',
      report: '报告',
      doc: '文档',
    }

    /** 一页多少行。DOM 里只留这么多节点。 */
    const ASSET_PAGE_SIZE = 50
    const LEDGER_PAGE_SIZE = 50

    /** 能出缩略图的类型。 */
    function isImageAsset(asset) {
      return asset.type === 'reference_image' || asset.type === 'keyframe'
    }

    /**
     * 一个「上一页 / 下一页」的分页条。
     *
     * @param {{page: number, pages: number, total: number, size: number, onPage: Function}} props
     */
    function Pager(props) {
      const { page, pages, total, size, onPage } = props
      if (total === 0) return null
      const from = page * size + 1
      const to = Math.min(total, (page + 1) * size)
      return h('div', { className: 'dd-pager' },
        h('span', { className: 'dd-note num' }, from + '–' + to + ' / ' + total + ' 条'),
        h('span', { className: 'dd-spacer' }),
        h('button', {
          className: 'dd-btn sm', disabled: page <= 0, onClick: () => onPage(page - 1),
        }, '上一页'),
        h('span', { className: 'dd-note num' }, (page + 1) + ' / ' + pages),
        h('button', {
          className: 'dd-btn sm', disabled: page >= pages - 1, onClick: () => onPage(page + 1),
        }, '下一页'),
      )
    }

    function AssetsView(props) {
      const { assets, onOpenImage, workspaceId, onGoto } = props
      const [typeFilter, setTypeFilter] = useState('')
      const [statusFilter, setStatusFilter] = useState('')
      const [query, setQuery] = useState('')
      const [needle, setNeedle] = useState('')
      const [page, setPage] = useState(0)

      // 搜索**防抖**：每敲一个键都重算整张表是白费力气。
      useEffect(() => {
        const timer = setTimeout(() => setNeedle(query.trim().toLowerCase()), 180)
        return () => clearTimeout(timer)
      }, [query])

      const rows = assets && Array.isArray(assets.assets) ? assets.assets : []

      /** 分类索引：每类的数量与体积。**一次算完**，不要每次渲染重算。 */
      const groups = useMemo(() => {
        const map = new Map()
        for (const asset of rows) {
          const key = String(asset.type || 'other')
          const entry = map.get(key) ?? { type: key, count: 0, bytes: 0 }
          entry.count += 1
          entry.bytes += typeof asset.bytes === 'number' ? asset.bytes : 0
          map.set(key, entry)
        }
        const list = [...map.values()]
        list.sort((a, b) => b.count - a.count)
        return list
      }, [rows])

      const statusCounts = useMemo(() => ({
        deprecated: rows.filter(row => row.status === 'deprecated').length,
        missing: rows.filter(row => row.missing === true).length,
      }), [rows])

      /** 过滤后的清单。 */
      const filtered = useMemo(() => {
        const out = []
        for (const asset of rows) {
          if (typeFilter !== '' && String(asset.type || 'other') !== typeFilter) continue
          if (statusFilter === 'deprecated' && asset.status !== 'deprecated') continue
          if (statusFilter === 'missing' && asset.missing !== true) continue
          if (needle !== '') {
            const hay = [asset.id, asset.path, asset.notes, asset.role, asset.shotId]
              .filter(part => typeof part === 'string')
              .join(' ')
              .toLowerCase()
            if (!hay.includes(needle)) continue
          }
          out.push(asset)
        }
        return out
      }, [rows, typeFilter, statusFilter, needle])

      const pages = Math.max(1, Math.ceil(filtered.length / ASSET_PAGE_SIZE))
      const current = Math.min(page, pages - 1)
      const visible = filtered.slice(current * ASSET_PAGE_SIZE, (current + 1) * ASSET_PAGE_SIZE)

      // 换了筛选条件就回到第一页——否则会停在一个不存在的页码上。
      useEffect(() => { setPage(0) }, [typeFilter, statusFilter, needle])

      if (!assets) return h('div', { className: 'dd-empty' }, '正在读取资产…')

      const totals = assets.totals || {}
      const typeChip = (key, label, count, bytes) => h('button', {
        key: key,
        className: 'dd-facet' + (typeFilter === key ? ' on' : ''),
        type: 'button',
        title: key === '' ? '全部类型' : label + ' · ' + count + ' 个 · ' + formatBytes(bytes),
        onClick: () => setTypeFilter(typeFilter === key && key !== '' ? '' : key),
      },
        h('span', { className: 'nm' }, label),
        h('span', { className: 'ct num' }, String(count)),
        key !== '' && bytes > 0 ? h('span', { className: 'by num' }, formatBytes(bytes)) : null,
      )

      const statusChip = (key, label, count) => h('button', {
        key: key,
        className: 'dd-facet' + (statusFilter === key ? ' on' : ''),
        type: 'button',
        onClick: () => setStatusFilter(statusFilter === key ? '' : key),
      },
        h('span', { className: 'nm' }, label),
        h('span', { className: 'ct num' }, String(count)),
      )

      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-toolbar' },
          h('span', { className: 'dd-chip' }, '共 ', h('b', { className: 'num' }, String(totals.count !== undefined ? totals.count : rows.length)), ' 个'),
          h('span', { className: 'dd-chip' }, '作废 ', h('b', { className: 'num' }, String(totals.deprecated !== undefined ? totals.deprecated : statusCounts.deprecated))),
          h('span', { className: 'dd-chip' }, '缺失 ', h('b', { className: 'num' }, String(totals.missing !== undefined ? totals.missing : statusCounts.missing))),
          h('span', { className: 'dd-chip' }, '占用 ', h('b', { className: 'num' }, formatBytes(totals.bytes !== undefined ? totals.bytes : 0))),
          h('span', { className: 'dd-spacer' }),
          h('input', {
            className: 'dd-input dd-asset-search',
            value: query,
            placeholder: '按 id / 路径 / 备注找…',
            onChange: event => setQuery(event.target.value),
          }),
        ),
        // 分类索引：一行类型，一行状态。
        h('div', { className: 'dd-facets' },
          h('div', { className: 'dd-facet-row' },
            h('span', { className: 'dd-facet-lab' }, '类型'),
            typeChip('', '全部', rows.length, 0),
            groups.map(group => typeChip(
              group.type,
              ASSET_TYPE_LABEL[group.type] || group.type,
              group.count,
              group.bytes,
            )),
          ),
          h('div', { className: 'dd-facet-row' },
            h('span', { className: 'dd-facet-lab' }, '状态'),
            statusChip('', '全部', rows.length),
            statusChip('deprecated', '作废', statusCounts.deprecated),
            statusChip('missing', '缺失', statusCounts.missing),
          ),
        ),
        h('div', { className: 'dd-scroll' },
          visible.length === 0
            ? h('div', { className: 'dd-empty' }, '这里没有资产。')
            : h('table', { className: 'dd-table dd-asset-table' },
              h('thead', null, h('tr', null,
                h('th', { className: 'th-thumb' }, ''),
                h('th', null, '资产'), h('th', null, '类型'), h('th', null, '状态'),
                h('th', { className: 'n' }, '引用'), h('th', { className: 'n' }, '尺寸'), h('th', { className: 'n' }, '体积'), h('th', null, '路径'),
              )),
              h('tbody', null, visible.map(asset => h('tr', { key: asset.id },
                h('td', { className: 'td-thumb' },
                  isImageAsset(asset) && asset.missing !== true
                    ? h('button', {
                      className: 'dd-asset-thumb',
                      type: 'button',
                      'aria-label': '打开 ' + asset.id,
                      title: '打开 ' + asset.id,
                      onClick: () => onOpenImage(asset),
                    }, h('img', {
                      src: assetImageUrl(workspaceId, asset.id),
                      alt: asset.id,
                      loading: 'lazy',
                      onError: event => { event.currentTarget.style.visibility = 'hidden' },
                    }))
                    : h('span', { className: 'dd-asset-thumb ph' }, (ASSET_TYPE_LABEL[asset.type] || asset.type || '·').slice(0, 1)),
                ),
                h('td', null, asset.id),
                h('td', null, ASSET_TYPE_LABEL[asset.type] || asset.type || '—'),
                h('td', null,
                  h('span', { style: { color: asset.status === 'deprecated' ? 'var(--warn)' : 'var(--ok)' } }, asset.status || 'active'),
                  asset.missing ? h('span', { style: { color: 'var(--danger)', marginLeft: '5px' } }, '缺失') : null,
                ),
                h('td', { className: 'n' },
                  // 引用它的镜头：**点一下就跳到那一镜**。
                  // 资产页与生成台之间本来是断的——找到问题资产，却找不到它出现在哪一镜。
                  (asset.referencedBy || []).length === 0
                    ? '—'
                    : h('span', { className: 'dd-refs' },
                      (asset.referencedBy || []).slice(0, 3).map(shotId => h('button', {
                        key: shotId,
                        className: 'dd-ref',
                        type: 'button',
                        title: '跳到 ' + shotId,
                        onClick: () => { if (typeof onGoto === 'function') onGoto('generate', shotId) },
                      }, shotId)),
                      (asset.referencedBy || []).length > 3
                        ? h('span', { className: 'dd-note' }, '+' + ((asset.referencedBy || []).length - 3))
                        : null,
                    )),
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
        h(Pager, {
          page: current,
          pages,
          total: filtered.length,
          size: ASSET_PAGE_SIZE,
          onPage: setPage,
        }),
      )
    }

    function LedgerView(props) {
      const { ledger, onGoto } = props
      const [statusFilter, setStatusFilter] = useState('')
      const [page, setPage] = useState(0)
      const totals = ledger && ledger.totals ? ledger.totals : {}
      const entries = ledger && Array.isArray(ledger.entries) ? ledger.entries : []

      const groups = useMemo(() => {
        const map = new Map()
        for (const entry of entries) {
          const key = String(entry.status || 'unknown')
          map.set(key, (map.get(key) || 0) + 1)
        }
        return [...map.entries()].sort((a, b) => b[1] - a[1])
      }, [entries])

      const filtered = useMemo(() => {
        if (statusFilter === '') return entries
        return entries.filter(entry => String(entry.status || 'unknown') === statusFilter)
      }, [entries, statusFilter])

      const pages = Math.max(1, Math.ceil(filtered.length / LEDGER_PAGE_SIZE))
      const current = Math.min(page, pages - 1)
      const visible = filtered.slice(current * LEDGER_PAGE_SIZE, (current + 1) * LEDGER_PAGE_SIZE)
      useEffect(() => { setPage(0) }, [statusFilter])

      // **早退必须在所有 hook 之后。**
      //
      // 以前这里写着「`if (!ledger) return …`」然后才写 `useMemo`——
      // 于是第一次渲染（还没数据）hook 少两个，第二次渲染（数据到了）hook 多两个，
      // React 直接报 #310（渲染的 hook 比上一次多），
      // **整个面板崩成空白**（`docs/dev/rendering.md` R7 的那条教训）。
      //
      // 现在：hook 全在前，无条件跑；数据没到就早退。
      if (!ledger) return h('div', { className: 'dd-empty' }, '正在读取台账…')

      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-toolbar' },
          h('span', { className: 'dd-chip' }, '任务 ', h('b', { className: 'num' }, String(totals.tasks !== undefined ? totals.tasks : entries.length))),
          h('span', { className: 'dd-chip' }, '花费 ', h('b', { className: 'num' }, '$' + formatNumber(totals.costUsd || 0, 2))),
          ledger.budget
            ? h('span', { className: 'dd-chip' }, '预算 ', h('b', { className: 'num' }, '$' + formatNumber(ledger.budget.limit_usd || 0, 2)),
              ' · 已用 ', h('b', { className: 'num' }, '$' + formatNumber(ledger.budget.spent_usd || 0, 2)))
            : null,
          h('span', { className: 'dd-spacer' }),
          h('span', { className: 'dd-note' }, '幂等三步：台账 → 提交 → 立刻回写'),
        ),
        h('div', { className: 'dd-facets' },
          h('div', { className: 'dd-facet-row' },
            h('span', { className: 'dd-facet-lab' }, '状态'),
            h('button', {
              className: 'dd-facet' + (statusFilter === '' ? ' on' : ''), type: 'button',
              onClick: () => setStatusFilter(''),
            }, h('span', { className: 'nm' }, '全部'), h('span', { className: 'ct num' }, String(entries.length))),
            groups.map(([key, count]) => h('button', {
              key: key,
              className: 'dd-facet' + (statusFilter === key ? ' on' : ''), type: 'button',
              onClick: () => setStatusFilter(statusFilter === key ? '' : key),
            }, h('span', { className: 'nm' }, key), h('span', { className: 'ct num' }, String(count)))),
          ),
        ),
        h('div', { className: 'dd-scroll' },
          visible.length === 0
            ? h('div', { className: 'dd-empty' }, '台账是空的。')
            : h('table', { className: 'dd-table' },
              h('thead', null, h('tr', null,
                h('th', null, '镜头'), h('th', null, '状态'), h('th', null, '模型'),
                h('th', { className: 'n' }, '时长'), h('th', { className: 'n' }, '费用'),
                h('th', null, '提交时间'), h('th', null, 'task_id'),
              )),
              h('tbody', null, visible.map(entry => h('tr', { key: (entry.taskId || '') + (entry.shotId || '') + (entry.submittedAt || '') },
                h('td', { className: 'n' },
                  // 台账上的镜头**点一下就跳到那一镜**——台账与生成台之间不该是断的。
                  entry.shotId
                    ? h('button', {
                      className: 'dd-ref',
                      type: 'button',
                      title: '跳到 ' + entry.shotId,
                      onClick: () => { if (typeof onGoto === 'function') onGoto('generate', entry.shotId) },
                    }, entry.shotId)
                    : '—'),
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
        h(Pager, {
          page: current,
          pages,
          total: filtered.length,
          size: LEDGER_PAGE_SIZE,
          onPage: setPage,
        }),
      )
    }

    // ── 资产页的样式 ──────────────────────────────────────────────────────
    CSS_PARTS.push(`
/* ── 分类索引 ─────────────────────────────────────────────────────────── */
.dd-facets{display:flex;flex-direction:column;gap:6px;padding:9px 20px 8px;flex:none}
.dd-facets>*{flex:0 0 auto}
.dd-facet-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.dd-facet-lab{
  font-family:var(--f-gauge);font-size:9px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--ink4);flex:none;width:28px;
}
.dd-facet{
  display:inline-flex;align-items:baseline;gap:6px;padding:3px 9px;border-radius:999px;
  font-size:11.5px;color:var(--ink3);box-shadow:inset 0 0 0 .5px var(--line);
  transition:color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease),background var(--t-fast) var(--ease);
}
.dd-facet:hover{color:var(--ink);box-shadow:inset 0 0 0 .5px var(--hot-line)}
.dd-facet.on{color:var(--ink);background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--hot-line)}
.dd-facet .ct{font-family:var(--f-mono);font-size:10.5px;color:var(--ink4)}
.dd-facet.on .ct{color:var(--hot)}
.dd-facet .by{font-family:var(--f-mono);font-size:10px;color:var(--ink4)}
.dd-asset-search{height:26px;width:210px;flex:none}
.dd-asset-table .th-thumb{width:44px}
.dd-asset-table .td-thumb{width:44px;padding:3px 6px}
.dd-asset-thumb{
  display:block;width:36px;height:36px;border-radius:var(--rx-1);overflow:hidden;
  background:var(--sunken);box-shadow:inset 0 0 0 .5px var(--line);cursor:pointer;padding:0;
}
.dd-asset-thumb img{display:block;width:100%;height:100%;object-fit:cover}
.dd-asset-thumb.ph{
  display:grid;place-items:center;font-family:var(--f-gauge);font-size:11px;color:var(--ink4);
  cursor:default;
}
/* 分页条。 */
.dd-pager{
  display:flex;align-items:center;gap:8px;padding:8px 20px;flex:none;
  box-shadow:0 -1px 0 var(--line);background:var(--panel);
}
.dd-pager>*{flex:0 0 auto}
/* 跨页引用：镜头号点一下就跳到那一镜。 */
.dd-refs{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.dd-ref{
  font-family:var(--f-mono);font-size:10.5px;color:var(--ink3);
  padding:1px 6px;border-radius:var(--rx-1);box-shadow:inset 0 0 0 .5px var(--line);
}
.dd-ref:hover{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
`)

    // ── 图片手势的数学（纯函数 · 零 DOM 依赖）──────────────────────────────
    //
    // 「纯函数对了 ≠ 组件对了」。
    //
    // 第一版修法把算出的 pan **写回了拖拽起点**，于是又变成累加——
    // 纯数学模块的用例全绿，实机拖动才暴露（-10/-30/-60/-100 而不是
    // -10/-20/-30/-40）。所以这套算术**单独成一层**：组件只管测量与事件，
    // 算术一律问这里。
    //
    // 坐标系：**中心相对**。图片永远画在视口正中，pan 是它相对视口中心的
    // 偏移。于是「图片不离开视野」的钳位是对称的，缩放锚点也好算。

    /** 缩放范围。 */
    const ZOOM_MIN = 0.1
    const ZOOM_MAX = 16
    /** 每档的倍率（**乘性**：1.1ⁿ）。加性步进会让两端手感不一致。 */
    const ZOOM_STEP = 1.1

    /**
     * 把缩放钳进范围。
     *
     * @param {number} zoom
     * @returns {number}
     */
    function clampZoom(zoom) {
      if (!Number.isFinite(zoom)) return 1
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
    }

    /**
     * 下一档缩放（乘性步进）。
     *
     * @param {number} current 当前缩放
     * @param {number} direction 正数放大、负数缩小
     * @returns {number}
     */
    function nextZoom(current, direction) {
      const base = clampZoom(current)
      return clampZoom(direction >= 0 ? base * ZOOM_STEP : base / ZOOM_STEP)
    }

    /**
     * 缩放百分比（读数用）。
     *
     * @param {number} zoom
     * @returns {string}
     */
    function zoomPercent(zoom) {
      return Math.round(clampZoom(zoom) * 100) + '%'
    }

    /**
     * 给定缩放，图片在视口里能平移多远。
     *
     * 钳位用的是**绘制尺寸**（布局框 × zoom），不是布局框——
     * 放大之后用布局框算，图片能直接拖出屏幕。
     *
     * @param {number} zoom
     * @param {{width: number, height: number}} size 图片的自然尺寸
     * @param {{width: number, height: number}} viewport 视口尺寸
     * @returns {{maxX: number, maxY: number}}
     */
    function clampFor(zoom, size, viewport) {
      const scaledWidth = size.width * zoom
      const scaledHeight = size.height * zoom
      return {
        maxX: Math.max(0, (scaledWidth - viewport.width) / 2),
        maxY: Math.max(0, (scaledHeight - viewport.height) / 2),
      }
    }

    /**
     * 把 pan 钳回「图片永远在视野里」。
     *
     * @param {{x: number, y: number}} pan
     * @param {number} zoom
     * @param {{width: number, height: number}} size
     * @param {{width: number, height: number}} viewport
     * @returns {{x: number, y: number}}
     */
    function clampPan(pan, zoom, size, viewport) {
      const { maxX, maxY } = clampFor(zoom, size, viewport)
      return {
        x: Math.min(maxX, Math.max(-maxX, pan.x)),
        y: Math.min(maxY, Math.max(-maxY, pan.y)),
      }
    }

    /**
     * 以某个点为锚缩放：锚点下的像素保持不动。
     *
     * 锚点同步要用**实际**比值 `next / current`——钳位过之后请求值与实际值
     * 可能不同，用请求值锚点会漂一点。
     *
     * @param {number} zoom 当前缩放
     * @param {{x: number, y: number}} pan 当前位移
     * @param {{x: number, y: number}} point 锚点（相对视口中心）
     * @param {number} factor 倍率
     * @returns {{zoom: number, pan: {x: number, y: number}}}
     */
    function zoomAroundPoint(zoom, pan, point, factor) {
      const current = clampZoom(zoom)
      const next = clampZoom(current * factor)
      if (next === current) return { zoom: next, pan }
      const ratio = next / current
      return {
        zoom: next,
        pan: {
          x: point.x - (point.x - pan.x) * ratio,
          y: point.y - (point.y - pan.y) * ratio,
        },
      }
    }

    /**
     * 拖拽起点。
     *
     * 起点是**只读**的：它持有开始拖动那一刻的 pan 与指针位置，
     * 之后**永不**被本次结果覆盖（覆盖了就变成累加）。
     *
     * @param {{x: number, y: number}} pointer 指针位置
     * @param {{x: number, y: number}} pan 当时的 pan
     * @returns {{pointer: {x: number, y: number}, pan: {x: number, y: number}}}
     */
    function beginDrag(pointer, pan) {
      return {
        pointer: { x: pointer.x, y: pointer.y },
        pan: { x: pan.x, y: pan.y },
      }
    }

    /**
     * 拖拽位移：**绝对式**（起点 + 位移），不是累加。
     *
     * 累加会让 pan 平方增长，几步就撞钳位 ⇒「图片直接跳到最左边」。
     *
     * @param {{pointer: {x: number, y: number}, pan: {x: number, y: number}}} drag 起点
     * @param {{x: number, y: number}} pointer 现在的指针位置
     * @returns {{x: number, y: number}}
     */
    function dragPan(drag, pointer) {
      return {
        x: drag.pan.x + (pointer.x - drag.pointer.x),
        y: drag.pan.y + (pointer.y - drag.pointer.y),
      }
    }

    /**
     * 「适应窗口」的缩放比。
     *
     * @param {{width: number, height: number}} size 图片自然尺寸
     * @param {{width: number, height: number}} viewport 视口尺寸
     * @returns {number}
     */
    function fitZoom(size, viewport) {
      if (size.width <= 0 || size.height <= 0) return 1
      if (viewport.width <= 0 || viewport.height <= 0) return 1
      return Math.min(viewport.width / size.width, viewport.height / size.height)
    }

    // ── image viewer（可缩放 · 可拖动 · 跟手）─────────────────────────────
    //
    // 这一层只做三件事：**测量**（图片多大、视口多大）、**事件**（滚轮 / 拖拽）、
    // **渲染**。算术全在 `84-viewer-zoom.js`（纯函数）。
    //
    // 几条不能省的：
    //  · 尺寸用 `ResizeObserver` 读，**不用 `load` 事件**——缓存命中时 `load`
    //    不再触发，尺寸停在 0，拖拽范围被钉死。
    //  · 缩放只改 `transform`，**不改 width/height**（否则与 ResizeObserver
    //    互相触发）。
    //  · 必须**拒绝浏览器的原生图片拖拽**（Chromium 会吞掉 move 事件）。
    //  · 拖动时**直写 DOM 的 transform**，React 状态每帧至多提交一次——
    //    否则「不跟手」。

    /** 图片预览的样式（跟着组件走）。 */
    CSS_PARTS.push(`
.dd-zoom-stage{
  flex:1 1 auto;min-height:120px;overflow:hidden;position:relative;
  cursor:grab;touch-action:none;user-select:none;
  display:flex;align-items:center;justify-content:center;background:var(--sunken);
}
.dd-zoom-stage.dragging{cursor:grabbing}
.dd-zoom-stage img{
  max-width:100%;max-height:100%;display:block;user-select:none;-webkit-user-drag:none;
  transform-origin:center center;will-change:transform;
}
.dd-zoom-readout{
  font-family:var(--f-mono);font-size:10.5px;color:var(--ink3);
  padding:2px 7px;border-radius:var(--rx-1);background:var(--sunken);
  box-shadow:inset 0 0 0 .5px var(--line);
}
.dd-zoom-hint{
  position:absolute;left:50%;bottom:10px;transform:translateX(-50%);
  font-size:10.5px;color:var(--ink4);pointer-events:none;white-space:nowrap;
}
`)

    function ImageViewer(props) {
      const { asset, src, onClose } = props
      const surfaceRef = useRef(null)
      const imgRef = useRef(null)
      const [zoom, setZoom] = useState(1)
      const [pan, setPan] = useState({ x: 0, y: 0 })
      const [natural, setNatural] = useState({ width: 0, height: 0 })
      /** 拖拽起点（**只读**：它持有开始那一刻的 pan 与指针）。 */
      const dragRef = useRef(null)
      /** 最新视图状态的引用：拖拽过程中读它，不等 React 重渲染。 */
      const viewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 }, natural: { width: 0, height: 0 } })
      viewRef.current = { zoom, pan, natural }
      /** 拖动时直写 DOM 的 transform；这一帧就动。 */
      const paintRef = useRef(null)
      const frameRef = useRef(0)

      /** 视口尺寸（surface 的客户区）。 */
      const viewport = useCallback(() => {
        const box = surfaceRef.current
        if (box === null) return { width: 0, height: 0 }
        return { width: box.clientWidth, height: box.clientHeight }
      }, [])

      /** 把当前视图写进 DOM（拖动时每帧都调）。 */
      const paint = useCallback((nextZoom, nextPan) => {
        const img = imgRef.current
        if (img === null) return
        img.style.transform = 'translate(' + nextPan.x + 'px,' + nextPan.y + 'px) scale(' + nextZoom + ')'
      }, [])

      /**
       * 拖动时的节流提交：**每帧至多一次** React 状态更新。
       *
       * 画面靠直写 DOM 跟手；状态只是给读数与松手后的最终值用的。
       */
      const schedule = useCallback((nextZoom, nextPan) => {
        paint(nextZoom, nextPan)
        if (frameRef.current !== 0) return
        const commit = () => {
          frameRef.current = 0
          setZoom(nextZoom)
          setPan(nextPan)
        }
        if (typeof requestAnimationFrame === 'function') frameRef.current = requestAnimationFrame(commit)
        else commit()
      }, [paint])

      /** 适应窗口。 */
      const applyFit = useCallback(() => {
        const size = viewRef.current.natural
        const box = viewport()
        const next = fitZoom(size, box)
        const clamped = clampPan({ x: 0, y: 0 }, next, size, box)
        setZoom(next)
        setPan(clamped)
        paint(next, clamped)
      }, [paint, viewport])

      /**
       * 尺寸：`ResizeObserver` 观察**图片自己**。
       *
       * 不用 `load` 事件——缓存命中时它不再触发，尺寸会是 0，拖拽恒死。
       * 观察表面（而不是图片）报的是视口尺寸，不是图片尺寸。
       */
      useEffect(() => {
        const img = imgRef.current
        if (img === null) return undefined
        const measure = () => {
          const width = img.naturalWidth || img.width || 0
          const height = img.naturalHeight || img.height || 0
          if (width === 0 || height === 0) return
          const current = viewRef.current
          if (current.natural.width === width && current.natural.height === height) return
          setNatural({ width, height })
          // 第一次量到尺寸 → 适应窗口。
          if (current.natural.width === 0) {
            const box = viewport()
            const next = fitZoom({ width, height }, box)
            setZoom(next)
            setPan({ x: 0, y: 0 })
          }
        }
        measure()
        if (typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(measure)
        observer.observe(img)
        return () => observer.disconnect()
      }, [viewport])

      /** 视口尺寸变了 → 重新钳一次（图片不许跑出视野）。 */
      useEffect(() => {
        const box = surfaceRef.current
        if (box === null || typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(() => {
          const current = viewRef.current
          const clamped = clampPan(current.pan, current.zoom, current.natural, viewport())
          if (clamped.x !== current.pan.x || clamped.y !== current.pan.y) {
            setPan(clamped)
            paint(current.zoom, clamped)
          }
        })
        observer.observe(box)
        return () => observer.disconnect()
      }, [paint, viewport])

      /** 以某个点为锚缩放。 */
      const zoomAt = useCallback((factor, clientX, clientY) => {
        const current = viewRef.current
        const box = surfaceRef.current
        let point = { x: 0, y: 0 }
        if (box !== null && clientX !== undefined && clientY !== undefined) {
          const rect = box.getBoundingClientRect()
          // 锚点换算到「相对视口中心」——pan 的坐标系是中心相对的。
          point = {
            x: clientX - rect.left - rect.width / 2,
            y: clientY - rect.top - rect.height / 2,
          }
        }
        const next = zoomAroundPoint(current.zoom, current.pan, point, factor)
        const clamped = clampPan(next.pan, next.zoom, current.natural, viewport())
        setZoom(next.zoom)
        setPan(clamped)
        paint(next.zoom, clamped)
      }, [paint, viewport])

      /** 滚轮缩放：必须 `passive:false`，否则 `preventDefault` 无效、页面跟着滚。 */
      useEffect(() => {
        const box = surfaceRef.current
        if (box === null) return undefined
        const onWheel = event => {
          event.preventDefault()
          zoomAt(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, event.clientX, event.clientY)
        }
        box.addEventListener('wheel', onWheel, { passive: false })
        return () => box.removeEventListener('wheel', onWheel)
      }, [zoomAt])

      /**
       * 拖动。
       *
       * `pointer` 与 `mouse` **双挂**：某些宿主吞掉其中一套。
       * 双挂不会出错——pan 是**绝对式**的，同一个物理位移算两次结果一样。
       *
       * `move` / `up` 绑在 `window` 上：指针移出图片就会丢事件源，拖拽半途断掉。
       */
      useEffect(() => {
        const box = surfaceRef.current
        if (box === null) return undefined

        const onDown = event => {
          if (event.button !== 0) return
          const current = viewRef.current
          dragRef.current = beginDrag({ x: event.clientX, y: event.clientY }, current.pan)
          box.classList.add('dragging')
        }
        const onMove = event => {
          const drag = dragRef.current
          if (drag === null) return
          const current = viewRef.current
          const raw = dragPan(drag, { x: event.clientX, y: event.clientY })
          const clamped = clampPan(raw, current.zoom, current.natural, viewport())
          schedule(current.zoom, clamped)
        }
        const onUp = () => {
          if (dragRef.current === null) return
          dragRef.current = null
          box.classList.remove('dragging')
          // 拖动结束：把最终值提交进 state，并把读数同步到画面。
          const current = viewRef.current
          const clamped = clampPan(current.pan, current.zoom, current.natural, viewport())
          setPan(clamped)
          paint(current.zoom, clamped)
        }

        box.addEventListener('pointerdown', onDown)
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
        box.addEventListener('mousedown', onDown)
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)

        return () => {
          box.removeEventListener('pointerdown', onDown)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
          box.removeEventListener('mousedown', onDown)
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }
      }, [paint, schedule, viewport])

      /** 键盘：Esc 关闭、方向键平移、+/- 缩放。 */
      useEffect(() => {
        const onKey = event => {
          if (event.key === 'Escape') { event.stopPropagation(); onClose(); return }
          const step = event.shiftKey ? 120 : 60
          const current = viewRef.current
          if (event.key === 'ArrowLeft') { event.preventDefault(); setPan(clampPan({ x: current.pan.x - step, y: current.pan.y }, current.zoom, current.natural, viewport())) }
          else if (event.key === 'ArrowRight') { event.preventDefault(); setPan(clampPan({ x: current.pan.x + step, y: current.pan.y }, current.zoom, current.natural, viewport())) }
          else if (event.key === 'ArrowUp') { event.preventDefault(); setPan(clampPan({ x: current.pan.x, y: current.pan.y - step }, current.zoom, current.natural, viewport())) }
          else if (event.key === 'ArrowDown') { event.preventDefault(); setPan(clampPan({ x: current.pan.x, y: current.pan.y + step }, current.zoom, current.natural, viewport())) }
          else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(ZOOM_STEP) }
          else if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomAt(1 / ZOOM_STEP) }
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [onClose, viewport, zoomAt])

      const item = asset || {}
      const readout = natural.width
        ? natural.width + '×' + natural.height + ' · ' + zoomPercent(zoom) + ' · ' + Math.round(pan.x) + ', ' + Math.round(pan.y)
        : '读取中…'

      return h('div', {
        className: 'dd-modal-backdrop',
        onMouseDown: event => { if (event.target === event.currentTarget) onClose() },
      },
        h('div', { className: 'dd-modal', role: 'dialog', 'aria-modal': 'true' },
          h('div', { className: 'dd-modal-head' },
            h(Icon, { name: 'eye', size: 14 }),
            h('span', { className: 'num', style: { fontSize: '12.5px' } }, item.id || ''),
            h('span', { className: 'dd-spacer' }),
            // 读数既是用户反馈，也是**实机验收的读数**（缩放% · 位移）。
            h('span', { className: 'dd-zoom-readout', title: readout }, readout),
            h('button', { className: 'dd-btn sm', onClick: applyFit, title: '缩放到刚好放得下' }, t('action.fit', '适应窗口')),
            h('button', {
              className: 'dd-btn sm',
              title: '按原始像素显示',
              onClick: () => {
                const current = viewRef.current
                const clamped = clampPan({ x: 0, y: 0 }, 1, current.natural, viewport())
                setZoom(1)
                setPan(clamped)
                paint(1, clamped)
              },
            }, t('action.actualSize', '1:1')),
            h('button', { className: 'dd-icon-btn', onClick: onClose, title: t('action.close', '关闭') },
              h(Icon, { name: 'close', size: 13 })),
          ),
          h('div', {
            className: 'dd-zoom-stage',
            ref: surfaceRef,
            title: readout,
            onDoubleClick: applyFit,
            // 拒绝浏览器的原生图片拖拽：Chromium 会吞掉 move 事件。
            onDragStart: event => event.preventDefault(),
          },
            h('img', {
              ref: imgRef,
              src: props.src,
              alt: item.id || '',
              draggable: false,
              style: { transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')' },
            }),
            h('div', { className: 'dd-zoom-hint' }, '滚轮缩放 · 拖动平移 · 双击适应窗口'),
          ),
          h('div', { className: 'dd-modal-foot' },
            h('span', { className: 'mf' }, '路径 ', h('b', null, item.path || '—')),
            item.source ? h('span', { className: 'mf' }, '来源 ', h('b', null, item.source)) : null,
            item.state ? h('span', { className: 'mf' }, '状态 ', h('b', null, item.state)) : null,
            item.notes ? h('span', { className: 'mf' }, '备注 ', h('b', null, item.notes)) : null,
            item.prompt
              ? h('div', { className: 'dd-modal-prompt' }, item.prompt)
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
                dshWorkspaceId: conceive && conceive.dshWorkspace ? conceive.dshWorkspace.id : undefined,
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
      inject: ['slots', 'locale', 'remote', 'remote.userQuestions', 'uiConversation'],
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
