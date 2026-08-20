package jobs

// Preset names — header selector. turbo = Anime_Turbo_api.json, base = Anima_base_api.json.
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
