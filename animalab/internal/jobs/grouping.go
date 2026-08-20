package jobs

import (
	"fmt"
	"sort"
	"strings"
)

func OrderedIndices(j *Job, force bool) []int {
	type gInfo struct {
		items    []int
		variants map[string]int
	}
	by := map[string]*gInfo{}
	order := []string{}
	for idx, it := range j.Items {
		if !force && it.Status != "pending" && it.Status != "failed" {
			continue
		}
		gk := it.GroupKey()
		if gk == "" {
			gk = "__default__"
		}
		if _, ok := by[gk]; !ok {
			by[gk] = &gInfo{variants: map[string]int{}}
			order = append(order, gk)
		}
		by[gk].items = append(by[gk].items, idx)
		sk := it.SubgroupKey(j)
		if sk == "" {
			sk = "__single__"
		}
		by[gk].variants[sk]++
	}
	for i := 0; i < len(order); i++ {
		for k := i + 1; k < len(order); k++ {
			if order[k] < order[i] {
				order[i], order[k] = order[k], order[i]
			}
		}
	}
	if len(order) > 1 {
		for i, s := range order {
			if s == "__default__" {
				order = append(order[:i], order[i+1:]...)
				order = append(order, "__default__")
				break
			}
		}
	}
	var out []int
	for _, gk := range order {
		gi := by[gk]
		skeys := make([]string, 0, len(gi.variants))
		for k := range gi.variants {
			skeys = append(skeys, k)
		}
		for i := 0; i < len(skeys); i++ {
			for k := i + 1; k < len(skeys); k++ {
				if skeys[k] < skeys[i] {
					skeys[i], skeys[k] = skeys[k], skeys[i]
				}
			}
		}
		for _, sk := range skeys {
			var bucket []int
			for _, idx := range gi.items {
				want := j.Items[idx].SubgroupKey(j)
				if want == "" {
					want = "__single__"
				}
				if want == sk {
					bucket = append(bucket, idx)
				}
			}
			for i := 0; i < len(bucket); i++ {
				for k := i + 1; k < len(bucket); k++ {
					if j.Items[bucket[k]].ID < j.Items[bucket[i]].ID {
						bucket[i], bucket[k] = bucket[k], bucket[i]
					}
				}
			}
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
	if it.Group != "" {
		return it.Group
	}
	if it.Scene != "" {
		return it.Scene
	}
	return ""
}

func (it *Item) SubgroupKey(j *Job) string {
	if it.Subgroup != "" {
		return it.Subgroup
	}
	if it.Variant != "" {
		return it.Variant
	}
	if it.Group != "" || it.Scene != "" {
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

func ratioKeyForItem(it *Item, j *Job) string {
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
