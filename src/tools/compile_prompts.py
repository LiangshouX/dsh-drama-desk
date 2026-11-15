"""提示词编译流水线 —— 真源 → 产物。

2026-11-15 决策（Q3）：**shots.json 当唯一真源，`.prompt.txt` 变纯产物。**
本脚本是这条决策的可执行形式：一条命令把真源编译成可提交的提示词。

真源分层
--------
    scenes.json  beats          表演层真源（动作行 / 台词 / 语气）
    shots.json  镜头级字段      分镜层真源（camera_en / duration / lighting / references）
                │
                ├─ description_en  ┐ **派生字段**（由 beats 编译，会被覆盖）
                └─ dialogue        ┘
    prompts/slim/*.prompt.txt      **纯产物**（每次编译重建，可随时丢弃）

派生字段 vs 真源字段的分界很重要：
  · 插件里 **description_en / dialogue 必须是只读展示** —— 改它们会被编译静默覆盖
  · 人要改表演 → 改 scenes.json 的 beats
  · 人要改镜头 → 改 shots.json 的镜头级字段

用法
----
    python compile_prompts.py            # 编译全部（幂等）
    python compile_prompts.py --dry      # 只预览差异，不写盘
    python compile_prompts.py --check    # 只校验：产物是否与真源一致（不一致返回非 0）
    python compile_prompts.py --shot SC03-SH01   # 只编译某镜
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
W = HERE.parent                      # 作品目录
SLIM = HERE / 'slim'

# shots.json 里由 beats 编译出来的字段（派生，人工编辑会被覆盖）
DERIVED_FIELDS = ('description_en', 'dialogue')


def sha(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def join_actions(beats):
    """把若干动作行拼成一段英文动作描述。"""
    parts = [(b.get('action') or '').strip() for b in beats]
    parts = [p for p in parts if p]
    if not parts:
        return ''
    out = ' '.join(parts)
    return out[0].upper() + out[1:]


def compile_shots(scenes, shots):
    """把 beats 编译进 shots.json 的派生字段。返回 (改动的镜 id 列表, 镜头级真源快照)。"""
    changed = []
    for sh in shots['shots']:
        sc = scenes.get(sh['scene'])
        if not sc:
            continue
        beats = sc['beats']
        covers = sh.get('covers') or []
        idx = [c - 1 for c in covers if 1 <= c <= len(beats)]
        if not idx:
            continue
        picked = [beats[i] for i in idx]

        act = join_actions(picked)
        if act and sh.get('description_en') != act:
            sh['description_en'] = act
            changed.append(sh['id'])

        dl = [{
            'speaker': b.get('speaker'),
            'text': b.get('text'),
            'mode': b.get('mode'),
            'delivery': b.get('delivery'),
            'delivery_en': b.get('delivery_en'),
        } for b in picked if b.get('mode') in ('dialogue', 'voiceover') and b.get('text')]
        if dl and sh.get('dialogue') != dl:
            sh['dialogue'] = dl
            if sh['id'] not in changed:
                changed.append(sh['id'])
    return changed


def build_prompts(scenes, shots):
    """用现有的 slim_prompt 生成器产出 45 条提示词（不经过 shell）。"""
    sys.path.insert(0, str(HERE))
    import slim_prompt as sp
    chars = {c['id']: c for c in json.loads((W / 'characters.json').read_text(encoding='utf-8'))['characters']}
    out = {}
    for sh in shots['shots']:
        sc = scenes.get(sh['scene'])
        beats = None
        if sc:
            covers = sh.get('covers') or []
            idx = [c - 1 for c in covers if 1 <= c <= len(sc['beats'])]
            if idx:
                beats = [sc['beats'][i] for i in idx]
        out[sh['id']] = sp.build_prompt(sh, chars, {}, beats)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true', help='只预览差异，不写盘')
    ap.add_argument('--check', action='store_true', help='只校验产物是否与真源一致')
    ap.add_argument('--shot', help='只处理这一镜')
    args = ap.parse_args()

    scenes = {s['id']: s for s in json.loads((W / 'scenes.json').read_text(encoding='utf-8'))['scenes']}
    shots_doc = json.loads((W / 'shots.json').read_text(encoding='utf-8'))
    shots = shots_doc['shots']
    if args.shot:
        shots = [s for s in shots if s['id'] == args.shot]
        shots_doc['shots'] = shots

    # ① 编译派生字段
    changed = compile_shots(scenes, shots_doc)

    # ② 生成提示词产物
    prompts = build_prompts(scenes, shots_doc)

    # ③ 比对
    stale = []
    for sid, text in prompts.items():
        p = SLIM / f'{sid}.prompt.txt'
        cur = p.read_text(encoding='utf-8') if p.exists() else None
        if cur != text:
            stale.append(sid)

    print(f'派生字段重编译：{len(changed)} 镜 {changed if changed else ""}')
    print(f'提示词产物：{len(prompts)} 条，与真源不一致 {len(stale)} 条 {stale if stale else ""}')

    if args.check:
        return 1 if (stale or changed) else 0

    if args.dry:
        print('[dry] 未写盘')
        return 0

    # 写盘：shots.json（派生字段）→ prompts/slim/*.prompt.txt（产物）
    (W / 'shots.json').write_text(
        json.dumps(shots_doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    SLIM.mkdir(parents=True, exist_ok=True)
    for sid, text in prompts.items():
        (SLIM / f'{sid}.prompt.txt').write_text(text, encoding='utf-8')
    print(f'✓ 已写 {len(prompts)} 条提示词产物')
    return 0


if __name__ == '__main__':
    sys.exit(main())
