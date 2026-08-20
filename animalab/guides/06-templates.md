# 06-templates — PROMPT_GUIDE 分册

> 来源：`PROMPT_GUIDE.md` 对应节拆分，详见主入口。

## 6. 完整模板（可直接套用）

```
[QUALITY / META]
masterpiece, best quality, highres, newest, year 2025, safe

[SUBJECT COUNT]
1girl, solo

[CHARACTER / SERIES]
fern, sousou no frieren  // 或 original character / no humans

[ARTIST / STYLE]  // 按需
anime illustration, clean lineart  // 或 @wlop

[APPEARANCE]
long purple hair, purple eyes, pale skin, black coat, white dress, puffy sleeves

[POSE / ACTION]
standing, holding a transparent umbrella

[COMPOSITION]
full body, three-quarter view, looking at viewer

[ENVIRONMENT]
rainy tokyo street, night, neon signs, wet pavement, reflections

[LIGHTING / EFFECTS]
cinematic lighting, rim light, depth of field

[NATURAL LANGUAGE]
A girl with long purple hair stands beneath a transparent umbrella in the center of a rainy Tokyo street. Neon signs glow behind her and their reflections extend across the wet pavement in the foreground.
```

- Negative 另起 `60:12`，与 positive 分离；单行逗号连接，不分行。
- **Negative** 见 §3.3，按变体选择是否含 `score_*`。
- Tomiigo 结构化变体（复杂多角色/多主体）：按 `[INTERACTION] → [CHARACTER_n: BASE/APPEARANCE/EXPRESSION/OUTFIT/POSE] → [SCENE_DETAILS: CAMERA/BACKGROUND/LIGHTING_AND_EFFECTS] → [NATURAL_LANGUAGE CAPTION]` 输出，见 §5.2。

---

---
