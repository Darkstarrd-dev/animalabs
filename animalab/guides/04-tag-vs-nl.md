# 04-tag-vs-nl — PROMPT_GUIDE 分册

> 来源：`PROMPT_GUIDE.md` 对应节拆分，详见主入口。

## 4. Tag vs 自然语言的分工

- **Tag**：`1girl, long hair, silver hair, school uniform, rain, tokyo street, neon lights, wet pavement`
- **NL**：`A young girl with long silver hair stands beneath a transparent umbrella on a rainy Tokyo street. Neon signs behind her illuminate the rain, reflections stretch across the wet pavement in the foreground.`
- **组合示例**（雨夜东京）：
  ```
  masterpiece, best quality, safe,
  1girl, solo,
  long hair, silver hair, blue eyes, school uniform,
  transparent umbrella, standing, looking at viewer,
  rain, night, tokyo street, neon lights, wet pavement, reflections,
  cinematic lighting, anime illustration.
  A young girl with long silver hair stands beneath a transparent umbrella on a rainy Tokyo street at night. Colorful neon signs behind her illuminate the rain, while their reflections stretch across the wet pavement in the foreground.
  ```
- **NL 擅长**：`left side / right side / looks toward / in front of / behind / while holding` 等空间/主次、因果、叙事分镜。
- **Tag 擅长**：发色、服装、镜头、光影等原子视觉。
- **组织原则**（Yu1Ko）：复杂 NL 按视觉层拆分 — subject/clothing → pose/expression → environment/camera → layout/containment（分镜时先定网格再逐格分配主体并声明“各出现一次、不跨格”）。
- **位置规则**：
  - 非人物场景，`no humans` 紧跟 `quality/meta/safety` 段后。
  - 多主体左右/前后不靠 tag 词序，需在 NL 中用 `left / center / right` 显式锚定；Anima 对显式位置锚点跟随良好。
  - 纯 NL 需至少 2 句完整英文句；极短 prompt 易出 bland 背景。

---

---
