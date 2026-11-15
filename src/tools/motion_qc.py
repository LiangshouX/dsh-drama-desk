#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""motion_qc.py — AI 视频运动质量量化验收

为什么需要它
------------
AI 生成视频最常见的失败不是「画得丑」，而是「像会动的 GIF」：
画面大部分时间定格，运动被压缩成极少数离散跳变帧，帧间抽搐。
这种缺陷肉眼容易漏判（尤其在静音快放或逐帧检查时才明显），
但可以用帧间差分与全局光流稳定地量化出来。

本工具用 ffmpeg + numpy（不依赖 cv2/PIL）计算四组指标：

  1. still_ratio   近乎静止帧占比 —— 越高越像 GIF/定格
  2. moving_ratio  有效运动帧占比 —— 越低运动越断续
  3. smoothness    运动方向平滑占比 —— 越低越像抽搐/抖动
  4. cam_motion    全局相机位移帧占比 + 累计位移 —— 运镜是否真的发生

判定线（默认，可在命令行调整）
--------------------------------
  still_ratio > 0.70  → FAIL  「近乎定格，观感为会动的 GIF」
  moving_ratio < 0.40 → FAIL  「运动断续，像逐格动画」
  smoothness  < 0.30  → WARN  「运动方向抽搐」
  cam_motion == 0     → WARN  「全程零相机位移（除非本镜设计就是静物特写）」

用法
----
  python motion_qc.py <video.mp4> [more.mp4 ...]
  python motion_qc.py --json <video.mp4> ...     # 输出 JSON，便于入库
  python motion_qc.py --strict <video.mp4> ...   # 有 FAIL 时退出码非 0（CI 用）

退出码：0 = 全部通过；1 = 存在 FAIL；2 = 存在 WARN（仅 --strict 下算失败）
"""

import json
import subprocess
import sys

import numpy as np

# ---- 判定阈值（经验值，依据见 .drama/references/AI视频运动质量.md） ----
TH_STILL_FAIL = 0.70     # 近乎静止帧占比
TH_MOVING_FAIL = 0.40    # 有效运动帧占比
TH_SMOOTH_FAIL = 0.30    # 运动方向平滑占比
STILL_EPS = 0.5          # 帧间平均差小于此值算「近乎静止」（0-255 灰阶）
MOTION_EPS = 1.0         # 全局位移小于此像素算「相机没动」
TH_TOTAL_MOTION_MIN = 8.0  # 每秒累计帧间差下限（低于此值 = 整段几乎没有运动）


def load_gray(path, w=256, h=256):
    """解码为灰度帧序列 (N,h,w)。"""
    cmd = [
        "ffmpeg", "-v", "error", "-i", path,
        "-vf", f"scale={w}:{h}:flags=bilinear,format=gray",
        "-f", "rawvideo", "-pix_fmt", "gray", "-",
    ]
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg 解码失败: {proc.stderr.decode('utf-8', 'replace')[:300]}")
    buf = proc.stdout
    n = len(buf) // (w * h)
    if n == 0:
        raise RuntimeError("视频没有可解码的帧")
    return np.frombuffer(buf[: n * w * h], dtype=np.uint8).reshape(n, h, w)


def global_shift(a, b):
    """求 a->b 的全局平移 (dy,dx)。用 FFT 互相关 + 相邻帧累积追踪。

    注意：大幅推近/拉远时，整幅画面尺度在变，单帧互相关会失配（返回 0）。
    解决：对多尺度金字塔各求一次互相关，取匹配质量最高的那一层，
    再把该层的位移换算回原分辨率。
    """
    h, w = a.shape
    best = (0, 0, -1.0)
    for scale in (1, 2, 4):
        if scale > 1:
            aa = a[::scale, ::scale]
            bb = b[::scale, ::scale]
            if aa.shape[0] < 16 or aa.shape[1] < 16:
                continue
        else:
            aa, bb = a, b
        A = np.fft.rfft2(aa - aa.mean())
        B = np.fft.rfft2(bb - bb.mean())
        cc = np.fft.irfft2(A * np.conj(B))
        peak = np.unravel_index(np.argmax(cc), cc.shape)
        ah, aw = aa.shape
        dy = peak[0] if peak[0] <= ah // 2 else peak[0] - ah
        dx = peak[1] if peak[1] <= aw // 2 else peak[1] - aw
        ratio = float(cc[peak] / (np.sqrt((cc ** 2).sum()) + 1e-6))
        if ratio > best[2]:
            best = (dy * scale, dx * scale, ratio)
    return best[0], best[1], best[2]


def edge_density(f):
    """水平梯度能量占比——细节越多、物体在画面里越大，梯度越密。

    推近时画面内容变大 → 边缘密度上升。这是比 FFT 互相关更稳的
    「运镜是否发生」判据，因为它不受平移影响（平移不改变物体尺寸）。
    """
    g = np.abs(np.diff(f.astype(np.float32), axis=1))
    return float((g > 12).mean())


def scale_change(a, b):
    """估计 a->b 的整体缩放比（推近时 >1，拉远时 <1）。

    用边缘密度比作为尺度代理：推近时画面内容变大，细节密度上升。
    """
    ea, eb = edge_density(a), edge_density(b)
    if ea < 1e-6:
        return 1.0
    return float(np.sqrt(max(eb / ea, 1e-6)))


def analyze(path, fps=24.0):
    frames = load_gray(path)
    n = len(frames)
    fl = frames.astype(np.float32)

    # --- 帧间差分 ---
    diffs = np.abs(fl[1:] - fl[:-1]).reshape(n - 1, -1).mean(axis=1)
    total_diff = float(diffs.sum())
    duration_sec = n / fps

    # --- 运动方向平滑度：相邻帧的运动方向余弦 ---
    fwd = fl[1:-1] - fl[:-2]
    bwd = fl[2:] - fl[1:-1]
    num = (fwd * bwd).sum(axis=(1, 2))
    den = np.sqrt((fwd ** 2).sum(axis=(1, 2)) * (bwd ** 2).sum(axis=(1, 2))) + 1e-6
    cos_sim = num / den
    smoothness = float((cos_sim > 0.5).mean()) if len(cos_sim) else 0.0

    # --- 静止 / 运动帧占比 ---
    thr = max(STILL_EPS, diffs.mean() * 0.25)
    still_ratio = float((diffs < STILL_EPS).mean())
    moving_ratio = float((diffs > thr).mean())

    # --- 全局相机位移（平移 + 缩放） ---
    dys, dxs, ratios = [], [], []
    for i in range(n - 1):
        dy, dx, r = global_shift(fl[i], fl[i + 1])
        dys.append(dy)
        dxs.append(dx)
        ratios.append(r)
    dys = np.array(dys, float)
    dxs = np.array(dxs, float)
    mag = np.hypot(dxs, dys)

    # 缩放（推近/拉远）：用边缘密度序列
    # 逐帧缩放量小，连续推近时靠首尾整体比对 + 序列单调性判断
    ed = np.array([edge_density(fl[i]) for i in range(n)])
    zoom_total = float(ed[-1] / (ed[0] + 1e-9))
    zoom_trend = float(np.sqrt(max(zoom_total, 1e-6)) - 1.0)
    # 单调性：连续推近时边缘密度大体单调上升
    ed_diff = np.diff(ed)
    zoom_monotonic = float((ed_diff > 0).mean()) if len(ed_diff) else 0.0
    # 跳变检测：边缘密度序列里的最大单步跳变（突兀推近的特征）
    zoom_jump = float(np.abs(ed_diff).max()) if len(ed_diff) else 0.0

    # 有相机运动 = 有平移 或 有缩放变化
    cam_moving = (mag >= MOTION_EPS) | (np.abs(np.sqrt(np.maximum(ed[1:] / (ed[:-1] + 1e-9), 1e-6)) - 1.0) >= 0.005)
    cam_motion_ratio = float(cam_moving.mean())
    cam_dx = float(dxs.sum())
    cam_dy = float(dys.sum())

    # --- 判定 ---
    issues = []
    if still_ratio > TH_STILL_FAIL:
        issues.append(f"近乎静止帧占比 {still_ratio*100:.0f}% > {TH_STILL_FAIL*100:.0f}%：观感为会动的 GIF")
    if moving_ratio < TH_MOVING_FAIL:
        issues.append(f"有效运动帧占比 {moving_ratio*100:.0f}% < {TH_MOVING_FAIL*100:.0f}%：运动断续")
    if smoothness < TH_SMOOTH_FAIL:
        issues.append(f"运动方向平滑占比 {smoothness*100:.0f}% < {TH_SMOOTH_FAIL*100:.0f}%：方向抽搐")
    if cam_motion_ratio == 0 and abs(zoom_trend) < 0.03:
        issues.append("全程零相机位移：本镜可能是静物特写，若设计有运镜则不合格")
    elif zoom_trend > 0.03:
        # 区分「连续推近」与「突兀跳变」：单调性低 + 单步跳变大 = 跳变而非推近
        if zoom_monotonic < 0.6 and zoom_jump > 0.02:
            issues.append(
                f"推近是跳变而非连续（单调性 {zoom_monotonic*100:.0f}%、单步跳变 {zoom_jump:.3f}）："
                f"观感突兀")
        else:
            issues.append(f"检测到连续推近（zoom trend {zoom_trend:+.3f}，单调性 {zoom_monotonic*100:.0f}%）")
    elif zoom_trend < -0.03:
        issues.append(f"检测到拉远（zoom trend {zoom_trend:+.3f}）")

    # 运动量绝对不足：整段视频的累计帧间差太小，说明根本没有发生多少运动。
    # 单独看 still_ratio 会漏判（画面在缓慢小幅变化时每帧差分都不高），
    # 所以再引入「累计运动量 / 时长」这条独立判据。
    per_sec = total_diff / max(duration_sec, 1e-6)
    if per_sec < TH_TOTAL_MOTION_MIN:
        issues.append(
            f"累计运动量 {total_diff:.0f}（{per_sec:.1f}/秒）< {TH_TOTAL_MOTION_MIN:.1f}/秒："
            f"整段几乎没有运动发生")

    verdict = "FAIL" if (
        still_ratio > TH_STILL_FAIL
        or moving_ratio < TH_MOVING_FAIL
        or per_sec < TH_TOTAL_MOTION_MIN
    ) else ("WARN" if issues else "PASS")

    return {
        "video": path,
        "frames": n,
        "fps": fps,
        "duration_sec": round(n / fps, 3),
        "still_ratio": round(still_ratio, 4),
        "moving_ratio": round(moving_ratio, 4),
        "smoothness": round(smoothness, 4),
        "cam_motion_ratio": round(cam_motion_ratio, 4),
        "cam_dx_px": round(cam_dx, 1),
        "cam_dy_px": round(cam_dy, 1),
        "zoom_trend": round(zoom_trend, 4),
        "zoom_monotonic": round(zoom_monotonic, 4),
        "zoom_jump": round(zoom_jump, 4),
        "cam_match_quality": round(float(np.mean(ratios)), 3),
        "mean_frame_diff": round(float(diffs.mean()), 3),
        "max_frame_diff": round(float(diffs.max()), 3),
        "total_motion_per_sec": round(per_sec, 2),
        "verdict": verdict,
        "issues": issues,
    }


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2
    as_json = "--json" in args
    strict = "--strict" in args
    fps = 24.0
    if "--fps" in args:
        i = args.index("--fps")
        fps = float(args[i + 1])
        args = args[:i] + args[i + 2:]
    paths = [a for a in args if not a.startswith("--")]

    results = []
    for p in paths:
        try:
            r = analyze(p, fps=fps)
        except Exception as e:
            r = {"video": p, "verdict": "ERROR", "issues": [str(e)]}
        results.append(r)

    if as_json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        for r in results:
            print(f"\n=== {r['video']} ===")
            if r["verdict"] == "ERROR":
                print(f"  错误: {r['issues'][0]}")
                continue
            print(f"  帧数 {r['frames']} @ {r['fps']}fps = {r['duration_sec']}s")
            print(f"  近乎静止帧占比 : {r['still_ratio']*100:5.1f}%   (FAIL 线 >{TH_STILL_FAIL*100:.0f}%)")
            print(f"  有效运动帧占比 : {r['moving_ratio']*100:5.1f}%   (FAIL 线 <{TH_MOVING_FAIL*100:.0f}%)")
            print(f"  运动方向平滑占比: {r['smoothness']*100:5.1f}%   (WARN 线 <{TH_SMOOTH_FAIL*100:.0f}%)")
            print(f"  相机有位移帧占比: {r['cam_motion_ratio']*100:5.1f}%  累计 dx={r['cam_dx_px']:+.0f} dy={r['cam_dy_px']:+.0f}px")
            print(f"  运镜(缩放)      : trend={r['zoom_trend']:+.3f}  单调性={r['zoom_monotonic']*100:.0f}%  单步跳变={r['zoom_jump']:.3f}")
            print(f"  帧间差 均/峰    : {r['mean_frame_diff']} / {r['max_frame_diff']}")
            print(f"  累计运动量/秒   : {r['total_motion_per_sec']}   (FAIL 线 <{TH_TOTAL_MOTION_MIN})")
            print(f"  判定            : {r['verdict']}")
            for it in r["issues"]:
                print(f"    - {it}")

    if strict:
        if any(r["verdict"] == "FAIL" for r in results):
            return 1
        if any(r["verdict"] == "WARN" for r in results):
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
