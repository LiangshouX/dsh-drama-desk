#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""beat_qc —— 剧本「表演层」体检器（motion_qc 的剧本对应物）。

motion_qc 量化画面运动；beat_qc 量化**剧本里有没有戏**。
AI 视频只能演出看得见的东西，剧本不写下来的表演，模型拍不出来——
所以「毫无情绪」这类问题必须在剧本层拦截，而不是等出片后才发现。

六项指标：
  1. 反应拍覆盖率：台词拍后面是否紧跟一个「无台词动作拍」（听者/后果的可见变化）
  2. 否定式表演：动作行里出现「不抬眼 / 没有动 / 没动 / 始终不…」——把克制写成了"没有动作"
  3. 台词拍的可拍性：动作行里是否有可被镜头拍到的位移动词
  4. 沉默占比：一场戏里"有台词"之外的时间预算，用来判断沉默有没有内容
  5. delivery 缺失：台词拍有没有写语气（R9：音色逐字复用，语气逐句另写）
  6. delivery 重复：同一角色多句台词的语气是否雷同（= 机器复读）

用法：
  python tools/drama/beat_qc.py --work <work-id>
  python tools/drama/beat_qc.py --work <work-id> --scene SC02
  python tools/drama/beat_qc.py --work <work-id> --json
退出码：发现硬伤（非 0）。
"""
import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]

# 否定式表演：把"克制"写成"没有动作"，模型会照做，输出木头人
ANTI_REACT = [
    "不抬眼", "没抬眼", "未抬眼", "始终不抬", "头不抬", "不抬头",
    "没有动", "没动", "不动", "没有表情", "面无表情", "毫无",
    "笔没停", "笔不停", "没有停", "没说话", "不说话", "没有声音",
]

# 可拍的位移动词（动作行里出现即认为有可见变化）
ACTION_VERBS = [
    "抬头", "低头", "抬眼", "看向", "移开", "转向", "起身", "站起", "坐下", "蹲",
    "伸手", "收回", "放下", "搁", "拿起", "推开", "拉住", "按住", "按", "压住", "压",
    "松开", "翻", "合上", "推", "拽", "挪", "退", "走", "跑", "停", "顿", "抖", "颤",
    "抓", "擦", "倒", "扔", "端", "捧", "落", "砸", "敲", "闭", "睁", "眨", "抿",
    "挣", "缩", "仰", "俯", "弯", "俯身", "探", "碰", "划", "写", "画",
    "摊", "挂", "取下", "脱", "戴", "拨", "挑", "掀", "盖", "撕", "卷", "抵", "托",
    "拍", "掸", "扶", "捻", "抹", "蹬", "踏", "摸", "抚", "塞", "插", "夹", "系",
    "解", "撒", "递", "接", "甩", "挥", "攥", "捏", "揉", "搓", "拧", "拔", "撞",
    "蹭", "贴", "摆", "放", "移", "抬", "俯",
    "指", "抢", "笑", "送", "抽", "端起", "递给", "喊", "答", "张嘴", "合嘴",
]

# 语气方向（导演指令，不是可见动作，但也是有效的内容）
DELIVERY_WORDS = [
    "轻", "重", "慢", "快", "沉", "压着", "尾音", "顿", "哑", "紧", "急", "轻一点",
    "低", "高", "拖", "断", "一字", "慢慢", "一声比一声", "不再", "还是",
]

# 判定线
REACTION_RATE_MIN = 0.50   # 反应拍覆盖率下限（R18②）


def load(work):
    d = ROOT / "workspaces" / work
    scenes = json.loads((d / "scenes.json").read_text(encoding="utf-8"))
    return scenes.get("scenes", [])


def analyze(scenes, only=None):
    rows = []
    for sc in scenes:
        if only and sc["id"] != only:
            continue
        beats = sc["beats"]
        dlg_idx = [i for i, b in enumerate(beats) if b.get("mode") == "dialogue"]
        react = 0
        anti = []
        inert = []
        delivery_only = []
        no_delivery = []
        # delivery 重复：同一角色多句台词的语气是否雷同
        by_speaker = {}
        for i in dlg_idx:
            nxt = beats[i + 1] if i + 1 < len(beats) else None
            if nxt and nxt.get("mode") is None and (nxt.get("action") or "").strip():
                react += 1
            a = (beats[i].get("action") or "")
            hits = [w for w in ANTI_REACT if w in a]
            if hits:
                anti.append({"beat": i + 1, "speaker": beats[i].get("speaker"),
                             "words": hits, "action": a})
            if not any(v in a for v in ACTION_VERBS):
                if any(v in a for v in DELIVERY_WORDS):
                    delivery_only.append({"beat": i + 1, "speaker": beats[i].get("speaker"), "action": a})
                else:
                    inert.append({"beat": i + 1, "speaker": beats[i].get("speaker"), "action": a})
            # 语气：中文 `delivery` 或英文 `delivery_en` 任一存在即算已写
            # （2026-11-15：提示词正文全英文，语气随之有英文版；两者是同一语气的两种语言）
            dl = (beats[i].get("delivery") or "").strip() or (beats[i].get("delivery_en") or "").strip()
            if not dl:
                no_delivery.append({"beat": i + 1, "speaker": beats[i].get("speaker"),
                                    "text": beats[i].get("text")})
            else:
                by_speaker.setdefault(beats[i].get("speaker"), []).append((i + 1, dl))

        dup_delivery = []
        for spk, items in by_speaker.items():
            if len(items) < 2:
                continue
            seen = {}
            for idx, dl in items:
                key = re.sub(r"\s+", "", dl)
                if key in seen:
                    dup_delivery.append({"speaker": spk, "beats": [seen[key], idx], "delivery": dl})
                else:
                    seen[key] = idx

        speech = sum(len(b.get("text") or "") for b in beats)
        dur = sc.get("duration", 0)
        rate = round(react / len(dlg_idx), 3) if dlg_idx else None
        row = {
            "scene": sc["id"], "title": sc.get("title"), "beats": len(beats),
            "dialogue_beats": len(dlg_idx), "reaction_beats": react,
            "reaction_rate": rate,
            "anti_reaction": anti, "inert_action": inert, "delivery_only": delivery_only,
            "no_delivery": no_delivery, "dup_delivery": dup_delivery,
            "duration": dur,
            "speech_sec": round(speech / 4.5, 1),
            "silence_sec": round(dur - speech / 4.5, 1),
            "silence_ratio": round((dur - speech / 4.5) / dur, 3) if dur else None,
        }
        issues = []
        if anti:
            issues.append("否定式表演")
        if inert:
            issues.append("无可拍动作")
        if rate is not None and rate < REACTION_RATE_MIN:
            issues.append("反应拍覆盖率低于 %d%%" % (REACTION_RATE_MIN * 100))
        if no_delivery:
            issues.append("台词缺 delivery")
        if dup_delivery:
            issues.append("delivery 雷同")
        row["issues"] = issues
        row["verdict"] = "FAIL" if issues else "pass"
        rows.append(row)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", required=True)
    ap.add_argument("--scene")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    rows = analyze(load(args.work), args.scene)
    total_dlg = sum(r["dialogue_beats"] for r in rows)
    total_react = sum(r["reaction_beats"] for r in rows)
    total_anti = sum(len(r["anti_reaction"]) for r in rows)
    total_inert = sum(len(r["inert_action"]) for r in rows)
    total_delivery = sum(len(r["delivery_only"]) for r in rows)
    total_nodel = sum(len(r["no_delivery"]) for r in rows)
    total_dup = sum(len(r["dup_delivery"]) for r in rows)
    failed = [r for r in rows if r["verdict"] == "FAIL"]

    if args.json:
        print(json.dumps({"scenes": rows, "totals": {
            "dialogue_beats": total_dlg, "reaction_beats": total_react,
            "reaction_rate": round(total_react / total_dlg, 3) if total_dlg else None,
            "anti_reaction": total_anti, "inert_action": total_inert,
            "delivery_only": total_delivery,
            "no_delivery": total_nodel, "dup_delivery": total_dup,
            "failed_scenes": [r["scene"] for r in failed]}},
            ensure_ascii=False, indent=2))
        return 1 if failed else 0

    print("=== 剧本表演层体检 ===")
    print("%-8s %-14s %5s %5s %8s %9s  %s" % ("场次", "标题", "台词拍", "反应拍", "覆盖率", "沉默占比", "判定"))
    for r in rows:
        print("%-8s %-14s %5d %5d %8s %9s  %s" % (
            r["scene"], (r["title"] or "")[:12], r["dialogue_beats"], r["reaction_beats"],
            ("%.0f%%" % (100 * r["reaction_rate"])) if r["reaction_rate"] is not None else "-",
            ("%.0f%%" % (100 * r["silence_ratio"])) if r["silence_ratio"] is not None else "-",
            r["verdict"] + ("（" + "、".join(r["issues"]) + "）" if r["issues"] else "")))
    print()
    print("全片：台词拍 %d，反应拍 %d（覆盖率 %.0f%%），否定式表演 %d 处，无位移动作 %d 处，"
          "只有语气无动作 %d 处，缺 delivery %d 处，delivery 雷同 %d 处，不合格场次 %d"
          % (total_dlg, total_react,
             100 * total_react / total_dlg if total_dlg else 0, total_anti, total_inert,
             total_delivery, total_nodel, total_dup, len(failed)))
    for r in rows:
        for a in r["anti_reaction"]:
            print("  [否定式表演] %s b%d %s：%s（%s）" % (r["scene"], a["beat"], a["speaker"], a["action"], "、".join(a["words"])))
        for a in r["inert_action"]:
            print("  [无可拍动作] %s b%d %s：%s" % (r["scene"], a["beat"], a["speaker"], a["action"]))
        for a in r["delivery_only"]:
            print("  [只有语气] %s b%d %s：%s" % (r["scene"], a["beat"], a["speaker"], a["action"]))
        for a in r["no_delivery"]:
            print("  [缺 delivery] %s b%d %s：%r" % (r["scene"], a["beat"], a["speaker"], a["text"]))
        for a in r["dup_delivery"]:
            print("  [delivery 雷同] %s b%d / b%d %s：%s" % (r["scene"], a["beats"][0], a["beats"][1], a["speaker"], a["delivery"]))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
