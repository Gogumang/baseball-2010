import { describe, expect, it } from 'vitest'
import { createRunner, type RunnerState } from '@/entities/fielding/model/fieldingState'
import { countsAsAtBat } from '@/entities/at-bat/model/atBatOutcome'
import {
  creditedBasesOf,
  isBattedBallKind,
  isSacrificeOf,
  settledBatterOutcomeOf,
} from '@/features/defense-play/model/playOutcome'

/** 판이 끝난 주자 — 출발 루 · 마지막으로 닿은 루(+0x8c) · 달려가던 루(+0x7c) · 아웃/득점 */
const 주자 = (
  index: number,
  fromBase: number,
  state: { readonly reached: number; readonly target?: number; readonly out?: boolean; readonly scored?: boolean },
): RunnerState => ({
  ...createRunner(index, fromBase, 300),
  startBase: state.reached,
  targetBase: state.target ?? state.reached,
  isOut: state.out === true,
  scored: state.scored === true,
})

const 기본 = { hitEvent: true, homeRunEvent: false, flyOut: false, outEvents: 0 }

describe('판 끝 정산 0xa8024 의 타자 갈래 (a8096 ~ a8266)', () => {
  it('사건 6(안타) 뒤 타자주자가 선 루(+0x8c)가 루타다', () => {
    expect(settledBatterOutcomeOf({ ...기본, runners: [주자(0, 0, { reached: 1 })] })).toEqual({ kind: '안타', bases: 1 })
    expect(settledBatterOutcomeOf({ ...기본, runners: [주자(0, 0, { reached: 2 })] })).toEqual({ kind: '안타', bases: 2 })
    expect(settledBatterOutcomeOf({ ...기본, runners: [주자(0, 0, { reached: 3 })] })).toEqual({ kind: '안타', bases: 3 })
  })

  it('판 안에서 홈을 밟은 타자주자(+0x8c = 4 — state[0x25] 그라운드 홈런)는 홈런이다', () => {
    expect(settledBatterOutcomeOf({ ...기본, runners: [주자(0, 0, { reached: 4, scored: true })] })).toEqual({ kind: '홈런' })
  })

  it('사건 8(담장 홈런 — 결과 코드 8 · 12)이 있으면 루타 4 다 (a8192)', () => {
    expect(
      settledBatterOutcomeOf({ ...기본, hitEvent: false, homeRunEvent: true, runners: [주자(0, 0, { reached: 0 })] }),
    ).toEqual({ kind: '홈런' })
  })

  it('사건 6 이 없으면(공이 땅·담장에 닿기 전에 잡힘) 안타가 아니다 — 뜬공 아웃', () => {
    expect(
      settledBatterOutcomeOf({
        ...기본,
        hitEvent: false,
        flyOut: true,
        outEvents: 1,
        runners: [주자(0, 0, { reached: 0, target: 1, out: true })],
      }),
    ).toEqual({ kind: '아웃', detail: '뜬공아웃' })
  })

  it('1루를 넘보지 않은 타자주자가 죽고 아웃 사건이 있으면 안타가 아니다 (a81f8) — 땅볼 아웃', () => {
    expect(
      settledBatterOutcomeOf({ ...기본, outEvents: 1, runners: [주자(0, 0, { reached: 0, target: 1, out: true })] }),
    ).toEqual({ kind: '아웃', detail: '땅볼아웃' })
  })

  it('1루를 넘보다 죽은 타자주자는 안타로 센다 — 루타 = 마지막으로 닿은 루 (a81d2 · a8210)', () => {
    // 1루를 밟고 2루로 가다 죽었다: +0x8c = 1 · +0x7c = 2
    expect(
      creditedBasesOf({ ...기본, outEvents: 1, runners: [주자(0, 0, { reached: 1, target: 2, out: true })] }),
    ).toBe(1)
    // 직전 목표(+0x84)가 2 였다가 1루로 되돌아온 판도 같다
    expect(
      creditedBasesOf({
        ...기본,
        outEvents: 1,
        runners: [주자(0, 0, { reached: 1, target: 1, out: true })],
        previousTargets: [2],
      }),
    ).toBe(1)
  })

  it('야수 선택 [sp+0x18] — 타자주자가 살았고 목록 i 번째 주자가 +0x7c == i + 1 로 죽었으면 안타가 아니다', () => {
    const 포스아웃 = [주자(0, 0, { reached: 1 }), 주자(1, 1, { reached: 1, target: 2, out: true })]
    expect(settledBatterOutcomeOf({ ...기본, outEvents: 1, runners: 포스아웃 })).toEqual({ kind: '아웃', detail: '땅볼아웃' })
    // ⚠️ 원본 그대로 목록 번호와 루를 견준다 — 2루 주자 혼자(i = 1) 3루에서 죽은 판은 야수 선택이 아니라 안타다
    const 이루주자 = [주자(0, 0, { reached: 1 }), 주자(1, 2, { reached: 2, target: 3, out: true })]
    expect(settledBatterOutcomeOf({ ...기본, outEvents: 1, runners: 이루주자 })).toEqual({ kind: '안타', bases: 1 })
  })

  it('맞은 공의 결과 꼴 — 안타 · 아웃 · 홈런만 판을 돈다', () => {
    expect(isBattedBallKind({ kind: '홈런' })).toBe(true)
    expect(isBattedBallKind({ kind: '아웃', detail: '땅볼아웃' })).toBe(true)
    expect(isBattedBallKind({ kind: '삼진' })).toBe(false)
    expect(isBattedBallKind({ kind: '사구' })).toBe(false)
  })
})

describe('타수를 안 세는 아웃 — 정산 a882e · 희생 [sp+8](칸은 투구 0xa5e14 가 세운다)', () => {
  /** 1루 주자(투구 때 1루)가 2루에 닿고 타자주자는 1루에서 죽은 땅볼 — 보내기 번트 꼴 */
  const 보내기 = [주자(0, 0, { reached: 0, target: 1, out: true }), 주자(1, 1, { reached: 2 })]

  it('주자가 투구 때 루를 비우고 타자만 죽으면 희생이다 — 타수에 안 든다', () => {
    const 결과 = settledBatterOutcomeOf({ ...기본, outEvents: 1, outsAfter: 1, runners: 보내기 })
    expect(isSacrificeOf({ ...기본, outEvents: 1, outsAfter: 1, runners: 보내기 })).toBe(true)
    expect(결과).toEqual({ kind: '아웃', detail: '땅볼아웃', noAtBat: true })
    expect(countsAsAtBat(결과)).toBe(false)
  })

  it('주자가 제자리면 희생이 아니다 — 칸[1] 을 그 주자의 +0x8c 가 지운다', () => {
    const 제자리 = [주자(0, 0, { reached: 0, target: 1, out: true }), 주자(1, 1, { reached: 1 })]
    expect(isSacrificeOf({ ...기본, outEvents: 1, outsAfter: 1, runners: 제자리 })).toBe(false)
    expect(countsAsAtBat(settledBatterOutcomeOf({ ...기본, outEvents: 1, outsAfter: 1, runners: 제자리 }))).toBe(true)
  })

  it('세 번째 아웃(state[6] > 2) · 공이 안 닿음(안타 사건 0) · 주자도 죽음 이면 희생이 아니다', () => {
    expect(isSacrificeOf({ ...기본, outEvents: 1, outsAfter: 3, runners: 보내기 })).toBe(false)
    expect(isSacrificeOf({ ...기본, hitEvent: false, flyOut: true, outEvents: 1, outsAfter: 1, runners: 보내기 })).toBe(false)
    const 병살 = [주자(0, 0, { reached: 0, target: 1, out: true }), 주자(1, 1, { reached: 1, target: 2, out: true })]
    expect(isSacrificeOf({ ...기본, outEvents: 2, outsAfter: 2, runners: 병살 })).toBe(false)
  })

  it('득점이 난 아웃(희생 뜬공 · 땅볼 타점)은 a882e 가 타수에서 뺀다', () => {
    const 뜬공 = [주자(0, 0, { reached: 0, target: 1, out: true }), 주자(1, 3, { reached: 4, scored: true })]
    const 결과 = settledBatterOutcomeOf({
      ...기본,
      hitEvent: false,
      flyOut: true,
      outEvents: 1,
      runsScored: 1,
      outsAfter: 1,
      runners: 뜬공,
    })
    expect(결과).toEqual({ kind: '아웃', detail: '뜬공아웃', noAtBat: true })
  })

  it('득점 없는 보통 아웃은 타수다', () => {
    const 결과 = settledBatterOutcomeOf({ ...기본, outEvents: 1, outsAfter: 1, runners: [주자(0, 0, { reached: 0, target: 1, out: true })] })
    expect(결과).toEqual({ kind: '아웃', detail: '땅볼아웃' })
    expect(countsAsAtBat(결과)).toBe(true)
  })
})
