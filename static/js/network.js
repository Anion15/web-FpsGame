class Network {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.connected = false;
        this.updateRate = 1;
        this.lastUpdateTime = 0;
        this.debugMode = this.game.debugMode || false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // 1초
        
        if (this.debugMode) {
            debug("네트워크 클래스 초기화");
        }
    }
    
    connect(username) {
        return new Promise((resolve, reject) => {
            if (this.debugMode) {
                debug("서버 연결 시도 중...");
            }
            
            try {
                // 소켓 연결
                if (typeof io === 'undefined') {
                    throw new Error("Socket.IO 라이브러리가 로드되지 않았습니다");
                }
                
                // 실제 소켓 연결 시도
                this.socket = io({
                    reconnection: true,
                    reconnectionAttempts: this.maxReconnectAttempts,
                    reconnectionDelay: this.reconnectDelay,
                    timeout: 5000
                });
                
                // 연결 시간 제한 설정
                const connectionTimeout = setTimeout(() => {
                    if (!this.connected) {
                        reject(new Error("연결 시간 초과"));
                    }
                }, 5000);
                
                // 연결 성공 이벤트
                this.socket.on('connect', () => {
                    debug("서버에 연결됨: " + this.socket.id);
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    
                    // 플레이어 등록
                    this.socket.emit('player:join', { username });
                    debug("플레이어 입장 요청 보냄: " + username);
                });
                
                // 재연결 시도 이벤트
                this.socket.on('reconnect_attempt', (attemptNumber) => {
                    this.reconnectAttempts = attemptNumber;
                    debug(`재연결 시도 ${attemptNumber}/${this.maxReconnectAttempts}`);
                });
                
                // 재연결 성공 이벤트
                this.socket.on('reconnect', (attemptNumber) => {
                    debug(`재연결 성공 (시도 ${attemptNumber})`);
                    this.connected = true;
                    
                    // 플레이어 재등록
                    this.socket.emit('player:join', { username });
                });
                
                // 재연결 실패 이벤트
                this.socket.on('reconnect_failed', () => {
                    debug("재연결 실패");
                    this.connected = false;
                    reject(new Error("서버 재연결 실패"));
                });
                
                // 게임 시작 이벤트
                this.socket.on('game:start', (data) => {
                    debug("게임 시작 이벤트 수신: " + JSON.stringify(data));
                    clearTimeout(connectionTimeout);
                    
                    this.game.playerId = data.playerId;
                    
                    // 지형 데이터로 월드 초기화
                    if (data.terrain) {
                        this.game.world.initializeFromServerData(data.terrain);
                    }
                    
                    // 초기 플레이어 생성
                    this.game.createPlayer(data.playerId, {
                        username: username,
                        position: data.position || new THREE.Vector3(0, 5, 0)
                    });
                    
                    resolve();
                });
                
                // 플레이어 참가 이벤트
                this.socket.on('player:joined', (data) => {
                    debug("플레이어 참가 이벤트: " + JSON.stringify(data));
                    
                    // 새 플레이어 생성
                    this.game.createPlayer(data.playerId, {
                        username: data.username,
                        position: data.position || new THREE.Vector3(0, 5, 0)
                    });
                });
                
                // 네트워크 이벤트 핸들러 내부 (player:list 수신 시)
                this.socket.on('player:list', (players) => {
                    debug("플레이어 목록 수신: " + Object.keys(players).length + "명");

                    // 내 playerId가 목록에 없으면 새로고침
                    if (!players[this.game.playerId]) {
                        console.warn('내 playerId가 서버 플레이어 목록에 없음! 새로고침합니다.');
                        location.reload();
                        return;
                    }

                    // 기존 플레이어들 생성
                    Object.keys(players).forEach(playerId => {
                        if (playerId !== this.game.playerId) {
                            this.game.createPlayer(playerId, {
                                username: players[playerId].username,
                                position: players[playerId].position,
                                rotation: players[playerId].rotation
                            });
                        }
                    });
                });
                
                // 플레이어 나감 이벤트
                this.socket.on('player:left', (data) => {
                    debug("플레이어 나감 이벤트: " + data.playerId);
                    this.game.removePlayer(data.playerId);
                });
                
                // 플레이어 위치 업데이트
                this.socket.on('player:update', (data) => {
                    if (data.playerId !== this.game.playerId) {
                        this.game.updatePlayer(data.playerId, data);
                    }
                });
                
                // 총알 피격 이벤트
                this.socket.on('player:hit', (data) => {
                    debug("피격 이벤트 수신: " + JSON.stringify(data));
                    
                    // 피격된 플레이어가 나인 경우
                    if (data.targetId === this.game.playerId) {
                        // 체력 감소
                        this.game.player.takeDamage(data.damage);
                    }
                    
                    // 피격 효과 표시
                    if (this.game.players[data.targetId]) {
                        this.game.players[data.targetId].showHitEffect();
                    }
                    
                    // UI 업데이트
                    this.game.updateUI();
                    this.game.updatePlayersList();
                });
                
                // 플레이어 사망 이벤트
                this.socket.on('player:died', (data) => {
                    debug("사망 이벤트: " + JSON.stringify(data));
                    this.game.playerDied(data.deadId, data.killerId);
                });
                
                // 플레이어 상태 업데이트 이벤트
                this.socket.on('players:state', (playerStates) => {
                    Object.entries(playerStates).forEach(([playerId, data]) => {
                        if (playerId !== this.game.playerId) {
                            if (this.game.players[playerId]) {
                                // 기존 플레이어 업데이트
                                this.game.players[playerId].health = data.health;
                                this.game.players[playerId].score = data.score;
                                this.game.players[playerId].updateFromNetwork(data);
                            } else {
                                // 새 플레이어 생성
                                this.game.createPlayer(playerId, data);
                            }
                        }
                    });
                    
                    // 플레이어 목록 UI 업데이트
                    this.game.updatePlayersList();
                });
                
                // 오류 처리
                this.socket.on('connect_error', (error) => {
                    debug("연결 오류: " + error.message);
                    clearTimeout(connectionTimeout);
                    reject(error);
                });
                
                this.socket.on('error', (error) => {
                    debug("소켓 오류: " + error.message);
                    reject(error);
                });
                
                this.socket.on('disconnect', (reason) => {
                    debug("서버와 연결이 끊어짐: " + reason);
                    this.connected = false;
                    
                    // 게임 종료
                    if (this.game.isRunning) {
                        this.game.endGame();
                    }
                });
            } catch (error) {
                debug("네트워크 클래스 오류: " + error.message);
                reject(error);
            }
        });
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.connected = false;
            debug("소켓 연결 종료");
        }
    }
    
    sendPlayerUpdate(data) {
        if (this.offlineMode) return;
        
        const now = performance.now();
        // 업데이트 주기를 더 짧게 설정 (50ms)
        if (this.connected && now - this.lastUpdateTime > 50) {
            this.lastUpdateTime = now;
            data.timestamp = now;
            
            // 위치, 회전, 속도가 모두 변경되었을 때만 전송
            if (data.position && data.rotation && data.velocity) {
                const positionChanged = !this.lastPosition || 
                    this.lastPosition.distanceTo(data.position) > 0.01;
                const rotationChanged = !this.lastRotation || 
                    Math.abs(this.lastRotation.y - data.rotation.y) > 0.01;
                const velocityChanged = !this.lastVelocity || 
                    this.lastVelocity.distanceTo(data.velocity) > 0.01;
                
                if (positionChanged || rotationChanged || velocityChanged) {
                    this.lastPosition = data.position.clone();
                    this.lastRotation = data.rotation.clone();
                    this.lastVelocity = data.velocity.clone();
                    
                    // 즉시 전송
                    this.socket.emit('player:update', {
                        position: {
                            x: data.position.x,
                            y: data.position.y,
                            z: data.position.z
                        },
                        rotation: {
                            x: data.rotation.x,
                            y: data.rotation.y,
                            z: data.rotation.z
                        },
                        velocity: {
                            x: data.velocity.x,
                            y: data.velocity.y,
                            z: data.velocity.z
                        },
                        timestamp: data.timestamp
                    });
                }
            }
        }
    }
    
    sendShot(targetId) {
        if (this.connected) {
            const timestamp = performance.now();
            this.socket.emit('player:shoot', {
                targetId: targetId,
                timestamp: timestamp
            });
            
            // 발사 사운드 재생
            if (this.game.soundManager) {
                this.game.soundManager.playShootSound();
            }
        }
    }
    
    sendPlayerDeath(killerId) {
        if (this.connected) {
            const timestamp = performance.now();
            this.socket.emit('player:death', {
                killerId: killerId,
                timestamp: timestamp
            });
            
            // 사망 사운드 재생
            if (this.game.soundManager) {
                this.game.soundManager.playDeathSound();
            }
        }
    }

    sendPlayerRespawn() {
        if (this.connected) {
            const timestamp = performance.now();
            this.socket.emit('player:respawn', {
                timestamp: timestamp
            });
        }
    }

    setupRespawnHandler() {
        this.socket.on('player:respawned', (data) => {
            if (data.playerId === this.game.playerId) {
                // 로컬 플레이어 리스폰
                this.game.player.resetAfterDeath();
            } else if (this.game.players[data.playerId]) {
                // 다른 플레이어 리스폰
                this.game.players[data.playerId].resetAfterDeath();
            }
        });
    }
}