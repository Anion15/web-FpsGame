class Controls {
    constructor(game) {
        this.game = game;
        this.camera = game.camera;

        // 키 상태
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
            reload: false,
            zoom: false
        };

        // 🎵 사운드 효과 로드
        this.gunshotSound = new Audio('/static/js/gunshot.mp3');
        this.reloadSound = new Audio('/static/js/reload.mp3');
        this.gunshotSound.volume = 0.4;

        // 마우스 감도
        this.mouseSensitivity = 0.002;
        this.mouseSensitivityMultiplier = 1.0;

        // 이동 속도
        this.walkSpeed = 5.0;
        this.sprintSpeed = 8.0;

        // 카메라 효과
        this.headBobEnabled = true;
        this.headBobAmplitude = 0.15;
        this.headBobFrequency = 2.0;
        this.bobTime = 0;

        // 회전
        this.smoothing = true;
        this.smoothFactor = 0.15;

        this.yaw = 0;
        this.pitch = 0;
        this.targetYaw = 0;
        this.targetPitch = 0;

        // 줌
        this.defaultFOV = 75;
        this.zoomFOV = 30;
        this.currentFOV = this.defaultFOV;
        this.zoomSpeed = 10;

        // 반동 관련
        this.recoilPitchOffset = 0;
        this.recoilYawOffset = 0;
        this.recoilRecoverySpeed = 5;

        // 충돌 처리와 관련된 변수
        this.isColliding = false;  // 충돌 여부
        this.collisionNormal = new THREE.Vector3();  // 충돌 방향 벡터

        this.setupEventListeners();
        this.initCameraRotation();
    }

    initCameraRotation() {
        this.yaw = this.camera.rotation.y;
        this.pitch = this.camera.rotation.x;
        this.targetYaw = this.yaw;
        this.targetPitch = this.pitch;
        this.updateCameraRotation();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (event) => this.onKeyDown(event));
        document.addEventListener('keyup', (event) => this.onKeyUp(event));
        document.addEventListener('mousemove', (event) => this.onMouseMove(event));
        document.addEventListener('mousedown', (event) => this.onMouseDown(event));
        document.addEventListener('mouseup', (event) => this.onMouseUp(event));
        document.addEventListener('wheel', (event) => this.onMouseWheel(event));
        document.addEventListener('contextmenu', (event) => event.preventDefault());
        document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    }

    onKeyDown(event) {
        if (!this.game.isRunning) return;
        switch (event.code) {
            case 'Escape':
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                } else {
                    this.lockPointer();
                }
                break;
            case 'KeyW': this.keys.forward = true; break;
            case 'KeyS': this.keys.backward = true; break;
            case 'KeyA': this.keys.left = true; break;
            case 'KeyD': this.keys.right = true; break;
            case 'Space':
                this.keys.jump = true;
                if (this.game.player) this.game.player.jump();
                break;
            case 'ShiftLeft': this.keys.sprint = true; break;
            case 'KeyR':
                this.keys.reload = true;
                if (this.game.world.weapon) {
                    this.game.world.weapon.reload();
                    //this.reloadSound.play();
                }
                break;
            case 'KeyC': this.headBobEnabled = !this.headBobEnabled; break;
            case 'KeyV': this.mouseSensitivityMultiplier = Math.max(0.5, this.mouseSensitivityMultiplier - 0.1); break;
            case 'KeyB': this.mouseSensitivityMultiplier = Math.min(2.0, this.mouseSensitivityMultiplier + 0.1); break;
            case 'KeyZ': this.keys.zoom = !this.keys.zoom; break;
        }
    }

    onKeyUp(event) {
        if (!this.game.isRunning) return;
        switch (event.code) {
            case 'KeyW': this.keys.forward = false; break;
            case 'KeyS': this.keys.backward = false; break;
            case 'KeyA': this.keys.left = false; break;
            case 'KeyD': this.keys.right = false; break;
            case 'Space': this.keys.jump = false; break;
            case 'ShiftLeft': this.keys.sprint = false; break;
            case 'KeyR': this.keys.reload = false; break;
        }
    }

    onMouseMove(event) {
        if (!this.game.isRunning || !document.pointerLockElement) return;

        const sensitivity = this.mouseSensitivity * this.mouseSensitivityMultiplier;

        if (this.smoothing) {
            this.targetYaw -= event.movementX * sensitivity;
            this.targetPitch -= event.movementY * sensitivity;
        } else {
            this.yaw -= event.movementX * sensitivity;
            this.pitch -= event.movementY * sensitivity;
        }

        const pitchLimit = (Math.PI / 2) * 0.99;
        this.targetPitch = Math.max(-pitchLimit, Math.min(pitchLimit, this.targetPitch));
        this.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, this.pitch));

        if (!this.smoothing) this.updateCameraRotation();
    }

    onMouseDown(event) {
        if (!this.game.isRunning) return;
        
        // 마우스가 잠금 해제된 상태에서 클릭하면 잠금
        if (!document.pointerLockElement) {
            this.lockPointer();
            return;
        }

        if (event.button === 0 && this.game.world.weapon) {
            this.game.world.weapon.shoot();
            this.gunshotSound.currentTime = 0;
            this.gunshotSound.play();
            this.applyRecoil();
        }

        if (event.button === 2) {
            this.keys.zoom = true;
        }
    }

    onMouseUp(event) {
        if (!this.game.isRunning) return;
        if (event.button === 2) {
            this.keys.zoom = false;
        }
    }

    onMouseWheel(event) {
        if (!this.game.isRunning) return;
        this.defaultFOV = Math.max(60, Math.min(90, this.defaultFOV - event.deltaY * 0.05));
        this.zoomFOV = Math.max(20, Math.min(40, this.zoomFOV - event.deltaY * 0.05));
    }

    onPointerLockChange() {
        if (!document.pointerLockElement && this.game.isRunning) {
            // 일시정지 메뉴 표시 가능
        }
    }

    lockPointer() {
        this.game.canvas.requestPointerLock();
    }

    updateHeadBob(delta, isMoving) {
        if (!this.headBobEnabled || !isMoving) {
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.game.player.height, delta * 5);
            return;
        }

        const speedFactor = this.keys.sprint ? 1.5 : 1.0;
        this.bobTime += delta * this.headBobFrequency * speedFactor;
        const bobOffset = Math.sin(this.bobTime) * this.headBobAmplitude * speedFactor;
        this.camera.position.y = this.game.player.height + bobOffset;
    }

    updateZoom(delta) {
        const targetFOV = this.keys.zoom ? this.zoomFOV : this.defaultFOV;
        this.currentFOV = THREE.MathUtils.lerp(this.currentFOV, targetFOV, delta * this.zoomSpeed);

        if (this.camera.fov !== this.currentFOV) {
            this.camera.fov = this.currentFOV;
            this.camera.updateProjectionMatrix();
        }
    }

    updateCameraRotation() {
        const recoilYaw = this.recoilYawOffset;
        const recoilPitch = this.recoilPitchOffset;
        this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch + recoilPitch, this.yaw + recoilYaw, 0, 'YXZ'));
    }

    applyRecoil() {
        const recoilStrengthPitch = 0.05; // 상하 반동
        const recoilStrengthYaw = 0.01;  // 좌우 반동
        this.recoilPitchOffset += Math.random() * recoilStrengthPitch;
        this.recoilYawOffset += (Math.random() - 0.5) * recoilStrengthYaw;
    }

    updateRecoil(delta) {
        // 부드러운 반동 회복
        this.recoilPitchOffset = THREE.MathUtils.lerp(this.recoilPitchOffset, 0, delta * this.recoilRecoverySpeed);
        this.recoilYawOffset = THREE.MathUtils.lerp(this.recoilYawOffset, 0, delta * this.recoilRecoverySpeed);
    }

    update(delta) {
        if (!this.game.player) return;
        if (this.game.player.health <= 0) return; // 사망 시 입력 차단

        // 카메라 회전 업데이트
        if (this.smoothing) {
            this.yaw = THREE.MathUtils.lerp(this.yaw, this.targetYaw, delta / this.smoothFactor);
            this.pitch = THREE.MathUtils.lerp(this.pitch, this.targetPitch, delta / this.smoothFactor);
        }

        this.updateRecoil(delta);
        this.updateCameraRotation();

        // 이동 방향 계산
        const direction = new THREE.Vector3();

        if (this.keys.forward) direction.z = -1;
        else if (this.keys.backward) direction.z = 1;
        if (this.keys.left) direction.x = -1;
        else if (this.keys.right) direction.x = 1;

        const isMoving = direction.length() > 0;
        if (isMoving) direction.normalize();

        // 카메라 방향 기준으로 이동 방향 회전
        const rotationMatrix = new THREE.Matrix4().makeRotationY(this.yaw);
        direction.applyMatrix4(rotationMatrix);

        // 이동 속도 설정
        const speed = this.keys.sprint ? this.sprintSpeed : this.walkSpeed;
        
        // 플레이어 속도 업데이트
        if (isMoving) {
            this.game.player.velocity.x = direction.x * speed;
            this.game.player.velocity.z = direction.z * speed;
        } else {
            // 이동 키가 눌리지 않았을 때는 속도를 0으로
            this.game.player.velocity.x = 0;
            this.game.player.velocity.z = 0;
        }

        // 카메라 효과 업데이트
        this.updateHeadBob(delta, isMoving);
        this.updateZoom(delta);
    }

    createBoundaryWalls() {
        const wallHeight = 10;
        const wallThickness = 2;
        const worldSize = 50;

        // 텍스처를 비동기로 로드한 후 벽 생성
        new THREE.TextureLoader().load('static/textures/wall_concrete.jpg', (wallTexture) => {
            wallTexture.wrapS = THREE.RepeatWrapping;
            wallTexture.wrapT = THREE.RepeatWrapping;
            wallTexture.repeat.set(8, 2);

            const wallMaterial = new THREE.MeshStandardMaterial({ 
                map: wallTexture,
                roughness: 0.7,
                metalness: 0.1
            });

            // 4개의 경계벽 생성
            // 앞/뒤 벽 (z축)
            for (let z of [-worldSize, worldSize]) {
                const wall = new THREE.Mesh(
                    new THREE.PlaneGeometry(worldSize * 2, wallHeight),
                    wallMaterial
                );
                wall.position.set(0, wallHeight / 2, z);
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
        });
    }
}