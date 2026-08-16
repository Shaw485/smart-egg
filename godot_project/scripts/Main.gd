extends Node2D
# 主场景控制器：处理状态切换下的菜单/关卡画面

@onready var menu_layer: Control = $MenuLayer

var show_dead: bool = false

func _ready() -> void:
	get_viewport().connect("size_changed", _on_size_changed)
	GameManager.state_changed.connect(_on_state_changed)
	_on_state_changed(GameManager.State.MENU, GameManager.state)

func _process(_delta: float) -> void:
	# 键鼠输入：传给玩家
	if GameManager.state == GameManager.State.PLAYING:
		if LevelManager.player:
			var dir := 0
			if Input.is_action_pressed("move_left"):
				dir -= 1
			if Input.is_action_pressed("move_right"):
				dir += 1
			LevelManager.player.set_move(dir)
			if Input.is_action_just_pressed("jump"):
				LevelManager.player.jump()
			if Input.is_action_just_pressed("ui_cancel"):
				GameManager.toggle_pause()

func _on_state_changed(_old: int, new_state: int) -> void:
	menu_layer.visible = (new_state == GameManager.State.MENU or new_state == GameManager.State.LEVEL_SELECT)
	if new_state == GameManager.State.PLAYING:
		LevelManager.load_level(GameManager.current_level_id)
		await get_tree().process_frame
		if LevelManager.player:
			if not LevelManager.player.fell_to_death.is_connected(_on_player_fell):
				LevelManager.player.fell_to_death.connect(_on_player_fell)
		show_dead = false
		UIManager.set_show_dead(false)
	elif new_state == GameManager.State.DEAD:
		show_dead = true
		UIManager.set_show_dead(true)
		if LevelManager.player:
			LevelManager.player.velocity.x = 0.0
			LevelManager.player.velocity.y = 0.0
	elif new_state == GameManager.State.LEVEL_SELECT:
		menu_layer.visible = false
		show_dead = false
		UIManager.set_show_dead(false)
	else:
		show_dead = false
		UIManager.set_show_dead(false)

func _on_player_fell() -> void:
	GameManager.change_state(GameManager.State.DEAD)

func _on_size_changed() -> void:
	queue_redraw()
