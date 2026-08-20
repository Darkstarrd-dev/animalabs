package comfy

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func (c *Client) resolveTemplatePath(preset string) string {
	if preset == "" {
		return c.TemplatePath
	}
	candidate := "Anime_Turbo_api.json"
	if preset == "base" {
		candidate = "Anima_base_api.json"
	}
	dir := filepath.Dir(c.TemplatePath)
	for _, cand := range []string{
		filepath.Join(dir, candidate),
		filepath.Join(exeDir(), candidate),
		candidate,
	} {
		if _, err := os.Stat(cand); err == nil {
			return cand
		}
	}
	return c.TemplatePath
}

func (c *Client) loadTemplate(req SubmitReq) (map[string]any, string, error) {
	path := c.resolveTemplatePath(req.Preset)
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, path, fmt.Errorf("read template %s: %w", path, err)
	}
	var tpl map[string]any
	if err := json.Unmarshal(b, &tpl); err != nil {
		return nil, path, fmt.Errorf("parse template: %w", err)
	}
	applyRequestToTemplate(tpl, req)
	return tpl, path, nil
}

func applyRequestToTemplate(tpl map[string]any, req SubmitReq) {
	setText(tpl, "60:11", req.Positive)
	setText(tpl, "60:12", req.Negative)
	setDim(tpl, "60:28", "width", req.Width)
	setDim(tpl, "60:28", "height", req.Height)
	if req.Batch > 1 {
		setDim(tpl, "60:28", "batch_size", req.Batch)
	}
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
	if strings.TrimSpace(req.UnetName) != "" {
		if node, ok := tpl["60:44"].(map[string]any); ok {
			if inputs, ok := node["inputs"].(map[string]any); ok {
				inputs["unet_name"] = strings.TrimSpace(req.UnetName)
			}
		}
	}
	injectLoras(tpl, req.Loras)
}

func injectLoras(tpl map[string]any, loras []LoraReq) {
	active := filterLoras(loras)
	if len(active) == 0 {
		return
	}
	prevOutput := "60:44"
	for i, lr := range active {
		nodeID := fmt.Sprintf("60:6%d", i+1)
		tpl[nodeID] = map[string]any{
			"inputs": map[string]any{
				"model":          []any{prevOutput, 0},
				"lora_name":      lr.Name,
				"strength_model": lr.Weight,
			},
			"class_type": "LoraLoaderModelOnly",
			"_meta":      map[string]any{"title": fmt.Sprintf("Lora %d", i+1)},
		}
		prevOutput = nodeID
	}
	if ksampler, ok := tpl["60:19"].(map[string]any); ok {
		if inputs, ok := ksampler["inputs"].(map[string]any); ok {
			inputs["model"] = []any{prevOutput, 0}
		}
	}
}

func filterLoras(loras []LoraReq) []LoraReq {
	var out []LoraReq
	for _, l := range loras {
		n := strings.TrimSpace(l.Name)
		if n == "" || strings.EqualFold(n, "off") {
			continue
		}
		w := l.Weight
		if w == 0 {
			w = 1.0
		}
		out = append(out, LoraReq{Name: n, Weight: w})
		if len(out) >= 3 {
			break
		}
	}
	return out
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
