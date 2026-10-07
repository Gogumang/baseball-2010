import { describe, expect, it } from 'vitest'
import {
  screenEffectCommandOf,
  screenEffectFrameAt,
  screenEffectsIn,
  SHAKE_OFFSETS,
} from '@/entities/story/model/screenEffect'

describe('명령 5 화면효과 id (0x8ceac · 점프표 0xd4ea4)', () => {
  it('1 진동만 · 2 진동 + 흔들기 · 3 흔들기 · 4 어두워짐 · 5 흰 덮개 · 6 검정에서 밝아짐 · 7 흰색에서 밝아짐', () => {
    expect(screenEffectCommandOf(1)).toEqual({ vibrationMilliseconds: 500, kind: null, color: '검정' })
    expect(screenEffectCommandOf(2)).toEqual({ vibrationMilliseconds: 500, kind: '흔들기', color: '검정' })
    expect(screenEffectCommandOf(3)?.kind).toBe('흔들기')
    expect(screenEffectCommandOf(4)?.kind).toBe('검게어두워짐')
    expect(screenEffectCommandOf(5)).toEqual({ vibrationMilliseconds: 0, kind: '색으로덮임', color: '흰색' })
    expect(screenEffectCommandOf(6)?.kind).toBe('검정에서밝아짐')
    expect(screenEffectCommandOf(7)).toEqual({ vibrationMilliseconds: 0, kind: '색에서밝아짐', color: '흰색' })
  })

  it('1~7 밖은 아무것도 안 한다 (0x8ceba bhi)', () => {
    expect(screenEffectCommandOf(0)).toBeNull()
    expect(screenEffectCommandOf(8)).toBeNull()
  })
})

describe('효과기 그리기 0xbd844 — 프레임마다 단계', () => {
  it('흔들기는 표 0xd8c4c 여섯 칸을 한 프레임씩, 그다음 비운다', () => {
    const 오프셋 = Array.from({ length: 6 }, (_unused, frame) => screenEffectFrameAt('흔들기', '검정', frame)?.offset)
    expect(오프셋).toEqual(SHAKE_OFFSETS.map(([x, y]) => ({ x, y })))
    expect(screenEffectFrameAt('흔들기', '검정', 6)).toBeNull()
  })

  it('검정에서 밝아짐은 16,14,…,0 아홉 프레임', () => {
    const 단계 = Array.from({ length: 9 }, (_unused, frame) => screenEffectFrameAt('검정에서밝아짐', '검정', frame)?.overlay?.level)
    expect(단계).toEqual([16, 14, 12, 10, 8, 6, 4, 2, 0])
    expect(screenEffectFrameAt('검정에서밝아짐', '검정', 9)).toBeNull()
  })

  it('검게 어두워짐은 0,2,…,16 아홉 프레임 뒤 비운다 — 어둠이 남지 않는다 (0xbd85e)', () => {
    const 단계 = Array.from({ length: 9 }, (_unused, frame) => screenEffectFrameAt('검게어두워짐', '검정', frame)?.overlay?.level)
    expect(단계).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16])
    expect(screenEffectFrameAt('검게어두워짐', '검정', 9)).toBeNull()
  })
})

describe('덮개 불투명도 — 검정 덮기 [0x15605d4] · 색 덮기 [0x15605d0]', () => {
  it('종류 1(검정에서밝아짐)은 검정 덮기라 16 은 안 칠하고 0 에서 완전 검정 — 실제로는 어두워진다(원본 그대로)', () => {
    const 진하기 = Array.from({ length: 9 }, (_unused, frame) => screenEffectFrameAt('검정에서밝아짐', '검정', frame)?.overlay?.opacity)
    expect(진하기).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16].map((n) => n / 16))
  })

  it('종류 2(검게어두워짐)는 완전 검정에서 시작해 16 에서 안 칠한다', () => {
    const 진하기 = Array.from({ length: 9 }, (_unused, frame) => screenEffectFrameAt('검게어두워짐', '검정', frame)?.overlay?.opacity)
    expect(진하기).toEqual([16, 14, 12, 10, 8, 6, 4, 2, 0].map((n) => n / 16))
  })

  it('종류 3·4 는 색 덮기 — 색 몫 (단계 + 1)/16, 16 은 안 칠한다', () => {
    const 덮임 = Array.from({ length: 9 }, (_unused, frame) => screenEffectFrameAt('색으로덮임', '흰색', frame)?.overlay)
    expect(덮임[0]).toEqual({ color: '흰색', level: 0, opacity: 1 / 16 })
    expect(덮임[7]?.opacity).toBe(15 / 16)
    expect(덮임[8]?.opacity).toBe(0)
    expect(screenEffectFrameAt('색에서밝아짐', '흰색', 1)?.overlay?.opacity).toBe(15 / 16)
  })
})

describe('지나온 명령에서 풀기', () => {
  it('진동은 모두 울리고 효과기는 마지막 것만 남는다', () => {
    const 결과 = screenEffectsIn([
      { op: 'effect', id: 2 },
      { op: 'sound', id: 3 },
      { op: 'effect', id: 4 },
      { op: 'effect', id: 1 },
    ])
    expect(결과.vibrations).toEqual([500, 500])
    expect(결과.last).toEqual({ kind: '검게어두워짐', color: '검정' })
  })
})
