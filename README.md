# 🕹️ 3D FPS Web Game

웹 브라우저에서 실행되는 실시간 3D 1인칭 슈팅(FPS) 게임입니다.  
Three.js 기반으로 구축되었으며, 마우스 조작과 키보드를 통해 몰입감 있는 슈팅 게임을 제공합니다.

> 스크린샷  
<img src="https://github.com/user-attachments/assets/54de7e81-869a-43aa-ba1c-abba5104e24e" width="600"/>

> 게임 플레이 영상  
<img src="https://github.com/user-attachments/assets/c04117fc-263b-4b97-ab7b-e1ace4e4ef20" width="600"/>
&nbsp;
<a href="https://drive.google.com/file/d/1-x-JBzCMnQnzAB7pHqEEML04y3lQWQVD/view?usp=sharing" target="_blank">▶️ 플레이 영상 전체 보기</a>




---
&nbsp;
&nbsp;
## 🌍 데모

> ⚠️ 이 게임은 **PC에서 실행**할 때 최적화되어 있습니다.  
> 모바일 환경에서는 실행이 제한됩니다.
&nbsp;
&nbsp;
---
&nbsp;
&nbsp;

| 분류                | 기술 요소                                                                          | 설명                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **렌더링 엔진**        | **Three.js**                                                                   | WebGL 기반 3D 렌더링 라이브러리로, 씬(scene), 카메라, 조명, 메시, 머티리얼 등을 생성하고 렌더링을 수행함.                                 |
| **후처리(렌더링 후 효과)** | `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `FXAAShader`, 커스텀 색상 보정 셰이더 | 후처리 효과 체인을 구성해 블룸, 안티앨리어싱(FXAA), 색상 보정(brightness/contrast/saturation), 비네트(vignette) 등 시각적 품질을 향상시킴. |
| **안개 효과**         | `THREE.FogExp2`                                                                | 씬에 자연스러운 거리 기반 안개를 적용하여 깊이감과 현실감을 제공.                                                                 |
| **하늘 표현**         | `THREE.Sky`                                                                    | 실시간 물리 기반 하늘 돔으로, 햇빛의 위치, Rayleigh 산란, Mie 산란 등을 조절하여 날씨와 분위기 연출.                                     |
| **구름 시뮬레이션**      | `PlaneGeometry` + `MeshBasicMaterial` + 텍스처 및 사용자 정의 애니메이션                     | 반투명 구름 텍스처를 평면에 입혀 부유하는 구름을 표현하며, 위치 및 회전을 반복적으로 애니메이션 처리.                                            |
| **지형**            | `createGround()` 함수 내 평면 메시와 텍스처 반복                                            | 넓은 땅(ground)을 평면으로 생성하고 텍스처를 반복시켜 자연스러운 지형을 표현.                                                       |
| **조명**            | `createLights()`                                                               | 다양한 광원을 설정해 현실감 있는 조명 환경 구현. (코드 일부 생략되어 있지만 보통 DirectionalLight, AmbientLight 사용)                    |
| **그림자 설정**        | `setupShadows()`                                                               | 그림자를 표현하여 오브젝트와 환경 간의 깊이감 및 사실감을 향상.                                                                  |
| **모듈 구조**         | JavaScript 클래스 (`World`)                                                       | 게임 환경을 캡슐화하는 구조적 설계로 유지보수 및 확장성 향상.                                                                   |
| **애니메이션**         | `requestAnimationFrame`                                                        | 프레임 단위로 구름 이동, 회전 등을 자연스럽게 구현.                                                                        |
| **사용자 정의 셰이더**    | 커스텀 `vertexShader` 및 `fragmentShader`                                          | 색상 보정, 비네트 효과 등을 GLSL로 직접 구현하여 세밀한 후처리 제어 가능.                                                         |
| **리소스 로딩**        | `TextureLoader`                                                                | 구름 및 지형 텍스처 등 외부 이미지 리소스를 로딩하여 시각적 요소에 적용.                                                            |

---
&nbsp;
&nbsp;
## 🎮 조작 방법

| 조작키/버튼        | 기능 |
|--------------------|------|
| `W/A/S/D`           | 앞/뒤/좌/우 이동 |
| `Shift`             | 달리기 |
| `Space`             | 점프 |
| `R`                 | 재장전 |
| `C`                 | 헤드 밥 토글 |
| `V/B`               | 마우스 감도 조절 |
| `Z` or `우클릭`     | 줌인/줌아웃 전환 |
| `마우스 좌클릭`     | 사격 |
| `휠 스크롤`         | 시야각 조절 |

---
&nbsp;
&nbsp;
## 📁 프로젝트 구조

```plaintext
├── index.html              # 메인 HTML + UI 구성
├── static/
│   └── js/
│       ├── world.js        # 환경(맵, 조명, 스카이박스 등) 생성
│       ├── controls.js     # 입력 및 카메라, 반동 처리
│       └── [기타 *.js]     # 네트워크, 플레이어, 무기 등
└── static/
    └── textures/           # 텍스처 파일 (구름, 벽, 바닥 등)
```
&nbsp;
&nbsp;
&nbsp;
![diagram (2)](https://github.com/user-attachments/assets/c2b406a0-653b-4245-a7f2-9215897287bf)

