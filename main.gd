extends Node2D

const FIELD := Rect2(80, 70, 1120, 580)
const GOAL_H := 180.0
const GOAL_Y := 290.0
const PLAYER_SPEED := 310.0
const SPRINT_SPEED := 430.0
const BALL_FRICTION := 0.985
const BALL_RADIUS := 12.0
const MATCH_LENGTH := 180.0

var player := Vector2(300, 360)
var teammates := [Vector2(420,220), Vector2(420,500), Vector2(560,300), Vector2(560,430)]
var opponents := [Vector2(980,220), Vector2(980,500), Vector2(850,300), Vector2(850,430), Vector2(1080,360)]
var ball := Vector2(640,360)
var ball_velocity := Vector2.ZERO
var score_home := 0
var score_away := 0
var elapsed := 0.0
var message := "KICK OFF"
var message_time := 2.0
var game_over := false

func _ready():
	queue_redraw()

func _input(event):
	if game_over:
		if event is InputEventKey and event.pressed and event.keycode == KEY_R:
			_restart_match()
		return
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	if player.distance_to(ball) >= 52:
		return
	if event.keycode == KEY_K:
		var target := Vector2(FIELD.end.x + 80, 360)
		ball_velocity = (target - ball).normalized() * 900.0
	elif event.keycode == KEY_J:
		var target := _nearest_teammate()
		ball_velocity = (target - ball).normalized() * 620.0

func _process(delta):
	if game_over:
		queue_redraw()
		return
	elapsed += delta
	message_time = max(0.0, message_time - delta)
	_update_player(delta)
	_update_ai(delta)
	_update_ball(delta)
	_check_goal()
	if elapsed >= MATCH_LENGTH:
		game_over = true
		message = "FULL TIME  %d - %d   (R to restart)" % [score_home, score_away]
		message_time = 999.0
	queue_redraw()

func _update_player(delta):
	var input_vec := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		input_vec.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		input_vec.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		input_vec.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		input_vec.y += 1.0
	var speed := SPRINT_SPEED if Input.is_key_pressed(KEY_SHIFT) else PLAYER_SPEED
	if input_vec.length() > 0.01:
		player += input_vec.normalized() * speed * delta
	player.x = clamp(player.x, FIELD.position.x + 20, FIELD.end.x - 20)
	player.y = clamp(player.y, FIELD.position.y + 20, FIELD.end.y - 20)

func _update_ai(delta):
	for i in range(teammates.size()):
		var p: Vector2 = teammates[i]
		var home := [Vector2(420,220), Vector2(420,500), Vector2(560,300), Vector2(560,430)][i]
		var target := home
		if ball.x < 700 and p.distance_to(ball) < 260:
			target = p.lerp(ball, 0.35)
		teammates[i] = p.move_toward(target, 150.0 * delta)

	for i in range(opponents.size()):
		var p: Vector2 = opponents[i]
		var target := p
		if i == 4 or p.distance_to(ball) < 240:
			target = p.lerp(ball, 0.22)
		opponents[i] = p.move_toward(target, 155.0 * delta)

	if ball.x > 700 and opponents[4].distance_to(ball) < 65:
		ball_velocity = (Vector2(300,360) - ball).normalized() * 360.0
	if ball.x > 760 and opponents[4].distance_to(ball) < 55:
		ball_velocity = (Vector2(FIELD.position.x - 50, 360) - ball).normalized() * 760.0

func _update_ball(delta):
	ball += ball_velocity * delta
	ball_velocity *= pow(BALL_FRICTION, delta * 60.0)

	if ball.y < FIELD.position.y + BALL_RADIUS or ball.y > FIELD.end.y - BALL_RADIUS:
		ball_velocity.y *= -0.82
		ball.y = clamp(ball.y, FIELD.position.y + BALL_RADIUS, FIELD.end.y - BALL_RADIUS)

	if ball.x < FIELD.position.x + BALL_RADIUS and not _in_goal_mouth(ball.y):
		ball_velocity.x *= -0.82
		ball.x = FIELD.position.x + BALL_RADIUS
	if ball.x > FIELD.end.x - BALL_RADIUS and not _in_goal_mouth(ball.y):
		ball_velocity.x *= -0.82
		ball.x = FIELD.end.x - BALL_RADIUS

	for p in teammates + opponents:
		var d := p.distance_to(ball)
		if d < 25 and d > 0:
			ball_velocity += (ball - p).normalized() * 80.0

func _in_goal_mouth(y: float) -> bool:
	return y >= GOAL_Y and y <= GOAL_Y + GOAL_H

func _check_goal():
	if ball.x < FIELD.position.x - 25 and _in_goal_mouth(ball.y):
		score_away += 1
		_reset_after_goal("AWAY GOAL")
	elif ball.x > FIELD.end.x + 25 and _in_goal_mouth(ball.y):
		score_home += 1
		_reset_after_goal("GOAL!")

func _reset_after_goal(text: String):
	message = text
	message_time = 2.0
	ball = Vector2(640,360)
	ball_velocity = Vector2.ZERO
	player = Vector2(300,360)

func _restart_match():
	player = Vector2(300,360)
	ball = Vector2(640,360)
	ball_velocity = Vector2.ZERO
	score_home = 0
	score_away = 0
	elapsed = 0.0
	message = "KICK OFF"
	message_time = 2.0
	game_over = false

func _nearest_teammate() -> Vector2:
	var best := teammates[0]
	var best_d := player.distance_to(best)
	for p in teammates:
		var d := player.distance_to(p)
		if d < best_d:
			best = p
			best_d = d
	return best

func _draw():
	draw_rect(Rect2(0,0,1280,720), Color("#07140d"))
	draw_rect(FIELD, Color("#167a3b"))
	for y in range(0, 10):
		var r := Rect2(FIELD.position.x + y * FIELD.size.x / 10.0, FIELD.position.y, FIELD.size.x / 10.0, FIELD.size.y)
		if y % 2 == 0:
			draw_rect(r, Color(0.08,0.42,0.20,1.0))
	draw_rect(FIELD, Color.WHITE, false, 4)
	draw_line(Vector2(640,70), Vector2(640,650), Color.WHITE, 3)
	draw_circle(Vector2(640,360), 92, Color.WHITE, false, 3)
	draw_rect(Rect2(80,235,140,250), Color.WHITE, false, 3)
	draw_rect(Rect2(1060,235,140,250), Color.WHITE, false, 3)
	draw_rect(Rect2(80,290,55,140), Color.WHITE, false, 3)
	draw_rect(Rect2(1145,290,55,140), Color.WHITE, false, 3)
	draw_rect(Rect2(20,290,60,180), Color("#dedede"), false, 5)
	draw_rect(Rect2(1200,290,60,180), Color("#dedede"), false, 5)

	for p in teammates:
		draw_circle(p, 17, Color("#3f8cff"))
		draw_circle(p, 17, Color.WHITE, false, 2)
	for p in opponents:
		draw_circle(p, 17, Color("#ef4444"))
		draw_circle(p, 17, Color.WHITE, false, 2)

	draw_circle(player, 19, Color("#ffd84d"))
	draw_circle(player, 19, Color.WHITE, false, 2)
	draw_circle(ball, BALL_RADIUS, Color.WHITE)
	draw_circle(ball, BALL_RADIUS, Color("#222222"), false, 2)

	draw_string(ThemeDB.fallback_font, Vector2(555,42), "%d  -  %d" % [score_home, score_away], HORIZONTAL_ALIGNMENT_LEFT, -1, 32, Color.WHITE)
	draw_string(ThemeDB.fallback_font, Vector2(90,42), "WASD/Arrows Move   SHIFT Sprint   J Pass   K Shoot", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color.WHITE)
	if message_time > 0:
		draw_string(ThemeDB.fallback_font, Vector2(430,680), message, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, Color.WHITE)
