#!/usr/bin/env python3
"""生成一个**带真实媒体**的演示作品，让导演工作台有东西可看。

产物落在用户「视频」目录下的 `drama-desk-demo/workspaces/…`，**不在插件仓库里**
（作品数据不属于方法论仓库）。

它模拟一条真实短剧的最小链路：
  · 4 个场次 / 7 个镜头
  · 每个镜头有真源字段（时长 / 运镜 / 光参数 / 参考图绑定）
  · 参考图是**真的图片**（其中一张 2048px，用来验证 ≤1200px 的显示约束）
  · 一条**真的视频**（用来验证播放器与运动层体检）
  · 一份六段式提示词产物
  · 一份台账

用法：
    python scripts/make_demo_work.py [--out <目录>] [--force]
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import shutil
import subprocess
import sys

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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, help="作品根目录（将写入 <out>/workspaces/<id>/）")
    parser.add_argument("--id", default="demo-pawnshop", help="作品 id")
    parser.add_argument("--force", action="store_true", help="覆盖已有目录")
    args = parser.parse_args()

    root = pathlib.Path(args.out).expanduser().resolve()
    work = root / "workspaces" / args.id
    if work.exists():
        if not args.force:
            print(f"{work} 已存在（加 --force 覆盖）")
            return 1
        shutil.rmtree(work)
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
    frames_dir = work / ".frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    total = 48
    for i in range(total):
        frame = draw_frame(640, 360, PALETTE[0], i / total, f"SC01-SH01 f{i:03d}")
        frame.save(frames_dir / f"f{i:03d}.jpg", quality=88)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-framerate", "12", "-i", str(frames_dir / "f%03d.jpg"),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(video_path)],
        check=True,
    )
    shutil.rmtree(frames_dir, ignore_errors=True)

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
        "version": "1.0", "work_id": args.id, "stage": "generate",
        "updated_at": "2026-11-15T10:40:00Z",
        "shots_total": len(shots), "shots_done": 3, "shots_failed": 0, "current_shot": None,
        "budget": {"limit_usd": 30.0, "spent_usd": 1.44, "billing_mode": "M Plan weekly window",
                   "model": "MiniMax-H3", "resolution": "768P", "cost_per_shot_usd": 0.48},
        "notes": "演示作品",
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (work / "work.json").write_text(json.dumps({
        "version": "1.0", "work_id": args.id, "title": "演示 · 当铺的旧契",
        "created_at": "2026-11-15T10:00:00Z", "created_by": "demo", "notes": "",
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (work / "creative" / "brief.md").write_text(
        "# 演示 · 当铺的旧契\n\n一个当铺学徒在柜台后擦账本。掌柜叫了一声她的典号。\n",
        encoding="utf-8")

    print(f"OK  demo work: {work}")
    print(f"  {len(scenes)} scenes / {len(shots)} shots / {len(assets)} assets / 1 video")
    return 0


if __name__ == "__main__":
    sys.exit(main())
