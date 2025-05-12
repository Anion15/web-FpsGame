class Player {
    constructor(game, id, data) {
        this.game = game;
        this.id = id;
        this.username = data.username;
        this.health = 100;
        this.maxHealth = 100;
        this.score = 0;
        this.isLocal = id === game.playerId;
        
        // 플레이어 3D 오브젝트 생성
        this.object = new THREE.Group();
        this.object.position.copy(data.position || new THREE.Vector3(0, 1.6, 0));
        
        // 플레이어 몸체 생성
        this.createBody();
        
        // 물리 속성
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.gravityVelocity = 0;
        this.onGround = false;
        this.height = 1.6; // 캐릭터 눈높이
        
        // 충돌 속성
        this.radius = 0.4; // 캡슐 반지름
        
        // 애니메이션 속성
        this.moveAnimation = {
            time: 0,
            walking: false
        };
        
        // 리스폰 위치 (기본값)
        this.respawnPosition = new THREE.Vector3(
            (Math.random() - 0.5) * 40,
            5,
            (Math.random() - 0.5) * 40
        );

        // 네트워크 보간을 위한 속성
        this.networkPosition = new THREE.Vector3();
        this.networkRotation = new THREE.Euler();
        this.networkVelocity = new THREE.Vector3();
        this.lastNetworkUpdate = 0;
        this.interpolationDelay = 100; // 100ms 지연으로 증가
        this.positionHistory = [];
        this.maxHistoryLength = 20; // 히스토리 버퍼 크기 증가
        this.lerpFactor = 0.3; // 보간 계수 조정
    }
    
    createBody() {
        // 캡슐 만들기 (실린더 + 반구 2개)
        
        // 머리 (상단 반구)
        const headGeometry = new THREE.SphereGeometry(this.radius, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const headMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFCC88,
            roughness: 0.7,
            metalness: 0.1,
            transparent: true,
            opacity: this.isLocal ? 0 : 1 // 로컬 플레이어는 투명
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.8;
        head.castShadow = true;
        this.object.add(head);
        this.head = head;
        
        // 몸통 (실린더)
        const bodyHeight = 1.2;
        const bodyGeometry = new THREE.CylinderGeometry(this.radius, this.radius, bodyHeight, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: this.isLocal ? 0x4444FF : 0xFF4444,
            roughness: 0.7,
            metalness: 0.1,
            transparent: true,
            opacity: this.isLocal ? 0 : 1 // 로컬 플레이어는 투명
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0;
        body.castShadow = true;
        this.object.add(body);
        this.body = body;
        
        // 하단 (하단 반구)
        const lowerGeometry = new THREE.SphereGeometry(this.radius, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
        const lowerMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x3333AA,
            roughness: 0.7,
            metalness: 0.1,
            transparent: true,
            opacity: this.isLocal ? 0 : 1 // 로컬 플레이어는 투명
        });
        const lower = new THREE.Mesh(lowerGeometry, lowerMaterial);
        lower.position.y = -0.6;
        lower.castShadow = true;
        this.object.add(lower);
        this.lower = lower;
        
        // 왼팔 (실린더)
        const armGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 8);
        const armMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFCC88,
            roughness: 0.7,
            metalness: 0.1,
            transparent: true,
            opacity: this.isLocal ? 0 : 1 // 로컬 플레이어는 투명
        });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-this.radius - 0.1, 0.15, 0);
        leftArm.rotation.z = Math.PI / 2 * 0.8; // 약간 기울임
        leftArm.castShadow = true;
        this.object.add(leftArm);
        this.leftArm = leftArm;
        
        // 오른팔 (실린더) - 로컬 플레이어의 경우 무기를 들 수 있도록 위치 조정
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(this.radius + 0.1, 0.15, 0);
        rightArm.rotation.z = -Math.PI / 2 * 0.8; // 약간 기울임
        rightArm.castShadow = true;
        this.object.add(rightArm);
        this.rightArm = rightArm;

        // 이름표
        if (!this.isLocal) {
            const nameplate = document.createElement('div');
            nameplate.className = 'nameplate';
            nameplate.textContent = this.username;
            
            const nameLabel = new THREE.CSS2DObject(nameplate);
            nameLabel.position.set(0, 1.2, 0);
            this.object.add(nameLabel);
            this.nameLabel = nameLabel;

            // Raycaster 추가
            this.raycaster = new THREE.Raycaster();
        }
    }
    
    update(delta) {
        if (this.isLocal) {
            this.updatePhysics(delta);
        } else {
            // 애니메이션 업데이트 (걷기, 점프 등)
            this.updateAnimation(delta);
            
            // 이름표 가시성 업데이트
            this.updateNameplateVisibility();
        }
    }
    
    updatePhysics(delta) {
        // 중력 적용
        this.gravityVelocity -= 9.8 * delta;
        this.object.position.y += this.gravityVelocity * delta;
        
        // 바닥 충돌 검사
        if (this.object.position.y < this.height) {
            this.object.position.y = this.height;
            this.gravityVelocity = 0;
            this.onGround = true;
        }
        
        // 이동 적용
        const oldPosition = this.object.position.clone();
        this.object.position.add(this.velocity.clone().multiplyScalar(delta));
        
        // 충돌 감지 및 응답
        this.checkCollisions(oldPosition);
        
        // 월드 경계 확인
        const worldSize = 50;
        if (Math.abs(this.object.position.x) > worldSize) {
            this.object.position.x = Math.sign(this.object.position.x) * worldSize;
        }
        if (Math.abs(this.object.position.z) > worldSize) {
            this.object.position.z = Math.sign(this.object.position.z) * worldSize;
        }
        
        // 카메라 위치 업데이트 (머리 위치 기준으로 변경)
        const headWorldPosition = new THREE.Vector3();
        this.head.getWorldPosition(headWorldPosition);
        this.game.camera.position.copy(headWorldPosition);
        
        // 걷기 애니메이션 확인
        const isWalking = this.velocity.length() > 0.1;
        if (isWalking !== this.moveAnimation.walking) {
            this.moveAnimation.walking = isWalking;
            this.moveAnimation.time = 0;
        }
        
        // 애니메이션 업데이트
        this.updateAnimation(delta);
    }
    
    checkCollisions(oldPosition) {
        // 다른 오브젝트와의 충돌 검사 (간단한 구현)
        if (!this.game.world || !this.game.world.objects) return;
        
        const objects = this.game.world.objects;
        
        for (let i = 0; i < objects.length; i++) {
            const object = objects[i];
            
            // 지면은 건너뜀
            if (object.isGround) continue;
            
            // 오브젝트의 AABB (Axis-Aligned Bounding Box) 가져오기
            const box = new THREE.Box3().setFromObject(object);
            
            // 플레이어의 캡슐 충돌 감지 (단순화: 상단/하단 구체 + 실린더를 단일 구체로 근사)
            const playerPosition = this.object.position.clone();
            playerPosition.y -= 0.3; // 캡슐의 중심으로 조정
            
            // 캡슐의 상단과 하단 위치
            const capsuleTop = playerPosition.clone();
            capsuleTop.y += 0.6;
            const capsuleBottom = playerPosition.clone();
            capsuleBottom.y -= 0.6;
            
            // 충돌 감지를 위한 간단한 계산
            const closestPoint = new THREE.Vector3();
            box.clampPoint(playerPosition, closestPoint);
            
            const distance = playerPosition.distanceTo(closestPoint);
            
            if (distance < this.radius) {
                // 충돌 발생, 오브젝트 밖으로 밀어냄
                const direction = new THREE.Vector3().subVectors(playerPosition, closestPoint).normalize();
                this.object.position.copy(oldPosition);
                
                // 충돌 방향에 따라 속도 조정
                const dot = this.velocity.dot(direction);
                if (dot < 0) {
                    this.velocity.sub(direction.multiplyScalar(dot));
                }
                break;
            }
        }
    }
    
    updateAnimation(delta) {
        if (this.moveAnimation.walking) {
            this.moveAnimation.time += delta * 5;
            
            // 캡슐형 모델에 맞게 팔 애니메이션 조정
            this.leftArm.rotation.x = Math.sin(this.moveAnimation.time) * 0.3;
            this.rightArm.rotation.x = -Math.sin(this.moveAnimation.time) * 0.3;
            
            // 몸체 약간 회전 (걷는 느낌)
            this.body.rotation.z = Math.sin(this.moveAnimation.time) * 0.05;
        } else {
            // 애니메이션 초기화
            this.leftArm.rotation.x = 0;
            this.rightArm.rotation.x = 0;
            this.body.rotation.z = 0;
        }
    }
    
    updateFromNetwork(data) {
        const now = performance.now();
        
        // 위치 보간 개선
        if (data.position) {
            this.networkPosition.set(data.position.x, data.position.y, data.position.z);
            
            this.positionHistory.push({
                position: new THREE.Vector3(data.position.x, data.position.y, data.position.z),
                timestamp: data.timestamp || now
            });
            
            while (this.positionHistory.length > this.maxHistoryLength) {
                this.positionHistory.shift();
            }
            
            const targetTime = now - this.interpolationDelay;
            let targetPosition = null;
            
            // 보간을 위한 두 위치 찾기
            for (let i = 0; i < this.positionHistory.length - 1; i++) {
                const current = this.positionHistory[i];
                const next = this.positionHistory[i + 1];
                if (current.timestamp <= targetTime && next.timestamp >= targetTime) {
                    const alpha = (targetTime - current.timestamp) / (next.timestamp - current.timestamp);
                    targetPosition = current.position.clone().lerp(next.position, alpha);
                    break;
                }
            }
            
            if (targetPosition) {
                // 부드러운 보간 적용
                this.object.position.lerp(targetPosition, this.lerpFactor);
            } else if (this.positionHistory.length > 0) {
                // 히스토리가 있지만 보간할 수 없는 경우
                const latest = this.positionHistory[this.positionHistory.length - 1];
                this.object.position.lerp(latest.position, this.lerpFactor);
            }
        }
        
        // 회전 보간 개선
        if (data.rotation) {
            this.networkRotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
            const targetRotation = new THREE.Euler(
                data.rotation.x,
                data.rotation.y,
                data.rotation.z
            );
            
            // 회전 보간 계수 조정
            this.head.rotation.x = THREE.MathUtils.lerp(
                this.head.rotation.x,
                targetRotation.x,
                this.lerpFactor
            );
            this.head.rotation.y = THREE.MathUtils.lerp(
                this.head.rotation.y,
                targetRotation.y,
                this.lerpFactor
            );
        }
        
        if (data.velocity) {
            this.networkVelocity.set(data.velocity.x, data.velocity.y, data.velocity.z);
            this.velocity.set(data.velocity.x, data.velocity.y, data.velocity.z);
        }
        
        // 상태 업데이트
        if (data.health !== undefined) {
            this.health = data.health;
        }
        if (data.score !== undefined) {
            this.score = data.score;
            this.game.updatePlayersList();
        }
        
        this.lastNetworkUpdate = now;
    }
    
    jump() {
        if (this.onGround) {
            this.gravityVelocity = 5;
            this.onGround = false;
        }
    }
    
    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        
        // UI 업데이트
        this.game.updateUI();
        
        // 피격 효과
        this.showHitEffect();
        
        // 피격 사운드 재생
        if (this.game.soundManager) {
            this.game.soundManager.playHitSound();
        }
        
        // 피격 시 화면 효과
        if (this.isLocal) {
            this.game.showHitEffect();
        }
        
        // 체력이 0이면 게임 오버
        if (this.health <= 0) {
            this.game.endGame();
        }
    }
    
    showHitEffect() {
        // 플레이어 몸체에 빨간색 깜빡임 효과
        const originalColor = this.body.material.color.getHex();
        this.body.material.color.set(0xFF0000);
        
        // 피격 이펙트 파티클 생성
        if (this.game.particleSystem) {
            const hitPosition = this.object.position.clone();
            hitPosition.y += 1; // 머리 높이에서 파티클 생성
            this.game.particleSystem.createHitEffect(hitPosition);
        }
        
        // 1초 동안 빨간색 유지
        setTimeout(() => {
            this.body.material.color.setHex(originalColor);
        }, 1000);
    }
    
    resetAfterDeath() {
        // 체력 회복
        this.health = this.maxHealth;
        // 위치 초기화 (리스폰)
        this.object.position.copy(this.respawnPosition);
        // 속도 초기화
        this.velocity.set(0, 0, 0);
        this.gravityVelocity = 0;
        // UI 갱신
        this.game.updateUI();
    }
    
    remove() {
        // 씬에서 제거
        if (this.object.parent) {
            this.object.parent.remove(this.object);
        }
        // 이름표 DOM도 제거 (혹시라도 남아있을 경우)
        if (this.nameLabel && this.nameLabel.element && this.nameLabel.element.parentNode) {
            this.nameLabel.element.parentNode.removeChild(this.nameLabel.element);
        }
        // 게임 상태에서 제거
        if (this.game.players[this.id]) {
            delete this.game.players[this.id];
        }
    }

    updateNameplateVisibility() {
        if (!this.nameLabel || !this.game.camera) return;

        // 플레이어 위치에서 카메라 방향으로 레이캐스팅
        const playerPosition = this.object.position.clone();
        playerPosition.y += 1.2; // 이름표 높이로 조정
        
        const cameraPosition = this.game.camera.position;
        const direction = new THREE.Vector3().subVectors(cameraPosition, playerPosition).normalize();
        
        this.raycaster.set(playerPosition, direction);
        
        // 월드의 모든 오브젝트와 충돌 검사
        const intersects = this.raycaster.intersectObjects(this.game.world.objects);
        
        // 카메라와 플레이어 사이의 거리 계산
        const distanceToCamera = playerPosition.distanceTo(cameraPosition);
        
        // 충돌이 있고, 충돌 지점이 플레이어와 카메라 사이에 있다면 이름표 숨김
        if (intersects.length > 0 && intersects[0].distance < distanceToCamera) {
            this.nameLabel.element.style.visibility = 'hidden';
        } else {
            this.nameLabel.element.style.visibility = 'visible';
        }
    }
}