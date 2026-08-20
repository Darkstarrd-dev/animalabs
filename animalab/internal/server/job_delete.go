package server

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func (s *Server) handleJobDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "method not allowed", 405)
		return
	}
	var req struct {
		Date string `json:"date"`
		Job  string `json:"job"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}
	if req.Date == "" || req.Job == "" {
		writeJSON(w, 400, map[string]string{"error": "date and job required"})
		return
	}
	if !strings.HasSuffix(req.Job, ".json") {
		req.Job += ".json"
	}
	path := filepath.Join(s.Root, "jobs", req.Date, req.Job)
	clean := filepath.Clean(path)
	expectedPrefix := filepath.Join(s.Root, "jobs")
	if !strings.HasPrefix(clean, expectedPrefix) {
		http.Error(w, "forbidden", 403)
		return
	}
	key := req.Date + "/" + req.Job
	s.runningMu.Lock()
	if s.running[key] {
		s.runningMu.Unlock()
		writeJSON(w, 409, map[string]string{"error": "job is running"})
		return
	}
	s.runningMu.Unlock()
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := os.Stat(clean); err != nil {
		writeJSON(w, 404, map[string]string{"error": "job not found"})
		return
	}
	if err := os.Remove(clean); err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	outDir := filepath.Join(s.Root, "output", req.Date, strings.TrimSuffix(req.Job, ".json"))
	_ = os.RemoveAll(outDir)
	writeJSON(w, 200, map[string]any{"ok": true})
}
