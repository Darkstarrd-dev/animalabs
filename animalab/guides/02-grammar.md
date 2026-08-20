# 02-grammar — PROMPT_GUIDE 分册

> 来源：`PROMPT_GUIDE.md` 对应节拆分，详见主入口。

## 2. 语法规则（Anima-Prompt Grammar）

### 硬性规则（AnimaTool）

1. 画师必须带 `@` 前缀：`@fkey` 而非 `fkey`，否则几乎无效。
2. 必须明确安全标签：`safe` / `sensitive` / `nsfw` / `explicit` 四选一。
3. 提示词不分行：单行逗号连接，分行会影响效果；每个逗号后加一空格。

### 详细语法

| 规则 | 正确 | 错误 | 说明 |
|---|---|---|---|
| 大小写 | `long hair` | `Long Hair` | tag 统一小写；纯 NL 段按正常英文大小写 |
| 分隔 | `long hair` | `long_hair` | 空格代替 `_` |
| 例外 | `score_7`, `score_9` | `score 7` | 仅 PonyV7 评分标签保留 `_` |
| 画师 | `@wlop`, `@fkey` | `wlop`, `artist:wlop` | 必须 `@` 前缀，系特殊 stylistic anchor |
| 逗号 | `,` 分隔 tags | 顿号/无分隔 | 逗号为 tag 边界 |
| 词库 | Danbooru/Gelbooru/e621 标准 tag | 随意英文 | 优先标准 tag，NL 仅用于关系/构图 |
| 转义 | `kiriko \(overwatch\)` | `kiriko (overwatch)` | 含括号的 tag 需转义；未转义括号视为权重 `(glitch:2)` |
| 权重-范式 | `(chibi:2)` / `(@q hayashida:2)` / `(rainbow fur:2.5)` / `(entire body covered in rainbow fur:2.5)` | `(chibi:1.1)` / `@(q hayashida:1.5)` | 统一 `(内容:weight)`；artist 形式必为 `(@name:weight)` — `@` 在括号内；普通 tag / 自然语言语义块同理；官方例 `(chibi:2)` 与作者例 `(@artist :1.1)`、`deep depth of field showing out of (focus food stalls:2) in the background` |
| 权重-强度 | `1.5 渐显 / 2.0 明显 / 2–3 常用` | `1.1` 期待明显变化 | Qwen 编码器权重非线性且弱于 SDXL，同值偏弱；`1.1≈无感 / 1.3仍弱 / 1.5起效 / 2.0明显 / 2–3 artist 才稳`，过高崩坏 |
| 权重-语义块 | `(entire body covered in vivid rainbow-colored fur:2.5)` | `(rainbow:3)` + 5 个同义词堆砌 | 优先对完整语义关系加权而非单关键词；`(no normal-colored fur anywhere:1.5)` 类否定块亦可 |
| 拼写 | Gelbooru 版 | Danbooru 版 | 两者不一致时优先 Gelbooru 拼写 |

**推荐顺序**（Anima-Prompt / AnimaTool 共识，段内任意序）：

```
quality / meta / year / safety        # 1
→ subject count (1girl/2girls/no humans)  # 2
→ character name                      # 3
→ series / copyright                  # 4
→ artist (@)                          # 5
→ general appearance / pose / clothing / scene / lighting / composition  # 6
→ natural language paragraph          # 7
```
**权重使用指引（实测 2026-08-20 · 破精美/多样性）**：
1. **三类皆可加权**：artist `(@name:weight)`、普通 tag `(tag:weight)`、NL 语义块 `(a full sentence concept:weight)`，语义块加权对“全身覆盖 / 整体关系”最有效。
2. **单变量逐级**：固定其它 prompt，仅将目标 artist 或语义块从 `1.0→1.5→2.0→2.5→3.0` 扫一遍找临界点；不要同时塞 5 个 artist 或堆 `weird/ugly/bizarre` 同义词。
3. **抗美化组合**：`(@grotesque artist:1.5–2.5)` + 被压制的精美属性语义块 `(concept:2–2.5)`（如全身彩虹毛）比单侧加权稳。
4. **括号即权重**：含括号的角色/画师名必须转义 `\( \)`，否则被解析为权重；负面权重不建议用括号扣分，改用负面 prompt 显式排除。
5. **官方顺序**：`quality/meta → count → character → series → artist → general tags → NL`，artist 建议在主体定义后、外观前；有 `@` 时其影响权重高于同位置普通风格词。

**语义映射而非直译**（Tomiigo）：`セーラー服→serafuku` 非 `sailor uniform`；`パーカー→hoodie` 非 `parka`；`着物→kimono` / `浴衣→yukata` 不可合并；`夜の街→city, night` 需拆分；抽象俚语 `萌え/厨二病/激しい` 无对应 tag 时分解为可见特征或省略，不可自造 `moe/edgy`。

---

---
