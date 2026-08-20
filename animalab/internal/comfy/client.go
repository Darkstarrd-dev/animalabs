package comfy

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Client struct {
	Host         string
	TemplatePath string
	HTTP         *http.Client
}

func NewClient(host, templatePath string) *Client {
	if host == "" {
		host = os.Getenv("COMFY_HOST")
		if host == "" {
			host = "http://127.0.0.1:8188"
		}
	}
	if templatePath == "" {
		templatePath = findTemplate()
	}
	return &Client{
		Host:         strings.TrimRight(host, "/"),
		TemplatePath: templatePath,
		HTTP:         &http.Client{Timeout: 30 * time.Second},
	}
}

func findTemplate() string {
	candidates := []string{
		"Anime_Turbo_api.json",
		"Anima/Anime_Turbo_api.json",
		filepath.Join(exeDir(), "Anime_Turbo_api.json"),
		filepath.Join(exeDir(), "..", "Anime_Turbo_api.json"),
		filepath.Join(exeDir(), "..", "..", "Anime_Turbo_api.json"),
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	dir, _ := os.Getwd()
	for range 6 {
		p := filepath.Join(dir, "Anime_Turbo_api.json")
		if _, err := os.Stat(p); err == nil {
			return p
		}
		p = filepath.Join(dir, "Anima", "Anime_Turbo_api.json")
		if _, err := os.Stat(p); err == nil {
			return p
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "Anime_Turbo_api.json"
}

func exeDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exe)
}
