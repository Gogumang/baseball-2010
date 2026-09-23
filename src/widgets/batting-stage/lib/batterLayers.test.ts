import { describe, expect, it } from 'vitest'
import { batterEquipmentOf, batterFrameAt, batterLayersOf, bodyTypeOf, equipmentGradeOf, layerPaletteIndexOf } from '@/widgets/batting-stage/lib/batterLayers'

const 파일 = (layers: ReturnType<typeof batterLayersOf>) => layers.map((layer) => `${layer.folder.split('/')[2]}:${layer.frame}`)

describe('타자 자세 프레임 f — 0xb905c', () => {
  it('대기는 [0,1,2,3] 을 칸마다 4틱씩 반복한다 (balancer)', () => {
    expect([0, 3, 4, 8, 12, 15, 16].map((tick) => batterFrameAt({ tick, swingTick: null, isBunting: false, bodyType: 0 }))).toEqual([0, 0, 1, 2, 3, 3, 0])
  })

  it('스윙은 6~12 를 매 틱 한 칸씩, 끝나면 대기로 돌아간다', () => {
    const 스윙 = (tick: number) => batterFrameAt({ tick, swingTick: 100, isBunting: false, bodyType: 0 })
    expect([100, 101, 106, 107].map(스윙)).toEqual([6, 7, 12, 2])
  })

  it('sluger 는 대기 [0..4], 스윙 7~11 이다', () => {
    expect(batterFrameAt({ tick: 16, swingTick: null, isBunting: false, bodyType: 1 })).toBe(4)
    expect(batterFrameAt({ tick: 104, swingTick: 100, isBunting: false, bodyType: 1 })).toBe(11)
  })

  it('번트 자세는 balancer 13 · sluger 12', () => {
    expect(batterFrameAt({ tick: 0, swingTick: null, isBunting: true, bodyType: 0 })).toBe(13)
    expect(batterFrameAt({ tick: 0, swingTick: null, isBunting: true, bodyType: 1 })).toBe(12)
  })
})

describe('타자 레이어 — 0x78cfc (겹침 표 0xd3a54)', () => {
  it('규칙 0 (f=4): 그림자·몸통·헬멧·배트·몸통 앞(f+14) 순서 — 맨몸이면 다리 레이어가 없다', () => {
    expect(파일(batterLayersOf(4, 0))).toEqual([
      'batter_shadow:4', 'batter_balancer:4', 'batter_helmet:4', 'batter_batter:4', 'batter_balancer:18',
    ])
  })

  it('규칙 1 (f=0): 배트와 몸통 앞을 맞바꾼다', () => {
    expect(파일(batterLayersOf(0, 0)).slice(3, 5)).toEqual(['batter_balancer:14', 'batter_batter:0'])
  })

  it('규칙 2 (f=13): 배트가 몸통 뒤로 간다', () => {
    expect(파일(batterLayersOf(13, 0)).slice(0, 5)).toEqual([
      'batter_shadow:13', 'batter_batter:13', 'batter_balancer:13', 'batter_helmet:13', 'batter_balancer:27',
    ])
  })

  it('f 8·9 는 잔상(batter_ghost)을 한 번 더 그린다 — balancer 는 f−6, 8 은 슬롯 4 뒤 · 9 는 슬롯 1 뒤', () => {
    expect(파일(batterLayersOf(8, 0))).toContain('batter_ghost:2')
    expect(파일(batterLayersOf(9, 0))[2]).toBe('batter_ghost:3')
  })

  it('sluger 는 몸통 외 레이어가 +14, 몸통 앞이 +13 이다', () => {
    expect(파일(batterLayersOf(0, 1))).toEqual([
      'batter_shadow:14', 'batter_sluger:0', 'batter_helmet:14', 'batter_batter:14', 'batter_sluger:13',
    ])
  })
})

describe('장비 외형 레이어 — 0x78fd8 적재 · 0x78cfc 슬롯', () => {
  it('장비 니블(0 미장착 · 레벨+1) → 등급 순번 n = 니블 − 1 (0x10866)', () => {
    expect([0, 1, 2, 8, 11].map(equipmentGradeOf)).toEqual([-1, 0, 1, 7, 10])
    expect(batterEquipmentOf({ hit: 3, power: 1, run: 0 })).toEqual({ head: 2, hand: 0, leg: -1 })
  })

  it('머리·손·다리 장비가 슬롯 3·4·8 에 들어간다 (규칙 0, f=4)', () => {
    expect(파일(batterLayersOf(4, 0, { head: 1, hand: 0, leg: 3 }))).toEqual([
      'batter_shadow:4', 'batter_balancer:4', 'batter_helmet:4', 'item_bat_head_1:4', 'item_bat_hand:4',
      'batter_balancer:18', 'item_bat_hand_014_0:4', 'item_bat_leg_0:4',
    ])
  })

  it('머리 장비 등급 2 이상이면 헬멧을 안 그린다 (0x78df4)', () => {
    expect(파일(batterLayersOf(4, 0, { head: 2, hand: -1, leg: -1 }))).toEqual([
      'batter_shadow:4', 'batter_balancer:4', 'item_bat_head_2:4', 'batter_batter:4', 'batter_balancer:18',
    ])
  })

  it('손 등급 1·4·5 는 셋째 겹(_1)이 붙고, 덧그림 이름은 2_0·35_0·6_0·014_0 이다', () => {
    expect(파일(batterLayersOf(4, 0, { head: -1, hand: 5, leg: -1 })).slice(5)).toEqual([
      'item_bat_hand_35_0:4', 'item_bat_hand_5_1:4',
    ])
    expect(파일(batterLayersOf(4, 0, { head: -1, hand: 2, leg: -1 })).slice(5)).toEqual(['item_bat_hand_2_0:4'])
    expect(파일(batterLayersOf(4, 0, { head: -1, hand: 6, leg: -1 })).slice(5)).toEqual(['item_bat_hand_6_0:4'])
  })

  it('히든 등급(7~10)은 손이 item_bat_hand_{n} 한 장이고 덧그림이 없다', () => {
    expect(파일(batterLayersOf(4, 0, { head: -1, hand: 9, leg: 10 }))).toEqual([
      'batter_shadow:4', 'batter_balancer:4', 'batter_helmet:4', 'item_bat_hand_9:4', 'batter_balancer:18', 'item_bat_leg_7:4',
    ])
  })

  it('등급 색 .mpl 줄 — 손 n≤1·다리 0·7 은 기본색, 나머지는 n−2 · n−1 · n−8', () => {
    const 줄 = (layers: ReturnType<typeof batterLayersOf>, folder: string) =>
      layers.find((layer) => layer.folder.includes(folder))?.gradePaletteRow
    expect(줄(batterLayersOf(4, 0, { head: -1, hand: 1, leg: -1 }), 'item_bat_hand/')).toBeUndefined()
    expect(줄(batterLayersOf(4, 0, { head: -1, hand: 4, leg: -1 }), 'item_bat_hand/')).toBe(2)
    expect(줄(batterLayersOf(4, 0, { head: -1, hand: -1, leg: 0 }), 'item_bat_leg_0')).toBeUndefined()
    expect(줄(batterLayersOf(4, 0, { head: -1, hand: -1, leg: 6 }), 'item_bat_leg_0')).toBe(5)
    expect(줄(batterLayersOf(4, 0, { head: -1, hand: -1, leg: 7 }), 'item_bat_leg_7')).toBeUndefined()
    expect(줄(batterLayersOf(4, 0, { head: -1, hand: -1, leg: 10 }), 'item_bat_leg_7')).toBe(2)
  })
})

describe('레이어 한 겹이 칠할 팔레트 번호 — layerPaletteIndexOf', () => {
  const 겹 = (layers: ReturnType<typeof batterLayersOf>, folder: string) =>
    layers.find((layer) => layer.folder.includes(folder))!

  it('장비 손·다리는 등급 줄을 그대로 쓴다 (팀·피부와 무관)', () => {
    const 손4 = 겹(batterLayersOf(4, 0, { head: -1, hand: 4, leg: -1 }), 'item_bat_hand/')
    expect(layerPaletteIndexOf(손4, 2, 7)).toBe(2)
    const 다리6 = 겹(batterLayersOf(4, 0, { head: -1, hand: -1, leg: 6 }), 'item_bat_leg_0')
    expect(layerPaletteIndexOf(다리6, 0, 0)).toBe(5)
    const 다리10 = 겹(batterLayersOf(4, 0, { head: -1, hand: -1, leg: 10 }), 'item_bat_leg_7')
    expect(layerPaletteIndexOf(다리10, 1, 14)).toBe(2)
  })

  it('⚠️ 등급 줄 0 은 진짜 0번 벌이다 — null 로 새면 안 된다 (baked 가 null 이라 줄 0 도 갈아 끼운다)', () => {
    const 손2 = 겹(batterLayersOf(4, 0, { head: -1, hand: 2, leg: -1 }), 'item_bat_hand/')
    expect(손2.gradePaletteRow).toBe(0)
    expect(layerPaletteIndexOf(손2, 2, 7)).toBe(0)
    const 다리1 = 겹(batterLayersOf(4, 0, { head: -1, hand: -1, leg: 1 }), 'item_bat_leg_0')
    expect(layerPaletteIndexOf(다리1, 2, 7)).toBe(0)
    const 다리8 = 겹(batterLayersOf(4, 0, { head: -1, hand: -1, leg: 8 }), 'item_bat_leg_7')
    expect(layerPaletteIndexOf(다리8, 2, 7)).toBe(0)
  })

  it('줄이 없는 등급(손 0·1 · 다리 0·7)과 그림자·기본 배트는 구운 색 그대로다', () => {
    const 손1 = 겹(batterLayersOf(4, 0, { head: -1, hand: 1, leg: -1 }), 'item_bat_hand/')
    expect(layerPaletteIndexOf(손1, 2, 7)).toBeNull()
    const 다리0 = 겹(batterLayersOf(4, 0, { head: -1, hand: -1, leg: 0 }), 'item_bat_leg_0')
    expect(layerPaletteIndexOf(다리0, 2, 7)).toBeNull()
    const 다리7 = 겹(batterLayersOf(4, 0, { head: -1, hand: -1, leg: 7 }), 'item_bat_leg_7')
    expect(layerPaletteIndexOf(다리7, 2, 7)).toBeNull()
    expect(layerPaletteIndexOf(겹(batterLayersOf(4, 0), 'batter_shadow'), 2, 7)).toBeNull()
    expect(layerPaletteIndexOf(겹(batterLayersOf(4, 0), 'batter_batter'), 2, 7)).toBeNull()
  })

  it('몸통은 피부×15+팀, 헬멧은 팀 — 장비 줄이 이 길을 가로채지 않는다', () => {
    const layers = batterLayersOf(4, 0, { head: -1, hand: 4, leg: 6 })
    expect(layerPaletteIndexOf(겹(layers, 'batter_balancer'), 2, 7)).toBe(37)
    expect(layerPaletteIndexOf(겹(layers, 'batter_helmet'), 2, 7)).toBe(7)
  })
})

describe('타자 폼 → 몸통 종류 t = 폼 >> 1 (0x78ab0)', () => {
  it('니블 0·1(타격형 우타·좌타)은 balancer, 2·3(장타형)은 sluger 다', () => {
    expect([0, 1, 2, 3].map(bodyTypeOf)).toEqual([0, 0, 1, 1])
  })

  it('장타형 폼을 주면 몸통 폴더가 sluger 로 바뀐다', () => {
    expect(파일(batterLayersOf(0, bodyTypeOf(2)))[1]).toBe('batter_sluger:0')
    expect(파일(batterLayersOf(0, bodyTypeOf(0)))[1]).toBe('batter_balancer:0')
  })

  it('장타형은 자세표도 갈린다 — 대기 다섯 칸 · 번트 12', () => {
    expect(batterFrameAt({ tick: 16, swingTick: null, isBunting: false, bodyType: bodyTypeOf(3) })).toBe(4)
    expect(batterFrameAt({ tick: 0, swingTick: null, isBunting: true, bodyType: bodyTypeOf(3) })).toBe(12)
  })
})
