package jobs

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
	GroupOrder    []string `json:"group_order,omitempty"`
	SubgroupOrder []string `json:"subgroup_order,omitempty"`
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
	Width          *int              `json:"width,omitempty"`
	Height         *int              `json:"height,omitempty"`
	Steps          *int              `json:"steps,omitempty"`
	Seed           *int64            `json:"seed,omitempty"`
	PositivePrompt string            `json:"positive_prompt"`
	NegativePrompt *string           `json:"negative_prompt,omitempty"`
	Sampler        *string           `json:"sampler,omitempty"`
	Scheduler      *string           `json:"scheduler,omitempty"`
	Cfg            *float64          `json:"cfg,omitempty"`
	Preset         *string           `json:"preset,omitempty"`
	UnetName       *string           `json:"unet_name,omitempty"`
	Loras          []LoraSlot        `json:"loras,omitempty"`
	Batch          *int              `json:"batch,omitempty"`
	Status         string            `json:"status"`
	Output         *Output           `json:"output,omitempty"`
	Review         *Review           `json:"review,omitempty"`
	Error          string            `json:"error,omitempty"`
	Warnings       []string          `json:"warnings,omitempty"`
}

type Output struct {
	Filename  string `json:"filename"`
	W         int    `json:"w"`
	H         int    `json:"h"`
	Bytes     int    `json:"bytes"`
	SHA16     string `json:"sha16"`
	PromptID  string `json:"prompt_id"`
	ElapsedMs int64  `json:"elapsed_ms"`
	Deleted   bool   `json:"deleted,omitempty"`
	Missing   bool   `json:"missing,omitempty"`
	// BatchOutputs holds siblings when batch>1 (siblings _02..N). Primary stays in Output.
	BatchOutputs []Output `json:"batch_outputs,omitempty"`
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

type ValidationError struct {
	Index   int    `json:"index"`
	ID      string `json:"id"`
	Field   string `json:"field"`
	Message string `json:"message"`
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

type SceneGroup struct {
	Scene    string         `json:"scene"`
	Items    []string       `json:"items"`
	Variants map[string]int `json:"variants"`
}
