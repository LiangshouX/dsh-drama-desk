#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
image_qc.py —— 用数字审图，不把图塞进模型上下文。

为什么存在
----------
之前的审图流程是「拼一张 contact sheet → read_image 给模型看」。
这条路有两个致命问题：

1. **会把会话卡死**。Multi-figure 大拼图会被 MiniMax 输入过滤判为
   new_sensitive 并返回 500；一旦进了对话历史，每轮重放、每轮被拒、
   重试 5 次后 step 失败，且你之后再发消息还是同一份 payload。
   本项目已因此永久卡死过 3 个会话。

2. **数字比眼睛客观**。「画风偏灰」只能靠感觉，而饱和度 0.24 vs 0.34
   是可复现、可比较、可写进规则的。

本工具输出两样东西：
    * 每张图的量化体检（8 个维度）
    * 组间对照表（同一探针矩阵内横向比）

模型只需要读**文本报告**，不需要看任何图。

指标说明（都经过实测校准，见 calibrate 一节）
------------------------------------------------
sat_mean      平均饱和度 (HSV 的 S 通道均值)。**核心指标**。
              低于 0.28 判废——这是项目宪法的硬门槛。
sat_p10       饱和度第 10 百分位。看「有没有大片死灰区域」。
value_mean    平均明度。接近 220 说明「接近白纸」——v1 的败因。
value_std     明度标准差。太低 = 平光、无层次。
warm_cool     R-B 均值。>0 偏暖，<0 偏冷。
contrast      RMS 对比度。太低 = 平淡。
edge_density  边缘密度（Sobel 近似）。低 = 缺线条/缺细节。
colorfulness  Hasler-Süsstrunk 色彩丰富度。对「灰 vs 鲜艳」比 sat 更稳。
hi_sat_ratio  高饱和像素占比 (S>0.35)。看「有没有漂亮的亮色」。

用法
----
    # 单张
    python image_qc.py --image foo.jpg

    # 一组（自动出组间对照）
    python image_qc.py --dir refs/v2_probe --glob "*.jpg"

    # 只跑一项（快）
    python image_qc.py --dir ... --metric sat

    # 输出 JSON（给别的脚本吃）
    python image_qc.py --dir ... --json
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
except ImportError:  # pragma: no cover
    sys.exit("缺少依赖：pip install pillow numpy")

# ── 判定阈值（2026-11-15 用对照组实测校准）──────────────────────────────
#
# 对照组数据（12 张真实探针 + 3 张已知好图 + 3 张已知坏图）：
#
#   【好图】MiniMax 自由发挥      sat 0.344–0.365  明度 119–170  色丰 0.157–0.218
#   【v2 探针】                  sat 0.224–0.354  明度 133–163  色丰 0.140–0.218
#   【v1 坏图】设定表（已判死）    sat 0.050–0.101  明度 201–224  色丰 0.051–0.079
#
# **有区分度的指标**：饱和度、明度、色彩丰富度、低饱和区占比
# **没有区分度的指标**（好坏重叠，只作参考不作判据）：
#   明度标准差（好 55–59 / 坏 61–86）、RMS 对比度（好 51–60 / 坏 63–86）、
#   边缘密度（好 0.068–0.134 / 坏 0.049–0.065）—— 后两个坏图反而更高，
#   因为设定表有硬阴影边界。**不要用它们判废。**
#
SAT_MIN = 0.28        # 项目宪法硬门槛；实测好图 ≥0.344，v1 坏图 ≤0.101
VALUE_MAX = 195.0     # >195 接近白纸；实测好图 ≤170，v1 坏图 ≥201
SAT_P10_MIN = 0.05    # 低饱和区占比；实测好图 ≥0.089，v1 坏图 ≤0.032
COLORFUL_MIN = 0.12   # Hasler-Süsstrunk；实测好图 ≥0.157，v1 坏图 ≤0.079

# 缩到这么小再算，够用且快，且抹平采样噪声
WORK_SIDE = 512


def load_rgb(path: Path) -> np.ndarray:
    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((WORK_SIDE, WORK_SIDE))
        return np.asarray(im, dtype=np.float64) / 255.0


def rgb_to_hsv_np(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = np.max(rgb, axis=-1)
    mn = np.min(rgb, axis=-1)
    diff = mx - mn
    v = mx
    s = np.where(mx > 1e-6, diff / np.maximum(mx, 1e-6), 0.0)
    return s, v, diff


def edge_density(gray: np.ndarray) -> float:
    """近似 Sobel：梯度幅值超过阈值的像素占比。"""
    gx = np.abs(np.diff(gray, axis=1))[:-1, :]
    gy = np.abs(np.diff(gray, axis=0))[:, :-1]
    mag = np.sqrt(gx ** 2 + gy ** 2)
    return float((mag > 0.12).mean())


def colorfulness(rgb: np.ndarray) -> float:
    """Hasler-Süsstrunk colorfulness，归一化到 0–1 附近。"""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    rg = r - g
    yb = 0.5 * (r + g) - b
    std = math.sqrt(float(rg.std()) ** 2 + float(yb.std()) ** 2)
    mean = math.sqrt(float(rg.mean()) ** 2 + float(yb.mean()) ** 2)
    return std + 0.3 * mean


def analyse(path: Path) -> dict:
    rgb = load_rgb(path)
    s, v, _diff = rgb_to_hsv_np(rgb)
    gray = rgb.mean(axis=-1)

    r_mean = float(rgb[..., 0].mean())
    b_mean = float(rgb[..., 2].mean())

    return {
        "file": path.name,
        "path": str(path),
        "size": list(Image.open(path).size),
        "sat_mean": round(float(s.mean()), 4),
        "sat_p10": round(float(np.percentile(s, 10)), 4),
        "hi_sat_ratio": round(float((s > 0.35).mean()), 4),
        "value_mean": round(float(v.mean()) * 255, 2),
        "value_std": round(float(v.std()) * 255, 2),
        "warm_cool": round((r_mean - b_mean) * 255, 2),
        "contrast": round(float(gray.std()) * 255, 2),
        "edge_density": round(edge_density(gray), 4),
        "colorfulness": round(colorfulness(rgb), 4),
    }


def verdicts(row: dict) -> list[str]:
    """把数值翻译成人能读的结论。

    只用**有区分度**的指标判废（见文件头校准说明）。
    明度σ / 对比度 / 边缘密度不参与判废——实测好坏图在这三项上重叠，
    坏图反而更高（设定表的硬阴影边界）。
    """
    out = []
    if row["sat_mean"] < SAT_MIN:
        out.append(f"饱和不足 {row['sat_mean']:.3f}<{SAT_MIN}（画风偏灰/白纸感）")
    if row["value_mean"] > VALUE_MAX:
        out.append(
            f"整体过亮 {row['value_mean']:.0f}>{VALUE_MAX:.0f}"
            f"（接近白底、没有光；实测好图 ≤170）")
    if row["sat_p10"] < SAT_P10_MIN:
        out.append(
            f"低饱和区过大 p10={row['sat_p10']:.3f}<{SAT_P10_MIN}"
            f"（有大片死灰；实测好图 ≥0.089）")
    if row["colorfulness"] < COLORFUL_MIN:
        out.append(
            f"色彩贫乏 {row['colorfulness']:.3f}<{COLORFUL_MIN}"
            f"（实测好图 ≥0.157）")
    return out


def print_table(rows: list[dict], title: str = "") -> None:
    if title:
        print(f"\n{title}")
    cols = [
        ("file", "文件", 30),
        ("sat_mean", "饱和", 7),
        ("sat_p10", "S10%", 7),
        ("value_mean", "明度", 7),
        ("value_std", "明度σ", 7),
        ("warm_cool", "冷暖", 7),
        ("contrast", "对比", 7),
        ("edge_density", "边缘", 7),
        ("colorfulness", "色丰", 7),
    ]
    header = "".join(f"{label:<{w}}" for _k, label, w in cols)
    print(header)
    print("-" * len(header))
    for r in rows:
        line = f"{r['file'][:29]:<30}"
        for key, _label, w in cols[1:]:
            val = r[key]
            line += f"{val:<{w}}"
        print(line)


def print_verdicts(rows: list[dict]) -> None:
    print("\n" + "=" * 78)
    print("体检结论")
    print("=" * 78)
    ok = [r for r in rows if not verdicts(r)]
    bad = [r for r in rows if verdicts(r)]
    print(f"达标 {len(ok)} / {len(rows)}")
    if bad:
        print(f"\n不达标 {len(bad)} 张：")
        for r in bad:
            print(f"\n  ● {r['file']}")
            for v in verdicts(r):
                print(f"      - {v}")
    if ok:
        print(f"\n达标名单：")
        for r in ok:
            print(f"  ✓ {r['file']}  (饱和 {r['sat_mean']:.3f})")


def group_compare(rows: list[dict]) -> None:
    """按文件名前缀分组，比较组内方差与组间差异。"""
    import re
    groups: dict[str, list[dict]] = {}
    for r in rows:
        m = re.match(r"([A-Za-z0-9]+_[a-z])", r["file"])
        key = m.group(1) if m else r["file"].split("_")[0]
        groups.setdefault(key, []).append(r)

    multi = {k: v for k, v in groups.items() if len(v) >= 2}
    if not multi:
        return

    print("\n" + "=" * 78)
    print("组内一致性（同组 n≥2 的方差）—— 规则 A6：单次采样方差很大")
    print("=" * 78)
    print(f"{'组':<18}{'n':<4}{'饱和均值':<10}{'饱和极差':<10}{'判定'}")
    print("-" * 60)
    for key, items in sorted(multi.items()):
        sats = [i["sat_mean"] for i in items]
        spread = max(sats) - min(sats)
        mean = sum(sats) / len(sats)
        note = ""
        if spread > 0.10:
            note = "★ 组内极差大，单张不可信"
        print(f"{key:<18}{len(items):<4}{mean:<10.4f}{spread:<10.4f}{note}")

    if len(multi) >= 2:
        print("\n" + "=" * 78)
        print("组间差异（只在方差小的组之间比较才有效）")
        print("=" * 78)
        ranked = sorted(multi.items(),
                        key=lambda kv: -sum(i["sat_mean"] for i in kv[1]) / len(kv[1]))
        for key, items in ranked:
            mean = sum(i["sat_mean"] for i in items) / len(items)
            bar = "█" * int(max(0, mean) * 60)
            print(f"  {key:<18}{mean:.4f}  {bar}")


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if stream and hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    ap = argparse.ArgumentParser(description="用数字审图，不读图")
    ap.add_argument("--image", action="append", default=[], help="单张图，可重复")
    ap.add_argument("--dir", help="目录")
    ap.add_argument("--glob", default="*.jpg,*.jpeg,*.png", help="扩展名，逗号分隔")
    ap.add_argument("--json", action="store_true", help="输出 JSON")
    ap.add_argument("--out", help="把 JSON 写到文件")
    ap.add_argument("--quiet", action="store_true", help="只输出结论，不输出大表")
    args = ap.parse_args()

    paths: list[Path] = [Path(p) for p in args.image]
    if args.dir:
        d = Path(args.dir)
        pats = [s.strip() for s in args.glob.split(",") if s.strip()]
        for pat in pats:
            paths.extend(sorted(p for p in d.glob(pat)
                                if not p.stem.endswith("_model")))
    paths = [p for p in paths if p.is_file()]
    if not paths:
        print("没有找到图片", file=sys.stderr)
        return 1

    rows = []
    for p in paths:
        try:
            rows.append(analyse(p))
        except Exception as exc:  # noqa: BLE001
            print(f"跳过 {p.name}: {exc}", file=sys.stderr)

    if args.json:
        payload = json.dumps(rows, ensure_ascii=False, indent=2)
        if args.out:
            Path(args.out).write_text(payload, encoding="utf-8")
            print(f"已写入 {args.out}")
        else:
            print(payload)
        return 0

    if not args.quiet:
        print_table(rows, title=f"量化体检（{len(rows)} 张）")
        print(f"\n判废阈值（校准自对照组）：饱和≥{SAT_MIN}  明度≤{VALUE_MAX:.0f}  "
              f"低饱和区 p10≥{SAT_P10_MIN}  色丰≥{COLORFUL_MIN}")
        print("参考项（不判废）：明度σ / 对比 / 边缘 —— 实测好坏图重叠")
    print_verdicts(rows)
    group_compare(rows)

    if args.out:
        Path(args.out).write_text(json.dumps(rows, ensure_ascii=False, indent=2),
                                  encoding="utf-8")
        print(f"\n明细已写入 {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
