# 摄影视角（Camera Angle）— Anima 通用词典

> 定位：**角度是离散 anchors，不是连续度数**。Anima 训练见过高频 tag + 自然语言 caption，稳定做法是：**tags 定离散机位，NL 定左右/强度/朝向**。对齐附件「8水平×5垂直 40 点」与 PROMPT_GUIDE §5/§6/§7 语法。

## 1 坐标系（固定 1人 upper body，相机环绕）

```
       垂直：TOP → high angle → eye level → low angle → BOTTOM
       水平：0°正→45°前侧 3/4→90°正侧→135°后侧3/4→180°正后→225°后侧→270°另一侧→315°前侧
```
三轴务必分离：**机位（camera position）≠ 身体朝向（facing away/toward）≠ 视线（looking at viewer/away）≠ 头朝向**。冲突镜头（from above+from below、close-up+full body）一帧只能取一。

## 2 半身像基准

用 `upper body` 而非 `medium shot`；基座固定 `1girl, solo, upper body` 再只改 `<CAMERA>`。

## 3 水平 8 Canonical（最稳）

| 水平 | 含义 | 推荐 tags |
|---:|---|---|
|0°|正|`facing viewer`|
|45°|前侧 3/4|`three-quarter view` （+ NL 左右）|
|90°|正侧|`profile` / `from side`|
|135°|后侧 3/4|`from behind, three-quarter view`|
|180°|正后|`from behind` / `facing away`|
|225°|后侧另一边|`from behind, three-quarter view` （+ NL）|
|270°|另一侧|`profile` / `from side` （+ NL 左右）|
|315°|前侧另一边|`three-quarter view` （+ NL）|

要点：`three-quarter view` 是机位在正前偏左/右；`looking at viewer` 是视线看镜头，二者独立，`three-quarter view, looking at viewer` = 3/4 脸+眼看镜头。左右脸不靠 `left three-quarter` tag，靠 `The camera is positioned to her left/right` 明确。

## 4 垂直 5 档（日常 3 档足够）

| 垂直 | 含义 | 推荐 tags / NL |
|---|---|---|
|eye level|平视|`eye-level` / `eye-level camera`|
|high +30°|微俯|`high angle` + NL `above her, looking downward`|
|top +60°|顶俯|`from above` / `top-down view` （极端透视，半身慎用）|
|low -30°|微仰|`low angle` + NL `below eye level, looking upward`|
|extreme low -60°|极仰|`from below` / `low front angle`|

## 5 8×5 = 40 矩阵（可直接复制 CAMERA）

水平见 §3，垂直见 §4，二者正交组合即 40 点。最小用例只改 `<CAMERA>`：

| 目的 | CAMERA |
|---|---|
|正平|`facing viewer, eye-level`|
|3/4 平|`three-quarter view, eye-level`|
|侧平|`profile, eye-level`|
|后侧 3/4 平|`from behind, three-quarter view, eye-level`|
|正后平|`from behind, facing away, eye-level`|
|后回头|`from behind, looking at viewer, eye-level`|
|俯 3/4|`three-quarter view, high angle`|
|仰 3/4|`three-quarter view, low angle`|

## 6 分段 prompt 模板（tags 管有什么，NL 管几何）

`tags = 离散 anchor`，`NL = 精确几何`，同一帧只给一主镜头：

```
[QUALITY] masterpiece, best quality, highres, newest, year 2025, safe
[COUNT] 1girl, solo, upper body
[CHARACTER] frieren, sousou no frieren, long white hair, pointed ears, green eyes
[CAMERA tags] three-quarter view, eye-level
[LIGHT] soft lighting, white background, simple background
[NL] The camera is positioned slightly to her left and above eye level, looking downward toward her face. She turns her head toward the camera.
```
负面示例（不要）：`three-quarter view, from side, profile, high angle, from above, looking at viewer, looking away` 同时出现。

## 7 可验证的硬 anchors（高频）

`upper body / profile / three-quarter view / from behind / facing away / high angle / low angle / eye-level / looking at viewer` 为 Booru 高频，优先用；左右、强度、朝向交给 NL。

## 8 左右与朝向的四轴拆分

- 机位：`The camera is positioned to her left/right/behind`
- 身体朝向：`facing away/toward the camera`
- 头/视线：`looking at viewer / looking away / turns head back`
- 角度强度：`moderately high/low, directly above/below`

> 下一步：按此 40 点逐一整理可复制 prompt，区分 脸朝向/身体朝向/机位/视线 四轴。


## 9 实测 (2026-08-20 · eye-back @ 768×1024 Turbo)

- frieren: 5 种景别 4/5 正常，仅 cowboy 1–2 张侧蹲；fern: cowboy 5/5 蹲 + head/bust 曾正面，v3/v4 后 head 已正背、bust 在 v4 后已正背。
- 结论：`eye-level, from behind, facing away` 在 head/bust/half/full 稳定；**fern 的 cowboy 长袍 + eye-back 判无解**，避免使用。

详见 Jobs: `frieren-fern-eye-back-framings` → `frieren-fern-eye-back-v4`。

