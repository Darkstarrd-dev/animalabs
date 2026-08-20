# Anima Prompt 指南与参考手册

> **定位**：Anima (anima_turboV10 / Base / Aesthetic / 2.9B) 的可验证 prompt 体系 + 社区参考获取路径 + 可增长 Cookbook。  
> **原则**：Tag 负责“画什么”(atomic visual concepts)，自然语言负责“怎么组织”(relationships / spatial logic)。混合优于纯 tag 或纯自然语言。  
> **版本**：v0.4 — 2026-08-20 / 目录式入口 + eye-back 实测 / 维护：随实测持续追加 Cookbook 条目与不良用例。  
> **入口**：`start.md` §8 引用本文；分册在 `guides/`；运行时 `anima.exe` 不依赖本文。

---

## 0. 如何使用本文（目录式）

- **读**：新人按索引点开分册；主文件仅保留索引与清单，不再塞长文。
- **查**：分册即单一真相源的小文件，按需只读一册。
- **增长**：新增 tag/角色/风格实测时，在对应分册追加，并在主文件 §13 登记。

## 0.5 指南分册索引

| 分册 | 主题 | 要点 |
|---|---|---|
| [01 模型理解](guides/01-model.md) | 为什么要混合 | 训练数据、版本分化、dropout |
| [02 语法规则](guides/02-grammar.md) | Grammar | `@artist`、大小写/空格/`score_`、转义、权重、顺序 |
| [03 质量与安全](guides/03-quality.md) | Quality/Safety/Negative | 按变体前缀、year/highres、安全四选一 |
| [04 Tag vs NL](guides/04-tag-vs-nl.md) | 分工 | 原子视觉 vs 空间关系、混合示例、位置规则 |
| [05 角色指定](guides/05-character.md) | Character | 单/多角色、`@artist`、Tomiigo 结构化 |
| [06 完整模板](guides/06-templates.md) | Templates | 可直接套用的段模板 |
| [07 常见坑](guides/07-pitfalls.md) | Pitfalls | 反模式与改法 |
| [08 变体与采样](guides/08-variant-sampler.md) | Variant/Sampler | Base/Aesthetic/Turbo/2.9B、采样器/调度器、分辨率与宽高比 |
| [09 快速查表](guides/09-quickref.md) | Quick Ref | Danbooru→Anima 写法 |
| [10 Cookbook](guides/10-cookbook.md) | 可增长词表 | 人物/光影/风格等强度与副作用 |
| [11 起手式](guides/11-starters.md) | Starters | 单/多角色/风景/Tomiigo |
| [摄影视角](guides/camera-angle.md) | Camera Angle | 8水平×5垂直 40 点、upper body、硬 anchors、NL 几何、四轴 |
| （预留） | 服装/光影/镜头调度 | 按需新建 `guides/<topic>.md` 并在此登记 |

---
## 9. 参考获取路径（长期维护）

### 9.1 第一优先（精读）

- **Anima-Prompt — Prompting Reference**：Anima 官方 grammar 总结（小写/空格/`@artist`/`score` 例外/转义/权重/推荐顺序/Base vs Aesthetic vs Turbo/混合 NL/采样器与分辨率）  
  https://github.com/Yu1Ko/Anima-Prompt/blob/main/references/anima-prompting.md

- **ComfyUI-AnimaTool — Prompt Guide**：按 `质量/人数/角色/作品/画师/风格/外观/核心 tags/环境` 拆解，含正/负例、画师推荐、宽高比、LoRA、常见问题、Reroll/批量  
  https://github.com/Moeblack/ComfyUI-AnimaTool/blob/main/wiki/Prompt-Guide.md

- **Tomiigo/anima-prompt-pipeline — system_prompt.txt**：日文场景→结构化 Anima tag 的抽取引擎，定义 `[INTERACTION]/[CHARACTER_n]/[SCENE_DETAILS]/[NATURAL_LANGUAGE]` 块与 COUNT/转义/语义映射细则  
  https://github.com/Tomiigo/anima-prompt-pipeline/blob/main/system_prompt.txt

### 9.2 词库（比教程更重要）

- **Comfyui-Anima-Prompt — Tag Database**：整理 21,580 tags（含 Character 10,484 / General 10,953 / Species 143），对接 Danbooru+e621 分类，105 个细分开关（`Visual & Composition 13 / Subject Appearance 10 / Living & Nature 3 / Scenes… 31 / Objects… 29 / Adult 19`），6 开关链式约束（每已连大类至少保留 1 标签，`min/max_tags` 8–24 默认/50 上限）  
  https://github.com/NaviVoid/Comfyui-Anima-Prompt

- **Danbooru / Gelbooru / e621**：Anima 主要 tag 词源，查 canonical 角色/作品/画师命名；优先 Gelbooru 拼写  
  https://danbooru.donmai.us/  
  https://gelbooru.com/  
  https://e621.net/

- **Anima Style Explorer**：可视化浏览数千画师风格并复制 `@artist` 名  
  https://anima.mooshieblob.com/

- **Tag 检索技巧**：在 Danbooru 搜角色名 → 看 `copyright / character / artist` 分类，取首选 tag（空格形式）回填 prompt 的 `name + series + @artist`。

### 9.3 官方与系统提示

- **Anima 官方 README（circlestone-labs/Anima）**：`@artist` 定义、tags+NL 混合训练、版本/采样器/分辨率/授权说明  
  https://huggingface.co/circlestone-labs/Anima

- **Finnsprite/Anima**：HF 镜像与 Turbo LoRA 预告，prompt 同官方（lowercase/space/`@`）  
  https://huggingface.co/Finnsprite/Anima

- **Anima 2.9B（Gazingstars123）**：28→40 层扩张、170 万增量训练、NO score、prompt 需详尽、采样/调度/分辨率推荐  
  https://huggingface.co/Gazingstars123/Anima-2.9B

- **Anima 2.9B LoRA/ComfyUI 官方集成帖**（Reddit）：角色须跟 series、year/highres 强影响、短 prompt 差、多角色需分外观、ComfyUI 0.33.1 集成  
  https://www.reddit.com/r/StableDiffusion/comments/1vo5skt/anima29b_lora_training_support_official_comfyui/

- **Anima Prompt Skill / Pipeline System Prompt**（Reddit 讨论帖与 Tomiigo 上述 `system_prompt.txt`）：Tags 管“有什么”，NL 管“怎么组织”  
  https://www.reddit.com/r/StableDiffusion/comments/1tsi95z/anima_prompt_skill_systempromt/

### 9.4 本地联动

- 本项目 `jobs/*.json` 的 `positive_prompt` 即实测语料，`export` 的 `stats/tags` 频次可反哺下一轮 prompt。
- `Anime_Turbo_api.json` 的 `60:19 KSampler` 为 9 维回落真源，别与 prompt 混淆；`sampler/scheduler/cfg` 未填时回落 `er_sde/simple/1.0`。

---

## 9.1 快速查表（已拆至 guides/09-quickref.md，此处留锚）

详见 [09-quickref](guides/09-quickref.md)

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

#### 11.8.1 诡异/破精美 artist 矩阵（实测 2026-08-20 · 多样性/抗精美 | 详 guides/10-cookbook.md §11.8.1）

| @artist | 视觉倾向 | 效果 | 注意 | 推荐度 | 权重起点 |
|---|---|---|---|---|---|
| `@q hayashida` | 粗糙/脏/怪/荒诞/粗线涂抹+怪物+不正常比例 | 脏粗荒诞漫画感，最能压精美 | 首选，保留搞笑感 | ⭐⭐⭐⭐⭐ | `(@q hayashida:2)` |
| `@hideshi hino` | 扭曲比例/病态童话/重黑白/怪脸 | 极端怪 | 易滑向恐怖非搞笑 | ⭐⭐⭐⭐⭐ | `(@hideshi hino:2)` |
| `@shintaro kago` | grotesque/absurd/变形/黑色幽默 | 荒诞变形神经质 | 避免再加 horror/gore | ⭐⭐⭐⭐⭐ | `(@shintaro kago:1.8)` |
| `@james ensor` | 面具/骷髅/怪人/狂欢荒诞 | 狂欢怪人荒诞 | 可能“疯狂彩虹狂欢猫” | ⭐⭐⭐⭐⭐ | `(@james ensor:1.8)` |
| `@francis bacon` | 扭曲形体+丑陋肉感+畸形 | 变形肉感丑陋 | 非恐怖而是 fleshy 畸变 | ⭐⭐⭐⭐ | `(@francis bacon:2)` |
| `@george grosz` | caricature/丑脸/夸张/讽刺 | 漫画化丑陋讽刺 | 比二次元更能压美型 | ⭐⭐⭐⭐ | `(@george grosz:2)` |
| `@otto dix` | 畸形脸/老人/怪形象 | 老人怪脸畸形特化“老” | 拉暗沧桑，rainbow 后置加权 | ⭐⭐⭐⭐ | `(@otto dix:2)` |
| `@hieronymus bosch` | 荒诞生物/不合理拼合/梦境怪物 | 怪物异形梦境 | 最极端易过 wild | ⭐⭐⭐⭐ | `(@hieronymus bosch:1.5)` |
| `@junji ito` | uncanny/disturbing/abnormal | 不安恐怖异常 | 易变恐怖猫，A/B 用 | ⭐⭐⭐ | `(@junji ito:1.5)` |
| `@suehiro maruo` | 复古诡异/颓废/马戏畸形 | 复古黑暗怪美 | 易暗，需补 rainbow 权重 | ⭐⭐⭐ | `(@suehiro maruo:1.5)` |
| `@francisco goya` | 老/疲惫/阴郁荒诞 | 阴暗衰老怪诞 | 压暗，rainbow 放 artist 后 | ⭐⭐⭐ | `(@francisco goya:1.5)` |

> **破精美协议**：单 artist 逐级 `1.0→1.5→2.0→2.5→3.0` 隔离测临界点；禁 5 artist 混塞（至多 `@a, (@b:weight)`）；语义块加权优于堆同义词如 `(entire body covered in vivid rainbow-colored fur:2.5)`；Turbo→Base 切档正交叠加（同权重 Base 更易畸变）；顺序 `quality/meta→count→character→series→@artist→外观`；先攻 `@q hayashida / @james ensor / @francis bacon`。训练含 Danbooru artist + LAION-POP/DeviantArt，`@` 缺省近无效，权重需 2–3。详 `guides/02-grammar.md` 权重三类与 `01-model/08-variant-sampler` 多样性结论。
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

## 12. 推荐起手式（复制即用）

### 12.1 通用单角色

```
masterpiece, best quality, highres, newest, year 2025, safe,
1girl, solo,
original character,
anime illustration, clean lineart,
long silver hair, blue eyes, pale skin, black dress, white gloves,
standing, holding a transparent umbrella, looking at viewer,
full body, three-quarter view,
rainy tokyo street, night, neon signs, wet pavement, reflections,
cinematic lighting, rim light, depth of field.
A silver-haired girl stands beneath a transparent umbrella in the center of a rainy Tokyo street. Neon signs glow behind her and their reflections extend across the wet pavement in the foreground.
```

Negative：
```
worst quality, low quality, blurry, jpeg artifacts, bad anatomy, bad hands, extra fingers, text, watermark
```
Turbo 建议负面追加 `score_1, score_2, score_3, chromatic aberration`；Aesthetic 可省 `score_*`。

### 12.2 指定角色（以 Fern 为例）

```
masterpiece, best quality, safe,
1girl, solo,
fern, sousou no frieren,
long purple hair, purple eyes, long black coat, white dress, puffy sleeves,
standing, looking at viewer, full body,
forest, sunlight, soft lighting
```

要 `@wlop` 风格则在 `fern, sousou no frieren,` 后插入 `@wlop,`。

### 12.3 多角色防串脸

```
2girls,
frieren, sousou no frieren, long white hair, pointed ears, green eyes, white and black mage outfit,
fern, sousou no frieren, long purple hair, purple eyes, black coat, white dress,
standing side by side, looking at viewer
Frieren stands on the left while Fern stands on the right. Frieren has white hair and pointed ears, Fern has long purple hair and wears a black coat.
```

### 12.4 无人物风景

```
masterpiece, best quality, highres, newest, year 2025, safe,
no humans,
anime background, scenic,
landscape, mountain, lake, reflection, clouds,
sunset, golden hour, dramatic lighting
```

Negative：
```
worst quality, low quality, blurry, text, watermark
```

### 12.5 Tomiigo 结构化管线（复杂多角色，LLM 友好）

```
[INTERACTION]
- COUNT_AND_RELATION: 2girls, duo, holding hands
[CHARACTER_1]
- BASE: frieren, sousou no frieren
- APPEARANCE: long white hair, pointed ears, green eyes
- EXPRESSION: smile
- OUTFIT: white and black mage outfit
- POSE: standing, arms up
[CHARACTER_2]
- BASE: fern, sousou no frieren
- APPEARANCE: long purple hair, purple eyes
- EXPRESSION: smile
- OUTFIT: black coat, white dress, puffy sleeves
- POSE: standing
[SCENE_DETAILS]
- CAMERA: full body, three-quarter view
- BACKGROUND: forest, sunlight
- LIGHTING_AND_EFFECTS: soft lighting, cinematic lighting
[NATURAL_LANGUAGE]
- CAPTION: {CHAR_1} stands on the left while {CHAR_2} stands on the right.
```
最终拼为单行 `tags, tags. Caption.` 形式投喂 `60:11`。

---

## 13. 实测记录与 Changelog（追加处）

| 日期 | 测试项 | Prompt 要点 | 结果/结论 | Job |
|---|---|---|---|---|
| 2026-08-20 | width 对齐 | `width 100→104 (8x)` + warnings | 走通，`104×104` 落盘 | `example:4` |
| 2026-08-20 | sampler 对比 | `er_sde/simple/cfg1` vs `euler/normal/cfg2` vs `dpmpp_2m/karras/cfg1.5` | `euler/cfg2` 更锐，待补图 | `turbo-compare` |
| 2026-08-20 | eye-back 景别 (frieren/fern 768×1024) | 5种构图×2角色 eye-back，fern cowboy 长袍无解、bust/head 需直视背面约束 | 头像/胸像加 `back of head, eyes not visible` 后修正面；cowboy 站立需 `(standing:1.5)` 仍有蹲，长袍判定无解 | `frieren-fern-eye-back-v4` |
| 2026-08-20 | 指南 v0.2 扩充 | 遍历 9 源：Anima-Prompt/AnimaTool/Comfyui-Anima-Prompt/circlestone/README/Finnsprite/2.9B/Tomiigo pipeline/Style Explorer/Danbooru | 补变体表/转义/权重/安全必选/单行/语义映射/采样调度/分辨率/宽高比/数据集标签/组织层 | — |
| 2026-08-20 | 双预设 + Header 模型控件 | `turbo`（`anima_turboV10`）与 `base`（由 `anima_good` UI workflow 转 API，`anima-preview3-base` + 可选 `anima-turbo-lora-v0.2` 链）；Header 增 `预设/UNET/Lora1-3` + `/api/presets·/api/meta`；CLI `--preset/--unet/--loras` | 端到端走通（`serve` + `POST /api/run` body 注入；`off` 过滤、weight `±10` clamp、≤3 链）；详 `start.md §2/§7` | `hdr-e2e*` 已验证后清理 |
| 2026-08-20 | 高过头顶正后俯视矩阵 | `frieren/fern` × `head/bust/half/full` × `high30°/steep45°/top60°` 24项（768×1024），`cowboy` 已剔；`fern-bust` 高俯 bust 穿透穿模另起修复 | 初跑：frieren 12/12 成；fern bust 3项中 2项翻面（裙胸跳到背侧 / 顶视大胸），已就地 patch 后通过 | `high-overhead-behind` |
| 2026-08-20 | fern bust 高俯防翻面 | bust 由 `chest up` 改 `upper back / back of shoulders / coat back view / shoulder blades / spine line / upper back fabric, chest not visible`，NL 重定向到背部；负面追加 `large/huge breasts, breasts visible, cleavage, chest front, front of dress, top view of chest` | patch 仅对 `fern-bust-{high30,steep45,top60}` 现场替换，dry-run 无 warn，待二跑复验 | `high-overhead-behind:fern-bust-*` |
| 2026-08-20 | Header 布局崩 + 下拉白字 | topbar 56px→min-height+wrap，hdr-presets 改 flex:1 1 520px，#selUnet 横控改 CSS 宽；select/option 背景从半透明改为 `var(--panel)` 深底白字 | 本地重绘不溢出，`go vet / build.ps1 → 6.9MB` | — |
| 2026-08-20 | Header 分组重跑 + base 可用化 | `base` 缺文件对齐到 `fnMixAnimaTurbo_baseNoTurbo`；`fetchHdrMeta` 初始化链修复；`handleRun/post` 支持 `group/subgroup/items` 入参并自动 force，重跑仅替分组；暴露 `GET /api/presets·/api/meta` | `verify-turbo/base/base-lora` 与 `rerun-group-test2` 全 `done`（分组替前后 sha 对比） | — |
| 2026-08-20 | Header 二行重构 + 下拉深色 + 采样覆盖 | 顶栏 `min-height→column(主/控两行)`，`option{background:var(--panel)}`；新增 `Steps/CFG/Batch/Sampler/Scheduler` 二排 Header，二排 `GET /api/meta.samplers/schedulers` 44/9 种，`reflectHdrFromJob` 计划↔Header 联动，`hdrUserEdited` 避覆 | `go vet/appcheck/build 6.9MB init` | — |
| 2026-08-20 | 缩略图保持比例 + batch 吞吐开关 | `card-media img{width/height:100%;object-fit:contain}` 字母箱不裁；新增 `batch(60:28 batch_size)` Header 可选覆盖，`Submit/Images batch` + `siblings _02..` 单项批落 `N` 张；50 项实测单↔批 `4×单 18.4s vs batch4 4.7s(3.95×)`，512×512 `batch2 1.75s/张 / batch4 0.98s/张 / batch8 0.69s/张` | `verify-real-batch batch4 → b1(_02.._04).png` 4 档落盘，`dry-run --batch 4` 行可见 `batch=4` | — |
| 2026-08-20 | 多样性-破精美：artist/语义块加权 + 切 Base | 结论：`(@artist:weight)` + 重点形容词/语义块 `(concept:weight)` 加权，配合从高度美化的 Turbo/Aesthetic 切官方更泛用的 Base，可显著提升多样性、压制 Anima 默认“精致/漂亮/干净”审美；artist 需 `@` 在括号内如 `(@q hayashida:2)`，普通 tag/自然语言块同理 `(rainbow fur:2.5)` / `(entire body covered in rainbow fur:2.5)`；Qwen 编码器权重非线性，需比 SDXL 更高：`1.1≈无感 / 1.3仍弱 / 1.5起效 / 2.0明显 / 2-3为常用区间`，过高崩坏；单 artist 逐级 `1.0→1.5→2.0→2.5→3.0` 隔离测试优于混 5 个 artist 或堆 ugly/weird 同义词 | grotesque 候选见 §11.8/cookbook 矩阵（Q Hayashida / Hideshi Hino / Shintaro Kago / James Ensor / Francis Bacon 等）；rainbow 全身覆盖以语义块加权比堆同义词有效 | — |
| 2026-08-21 | Gallery: batch N 独立卡·运行启停·未审核展示修复 | batch: `Output.BatchOutputs` 落 `_02..N` 兄弟档，`GET /api/job` 聚合展示为 N 张独立 1:1 缩略卡（`__b2..N` 展开），卡/灯箱/抽屉均为单图，Header Batch 1-8 通用输入，`remaining-angles-full` 22×4×2 defaults.batch=4 随机 seed；运行：`/api/run/{pause,resume,stop,status}` + serverRunning 真实态驱动按钮，`●新` 跟最新 done，卡片圆角/留空与灯箱 94vh/360px 右栏；分组焦点自动 `scrollIntoView(nearest)` | 同上 584(=96原×4批近似中2×4) 已验证，卡/灯箱/抽屉可用，ESC/1/2 与 Numpad Add/Sub 批量保留/驳回可用 | — |
| 2026-08-21 | Gallery: 交互收尾 (scroll/快捷键/标注静默) | 运行接管: 上下方向键语义由 `Ctrl+↑/↓` 一级分组 /`Alt+↑/↓` 子分组 取代（全屏亦统一）；`F` 全局切灯箱；全屏 `Numpad +/-` 单张 `kept/rejected` 静默不弹抽屉，非全屏 `Numpad +/-` 批量保留/驳回当前一级分组全项；标注批前台 `__b→orig` 映射修复 `item_id required` 偶发；批次校验 `__b` 二次改标可连续；抽屉 `_displayUrl` 不再 `urls is not defined` | 非全屏 Ctrl/Alt 切组 + 全屏同逻辑 + F 切换 + 小键盘标注均验证 | — |

> 新增时请贴 `job: id` 与 `export` 的 `kept/rejected + tags` 分布，以便下一轮复用。

---

## 14. 参考文献（固定）

- Yu1Ko/Anima-Prompt — `references/anima-prompting.md` — Anima grammar、顺序、大小写/`@`/`score`/转义/权重、Base/Aesthetic/Turbo、NL 混合、采样与分辨率  
  https://github.com/Yu1Ko/Anima-Prompt/blob/main/references/anima-prompting.md
- Moeblack/ComfyUI-AnimaTool — `wiki/Prompt-Guide.md` — 质量/人数/角色/作品/画师/风格/外观/核心/环境的实用拆解、正/负例、画师推荐、宽高比、LoRA、常见问题、Reroll/批量  
  https://github.com/Moeblack/ComfyUI-AnimaTool/blob/main/wiki/Prompt-Guide.md
- NaviVoid/Comfyui-Anima-Prompt — 21,580 tags 数据库（Character 10,484 / General 10,953 / Species 143），105 开关分类  
  https://github.com/NaviVoid/Comfyui-Anima-Prompt
- circlestone-labs/Anima — 官方 README（`@artist`、tags+NL 混合、训练说明、版本/采样/分辨率/授权）  
  https://huggingface.co/circlestone-labs/Anima
- Finnsprite/Anima — HF 镜像（prompt 同官方）  
  https://huggingface.co/Finnsprite/Anima
- Gazingstars123/Anima-2.9B — 28→40 层 2.9B 扩张、170 万增量、NO score、采样/调度/分辨率推荐  
  https://huggingface.co/Gazingstars123/Anima-2.9B
- Tomiigo/anima-prompt-pipeline `system_prompt.txt` — tags 管“有什么”、NL 管“怎么组织”，`[INTERACTION]/[CHARACTER_n]/[SCENE]/[CAPTION]` 与 COUNT/转义/语义映射  
  https://github.com/Tomiigo/anima-prompt-pipeline/blob/main/system_prompt.txt
- Anima Style Explorer — 数千画师可视化与 `@artist` 复制  
  https://anima.mooshieblob.com/
- Danbooru / Gelbooru / e621 — Anima 主要 tag 词源，查 `character / copyright / artist` canonical  
  https://danbooru.donmai.us/  
  https://gelbooru.com/  
  https://e621.net/
- Anima Prompt Skill / Pipeline System Prompt（Reddit 讨论）  
  https://www.reddit.com/r/StableDiffusion/comments/1tsi95z/anima_prompt_skill_systempromt/
- Anima 2.9B LoRA/ComfyUI 官方集成帖（Reddit）  
  https://www.reddit.com/r/StableDiffusion/comments/1vo5skt/anima29b_lora_training_support_official_comfyui/

> 社区词库用法：Danbooru/Gelbooru/e621 → 取 `character / copyright / artist` 标准 tag → 换空格小写 → 回填 prompt。

---

## 15. 维护建议

- 本文件为 **单一真相源** 的 prompt 层，新增验证优先改此处而非零散笔记。
- 每新增 5–10 条实测后，提炼一次“高频可用组合”（如 `long hair + blue eyes + school uniform` 的 Anima 响应强度）反哺 `jobs` 生成器。
- 若发现新的官方/社区高质量指南，在 §9 追加链接并在 §13 记一条“参考更新”。
- 词库侧：`Comfyui-Anima-Prompt` 的 CSV 校验规则（UTF-8/列集合/行级 NUL/重复/非法 category/post_count/不连续 classification）可作为自建 tag 库的入库门槛。