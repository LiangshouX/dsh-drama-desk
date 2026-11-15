# 场次表骨架（scenes.json）

> 模板覆盖栈：`.drama/templates/scene-table.md`（作品级可覆盖）。
> 填入 `workspaces/<work-id>/scenes.json`，然后执行
> `python tools/drama/drama.py scenes write` 同步计数。

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | `SC01` / `SC02`，两位数字从 01 起，**连续不跳号** |
| `index` | ✅ | 场次序号，与 id 后缀一致 |
| `act` | ✅ | 1 / 2 / 3 —— 属于哪一幕 |
| `title` | ✅ | 四到八字 |
| `function` | ✅ | 这一场在故事里的功能：建置 / 升级 / 转折 / 揭示 / 收束 |
| `duration` | ✅ | 预估秒数（受总时长约束） |
| `summary` | ✅ | 一句话：这一场发生了什么 |
| `turn` | | 这一场结束时**什么变了**。没有变化就别写 |
| `characters` | ✅ | 出场角色 ID 数组（来自 characters.json） |
| `beats` | | **script 阶段填**：动作与台词序列。outline 阶段留空数组 |

## 示例

````json
{
  "version": "1.0",
  "scenes": [
    {
      "id": "SC01",
      "index": 1,
      "act": 1,
      "title": "拾音斋清晨",
      "function": "建置",
      "duration": 20,
      "summary": "掌柜连喊三声典号，阿铃笔不停、头不抬地应了一声。",
      "turn": "观众知道她的真名并非本名，而她装作不知道。",
      "characters": ["aling", "shopkeeper"],
      "beats": []
    }
  ]
}
````

## 约束

- 场次**不是镜头**。一个场次会拆成 2–5 个镜头，那是 storyboard 阶段的事。
- `duration` 之和应接近 brief 里的总时长，允许 ±15%。
- 每场都要有 `turn` 或明确它不承担转折功能——**没有变化的场次就是废场次**。
