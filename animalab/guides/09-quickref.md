# 09-quickref — PROMPT_GUIDE 分册

> 来源：`PROMPT_GUIDE.md` 对应节拆分，详见主入口。

## 10. 快速查表（Danbooru → Anima 写法）

| 类别 | Danbooru 写法 | Anima 写法 | 备注 |
|---|---|---|---|
| 发型 | `long_hair` | `long hair` | 去 `_` |
| 瞳色 | `blue_eyes` | `blue eyes` | 去 `_` |
| 评分 | `score_7` | `score_7` | 保留 `_` |
| 画师 | `wlop` (artist) | `@wlop` | 必须 `@` |
| 人数 | `1girl` / `2girls` | 同左 | 计数 tag |
| 无人 | — | `no humans` | 紧跟 quality 段后 |
| 角色 | `fern` | `fern, sousou no frieren` | 补 series |
| 年代 | `year_2025` | `year 2025` | 去 `_`（`year` 强影响） |
| 卫衣 | `parka` 误用 | `hoodie` | `パーカー→hoodie` |
| 水手服 | `sailor_uniform` | `serafuku` | 精确召回 |
| 和服/浴衣 | `kimono`/`yukata` 混用 | 分明 `kimono` vs `yukata` | 不可合并 |
| 夜街 | `night_city` | `city, night` | 拆分 |
| 括号 tag | `kiriko (overwatch)` | `kiriko \(overwatch\)` | 转义 |
| 画师括号 | `yd (orange maru)` | `@yd \(orange maru\)` | 转义 |
| 年龄 | `woman` | `mature female` | 计数不表年龄 |
| 多人 | `1girl and 2boys` | `1girl, 2boys` | 禁 `and` |

> 查不到时先用 Danbooru 原词（空格版），跑小批量验证后再固化。

---

---
