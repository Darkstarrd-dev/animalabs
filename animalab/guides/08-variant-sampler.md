# 08-variant-sampler — PROMPT_GUIDE 分册

> 来源：`PROMPT_GUIDE.md` 对应节拆分，详见主入口。

## 8. 变体、采样器、分辨率与宽高比

### 8.1 变体策略

- **Base**：适合显式 `style / composition / artist / tags`，你负责控制；LoRA 训练必须用 Base。
- **Aesthetic 1.0/1.0b**：已审美微调，少堆“漂亮”类词，关注内容本身；`score_*` 可省。
- **Aesthetic v1.1**：部分重训平滑风格、降伪影，适合长英文/复杂姿态/镜头/分镜绑定；作者建议 v1.0b 为通用默认，v1.1 用于上述复杂场景。
- **Turbo**：蒸馏强默认风格，`CFG 1` + `8–12 steps`；本仓库 `anima_turboV10` 实测 `4–8 steps` 亦稳，单张约 1.5–2s（RTX 5090D）。
- **2.9B**：同 Base 提示词习惯，`year/highres` 仍强影响，短 prompt 差；实测 `euler + sgm-uniform` 均衡，`res-multistep + linear-quadratic` 更重高噪步、构图更好。

建议同一 job 在 Base/Aesthetic/Turbo 上各跑一组对比（`turbo-compare.json` 已预留 sampler/cfg 对比思路；`cfg 2` 更锐待补图）。

### 8.2 采样器与调度器（官方 + 2.9B + 实测）

| 采样器 | 风格倾向 | 备注 |
|---|---|---|
| `er_sde` | 中性、平涂、锐线 | 官方默认推荐 |
| `euler_a` | 更柔、细线、偶 2.5D | CFG 可略推高不易糊 |
| `dpmpp_2m_sde_gpu` | 同 `er_sde` 但更多变/更 creative | 有时过 wild |
| `euler` | 基础、略 creative | Turbo/Aesthetic 上更稳 |
| `res-multistep` | 构图更佳 | 2.9B 推荐搭配 `linear-quadratic` |

**调度器**：`simple`（本仓库 Turbo 默认）、`normal`、`karras`、`sgm-uniform`、`linear-quadratic`、`beta`、`beta57`（需 RES4LYF 节点，更重低噪步、更写实/油画质感）。

**CFG / Steps**：
- Turbo：`cfg 1.0` + `steps 4–12`（本仓库固定 `cfg=1.0`）
- Base/Aesthetic：`cfg 4–5` + `steps 30–50`
- 2.9B：`cfg 3.5–5` + `steps 28–50`（`3.5` 与 `5` 各有胜负，需 A/B）

### 8.3 分辨率与宽高比

- **官方像素范围**：512² – 1536²（约 262k – 2.36M 像素）；`2.9B` 推荐 `812×1216 / 1152×1536 / 1536×1536 (iffy)`。
- **本仓库约束**（`Anime_Turbo_api.json:60:28`）：`width/height` 16–16384 且 8 倍数，非倍数向上对齐并记 `warnings`。
- **AnimaTool 宽高比**：

| 类型 | 比例 | 适用场景 |
|---|---|---|
| 横屏 | `21:9, 2:1, 16:9, 16:10, 5:3, 3:2, 4:3` | 风景、场景 |
| 方形 | `1:1` | 头像、图标 |
| 竖屏 | `3:4, 2:3, 3:5, 10:16, 9:16, 1:2, 9:21` | 人物立绘、手机壁纸 |

- **常见问题**：
  - 手足崩坏 → 负面加 `bad hands, extra fingers, missing fingers, bad feet, extra limbs`
  - 兽耳变异 → 负面加 `anthro, furry`
  - 构图不对 → 用 `upper body / full body / portrait / close-up` 明确构图，1MP 下主体占比需足够大
  - 画风不稳 → 用推荐画师组合，避免小众画师，辅以 `style` 字段

### 8.4 数据集标签（可选高级）

为提升多样性，Anima 额外训练于 `ye-pop` / `DeviantArt` 非 anime 数据集，caption 以数据集标签开头 + 换行：

```
ye-pop
For Sale: Others by Arun Prem
Abstract, oil painting of three faceless, blue-skinned figures...
---
deviantart
Flame
Digital painting of a fiery dragon...
```

一般 anime 创作无需使用，了解即可。

---

---
