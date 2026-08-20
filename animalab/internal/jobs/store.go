package jobs

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

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
	if j.SchemaVersion == 0 {
		j.SchemaVersion = 1
	}
	for i := range j.Items {
		if j.Items[i].Group == "" && j.Items[i].Scene == "" && len(j.Items[i].GroupBy) > 0 && len(j.Items[i].Tags) > 0 {
			j.Items[i].Group = j.Items[i].Tags[j.Items[i].GroupBy[0]]
		}
		if j.Items[i].Subgroup == "" && j.Items[i].Variant == "" {
			if len(j.Items[i].GroupBy) > 1 && len(j.Items[i].Tags) > 0 {
				j.Items[i].Subgroup = j.Items[i].Tags[j.Items[i].GroupBy[1]]
			}
		}
		if j.Items[i].Subgroup == "" && j.Items[i].Tags != nil {
			if _, ok := j.Items[i].Tags["sampler"]; ok {
				if _, ok2 := j.Items[i].Tags["scheduler"]; ok2 {
					if it := j.Items[i]; it.Group != "" || it.Scene != "" {
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
	GlobalWorkflowDefaults = wd
	return wd, nil
}
