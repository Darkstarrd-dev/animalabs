package server

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"anima/internal/jobs"
)

func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	date := r.URL.Query().Get("date")
	jobName := r.URL.Query().Get("job")
	if date == "" {
		writeJSON(w, 400, map[string]string{"error": "date required"})
		return
	}
	if jobName != "" {
		if !strings.HasSuffix(jobName, ".json") {
			jobName += ".json"
		}
		path := filepath.Join(s.Root, "jobs", date, jobName)
		j, err := jobs.Load(path)
		if err != nil {
			writeJSON(w, 404, map[string]string{"error": "job not found"})
			return
		}
		writeJSON(w, 200, buildExportForJob(j, date))
		return
	}
	pattern := filepath.Join(s.Root, "jobs", date, "*.json")
	files, _ := filepath.Glob(pattern)
	var items []map[string]any
	stats := map[string]int{"kept": 0, "rejected": 0, "unreviewed": 0, "failed": 0, "done": 0, "pending": 0}
	tagFreq := map[string]int{}
	failReasons := map[string]int{}
	for _, f := range files {
		j, err := jobs.Load(f)
		if err != nil {
			continue
		}
		exp := buildExportForJob(j, date)
		if arr, ok := exp["items"].([]map[string]any); ok {
			items = append(items, arr...)
		}
		if st, ok := exp["stats"].(map[string]any); ok {
			for k, v := range st {
				if k == "tags" || k == "fail_reasons" {
					continue
				}
				if n, ok := v.(int); ok {
					stats[k] += n
				}
			}
			if tf, ok := st["tags"].(map[string]int); ok {
				for k, v := range tf {
					tagFreq[k] += v
				}
			}
			if fr, ok := st["fail_reasons"].(map[string]int); ok {
				for k, v := range fr {
					failReasons[k] += v
				}
			}
		}
	}
	if items == nil {
		items = []map[string]any{}
	}
	writeJSON(w, 200, map[string]any{
		"date":  date,
		"items": items,
		"stats": map[string]any{
			"kept":         stats["kept"],
			"rejected":     stats["rejected"],
			"unreviewed":   stats["unreviewed"],
			"failed":       stats["failed"],
			"done":         stats["done"],
			"pending":      stats["pending"],
			"tags":         tagFreq,
			"fail_reasons": failReasons,
		},
	})
}

func buildExportForJob(j *jobs.Job, date string) map[string]any {
	var items []map[string]any
	tagFreq := map[string]int{}
	failReasons := map[string]int{}
	kept, rejected, unreviewed, failed, done, pending := 0, 0, 0, 0, 0, 0
	for idx := range j.Items {
		resolved := j.Resolve(idx)
		it := j.Items[idx]
		verdict := "unreviewed"
		if it.Review != nil && it.Review.Verdict != "" {
			verdict = it.Review.Verdict
		}
		switch verdict {
		case "kept":
			kept++
		case "rejected":
			rejected++
		default:
			unreviewed++
		}
		switch it.Status {
		case "failed":
			failed++
			if it.Error != "" {
				failReasons[it.Error]++
			}
		case "done":
			done++
		case "pending":
			pending++
		}
		if it.Review != nil {
			for _, t := range it.Review.Tags {
				tagFreq[t]++
			}
		}
		entry := map[string]any{
			"id":       it.ID,
			"resolved": resolved,
			"status":   it.Status,
			"output":   it.Output,
			"review":   it.Review,
			"error":    it.Error,
			"warnings": it.Warnings,
		}
		items = append(items, entry)
	}
	if items == nil {
		items = []map[string]any{}
	}
	return map[string]any{
		"date":  date,
		"job":   j.JobID,
		"items": items,
		"stats": map[string]any{
			"kept":         kept,
			"rejected":     rejected,
			"unreviewed":   unreviewed,
			"failed":       failed,
			"done":         done,
			"pending":      pending,
			"tags":         tagFreq,
			"fail_reasons": failReasons,
		},
	}
}

func (s *Server) handlePresets(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	writeJSON(w, 200, map[string]any{
		"presets": []map[string]string{
			{"id": "turbo", "label": "Turbo", "file": "Anime_Turbo_api.json"},
			{"id": "base", "label": "Base", "file": "Anima_base_api.json"},
		},
	})
}

func (s *Server) handleMeta(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	// Proxy ComfyUI /object_info to expose available unet/loras without CORS issues
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(s.ComfyHost + "/object_info")
	if err != nil {
		writeJSON(w, 200, map[string]any{"unets": []string{}, "loras": []string{}, "error": err.Error()})
		return
	}
	defer resp.Body.Close()
	var info map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		writeJSON(w, 200, map[string]any{"unets": []string{}, "loras": []string{}, "error": err.Error()})
		return
	}
	unets := []string{}
	loras := []string{}
	if unetNode, ok := info["UNETLoader"].(map[string]any); ok {
		if inp, ok := unetNode["input"].(map[string]any); ok {
			if req, ok := inp["required"].(map[string]any); ok {
				if names, ok := req["unet_name"].([]any); ok && len(names) > 0 {
					if list, ok := names[0].([]any); ok {
						for _, v := range list {
							if s, ok := v.(string); ok {
								unets = append(unets, s)
							}
						}
					}
				}
			}
		}
	}
	for _, key := range []string{"LoraLoaderModelOnly", "LoraLoader"} {
		if node, ok := info[key].(map[string]any); ok {
			if inp, ok := node["input"].(map[string]any); ok {
				if req, ok := inp["required"].(map[string]any); ok {
					if names, ok := req["lora_name"].([]any); ok && len(names) > 0 {
						if list, ok := names[0].([]any); ok {
							for _, v := range list {
								if s, ok := v.(string); ok {
									loras = append(loras, s)
								}
							}
						}
					}
				}
			}
			if len(loras) > 0 {
				break
			}
		}
	}
	// deduplicate
	seen := map[string]bool{}
	uniqLoras := []string{}
	for _, l := range loras {
		if !seen[l] {
			seen[l] = true
			uniqLoras = append(uniqLoras, l)
		}
	}
	samplers := []string{}
	schedulers := []string{}
	if ksampler, ok := info["KSampler"].(map[string]any); ok {
		if inp, ok := ksampler["input"].(map[string]any); ok {
			if req, ok := inp["required"].(map[string]any); ok {
				if list, ok := req["sampler_name"].([]any); ok && len(list) > 0 {
					if enum, ok := list[0].([]any); ok {
						for _, v := range enum { if s, ok := v.(string); ok { samplers = append(samplers, s) } }
					}
				}
				if list, ok := req["scheduler"].([]any); ok && len(list) > 0 {
					if enum, ok := list[0].([]any); ok {
						for _, v := range enum { if s, ok := v.(string); ok { schedulers = append(schedulers, s) } }
					}
				}
			}
		}
	}
	writeJSON(w, 200, map[string]any{"unets": unets, "loras": uniqLoras, "samplers": samplers, "schedulers": schedulers})
}

func (s *Server) handleLegacy(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	pattern := filepath.Join(s.Root, "output", "Anima_*.png")
	files, _ := filepath.Glob(pattern)
	type entry struct {
		Filename string `json:"filename"`
		Bytes    int64  `json:"bytes"`
		URL      string `json:"url"`
	}
	var out []entry
	for _, f := range files {
		fi, err := os.Stat(f)
		if err != nil {
			continue
		}
		base := filepath.Base(f)
		out = append(out, entry{Filename: base, Bytes: fi.Size(), URL: "/output/" + base})
	}
	if out == nil {
		out = []entry{}
	}
	writeJSON(w, 200, out)
}
func (s *Server) handleQuit(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "method not allowed", 405)
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
	go func() {
		time.Sleep(200 * time.Millisecond)
		os.Exit(0)
	}()
}

