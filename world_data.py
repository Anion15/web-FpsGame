"""
지형 구조 데이터를 관리하는 모듈
"""

class WorldData:
    @staticmethod
    def get_world_data():
        """
        월드 데이터 구조를 반환하는 함수
        """
        return {
            # 경계벽 정보
            'boundary_walls': [
                {
                    'position': {'x': 0, 'y': 5, 'z': -50},
                    'size': {'x': 100, 'y': 10, 'z': 2},
                    'color': 0x555555
                },
                {
                    'position': {'x': 0, 'y': 5, 'z': 50},
                    'size': {'x': 100, 'y': 10, 'z': 2},
                    'color': 0x555555
                },
                {
                    'position': {'x': -50, 'y': 5, 'z': 0},
                    'size': {'x': 2, 'y': 10, 'z': 100},
                    'color': (0x555555)
                },
                {
                    'position': {'x': 50, 'y': 5, 'z': 0},
                    'size': {'x': 2, 'y': 10, 'z': 100},
                    'color': 0x555555
                }
            ],
            
            # 건물 정보
            'buildings': [
                {
                    'position': {'x': -20, 'y': 0, 'z': -15},
                    'size': {'x': 10, 'y': 8, 'z': 12},
                    'color': 0x888888,
                    'texture': 'concrete.jpg'
                },
                {
                    'position': {'x': 15, 'y': 0, 'z': 20},
                    'size': {'x': 8, 'y': 5, 'z': 8},
                    'color': 0x999999,
                    'texture': 'concrete.jpg'
                }
            ],
            
            # 바닥 정보
            'ground': {
                'size': 500,
                'texture': 'ground.jpg',
                'textureRepeat': 100
            },
            
            # 조명 정보
            'lights': {
                'ambient': {
                    'color': 0xffffff,
                    'intensity': 0.6
                },
                'sun': {
                    'color': 0xffffff,
                    'intensity': 0.8,
                    'position': {'x': 50, 'y': 100, 'z': 50},
                    'shadowSize': 100
                }
            },
            
            # 랜덤 장애물
            'obstacles': WorldData._generate_obstacles(30)
        }
    
    @staticmethod
    def _generate_obstacles(count):
        """
        랜덤 장애물 생성
        """
        import random
        import math
        
        obstacles = []
        building_positions = [
            {'x': -20, 'z': -15, 'radius': 15},
            {'x': 15, 'z': 20, 'radius': 10}
        ]
        
        for i in range(count):
            size = 1 + random.random() * 2
            height = 1 + random.random() * 3
            
            # 랜덤 위치 생성
            position = {
                'x': (random.random() - 0.5) * 80,
                'y': height / 2,
                'z': (random.random() - 0.5) * 80
            }
            
            # 건물과 충돌하지 않는지 확인
            valid_position = True
            for building in building_positions:
                distance = math.sqrt(
                    (position['x'] - building['x'])**2 + 
                    (position['z'] - building['z'])**2
                )
                
                if distance < building['radius']:
                    valid_position = False
                    break
            
            if valid_position:
                obstacles.append({
                    'position': position,
                    'size': {'x': size, 'y': height, 'z': size},
                    'color': 0x808080
                })
        
        return obstacles