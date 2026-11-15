# H3 提示词骨架（六段式 · 多模态参考模式）

> 模板覆盖栈：`spec/templates/h3-prompt.md`（作品级可覆盖）。
> 格式规范见 `spec/references/h3-官方提示词规范.md`。

```
subject_definitions:
<Picture 1> ...        # 每张参考图一个标签
<Subject 1> ...        # 主体，引用 Picture

summary:
[reference generation] ...

retention_analysis:
<Picture 1> fully_preserved
<Subject 1> fully_preserved
...

detailed_description:
3D CG Pixar animation style, ... [Shot 1] ...

overall_soundscape:
...

non_diegetic_music:
...
```

## 填空约束

- `[Shot 1]` 必须是 `integrated_multimodal_description:` 之后的第一个词（纯文生视频用三段式时，该段就是 `integrated_multimodal_description:`）
- **不写**时长与画幅（用请求参数传）
- 主体定义与详细描述里的状态必须一致（干/湿、白/夜、季节）
- 音色描述词逐条逐字复用，不要每条现写

## 本项目固定的音色描述词

<!-- 复制这段到每条需要人声的提示词里，一个字都不要改 -->

```
<Subject 1> speaks with a calm, low-pitched adult male voice, warm and slightly husky, steady tempo, clear diction, no background music in the foreground.
```
