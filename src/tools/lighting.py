"""H3 提示词的光参数段 —— **通用光参数预设**（随包分发）。

为什么需要它
------------
风格锚（style anchor）在**图像端**能完整继承画风与光比，但在**视频端会衰减一档**：
实测角色的脸认得出，**光认不出**。所以视频端的渲染光比必须在提示词里**显式重建**——
这就是本模块存在的理由。

写法铁律
--------
· 写**光的行为**（方向 / 性质 / 明暗比 / 轮廓光 / 反弹光 / 空气感），
  不写抽象审美词（beautiful / pretty / stunning / masterpiece / best quality）。
· 必须有**画内可见光源**（叙事光）——超现实片段也要自洽给出光源。
· 冷暖用**暖赭石 / 古金（光）↔ 半透紫灰（暗）**，不用 muted / low-saturation 之类。
· 不得与场景锚矛盾：每个 preset 的光源都取自对应的场景锚事实。

这里只放**通用预设**：

    PRESETS  完整光参数段（文本以 `Lighting: ` 开头）
    SHORT    瘦身版光参数段（不带前缀，给瘦身后的提示词用）

**逐镜映射（`SHOT_LIGHTING`）是作品数据，不在这里**。
需要时由作品自己登记（`register_shot_lighting` / `load_shot_lighting`），
未登记的镜头 `key_for()` 返回 `None`、`block()` 返回空串。

公开接口
--------
PRESETS: dict[str, str]
SHORT: dict[str, str]
key_for(shot_id) -> str | None
block(shot_id) -> str
register_shot_lighting(mapping) -> dict
load_shot_lighting(path) -> dict
"""
from __future__ import annotations

import importlib.util
import json
import pathlib
import sys

# ---------------------------------------------------------------- 光参数段

PRESETS = {
    # 白天 · 室内（有窗、有裸灯泡、有实墙）
    "day_interior": (
        "Lighting: Low afternoon sun rakes in through the aluminium-framed sliding window at frame left "
        "at a shallow angle, laying a warm wedge of light across the floor and the near edge of the counter, "
        "with fine dust turning slowly inside the beam. "
        "A soft warm bounce off the dark wooden counter and the white brick wall lifts the shadow side of every face. "
        "The bare bulb overhead is on but weak, so the window stays the key. "
        "Shadows stay open and readable, never crushed. "
        "Warm ochre and old gold in the light against translucent violet-grey in the shade, "
        "with a thin rim of light along the hair and shoulders of anyone standing between the window and the room."
    ),
    # 白天 · 纸面 / 道具特写
    "day_paper": (
        "Lighting: A narrow shaft of low afternoon sun falls across the paper from the upper left at a shallow angle, "
        "picking out the tooth of the fibre and the raised edge of a fresh ink stroke, "
        "while the rest of the page falls away into soft warm shade. "
        "A faint warm bounce off the counter keeps the shaded half of the sheet from going flat, "
        "and a thin rim of light runs along the torn and creased edges. "
        "Warm ochre against translucent violet-grey, shadows open and every mark still legible."
    ),
    # 白天 · 面部 / 情绪
    "day_face": (
        "Lighting: Low afternoon sun rakes across the face from the upper left at a shallow angle, "
        "so the brow, the bridge of the nose and the cheekbone take the light "
        "while the far side of the face falls into soft shadow that keeps its detail; "
        "fine dust drifts in the beam behind. "
        "A warm bounce from the counter fills the shadow side and a thin rim of light edges the hair and the jaw. "
        "Warm ochre in the light against translucent violet-grey in the shade; the eyes stay bright and readable."
    ),
    # 白天 · 户外街道
    "alley_day": (
        "Lighting: Late-afternoon sun comes in high from the upper right, "
        "throwing long warm patches and tree-shadow across the grey flagstones, with dust hanging in the air. "
        "The shaded wall on the left stays cool and soft, and warm light bounces off the sunlit paving "
        "into the undersides of faces and awnings. "
        "A crisp warm rim traces the edges of shoulders and the carrying pole. "
        "Warm ochre and old gold against translucent violet-grey, clear separation but no crushed blacks."
    ),
    # 关张夜 · 室内（唯一亮源是裸灯泡 + 门缝一线街灯）
    "night_interior": (
        "Lighting: A single bare bulb hanging over the counter is the only working light — "
        "it drops a warm pool onto the open ledger and the scratched glass top "
        "and falls off steeply into deep translucent violet-grey shadow where detail still reads. "
        "A thin blade of street-lamp light cuts in through the gap under the roller shutter "
        "and lies across the concrete floor. "
        "The two warm sources separate in colour, the bulb pale gold and the street lamp cooler amber. "
        "Rim light catches the edge of hair and the shoulder line against the dark, "
        "and the faces are filled softly from the front so the eyes stay readable."
    ),
    # 关张夜 · 火光（炭盆 / 烧纸 / 纸灰）
    "night_fire": (
        "Lighting: A single bare bulb over the counter gives a small warm pool that falls away fast, "
        "while an enamel brazier on the floor throws a flickering orange glow "
        "that licks the wall behind it and lifts the undersides of faces and hands. "
        "The firelight is the moving light in this shot — it pulses across the curling paper and the grey ash. "
        "Everything outside the fire's reach sinks into deep translucent violet-grey shadow that still keeps its outline. "
        "Warm orange against cool violet-grey, with a hard rim of light along hair and shoulders."
    ),
    # 关张夜 · 面部 / 情绪
    "night_face": (
        "Lighting: Low warm light from the counter side rakes across the face at a shallow angle, "
        "so the brow, the cheekbone and the jaw take the light "
        "and the far side falls into translucent violet-grey shadow that keeps its detail. "
        "A faint orange flicker from the brazier breathes across the skin. "
        "A thin rim of light edges the hair and the shoulder line against the dark. "
        "The eyes stay bright and readable; the shadows are open, never crushed to black."
    ),
    # 关张夜 · 记忆叠印（同一构图的叠印，色温偏冷）
    "night_memory": (
        "Lighting: The room falls away into a soft, even translucent violet-grey wash as the memory surfaces, "
        "its warm key fading to a cold ambient glow. "
        "A pale cold light rises from the open ledger page itself and lifts the remembered hands, "
        "the damp cloth and the swinging bell out of the dim, "
        "with a soft bloom along their edges and a thin rim light tracing each contour; "
        "the edges of the overlay stay slightly brighter than the room behind them, "
        "as if two sheets of tracing paper were laid over one another. "
        "The shadow side of the fragment keeps its detail, "
        "and a faint warm edge of light from the bulb on the counter separates the fragment from the room. "
        "Its light is colder than the bulb."
    ),
}

# ---------------------------------------------------------------- 压缩版（瘦身提示词用）
#
# v2.2 冷暖结构：环境与暗部冷，光与受光面暖。这三条把「冷调环境 + 暖色光」写成
# 可执行的光行为（方向 / 性质 / 明暗 / 轮廓光 / 反弹光 / 空气感），不是抽象审美词。
SHORT = {
    "day_interior": (
        "Low afternoon sun rakes in through the window at frame left; the room stays cool "
        "slate-blue and indigo in the shadows, and only the lit surfaces turn warm ochre. "
        "A warm bounce off the counter lifts the shadow side of every face; a thin rim of light "
        "edges the hair and shoulders; dust drifts in the beam."
    ),
    "day_paper": (
        "A narrow shaft of low afternoon sun falls across the page from the upper left; "
        "the room around it stays cool blue-grey and indigo, and only the sheet and the hand "
        "turn warm ochre. A thin rim of light runs along the torn edges; every mark stays legible."
    ),
    "day_face": (
        "Low afternoon sun rakes across the face from the upper left; the room behind stays cool "
        "blue-grey and indigo, and only the lit side of the skin turns warm ochre. "
        "A warm bounce fills the shadow side; a thin rim edges the hair and jaw; the eyes stay bright."
    ),
    "alley_day": (
        "Late-afternoon sun comes in high from the upper right, laying long warm patches and "
        "tree-shadow across the cool grey flagstones; the shaded wall stays cool and soft, "
        "and only the sunlit surfaces turn ochre. A crisp warm rim traces the shoulders; "
        "dust hangs in the air."
    ),
    "night_interior": (
        "A single bare bulb over the counter drops a warm pool onto the ledger and falls off fast "
        "into deep indigo shadow; a thin blade of street-lamp light cuts in under the roller shutter. "
        "The two warm sources separate in colour; a rim of light edges the hair and shoulder."
    ),
    "night_fire": (
        "A small warm pool from a bare bulb falls away fast, while an enamel brazier throws a "
        "flickering orange glow that licks the wall and lifts the undersides of faces and hands. "
        "The firelight pulses across the paper and ash; everything else sinks into deep indigo; "
        "a hard rim edges the hair."
    ),
    "night_face": (
        "Low warm light from the counter side rakes across the face at a shallow angle; the room "
        "behind stays deep indigo and violet-grey, and only the lit skin turns warm ochre. "
        "A faint orange flicker from the brazier breathes across the skin; a thin rim edges the "
        "hair and jaw."
    ),
    "night_memory": (
        "The room falls away into an even violet-grey as the memory surfaces, its warm key fading "
        "to a cold ambient glow. A pale cold light rises from the open ledger page and lifts the "
        "remembered hands out of the dim; the edges of the overlay stay brighter than the room "
        "behind them, like two sheets of tracing paper laid over one another."
    ),
}

# ---------------------------------------------------------------- 逐镜映射（作品数据，默认空）
#
# 逐镜映射是**作品自己的数据**，不属于通用预设：
# 需要时由作品显式登记（见 `register_shot_lighting` / `load_shot_lighting`）。
SHOT_LIGHTING: dict = {}


def register_shot_lighting(mapping) -> dict:
    """登记逐镜映射（`{镜头 id: preset 键}`），返回登记后的总表。"""
    if isinstance(mapping, dict):
        for key, value in mapping.items():
            SHOT_LIGHTING[str(key)] = str(value)
    return SHOT_LIGHTING


def load_shot_lighting(path) -> dict:
    """从作品自己的文件载入逐镜映射。

    * `.json` —— 直接读 `{镜头 id: preset 键}`
    * `.py`  —— 显式导入该模块并取它的 `SHOT_LIGHTING`

    文件不存在返回空表（不报错）。
    """
    target = pathlib.Path(path)
    if not target.is_file():
        return {}
    if target.suffix.lower() == '.json':
        try:
            data = json.loads(target.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            return {}
        return register_shot_lighting(data)
    spec = importlib.util.spec_from_file_location('_work_shot_lighting', target)
    if spec is None or spec.loader is None:
        return {}
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception:
        return {}
    mapping = getattr(module, 'SHOT_LIGHTING', None)
    return register_shot_lighting(mapping) if isinstance(mapping, dict) else {}


def key_for(shot_id):
    """该镜头用的光参数 preset 键；未登记返回 `None`。"""
    return SHOT_LIGHTING.get(str(shot_id))


def block(shot_id):
    """该镜头的光参数段文本；未登记返回空串。"""
    key = key_for(shot_id)
    return PRESETS.get(key, '') if key else ''


def _main(argv=None):
    """`python lighting.py` —— 自检：预设键与逐镜映射是否对得上。"""
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv:
        load_shot_lighting(argv[0])
    print(json.dumps({'presets': sorted(PRESETS), 'short': sorted(SHORT),
                      'shot_lighting': SHOT_LIGHTING}, ensure_ascii=False, indent=2))
    missing = [key for key in SHOT_LIGHTING if key not in PRESETS]
    if missing:
        print('PRESETS 缺键:', missing, file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(_main())
