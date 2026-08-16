extends Node
class_name SaveManager

const SAVE_PATH := "user://save.cfg"

var data := {
	"unlocked_level": 1,
	"completed_levels": [],
	"total_brainpower": 0,
	"first_launch": true,
}

signal data_changed

func _ready() -> void:
	load()

func load() -> void:
	var cfg := ConfigFile.new()
	var err := cfg.load(SAVE_PATH)
	if err == OK:
		data.unlocked_level = int(cfg.get_value("progress", "unlocked", 1))
		var completed_str := str(cfg.get_value("progress", "completed", ""))
		data.completed_levels.clear()
		if completed_str != "":
			var parts := completed_str.split(",", false)
			for s in parts:
				if s.strip_edges() != "":
					data.completed_levels.append(int(s.strip_edges()))
		data.total_brainpower = int(cfg.get_value("progress", "brainpower", 0))
		data.first_launch = false
	save()

func save() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("progress", "unlocked", data.unlocked_level)
	var completed_str := ""
	for i in range(data.completed_levels.size()):
		if i > 0:
			completed_str += ","
		completed_str += str(data.completed_levels[i])
	cfg.set_value("progress", "completed", completed_str)
	cfg.set_value("progress", "brainpower", data.total_brainpower)
	cfg.save(SAVE_PATH)
	data_changed.emit()

func complete_level(level_id: int) -> void:
	if not data.completed_levels.has(level_id):
		data.completed_levels.append(level_id)
		data.total_brainpower += 1
	if level_id + 1 > data.unlocked_level:
		data.unlocked_level = min(level_id + 2, 999)
	save()

func is_level_unlocked(level_id: int) -> bool:
	return level_id < data.unlocked_level

func reset() -> void:
	data = {
		"unlocked_level": 1,
		"completed_levels": [],
		"total_brainpower": 0,
		"first_launch": false,
	}
	save()