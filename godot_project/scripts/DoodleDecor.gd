extends Node2D
class_name DoodleDecor

var cfg: Dictionary = {}

func _ready() -> void:
	call_deferred("_init_from_meta")

func _init_from_meta() -> void:
	if has_meta("content"):
		cfg = get_meta("content")
		queue_redraw()

func _draw() -> void:
	if cfg.is_empty():
		return
	var kind := cfg.get("kind", "text")
	var content := cfg.get("content", "")
	match kind:
		"text":
			pass
		"cloud":
			pass
		"arrow":
			pass
		"flag":
			pass
		_:
			pass
