package jobs

import (
	"fmt"
	"strings"
)

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
			j.Items[i].Warnings = r.Warnings
		}
	}
	return errs
}
