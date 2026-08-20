# 11-starters — PROMPT_GUIDE 分册

> 来源：`PROMPT_GUIDE.md` 对应节拆分，详见主入口。

## 12. 推荐起手式（复制即用）

### 12.1 通用单角色

```
masterpiece, best quality, highres, newest, year 2025, safe,
1girl, solo,
original character,
anime illustration, clean lineart,
long silver hair, blue eyes, pale skin, black dress, white gloves,
standing, holding a transparent umbrella, looking at viewer,
full body, three-quarter view,
rainy tokyo street, night, neon signs, wet pavement, reflections,
cinematic lighting, rim light, depth of field.
A silver-haired girl stands beneath a transparent umbrella in the center of a rainy Tokyo street. Neon signs glow behind her and their reflections extend across the wet pavement in the foreground.
```

Negative：
```
worst quality, low quality, blurry, jpeg artifacts, bad anatomy, bad hands, extra fingers, text, watermark
```
Turbo 建议负面追加 `score_1, score_2, score_3, chromatic aberration`；Aesthetic 可省 `score_*`。

### 12.2 指定角色（以 Fern 为例）

```
masterpiece, best quality, safe,
1girl, solo,
fern, sousou no frieren,
long purple hair, purple eyes, long black coat, white dress, puffy sleeves,
standing, looking at viewer, full body,
forest, sunlight, soft lighting
```

要 `@wlop` 风格则在 `fern, sousou no frieren,` 后插入 `@wlop,`。

### 12.3 多角色防串脸

```
2girls,
frieren, sousou no frieren, long white hair, pointed ears, green eyes, white and black mage outfit,
fern, sousou no frieren, long purple hair, purple eyes, black coat, white dress,
standing side by side, looking at viewer
Frieren stands on the left while Fern stands on the right. Frieren has white hair and pointed ears, Fern has long purple hair and wears a black coat.
```

### 12.4 无人物风景

```
masterpiece, best quality, highres, newest, year 2025, safe,
no humans,
anime background, scenic,
landscape, mountain, lake, reflection, clouds,
sunset, golden hour, dramatic lighting
```

Negative：
```
worst quality, low quality, blurry, text, watermark
```

### 12.5 Tomiigo 结构化管线（复杂多角色，LLM 友好）

```
[INTERACTION]
- COUNT_AND_RELATION: 2girls, duo, holding hands
[CHARACTER_1]
- BASE: frieren, sousou no frieren
- APPEARANCE: long white hair, pointed ears, green eyes
- EXPRESSION: smile
- OUTFIT: white and black mage outfit
- POSE: standing, arms up
[CHARACTER_2]
- BASE: fern, sousou no frieren
- APPEARANCE: long purple hair, purple eyes
- EXPRESSION: smile
- OUTFIT: black coat, white dress, puffy sleeves
- POSE: standing
[SCENE_DETAILS]
- CAMERA: full body, three-quarter view
- BACKGROUND: forest, sunlight
- LIGHTING_AND_EFFECTS: soft lighting, cinematic lighting
[NATURAL_LANGUAGE]
- CAPTION: {CHAR_1} stands on the left while {CHAR_2} stands on the right.
```
最终拼为单行 `tags, tags. Caption.` 形式投喂 `60:11`。

---

---
