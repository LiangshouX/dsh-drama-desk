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
/* 草稿徽标：名字还没定，别让人以为这就是最终标题。 */
.dd-work-draft{
  flex:none;align-self:center;font-family:var(--f-gauge);font-size:8.5px;letter-spacing:.12em;
  text-transform:uppercase;padding:1.5px 5px;border-radius:var(--rx-1);color:var(--ink3);
  box-shadow:inset 0 0 0 .5px var(--line-2);
}
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
  /* 一屏话会盖住整个面板：给一个高度上限，超出就滚。消息本身该短——
     这是兜底，不是让人读长文的入口。 */
  max-height:38vh;overflow:auto;overflow-wrap:anywhere;line-height:1.55;
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
/* 窄台面（手机 / 竖屏 Pocket）：顶栏先让出品牌文字。
   390 CSS px 实测：品牌名 + 分隔线 + 作品牌 + 右侧按钮合计 468px，容器只有 388px ——
   「制作助手 / 刷新 / 设置」被挤出可视区，而那三个按钮没有第二个入口。
   这里把品牌收成标记、让作品牌可缩，并允许换行兜底（再窄也不会被裁掉）。 */
@container dd-root (max-width: 520px){
  .dd-mast{gap:10px;padding:6px 12px;min-height:54px;height:auto;flex-wrap:wrap;row-gap:6px}
  .dd-brand{gap:0}
  .dd-brand-name,.dd-brand-sub,.dd-mast-sep{display:none}
  .dd-work{min-width:0;flex:1 1 auto}
  .dd-work-label{display:none}
  .dd-work-title{max-width:110px}
  .dd-mast-right{gap:6px}
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
