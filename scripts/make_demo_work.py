#!/usr/bin/env python3
"""生成一个**带真实媒体**的演示作品，让导演工作台有东西可看。

产物落在用户「视频」目录下的 `drama-desk-demo/workspaces/…`，**不在插件仓库里**
（作品数据不属于方法论仓库）。

两种规模：

  --scale small （默认，行为与上一版完全一致）
      最小链路：4 场 / 7 镜 / 5 资产 / 1 条真视频 / 7 份提示词产物。
      参考图是**真的图片**（其中一张 2048px，用来验证 ≤1200px 的显示约束），
      视频是**真的视频**（用来验证播放器与运动层体检）。

  --scale large
      **规模化**的演示作品：12 场 × 6 镜 = 72 镜。用来验证界面在真实规模下
      还站得住——场次导航、分页、网格性能、各阶段视图、资产图谱。
      · 6 张角色卡 + 4 张道具卡（带完整字段：外观 / 行为 / 音色 / 默认语气）
      · 16 张真参考图（抽象构图：渐变场 + 几何形 + 柔光晕，其中**恰好一张**
        2048×2048，用来压 ≤1200px 的图片显示约束）
      · 3 条真 MP4（ffmpeg 生成，带真实位移 → 运动层体检能测到）
      · 72 份六段式提示词产物（正文全英文，台词除外）
      · 完整台账（submitting→submitted→running→succeeded 轨迹）与资产索引

用法：
    python scripts/make_demo_work.py --out <目录> [--scale small|large] [--seed N] [--force]

**确定性**：同一个 --seed 必得同一份产物（图片、视频、提示词、JSON 全一致）。
时间戳一律取固定基准时刻，不读系统时钟。
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import math
import pathlib
import random
import shutil
import subprocess
import sys
import tempfile
import time

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("需要 Pillow：pip install pillow")


# ── 调色板（与作品基调一致：暖光 + 冷调环境）─────────────────────────────
PALETTE = [
    ((18, 26, 38), (232, 176, 104), (86, 122, 158)),   # 冷蓝夜色 × 暖灯
    ((38, 30, 26), (240, 198, 128), (120, 92, 74)),    # 暖木柜台 × 冷影
    ((26, 34, 30), (214, 226, 180), (78, 116, 96)),    # 晨雾灰绿 × 纸白
    ((34, 22, 28), (236, 146, 118), (110, 74, 88)),    # 暮色 × 灯笼
]


def draw_frame(width: int, height: int, palette, t: float, label: str) -> Image.Image:
    """画一帧：冷调环境 + 暖光源 + 一个移动的暖色块（让运动层体检有东西可测）。"""
    bg, light, accent = palette
    img = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(img)

    # 冷调渐变环境
    for y in range(height):
        k = y / max(1, height - 1)
        draw.line(
            [(0, y), (width, y)],
            fill=tuple(int(bg[i] * (1 - 0.35 * k) + accent[i] * 0.35 * k) for i in range(3)),
        )

    # 暖光（右上）
    lx, ly = int(width * 0.74), int(height * 0.24)
    for r in range(int(width * 0.42), 0, -6):
        k = 1 - r / (width * 0.42)
        draw.ellipse(
            [lx - r, ly - r, lx + r, ly + r],
            fill=tuple(int(bg[i] + (light[i] - bg[i]) * k * 0.55) for i in range(3)),
        )

    # 前景：一条桌沿 + 一个横向移动的暖色块（真实位移 → 运动体检能测到）
    draw.rectangle([0, int(height * 0.72), width, height], fill=tuple(int(c * 0.55) for c in bg))
    x = int(width * (0.12 + 0.5 * (0.5 + 0.5 * math.sin(t * math.pi * 2))))
    bw, bh = int(width * 0.13), int(height * 0.22)
    draw.rounded_rectangle([x, int(height * 0.72) - bh, x + bw, int(height * 0.72) + 6], radius=8, fill=light)
    draw.rectangle([x + 8, int(height * 0.72) - bh + 10, x + bw - 8, int(height * 0.72) - bh + 26], fill=accent)

    # 画面标记（给验收用的小字）
    draw.text((12, 10), label, fill=(235, 235, 235))
    return img


def make_reference(path: pathlib.Path, size: int, palette, seed: int) -> None:
    """一张「参考图」：竖幅构图，冷调环境 + 暖光主体。"""
    width = size
    height = int(size * 1.5)
    img = Image.new("RGB", (width, height), palette[0])
    draw = ImageDraw.Draw(img)
    bg, light, accent = palette
    for y in range(height):
        k = y / max(1, height - 1)
        draw.line([(0, y), (width, y)], fill=tuple(int(bg[i] * (1 - 0.3 * k) + accent[i] * 0.3 * k) for i in range(3)))
    # 主体：一个头肩剪影
    cx = width // 2
    draw.ellipse([cx - width // 5, height // 6, cx + width // 5, height // 6 + int(width * 0.4)], fill=light)
    draw.ellipse([cx - width // 3, int(height * 0.42), cx + width // 3, height], fill=tuple(int(c * 0.8) for c in accent))
    # 暖光
    for r in range(int(width * 0.7), 0, -8):
        k = 1 - r / (width * 0.7)
        draw.ellipse([width - r, -r // 2, width + r, r], fill=tuple(int(bg[i] + (light[i] - bg[i]) * k * 0.3) for i in range(3)))
    draw.text((10, 10), f"ref {seed}", fill=(240, 240, 240))
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, quality=92)


# ══════════════════════════════════════════════════════════════════════════
#  小规模演示（--scale small）：行为与上一版逐字节一致
# ══════════════════════════════════════════════════════════════════════════

def build_small(work: pathlib.Path, work_id: str) -> None:
    """生成最小演示作品。字段与文件名与上一版完全一致。"""
    (work / "refs").mkdir(parents=True, exist_ok=True)
    (work / "videos").mkdir(parents=True, exist_ok=True)
    (work / "prompts" / "slim").mkdir(parents=True, exist_ok=True)
    (work / "creative").mkdir(parents=True, exist_ok=True)

    # ── 参考图：三张 1024px + 一张 2048px（超限，用来验证显示约束）──────
    refs = []
    for index, (name, size) in enumerate(
        [("hero_face", 1024), ("shop_interior", 1024), ("prop_bell", 1024), ("wide_backroom", 2048)]
    ):
        path = work / "refs" / f"{name}.jpg"
        make_reference(path, size, PALETTE[index % len(PALETTE)], index)
        refs.append({
            "id": name,
            "type": "reference_image",
            "path": f"refs/{name}.jpg",
            "status": "active",
            "role": "anchor" if index == 0 else None,
            "width": size,
            "height": int(size * 1.5),
            "bytes": path.stat().st_size,
            "sha256": "",
            "created_at": "2026-11-15T10:00:00Z",
            "created_by": "demo",
            "source": "demo-generator",
            "notes": f"{name} 参考图",
        })
        refs[-1].pop("role", None) if name != "hero_face" else None

    # ── 一条真的视频（4 秒，带真实位移 → 运动层体检能测到）──────────────
    video_path = work / "videos" / "SC01-SH01_v01.mp4"
    frames_dir = pathlib.Path(tempfile.mkdtemp(prefix="dd-frames-"))
    total = 48
    for i in range(total):
        frame = draw_frame(640, 360, PALETTE[0], i / total, f"SC01-SH01 f{i:03d}")
        frame.save(frames_dir / f"f{i:03d}.jpg", quality=88)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-framerate", "12", "-i", str(frames_dir / "f%03d.jpg"),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(video_path)],
        check=True,
    )
    _rmtree_quiet(frames_dir)

    # ── 场次 / 镜头 ──────────────────────────────────────────────────────
    scenes = [
        {
            "id": "SC01", "index": 1, "title": "柜底那张旧契", "function": "建置",
            "duration": 10,
            "summary": "冷开场：一只苍老的手把一张旧契推回柜底。",
            "characters": ["shopkeeper"],
            "beats": [
                {"action": "抽屉被拉开，木头涩涩地响了一声", "speaker": None, "text": None, "mode": None,
                 "action_en": "A drawer is pulled open, the wood rasping once."},
                {"action": "柜底压着一张对折的脆纸；摊开一角——一条朱红细线把两个名字连在一起", "speaker": None, "text": None, "mode": None,
                 "action_en": "At the bottom of the cabinet lies a brittle paper folded in half; a thin vermilion line links two names together."},
                {"action": "那只手把纸推回柜底，压上；柜台上的黄铜铃闷闷响了一声", "speaker": None, "text": None, "mode": None,
                 "action_en": "The hand pushes the paper back down into the cabinet and presses it flat. Beside it the brass counter bell gives one dull note."},
            ],
        },
        {
            "id": "SC02", "index": 2, "title": "清晨拾音斋", "function": "推进",
            "duration": 18,
            "summary": "阿铃在柜台后擦账本，掌柜推门进来。",
            "characters": ["shopkeeper", "aling"],
            "beats": [
                {"action": "灰蓝的晨光从半卷的卷帘门里漏进来，白炽灯还亮着", "speaker": None, "text": None, "mode": None,
                 "action_en": "Grey-blue early light comes through the half-raised roller shutter and the bare white bulb is lit."},
                {"action": "掌柜坐在高木凳上，钢笔在指间转了半圈", "speaker": None, "text": None, "mode": None,
                 "action_en": "The shopkeeper sits on his tall wooden stool, rolling a wooden-barrel fountain pen half a turn between the fingers of his right hand."},
                {"action": "「十九。」", "speaker": "shopkeeper", "text": "十九。", "mode": "dialogue",
                 "delivery": "第一声轻，像点号",
                 "action_en": "The shopkeeper calls once, lightly."},
                {"action": "阿铃的笔尖在纸上顿住半拍，才落下", "speaker": None, "text": None, "mode": None,
                 "action_en": "The nib of her pen hesitates half a beat on the paper before it lands."},
                {"action": "「在。」", "speaker": "aling", "text": "在。", "mode": "dialogue",
                 "delivery": "第二声慢而沉，带重量",
                 "action_en": "She answers without looking up."},
            ],
        },
        {
            "id": "SC03", "index": 3, "title": "柜台上的铜铃", "function": "转折",
            "duration": 12,
            "summary": "铜铃响了三下，门外有人。",
            "characters": ["aling"],
            "beats": [
                {"action": "铜铃在柜台上晃了两下，余音散在空屋子里", "speaker": None, "text": None, "mode": None,
                 "action_en": "The brass bell on the counter rings twice, its last note drifting through the empty room."},
                {"action": "阿铃抬起头，看向门口", "speaker": None, "text": None, "mode": None,
                 "action_en": "She lifts her head and looks toward the doorway."},
            ],
        },
        {
            "id": "SC04", "index": 4, "title": "当铺的规矩", "function": "收束",
            "duration": 9,
            "summary": "她把旧契压在账本最底下。",
            "characters": ["aling"],
            "beats": [
                {"action": "她把那张旧契折回去，压进账本最底下一页", "speaker": None, "text": None, "mode": None,
                 "action_en": "She folds the old contract back and presses it into the last page of the ledger."},
            ],
        },
    ]

    shots = [
        {"id": "SC01-SH01", "scene": "SC01", "index": 1, "title": "抽屉里的旧契", "duration": 5,
         "ratio": "16:9", "resolution": "768P", "model": "MiniMax-H3", "camera": "Push In", "lighting": "day_paper",
         "characters": [], "references": ["hero_face", "shop_interior", "prop_bell"],
         "dialogue": [], "covers": [1, 2, 3], "current_version": 1, "status": "succeeded",
         "notes": "开场第一镜。手部质感待验收。",
         "motion_action": "抽屉前板被拉开并滑到底，露出柜底那张对折的脆纸",
         "motion_reason": "冷开场靠这一个动作推进",
         "camera_en": "At 00:01.000 the camera begins a slow push in with small amplitude, moving from the counter down to the paper."},
        {"id": "SC01-SH02", "scene": "SC01", "index": 2, "title": "手压回旧契", "duration": 4,
         "ratio": "16:9", "resolution": "768P", "model": "MiniMax-H3", "camera": "Static Shot", "lighting": "day_paper",
         "characters": [], "references": ["hero_face", "prop_bell"], "dialogue": [], "covers": [3],
         "current_version": 1, "status": "pending", "notes": "",
         "motion_action": "那只手把纸推回柜底并压上", "motion_reason": "",
         "camera_en": "A locked-off close view of the drawer bottom."},
        {"id": "SC02-SH01", "scene": "SC02", "index": 1, "title": "柜台后擦账本", "duration": 6,
         "ratio": "16:9", "resolution": "768P", "model": "MiniMax-H3", "camera": "Truck Left", "lighting": "day_interior",
         "characters": ["aling"], "references": ["shop_interior", "hero_face"], "dialogue": [], "covers": [1, 2],
         "current_version": 1, "status": "succeeded", "notes": "R18 表演层样板：柜台后先写动作行，台词拍后必有反应拍。",
         "motion_action": "阿铃左手压住纸角，右手擦过账本",
         "motion_reason": "一镜只做一件事：主体动作，不给运镜",
         "camera_en": "A slow truck left along the counter, revealing the ledger."},
        {"id": "SC02-SH02", "scene": "SC02", "index": 2, "title": "十九", "duration": 8,
         "ratio": "16:9", "resolution": "768P", "model": "MiniMax-H3", "camera": "Push In", "lighting": "day_interior",
         "characters": ["shopkeeper", "aling"], "references": ["hero_face"], "dialogue": [], "covers": [3, 4, 5],
         "current_version": 1, "status": "succeeded", "notes": "三声「十九」要递进：轻 / 重 / 慢而沉。",
         "motion_action": "掌柜的右手转了半圈钢笔", "motion_reason": "",
         "camera_en": "A slow push in toward the shopkeeper's hand holding the pen."},
        {"id": "SC03-SH01", "scene": "SC03", "index": 1, "title": "铜铃响", "duration": 4,
         "ratio": "16:9", "resolution": "768P", "model": "MiniMax-H3", "camera": "Static Shot", "lighting": "day_interior",
         "characters": ["aling"], "references": ["prop_bell", "shop_interior"], "dialogue": [], "covers": [1],
         "current_version": 1, "status": "pending", "notes": "",
         "motion_action": "铜铃在柜台上晃了两下", "motion_reason": "",
         "camera_en": "A locked-off close view of the brass bell."},
        {"id": "SC03-SH02", "scene": "SC03", "index": 2, "title": "抬头", "duration": 4,
         "ratio": "16:9", "resolution": "768P", "model": "MiniMax-H3", "camera": "Push In", "lighting": "day_interior",
         "characters": ["aling"], "references": ["hero_face"], "dialogue": [], "covers": [2],
         "current_version": 1, "status": "pending", "notes": "",
         "motion_action": "阿铃抬起头，看向门口", "motion_reason": "",
         "camera_en": "A slow push in as she lifts her head."},
        {"id": "SC04-SH01", "scene": "SC04", "index": 1, "title": "压在账本最底下", "duration": 9,
         "ratio": "16:9", "resolution": "768P", "model": "MiniMax-H3", "camera": "Pull Out", "lighting": "day_interior",
         "characters": ["aling"], "references": ["wide_backroom"], "dialogue": [], "covers": [1],
         "current_version": 1, "status": "pending", "notes": "",
         "motion_action": "她把旧契折回，压进账本最后一页", "motion_reason": "",
         "camera_en": "A slow pull out as the ledger closes."},
    ]

    characters = [
        {"id": "aling", "name": "阿铃", "role": "主角", "age": "17-18",
         "appearance": "齐耳黑茶色短发；上身洗旧的靛蓝牛仔工装外套敞开，里面白棉 T 恤。",
         "behavior": "记账时左手小指压住纸角；被叫典号时手不停、头不抬。",
         "voice": "短句，少用主语，答话常只有一个字；从不辩解",
         "states": ["work"], "props": ["prop_bell"],
         "reference_assets": ["hero_face"],
         "voice_desc": "a young woman's voice, low and slightly husky, with clear diction",
         "delivery_default": "quiet and unhurried"},
        {"id": "shopkeeper", "name": "掌柜", "role": "配角", "age": "50+",
         "appearance": "瘦高，深色长衫；手背青筋明显，指甲修得极短。",
         "behavior": "说话时手上的笔不停。",
         "voice": "低、慢、每个字都落实",
         "states": ["work"], "props": [],
         "reference_assets": [],
         "voice_desc": "a slow, low male voice with a dry edge",
         "delivery_default": "unhurried, each word placed"},
    ]

    # ── 提示词产物（六段式）────────────────────────────────────────────
    prompts = {}
    for shot in shots:
        subject_lines = []
        retention = []
        for index, ref in enumerate(shot["references"], start=1):
            subject_lines.append(f"<Picture {index}> {ref}, exactly as shown.")
            subject_lines.append(f"<Subject {index}> {ref} from <Picture {index}> — strictly the same subject.")
            retention.append(f"<Picture {index}> fully_preserved")
        for index in range(1, len(shot["references"]) + 1):
            retention.append(f"<Subject {index}> fully_preserved")
        body = [f"[Shot 1] Hand-drawn 2D animated feature, cel-shaded flat colour areas with hard-edged shading under a light transparent watercolour wash.",
                f"Lighting: {shot['lighting']}",
                f"<Subject 1> is the subject of this shot."]
        for beat in scenes[[s["id"] for s in scenes].index(shot["scene"])]["beats"]:
            if shot["covers"] and (scenes[[s["id"] for s in scenes].index(shot["scene"])]["beats"].index(beat) + 1) in shot["covers"]:
                body.append("")
                body.append(beat.get("action_en") or "")
        body.append("")
        body.append(f"Camera: {shot['camera_en']}")
        prompts[shot["id"]] = "\n".join([
            "subject_definitions:", *subject_lines, "",
            "summary:", "[reference generation] one continuous take; every <Subject> stays identical to its reference picture.", "",
            "retention_analysis:", *retention, "",
            "detailed_description:", *body, "",
            "overall_soundscape:", "Close: the dry squeak of the wooden drawer runner and the fine scraping of brittle paper. Far: a bicycle bell on the street and mahjong tiles clacking in the distance.",
            "non_diegetic_music:", "No non-diegetic music plays in this shot; only the diegetic sounds described above are heard.", "",
        ])
        (work / "prompts" / "slim" / f"{shot['id']}.prompt.txt").write_text(prompts[shot["id"]], encoding="utf-8")

    # ── 台账 / 状态 / 资产索引 ─────────────────────────────────────────
    ledger_entries = [
        {"task_id": "462265930059984", "shot_id": "SC01-SH01", "model": "MiniMax-H3", "resolution": "768P",
         "duration": 4, "ratio": "16:9", "references": ["hero_face", "shop_interior"], "prompt_sha256": "demo1",
         "status": "succeeded", "submitted_at": "2026-11-15T10:12:03Z", "last_query_at": "2026-11-15T10:14:22Z",
         "node_id": "462265710633214", "output_path": "videos/SC01-SH01_v01.mp4", "cost_usd": 0.32},
        {"task_id": "462265930059985", "shot_id": "SC02-SH01", "model": "MiniMax-H3", "resolution": "768P",
         "duration": 6, "ratio": "16:9", "references": ["shop_interior"], "prompt_sha256": "demo2",
         "status": "succeeded", "submitted_at": "2026-11-15T10:20:41Z", "last_query_at": "2026-11-15T10:23:02Z",
         "node_id": "462265710633215", "output_path": None, "cost_usd": 0.48},
        {"task_id": "462265930059986", "shot_id": "SC02-SH02", "model": "MiniMax-H3", "resolution": "768P",
         "duration": 8, "ratio": "16:9", "references": ["hero_face"], "prompt_sha256": "demo3",
         "status": "succeeded", "submitted_at": "2026-11-15T10:31:10Z", "last_query_at": "2026-11-15T10:33:44Z",
         "node_id": "462265710633216", "output_path": None, "cost_usd": 0.64},
    ]
    assets = list(refs)
    assets.append({
        "id": "SC01-SH01_v01", "type": "video", "path": "videos/SC01-SH01_v01.mp4",
        "status": "active", "shot_id": "SC01-SH01", "bytes": video_path.stat().st_size,
        "duration_sec": 4.0, "has_audio": True, "codec": "h264",
        "created_at": "2026-11-15T10:14:22Z", "created_by": "demo", "source": "MiniMax-H3",
        "cost_usd": 0.32, "notes": "成片",
    })

    (work / "scenes.json").write_text(json.dumps({"version": "1.0", "scenes": scenes}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (work / "shots.json").write_text(json.dumps({"version": "1.0", "shots": shots, "revision": "demo"}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (work / "characters.json").write_text(json.dumps({"version": "1.0", "characters": characters, "props": []}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (work / "assets.json").write_text(json.dumps({"version": "1.0", "assets": assets}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (work / "ledger.json").write_text(json.dumps({
        "version": "1.0", "entries": ledger_entries,
        "totals": {"cost_usd": 1.44, "tasks": 3, "succeeded": 3, "failed": 0, "pending": 0},
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (work / "state.json").write_text(json.dumps({
        "version": "1.0", "work_id": work_id, "stage": "generate",
        "updated_at": "2026-11-15T10:40:00Z",
        "shots_total": len(shots), "shots_done": 3, "shots_failed": 0, "current_shot": None,
        "budget": {"limit_usd": 30.0, "spent_usd": 1.44, "billing_mode": "M Plan weekly window",
                   "model": "MiniMax-H3", "resolution": "768P", "cost_per_shot_usd": 0.48},
        "notes": "演示作品",
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (work / "work.json").write_text(json.dumps({
        "version": "1.0", "work_id": work_id, "title": "演示 · 当铺的旧契",
        "created_at": "2026-11-15T10:00:00Z", "created_by": "demo", "notes": "",
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (work / "creative" / "brief.md").write_text(
        "# 演示 · 当铺的旧契\n\n一个当铺学徒在柜台后擦账本。掌柜叫了一声她的典号。\n",
        encoding="utf-8")


# ══════════════════════════════════════════════════════════════════════════
#  大规模演示（--scale large）：12 场 × 6 镜 = 72 镜
# ══════════════════════════════════════════════════════════════════════════

LARGE_WORK_ID = "demo-epic"
LARGE_WORK_TITLE = "演示 · 潮信"

# 参考图清单：(资产 id, 宽, 高, 类别, 角色 id, 状态, 英文标签)
# 类别 character = 角色锚；prop = 道具锚；scene = 场景锚
# 尺寸：角色 768×1024 / 场景 1024×576 / 道具 1024×1024，
#       **恰好一张 2048×2048**（loc_harbor_wide）——用来压 ≤1200px 的显示约束。
LARGE_IMAGES = [
    ("char_shen_zhao_face", 768, 1024, "character", "shen_zhao", "day",
     "the radio operator"),
    ("char_shen_zhao_full", 768, 1024, "character", "shen_zhao", "night",
     "the radio operator, full body"),
    ("char_shen_du_face", 768, 1024, "character", "shen_du", "wet",
     "the man in a yellow slicker"),
    ("char_gu_chi_face", 768, 1024, "character", "gu_chi", "work",
     "the welder in a canvas jacket"),
    ("char_han_bing_face", 768, 1024, "character", "han_bing", "day",
     "the man in a dark suit"),
    ("char_li_su_face", 768, 1024, "character", "li_su", "night",
     "the nurse in a white coat"),
    ("char_xiaoman_face", 768, 1024, "character", "xiaoman", "day",
     "the schoolgirl"),
    ("prop_receiver_ref", 1024, 1024, "prop", None, None,
     "the shortwave receiver"),
    ("prop_logbook_ref", 1024, 1024, "prop", None, None,
     "the duty logbook"),
    ("prop_flashlight_ref", 1024, 1024, "prop", None, None,
     "the tin flashlight"),
    ("prop_thermos_ref", 1024, 1024, "prop", None, None,
     "the steel thermos"),
    ("loc_signal_station_day", 1024, 576, "scene", None, None,
     "the signal station in daylight"),
    ("loc_signal_station_night", 1024, 576, "scene", None, None,
     "the signal station at night"),
    ("loc_pier_dawn", 1024, 576, "scene", None, None,
     "the breakwater at dawn"),
    ("loc_town_street", 1024, 576, "scene", None, None,
     "the wet town street"),
    ("loc_harbor_wide", 2048, 2048, "scene", None, None,
     "the harbour from the cliff"),
]

# 角色卡（gender / prompt_label 只在本脚本内部用，不进 characters.json）
LARGE_CHARACTERS = [
    {
        "id": "shen_zhao", "name": "沈昭", "role": "主角", "age": "32-35",
        "appearance": "齐肩黑发被海风压得贴住右颊；瘦长脸、颧骨平、鼻梁直；身形偏瘦，肩窄；右手腕戴一只旧机械表，表带磨得发白。",
        "behavior": "值班时左手压住记录纸的边角，右手每十分钟拨一次旋钮。",
        "voice": "短句多，提问常多过回答；真被问住时会重复对方最后两个字",
        "states": ["day", "night", "wet"],
        "props": ["prop_receiver", "prop_logbook"],
        "reference_assets": ["char_shen_zhao_face", "char_shen_zhao_full"],
        "voice_desc": "a low, slightly husky woman's voice, steady, with a dry coastal edge",
        "delivery_default": "flat and economical, answers clipped to short phrases",
        "gender": "female",
    },
    {
        "id": "shen_du", "name": "沈渡", "role": "配角", "age": "38-42",
        "appearance": "浓眉、方下颌；短寸头被雨水压塌；肩宽背厚；左眉尾一道旧疤；穿一件洗到发白的黄色雨衣。",
        "behavior": "说话前先用手背蹭一下鼻尖，像在把话捋顺。",
        "voice": "话慢，句尾常吞掉半句；叫妹妹名字时会拖长",
        "states": ["wet", "day"],
        "props": ["prop_flashlight"],
        "reference_assets": ["char_shen_du_face"],
        "voice_desc": "a low, hoarse man's voice with a weathered edge",
        "delivery_default": "slow, trailing off at the end of sentences",
        "gender": "male",
    },
    {
        "id": "gu_chi", "name": "顾迟", "role": "配角", "age": "40-45",
        "appearance": "宽肩方脸，络腮胡刮得干净；额头有一道旧烫伤；穿洗旧的墨绿帆布工装外套；左手小指缺了一截。",
        "behavior": "说话时用拇指反复搓左手缺掉的那截指根。",
        "voice": "嗓门大，句子长，爱把话说到一半自己接上",
        "states": ["work", "night"],
        "props": ["prop_flashlight"],
        "reference_assets": ["char_gu_chi_face"],
        "voice_desc": "a broad, gravelly man's voice that carries easily outdoors",
        "delivery_default": "loud and expansive, quick to interrupt himself",
        "gender": "male",
    },
    {
        "id": "han_bing", "name": "韩秉", "role": "反派", "age": "43-48",
        "appearance": "梳得整齐的短发，戴一副细框眼镜；深灰西装剪裁合身；左手常握一只哑光不锈钢保温杯。",
        "behavior": "每说一句话前，先把保温杯盖拧开再拧上。",
        "voice": "公事公办的客气，句子短，不容追问",
        "states": ["day"],
        "props": ["prop_thermos"],
        "reference_assets": ["char_han_bing_face"],
        "voice_desc": "a smooth, measured male voice with no warmth in it",
        "delivery_default": "businesslike, clipped, courteous without warmth",
        "gender": "male",
    },
    {
        "id": "li_su", "name": "黎素", "role": "配角", "age": "54-58",
        "appearance": "齐耳短发别在耳后；圆脸，眼角有细纹；白大褂洗得发硬；胸前口袋插一支旧钢笔。",
        "behavior": "递东西时先把物件在掌心里转半圈，再推过去。",
        "voice": "慢，温和，句子短，从不追问",
        "states": ["day", "night"],
        "props": ["prop_logbook"],
        "reference_assets": ["char_li_su_face"],
        "voice_desc": "a calm, low woman's voice, warm and unhurried",
        "delivery_default": "gentle and slow, each word set down carefully",
        "gender": "female",
    },
    {
        "id": "xiaoman", "name": "小满", "role": "配角", "age": "16-18",
        "appearance": "齐刘海，眉心一颗小痣；校服外套袖子挽到手肘；脖子上挂着一副旧耳机。",
        "behavior": "听录音时用手指在桌沿打拍子。",
        "voice": "语速快，爱用短促的感叹，尾音上扬",
        "states": ["day"],
        "props": [],
        "reference_assets": ["char_xiaoman_face"],
        "voice_desc": "a bright, young girl's voice that moves quickly",
        "delivery_default": "quick and eager, endings lifting",
        "gender": "female",
    },
]

LARGE_PROPS = [
    {"id": "prop_receiver", "name": "短波接收机",
     "appearance": "军绿色铁皮机箱，刻度盘蒙一层灰，右侧旋钮磨得发亮，缝隙里结着盐霜。",
     "owner": "shen_zhao", "reference_assets": ["prop_receiver_ref"]},
    {"id": "prop_logbook", "name": "值班记录簿",
     "appearance": "牛皮纸封面的厚册子，硬壳边角磨白；内页是浅蓝格线，纸角沾着机油与盐渍。",
     "owner": "shen_zhao", "reference_assets": ["prop_logbook_ref"]},
    {"id": "prop_flashlight", "name": "铁皮手电",
     "appearance": "银灰铁壳，尾盖缠着一圈黑胶布，镜面有一道细裂，开关按下去会咔一声。",
     "owner": "gu_chi", "reference_assets": ["prop_flashlight_ref"]},
    {"id": "prop_thermos", "name": "不锈钢保温杯",
     "appearance": "哑光银杯身，杯盖边缘一圈茶渍，杯底磕出一个凹点，拧盖时有一圈滑丝。",
     "owner": "han_bing", "reference_assets": ["prop_thermos_ref"]},
]


def B(action, action_en, speaker=None, text=None, mode=None, delivery=None, delivery_en=None):
    """一个 beat。台词拍必须带 delivery（语气阶梯），且全片语气互不重复。"""
    beat = {"action": action, "action_en": action_en, "speaker": speaker, "text": text, "mode": mode}
    if mode in ("dialogue", "voiceover"):
        beat["delivery"] = delivery
        beat["delivery_en"] = delivery_en
    return beat


# 12 场：每场 4–6 个 beat、6 个镜头（机位 / 光参数 / 标题逐镜不同）
LARGE_SCENES = [
    {
        "id": "SC01", "act": 1, "function": "建置", "title": "台风前的信号站",
        "summary": "台风逼近，沈昭独自在海岸信号站值班，无线里浮出一段不属于今天的呼号。",
        "turn": "呼号里那个声音，像是她十七年前就听过的人。",
        "characters": ["shen_zhao"], "loc": "loc_signal_station_night",
        "cameras": ["Static Shot", "Push In", "Tracking Shot", "Arc Shot", "Pull Out", "Tilt Down"],
        "lights": ["night_interior", "night_face", "night_interior", "night_memory", "night_interior", "night_fire"],
        "titles": ["风把记录纸掀翻", "纸角压在桌沿", "旋钮拧到最左格", "耳朵贴上喇叭", "半句问话", "频率一格格往上推"],
        "beats": [
            B("沈昭推开铁门，风把桌上的记录纸掀到地上，她跨一步把纸压回桌面",
              "Shen Zhao pushes the steel door open; the wind lifts the log sheet off the desk."),
            B("她把频率旋钮拧到刻度盘最左端，指腹在旋钮的刻痕上反复擦过",
              "She turns the tuning knob to the far left of the dial and rubs the worn notch."),
            B("接收机里沙沙作响，她抬手把耳朵贴到喇叭罩上",
              "Static hisses; she raises a hand and presses her ear to the speaker cone."),
            B("她的右手在旋钮上停住，指节压得发白，对着喇叭低声开口",
              "Her hand stops on the knob, knuckles pale, and she speaks to the speaker.",
              "shen_zhao", "……有人？", "dialogue",
              "第一声，几乎是问自己，气口断在半途",
              "almost a question to herself, the breath cut in half"),
            B("她摘下耳机放在桌上，重新拧动旋钮，把频率一格一格往上推",
              "She sets the headphones down and pushes the frequency up notch by notch."),
        ],
    },
    {
        "id": "SC02", "act": 1, "function": "建置", "title": "频率里的旧声音",
        "summary": "沈昭把频率推到十七年前的呼号上，一个陌生又熟悉的男声从喇叭里说了一句话。",
        "turn": "呼号属于「鲎浦三号」——一座十七年前就停用的信号塔。",
        "characters": ["shen_zhao", "shen_du"], "loc": "loc_signal_station_night",
        "cameras": ["Push In", "Static Shot", "Zoom In", "Pan Right", "Truck Left", "Pull Out"],
        "lights": ["night_interior", "night_face", "night_memory", "night_interior", "night_face", "night_interior"],
        "titles": ["指针滑到最后一格", "音量退半圈", "男声突然清晰", "写下呼号", "合上记录簿", "窗外的雨线"],
        "beats": [
            B("刻度盘上的指针滑到最后一格，沈昭把音量旋钮往回拧了半圈",
              "The needle slides to the last mark; she turns the volume back half a notch."),
            B("喇叭里的男声忽然清晰起来，沈昭的手猛地按住旋钮",
              "The male voice in the speaker sharpens; her hand clamps down on the knob."),
            B("男声念出一串数字，她抓起铅笔在记录纸上写下同样的数字",
              "The man recites digits; she grabs a pencil and writes the same numbers.",
              "shen_du", "鲎浦三号，收到请回答。", "voiceover",
              "第三声，隔着一层水，字与字之间都含着回声",
              "a third, muffled as if under water, every word trailing an echo"),
            B("她合上记录簿，把铅笔别回耳后，抬头看向窗外的雨线",
              "She closes the log book, tucks the pencil behind her ear and looks up at the rain."),
        ],
    },
    {
        "id": "SC03", "act": 1, "function": "升级", "title": "顾迟上门",
        "summary": "船厂焊工顾迟带着手电来修天线，听见呼号后承认十七年前那晚他也在塔上。",
        "turn": "顾迟说，那晚之后，沈渡再没回过鲎浦。",
        "characters": ["shen_zhao", "gu_chi"], "loc": "loc_town_street",
        "cameras": ["Static Shot", "Truck Left", "Push In", "Arc Shot", "Pan Left", "Tilt Up"],
        "lights": ["alley_day", "day_interior", "day_face", "alley_day", "day_paper", "day_interior"],
        "titles": ["雨里拧亮手电", "工具箱搁上门槛", "耳机递过去", "搓着缺口听完", "门槛上的旧水痕", "雨中的天线"],
        "beats": [
            B("铁门被拍响，沈昭起身去开，顾迟站在雨里拧亮手电",
              "The steel door bangs; Shen Zhao gets up and Gu Chi twists on a flashlight."),
            B("顾迟把工具箱搁在门槛上，伸手去拧天线的旧接头",
              "Gu Chi sets his toolbox on the threshold and works the old antenna joint loose."),
            B("沈昭把耳机递给他，他抬手接过去扣在耳朵上",
              "Shen Zhao hands him the headphones; he takes them and presses them over his ears."),
            B("顾迟听完那段呼号，手指在左手缺口上来回搓，喉咙动了一下",
              "Gu Chi listens through, rubbing the missing tip of his left finger.",
              "gu_chi", "这呼号……是三号的。", "dialogue",
              "第四声，喉咙先哑了一下，后半句压得很低",
              "a fourth, the throat catches dry before the words, the rest dropped low"),
            B("他把手电压低，照着门槛上一道旧水痕看了很久",
              "He lowers the flashlight and stares at an old water mark on the threshold."),
        ],
    },
    {
        "id": "SC04", "act": 1, "function": "升级", "title": "小满的耳机",
        "summary": "小满用旧耳机和磁带比对频率，在带子里找出第二个应答的人。",
        "turn": "磁带末尾有人喊了沈渡的名字。",
        "characters": ["shen_zhao", "xiaoman"], "loc": "loc_signal_station_day",
        "cameras": ["Push In", "Static Shot", "Pan Right", "Push In", "Tracking Shot", "Pull Out"],
        "lights": ["day_interior", "day_face", "day_paper", "day_interior", "day_face", "day_paper"],
        "titles": ["旧耳机挂在脖子上", "倒带重放", "指尖点后半段", "喊名字的声音", "摘下一只耳机", "磁带转过半圈"],
        "beats": [
            B("小满把一副旧耳机挂在脖子上，手指在桌沿打着拍子听磁带",
              "Xiaoman hooks old headphones at her neck and taps the desk while the tape plays."),
            B("她把磁带倒回去重放，手指按住快进键，眼睛盯着转盘",
              "She rewinds the tape, holds the fast-forward key and watches the reel turn."),
            B("她摘下一只耳机递给沈昭，指尖点了点磁带后半段",
              "She hands one headphone to Shen Zhao and taps the back half of the tape.",
              "xiaoman", "姐，这儿有第二个人。", "dialogue",
              "第五声，少女的清亮，尾音上扬带着发现秘密的兴奋",
              "a fifth, young and bright, the tail lifting with the thrill of a secret"),
            B("磁带转过半圈，一个喊名字的声音从喇叭里炸出来，沈昭伸手把音量拧到底",
              "A voice shouting a name bursts out; she reaches for the volume knob."),
        ],
    },
    {
        "id": "SC05", "act": 2, "function": "揭示", "title": "黎素带来的病历",
        "summary": "护士长黎素带来十七年前的住院记录，说沈渡没有死。",
        "turn": "档案上写着：家属放弃治疗，转往外省。",
        "characters": ["shen_zhao", "li_su"], "loc": "loc_signal_station_day",
        "cameras": ["Static Shot", "Push In", "Tilt Down", "Arc Shot", "Tracking Shot", "Pull Out"],
        "lights": ["day_interior", "day_face", "day_paper", "day_interior", "day_face", "day_paper"],
        "titles": ["信封推过桌面", "翻到签字栏", "钢笔转半圈", "笔尖悬住两秒", "写下一个名字", "医院走廊的灯"],
        "beats": [
            B("黎素把牛皮纸信封推过桌面，在杯口上敲了两下",
              "Li Su slides a kraft envelope across the table and taps it twice."),
            B("沈昭伸手抽出里面的病历，纸页翻到签字栏时指尖停住",
              "Shen Zhao pulls out the record; her fingertip stops at the signature page.",
              "li_su", "他没死。转去外省了。", "dialogue",
              "第六声，平得像念化验单，尾音收得干净",
              "a sixth, flat as if reading a lab result, the ending cut clean"),
            B("黎素把钢笔在指间转了半圈，推到沈昭手边",
              "Li Su turns the pen half a circle and pushes it toward Shen Zhao."),
            B("沈昭握住笔，笔尖在纸面上悬了两秒，落下去写下一个名字",
              "Shen Zhao grips the pen; the tip hovers, then comes down to write a name."),
        ],
    },
    {
        "id": "SC06", "act": 2, "function": "揭示", "title": "韩秉的拆迁协议",
        "summary": "拆迁代表韩秉带着协议上门，要把信号站这个周末拆掉。",
        "turn": "拆迁日期被提前到台风登陆的前一天。",
        "characters": ["shen_zhao", "han_bing"], "loc": "loc_town_street",
        "cameras": ["Static Shot", "Truck Right", "Push In", "Zoom In", "Pan Left", "Pull Out"],
        "lights": ["day_interior", "day_face", "day_paper", "day_interior", "alley_day", "day_face"],
        "titles": ["保温杯开合两次", "指尖敲日期", "把协议推开", "椅子退半寸", "折起协议", "抽屉最底层"],
        "beats": [
            B("韩秉把保温杯放在桌上，拧开杯盖又拧上，动作重复了两次",
              "Han Bing sets his thermos down, twists the cap open and shut, then does it again."),
            B("他把一份协议推到沈昭面前，指尖敲了敲封皮上的日期",
              "He pushes an agreement across and taps the date on its cover.",
              "han_bing", "周末拆。台风前一天，省事。", "dialogue",
              "第七声，公事公办的客气，句子短促，每个词都落在点上",
              "a seventh, businesslike courtesy, each word landing exactly"),
            B("沈昭把协议推开，手掌压在封皮上，抬眼盯住他",
              "Shen Zhao pushes the agreement back, keeps her palm flat and looks up at him."),
            B("韩秉收回手，拧紧杯盖，把椅子往后拖了半寸",
              "Han Bing pulls his hand back, screws the cap tight and drags his chair away."),
            B("铁门被风带得合上，沈昭把那份协议折起来，塞进抽屉最底层",
              "The door swings shut in the wind; she folds the agreement into the drawer."),
        ],
    },
    {
        "id": "SC07", "act": 2, "function": "升级", "title": "雨夜守塔",
        "summary": "台风夜，沈昭和小满守在塔上，雨把天线打成一片噪音。",
        "turn": "噪音里忽然浮出一个实时应答——有人在同一频率上。",
        "characters": ["shen_zhao", "xiaoman"], "loc": "loc_signal_station_night",
        "cameras": ["Tracking Shot", "POV", "Arc Shot", "Shake Slightly", "Static Shot", "Tilt Up"],
        "lights": ["night_fire", "night_interior", "night_face", "night_interior", "night_fire", "night_face"],
        "titles": ["雨水顺塔身淌下", "旋钮慢慢拧", "录音笔贴住喇叭", "有人应答", "接住录音笔", "塔顶的灯"],
        "beats": [
            B("雨水顺着塔身往下淌，小满把耳机扣紧，抬手扶住摇晃的灯罩",
              "Rain runs down the tower; Xiaoman steadies the swinging lamp shade."),
            B("沈昭俯身握住旋钮慢慢拧，刻度盘上的指针一点点滑过红区",
              "Shen Zhao bends over the knob and turns it; the needle crosses the red band."),
            B("小满把录音笔贴在喇叭前，指示灯一闪一闪",
              "Xiaoman holds the recorder against the speaker; its light blinks."),
            B("喇叭里突然有人应答，小满猛地抬头，笔从手里滑落",
              "Someone answers back in the speaker and the recorder slips from her hand.",
              "shen_du", "……听得见吗。", "voiceover",
              "第八声，轻得像试探，字与字之间留着大片空白",
              "an eighth, light as a probe, long blanks between the words"),
            B("沈昭伸手接住掉落的录音笔，把它按在桌面上继续录",
              "Shen Zhao catches the falling recorder and presses it flat on the desk."),
        ],
    },
    {
        "id": "SC08", "act": 2, "function": "转折", "title": "沈渡的声音",
        "summary": "信号里的男人报出只有家里人知道的事，声音却突然中断。",
        "turn": "沈昭确认那是哥哥沈渡，可十七年前的记录显示他已经在那天夜里失踪。",
        "characters": ["shen_zhao", "shen_du"], "loc": "loc_signal_station_night",
        "cameras": ["Push In", "Zoom In", "Static Shot", "Arc Shot", "Pull Out", "Tilt Down"],
        "lights": ["night_interior", "night_face", "night_memory", "night_interior", "night_face", "night_memory"],
        "titles": ["音量拧到底", "攥住耳机", "哥哥的声音", "电流切断", "只剩底噪", "刻度盘归零"],
        "beats": [
            B("沈昭把音量拧到底，喇叭里的话一句比一句清楚",
              "She turns the volume all the way up; the words grow clearer each sentence."),
            B("她攥住耳机，指节抵着耳廓，眼睛一眨不眨地盯着刻度盘",
              "She grips the headphone, knuckles at her ear, and stares at the dial."),
            B("男声念出一句只有家里人才知道的话，尾音带着一声笑",
              "The male voice says a line only the family would know, ending in a laugh.",
              "shen_du", "小昭，爸的表还在你手上吧。", "voiceover",
              "第九声，温柔得近乎纵容，尾音扬起来又落下",
              "a ninth, gentle to the point of indulgence, the ending rising then falling"),
            B("喇叭里的声音被一阵电流切断，沈昭伸手去拧旋钮，刻度盘只剩底噪",
              "A rush of static swallows the voice; she reaches for the knob and finds only noise."),
        ],
    },
    {
        "id": "SC09", "act": 3, "function": "转折", "title": "防波堤上的人",
        "summary": "沈昭循着信号赶到防波堤，看见一个背影站在浪里，提着一只陌生的保温杯。",
        "turn": "那人转过身来——是沈渡，可他手里那只保温杯不是他的东西。",
        "characters": ["shen_zhao", "shen_du"], "loc": "loc_pier_dawn",
        "cameras": ["Tracking Shot", "Tilt Up", "Static Shot", "Push In", "Arc Shot", "Pull Out"],
        "lights": ["alley_day", "day_face", "night_face", "day_face", "alley_day", "night_fire"],
        "titles": ["跑上防波堤", "抓住栏杆", "堤顶转过身", "雨里的一句玩笑", "手握成拳", "浪打上石阶"],
        "beats": [
            B("沈昭踩着湿滑的防波堤往上跑，风把她的外套掀到肩后",
              "Shen Zhao runs up the slick breakwater, the wind tearing her coat back."),
            B("浪花打在堤面上，她伸手抓住栏杆，一节一节往上挪",
              "Spray slaps the concrete; she grabs the rail and climbs it section by section."),
            B("堤顶的人转过身，把保温杯夹在臂弯，杯盖在风里磕出轻响",
              "The figure on top turns around and tucks a thermos under one arm."),
            B("沈昭的手松开栏杆，雨水顺着她下巴滴到衬衫领口",
              "Her hand lets go of the rail; rain drips from her chin onto her collar.",
              "shen_du", "你比小时候高了不少。", "dialogue",
              "第十声，几乎是玩笑，尾音却往下坠",
              "a tenth, almost joking, the ending falling away"),
            B("沈昭站在原地，两只手慢慢握成拳，雨水从指缝里淌下来",
              "She stands there, her hands slowly closing into fists as the rain runs between them."),
        ],
    },
    {
        "id": "SC10", "act": 3, "function": "升级", "title": "兄弟对峙",
        "summary": "沈渡承认当年替人顶下事故责任离开鲎浦，这次回来是为了把信号塔留下。",
        "turn": "沈渡说，十七年里每一晚他都在这个频率上等她接班。",
        "characters": ["shen_zhao", "shen_du", "gu_chi"], "loc": "loc_pier_dawn",
        "cameras": ["Static Shot", "Pan Right", "Push In", "Tracking Shot", "Zoom In", "Pull Out"],
        "lights": ["day_face", "day_interior", "day_face", "alley_day", "night_face", "night_interior"],
        "titles": ["保温杯搁在堤上", "翻上防波堤", "摊开手掌", "顶下事故的人", "拿走号码牌", "兄妹并肩"],
        "beats": [
            B("沈渡把保温杯搁在堤面石上，杯口冒出一线白汽",
              "Shen Du sets the thermos down; a thin line of steam rises from the cap."),
            B("顾迟一手扒着堤沿翻上来，另一只手把手电按在胸口",
              "Gu Chi hauls himself over the edge, pressing the flashlight to his chest."),
            B("沈渡摊开手掌，掌心里是一枚旧的黄铜号码牌",
              "Shen Du opens his palm; an old brass number tag lies in it."),
            B("沈昭走上前两步，把那枚号码牌从他手里拿走，攥进掌心",
              "Shen Zhao steps forward, takes the tag and closes her fingers around it."),
        ],
    },
    {
        "id": "SC11", "act": 3, "function": "揭示", "title": "记录簿的夹层",
        "summary": "小满在记录簿的硬壳夹层里翻出一沓寄不出去的信，落款是父亲的名字。",
        "turn": "十七年来每一条信号都是父亲发的，沈渡只是替他把话送到。",
        "characters": ["shen_zhao", "li_su", "xiaoman"], "loc": "loc_signal_station_day",
        "cameras": ["Push In", "Static Shot", "Tilt Down", "Pan Left", "Push In", "Pull Out"],
        "lights": ["day_interior", "day_face", "day_paper", "day_interior", "day_face", "day_paper"],
        "titles": ["挑开硬壳夹层", "抖开旧信", "灯下看落款", "念出那个名字", "三封信塞进内袋", "窗外的塔"],
        "beats": [
            B("小满用小刀挑开记录簿的硬壳夹层，一沓旧信从里面滑出来",
              "Xiaoman pries open the stiff cover; a stack of old letters slides out."),
            B("黎素伸手接过最上面一封，抖开折了四折的信纸",
              "Li Su takes the topmost letter and unfolds the paper creased into quarters."),
            B("沈昭把信纸凑到灯下，指尖顺着落款一行一行往下移",
              "Shen Zhao holds the letter under the lamp, her fingertip travelling down the signature."),
            B("小满指着其中一行念出声，念到名字时抬头看向沈昭",
              "Xiaoman points at one line, reads it out and looks up at Shen Zhao.",
              "xiaoman", "沈远山……这不是你哥哥的字。", "dialogue",
              "第十二声，念到名字时声音抖了一下，后半句轻下去",
              "a twelfth, the voice shaking on the name and dropping away after it"),
            B("沈昭把三封信叠在一起塞进外套内袋，抬手抹了一把脸",
              "She folds three letters together, pushes them into her coat and wipes her face."),
        ],
    },
    {
        "id": "SC12", "act": 3, "function": "收束", "title": "新频率",
        "summary": "拆迁被叫停，信号站重新挂牌；小满接过频率，成了新的守塔人。",
        "turn": "塔顶的灯重新亮起，频率表上多了一个新的名字。",
        "characters": ["shen_zhao", "xiaoman", "gu_chi", "han_bing"], "loc": "loc_harbor_wide",
        "cameras": ["Static Shot", "Tilt Up", "Tracking Shot", "Pan Right", "Push In", "Pull Out"],
        "lights": ["day_interior", "day_face", "alley_day", "day_interior", "day_face", "day_paper"],
        "titles": ["协议收回公文包", "新号牌挂上横梁", "戴好旧耳机", "号码牌搁在频率表旁", "新任守塔人报到", "塔顶灯亮"],
        "beats": [
            B("韩秉把协议卷起来塞进公文包，扣上搭扣，朝沈昭点了点头",
              "Han Bing rolls the agreement up, pushes it into his briefcase and nods.",
              "han_bing", "塔不拆了。公司认。", "dialogue",
              "第十三声，公事公办，却比第一次松了半口气",
              "a thirteenth, still businesslike but half a breath looser than before"),
            B("顾迟爬上天线塔，把一只新的号牌挂到横梁上",
              "Gu Chi climbs the antenna mast and hangs a new number plate on the crossbeam."),
            B("小满把旧耳机戴好，手指在桌沿打着拍子等信号",
              "Xiaoman fits the old headphones on and taps the desk, waiting for a signal."),
            B("沈昭从口袋里掏出黄铜号码牌，搁在频率表旁边",
              "Shen Zhao takes the brass tag out and sets it beside the frequency chart."),
            B("喇叭里响起一声短促的呼号，小满猛地从椅子上站起来",
              "A short call comes out of the speaker and Xiaoman springs up from her chair.",
              "shen_du", "鲎浦三号，新任守塔人报到。", "voiceover",
              "第十四声，尾音上扬，像在笑",
              "a fourteenth, the ending lifting as if in a smile"),
            B("沈昭抬手把塔顶的灯打开，光柱扫过海面，把整片滩涂照亮",
              "She reaches up and switches the lamp on; its beam sweeps the sea."),
        ],
    },
]

# 运镜 → 英文运镜句（一句一镜；不写“静止”类禁词，R13）
LARGE_CAMERA_EN = {
    "Static Shot": "A steady frame on {target}.",
    "Push In": "A slow push in toward {target}.",
    "Pull Out": "A slow pull out away from {target}.",
    "Zoom In": "A slow zoom in on {target}.",
    "Pan Left": "A slow pan left across {target}.",
    "Pan Right": "A slow pan right across {target}.",
    "Truck Left": "A slow truck left along {target}.",
    "Truck Right": "A slow truck right along {target}.",
    "Tilt Up": "A slow tilt up from {target}.",
    "Tilt Down": "A slow tilt down to {target}.",
    "Arc Shot": "A slow arc around {target}.",
    "Tracking Shot": "A tracking move alongside {target}.",
    "Shake Slightly": "A slight handheld shake on {target}.",
    "POV": "A point-of-view look straight at {target}.",
}

# 每场的运镜落点（英文短语）
LARGE_CAMERA_TARGET = {
    "SC01": "the receiver dial", "SC02": "the tuning dial", "SC03": "the antenna joint",
    "SC04": "the tape reels", "SC05": "the envelope on the desk", "SC06": "the date on the contract",
    "SC07": "the tower ladder", "SC08": "the headphone cord", "SC09": "the figure on the breakwater",
    "SC10": "the brass tag", "SC11": "the folded letters", "SC12": "the tower lamp",
}

# 逐镜批注（部分镜头留空，模拟真实作品里「有的有批注、有的没有」）
LARGE_NOTES = [
    "R14：一镜只做一件事——这一镜给运镜，主体动作只留一个。",
    "开画第一镜，先把空间关系立住：塔在左，桌在右。",
    "光参数用的是预设键，待与 A/B 对照组核对。",
    "台词拍后面必须跟一个反应拍，否则模型会读成念稿。",
    "道具单独绑参考图，避免道具在镜头之间搬家。",
    "口型句按角色性别写死；提示词正文全英文，台词除外。",
]

LARGE_MOTION_REASONS = [
    "细节镜必须给运镜：主体动作太小，撑不起整段。",
    "冷开场靠这一个动作推进，先把注意力钉在道具上。",
    "一镜一动作：主体动作已经够满，运镜只做轻微跟随。",
    "雨声与灯闪提供连续的视觉变化，避免画面定格。",
]

# 逐镜状态（其余为 pending）
LARGE_SHOT_STATUS = {
    "SC01-SH01": "verified",
    "SC02-SH04": "succeeded",
    "SC03-SH01": "succeeded",
    "SC04-SH02": "succeeded",
    "SC07-SH02": "succeeded",
    "SC05-SH03": "failed",
    "SC09-SH01": "failed",
}

# 有真视频的镜头：镜 id → (时长秒, 调色板序号)
LARGE_VIDEO_SHOTS = {
    "SC01-SH01": (4, 0),
    "SC04-SH02": (5, 1),
    "SC09-SH01": (4, 2),
}

# 时长微调（让镜长与真视频时长对齐）
LARGE_DURATION_OVERRIDE = {"SC04-SH02": 5, "SC09-SH01": 4}

# 道具在镜头里的露出（镜 id → 道具 id）
LARGE_SHOT_PROP = {
    "SC01-SH03": "prop_receiver",
    "SC01-SH06": "prop_receiver",
    "SC04-SH06": "prop_logbook",
    "SC05-SH01": "prop_logbook",
    "SC06-SH01": "prop_thermos",
    "SC09-SH03": "prop_thermos",
    "SC10-SH01": "prop_thermos",
    "SC03-SH02": "prop_flashlight",
    "SC07-SH01": "prop_flashlight",
    "SC12-SH04": "prop_receiver",
}

# 每场用到的道具参考图（由道具 id 找）
LARGE_PROP_REF = {
    "prop_receiver": "prop_receiver_ref",
    "prop_logbook": "prop_logbook_ref",
    "prop_flashlight": "prop_flashlight_ref",
    "prop_thermos": "prop_thermos_ref",
}

# 场次 → 备用参考图池（每场最多三张参考图：角色脸 + 场景 + 道具）
LARGE_SHOT_SOUNDS = {
    "SC01": "Close: the knob click and the clock tick.",
    "SC02": "Close: the tuning knob and the pen on paper.",
    "SC03": "Close: rain on the door and a toolbox latch.",
    "SC04": "Close: a tape reel and a headphone jack.",
    "SC05": "Close: paper unfolding and a pen cap.",
    "SC06": "Close: a thermos cap and a chair leg.",
    "SC07": "Close: rain on the railing and a lamp hum.",
    "SC08": "Close: static hiss and a headphone creak.",
    "SC09": "Close: surf on stone and a bottle cap.",
    "SC10": "Close: a thermos on stone and heavy breathing.",
    "SC11": "Close: stiff paper and a knife on a desk.",
    "SC12": "Close: a lamp switch and a gull overhead.",
}

LARGE_MUSIC = {
    "SC01": "A low cello drone, barely audible.",
    "SC02": "No non-diegetic music plays in this shot.",
    "SC03": "A slow piano figure, thin and distant.",
    "SC04": "A light pizzicato line, playful but sparse.",
    "SC05": "A low sustained string pad, almost silent.",
    "SC06": "No non-diegetic music plays in this shot.",
    "SC07": "A rising string drone with a slow pulse.",
    "SC08": "A high sustained tone, thin and cold.",
    "SC09": "A low brass swell, slow and heavy.",
    "SC10": "A sparse piano figure, unhurried.",
    "SC11": "A single held cello note.",
    "SC12": "A warm string theme, slow and open.",
}

# 时间戳基准（固定时刻 → 确定性）
LARGE_EPOCH = datetime.datetime(2026, 11, 16, 8, 0, 0)


def _stamp(minutes: int) -> str:
    return (LARGE_EPOCH + datetime.timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_json(path: pathlib.Path, payload) -> None:
    """顶层 JSON 一律 LF 落盘（Windows 上 text 模式默认会写成 CRLF）。"""
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8", newline="\n")


def _numpy():
    try:
        import numpy
    except ImportError:  # pragma: no cover - 环境缺依赖时的提示
        sys.exit("需要 numpy：pip install numpy")
    return numpy


def _abstract_image(path: pathlib.Path, width: int, height: int, palette, rng) -> None:
    """一张抽象参考图：渐变场 + 几何形 + 柔光晕。同一 seed 必得同一张图。"""
    numpy = _numpy()
    bg, light, accent = palette

    ys = numpy.linspace(0.0, 1.0, height, dtype=numpy.float32)[:, None]
    xs = numpy.linspace(0.0, 1.0, width, dtype=numpy.float32)[None, :]
    field = numpy.zeros((height, width, 3), dtype=numpy.float32)
    for i in range(3):
        field[:, :, i] = bg[i] * (1.0 - ys) + accent[i] * ys

    # 一处方向光
    lx = rng.uniform(0.15, 0.85)
    ly = rng.uniform(0.12, 0.55)
    radius = rng.uniform(0.30, 0.62)
    dist = numpy.sqrt(((xs - lx) * 1.15) ** 2 + ((ys - ly) * 0.95) ** 2)
    glow = numpy.clip(1.0 - dist / radius, 0.0, 1.0) ** 2
    for i in range(3):
        field[:, :, i] += (light[i] - field[:, :, i]) * glow * 0.55

    # 一条斜向色带
    slope = rng.uniform(-0.6, 0.6)
    band = numpy.clip(1.0 - numpy.abs((ys - (xs * slope + rng.uniform(0.1, 0.9)))) / rng.uniform(0.06, 0.18), 0.0, 1.0)
    for i in range(3):
        field[:, :, i] += (light[i] - field[:, :, i]) * band * 0.22

    image = Image.fromarray(numpy.clip(field, 0, 255).astype(numpy.uint8), "RGB").convert("RGBA")
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # 几何形：三到五个，位置 / 大小 / 颜色由 rng 决定
    for _ in range(rng.randint(3, 5)):
        kind = rng.choice(("ellipse", "rect", "triangle", "band"))
        color = rng.choice((light, accent, (240, 240, 236)))
        alpha = rng.randint(70, 165)
        cx = rng.uniform(0.15, 0.85) * width
        cy = rng.uniform(0.15, 0.85) * height
        size = rng.uniform(0.10, 0.34) * min(width, height)
        fill = (color[0], color[1], color[2], alpha)
        if kind == "ellipse":
            draw.ellipse([cx - size, cy - size * 0.8, cx + size, cy + size * 0.8], fill=fill)
        elif kind == "rect":
            draw.rectangle([cx - size, cy - size * 0.5, cx + size, cy + size * 0.5], fill=fill)
        elif kind == "triangle":
            draw.polygon([(cx, cy - size), (cx - size, cy + size * 0.7), (cx + size, cy + size * 0.7)], fill=fill)
        else:
            draw.rectangle([cx - size * 1.6, cy - size * 0.08, cx + size * 1.6, cy + size * 0.08], fill=fill)

    image = Image.alpha_composite(image, overlay)

    # 柔光晕（vignette）
    arr = numpy.asarray(image.convert("RGB"), dtype=numpy.float32)
    cx = (xs - 0.5) * 2.0
    cy = (ys - 0.5) * 2.0
    vig = numpy.clip(1.0 - 0.42 * (cx ** 2 + cy ** 2) ** 0.75, 0.0, 1.0)
    arr *= vig[:, :, None]
    image = Image.fromarray(numpy.clip(arr, 0, 255).astype(numpy.uint8), "RGB")

    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def _video_frame(width: int, height: int, t: float, palette):
    """视频的一帧：横向流动的渐变场 + 一团静态暖光 + 静态硬边（桌沿与立柱）。

    设计要点（都是被运动体检逼出来的）：
    · **动的东西是软渐变**——横向流动的正弦波，帧间差大、方向一致；
    · **硬边全部静止**——桌沿与立柱给边缘密度一个恒定基准，否则缩放代理
      指标会把这段片误判成「拉远」；
    · 动的东西不含任何硬边 → 边缘密度不随时间漂移。
    """
    numpy = _numpy()
    bg, light, accent = palette
    xs = numpy.linspace(0.0, 1.0, width, dtype=numpy.float32)[None, :]
    ys = numpy.linspace(0.0, 1.0, height, dtype=numpy.float32)[:, None]

    # 静态纵向渐变底
    field = numpy.zeros((height, width, 3), dtype=numpy.float32)
    for i in range(3):
        field[:, :, i] = bg[i] * (1.0 - 0.35 * ys) + accent[i] * 0.35 * ys

    # 横向流动的渐变波（唯一的运动源：软、同向、位移真实）
    wave = 0.5 + 0.5 * numpy.sin(2 * math.pi * (xs * 1.5 + t * 1.7))
    for i in range(3):
        field[:, :, i] = field[:, :, i] * (1.0 - 0.55 * wave)

    # 一团静态暖光（软边，不进边缘密度）
    lx, ly = 0.74, 0.26
    radius = 0.55
    dist = numpy.sqrt(((xs - lx) * 1.15) ** 2 + ((ys - ly) * 0.95) ** 2)
    glow = numpy.clip(1.0 - dist / radius, 0.0, 1.0) ** 2
    for i in range(3):
        field[:, :, i] += (light[i] - field[:, :, i]) * glow * 0.6

    # 静态硬边结构：桌沿（横）与两根立柱（竖）——边缘密度恒定
    edge_y = int(height * 0.74)
    field[edge_y:, :, :] *= 0.5
    for fx in (0.18, 0.63):
        x = int(fx * width)
        field[int(height * 0.30):edge_y, x:x + max(2, int(width * 0.012)), :] = light

    return Image.fromarray(numpy.clip(field, 0, 255).astype(numpy.uint8), "RGB")


def _rmtree_quiet(path: pathlib.Path, attempts: int = 5) -> None:
    """删目录。Windows 上文件可能被索引器/杀软短暂锁住，重试几次。"""
    for attempt in range(attempts):
        if not path.exists():
            return
        shutil.rmtree(path, ignore_errors=True)
        if not path.exists():
            return
        time.sleep(0.2 * (attempt + 1))
    shutil.rmtree(path, ignore_errors=True)


def _make_video(path: pathlib.Path, width: int, height: int, seconds: int, fps: int, palette, rng, work: pathlib.Path) -> None:
    """用 ffmpeg 生成一条真 MP4（带真实位移）。帧先落盘再编码，保证确定性。

    帧落在**系统临时目录**里（不落作品目录）——ffmpeg 结束后立刻清掉，
    作品目录里只剩成片。
    """
    frames_dir = pathlib.Path(tempfile.mkdtemp(prefix="dd-frames-"))
    try:
        total = seconds * fps
        for index in range(total):
            t = index / total
            frame = _video_frame(width, height, t, palette)
            # PNG（无损）：JPEG/H.264 的振铃会在硬边周围制造忽多忽少的梯度，
            # 边缘密度代理指标就会把它读成「忽推近忽拉远」
            frame.save(frames_dir / f"f{index:03d}.png", format="PNG", optimize=True)
        path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps),
             "-i", str(frames_dir / "f%03d.png"),
             "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
             "-movflags", "+faststart", "-fflags", "+bitexact", "-flags:v", "+bitexact",
             str(path)],
            check=True,
        )
    finally:
        _rmtree_quiet(frames_dir)


def _covers_for(beat_count: int) -> list[list[int]]:
    """6 个镜头怎么分摊 N 个 beat：每个 beat 至少被一个镜头覆盖，每个镜头至少覆盖一个 beat。"""
    if beat_count >= 6:
        return [[i + 1] for i in range(6)]
    if beat_count == 5:
        return [[1], [1], [2], [3], [4], [5]]
    if beat_count == 4:
        return [[1], [1], [2], [3], [4], [4]]
    return [[1], [1], [2], [3], [3], [3]]


def _join_actions(beats) -> str:
    """与 compile_prompts.py 的派生规则一致：覆盖到的动作行拼成一段**英文**动作描述。

    编译器（2026-11-16 版）优先取 `action_en`；只有中文 `action` 且是纯 ASCII 时才回退，
    否则丢弃——`description_en` 是英文派生字段，中文动作行不该混进去（R17）。
    """
    parts = []
    for beat in beats or []:
        if not isinstance(beat, dict):
            continue
        text = (beat.get("action_en") or "").strip()
        if not text:
            fallback = (beat.get("action") or "").strip()
            text = fallback if fallback.isascii() else ""
        if text:
            parts.append(text)
    if not parts:
        return ""
    out = " ".join(parts)
    return out[0].upper() + out[1:]


def _derive_dialogue(beats) -> list[dict]:
    """与 compile_prompts.py 的派生规则一致。"""
    return [{
        "speaker": b.get("speaker"),
        "text": b.get("text"),
        "mode": b.get("mode"),
        "delivery": b.get("delivery"),
        "delivery_en": b.get("delivery_en"),
    } for b in beats if b.get("mode") in ("dialogue", "voiceover") and b.get("text")]


def _build_prompt(shot, scene, image_meta, char_by_id) -> str:
    """六段式提示词产物。正文全英文，台词（中文）只出现在 <d>[Chinese] …</d> 里。"""
    refs = shot["references"]
    subject_defs = []
    retention = []
    subjects = []          # [(subject 序号, 标签, 是不是角色)]
    picture_no = 0
    for rid in refs:
        meta = image_meta[rid]
        picture_no += 1
        if meta["kind"] == "character":
            subject_defs.append(f"<Picture {picture_no}> {rid}.")
            subjects.append((len(subjects) + 1, meta["label"], True))
            subject_defs.append(f"<Subject {len(subjects)}> {meta['label']} from <Picture {picture_no}>.")
            retention.append(f"<Picture {picture_no}> fully_preserved")
            retention.append(f"<Subject {len(subjects)}> fully_preserved")
        elif meta["kind"] == "prop":
            # 只定义主体的图：在 <Subject N> 定义内部引用 <Picture N>，不单开 Picture 条目
            subjects.append((len(subjects) + 1, meta["label"], False))
            subject_defs.append(f"<Subject {len(subjects)}> {meta['label']} from <Picture {picture_no}>.")
            retention.append(f"<Subject {len(subjects)}> fully_preserved")
        else:
            subject_defs.append(f"<Picture {picture_no}> {rid}.")
            retention.append(f"<Picture {picture_no}> fully_preserved")

    covered = [scene["beats"][c - 1] for c in shot["covers"] if 1 <= c <= len(scene["beats"])]
    action_full = " ".join((b.get("action_en") or "") for b in covered).strip()
    action_short = " ".join((b.get("action_en") or "").split(";")[0] for b in covered).strip()

    def build(action_line: str, with_tone: bool) -> str:
        detail = [
            "[Shot 1] Hand-drawn 2D animation, cel-shaded flat colour.",
            f"Lighting: {shot['lighting']}",
        ]
        if subjects:
            detail.append(f"<Subject {subjects[0][0]}> is the subject of this shot.")
        if action_line:
            detail.append(action_line)
        for beat in covered:
            if beat.get("mode") not in ("dialogue", "voiceover") or not beat.get("text"):
                continue
            speaker = char_by_id.get(beat.get("speaker"), {})
            pronoun = "Her" if speaker.get("gender") == "female" else "His"
            tone = beat.get("delivery_en") or ""
            if beat.get("mode") == "voiceover":
                # 画外音：不写闭唇句，只写画外声部（R3）
                detail.append(
                    f"Off screen, {speaker.get('voice_desc', 'an unseen voice')} (S1) speaks: "
                    f"<d>[Chinese] {beat['text']}</d>")
            else:
                tail = f", {tone}" if (with_tone and tone) else ""
                detail.append(
                    f"<Subject {subjects[0][0]}> (S1) says: <d>[Chinese] {beat['text']}</d> "
                    f"{pronoun} lips move clearly with the words{tail}.")
        detail.append(f"Camera: {shot['camera_en']}")
        return "\n".join([
            "subject_definitions:", *subject_defs, "",
            "summary:", "One take; every <Subject> matches its picture.", "",
            "retention_analysis:", *retention, "",
            "detailed_description:", *detail, "",
            "overall_soundscape:", LARGE_SHOT_SOUNDS[scene["id"]], "",
            "non_diegetic_music:", LARGE_MUSIC[scene["id"]], "",
        ])

    # 词数预算 60–120：先保语气，再保动作细节；裁剪顺序固定 → 结果可复现
    text = build(action_full, True)
    for action_line, with_tone in ((action_full, True), (action_full, False),
                                   (action_short, False)):
        text = build(action_line, with_tone)
        if len(text.split()) <= 120:
            return text
    return text


def build_large(work: pathlib.Path, work_id: str, seed: int) -> dict:
    """生成 12 场 × 6 镜 = 72 镜的大规模演示作品。"""
    for folder in ("refs", "videos", "prompts/slim", "creative", "keyframes", "verify"):
        (work / folder).mkdir(parents=True, exist_ok=True)

    image_meta = {}
    assets = []
    assets_by_id = {}

    def register(asset: dict) -> dict:
        assets.append(asset)
        assets_by_id[asset["id"]] = asset
        return asset

    # ── 参考图：16 张（其中恰好一张 2048×2048）────────────────────────
    for index, (asset_id, width, height, kind, role, state, label) in enumerate(LARGE_IMAGES):
        rng = random.Random(f"{seed}:image:{asset_id}")
        path = work / "refs" / f"{asset_id}.png"
        _abstract_image(path, width, height, PALETTE[index % len(PALETTE)], rng)
        image_meta[asset_id] = {"kind": kind, "label": label, "role": role, "state": state}
        register({
            "id": asset_id,
            "type": "reference_image",
            "path": f"refs/{asset_id}.png",
            "status": "active",
            "role": role,
            "state": state,
            "tags": [kind, label.split(",")[0]],
            "width": width,
            "height": height,
            "bytes": path.stat().st_size,
            "sha256": _sha256_file(path),
            "created_at": _stamp(index * 3),
            "created_by": "demo",
            "source": "demo-generator",
            "notes": f"{label}（{kind} 锚）",
        })

    char_by_id = {c["id"]: c for c in LARGE_CHARACTERS}

    # ── 场次 / 镜头 ──────────────────────────────────────────────────────
    scenes = []
    shots = []
    shot_index = 0
    for scene_index, spec in enumerate(LARGE_SCENES):
        scene = {
            "id": spec["id"],
            "index": scene_index + 1,
            "act": spec["act"],
            "title": spec["title"],
            "function": spec["function"],
            "duration": 0,
            "summary": spec["summary"],
            "turn": spec["turn"],
            "characters": list(spec["characters"]),
            "beats": spec["beats"],
        }
        scenes.append(scene)

        covers = _covers_for(len(spec["beats"]))
        scene_duration = 0
        for local_index in range(6):
            shot_index += 1
            shot_id = f"{spec['id']}-SH{local_index + 1:02d}"
            covered = [spec["beats"][c - 1] for c in covers[local_index]]
            duration = LARGE_DURATION_OVERRIDE.get(
                shot_id, 4 + ((scene_index * 7 + local_index * 3) % 9))
            scene_duration += duration

            visible = []
            for beat in covered:
                if beat.get("mode") == "dialogue" and beat.get("speaker") and beat["speaker"] not in visible:
                    visible.append(beat["speaker"])
            if not visible:
                visible = [spec["characters"][0]]

            references = [f"char_{visible[0]}_face", spec["loc"]]
            prop_id = LARGE_SHOT_PROP.get(shot_id)
            if prop_id:
                references.append(LARGE_PROP_REF[prop_id])

            camera = spec["cameras"][local_index]
            camera_en = LARGE_CAMERA_EN[camera].format(target=LARGE_CAMERA_TARGET[spec["id"]])
            notes = LARGE_NOTES[shot_index % len(LARGE_NOTES)] if shot_index % 3 == 0 else ""
            reason = LARGE_MOTION_REASONS[shot_index % len(LARGE_MOTION_REASONS)] if shot_index % 2 == 0 else ""

            shot = {
                "id": shot_id,
                "scene": spec["id"],
                "index": shot_index,
                "title": spec["titles"][local_index],
                "duration": duration,
                "ratio": "16:9",
                "resolution": "768P",
                "model": "MiniMax-H3",
                "camera": camera,
                "lighting": spec["lights"][local_index],
                "characters": visible,
                "references": references,
                "dialogue": _derive_dialogue(covered),
                "audio": {
                    "voiceover": any(b.get("mode") == "voiceover" for b in covered),
                    "soundscape": LARGE_SHOT_SOUNDS[spec["id"]],
                    "music": LARGE_MUSIC[spec["id"]],
                },
                "covers": covers[local_index],
                "current_version": 1,
                "status": LARGE_SHOT_STATUS.get(shot_id, "pending"),
                "notes": notes,
                "motion_action": "".join((b.get("action") or "") for b in covered),
                "motion_reason": reason,
                "description_en": _join_actions(covered),
                "camera_en": camera_en,
            }
            shots.append(shot)
        scene["duration"] = scene_duration

    # ── 提示词产物：72 份六段式 ─────────────────────────────────────────
    scene_by_id = {s["id"]: s for s in scenes}
    for shot in shots:
        text = _build_prompt(shot, scene_by_id[shot["scene"]], image_meta, char_by_id)
        prompt_path = work / "prompts" / "slim" / f"{shot['id']}.prompt.txt"
        prompt_path.write_text(text, encoding="utf-8", newline="\n")
        register({
            "id": f"{shot['id']}.prompt",
            "type": "prompt",
            "path": f"prompts/slim/{shot['id']}.prompt.txt",
            "status": "active",
            "shot_id": shot["id"],
            "bytes": prompt_path.stat().st_size,
            "sha256": _sha256_file(prompt_path),
            "created_at": _stamp(shot["index"]),
            "created_by": "demo",
            "source": "demo-generator",
            "notes": "六段式提示词产物（占位）",
        })

    # ── 真视频：3 条（SC01-SH01 / SC04-SH02 / SC09-SH01）────────────────
    ledger_entries = []
    video_shot_ids = list(LARGE_VIDEO_SHOTS)
    for order, shot_id in enumerate(video_shot_ids):
        seconds, palette_index = LARGE_VIDEO_SHOTS[shot_id]
        shot = next(s for s in shots if s["id"] == shot_id)
        video_path = work / "videos" / f"{shot_id}_v01.mp4"
        _make_video(video_path, 768, 432, seconds, 12, PALETTE[palette_index],
                    random.Random(f"{seed}:video:{shot_id}"), work)

        # 关键帧：首帧与尾帧
        for label, t in (("first", 0.0), ("last", 0.999)):
            frame = _video_frame(768, 432, t, PALETTE[palette_index])
            key_path = work / "keyframes" / f"{shot_id}_{label}.png"
            frame.save(key_path, format="PNG", optimize=True)
            register({
                "id": f"{shot_id}_{label}",
                "type": "keyframe",
                "path": f"keyframes/{shot_id}_{label}.png",
                "status": "active",
                "shot_id": shot_id,
                "width": 768,
                "height": 432,
                "bytes": key_path.stat().st_size,
                "sha256": _sha256_file(key_path),
                "created_at": _stamp(200 + order * 2 + (0 if label == "first" else 1)),
                "created_by": "demo",
                "source": "demo-generator",
                "notes": "镜头关键帧",
            })

        prompt_asset_id = f"{shot_id}.prompt"
        references = list(shot["references"]) + [prompt_asset_id]
        register({
            "id": f"{shot_id}_v01",
            "type": "video",
            "path": f"videos/{shot_id}_v01.mp4",
            "status": "active",
            "shot_id": shot_id,
            "version": 1,
            "width": 768,
            "height": 432,
            "duration_sec": float(seconds),
            "bytes": video_path.stat().st_size,
            "sha256": _sha256_file(video_path),
            "created_at": _stamp(300 + order * 4),
            "created_by": "demo",
            "source": "MiniMax-H3",
            "task_id": f"46290100000{order + 1}",
            "cost_usd": round(0.08 * seconds, 2),
            "references": references,
            "has_audio": False,
            "codec": "h264",
            "notes": "成片（演示素材）",
        })

        prompt_sha = assets_by_id[prompt_asset_id]["sha256"]
        ledger_entries.append({
            "task_id": f"46290100000{order + 1}",
            "shot_id": shot_id,
            "model": "MiniMax-H3",
            "resolution": "768P",
            "duration": seconds,
            "ratio": "16:9",
            "references": list(shot["references"]),
            "prompt_sha256": prompt_sha,
            "submitted_at": _stamp(299 + order * 4),
            "last_query_at": _stamp(300 + order * 4),
            "status": "succeeded",
            "node_id": f"46290110000{order + 1}",
            "output_path": f"videos/{shot_id}_v01.mp4",
            "cost_usd": round(0.08 * seconds, 2),
            "poller_task_id": None,
            "trajectory": [
                {"status": "submitting", "at": _stamp(298 + order * 4)},
                {"status": "submitted", "at": _stamp(299 + order * 4)},
                {"status": "running", "at": _stamp(299 + order * 4 + 1)},
                {"status": "succeeded", "at": _stamp(300 + order * 4)},
            ],
        })

    # 另外两条台账：有任务记录但产物尚未回收（真实工作里常见）
    for order, shot_id in enumerate(["SC02-SH04", "SC07-SH02"]):
        shot = next(s for s in shots if s["id"] == shot_id)
        prompt_sha = assets_by_id[f"{shot_id}.prompt"]["sha256"]
        cost = round(0.08 * shot["duration"], 2)
        ledger_entries.append({
            "task_id": f"46290200000{order + 1}",
            "shot_id": shot_id,
            "model": "MiniMax-H3",
            "resolution": "768P",
            "duration": shot["duration"],
            "ratio": "16:9",
            "references": list(shot["references"]),
            "prompt_sha256": prompt_sha,
            "submitted_at": _stamp(320 + order * 4),
            "last_query_at": _stamp(322 + order * 4),
            "status": "succeeded",
            "node_id": f"46290210000{order + 1}",
            "output_path": None,
            "cost_usd": cost,
            "poller_task_id": None,
            "trajectory": [
                {"status": "submitting", "at": _stamp(320 + order * 4)},
                {"status": "submitted", "at": _stamp(321 + order * 4)},
                {"status": "running", "at": _stamp(321 + order * 4 + 1)},
                {"status": "succeeded", "at": _stamp(322 + order * 4)},
            ],
        })

    # ── 验收报告：3 份（pass / warn / fail 各一，网格才有三种颜色）──────
    reports = [
        ("SC01-SH01", "pass", [], "冷开场：起幅与运镜都稳，声音在可听阈值之上。"),
        ("SC04-SH02", "warn", ["方向平滑占比偏低，接缝处有一次方向跳变"], "画面可用，声音偏薄，建议重录环境音。"),
        ("SC09-SH01", "fail", ["浪声压过人声，台词听不清", "镜头末尾有人入画，未在设计之内"], "判废重出：先把风声压下去，再谈构图。"),
    ]
    for order, (shot_id, verdict, issues, comment) in enumerate(reports):
        shot = next(s for s in shots if s["id"] == shot_id)
        report = {
            "shot_id": shot_id,
            "version": shot["current_version"],
            "tech": {
                "duration_sec": float(shot["duration"]),
                "width": 768,
                "height": 432,
                "ratio_check": "16:9",
                "has_audio": False,
                "mean_volume": "-52.4dB",
                "max_volume": "-30.1dB",
                "pass": verdict != "fail",
            },
            "semantic": {
                "note": "机器判定仅作参考，不作判废依据",
                "dialogue_match": verdict != "fail",
                "lipsync": "unclear",
                "camera": shot["camera_en"],
                "character_match": True,
            },
            "human": {
                "verdict": verdict,
                "reviewer": "demo",
                "checked_frames": ["keyframe_first", "keyframe_last"],
                "issues": issues,
                "comment": comment,
            },
            "verdict": verdict,
            "verified_at": _stamp(400 + order * 5),
        }
        path = work / "verify" / f"{shot_id}.report.json"
        text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
        path.write_text(text, encoding="utf-8", newline="\n")
        register({
            "id": f"{shot_id}.report",
            "type": "report",
            "path": f"verify/{shot_id}.report.json",
            "status": "active",
            "shot_id": shot_id,
            "bytes": path.stat().st_size,
            "sha256": _sha256_file(path),
            "created_at": _stamp(400 + order * 5),
            "created_by": "demo",
            "source": "demo-generator",
            "notes": f"验收报告：{verdict}",
        })

    # ── 创意简报 ─────────────────────────────────────────────────────────
    brief = LARGE_BRIEF
    brief_path = work / "creative" / "brief.md"
    brief_path.write_text(brief, encoding="utf-8", newline="\n")
    register({
        "id": "brief",
        "type": "doc",
        "path": "creative/brief.md",
        "status": "active",
        "bytes": brief_path.stat().st_size,
        "sha256": _sha256_file(brief_path),
        "created_at": _stamp(0),
        "created_by": "demo",
        "source": "demo-generator",
        "notes": "创意简报（conceive 阶段产物）",
    })

    # ── 顶层 JSON ───────────────────────────────────────────────────────
    total_cost = round(sum(entry["cost_usd"] for entry in ledger_entries), 2)
    _write_json(work / "work.json", {
        "version": "1.0",
        "work_id": work_id,
        "title": LARGE_WORK_TITLE,
        "created_at": _stamp(0),
        "created_by": "demo",
        "notes": "大规模演示作品：12 场 × 6 镜 = 72 镜",
    })

    _write_json(work / "scenes.json", {
        "version": "1.0", "scenes": scenes,
    })

    _write_json(work / "shots.json", {
        "version": "1.0", "shots": shots, "revision": "demo-large",
    })

    _write_json(work / "characters.json", {
        "version": "1.0",
        "characters": [{k: v for k, v in c.items() if k != "gender"} for c in LARGE_CHARACTERS],
        "props": LARGE_PROPS,
    })

    _write_json(work / "assets.json", {
        "version": "1.0", "assets": assets,
    })

    _write_json(work / "ledger.json", {
        "version": "1.0",
        "entries": ledger_entries,
        "totals": {
            "cost_usd": total_cost,
            "tasks": len(ledger_entries),
            "succeeded": len(ledger_entries),
            "failed": 0,
            "pending": 0,
        },
    })

    done = sum(1 for s in shots if s["status"] in ("succeeded", "verified"))
    failed = sum(1 for s in shots if s["status"] == "failed")
    _write_json(work / "state.json", {
        "version": "1.0",
        "work_id": work_id,
        "stage": "generate",
        "updated_at": _stamp(500),
        "shots_total": len(shots),
        "scenes_total": len(scenes),
        "shots_done": done,
        "shots_failed": failed,
        "current_shot": "SC09-SH01",
        "budget": {
            "limit_usd": 30.0,
            "spent_usd": total_cost,
            "billing_mode": "M Plan weekly window",
            "model": "MiniMax-H3",
            "resolution": "768P",
            "cost_per_shot_usd": 0.40,
        },
        "notes": "大规模演示作品：72 镜全量分镜已出，生成阶段进行中。",
    })

    # ── 收尾：作品目录里不留任何临时产物 ──────────────────────────────
    for leftover in work.glob(".frames*"):
        _rmtree_quiet(leftover)

    return {
        "scenes": len(scenes),
        "shots": len(shots),
        "assets": len(assets),
        "videos": len(LARGE_VIDEO_SHOTS),
        "prompts": len(shots),
        "ledger": len(ledger_entries),
    }


LARGE_BRIEF = """# 潮信

## 一句话

台风登陆前夜，小镇「鲎浦」最后一座海岸信号站收到一段十七年前的呼号，呼叫它的人是失踪十七年的哥哥。

## 世界

1998 年建的海岸信号站架在鲎浦北坡的礁石上。塔漆早掉光了，塔顶那盏灯还在，亮不亮要看供电。镇上管它叫「三号」。

## 人物

- **沈昭**（34）：三号最后一任守塔员。父母走后没走，左手压纸，右手调频。
- **沈渡**（40）：沈昭的哥哥，十七年前那晚人间蒸发。档案写「失踪」，户口写「死亡」，她两种都不认。
- **顾迟**（42）：船厂焊工，沈渡的老同事，左手小指缺一截。知道一些事，话到嘴边就拐弯。
- **韩秉**（46）：拆迁项目代表。保温杯、一份随时能改日期的协议。他不凶，他只是有表格。
- **黎素**（56）：镇医院护士长，沈渡的寡姐。说话慢，从不追问——十七年前她追问过。
- **小满**（17）：顾迟的女儿，放假跑来塔上听带子，全片唯一不怕那台机器的人。

## 三幕

**第一幕（SC01–SC04）。** 台风前的信号站，机器里浮出一段不属于今天的呼号。沈昭把频率推到最后一格，听见哥哥的声音。顾迟上门修天线，听完只说一句「是三号的」。小满用旧磁带找到第二个应答的人——带子末尾有人喊沈渡的名字。

**第二幕（SC05–SC08）。** 黎素带来十七年前的病历，说沈渡没死，只是转去了外省，档案上写着家属放弃治疗。韩秉带拆迁协议上门，把拆塔日期定在台风前一天。台风夜，噪音里浮出一个实时应答，那人报出一句只有家里人才知道的话，信号随即被电流切断。

**第三幕（SC09–SC12）。** 沈昭循着信号跑到防波堤，堤顶的人转过身来是哥哥，可他手里那只保温杯不是他的东西。沈渡承认当年替人顶下事故责任才离开。小满在记录簿夹层里翻出一沓寄不出去的信，落款是父亲沈远山。最后拆迁被叫停，小满接过频率成了新的守塔人，塔顶的灯重新亮起。

## 视觉与声音

冷蓝的海、暖黄的灯、锈铁和盐霜。全片唯一暖色是塔上那盏旧灯。声音三层：近景机械声，中景塔身共振，远景镇子。

## 要守住的三件事

1. 克制写成**压住的动作**，不写「没有动作」。
2. 台词拍后必有一个反应拍——机器复读比沉默更可怕。
3. 提示词正文全英文，台词除外；汉字进画面就会变成模型随手写的字。
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, help="作品根目录（将写入 <out>/workspaces/<id>/）")
    parser.add_argument("--id", default=None, help="作品 id（默认：small=demo-pawnshop，large=demo-epic）")
    parser.add_argument("--scale", choices=("small", "large"), default="small",
                        help="作品规模：small=最小演示（默认），large=12 场 × 6 镜 = 72 镜")
    parser.add_argument("--seed", type=int, default=20261116, help="随机种子（默认固定，保证可复现）")
    parser.add_argument("--force", action="store_true", help="覆盖已有目录")
    args = parser.parse_args()

    work_id = args.id or ("demo-epic" if args.scale == "large" else "demo-pawnshop")
    root = pathlib.Path(args.out).expanduser().resolve()
    work = root / "workspaces" / work_id
    if work.exists():
        if not args.force:
            print(f"{work} 已存在（加 --force 覆盖）")
            return 1
        shutil.rmtree(work)
    work.mkdir(parents=True, exist_ok=True)

    if args.scale == "large":
        stats = build_large(work, work_id, args.seed)
        print(f"OK  demo work (large): {work}")
        print(f"  {stats['scenes']} scenes / {stats['shots']} shots / {stats['assets']} assets / "
              f"{stats['videos']} videos / {stats['prompts']} prompt artifacts / {stats['ledger']} ledger entries")
        print(f"  seed={args.seed}（同种子必得同一份产物）")
        return 0

    build_small(work, work_id)
    print(f"OK  demo work: {work}")
    print(f"  4 scenes / 7 shots / 5 assets / 1 video")
    return 0


if __name__ == "__main__":
    sys.exit(main())
