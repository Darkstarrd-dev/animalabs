package server

import (
	"io"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"anima/internal/comfy"
	"anima/internal/jobs"
)

type Server struct {
	Root        string
	ComfyHost   string
	Mux         *http.ServeMux
	mu          sync.Mutex
	running     map[string]bool
	runningMu   sync.Mutex
	comfyClient *comfy.Client
}

func New(root, comfyHost string) *Server {
	if root == "" {
		root = FindRoot()
	}
	if comfyHost == "" {
		comfyHost = os.Getenv("COMFY_HOST")
		if comfyHost == "" {
			comfyHost = "http://127.0.0.1:8188"
		}
	}
	s := &Server{
		Root:        root,
		ComfyHost:   comfyHost,
		Mux:         http.NewServeMux(),
		running:     map[string]bool{},
		comfyClient: comfy.NewClient(comfyHost, filepath.Join(root, "Anime_Turbo_api.json")),
	}
	s.routes()
	return s
}

func FindRoot() string {
	cwd, _ := os.Getwd()
	candidates := []string{cwd, filepath.Join(cwd, "Anima"), filepath.Join(cwd, ".."), filepath.Join(cwd, "..", "Anima")}
	for _, d := range candidates {
		if _, err := os.Stat(filepath.Join(d, "Anime_Turbo_api.json")); err == nil {
			return d
		}
	}
	exe, err := os.Executable()
	if err == nil {
		dir := filepath.Dir(exe)
		for range 6 {
			if _, err := os.Stat(filepath.Join(dir, "Anime_Turbo_api.json")); err == nil {
				return dir
			}
			if _, err := os.Stat(filepath.Join(dir, "Anima", "Anime_Turbo_api.json")); err == nil {
				return filepath.Join(dir, "Anima")
			}
			if _, err := os.Stat(filepath.Join(dir, "animalab", "web", "index.html")); err == nil {
				return dir
			}
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}
	return cwd
}

func (s *Server) routes() {
	s.Mux.HandleFunc("/", s.handleRoot)
	s.Mux.HandleFunc("/web/", s.handleWeb)
	s.Mux.HandleFunc("/output/", s.handleOutput)
	s.Mux.HandleFunc("/api/dates", s.handleDates)
	s.Mux.HandleFunc("/api/jobs", s.handleJobs)
	s.Mux.HandleFunc("/api/job", s.handleJob)
	s.Mux.HandleFunc("/api/job/delete", s.handleJobDelete)
	s.Mux.HandleFunc("/api/review", s.handleReview)
	s.Mux.HandleFunc("/api/delete", s.handleDelete)
	s.Mux.HandleFunc("/api/run", s.handleRun)
	s.Mux.HandleFunc("/api/export", s.handleExport)
	s.Mux.HandleFunc("/api/presets", s.handlePresets)
	s.Mux.HandleFunc("/api/meta", s.handleMeta)
	s.Mux.HandleFunc("/api/legacy", s.handleLegacy)
	s.Mux.HandleFunc("/api/quit", s.handleQuit)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}

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

func (s *Server) handleRoot(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	indexPath := filepath.Join(s.Root, "web", "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		alt := filepath.Join(s.Root, "animalab", "web", "index.html")
		if _, err2 := os.Stat(alt); err2 == nil {
			indexPath = alt
		} else {
			writeJSON(w, 404, map[string]string{"error": "web/index.html not found, run anima serve from Anima dir"})
			return
		}
	}
	http.ServeFile(w, r, indexPath)
}

func (s *Server) handleWeb(w http.ResponseWriter, r *http.Request) {
	rel := strings.TrimPrefix(r.URL.Path, "/web/")
	if rel == "" {
		http.NotFound(w, r)
		return
	}
	clean := filepath.Clean(rel)
	abs := filepath.Join(s.Root, "web", clean)
	if _, err := os.Stat(abs); err != nil {
		alt := filepath.Join(s.Root, "animalab", "web", clean)
		if _, err2 := os.Stat(alt); err2 == nil {
			abs = alt
		}
	}
	if !strings.HasPrefix(filepath.Clean(abs), filepath.Join(s.Root, "web")) && !strings.HasPrefix(filepath.Clean(abs), filepath.Join(s.Root, "animalab", "web")) {
		http.Error(w, "forbidden", 403)
		return
	}
	http.ServeFile(w, r, abs)
}

func (s *Server) handleOutput(w http.ResponseWriter, r *http.Request) {
	rel := strings.TrimPrefix(r.URL.Path, "/output/")
	clean := filepath.Clean(rel)
	if strings.Contains(clean, "..") {
		http.Error(w, "forbidden", 403)
		return
	}
	abs := filepath.Join(s.Root, "output", clean)
	if !strings.HasPrefix(filepath.Clean(abs), filepath.Join(s.Root, "output")) {
		http.Error(w, "forbidden", 403)
		return
	}
	w.Header().Set("Cache-Control", "no-cache")
	if strings.HasSuffix(strings.ToLower(abs), ".png") {
		w.Header().Set("Content-Type", "image/png")
	}
	http.ServeFile(w, r, abs)
}

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
					j.Items[i].Output.Deleted = true
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
		Preset   string         `json:"preset"`
		UnetName string         `json:"unet_name"`
		Loras    []jobs.LoraSlot `json:"loras"`
		Group    string         `json:"group"`
		Subgroup string         `json:"subgroup"`
		Items    []string       `json:"items"`
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
	go s.runJob(date, jobName, force, hdrBody.Preset, hdrBody.UnetName, hdrBody.Loras, filterItems, group, subgroup)
	writeJSON(w, 200, map[string]any{"started": true, "date": date, "job": jobName, "force": force, "preset": hdrBody.Preset, "unet_name": hdrBody.UnetName, "loras": hdrBody.Loras})
}

func (s *Server) runJob(date, jobFile string, force bool, hdrPreset, hdrUnet string, hdrLoras []jobs.LoraSlot, filterItems []string, filterGroup, filterSubgroup string) {
	key := date + "/" + jobFile
	defer func() {
		s.runningMu.Lock()
		delete(s.running, key)
		s.runningMu.Unlock()
	}()
	jobPath := filepath.Join(s.Root, "jobs", date, jobFile)
	jobName := strings.TrimSuffix(jobFile, ".json")

	s.mu.Lock()
	j0, err := jobs.Load(jobPath)
	s.mu.Unlock()
	if err != nil {
		return
	}
	// merge header global override into job defaults (does not persist to disk, only this run)
	// preset/unet/loras from header act as run-time global defaults, overriding job defaults
	if hdrPreset != "" && jobs.ValidPresets[hdrPreset] {
		hdrPresetCopy := hdrPreset
		j0.Defaults.Preset = &hdrPresetCopy
	}
	if hdrUnet != "" {
		hdrUnetCopy := hdrUnet
		j0.Defaults.UnetName = &hdrUnetCopy
	}
	if hdrLoras != nil {
		j0.Defaults.Loras = hdrLoras
	}
	var indices []int
	// order to match frontend: grouped display order (see jobs.OrderedIndices)
	indices = jobs.OrderedIndices(j0, force)
	if len(filterItems) > 0 || filterGroup != "" {
		wanted := map[string]bool{}
		for _, id := range filterItems { wanted[id] = true }
		filtered := []int{}
		for _, idx := range indices {
			it := j0.Items[idx]
			if len(filterItems) > 0 {
				if wanted[it.ID] { filtered = append(filtered, idx) }
				continue
			}
			if filterGroup != "" && it.GroupKey() != filterGroup { continue }
			if filterSubgroup != "" && it.SubgroupKey(j0) != filterSubgroup { continue }
			filtered = append(filtered, idx)
		}
		indices = filtered
		// if nothing matched but force was implied, still run nothing rather than whole job
	}
	for _, idx := range indices {
		// reload for resolve (handles warnings)
		s.mu.Lock()
		jCheck, _ := jobs.Load(jobPath)
		s.mu.Unlock()
		if jCheck == nil {
			continue
		}
		// re-apply header globals for resolve
		if hdrPreset != "" && jobs.ValidPresets[hdrPreset] {
			hdrPresetCopy2 := hdrPreset
			jCheck.Defaults.Preset = &hdrPresetCopy2
		}
		if hdrUnet != "" {
			hdrUnetCopy2 := hdrUnet
			jCheck.Defaults.UnetName = &hdrUnetCopy2
		}
		if hdrLoras != nil {
			jCheck.Defaults.Loras = hdrLoras
		}
		resolved := jCheck.Resolve(idx)
		valErrs := jCheck.Validate()
		hasErr := false
		for _, ve := range valErrs {
			if ve.Index == idx {
				hasErr = true
				s.mu.Lock()
				jj, _ := jobs.Load(jobPath)
				jj.Items[idx].Status = "failed"
				jj.Items[idx].Error = ve.Field + ": " + ve.Message
				jj.Items[idx].Warnings = resolved.Warnings
				_ = jobs.AtomicSave(jobPath, jj)
				s.mu.Unlock()
				break
			}
		}
		if hasErr {
			continue
		}
		s.mu.Lock()
		jj, _ := jobs.Load(jobPath)
		jj.Items[idx].Status = "queued"
		_ = jobs.AtomicSave(jobPath, jj)
		s.mu.Unlock()

		prefix := jobName + "_" + resolved.ID
		loraReqs := []comfy.LoraReq{}
		for _, lr := range resolved.Loras {
			loraReqs = append(loraReqs, comfy.LoraReq{Name: lr.Name, Weight: lr.Weight})
		}
		req := comfy.SubmitReq{
			Width:     resolved.Width,
			Height:    resolved.Height,
			Steps:     resolved.Steps,
			Seed:      resolved.Seed,
			Positive:  resolved.PositivePrompt,
			Negative:  resolved.NegativePrompt,
			Sampler:   resolved.Sampler,
			Scheduler: resolved.Scheduler,
			Cfg:       resolved.Cfg,
			Prefix:    prefix,
			Preset:    resolved.Preset,
			UnetName:  resolved.UnetName,
			Loras:     loraReqs,
		}
		ctx, cancel := context.WithTimeout(context.Background(), 190*time.Second)
		result, err := s.comfyClient.Submit(ctx, req)
		cancel()
		s.mu.Lock()
		j3, _ := jobs.Load(jobPath)
		if err != nil {
			j3.Items[idx].Status = "failed"
			j3.Items[idx].Error = err.Error()
			j3.Items[idx].Warnings = resolved.Warnings
			_ = jobs.AtomicSave(jobPath, j3)
			s.mu.Unlock()
			continue
		}
		outDir := filepath.Join(s.Root, "output", date, jobName)
		_ = os.MkdirAll(outDir, 0755)
		filename := fmt.Sprintf("%s_%d.png", resolved.ID, resolved.Seed)
		outPath := filepath.Join(outDir, filename)
		if err := os.WriteFile(outPath, result.Bytes, 0644); err != nil {
			j3.Items[idx].Status = "failed"
			j3.Items[idx].Error = fmt.Sprintf("write output: %v", err)
			_ = jobs.AtomicSave(jobPath, j3)
			s.mu.Unlock()
			continue
		}
		sha := sha256.Sum256(result.Bytes)
		sha16 := hex.EncodeToString(sha[:])[:16]
		j3.Items[idx].Status = "done"
		j3.Items[idx].Error = ""
		j3.Items[idx].Warnings = resolved.Warnings
		j3.Items[idx].Output = &jobs.Output{
			Filename:  filename,
			W:         result.W,
			H:         result.H,
			Bytes:     len(result.Bytes),
			SHA16:     sha16,
			PromptID:  result.PromptID,
			ElapsedMs: result.ElapsedMs,
		}
		_ = jobs.AtomicSave(jobPath, j3)
		s.mu.Unlock()
	}
}

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
	writeJSON(w, 200, map[string]any{"unets": unets, "loras": uniqLoras})
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
