---
name: drama-assemble
description: AI 短剧与微电影的本地装配。检查镜头当前版本、验收和音轨，调用工作台本地 FFmpeg 顺切粗剪，跟踪导出并保留版本来源。用户要求装配、粗剪、连接镜头或输出本地成片时使用。
---

# 本地装配

1. `drama_desk_production` 指定作品、stage=assemble；读 ready、gaps、warnings 和 job，再读本阶段规范。
2. 有缺口先解决，不能用历史版本代替缺失的当前版本。缺少人工验收时回到验收页，不能批量把 status 改为 verified。
3. 导演要求本地粗剪时，调用 `drama_desk_assemble`：profile=landscape、portrait 或 square。该工具只用本机 FFmpeg，无生成费用。保留整个镜头和原声，统一 24fps；留黑边适配画幅，无声镜补静音。
4. 工具立即返回任务。后续按需要读 production 的 assemble 载荷，避免高频轮询。运行中不重复创建任务；失败读 job.message，修复后重试。
5. 成功后到 deliver 阶段回看。粗剪不自动代表最终验收；不能声称已完成字幕、配乐、精剪或混音。

出口：`finals/<cut-id>.mp4`、已登记资产和 `assembly/<cut-id>/manifest.json`。输入与历史输出均保留。
