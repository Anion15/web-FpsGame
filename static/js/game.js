// 게임의 메인 클래스
class Game {
    constructor() {
        // DOM 요소
        this.canvas = document.getElementById('game-canvas');
        this.loginScreen = document.getElementById('login-screen');
        this.gameUI = document.getElementById('game-ui');
        this.gameOver = document.getElementById('game-over');
        this.usernameInput = document.getElementById('username');
        this.startButton = document.getElementById('start-button');
        this.restartButton = document.getElementById('restart-button');
        this.healthValue = document.getElementById('health-value');
        this.ammoCount = document.getElementById('ammo-count');
        this.scoreValue = document.getElementById('score-value');
        this.finalScoreValue = document.getElementById('final-score-value');
        this.playersList = document.getElementById('players-list');
        this.loadingScreen = document.getElementById('loading');
        this.killLog = document.getElementById('kill-log');

        // 게임 속성
        this.isRunning = false;
        this.clock = new THREE.Clock();
        this.players = {};
        this.playerId = null;
        this.score = 0;
        this.lastKillTime = 0;
        this.killLogTimeout = 5000; // 킬 로그 표시 시간 (5초)

        // 디버그 로그 활성화
        this.debugMode = false;

        // 렌더러, 씬, 카메라 초기화
        this.setupThree();

        // 월드 생성
        this.world = new World(this);

        // 컨트롤 초기화
        this.controls = new Controls(this);

        // 네트워크 초기화 (컨트롤과 월드 생성 후)
        this.network = new Network(this);

        // 모바일 컨트롤 초기화
        //this.mobileControls = new MobileControls(this);

        // 이벤트 리스너 설정 (모든 초기화 후에)
        this.setupEventListeners();

        // 애니메이션 루프 시작
        this.animate();
        
        if (this.debugMode) {
            debug("게임 초기화 완료");
        }
    }

    setupEventListeners() {
        if (this.debugMode) {
            debug("이벤트 리스너 설정 중...");
        }

        try {
            this.startButton.addEventListener('click', () => {
                debug("시작 버튼 클릭됨");
                this.startGame();
            });
            
            this.restartButton.addEventListener('click', () => {
                debug("재시작 버튼 클릭됨");
                this.restartGame();
            });
            
            window.addEventListener('resize', () => this.onWindowResize());
            
            // 포인터 잠금 이벤트 처리
            document.addEventListener('pointerlockchange', () => {
                if (document.pointerLockElement === this.canvas) {
                    this.controls.enabled = true;
                } else {
                    this.controls.enabled = false;
                }
            });
            
            debug("이벤트 리스너 설정 완료");
        } catch (error) {
            debug("이벤트 리스너 설정 중 오류 발생: " + error.message);
        }
    }

    setupThree() {
        try {
            // 렌더러 초기화
            this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.shadowMap.enabled = true;

            // 씬 생성
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x87ceeb); // 하늘색 배경

            // 카메라 설정
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.camera.position.set(0, 1.6, 0); // 눈높이
            
            // CSS2D 렌더러 추가 (이름표용)
            this.labelRenderer = new THREE.CSS2DRenderer();
            this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
            this.labelRenderer.domElement.style.position = 'absolute';
            this.labelRenderer.domElement.style.top = '0';
            this.labelRenderer.domElement.style.pointerEvents = 'none';
            document.body.appendChild(this.labelRenderer.domElement);
            
            if (this.debugMode) {
                debug("Three.js 설정 완료");
            }
        } catch (error) {
            debug("Three.js 설정 중 오류 발생: " + error.message);
        }
    }

    startGame() {
        const username = this.usernameInput.value.trim();
        if (username === '') {
            alert('사용자 이름을 입력해주세요.');
            return;
        }

        // 로딩 화면 표시
        this.loadingScreen.style.display = 'flex';
        
        if (this.debugMode) {
            debug("게임 시작 시도 중...");
        }

        try {
            if (typeof io === 'undefined') {
                throw new Error("Socket.IO가 로드되지 않았습니다.");
            }
            
            this.network.connect(username)
                .then(() => {
                    debug("서버 연결 성공");
                    this.loginScreen.style.display = 'none';
                    this.gameUI.style.display = 'block';
                    this.isRunning = true;
                    this.loadingScreen.style.display = 'none';
                    
                    // 포인터 잠금
                    this.controls.lockPointer();
                })
                .catch(error => {
                    debug("서버 연결 실패: " + error.message);
                    this.loadingScreen.style.display = 'none';
                    alert('서버 연결에 실패했습니다: ' + error.message);
                });
        } catch (error) {
            debug("게임 시작 중 치명적 오류: " + error.message);
            this.loadingScreen.style.display = 'none';
            alert('게임을 시작할 수 없습니다: ' + error.message);
        }
    }

    endGame() {
        if (!this.isRunning) return; // 이미 게임이 종료된 상태면 무시
        
        this.isRunning = false;
        this.gameUI.style.display = 'none';
        this.finalScoreValue.textContent = this.score;
        this.gameOver.classList.remove('hidden');
        
        // 포인터 잠금 해제
        document.exitPointerLock();
        
        // 모든 플레이어 제거
        Object.values(this.players).forEach(player => {
            if (player.id !== this.playerId) {
                player.remove();
            }
        });
        
        // 로컬 플레이어 제거
        if (this.player) {
            this.player.remove();
            this.player = null;
        }
        
        // 컨트롤 비활성화
        this.controls.enabled = false;
        
        debug("게임 종료");
    }

    restartGame() {
        // 게임 상태 초기화
        this.isRunning = false;
        this.score = 0;
        this.players = {};
        this.playerId = null;
        
        // UI 초기화
        this.gameOver.classList.add('hidden');
        this.loginScreen.style.display = 'flex';
        this.gameUI.style.display = 'none';
        this.killLog.innerHTML = '';
        
        // 네트워크 연결 종료
        if (this.network) {
            this.network.disconnect();
        }
        
        // 컨트롤 초기화
        if (this.controls) {
            this.controls.reset();
        }
        
        debug("게임 재시작");
    }

    showHitEffect() {
        // 기존 hit-effect 요소가 있다면 제거
        const existingEffect = document.getElementById('hit-effect');
        if (existingEffect) {
            existingEffect.remove();
        }

        // 새로운 hit-effect 요소 생성
        const hitEffect = document.createElement('div');
        hitEffect.id = 'hit-effect';
        document.body.appendChild(hitEffect);

        // 즉시 opacity를 1로 설정하여 효과 표시
        requestAnimationFrame(() => {
            hitEffect.style.opacity = '1';
        });

        // 0.05초 후 효과 제거
        setTimeout(() => {
            hitEffect.style.opacity = '0';
            // 트랜지션이 완료된 후 요소 제거
            setTimeout(() => {
                hitEffect.remove();
            }, 50);
        }, 50);
    }

    addKillLog(killerName, victimName) {
        // killLog가 null이면 아무것도 하지 않음
        if (!this.killLog) {
            console.warn('killLog DOM is null!');
            return;
        }
    
        const now = Date.now();
        if (now - this.lastKillTime < 100) return; // 스팸 방지
    
        this.lastKillTime = now;
    
        const logEntry = document.createElement('div');
        logEntry.className = 'kill-log-entry';
        logEntry.textContent = `${killerName} killed ${victimName}`;
    
        this.killLog.appendChild(logEntry);
    
        // 5초 후 로그 제거
        setTimeout(() => {
            logEntry.classList.add('fade-out');
            setTimeout(() => {
                logEntry.remove();
            }, 500);
        }, this.killLogTimeout);
    }

    createPlayer(id, data) {
        try {
            // 이미 존재하는 플레이어는 제거
            if (this.players[id]) {
                this.removePlayer(id);
            }
            
            const player = new Player(this, id, data);
            this.players[id] = player;
            this.scene.add(player.object);
            
            if (id === this.playerId) {
                this.player = player;
                this.world.createWeapon();
                debug("로컬 플레이어 생성됨: " + id);
            } else {
                debug("원격 플레이어 생성됨: " + id);
            }
            
            this.updatePlayersList();
            return player;
        } catch (error) {
            debug("플레이어 생성 오류: " + error.message);
            return null;
        }
    }

    removePlayer(id) {
        if (this.players[id]) {
            this.players[id].remove();
            delete this.players[id];
            this.updatePlayersList();
            debug("플레이어 제거: " + id);
        }
    }

    updatePlayer(id, data) {
        if (this.players[id]) {
            if (data.health !== undefined && data.health <= 0) return;
            this.players[id].updateFromNetwork(data);
        }
    }

    updatePlayersList() {
        // 기존 목록 내용 지우기
        this.playersList.innerHTML = '<h3>플레이어</h3>';
        
        // 모든 플레이어의 상태를 표시
        Object.values(this.players).forEach(player => {
            const div = document.createElement('div');
            div.textContent = `${player.username}: ${player.score} (HP: ${player.health})`;
            
            // 현재 플레이어 강조 표시
            if (player.id === this.playerId) {
                div.style.color = '#ff0';
            }
            
            // 사망한 플레이어는 회색으로 표시
            if (player.health <= 0) {
                div.style.color = '#888';
            }
            
            this.playersList.appendChild(div);
        });
        
        // UI 업데이트
        this.updateUI();
    }

    updateUI() {
        if (this.player) {
            // 체력 업데이트
            const healthPercent = (this.player.health / this.player.maxHealth) * 100;
            this.healthValue.style.width = `${healthPercent}%`;
            
            // 탄약 업데이트
            if (this.world.weapon) {
                this.ammoCount.textContent = this.world.weapon.ammo;
            }
            
            // 점수 업데이트
            this.scoreValue.textContent = this.score;
        }
    }

    playerShot(shooterId, targetId) {
        if (targetId === this.playerId) {
            // 내가 맞았을 때
            const damage = 5; // 기본 데미지
            const distance = this.calculateDistance(shooterId);
            const finalDamage = this.calculateDamage(damage, distance);
            
            // 체력 감소
            this.player.takeDamage(finalDamage);
            
            // UI 업데이트
            this.updateUI();
            this.updatePlayersList();
        } else if (shooterId === this.playerId) {
            // 내가 명중시켰을 때
            const hitPlayer = this.players[targetId];
            if (hitPlayer) {
                const distance = this.calculateDistance(targetId);
                const damage = this.calculateDamage(5, distance);
                this.score += Math.floor(damage * 2); // 데미지에 비례한 점수
            }
        }
        
        // 피격 효과 표시
        if (this.players[targetId]) {
            this.players[targetId].showHitEffect();
        }
        
        this.updateUI();
        this.updatePlayersList();
    }

    calculateDamage(baseDamage, distance) {
        const maxDistance = 100; // 최대 유효 사거리
        const damageFalloff = 0.5; // 데미지 감소율
        
        if (distance > maxDistance) return 0;
        
        const damageMultiplier = 1 - (distance / maxDistance) * damageFalloff;
        return Math.floor(baseDamage * damageMultiplier);
    }

    calculateDistance(targetId) {
        const targetPlayer = this.players[targetId];
        if (!targetPlayer || !this.player) return Infinity;
        
        return this.player.object.position.distanceTo(targetPlayer.object.position);
    }

    handlePlayerDeath(killerId) {
        const killer = this.players[killerId];
        if (killer) {
            killer.score += 50; // 킬 점수
            this.addKillLog(killer.username, this.player.username);
        }
        
        // 리스폰 타이머 설정
        setTimeout(() => {
            this.network.sendPlayerRespawn();
        }, 3000); // 3초 후 리스폰
    }

    playerDied(deadId, killerId) {
        const deadPlayer = this.players[deadId];
        const killerPlayer = this.players[killerId];
    
        if (deadId === this.playerId) {
            // 내가 죽었으면 새로고침
            location.reload();
            return;
        }
    
        if (deadPlayer) {
            deadPlayer.health = 0;
            this.updatePlayersList();
            if (killerPlayer) {
                this.addKillLog(killerPlayer.username, deadPlayer.username);
            }
        }
    
        if (killerId === this.playerId) {
            this.score += 50;
            this.updateUI();
        }
    
        debug(`플레이어 사망: ${deadId}, 킬러: ${killerId}`);
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        if (this.labelRenderer) {
            this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    update() {
        if (!this.isRunning) return;
        
        const delta = this.clock.getDelta();
        
        // 플레이어 상태 업데이트
        if (this.player) {
            if (this.player.health <= 0) return; // 사망 시 이동/업데이트 차단

            // 컨트롤 업데이트 (이동 입력 처리)
            this.controls.update(delta);
            
            // 모바일 컨트롤 업데이트
            //if (this.mobileControls) {
            //    this.mobileControls.update();
            //}
            
            // 플레이어 물리 업데이트
            this.player.update(delta);
            
            // 충돌 체크
            if (this.checkCollision()) {
                this.respawnPlayer();
            }
            
            // 무기 업데이트
            if (this.world.weapon) {
                this.world.weapon.update(delta);
            }
            
            // 네트워크 업데이트 전송
            if (this.network && this.network.connected) {
                this.network.sendPlayerUpdate({
                    position: this.player.object.position,
                    rotation: this.camera.rotation,
                    velocity: this.player.velocity
                });
            }
        }
        
        // 다른 플레이어 업데이트
        Object.values(this.players).forEach(player => {
            if (player.id !== this.playerId) {
                player.update(delta);
            }
        });
    }

    checkCollision() {
        if (!this.player) return false;
        
        // 플레이어의 현재 위치
        const playerPos = this.player.object.position;
        
        // 1. 다른 플레이어들과의 충돌 체크
        for (const otherPlayer of Object.values(this.players)) {
            if (otherPlayer.id === this.playerId) continue;
            const distance = playerPos.distanceTo(otherPlayer.object.position);
            if (distance < 2) { // 2 유닛 이내면 충돌로 간주
                return true;
            }
        }
        
        // 2. 월드 오브젝트(벽, 박스 등)와의 충돌 체크
        if (this.world && this.world.objects) {
            for (const object of this.world.objects) {
                // 지면(바닥)은 건너뜀
                if (object.isGround) continue;
                // AABB(박스) 충돌 체크
                const box = new THREE.Box3().setFromObject(object);
                const playerRadius = this.player.radius || 1; // 기본값 1
                const playerCenter = playerPos.clone();
                playerCenter.y -= 0.3; // 캡슐 중심 보정
                const closestPoint = new THREE.Vector3();
                box.clampPoint(playerCenter, closestPoint);
                const dist = playerCenter.distanceTo(closestPoint);
                if (dist < playerRadius) {
                    return true;
                }
            }
        }
        return false;
    }

    respawnPlayer() {
        if (!this.player) return;
        
        // 랜덤한 위치 생성 (월드 크기에 따라 조정)
        const x = (Math.random() - 0.5) * 40; // -20 ~ 20
        const z = (Math.random() - 0.5) * 40; // -20 ~ 20
        
        // 플레이어 위치 재설정
        this.player.object.position.set(x, 1.6, z);
        this.camera.position.set(x, 1.6, z);
        
        // 네트워크로 위치 업데이트 전송
        if (this.network && this.network.connected) {
            this.network.sendPlayerUpdate({
                position: this.player.object.position,
                rotation: this.camera.rotation,
                velocity: this.player.velocity
            });
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        try {
            this.update();
            this.renderer.render(this.scene, this.camera);
            
            // 이름표 렌더링
            if (this.labelRenderer) {
                this.labelRenderer.render(this.scene, this.camera);
            }
        } catch (error) {
            if (!this._animationErrorReported) {
                debug("애니메이션 루프 오류: " + error.message);
                this._animationErrorReported = true;
            }
        }
    }

    createBoundaryWalls() {
        const wallHeight = 10;
        const wallThickness = 2;
        const worldSize = 50;

        // 벽 텍스처 로드
        const wallTexture = new THREE.TextureLoader().load('static/textures/wall_concrete.jpg');
        wallTexture.wrapS = THREE.RepeatWrapping;
        wallTexture.wrapT = THREE.RepeatWrapping;
        wallTexture.repeat.set(8, 2);

        // 벽 재질
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            map: wallTexture,
            roughness: 0.7,
            metalness: 0.1
        });

        // 앞/뒤 벽 (z축)
        for (let z of [-worldSize, worldSize]) {
            const wall = new THREE.Mesh(
                new THREE.PlaneGeometry(worldSize * 2, wallHeight),
                wallMaterial
            );
            wall.position.set(0, wallHeight / 2, z);
            wall.rotation.y = 0;
            wall.receiveShadow = true;
            this.scene.add(wall);
            this.objects.push(wall);
        }

        // 좌/우 벽 (x축)
        for (let x of [-worldSize, worldSize]) {
            const wall = new THREE.Mesh(
                new THREE.PlaneGeometry(worldSize * 2, wallHeight),
                wallMaterial
            );
            wall.position.set(x, wallHeight / 2, 0);
            wall.rotation.y = Math.PI / 2;
            wall.receiveShadow = true;
            this.scene.add(wall);
            this.objects.push(wall);
        }
    }
}

// 페이지 로드 완료 시 게임 인스턴스 생성
window.addEventListener('load', () => {
    try {
        window.game = new Game();
        debug("게임 인스턴스 생성 완료");
    } catch (error) {
        debug("게임 인스턴스 생성 실패: " + error.message);
    }
});