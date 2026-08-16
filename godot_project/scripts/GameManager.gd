extends Node
class_name GameManager

enum State { MENU, LEVEL_SELECT, PLAYING, DEAD, BETWEEN, COMPLETE, PAUSED, SUCCESS_ANIM, COMPLETE_INTRO }

var state: State = State.MENU
var current_level_id: int = 0
const SUCCESS_TOTAL: int = 120
const SUCCESS_TIMER_FRAMES: int = SUCCESS_TOTAL
var success_timer: int = 0
var _success_stuck_counter: int = 0
var door_open_t: float = 0.0
var _anim_start: Vector2 = Vector2.ZERO
var _anim_target: Vector2 = Vector2.ZERO
var _anim_target_door: Node2D = null

var _complete_timer: float = 0.0
var _complete_rot_angle: float = 0.0

signal state_changed(old_state: int, new_state: int)
signal level_started(level_id: int)
signal level_completed(level_id: int)

const TOTAL_LEVELS := 10
const LEVEL_COUNT := TOTAL_LEVELS
const LOG_MAX: int = 50
var _log_buffer: Array = []
var _success_logged_ticks: Dictionary = {}
var _available_levels: Array = []

func _ready() -> void:
	randomize()
	_load_progress()
	_available_levels = probe_available_levels()
	change_state(State.MENU)

func _process(delta: float) -> void:
	if state == State.COMPLETE_INTRO:
		_complete_timer -= 1.0
		_complete_rot_angle += 0.04
		if _complete_timer <= 0.0:
			_complete_timer = 0.0
			change_state(State.COMPLETE)
		if UIManager:
			UIManager.queue_redraw()
		return

	if state == State.SUCCESS_ANIM or success_timer > 0:
		_success_stuck_counter += 1
		if state == State.SUCCESS_ANIM:
			door_open_t = min(1.0, door_open_t + 1.0 / 40.0)
		if success_timer > 0:
			success_timer -= 1
			var tick_values: Array = [120, 100, 80, 60, 40, 20, 1]
			if success_timer in tick_values and not _success_logged_ticks.has(success_timer):
				_success_logged_ticks[success_timer] = true
				var elapsed: int = SUCCESS_TOTAL - success_timer
				var phase_str: String = ""
				if elapsed < 40:
					phase_str = "phase1-door"
				elif elapsed < 100:
					phase_str = "phase2-suck"
				else:
					phase_str = "phase3-popup"
				log_step("success", "success-tick", {
					"timer": success_timer,
					"elapsed": elapsed,
					"phase": phase_str,
					"door_open_t": door_open_t
				})
		if success_timer <= 0:
			success_timer = 0
			if state == State.SUCCESS_ANIM:
				_complete_timer = 90.0
				_complete_rot_angle = 0.0
				change_state(State.COMPLETE_INTRO)
			else:
				var next_id := current_level_id + 1
				if next_id < LEVEL_COUNT and SaveManager.is_level_unlocked(next_id):
					change_state(State.BETWEEN)
				else:
					change_state(State.COMPLETE)
		if _success_stuck_counter > SUCCESS_TOTAL * 2:
			log_step("fatal", "success-watchdog-forced-complete", {
				"level": current_level_id,
				"stuck_frames": _success_stuck_counter,
				"timer": success_timer
			})
			success_timer = 0
			if state == State.SUCCESS_ANIM:
				_complete_timer = 90.0
				_complete_rot_angle = 0.0
				change_state(State.COMPLETE_INTRO)
			else:
				change_state(State.COMPLETE)
			_success_stuck_counter = 0
	else:
		_success_stuck_counter = 0

func change_state(new_state: State) -> void:
	if state == new_state:
		return
	if new_state == State.DEAD and state == State.COMPLETE:
		return
	var old := state
	if old == State.SUCCESS_ANIM:
		door_open_t = 0.0
		_anim_start = Vector2.ZERO
		_anim_target = Vector2.ZERO
		_anim_target_door = null
		_success_logged_ticks.clear()
	state = new_state
	if new_state == State.COMPLETE:
		UIManager.set_show_dead(false)
	log_step("state", "change_state", {
		"from": old, "to": new_state,
		"level": current_level_id, "success_timer": success_timer
	})
	state_changed.emit(old, new_state)

func start_level(id: int) -> void:
	if id < 0 or id >= LEVEL_COUNT:
		return
	if not SaveManager.is_level_unlocked(id):
		log_step("fatal", "start_level-locked", {"level": id})
		return
	current_level_id = id
	change_state(State.PLAYING)
	level_started.emit(id)
	try:
		LevelManager.load_level(id)
	except e:
		log_step("fatal", "start_level-exception", {
			"level": id, "msg": str(e)
		})

func loadLevelByIndex(idx: int) -> void:
	start_level(idx)

func replay_current() -> void:
	start_level(current_level_id)

func complete_current(door: Node2D = null) -> void:
	try:
		SaveManager.complete_level(current_level_id)
	except e:
		log_step("fatal", "complete_current-exception", {
			"level": current_level_id, "msg": str(e)
		})
	level_completed.emit(current_level_id)
	success_timer = SUCCESS_TOTAL
	door_open_t = 0.0
	_success_logged_ticks.clear()
	if LevelLoader and LevelLoader.player:
		_anim_start = LevelLoader.player.global_position
	if door:
		_anim_target_door = door
		var door_pos: Vector2 = door.global_position
		var door_h_val: float = door.door_h if "door_h" in door else 240.0
		_anim_target = Vector2(door_pos.x, door_pos.y - door_h_val * 0.15)
	log_step("success", "complete_current", {
		"level": current_level_id,
		"timer": success_timer,
		"anim_start_x": _anim_start.x,
		"anim_start_y": _anim_start.y,
		"anim_target_x": _anim_target.x,
		"anim_target_y": _anim_target.y
	})
	change_state(State.SUCCESS_ANIM)

func advance_to_next_level() -> void:
	var next := current_level_id + 1
	if next < LEVEL_COUNT and SaveManager.is_level_unlocked(next):
		start_level(next)
	else:
		change_state(State.COMPLETE)

func back_to_menu() -> void:
	change_state(State.MENU)

func toggle_pause() -> void:
	if state == State.PLAYING:
		change_state(State.PAUSED)
		get_tree().paused = true
	elif state == State.PAUSED:
		change_state(State.PLAYING)
		get_tree().paused = false

func _save_progress() -> void:
	SaveManager.save()

func _load_progress() -> void:
	SaveManager.load()

func probe_available_levels() -> Array:
	var available: Array = []
	for i in range(TOTAL_LEVELS):
		var path := "res://levels/level_%d.json" % i
		if FileAccess.file_exists(path):
			available.append(i)
	return available

func log_step(cat: String, tag: String, kv: Dictionary = {}) -> void:
	var entry: Dictionary = {
		"f": Engine.get_process_frames(),
		"t": Time.get_ticks_msec() / 1000.0,
		"cat": cat,
		"tag": tag,
		"kv": kv
	}
	_log_buffer.append(entry)
	if _log_buffer.size() > LOG_MAX:
		_log_buffer.remove_at(0)
	if cat in ["state", "door", "success", "fatal", "debug"]:
		print("[LOG f=%d %s/%s] %s" % [
			entry.f, cat, tag, JSON.stringify(kv)
		])

func dump_logs() -> String:
	return JSON.stringify(_log_buffer)

func clear_logs() -> void:
	_log_buffer = []