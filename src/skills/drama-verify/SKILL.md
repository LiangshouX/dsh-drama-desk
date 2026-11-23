---
name: drama-verify
description: AI 短剧与微电影的镜头验收。读取当前视频版本和检查报告，辅助导演发现技术、表演与连续性问题，记录人工复核并安排返工。用户要求验收、审片、复核或处理失败镜头时使用。
---

# 镜头验收

1. 用 `drama_desk_production` 指定作品与 stage=verify 读取实际载荷，随后用 `drama_desk_rules` 读本阶段规范。不假设工作区存在外部 CLI。
2. 只审当前版本；用 `drama_desk_shot` 查看镜头、视频资产、beats 与报告。没有视频或报告时如实说明；未知不能说成通过。
3. 技术、语义与人工判定分别记录。机器结果不能冒充人工意见，复核人不能编造。判废仍需人工复核，依据见规范。
4. 导演回看后，可用 `drama_desk_review` 的 patch 记录 verdict、reviewer、issues、note；只有导演明确确认当前版本通过，才调用 approve=true。该操作校验复核版本与当前视频一致。
5. 返工用镜头批注留问题，回到相应阶段修源文件；付费重生成先明确授权并检查台账。不要删除旧版本。

出口：`verify/<shot-id>.report.json`；人工确认后 shots.json 的 status=verified，并绑定 verified_asset_id。
