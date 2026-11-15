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
    prompts/overrides/*.prompt.txt **人工覆盖**（人写的，编译不覆盖它）

派生字段 vs 真源字段的分界很重要：
  · 插件里 **description_en / dialogue 必须是只读展示** —— 改它们会被编译静默覆盖
  · 人要改表演 → 改 scenes.json 的 beats
  · 人要改镜头 → 改 shots.json 的镜头级字段

人工覆盖（override）
-------------------
人偶尔会直接改提示词正文（措辞、道具描述、某个镜头多一句话）。
那种改动不能被"重新编译"静默吞掉，所以：

  · `<作品>/prompts/overrides/<shotId>.prompt.txt` 是**人工覆盖**，
    永远压过自动生成的文本；
  · 正常编译把它拷进 `prompts/slim/<shotId>.prompt.txt`，并在 `--json` 里
    用 `overridden` 列出；
  · `--force` 表示「我不要人工覆盖」：自动文本覆盖它，**覆盖文件被删掉**
    （人明确要求丢弃，才敢删）；
  · `--reset-override <shotId>` 删掉某一镜的覆盖文件并重新生成那一镜。

找不到生成器时的降级
--------------------
提示词生成器（`slim_prompt.py`）是**可选的**：作品可以自带一份，
没有就用插件随包分发的默认实现；两处都没有时**不能崩**——
跳过提示词生成，仍然重编译派生字段，并在 `--json` 里报
`prompts: 0` + 一句人能读的 `note`。

提示词生成器的搜索顺序
----------------------
    `<作品>/prompts/` → `<作品>/prompts/slim/` → 编译脚本自身所在目录
（`--toolkit` 显式指定时用它替换最后一项；插件调用时它就是随包目录。）

用法
----
    python compile_prompts.py                    # 编译全部（幂等）
    python compile_prompts.py --dry              # 只预览差异，不写盘
    python compile_prompts.py --check            # 只校验：产物是否与真源一致（不一致返回非 0）
    python compile_prompts.py --shot SC03-SH01   # 只编译某镜
    python compile_prompts.py --force            # 丢弃人工覆盖，用自动文本覆盖
    python compile_prompts.py --reset-override SC03-SH01   # 删掉某一镜的覆盖并重生成

插件调用约定
------------
    python compile_prompts.py --work <作品目录> --toolkit <含 slim_prompt.py 的目录> --json

`--json` 让插件能读懂结果，**stdout 上永远只有一个 JSON 对象**：

    {
      "ok": true,              # 是否成功
      "work": "<作品目录>",
      "toolkit": "<生成器搜索目录>",
      "changed": ["SC01-SH01"],# 派生字段被改写的镜头
      "stale": ["SC01-SH02"],  # 产物与真源不一致的镜头
      "prompts": 12,           # 本次生成的提示词条数
      "overridden": ["SC01-SH01"],  # 用了人工覆盖的镜头
      "note": ""               # 人能读的一句话（降级 / 覆盖 / 失败）
    }
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent

# shots.json 里由 beats 编译出来的字段（派生，人工编辑会被覆盖）
DERIVED_FIELDS = ('description_en', 'dialogue')

# 作品目录下的两个提示词目录
SLIM_DIRNAME = 'slim'
OVERRIDE_DIRNAME = 'overrides'


def sha(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def ascii_ok(text) -> bool:
    """文本是否纯 ASCII（英文派生字段 / 提示词正文不能带中文，R17）。"""
    return isinstance(text, str) and all(ord(ch) < 128 for ch in text)


def join_actions(beats):
    """把若干动作行拼成一段英文动作描述。

    优先用 `action_en`（英文动作行）；只有中文 `action` 且能保证是 ASCII 时才用，
    否则丢弃 —— `description_en` 是英文派生字段，中文动作行不该混进去（R17）。
    """
    parts = []
    for beat in beats or []:
        if not isinstance(beat, dict):
            continue
        text = (beat.get('action_en') or '').strip()
        if not text:
            fallback = (beat.get('action') or '').strip()
            text = fallback if ascii_ok(fallback) else ''
        if text:
            parts.append(text)
    if not parts:
        return ''
    out = ' '.join(parts)
    return out[0].upper() + out[1:]


def compile_shots(scenes, shots):
    """把 beats 编译进 shots.json 的派生字段。返回 (改动的镜 id 列表)。

    `shots` 可以是镜头列表，也可以是整个 shots.json 文档（兼容旧调用）。
    """
    if isinstance(shots, dict):
        shots = shots.get('shots') or []
    changed = []
    for sh in shots:
        sc = scenes.get(sh.get('scene'))
        if not sc:
            continue
        beats = sc.get('beats') or []
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


def toolkit_candidates(work, toolkit=None):
    """`slim_prompt.py` 的搜索顺序。

    `<作品>/prompts/` → `<作品>/prompts/slim/` → 编译脚本自身所在目录。
    `--toolkit` 显式指定时用它替换最后一项（插件调用时它就是随包目录）。
    """
    candidates = []

    def add(path):
        if path is None:
            return
        resolved = pathlib.Path(path)
        if resolved not in candidates:
            candidates.append(resolved)

    add(work / 'prompts')
    add(work / 'prompts' / SLIM_DIRNAME)
    if toolkit is not None:
        add(toolkit)
    else:
        add(HERE)
    return candidates


def load_generator(candidates):
    """按顺序找 `slim_prompt`；第一个能导入的赢。

    @return `(module, 找到的目录, 失败说明列表)`
    """
    errors = []
    for directory in candidates:
        path = pathlib.Path(directory) / 'slim_prompt.py'
        if not path.is_file():
            continue
        name = '_dd_slim_prompt'
        try:
            spec = importlib.util.spec_from_file_location(name, path)
            if spec is None or spec.loader is None:
                errors.append(f'{path}: 不是可导入的 Python 模块')
                continue
            module = importlib.util.module_from_spec(spec)
            sys.modules[name] = module
            spec.loader.exec_module(module)
        except Exception as error:
            sys.modules.pop(name, None)
            errors.append(f'{path}: {error}')
            continue
        if not hasattr(module, 'build_prompt'):
            errors.append(f'{path}: 缺少 build_prompt()')
            sys.modules.pop(name, None)
            continue
        return module, pathlib.Path(directory), errors
    return None, None, errors


def build_prompts(scenes, shots, work, generator):
    """用生成器产出提示词（不经过 shell）。返回 ({镜 id: 提示词}, 失败说明列表)。"""
    chars = {}
    characters_path = work / 'characters.json'
    if characters_path.is_file():
        try:
            document = json.loads(characters_path.read_text(encoding='utf-8'))
            chars = {c['id']: c for c in document.get('characters') or [] if isinstance(c, dict) and c.get('id')}
        except (OSError, ValueError):
            chars = {}

    out = {}
    failures = []
    for sh in shots:
        sc = scenes.get(sh.get('scene'))
        beats = None
        if sc:
            covers = sh.get('covers') or []
            idx = [c - 1 for c in covers if 1 <= c <= len(sc.get('beats') or [])]
            if idx:
                beats = [sc['beats'][i] for i in idx]
        try:
            out[sh['id']] = generator.build_prompt(sh, chars, {}, beats)
        except Exception as error:
            failures.append(f"{sh['id']}: {error}")
    return out, failures


def override_path(work, shot_id) -> pathlib.Path:
    """人工覆盖文件路径：`<作品>/prompts/overrides/<shotId>.prompt.txt`。"""
    return work / 'prompts' / OVERRIDE_DIRNAME / f'{shot_id}.prompt.txt'


def collect_overrides(work, shot_ids):
    """找出这一轮涉及的人工覆盖文件。返回 `{镜 id: 路径}`。"""
    found = {}
    for shot_id in shot_ids:
        path = override_path(work, shot_id)
        if path.is_file():
            found[shot_id] = path
    return found


def main(argv=None):
    ap = argparse.ArgumentParser(description='提示词编译流水线（真源 → 产物）')
    ap.add_argument('--dry', action='store_true', help='只预览差异，不写盘')
    ap.add_argument('--check', action='store_true', help='只校验产物是否与真源一致')
    ap.add_argument('--shot', help='只处理这一镜')
    ap.add_argument('--work', help='作品目录（含 scenes.json / shots.json / characters.json）')
    ap.add_argument('--toolkit', help='含 slim_prompt.py 的目录（默认与本脚本同目录）')
    ap.add_argument('--json', action='store_true', help='输出机器可读结果（单个 JSON 对象）')
    ap.add_argument('--force', action='store_true', help='丢弃人工覆盖，用自动生成的文本覆盖')
    ap.add_argument('--reset-override', metavar='SHOT_ID', help='删除某一镜的人工覆盖并重新生成该镜')
    args = ap.parse_args(argv)

    work = pathlib.Path(args.work).resolve() if args.work else HERE.parent
    toolkit = pathlib.Path(args.toolkit).resolve() if args.toolkit else HERE
    slim = work / 'prompts' / SLIM_DIRNAME

    result = {
        'ok': False,
        'work': str(work),
        'toolkit': str(toolkit),
        'changed': [],
        'stale': [],
        'prompts': 0,
        'overridden': [],
        'note': '',
    }

    try:
        scenes = {s['id']: s for s in json.loads((work / 'scenes.json').read_text(encoding='utf-8'))['scenes']}
        shots_doc = json.loads((work / 'shots.json').read_text(encoding='utf-8'))
    except (OSError, ValueError, KeyError) as error:
        result['note'] = f'读不到作品数据：{error}'
        if args.json:
            print(json.dumps(result, ensure_ascii=False))
        else:
            print(f'✗ {result["note"]}')
        return 1

    all_shots = shots_doc.get('shots') or []

    # 本轮处理哪些镜头（--shot / --reset-override 缩小范围；**不改动 shots.json 里的镜头表**）
    wanted = None
    if args.shot or args.reset_override:
        wanted = set()
        if args.shot:
            wanted.add(args.shot)
        if args.reset_override:
            wanted.add(args.reset_override)
    target = [s for s in all_shots if wanted is None or s.get('id') in wanted]

    # ① 编译派生字段
    changed = compile_shots(scenes, target)
    result['changed'] = changed

    # ② 生成提示词产物（生成器缺失也不能崩 —— 降级为「只重编译派生字段」）
    candidates = toolkit_candidates(work, toolkit)
    for directory in reversed(candidates):
        if str(directory) not in sys.path:
            sys.path.insert(0, str(directory))
    generator, _found_in, errors = load_generator(candidates)

    prompts = {}
    failures = []
    notes = []
    if generator is None:
        notes.append(f'没有找到提示词生成器（toolkit={toolkit}）')
        if errors:
            notes.append('；'.join(errors))
    else:
        prompts, failures = build_prompts(scenes, target, work, generator)
        if failures:
            notes.append('提示词生成失败：' + '；'.join(failures))

    # ③ 人工覆盖
    shot_ids = [s.get('id') for s in target if s.get('id')]
    override_files = collect_overrides(work, shot_ids)
    if args.reset_override:
        # 要重置的那一镜不参与覆盖（覆盖文件在写盘阶段删掉）
        override_files.pop(args.reset_override, None)

    effective = dict(prompts)
    overridden = []
    dirty_override = []
    for shot_id, path in override_files.items():
        if args.force:
            continue
        try:
            text = path.read_text(encoding='utf-8')
        except OSError:
            continue
        effective[shot_id] = text
        overridden.append(shot_id)
        if text != prompts.get(shot_id):
            dirty_override.append(shot_id)

    if args.force and override_files:
        notes.append('已按 --force 丢弃人工覆盖：' + '、'.join(sorted(override_files)))
    elif overridden:
        notes.append('已应用人工覆盖：' + '、'.join(sorted(overridden)))

    # ④ 比对产物与真源
    stale = []
    for shot_id, text in effective.items():
        path = slim / f'{shot_id}.prompt.txt'
        current = path.read_text(encoding='utf-8') if path.exists() else None
        if current != text:
            stale.append(shot_id)

    result['stale'] = stale
    result['prompts'] = len(prompts)
    result['overridden'] = sorted(overridden)
    result['note'] = '；'.join(notes)
    result['ok'] = True

    needs_work = bool(stale or changed or dirty_override)

    def report():
        """输出结果：`--json` 时 stdout 上只有一个 JSON 对象，否则给人看的文本。"""
        if args.json:
            print(json.dumps(result, ensure_ascii=False))
            return
        print(f'派生字段重编译：{len(changed)} 镜 {changed if changed else ""}')
        print(f'提示词产物：{len(prompts)} 条，与真源不一致 {len(stale)} 条 {stale if stale else ""}')
        if overridden:
            print(f'人工覆盖：{len(overridden)} 镜 {sorted(overridden)}')
        if result['note']:
            print(f'说明：{result["note"]}')

    # `--check` / `--dry` 都不写盘
    if args.check:
        report()
        return 1 if needs_work else 0

    if args.dry:
        report()
        if not args.json:
            print('[dry] 未写盘')
        return 0

    # 写盘：shots.json（派生字段）→ prompts/slim/*.prompt.txt（产物）
    (work / 'shots.json').write_text(
        json.dumps(shots_doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    slim.mkdir(parents=True, exist_ok=True)
    for shot_id, text in effective.items():
        (slim / f'{shot_id}.prompt.txt').write_text(text, encoding='utf-8')

    # 人工覆盖文件的处置
    if args.force:
        for path in override_files.values():
            try:
                path.unlink()
            except OSError:
                pass
    if args.reset_override:
        path = override_path(work, args.reset_override)
        try:
            if path.is_file():
                path.unlink()
        except OSError:
            pass

    report()
    if not args.json:
        print(f'✓ 已写 {len(effective)} 条提示词产物')
    return 0


if __name__ == '__main__':
    sys.exit(main())
