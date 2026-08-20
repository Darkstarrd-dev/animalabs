package jobs

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// WorkflowDefaults cached at startup from Anime_Turbo_api.json:60:19
type WorkflowDefaults struct {
	Sampler   string  `json:"sampler"`
	Scheduler string  `json:"scheduler"`
	Cfg       float64 `json:"cfg"`
}

var GlobalWorkflowDefaults = WorkflowDefaults{
	Sampler:   "er_sde",
	Scheduler: "simple",
	Cfg:       1.0,
}

// Preset names — header selector. turbo = Anime_Turbo_api.json, base = Anima_base_api.json (converted from Anima_good UI workflow: base UNET + turbo-lora chain).
const (
	PresetTurbo = "turbo"
	PresetBase  = "base"
)

var ValidPresets = map[string]bool{PresetTurbo: true, PresetBase: true}

func PresetFile(preset string) string {
	switch preset {
	case PresetBase:
		return "Anima_base_api.json"
	default:
		return "Anime_Turbo_api.json"
	}
}

// LoraSlot mirrors header lora1-3 (off = disabled). Weight only meaningful when Name != "off" && Name != "".
type LoraSlot struct {
	Name   string  `json:"name"`
	Weight float64 `json:"weight"`
}

var GlobalDefaults = struct {
	Width          int
	Height         int
	Steps          int
	NegativePrompt string
}{
	Width:          1024,
	Height:         768,
	Steps:          4,
	NegativePrompt: "worst quality, low quality, blurry",
}

// Job is the top-level unit: Anima/jobs/<date>/<job>.json
type Job struct {
	SchemaVersion int      `json:"schema_version"`
	JobID         string   `json:"job_id"`
	Date          string   `json:"date"`
	CreatedAt     string   `json:"created_at"`
	Defaults      Defaults `json:"defaults"`
	Items         []Item   `json:"items"`
}

type Defaults struct {
	Width          *int       `json:"width,omitempty"`
	Height         *int       `json:"height,omitempty"`
	Steps          *int       `json:"steps,omitempty"`
	Seed           *int64     `json:"seed,omitempty"`
	Batch          *int       `json:"batch,omitempty"`
	NegativePrompt *string    `json:"negative_prompt,omitempty"`
	Sampler        *string    `json:"sampler,omitempty"`
	Scheduler      *string    `json:"scheduler,omitempty"`
	Cfg            *float64   `json:"cfg,omitempty"`
	Preset         *string    `json:"preset,omitempty"`
	UnetName       *string    `json:"unet_name,omitempty"`
	Loras          []LoraSlot `json:"loras,omitempty"`
}

type Item struct {
	ID             string            `json:"id"`
	Scene          string            `json:"scene,omitempty"`
	Variant        string            `json:"variant,omitempty"`
	Group          string            `json:"group,omitempty"`
	Subgroup       string            `json:"subgroup,omitempty"`
	GroupBy        []string          `json:"group_by,omitempty"`
	Tags           map[string]string `json:"tags,omitempty"`
	Width          *int      `json:"width,omitempty"`
	Height         *int      `json:"height,omitempty"`
	Steps          *int      `json:"steps,omitempty"`
	Seed           *int64    `json:"seed,omitempty"`
	PositivePrompt string    `json:"positive_prompt"`
	NegativePrompt *string   `json:"negative_prompt,omitempty"`
	Sampler        *string   `json:"sampler,omitempty"`
	Scheduler      *string   `json:"scheduler,omitempty"`
	Cfg            *float64  `json:"cfg,omitempty"`
	Preset         *string   `json:"preset,omitempty"`
	UnetName       *string   `json:"unet_name,omitempty"`
	Loras          []LoraSlot `json:"loras,omitempty"`
	Batch          *int      `json:"batch,omitempty"`
	Status         string    `json:"status"`
	Output         *Output   `json:"output,omitempty"`
	Review         *Review   `json:"review,omitempty"`
	Error          string    `json:"error,omitempty"`
	Warnings       []string  `json:"warnings,omitempty"`
}

type Output struct {
	Filename string `json:"filename"`
	W        int    `json:"w"`
	H        int    `json:"h"`
	Bytes    int    `json:"bytes"`
	SHA16    string `json:"sha16"`
	PromptID string `json:"prompt_id"`
	ElapsedMs int64 `json:"elapsed_ms"`
	Deleted  bool   `json:"deleted,omitempty"`
	Missing  bool   `json:"missing,omitempty"`
}

type Review struct {
	Verdict    string   `json:"verdict"` // kept|rejected|unreviewed
	Reason     string   `json:"reason"`
	Tags       []string `json:"tags"`
	ReviewedAt string   `json:"reviewed_at"`
}

// Resolved is the merged dim+preset+lora view for execution
type Resolved struct {
	ID             string     `json:"id"`
	Width          int        `json:"width"`
	Height         int        `json:"height"`
	Steps          int        `json:"steps"`
	Seed           int64      `json:"seed"`
	Batch          int        `json:"batch"`
	PositivePrompt string     `json:"positive_prompt"`
	NegativePrompt string     `json:"negative_prompt"`
	Sampler        string     `json:"sampler"`
	Scheduler      string     `json:"scheduler"`
	Cfg            float64    `json:"cfg"`
	Preset         string     `json:"preset"`
	UnetName       string     `json:"unet_name"`
	Loras          []LoraSlot `json:"loras,omitempty"`
	Warnings       []string   `json:"warnings,omitempty"`
}

// Load reads a job file.
func Load(path string) (*Job, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var j Job
	if err := json.Unmarshal(b, &j); err != nil {
		return nil, err
	}
	// normalize defaults
	if j.SchemaVersion == 0 {
		j.SchemaVersion = 1
	}
	for i := range j.Items {
		// derive Group/Subgroup from Tags+GroupBy if not explicitly set (generic grouping contract)
		if j.Items[i].Group == "" && j.Items[i].Scene == "" && len(j.Items[i].GroupBy) > 0 && len(j.Items[i].Tags) > 0 {
			j.Items[i].Group = j.Items[i].Tags[j.Items[i].GroupBy[0]]
		}
		if j.Items[i].Subgroup == "" && j.Items[i].Variant == "" {
			if len(j.Items[i].GroupBy) > 1 && len(j.Items[i].Tags) > 0 {
				j.Items[i].Subgroup = j.Items[i].Tags[j.Items[i].GroupBy[1]]
			}
		}
		// compose sampler x scheduler subgroup if tags contain both and subgroup still empty
		if j.Items[i].Subgroup == "" && j.Items[i].Tags != nil {
			if _, ok := j.Items[i].Tags["sampler"]; ok {
				if _, ok2 := j.Items[i].Tags["scheduler"]; ok2 {
					if it := j.Items[i]; it.Group != "" || it.Scene != "" {
						// only compose when grouped
						if j.Items[i].Tags["sampler"] != "" && j.Items[i].Tags["scheduler"] != "" {
							j.Items[i].Subgroup = j.Items[i].Tags["sampler"] + " x " + j.Items[i].Tags["scheduler"]
						}
					}
				}
			}
		}
	}
	for i := range j.Items {
		if j.Items[i].Status == "" {
			j.Items[i].Status = "pending"
		}
		if j.Items[i].Review == nil {
			j.Items[i].Review = &Review{Verdict: "unreviewed"}
		} else if j.Items[i].Review.Verdict == "" {
			j.Items[i].Review.Verdict = "unreviewed"
		}
	}
	return &j, nil
}

// AtomicSave writes path.tmp + rename + sync.
func AtomicSave(path string, job *Job) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(job, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, append(b, '\n'), 0644); err != nil {
		return err
	}
	// fsync tmp
	if f, err := os.Open(tmp); err == nil {
		_ = f.Sync()
		f.Close()
	}
	if err := os.Rename(tmp, path); err != nil {
		return err
	}
	if d, err := os.Open(dir); err == nil {
		_ = d.Sync()
		d.Close()
	}
	return nil
}

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
	if j.Defaults.Batch != nil { batch = *j.Defaults.Batch }
	if it.Batch != nil { batch = *it.Batch }
	if batch < 1 { batch = 1 }
	if batch > 8 { batch = 8; warnings = append(warnings, "batch clamped to 8") }
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

	// width/height align to 8
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
	if steps < 1 || steps > 32 {
		// validation will mark error, but also warning here
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

// Validate checks job and items. Returns per-item errors; also mutates warnings.
func (j *Job) Validate() []ValidationError {
	var errs []ValidationError
	seen := map[string]int{}
	for i, it := range j.Items {
		if it.ID == "" {
			errs = append(errs, ValidationError{Index: i, ID: it.ID, Field: "id", Message: "id required"})
		} else {
			if prev, ok := seen[it.ID]; ok {
				errs = append(errs, ValidationError{Index: i, ID: it.ID, Field: "id", Message: fmt.Sprintf("duplicate id (first at %d)", prev)})
			}
			seen[it.ID] = i
		}
		if strings.TrimSpace(it.PositivePrompt) == "" {
			errs = append(errs, ValidationError{Index: i, ID: it.ID, Field: "positive_prompt", Message: "positive_prompt required"})
		}
		// width/height range check after resolve
		r := j.Resolve(i)
		if r.Width < 16 || r.Width > 16384 {
			errs = append(errs, ValidationError{Index: i, ID: it.ID, Field: "width", Message: fmt.Sprintf("width %d out of 16-16384", r.Width)})
		}
		if r.Height < 16 || r.Height > 16384 {
			errs = append(errs, ValidationError{Index: i, ID: it.ID, Field: "height", Message: fmt.Sprintf("height %d out of 16-16384", r.Height)})
		}
		if r.Steps < 1 || r.Steps > 32 {
			errs = append(errs, ValidationError{Index: i, ID: it.ID, Field: "steps", Message: fmt.Sprintf("steps %d out of 1-32", r.Steps)})
		}
		if r.Cfg < 0 || r.Cfg > 20 {
			errs = append(errs, ValidationError{Index: i, ID: it.ID, Field: "cfg", Message: fmt.Sprintf("cfg %v out of 0-20", r.Cfg)})
		}
		if strings.TrimSpace(r.Sampler) == "" {
			errs = append(errs, ValidationError{Index: i, ID: it.ID, Field: "sampler", Message: "sampler required"})
		}
		if strings.TrimSpace(r.Scheduler) == "" {
			errs = append(errs, ValidationError{Index: i, ID: it.ID, Field: "scheduler", Message: "scheduler required"})
		}
		if len(r.Warnings) > 0 {
			// merge warnings into item for persistence
			j.Items[i].Warnings = r.Warnings
		}
	}
	return errs
}

type ValidationError struct {
	Index   int    `json:"index"`
	ID      string `json:"id"`
	Field   string `json:"field"`
	Message string `json:"message"`
}

// LoadWorkflowDefaults reads Anime_Turbo_api.json to extract KSampler defaults.
func LoadWorkflowDefaults(workflowPath string) (WorkflowDefaults, error) {
	b, err := os.ReadFile(workflowPath)
	if err != nil {
		return GlobalWorkflowDefaults, err
	}
	var wf map[string]json.RawMessage
	if err := json.Unmarshal(b, &wf); err != nil {
		return GlobalWorkflowDefaults, err
	}
	raw, ok := wf["60:19"]
	if !ok {
		return GlobalWorkflowDefaults, fmt.Errorf("60:19 not found")
	}
	var node struct {
		Inputs struct {
			SamplerName string  `json:"sampler_name"`
			Scheduler   string  `json:"scheduler"`
			Cfg         float64 `json:"cfg"`
		} `json:"inputs"`
	}
	if err := json.Unmarshal(raw, &node); err != nil {
		return GlobalWorkflowDefaults, err
	}
	wd := WorkflowDefaults{
		Sampler:   node.Inputs.SamplerName,
		Scheduler: node.Inputs.Scheduler,
		Cfg:       node.Inputs.Cfg,
	}
	if wd.Sampler == "" {
		wd.Sampler = GlobalWorkflowDefaults.Sampler
	}
	if wd.Scheduler == "" {
		wd.Scheduler = GlobalWorkflowDefaults.Scheduler
	}
	// allow cfg 0
	GlobalWorkflowDefaults = wd
	return wd, nil
}

// Job helpers for API
type DatesResponse []DateEntry
type DateEntry struct {
	Date       string `json:"date"`
	JobCount   int    `json:"job_count"`
	ImageCount int    `json:"image_count"`
}

type JobSummary struct {
	JobID     string `json:"job_id"`
	File      string `json:"file"`
	ItemCount int    `json:"item_count"`
	Counts    Counts `json:"counts"`
}

type Counts struct {
	Done       int `json:"done"`
	Failed     int `json:"failed"`
	Kept       int `json:"kept"`
	Rejected   int `json:"rejected"`
	Unreviewed int `json:"unreviewed"`
	Pending    int `json:"pending"`
	Queued     int `json:"queued"`
}

func OrderedIndices(j *Job, force bool) []int {
	// Build group order like frontend buildScenes: groupKey first-appearance then sort, __default__ last
	type gInfo struct{ items []int; variants map[string]int }
	by := map[string]*gInfo{}
	order := []string{}
	for idx, it := range j.Items {
		if !force && it.Status != "pending" && it.Status != "failed" {
			continue
		}
		gk := it.GroupKey()
		if gk == "" { gk = "__default__" }
		if _, ok := by[gk]; !ok {
			by[gk]=&gInfo{variants:map[string]int{}}
			order = append(order, gk)
		}
		by[gk].items = append(by[gk].items, idx)
		sk := it.SubgroupKey(j)
		if sk == "" { sk = "__single__" }
		by[gk].variants[sk]++
	}
	// sort group order like frontend
	// order first by lexical sort, then __default__ to end
	// stable sort lexical
	for i := 0; i < len(order); i++ {
		for k := i+1; k < len(order); k++ {
			if order[k] < order[i] { order[i], order[k] = order[k], order[i] }
		}
	}
	if len(order)>1 {
		for i,s := range order { if s=="__default__" { order=append(order[:i], order[i+1:]...); order=append(order,"__default__"); break } }
	}
	// subgroup order per group: lexical
	var out []int
	for _, gk := range order {
		gi := by[gk]
		// build subgroup lexical order
		skeys := make([]string, 0, len(gi.variants))
		for k := range gi.variants { skeys = append(skeys, k) }
		for i:=0;i<len(skeys);i++ { for k:=i+1;k<len(skeys);k++ { if skeys[k]<skeys[i] { skeys[i],skeys[k]=skeys[k],skeys[i] } } }
		for _, sk := range skeys {
			var bucket []int
			for _, idx := range gi.items {
				if want := j.Items[idx].SubgroupKey(j); func() string { if want=="" { return "__single__" }; return want }() == sk { bucket = append(bucket, idx) }
			}
			// within bucket, sort by id lexical numeric-aware
			for i:=0;i<len(bucket);i++ { for k:=i+1;k<len(bucket);k++ { if j.Items[bucket[k]].ID < j.Items[bucket[i]].ID { bucket[i],bucket[k]=bucket[k],bucket[i] } } }
			out = append(out, bucket...)
		}
	}
	return out
}

func ComputeCounts(j *Job) Counts {
	var c Counts
	for _, it := range j.Items {
		switch it.Status {
		case "done":
			c.Done++
		case "failed":
			c.Failed++
		case "pending":
			c.Pending++
		case "queued":
			c.Queued++
		}
		v := "unreviewed"
		if it.Review != nil && it.Review.Verdict != "" {
			v = it.Review.Verdict
		}
		switch v {
		case "kept":
			c.Kept++
		case "rejected":
			c.Rejected++
		default:
			c.Unreviewed++
		}
	}
	return c
}

func NormalizeTags(tags []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, t := range tags {
		s := strings.TrimSpace(strings.ToLower(t))
		if s == "" {
			continue
		}
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	sort.Strings(out)
	if out == nil {
		return []string{}
	}
	return out
}

func (it *Item) GroupKey() string {
	if it.Group != "" { return it.Group }
	if it.Scene != "" { return it.Scene }
	return ""
}
func (it *Item) SubgroupKey(j *Job) string {
	if it.Subgroup != "" { return it.Subgroup }
	if it.Variant != "" { return it.Variant }
	if it.Group != "" || it.Scene != "" {
		// fallback to ratio bucket only when grouped
		return ratioKeyForItem(it, j)
	}
	return ""
}
func GroupByScene(j *Job) []SceneGroup {
	byScene := map[string]*SceneGroup{}
	var order []string
	for _, it := range j.Items {
		scene := it.GroupKey()
		if scene == "" {
			scene = "__default__"
		}
		g, ok := byScene[scene]
		if !ok {
			g = &SceneGroup{Scene: scene, Items: nil, Variants: map[string]int{}}
			byScene[scene] = g
			order = append(order, scene)
		}
		g.Items = append(g.Items, it.ID)
		sk := it.SubgroupKey(j)
		if sk == "" {
			sk = "__single__"
		}
		g.Variants[sk]++
	}
	sort.Strings(order)
	// keep __default__ last for stable UX if multiple scenes
	if len(order) > 1 {
		for i, s := range order {
			if s == "__default__" {
				order = append(order[:i], order[i+1:]...)
				order = append(order, "__default__")
				break
			}
		}
	}
	out := make([]SceneGroup, 0, len(order))
	for _, s := range order {
		out = append(out, *byScene[s])
	}
	return out
}

type SceneGroup struct {
	Scene    string         `json:"scene"`
	Items    []string       `json:"items"`
	Variants map[string]int `json:"variants"`
}

func ratioKeyForItem(it *Item, j *Job) string {
	// use resolved-ish dims without triggering random seed side effects
	w := 1024
	if j.Defaults.Width != nil {
		w = *j.Defaults.Width
	}
	if it.Width != nil {
		w = *it.Width
	}
	h := 768
	if j.Defaults.Height != nil {
		h = *j.Defaults.Height
	}
	if it.Height != nil {
		h = *it.Height
	}
	if w%8 != 0 {
		w = ((w + 7) / 8) * 8
	}
	if h%8 != 0 {
		h = ((h + 7) / 8) * 8
	}
	g := gcd(w, h)
	if g == 0 {
		return fmt.Sprintf("%dx%d", w, h)
	}
	return fmt.Sprintf("%d:%d", w/g, h/g)
}

func gcd(a, b int) int {
	for b != 0 {
		a, b = b, a%b
	}
	return a
}
