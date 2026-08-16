extends Node2D
class_name LevelLoader
# PRD Part7 JSON Schema 对应的加载器：
# levels/level_N.json 描述关卡 entity，逐个实例化为场景节点

signal level_loaded(level_id: int)
signal level_failed(reason: String)

var current_root: Node2D
var player: Player
var all_entities: Array = []
var level_data: Dictionary

const ENTITY_DIR := "res://levels/"

func load_level(id: int) -> Node2D:
	unload()
	var path := ENTITY_DIR + "level_%d.json" % [id]
	if not FileAccess.file_exists(path):
		level_failed.emit("找不到关卡配置: %s" % path)
		return null
	var f := FileAccess.open(path, FileAccess.READ)
	var raw := f.get_as_text()
	f.close()
	var parsed := JSON.parse_string(raw)
	if typeof(parsed) != TYPE_DICTIONARY:
		level_failed.emit("level_%d.json 格式错误" % id)
		return null
	level_data = parsed
	_build_level(parsed)
	level_loaded.emit(id)
	return current_root

func unload() -> void:
	if current_root and is_instance_valid(current_root):
		current_root.queue_free()
	current_root = null
	player = null
	all_entities.clear()
	level_data.clear()

func _build_level(data: Dictionary) -> void:
	current_root = Node2D.new()
	current_root.name = "Level_%d" % [data.get("id", 0)]
	add_child(current_root)
	current_root.set_process(true)

	# 地面（世界坐标系下，y越大越低）
	for p in data.get("platforms", []):
		var plat := _spawn_platform(p)
		all_entities.append(plat)

	# 门
	for d in data.get("doors", []):
		var door_node := _spawn_door(d)
		all_entities.append(door_node)

	# 装饰（手绘风背景元素）
	for d in data.get("decor", []):
		var decor := _spawn_decor(d)
		all_entities.append(decor)

	# 玩家
	var spawn := data.get("spawn", {"x": 200, "y": 800})
	var scene_player := preload("res://scenes/Player.tscn").instantiate()
	scene_player.position = Vector2(spawn.get("x", 200), spawn.get("y", 800))
	current_root.add_child(scene_player)
	player = scene_player
	scene_player.entered_door.connect(_on_player_entered_door)

func _spawn_platform(p: Dictionary) -> Node2D:
	var scene := preload("res://scenes/Platform.tscn").instantiate()
	scene.configure(p)
	current_root.add_child(scene)
	return scene

func _spawn_door(d: Dictionary) -> Node2D:
	var scene := preload("res://scenes/Door.tscn").instantiate()
	scene.configure(d)
	current_root.add_child(scene)
	return scene

func _spawn_decor(d: Dictionary) -> Node2D:
	var n := Node2D.new()
	var kind := d.get("kind", "text")
	var pos := Vector2(d.get("x", 0), d.get("y", 0))
	n.position = pos
	current_root.add_child(n)
	n.set_meta("kind", kind)
	n.set_meta("content", d)
	n.set_script(preload("res://scripts/DoodleDecor.gd"))
	return n

func _on_player_entered_door(door_id: String) -> void:
	for entity in all_entities:
		if entity is Door and entity.door_id == door_id and entity.is_goal:
			const PLAYER_HALF_AREA: float = 4800.0
			var player_aabb_local: Rect2 = player.get_collision_shape_aabb()
			var player_aabb: Rect2 = Rect2(
				player_aabb_local.position + player.global_position,
				player_aabb_local.size
			)
			var door_node: Door = entity
			var door_pos: Vector2 = door_node.global_position
			var door_size_val: Vector2 = door_node.door_size
			var door_rect: Rect2 = Rect2(door_pos - door_size_val * 0.5, door_size_val)
			var overlap: float = rect_overlap_area(
				player_aabb.position.x, player_aabb.position.y,
				player_aabb.size.x, player_aabb.size.y,
				door_rect.position.x, door_rect.position.y,
				door_rect.size.x, door_rect.size.y
			)
			if overlap >= PLAYER_HALF_AREA:
				UIManager.set_show_dead(false)
				player.frozen = true
				player.velocity = Vector2.ZERO
				GameManager.complete_current(door_node)
			return

func rect_overlap_area(ax: float, ay: float, aw: float, ah: float,
                       bx: float, by: float, bw: float, bh: float) -> float:
	var ox: float = max(0.0, min(ax + aw, bx + bw) - max(ax, bx))
	var oy: float = max(0.0, min(ay + ah, by + bh) - max(ay, by))
	return ox * oy
