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

| `anime illustration / clean lineart / watercolor / cel shading / anime background, scenic / thick paint` | 中 | 风格冲突 | 单一风格为先，artist 1–2 个 | `turbo-compare:2/4` |
| `@wlop / @fkey / @jima / @ciloranko / @ask_ \(askzy\) / @nardack / @kantoku` | 强（分布偏移） | 原作偏离 | 单角色+单 artist |  |
| `deviantart / ye-pop` | 弱（数据集锚） | 风格偏移 | 仅高级多样性需要 |  |

#### 11.8.1 诡异/破精美 artist 矩阵（实测 2026-08-20 · 多样性/抗精美） — 训练含 Danbooru artist + LAION-POP/DeviantArt，`@` 缺省几乎无效，权重需比 SDXL 高

| @artist | 视觉倾向 | 可能效果 | 副作用/注意 | 推荐度 | 权重起点 | 示例 prompt 骨架 |
|---|---|---|---|---|---|---|
| `@q hayashida` | 粗糙/脏/怪/随意/荒诞/粗线+涂抹+杂色+怪物+不正常比例 | 脏、粗、荒诞、漫画感，最能压“精致干净” | 偏漫画怪物但保留搞笑感，适合 rainbow 醉猫首选 | ⭐⭐⭐⭐⭐ | `(@q hayashida:2)` | `(@q hayashida:2), cat, old cat, elderly, short stout stocky, drunk sleepy lazy, (completely rainbow-colored fur:2.5), (entire coat rainbow-colored:2), rough fur, messy fur, bizarre proportions` |
| `@hideshi hino` | 扭曲比例/怪诞角色/病态童话/重黑白/怪脸 | 极端“怪” | 易滑向恐怖/怪物而非搞笑醉猫，需控负面 | ⭐⭐⭐⭐⭐ | `(@hideshi hino:2)` | `(@hideshi hino:2), old rainbow cat, drunk sleepy lethargic, (full rainbow coat:2.2), bizarre proportions, strange expression, rough drawing, grotesque character` |
| `@shintaro kago` | grotesque/absurd/身体变形/黑色幽默/神经质 | 荒诞、变形、神经质 | 方向极端，避免再加 horror/gore，让 artist 自身拉歪 | ⭐⭐⭐⭐⭐ | `(@shintaro kago:1.8)` | `(@shintaro kago:1.8), old rainbow cat, drunk sleepy stout, (completely rainbow-colored fur:2.2), absurd proportions, bizarre character design` |
| `@james ensor` | 面具/骷髅/怪人/狂欢/荒诞人物 | 狂欢、怪人、荒诞，契合“醉+老+懒+彩虹” | 可能出“疯狂彩虹狂欢节猫”，多样性高 | ⭐⭐⭐⭐⭐ | `(@james ensor:1.8)` | `(@james ensor:1.8), old rainbow cat, drunk sleepy lazy stout, (completely rainbow-colored fur:2.2), strange face, bizarre expression, absurd character` |
| `@francis bacon` | 扭曲人/动物形体+丑陋肉感+畸形+不安表情 | 变形、肉感、丑陋，压漂亮脸 | 非恐怖而是丑陋 fleshy 畸变，契合老胖醉懒 | ⭐⭐⭐⭐ | `(@francis bacon:2)` | `(@francis bacon:2), old fat drunk lazy rainbow cat, (entire body rainbow fur:2.3), distorted form, malformed shape` |
| `@george grosz` | caricature/丑脸/夸张身/讽刺/畸变解剖 | 漫画化、丑陋、讽刺 | 比二次元画师更适合压二次元美型 | ⭐⭐⭐⭐ | `(@george grosz:2)` | `(@george grosz:2), old rainbow cat, caricature, ugly face, exaggerated body, distorted anatomy` |
| `@otto dix` | 畸形脸/老人/怪形象/硬 caricature | 老人、怪脸、畸形，特化“老” | 会拉暗/沧桑，需后置强调 rainbow | ⭐⭐⭐⭐ | `(@otto dix:2)` | `(@otto dix:2), old rainbow cat, elderly stout, (completely rainbow-colored fur:2.3), distorted old face` |
| `@hieronymus bosch` | 荒诞生物/不合理拼合/怪比例/梦境怪物 | 怪物、异形、梦境 | 最极端，“不该存在的猫”，易过 wild | ⭐⭐⭐⭐ | `(@hieronymus bosch:1.5)` | `(@hieronymus bosch:1.5), old rainbow cat, bizarre creature, absurd body combination, strange proportions` |
| `@junji ito` | uncanny/disturbing/abnormal，强不安感 | 不安、恐怖、异常 | 易变恐怖猫，非首选，作 A/B | ⭐⭐⭐ | `(@junji ito:1.5)` | `(@junji ito:1.5), old rainbow cat, drunk sleepy lethargic, (completely rainbow-colored fur:2), droopy eyes, bizarre expression` |
| `@suehiro maruo` | 复古诡异/颓废/超现实/马戏畸形/异常比例 | 复古黑暗怪美 | 易拉向复古暗色，需补 rainbow 权重 | ⭐⭐⭐ | `(@suehiro maruo:1.5)` | `(@suehiro maruo:1.5), old rainbow cat, grotesque decadent circus freak, (completely rainbow-colored fur:2.3)` |
| `@francisco goya` | 老/疲惫/怪异/阴郁/荒诞 | 阴暗、衰老、怪诞 | 明显压暗色调，rainbow 放 artist 后并加权 | ⭐⭐⭐ | `(@francisco goya:1.5)` | `(@francisco goya:1.5), old tired rainbow cat, (completely rainbow-colored fur:2.3), strange gloomy expression` |

> **破精美协议（必读）**：
> 1. 单 artist 隔离：`(@one artist:1.0)→1.5→2.0→2.5→3.0` 只换 artist/权重，其余 prompt 一字不动，找临界点；
> 2. 禁 5 artist 混塞：社区反馈多 artist 易漂，至多 `@a, (@b:weight)` 双 artist，且分别控重；
> 3. 语义块加权优于堆词：`(entire body covered in vivid rainbow-colored fur:2.5)` + `(the entire coat is continuous spectrum red orange yellow green cyan blue violet:2)` + `(no normal-colored fur anywhere:1.5)` 比 `rainbow, multicolored, colorful`×10 有效，Qwen 视角是“强调关系”而非“倍数”；
> 4. Turbo→Base 切档：同样权重在 Base 上更易出粗糙/畸变，Turbo/Aesthetic 上需 2–3 才明显；要多样性就切 `preset base`（`Anima_base_api.json → anima-preview3-base.safetensors`，可选叠 `anima-turbo-lora-v0.2`），详 `01-model / 08-variant-sampler`；
> 5. 顺序：`quality/meta → count → character → series → @artist → 外观/pose/场景/光`，artist 在主体后外观前最稳；
> 6. 先攻三剑客：`@q hayashida` / `@james ensor` / `@francis bacon`。

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

### 11.11 eye-back 景别 (实测 2026-08-20 · frieren/fern)

| 景别 | frieren eye-back | fern eye-back | 要点 | Job |
|---|---|---|---|---|
| 头像 head (close-up) | ✅ 正背稳定 | ✅ v3 后为正背（需 `back of head, eyes not visible`） | 头像易翻正面，需强 `direct back view` | `frieren-fern-eye-back-v3` |
| 胸像 bust | ✅ | ✅ v4 后为正背（v3 曾全正面） | 同头像，增加 `back of shoulders` | `v4` |
| 半身 half | ✅ | ✅ | 最稳，无需加权 | `v1` |
| 3/4 cowboy | frieren 稳仅 1-2 侧蹲；fern 5/5 蹲 | 同 frieren，fern 长袍加重 | 长袍需 `long dress while standing` + `(standing:1.5)`，仍无解 | `v2~v4` 无解 |
| 全身 full | ✅ | ✅ | `feet visible` 隐含站立 | `v1` |

| 维度 | 结论 |
|---|---|
| eye-back 锚定 | `eye-level, from behind, facing away, direct back view` 稳 |
| 侧偏 | 单用 `three-quarter view` 在后机位会飘，必成对 |
| 站立 | cowboy 无 `standing` 时回落抱膝坐，需显式并加权 |
| 种族/服装差异 | 同 prompt 下 fern 比 frieren 更易偏侧/蹲，长袍加重 |

> 头/胸/半身/全身可用作正背面基座；**fern 的 cowboy 判为无解**（数据召回限制），后续避免该组合。


---
