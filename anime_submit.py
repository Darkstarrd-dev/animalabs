"""
Anime_Turbo 文生图 6维控制 — 最小可复用提交器
映射: width/height->60:28 EmptyLatentImage, steps/seed->60:19 KSampler, pos->60:11, neg->60:12
用法: python anime_submit.py --width 1024 --height 768 --steps 4 --seed 12345 --pos "masterpiece, ..." --neg "worst quality, ..."
依赖: 仅标准库 + 运行中的 ComfyUI (127.0.0.1:8188)
"""
import json, copy, uuid, time, struct, pathlib, hashlib, argparse, urllib.request

BASE="http://127.0.0.1:8188"
TPL=pathlib.Path(__file__).with_name("Anime_Turbo_api.json")

def get_json(path):
    with urllib.request.urlopen(BASE+path, timeout=15) as r: return json.loads(r.read().decode())
def post_json(path, obj):
    data=json.dumps(obj).encode()
    req=urllib.request.Request(BASE+path, data=data, headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req, timeout=15) as r: return json.loads(r.read().decode())

def submit(width,height,steps,seed,pos,neg,prefix="Anima_api"):
    tpl=json.loads(TPL.read_text(encoding="utf-8"))
    tpl["60:11"]["inputs"]["text"]=pos
    tpl["60:12"]["inputs"]["text"]=neg
    tpl["60:28"]["inputs"]["width"]=width
    tpl["60:28"]["inputs"]["height"]=height
    tpl["60:19"]["inputs"]["steps"]=steps
    tpl["60:19"]["inputs"]["seed"]=seed
    tpl["46"]["inputs"]["filename_prefix"]=prefix
    cid=str(uuid.uuid4())
    resp=post_json("/prompt", {"prompt": tpl, "client_id": cid})
    pid=resp["prompt_id"]
    # poll history (WS 可选，轮询足够；RTX 5090D 约2-3s)
    deadline=time.time()+120
    while time.time()<deadline:
        h=get_json(f"/history/{pid}")
        if pid in h and h[pid].get("outputs"): break
        time.sleep(0.5)
    h=get_json(f"/history/{pid}")[pid]
    im=list(h["outputs"].values())[0]["images"][0]
    qs=f"filename={im['filename']}&subfolder={im.get('subfolder','')}&type={im.get('type','output')}"
    with urllib.request.urlopen(BASE+f"/view?{qs}", timeout=30) as r: buf=r.read()
    # validate PNG dims
    w=struct.unpack(">I", buf[16:20])[0]; ht=struct.unpack(">I", buf[20:24])[0]
    assert w==width and ht==height, f"dim mismatch {w}x{ht} vs {width}x{height}"
    out=TPL.parent / "output" / im['filename']
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(buf)
    return {"prompt_id":pid, "file":str(out), "w":w, "h":ht, "bytes":len(buf), "sha":hashlib.sha256(buf).hexdigest()[:16]}

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--width", type=int, default=1024)
    ap.add_argument("--height", type=int, default=768)
    ap.add_argument("--steps", type=int, default=4)
    ap.add_argument("--seed", type=int, default=12345)
    ap.add_argument("--pos", default="masterpiece, best quality, anime, 1girl, smiling")
    ap.add_argument("--neg", default="worst quality, low quality, blurry")
    ap.add_argument("--prefix", default="Anima_api")
    args=ap.parse_args()
    print(json.dumps(submit(args.width,args.height,args.steps,args.seed,args.pos,args.neg,args.prefix), indent=2, ensure_ascii=False))
