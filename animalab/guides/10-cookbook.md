# 10-cookbook — PROMPT_GUIDE 分册

> 来源：`PROMPT_GUIDE.md` 对应节拆分，详见主入口。

## 11. Cookbook（可增长词表骨架）

> 每行 = `tag / 写法 / Anima 强度 / 副作用 / 推荐组合 / 样图 job`。先搭骨架，随测随填。

### 11.1 人物与计数

| Tag | 强度 | 副作用 | 推荐组合 | 样图 |
|---|---|---|---|---|
| `1girl, solo` / `1boy, solo` / `2girls` / `no humans` | 强 | `2girls` 易串脸 | + 每角色独立外观 + NL 左右 | `example:1` |
| `original character` | 中 | 过拟合少 | + 外观自描述 |  |
| `mature female / mature male / old woman / old man / child` | 中 | 年龄漂移 | + 计数 tag 分离 |  |

### 11.2 发型/五官/表情

| Tag | 强度 | 副作用 | 推荐组合 | 样图 |
|---|---|---|---|---|
| `long hair / twintails / aqua hair / silver hair` | 强 | 发色易漂 | + `aqua eyes` 对齐 |  |
| `blue eyes / purple eyes / aqua eyes` | 中 | 瞳色漂移 | + 发色同系 |  |
| `smile / blush / looking at viewer / one eye closed` | 中 | 过度笑容 | + `portrait / half body` |  |
| `fang / skin fang / ;d` | 弱 | 表情过强 | + `smile` |  |

### 11.3 服装

| Tag | 强度 | 副作用 | 推荐组合 | 样图 |
|---|---|---|---|---|
| `school uniform / white dress / black coat / puffy sleeves / serafuku` | 强 | 服装串 | 多角色时分人写 | `example:3` |
| `hooded jacket / cat ears / kimono / yukata` | 中 | 兽耳过强 | + `casual outfit` / 负面 `anthro, furry` | `example:2` |

### 11.4 动作/手部

| Tag | 强度 | 副作用 | 推荐组合 | 样图 |
|---|---|---|---|---|
| `standing / sitting / holding umbrella / peace sign / holding bag` | 中 | 手部畸形 | + NL `holding ... in her right hand` + 负面 `bad hands, extra fingers` | `example:4` |

### 11.5 镜头/构图/视角

详见分册：**[guides/camera-angle.md](guides/camera-angle.md)** — 40 点矩阵与四轴拆分。

| Tag | 强度 | 副作用 | 推荐组合 | 样图 |
|---|---|---|---|---|
| `upper body / full body / portrait / close-up` | 中 | 裁切 | + 主体 1MP |  |
| `facing viewer / three-quarter view / profile / from behind / facing away` | 强 | 朝向混淆 | + 另三轴在 NL 中补左右/视线 |  |
| `eye-level / high angle / low angle / from above / top-down view / from below / low front angle` | 中 | 透视过强 | 同帧一主角度 |  |
| `left side / right side / centered` | 弱（需 NL） |  | + NL 明确主次 |  |

### 11.6 场景

| Tag | 强度 | 副作用 | 推荐组合 | 样图 |
|---|---|---|---|---|
| `rainy tokyo street / night / neon lights / wet pavement / classroom / forest / city` | 中 | 背景抢主体 | + `depth of field / bokeh` |  |
| `sunset / golden hour / mountain / lake / reflection / clouds` | 中 | 背景抢主体 | + `dramatic lighting` |  |

### 11.7 光线/特效

| Tag | 强度 | 副作用 | 推荐组合 | 样图 |
|---|---|---|---|---|
| `cinematic lighting / rim light / backlighting / sunset / backlight` | 中 | 过曝 | + `soft light` |  |
| `depth of field / bokeh / volumetric lighting` | 中 |  | + 场景 tag |  |

### 11.8 风格

| Tag | 强度 | 副作用 | 推荐组合 | 样图 |
|---|---|---|---|---|
| `anime illustration / clean lineart / watercolor / cel shading / anime background, scenic / thick paint` | 中 | 风格冲突 | 单一风格为先，artist 1–2 个 | `turbo-compare:2/4` |
| `@wlop / @fkey / @jima / @ciloranko / @ask_ \(askzy\) / @nardack / @kantoku` | 强（分布偏移） | 原作偏离 | 单角色+单 artist |  |
| `deviantart / ye-pop` | 弱（数据集锚） | 风格偏移 | 仅高级多样性需要 |  |

### 11.9 元数据

| Tag | 强度 | 副作用 | 推荐组合 | 样图 |
|---|---|---|---|---|
| `year 2025 / highres / absurdres / score_7 / newest / recent` | 强 | 时代感偏移 | 开头固定 |  |
| `safe / sensitive / nsfw / explicit` | 强 | 安全漂移 | 必选其一 |  |

### 11.10 多角色关系（必须用 NL）

| 场景 | NL 写法 | 样图 |
|---|---|---|
| 左右站位 | `Frieren stands on the left while Fern stands on the right.` |  |
| 看向 | `She looks toward the motorcycle on the right side of the frame.` |  |
| 遮挡 | `The girl in front partially obscures the crowd behind her.` |  |
| 共互（tag） | `duo, holding hands, facing each other, back-to-back` → 放 `[INTERACTION]` |  |
| 定向（NL+占位符） | `{CHAR_3} is on {CHAR_2}'s knees.` → 放 `CAPTION`，禁 `he/she` |  |

> **追加方式**：在对应表加一行，填 `强度/副作用/推荐组合`，并在 `export` 中验证 `kept` 率后固化。

---

---
