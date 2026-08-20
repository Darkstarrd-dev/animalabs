package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"anima/internal/comfy"
	"anima/internal/jobs"
	"anima/internal/server"
)

func runRun(args []string) {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	dryRun := fs.Bool("dry-run", false, "only print resolved 9 dims")
	limit := fs.Int("limit", 0, "max items to run (0=all)")
	force := fs.Bool("force", false, "re-run done items")
	cliPreset := fs.String("preset", "", "preset turbo|base (header override)")
	cliUnet := fs.String("unet", "", "unet_name override (header override)")
	cliLoras := fs.String("loras", "", "loras JSON header override")
	cliSteps := fs.Int("steps", 0, "header override steps 1-32 (0=follow plan)")
	cliCfg := fs.Float64("cfg", 0, "header override cfg 0-20 (0=follow plan)")
	cliSampler := fs.String("sampler", "", "header override sampler_name")
	cliScheduler := fs.String("scheduler", "", "header override scheduler")
	cliBatch := fs.Int("batch", 0, "header override batch 1-8 (0=follow plan)")
	// support flags after positional: extract known flags manually before Parse
	var filtered []string
	var positional []string
	for i := 0; i < len(args); i++ {
		a := args[i]
		if a == "--dry-run" {
			filtered = append(filtered, a)
		} else if a == "--force" {
			filtered = append(filtered, a)
		} else if a == "--preset" && i+1 < len(args) {
			filtered = append(filtered, a, args[i+1]); i++
		} else if len(a) > 9 && a[:9] == "--preset=" {
			filtered = append(filtered, a)
		} else if a == "--unet" && i+1 < len(args) {
			filtered = append(filtered, a, args[i+1]); i++
		} else if len(a) > 7 && a[:7] == "--unet=" {
			filtered = append(filtered, a)
		} else if a == "--loras" && i+1 < len(args) {
			filtered = append(filtered, a, args[i+1]); i++
		} else if len(a) > 8 && a[:8] == "--loras=" {
			filtered = append(filtered, a)
		} else if a == "--steps" && i+1 < len(args) {
			filtered = append(filtered, a, args[i+1]); i++
		} else if len(a) > 8 && a[:8] == "--steps=" {
			filtered = append(filtered, a)
		} else if a == "--cfg" && i+1 < len(args) {
			filtered = append(filtered, a, args[i+1]); i++
		} else if len(a) > 6 && a[:6] == "--cfg=" {
			filtered = append(filtered, a)
		} else if a == "--sampler" && i+1 < len(args) {
			filtered = append(filtered, a, args[i+1]); i++
		} else if len(a) > 10 && a[:10] == "--sampler=" {
			filtered = append(filtered, a)
		} else if a == "--scheduler" && i+1 < len(args) {
			filtered = append(filtered, a, args[i+1]); i++
		} else if len(a) > 12 && a[:12] == "--scheduler=" {
			filtered = append(filtered, a)
		} else if a == "--batch" && i+1 < len(args) {
			filtered = append(filtered, a, args[i+1]); i++
		} else if len(a) > 8 && a[:8] == "--batch=" {
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
	// apply CLI header overrides (same semantics as server header)
	if *cliPreset != "" && jobs.ValidPresets[*cliPreset] {
		cp := *cliPreset
		j.Defaults.Preset = &cp
	}
	if *cliUnet != "" {
		cu := *cliUnet
		j.Defaults.UnetName = &cu
	}
	if *cliLoras != "" {
		var parsed []jobs.LoraSlot
		if err := json.Unmarshal([]byte(*cliLoras), &parsed); err == nil {
			j.Defaults.Loras = parsed
		}
	}
	if *cliSteps != 0 {
		cs := *cliSteps
		j.Defaults.Steps = &cs
	}
	if *cliCfg != 0 {
		cc := *cliCfg
		j.Defaults.Cfg = &cc
	}
	if *cliSampler != "" {
		csa := *cliSampler
		j.Defaults.Sampler = &csa
	}
	if *cliScheduler != "" {
		csh := *cliScheduler
		j.Defaults.Scheduler = &csh
	}
	if *cliBatch != 0 {
		cb := *cliBatch
		j.Defaults.Batch = &cb
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
			fmt.Printf("item %s: %dx%d steps=%d seed=%d sampler=%s scheduler=%s cfg=%v batch=%d preset=%s unet=%s loras=%v pos=%q neg=%q%s%s\n",
				r.ID, r.Width, r.Height, r.Steps, r.Seed, r.Sampler, r.Scheduler, r.Cfg, r.Batch, r.Preset, r.UnetName, r.Loras, r.PositivePrompt, r.NegativePrompt, warnStr, errMsg)
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
		loraReqs := []comfy.LoraReq{}
		for _, lr := range r.Loras {
			loraReqs = append(loraReqs, comfy.LoraReq{Name: lr.Name, Weight: lr.Weight})
		}
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
			Preset:    r.Preset,
			UnetName:  r.UnetName,
			Loras:     loraReqs,
			Batch:     r.Batch,
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
