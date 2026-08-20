package jobs

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"time"
)

// Resolve merges item > job.defaults > workflowDefaults > global.
func (j *Job) Resolve(idx int) Resolved {
	it := j.Items[idx]
	warnings := []string{}

	width := GlobalDefaults.Width
	if j.Defaults.Width != nil {
		width = *j.Defaults.Width
	}
	if it.Width != nil {
		width = *it.Width
	}
	height := GlobalDefaults.Height
	if j.Defaults.Height != nil {
		height = *j.Defaults.Height
	}
	if it.Height != nil {
		height = *it.Height
	}
	steps := GlobalDefaults.Steps
	if j.Defaults.Steps != nil {
		steps = *j.Defaults.Steps
	}
	if it.Steps != nil {
		steps = *it.Steps
	}
	neg := GlobalDefaults.NegativePrompt
	if j.Defaults.NegativePrompt != nil {
		neg = *j.Defaults.NegativePrompt
	}
	if it.NegativePrompt != nil {
		neg = *it.NegativePrompt
	}
	sampler := GlobalWorkflowDefaults.Sampler
	if j.Defaults.Sampler != nil {
		sampler = *j.Defaults.Sampler
	}
	if it.Sampler != nil {
		sampler = *it.Sampler
	}
	scheduler := GlobalWorkflowDefaults.Scheduler
	if j.Defaults.Scheduler != nil {
		scheduler = *j.Defaults.Scheduler
	}
	if it.Scheduler != nil {
		scheduler = *it.Scheduler
	}
	cfg := GlobalWorkflowDefaults.Cfg
	if j.Defaults.Cfg != nil {
		cfg = *j.Defaults.Cfg
	}
	if it.Cfg != nil {
		cfg = *it.Cfg
	}
	preset := PresetTurbo
	if j.Defaults.Preset != nil && ValidPresets[*j.Defaults.Preset] {
		preset = *j.Defaults.Preset
	}
	if it.Preset != nil && ValidPresets[*it.Preset] {
		preset = *it.Preset
	}
	presetDefaultUnet := "anima_turboV10.safetensors"
	if preset == PresetBase {
		presetDefaultUnet = "fnMixAnimaTurbo_baseNoTurbo.safetensors"
	}
	unetName := presetDefaultUnet
	if j.Defaults.UnetName != nil && strings.TrimSpace(*j.Defaults.UnetName) != "" {
		unetName = strings.TrimSpace(*j.Defaults.UnetName)
	}
	if it.UnetName != nil && strings.TrimSpace(*it.UnetName) != "" {
		unetName = strings.TrimSpace(*it.UnetName)
	}
	batch := 1
	if j.Defaults.Batch != nil {
		batch = *j.Defaults.Batch
	}
	if it.Batch != nil {
		batch = *it.Batch
	}
	if batch < 1 {
		batch = 1
	}
	if batch > 8 {
		batch = 8
		warnings = append(warnings, "batch clamped to 8")
	}
	loras := []LoraSlot{}
	if len(j.Defaults.Loras) > 0 {
		loras = j.Defaults.Loras
	}
	if len(it.Loras) > 0 {
		loras = it.Loras
	}
	activeLoras := []LoraSlot{}
	for _, l := range loras {
		name := strings.TrimSpace(l.Name)
		if name == "" || strings.EqualFold(name, "off") {
			continue
		}
		w := l.Weight
		if w == 0 {
			w = 1.0
		}
		if w < -10 {
			w = -10
		}
		if w > 10 {
			w = 10
		}
		activeLoras = append(activeLoras, LoraSlot{Name: name, Weight: w})
		if len(activeLoras) >= 3 {
			break
		}
	}

	origW, origH := width, height
	if width%8 != 0 {
		aligned := ((width + 7) / 8) * 8
		warnings = append(warnings, fmt.Sprintf("width %d aligned to %d (8x)", origW, aligned))
		width = aligned
	}
	if height%8 != 0 {
		aligned := ((height + 7) / 8) * 8
		warnings = append(warnings, fmt.Sprintf("height %d aligned to %d (8x)", origH, aligned))
		height = aligned
	}
	if steps < 4 || steps > 8 {
		if steps >= 1 && steps <= 32 {
			warnings = append(warnings, fmt.Sprintf("steps %d outside turbo recommended 4-8", steps))
		}
	}

	var seed int64
	hasSeed := false
	if it.Seed != nil {
		seed = *it.Seed
		hasSeed = true
	} else if j.Defaults.Seed != nil {
		seed = *j.Defaults.Seed
		hasSeed = true
	}
	if !hasSeed {
		seed = randomSeed()
		warnings = append(warnings, fmt.Sprintf("seed auto-generated %d", seed))
	}

	return Resolved{
		ID:             it.ID,
		Width:          width,
		Height:         height,
		Steps:          steps,
		Seed:           seed,
		Batch:          batch,
		PositivePrompt: it.PositivePrompt,
		NegativePrompt: neg,
		Sampler:        sampler,
		Scheduler:      scheduler,
		Cfg:            cfg,
		Preset:         preset,
		UnetName:       unetName,
		Loras:          activeLoras,
		Warnings:       warnings,
	}
}

func randomSeed() int64 {
	n, err := rand.Int(rand.Reader, big.NewInt(1<<62))
	if err != nil {
		return time.Now().UnixNano() & ((1 << 62) - 1)
	}
	return n.Int64()
}
