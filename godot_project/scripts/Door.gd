extends Area2D
class_name Door

var door_id: String = ""
var is_goal: bool = false
@export var door_w: float = 90.0
@export var door_h: float = 240.0
@export var door_size: Vector2 = Vector2(110, 180)
var open_t: float = 0.0
var player_ref: Player = null

func _ready() -> void:
	add_to_group("door")
	collision_layer = 0
	collision_mask = 1
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)

func _process(delta: float) -> void:
	if GameManager.state == GameManager.State.SUCCESS_ANIM:
		open_t = GameManager.door_open_t
	elif GameManager.state == GameManager.State.PLAYING:
		open_t = 0.0
		if player_ref and is_goal:
			try_enter(player_ref)
	queue_redraw()

func configure(cfg: Dictionary) -> void:
	position = Vector2(cfg.get("x", 0), cfg.get("y", 0))
	door_id = str(cfg.get("id", "door_%d" % cfg.get("index", 0)))
	is_goal = bool(cfg.get("is_goal", true))
	door_w = float(cfg.get("w", door_w))
	door_h = float(cfg.get("h", door_h))
	door_size = Vector2(door_w, door_h)
	var shape_node := get_node_or_null("CollisionShape2D") as CollisionShape2D
	if shape_node == null:
		shape_node = CollisionShape2D.new()
		add_child(shape_node)
	var rect := RectangleShape2D.new()
	rect.size = Vector2(door_w, door_h)
	shape_node.shape = rect
	queue_redraw()

func try_enter(p: Player) -> void:
	if is_goal:
		p.entered_door.emit(door_id)

func _on_body_entered(body: Node) -> void:
	if body is Player:
		player_ref = body as Player
		try_enter(body as Player)

func _on_body_exited(body: Node) -> void:
	if body is Player:
		player_ref = null

func _static_wobble(seed: float, amp: float) -> float:
	return fmod(sin(seed * 12.9898) * 43758.5453, 1.0) * amp - amp * 0.5

func _wonky_rect_points(x: float, y: float, w: float, h: float, r: float, seed: float, amp: float) -> PackedVector2Array:
	var p := PackedVector2Array()
	var steps := 10
	var s := seed
	for i in range(steps + 1):
		var t := PI + (PI / 2.0) * (float(i) / steps)
		var px := x + r + cos(t) * r
		var py := y + r + sin(t) * r
		p.append(Vector2(px + _static_wobble(s + i, amp), py + _static_wobble(s + i + 100, amp)))
	for i in range(steps + 1):
		var t := -PI / 2.0 + (PI / 2.0) * (float(i) / steps)
		var px := x + w - r + cos(t) * r
		var py := y + r + sin(t) * r
		p.append(Vector2(px + _static_wobble(s + i + 200, amp), py + _static_wobble(s + i + 300, amp)))
	for i in range(steps + 1):
		var t := (PI / 2.0) * (float(i) / steps)
		var px := x + w - r + cos(t) * r
		var py := y + h - r + sin(t) * r
		p.append(Vector2(px + _static_wobble(s + i + 400, amp), py + _static_wobble(s + i + 500, amp)))
	for i in range(steps + 1):
		var t := PI / 2.0 + (PI / 2.0) * (float(i) / steps)
		var px := x + r + cos(t) * r
		var py := y + h - r + sin(t) * r
		p.append(Vector2(px + _static_wobble(s + i + 600, amp), py + _static_wobble(s + i + 700, amp)))
	return p

func _draw_simple_wonky(x: float, y: float, w: float, h: float, r: float, seed: float, amp: float, lw: float, fill_color: Color, stroke_color: bool = true) -> void:
	var p := _wonky_rect_points(x, y, w, h, r, seed, amp)
	draw_colored_polygon(p, fill_color)
	if stroke_color:
		draw_polyline(p + [p[0]], Color.BLACK, lw, true)

func _draw() -> void:
	var w := door_w
	var h := door_h
	var opening := open_t
	var lw := 4.0
	var left := -w / 2.0
	var top := -h / 2.0

	var overhang := 16.0
	var header_h := 22.0
	var header_w := w + 32.0
	var header_x := -header_w / 2.0
	var header_y := top - header_h

	_draw_simple_wonky(header_x, header_y, header_w, header_h, 5.0, 1.0, 1.8, 4.0, Color.WHITE, true)

	var cap_w := 12.0
	var cap_h := 10.0
	var cap_y := header_y + header_h
	var left_cap_x := header_x
	var right_cap_x := header_x + header_w - cap_w
	draw_rect(Rect2(left_cap_x, cap_y, cap_w, cap_h), Color.WHITE, true)
	draw_rect(Rect2(left_cap_x, cap_y, cap_w, cap_h), Color.BLACK, false, lw, true)
	draw_rect(Rect2(right_cap_x, cap_y, cap_w, cap_h), Color.WHITE, true)
	draw_rect(Rect2(right_cap_x, cap_y, cap_w, cap_h), Color.BLACK, false, lw, true)

	if opening > 0.0:
		var reveal_w := (w - 4.0) * opening
		draw_rect(Rect2(left + 2.0, top + 2.0, reveal_w, h - 4.0), Color.BLACK, true)
		draw_rect(Rect2(left + 2.0, top + 2.0, reveal_w, 6.0), Color(0.04, 0.04, 0.04), true)

	var body_shift := opening * (w + 24.0)
	var bx := left + body_shift
	var by := top
	var bw := w
	var bh := h

	if bx + bw > left - 2.0:
		_draw_simple_wonky(bx, by, bw, bh, 8.0, 11.0, 2.0, lw, Color.WHITE, true)

		var kbw := 22.0
		var kbh := 26.0
		var kx := bx + w / 2.0 - 11.0
		var ky := by + h / 2.0 + 6.0 - kbh / 2.0

		_draw_simple_wonky(kx, ky, kbw, kbh, 5.0, 100.0, 0.8, 3.0, Color.WHITE, true)

		var kx1 := kx + kbw * 0.3
		var ky1 := ky + kbh * 0.3
		var kx2 := kx + kbw * 0.3
		var ky2 := ky + kbh * 0.72
		var kx3 := kx + kbw * 0.72
		var ky3 := ky + kbh * 0.72

		draw_line(Vector2(kx1, ky1), Vector2(kx2, ky2), Color.BLACK, 3.0, true)
		draw_line(Vector2(kx2, ky2), Vector2(kx3, ky3), Color.BLACK, 3.0, true)