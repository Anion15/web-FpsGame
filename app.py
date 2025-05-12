from flask import Flask, render_template, send_from_directory, request, jsonify
from flask_socketio import SocketIO, emit
from world_data import WorldData

import os
import json
import uuid
import time
import math
import random
from collections import deque
import threading

app = Flask(__name__)
app.config['SECRET_KEY'] = 'fps-game-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

# 게임 상태 (플레이어, 맵 객체 등)
game_state = {
    'players': {},
    'respawn_points': [
        {'x': -40, 'y': 5, 'z': -40},
        {'x': 40, 'y': 5, 'z': -40},
        {'x': -40, 'y': 5, 'z': 40},
        {'x': 40, 'y': 5, 'z': 40},
        {'x': 0, 'y': 5, 'z': 0},
        {'x': 20, 'y': 5, 'z': -20},
        {'x': -20, 'y': 5, 'z': 20},
        {'x': -20, 'y': 5, 'z': -20},
        {'x': 20, 'y': 5, 'z': 20}
    ],
    'terrain': WorldData.get_world_data()  # 지형 데이터 추가
}

# 플레이어 위치 히스토리 (최근 10개 위치 저장)
player_positions = {}

@socketio.on('player:join')
def handle_player_join(data):
    username = data.get('username')
    sid = request.sid

    print(f"플레이어 참가: {username} ({sid})")

    # 플레이어 ID 할당 (세션 ID 기반 또는 UUID)
    player_id = sid  # 간단히 sid를 아이디로 사용

    # 리스폰 위치 랜덤 할당
    spawn = random.choice(game_state['respawn_points'])

    # 게임 상태에 추가 (체력 추가)
    game_state['players'][player_id] = {
        'username': username,
        'position': spawn,
        'rotation': {'x': 0, 'y': 0, 'z': 0},
        'health': 100,  # 초기 체력 100으로 설정
        'last_update': time.time()
    }

    # 위치 히스토리 초기화
    player_positions[player_id] = deque(maxlen=10)
    player_positions[player_id].append({
        'position': spawn,
        'timestamp': time.time()
    })

    # 참가자에게 game:start 전송 (지형 데이터 포함)
    emit('game:start', {
        'playerId': player_id,
        'position': spawn,
        'health': 100,  # 초기 체력 정보도 함께 전송
        'timestamp': time.time(),
        'terrain': game_state['terrain']  # 지형 데이터 전송
    })

    # 다른 사람에게 player:joined 알림
    emit('player:joined', {
        'playerId': player_id,
        'username': username,
        'position': spawn,
        'health': 100,  # 초기 체력 정보도 함께 전송
        'timestamp': time.time()
    }, broadcast=True, include_self=False)

    # 현재 전체 플레이어 목록 전송
    emit('player:list', game_state['players'])

@socketio.on('player:update')
def handle_player_update(data):
    """플레이어 위치 업데이트 처리"""
    player_id = request.sid
    current_time = time.time()
    
    # 플레이어가 게임 상태에 있는지 확인
    if player_id in game_state['players']:
        # 위치 및 상태 업데이트
        if 'position' in data:
            game_state['players'][player_id]['position'] = data['position']
            player_positions[player_id].append({
                'position': {'x': data['position']['x'], 'y': data['position']['y'], 'z': data['position']['z']},
                'timestamp': data.get('timestamp', current_time)
            })
        
        if 'rotation' in data:
            game_state['players'][player_id]['rotation'] = data['rotation']
        
        if 'velocity' in data:
            game_state['players'][player_id]['velocity'] = data['velocity']
        
        # 마지막 업데이트 시간 기록
        game_state['players'][player_id]['last_update'] = current_time
        
        # 다른 플레이어들에게 브로드캐스트 (자신 제외)
        data['playerId'] = player_id
        data['timestamp'] = current_time
        emit('player:update', data, broadcast=True, include_self=False)

@socketio.on('player:shoot')
def handle_player_shoot(data):
    """플레이어 총알 발사 처리"""
    shooter_id = request.sid
    target_id = data.get('targetId')
    current_time = time.time()
    
    # 플레이어와 대상이 모두 게임 상태에 있는지 확인
    if shooter_id in game_state['players'] and target_id in game_state['players']:
        # 대상 플레이어의 체력 감소 (5 포인트)
        game_state['players'][target_id]['health'] -= 5
        current_health = game_state['players'][target_id]['health']
        
        # 체력이 0 이하면 즉시 사망 처리
        if current_health <= 0:
            # 사망 처리 (체력을 0으로 설정)
            game_state['players'][target_id]['health'] = 0
            
            # 즉시 모든 플레이어에게 사망 알림
            emit('player:died', {
                'deadId': target_id,
                'killerId': shooter_id,
                'timestamp': current_time,
                'health': 0
            }, broadcast=True)
            
            # 게임 오버 이벤트 발송
            emit('game:over', {
                'deadId': target_id,
                'killerId': shooter_id,
                'timestamp': current_time
            }, broadcast=True)
        else:
            # 피격 이벤트 즉시 발송
            emit('player:hit', {
                'targetId': target_id,
                'shooterId': shooter_id,
                'health': current_health,
                'damage': 5,
                'timestamp': current_time
            }, broadcast=True)
            
            # 모든 플레이어에게 업데이트된 상태 전송
            emit('players:state', {
                player_id: {
                    'username': player_data['username'],
                    'position': player_data['position'],
                    'health': player_data['health'],
                    'score': player_data.get('score', 0),
                    'awf': player_data.get('awf', 0),
                    'timestamp': current_time
                }
                for player_id, player_data in game_state['players'].items()
            }, broadcast=True)

@socketio.on('player:respawn')
def handle_player_respawn(request):
    player_id = request.sid
    current_time = time.time()
    
    if player_id in game_state['players']:
        # 안전한 리스폰 위치 찾기
        spawn = find_safe_spawn_point(player_id)
        
        # 플레이어 상태 초기화
        game_state['players'][player_id].update({
            'position': spawn,
            'health': 100,
            'last_update': current_time
        })
        
        # 위치 히스토리 초기화
        player_positions[player_id].clear()
        player_positions[player_id].append({
            'position': spawn,
            'timestamp': current_time
        })
        
        # 리스폰 이벤트 브로드캐스트
        emit('player:respawned', {
            'playerId': player_id,
            'position': spawn,
            'health': 100,
            'timestamp': current_time
        }, broadcast=True)

def find_safe_spawn_point(player_id):
    """안전한 리스폰 위치 찾기"""
    spawn_points = game_state['respawn_points']
    occupied_positions = [
        p['position'] for p in game_state['players'].values()
        if p['position'] != game_state['players'][player_id]['position']
    ]
    
    # 다른 플레이어와 충분히 떨어진 위치 찾기
    for _ in range(10):  # 최대 10번 시도
        spawn = random.choice(spawn_points)
        if all(
            math.sqrt(
                (spawn['x'] - pos['x'])**2 +
                (spawn['z'] - pos['z'])**2
            ) > 5  # 최소 5 유닛 거리
            for pos in occupied_positions
        ):
            return spawn
    
    return random.choice(spawn_points)  # 안전한 위치를 찾지 못하면 랜덤 위치 반환

@socketio.on('disconnect')
def handle_disconnect():
    """플레이어 연결 종료 처리"""
    player_id = request.sid
    
    # 플레이어가 게임 상태에 있는지 확인
    if player_id in game_state['players']:
        # 게임 상태에서 제거
        player_data = game_state['players'].pop(player_id)
        
        # 위치 히스토리 제거
        if player_id in player_positions:
            del player_positions[player_id]
        
        print(f"플레이어 나감: {player_data.get('username')} ({player_id})")
        
        # 다른 플레이어들에게 알림
        emit('player:left', {
            'playerId': player_id,
            'timestamp': time.time()
        }, broadcast=True)

@app.route('/api/world-data')
def world_data():
    """월드 데이터 API 엔드포인트"""
    return jsonify(game_state['terrain'])

@app.route('/')
def index():
    """메인 페이지 라우트"""
    return render_template('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    """정적 파일 제공"""
    return send_from_directory('static', path)

def broadcast_player_states():
    while True:
        socketio.emit('players:state', game_state['players'])
        socketio.sleep(0.1)  # 100ms

@socketio.on('connect')
def handle_connect():
    socketio.start_background_task(broadcast_player_states)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)