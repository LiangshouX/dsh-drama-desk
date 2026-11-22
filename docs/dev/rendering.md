# 渲染层陷阱（改界面之前先读这篇）

这些坑都在 DSH Desktop 的 Electron 渲染器里真实踩过。分两类，**症状都长得像「没数据」**：

- Chromium 的合成/裁剪 bug：**DOM 在、几何对、就是不画**——自动化断言查不出来。
- React 的 hook 规则：**整个面板崩成一片空白**——控制台里才有真相。

所以规矩只有一句话：**改完界面要截图，并且要看控制台。**

---

## R1 同一层叠上下文里的大模糊层会吃掉 `backdrop-filter`

`.dd-ambient` 里有三个 `56vmax` 的 `filter: blur(70px)` 光斑。同一个层叠上下文里
再给顶栏用 `backdrop-filter`，Chromium 会把该元素的**内容层整个丢掉**——只剩背景，
文字、按钮、图标全不画。

**对策**：顶栏 / 抽屉 / 浮层一律**不用 `backdrop-filter`**，用半透明纯色。
（大光斑本身可以留，它自己画得好好的——但它很贵，见 `performance.md` P3。）

## R2 纵向 flex 容器里的子项会被压扁

`.dd-inspector-body` 是 `display:flex; flex-direction:column`。子项默认可压缩，
内容比容器高时它们会被**压扁**（而不是溢出滚动）——表现为每段只露一条缝。

**对策**：可滚动的纵向 flex 容器里，所有直接子项都要 `flex:0 0 auto`。

## R3 渐变背景 + `backdrop-filter` 同元素 = 内容不画

`background: linear-gradient(...)` 与 `backdrop-filter` 同时用在同一元素上时，
Chromium 会丢内容层。纯色背景没有这个问题。

**对策**：不要在同一个元素上同时用渐变背景与 `backdrop-filter`。

## R4 祖先 `overflow:hidden` + 自身带 `filter` 的 `<img>` = 空白图片

`.dd-thumb img` 曾经带 `animation: dd-develop`（里面是 `filter: blur(10px)`）。
结果**参考图一片空白**——DOM 在、几何对、网络请求也成功，就是不画。

与 R1/R3 同源：Chromium 在「祖先裁剪 + 自身滤镜」这一组合下会丢内容层。

**对策**：入场动画只用 `opacity` / `transform`；任何 `filter` 都不许进图片动画。

## R5 横向 flex 里的中文标题会被压成一个字一行

`.dd-stagehead` 是横向 flex。右侧一旦放了一条很宽的子元素（12 枚场次 chip），
左侧的中文标题就被压到**最小内容宽度 = 1 个字**，于是整段话竖着排。

**对策**：给文字那一侧一个下限（`min-width: 300px`），并允许换行（`flex-wrap: wrap`）。
挤不下就换行，不许把字压成一列。

## R6 把元素包进新容器时：`flex:0 0 auto` 的**主轴**会换人

症状：右侧聊天窗**不可滚动**，消息一长就把输入框顶到视口外面去；而页面本身也不滚
（`.dd-body` 是 `overflow:hidden`）——于是**输入框彻底看不见**。

根因：`.dd-chat` 带着 `flex:0 0 auto`。它原先是 `.dd-body`（**行**向 flex）的直接
子项，那个声明管的是**宽度**；被包进 `.dd-side`（**列**向 flex）之后，同一个声明落到
**高度**上，而 `flex-shrink:0` 意味着不许收缩 ⇒ 聊天窗被内容撑到 1181px，消息流的
`overflow:auto` 永远用不上。

**对策**：包进新容器时，主轴变了就得重写 flex 声明：

```css
.dd-side > .dd-inspector,
.dd-side > .dd-chat { flex: 1 1 auto; min-height: 0; overflow: hidden; }
```

**症状特征**：某个可滚动区域「突然不滚了」，而它的父容器高度 > 视口。
排查第一步是**量几何**（`getBoundingClientRect()` + `scrollHeight` vs `clientHeight`），
不要凭截图猜。

---

## R7 React：早退必须排在所有 hook 之后

```js
// 错：第一次渲染没数据、第二次有了 → hook 数变了 → React #310 → 整个面板空白
if (!ledger) return <Empty/>
const rows = useMemo(() => …, [ledger])

// 对：hook 先跑完，再决定渲染什么
const rows = useMemo(() => ledger ? … : [], [ledger])
if (!ledger) return <Empty/>
```

`scripts/build-client.mjs` 会扫每一个组件拦这一条。

## R8 React：effect 的依赖数组在**渲染时**求值

effect 里引用后面才声明的 `const`，会撞上
`ReferenceError: Cannot access 'showHome' before initialization`，**整个面板直接崩掉**
（控制台里是 `slot entry crashed in 'main'`）。要么把 effect 挪到那个 `const` 之后，
要么别引用它。

## R9 崩掉的 panel 在画面上只是「一片空白」

它很容易被当成「没数据」而不是「代码错了」。

**对策**：改完界面**看控制台**，不只是看画面。`slot entry crashed` / React #310
这类错误只在控制台里，画面上一片安静。

---

## R10 截图纪律

```powershell
pwsh scripts/shot.ps1            # 默认把最长边缩到 1200px 再存
```

- 截图必须**缩到最长边 ≤1200px** 再读（见 `AGENTS.md` 的图片纪律：大尺寸多脸拼图
  会被输入审核判为敏感并**永久卡死会话**）。
- 判「面板可见」看**几何**（宽高非零），不看「元素还在不在」——宿主可能把面板留在
  DOM 里只是不显示。
- 探针说「通过」也可能什么都没测到，见 `performance.md` P5。
