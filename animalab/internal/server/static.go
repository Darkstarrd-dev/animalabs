package server

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

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
