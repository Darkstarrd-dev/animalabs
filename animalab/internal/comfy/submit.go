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
	"time"
)

func newUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func (c *Client) Submit(ctx context.Context, req SubmitReq) (SubmitResult, error) {
	start := time.Now()
	tpl, _, err := c.loadTemplate(req)
	if err != nil {
		return SubmitResult{}, err
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

	images, err := c.pollAndDownload(ctx, pid)
	if err != nil {
		return SubmitResult{}, err
	}
	elapsed := time.Since(start).Milliseconds()
	first := images[0]
	return SubmitResult{
		PromptID:  pid,
		Bytes:     first.Bytes,
		W:         first.W,
		H:         first.H,
		SHA16:     first.SHA16,
		ElapsedMs: elapsed,
		Filename:  first.Filename,
		Images:    images,
	}, nil
}

func (c *Client) pollAndDownload(ctx context.Context, pid string) ([]BatchImage, error) {
	deadline := time.Now().Add(180 * time.Second)
	var lastHistory map[string]map[string]any
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
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
			}
		}
		lastHistory = h
		time.Sleep(500 * time.Millisecond)
	}
	if lastHistory == nil {
		return nil, fmt.Errorf("poll timeout 120s for %s", pid)
	}
	entry, ok := lastHistory[pid]
	if !ok {
		return nil, fmt.Errorf("history missing pid %s", pid)
	}
	outputs, ok := entry["outputs"].(map[string]any)
	if !ok || len(outputs) == 0 {
		return nil, fmt.Errorf("no outputs for %s", pid)
	}
	var allMaps []map[string]any
	for _, v := range outputs {
		if outMap, ok := v.(map[string]any); ok {
			if imgs, ok := outMap["images"].([]any); ok && len(imgs) > 0 {
				for _, raw := range imgs {
					if m, ok := raw.(map[string]any); ok {
						allMaps = append(allMaps, m)
					}
				}
			}
		}
	}
	if len(allMaps) == 0 {
		return nil, fmt.Errorf("no images in outputs for %s", pid)
	}
	images := make([]BatchImage, 0, len(allMaps))
	for _, im := range allMaps {
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
			return nil, err
		}
		http2 := &http.Client{Timeout: 30 * time.Second}
		resp2, err := http2.Do(req2)
		if err != nil {
			return nil, fmt.Errorf("GET /view: %w", err)
		}
		buf, err := io.ReadAll(resp2.Body)
		resp2.Body.Close()
		if err != nil {
			return nil, err
		}
		if len(buf) < 24 {
			return nil, fmt.Errorf("image too short %d", len(buf))
		}
		if string(buf[1:4]) != "PNG" {
			return nil, fmt.Errorf("not PNG")
		}
		w := int(binary.BigEndian.Uint32(buf[16:20]))
		h := int(binary.BigEndian.Uint32(buf[20:24]))
		sha := sha256.Sum256(buf)
		sha16 := hex.EncodeToString(sha[:])[:16]
		images = append(images, BatchImage{Bytes: buf, W: w, H: h, SHA16: sha16, Filename: filename})
	}
	return images, nil
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
