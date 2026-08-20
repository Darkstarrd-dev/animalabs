package server

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"anima/internal/jobs"
)

func (s *Server) handleRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "method not allowed", 405)
		return
	}
	date := r.URL.Query().Get("date")
	jobName := r.URL.Query().Get("job")
	force := r.URL.Query().Get("force") == "1"
	group := r.URL.Query().Get("group")
	subgroup := r.URL.Query().Get("subgroup")
	itemsParam := r.URL.Query().Get("items")
	// header payload (preset/unet/loras) may come as JSON body; keep for runJob as global override
	var hdrBody struct {
		Date     string         `json:"date"`
		Job      string         `json:"job"`
		Force    bool           `json:"force"`
		Preset    string         `json:"preset"`
		UnetName  string         `json:"unet_name"`
		Loras     []jobs.LoraSlot `json:"loras"`
		Steps     *int            `json:"steps,omitempty"`
		Cfg       *float64        `json:"cfg,omitempty"`
		Sampler   string          `json:"sampler,omitempty"`
		Scheduler string          `json:"scheduler,omitempty"`
		Batch     *int            `json:"batch,omitempty"`
		Group     string         `json:"group"`
		Subgroup  string         `json:"subgroup"`
		Items     []string       `json:"items"`
	}
	hdrBytes, _ := io.ReadAll(r.Body)
	if len(hdrBytes) > 0 {
		_ = json.Unmarshal(hdrBytes, &hdrBody)
		if date == "" {
			date = hdrBody.Date
		}
		if jobName == "" {
			jobName = hdrBody.Job
		}
		if hdrBody.Force {
			force = true
		}
		if group == "" && hdrBody.Group != "" {
			group = hdrBody.Group
		}
		if subgroup == "" && hdrBody.Subgroup != "" {
			subgroup = hdrBody.Subgroup
		}
		if itemsParam == "" && len(hdrBody.Items) > 0 {
			itemsParam = strings.Join(hdrBody.Items, ",")
		}
	}
	if date == "" || jobName == "" {
		writeJSON(w, 400, map[string]string{"error": "date and job required"})
		return
	}
	if !strings.HasSuffix(jobName, ".json") {
		jobName += ".json"
	}
	key := date + "/" + jobName
	s.runningMu.Lock()
	if s.running[key] {
		s.runningMu.Unlock()
		writeJSON(w, 409, map[string]string{"error": "already running"})
		return
	}
	s.running[key] = true
	s.runningMu.Unlock()
	var filterItems []string
	if itemsParam != "" {
		for _, s := range strings.Split(itemsParam, ",") {
			if v := strings.TrimSpace(s); v != "" {
				filterItems = append(filterItems, v)
			}
		}
	}
	// when a scene group is targeted, force re-run that group's items even if done
	if group != "" || subgroup != "" || len(filterItems) > 0 {
		force = true
	}
	go s.runJob(date, jobName, force, hdrBody.Preset, hdrBody.UnetName, hdrBody.Loras, hdrBody.Steps, hdrBody.Cfg, hdrBody.Sampler, hdrBody.Scheduler, hdrBody.Batch, filterItems, group, subgroup)
	writeJSON(w, 200, map[string]any{"started": true, "date": date, "job": jobName, "force": force, "preset": hdrBody.Preset, "unet_name": hdrBody.UnetName, "loras": hdrBody.Loras, "steps": hdrBody.Steps, "cfg": hdrBody.Cfg, "sampler": hdrBody.Sampler, "scheduler": hdrBody.Scheduler, "batch": hdrBody.Batch})
}
func parseRunKey(r *http.Request) (string, string) {
	date := r.URL.Query().Get("date")
	job := r.URL.Query().Get("job")
	if date == "" || job == "" {
		var body struct{ Date string `json:"date"`; Job string `json:"job"` }
		b, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(b, &body)
		if date == "" { date = body.Date }
		if job == "" { job = body.Job }
	}
	if job != "" && !strings.HasSuffix(job, ".json") { job += ".json" }
	if date == "" || job == "" { return "", "" }
	return date + "/" + job, job
}
func (s *Server) handleRunPause(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { http.Error(w, "method not allowed", 405); return }
	key, _ := parseRunKey(r)
	if key == "" { writeJSON(w, 400, map[string]string{"error": "date and job required"}); return }
	s.runStatesMu.Lock()
	rs := s.runStates[key]
	s.runStatesMu.Unlock()
	if rs == nil { writeJSON(w, 404, map[string]string{"error": "not running"}); return }
	rs.mu.Lock()
	rs.paused = true
	rs.mu.Unlock()
	writeJSON(w, 200, map[string]any{"ok": true, "paused": true, "key": key})
}
func (s *Server) handleRunResume(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { http.Error(w, "method not allowed", 405); return }
	key, _ := parseRunKey(r)
	if key == "" { writeJSON(w, 400, map[string]string{"error": "date and job required"}); return }
	s.runStatesMu.Lock()
	rs := s.runStates[key]
	s.runStatesMu.Unlock()
	if rs == nil { writeJSON(w, 404, map[string]string{"error": "not running"}); return }
	rs.mu.Lock()
	rs.paused = false
	rs.mu.Unlock()
	writeJSON(w, 200, map[string]any{"ok": true, "paused": false, "key": key})
}
func (s *Server) handleRunStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { http.Error(w, "method not allowed", 405); return }
	key, _ := parseRunKey(r)
	if key == "" { writeJSON(w, 400, map[string]string{"error": "date and job required"}); return }
	s.runStatesMu.Lock()
	rs := s.runStates[key]
	s.runStatesMu.Unlock()
	if rs == nil { writeJSON(w, 404, map[string]string{"error": "not running"}); return }
	rs.mu.Lock()
	rs.stopped = true
	rs.paused = false
	if rs.cancelFn != nil { rs.cancelFn() }
	rs.mu.Unlock()
	writeJSON(w, 200, map[string]any{"ok": true, "stopped": true, "key": key})
}
func (s *Server) handleRunStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" { http.Error(w, "method not allowed", 405); return }
	date := r.URL.Query().Get("date")
	job := r.URL.Query().Get("job")
	if job != "" && !strings.HasSuffix(job, ".json") { job += ".json" }
	key := date + "/" + job
	s.runningMu.Lock()
	running := s.running[key]
	s.runningMu.Unlock()
	s.runStatesMu.Lock()
	rs := s.runStates[key]
	s.runStatesMu.Unlock()
	paused, stopped := false, false
	if rs != nil {
		rs.mu.Lock()
		paused = rs.paused
		stopped = rs.stopped
		rs.mu.Unlock()
	}
	writeJSON(w, 200, map[string]any{"running": running, "paused": paused, "stopped": stopped, "key": key})
}

