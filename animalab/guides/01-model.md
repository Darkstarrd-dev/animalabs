# 01-model — PROMPT_GUIDE 分册

> 来源：`PROMPT_GUIDE.md` 对应节拆分，详见主入口。

## 1. 模型理解（为什么要混合）

- Anima 训练同时见过 `Danbooru-style tags + natural language captions`（官方 README），因此：
  - `纯 tags` → 原子概念精确，但空间/主次关系模糊（谁在左、谁拿什么）。
  - `纯自然语言` → 场景连贯、关系清晰，但细粒度控制下降。
  - `Tags + Natural Language` → 最佳：tags 定“有什么”，NL 定“怎么摆”。
- 社区共识（Anima-Prompt / AnimaTool / Tomiigo pipeline）均采用“先 tags 后 NL 段”的混合结构。Qwen 3 0.6B 文本编码器对长英文 caption 跟随能力强，非仅短语。
- **训练数据**：数百万 anime + 约 80 万非 anime 艺术图，无合成数据；官方 Base 知识截止 2025-09，2.9B 扩展集新增 170 万样本截止 2026-07（Gazingstars123）。
- **版本分化（多样性视角 · 实测 2026-08-20）**：
  - `Base (anima-preview3-base)` — 预训练基座，最中性/最泛用，多样性基线最高；破精美/诡异风格的首选，LoRA 训练也必须用 Base。需显式 `style/composition/artist + 语义块加权` 才会出效果，但可控。
  - `Aesthetic 1.0/1.0b/1.1` — 高质量图微调，默认审美更强，精美收敛；`score_*` 可省。v1.1 平滑风格/降伪影，适长英文/复杂姿态/分镜。
  - `Turbo (anima_turboV10)` — 蒸馏版，**CFG=1.0, steps 8–12（本仓库 4–8 亦可），sampler `er_sde`/`euler`**，速度最快但默认审美最精美、干净，多样性略降；不加干预易“千图一美脸”。
  - `Anima-2.9B` — 28→40 层扩张至 2.9B，Muon 8×5080，功能等价 Base 起点。
- **多样性实测结论**：`artist加权 + 重点形容词/语义块加权` 配合 `Turbo/Aesthetic → Base` 切换，可显著提升多样性并压制“过度精美”。即：`(entire body covered in rainbow fur:2.5)` 类语义块加权 + `(@q hayashida:2)` 类 artist 加权，在 Base 上比在 Turbo 上更易拉出粗糙/怪诞/畸变等非精美分布；反之在 Turbo 上需更高权重 (2–3) 才明显。
---

---
