package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"anima/internal/jobs"
	"anima/internal/server"
)

func runServe(args []string) {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	port := fs.String("port", "", "serve port")
	host := fs.String("host", "", "comfy host")
	root := fs.String("root", "", "anima root (contains Anime_Turbo_api.json)")
	openFlag := fs.Bool("open", false, "open gallery in browser")
	noOpen := fs.Bool("no-open", false, "do not open browser")
	_ = fs.Parse(args)
	// bare invocation (no args) implies --open; explicit --open/--no-open wins
	wantOpen := *openFlag
	if len(args) == 0 && !*noOpen && !*openFlag {
		wantOpen = true
	}
	// legacy: main() injects --open for zero-arg exe; also respect --open flag
	if *noOpen {
		wantOpen = false
	}

	// env overrides
	envPort := os.Getenv("ANIMA_PORT")
	if *port == "" {
		if envPort != "" {
			*port = envPort
		} else {
			*port = "8765"
		}
	}
	if *host == "" {
		*host = os.Getenv("COMFY_HOST")
		if *host == "" {
			*host = "http://127.0.0.1:8188"
		}
	}
	if *root == "" {
		*root = server.FindRoot()
	}
	// load workflow defaults at startup
	wfPath := filepath.Join(*root, "Anime_Turbo_api.json")
	if _, err := jobs.LoadWorkflowDefaults(wfPath); err != nil {
		fmt.Fprintf(os.Stderr, "warn: load workflow defaults %s: %v (using er_sde/simple/1.0)\n", wfPath, err)
	} else {
		fmt.Printf("workflow defaults: %+v from %s\n", jobs.GlobalWorkflowDefaults, wfPath)
	}

	srv := server.New(*root, *host)
	addr := "127.0.0.1:" + strings.TrimPrefix(*port, ":")
	// if port contains colon, use as-is
	if strings.Contains(*port, ":") {
		addr = *port
	}
	httpSrv := &http.Server{Addr: addr, Handler: srv.Mux}
	go func() {
		fmt.Printf("anima serve at http://%s  (root=%s comfy=%s)\n", addr, *root, *host)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "serve error: %v\n", err)
			os.Exit(1)
		}
	}()
	// give server a moment to bind, then open browser if requested
	if wantOpen {
		url := "http://" + addr + "/"
		// addr is 127.0.0.1:PORT — browser URL keeps it
		time.Sleep(400 * time.Millisecond)
		openBrowser(url)
		fmt.Printf("open %s\n", url)
	}
	// graceful shutdown
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
	<-ch
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(ctx)
	fmt.Println("shutdown")
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}
