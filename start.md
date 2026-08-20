# Anima — 文生图入口文档

> **用途**：本文件是 `Anima` 目录下 Anima 文生图模型 API 控制的唯一入口，可在任意电脑独立使用。
> **预设**：`turbo`（`Anime_Turbo_api.json`，`anima_turboV10.safetensors` UNET，默认）与 `base`（`Anima_base_api.json`，由 `anima_good` UI workflow 转换：`anima-preview3-base.safetensors` UNET + 可选 `anima-turbo-lora-v0.2` LoRA 链）。
> **CLIP/VAE 共用**：`qwen_3_06b_base.safetensors` (CLIP) + `qwen_image_vae.safetensors` (VAE)
> **验证**：ComfyUI 0.33.0 / Python 3.13.12 / RTX 5090D / `127.0.0.1:8188` 实测通过（2026-08-13）。
> **控制维度**：9 维 — `width / height / steps / seed / positive_prompt / negative_prompt / sampler / scheduler / cfg` + 全局 `preset / unet / lora1-3`（Header 控件）。

---

## 0. 目录结构

```
Anima/                          # 根（入口 + 运行时）
  start.md                      # 本文件（入口文档）
  anima.exe                     # Go 后端可执行文件（animalab/build.* 构筑）
  Anime_Turbo_api.json          # 预设 turbo：API 格式工作流模板（9 节点，anima_turboV10）
  Anima_base_api.json           # 预设 base：API 格式工作流模板（由 anima_good 转换，anima-preview3-base）
  anime_submit.py               # 最小可复用提交器（仅标准库，仅 turbo）
  jobs/<date>/<job>.json        # 批量任务（输入+结果同文件，exe 运行时目录）
  output/<date>/<job>/          # PNG 落盘（exe 运行时目录）
  build.ps1 / build.bat         # 构筑入口（转发至 animalab/build.*）
  animalab/                     # 项目源码与开发资源
    go.mod                      # module anima, go 1.22
    build.ps1 / build.bat       # 真实构筑脚本（go vet + CGO_ENABLED=0 go build -o ../anima.exe）
    cmd/anima/main.go           # 入口（serve/run，双击默认 serve --open）
    internal/{jobs,comfy,server}# 核心模块
    web/                        # 画廊前端（vanilla JS，三栏，exe 回落至此）
    jobs/                       # 示例 jobs（同步至根 jobs）
    PROMPT_GUIDE.md             # Prompt 指南与参考手册（可增长 Cookbook，详见 §8）
```
`MiniMaxH3` 相关文件保留在 `C:/# Repo/MiniMaxH3/h3lab/`，与本目录互不依赖。

---

## 1. 前置条件

1. ComfyUI 运行中（默认 `http://127.0.0.1:8188`，`COMFY_HOST` 可覆盖）
2. 模型已就位：`models/diffusion_models/anima_turboV10.safetensors`、`models/text_encoders/qwen_3_06b_base.safetensors`、`models/vae/qwen_image_vae.safetensors`
3. Python ≥ 3.10（仅标准库，无 npm/pip 依赖）

验证：

```bash
curl -s http://127.0.0.1:8188/system_stats
curl -s http://127.0.0.1:8188/models/diffusion_models  # 需包含 anima_turboV10.safetensors
```

---

## 2. 工作流（双预设 API 模板）

两个预设均为 API 格式 `{ node_id: { class_type, inputs, _meta } }`，共 9 节点（结构一致，仅 `60:44 UNETLoader.unet_name` 不同）：

```
60:44 UNETLoader      turbo: anima_turboV10.safetensors [默认] | base: anima-preview3-base.safetensors
60:45 CLIPLoader       qwen_3_06b_base.safetensors
60:15 VAELoader        qwen_image_vae.safetensors
60:11 CLIPTextEncode   positive_prompt  ─┐
60:12 CLIPTextEncode   negative_prompt  ─┤
60:28 EmptyLatentImage width/height      ─┼─> 60:19 KSampler (er_sde/simple, cfg=1.0) -> 60:8 VAEDecode -> 46 SaveImage
```

`base` 预设可选叠加 `anima-turbo-lora-v0.2` LoRA（强度默认 0.8，见 §7 Header 的 `lora` 控件；运行时由后端动态插入 `60:61/60:62/60:63 LoraLoaderModelOnly` 链到 `60:19.model`）。固定项无需控制：`KSampler.cfg=1.0, sampler_name=er_sde, scheduler=simple, denoise=1.0`。`SaveImage.filename_prefix` 仅控制落盘前缀（默认 `Anima`）。

### 6 维映射（稳定 Node ID，直改 `inputs`）

| 维度 | 节点 | 字段 | 约束 |
|---|---|---|---|
| `width` | `60:28 EmptyLatentImage` | `width` | INT 16–16384 step 8 |
| `height` | `60:28` | `height` | 同上 |
| `steps` | `60:19 KSampler` | `steps` | turbo 推荐 4–8 |
| `seed` | `60:19` | `seed` | 64-bit int，每次需变化否则命中缓存 |
| `positive_prompt` | `60:11 CLIPTextEncode` | `text` | 英文，含 `masterpiece, best quality, anime` 前缀效果更稳 |
| `negative_prompt` | `60:12 CLIPTextEncode` | `text` | 如 `worst quality, low quality, blurry, jpeg artifacts` |

---

## 3. API 控制（REST，轮询足够，无需 WebSocket）

原理同 `skill://comfyui-local-api`：`POST /prompt` → 轮询 `GET /history/{prompt_id}` → `GET /view` 下载。

```python
import json, copy, uuid, time, struct, pathlib, hashlib, urllib.request

BASE = "http://127.0.0.1:8188"
TPL  = pathlib.Path("Anime_Turbo_api.json")  # 与本文件同目录

def submit(width, height, steps, seed, pos, neg, prefix="Anima"):
    tpl = json.loads(TPL.read_text(encoding="utf-8"))
    tpl["60:11"]["inputs"]["text"] = pos
    tpl["60:12"]["inputs"]["text"] = neg
    tpl["60:28"]["inputs"]["width"] = width
    tpl["60:28"]["inputs"]["height"] = height
    tpl["60:19"]["inputs"]["steps"] = steps
    tpl["60:19"]["inputs"]["seed"] = seed
    tpl["46"]["inputs"]["filename_prefix"] = prefix
    cid = str(uuid.uuid4())
    data = json.dumps({"prompt": tpl, "client_id": cid}).encode()
    req = urllib.request.Request(f"{BASE}/prompt", data=data, headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        pid = json.loads(r.read().decode())["prompt_id"]
    deadline = time.time() + 120
    while time.time() < deadline:
        with urllib.request.urlopen(f"{BASE}/history/{pid}", timeout=15) as r:
            h = json.loads(r.read().decode())
        if pid in h and h[pid].get("outputs"):
            break
        time.sleep(0.5)
    with urllib.request.urlopen(f"{BASE}/history/{pid}", timeout=15) as r:
        h = json.loads(r.read().decode())[pid]
    im = list(h["outputs"].values())[0]["images"][0]
    qs = f"filename={im['filename']}&subfolder={im.get('subfolder','')}&type={im.get('type','output')}"
    with urllib.request.urlopen(f"{BASE}/view?{qs}", timeout=30) as r:
        buf = r.read()
    w = struct.unpack(">I", buf[16:20])[0]; ht = struct.unpack(">I", buf[20:24])[0]
    assert w == width and ht == height
    out = pathlib.Path("output") / im["filename"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(buf)
    return {"prompt_id": pid, "file": str(out), "w": w, "h": ht, "bytes": len(buf), "sha": hashlib.sha256(buf).hexdigest()[:16]}
```

核心路由：`POST /prompt`、`GET /history/{prompt_id}`、`GET /view?filename=&subfolder=&type=output`、`GET /queue`（可选）。

Anima 服务自身路由（`http://127.0.0.1:8765`）：

- `GET /api/presets` → `{presets:[{id,turbo|base, file}]}`
- `GET /api/meta` → `{unets:[...], loras:[...]}`（代理 ComfyUI `UNETLoader / LoraLoader*` 可选值，Header 下拉数据源）
- `POST /api/run?date=&job=`（body 可选 `{preset, unet_name, loras:[...]}` 作为本次运行全局覆盖）
- `GET /api/job?date=&job=`、`POST /api/review`、`POST /api/delete`、`GET /api/export?date=`、`GET /api/legacy`、`POST /api/quit`

---

## 4. 用法

### 单次（推荐）

```bash
python anime_submit.py --width 1024 --height 768 --steps 4 --seed 12345 --pos "masterpiece, best quality, anime, 1girl with long blue hair, smiling, white background" --neg "worst quality, low quality, blurry, jpeg artifacts" --prefix Anima
# 输出：output/Anima_00001_.png + JSON {prompt_id, file, w, h, bytes, sha}
```

默认参数：`1024x768, steps=4, seed=12345`，不传 `seed` 时脚本内自动随机（避免缓存复用）。

### 批量（循环调用即可，无需队列）

```python
for seed in [1, 2, 3]:
    print(submit(768, 768, 4, seed, "masterpiece, best quality, anime, cat", "worst quality, blurry"))
```

ComfyUI 单队列串行执行，无需并发。

---

## 5. 实测（2026-08-13）

| 测试 | 参数 | 结果 |
|---|---|---|
| 基准 | 1024×768 s4 seed12345 | `Anima_api_test_00001.png 695KB PNG 1024×768 OK` |
| seed | seed999 其余同基准 | hash 变化（`d39d60d57a28cf5a`） |
| 分辨率 | 768×768 | `499KB PNG 768×768 OK` |
| steps | s8 | hash 变化（`353e44b4a4e1d405`） |
| positive | 1boy red hair | hash 变化 |
| negative | `blurry, low quality` | hash 变化 |

单张耗时约 1.5–2s（RTX 5090D，0.33.1）；PNG 以 `89 50 4E 47 0D 0A 1A 0A` 签名 + IHDR 校验分辨率。

---

## 6. 约束

- `width/height` 需为 8 的倍数，否则 ComfyUI 自动对齐。
- `seed` 每次需新值，否则 `execution_cached` 直接复用旧图（`status.messages` 可见）。
- `POST /prompt` 返回 `{prompt_id, number, node_errors:{}}`，`node_errors` 为空即成功；`error` 非空需检查节点连线。
- `GET /workflow_templates` 在 0.33.1 返回 `{}`，模板以 `Anime_Turbo_api.json` 为准，从 `GET /history` 恢复。

---

## 7. 批量与审核（Anima Batch Gallery）

> 9 维可选（`sampler / scheduler / cfg` 等）外加全局 3 项（`preset / unet_name / loras`）由 Header 控件驱动（见下「Header 预设与模型」）。未填的 3 维回落到 `Anime_Turbo_api.json:60:19 KSampler` 当前值 `er_sde / simple / 1.0`；回落优先级 `item > job.defaults > workflowDefaults > 全局默认`；`preset/unet/lora` 回落同理 `item > job.defaults > 预设默认`。

### 目录契约
```
Anima/                          # 根（入口 + 运行时，exe 双击即用）
  anima.exe                     # 可执行文件（双击默认 serve --open → http://127.0.0.1:8765）
  Anime_Turbo_api.json          # 工作流模板（exe 读取）
  jobs/<YYYY-MM-DD>/<job>.json  # 运行时 jobs（与 animalab/jobs 同步）
  output/<YYYY-MM-DD>/<job>/    # 运行时落盘
  animalab/                     # 项目源码（开发期）
    build.ps1 / build.bat       # 真实构筑（go vet + go build -o ../anima.exe）
    cmd/anima / internal/* / web / jobs
```
根仅保留入口文档、exe 及其运行时目录；`cmd/internal/web/go.mod` 均在 `animalab/`。

旧 `output/Anima_*.png` 保留不迁移，`GET /api/legacy` 归入 `__legacy__` 桶。`exe` 若 `Anima/web` 缺失会回落至 `animalab/web`。

### Job JSON（schema_version: 1）

```json
{
  "schema_version": 1,
  "job_id": "example",
  "date": "2026-08-20",
  "created_at": "2026-08-20T12:00:00Z",
  "defaults": { "width": 1024, "height": 768, "steps": 4, "sampler": "er_sde", "scheduler": "simple", "cfg": 1.0 },
  "items": [{ "id": "1", "scene": "forest", "variant": "4:3", "positive_prompt": "...", "status": "pending", "review": { "verdict": "unreviewed" } }]
}
```
新增 `scene`/`variant` 可选：`scene` 为场景分组（如 `forest/city`），`variant` 为该场景下的比例或变体名（如 `4:3/16:9/1:1`）；未填归“未分组”，前端按场景聚合、按比例展开。旧 job 缺省兼容，无需迁移。

预设与模型同样可在 `defaults`/`item` 声明（`preset: "turbo"|"base"`、`unet_name: "*.safetensors"`、`loras: [{name, weight}]`，`name` 为 `off`/空则跳过，`weight` 未填按 `1.0`，`±10` clamp，最多 3 条）。Header 控件作为**本次运行**的全局覆盖注入（仅内存态写入 `job.Defaults`，不落盘）；优先级仍 `item > defaults > Header > 预设默认`。

### Header 预设与模型（新增）

`http://127.0.0.1:8765/` 顶部（`brand` 与 `▶运行批次` 之间）新增一排控件：

- **预设**（`selPreset`）：`turbo`（默认）/ `base`，决定读取 `Anime_Turbo_api.json` 或 `Anima_base_api.json` 作为模板。
- **UNET**（`selUnet`）：所有 `anima*.safetensors`（来自 `GET /api/meta`）；默认空 = 跟随预设的 unet。
- **Lora 1/2/3**（`selLora1-3` + 权重 `wtLora1-3`）：默认 `off`（禁权重输入），选中 `anima-turbo-lora-v0.2.safetensors` 等即生效、权重 `step 0.05 [-10,10]`（默认 0.8/1.0/1.0）。
- 全部持久化 `localStorage anima.hdr.*`，重开页面恢复。
- 点击 `▶运行批次` 时随 `POST /api/run` body 上传 `{preset, unet_name, loras}`。

对应 `dry-run` / CLI / REST 见下方。

### 构筑

```powershell
# 方式A：根入口（推荐，双击亦可）
powershell -ExecutionPolicy Bypass -File build.ps1
# 或 build.bat

# 方式B：源码目录
powershell -ExecutionPolicy Bypass -File animalab/build.ps1
```

真实脚本在 `animalab/build.ps1|bat`：`go vet ./...` → `CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o ../anima.exe ./cmd/anima`（需在 `animalab/` 内执行），产物 `../anima.exe` 约 6–8MB。根的 `build.ps1|bat` 仅转发至 `animalab/`。已提交的 `anima.exe` 即此脚本产物，直接可用，无需本地 Go 亦可运行；`go vet` 需在 `animalab` 目录执行（根无 `go.mod`）。

### 可执行文件用法（与 go run 等价，无需 Go 环境）

```bash
# 双击 / 不带参数 — 默认启动服务并自动打开画廊（最常用）
./anima.exe                                # 等同 anima serve --open → http://127.0.0.1:8765
# 不自动弹浏览器
./anima.exe --no-open
./anima.exe serve --no-open

# 预览 / 批量（新增 Header 等价 CLI：--preset / --unet / --loras）
./anima.exe run jobs/2026-08-20/example.json --dry-run
./anima.exe run jobs/2026-08-20/example.json
./anima.exe run jobs/2026-08-20/example.json --dry-run --preset base
./anima.exe run jobs/2026-08-20/example.json --dry-run --preset base --unet anima_turboV10.safetensors
./anima.exe run jobs/2026-08-20/example.json --dry-run --loras '[{"name":"anima-turbo-lora-v0.2.safetensors","weight":0.8}]'

# 服务显式
./anima.exe serve                          # + 自动弹浏览器
./anima.exe serve --port 8765 --host 127.0.0.1:8188 --no-open
ANIMA_PORT=8765 COMFY_HOST=http://127.0.0.1:8188 ./anima.exe
# 清理（端口/内存幽灵占用）
./anima.exe kill                             # 杀掉本机所有 anima 进程 + 释放 8765
./anima.exe kill --port 8765                 # 仅清理指定端口
```

`--preset base` 读取 `Anima_base_api.json`（默认 `--preset turbo` 读 `Anime_Turbo_api.json`）；`--unet` 覆盖 `60:44.unet_name`；`--loras` 接收 JSON 数组（最多 3 条，`off`/空跳过，weight 默认 1.0），等价 Header 控件。`dry-run` 会打印每项 `preset / unet / loras`。

`kill` 在 Windows 通过 `netstat -ano` 定位 `:8765 LISTENING` 且 `tasklist` 确认为 `anima` 的 PID 后 `taskkill /F`，再扫 `anima.exe` 映像兜底；Unix 走 `lsof -ti :port`/`fuser`+`pgrep -f anima`。均排除自身 PID，不会自杀；未命中则提示 `no anima tasks found`。

`POST /api/quit`（`header Quit` 按钮调用）：返回 `{"ok":true}` 后约 200ms 优雅退出服务进程；前端随后 `window.close()` 关标签，兜底显示“Anima 已退出”占位。`curl -X POST http://127.0.0.1:8765/api/quit` 可在终端验证。

源码方式（需 Go 1.22+，在 `animalab/` 内）：
```bash
cd animalab
go run ./cmd/anima --no-open
go run ./cmd/anima run ../jobs/2026-08-20/example.json --dry-run
```
根的 `jobs/` 与 `animalab/jobs/` 保持同步，`output/` 仅在根。

### AI 闭环

`AI 生成 jobs/<date>/<job>.json → POST /api/run 或 anima run 批量验证 → 人工在画廊标注 rejected+reason/tags → GET /api/export?date= 聚合（stats/tags频次/失败原因）→ 作为下一轮 jobs 生成依据`。示例见 `jobs/2026-08-20/example.json`（含 width 对齐用例）、`jobs/2026-08-20/turbo-compare.json`（sampler/scheduler/cfg 对比）与 `jobs/2026-08-20/scene-demo.json`（任意 `group/subgroup` 分组演示，兼容旧 `scene/variant`）；新增 `jobs/2026-08-20/high-overhead-behind.json`（高过头顶正后俯视 24项，`frieren/fern` × `head/bust/half/full` × `高俯30°/斜顶45°/顶俯60°`，`fern-bust` 已就地 patch 防胸部翻面）。

## 8. Prompt 指南与参考（可增长）

> 完整手册与参考获取路径见 **`animalab/PROMPT_GUIDE.md`**（单一真相源）。本节为精简引用，使用时以该文件为准，其余笔记不再重复。

**模型理解**：Anima 同时训练于 `Danbooru tags + 自然语言`，因此 `Tags` 掌管原子视觉（画什么），`自然语言` 掌管空间/关系（怎么摆）。混合优于纯 tag 或纯 NL。`@artist` 为画师锚点（必带 `@`），通用风格用 `watercolor / cel shading / cinematic lighting` 等普通 tag。

**角色指定**：必用 `角色 canonical + 作品/版权`（如 `fern, sousou no frieren` / `hatsune miku, vocaloid`），并补关键外观（发色/瞳色/服装）避免漂移；多角色需每人独立 `name+series+外观` 再用 NL 绑定左右/看向。详见 `PROMPT_GUIDE.md §5`。

**起手模板**（`Tags + NL`）：
```text
masterpiece, best quality, highres, newest, year 2025, safe,
1girl, solo, fern, sousou no frieren, long purple hair, purple eyes, black coat, white dress,
standing, full body, looking at viewer, forest, sunlight, soft lighting
// + 一段自然语言关系描述（如“F… stands on the left while …”）
```

**参考获取路径**：
- 摄影视角词典： — 8×5 40 点、upper body 基准、硬 anchors、NL 几何、四轴拆分

- Anima-Prompt `references/anima-prompting.md` — 语法/顺序/`@`/Base vs Aesthetic
- ComfyUI-AnimaTool `wiki/Prompt-Guide.md` — 质量/人数/角色/作品/画师/风格/外观/环境拆解
- Comfyui-Anima-Prompt — 21,580 tag 数据库（Character/General/Species）
- Danbooru/Gelbooru/e621 — 查 `character/copyright/artist` canonical，空格小写回填
- 官方 README + 系统提示 — `circlestone-labs/Anima`、`Finnsprite/Anima`、`Gazingstars123/2.9B`、`Tomiigo/system_prompt.txt`

具体链接与可增长 Cookbook（人物/服装/镜头/光影/多角色等，含强度/副作用/推荐组合/样图 job）见 `animalab/PROMPT_GUIDE.md §9–§13`，新增实测请按其模板在该文件追加并在 `§13 Changelog` 登记。

### 画廊

浏览器打开 `http://127.0.0.1:8765/`：

- **布局**：header 左 `≡` 可折叠最左侧 `月→日→包` TREE（月为最小单位，记忆到 `localStorage`）；次左 `Scenes` 按 `scene/variant` 聚合（无 `scene` 归“未分组”，`variant` 未填则回落 `w×h→比例`）；右侧为主网格。
- **卡片**：仅保留首行 `#id · 分辨率` 与末行 `✓保留 ✕驳回`，其余 `prompt/tags/warnings` 入灯箱右侧；多选 `☑` 仍在卡片右上角，批量栏共用。
- **缩放**：工具栏 `缩放` 滑块 `220–500px step10`（默认 260），`--thumb` 驱 `grid minmax`，持久化 `localStorage anima.thumb`。
- **筛选/批量**：`全部/未审核/已保留/已驳回/失败` + `tags` 过滤 + `按ID/状态/Seed` 排序 + `批量保留/驳回`；计数 `可见/总数 · job · date · scene`。
- **生成回调**：`▶运行批次` 后轮询 `GET /api/job` 增量 diff 仅追加新 thumbnail（绿色闪边），无需刷新。
- **灯箱全屏**：`‹/›` 左右切同筛选列表，到边界自动跨场景；`↑/↓` 切上一/下一场景（`▲场景/▼场景` 按钮同效）；右侧嵌入完整“抽屉内容”（9维+审核表单+保存/删除），剩余空间图片 `contain 88vh` 自适应；`Esc` 关闭。
- **预设与模型（新增，Header）**：`预设 turbo/base`、`UNET`（空=跟随预设）、`Lora 1/2/3`（默认 off + 权重输入）；`▶运行批次` 一并上传该全局配置（详见 §7「Header 预设与模型」），`localStorage anima.hdr.*` 持久化。
- **后退/分享**：`#date=&job=&scene=&variant=&item=` 可分享，`file://` 直接打开提示启动后端；`header Quit(红)` = `POST /api/quit` 停服并关页。
