# imagecraft · 独立技能说明

> **本技能独立于 drama 工作流。**
> 它不参与 `conceive → outline → characters → script → storyboard → generate → verify → assemble → deliver` 流水线，
> 不被 `drama.py` 的阶段路由加载，也不依赖 `.drama/` 记忆层（rules / constitution / templates / references）。
> 它解决的是**通用问题**：怎么写出高质量图像的提示词、怎么选和控制锚点、怎么把画面质量从"能看"提到"能打"。

---

## 它是什么

一个面向 **MiniMax-H3-Image**（Connector 通道 `connector__matrix__generate_image`）的高质量生图方法论技能，
覆盖两大画风支线：

- **影视级 3D CG 写实**（剧情画面质感：影调、镜头、材质、骨相）
- **2D 赛璐璐 / 手绘动画**（与 drama 项目的 `.drama/references/角色参考图提示词配方.md` 互补，后者更侧重该项目的具体角色配方）

以及跨支线通用的工程方法：**锚点纪律、提示词结构、探针验证、验收标准、接口与成本**。

---

## 与 drama 工作流的关系

| | drama 工作流 | imagecraft |
|---|---|---|
| 触发方式 | `python tools/drama/drama.py next` 路由 | 直接描述需求即可命中本技能 |
| 记忆层 | `.drama/`（rules / constitution / templates / references） | 自带 `references/`，**不读 `.drama/`** |
| 阶段产物 | scenes.json / characters.json / shots.json … | 无结构化产物，只交付图像 |
| 职责 | 短剧全流程编排 | 单张图像的质量控制 |

**当前状态：独立并行，尚未集成。**
等本技能的规律经过更多题材验证、沉淀出可自动化的批量生产流程后，再考虑把它接进 drama 的 `characters` / `generate` 阶段，
届时预计的做法是：把 imagecraft 的锚点纪律与词表规范提炼为 `.drama/rules.md` 的新规则条目（记忆层仍是单一真源），
由 `drama.py` 在 `characters` / `generate` 阶段注入。

---

## 目录结构

```
imagecraft/
├── SKILL.md                    主流程：七条硬规则 + 五步工作流 + 七段式提示词骨架
├── README.md                   本文件（独立性与集成路线说明）
├── references/
│   ├── 锚点学.md               锚的职责、选择、降级传递、图序、题材语汇距离
│   ├── 提示词结构.md           七段式、语汇分簇、危险词表、面部公式、构图参数
│   ├── 影调与光.md             镜头/光位/材质/调色语汇库、纵深三层、一致性复用
│   ├── 探针方法论.md           A/B 实验设计、读数比对(image_qc)、评分维度、验收清单
│   ├── 接口速查.md             H3-Image 接口、幂等约束、成本、超分与配套工具
│   └── 实测案例库.md           14 张探针的对照结论与来源
└── assets/probe-sheets/        实验证据拼图（**不入库**，在工作区 reference/ 下；⚠️ 不要 read_image，会卡死会话）
```

> ⚠️ **`assets/probe-sheets/` 只作历史存档，不是给模型看的。**
> 这些拼图 1270×946 ~ 1270×1414，目前实测能通过输入审核，
> 但**大幅多脸拼图会被判敏感并永久卡死会话**（已发生 3 次）。
> 审图请用 `tools/drama/image_qc.py` 读数。

---

## 快速上手

1. 读 `SKILL.md` 的两条核心规则：**锚点是天花板**、**词表决定落点簇**。
2. 挑一张**质量最高的原图**当风格锚（不要用自己刚生成的图）。
3. 抄 `references/影调与光.md` 的四段语汇 + `references/提示词结构.md` 的七段式骨架。
4. 一次提交 n=2，跑 `python tools/drama/image_qc.py --dir <目录>` **读数对比**
   （不要拼图、不要 `read_image`，见 `探针方法论.md` §3）。
5. 数字达标后，由**人**过一眼原图定稿，再接 4K + `enhance_image`。
