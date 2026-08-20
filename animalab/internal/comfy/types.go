package comfy

type LoraReq struct {
	Name   string  `json:"name"`
	Weight float64 `json:"weight"`
}

type SubmitReq struct {
	Width     int       `json:"width"`
	Height    int       `json:"height"`
	Steps     int       `json:"steps"`
	Seed      int64     `json:"seed"`
	Batch     int       `json:"batch,omitempty"`
	Positive  string    `json:"positive"`
	Negative  string    `json:"negative"`
	Sampler   string    `json:"sampler"`
	Scheduler string    `json:"scheduler"`
	Cfg       float64   `json:"cfg"`
	Prefix    string    `json:"prefix"`
	Preset    string    `json:"preset,omitempty"`
	UnetName  string    `json:"unet_name,omitempty"`
	Loras     []LoraReq `json:"loras,omitempty"`
}

type BatchImage struct {
	Bytes    []byte
	W        int    `json:"w"`
	H        int    `json:"h"`
	SHA16    string `json:"sha16"`
	Filename string `json:"filename"`
}

type SubmitResult struct {
	PromptID  string `json:"prompt_id"`
	Bytes     []byte `json:"-"`
	W         int    `json:"w"`
	H         int    `json:"h"`
	SHA16     string `json:"sha16"`
	ElapsedMs int64  `json:"elapsed_ms"`
	Filename  string `json:"filename"`
	Images    []BatchImage `json:"images,omitempty"`
}

type promptResp struct {
	PromptID   string         `json:"prompt_id"`
	NodeErrors map[string]any `json:"node_errors"`
	Error      any            `json:"error"`
}
