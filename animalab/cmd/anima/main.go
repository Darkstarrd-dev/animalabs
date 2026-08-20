package main

import (
	"fmt"
	"os"
)

func main() {
	// No args: default to serve with gallery auto-open (double-click friendly)
	if len(os.Args) < 2 {
		runServe([]string{"--open"})
		return
	}
	if os.Args[1] == "--help" || os.Args[1] == "-h" || os.Args[1] == "help" || os.Args[1] == "-help" {
		usage()
		return
	}
	if len(os.Args[1]) > 0 && os.Args[1][0] == '-' {
		runServe(os.Args[1:])
		return
	}
	switch os.Args[1] {
	case "kill":
		runKill(os.Args[2:])
	case "serve":
		runServe(os.Args[2:])
	case "run":
		runRun(os.Args[2:])
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand %q\n", os.Args[1])
		usage()
		os.Exit(1)
	}
}

func usage() {
	fmt.Print(`anima - Anima batch & gallery

Usage:
  anima                          # no args: serve on :8765 + open gallery
  anima serve [--port 8765] [--host 127.0.0.1:8188] [--root .] [--open] [--no-open]
  anima run jobs/<date>/<job>.json [--dry-run] [--limit N] [--force]
  anima kill [--port 8765]       # kill anima tasks, free port/memory

Env:
  COMFY_HOST  comfyui host (default http://127.0.0.1:8188)
  ANIMA_PORT  serve port (default 8765)`)
}
