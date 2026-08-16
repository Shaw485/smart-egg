extends StaticBody2D
class_name Platform
@onready var collision: CollisionShape2D = $CollisionShape2D

var kind: String = "ground"

func _ready() -> void:
	collision_layer = 2
	collision_mask = 0
	collision = get_node_or_null("CollisionShape2D") as CollisionShape2D
	if collision == null:
		collision = CollisionShape2D.new()
		add_child(collision)

func configure(cfg: Dictionary) -> void:
	position = Vector2(cfg.get("x", 0), cfg.get("y", 0))
	var w := float(cfg.get("w", 200))
	var h := float(cfg.get("h", 40))
	kind = str(cfg.get("kind", "ground"))
	var rect := RectangleShape2D.new()
	rect.size = Vector2(w, h)
	if collision == null:
		collision = CollisionShape2D.new()
		add_child(collision)
	collision.shape = rect
	set_meta("w", w)
	set_meta("h", h)
	queue_redraw()

func _static_wobble(seed: float, amp: float) -> float:
	return fmod(sin(seed * 12.9898) * 43758.5453, 1.0) * amp - amp * 0.5

func _sketchLine(x1: float, y1: float, x2: float, y2: float, lw: float, seed: float, amp: float) -> void:
	var dx := x2 - x1
	var dy := y2 - y1
	var dist := sqrt(dx * dx + dy * dy)
	var seg := 14.0
	var n := max(1, int(ceil(dist / seg)))
	var pts := PackedVector2Array()
	for i in range(n + 1):
		var t := float(i) / float(n)
		var px := x1 + dx * t + _static_wobble(seed + float(i), amp)
		var py := y1 + dy * t + _static_wobble(seed + float(i) + 50.0, amp)
		pts.append(Vector2(px, py))
	draw_polyline(pts, Color.BLACK, lw, true)

func _drawGrassPair(cx: float, cy: float, seed: float) -> void:
	var leans := [-7.0, 7.0]
	for i in range(leans.size()):
		var s := seed + float(i) * 5.0
		var height := 11.0 + _static_wobble(s, 1.2)
		var base_x := cx + _static_wobble(s + 1.0, 0.6)
		var tip_x := base_x + leans[i] + _static_wobble(s + 2.0, 0.7)
		var half_width := 2.3
		var leaf := PackedVector2Array([
			Vector2(base_x - half_width, cy),
			Vector2(tip_x - half_width, cy - height * 0.55),
			Vector2(tip_x, cy - height),
			Vector2(tip_x + half_width, cy - height * 0.55),
			Vector2(base_x + half_width, cy)
		])
		draw_colored_polygon(leaf, Color.WHITE)
		draw_polyline(leaf + [leaf[0]], Color.BLACK, 2.6, true)

func _draw() -> void:
	var w: float = get_meta("w", 200)
	var h: float = get_meta("h", 40)
	var left := -w / 2.0
	var right := w / 2.0
	var top := -h / 2.0
	var bottom := h / 2.0

	if kind == "ground":
		var bandThick := 5.5
		var whiteH := 26.0
		var topLineY := top
		var whiteBot := topLineY + bandThick + whiteH

		draw_rect(Rect2(left, topLineY + bandThick, w, whiteH), Color.WHITE, true)

		_sketchLine(left, topLineY, right, topLineY, bandThick, 1.0, 2.0)
		_sketchLine(left, topLineY + bandThick + whiteH, right, topLineY + bandThick + whiteH, bandThick, 500.0, 2.0)

		draw_rect(Rect2(left, whiteBot, w, bottom - whiteBot), Color(0.86, 0.86, 0.86), true)

		_sketchLine(left, bottom, right, bottom, bandThick * 0.8, 1000.0, 2.0)

		var grassCount := int(floor(w / 110.0))
		for i in range(grassCount):
			var gx := left + (right - left) * (float(i + 1) / float(grassCount + 1))
			_drawGrassPair(gx, topLineY, 2000.0 + float(i) * 17.0)
	else:
		var r := h / 2.0
		var steps := 16
		var amp := 1.6
		var cap := PackedVector2Array()
		var seed := 1.0

		cap.append(Vector2(left + r + _static_wobble(seed + 1, amp), top + _static_wobble(seed + 2, amp)))
		cap.append(Vector2(right - r + _static_wobble(seed + 3, amp), top + _static_wobble(seed + 4, amp)))

		for i in range(steps):
			var t := -PI / 2.0 + PI * (float(i + 1) / steps)
			var px := right - r + cos(t) * r
			var py := r + sin(t) * r
			cap.append(Vector2(px + _static_wobble(seed + 10.0 + float(i), amp), py + _static_wobble(seed + 60.0 + float(i), amp)))

		cap.append(Vector2(right - r + _static_wobble(seed + 120.0, amp), bottom + _static_wobble(seed + 121.0, amp)))
		cap.append(Vector2(left + r + _static_wobble(seed + 122.0, amp), bottom + _static_wobble(seed + 123.0, amp)))

		for i in range(steps):
			var t := PI / 2.0 + PI * (float(i + 1) / steps)
			var px := left + r + cos(t) * r
			var py := r + sin(t) * r
			cap.append(Vector2(px + _static_wobble(seed + 200.0 + float(i), amp), py + _static_wobble(seed + 260.0 + float(i), amp)))

		draw_colored_polygon(cap, Color.WHITE)
		draw_polyline(cap + [cap[0]], Color.BLACK, 4.5, true)

		_sketchLine(left + 16.0, top + 3.0, right - 16.0, top + 3.0, 17.0, 760.0, 3.2)
		_drawGrassPair(left + w * 0.20, top - 4.0, 5000.0)
		_drawGrassPair(left + w * 0.82, top - 4.0, 6000.0)
		_sketchLine(left + w * 0.20, 8.0, left + w * 0.29, 7.0, 2.2, 1000.0, 1.1)
		_sketchLine(left + w * 0.70, 7.0, left + w * 0.78, 6.0, 2.2, 1100.0, 1.1)
