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

func (s *Server) handleJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	date := r.URL.Query().Get("date")
	jobName := r.URL.Query().Get("job")
	if date == "" || jobName == "" {
		writeJSON(w, 400, map[string]string{"error": "date and job required"})
		return
	}
	if !strings.HasSuffix(jobName, ".json") {
		jobName += ".json"
	}
	path := filepath.Join(s.Root, "jobs", date, jobName)
	clean := filepath.Clean(path)
	expectedPrefix := filepath.Join(s.Root, "jobs")
	if !strings.HasPrefix(clean, expectedPrefix) {
		http.Error(w, "forbidden", 403)
		return
	}
	j, err := jobs.Load(clean)
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "job not found"})
		return
	}
	for i, it := range j.Items {
		if it.Output != nil && !it.Output.Deleted {
			imgPath := filepath.Join(s.Root, "output", date, strings.TrimSuffix(filepath.Base(clean), ".json"), it.Output.Filename)
			if _, err := os.Stat(imgPath); err != nil {
				alt := filepath.Join(s.Root, "output", date, strings.TrimSuffix(filepath.Base(clean), ".json"), filepath.Base(it.Output.Filename))
				if _, err2 := os.Stat(alt); err2 != nil {
					j.Items[i].Output.Missing = true
				}
			}
			for k, bo := range it.Output.BatchOutputs {
				if bo.Deleted { continue }
				sib := filepath.Join(s.Root, "output", date, strings.TrimSuffix(filepath.Base(clean), ".json"), bo.Filename)
				if _, err := os.Stat(sib); err != nil {
					j.Items[i].Output.BatchOutputs[k].Missing = true
				}
			}
		}
	}
	writeJSON(w, 200, j)
}

func (s *Server) handleReview(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "method not allowed", 405)
		return
	}
	var req struct {
		Date    string   `json:"date"`
		Job     string   `json:"job"`
		ItemID  string   `json:"item_id"`
		Verdict string   `json:"verdict"`
		Reason  string   `json:"reason"`
		Tags    []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}
	if req.Date == "" || req.Job == "" || req.ItemID == "" {
		writeJSON(w, 400, map[string]string{"error": "date, job, item_id required"})
		return
	}
	if req.Verdict != "kept" && req.Verdict != "rejected" && req.Verdict != "unreviewed" {
		writeJSON(w, 400, map[string]string{"error": "verdict must be kept|rejected|unreviewed"})
		return
	}
	if !strings.HasSuffix(req.Job, ".json") {
		req.Job += ".json"
	}
	path := filepath.Join(s.Root, "jobs", req.Date, req.Job)
	clean := filepath.Clean(path)
	if !strings.HasPrefix(clean, filepath.Join(s.Root, "jobs")) {
		http.Error(w, "forbidden", 403)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	j, err := jobs.Load(clean)
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "job not found"})
		return
	}
	found := false
	var updated *jobs.Item
	for i := range j.Items {
		if j.Items[i].ID == req.ItemID {
			if j.Items[i].Review == nil {
				j.Items[i].Review = &jobs.Review{}
			}
			j.Items[i].Review.Verdict = req.Verdict
			j.Items[i].Review.Reason = req.Reason
			j.Items[i].Review.Tags = jobs.NormalizeTags(req.Tags)
			j.Items[i].Review.ReviewedAt = time.Now().UTC().Format(time.RFC3339)
			updated = &j.Items[i]
			found = true
			break
		}
	}
	if !found {
		writeJSON(w, 404, map[string]string{"error": "item not found"})
		return
	}
	if err := jobs.AtomicSave(clean, j); err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, updated)
}

func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "method not allowed", 405)
		return
	}
	var req struct {
		Date   string `json:"date"`
		Job    string `json:"job"`
		ItemID string `json:"item_id"`
		Hard   bool   `json:"hard"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}
	if req.Date == "" || req.Job == "" || req.ItemID == "" {
		writeJSON(w, 400, map[string]string{"error": "date, job, item_id required"})
		return
	}
	if !strings.HasSuffix(req.Job, ".json") {
		req.Job += ".json"
	}
	path := filepath.Join(s.Root, "jobs", req.Date, req.Job)
	clean := filepath.Clean(path)
	if !strings.HasPrefix(clean, filepath.Join(s.Root, "jobs")) {
		http.Error(w, "forbidden", 403)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	j, err := jobs.Load(clean)
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "job not found"})
		return
	}
	found := false
	for i := range j.Items {
		if j.Items[i].ID == req.ItemID {
			found = true
			if req.Hard {
				if j.Items[i].Output != nil && j.Items[i].Output.Filename != "" {
					imgPath := filepath.Join(s.Root, "output", req.Date, strings.TrimSuffix(req.Job, ".json"), j.Items[i].Output.Filename)
					_ = os.Remove(imgPath)
					for _, bo := range j.Items[i].Output.BatchOutputs {
						_ = os.Remove(filepath.Join(s.Root, "output", req.Date, strings.TrimSuffix(req.Job, ".json"), bo.Filename))
					}
					j.Items[i].Output.Deleted = true
					for k := range j.Items[i].Output.BatchOutputs {
						j.Items[i].Output.BatchOutputs[k].Deleted = true
					}
				}
				if j.Items[i].Review == nil {
					j.Items[i].Review = &jobs.Review{}
				}
				j.Items[i].Review.Verdict = "rejected"
				j.Items[i].Review.ReviewedAt = time.Now().UTC().Format(time.RFC3339)
			} else {
				if j.Items[i].Review == nil {
					j.Items[i].Review = &jobs.Review{}
				}
				j.Items[i].Review.Verdict = "rejected"
				j.Items[i].Review.ReviewedAt = time.Now().UTC().Format(time.RFC3339)
			}
			break
		}
	}
	if !found {
		writeJSON(w, 404, map[string]string{"error": "item not found"})
		return
	}
	if err := jobs.AtomicSave(clean, j); err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "hard": req.Hard})
}
