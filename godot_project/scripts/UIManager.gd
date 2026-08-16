extends CanvasLayer
class_name UIManager

const DARK := Color.BLACK
const WHITE := Color.WHITE
const BG_COLOR := Color(0.95686, 0.95686, 0.95686, 1.0)
const GRID_COLOR := Color(0, 0, 0, 0.07)

const CELL_W := 300.0
const CELL_H := 200.0
const CELL_GAP_X := 50.0
const CELL_GAP_Y := 50.0
const GRID_COLS := 5
const GRID_ROWS := 2
const TOTAL_CELLS := GRID_ROWS * GRID_COLS

var show_dead: bool = false
var dead_btn_rect: Rect2 = Rect2()
@export var show_debug_overlay: bool = false

@onready var grid := ColorRect.new()

var _level_cell_rects: Array = []
var _back_btn_rect: Rect2 = Rect2()

func set_show_dead(v: bool) -> void:
	show_dead = v
	queue_redraw()

func _ready() -> void:
	layer = 10
	GameManager.state_changed.connect(_on_state_changed)
	_draw_grid_bg()

func _draw_grid_bg() -> void:
	grid.color = BG_COLOR
	grid.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(grid)

func _on_state_changed(_old: int, new_state: int) -> void:
	GameManager.log_step("state", "ui-state-changed", {
		"old": _old, "new": new_state
	})
	if new_state == GameManager.State.LEVEL_SELECT:
		_rebuild_cell_rects()
	queue_redraw()

func _rebuild_cell_rects() -> void:
	_level_cell_rects.clear()
	var vp := get_viewport_rect().size
	var total_w := float(GRID_COLS) * CELL_W + float(GRID_COLS - 1) * CELL_GAP_X
	var total_h := float(GRID_ROWS) * CELL_H + float(GRID_ROWS - 1) * CELL_GAP_Y
	var start_x := (vp.x - total_w) / 2.0
	var start_y := vp.y * 0.30
	for r in range(GRID_ROWS):
		for c in range(GRID_COLS):
			var x := start_x + float(c) * (CELL_W + CELL_GAP_X)
			var y := start_y + float(r) * (CELL_H + CELL_GAP_Y)
			_level_cell_rects.append(Rect2(x, y, CELL_W, CELL_H))
	var bw := 360.0
	var bh := 100.0
	var bx := (vp.x - bw) / 2.0
	var by := vp.y * 0.85
	_back_btn_rect = Rect2(bx, by, bw, bh)

func _draw() -> void:
	if GameManager.state == GameManager.State.PLAYING or GameManager.state == GameManager.State.DEAD:
		_draw_level_top_bar()
		_draw_bottom_controls()
		if GameManager.state == GameManager.State.DEAD or show_dead:
			_draw_dead_overlay()
	elif GameManager.state == GameManager.State.SUCCESS_ANIM:
		_draw_level_top_bar()
		_draw_bottom_controls()
		_draw_success_overlay()
	elif GameManager.state == GameManager.State.MENU:
		pass
	elif GameManager.state == GameManager.State.LEVEL_SELECT:
		_draw_level_select()
	elif GameManager.state == GameManager.State.COMPLETE_INTRO:
		_draw_complete_intro()
	elif GameManager.state == GameManager.State.COMPLETE:
		_draw_complete_buttons()
	if show_debug_overlay:
		_draw_debug_overlay()

func _draw_complete_intro() -> void:
	var vp := get_viewport_rect().size
	var W := vp.x
	var H := vp.y
	var cx := W / 2.0
	var cy := H / 2.0 - 40.0

	var t := GameManager._complete_timer
	var total_t := 90.0
	var alpha := 1.0
	if t > total_t - 30.0:
		alpha = (total_t - t) / 30.0
	alpha = clamp(alpha, 0.0, 1.0)

	draw_rect(Rect2(0, 0, W, H), Color(1, 1, 1, 0.85 * alpha), true)

	var base_angle := GameManager._complete_rot_angle
	var ring_data := [
		{"r": 0, "radius": 100.0, "color": Color(0, 0, 0, alpha), "vel_mult": 1.0},
		{"r": 1, "radius": 122.0, "color": Color(0.4, 0.4, 0.4, alpha), "vel_mult": -1.375},
		{"r": 2, "radius": 144.0, "color": Color(0.2, 0.2, 0.2, alpha), "vel_mult": 1.75},
	]

	for ring in ring_data:
		var angle := base_angle * ring.vel_mult
		_draw_dashed_ring(cx, cy, ring.radius, angle, ring.color, 5.0, 28.0, 18.0)

	var fade_in := 1.0
	if t > total_t - 40.0:
		fade_in = (total_t - t) / 40.0
	fade_in = clamp(fade_in, 0.0, 1.0)

	var text_alpha := alpha * fade_in
	var text_color := Color(0, 0, 0, text_alpha)
	var level_num := GameManager.current_level_id + 1
	var line1 := "🎉 恭喜通关！"
	var line2 := "第 %d 关" % level_num
	var line3 := "脑洞 +1"

	draw_string(ThemeDB.fallback_font,
		Vector2(cx, cy - 50.0),
		line1, HORIZONTAL_ALIGNMENT_CENTER, -1, 48, text_color)
	draw_string(ThemeDB.fallback_font,
		Vector2(cx, cy + 10.0),
		line2, HORIZONTAL_ALIGNMENT_CENTER, -1, 36, text_color)
	draw_string(ThemeDB.fallback_font,
		Vector2(cx, cy + 60.0),
		line3, HORIZONTAL_ALIGNMENT_CENTER, -1, 30, text_color)

	queue_redraw()

func _draw_dashed_ring(cx: float, cy: float, radius: float, rotation: float, color: Color, width: float, dash_len: float, gap_len: float) -> void:
	var total_circumference := TAU * radius
	var seg_len := dash_len + gap_len
	var num_segs := int(total_circumference / seg_len)
	if num_segs < 1:
		num_segs = 1
	for i in range(num_segs):
		var start_frac := (float(i) * seg_len) / total_circumference
		var end_frac := (float(i) * seg_len + dash_len) / total_circumference
		var a1 := rotation + start_frac * TAU
		var a2 := rotation + end_frac * TAU
		var pts := PackedVector2Array()
		pts.append(Vector2(cx + cos(a1) * radius, cy + sin(a1) * radius))
		pts.append(Vector2(cx + cos(a2) * radius, cy + sin(a2) * radius))
		if pts.size() >= 2:
			draw_line(pts[0], pts[1], color, width, true)

func _draw_level_select() -> void:
	var vp := get_viewport_rect().size
	var W := vp.x
	var H := vp.y

	draw_rect(Rect2(0, 0, W, H), Color.WHITE, true)

	draw_string(ThemeDB.fallback_font,
		Vector2(W / 2.0, H * 0.12),
		"选择关卡", HORIZONTAL_ALIGNMENT_CENTER, -1, 56, DARK)

	var unlocked := SaveManager.data.unlocked_level
	var completed_list := SaveManager.data.completed_levels

	for i in range(TOTAL_CELLS):
		var col := i % GRID_COLS
		var row := i / GRID_COLS
		var level_idx := i
		var cell_rect: Rect2 = _level_cell_rects[i]

		var is_available := level_idx in GameManager._available_levels
		var is_unlocked := level_idx < unlocked
		var is_completed := level_idx in completed_list

		var bg_color := Color.WHITE
		var status_text := ""
		var show_lock := false

		if not is_available:
			bg_color = Color(0.95, 0.95, 0.95)
			status_text = "📝 待开发"
		elif not is_unlocked:
			bg_color = Color(0.91, 0.91, 0.91)
			status_text = "🔒 未解锁"
			show_lock = true
		elif is_completed:
			bg_color = Color(0.835, 0.961, 0.835)
			status_text = "✓ 已通关"
		else:
			bg_color = Color.WHITE
			status_text = "未通关"

		_draw_simple_wonky(cell_rect.position.x, cell_rect.position.y,
			cell_rect.size.x, cell_rect.size.y,
			20.0, 100.0 + float(i) * 37.0, 2.0, 2.5, bg_color, DARK)

		var cx_cell := cell_rect.position.x + cell_rect.size.x / 2.0
		var cy_cell := cell_rect.position.y + cell_rect.size.y / 2.0

		if show_lock:
			_draw_lock_icon(cx_cell - 40.0, cy_cell + 5.0, 18.0, 14.0, 6.0, Color(0.3, 0.3, 0.3))

		var level_text := "第 %d 关" % (level_idx + 1)
		draw_string(ThemeDB.fallback_font,
			Vector2(cx_cell, cell_rect.position.y + 50.0),
			level_text, HORIZONTAL_ALIGNMENT_CENTER, -1, 28, DARK)

		draw_string(ThemeDB.fallback_font,
			Vector2(cx_cell, cell_rect.position.y + cell_rect.size.y - 30.0),
			status_text, HORIZONTAL_ALIGNMENT_CENTER, -1, 20, DARK)

	_draw_simple_wonky(_back_btn_rect.position.x, _back_btn_rect.position.y,
		_back_btn_rect.size.x, _back_btn_rect.size.y,
		24.0, 99999.0, 2.5, 3.0, WHITE, DARK)
	draw_string(ThemeDB.fallback_font,
		Vector2(_back_btn_rect.position.x + _back_btn_rect.size.x / 2.0,
			_back_btn_rect.position.y + _back_btn_rect.size.y / 2.0 + 10.0),
		"返回主菜单", HORIZONTAL_ALIGNMENT_CENTER, -1, 32, DARK)

func _draw_lock_icon(cx: float, cy: float, body_w: float, body_h: float, ring_r: float, color: Color) -> void:
	var body_x := cx - body_w / 2.0
	var body_y := cy - body_h / 2.0
	_draw_simple_wonky(body_x, body_y, body_w, body_h, 4.0, 7777.0, 1.2, 2.0, color, DARK)

	var ring_cx := cx
	var ring_cy := body_y
	var ring_pts := PackedVector2Array()
	var steps := 20
	for j in range(steps + 1):
		var t := PI + (PI / 2.0) * (float(j) / steps)
		ring_pts.append(Vector2(ring_cx + cos(t) * ring_r, ring_cy + sin(t) * ring_r))
	if ring_pts.size() >= 2:
		draw_polyline(ring_pts, DARK, 2.5, true)

func _get_door_open_t() -> float:
	var t: float = 0.0
	if LevelLoader and LevelLoader.all_entities:
		for e in LevelLoader.all_entities:
			if e is Door:
				t = max(t, e.open_t)
	return t

func _draw_debug_overlay() -> void:
	var bg := Color(0, 0, 0, 0.7)
	var fg := Color(0, 1, 0, 1)
	var font := ThemeDB.fallback_font
	var fs := 14
	var pad := 12.0
	var line_h := 16.0
	var w := 320.0
	var h := 112.0
	var x := 16.0
	var y := 16.0
	draw_rect(Rect2(x, y, w, h), bg, true)
	var lines: Array[String] = []
	lines.append("f=%d" % Engine.get_process_frames())
	lines.append("state=%s" % str(GameManager.state))
	lines.append("showSuccess=%s" % str(GameManager.success_timer > 0))
	lines.append("showDead=%s" % str(show_dead))
	var s_pct := 0.0
	if GameManager.SUCCESS_TOTAL > 0:
		s_pct = 1.0 - (float(GameManager.success_timer) / float(GameManager.SUCCESS_TOTAL))
	lines.append("sT=%d %d%%" % [GameManager.success_timer, int(s_pct * 100.0)])
	lines.append("doorOpenT=%.3f" % _get_door_open_t())
	lines.append("stuckCounter=%d" % GameManager._success_stuck_counter)
	for i in lines.size():
		var ly := y + pad + float(i) * line_h
		draw_string(font, Vector2(x + pad, ly + float(fs)), lines[i], HORIZONTAL_ALIGNMENT_LEFT, -1, fs, fg)
	queue_redraw()

func _draw_success_overlay() -> void:
	var size := get_viewport_rect().size
	var W := size.x
	var H := size.y
	var total: float = GameManager.SUCCESS_TOTAL
	var a: float = 0.0
	if GameManager.success_timer < 20:
		a = min(1.0, (20.0 - GameManager.success_timer) / 15.0)
	draw_rect(Rect2(0, 0, W, H), Color(0, 0, 0, 0.22 * a), true)
	var pw := 580.0
	var ph := 420.0
	var px := (W - pw) / 2.0
	var py := (H - ph) / 2.0
	_draw_simple_wonky(px, py, pw, ph, 30.0, 33333.0, 2.0, 4.5, Color(WHITE.r, WHITE.g, WHITE.b, a), Color(DARK.r, DARK.g, DARK.b, a))
	draw_string(ThemeDB.fallback_font,
		Vector2(W / 2.0, H / 2.0 - 110.0),
		"过关啦!", HORIZONTAL_ALIGNMENT_CENTER, -1, 56, Color(DARK.r, DARK.g, DARK.b, a))
	draw_string(ThemeDB.fallback_font,
		Vector2(W / 2.0, H / 2.0 - 40.0),
		"🎉 脑洞 +1", HORIZONTAL_ALIGNMENT_CENTER, -1, 30, Color(DARK.r, DARK.g, DARK.b, a))
	var cx := W / 2.0
	var cy := H / 2.0 + 60.0
	var cr := 48.0
	var bg_color := Color(DARK.r, DARK.g, DARK.b, 0.12 * a)
	var fg_color := Color(DARK.r, DARK.g, DARK.b, a)
	var ring_lw := 10.0
	var bg_pts := PackedVector2Array()
	var bg_steps := 60
	for j in range(bg_steps + 1):
		var t := -PI / 2.0 + TAU * (float(j) / bg_steps)
		bg_pts.append(Vector2(cx + cos(t) * cr, cy + sin(t) * cr))
	draw_polyline(bg_pts, bg_color, ring_lw, true)
	var p: float = 1.0 - (GameManager.success_timer / total)
	if p > 0.0:
		var fg_pts := PackedVector2Array()
		var fg_steps := 60
		var start_angle := -PI / 2.0
		var end_angle := start_angle + TAU * p
		for j in range(fg_steps + 1):
			var t := start_angle + (end_angle - start_angle) * (float(j) / fg_steps)
			fg_pts.append(Vector2(cx + cos(t) * cr, cy + sin(t) * cr))
		draw_polyline(fg_pts, fg_color, ring_lw, true)
	var tip_size := 22
	draw_string(ThemeDB.fallback_font,
		Vector2(W / 2.0, cy + cr + tip_size + 16.0),
		"即将进入下一关…", HORIZONTAL_ALIGNMENT_CENTER, -1, tip_size, Color(DARK.r, DARK.g, DARK.b, a))
	queue_redraw()

func _draw_dead_overlay() -> void:
	var size := get_viewport_rect().size
	var W := size.x
	var H := size.y
	draw_rect(Rect2(0, 0, W, H), Color(0, 0, 0, 0.22), true)
	var pw := 580.0
	var ph := 360.0
	var px := (W - pw) / 2.0
	var py := (H - ph) / 2.0
	_draw_simple_wonky(px, py, pw, ph, 30.0, 44445.0, 2.0, 4.5, WHITE, DARK)
	draw_string(ThemeDB.fallback_font,
		Vector2(W / 2.0, H / 2.0 - 80.0 + 20.0),
		"掉下去了…", HORIZONTAL_ALIGNMENT_CENTER, -1, 56, DARK)
	draw_string(ThemeDB.fallback_font,
		Vector2(W / 2.0, H / 2.0 - 10.0 + 10.0),
		"😵 脑洞 -1", HORIZONTAL_ALIGNMENT_CENTER, -1, 30, DARK)
	var bw := 360.0
	var bh := 110.0
	var bx := W / 2.0 - bw / 2.0
	var by := H / 2.0 + 40.0
	dead_btn_rect = Rect2(bx, by, bw, bh)
	_draw_simple_wonky(bx, by, bw, bh, 28.0, 60001.0, 2.0, 4.5, WHITE, DARK)
	draw_string(ThemeDB.fallback_font,
		Vector2(W / 2.0, by + bh / 2.0 + 14.0),
		"重 来", HORIZONTAL_ALIGNMENT_CENTER, -1, 40, DARK)

func _draw_complete_buttons() -> void:
	var bw: float = 260.0
	var bh: float = 110.0
	var gap: float = 40.0
	var total_w: float = bw * 3 + gap * 2
	var start_x: float = (get_viewport_rect().size.x - total_w) / 2.0
	var by: float = get_viewport_rect().size.y * 0.68
	var labels: Array[String] = ["返回菜单", "再玩一次", "下一关"]
	for i in 3:
		var bx: float = start_x + i * (bw + gap)
		var seed: int = 66666 + i * 11111
		_draw_simple_wonky(bx, by, bw, bh, 30.0, float(seed), 2.5, WHITE, DARK)
		draw_string(ThemeDB.fallback_font,
			Vector2(bx + bw / 2.0, by + bh / 2.0 + 6.0),
			labels[i], HORIZONTAL_ALIGNMENT_CENTER, -1, 30, DARK)

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

func _draw_simple_wonky(x: float, y: float, w: float, h: float, r: float, seed: float, amp: float, lw: float, fill_color: Color, stroke_color: Color = DARK) -> void:
	var p := _wonky_rect_points(x, y, w, h, r, seed, amp)
	draw_colored_polygon(p, fill_color)
	if stroke_color.a > 0.0 and lw > 0.0:
		draw_polyline(p + [p[0]], stroke_color, lw, true)

func _draw_filled_tri(cx: float, cy: float, size: float, dir: String, seed: float, color: Color = WHITE) -> void:
	var tri := PackedVector2Array()
	if dir == "left":
		tri = PackedVector2Array([
			Vector2(cx + size * 0.45 + _static_wobble(seed + 1, 1.2), cy - size * 0.55 + _static_wobble(seed + 2, 1.2)),
			Vector2(cx - size * 0.55 + _static_wobble(seed + 3, 1.2), cy + _static_wobble(seed + 4, 1.2)),
			Vector2(cx + size * 0.45 + _static_wobble(seed + 5, 1.2), cy + size * 0.55 + _static_wobble(seed + 6, 1.2))
		])
	elif dir == "right":
		tri = PackedVector2Array([
			Vector2(cx - size * 0.45 + _static_wobble(seed + 1, 1.2), cy - size * 0.55 + _static_wobble(seed + 2, 1.2)),
			Vector2(cx + size * 0.55 + _static_wobble(seed + 3, 1.2), cy + _static_wobble(seed + 4, 1.2)),
			Vector2(cx - size * 0.45 + _static_wobble(seed + 5, 1.2), cy + size * 0.55 + _static_wobble(seed + 6, 1.2))
		])
	else:
		tri = PackedVector2Array([
			Vector2(cx + _static_wobble(seed + 1, 1.2), cy - size * 0.55 + _static_wobble(seed + 2, 1.2)),
			Vector2(cx + size * 0.55 + _static_wobble(seed + 3, 1.2), cy + size * 0.45 + _static_wobble(seed + 4, 1.2)),
			Vector2(cx - size * 0.55 + _static_wobble(seed + 5, 1.2), cy + size * 0.45 + _static_wobble(seed + 6, 1.2))
		])
	draw_colored_polygon(tri, color)

func _draw_level_top_bar() -> void:
	var size := get_viewport_rect().size
	var W := size.x

	var tag_x := 60.0
	var tag_y := 44.0
	var tag_w := 180.0
	var tag_h := 74.0
	var tag_r := 16.0

	var pole_y_start := 0.0
	var pole_y_end := 44.0
	var pole_x1 := 104.0
	var pole_x2 := 196.0
	var pole_lw := 3.0
	var dot_r := 4.0

	draw_line(Vector2(pole_x1, pole_y_start), Vector2(pole_x1, pole_y_end), DARK, pole_lw, true)
	draw_line(Vector2(pole_x2, pole_y_start), Vector2(pole_x2, pole_y_end), DARK, pole_lw, true)
	draw_circle(Vector2(pole_x1, pole_y_end), dot_r, DARK)
	draw_circle(Vector2(pole_x2, pole_y_end), dot_r, DARK)

	_draw_simple_wonky(tag_x, tag_y, tag_w, tag_h, tag_r, 1.0, 1.8, 4.0, WHITE, DARK)

	var level_num := GameManager.current_level_id + 1
	draw_string(ThemeDB.fallback_font,
		Vector2(tag_x + tag_w / 2.0, tag_y + tag_h / 2.0 + 12),
		"第 %d 关" % [level_num],
		HORIZONTAL_ALIGNMENT_CENTER, -1, 30, DARK)

	var btn_sz := 82.0
	var btn_gap := 28.0
	var btn_r := 22.0
	var btn_lw := 4.5
	var btn_y := 44.0
	var btn_amp := 2.8
	var btn_start_x := W - 70.0 - btn_sz * 3.0 - btn_gap * 2.0

	for i in range(3):
		var bx := btn_start_x + float(i) * (btn_sz + btn_gap)
		_draw_simple_wonky(bx, btn_y, btn_sz, btn_sz, btn_r, 10.0 + float(i) * 5.0, btn_amp, btn_lw, WHITE, DARK)
		var icx := bx + btn_sz / 2.0
		var icy := btn_y + btn_sz / 2.0
		if i == 0:
			var qr := 12.0
			var qcx := icx
			var qcy := icy - 6.0
			var pts := PackedVector2Array()
			var asteps := 20
			for j in range(asteps + 1):
				var t := PI + (PI / 2.0) * (float(j) / asteps)
				pts.append(Vector2(qcx + cos(t) * qr, qcy + sin(t) * qr))
			var arc_end := Vector2(qcx + cos(-PI / 2.0) * qr + 0.5, qcy + sin(-PI / 2.0) * qr + qr + 2.0)
			pts.append(arc_end)
			draw_polyline(pts, DARK, 5.5, true)
			draw_circle(Vector2(icx, icy + 20.0), 3.8, DARK)
		elif i == 1:
			var cr := 18.0
			var a1_angle := -PI * 1.05
			var a2_angle := -PI * 0.05
			var a1x := icx + cos(a1_angle) * cr
			var a1y := icy + sin(a1_angle) * cr
			var a2x := icx + cos(a2_angle) * cr
			var a2y := icy + sin(a2_angle) * cr
			var arc_pts := PackedVector2Array()
			var asteps2 := 30
			for j in range(asteps2 + 1):
				var t := a1_angle + (a2_angle - a1_angle) * (float(j) / asteps2)
				arc_pts.append(Vector2(icx + cos(t) * cr, icy + sin(t) * cr))
			draw_polyline(arc_pts, DARK, 5.2, true)
			var tri1 := PackedVector2Array([
				Vector2(a1x - 4.0, a1y + 1.0),
				Vector2(a1x + 6.0, a1y - 3.0),
				Vector2(a1x - 3.0, a1y + 8.0)
			])
			draw_colored_polygon(tri1, DARK)
			var tri2 := PackedVector2Array([
				Vector2(a2x + 3.0, a2y - 9.0),
				Vector2(a2x + 10.0, a2y - 1.0),
				Vector2(a2x - 1.0, a2y + 5.0)
			])
			draw_colored_polygon(tri2, DARK)
		elif i == 2:
			draw_line(Vector2(icx - 10.0, icy - 18.0), Vector2(icx - 10.0, icy + 18.0), DARK, 7.0, true)
			draw_line(Vector2(icx + 10.0, icy - 18.0), Vector2(icx + 10.0, icy + 18.0), DARK, 7.0, true)

	var title := ""
	if LevelLoader.level_data.is_empty():
		title = "进门就过关了!"
	else:
		title = str(LevelLoader.level_data.get("name", "进门就过关了!"))
	var tx := W / 2.0
	var ty := 78.0
	var font_size := 56
	draw_string(ThemeDB.fallback_font,
		Vector2(tx, ty), title,
		HORIZONTAL_ALIGNMENT_CENTER, -1, font_size, DARK)

func _draw_bottom_controls() -> void:
	var size := get_viewport_rect().size
	var W := size.x
	var H := size.y

	var sz := 120.0
	var x1 := 70.0
	var x2 := x1 + sz + 90.0
	var x3 := W - 70.0 - sz
	var y := H - 70.0 - sz
	var r := 28.0
	var lw := 4.5
	var amp := 1.6

	var btn_fill := WHITE
	var btn_stroke := DARK
	var no_stroke := Color(0, 0, 0, 0)

	_draw_simple_wonky(x1 - 6, y - 4, sz + 12, sz + 12, r + 4, 100.0, amp, 0.0, Color(0, 0, 0, 0.05), no_stroke)
	_draw_simple_wonky(x1 - 3, y - 2, sz + 6, sz + 6, r + 2, 101.0, amp, 0.0, Color(0, 0, 0, 0.07), no_stroke)
	_draw_simple_wonky(x1, y, sz, sz, r, 102.0, amp, lw, btn_fill, btn_stroke)

	_draw_simple_wonky(x2 - 6, y - 4, sz + 12, sz + 12, r + 4, 200.0, amp, 0.0, Color(0, 0, 0, 0.05), no_stroke)
	_draw_simple_wonky(x2 - 3, y - 2, sz + 6, sz + 6, r + 2, 201.0, amp, 0.0, Color(0, 0, 0, 0.07), no_stroke)
	_draw_simple_wonky(x2, y, sz, sz, r, 202.0, amp, lw, btn_fill, btn_stroke)

	_draw_simple_wonky(x3 - 6, y - 4, sz + 12, sz + 12, r + 4, 300.0, amp, 0.0, Color(0, 0, 0, 0.05), no_stroke)
	_draw_simple_wonky(x3 - 3, y - 2, sz + 6, sz + 6, r + 2, 301.0, amp, 0.0, Color(0, 0, 0, 0.07), no_stroke)
	_draw_simple_wonky(x3, y, sz, sz, r, 302.0, amp, lw, btn_fill, btn_stroke)

	_draw_filled_tri(x1 + sz / 2.0, y + sz / 2.0, 62.0, "left", 400.0, DARK)
	_draw_filled_tri(x2 + sz / 2.0, y + sz / 2.0, 62.0, "right", 500.0, DARK)
	_draw_filled_tri(x3 + sz / 2.0, y + sz / 2.0, 72.0, "up", 600.0, DARK)

func _gui_input(event: InputEvent) -> void:
	if GameManager.state == GameManager.State.LEVEL_SELECT:
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
			var local: Vector2 = event.position
			for i in range(_level_cell_rects.size()):
				if _level_cell_rects[i].has_point(local):
					var level_idx := i
					var unlocked := SaveManager.data.unlocked_level
					var is_available := level_idx in GameManager._available_levels
					var is_unlocked := level_idx < unlocked
					if is_available and is_unlocked:
						GameManager.start_level(level_idx)
					accept_event()
					return
			if _back_btn_rect.has_point(local):
				GameManager.change_state(GameManager.State.MENU)
				accept_event()
				return
		if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
			GameManager.change_state(GameManager.State.MENU)
			accept_event()
	elif GameManager.state == GameManager.State.COMPLETE:
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
			var local: Vector2 = event.position
			var bw: float = 260.0, bh: float = 110.0, gap: float = 40.0
			var total_w: float = bw * 3 + gap * 2
			var start_x: float = (get_viewport_rect().size.x - total_w) / 2.0
			var by: float = get_viewport_rect().size.y * 0.68
			for i in 3:
				var bx: float = start_x + i * (bw + gap)
				if local.x >= bx and local.x <= bx + bw and local.y >= by and local.y <= by + bh:
					match i:
						0: GameManager.change_state(GameManager.State.MENU)
						1: GameManager.replay_current()
						2: GameManager.advance_to_next_level()
					accept_event()
					return
		if event is InputEventKey and event.pressed:
			if event.keycode == KEY_ESCAPE:
				GameManager.change_state(GameManager.State.MENU)
				accept_event()
			elif event.keycode == KEY_ENTER or event.keycode == KEY_SPACE:
				GameManager.replay_current()
				accept_event()
	elif (GameManager.state == GameManager.State.DEAD or show_dead) and event is InputEventMouseButton:
		var mb: InputEventMouseButton = event
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT:
			var pos := mb.position
			if dead_btn_rect.has_point(pos):
				show_dead = false
				GameManager.change_state(GameManager.State.PLAYING)
				LevelManager.load_level(0)
				accept_event()
	elif GameManager.state == GameManager.State.DEAD and event is InputEventKey:
		var k: InputEventKey = event
		if k.pressed and (k.keycode == KEY_SPACE or k.keycode == KEY_ENTER):
			show_dead = false
			GameManager.change_state(GameManager.State.PLAYING)
			LevelManager.load_level(0)
			accept_event()