import { describe, expect, it } from 'vitest'
import { batterFrameAt, batterLayersOf, bodyTypeOf } from '@/widgets/batting-stage/lib/batterLayers'

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
  it('규칙 0 (f=4): 그림자·몸통·헬멧·배트·몸통 앞(f+14)·다리 순서', () => {
    expect(파일(batterLayersOf(4, 0))).toEqual([
      'batter_shadow:4', 'batter_balancer:4', 'batter_helmet:4', 'batter_batter:4', 'batter_balancer:18', 'item_bat_leg_0:4',
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
      'batter_shadow:14', 'batter_sluger:0', 'batter_helmet:14', 'batter_batter:14', 'batter_sluger:13', 'item_bat_leg_0:14',
    ])
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
