#!/usr/bin/env python3
"""dsh-drama-desk 的体检驱动器。

**这个文件不实现任何判定。** 它只做一件事：把插件包的体检器
（`beat_qc.py` / `motion_qc.py` / `image_qc.py`）当成库调用，把结果转成 JSON
交给 Host。

这样做的原因（也是纪律）：阈值、词表、判定线**只存在于体检器里**。
插件不复制它们，所以「人看到的」和「agent 看到的」永远是同一套判定。

用法：
    python desk_qc.py beat   --scenes <scenes.json>
    python desk_qc.py motion --video  <video.mp4> [...]
    python desk_qc.py image  --path   <image.jpg> [...]

输出：stdout 上一个 JSON 对象（`{"ok": true, ...}` 或 `{"ok": false, "error": ...}`）。
退出码 0 = 成功；非 0 = 体检器不可用或输入非法（错误信息在 JSON 里）。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))


def _fail(message: str) -> int:
    print(json.dumps({"ok": False, "error": message}, ensure_ascii=False))
    return 2


def _import(name: str):
    """Import one QC module, turning every failure into a plain message."""
    try:
        return __import__(name)
    except SystemExit as exc:  # image_qc 用 sys.exit("缺少依赖：…") 报告缺包
        return ("error", str(exc))
    except ImportError as exc:
        return ("error", f"缺少依赖：{exc}（pip install pillow numpy）")


def cmd_beat(args: argparse.Namespace) -> int:
    module = _import("beat_qc")
    if isinstance(module, tuple):
        return _fail(module[1])
    path = Path(args.scenes)
    if not path.is_file():
        return _fail(f"找不到 {path}")
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001 - 任何读盘失败都变成可读信息
        return _fail(f"读取 {path} 失败：{exc}")
    scenes = doc.get("scenes", []) if isinstance(doc, dict) else []
    rows = module.analyze(scenes, only=args.scene)
    print(json.dumps({"ok": True, "scenes": rows}, ensure_ascii=False))
    return 0


def cmd_motion(args: argparse.Namespace) -> int:
    module = _import("motion_qc")
    if isinstance(module, tuple):
        return _fail(module[1])
    reports = []
    for raw in args.video:
        path = Path(raw)
        try:
            reports.append(module.analyze(str(path), fps=args.fps))
        except Exception as exc:  # noqa: BLE001 - 单条视频失败不应中断整批
            reports.append({"video": str(path), "verdict": "ERROR", "issues": [str(exc)]})
    print(json.dumps({"ok": True, "reports": reports}, ensure_ascii=False))
    return 0


def cmd_image(args: argparse.Namespace) -> int:
    module = _import("image_qc")
    if isinstance(module, tuple):
        return _fail(module[1])
    rows = []
    for raw in args.path:
        path = Path(raw)
        if not path.is_file():
            continue
        try:
            row = module.analyse(path)
        except Exception as exc:  # noqa: BLE001 - 单张读失败不应中断整批
            rows.append({"file": path.name, "path": str(path), "error": str(exc), "verdicts": [f"读取失败：{exc}"]})
            continue
        # 判定行由体检器给出（SAT_MIN / VALUE_MAX / SAT_P10_MIN / COLORFUL_MIN），
        # 插件不重算。
        row["verdicts"] = module.verdicts(row)
        rows.append(row)
    print(json.dumps({"ok": True, "rows": rows}, ensure_ascii=False))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="dsh-drama-desk 体检驱动器")
    sub = parser.add_subparsers(dest="command", required=True)

    beat = sub.add_parser("beat", help="剧本表演层体检（beat_qc）")
    beat.add_argument("--scenes", required=True, help="scenes.json 路径")
    beat.add_argument("--scene", default=None, help="只查一个场次 id")
    beat.set_defaults(func=cmd_beat)

    motion = sub.add_parser("motion", help="画面运动质量体检（motion_qc）")
    motion.add_argument("--video", action="append", default=[], help="视频路径，可重复")
    motion.add_argument("--fps", type=float, default=24.0, help="采样帧率")
    motion.set_defaults(func=cmd_motion)

    image = sub.add_parser("image", help="参考图质量体检（image_qc）")
    image.add_argument("--path", action="append", default=[], help="图片路径，可重复")
    image.set_defaults(func=cmd_image)

    args = parser.parse_args()
    try:
        return int(args.func(args))
    except Exception as exc:  # noqa: BLE001 - 驱动器绝不让栈回溯打到 stdout
        return _fail(f"{type(exc).__name__}: {exc}")


if __name__ == "__main__":
    sys.exit(main())
