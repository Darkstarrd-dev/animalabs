# 07-pitfalls — PROMPT_GUIDE 分册

> 来源：`PROMPT_GUIDE.md` 对应节拆分，详见主入口。

## 7. 常见坑与反模式

| 坑 | 现象 | 改法 |
|---|---|---|
| `long_hair` 带 `_` | 响应弱 | `long hair`（仅 `score_*` 保留 `_`） |
| 裸 `wlop` 无 `@` | 风格几乎不生效 | `@wlop` |
| 多画师堆砌 5–10 个 | 色彩/线条打架 | 1–2 个 artist 为限 |
| 仅角色名无作品 | 认错/泛化 | `name + series` |
| 仅名字无外观 | 发色/服装漂移 | 补 `appearance` |
| 纯 NL 长描述无 tags | 细粒度失控 | 前置 tags 再跟 NL |
| 多角色不分外观 | 串脸 | 每角色独立外观+NL 左右绑定 |
| 忽略 `year/highres` | 画质/时代感偏差 | 保留 `year 2025/highres` |
| 缺安全标签 | 易出不期望内容 | 必写 `safe/sensitive/nsfw/explicit` 其一 |
| 提示词分行 | 效果下降 | 单行逗号连接 |
| `woman/man/person` | 计数失效 | 用 `1girl/1boy/1other/no humans` |
| `and` 连计数 | 解析错误 | `1girl, 2boys` 非 `1girl and 2boys` |
| `parka` 当卫衣 | 服装错 | `パーカー→hoodie`，`parka` 是另一种外套 |
| `sailor uniform` 当水手服 | 召回差 | `セーラー服→serafuku` |
| `kimono`/`yukata` 混用 | 服装错 | 二者分明，不可合并 |
| `夜の街→night city` | 无此 tag | 拆 `city, night` |
| 括号未转义 | 被判权重/解析错 | `kiriko \(overwatch\)` / `@yd \(orange maru\)` |
| `anthro` 未屏蔽 | 兽耳变异 | 负面加 `anthro, furry` |
| 裸 `artist name` 占位未删 | 负面残留 | 替换为具体画师或删 |
| `beta57` 等调度器未装节点 | 无效 | 安装 RES4LYF custom nodes |
| `cowboy shot + fern 长袍 + eye-back` 时 `standing` 被压制为蹲姿 | fern cowboy 5/5 蹲 | 追加 `(standing:1.4~1.5), upright, straight legs, feet on ground` + 负面 `sitting, squatting, kneeling, crouching` + 长袍需说明 `long dress draping while standing` | `frieren-fern-eye-back-v2~v4` 提示 robe 易触发抱膝 |
| `head / bust + from behind` 在 fern 上误召正面 | fern 头像 bust 全正面 | 加 `back of head, nape, eyes not visible, not front view, direct back view` + 负面 `front view, facing viewer, face visible` | `v3~v4 fern-head/bust` 已修正面 |
| `three-quarter view` 误配后机位导致侧偏 | 后 45° 漂移到侧面 | 后机位必须 `from behind, three-quarter view` 成对，勿单用 `three-quarter view` | `camera-angle §3` |
| 多视图同值种子仅测抖动 | 组内 5 seed 同 prompt 误判好坏 | 组内选优无意义，跨 `subgroup/角度` 对比才有意义；做 prompt 对比时每组 1 seed 即可 | `frieren-halfbody-angles` 75→375 |

---
