# 01-model — PROMPT_GUIDE 分册

> 来源：`PROMPT_GUIDE.md` 对应节拆分，详见主入口。

## 1. 模型理解（为什么要混合）

- Anima 训练同时见过 `Danbooru-style tags + natural language captions`（官方 README），因此：
  - `纯 tags` → 原子概念精确，但空间/主次关系模糊（谁在左、谁拿什么）。
  - `纯自然语言` → 场景连贯、关系清晰，但细粒度控制下降。
  - `Tags + Natural Language` → 最佳：tags 定“有什么”，NL 定“怎么摆”。
- 社区共识（Anima-Prompt / AnimaTool / Tomiigo pipeline）均采用“先 tags 后 NL 段”的混合结构。Qwen 3 0.6B 文本编码器对长英文 caption 跟随能力强，非仅短语。
- **训练数据**：数百万 anime + 约 80 万非 anime 艺术图，无合成数据；官方 Base 知识截止 2025-09，2.9B 扩展集新增 170 万样本截止 2026-07（Gazingstars123）。
- **版本分化**：
  - `Base` — 预训练基座，最中性，LoRA 应基于此训练；需显式 style/composition/artist。
  - `Aesthetic 1.0/1.0b/1.1` — 高质量图微调，去除质量标签后训练，默认更高审美；v1.1 为平滑风格/降伪影的重训版，适合长英文/复杂姿态/镜头/分镜。
  - `Turbo (anima_turboV10.safetensors)` — 蒸馏版，本仓库运行时版本；**CFG=1.0, steps 8–12（本仓库实测 4–8 亦可），sampler `er_sde`/`euler`**，稳定性强但多样性略降。
  - `Anima-2.9B` — 28 层→40 层扩张至 2.9B 深度，Muon 优化器 8×5080，前期层零初始化输出投影，功能等价于 Base 起点。
- **Tag dropout**：训练时随机丢弃标签，无需堆砌全部相关 tag；优先高信息量标签，去冗余同义词。

---

---
