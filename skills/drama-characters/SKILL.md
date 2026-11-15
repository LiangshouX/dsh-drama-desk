---
name: drama-characters
description: AI 短剧/微电影的角色美术阶段。定义角色 ID、外貌、行为特征、各状态变体与关键道具，生成并登记参考图，产出 characters.json。当用户要定角色设定、画角色立绘、准备角色参考图、补状态变体或准备道具参考图时使用。不用于结构分场、剧本台词、分镜拆镜或镜头生成。
---

# drama-characters — 角色与美术设定

**本阶段产出**：`workspaces/<work-id>/characters.json`（角色卡 + 道具卡）+ 角色参考图资产。

---

## 0. 开工前

```bash
python tools/drama/drama.py next --work <work-id>
python tools/drama/drama.py constitution
python tools/drama/drama.py template character-card
python tools/drama/drama.py scenes read --work <work-id>
```

角色 ID 已在 outline 阶段定好（`scenes.json` 的 `characters` 数组），**沿用，不改名**。

---

## 1. 先列 state 表，再生成参考图

这是本阶段最容易翻车的地方：**state 漏一个，到 storyboard 才发现，就得回头补图，返工成本最高**。

步骤：

1. 逐场过 `scenes.json`，凡是**同一角色的外观、服装、环境光照不同**，就是一个 state
2. 写成表：

| state | 出现在 | 触发原因 |
|---|---|---|
| dry | SC01–SC08 | 默认 |
| wet | SC09 | 雨夜 |
| night | SC05–SC06 | 时间推进 |

3. **穷举完再生成图。** 宁可多列一个用不到的 state，也别漏。

state 的常见来源：干/湿、白/夜、季节、年龄阶段、受伤/恢复、服装更换、妆造。

---

## 2. 角色卡怎么写

见 `drama template character-card`。三条关键：

- **`behavior` 必须是动词。** ❌"犹豫不决" ✅"记账时从不写自己那一栏"。抽象性格拍不出来。
- **`age` 要和参考图对得上。** 参考图偏少年相，模型会跟着走（实测踩过）。
- **`voice_desc` 是逐字复用的字段。** 同一角色的所有镜头**完全一致**，不许每条现写。写成一句话描述音色、语速、清晰度。

---

## 3. 参考图规格

每个角色至少两张：

| 图 | 作用 |
|---|---|
| **全身正面** | 锁定体型、身高、整体轮廓 |
| **面部特写** | 锁定脸型五官——**跨镜头辨认同一人主要靠这张** |

每个变体 state 各一套。

规格：

- **纯色背景**（纯白或纯灰），不要场景、不要道具、不要其他角色
- 光照均匀，避免强侧光（否则光影会被"烙"进身份特征，换个场景就变脸）
- 同一角色的所有图**同一套服装体系、同一种画风**
- 人物占画面 60–80%，四周留边

**道具参考图单独一张**：道具为主体的特写，背景同样纯净。关键道具（主角欲望指向的那件东西）必须有独立参考图，否则会被"搬家"到背景里（实测：琴身贴纸跑到了路灯柱上）。

---

## 4. 生成与登记

```bash
mcode-tools connector call connector__matrix__generate_image --args-file <args.json>

python tools/drama/drama.py asset add refs/aling_dry_full.png \
  --type reference_image --role aling --state dry
```

登记时的 `--role` / `--state` **必须和 characters.json 里写的完全一致**——storyboard 阶段靠这两个字段绑定参考图，写错就错配。

道具图用 `--role prop_benmingqi`，`--state` 留空。

---

## 5. 检查

把一个角色的所有参考图排成一排看：

- 能看出是**同一个人**吗？
- 服装体系一致吗？
- 变体之间的差异是**真实的**吗（不是同一张图换了滤镜）？

道具图和角色图能一眼分清吗？道具图有没有被环境元素污染？

**角色卡和参考图是否一致**？（`age`、`appearance` 描述的特征，图里有没有）

---

## 6. 交接

```bash
python tools/drama/drama.py characters write
python tools/drama/drama.py advance --stage script --note "N 个角色 / M 个道具 / K 张参考图"
```

---

## 7. 边界

- **不写**台词（那是 script）、**不排**镜头（storyboard）。
- 不生成"以后可能用"的角色——只做 brief 里真实出现的。
- 不改 brief 里的角色动机与关系，那是 conceive 的产物。
- 参考图生成是付费调用，**批量生成前先给用户看清单**。
