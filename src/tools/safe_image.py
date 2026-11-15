#!/usr/bin/env python3
"""把一张图缩到 ≤1200px 再交给界面显示。

**为什么必须存在这条纪律**：MiniMax 的输入过滤会把「多张人脸 + 大像素量」的
拼贴图判为 `new_sensitive` 并返回 500，一旦这种图进了对话历史，**那个会话会永久
卡死**（每轮重放历史、每轮被拒、重试无用）。本项目已因此报废 3 个会话。

所以：**任何显示出来的图，最长边必须 ≤1200px**。这不是文档备注，是组件级约束——
插件的每个图片显示点都是潜在的事故点。

用法：
    python safe_image.py --in <src> --out <dst> [--max 1200] [--quality 88]

成功时 stdout 打印一行 JSON：
    {"ok": true, "width": 1200, "height": 1200, "bytes": 123456, "scaled": true}

失败时打印 {"ok": false, "error": "..."} 并以非 0 退出。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DEFAULT_MAX = 1200


def main() -> int:
    parser = argparse.ArgumentParser(description="缩图到 ≤1200px（会话安全约束）")
    parser.add_argument("--in", dest="source", required=True, help="源图路径")
    parser.add_argument("--out", dest="target", required=True, help="输出图路径")
    parser.add_argument("--max", type=int, default=DEFAULT_MAX, help="最长边上限（默认 1200）")
    parser.add_argument("--quality", type=int, default=88, help="JPEG 质量")
    args = parser.parse_args()

    source = Path(args.source)
    target = Path(args.target)
    if not source.is_file():
        print(json.dumps({"ok": False, "error": f"找不到 {source}"}, ensure_ascii=False))
        return 2

    try:
        from PIL import Image
    except ImportError:
        print(json.dumps({
            "ok": False,
            "error": "缺少 Pillow：无法安全缩图（pip install pillow）。请用外部工具查看原图。",
        }, ensure_ascii=False))
        return 3

    try:
        with Image.open(source) as image:
            image = image.convert("RGB")
            width, height = image.size
            longest = max(width, height)
            if longest > args.max:
                image.thumbnail((args.max, args.max), Image.LANCZOS)
                scaled = True
            else:
                scaled = False
            target.parent.mkdir(parents=True, exist_ok=True)
            image.save(target, format="JPEG", quality=args.quality, optimize=True)
            out_width, out_height = image.size
    except Exception as exc:  # noqa: BLE001 - 任何失败都变成可读信息
        print(json.dumps({"ok": False, "error": f"缩图失败：{exc}"}, ensure_ascii=False))
        return 4

    print(json.dumps({
        "ok": True,
        "width": out_width,
        "height": out_height,
        "bytes": target.stat().st_size,
        "scaled": scaled,
        "sourceWidth": width,
        "sourceHeight": height,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
