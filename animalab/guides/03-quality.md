# 03-quality — PROMPT_GUIDE 分册

> 来源：`PROMPT_GUIDE.md` 对应节拆分，详见主入口。

## 3. 元数据 / 质量 Tag

### 3.1 质量与评分

Anima 对 `year` / `score` / `highres` 的敏感度高于传统 SD，实测有强影响：

**人评质量**：`masterpiece, best quality, good quality, normal quality, low quality, worst quality`
**PonyV7 美学分**：`score_9` … `score_1`（保留 `_`）
可混用、单用或不用，皆有效。

**按变体推荐前缀**（Yu1Ko/Anima-Prompt）：

| Variant | Positive prefix | Negative baseline | Steps | CFG |
|---|---|---|---:|---:|
| Base | `masterpiece, best quality, score_7, safe` | `worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration` | 30–50 | 4–5 |
| Aesthetic 1.0 / 1.0b | `masterpiece, best quality, safe` | `worst quality, low quality, artist name, blurry, jpeg artifacts, chromatic aberration` | 30–50 | 4–5 |
| Aesthetic 1.1 | `masterpiece, best quality, safe` | `worst quality, low quality, artist name, blurry, jpeg artifacts, chromatic aberration` | 30–50 | 3–6 (start 4) |
| **Turbo (本仓库)** | `masterpiece, best quality, score_7, safe` | `worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration` | **8–12** (实测 4–8) | **1** |
| 2.9B-preview | `masterpiece, best quality, safe` (训练无 score，可保留) | 同 Base，score 可选 | 28–50 | 3.5–5 |

> Aesthetic 已在高质量图上微调并去除质量标签，默认可**省略 `score_*`**；但已本地验证的工作流无需强行去除，实测为准。2.9B 数据集亦无 `score`，但仍可使用。

**常用开头**：`masterpiece, best quality, highres, absurdres, newest, year 2025, safe` 或 `masterpiece, best quality, score_7, safe`
**year**：`year 2024` / `year 2025` 影响明显，作者建议保留 `highres/absurdres/year`
**period**：`newest, recent, mid, early, old`（时代感）
**meta**：`highres, absurdres, anime screenshot, jpeg artifacts, official art` 等

### 3.2 安全标签（必选其一）

| 标签 | 说明 |
|---|---|
| `safe` | 全年龄向（默认，仅当请求匹配时使用） |
| `sensitive` | 擦边/性感但不露骨 |
| `nsfw` | 成人内容 |
| `explicit` | 明确成人内容 |

必须在 `quality_meta_year_safe` 段明确指定。

### 3.3 Negative 起步

**Turbo/Base 通用**：
```
worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration
```
**Aesthetic**（去 score）：
```
worst quality, low quality, artist name, blurry, jpeg artifacts, chromatic aberration
```
**本仓库实测增强版**（AnimaTool + 实测）：
```
worst quality, low quality, blurry, jpeg artifacts, bad anatomy, bad hands, bad feet, extra fingers, missing fingers, extra limbs, text, watermark, logo
```

---

---
