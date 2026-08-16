extends CharacterBody2D
class_name Player
@icon("res://icon_player.svg")

signal fell_to_death()

var walkT: float = 0.0
var sH: float = 0.0
var sF: float = 0.0

const GRAVITY := 2000.0
const MAX_FALL := 1200.0
const MOVE_SPEED := 420.0
const JUMP_VELOCITY := -780.0
const HALF_W := 40.0
const HALF_H := 60.0

var move_dir := 0
var want_jump := false
var is_alive := true
var frozen: bool = false
var _snap_door_x: float = -1.0
var _log_frame_counter: int = 0

signal entered_door(door_id: String)
signal died

func _ready() -> void:
	try:
		collision_layer = 1
		collision_mask = 2
		var cs := get_node_or_null("CollisionShape2D") as CollisionShape2D
		if cs == null:
			cs = CollisionShape2D.new()
			add_child(cs)
		if cs.shape == null:
			var cap := CapsuleShape2D.new()
			cap.radius = HALF_W
			cap.height = HALF_H * 2.0
			cs.shape = cap
		GameManager.state_changed.connect(_on_game_state_changed)
	except e:
		GameManager.log_step("fatal", "player_ready-exception", {
			"msg": str(e)
		})

func _on_game_state_changed(old_state: int, new_state: int) -> void:
	if old_state == GameManager.State.SUCCESS_ANIM:
		scale = Vector2(1.0, 1.0)
		visible = true

func set_move(dir: int) -> void:
	move_dir = clamp(dir, -1, 1)

func jump() -> void:
	want_jump = true

func _physics_process(delta: float) -> void:
	if GameManager.state == GameManager.State.SUCCESS_ANIM:
		velocity = Vector2.ZERO
		var elapsed: float = float(GameManager.SUCCESS_TOTAL - GameManager.success_timer)
		if elapsed >= 100.0:
			visible = false
		elif elapsed >= 40.0:
			visible = true
			var phase_t: float = clamp((elapsed - 40.0) / 60.0, 0.0, 1.0)
			var eased: float = phase_t * phase_t
			var ax: float = lerp(GameManager._anim_start.x, GameManager._anim_target.x, eased)
			var ay: float = lerp(GameManager._anim_start.y, GameManager._anim_target.y, eased)
			global_position = Vector2(ax, ay)
			var s: float = 1.0 - eased
			scale = Vector2(s, s)
		else:
			visible = true
			scale = Vector2(1.0, 1.0)
		var k: float = min(1.0, delta * 10.0)
		sH = lerp(sH, 0.0, k)
		sF = lerp(sF, 0.0, k)
		queue_redraw()
		return

	if GameManager.state != GameManager.State.PLAYING:
		velocity = Vector2.ZERO
		var k: float = min(1.0, delta * 10.0)
		sH = lerp(sH, 0.0, k)
		sF = lerp(sF, 0.0, k)
		if GameManager.state == GameManager.State.COMPLETE and UIManager:
			UIManager.set_show_dead(false)
		return

	if frozen or GameManager.state == GameManager.State.COMPLETE:
		velocity = Vector2.ZERO
		if _snap_door_x > 0.0:
			global_position.x = _snap_door_x
		var k: float = min(1.0, delta * 10.0)
		sH = lerp(sH, 0.0, k)
		sF = lerp(sF, 0.0, k)
		Main.show_dead = false
		return

	if not is_alive:
		return

	try:
		velocity.y += GRAVITY * delta
		velocity.y = min(velocity.y, MAX_FALL)

		if want_jump and is_on_floor():
			velocity.y = JUMP_VELOCITY
			want_jump = false

		velocity.x = move_dir * MOVE_SPEED
		move_and_slide()

		_log_frame_counter += 1

		for i in get_slide_collision_count():
			var col := get_slide_collision(i)
			if col and col.get_collider():
				var other := col.get_collider()
				if other.is_in_group("door"):
					var door: Door = other as Door
					if door:
						GameManager.log_step("door", "door-hit", {
							"door_id": door.door_id,
							"is_goal": door.is_goal,
							"px": position.x,
							"py": position.y,
							"overlap": get_slide_collision_count()
						})
					other.try_enter(self)

		if _log_frame_counter % 30 == 0:
			GameManager.log_step("debug", "physics", {
				"px": position.x,
				"py": position.y,
				"vx": velocity.x,
				"vy": velocity.y,
				"on_ground": is_on_floor(),
				"state": GameManager.state
			})

		if GameManager.success_timer > 0 and _log_frame_counter % 10 == 0:
			GameManager.log_step("debug", "success-tick", {
				"timer": GameManager.success_timer,
				"px": position.x,
				"py": position.y
			})

		var speed: float = abs(velocity.x)
		var walking: bool = is_on_floor() and speed > 10.0
		if walking:
			var freq: float = 1.5 + min(6.5, (speed / MOVE_SPEED) * 7.0)
			walkT += delta * freq * PI * 2.0
		var swinging: float = sin(walkT)
		var tgtH: float = swinging * 0.32 if walking else 0.0
		var tgtF: float = -swinging * 0.27 if walking else 0.0
		var k: float = min(1.0, delta * 10.0)
		sH = lerp(sH, tgtH, k)
		sF = lerp(sF, tgtF, k)

		if position.y > 1080.0 + 400.0:
			emit_signal("fell_to_death")
			velocity.x = 0.0
			velocity.y = 0.0
	except e:
		GameManager.log_step("fatal", "physics_process-exception", {
			"msg": str(e), "stack": e.stack if "stack" in e else ""
		})

func _static_wobble(seed: float, amp: float) -> float:
	return fmod(sin(seed * 12.9898) * 43758.5453, 1.0) * amp - amp * 0.5

func _draw() -> void:
	draw_doodle()

func draw_doodle() -> void:
	var cur_scale: float = scale.x
	if cur_scale < 0.001:
		return

	var cx := 0.0
	var cy := 0.0
	var rx := HALF_W * 0.94
	var ry := HALF_H * 0.78
	var amp := 1.5
	var seed := 1.0

	var points := PackedVector2Array()
	for i in range(41):
		var t := PI * 2.0 * (float(i) / 40.0)
		var px := cx + cos(t) * rx
		var py := cy + sin(t) * ry
		points.append(Vector2(px + _static_wobble(seed + float(i), amp), py + _static_wobble(seed + float(i) + 200.0, amp)))
	draw_colored_polygon(points, Color.WHITE)
	draw_polyline(points + [points[0]], Color.BLACK, 4.0, true)

	var draw_details: bool = cur_scale >= 0.25

	if draw_details:
		var ah1_start := Vector2(-12.0, -ry + 4.0)
		var ah1_ctrl := Vector2(-18.0, -ry - 10.0)
		var ah1_end := Vector2(-22.0, -ry - 18.0)
		var ah1_points := PackedVector2Array()
		for i in range(11):
			var t := float(i) / 10.0
			var px := (1.0 - t) * (1.0 - t) * ah1_start.x + 2.0 * (1.0 - t) * t * ah1_ctrl.x + t * t * ah1_end.x
			var py := (1.0 - t) * (1.0 - t) * ah1_start.y + 2.0 * (1.0 - t) * t * ah1_ctrl.y + t * t * ah1_end.y
			ah1_points.append(Vector2(px + _static_wobble(seed + 500.0 + float(i), 0.8), py + _static_wobble(seed + 550.0 + float(i), 0.8)))
		draw_polyline(ah1_points, Color.BLACK, 3.0, true)

		var ah2_start := Vector2(12.0, -ry + 4.0)
		var ah2_ctrl := Vector2(18.0, -ry - 10.0)
		var ah2_end := Vector2(22.0, -ry - 18.0)
		var ah2_points := PackedVector2Array()
		for i in range(11):
			var t := float(i) / 10.0
			var px := (1.0 - t) * (1.0 - t) * ah2_start.x + 2.0 * (1.0 - t) * t * ah2_ctrl.x + t * t * ah2_end.x
			var py := (1.0 - t) * (1.0 - t) * ah2_start.y + 2.0 * (1.0 - t) * t * ah2_ctrl.y + t * t * ah2_end.y
			ah2_points.append(Vector2(px + _static_wobble(seed + 600.0 + float(i), 0.8), py + _static_wobble(seed + 650.0 + float(i), 0.8)))
		draw_polyline(ah2_points, Color.BLACK, 3.0, true)

		var eyY := -6.0
		var lw := 3.5

		var lx := -rx * 0.34
		var l_tip := Vector2(lx + 2.0, eyY)
		var l_p1 := Vector2(lx - 8.0, eyY - 4.8)
		var l_p2 := Vector2(lx - 8.0, eyY + 4.8)
		draw_line(l_p1, l_tip, Color.BLACK, lw, true)
		draw_line(l_p2, l_tip, Color.BLACK, lw, true)

		var rx_eye := rx * 0.34
		var r_tip := Vector2(rx_eye - 2.0, eyY)
		var r_p1 := Vector2(rx_eye + 8.0, eyY - 4.8)
		var r_p2 := Vector2(rx_eye + 8.0, eyY + 4.8)
		draw_line(r_p1, r_tip, Color.BLACK, lw, true)
		draw_line(r_p2, r_tip, Color.BLACK, lw, true)

		draw_circle(Vector2(0.0, ry * 0.30), 4.2, Color.BLACK)

	var speed: float = abs(velocity.x)
	var walking: bool = is_on_floor() and speed > 10.0
	var inAir: bool = not is_on_floor() and not frozen

	var angHL: float = +sH
	var angHR: float = -sH
	var hL_offX: float = 0.0
	var hR_offX: float = 0.0
	var hL_offY: float = 0.0
	var hR_offY: float = 0.0

	if inAir:
		var raise: float = 20.0 + sin(walkT * 2.0) * 8.0
		hL_offY = -raise
		hR_offY = -raise
		hL_offX = -2.0
		hR_offX = +2.0
		angHL = 0.0
		angHR = 0.0

	if draw_details:
		var lh_root_base := Vector2(-rx * 1.06, ry * 0.45)
		var lh_root := Vector2(
			lh_root_base.x + hL_offX + _static_wobble(seed + 31.0, 0.5),
			lh_root_base.y + hL_offY + _static_wobble(seed + 32.0, 0.5)
		)
		var lh_vec := Vector2(0.0, 14.0).rotated(angHL) + Vector2(_static_wobble(seed + 33.0, 0.5), _static_wobble(seed + 34.0, 0.5))
		var lh_end := lh_root + lh_vec
		draw_line(lh_root, lh_end, Color.BLACK, 3.0, true)
		draw_circle(lh_end + Vector2(_static_wobble(seed + 35.0, 0.5), _static_wobble(seed + 36.0, 0.5)), 3.5, Color.BLACK)

		var rh_root_base := Vector2(rx * 1.06, ry * 0.45)
		var rh_root := Vector2(
			rh_root_base.x + hR_offX + _static_wobble(seed + 37.0, 0.5),
			rh_root_base.y + hR_offY + _static_wobble(seed + 38.0, 0.5)
		)
		var rh_vec := Vector2(0.0, 14.0).rotated(angHR) + Vector2(_static_wobble(seed + 39.0, 0.5), _static_wobble(seed + 40.0, 0.5))
		var rh_end := rh_root + rh_vec
		draw_line(rh_root, rh_end, Color.BLACK, 3.0, true)
		draw_circle(rh_end + Vector2(_static_wobble(seed + 41.0, 0.5), _static_wobble(seed + 42.0, 0.5)), 3.5, Color.BLACK)

		var fShL: float = +sin(walkT) * 10.0 if walking else 0.0
		var fShR: float = -sin(walkT) * 10.0 if walking else 0.0
		var fOffY: float = -6.0 if inAir else 0.0

		var lf_root_base := Vector2(-16.0, ry - 4.0)
		var lf_root := Vector2(
			lf_root_base.x + fShL + _static_wobble(seed + 51.0, 0.3),
			lf_root_base.y + fOffY + _static_wobble(seed + 52.0, 0.4)
		)
		var lf_vec := Vector2(0.0, 11.0) + Vector2(_static_wobble(seed + 53.0, 0.3), _static_wobble(seed + 54.0, 0.3))
		var lf_end := lf_root + lf_vec
		draw_line(lf_root, lf_end, Color.BLACK, 3.0, true)
		var lf_sole_l := lf_end + Vector2(-2.5, 0.0) + Vector2(_static_wobble(seed + 55.0, 0.3), _static_wobble(seed + 56.0, 0.3))
		var lf_sole_r := lf_end + Vector2(+2.5, 0.0) + Vector2(_static_wobble(seed + 57.0, 0.3), _static_wobble(seed + 58.0, 0.3))
		draw_line(lf_sole_l, lf_sole_r, Color.BLACK, 3.0, true)

		var rf_root_base := Vector2(+16.0, ry - 4.0)
		var rf_root := Vector2(
			rf_root_base.x + fShR + _static_wobble(seed + 59.0, 0.3),
			rf_root_base.y + fOffY + _static_wobble(seed + 60.0, 0.4)
		)
		var rf_vec := Vector2(0.0, 11.0) + Vector2(_static_wobble(seed + 61.0, 0.3), _static_wobble(seed + 62.0, 0.3))
		var rf_end := rf_root + rf_vec
		draw_line(rf_root, rf_end, Color.BLACK, 3.0, true)
		var rf_sole_l := rf_end + Vector2(-2.5, 0.0) + Vector2(_static_wobble(seed + 63.0, 0.3), _static_wobble(seed + 64.0, 0.3))
		var rf_sole_r := rf_end + Vector2(+2.5, 0.0) + Vector2(_static_wobble(seed + 65.0, 0.3), _static_wobble(seed + 66.0, 0.3))
		draw_line(rf_sole_l, rf_sole_r, Color.BLACK, 3.0, true)

func snap_to_door(door_global_x: float) -> void:
	frozen = true
	velocity = Vector2.ZERO
	_snap_door_x = door_global_x
	global_position.x = door_global_x
