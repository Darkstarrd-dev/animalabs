package server

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"anima/internal/comfy"
	"anima/internal/jobs"
)

func (s *Server) runJob(date, jobFile string, force bool, hdrPreset, hdrUnet string, hdrLoras []jobs.LoraSlot, hdrSteps *int, hdrCfg *float64, hdrSampler, hdrScheduler string, hdrBatch *int, filterItems []string, filterGroup, filterSubgroup string) {
	key := date + "/" + jobFile
	s.runStatesMu.Lock()
	rs := &runState{}
	s.runStates[key] = rs
	s.runStatesMu.Unlock()
	defer func() {
		s.runningMu.Lock()
		delete(s.running, key)
		s.runningMu.Unlock()
		s.runStatesMu.Lock()
		delete(s.runStates, key)
		s.runStatesMu.Unlock()
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
	if hdrSteps != nil {
		j0.Defaults.Steps = hdrSteps
	}
	if hdrCfg != nil {
		j0.Defaults.Cfg = hdrCfg
	}
	if hdrSampler != "" {
		hdrSamplerCopy := hdrSampler
		j0.Defaults.Sampler = &hdrSamplerCopy
	}
	if hdrScheduler != "" {
		hdrSchedulerCopy := hdrScheduler
		j0.Defaults.Scheduler = &hdrSchedulerCopy
	}
	if hdrBatch != nil {
		j0.Defaults.Batch = hdrBatch
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
		// check stop/pause before next item
		for {
			rs.mu.Lock()
			stopped := rs.stopped
			paused := rs.paused
			rs.mu.Unlock()
			if stopped { return }
			if !paused { break }
			time.Sleep(300 * time.Millisecond)
		}
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
		if hdrSteps != nil {
			jCheck.Defaults.Steps = hdrSteps
		}
		if hdrCfg != nil {
			jCheck.Defaults.Cfg = hdrCfg
		}
		if hdrSampler != "" {
			hdrSamplerCopy2 := hdrSampler
			jCheck.Defaults.Sampler = &hdrSamplerCopy2
		}
		if hdrScheduler != "" {
			hdrSchedulerCopy2 := hdrScheduler
			jCheck.Defaults.Scheduler = &hdrSchedulerCopy2
		}
		if hdrBatch != nil {
			jCheck.Defaults.Batch = hdrBatch
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
			Batch:     resolved.Batch,
		}
		ctx, cancel := context.WithTimeout(context.Background(), 190*time.Second)
		rs.mu.Lock()
		rs.cancelFn = cancel
		stoppedEarly := rs.stopped
		rs.mu.Unlock()
		if stoppedEarly { cancel(); return }
		result, err := s.comfyClient.Submit(ctx, req)
		cancel()
		rs.mu.Lock()
		rs.cancelFn = nil
		stopped2 := rs.stopped
		rs.mu.Unlock()
		if stopped2 {
			s.mu.Lock()
			j3, _ := jobs.Load(jobPath)
			if j3.Items[idx].Status == "queued" {
				j3.Items[idx].Status = "pending"
				_ = jobs.AtomicSave(jobPath, j3)
			}
			s.mu.Unlock()
			return
		}
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
		batchOuts := []jobs.Output{}
		if len(result.Images) > 1 {
			base := strings.TrimSuffix(filename, ".png")
			for i, bi := range result.Images[1:] {
				sibling := fmt.Sprintf("%s_%02d.png", base, i+2)
				_ = os.WriteFile(filepath.Join(outDir, sibling), bi.Bytes, 0644)
				sha2 := sha256.Sum256(bi.Bytes)
				batchOuts = append(batchOuts, jobs.Output{Filename: sibling, W: bi.W, H: bi.H, Bytes: len(bi.Bytes), SHA16: hex.EncodeToString(sha2[:])[:16], PromptID: result.PromptID, ElapsedMs: result.ElapsedMs})
			}
		}
		sha := sha256.Sum256(result.Bytes)
		sha16 := hex.EncodeToString(sha[:])[:16]
		// Mark siblings missing if files were cleaned externally
		for i := range batchOuts {
			if _, err := os.Stat(filepath.Join(outDir, batchOuts[i].Filename)); err != nil {
				batchOuts[i].Missing = true
			}
		}
		j3.Items[idx].Status = "done"
		j3.Items[idx].Error = ""
		j3.Items[idx].Warnings = resolved.Warnings
		j3.Items[idx].Output = &jobs.Output{
			Filename:     filename,
			W:            result.W,
			H:            result.H,
			Bytes:        len(result.Bytes),
			SHA16:        sha16,
			PromptID:     result.PromptID,
			ElapsedMs:    result.ElapsedMs,
			BatchOutputs: batchOuts,
		}
		_ = jobs.AtomicSave(jobPath, j3)
		s.mu.Unlock()
	}
}

