package server

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"anima/internal/comfy"
)

type runState struct {
	mu       sync.Mutex
	paused   bool
	stopped  bool
	cancelFn context.CancelFunc
}

type Server struct {
	Root        string
	ComfyHost   string
	Mux         *http.ServeMux
	mu          sync.Mutex
	running     map[string]bool
	runningMu   sync.Mutex
	runStates   map[string]*runState
	runStatesMu sync.Mutex
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
		runStates:   map[string]*runState{},
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
	s.Mux.HandleFunc("/api/run/pause", s.handleRunPause)
	s.Mux.HandleFunc("/api/run/resume", s.handleRunResume)
	s.Mux.HandleFunc("/api/run/stop", s.handleRunStop)
	s.Mux.HandleFunc("/api/run/status", s.handleRunStatus)
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
