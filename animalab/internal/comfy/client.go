package comfy

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Client struct {
	Host         string
	TemplatePath string
	HTTP         *http.Client
}

func NewClient(host, templatePath string) *Client {
	if host == "" {
		host = os.Getenv("COMFY_HOST")
		if host == "" {
			host = "http://127.0.0.1:8188"
		}
	}
	if templatePath == "" {
		templatePath = findTemplate()
	}
	return &Client{
		Host:         strings.TrimRight(host, "/"),
		TemplatePath: templatePath,
		HTTP:         &http.Client{Timeout: 30 * time.Second},
	}
}

func findTemplate() string {
	candidates := []string{
		"Anime_Turbo_api.json",
		"Anima/Anime_Turbo_api.json",
		filepath.Join(exeDir(), "Anime_Turbo_api.json"),
		filepath.Join(exeDir(), "..", "Anime_Turbo_api.json"),
		filepath.Join(exeDir(), "..", "..", "Anime_Turbo_api.json"),
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	dir, _ := os.Getwd()
	for range 6 {
		p := filepath.Join(dir, "Anime_Turbo_api.json")
		if _, err := os.Stat(p); err == nil {
			return p
		}
		p = filepath.Join(dir, "Anima", "Anime_Turbo_api.json")
		if _, err := os.Stat(p); err == nil {
			return p
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "Anime_Turbo_api.json"
}

func exeDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exe)
}

type SubmitReq struct {
	Width     int     `json:"width"`
	Height    int     `json:"height"`
	Steps     int     `json:"steps"`
	Seed      int64   `json:"seed"`
	Positive  string  `json:"positive"`
	Negative  string  `json:"negative"`
	Sampler   string  `json:"sampler"`
	Scheduler string  `json:"scheduler"`
	Cfg       float64 `json:"cfg"`
	Prefix    string  `json:"prefix"`
}

type SubmitResult struct {
	PromptID  string `json:"prompt_id"`
	Bytes     []byte `json:"-"`
	W         int    `json:"w"`
	H         int    `json:"h"`
	SHA16     string `json:"sha16"`
	ElapsedMs int64  `json:"elapsed_ms"`
}

type promptResp struct {
	PromptID   string         `json:"prompt_id"`
	NodeErrors map[string]any `json:"node_errors"`
	Error      any            `json:"error"`
}

func newUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func (c *Client) Submit(ctx context.Context, req SubmitReq) (SubmitResult, error) {
	start := time.Now()
	tplBytes, err := os.ReadFile(c.TemplatePath)
	if err != nil {
		return SubmitResult{}, fmt.Errorf("read template %s: %w", c.TemplatePath, err)
	}
	var tpl map[string]any
	if err := json.Unmarshal(tplBytes, &tpl); err != nil {
		return SubmitResult{}, fmt.Errorf("parse template: %w", err)
	}
	setText(tpl, "60:11", req.Positive)
	setText(tpl, "60:12", req.Negative)
	setDim(tpl, "60:28", "width", req.Width)
	setDim(tpl, "60:28", "height", req.Height)
	if node, ok := tpl["60:19"].(map[string]any); ok {
		if inputs, ok := node["inputs"].(map[string]any); ok {
			inputs["steps"] = req.Steps
			inputs["seed"] = req.Seed
			inputs["sampler_name"] = req.Sampler
			inputs["scheduler"] = req.Scheduler
			inputs["cfg"] = req.Cfg
		}
	}
	if node, ok := tpl["46"].(map[string]any); ok {
		if inputs, ok := node["inputs"].(map[string]any); ok {
			inputs["filename_prefix"] = req.Prefix
		}
	}

	cid := newUUID()
	body := map[string]any{
		"prompt":    tpl,
		"client_id": cid,
	}
	data, _ := json.Marshal(body)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.Host+"/prompt", bytes.NewReader(data))
	if err != nil {
		return SubmitResult{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(httpReq)
	if err != nil {
		return SubmitResult{}, fmt.Errorf("POST /prompt: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return SubmitResult{}, fmt.Errorf("POST /prompt %d: %s", resp.StatusCode, string(respBody))
	}
	var pr promptResp
	if err := json.Unmarshal(respBody, &pr); err != nil {
		return SubmitResult{}, fmt.Errorf("parse prompt resp: %w", err)
	}
	if pr.Error != nil && pr.Error != "" {
		return SubmitResult{}, fmt.Errorf("comfy error: %v", pr.Error)
	}
	if len(pr.NodeErrors) > 0 {
		b, _ := json.Marshal(pr.NodeErrors)
		return SubmitResult{}, fmt.Errorf("node_errors: %s", string(b))
	}
	if pr.PromptID == "" {
		return SubmitResult{}, fmt.Errorf("no prompt_id in response: %s", string(respBody))
	}
	pid := pr.PromptID

	deadline := time.Now().Add(120 * time.Second)
	var lastHistory map[string]map[string]any
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return SubmitResult{}, ctx.Err()
		default:
		}
		h, err := c.getHistory(ctx, pid)
		if err != nil {
			time.Sleep(500 * time.Millisecond)
			continue
		}
		if h != nil {
			if entry, ok := h[pid]; ok {
				if outputs, ok := entry["outputs"].(map[string]any); ok && len(outputs) > 0 {
					lastHistory = h
					break
				}
				if status, ok := entry["status"].(map[string]any); ok {
					if msgs, ok := status["messages"].([]any); ok {
						for _, m := range msgs {
							if mm, ok := m.([]any); ok && len(mm) > 0 {
								_ = mm
							}
						}
					}
				}
			}
		}
		lastHistory = h
		time.Sleep(500 * time.Millisecond)
	}
	if lastHistory == nil {
		return SubmitResult{}, fmt.Errorf("poll timeout 120s for %s", pid)
	}
	entry, ok := lastHistory[pid]
	if !ok {
		return SubmitResult{}, fmt.Errorf("history missing pid %s", pid)
	}
	if status, ok := entry["status"].(map[string]any); ok {
		if msgs, ok := status["messages"].([]any); ok {
			_ = msgs
		}
	}
	outputs, ok := entry["outputs"].(map[string]any)
	if !ok || len(outputs) == 0 {
		return SubmitResult{}, fmt.Errorf("no outputs for %s", pid)
	}
	var im map[string]any
	for _, v := range outputs {
		if outMap, ok := v.(map[string]any); ok {
			if imgs, ok := outMap["images"].([]any); ok && len(imgs) > 0 {
				if m, ok := imgs[0].(map[string]any); ok {
					im = m
					break
				}
			}
		}
	}
	if im == nil {
		return SubmitResult{}, fmt.Errorf("no images in outputs for %s", pid)
	}
	filename, _ := im["filename"].(string)
	subfolder, _ := im["subfolder"].(string)
	typ, _ := im["type"].(string)
	if typ == "" {
		typ = "output"
	}
	qs := url.Values{}
	qs.Set("filename", filename)
	qs.Set("subfolder", subfolder)
	qs.Set("type", typ)
	viewURL := c.Host + "/view?" + qs.Encode()
	req2, err := http.NewRequestWithContext(ctx, "GET", viewURL, nil)
	if err != nil {
		return SubmitResult{}, err
	}
	http2 := &http.Client{Timeout: 30 * time.Second}
	resp2, err := http2.Do(req2)
	if err != nil {
		return SubmitResult{}, fmt.Errorf("GET /view: %w", err)
	}
	defer resp2.Body.Close()
	buf, err := io.ReadAll(resp2.Body)
	if err != nil {
		return SubmitResult{}, err
	}
	if len(buf) < 24 {
		return SubmitResult{}, fmt.Errorf("image too short %d", len(buf))
	}
	if string(buf[1:4]) != "PNG" {
		return SubmitResult{}, fmt.Errorf("not PNG")
	}
	w := int(binary.BigEndian.Uint32(buf[16:20]))
	h := int(binary.BigEndian.Uint32(buf[20:24]))
	sha := sha256.Sum256(buf)
	sha16 := hex.EncodeToString(sha[:])[:16]
	elapsed := time.Since(start).Milliseconds()
	return SubmitResult{
		PromptID:  pid,
		Bytes:     buf,
		W:         w,
		H:         h,
		SHA16:     sha16,
		ElapsedMs: elapsed,
	}, nil
}

func (c *Client) getHistory(ctx context.Context, pid string) (map[string]map[string]any, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.Host+"/history/"+pid, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("history %d: %s", resp.StatusCode, string(body))
	}
	var h map[string]map[string]any
	if err := json.Unmarshal(body, &h); err != nil {
		return nil, err
	}
	return h, nil
}

func setText(tpl map[string]any, nodeID, text string) {
	if node, ok := tpl[nodeID].(map[string]any); ok {
		if inputs, ok := node["inputs"].(map[string]any); ok {
			inputs["text"] = text
		}
	}
}

func setDim(tpl map[string]any, nodeID, key string, val int) {
	if node, ok := tpl[nodeID].(map[string]any); ok {
		if inputs, ok := node["inputs"].(map[string]any); ok {
			inputs[key] = val
		}
	}
}
