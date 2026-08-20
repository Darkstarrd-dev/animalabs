# 05-character — PROMPT_GUIDE 分册

> 来源：`PROMPT_GUIDE.md` 对应节拆分，详见主入口。

## 5. 角色指定（最关键）

> **三层控制**：Character identity → Visual identity → Style/rendering

### 5.1 单角色

```
1girl,
fern,
sousou no frieren,
long purple hair, purple eyes, long black coat, white dress, puffy sleeves,
standing, looking at viewer, full body
```

- **必须**：`角色 canonical tag + 作品/版权 tag`（例 `fern + sousou no frieren`，`hatsune miku + vocaloid`，`frieren + sousou no frieren`）。官方示例 `oomuro sakurako, yuru yuri` 同理。仅名字无作品易认错/泛化。
- **必须补外观**：即使模型认得角色，也重述关键视觉（发色/瞳色/服装），否则易偏离/融合。长 prompt 优于短 prompt（作者强调短 prompt 表现差）。
- **年龄承载**：计数 tag 不表年龄，年龄由 appearance 段的 `mature female / mature male / old woman / old man / child` 承载（Tomiigo）。
- **长度**：Anima 2.9B 提示“过短 prompt 表现差”，角色段不要只有名字。

> 实测建议：先不加 `@artist` 验证原作像，再按需加风格。

### 5.2 多角色（易串脸）

```
2girls,
frieren, sousou no frieren, long white hair, pointed ears, green eyes, white and black mage outfit,
fern, sousou no frieren, long purple hair, purple eyes, black coat, white dress,
standing side by side
...
Natural language:
Frieren stands on the left while Fern stands on the right. Frieren has white hair and pointed ears, while Fern has long purple hair and wears her black coat.
```

- 每个角色**独立展开** name+series+appearance；再用 NL 绑定左右/前后/看向。
- 计数段：混合性别必须逗号分隔，禁止 `and` — 好 `1girl, 2boys` 坏 `1girl and 2boys`；`2girls` 易串脸，必须每人独立外观 + NL 左右。
- Tomiigo 结构化管线：`[INTERACTION] COUNT_AND_RELATION` 仅放头数及**不指向个体的共互 tag**（如 `duo, holding hands, facing each other`）；指向个体的位置/交互一律进 `[NATURAL_LANGUAGE] CAPTION` 并用 `{CHAR_1}` 等占位符指代，禁用 `he/she/1boy` 裸指。

### 5.3 `@artist` 角色

- **语法**：`@wlop`, `@kantoku`, `@fkey`（非 `@watercolor`）；`@kawakami rokkaku` 非 `@kawakami_rokkaku`；多画师 ` @fkey, @jima` 但稳定性下降。
- **语义**：`@artist` 是画师身份锚点，其训练分布会带出风格；`watercolor / cel shading / thick paint / cinematic lighting` 才是通用风格 tag。
- **克制**：别一次 5–10 个画师（混合多分布易崩），1–2 个为限；括号画师如 `@yd \(orange maru\)` 需转义。
- **热门/稳定组合**（AnimaTool）：
  - 稳定：`@fkey, @jima`（色彩明亮）
  - 热门：`@wlop` 精致写实、 `@ciloranko` 明亮可爱、 `@ask_ \(askzy\)` 细腻唯美、 `@nardack` 柔和梦幻
  - 查找：[Anima Style Explorer](https://anima.mooshieblob.com/) 预览并复制显示的画师名；Danbooru 搜 `artist` 分类取首选 tag。
- **何时加**：
  - 要原作：`fern + sousou no frieren + 外观`（先不加 artist）
  - 要“该角色+某画师风格”：`fern, sousou no frieren, @wlop, ...`

---

---
