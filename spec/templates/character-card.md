# 角色卡与道具卡骨架（characters.json）

> 模板覆盖栈：`.drama/templates/character-card.md`（作品级可覆盖）。
> 填入 `workspaces/<work-id>/characters.json`，然后执行
> `python tools/drama/drama.py characters write` 同步计数。

## 角色字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | 小写英文、无空格、全作品唯一：`aling` / `shopkeeper` |
| `name` | ✅ | 剧中称呼（可能是典号） |
| `role` | ✅ | 主角 / 对手 / 配角 / 功能角色 |
| `age` | | 外显年龄。**参考图会跟着走**，别写"少年相"却要成年角色 |
| `appearance` | ✅ | 外貌特征，至少写清：发型 / 脸型 / 体型 / 标志物 |
| `behavior` | ✅ | **一个可被镜头拍到的动作**。不是性格形容词 |
| `voice` | | 说话方式：句长 / 用词 / 是否用敬语。用于区分角色 |
| `states` | ✅ | 视觉状态数组：`["dry"]` / `["dry","wet"]` / `["day","night"]` |
| `props` | | 随身道具 ID 数组（指向下方 props） |
| `reference_assets` | | 参考图资产 ID 数组（`assets.json` 里的 id） |
| `voice_desc` | | **音色描述词**：逐字复制到每条需要此角色说话的提示词里 |

## 道具字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | `prop_<name>` |
| `name` | ✅ | 剧中名称 |
| `appearance` | ✅ | 外观细节。**关键道具必须单独有参考图**，否则会被"搬家" |
| `owner` | | 归属角色 ID |
| `reference_assets` | | 道具参考图资产 ID |

## 示例

````json
{
  "version": "1.0",
  "characters": [
    {
      "id": "aling",
      "name": "阿铃",
      "role": "主角",
      "age": "17-18",
      "appearance": "齐耳短发，左侧用铜夹别住；瘦小；粗布罩衫，右手食指有墨渍",
      "behavior": "记账时左手小指压住纸角；被叫典号时手不停、头不抬",
      "voice": "短句，少用主语，回答只用一个字；从不辩解",
      "states": ["dry"],
      "props": ["prop_benmingqi"],
      "reference_assets": ["aling_dry_full", "aling_face"],
      "voice_desc": "a calm, low-pitched young female voice, slightly husky, steady tempo, clear diction"
    }
  ],
  "props": [
    {
      "id": "prop_benmingqi",
      "name": "本名契",
      "appearance": "泛黄宣纸，折痕三道，右下角一枚朱砂印",
      "owner": "aling",
      "reference_assets": ["prop_benmingqi"]
    }
  ]
}
````

## 约束

- `states` 要**穷举本片会出现的状态**。漏掉一个状态，到 storyboard 才发现就得回头补图。
- `reference_assets` 里的每个 id 都必须已在 `assets.json` 登记（`drama asset list --type reference_image`）。
- `voice_desc` 是**逐字复用**的字段，不是描述性提示——同一角色所有镜头必须完全一致。
