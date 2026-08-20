package main

import (
	"context"
	"encoding/json"
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

	"anima/internal/comfy"
	"anima/internal/jobs"
	"anima/internal/server"
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


func runKill(args []string) {
	fs := flag.NewFlagSet("kill", flag.ExitOnError)
	port := fs.String("port", "", "port to free (default all anima ports: ANIMA_PORT / 8765)")
	_ = fs.Parse(args)
	targetPort := *port
	if targetPort == "" {
		if p := os.Getenv("ANIMA_PORT"); p != "" {
			targetPort = p
		} else {
			targetPort = "8765"
		}
	}
	killed := 0
	switch runtime.GOOS {
	case "windows":
		killed += killByPortWindows(targetPort)
		killed += killByImageWindows("anima.exe")
	default:
		killed += killByPortUnix(targetPort)
		killed += killByPgrepUnix("anima")
	}
	if killed == 0 {
		fmt.Println("kill: no anima tasks found")
	} else {
		fmt.Printf("kill: terminated %d task(s)\n", killed)
	}
}

func killByPortWindows(port string) int {
	myPid := fmt.Sprintf("%d", os.Getpid())
	out, _ := exec.Command("netstat", "-ano").Output()
	lines := strings.Split(string(out), "\n")
	killed := 0
	seen := map[string]bool{}
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if !strings.Contains(l, ":"+port) || !strings.Contains(strings.ToUpper(l), "LISTENING") {
			continue
		}
		fields := strings.Fields(l)
		if len(fields) < 5 {
			continue
		}
		pid := fields[len(fields)-1]
		if seen[pid] {
			continue
		}
		seen[pid] = true
		if pid == "0" || pid == "4" || pid == myPid {
			continue
		}
		if isAnimaPid(pid) {
			_ = exec.Command("taskkill", "/PID", pid, "/F").Run()
			fmt.Printf("kill port %s pid %s\n", port, pid)
			killed++
		}
	}
	return killed
}

func killByImageWindows(image string) int {
	myPid := fmt.Sprintf("%d", os.Getpid())
	out, _ := exec.Command("tasklist", "/FI", "IMAGENAME eq "+image).Output()
	killed := 0
	for _, l := range strings.Split(string(out), "\n") {
		l = strings.TrimSpace(l)
		if !strings.HasPrefix(strings.ToLower(l), strings.ToLower(image)) {
			continue
		}
		fields := strings.Fields(l)
		if len(fields) < 2 {
			continue
		}
		pid := fields[1]
		if pid == myPid {
			continue
		}
		_ = exec.Command("taskkill", "/PID", pid, "/F").Run()
		fmt.Printf("kill image %s pid %s\n", image, pid)
		killed++
	}
	return killed
}

func killByPortUnix(port string) int {
	killed := 0
	if out, err := exec.Command("lsof", "-ti", ":"+port).Output(); err == nil {
		for _, pid := range strings.Fields(string(out)) {
			_ = exec.Command("kill", "-9", pid).Run()
			fmt.Printf("kill port %s pid %s\n", port, pid)
			killed++
		}
	} else if out, err := exec.Command("fuser", "-k", port+"/tcp").Output(); err == nil {
		_ = out
		killed++
	}
	return killed
}

func killByPgrepUnix(pattern string) int {
	out, _ := exec.Command("pgrep", "-f", pattern).Output()
	killed := 0
	for _, pid := range strings.Fields(string(out)) {
		_ = exec.Command("kill", "-9", pid).Run()
		fmt.Printf("kill pgrep %s pid %s\n", pattern, pid)
		killed++
	}
	return killed
}

func isAnimaPid(pid string) bool {
	out, _ := exec.Command("tasklist", "/FI", "PID eq "+pid).Output()
	s := strings.ToLower(string(out))
	return strings.Contains(s, "anima")
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

func runRun(args []string) {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	dryRun := fs.Bool("dry-run", false, "only print resolved 9 dims")
	limit := fs.Int("limit", 0, "max items to run (0=all)")
	force := fs.Bool("force", false, "re-run done items")
	// support flags after positional: extract known flags manually before Parse
	var filtered []string
	var positional []string
	for i := 0; i < len(args); i++ {
		a := args[i]
		if a == "--dry-run" {
			filtered = append(filtered, a)
		} else if a == "--force" {
			filtered = append(filtered, a)
		} else if a == "--limit" && i+1 < len(args) {
			filtered = append(filtered, a, args[i+1]); i++
		} else if len(a) > 8 && a[:8] == "--limit=" {
			filtered = append(filtered, a)
		} else if len(a) > 0 && a[0] == '-' {
			filtered = append(filtered, a)
		} else {
			positional = append(positional, a)
		}
	}
	// Parse flags first, then append positional for fs.Args()
	_ = fs.Parse(filtered)
	rest := fs.Args()
	if len(rest) == 0 {
		rest = positional
	} else {
		rest = append(rest, positional...)
	}
	if len(rest) < 1 {
		fmt.Fprintln(os.Stderr, "run: need jobs/<date>/<job>.json")
		os.Exit(1)
	}
	jobPath := rest[0]
	// resolve root for workflow defaults
	root := server.FindRoot()
	wfPath := filepath.Join(root, "Anime_Turbo_api.json")
	if _, err := jobs.LoadWorkflowDefaults(wfPath); err != nil {
		fmt.Fprintf(os.Stderr, "warn: load workflow defaults: %v\n", err)
	}

	// load job
	j, err := jobs.Load(jobPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "load %s: %v\n", jobPath, err)
		os.Exit(1)
	}
	jobDir := filepath.Dir(jobPath)
	// derive date/job name
	date := j.Date
	if date == "" {
		// infer from path jobs/<date>/<file>
		date = filepath.Base(filepath.Dir(jobPath))
	}
	jobName := j.JobID
	if jobName == "" {
		jobName = strings.TrimSuffix(filepath.Base(jobPath), ".json")
	}

	if *dryRun {
		valErrs := j.Validate()
		for idx := range j.Items {
			r := j.Resolve(idx)
			warnStr := ""
			if len(r.Warnings) > 0 {
				warnStr = fmt.Sprintf(" warnings=%v", r.Warnings)
			}
			// check validation error for this idx
			errMsg := ""
			for _, ve := range valErrs {
				if ve.Index == idx {
					errMsg = fmt.Sprintf(" ERROR %s:%s", ve.Field, ve.Message)
				}
			}
			fmt.Printf("item %s: %dx%d steps=%d seed=%d sampler=%s scheduler=%s cfg=%v pos=%q neg=%q%s%s\n",
				r.ID, r.Width, r.Height, r.Steps, r.Seed, r.Sampler, r.Scheduler, r.Cfg, r.PositivePrompt, r.NegativePrompt, warnStr, errMsg)
		}
		if len(valErrs) > 0 {
			fmt.Fprintf(os.Stderr, "validation: %d errors\n", len(valErrs))
			for _, ve := range valErrs {
				fmt.Fprintf(os.Stderr, "  [%d] id=%s %s: %s\n", ve.Index, ve.ID, ve.Field, ve.Message)
			}
		}
		return
	}

	// determine host
	comfyHost := os.Getenv("COMFY_HOST")
	if comfyHost == "" {
		comfyHost = "http://127.0.0.1:8188"
	}
	client := comfy.NewClient(comfyHost, wfPath)

	// serial execution
	count := 0
	for idx := range j.Items {
		if *limit > 0 && count >= *limit {
			break
		}
		// reload each iteration to respect atomic saves from prior
		jj, err := jobs.Load(jobPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "reload: %v\n", err)
			break
		}
		j = jj
		it := j.Items[idx]
		if it.Status == "done" && !*force {
			fmt.Printf("skip done %s\n", it.ID)
			continue
		}
		if it.Status == "queued" {
			fmt.Printf("skip queued %s\n", it.ID)
			continue
		}
		// validate single
		r := j.Resolve(idx)
		valErrs := j.Validate()
		failed := false
		for _, ve := range valErrs {
			if ve.Index == idx {
				failed = true
				fmt.Fprintf(os.Stderr, "validate item %s failed: %s: %s\n", it.ID, ve.Field, ve.Message)
				// persist failed
				j.Items[idx].Status = "failed"
				j.Items[idx].Error = ve.Field + ": " + ve.Message
				j.Items[idx].Warnings = r.Warnings
				_ = jobs.AtomicSave(jobPath, j)
				break
			}
		}
		if failed {
			count++
			continue
		}

		prefix := jobName + "_" + r.ID
		req := comfy.SubmitReq{
			Width:     r.Width,
			Height:    r.Height,
			Steps:     r.Steps,
			Seed:      r.Seed,
			Positive:  r.PositivePrompt,
			Negative:  r.NegativePrompt,
			Sampler:   r.Sampler,
			Scheduler: r.Scheduler,
			Cfg:       r.Cfg,
			Prefix:    prefix,
		}
		// mark queued
		j.Items[idx].Status = "queued"
		_ = jobs.AtomicSave(jobPath, j)

		ctx, cancel := context.WithTimeout(context.Background(), 130*time.Second)
		result, err := client.Submit(ctx, req)
		cancel()
		// reload again
		j2, _ := jobs.Load(jobPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "item %s failed: %v\n", r.ID, err)
			j2.Items[idx].Status = "failed"
			j2.Items[idx].Error = err.Error()
			j2.Items[idx].Warnings = r.Warnings
			_ = jobs.AtomicSave(jobPath, j2)
			j = j2
			count++
			continue
		}
		// save png
		// output/<date>/<job>/<id>_<seed>.png
		outDate := date
		if outDate == "" {
			outDate = filepath.Base(jobDir)
		}
		outDir := filepath.Join(root, "output", outDate, jobName)
		// if root detection off, fallback to relative output next to job
		if _, err := os.Stat(root); err != nil {
			outDir = filepath.Join(jobDir, "..", "..", "output", outDate, jobName)
		}
		_ = os.MkdirAll(outDir, 0755)
		filename := fmt.Sprintf("%s_%d.png", r.ID, r.Seed)
		outPath := filepath.Join(outDir, filename)
		if err := os.WriteFile(outPath, result.Bytes, 0644); err != nil {
			j2.Items[idx].Status = "failed"
			j2.Items[idx].Error = fmt.Sprintf("write output: %v", err)
			_ = jobs.AtomicSave(jobPath, j2)
			count++
			continue
		}
		j2.Items[idx].Status = "done"
		j2.Items[idx].Error = ""
		j2.Items[idx].Warnings = r.Warnings
		j2.Items[idx].Output = &jobs.Output{
			Filename:  filename,
			W:         result.W,
			H:         result.H,
			Bytes:     len(result.Bytes),
			SHA16:     result.SHA16,
			PromptID:  result.PromptID,
			ElapsedMs: result.ElapsedMs,
		}
		_ = jobs.AtomicSave(jobPath, j2)
		j = j2
		// stdout one JSON line per spec
		line, _ := json.Marshal(map[string]any{
			"id":         r.ID,
			"prompt_id":  result.PromptID,
			"file":       outPath,
			"w":          result.W,
			"h":          result.H,
			"sha16":      result.SHA16,
			"elapsed_ms": result.ElapsedMs,
		})
		fmt.Println(string(line))
		count++
	}
	fmt.Printf("done: %d items processed\n", count)
}
