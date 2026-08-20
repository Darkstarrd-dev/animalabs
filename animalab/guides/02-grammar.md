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
| 权重 | `(chibi:2)` | `(chibi:1.1)` | 如需加权，需高于 SDXL 常用权重 |
| 拼写 | Gelbooru 版 | Danbooru 版 | 两者不一致时优先 Gelbooru 拼写 |
| 计数 | `1girl, solo` / `2girls` / `no humans` | `woman` / `person` | 计数 tag 仅表数量+性别，年龄由 `mature female` 等 tag 承载（Tomiigo 规则） |

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

随机 tag dropout 已用于训练，**完整性非目标**，去冗余优于堆砌。

**语义映射而非直译**（Tomiigo）：`セーラー服→serafuku` 非 `sailor uniform`；`パーカー→hoodie` 非 `parka`；`着物→kimono` / `浴衣→yukata` 不可合并；`夜の街→city, night` 需拆分；抽象俚语 `萌え/厨二病/激しい` 无对应 tag 时分解为可见特征或省略，不可自造 `moe/edgy`。

---

---
