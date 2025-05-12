class Weapon {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.camera = game.camera;
        
        // 무기 속성
        this.ammo = 30;
        this.maxAmmo = 30;
        this.damage = 20;
        this.fireRate = 0.1;
        this.reloadTime = 2.0;
        this.range = 100;
        this.recoil = 0.01;
        
        // 상태
        this.canShoot = true;
        this.isReloading = false;
        this.lastShotTime = 0;
        
        // 무기 모델 생성
        this.createModel();
        
        // 탄약 UI 업데이트
        this.game.updateUI();
        this.reloadSound = new Audio('/static/js/reload.mp3');
    }
    
    createModel() {
        // 무기 그룹 생성
        this.object = new THREE.Group();
        
        // 총신
        const barrel = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.05, 0.5),
            new THREE.MeshLambertMaterial({ color: 0x333333 })
        );
        barrel.position.z = -0.25;
        this.object.add(barrel);
        
        // 총 손잡이
        const handle = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.15, 0.1),
            new THREE.MeshLambertMaterial({ color: 0x8B4513 })
        );
        handle.position.y = -0.1;
        this.object.add(handle);
        
        // 조준점
        const sightGeometry = new THREE.RingGeometry(0.002, 0.005, 32);
        const sightMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000, side: THREE.DoubleSide });
        this.sight = new THREE.Mesh(sightGeometry, sightMaterial);
        this.sight.position.z = -0.5;
        this.object.add(this.sight);
        
        // 카메라에 무기 부착
        this.camera.add(this.object);
        
        // 무기 위치 설정
        this.object.position.set(0.2, -0.2, -0.4);
    }
    
    update(delta) {
        // 무기 흔들림 (걷기 효과)
        if (this.game.player && this.game.player.moveAnimation.walking) {
            const walkBob = Math.sin(this.game.player.moveAnimation.time * 2) * 0.01;
            this.object.position.y = -0.2 + walkBob;
        }
        
        // 반동 복구
        if (this.object.rotation.x > 0) {
            this.object.rotation.x *= 0.9;
            if (this.object.rotation.x < 0.01) this.object.rotation.x = 0;
        }
    }
    
    shoot() {
        const now = performance.now();
        
        // 발사 가능 여부 확인
        if (!this.canShoot || 
            this.isReloading || 
            this.ammo <= 0 || 
            now - this.lastShotTime < this.fireRate * 1000) {
            return;
        }
        
        this.lastShotTime = now;
        this.ammo--;
        
        // 총구 화염 효과
        this.createMuzzleFlash();
        
        // 반동 효과
        this.object.rotation.x += this.recoil;
        
        // UI 업데이트
        this.game.updateUI();
        
        // 레이캐스트를 통한 충돌 검사
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        
        // 다른 플레이어와의 충돌 확인
        const playerObjects = Object.values(this.game.players)
            .filter(player => player.id !== this.game.playerId)
            .map(player => player.object);
        
        // 맵 오브젝트와의 충돌 확인
        const mapObjects = this.game.world.objects || [];
        
        const intersects = raycaster.intersectObjects([...playerObjects, ...mapObjects], true);
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            
            // 총알 궤적 생성
            const startPoint = this.object.position.clone();
            this.object.localToWorld(startPoint);
            this.createBulletTrail(startPoint, hit.point);
            
            // 맞은 오브젝트 처리
            let hitPlayerId = null;
            
            // 플레이어가 맞았는지 확인
            Object.values(this.game.players).forEach(player => {
                if (player.id !== this.game.playerId &&
                    player.object.getObjectById(hit.object.id)) {
                    hitPlayerId = player.id;
                }
            });
            
            if (hitPlayerId) {
                // 서버에 피격 정보 전송
                this.game.network.sendShot(hitPlayerId);
                // 조준선 효과 표시
                this.showHitMarker();
            } else {
                // 탄흔 효과 생성
                this.createBulletHole(hit.point, hit.face.normal);
            }
        } else {
            // 충돌이 없는 경우 최대 사거리까지 궤적 생성
            const startPoint = this.object.position.clone();
            this.object.localToWorld(startPoint);
            const endPoint = raycaster.ray.at(this.range, new THREE.Vector3());
            this.createBulletTrail(startPoint, endPoint);
        }
        
        // 자동 재장전 (탄약이 없을 경우)
        if (this.ammo <= 0) {
            this.reload();
        }
    }
    
    reload() {
        if (this.isReloading || this.ammo === this.maxAmmo) return;
        
        this.isReloading = true;
        this.canShoot = false;
        
        // 재장전 효과음 재생 (구현 필요)
        this.reloadSound.play();
        
        // 재장전 애니메이션 (임시)
        this.object.position.z += 0.1;
        
        // 재장전 시간 후 완료
        setTimeout(() => {
            this.ammo = this.maxAmmo;
            this.isReloading = false;
            this.canShoot = true;
            this.object.position.z -= 0.1;
            
            // UI 업데이트
            this.game.updateUI();
        }, this.reloadTime * 1000);
    }
    
    createMuzzleFlash() {
        // 총구 화염 효과 개선
        const flashGroup = new THREE.Group();
        
        // 중심 화염
        const centerFlash = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 8),
            new THREE.MeshBasicMaterial({ 
                color: 0xffff00,
                transparent: true,
                opacity: 0.8
            })
        );
        flashGroup.add(centerFlash);
        
        // 외부 화염
        const outerFlash = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 8, 8),
            new THREE.MeshBasicMaterial({ 
                color: 0xff4400,
                transparent: true,
                opacity: 0.6
            })
        );
        flashGroup.add(outerFlash);
        
        // 위치 설정
        flashGroup.position.copy(this.object.position);
        flashGroup.position.z -= 0.5;
        this.camera.add(flashGroup);
        
        // 애니메이션
        const startTime = performance.now();
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const scale = 1 - (elapsed / 50); // 50ms 동안 사라짐
            
            if (scale > 0) {
                flashGroup.scale.set(scale, scale, scale);
                centerFlash.material.opacity = 0.8 * scale;
                outerFlash.material.opacity = 0.6 * scale;
                requestAnimationFrame(animate);
            } else {
                this.camera.remove(flashGroup);
            }
        };
        
        animate();
    }
    
    createBulletTrail(startPoint, endPoint) {
        // 총알 궤적 생성
        const points = [];
        points.push(startPoint);
        points.push(endPoint);
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: 0xffff00,
            transparent: true,
            opacity: 0.5
        });
        
        const trail = new THREE.Line(geometry, material);
        this.scene.add(trail);
        
        // 애니메이션
        const startTime = performance.now();
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const scale = 1 - (elapsed / 100); // 100ms 동안 사라짐
            
            if (scale > 0) {
                trail.material.opacity = 0.5 * scale;
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(trail);
            }
        };
        
        animate();
    }
    
    createBulletHole(position, normal) {
        // 탄흔 생성
        const bulletHole = new THREE.Mesh(
            new THREE.CircleGeometry(0.03, 16),
            new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
        );
        
        // 위치 설정
        bulletHole.position.copy(position);
        
        // 노멀 방향으로 약간 이동 (z-fighting 방지)
        bulletHole.position.add(normal.multiplyScalar(0.01));
        
        // 노멀 방향으로 회전
        bulletHole.lookAt(position.clone().add(normal));
        
        this.scene.add(bulletHole);
        
        // 일정 시간 후 사라짐
        setTimeout(() => {
            this.scene.remove(bulletHole);
        }, 10000); // 10초 유지
    }

    showHitMarker() {
        // 기존 hit-marker 요소가 있다면 제거
        const existingMarker = document.getElementById('hit-marker');
        if (existingMarker) {
            existingMarker.remove();
        }

        // 새로운 hit-marker 요소 생성
        const hitMarker = document.createElement('div');
        hitMarker.id = 'hit-marker';
        hitMarker.innerHTML = '+';
        document.body.appendChild(hitMarker);

        // 애니메이션 효과
        requestAnimationFrame(() => {
            hitMarker.style.opacity = '1';
            hitMarker.style.transform = 'scale(1.5)';
        });

        // 0.2초 후 효과 제거
        setTimeout(() => {
            hitMarker.style.opacity = '0';
            hitMarker.style.transform = 'scale(1)';
            setTimeout(() => {
                hitMarker.remove();
            }, 200);
        }, 200);
    }
}