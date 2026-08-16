extends Control

func _ready() -> void:
	queue_redraw()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var mx := event.position.x
		var my := event.position.y
		var vp_size := get_viewport_rect().size
		var bw := vp_size.x * 0.34
		var bh := 140.0
		var bx := (vp_size.x - bw) / 2
		var by := vp_size.y * 0.58
		if mx >= bx and mx <= bx + bw and my >= by and my <= by + bh:
			GameManager.change_state(GameManager.State.LEVEL_SELECT)

func _draw() -> void:
	var vp := get_viewport_rect().size

	var step := 32.0
	var grid_color := Color(0, 0, 0, 0.10)
	for x in range(0, int(vp.x), int(step)):
		draw_line(Vector2(x, 0), Vector2(x, vp.y), grid_color, 1.0, false)
	for y in range(0, int(vp.y), int(step)):
		draw_line(Vector2(0, y), Vector2(vp.x, y), grid_color, 1.0, false)

	_draw_status_bar(vp)

	var title_y1 := vp.y * 0.20
	var title_y2 := vp.y * 0.32
	var shadow := 7.0
	_draw_shadow_text("大聪明", vp.x / 2, title_y1, 96, shadow)
	_draw_shadow_text("脑洞蛋", vp.x / 2, title_y2, 110, shadow + 1)

	var bw := vp.x * 0.34
	var bh := 140.0
	var bx := (vp.x - bw) / 2
	var by := vp.y * 0.58
	var r := 44.0
	var s := 8.0
	var lw := 4.5
	_draw_sticker_rect(bx, by, bw, bh, r, s, lw)
	draw_string(ThemeDB.fallback_font,
		Vector2(bx + bw / 2, by + bh / 2 + 15),
		"选择关卡", HORIZONTAL_ALIGNMENT_CENTER, -1, 44, Color.BLACK)

	draw_string(ThemeDB.fallback_font,
		Vector2(vp.x / 2, vp.y - 48),
		"© 2024 MVP Demo", HORIZONTAL_ALIGNMENT_CENTER, -1, 22,
		Color(0, 0, 0, 0.45))

func _draw_status_bar(vp: Vector2) -> void:
	var size := vp
	draw_string(ThemeDB.fallback_font,
		Vector2(28, 36), "20:38",
		HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color.BLACK)
	var sx := size.x - 150
	var sy := 22
	for i in range(4):
		var bh := 5 + i * 3.5
		draw_rect(Rect2(sx + i * 8, sy - bh, 4.5, bh), Color.BLACK, true)
	var wx := sx + 42
	var wy := sy - 3
	for i in range(3):
		var radius := 15 - i * 4.5
		draw_arc(Vector2(wx, wy), radius, deg_to_rad(216), deg_to_rad(324),
			16, Color.BLACK, 2.8, true)
	draw_circle(Vector2(wx, wy), 3, Color.BLACK)
	var bx := sx + 86
	var by_rect := sy - 10
	draw_rect(Rect2(bx, by_rect, 58, 24), Color.BLACK, false, 3.5, true)
	draw_rect(Rect2(bx + 58, by_rect + 7, 6, 11), Color.BLACK, true)
	draw_rect(Rect2(bx + 5, by_rect + 4, 36, 16), Color.BLACK, true)

func _draw_shadow_text(t: String, cx: float, cy: float, sz: int, shadow: float) -> void:
	draw_string(ThemeDB.fallback_font,
		Vector2(cx + shadow, cy + shadow), t,
		HORIZONTAL_ALIGNMENT_CENTER, -1, sz, Color.BLACK)
	draw_string(ThemeDB.fallback_font,
		Vector2(cx, cy), t,
		HORIZONTAL_ALIGNMENT_CENTER, -1, sz, Color.BLACK)

func _draw_sticker_rect(x: float, y: float, w: float, h: float,
		r: float, shadow: float, lw: float) -> void:
	_draw_round_rect(x + shadow, y + shadow, w, h, r, Color.BLACK, true)
	_draw_round_rect(x, y, w, h, r, Color.WHITE, true)
	_draw_round_rect(x, y, w, h, r, Color.BLACK, false, lw)

func _draw_round_rect(x: float, y: float, w: float, h: float,
		r: float, color: Color, filled: bool, lw := 4.0) -> void:
	var p := PackedVector2Array()
	var steps := 10
	for i in range(steps + 1):
		var t := PI + (PI / 2.0) * (float(i) / steps)
		p.append(Vector2(x + r + cos(t) * r, y + r + sin(t) * r))
	for i in range(steps + 1):
		var t := -PI / 2.0 + (PI / 2.0) * (float(i) / steps)
		p.append(Vector2(x + w - r + cos(t) * r, y + r + sin(t) * r))
	for i in range(steps + 1):
		var t := (PI / 2.0) * (float(i) / steps)
		p.append(Vector2(x + w - r + cos(t) * r, y + h - r + sin(t) * r))
	for i in range(steps + 1):
		var t := PI / 2.0 + (PI / 2.0) * (float(i) / steps)
		p.append(Vector2(x + r + cos(t) * r, y + h - r + sin(t) * r))
	if filled:
		draw_colored_polygon(p, color)
	else:
		draw_polyline(p + [p[0]], color, lw, true)