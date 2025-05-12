class World {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.objects = [];
        
        // 후처리 효과 설정
        this.setupPostProcessing();
        
        // 안개 설정
        this.setupFog();
        
        // 하늘 생성
        this.createSky();
        
        // 물 효과 추가
        //this.createWater();
        
        // 기본 환경 생성
        this.createLights();
        this.createGround({
            size: 500,
            texture: 'ground.jpg',
            textureRepeat: 100
        });
        this.createEnvironment();
        
        // 저장된 오브젝트들을 라이트맵에 포함
        this.setupShadows();
    }

    setupPostProcessing() {
        // 후처리 효과 컴포저 생성 전에 필요한 의존성 확인
        if (!THREE.EffectComposer || !THREE.RenderPass || !THREE.UnrealBloomPass) {
            console.error('필요한 Three.js 후처리 효과 모듈이 로드되지 않았습니다.');
            return;
        }

        try {
            // 후처리 효과 컴포저 생성
            this.composer = new THREE.EffectComposer(this.game.renderer);
            
            // 렌더 패스 추가
            const renderPass = new THREE.RenderPass(this.scene, this.game.camera);
            this.composer.addPass(renderPass);
            
            // 블룸 효과 (기본값으로 시작)
            const bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                1.0,  // 강도 감소
                0.4,  // 반경
                0.85  // 임계값
            );
            this.composer.addPass(bloomPass);
            
            // FXAA (Fast Approximate Anti-Aliasing)
            const fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
            fxaaPass.uniforms['resolution'].value.set(
                1 / (window.innerWidth * this.game.renderer.getPixelRatio()),
                1 / (window.innerHeight * this.game.renderer.getPixelRatio())
            );
            this.composer.addPass(fxaaPass);
            
            // 기본 색상 보정
            const colorCorrectionShader = {
                uniforms: {
                    "tDiffuse": { value: null },
                    "brightness": { value: 0.05 },
                    "contrast": { value: 0.1 },
                    "saturation": { value: 0.1 },
                    "vignette": { value: 0.5 }
                },
                vertexShader: `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform sampler2D tDiffuse;
                    uniform float brightness;
                    uniform float contrast;
                    uniform float saturation;
                    uniform float vignette;
                    varying vec2 vUv;
                    
                    void main() {
                        vec4 color = texture2D(tDiffuse, vUv);
                        
                        // 밝기 조정
                        color.rgb += brightness;
                        
                        // 대비 조정
                        color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;
                        
                        // 채도 조정
                        float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                        color.rgb = mix(vec3(gray), color.rgb, 1.0 + saturation);
                        
                        // 비네트 효과
                        vec2 vignetteUv = vUv * 2.0 - 1.0;
                        float vignetteStrength = 1.0 - dot(vignetteUv, vignetteUv) * vignette;
                        color.rgb *= vignetteStrength;
                        
                        gl_FragColor = color;
                    }
                `
            };
            
            const colorCorrectionPass = new THREE.ShaderPass(colorCorrectionShader);
            this.composer.addPass(colorCorrectionPass);

        } catch (error) {
            console.error('후처리 효과 초기화 중 오류 발생:', error);
            // 오류 발생 시 기본 렌더러 사용
            this.composer = null;
        }
    }

    setupFog() {
        // 더 자연스러운 안개 효과
        const fogColor = new THREE.Color(0xCCCCCC);
        this.scene.fog = new THREE.FogExp2(fogColor, 0.019);
    }

    createSky() {
        // Sky 객체 생성
        const sky = new THREE.Sky();
        sky.scale.setScalar(10000);
        this.scene.add(sky);

        // Sky 파라미터 설정 (더 자연스럽게)
        const skyUniforms = sky.material.uniforms;
        skyUniforms['turbidity'].value = 8;
        skyUniforms['rayleigh'].value = 2.5;
        skyUniforms['mieCoefficient'].value = 0.004;
        skyUniforms['mieDirectionalG'].value = 0.8;

        // 태양 위치 설정 (살짝 낮고 따뜻한 각도)
        const sun = new THREE.Vector3();
        const phi = THREE.MathUtils.degToRad(85);
        const theta = THREE.MathUtils.degToRad(170);
        sun.setFromSphericalCoords(1, phi, theta);
        skyUniforms['sunPosition'].value.copy(sun);

        // 구름 생성
        const cloudTexture = new THREE.TextureLoader().load('static/textures/cloud.png');
        
        const cloudSizes = [
            { width: 500, height: 500 },
            { width: 300, height: 300 },
            { width: 200, height: 200 },
            { width: 150, height: 150 }
        ];

        for (let i = 0; i < 12; i++) {
            const size = cloudSizes[i % cloudSizes.length];
            const cloudGeometry = new THREE.PlaneGeometry(size.width, size.height);
            const cloudMaterial = new THREE.MeshBasicMaterial({
                map: cloudTexture,
                transparent: true,
                opacity: 0.4 + Math.random() * 0.3,
                depthWrite: false
            });

            const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial.clone());
            cloud.position.y = 80 + i * 15;
            cloud.rotation.x = -Math.PI / 2;
            
            cloud.userData = {
                speed: 0.05 + Math.random() * 0.15,
                direction: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.001
            };
            
            this.scene.add(cloud);
            
            const animateClouds = () => {
                cloud.position.x += Math.cos(cloud.userData.direction) * cloud.userData.speed;
                cloud.position.z += Math.sin(cloud.userData.direction) * cloud.userData.speed;
                cloud.rotation.z += cloud.userData.rotationSpeed;
                
                if (cloud.position.x > 300) cloud.position.x = -300;
                if (cloud.position.x < -300) cloud.position.x = 300;
                if (cloud.position.z > 300) cloud.position.z = -300;
                if (cloud.position.z < -300) cloud.position.z = 300;
                
                requestAnimationFrame(animateClouds);
            };
            
            animateClouds();
        }
    }

    createWater() {
        const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
        
        // 물 텍스처 로드 시도
        const waterNormals = new THREE.TextureLoader().load(
            'static/textures/waternormals.jpg',
            undefined,
            undefined,
            (error) => {
                console.warn('물 텍스처를 로드할 수 없습니다:', error);
            }
        );
        
        const water = new THREE.Water(
            waterGeometry,
            {
                textureWidth: 512,
                textureHeight: 512,
                waterNormals: waterNormals,
                sunDirection: new THREE.Vector3(0, 1, 0),
                sunColor: 0xffffff,
                waterColor: 0x001e0f,
                distortionScale: 3.7,
                fog: this.scene.fog !== undefined
            }
        );
        
        water.rotation.x = -Math.PI / 2;
        water.position.y = -2;
        this.scene.add(water);
        this.water = water;
    }

    createLights() {
        // 주변광 개선 (연한 하늘색)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        // 태양빛 개선 (따뜻한 노란빛)
        const sunLight = new THREE.DirectionalLight(0xfff7b2, 1.0);
        sunLight.position.set(50, 100, 50);
        sunLight.castShadow = true;
        
        // 그림자 품질 향상
        sunLight.shadow.mapSize.width = 4096;
        sunLight.shadow.mapSize.height = 4096;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        
        // 그림자 범위 및 품질 설정
        const shadowSize = 100;
        sunLight.shadow.camera.left = -shadowSize;
        sunLight.shadow.camera.right = shadowSize;
        sunLight.shadow.camera.top = shadowSize;
        sunLight.shadow.camera.bottom = -shadowSize;
        
        // 그림자 블러 효과
        sunLight.shadow.radius = 2;
        
        this.scene.add(sunLight);
        this.sunLight = sunLight;
        
        // 보조 조명 추가
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-50, 50, -50);
        this.scene.add(fillLight);
    }
    
    createGround(groundData) {
        const textureLoader = new THREE.TextureLoader();
        
        // 텍스처 로딩 에러 처리
        textureLoader.crossOrigin = 'anonymous';
        
        const groundTexture = textureLoader.load(
            'static/textures/' + groundData.texture,
            undefined,
            undefined,
            (error) => {
                console.error('텍스처 로딩 실패:', error);
                // 텍스처 로딩 실패 시 기본 색상 사용
                const ground = new THREE.Mesh(
                    new THREE.PlaneGeometry(groundData.size, groundData.size),
                    new THREE.MeshStandardMaterial({ 
                        color: 0x808080,
                        roughness: 0.8,
                        metalness: 0.2
                    })
                );
                
                ground.rotation.x = -Math.PI / 2;
                ground.receiveShadow = true;
                this.scene.add(ground);
                this.objects.push(ground);
            }
        );
        
        if (groundTexture) {
            groundTexture.wrapS = THREE.RepeatWrapping;
            groundTexture.wrapT = THREE.RepeatWrapping;
            groundTexture.repeat.set(groundData.textureRepeat, groundData.textureRepeat);
            
            const ground = new THREE.Mesh(
                new THREE.PlaneGeometry(groundData.size, groundData.size),
                new THREE.MeshStandardMaterial({ 
                    map: groundTexture,
                    roughness: 0.8,
                    metalness: 0.2
                })
            );
            
            ground.rotation.x = -Math.PI / 2;
            ground.receiveShadow = true;
            this.scene.add(ground);
            this.objects.push(ground);
        }
    }
    
    createEnvironment() {
        // 맵 가장자리 경계 (벽)
        this.createBoundaryWalls();
        
        // 콘크리트 블록 텍스처
        const blockTexture = new THREE.TextureLoader().load('static/textures/concrete.jpg');
        
        // 장애물, 벽 및 구조물 생성
        this.createBuilding(new THREE.Vector3(-20, 0, -15), new THREE.Vector3(10, 8, 12), blockTexture, 0x888888);
        this.createBuilding(new THREE.Vector3(15, 0, 20), new THREE.Vector3(8, 5, 8), blockTexture, 0x999999);
        
        // 작은 장애물들
        for (let i = 0; i < 30; i++) {
            const size = 1 + Math.random() * 2;
            const height = 1 + Math.random() * 3;
            const position = new THREE.Vector3(
                (Math.random() - 0.5) * 80,
                height / 2,
                (Math.random() - 0.5) * 80
            );
            
            // 건물과 충돌하지 않는 위치인지 확인
            if (position.distanceTo(new THREE.Vector3(-20, 0, -15)) > 15 &&
                position.distanceTo(new THREE.Vector3(15, 0, 20)) > 10) {
                this.createBox(position, new THREE.Vector3(size, height, size), 0x808080);
            }
        }
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
    
    createBuilding(position, size, texture, color) {
        const building = new THREE.Group();
        building.position.copy(position);
        
        // 건물 몸체
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(size.x, size.y, size.z),
            new THREE.MeshStandardMaterial({ 
                map: texture,
                color: color
            })
        );
        body.position.y = size.y / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        building.add(body);
        
        // 지붕
        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(size.x, 0.5, size.z),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        roof.position.y = size.y + 0.25;
        roof.castShadow = true;
        roof.receiveShadow = true;
        building.add(roof);
        
        // 출입구
        const doorWidth = Math.min(size.x, size.z) * 0.3;
        const doorHeight = Math.min(2.5, size.y * 0.7);
        
        // 출입구 위치 결정 (건물 가장자리 중 하나)
        const doorSide = Math.floor(Math.random() * 4);
        let doorPosition = new THREE.Vector3(0, doorHeight / 2, 0);
        
        switch (doorSide) {
            case 0: // 전면
                doorPosition.z = size.z / 2;
                break;
            case 1: // 후면
                doorPosition.z = -size.z / 2;
                break;
            case 2: // 왼쪽
                doorPosition.x = -size.x / 2;
                break;
            case 3: // 오른쪽
                doorPosition.x = size.x / 2;
                break;
        }
        
        // 출입구 생성
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(
                doorSide < 2 ? doorWidth : 0.1,
                doorHeight,
                doorSide < 2 ? 0.1 : doorWidth
            ),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        door.position.copy(doorPosition);
        building.add(door);
        
        this.scene.add(building);
        this.objects.push(body);
        this.objects.push(roof);
    }
    
    createBox(position, size, color) {
        const textureLoader = new THREE.TextureLoader();
        const boxTexture = textureLoader.load('static/textures/concrete.jpg');
        boxTexture.wrapS = THREE.RepeatWrapping;
        boxTexture.wrapT = THREE.RepeatWrapping;
        boxTexture.repeat.set(2, 2); // 텍스처 반복 횟수 조정

        const box = new THREE.Mesh(
            new THREE.BoxGeometry(size.x, size.y, size.z),
            new THREE.MeshStandardMaterial({ 
                map: boxTexture,
                color: color,
                roughness: 0.8,
                metalness: 0.2
            })
        );
        
        box.position.copy(position);
        box.castShadow = true;
        box.receiveShadow = true;
        
        this.scene.add(box);
        this.objects.push(box);
        
        return box;
    }
    
    setupShadows() {
        // 모든 오브젝트에 그림자 설정
        this.objects.forEach(object => {
            if (object instanceof THREE.Mesh) {
                object.castShadow = true;
                object.receiveShadow = true;
            }
        });
    }
    
    createWeapon() {
        this.weapon = new Weapon(this.game);
        return this.weapon;
    }

    // 새로운 메서드 추가
    initializeFromServerData(terrainData) {
        // 기존 오브젝트 제거
        this.objects.forEach(obj => {
            if (obj.parent) {
                obj.parent.remove(obj);
            }
        });
        this.objects = [];

        // 바닥 생성
        this.createGround(terrainData.ground);
        
        // 경계벽 생성
        terrainData.boundary_walls.forEach(wall => {
            this.createWall(
                new THREE.Vector3(wall.position.x, wall.position.y, wall.position.z),
                new THREE.Vector3(wall.size.x, wall.size.y, wall.size.z),
                wall.color
            );
        });
        
        // 건물 생성
        terrainData.buildings.forEach(building => {
            const texture = new THREE.TextureLoader().load('static/textures/' + building.texture);
            this.createBuilding(
                new THREE.Vector3(building.position.x, building.position.y, building.position.z),
                new THREE.Vector3(building.size.x, building.size.y, building.size.z),
                texture,
                building.color
            );
        });
        
        // 장애물 생성
        terrainData.obstacles.forEach(obstacle => {
            this.createBox(
                new THREE.Vector3(obstacle.position.x, obstacle.position.y, obstacle.position.z),
                new THREE.Vector3(obstacle.size.x, obstacle.size.y, obstacle.size.z),
                obstacle.color
            );
        });
        
        // 그림자 설정
        this.setupShadows();
    }

    createWall(position, size, color) {
        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(size.x, size.y, size.z),
            new THREE.MeshStandardMaterial({ color: color })
        );
        
        wall.position.copy(position);
        wall.castShadow = true;
        wall.receiveShadow = true;
        
        this.scene.add(wall);
        this.objects.push(wall);
        
        return wall;
    }

    update() {
        // 물 애니메이션 업데이트
        if (this.water) {
            this.water.material.uniforms['time'].value += 1.0 / 60.0;
        }

        // 후처리 효과 업데이트
        if (this.composer) {
            this.composer.render();
        }
    }
}