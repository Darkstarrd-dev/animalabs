package server

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"anima/internal/jobs"
)

func (s *Server) handleDates(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	jobsDir := filepath.Join(s.Root, "jobs")
	entries, err := os.ReadDir(jobsDir)
	if err != nil {
		writeJSON(w, 200, []any{})
		return
	}
	var out []jobs.DateEntry
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		date := e.Name()
		jobFiles, _ := filepath.Glob(filepath.Join(jobsDir, date, "*.json"))
		jobCount := len(jobFiles)
		outPattern := filepath.Join(s.Root, "output", date, "*", "*.png")
		imgs, _ := filepath.Glob(outPattern)
		imageCount := len(imgs)
		out = append(out, jobs.DateEntry{Date: date, JobCount: jobCount, ImageCount: imageCount})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Date < out[j].Date })
	if out == nil {
		out = []jobs.DateEntry{}
	}
	writeJSON(w, 200, out)
}

func (s *Server) handleJobs(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	date := r.URL.Query().Get("date")
	if date == "" {
		writeJSON(w, 400, map[string]string{"error": "date required"})
		return
	}
	pattern := filepath.Join(s.Root, "jobs", date, "*.json")
	files, _ := filepath.Glob(pattern)
	var summaries []jobs.JobSummary
	for _, f := range files {
		j, err := jobs.Load(f)
		if err != nil {
			continue
		}
		counts := jobs.ComputeCounts(j)
		jobID := j.JobID
		if jobID == "" {
			jobID = strings.TrimSuffix(filepath.Base(f), ".json")
		}
		summaries = append(summaries, jobs.JobSummary{
			JobID:     jobID,
			File:      filepath.Base(f),
			ItemCount: len(j.Items),
			Counts:    counts,
		})
	}
	sort.Slice(summaries, func(i, j int) bool { return summaries[i].JobID < summaries[j].JobID })
	if summaries == nil {
		summaries = []jobs.JobSummary{}
	}
	writeJSON(w, 200, summaries)
}
