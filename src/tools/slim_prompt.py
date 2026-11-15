"""通用六段式 H3 提示词生成器 —— 插件随包分发的**默认实现**。

为什么要有"默认"生成器
----------------------
插件包原先假设作品目录里自带 `prompts/slim_prompt.py`；可演示作品只有**产物**
（`prompts/slim/*.prompt.txt`），没有生成器，于是"重新编译"直接崩在：

    ModuleNotFoundError: No module named 'slim_prompt'

本模块是兜底的通用实现：**作品自带生成器时用作品自己的，没有就用这个**
（编译器的搜索顺序见 `compile_prompts.py`）。

它做什么
--------
把一个镜头的真源编译成 H3 参考模式的**六段式**提示词：

    subject_definitions / summary / retention_analysis /
    detailed_description / overall_soundscape / non_diegetic_music

三条铁律
--------
R17  正文全英文（**台词除外**：`<d>[Chinese] …</d>` 逐字保留，不翻译）
R7   每个参考图都要有 `<Picture N>` + `<Subject N>` 声明，
     且在 `retention_analysis` 里**各占一行**
R9   音色描述词**每个说话人只写一次**；语气**逐句另写**（`delivery_en`）

通用性（不含任何具体作品的内容）
------------------------------
角色 / 道具 / 场景的英文标签全部从**作品自己的数据**现场推导：

  角色  character 记录的 `prompt_label`
        → `role` 字段经内置中文角色词表翻译
        → 通用兜底 `the character <角色 id>`
  道具  `prop_*` 资产 → `the prop <名字>`
  场景  `scene_*`（参考作品用法）/ `loc_*`（数据契约 §2.3）资产 → `the scene <名字>`
  其它  一律按道具处理 → `the prop <名字>`

标签里一旦出现非 ASCII 就回退到通用英文写法 —— **正文里不会出现中文**（R17）。
代词默认用中性写法（`their`）；只有 character 记录里**显式**写了 `pronoun`
（he / she / they）才用对应代词 —— **绝不从名字猜**。

公开接口
--------
build_prompt(shot, chars=None, idx_by_role=None, beats=None) -> str
    编译一个镜头的提示词。`chars` 是 `{角色 id: 角色记录}`；
    `beats` 是该镜覆盖的表演层 beat 列表（可选）。
build_subjects(refs, chars=None) -> (str, dict, dict)
    `(主体声明段, {资产 id: 序号}, {角色 id: 序号})`
build_dialogue(dialogue, idx_by_role=None, chars=None) -> list[str]
    台词行（音色每人一次，语气逐句另写）
classify(aid, chars=None) -> (kind, label, role_id)
    资产 id → `(char|prop|scene, 英文标签, 角色 id 或 None)`
"""
from __future__ import annotations

import importlib
import json
import pathlib
import re
import sys

_HERE = pathlib.Path(__file__).resolve().parent

# ---------------------------------------------------------------- 词表

#: character 记录的 `role` 字段（中文）→ 英文标签
ROLE_EN = {
    '主角': 'the lead character',
    '配角': 'the supporting character',
    '反派': 'the antagonist',
    '群演': 'the crowd',
    '旁白': 'the narrator',
}

#: 各类参考图的「要保持什么」—— 一句话，是复述的**替代品**
KEEP = {
    'char': 'strictly the same person, the same face and the same clothes',
    'scene': 'the same space; do not move any furniture',
    'prop': 'the same object, the same material and the same size',
}

#: 画面质感（`[Shot 1]` 之后的第一句）
STYLE = ('Hand-drawn 2D animated feature, cel-shaded flat colour areas with hard-edged '
         'shading under a light transparent watercolour wash, extremely fine linework close to a '
         'single pencil line, tapering at the ends, line weight varying with the form.')

#: 镜头没有登记光参数时的通用兜底（写光的行为，不写抽象审美词）
FALLBACK_LIGHTING = ('Lighting: the light already established by the reference images, with a clear '
                      'direction, a soft bounce off the surrounding surfaces and open, readable shadows.')

#: 镜头没有登记声景时的通用兜底
FALLBACK_SOUNDSCAPE = ('The diegetic sounds of the space are present and clearly audible at a normal level.')

#: 资产 id 尾部的版本 / 语言标记（`_cn` / `_v2` / `_cn_v2`）
_VERSION_TAIL = re.compile(r'(?:^|_)(?:v\d+|cn)$')


def _load_short():
    """载入 `lighting.py` 的瘦身光参数段；没有就返回空表（光参数走通用兜底）。

    先用 `sys.path` 上已有的（作品自带的优先），失败再把本模块所在目录加进去试。
    """
    for attempt in (False, True):
        try:
            if attempt and str(_HERE) not in sys.path:
                sys.path.insert(0, str(_HERE))
            module = importlib.import_module('lighting')
            short = getattr(module, 'SHORT', None)
            if isinstance(short, dict):
                return short
        except Exception:
            continue
    return {}


#: 瘦身光参数段 `{preset 键: 文本}`（来自同目录的 `lighting.py`）
SHORT = _load_short()


# ---------------------------------------------------------------- 小工具

def _ascii_ok(text) -> bool:
    """文本是否纯 ASCII（R17：正文不得出现中文等非 ASCII 字符）。"""
    return isinstance(text, str) and all(ord(ch) < 128 for ch in text)


def _clean_en(value) -> str:
    """取出可安全写进英文正文的文本（R17：正文全英文）。

    · 全 ASCII → 原样保留；
    · **少量**非 ASCII → 保留：那是「可见文字」（引号里的汉字、道具上写着的字），
      R17 与官方规范都明确豁免它（除对白、歌词、可见文字外，全部英文）；
    · 整体非 ASCII（中文句子）→ 丢弃，不让中文混进正文。
    """
    if not isinstance(value, str):
        return ''
    text = ' '.join(value.split())
    if not text:
        return ''
    if _ascii_ok(text):
        return text
    foreign = sum(1 for ch in text if ord(ch) >= 128)
    if foreign / len(text) > 0.3:
        return ''
    return text


def _words(value) -> str:
    """把 id 里的下划线换成空格。"""
    return ' '.join(str(value).replace('_', ' ').split())


def _cap(text: str) -> str:
    """首字母大写（拼成句子用）。"""
    text = str(text)
    return text[0].upper() + text[1:] if text else text


def _slug(value) -> str:
    """把任意 id 压成可安全写进英文正文的片段（非 ASCII 一律丢掉）。"""
    out = []
    for ch in str(value):
        if ch.isascii() and (ch.isalnum() or ch in ' _-'):
            out.append(ch)
        else:
            out.append(' ')
    return _words(''.join(out))


def _strip_version(base: str) -> str:
    """去掉资产 id 尾部的版本 / 语言标记（`prop_bell_cn_v2` → `prop_bell`）。"""
    current = str(base)
    while True:
        new = _VERSION_TAIL.sub('', current)
        if new == current or not new:
            return current
        current = new


# ---------------------------------------------------------------- 英文标签

def char_label(role_id, chars=None) -> str:
    """角色的英文标签：`prompt_label` → `role` 词表 → `the character <id>`。

    非 ASCII 一律不采用（R17）：中文标签回落成通用英文写法。
    """
    records = chars if isinstance(chars, dict) else {}
    record = records.get(role_id) or {}
    if not isinstance(record, dict):
        record = {}

    label = record.get('prompt_label')
    if isinstance(label, str):
        label = _clean_en(label)
        if label:
            return label

    role = record.get('role')
    if isinstance(role, str):
        mapped = ROLE_EN.get(role.strip())
        if mapped:
            return mapped

    slug = _slug(role_id)
    return 'the character ' + (slug if slug else 'figure')


def prop_label(base) -> str:
    """道具的英文标签：`the prop <名字>`（`prop_bell` → `the prop bell`）。"""
    text = str(base)
    if text.startswith('prop_'):
        text = text[len('prop_'):]
    name = _slug(text)
    return 'the prop ' + (name if name else 'object')


def scene_label(base) -> str:
    """场景的英文标签：`the scene <名字>`（`scene_shop` → `the scene shop`）。"""
    text = str(base)
    for prefix in ('scene_', 'loc_'):
        if text.startswith(prefix):
            text = text[len(prefix):]
            break
    name = _slug(text)
    return 'the scene ' + (name if name else 'space')


# ---------------------------------------------------------------- 分类

def _role_maps(chars):
    """返回 `(角色记录表, 资产 id → 角色 id 反查表)`。"""
    records = {}
    owner = {}
    for cid, record in (chars or {}).items():
        record = record if isinstance(record, dict) else {}
        records[cid] = record
        for key in ('reference_assets', 'assets', 'refs'):
            values = record.get(key)
            if not isinstance(values, (list, tuple)):
                continue
            for aid in values:
                if isinstance(aid, str) and aid:
                    owner.setdefault(aid, cid)
    return records, owner


def _classify(aid, records, owner):
    """资产 id → `(kind, 英文标签, 角色 id 或 None)`。"""
    aid = str(aid)
    base = _strip_version(aid)

    cid = owner.get(aid) or owner.get(base)
    if cid is None:
        # `<role>_<state>_<tag>` 形态：role 命中已知角色 id
        for candidate in sorted(records.keys(), key=len, reverse=True):
            if base == candidate or base.startswith(candidate + '_'):
                cid = candidate
                break
    if cid is not None:
        return 'char', char_label(cid, records), cid
    if base.startswith('scene_') or base.startswith('loc_'):
        # `scene_*`（参考作品用法）与 `loc_*`（数据契约 §2.3 的场景参考图命名）都算场景
        return 'scene', scene_label(base), None
    # `prop_*` 与其它一切 → 道具
    return 'prop', prop_label(base), None


def classify(aid, chars=None):
    """资产 id → `(kind, 英文标签, 角色 id 或 None)`。

    `kind` ∈ `char` / `prop` / `scene`。
    """
    records, owner = _role_maps(chars)
    return _classify(aid, records, owner)


# ---------------------------------------------------------------- 段落

def build_subjects(refs, chars=None):
    """`(subject_definitions 段, {资产 id: 序号}, {角色 id: 序号})`。

    每张参考图两行：`<Picture N>` 声明它是什么，`<Subject N>` 声明要保持什么。
    """
    records, owner = _role_maps(chars)
    refs = [r for r in (refs or []) if isinstance(r, str) and r]

    lines = []
    idx = {}
    role_idx = {}
    for i, aid in enumerate(refs, 1):
        kind, label, cid = _classify(aid, records, owner)
        lines.append(f'<Picture {i}> {label}, exactly as shown.')
        idx[aid] = i
        if cid and cid not in role_idx:
            role_idx[cid] = i
    for i, aid in enumerate(refs, 1):
        kind, label, _ = _classify(aid, records, owner)
        lines.append(f'<Subject {i}> {label} from <Picture {i}> - {KEEP[kind]}.')
    return '\n'.join(lines), idx, role_idx


def _pronouns(record):
    """代词：默认中性（they）；只有显式 `pronoun` 字段才用性别代词。

    @return `(主格代词, 句首大写形式, 动词形式)`
    """
    value = (record or {}).get('pronoun')
    if isinstance(value, str):
        value = value.strip().lower()
        if value in ('he', 'she', 'they'):
            return value, value.capitalize(), ('speak' if value == 'they' else 'speaks')
    return 'they', 'Their', 'speak'


def build_dialogue(dialogue, idx_by_role=None, chars=None, on_screen_roles=None):
    """台词行。

    · 音色描述词**每个说话人只写一次**（R9）；
    · 语气**逐句另写**（`delivery_en`，只写英文那份）；
    · 画内音才写口型（`mode=dialogue`），画外音写成独立的画外声部；
    · 没有参考图但**在镜头角色表里**的人，按画内音处理（只是没有 `<Subject>` 可指）。
    """
    records, _ = _role_maps(chars)
    idx_by_role = idx_by_role if isinstance(idx_by_role, dict) else {}
    on_screen_roles = on_screen_roles if isinstance(on_screen_roles, (list, tuple, set, frozenset)) else []

    out = []
    spoken = set()
    for entry in dialogue or []:
        if not isinstance(entry, dict):
            continue
        role = entry.get('speaker')
        if isinstance(role, dict):
            role = role.get('role')
        if not isinstance(role, str) or not role:
            continue

        text = entry.get('text') or ''
        mode = entry.get('mode') or 'dialogue'
        sid = idx_by_role.get(role)
        record = records.get(role) or {}

        if sid is not None and mode != 'voiceover':
            # 画内音：写清口型（R3：要口型就写画内音）
            pronoun, pronoun_cap, verb = _pronouns(record)
            line = (f'<Subject {sid}> says: <d>[Chinese] {text}</d> '
                    f'{pronoun_cap} lips move clearly with the words as {pronoun} {verb}.')
        elif role in on_screen_roles and mode != 'voiceover':
            # 在镜头里、但这一镜没给参考图 → 只能按描述写，不能写成 `<Subject>`
            pronoun, pronoun_cap, verb = _pronouns(record)
            who = _cap(char_label(role, records))
            line = (f'{who} says: <d>[Chinese] {text}</d> '
                    f'{pronoun_cap} lips move clearly with the words as {pronoun} {verb}.')
        else:
            # 画外声部：不在画面里，也没有参考图
            line = f'Off screen, an unseen voice says: <d>[Chinese] {text}</d>'
            line += ' The speaker is off screen and not visible.'

        if role not in spoken:
            spoken.add(role)
            voice = _clean_en(record.get('voice_desc'))
            if voice:
                line += f' {_cap(voice)}.'
        delivery = _clean_en(entry.get('delivery_en'))
        if delivery:
            line += f' {delivery}'
        out.append(line)
    return out


def _lighting_line(shot):
    """`Lighting:` 行：镜头登记的光参数段；没登记走通用兜底。"""
    key = _clean_en(shot.get('lighting'))
    if key:
        text = _clean_en(SHORT.get(key))
        if text:
            return 'Lighting: ' + text
    return FALLBACK_LIGHTING


def _shot_roles(shot):
    """镜头里的角色 id 列表（**保持 shots.json 里的顺序**，去重）。

    `shot["characters"]` 有两种写法，都要认：
    `["aling"]` 与 `[{"role": "aling", "state": "dry"}]`。
    """
    roles = []
    for entry in shot.get('characters') or []:
        role = entry.get('role') if isinstance(entry, dict) else entry
        if isinstance(role, dict):
            role = role.get('role')
        if isinstance(role, str) and role and role not in roles:
            roles.append(role)
    return roles


def _subject_line(shot, role_idx, refs, records, owner):
    """这一镜的主体指向哪个 `<Subject>`。"""
    for role in _shot_roles(shot):
        if role in role_idx:
            return f'<Subject {role_idx[role]}> is the subject of this shot.'
    for i, aid in enumerate(refs, 1):
        kind, _, _ = _classify(aid, records, owner)
        if kind == 'char':
            return f'<Subject {i}> is the subject of this shot.'
    if refs:
        return '<Subject 1> is the subject of this shot.'
    return ''


def build_prompt(shot, chars=None, idx_by_role=None, beats=None) -> str:
    """把一个镜头编译成六段式提示词。

    @param shot         镜头真源（references / characters / dialogue / audio / lighting / camera）
    @param chars        `{角色 id: 角色记录}`
    @param idx_by_role  `{角色 id: <Subject N> 序号}`（可选，与内部推导合并）
    @param beats        该镜覆盖的表演层 beat 列表（可选）
    @return             六段式提示词全文
    """
    shot = shot if isinstance(shot, dict) else {}
    chars = chars if isinstance(chars, dict) else {}

    refs = [r for r in (shot.get('references') or []) if isinstance(r, str) and r]
    records, owner = _role_maps(chars)
    subdefs, idx_by_aid, role_idx = build_subjects(refs, chars)

    merged = dict(role_idx)
    for key, value in (idx_by_role or {}).items():
        if key not in merged:
            merged[key] = value

    subj_line = _subject_line(shot, merged, refs, records, owner)

    retention = '\n'.join(
        [f'<Picture {i}> fully_preserved' for i in range(1, len(refs) + 1)] +
        [f'<Subject {i}> fully_preserved' for i in range(1, len(refs) + 1)])

    body = [f'[Shot 1] {STYLE}']
    lighting = _lighting_line(shot)
    if lighting:
        body.append(lighting)
    if subj_line:
        body.append('')
        body.append(subj_line)

    # 表演层：**按 beat 交替输出「动作 → 台词 → 反应拍 → 台词」**（R18②）
    dlg_lines = build_dialogue(shot.get('dialogue'), merged, chars, _shot_roles(shot))
    if beats:
        di = 0
        for beat in beats:
            if not isinstance(beat, dict):
                continue
            action = _clean_en(beat.get('action_en'))
            if action:
                body.append('')
                body.append(action)
            if beat.get('mode') in ('dialogue', 'voiceover') and di < len(dlg_lines):
                body.append('')
                body.append(dlg_lines[di])
                di += 1
        for line in dlg_lines[di:]:          # beats 覆盖不全时兜底
            body.append('')
            body.append(line)
    else:
        desc = _clean_en(shot.get('description_en')) or _clean_en(shot.get('description'))
        if desc:
            body.append('')
            body.append(desc)
        for line in dlg_lines:
            body.append('')
            body.append(line)

    camera = _clean_en(shot.get('camera_en')) or _clean_en(shot.get('camera')) or 'Static Shot'
    body.append('')
    body.append(f'Camera: {camera}')

    audio = shot.get('audio') if isinstance(shot.get('audio'), dict) else {}
    soundscape = _clean_en(audio.get('soundscape')) or FALLBACK_SOUNDSCAPE
    music = _clean_en(audio.get('music')) or 'no non-diegetic music in this shot'
    if music.strip().lower().startswith('no '):
        music_line = ('No non-diegetic music plays in this shot; '
                      'only the diegetic sounds described above are heard.')
    else:
        music_line = music

    return '\n'.join([
        'subject_definitions:',
        subdefs,
        '',
        'summary:',
        '[reference generation] one continuous take; every <Subject> stays identical to its reference picture.',
        '',
        'retention_analysis:',
        retention,
        '',
        'detailed_description:',
        '\n'.join(body),
        '',
        'overall_soundscape:',
        soundscape,
        'non_diegetic_music:',
        music_line,
        '',
    ])


# ---------------------------------------------------------------- 命令行

def _main(argv=None):
    """`python slim_prompt.py <作品目录>` —— 独立跑一遍，产物写到 `<作品>/prompts/slim/`。"""
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv:
        print('用法：python slim_prompt.py <作品目录>', file=sys.stderr)
        return 2

    work = pathlib.Path(argv[0]).resolve()
    scenes = {s['id']: s for s in json.loads((work / 'scenes.json').read_text(encoding='utf-8'))['scenes']}
    shots = json.loads((work / 'shots.json').read_text(encoding='utf-8'))['shots']
    chars = {c['id']: c for c in json.loads((work / 'characters.json').read_text(encoding='utf-8'))['characters']}

    out_dir = work / 'prompts' / 'slim'
    out_dir.mkdir(parents=True, exist_ok=True)
    for shot in shots:
        scene = scenes.get(shot.get('scene'))
        beats = None
        if scene:
            covers = shot.get('covers') or []
            idx = [c - 1 for c in covers if 1 <= c <= len(scene.get('beats') or [])]
            if idx:
                beats = [scene['beats'][i] for i in idx]
        text = build_prompt(shot, chars, {}, beats)
        (out_dir / f"{shot['id']}.prompt.txt").write_text(text, encoding='utf-8')
        print(f"  {shot['id']:14} {len(text.split()):>4} words")
    print(f'-> {out_dir}')
    return 0


if __name__ == '__main__':
    raise SystemExit(_main())
