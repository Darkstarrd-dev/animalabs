package jobs

import (
	"fmt"
	"sort"
	"strings"
)

// nine-grid ring order: character at 5, counterclockwise 2→3→6→9→8→7→4→1 (front start)
var angleRingOrder = []string{
	"front",
	"front-right-45",
	"right",
	"behind-right-135",
	"behind",
	"behind-left-135",
	"left",
	"front-left-45",
}

// framing display order: close → far
var framingOrder = []string{"head", "bust", "half", "cowboy", "full"}

func buildRank(primary, fallback []string) map[string]int {
	m := map[string]int{}
	for _, s := range primary {
		if _, ok := m[s]; !ok {
			m[s] = len(m)
		}
	}
	for _, s := range fallback {
		if _, ok := m[s]; !ok {
			m[s] = len(m)
		}
	}
	return m
}

func sortGroupsRing(order []string, j *Job) {
	rank := buildRank(j.GroupOrder, angleRingOrder)
	sort.SliceStable(order, func(a, b int) bool {
		ra, oka := rank[order[a]]
		rb, okb := rank[order[b]]
		if oka && okb {
			return ra < rb
		}
		if oka != okb {
			return oka
		}
		return order[a] < order[b]
	})
}

func sortFramingsRing(keys []string, j *Job) {
	rank := buildRank(j.SubgroupOrder, framingOrder)
	sort.SliceStable(keys, func(a, b int) bool {
		ra, oka := rank[keys[a]]
		rb, okb := rank[keys[b]]
		if oka && okb {
			return ra < rb
		}
		if oka != okb {
			return oka
		}
		return keys[a] < keys[b]
	})
}

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
	sortGroupsRing(order, j)
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
		sortFramingsRing(skeys, j)
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
	sortGroupsRing(order, j)
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
