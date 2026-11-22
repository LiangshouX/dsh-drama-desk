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
  /* 语义别名。--ok / --warn / --danger 这三个名字在十来处样式里被用过
     （未保存胶囊、警告条、产物过期…），但**从来没有定义过** ——
     var() 找不到变量会被静默丢弃，于是那些颜色悄悄变回了正文色，
     看上去像「设计本来就这样」。它们和信号灯是同一套颜色，这里补上别名，
     一处修好全部，而不是去十个地方各改一遍。
     注意：这段是模板字符串，注释里**不许出现反引号**（会提前结束模板）。 */
  --ok:var(--sig-pass);
  --warn:var(--sig-warn);
  --danger:var(--sig-fail);

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

/* 两列 / 三列字段组。
   **列数要跟着「主区有多宽」变，而不是跟着视口。**
   正文区是可伸缩的（右栏能拖宽、构思会话能开着），一边开着 460px 的会话窗时，
   主区只剩 430px —— 那时两列各得 0 份，会把每个字段压到 60px，
   中文直接变成一字一行（实机上看到的是「pa/ss」「姓/名」「fai/l」）。
   媒体查询在这里没用（视口一直很宽），所以用**容器查询**：窄了就折成一列。
   浏览器不支持容器查询时退化成原来的两列/三列，不会更糟。 */
.dd-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dd-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.dd-main{container-type:inline-size}
@container (max-width: 560px){
  .dd-grid2,.dd-grid3{grid-template-columns:1fr}
}
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

/* ── conceive chat ───────────────────────────────────────────────────────
   会话窗里的**内容**全是宿主自己渲染的（消息、工具卡、提问卡、composer），
   所以这里不再有一行气泡样式。盒子本身的样式在 70-chat.js 里跟着组件走。 */

/* ── responsive ──────────────────────────────────────────────────────── */
@container dd-root (max-width: 1240px){
  .dd-home{padding:20px 18px 32px}
  .dd-home-hero{padding:18px 20px;gap:16px}
  .dd-home-hero .h1{font-size:22px}
  .dd-works{grid-template-columns:repeat(auto-fill,minmax(214px,1fr))}
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
    /** 拖动时至少还给主区留这么多，否则侧栏能把内容挤没。 */
    const PANEL_KEEP = 240

    /**
     * 一块可调宽度的侧栏。
     *
     * @param {{storageKey?: string, initial?: number, min?: number, max?: number, label?: string}} options
     */
    function usePanelWidth(options = {}) {
      const { storageKey, initial = 420, min = PANEL_MIN, max = PANEL_MAX, label = '侧栏' } = options
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
      /** 拖动中：只给读数用（读数条要亮起来）。 */
      const [dragging, setDragging] = useState(false)
      const panelRef = useRef(null)
      const dragRef = useRef(null)
      const widthRef = useRef(width)
      widthRef.current = width
      const fullRef = useRef(full)
      fullRef.current = full

      const clamp = useCallback(value => Math.min(max, Math.max(min, value)), [max, min])

      /**
       * 这次拖动实际能到多宽。
       *
       * 上限不能只看常量：侧栏是 flex 子项，父容器的宽度才是硬边界。
       * 以前只按 `PANEL_MAX` 钳位，窗口窄的时候能拖到把主区挤成负宽度。
       */
      const limit = useCallback(() => {
        const box = panelRef.current
        const parent = box === null ? null : box.parentElement
        const available = parent === null ? window.innerWidth : parent.getBoundingClientRect().width
        return Math.max(min, Math.min(max, Math.round(available - PANEL_KEEP)))
      }, [max, min])

      const remember = useCallback(value => {
        if (typeof storageKey !== 'string') return
        try { window.localStorage.setItem(storageKey, String(value)) } catch { /* 存不下就算了 */ }
      }, [storageKey])

      const startResize = useCallback(event => {
        event.preventDefault()
        const box = panelRef.current
        if (box === null) return
        const start = { x: event.clientX, width: box.getBoundingClientRect().width }
        dragRef.current = start
        const hardMax = limit()
        setDragging(true)
        try {
          if (typeof box.setPointerCapture === 'function' && typeof event.pointerId === 'number') {
            box.setPointerCapture(event.pointerId)
          }
        } catch { /* 指针已经没了 */ }

        const onMove = move => {
          const from = dragRef.current
          if (from === null) return
          // 右侧栏的把手在**左**边：往左拖 = 变宽。
          const next = Math.min(hardMax, Math.max(min, Math.round(from.width - (move.clientX - from.x))))
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
          setDragging(false)
          if (from === null) return
          const final = Math.min(hardMax, Math.max(min,
            Number.parseFloat(box.style.width) || from.width))
          box.style.width = ''
          box.style.maxWidth = ''
          setWidth(final)
          remember(final)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
      }, [limit, min, remember])

      /**
       * 键盘调宽。
       *
       * 把手是 `role="separator"`：它是**控件**，不是装饰。以前它只能拖，
       * 于是用键盘的人完全够不到「把侧栏放宽」这件事。
       */
      const nudge = useCallback(delta => {
        const next = clamp(widthRef.current + delta)
        setWidth(next)
        remember(next)
      }, [clamp, remember])

      /** 双击把手 = 回到默认宽度（每条侧栏各自的 `initial`）。 */
      const resetWidth = useCallback(() => {
        setWidth(initial)
        remember(initial)
      }, [initial, remember])

      const toggleFull = useCallback(() => setFull(value => !value), [])
      const exitFull = useCallback(() => setFull(false), [])

      // 全屏时 Esc 退出。全屏把导航也盖住了，必须有一条**不用找按钮**的退路。
      useEffect(() => {
        if (!full) return undefined
        const onKey = event => {
          if (event.key !== 'Escape') return
          // 别的浮层（放大编辑窗口 / 图片查看器）自己会处理 Esc：它们开着时不要抢。
          if (document.querySelector('.dd-tf-overlay,.dd-modal-backdrop') !== null) return
          event.stopPropagation()
          setFull(false)
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [full])

      const style = full
        ? undefined
        : { width: width + 'px', maxWidth: width + 'px' }

      const resizeProps = full
        ? {}
        : {
          onPointerDown: startResize,
          onDoubleClick: resetWidth,
          onKeyDown: event => {
            if (event.key === 'ArrowLeft') { event.preventDefault(); nudge(event.shiftKey ? 80 : 20) }
            else if (event.key === 'ArrowRight') { event.preventDefault(); nudge(event.shiftKey ? -80 : -20) }
            else if (event.key === 'Home') { event.preventDefault(); nudge(-max) }
            else if (event.key === 'End') { event.preventDefault(); nudge(max) }
          },
          role: 'separator',
          tabIndex: 0,
          'aria-label': '调整' + label + '宽度',
          'aria-orientation': 'vertical',
          'aria-valuenow': width,
          'aria-valuemin': min,
          'aria-valuemax': max,
          title: '拖动改宽度（双击回到默认；方向键微调）· ' + width + 'px',
        }

      return {
        width, full, dragging, panelRef, style, min, max,
        startResize, toggleFull, exitFull, resizeProps,
      }
    }

    // ── 侧栏的样式 ────────────────────────────────────────────────────────
    CSS_PARTS.push(`
/* ── 可调宽度的侧栏 ───────────────────────────────────────────────────── */
.dd-side{position:relative;flex:0 0 auto;display:flex;flex-direction:column;min-height:0;overflow:hidden;
  /* 宽度由 usePanelWidth 写成行内值；给个兜底下限，
     免得某次渲染丢了行内宽度就把侧栏压扁（320 = PANEL_MIN）。 */
  min-width:320px;
  transition:box-shadow var(--t-fast) var(--ease);
}
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
/* 把手：左边缘一条 9px 的热区，视觉上是一条发丝线。
   热区要比发丝线宽得多——抓一条 2px 的线是件很累的事。 */
.dd-side-resize{
  position:absolute;left:-4px;top:0;bottom:0;width:9px;z-index:21;cursor:col-resize;
  display:flex;align-items:center;justify-content:center;
  outline:none;
}
.dd-side-resize::after{
  content:'';width:2px;height:26px;border-radius:2px;background:var(--line-2);
  transition:background var(--t-fast) var(--ease),height var(--t-fast) var(--ease);
}
.dd-side-resize:hover::after{background:var(--hot-line);height:44px}
.dd-side-resize:focus-visible::after{background:var(--hot);height:44px}
/* 拖动中：把手整条亮起来，明确「现在在改宽度」。 */
.dd-side[data-resizing='true'] .dd-side-resize::after{background:var(--hot);height:64px}
.dd-side[data-resizing='true']{box-shadow:inset 1px 0 0 var(--hot-line)}
/* 全屏时没有把手——它已经占满整块工作台了。 */
.dd-side.full .dd-side-resize{display:none}
/* 宽度读数：拖动时挂在把手上。 */
.dd-side-size{
  position:absolute;left:8px;top:8px;z-index:22;pointer-events:none;
  font-family:var(--f-mono);font-size:10px;color:var(--ink);
  padding:2px 6px;border-radius:var(--rx-1);background:var(--raised);
  box-shadow:inset 0 0 0 .5px var(--line-2),var(--e-1);white-space:nowrap;
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
    //   · **读态就是内容**：多行文本按 **markdown** 渲染，读起来是给人看的。
    //   · **一种手势，一个入口**：点那段字就改。以前是「✎ 就地改」+「⤢ 放大」两枚并排的
    //     20px 小按钮、默认 34% 透明度 —— 记忆里反模式表的第一条正是「两个同义按钮让人
    //     怀疑它们不是一回事」，而 34% 透明度等于把「怎么改」藏起来。用户第二次说
    //     「手感不好」，指的就是这个：内容看着能点，点了没反应。
    //   · **两态几何完全一致 ⇒ 页面不跳**。上一版是**假达标**：编辑态多一条
    //     `.dd-ed-box.editing{margin-bottom:15px}`（下方所有内容整体下移 15px），
    //     读态多一条 `margin-left:-7px`（正文左右横移 7px）。两条都是实测量出来的跳动。
    //   · **编辑框随内容长高，不内滚**。锁死成读态高度 + 内部滚动条 = 在 44px 的窗口里
    //     改三百字；外层面板本身也能滚 ⇒ 两层滚动条叠在一起。这是「手感不好」最直接的来源。
    //   · **长文档不就地改**。markdown 渲染高度与源码高度天然不同（简报实测 1025px vs
    //     1424px），就地换态必跳。超过阈值改成「点内容 → 放大窗口」，窗口里两态尺寸恒定。
    //   · **真改了才存**：失焦 / Enter 保存，Esc 还原；只敲空格又删回去不算改动。
    //   · **保存失败留在原地**：`onSave` 返回 `false` = 没存上，草稿一个字都不丢。

    /**
     * 放大窗口的宿主。
     *
     * 字段们只管喊一声「我要开一个放大窗口」，由**根组件**统一渲染——
     * 这样浮层永远在根上，不会被中间容器的 `overflow` 裁掉，
     * 也不会被别的东西盖住。
     */
    let TEXT_DIALOG_HOST = null

    /**
     * 超过这个字数就不再就地改。
     *
     * 为什么有阈值而不是一律就地改：长文本的 markdown 渲染版面与源码版面差得很远，
     * 就地换态一定跳（简报实测：渲染 1025px / 源码 1424px）。跳到放大窗口里改，
     * 窗口自身的两态尺寸是恒定的（记忆 R2），跳动的根源被移走了，而不是被掩盖。
     */
    const TEXT_INLINE_LIMIT = 600

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
     * 短字段：点内容 → 原地编辑（几何不变、随内容长高），右上角的 ⤢ 是**可选**的放大路径。
     * 长字段：点内容 → 放大窗口（那里才有两态恒定的版面）。
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
      const [failed, setFailed] = useState(false)
      const boxRef = useRef(null)
      const nodeRef = useRef(null)
      const editingRef = useRef(false)
      /** 读态量出来的高度：编辑框的**地板**（内容再少也不比读态矮）。 */
      const floorRef = useRef(0)
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
      // 长文档：不给就地编辑这条路（必跳），一律走放大窗口。
      const longText = current.length > TEXT_INLINE_LIMIT
      // 放大按钮：短的多行字段给一枚可选的「放大」；长的整个面就是入口，不用再给按钮。
      const canExpand = !longText && (expandable === undefined ? multiline === true : expandable === true)

      /** 量一下读态有多高：编辑框以它为地板，内容多了再长。 */
      const measureFloor = () => {
        const box = boxRef.current
        floorRef.current = box === null ? 0 : Math.round(box.getBoundingClientRect().height)
      }

      const begin = () => {
        if (!canEdit || editingRef.current) return
        editingRef.current = true
        measureFloor()
        setFailed(false)
        setEditing(true)
      }

      /** 打开放大窗口：把当前值带过去，在那里改。 */
      const enlarge = () => {
        measureFloor()
        openTextDialog({
          title: typeof label === 'string' && label !== '' ? label : (labelTitle ?? '编辑'),
          value: current,
          placeholder,
          serif,
          mono,
          // 空字段直接进编辑态（面对空纸不知道要干什么），有内容先看成品。
          initialMode: current.trim() === '' ? 'edit' : 'preview',
          // **把成功/失败如实带回来。** 以前这里写成 `next => { onSave(next) }`，
          // 箭头函数没有 return ⇒ 永远拿不到结果 ⇒ 存失败了窗口也照样说「存好了」。
          onSave: async next => {
            const result = await onSave(next)
            return result !== false
          },
        })
      }

      /**
       * 点内容要干什么。
       *
       * 长文档 → 放大窗口；短字段 → 就地改。
       * 两个守卫：① 用户正在**选字**（比如要复制）时不许进编辑；
       * ② 不可编辑的字段什么都不做（它连光标都不该变成 text）。
       */
      const surfaceClick = () => {
        if (!canEdit) return
        const selection = typeof window.getSelection === 'function' ? window.getSelection() : null
        if (selection !== null && selection.isCollapsed !== true) {
          const box = boxRef.current
          const anchor = selection.anchorNode
          if (box !== null && anchor !== null && anchor !== undefined && box.contains(anchor)) return
        }
        if (longText) { enlarge(); return }
        begin()
      }

      // **从外部进入编辑态**：空态的「写第一版」按钮靠它。
      //
      // 信号值一变就进编辑态；相同信号重复触发不会重置正在写的草稿。
      const signalRef = useRef(editSignal)
      useEffect(() => {
        if (editSignal === undefined || editSignal === signalRef.current) return
        signalRef.current = editSignal
        if (editingRef.current) return
        if (longText) { enlarge(); return }
        begin()
        // begin / enlarge 只依赖 canEdit 与长度；信号变化才是触发点。
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [editSignal])

      /**
       * 编辑框的高度：**地板是读态高度，上限是内容高度**（超过半屏才允许内滚）。
       *
       * `scrollHeight` 与元素当前高度无关，所以不必先 `height:'auto'` 再量——
       * 那样会在每帧多一次强制布局（打字时肉眼可见的涩）。
       */
      React.useLayoutEffect(() => {
        if (!editing) return
        const node = nodeRef.current
        if (node === null || node.tagName !== 'TEXTAREA') return
        const cap = Math.max(140, Math.round((window.innerHeight || 800) * 0.45))
        const need = node.scrollHeight
        const height = Math.min(cap, Math.max(need, floorRef.current))
        node.style.height = height + 'px'
        node.style.overflowY = need > cap ? 'auto' : 'hidden'
      }, [editing, draft])

      const commit = async () => {
        if (!editingRef.current) return
        if (draft === current) {
          editingRef.current = false
          setEditing(false)
          return
        }
        const result = await onSave(draft)
        if (result === false) {
          // **没存上就不许退出编辑态**：草稿全在，再点一次保存就行。
          setFailed(true)
          return
        }
        setFailed(false)
        editingRef.current = false
        setEditing(false)
      }

      const cancel = () => {
        if (!editingRef.current) return
        editingRef.current = false
        setDraft(current)
        setFailed(false)
        setEditing(false)
      }

      const onKeyDown = event => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          cancel()
        } else if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          void commit()
        }
      }

      const cls = 'dd-ed'
        + (layout === 'row' ? ' row' : '')
        + (serif ? ' serif' : '')
        + (mono ? ' mono' : '')
        + (multiline ? ' multi' : '')
        + (canEdit ? '' : ' readonly')
        + (longText ? ' longtext' : '')
        + (className ? ' ' + className : '')
      const head = label
        ? h('div', { className: 'dd-ed-lab', title: labelTitle || undefined }, label)
        : null
      const hint = canEdit
        ? (longText ? '点一下，在放大窗口里改' : '点一下就能改')
        : undefined

      if (!editing) {
        // **读态就是读态，但它自己是入口。**
        //
        // 「点内容不跳进编辑」那条规矩是为了治「页面一直跳」，不是为了让内容变成死的。
        // 跳动的根因已经修掉了（两态几何完全一致），于是可以把直接的手势还回来。
        const boxProps = {
          className: 'dd-ed-box' + (canEdit ? ' can' : ''),
          ref: boxRef,
          onClick: surfaceClick,
          title: title || hint,
        }
        // 长文档整个面就是唯一入口 ⇒ 它必须能用键盘打开。
        if (longText && canEdit) {
          boxProps.role = 'button'
          boxProps.tabIndex = 0
          boxProps.onKeyDown = event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); enlarge() }
          }
        }
        return h('div', { className: cls, style },
          head,
          h('div', boxProps,
            h('div', {
              className: 'dd-ed-val' + (empty ? ' empty' : '') + (useMarkdown ? ' md' : ''),
            }, h(EditableRead, { text: current, markdown: useMarkdown, placeholder, emptyHint })),
            canExpand
              ? h('div', { className: 'dd-tf-tools' },
                h('button', {
                  className: 'dd-tf-expand',
                  type: 'button',
                  title: '放大编辑（长文本在这里改更舒服）',
                  'aria-label': '放大编辑' + (typeof label === 'string' && label !== '' ? '：' + label : ''),
                  onMouseDown: event => event.preventDefault(),
                  onClick: event => { event.stopPropagation(); enlarge() },
                }, h(Icon, { name: 'expand', size: 12 })),
              )
              : null,
          ),
        )
      }

      return h('div', { className: cls, style },
        head,
        h('div', { className: 'dd-ed-box editing', ref: boxRef },
          h('div', {
            className: 'dd-ed-edit acting'
              + (serif ? ' serif' : '')
              + (mono ? ' mono' : '')
              + (failed ? ' failed' : ''),
          },
            multiline
              ? h('textarea', {
                ref: nodeRef, value: draft, placeholder, spellCheck: false,
                onChange: event => setDraft(event.target.value),
                onKeyDown, onBlur: () => { void commit() },
              })
              : h('input', {
                ref: nodeRef, type: type ?? 'text', value: draft, placeholder,
                onChange: event => setDraft(event.target.value),
                onKeyDown, onBlur: () => { void commit() },
              }),
            h('span', { className: 'dd-ed-acts' },
              h('button', {
                className: 'dd-ed-act ok', type: 'button',
                title: '保存（失焦、Enter 或 Ctrl+Enter）',
                onMouseDown: event => event.preventDefault(),
                onClick: () => { void commit() },
              }, h(Icon, { name: 'check', size: 11 })),
              h('button', {
                className: 'dd-ed-act no', type: 'button', title: '撤销（Esc）',
                onMouseDown: event => event.preventDefault(),
                onClick: cancel,
              }, h(Icon, { name: 'close', size: 11 })),
            ),
          ),
          // 字数：算**草稿**，编辑时实时变。
          // 它落在正文右侧那条**常驻留白**里（读态与编辑态都留着 48px），
          // 所以既不压在字上，也不占新的高度 ⇒ 不跳。
          multiline ? h('span', { className: 'dd-tf-count' }, draft.length + ' 字') : null,
          failed
            ? h('span', { className: 'dd-ed-fail' }, '没存上，改动还在')
            : null,
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
      const { title, value, onSave, onClose, placeholder, serif, mono, initialMode } = props
      const text = value ?? ''
      const [mode, setMode] = useState(initialMode === 'edit' ? 'edit' : 'preview')
      const [draft, setDraft] = useState(text)
      /**
       * **已保存的基线。**
       *
       * 以前这里直接拿 prop `value` 当基线，而 `value` 是**打开那一刻的快照**——
       * 于是存成功之后 `dirty` 永远还是 true：头部一直挂着「未保存」，
       * 而【保存】按钮只在编辑态出现 ⇒ 窗口里再没有任何出口，
       * 只能点「放弃修改」把刚存好的东西再丢一次。这条是实测出来的死锁。
       */
      const [baseline, setBaseline] = useState(text)
      const [busy, setBusy] = useState(false)
      const [failed, setFailed] = useState(false)
      const [warned, setWarned] = useState(false)
      const warnTimer = useRef(undefined)
      const areaRef = useRef(null)
      const dirty = draft !== baseline

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

      // 切到编辑态就把焦点交给正文：不抢焦点的话用户得再点一次。
      useEffect(() => {
        if (mode !== 'edit' || areaRef.current === null) return
        try { areaRef.current.focus({ preventScroll: true }) } catch { areaRef.current.focus() }
      }, [mode])

      const commit = async () => {
        if (busy) return
        if (draft === baseline) { setMode('preview'); return }
        setBusy(true)
        setFailed(false)
        try {
          const ok = await onSave(draft)
          if (ok === false) {
            // 没存上：留在编辑态，草稿一个字都不丢，给出原因而不是静默回到预览。
            setFailed(true)
            return
          }
          setBaseline(draft)
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
          ref: areaRef,
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
          h('span', null, '有未保存的改动。先保存，或者放弃这次修改。'),
          h('button', {
            type: 'button', className: 'dd-btn sm',
            title: '丢掉这次修改，关闭窗口',
            onClick: onClose,
          }, '放弃修改'))
        : null
      const failStrip = failed
        ? h('div', { className: 'dd-tf-fail' },
          h('span', null, '没存上。改动还在——再点一次保存，或者先复制走。'),
          h('button', {
            type: 'button', className: 'dd-btn sm',
            title: '重试保存',
            onClick: () => { void commit() },
          }, '重试'))
        : null

      const head = h('div', { className: 'dd-tf-head' },
        h('span', { className: 'dd-tf-title' }, title || '编辑'),
        // 字数常驻头部、算草稿、两态都在（记忆 R5）。
        h('span', { className: 'dd-tf-meta num' }, draft.length + ' 字'),
        dirty ? h('span', { className: 'dd-tf-dirty' }, '未保存') : null,
        h('span', { className: 'dd-spacer' }),
        h('div', { className: 'dd-tf-seg' }, chip('preview', '预览'), chip('edit', '编辑')),
        // **只有真改了才有【保存】**：没改就不该有一个按钮等着被误点（记忆 R4）。
        dirty
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
          failStrip,
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
    //
    // **两态几何一致**是这一块的验收标准，不是审美偏好：
    // 下面每一条「读态有、编辑态也有」的声明，都是为了切换时不产生任何位移。
    // 实测过两次翻车：`margin-bottom:15px` 让下方内容整体下移 15px；
    // `margin-left:-7px` 让正文左右横移 7px。
    CSS_PARTS.push(`
/* ── 文本编辑组件 ─────────────────────────────────────────────────────── */
.dd-ed{display:flex;flex-direction:column;gap:2px;min-width:0;position:relative}
.dd-ed.row{display:grid;grid-template-columns:var(--ed-lab,116px) minmax(0,1fr);gap:14px;align-items:baseline}
.dd-ed-lab{
  font-family:var(--f-gauge);font-size:10px;color:var(--ink3);
  letter-spacing:.1em;text-transform:uppercase;line-height:1.5;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
/* 读态与编辑态的**排版度量必须完全一致**（字号/行高/内边距/宽度），
   否则切换时盒子会变高变低——这就是「页面一直跳」的根源。 */
.dd-ed-box{position:relative;min-width:0;border-radius:var(--rx-1)}
.dd-ed-box.can{cursor:text}
.dd-ed-val{
  font-size:12.5px;line-height:1.65;color:var(--ink);
  padding:3px 7px;
  min-height:28px;border-radius:var(--rx-1);
  border-bottom:.5px dashed transparent;cursor:text;
  white-space:pre-wrap;word-break:break-word;
  transition:border-color var(--t-fast) var(--ease),color var(--t-fast) var(--ease),background var(--t-fast) var(--ease);
}
/* 多行字段：读态与编辑态的**最小高度相同** ⇒ 切换时高度不变。 */
.dd-ed.multi .dd-ed-val{min-height:44px}
.dd-ed-box.can:hover .dd-ed-val{border-bottom-color:var(--hot-line);background:color-mix(in srgb,var(--hot) 6%,transparent)}
.dd-ed-val.empty{color:var(--ink4)}
.dd-ed.readonly .dd-ed-val,.dd-ed.readonly .dd-ed-box{cursor:default}
.dd-ed.readonly .dd-ed-box:hover .dd-ed-val{border-bottom-color:transparent;background:transparent}
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

/* 可选的放大入口：**常驻、安静**，悬停才亮。
   它现在只是一个「另一条路」——主路是点内容。 */
.dd-tf-tools{
  position:absolute;top:1px;right:1px;z-index:2;
  display:flex;align-items:center;gap:2px;
  opacity:.4;transition:opacity var(--t-fast) var(--ease);
}
.dd-ed-box:hover .dd-tf-tools,.dd-tf-tools:focus-within{opacity:1}
.dd-tf-expand{
  width:20px;height:20px;border-radius:var(--rx-1);
  display:grid;place-items:center;color:var(--ink3);
  background:color-mix(in srgb,var(--raised) 88%,transparent);
  box-shadow:inset 0 0 0 .5px var(--line);
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-tf-expand:hover{color:var(--hot);box-shadow:inset 0 0 0 .5px var(--hot-line)}
/* 给右上角留位：**常驻**留（不是悬停才留），所以读态与编辑态的可用宽度一致 ⇒ 不跳。 */
.dd-ed:not(.readonly) .dd-ed-val{padding-right:48px}
.dd-ed:not(.readonly) .dd-ed-edit input,
.dd-ed:not(.readonly) .dd-ed-edit textarea{padding-right:48px}
/* 长文档：整块面就是入口，给一点「这是一张纸」的暗示。 */
.dd-ed.longtext .dd-ed-box.can:hover .dd-ed-val{background:color-mix(in srgb,var(--hot) 4%,transparent)}
.dd-ed.longtext .dd-ed-box.can:focus-visible{outline:none;box-shadow:0 0 0 1.5px var(--hot)}

/* 编辑态：与读态同一套度量，只是多了个内阴影。 */
.dd-ed-edit{position:relative;display:block}
.dd-ed-edit input,.dd-ed-edit textarea{
  display:block;width:100%;background:var(--sunken);border:none;
  box-shadow:var(--e-well);border-radius:var(--rx-1);color:var(--ink);
  font-family:inherit;font-size:12.5px;line-height:1.65;padding:3px 7px;outline:none;
  box-sizing:border-box;resize:none;white-space:pre-wrap;
  transition:box-shadow var(--t-fast) var(--ease);
}
.dd-ed-edit input{height:28px}
.dd-ed.multi .dd-ed-edit textarea{min-height:44px}
.dd-ed-edit.serif input,.dd-ed-edit.serif textarea{font-family:var(--serif);font-size:15px;line-height:1.5}
.dd-ed-edit.mono input,.dd-ed-edit.mono textarea{font-family:var(--f-mono);font-size:11.5px}
.dd-ed-edit.serif textarea{min-height:52px}
.dd-ed-edit.mono textarea{min-height:38px}
.dd-ed-edit input:focus,.dd-ed-edit textarea:focus{box-shadow:var(--e-well),0 0 0 1.5px var(--hot)}
.dd-ed-edit.failed textarea,.dd-ed-edit.failed input{box-shadow:var(--e-well),0 0 0 1.5px var(--sig-fail)}
.dd-ed-acts{position:absolute;top:3px;right:5px;display:flex;gap:3px}
.dd-ed-act{
  width:20px;height:20px;border-radius:var(--rx-1);display:grid;place-items:center;
  color:var(--ink4);box-shadow:inset 0 0 0 .5px var(--line);
  transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-ed-act:hover{color:var(--ink);background:var(--panel-2)}
.dd-ed-act.ok:hover{color:var(--sig-pass);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-pass) 45%,transparent)}
.dd-ed-act.no:hover{color:var(--sig-fail);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-fail) 45%,transparent)}
/* 字数：算草稿，编辑时实时变。
   位置在正文右侧那条**常驻留白**里（48px），所以不压字、不占高度 ⇒ 不跳。 */
.dd-tf-count{
  position:absolute;right:8px;bottom:3px;pointer-events:none;
  font-family:var(--f-mono);font-size:10px;color:var(--ink4);
  padding:0 4px;border-radius:var(--rx-1);
  background:color-mix(in srgb,var(--sunken) 88%,transparent);
}
/* 存不上：一条贴着正文的细提示，**不再撑高整块**（以前它靠 margin 腾地方）。 */
.dd-ed-fail{
  position:absolute;left:0;top:100%;z-index:2;
  font-size:10.5px;color:var(--sig-fail);white-space:nowrap;
  padding:1px 5px;border-radius:var(--rx-1);
  background:color-mix(in srgb,var(--sig-fail) 12%,var(--panel));
}

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
.dd-tf-fail{
  display:flex;align-items:center;gap:10px;padding:7px 11px;border-radius:var(--rx-1);
  font-size:12px;color:var(--sig-fail);
  background:color-mix(in srgb,var(--sig-fail) 10%,transparent);
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--sig-fail) 35%,transparent);
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
      const { data, busy, actions, onOpenShot, onGoto } = props
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
                  h('td', null,
                    h('div', { style: { display: 'flex', gap: '5px' } },
                      h('button', {
                        className: 'dd-btn sm',
                        onClick: event => { event.stopPropagation(); onOpenShot(shot.id) },
                      }, '打开'),
                      // 分镜是「图纸」，生成台是「车间」：看完图纸就该能走过去，
                      // 而且要**落在同一镜**上，不要让人自己再找一遍。
                      typeof onGoto === 'function'
                        ? h('button', {
                          className: 'dd-btn sm ghost',
                          title: '去生成台打开 ' + shot.id,
                          onClick: event => { event.stopPropagation(); onGoto('generate', shot.id) },
                        }, '生成台')
                        : null,
                    )),
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
      const { data, busy, actions, onOpenShot, onGoto } = props
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
                  // 判定有三个来源，大小写还不统一：报告里的 `verdict` 是大写，
                  // 体检器的 `qc.verdict` 也是大写，人工段是小写。以前这里只比小写
                  // `shot.verdict === 'fail'`，于是**大写判定一个都对不上**：
                  // 徽标无色、按钮永远是「生成台」，判废的镜头看不出该回去修。
                  const verdict = String(shot.verdict || (shot.qc && shot.qc.verdict) || '').toLowerCase()
                  const broken = verdict === 'fail' || verdict === 'warn'
                  return h('div', { className: 'dd-sec', key: shot.id },
                    h('div', { className: 'dd-sec-head', onClick: () => onOpenShot(shot.id) },
                      h('span', { className: 'num', style: { fontSize: '12px' } }, shot.id),
                      h('span', { className: 't' }, shot.title || ''),
                      h('span', { className: 'sp' }),
                      // 判废之后**下一步就是回去改**：验收页不该是终点站。
                      // 没有这条，用户看完 FAIL 只能自己找导航、自己找那一镜。
                      typeof onGoto === 'function'
                        ? h('button', {
                          className: 'dd-btn sm' + (broken ? ' primary' : ' ghost'),
                          type: 'button',
                          title: '去生成台打开 ' + shot.id + (broken ? '（把它修好）' : ''),
                          onClick: event => { event.stopPropagation(); onGoto('generate', shot.id) },
                        }, broken ? '去修这一镜' : '生成台')
                        : null,
                      h('span', {
                        className: 'dd-badge ' + (verdict === 'pass' ? 'pass' : verdict === 'fail' ? 'fail' : verdict === 'warn' ? 'warn' : ''),
                      }, shot.verdict || (shot.qc && shot.qc.verdict) || '未判'),
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
        if (Object.keys(next).length === 0) return undefined
        // **把结果原样交回去**：编辑器靠 `false` 判断「没存上，别退出编辑态」。
        return onSave(next)
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

    // ── 构思会话：把**宿主自己的对话装配**嵌进侧栏 ──────────────────────────
    //
    // 设计（2026-11-22 重做，推翻了之前「自己画消息流」的做法）
    // ------------------------------------------------------------
    // 宿主的 `conversation.content` 是一个 **Component Factory**
    // （`SlotFactoryMap` 里的注释原话：「Reusable Conversation content instantiated
    // by presentation hosts」），并且明确支持两种出现形态：
    //
    //   variant: 'main'      —— 主面板那份（带头部、带宽度把手）
    //   variant: 'embedded'  —— 嵌进别处那份（**不带头部**、不带宽度把手）
    //
    // 右侧栏的「子 agent 对话」用的就是 embedded——它就是宿主自己背书的
    // 「把原生聊天嵌进侧边栏」的形态。插件照同一条路走，就能一行聊天渲染都不用写：
    //
    //   ① 自己的槽注册里声明一个 **session 作用域的子槽**
    //      ⇒ 宿主才会把 `SessionProvider` 与 `renderSlot` 这两件标准道具交给我们
    //   ② `sessions.retain(id)` 拿引用，`SessionProvider` 把这段会话**绑住**
    //   ③ `renderFactorySlot('conversation.content', { variant: 'embedded' })`
    //
    // 拿到的是宿主**自己的**一整套：消息与 markdown、每个工具的自定义卡片
    // （read / write / edit / bash / 子 agent… 全是宿主实现的）、思考折叠、
    // **提问卡片（点选即回传）**、上下文折叠、审批、队列与引导、停止与重试、
    // 以及 composer 里的**模型与思考强度选择**。
    //
    // 这扇窗只补宿主没做的三件事：
    //   · 贴住作品：会话清单按 **DSH 工作区的账本**取（所以要 Host 侧 attach）
    //   · 头部的会话切换 / 新对话 / 跳完整对话面板
    //   · 还没开会话时的空态引导
    //
    // 反面教训（为什么以前那版是错的）：自己把 `eventSource` 折叠成
    // 「我说的话 / 它说的话 / 处理过程」三种行，等于**用 300 行僭越了宿主
    // 几个包**——工具卡只有一行 `name(args)`，提问卡是个假按钮，
    // 注入的上下文糊成一屏。那不是「轻量嵌入」，那是重造一个更差的聊天。

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

    /** 稳定空值：给标准道具缺失时的兜底（换新对象会让订阅每次重连）。 */
    const EMPTY_SESSION = { blank: true, running: false, awaitingFirstTurn: false, promptAttempted: false, openState: 'cold' }

    const EMPTY_CONVERSATION = { activeTargets: new Set() }

    /** 宿主的会话服务；拿不到就返回 undefined（由调用方如实说明）。 */
    function sessionsService() {
      if (CTX === null || CTX === undefined || typeof CTX.get !== 'function') return undefined
      try {
        const service = CTX.get('sessions')
        return service !== undefined && service !== null && typeof service.retain === 'function'
          ? service
          : undefined
      } catch {
        return undefined
      }
    }

    /** 会话清单里的时间戳：「今天」只露时分，更早露月-日。拿不到就空着。 */
    function sessionStamp(createdAt) {
      if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || createdAt <= 0) return ''
      // 毫秒还是秒：宿主的 header 是毫秒，但这里不赌——小到不像毫秒就按秒算。
      const date = new Date(createdAt > 1e12 ? createdAt : createdAt * 1000)
      if (Number.isNaN(date.getTime())) return ''
      const pad = value => String(value).padStart(2, '0')
      const now = new Date()
      const sameDay = date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate()
      const clock = pad(date.getHours()) + ':' + pad(date.getMinutes())
      return sameDay ? clock : pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + clock
    }

    /**
     * 每一段会话的**标题**。
     *
     * 宿主的 `SessionHeader` 里**没有 title 字段**——标题是 `session-title` 投影的产物
     * （一条 `session/title` 事件 fold 出来，第一句话之后由宿主摘要生成）。
     * 侧栏显示的就是客户端会话清单里的 `SessionSummary.title`。
     *
     * 所以这里读**同一个来源**，而不是自己拿第一句话去摘要：
     * 清单里的标题于是永远和侧栏一致，也不会出现「插件一套、宿主一套」。
     *
     * 注意：**不要**读 `projectionValues.title` —— 列表行只带摘要子集
     * （`SessionProjectionSummaryValues`），title 是以 `SessionSummary.title`
     * 这个扁平字段出现的。`displayTitle` 也不拿来做兜底：它退化成项目目录名，
     * 同一个工作区里每段会话都会显示成同一个词。
     *
     * @returns {Record<string, string>} sessionId → 标题
     */
    function sessionTitles() {
      const service = sessionsService()
      const source = service !== undefined ? service.list : undefined
      if (source === undefined || source === null || typeof source.getSnapshot !== 'function') return {}
      let snapshot
      try {
        snapshot = source.getSnapshot()
      } catch {
        return {}
      }
      const byId = snapshot !== undefined && snapshot !== null && snapshot.byId !== undefined && snapshot.byId !== null
        ? snapshot.byId
        : {}
      const out = {}
      for (const id of Object.keys(byId)) {
        const row = byId[id]
        if (row === undefined || row === null) continue
        const durable = typeof row.title === 'string' ? row.title.trim() : ''
        if (durable !== '') {
          out[id] = durable
          continue
        }
        // 兜底：某些宿主版本把投影原样塞进 projectionValues。
        const projected = row.projectionValues !== undefined && row.projectionValues !== null
          ? row.projectionValues.title
          : undefined
        const title = projected !== undefined && projected !== null && typeof projected.title === 'string'
          ? projected.title.trim()
          : ''
        if (title !== '') out[id] = title
      }
      return out
    }

    /** 两份标题表是否等价（没变就别 setState——父组件的每次重渲染都会带上整棵子树）。 */
    function sameTitles(a, b) {
      const left = Object.keys(a)
      const right = Object.keys(b)
      if (left.length !== right.length) return false
      for (const key of left) if (a[key] !== b[key]) return false
      return true
    }

    /**
     * 会话清单里的显示名。
     *
     * 优先**标题**（和侧栏一致），其次 API 给的 `title`，最后才是 id 片段 + 创建时间。
     * 光露 id 前八位不行：`session-xxxx` 会显示成一模一样的「会话 session-」。
     */
    function sessionLabel(session, titles) {
      const id = session && typeof session.id === 'string' ? session.id : ''
      const projected = titles !== undefined && id !== '' ? titles[id] : undefined
      if (typeof projected === 'string' && projected !== '') return projected
      const title = session && typeof session.title === 'string' ? session.title.trim() : ''
      if (title !== '') return title
      const bare = id.replace(/^session-/, '')
      const stamp = sessionStamp(session ? session.createdAt : undefined)
      const name = bare === '' ? '未命名对话' : '会话 ' + bare.slice(0, 8)
      return stamp === '' ? name : name + ' · ' + stamp
    }

    /**
     * 这一个 View 槽里放什么：**固定走宿主的「对话」视图**。
     *
     * 这一格是聊天窗，不是轨迹台——轨迹在「宿主面板」那一侧看。
     * `renderSlot` 是工厂给的（`conversation.content` 的 `views` 位置）。
     */
    function DeskChatView(props) {
      return props.renderSlot('conversation.session', { view: 'chat' })
    }

    /**
     * 会话体：宿主 `conversation.content` 的 **embedded** 出现形态。
     *
     * `phase` / `hero` 决定宿主渲染哪一屏（空白首屏 / 正在接续 / 正文）。
     * 这段判定照抄宿主的 `sidebar-chat`：它是「这段会话现在是空、是刚开、
     * 还是已经有内容」的**宿主自己的**口径，我们不该另发明一套。
     */
    function DeskConversationBody(props) {
      const { sessionId, useSession, useConversation, useSessions, renderFactorySlot } = props
      // 标准道具可能因为宿主版本不同而缺席——缺席也不能让 hook 顺序变。
      const readSession = typeof useSession === 'function' ? useSession : value => value
      const readConversation = typeof useConversation === 'function' ? useConversation : value => value
      const readSessions = typeof useSessions === 'function' ? useSessions : value => value
      const session = readSession(value => value) || EMPTY_SESSION
      const conversation = readConversation(value => value) || EMPTY_CONVERSATION
      const summaryBlank = readSessions(state => (state && state.byId ? state.byId[sessionId] : undefined)?.blank)

      const active = conversation.activeTargets.size > 0
        || (session.blank !== true && session.awaitingFirstTurn !== true)
        || session.running === true
      const shellPhase = active ? 'active' : session.promptAttempted === true ? 'engaging' : 'blank'
      const settling = shellPhase === 'blank' && session.openState === 'loading' && summaryBlank !== true
      const hero = shellPhase === 'blank' && (session.openState === 'open' || summaryBlank === true)
      const phase = settling ? 'settling' : hero ? 'hero' : 'active'

      if (typeof renderFactorySlot !== 'function') {
        return h('div', { className: 'dd-chat-note' },
          '这个宿主没有提供对话装配接口（renderFactorySlot）：需要更新的 DSH 桌面版或 dsh web。')
      }
      return renderFactorySlot(
        'conversation.content',
        { variant: 'embedded', phase, hero },
        { slots: { views: DeskChatView } },
      )
    }

    /**
     * 会话切换：这个 **DSH 工作区**里的对话。
     *
     * 用原生 `<select>` 而不是自造弹出层：它会键盘可用、会跟随系统主题、
     * 在窄侧栏里也不会被裁掉。会话一多，浏览器自己会滚。
     */
    function ConceiveSessionMenu(props) {
      const { sessions, current, onPick, titles } = props
      const list = Array.isArray(sessions) ? sessions : []
      const known = current === undefined ? false : list.some(item => item && item.id === current)
      const currentTitle = current !== undefined && titles !== undefined ? titles[current] : undefined
      return h('select', {
        className: 'dd-chat-session',
        value: current === undefined ? '' : current,
        disabled: list.length === 0 && !known,
        title: '这个工作区里的对话（含你在宿主的侧栏里自己开的）',
        onChange: event => {
          const id = event.target.value
          if (id !== '' && typeof onPick === 'function') onPick(id)
        },
      }, [
        // 当前这段不在清单里（清单还没刷出来）时也要有个选项，否则 select 会空值。
        current !== undefined && !known
          ? h('option', { key: '__current', value: current }, typeof currentTitle === 'string' && currentTitle !== ''
            ? currentTitle
            : '当前对话 ' + current.replace(/^session-/, '').slice(0, 8))
          : null,
        list.length === 0
          ? h('option', { key: '__empty', value: '' }, '（这个工作区里只有这一段）')
          : null,
        list.map(item => h('option', { key: item.id, value: item.id }, sessionLabel(item, titles))),
      ])
    }

    /**
     * 构思会话窗。
     *
     * 会话**不是**这里发起的：Host 侧用 `agents.create()` 开真会话、把它挂进
     * DSH 工作区的账本、再把「这次只谈哪个项目」作为 **prompt context** 交给宿主。
     * 这扇窗只负责「把那段会话显示出来 + 让人能切、能新开、能跳过去」。
     */
    function ConceiveChat(props) {
      const {
        sessionId, onClose, onFresh, onStart, canStart, busy, seeded,
        panelControls, dshWorkspaceId, SessionProvider, renderSlot,
      } = props
      const [activeId, setActiveId] = useState(sessionId)
      /**
       * 绑住的会话引用 **连同它属于哪一段会话**。
       *
       * 只存引用是不够的：换会话时 React 会先用**旧的**引用渲染一帧，而旧引用的
       * 释放发生在上一轮 effect 的 cleanup 里 —— 那一帧里 `SessionProvider`
       * 就会拿到一个已经 released 的引用，宿主直接抛
       * `Session reference "…" is released`。
       *
       * 所以这里记上 id，渲染时**只认 id 与当前一致的那一个**：换了会话的那一刻
       * `liveReference` 就是 null，那一帧显示「正在打开」，不会把死引用交出去。
       */
      const [bound, setBound] = useState({ id: undefined, reference: null })
      const [problem, setProblem] = useState(null)
      const [list, setList] = useState([])
      /** 标题表：sessionId → 标题（来自宿主的 title 投影，和侧栏同一来源）。 */
      const [titles, setTitles] = useState({})
      const [starting, setStarting] = useState(false)
      /** 自愈重试计数：绑定失败 → 请 Host 把这段会话恢复成活的 → 再绑一次。 */
      const [attempt, setAttempt] = useState(0)
      const repairedRef = useRef(false)
      /**
       * `onStart` 每次渲染都是新函数（父组件里的内联箭头），放进依赖会让 effect
       * 每帧重跑（retain/release 抖动）。所以走 ref：值是最新的，身份不参与依赖。
       */
      const startRef = useRef(onStart)
      startRef.current = onStart

      // 作品换了自己的会话 → 跟着走。
      useEffect(() => { setActiveId(sessionId) }, [sessionId])

      // 清单：只在**换了会话/作品**（或自愈重连过一次）时拉。它是清单，不是某一镜的
      // 判定，所以不进轮询——开会话那一次 `conceive-session` 之后会重渲染，够用。
      useEffect(() => {
        let cancelled = false
        apiGet('sessions').then(value => {
          if (!cancelled) setList(value && Array.isArray(value.sessions) ? value.sessions : [])
        }).catch(() => { if (!cancelled) setList([]) })
        return () => { cancelled = true }
      }, [sessionId, attempt])

      // **绑定**这一段会话：用宿主自己的 retain（共享它的历史开屏与增量）。
      //
      // `attempt` 是自愈重试：见下面的 catch —— 插件重装 / 宿主重启之后，
      // 这段会话可能已经不在宿主的活目录里（客户端 retain 会报
      // `sessions.retain: unknown session`），此时请 Host 走一次
      // `ensureDeskSession()`（本质是 `agents.resume`）把它带回来，再绑一次。
      useEffect(() => {
        repairedRef.current = false
        return undefined
      }, [activeId])

      useEffect(() => {
        if (activeId === undefined || activeId === null || activeId === '') {
          setBound({ id: undefined, reference: null })
          return undefined
        }
        const service = sessionsService()
        if (service === undefined) {
          setBound({ id: undefined, reference: null })
          setProblem('这个宿主没有会话服务：构思会话需要 DSH 桌面版或 dsh web。')
          return undefined
        }
        let held
        try {
          held = service.retain(activeId, { source: 'controllerOperation' })
        } catch (bad) {
          setBound({ id: undefined, reference: null })
          setProblem(bad instanceof Error ? bad.message : String(bad))
          // **一次性自愈**：只试一次，失败就如实停在这里，不循环打接口。
          if (repairedRef.current !== true && typeof startRef.current === 'function') {
            repairedRef.current = true
            Promise.resolve()
              .then(() => startRef.current())
              .then(() => setAttempt(count => count + 1))
              .catch(() => { /* 恢复不了就让它停在提示上 */ })
          }
          return undefined
        }
        setProblem(null)
        setBound({ id: activeId, reference: held })
        return () => {
          try {
            held.release()
          } catch {
            // 已经释放过：忽略。
          }
        }
      }, [activeId, attempt])

      // 标题：订阅宿主的会话清单快照，取 `title` 投影（和侧栏同一来源，见 sessionTitles）。
      //
      // 标题是**后来才有**的（第一句话之后由宿主摘要生成），所以必须订阅而不是快照一次；
      // 但表没变就**不 setState**——父组件每重渲染一次都会带上整棵子树。
      useEffect(() => {
        const service = sessionsService()
        const source = service !== undefined ? service.list : undefined
        if (source === undefined || source === null
          || typeof source.getSnapshot !== 'function' || typeof source.subscribe !== 'function') {
          setTitles(previous => (Object.keys(previous).length === 0 ? previous : {}))
          return undefined
        }
        const read = () => {
          const next = sessionTitles()
          setTitles(previous => (sameTitles(previous, next) ? previous : next))
        }
        read()
        const off = source.subscribe(read)
        return () => {
          if (typeof off === 'function') off()
        }
      }, [sessionId, attempt])

      // 只认「当前这一段」的引用：换会话时旧引用已经不可用了（见 bound 的说明）。
      const reference = bound.id === activeId ? bound.reference : null

      const snapshot = useStore(reference !== null && reference.binding ? reference.binding.session : undefined)
      const running = snapshot !== undefined && snapshot !== null && snapshot.running === true
      const openState = snapshot !== undefined && snapshot !== null ? snapshot.openState : undefined

      const hasSession = activeId !== undefined && activeId !== null && activeId !== ''

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

      /**
       * 打开**宿主的完整对话面板**，把这段会话放进去。
       *
       * 为什么还要留这个出口：侧栏这一格是嵌进来的**窄**视图，宿主的完整面板
       * 才有轨迹 / 上下文 / 编队 / 统计这几个标签。同一段会话，两个入口。
       *
       * 顺序不能反：工作区切换会把会话选择重置掉，所以**会话要先选**，
       * 工作区随后。
       */
      const openInPanel = useCallback(() => {
        if (!hasSession) return
        const helper = CTX === null ? undefined : CTX.get('uiWorkspace')
        const layout = CTX === null ? undefined : CTX.get('layout')
        try {
          if (typeof helper?.openSession === 'function') helper.openSession(activeId)
          if (dshWorkspaceId !== undefined && dshWorkspaceId !== ''
            && typeof helper?.openWorkspace === 'function') {
            helper.openWorkspace(dshWorkspaceId, () => {})
          }
          if (typeof layout?.selectPanel === 'function') layout.selectPanel('conversation')
        } catch {
          // 打不开就算了：这扇窗里照常能聊。
        }
      }, [activeId, dshWorkspaceId, hasSession])

      // 头部**两行**：第一行是「这是什么窗 + 收 / 全屏」，第二行是「哪一段对话 + 动作」。
      //
      // 一行塞不下：460px 里塞进标题 + 会话下拉 + 两个按钮，
      // 中文标题会被压成一列（`docs/dev/rendering.md` 第 5 条）。
      // 两行反而更清楚：上一行说身份，下一行说操作。
      const head = h('div', { className: 'dd-chat-head' },
        h('div', { className: 'dd-chat-titleline' },
          h(Icon, { name: 'note', size: 14 }),
          h('span', { className: 'ch-t' }, '构思会话'),
          h('span', { className: 'ch-sub' },
            !hasSession ? '还没开始'
              : openState === 'open' ? (running ? '正在想…' : '等你说话')
                : openState === 'loading' ? '正在打开…'
                  : openState === 'error' ? '打不开这段会话'
                    : '准备中…'),
          h('span', { className: 'dd-spacer' }),
          panelControls,
          h('button', { className: 'dd-icon-btn', onClick: onClose, title: '收起这扇窗（顶栏的图标能再展开）' }, h(Icon, { name: 'close', size: 13 })),
        ),
        h('div', { className: 'dd-chat-bar' },
          h(ConceiveSessionMenu, { sessions: list, current: activeId, onPick: setActiveId, titles }),
          h('button', {
            className: 'dd-btn sm', onClick: onFresh, disabled: !hasSession || busy,
            title: '开一段新对话（旧的那段仍留在 DSH 的会话列表里）',
          }, '新对话'),
          h('button', {
            className: 'dd-btn sm', onClick: openInPanel, disabled: !hasSession,
            title: '在宿主的完整对话面板里打开这段会话（那边有轨迹 / 上下文 / 编队 / 统计）',
          }, '完整对话'),
        ),
      )

      /**
       * 空态：还没有会话，或者宿主不给标准道具。
       *
       * 「宿主的原生对话嵌不进来」这件事要**说清楚**，不能给一个空白框让人猜。
       */
      const emptyState = h('div', { className: 'dd-chat-empty' },
        h('div', null, '这里接的是真的 DSH 会话：'),
        h('div', null, '同一个模型、同一套工具、加载了 `drama-conceive` 技能。'),
        h('div', { style: { marginTop: '14px' } },
          h('button', {
            className: 'dd-btn primary', onClick: start,
            disabled: starting || busy || !canStart,
            title: canStart ? '开一段真的构思会话' : '先选一个作品（构思会话是挂在作品上的）',
          }, starting ? '正在开…' : '开始对话'),
          h('div', { style: { marginTop: '10px', color: 'var(--ink4)' } },
            canStart
              ? '开好之后，聊天界面是宿主自己的那一套。'
              : '先选一个作品（或新建一个），构思会话是挂在作品上的。')),
      )

      // 页面本体：绑上了会话就交给宿主渲染，否则说清楚缺什么。
      const body = !hasSession || reference === null
        ? (problem !== null
          ? h('div', { className: 'dd-chat-note', title: problem },
            h('div', null, '这段会话还没在宿主那边打开——插件重装、或 DSH 重启后会这样。'),
            h('div', { style: { marginTop: '10px', color: 'var(--ink4)', fontSize: '11px' } },
              '点「开始对话」让它重新打开；如果它已经不在了，点「新对话」。'))
          : (hasSession && openState === 'error'
            ? h('div', { className: 'dd-chat-note' }, '这段会话打不开：它在宿主那边可能已被删除或归档。')
            : (hasSession ? h('div', { className: 'dd-chat-note' }, '正在打开这段会话…') : emptyState)))
        : (typeof SessionProvider !== 'function' || typeof renderSlot !== 'function'
          ? h('div', { className: 'dd-chat-note' },
            '这个宿主没有把会话槽交给插件（SessionProvider / renderSlot 缺失）：'
            + '原生对话嵌不进来。需要更新的 DSH 桌面版，或改用「完整对话」。')
          : h('div', { className: 'dd-chat-host' },
            h(SessionProvider, { session: reference },
              renderSlot('drama-desk.conversation', {}))))

      // 宿主没接住项目上下文时的**如实提示**（只有刚开的那一段会回报这件事）。
      // 不说清楚的话，agent 会一本正经地在**整个总根**里乱翻别人的项目。
      const seedWarning = seeded === false
        ? h('div', { className: 'dd-chat-warn' },
          '这段会话没带上「只谈哪个项目」的上下文（宿主不支持 prompt context）：',
          '在消息里点明 `workspaces/<作品>/` 更保险。')
        : null

      return h('div', { className: 'dd-chat' }, head, seedWarning, body)
    }

    // ── 会话窗的样式 ──────────────────────────────────────────────────────
    // 消息、工具卡、提问卡、composer 的样式**都在宿主那边**——这里只有
    // 「装它的那个盒子」和三样我们自己的东西（头部、原生下拉、说明块）。

    CSS_PARTS.push(`
/* 装宿主对话的盒子：它是一条**列向** flex 链的最后一环，必须能把高度
   交给子项（宿主自己内部才是那个滚动容器）——所以 min-height:0 不能少。 */
.dd-chat{width:100%;flex:1 1 auto;min-height:0;box-shadow:-1px 0 0 var(--line);
  background:linear-gradient(180deg,var(--panel),var(--bg));
  display:flex;flex-direction:column;overflow:hidden}
.dd-chat-host{flex:1 1 auto;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.dd-chat-host>*{flex:1 1 auto;min-height:0;min-width:0}
/* 头部：**两行**。第一行身份 + 收起 / 全屏，第二行会话选择 + 动作。
   一行塞不下 460px —— 中文标题会被压成一列（rendering.md 第 5 条）。 */
.dd-chat-head{flex:none;display:flex;flex-direction:column;gap:8px;
  padding:10px 12px;box-shadow:0 1px 0 var(--line)}
.dd-chat-titleline{display:flex;align-items:center;gap:7px;min-width:0}
.dd-chat-head .ch-t{font-size:12.5px;font-weight:600;white-space:nowrap}
.dd-chat-head .ch-sub{font-size:10.5px;color:var(--ink3);font-family:var(--f-mono);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.dd-chat-bar{display:flex;align-items:center;gap:6px;min-width:0}
.dd-chat-bar .dd-btn{flex:0 0 auto}
/* 会话切换：原生 <select>，压到与头部其它控件同一重量；宽度吃掉剩余空间。 */
.dd-chat-session{
  flex:1 1 auto;min-width:0;height:24px;padding:0 6px;border-radius:var(--rx-1);
  background:var(--sunken);color:var(--ink2);border:none;box-shadow:inset 0 0 0 .5px var(--line-2);
  font-family:inherit;font-size:11px;outline:none;text-overflow:ellipsis;
}
.dd-chat-session:focus-visible{box-shadow:inset 0 0 0 .5px var(--line-2),0 0 0 1.5px var(--hot)}
.dd-chat-session:disabled{opacity:.55}
/* 说明块：空态 / 打不开 / 宿主不给槽——都不画假界面。 */
.dd-chat-note{
  margin:auto;max-width:320px;padding:22px 16px;text-align:center;
  font-size:12.5px;line-height:1.8;color:var(--ink3);
}
/* 如实提示条（例如：项目上下文没交给宿主）。不用红色：它不是错误，是缺一件保险。 */
.dd-chat-warn{
  flex:none;padding:7px 12px;font-size:11px;line-height:1.7;color:var(--ink2);
  background:color-mix(in srgb,var(--sig-warn) 12%,transparent);
  box-shadow:inset 0 -1px 0 var(--line);
}
/* 空态：还没有会话时的引导。 */
.dd-chat-empty{margin:auto;text-align:center;color:var(--ink3);font-size:12.5px;line-height:1.85;padding:20px 14px;max-width:300px}
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
                      // 规则上写着它管哪几个阶段——那几段就该能点过去。
                      // 看完一条铁律接着去它管的那个阶段，是这一页最自然的下一步。
                      h('span', { className: 'st' },
                        (rule.stages || []).length === 0
                          ? '—'
                          : (rule.stages || []).map(stage => (typeof onGoto === 'function'
                            ? h('button', {
                              key: stage,
                              className: 'dd-ref',
                              type: 'button',
                              title: '去「' + (STAGE_LABEL[stage] || stage) + '」阶段',
                              onClick: event => { event.stopPropagation(); onGoto(stage) },
                            }, STAGE_LABEL[stage] || stage)
                            : h('span', { key: stage, className: 'dd-ref' }, STAGE_LABEL[stage] || stage)))),
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
    // 资产管理是工作台的主要职能之一。很长一段时间里这一页是**一个只读的表格**——
    // 资产多起来之后（一百多个），没人能从里面看出「这个作品里有什么」。
    //
    // 现在它按资产管理的四件事组织：
    //   ① **分类索引**：类型 / 状态 / 场次→镜号 三个维度，角标上带数量与体积；
    //   ② **便捷预览**：表格里有缩略图，图墙给一整面画面，点开就是浮层；
    //      文本类资产**不在这里读文件**（客户端没有读文本的接口），
    //      给的是「去那一镜处理它」的直达入口——预览一个提示词，
    //      有意义的是它将被怎么改，不是它此刻的字节；
    //   ③ **详情**：点一行，表格下方给出完整的 id / 路径 / 哈希 / 全部引用；
    //   ④ **排序与分页**：DOM 里只有当前这一页。
    //
    // 性能铁律（`docs/dev/performance.md`）：这一页**只渲染当前页**。
    // 五千个资产时在 render 里 map 全表 = 五千个 React 元素，
    // 面板会先卡后崩——而插件是嵌在用户主应用里的，用户只会说「DSH 卡了」。

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

    /** 资产状态的中文名。分类索引、表格、详情条共用这一张表。 */
    const ASSET_STATUS_LABEL = {
      active: '在用',
      deprecated: '作废',
    }

    /** 一页多少行。DOM 里只留这么多节点。 */
    const ASSET_PAGE_SIZE = 50
    const LEDGER_PAGE_SIZE = 50
    /** 图墙一页多少格。格子比行矮，一页可以多给一些，但仍然是一页。 */
    const ASSET_WALL_SIZE = 30

    /**
     * 排序下拉的选项。
     *
     * `default` 是**服务端顺序**（= 文件清单顺序），也是打开这一页时的样子：
     * 没有理由的地方就不要替用户排。
     */
    const ASSET_SORT_LABEL = {
      default: '默认顺序',
      type: '按类型',
      bytes: '按体积',
      time: '按时间',
      shot: '按镜号',
    }

    /** 能出缩略图的类型。 */
    function isImageAsset(asset) {
      return asset.type === 'reference_image' || asset.type === 'keyframe'
    }

    /** 视频资产。浮层由 `84-viewer.js` 负责 `<video>`，这里只负责把 asset 递过去。 */
    function isVideoAsset(asset) {
      return asset.type === 'video'
    }

    /**
     * 镜号里的场次：`SC01-SH03` → `SC01`。
     *
     * 用 `indexOf('-')` 而不是切前四位——镜号格式一改（`SC1-SH3`、`S01-SH003`），
     * 写死的长度就会**静默**分错组：界面上看不出错，只是场次少了几个。
     */
    function shotSceneOf(shotId) {
      if (typeof shotId !== 'string' || shotId === '') return ''
      const at = shotId.indexOf('-')
      return at > 0 ? shotId.slice(0, at) : shotId
    }

    /** 镜号排序：空镜号排最后（没有镜号的资产不属于任何一镜，不该抢在开头）。 */
    function compareShotIds(a, b) {
      if (a === b) return 0
      if (a === '') return 1
      if (b === '') return -1
      return a.localeCompare(b, 'en', { numeric: true })
    }

    /**
     * 这个资产能不能出像素。返回 `'image'` / `'video'` / `''`。
     *
     * 图墙靠它筛。**文件缺失的资产不进图墙**——一格黑框比「缺失」两个字更难懂。
     */
    function assetPixelKind(asset) {
      if (asset === null || typeof asset !== 'object' || asset.missing === true) return ''
      if (isImageAsset(asset)) return 'image'
      if (isVideoAsset(asset)) return 'video'
      return ''
    }

    /**
     * 一个资产这一行能做什么。
     *
     * 文本类资产（提示词 / 报告 / 文档）**不在资产页里读文件内容**：
     * 客户端没有读文本的接口，硬读只会造出第三个真源。这里给的是
     * 「去那一镜处理它」的直达入口——权限、校验、幂等都在各自的阶段里。
     */
    function assetActionOf(asset) {
      const pixel = assetPixelKind(asset)
      if (pixel === 'image') {
        return { kind: 'image', label: '预览', icon: 'eye', hint: '在浮层里看大图' }
      }
      if (pixel === 'video') {
        return { kind: 'video', label: '播放', icon: 'play', hint: '在浮层里播放这段视频' }
      }
      if (asset === null || typeof asset !== 'object' || asset.missing === true) return null
      if (asset.type === 'prompt') {
        return {
          kind: 'goto', label: '去生成台', icon: 'film', stage: 'generate', shotId: asset.shotId,
          hint: '去生成台改这一镜的提示词（资产页不读文本）',
        }
      }
      if (asset.type === 'report') {
        return {
          kind: 'goto', label: '去验收', icon: 'check', stage: 'verify', shotId: asset.shotId,
          hint: '去验收台看这一镜的报告（资产页不读文本）',
        }
      }
      if (asset.type === 'doc') {
        return {
          kind: 'goto', label: '去构思', icon: 'edit', stage: 'conceive', shotId: '',
          hint: '在创意阶段编辑（资产页不读文本内容）',
        }
      }
      return null
    }

    /** 资产状态的短名。 */
    function assetStatusLabel(asset) {
      const key = String((asset && asset.status) || 'active')
      return ASSET_STATUS_LABEL[key] || key
    }

    /**
     * 资产状态的语义色（`dd-badge` 的键）。
     *
     * 之前这里写的是 `var(--warn)` / `var(--ok)` / `var(--danger)`——这**三个变量
     * 在这套主题里根本不存在**，于是颜色被静默丢掉（表现为「和正文一个颜色」，
     * 不是报错）。主题里的真名是 `--sig-*`，而 `dd-badge` 已经把语义映射好了。
     */
    function assetStatusTone(asset) {
      const key = String((asset && asset.status) || 'active')
      if (key === 'active') return 'pass'
      if (key === 'deprecated') return 'warn'
      return 'none'
    }

    /**
     * 排序比较器。
     *
     * 体积与时间都**从大到新**：找资产时想看的总是「最大的那个」「最新的那个」。
     * 类型与镜号相同时用 id 清位，免得顺序随机跳（排序不稳定 = 翻页时行会串）。
     */
    function assetSortCompare(sort, a, b) {
      if (sort === 'bytes') {
        return (typeof b.bytes === 'number' ? b.bytes : 0) - (typeof a.bytes === 'number' ? a.bytes : 0)
      }
      if (sort === 'time') {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      }
      if (sort === 'type') {
        const left = String(a.type || '')
        const right = String(b.type || '')
        return left === right ? String(a.id || '').localeCompare(String(b.id || '')) : left.localeCompare(right)
      }
      if (sort === 'shot') {
        const left = typeof a.shotId === 'string' ? a.shotId : ''
        const right = typeof b.shotId === 'string' ? b.shotId : ''
        return left === right ? String(a.id || '').localeCompare(String(b.id || '')) : compareShotIds(left, right)
      }
      return 0
    }

    /**
     * 台账状态 → 语义色。
     *
     * 颜色跟**判定**走（`dd-badge` 的那几个键）。不在表里的 status 用灰——
     * 给不认识的状态编一个颜色，就是在替服务端说它没说的话。
     */
    const LEDGER_STATUS_TONE = {
      succeeded: 'pass',
      failed: 'fail',
      submitted: 'generated',
      running: 'generated',
      pending: 'warn',
      deprecated: 'none',
    }

    function ledgerStatusTone(status) {
      return LEDGER_STATUS_TONE[String(status || '')] || 'none'
    }

    /** 毫秒 → `42s` / `3m 05s` / `1h 20m` 这种短读数。 */
    function formatSpan(ms) {
      const total = Math.round(ms / 1000)
      if (total < 60) return total + 's'
      const minutes = Math.floor(total / 60)
      if (minutes < 60) return minutes + 'm ' + String(total % 60).padStart(2, '0') + 's'
      const hours = Math.floor(minutes / 60)
      return hours + 'h ' + String(minutes % 60).padStart(2, '0') + 'm'
    }

    /**
     * 一次生成花了多久。
     *
     * **台账里没有 `succeeded_at`**：`src/host/service.js` 的 `ledger()` 只把
     * `submitted_at` 与 `last_query_at` 交给客户端。所以这里不编造完成时刻——
     * 用「提交 → 末次查询」这段**真实**时间，读数前面标 `≈`，列头写明它是什么。
     * 不是 succeeded 的条目没有这段（还在跑 / 失败了），一律显示 —。
     */
    function ledgerElapsed(entry) {
      if (entry === null || typeof entry !== 'object' || entry.status !== 'succeeded') return ''
      const from = Date.parse(entry.submittedAt || '')
      const to = Date.parse(entry.lastQueryAt || '')
      if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return ''
      return '≈ ' + formatSpan(to - from)
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
      // 视图 / 排序 / 镜头维度 / 选中行：它们**都是筛选状态**，换一个就回第一页。
      const [viewMode, setViewMode] = useState('table')
      const [sort, setSort] = useState('default')
      const [sceneFilter, setSceneFilter] = useState('')
      const [shotFilter, setShotFilter] = useState('')
      const [selectedId, setSelectedId] = useState('')

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

      /**
       * 镜头维度：场次 → 镜号 → 数量 / 体积。
       *
       * 一百多个资产里七十多个带镜号。**不能把镜号直接铺成一行 chip**：
       * 那行会变成一堵墙，比列表还难找。所以索引只做到场次，
       * 镜号等选中场次之后再展开（见下面的 `sceneFilter` 两层）。
       */
      const shotIndex = useMemo(() => {
        const scenes = new Map()
        let total = 0
        for (const asset of rows) {
          if (typeof asset.shotId !== 'string' || asset.shotId === '') continue
          total += 1
          const scene = shotSceneOf(asset.shotId)
          let group = scenes.get(scene)
          if (group === undefined) {
            group = { scene: scene, count: 0, bytes: 0, shots: new Map() }
            scenes.set(scene, group)
          }
          group.count += 1
          group.bytes += typeof asset.bytes === 'number' ? asset.bytes : 0
          group.shots.set(asset.shotId, (group.shots.get(asset.shotId) || 0) + 1)
        }
        const list = [...scenes.values()]
        list.sort((a, b) => compareShotIds(a.scene, b.scene))
        for (const group of list) {
          group.shots = [...group.shots.entries()]
            .sort((a, b) => compareShotIds(a[0], b[0]))
            .map(pair => ({ shot: pair[0], count: pair[1] }))
        }
        return { scenes: list, total: total }
      }, [rows])

      /**
       * 过滤 + 排序。**全表只在这一次扫**；之后的一切都只看 `visible`。
       *
       * `out` 是新数组，所以 `sort` 不会动到 props 里那份清单
       * （原地排序 props 是「翻一次页顺序就变了」的经典来源）。
       */
      const ordered = useMemo(() => {
        const out = []
        for (const asset of rows) {
          if (typeFilter !== '' && String(asset.type || 'other') !== typeFilter) continue
          if (statusFilter === 'deprecated' && asset.status !== 'deprecated') continue
          if (statusFilter === 'missing' && asset.missing !== true) continue
          if (sceneFilter !== '') {
            if (shotSceneOf(asset.shotId) !== sceneFilter) continue
            if (shotFilter !== '' && asset.shotId !== shotFilter) continue
          }
          if (needle !== '') {
            const hay = [asset.id, asset.path, asset.notes, asset.role, asset.shotId]
              .filter(part => typeof part === 'string')
              .join(' ')
              .toLowerCase()
            if (!hay.includes(needle)) continue
          }
          out.push(asset)
        }
        if (sort === 'default') return out
        out.sort((a, b) => assetSortCompare(sort, a, b))
        return out
      }, [rows, typeFilter, statusFilter, needle, sceneFilter, shotFilter, sort])

      /** 图墙只收能出像素的资产：文本资产在图墙里没有位置。 */
      const listed = useMemo(
        () => (viewMode === 'wall' ? ordered.filter(asset => assetPixelKind(asset) !== '') : ordered),
        [ordered, viewMode],
      )

      const size = viewMode === 'wall' ? ASSET_WALL_SIZE : ASSET_PAGE_SIZE
      const pages = Math.max(1, Math.ceil(listed.length / size))
      const current = Math.min(page, pages - 1)
      /** 真正会被渲染的那**一页**。全表到这里为止。 */
      const visible = useMemo(
        () => listed.slice(current * size, (current + 1) * size),
        [listed, current, size],
      )

      /** 选中的资产（详情条用）。按 id 回查，筛选变了它也能继续显示。 */
      const selected = useMemo(
        () => (selectedId === '' ? null : rows.find(asset => asset.id === selectedId) || null),
        [rows, selectedId],
      )

      // 换了筛选条件就回到第一页——否则会停在一个不存在的页码上。
      useEffect(() => {
        setPage(0)
      }, [typeFilter, statusFilter, needle, sort, viewMode, sceneFilter, shotFilter])

      if (!assets) return h('div', { className: 'dd-empty' }, '正在读取资产…')

      const totals = assets.totals || {}
      const sceneGroup = sceneFilter === '' ? undefined : shotIndex.scenes.find(group => group.scene === sceneFilter)
      const sceneShots = sceneGroup ? sceneGroup.shots : []

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

      // 点缩略图 / 「预览」：选中 + 打开浮层。
      // `stopPropagation` 让「点行选中」不跟缩略图抢事件——一格缩略图里点两下
      // 出两种结果，用户会以为界面坏了。
      const openAsset = (event, asset) => {
        if (event) event.stopPropagation()
        setSelectedId(asset.id)
        if (typeof onOpenImage === 'function') onOpenImage(asset)
      }

      const jumpTo = (event, stage, shotId) => {
        if (event) event.stopPropagation()
        if (typeof onGoto === 'function') onGoto(stage, shotId)
      }

      /** 表格第一格：能出像素的给缩略图（视频用海报帧），否则给一个类型字。 */
      const thumbCell = asset => {
        const pixel = assetPixelKind(asset)
        let src = ''
        if (pixel === 'image') src = assetImageUrl(workspaceId, asset.id)
        if (pixel === 'video' && typeof asset.shotId === 'string' && asset.shotId !== '') {
          // 视频封面走 `/drama-desk/poster`：它是**受控路由**（≤1200px），
          // 而且不发整个视频文件——表格里滚过 3 个视频不该拉 500MB。
          src = posterUrl(workspaceId, asset.shotId)
        }
        if (src === '') {
          return h('span', { className: 'dd-asset-thumb ph' },
            (ASSET_TYPE_LABEL[asset.type] || asset.type || '·').slice(0, 1))
        }
        return h('button', {
          className: 'dd-asset-thumb' + (pixel === 'video' ? ' is-video' : ''),
          type: 'button',
          'aria-label': (pixel === 'video' ? '播放 ' : '打开 ') + asset.id,
          title: (pixel === 'video' ? '播放 ' : '打开 ') + asset.id,
          onClick: event => openAsset(event, asset),
        },
          h('img', {
            src: src,
            alt: asset.id,
            loading: 'lazy',
            onError: event => { event.currentTarget.style.visibility = 'hidden' },
          }),
          pixel === 'video' ? h('span', { className: 'dd-asset-thumb-play', 'aria-hidden': true }, '▶') : null,
        )
      }

      /** 「预览 / 去处理」这一列：每个资产只有**一个**明确的下一步。 */
      const actionCell = asset => {
        const action = assetActionOf(asset)
        if (action === null) {
          return h('span', { className: 'dd-note' }, asset.missing === true ? '文件缺失' : '—')
        }
        return h('button', {
          className: 'dd-btn sm ghost dd-go-btn',
          type: 'button',
          title: action.hint + (action.shotId ? ' · ' + action.shotId : ''),
          onClick: action.kind === 'goto'
            ? event => jumpTo(event, action.stage, action.shotId)
            : event => openAsset(event, asset),
        },
          h(Icon, { name: action.icon, size: 12 }),
          action.label,
        )
      }

      /** 引用它的镜头：**点一下就跳到那一镜**。 */
      const refsCell = asset => {
        const refs = Array.isArray(asset.referencedBy) ? asset.referencedBy : []
        if (refs.length === 0) return '—'
        return h('span', { className: 'dd-refs' },
          refs.slice(0, 3).map(shotId => h('button', {
            key: shotId,
            className: 'dd-ref',
            type: 'button',
            title: '跳到 ' + shotId,
            onClick: event => jumpTo(event, 'generate', shotId),
          }, shotId)),
          refs.length > 3 ? h('span', { className: 'dd-note' }, '+' + (refs.length - 3)) : null,
        )
      }

      /** 图墙的一格。只收像素资产，所以点下去一定是开浮层。 */
      const wallTile = asset => {
        const pixel = assetPixelKind(asset)
        let src = ''
        if (pixel === 'image') src = assetImageUrl(workspaceId, asset.id)
        if (pixel === 'video' && typeof asset.shotId === 'string' && asset.shotId !== '') {
          src = posterUrl(workspaceId, asset.shotId)
        }
        return h('button', {
          key: asset.id,
          className: 'dd-asset-tile'
            + (asset.status === 'deprecated' ? ' dep' : '')
            + (selectedId === asset.id ? ' on' : ''),
          type: 'button',
          title: asset.id + (asset.path ? '\n' + asset.path : ''),
          onClick: () => openAsset(null, asset),
        },
          h('span', { className: 'dd-asset-tile-frame' },
            src === '' ? null : h('img', {
              src: src,
              alt: asset.id,
              loading: 'lazy',
              onError: event => { event.currentTarget.style.visibility = 'hidden' },
            }),
            pixel === 'video' ? h('span', { className: 'dd-asset-tile-play', 'aria-hidden': true }, h(Icon, { name: 'play', size: 18 })) : null,
            asset.status === 'deprecated' ? h('span', { className: 'dd-asset-tile-mark' }, '作废') : null,
          ),
          h('span', { className: 'dd-asset-tile-cap' }, asset.id),
        )
      }

      const sceneChips = shotIndex.scenes.map(group => h('button', {
        key: group.scene,
        className: 'dd-facet scene' + (sceneFilter === group.scene ? ' on' : ''),
        type: 'button',
        title: group.scene + ' · ' + group.count + ' 个资产 · ' + formatBytes(group.bytes) + '（点一下展开镜号）',
        onClick: () => {
          setSceneFilter(sceneFilter === group.scene ? '' : group.scene)
          setShotFilter('')
        },
      },
        h('span', { className: 'nm' }, group.scene),
        h('span', { className: 'ct num' }, String(group.count)),
      ))

      const shotChips = sceneShots.map(group => h('button', {
        key: group.shot,
        className: 'dd-facet' + (shotFilter === group.shot ? ' on' : ''),
        type: 'button',
        title: group.shot + ' · ' + group.count + ' 个资产',
        onClick: () => setShotFilter(shotFilter === group.shot ? '' : group.shot),
      },
        h('span', { className: 'nm' }, group.shot),
        h('span', { className: 'ct num' }, String(group.count)),
      ))

      const table = h('table', { className: 'dd-table dd-asset-table' },
        h('thead', null, h('tr', null,
          h('th', { className: 'th-thumb' }, ''),
          h('th', null, '资产'), h('th', null, '类型'), h('th', null, '状态'),
          h('th', { className: 'n' }, '镜号'), h('th', { className: 'n' }, '引用'),
          h('th', { className: 'n' }, '尺寸'), h('th', { className: 'n' }, '体积'),
          h('th', null, '路径'), h('th', null, '预览 / 去处理'),
        )),
        h('tbody', null, visible.map(asset => h('tr', {
          key: asset.id,
          className: 'dd-asset-row' + (selectedId === asset.id ? ' on' : ''),
          title: '点这一行看完整的 id / 路径 / 哈希 / 引用',
          onClick: () => setSelectedId(asset.id),
        },
          h('td', { className: 'td-thumb' }, thumbCell(asset)),
          h('td', { title: asset.id }, asset.id),
          h('td', null, ASSET_TYPE_LABEL[asset.type] || asset.type || '—'),
          h('td', null,
            h('span', { className: 'dd-badge ' + assetStatusTone(asset) }, assetStatusLabel(asset)),
            asset.missing === true ? h('span', { className: 'dd-badge fail', style: { marginLeft: '5px' } }, '缺失') : null,
          ),
          h('td', { className: 'n' },
            // 资产属于哪一镜：点一下就落到那一镜。
            typeof asset.shotId === 'string' && asset.shotId !== ''
              ? h('button', {
                className: 'dd-ref',
                type: 'button',
                title: '跳到 ' + asset.shotId,
                onClick: event => jumpTo(event, 'generate', asset.shotId),
              }, asset.shotId)
              : '—'),
          h('td', { className: 'n' }, refsCell(asset)),
          h('td', { className: 'n' }, asset.width ? asset.width + '×' + asset.height : '—'),
          h('td', { className: 'n' }, formatBytes(asset.bytes)),
          h('td', { className: 'path', title: asset.path || '' },
            assetPixelKind(asset) === ''
              ? (asset.path || '—')
              : h('button', {
                className: 'dd-path-open',
                type: 'button',
                title: '打开 ' + asset.id,
                onClick: event => openAsset(event, asset),
              }, asset.path || '—')),
          h('td', { className: 'td-go' }, actionCell(asset)),
        ))),
      )

      const wall = h('div', { className: 'dd-asset-wall-hold' },
        h('div', { className: 'dd-asset-wall' }, visible.map(wallTile)),
      )

      return h('div', { className: 'dd-main' },
        h('div', { className: 'dd-toolbar' },
          h('span', { className: 'dd-chip' }, '共 ', h('b', { className: 'num' }, String(totals.count !== undefined ? totals.count : rows.length)), ' 个'),
          h('span', { className: 'dd-chip' }, '作废 ', h('b', { className: 'num' }, String(totals.deprecated !== undefined ? totals.deprecated : statusCounts.deprecated))),
          h('span', { className: 'dd-chip' }, '缺失 ', h('b', { className: 'num' }, String(totals.missing !== undefined ? totals.missing : statusCounts.missing))),
          h('span', { className: 'dd-chip' }, '占用 ', h('b', { className: 'num' }, formatBytes(totals.bytes !== undefined ? totals.bytes : 0))),
          h('span', { className: 'dd-spacer' }),
          // 表格 / 图墙。图墙是「便捷预览」的主要答案：
          // 一百个资产在表格里根本看不出作品长什么样。
          h('div', { className: 'dd-seg' },
            h('button', {
              className: viewMode === 'table' ? 'on' : '',
              type: 'button',
              title: '表格：字段、引用、完整信息',
              onClick: () => setViewMode('table'),
            }, '表格'),
            h('button', {
              className: viewMode === 'wall' ? 'on' : '',
              type: 'button',
              title: '图墙：只看能出画面的资产',
              onClick: () => setViewMode('wall'),
            }, '图墙'),
          ),
          h('select', {
            className: 'dd-input dd-asset-sort',
            value: sort,
            title: '排序',
            onChange: event => setSort(event.target.value),
          }, Object.keys(ASSET_SORT_LABEL).map(key => h('option', { key: key, value: key }, ASSET_SORT_LABEL[key]))),
          h('input', {
            className: 'dd-input dd-asset-search',
            value: query,
            placeholder: '按 id / 路径 / 备注找…',
            onChange: event => setQuery(event.target.value),
          }),
        ),
        // 分类索引：类型、状态、镜头（场次 → 镜号）三行。
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
          // 镜头：先铺场次（十二个左右），选中一场才展开它的镜号。
          // 七十多个镜号一次铺出来，这一行就变成一堵墙——比列表更难找。
          h('div', { className: 'dd-facet-row' },
            h('span', { className: 'dd-facet-lab' }, '镜头'),
            h('button', {
              className: 'dd-facet' + (sceneFilter === '' ? ' on' : ''),
              type: 'button',
              title: '所有带镜号的资产',
              onClick: () => { setSceneFilter(''); setShotFilter('') },
            },
              h('span', { className: 'nm' }, '全部'),
              h('span', { className: 'ct num' }, String(shotIndex.total)),
            ),
            sceneChips,
            shotIndex.total === 0
              ? h('span', { className: 'dd-note' }, '这批资产还没有镜号')
              : null,
            sceneFilter === '' && shotIndex.total > 0
              ? h('span', { className: 'dd-note dd-facet-hint' }, '点场次展开镜号')
              : null,
          ),
          sceneFilter === '' ? null : h('div', { className: 'dd-facet-row' },
            h('span', { className: 'dd-facet-lab' }, '镜号'),
            h('button', {
              className: 'dd-facet' + (shotFilter === '' ? ' on' : ''),
              type: 'button',
              title: '这一场的全部资产',
              onClick: () => setShotFilter(''),
            },
              h('span', { className: 'nm' }, sceneFilter + ' 全镜'),
              h('span', { className: 'ct num' }, String(sceneGroup ? sceneGroup.count : 0)),
            ),
            shotChips,
          ),
        ),
        h('div', { className: 'dd-scroll' },
          visible.length === 0
            ? h('div', { className: 'dd-empty' },
              viewMode === 'wall' ? '当前筛选下没有能出画面的资产。' : '这里没有资产。')
            : (viewMode === 'wall' ? wall : table),
        ),
        // 详情条：表格里被截断的那些值，在这里**完整**给出来。
        // 它挂在滚动区外面（flex:none），所以翻页时它不跟着滚走。
        selected === null ? null : h(AssetDetail, {
          key: selected.id,
          asset: selected,
          onClear: () => setSelectedId(''),
          onOpenImage: onOpenImage,
          onGoto: onGoto,
        }),
        h(Pager, {
          page: current,
          pages: pages,
          total: listed.length,
          size: size,
          onPage: setPage,
        }),
      )
    }

    /**
     * 选中一行的**详情条**。
     *
     * 表格里每个字段都被截断（路径、引用只给前三个），而「这个文件到底是什么」
     * 恰恰要靠完整值回答：路径要能整条选中复制，sha256 要能拿去比对，
     * referencedBy 要能看全（换一张参考图之前，得知道动它会碰到哪几镜）。
     *
     * 没有 hook：它是纯展示，挂在哪一页都不影响 hook 数。
     */
    function AssetDetail(props) {
      const { asset, onClear, onOpenImage, onGoto } = props
      if (asset === null || asset === undefined) return null
      const action = assetActionOf(asset)
      const refs = Array.isArray(asset.referencedBy) ? asset.referencedBy : []
      const cell = (label, value, options) => h('div', {
        className: 'dd-asset-detail-cell' + (options && options.wide ? ' wide' : ''),
      },
        h('span', { className: 'k' }, label),
        h('span', { className: 'v' + (options && options.mono ? ' mono' : '') }, value),
      )
      return h('div', { className: 'dd-asset-detail' },
        h('div', { className: 'dd-asset-detail-head' },
          h('span', { className: 'dd-asset-detail-title', title: asset.id }, asset.id),
          h('span', { className: 'dd-badge ' + assetStatusTone(asset) }, assetStatusLabel(asset)),
          asset.missing === true ? h('span', { className: 'dd-badge fail' }, '缺失') : null,
          h('span', { className: 'dd-note' }, ASSET_TYPE_LABEL[asset.type] || asset.type || '资产'),
          h('span', { className: 'dd-spacer' }),
          action === null ? null : h('button', {
            className: 'dd-btn sm dd-go-btn',
            type: 'button',
            title: action.hint + (action.shotId ? ' · ' + action.shotId : ''),
            onClick: () => {
              if (action.kind === 'goto') {
                if (typeof onGoto === 'function') onGoto(action.stage, action.shotId)
              } else if (typeof onOpenImage === 'function') {
                onOpenImage(asset)
              }
            },
          }, h(Icon, { name: action.icon, size: 12 }), action.label),
          h('button', { className: 'dd-btn sm ghost', type: 'button', onClick: onClear }, '收起'),
        ),
        h('div', { className: 'dd-asset-detail-grid' },
          // id 在头里已经显示过一次，但那里会被省略号截断；这一格保证**完整**的 id
          // 能整条选中（拿去搜、拿去贴进命令里）。
          cell('id', asset.id || '—', { mono: true, wide: true }),
          cell('路径', asset.path || '—', { mono: true, wide: true }),
          cell('sha256 前 12 位', typeof asset.sha256 === 'string' ? asset.sha256.slice(0, 12) : '—', { mono: true }),
          cell('创建时间', formatTime(asset.createdAt), { mono: true }),
          cell('体积', formatBytes(asset.bytes), { mono: true }),
          cell('尺寸', asset.width ? asset.width + '×' + asset.height : '—', { mono: true }),
          cell('镜号', asset.shotId || '—', { mono: true }),
          cell('角色', asset.role || '—', { mono: true }),
          cell('备注', asset.notes || '—', { wide: true }),
          refs.length === 0
            ? cell('引用', '—')
            : h('div', { className: 'dd-asset-detail-cell wide' },
              h('span', { className: 'k' }, '引用它的镜头（' + refs.length + '）'),
              h('span', { className: 'v' },
                h('span', { className: 'dd-refs' },
                  refs.map(shotId => h('button', {
                    key: shotId,
                    className: 'dd-ref',
                    type: 'button',
                    title: '跳到 ' + shotId,
                    onClick: () => { if (typeof onGoto === 'function') onGoto('generate', shotId) },
                  }, shotId)),
                ),
              ),
            ),
        ),
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
                h('th', null, '提交时间'),
                // 台账里**没有完成时刻**（服务端只回 submitted_at / last_query_at），
                // 所以这一列是「提交 → 末次查询」的真实时间，不是编出来的耗时。
                h('th', { className: 'n', title: '提交 → 末次查询（台账没有 succeeded_at）' }, '耗时'),
                h('th', null, 'task_id'),
                h('th', null, '下一步'),
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
                  className: 'dd-badge ' + ledgerStatusTone(entry.status),
                }, entry.status || '—')),
                h('td', null, entry.model || '—'),
                h('td', { className: 'n' }, entry.duration ? entry.duration + 's' : '—'),
                h('td', { className: 'n' }, typeof entry.costUsd === 'number' ? '$' + entry.costUsd.toFixed(2) : '—'),
                h('td', { className: 'n' }, formatTime(entry.submittedAt)),
                h('td', { className: 'n', title: '提交 → 末次查询' }, ledgerElapsed(entry) || '—'),
                h('td', { className: 'n', style: { color: 'var(--ink4)' } }, entry.taskId || '—'),
                // 生成完的那一镜，下一步是**验收**——台账不该把人丢回阶段首页。
                h('td', null,
                  entry.shotId
                    ? h('button', {
                      className: 'dd-ref',
                      type: 'button',
                      title: '去验收 ' + entry.shotId,
                      onClick: () => { if (typeof onGoto === 'function') onGoto('verify', entry.shotId) },
                    }, '去验收')
                    : '—'),
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
/* 场次 chip 的编号是「坐标」，用等宽字体；提示文字不许把这一行撑宽。 */
.dd-facet.scene .nm{font-family:var(--f-mono);font-size:10.5px}
.dd-facet-hint{flex:0 0 auto;padding-left:2px}
/* 排序 / 搜索 / 视图切换。 */
.dd-asset-search{height:26px;width:210px;flex:none}
.dd-asset-sort{height:26px;width:120px;min-width:0;flex:none}
/* ── 资产表 ───────────────────────────────────────────────────────────── */
.dd-asset-table .th-thumb{width:44px}
.dd-asset-table .td-thumb{width:44px;padding:3px 6px}
.dd-asset-thumb{
  position:relative;display:block;width:36px;height:36px;border-radius:var(--rx-1);overflow:hidden;
  background:var(--sunken);box-shadow:inset 0 0 0 .5px var(--line);cursor:pointer;padding:0;
}
.dd-asset-thumb img{display:block;width:100%;height:100%;object-fit:cover}
.dd-asset-thumb.ph{
  display:grid;place-items:center;font-family:var(--f-gauge);font-size:11px;color:var(--ink4);
  cursor:default;
}
/* 视频缩略图上的播放角标：一眼看出这一格点下去是播，不是看。 */
.dd-asset-thumb-play{
  position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:10px;
  background:linear-gradient(180deg,transparent 38%,rgba(0,0,0,.55));pointer-events:none;
  text-shadow:0 1px 2px rgba(0,0,0,.8);
}
/* 行 = 可选中：点行出详情，点缩略图开浮层（缩略图自己 stopPropagation）。 */
.dd-asset-row{cursor:pointer}
.dd-asset-row.on,.dd-asset-row.on:hover{background:var(--hot-2)}
.td-go{padding:6px 12px;white-space:nowrap}
.dd-go-btn{display:inline-flex;align-items:center;gap:5px;padding:0 8px}
/* 路径本身是个入口（图片/视频），但长得像文字：它不该在表格里抢走注意力。 */
.dd-path-open{
  display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--ink3);font-size:11px;text-align:left;
}
.dd-path-open:hover{color:var(--hot);text-decoration:underline}
/* ── 图墙 ─────────────────────────────────────────────────────────────── */
.dd-asset-wall-hold{padding:14px 20px 26px}
.dd-asset-wall{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(104px,1fr))}
/* 上面那行是**兜底**；下面这条把列数压在 4–6 之间（一屏 4～6 列自适应）：
   6 列时每格刚好分到 (100% - 5×gap)/6，再宽也不会多出第七列。
   max()/百分比万一被浏览器丢掉，整条声明作废，上面那条还在。 */
.dd-asset-wall{grid-template-columns:repeat(auto-fill,minmax(max(88px,calc((100% - 50px)/6)),1fr))}
.dd-asset-tile{display:flex;flex-direction:column;gap:5px;min-width:0;text-align:left}
.dd-asset-tile-frame{
  position:relative;display:block;aspect-ratio:16/9;border-radius:var(--rx-2);overflow:hidden;
  background:var(--sunken);box-shadow:inset 0 0 0 .5px var(--line);
  transition:transform var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.dd-asset-tile:hover .dd-asset-tile-frame{transform:translateY(-2px);box-shadow:var(--e-4)}
.dd-asset-tile.on .dd-asset-tile-frame{box-shadow:inset 0 0 0 1.5px var(--hot)}
.dd-asset-tile.dep .dd-asset-tile-frame{opacity:.55}
.dd-asset-tile-frame img{display:block;width:100%;height:100%;object-fit:cover}
.dd-asset-tile-play{
  position:absolute;inset:0;display:grid;place-items:center;color:#fff;pointer-events:none;
  background:radial-gradient(circle at 50% 50%,rgba(0,0,0,.5),transparent 62%);
}
.dd-asset-tile-mark{
  position:absolute;left:5px;top:4px;font-size:9px;letter-spacing:.08em;color:#fff;
  padding:1px 5px;border-radius:999px;background:var(--sig-warn);pointer-events:none;
}
.dd-asset-tile-cap{
  font-family:var(--f-mono);font-size:10px;color:var(--ink3);padding:0 2px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* ── 详情条 ───────────────────────────────────────────────────────────── */
.dd-asset-detail{
  flex:0 0 auto;max-height:158px;overflow:auto;padding:9px 20px 10px;
  box-shadow:0 -1px 0 var(--line);background:var(--panel-2);
}
.dd-asset-detail-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;min-width:0}
/* 标题能收缩（长 id 省略号），右边那几枚按钮不收缩——顺序反过来就是按钮被挤成一条线。 */
.dd-asset-detail-head .dd-badge,
.dd-asset-detail-head .dd-btn,
.dd-asset-detail-head>.dd-note{flex:0 0 auto}
.dd-asset-detail-title{
  font-family:var(--f-mono);font-size:11.5px;color:var(--ink);min-width:0;max-width:52%;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto;
}
.dd-asset-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:4px 16px}
.dd-asset-detail-cell{display:flex;flex-direction:column;gap:1px;min-width:0}
.dd-asset-detail-cell.wide{grid-column:1 / -1}
.dd-asset-detail-cell .k{
  font-family:var(--f-gauge);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink4);
}
.dd-asset-detail-cell .v{
  font-size:11.5px;color:var(--ink2);min-width:0;overflow-wrap:anywhere;
  /* 路径 / 哈希要能整条选中复制——这是详情条存在的理由之一。 */
  user-select:text;-webkit-user-select:text;
}
.dd-asset-detail-cell .v.mono{font-family:var(--f-mono);font-size:11px}
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
    //
    // 尺寸语义（这里曾经错成「缩了两次」）：
    //  · `layout` 是**布局框**——CSS 的 max-width/max-height 已经把图压到刚好
    //    放得下，它本身就是「适配尺寸」。
    //  · `zoom === 1` 表示「适配」，**不是**「原始像素」。所以这里没有
    //    `fitZoom`：再乘一次 viewport/natural 就是把已缩过一次的图又缩一次，
    //    屏幕上只剩「刚好放得下」的八成，还白占了空间。
    //  · 钳位与读数一律用**绘制尺寸 = layout × zoom**，不用 natural——
    //    两者差的那 20%~26% 正是「图片能被拖出可视区」的来源。
    //  · `natural` 只在一个地方用得着：1:1 的目标缩放 = natural.width / layout.width。

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
     * 屏幕上的**绘制尺寸**：布局框 × zoom。
     *
     * 钳位、读数都该用它。用自然尺寸算，图能直接拖出屏幕。
     *
     * @param {number} zoom
     * @param {{width: number, height: number}} layout 布局框（CSS 适配之后的盒子）
     * @returns {{width: number, height: number}}
     */
    function drawnSize(zoom, layout) {
      return { width: layout.width * zoom, height: layout.height * zoom }
    }

    /**
     * 布局框的兜底。
     *
     * 图还没解码 / 还没布局时 `offsetWidth` 是 0。拿 0 当尺寸会把可拖范围钳成 0
     * （图片被钉死在原地），所以按视口两倍兜底；真正的尺寸到了，组件会再钳一次。
     *
     * @param {{width: number, height: number}} layout
     * @param {{width: number, height: number}} viewport
     * @returns {{width: number, height: number}}
     */
    function safeLayoutSize(layout, viewport) {
      if (layout && layout.width > 0 && layout.height > 0) {
        return { width: layout.width, height: layout.height }
      }
      const width = viewport && viewport.width > 0 ? viewport.width : 0
      const height = viewport && viewport.height > 0 ? viewport.height : 0
      return { width: width * 2, height: height * 2 }
    }

    /**
     * 给定缩放，图片在视口里能平移多远。
     *
     * 钳位用的是**绘制尺寸**（布局框 × zoom），不是布局框——
     * 放大之后用布局框算，图片能直接拖出屏幕。
     *
     * @param {number} zoom
     * @param {{width: number, height: number}} layout 布局框
     * @param {{width: number, height: number}} viewport 视口尺寸
     * @returns {{maxX: number, maxY: number}}
     */
    function clampFor(zoom, layout, viewport) {
      const drawn = drawnSize(zoom, layout)
      return {
        maxX: Math.max(0, (drawn.width - viewport.width) / 2),
        maxY: Math.max(0, (drawn.height - viewport.height) / 2),
      }
    }

    /**
     * 把 pan 钳回「图片永远在视野里」。
     *
     * 图比视口小的时候 maxX / maxY 是 0，pan 恒为 {0,0}——也就是居中。
     *
     * @param {{x: number, y: number}} pan
     * @param {number} zoom
     * @param {{width: number, height: number}} layout
     * @param {{width: number, height: number}} viewport
     * @returns {{x: number, y: number}}
     */
    function clampPan(pan, zoom, layout, viewport) {
      const { maxX, maxY } = clampFor(zoom, layout, viewport)
      return {
        x: Math.min(maxX, Math.max(-maxX, pan.x)),
        y: Math.min(maxY, Math.max(-maxY, pan.y)),
      }
    }

    /**
     * 以某个点为锚缩放：锚点下的像素保持不动。
     *
     * 锚点同步要用**实际**比值 `next / current`——钳位过之后请求值与实际值
     * 可能不同，用请求值锚点会漂一点。返回的 pan 还可能被调用方再钳一次。
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
      if (next === current) return { zoom: next, pan: { x: pan.x, y: pan.y } }
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
     * 1:1 的目标缩放。
     *
     * 1:1 要的是「原始像素」，而 `zoom = 1` 是「适配」——所以目标是
     * `natural.width / layout.width`，不是 1。拿不到尺寸就退回适配。
     *
     * @param {{width: number, height: number}} natural 原始像素
     * @param {{width: number, height: number}} layout 布局框
     * @returns {number}
     */
    function zoomForActualSize(natural, layout) {
      if (!natural || !layout) return 1
      if (natural.width <= 0 || layout.width <= 0) return 1
      return clampZoom(natural.width / layout.width)
    }

    /**
     * 读数：`适配 N% · 实际 W×H · 位移 x, y`。
     *
     * 「适配 N%」是 zoom 的百分比（100% = 刚好放得下），「实际 W×H」是**屏幕上**
     * 的绘制尺寸——别拿自然尺寸冒充实际尺寸，实机验收读的就是这一行。
     *
     * @param {number} zoom
     * @param {{width: number, height: number}} layout
     * @param {{x: number, y: number}} pan
     * @returns {string}
     */
    function viewerReadout(zoom, layout, pan) {
      const drawn = drawnSize(clampZoom(zoom), layout)
      return '适配 ' + zoomPercent(zoom)
        + ' · 实际 ' + Math.round(drawn.width) + '×' + Math.round(drawn.height)
        + ' · 位移 ' + Math.round(pan.x) + ', ' + Math.round(pan.y)
    }

    // ── image viewer（可缩放 · 可拖动 · 跟手）─────────────────────────────
    //
    // 这一层只做三件事：**测量**（图片布局框多大、视口多大）、**事件**（滚轮 /
    // 拖拽 / 键盘）、**渲染**。算术全在 `84-viewer-zoom.js`（纯函数）。
    //
    // 坐标与尺寸语义：
    //  · `zoom === 1` 是「**适配**」——布局框由 CSS 的 max-width/max-height
    //    决定，它本身就刚好放得下，所以打开即 100%。**不要**再乘一次
    //    `fitZoom(natural, viewport)`：那会把已经缩过一次的图再缩一次
    //    （实机读数 554 的盒子 × 0.79 = 439，白占两成空间）。
    //  · `pan` 是**中心相对**的偏移（图片画在视口正中）。
    //  · 钳位用**绘制尺寸 = 布局框 × zoom**；用自然尺寸算，图能被拖出可视区。
    //
    // 几条不能省的：
    //  · 尺寸用 `ResizeObserver` 观察**图片自己**读 `offsetWidth/offsetHeight`，
    //    不用 `load` 事件——缓存命中时 `load` 不再触发，尺寸停在 0，拖拽恒死。
    //  · 缩放只改 `transform`，不改 width/height（否则与 ResizeObserver 互相触发）。
    //  · 必须拒绝浏览器的原生图片拖拽（Chromium 会吞掉 move 事件）。
    //  · 拖动时直写 DOM 的 transform，React 状态每帧至多提交一次——否则不跟手。
    //  · 拖拽起点**只读**：位移是「起点 + 累计」，绝不把结果写回起点。

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
.dd-viewer-video{
  flex:1 1 auto;min-height:120px;display:flex;align-items:center;justify-content:center;
  background:#000;overflow:hidden;
}
.dd-viewer-video video{max-width:100%;max-height:100%;display:block}
`)

    /**
     * 视频资产的地址。
     *
     * 浮层的调用方是按**图片**路由拼好 src 传进来的（它不知道这里要播视频），
     * 所以 workspace 只能从 asset 或 src 的查询串里捡出来。捡不到就用传进来的
     * src——不自己拼图片 URL 是一条硬约束（≤1200px 由 Host 路由保证）。
     *
     * @param {object} asset
     * @param {string} src
     * @returns {string}
     */
    function viewerVideoSrc(asset, src) {
      const item = asset || {}
      const id = item.id || ''
      if (id === '') return src || ''
      let workspaceId = item.workspaceId || ''
      if (workspaceId === '' && typeof src === 'string' && src !== '') {
        try {
          const origin = typeof location === 'undefined' ? 'http://localhost' : location.origin
          workspaceId = new URL(src, origin).searchParams.get('workspace') || ''
        } catch (error) {
          workspaceId = ''
        }
      }
      // 拿不到 workspace 就只用 src：宁可播不了，也不自己拼一条路由。
      if (workspaceId === '') return src || ''
      return assetVideoUrl(workspaceId, id)
    }

    function ImageViewer(props) {
      const { asset, src, onClose } = props
      const item = asset || {}
      /** 视频走同一个浮层，但**不做**缩放拖动：手势监听一律不挂。 */
      const isVideo = item.type === 'video'
      const surfaceRef = useRef(null)
      const imgRef = useRef(null)
      const [zoom, setZoom] = useState(1)
      const [pan, setPan] = useState({ x: 0, y: 0 })
      /** 图片的**布局框**（CSS 适配之后的盒子）——钳位与读数都基于它。 */
      const [layout, setLayout] = useState({ width: 0, height: 0 })
      /** 原始像素——只给 1:1 的目标缩放用。 */
      const [natural, setNatural] = useState({ width: 0, height: 0 })
      /** 拖拽起点（**只读**：它持有开始那一刻的 pan 与指针）。 */
      const dragRef = useRef(null)
      /** 最新视图状态的镜像：事件里读它，不等 React 重渲染。 */
      const viewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 }, layout: { width: 0, height: 0 }, natural: { width: 0, height: 0 } })
      viewRef.current = { zoom, pan, layout, natural }
      /** 本帧待提交的视图：拖动时只写 DOM，状态交给 rAF。 */
      const pendingRef = useRef(null)
      const frameRef = useRef(0)

      /** 视口尺寸（stage 的客户区）。 */
      const viewport = useCallback(() => {
        const box = surfaceRef.current
        if (box === null) return { width: 0, height: 0 }
        return { width: box.clientWidth, height: box.clientHeight }
      }, [])

      /** 测量用的布局框；缺尺寸时按视口两倍兜底，不能把图钉死。 */
      const layoutBox = useCallback(() => safeLayoutSize(viewRef.current.layout, viewport()), [viewport])

      /** 把视图写进 DOM（拖动时每帧都调，缩放只走 transform）。 */
      const paint = useCallback((nextZoom, nextPan) => {
        const img = imgRef.current
        if (img === null) return
        img.style.transform = 'translate(' + nextPan.x + 'px,' + nextPan.y + 'px) scale(' + nextZoom + ')'
      }, [])

      /** 立即提交（缩放 / 按钮 / 松手）：撤掉本帧挂起的提交，免得旧值盖新值。 */
      const applyView = useCallback((nextZoom, nextPan) => {
        pendingRef.current = null
        if (frameRef.current !== 0) {
          if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameRef.current)
          frameRef.current = 0
        }
        setZoom(nextZoom)
        setPan(nextPan)
        paint(nextZoom, nextPan)
      }, [paint])

      /**
       * 拖动中的节流提交：画面直写 DOM 跟手，React 状态**每帧至多一次**。
       *
       * 提交读 pendingRef 而不是闭包里的值——一帧内可能来了好几个 move，
       * 要提交的是最后一个。
       */
      const schedule = useCallback((nextZoom, nextPan) => {
        paint(nextZoom, nextPan)
        pendingRef.current = { zoom: nextZoom, pan: nextPan }
        if (frameRef.current !== 0) return
        if (typeof requestAnimationFrame !== 'function') {
          const pending = pendingRef.current
          pendingRef.current = null
          setZoom(pending.zoom)
          setPan(pending.pan)
          return
        }
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = 0
          const pending = pendingRef.current
          if (pending === null) return
          pendingRef.current = null
          setZoom(pending.zoom)
          setPan(pending.pan)
        })
      }, [paint])

      /** 复位到「适配」：`zoom = 1` 就是刚好放得下，pan 归零即居中。 */
      const resetFit = useCallback(() => {
        applyView(1, clampPan({ x: 0, y: 0 }, 1, layoutBox(), viewport()))
      }, [applyView, layoutBox, viewport])

      /**
       * 按原始像素显示（1:1）。
       *
       * `zoom = 1` 是适配尺寸，所以目标是 `natural.width / layout.width`；
       * 复位到居中（1:1 之后图通常比视口大，居中才是「看全图」）。
       */
      const actualSize = useCallback(() => {
        const current = viewRef.current
        const img = imgRef.current
        const size = current.natural.width > 0
          ? current.natural
          : { width: img === null ? 0 : img.naturalWidth, height: img === null ? 0 : img.naturalHeight }
        const box = layoutBox()
        const target = zoomForActualSize(size, box)
        applyView(target, clampPan({ x: 0, y: 0 }, target, box, viewport()))
      }, [applyView, layoutBox, viewport])

      /** 以某个点为锚缩放；锚点换算到「相对视口中心」，与 pan 同坐标系。 */
      const zoomAt = useCallback((factor, clientX, clientY) => {
        const current = viewRef.current
        const box = surfaceRef.current
        let point = { x: 0, y: 0 }
        if (box !== null && typeof clientX === 'number' && typeof clientY === 'number') {
          const rect = box.getBoundingClientRect()
          point = {
            x: clientX - rect.left - rect.width / 2,
            y: clientY - rect.top - rect.height / 2,
          }
        }
        const next = zoomAroundPoint(current.zoom, current.pan, point, factor)
        // 缩放后立刻重新钳位：放大后的可拖范围变了，旧 pan 可能已经越界。
        applyView(next.zoom, clampPan(next.pan, next.zoom, layoutBox(), viewport()))
      }, [applyView, layoutBox, viewport])

      /**
       * 尺寸：`ResizeObserver` 观察**图片自己**，读布局框（`offsetWidth/offsetHeight`）。
       *
       * 不用 `load` 事件——缓存命中时它不再触发，尺寸会是 0，拖拽恒死。
       * 观察 stage（而不是图片）报的是视口尺寸，不是图片尺寸。
       * 布局框一变就重新钳一次：图换了 / 视口变小，旧 pan 可能已经越界。
       */
      useEffect(() => {
        const img = imgRef.current
        if (img === null) return undefined
        const measure = () => {
          const width = img.offsetWidth
          const height = img.offsetHeight
          const naturalWidth = img.naturalWidth || 0
          const naturalHeight = img.naturalHeight || 0
          const current = viewRef.current
          if (width > 0 && height > 0 && (width !== current.layout.width || height !== current.layout.height)) {
            setLayout({ width, height })
          }
          if (naturalWidth > 0 && naturalHeight > 0
            && (naturalWidth !== current.natural.width || naturalHeight !== current.natural.height)) {
            setNatural({ width: naturalWidth, height: naturalHeight })
          }
          if (width > 0 && height > 0) {
            const clamped = clampPan(current.pan, current.zoom, { width, height }, viewport())
            if (clamped.x !== current.pan.x || clamped.y !== current.pan.y) {
              setPan(clamped)
              paint(current.zoom, clamped)
            }
          }
        }
        measure()
        if (typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(measure)
        observer.observe(img)
        return () => observer.disconnect()
      }, [paint, viewport])

      /** 视口尺寸变了（窗口缩放 / 浮层重排）→ 重新钳一次。 */
      useEffect(() => {
        const box = surfaceRef.current
        if (box === null || typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(() => {
          const current = viewRef.current
          const view = viewport()
          const clamped = clampPan(current.pan, current.zoom, safeLayoutSize(current.layout, view), view)
          if (clamped.x !== current.pan.x || clamped.y !== current.pan.y) {
            setPan(clamped)
            paint(current.zoom, clamped)
          }
        })
        observer.observe(box)
        return () => observer.disconnect()
      }, [paint, viewport])

      /** 滚轮缩放：必须 `passive:false`，否则 `preventDefault` 无效、整页跟着滚。 */
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
       * `pointer` 与 `mouse` **双挂**：某些宿主吞掉其中一套。双挂不会出错——
       * 位移是**绝对式**（起点 + 累计），同一个物理位移算几次结果一样。
       * `move` / `up` 绑在 `window`：指针移出图片就丢事件源，拖拽半途断掉。
       */
      useEffect(() => {
        const box = surfaceRef.current
        if (box === null) return undefined

        const finish = event => {
          const drag = dragRef.current
          if (drag === null) return
          dragRef.current = null
          box.classList.remove('dragging')
          const current = viewRef.current
          const view = viewport()
          const size = safeLayoutSize(current.layout, view)
          // 松手位置未必从事件里拿得到（某些鼠标事件不带坐标），那就用最后
          // 一帧的挂起值；两者都没有时才退回已提交的 pan。
          let final = pendingRef.current === null ? current.pan : pendingRef.current.pan
          if (event !== undefined && event !== null
            && typeof event.clientX === 'number' && Number.isFinite(event.clientX)
            && Number.isFinite(event.clientY)) {
            final = clampPan(dragPan(drag, { x: event.clientX, y: event.clientY }), current.zoom, size, view)
          }
          applyView(current.zoom, final)
        }

        const onDown = event => {
          // 右键 / 中键不该开始拖拽（按下时 button 是 0 才是左键）。
          if (event.button !== 0) return
          const current = viewRef.current
          // 起点只读：本次位移永远由它 + 指针累计位移算出，结果绝不写回。
          dragRef.current = beginDrag({ x: event.clientX, y: event.clientY }, current.pan)
          box.classList.add('dragging')
        }

        const onMove = event => {
          const drag = dragRef.current
          if (drag === null) return
          const current = viewRef.current
          const view = viewport()
          const raw = dragPan(drag, { x: event.clientX, y: event.clientY })
          schedule(current.zoom, clampPan(raw, current.zoom, safeLayoutSize(current.layout, view), view))
        }

        box.addEventListener('pointerdown', onDown)
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', finish)
        window.addEventListener('pointercancel', finish)
        box.addEventListener('mousedown', onDown)
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', finish)

        return () => {
          box.removeEventListener('pointerdown', onDown)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', finish)
          window.removeEventListener('pointercancel', finish)
          box.removeEventListener('mousedown', onDown)
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', finish)
          dragRef.current = null
          box.classList.remove('dragging')
        }
      }, [applyView, schedule, viewport])

      /** 键盘：Esc 关闭、方向键平移（Shift 加大步）、+/- 缩放、0 复位、1 切 1:1。 */
      useEffect(() => {
        const onKey = event => {
          if (event.key === 'Escape') { event.stopPropagation(); onClose(); return }
          // 视频没有缩放/拖动，只留 Esc。
          if (imgRef.current === null) return
          const current = viewRef.current
          const view = viewport()
          const size = safeLayoutSize(current.layout, view)
          const step = event.shiftKey ? 120 : 60
          const nudge = (dx, dy) => {
            applyView(current.zoom, clampPan({
              x: current.pan.x + dx,
              y: current.pan.y + dy,
            }, current.zoom, size, view))
          }
          if (event.key === 'ArrowLeft') { event.preventDefault(); nudge(-step, 0) }
          else if (event.key === 'ArrowRight') { event.preventDefault(); nudge(step, 0) }
          else if (event.key === 'ArrowUp') { event.preventDefault(); nudge(0, -step) }
          else if (event.key === 'ArrowDown') { event.preventDefault(); nudge(0, step) }
          else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(ZOOM_STEP) }
          else if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomAt(1 / ZOOM_STEP) }
          else if (event.key === '0') { event.preventDefault(); resetFit() }
          else if (event.key === '1') { event.preventDefault(); actualSize() }
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [actualSize, applyView, onClose, resetFit, viewport, zoomAt])

      /** 卸载时撤掉挂起的帧，免得对已卸载的组件提交状态。 */
      useEffect(() => () => {
        if (frameRef.current !== 0 && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
        pendingRef.current = null
      }, [])

      const readout = layout.width > 0
        ? viewerReadout(zoom, layout, pan)
        : '读取中…'

      const foot = h('div', { className: 'dd-modal-foot' },
        h('span', { className: 'mf' }, '路径 ', h('b', null, item.path || '—')),
        item.source ? h('span', { className: 'mf' }, '来源 ', h('b', null, item.source)) : null,
        item.state ? h('span', { className: 'mf' }, '状态 ', h('b', null, item.state)) : null,
        item.notes ? h('span', { className: 'mf' }, '备注 ', h('b', null, item.notes)) : null,
        item.prompt
          ? h('div', { className: 'dd-modal-prompt' }, item.prompt)
          : (isVideo ? null : h('span', { className: 'mf', style: { color: 'var(--ink4)' } }, '（这张图没有登记提示词）')),
      )

      /**
       * 视频资产：同一个浮层里直接播。
       *
       * 手势一律不挂（`surfaceRef` 不绑在这个容器上，几个 effect 自然空转），
       * 头部只留关闭——给视频缩放拖动没有意义，还会和 `<video controls>` 抢指针。
       * 早退排在这里（所有 hook 之后），否则两次渲染的 hook 数不同 ⇒ React #310。
       */
      if (isVideo) {
        return h('div', {
          className: 'dd-modal-backdrop',
          onMouseDown: event => { if (event.target === event.currentTarget) onClose() },
        },
          h('div', { className: 'dd-modal', role: 'dialog', 'aria-modal': 'true' },
            h('div', { className: 'dd-modal-head' },
              h(Icon, { name: 'film', size: 14 }),
              h('span', { className: 'num', style: { fontSize: '12.5px' } }, item.id || ''),
              h('span', { className: 'dd-spacer' }),
              h('button', { className: 'dd-icon-btn', onClick: onClose, title: t('action.close', '关闭') },
                h(Icon, { name: 'close', size: 13 })),
            ),
            h('div', { className: 'dd-viewer-video' },
              h('video', {
                src: viewerVideoSrc(item, src),
                controls: true,
                preload: 'metadata',
                playsInline: true,
              }),
            ),
            foot,
          ),
        )
      }

      return h('div', {
        className: 'dd-modal-backdrop',
        onMouseDown: event => { if (event.target === event.currentTarget) onClose() },
      },
        h('div', { className: 'dd-modal', role: 'dialog', 'aria-modal': 'true' },
          h('div', { className: 'dd-modal-head' },
            h(Icon, { name: 'eye', size: 14 }),
            h('span', { className: 'num', style: { fontSize: '12.5px' } }, item.id || ''),
            h('span', { className: 'dd-spacer' }),
            // 读数既是用户反馈，也是**实机验收的读数**（适配% · 实际尺寸 · 位移）。
            h('span', { className: 'dd-zoom-readout', title: readout }, readout),
            h('button', { className: 'dd-btn sm', onClick: resetFit, title: '复位到适配尺寸（100%）' }, t('action.fit', '适应窗口')),
            h('button', { className: 'dd-btn sm', onClick: actualSize, title: '按原始像素显示（1:1）' }, t('action.actualSize', '1:1')),
            h('button', { className: 'dd-icon-btn', onClick: onClose, title: t('action.close', '关闭') },
              h(Icon, { name: 'close', size: 13 })),
          ),
          h('div', {
            className: 'dd-zoom-stage',
            ref: surfaceRef,
            title: readout,
            onDoubleClick: resetFit,
            // 拒绝浏览器的原生图片拖拽：Chromium 会吞掉 move 事件。
            onDragStart: event => event.preventDefault(),
          },
            h('img', {
              ref: imgRef,
              src: src,
              alt: item.id || '',
              draggable: false,
              style: { transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')' },
            }),
            h('div', { className: 'dd-zoom-hint' }, '滚轮缩放 · 拖动平移 · 双击复位 · 0 适配 / 1 原始像素'),
          ),
          foot,
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
      const inspector = usePanelWidth({ storageKey: 'dsh-drama-desk:inspector-width', initial: 420, label: '镜详情' })
      const chatPanel = usePanelWidth({ storageKey: 'dsh-drama-desk:chat-width', initial: 460, label: '构思会话' })

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
              className: 'dd-icon-btn' + (chatVisible ? ' on' : ''),
              type: 'button',
              onClick: () => {
                const next = !chatVisible
                setChatWanted(next)
                try { window.localStorage.setItem('dsh-drama-desk:chat-open', next ? '1' : '0') } catch { /* 存不下就算了 */ }
              },
              title: chatVisible ? '收起构思会话' : '展开构思会话（在当前页面也能开）',
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
                              ? h(VerifyView, { data: stageData, busy, actions, onOpenShot: openShot, onGoto: gotoStage })
                              : shownStage === 'assemble'
                                ? h(AssembleView, { data: stageData, onOpenShot: openShot })
                                : h(DeliverView, { data: stageData }))
                : null,
            view === 'spec' ? h(SpecView, { spec, tab: specTab, onTab: setSpecTab, stage: specStage, onStage: setSpecStage, onGoto: gotoStage }) : null,
            view === 'assets' ? h(AssetsView, { assets, workspaceId, onOpenImage: asset => setViewer(asset), onGoto: gotoStage }) : null,
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
          (view === 'stage' && !showHome
            && (selectedShot !== null || viewStage === 'generate' || viewStage === 'storyboard'))
            ? h('div', {
              className: 'dd-side' + (inspector.full ? ' full' : ''),
              ref: inspector.panelRef,
              style: inspector.style,
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
              className: 'dd-side' + (chatPanel.full ? ' full' : ''),
              ref: chatPanel.panelRef,
              style: chatPanel.style,
              'data-resizing': chatPanel.dragging ? 'true' : 'false',
            },
              h(ConceiveChat, {
                sessionId: conceive && conceive.sessionId ? conceive.sessionId : undefined,
                busy,
                canStart: workspaceId !== '',
                onStart: () => openConceive(false),
                onClose: () => {
                  setChatWanted(false)
                  try { window.localStorage.setItem('dsh-drama-desk:chat-open', '0') } catch { /* 存不下就算了 */ }
                },
                onFresh: () => openConceive(true),
                panelControls: chatControls,
                dshWorkspaceId: conceive && conceive.dshWorkspace ? conceive.dshWorkspace.id : undefined,
                // Host 回报「项目范围有没有作为 prompt context 交给宿主」。
                // false = 宿主版本不支持那条通道，agent 不知道这次只谈哪个项目 → 界面要如实说。
                seeded: conceive && conceive.created === true ? conceive.seeded !== false : undefined,
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
        // ── 放大编辑窗口 ──────────────────────────────────────────────────
        // 浮层里最后渲染 ⇒ 它在最上面。
        textDialog
          ? h(TextDialog, {
            title: textDialog.title,
            value: textDialog.value,
            placeholder: textDialog.placeholder,
            serif: textDialog.serif,
            mono: textDialog.mono,
            initialMode: textDialog.initialMode,
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
  },
})
