import { describe, expect, it } from 'vitest'
import { applyPlayerOutcome, arrivePitch, startGame, startSteal } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { BURST_TABLES } from '@/entities/burst-mission/model/burstMissionRow'
import { MAXIMUM_BURSTS_PER_GAME } from '@/entities/burst-mission/model/burstMissionSession'

/**
 * 돌발미션 결선 — 경기 진행기가 타석 준비에서 굴리고(0x8f158) 타석 끝에서 판정한다(0x8f414).
 * 표·판정·보상 자체는 `entities/burst-mission` 이 이미 못박아 두었으므로 여기서는 **연결**만 본다.
 */

const 씨앗 = (seed: number) => createSeededRandom(seed)

/**
 * 돌발이 발동할 때까지 씨앗을 바꿔 가며 경기를 세운다.
 * 씨앗 400개 중 14개에서 첫 타석에 뜬다 — 하나도 못 찾으면 연결이 끊긴 것이라 터뜨린다.
 */
function 돌발이_뜬_경기(): GameProgress {
  for (let seed = 1; seed <= 400; seed += 1) {
    const progress = startGame(씨앗(seed))
    if (progress.burst?.current != null) return progress
  }
  throw new Error('씨앗 400개에서 돌발이 한 번도 안 떴습니다 — 발동 연결을 확인하세요')
}

describe('경기 진행기와 돌발미션', () => {
  it('나만의리그 타자편은 모드 4 라 돌발 객체를 만든다 — 표는 BATTER 다', () => {
    const progress = startGame(씨앗(20100901))

    expect(progress.burst).not.toBeNull()
    expect(progress.burst?.table).toBe('BATTER')
    expect(progress.burst?.maximumTriggers).toBe(MAXIMUM_BURSTS_PER_GAME)
  })

  it('발동한 행은 BATTER 표의 행이고 발동 횟수가 하나 오른다', () => {
    const progress = 돌발이_뜬_경기()

    expect(BURST_TABLES.BATTER).toContain(progress.burst?.current)
    expect(progress.burst?.triggeredCount).toBe(1)
  })

  it('타석이 끝나면 판정이 나고 돌발이 내려간다 — 보상 변화량이 함께 나온다', () => {
    const progress = 돌발이_뜬_경기()

    const after = applyPlayerOutcome(progress, { kind: '홈런' }, 씨앗(7))

    // 홈런 비트(0x001)·타점(0x010)·출루(0x020)가 서므로 어떤 목표든 판정이 난다
    expect(after.lastBurstResolution?.judgement).not.toBeNull()
    expect(after.burst?.current).toBeNull()
    // 경기당 한 번이라 다시 뜨지 않는다 (obj+0x229 == 1)
    expect(after.burst?.triggeredCount).toBe(MAXIMUM_BURSTS_PER_GAME)
  })

  it('돌발이 없던 타석은 판정도 없다', () => {
    // 이 테스트가 보려는 것은 **뜬 돌발이 없으면 판정도 없다** 이다.
    // 씨앗 운을 타지 않게 상태로 못 박는다 — 예전에는 씨앗 하나에 기대고 있어 60개 중 42개에서
    // 깨졌다(선발을 로테이션으로 바꾸며 난수 스트림이 밀리자 드러났다). 이 타석에서 새 돌발이
    // 뜨면 그 자리에서 판정이 날 수 있으므로, 경기당 한 번(obj+0x229)을 이미 써 버린 상태로
    // 두어 새로 뜨지 못하게 하고, `startGame` 이 동료 타석에서 남긴 판정도 지운다.
    const progress = startGame(씨앗(20100901))
    const 돌발없음 = {
      ...progress,
      burst:
        progress.burst === null
          ? null
          : { ...progress.burst, current: null, triggeredCount: MAXIMUM_BURSTS_PER_GAME },
      lastBurstResolution: null,
    }

    const after = applyPlayerOutcome(돌발없음, { kind: '삼진' }, 씨앗(3))

    expect(after.lastBurstResolution).toBeNull()
  })
})

describe('굴리는 타석은 내 타석뿐 — 동료·상대 타석은 자동진행(0x21)이다', () => {
  /**
   * 0x8f158 을 부르는 곳은 메시지 1 의 인자 0xe 갈래(0x50c42) 한 곳이고, 판정 0x8f414 는 사람 장면의 0x12·0x17 끝뿐이다.
   * 모드 4 는 0xc1ed6 이 "공격 팀 지금 타자가 내 선수인가" 만 보므로 동료·상대 타석은 늘 0x21 — 굴림도 판정도 없다.
   * 예전 웹은 K 4절 1-6 "매 타석 시작 때" 를 동료·상대 타석까지로 읽어 거기서도 굴렸다.
   */
  const 내차례 = (seed: number) => {
    const progress = startGame(씨앗(seed))
    return { ...progress, burst: progress.burst === null ? null : { ...progress.burst, current: null } }
  }

  it('자동 타석은 돌발 상태와 상관없이 같은 난수를 먹는다 — 발동을 이미 썼든 안 썼든 경기가 같게 흐른다', () => {
    for (const seed of [1, 2, 3, 42, 777, 20100901]) {
      const 남음 = 내차례(seed)
      const 씀 = {
        ...남음,
        burst: 남음.burst === null ? null : { ...남음.burst, triggeredCount: MAXIMUM_BURSTS_PER_GAME },
      }

      // 내 타석 → (동료·상대 자동 타석) → 다음 내 타석 준비. 굴림은 맨 끝 내 타석 준비에서만 갈린다
      const 가 = applyPlayerOutcome(남음, { kind: '삼진' }, 씨앗(seed + 100))
      const 나 = applyPlayerOutcome(씀, { kind: '삼진' }, 씨앗(seed + 100))

      expect(가.game, `씨앗 ${seed}`).toEqual(나.game)
      expect(가.log, `씨앗 ${seed}`).toEqual(나.log)
    }
  })

  it('발동은 늘 내 타석 준비에서 난다 — 뜬 채로 내 타석에 돌려준다', () => {
    let 뜬경기 = 0
    for (let seed = 1; seed <= 40; seed += 1) {
      let progress = startGame(씨앗(seed))
      const random = 씨앗(seed + 1)
      for (let step = 0; step < 200 && !progress.game.isFinished; step += 1) {
        if ((progress.burst?.triggeredCount ?? 0) > 0) break
        progress = applyPlayerOutcome(progress, { kind: '삼진' }, random)
      }
      if ((progress.burst?.triggeredCount ?? 0) === 0) continue
      뜬경기 += 1
      // 자동 타석에서 떴다면 거기서 판정되거나 0x21 진입에서 내려가 비어 있었을 것이다
      expect(progress.burst?.current, `씨앗 ${seed}`).not.toBeNull()
    }

    expect(뜬경기).toBeGreaterThan(0)
  })

  it('내 타석에서 판정을 못 받고 남은 돌발은 다음 자동 타석 앞(0x21 진입 0x8f628)에서 판정 없이 내려간다', () => {
    const progress = 내차례(20100901)
    const 행 = BURST_TABLES.BATTER[0]
    // 목표 5 는 점프표 칸만 있고 판정을 안 한다 — 결과비트가 무엇이든 남는다 (0x8f414)
    const 남는돌발 = {
      ...progress,
      burst: progress.burst === null ? null : { ...progress.burst, current: { ...행, goal: 5 }, triggeredCount: 1 },
      lastBurstResolution: null,
    }

    const after = applyPlayerOutcome(남는돌발, { kind: '삼진' }, 씨앗(3))

    expect(after.burst?.current).toBeNull()
    expect(after.burst?.judgement).toBeNull()
    // 발동 횟수는 그대로라 이 경기에서는 다시 안 뜬다
    expect(after.burst?.triggeredCount).toBe(MAXIMUM_BURSTS_PER_GAME)
    expect(after.lastBurstResolution).toBeNull()
  })
})

describe('판정이 새지 않는가', () => {
  it('내 타석에서 판정이 안 나도 **앞서 난 판정을 지우지 않는다**', () => {
    const progress = startGame(씨앗(20100901))
    // 동료·상대 타석에서 난 판정이 아직 화면에 안 뜬 상태를 흉내 낸다
    const 대기중 = {
      ...progress,
      burst: progress.burst === null ? null : { ...progress.burst, current: null },
      lastBurstResolution: { session: progress.burst!, row: null, judgement: '성공', deltas: [] } as never,
    }

    const after = applyPlayerOutcome(대기중, { kind: '삼진' }, 씨앗(3))

    expect(after.lastBurstResolution).not.toBeNull()
  })
})

describe('도루 (0x53610 → 0xa9bd4 출발 · 공 도착 0x3dfac 의 종류 5 판)', () => {
  const 주자있는경기 = () => {
    const progress = startGame(씨앗(20100901))
    return {
      ...progress,
      game: { ...progress.game, bases: { first: true, second: false, third: false }, outs: 0 },
    }
  }

  it('출발한 주자는 공이 도착해야 판정된다 — 판이 열리면 1루가 빈다', () => {
    const before = startSteal(주자있는경기(), 1)
    const 결과들 = Array.from({ length: 10 }, (_unused, seed) =>
      arrivePitch(before, { resolution: { kind: '볼' }, outcomeAfter: null }, 씨앗(seed + 1)),
    )
    for (const { progress, play } of 결과들) {
      if (play === null) continue
      expect(progress.game.bases.first, '도루 주자는 1루를 떠났다').toBe(false)
    }
    expect(결과들.some(({ play }) => play?.kind === 5)).toBe(true)
  })

  it('앞 루가 차 있으면 걸지 않는다', () => {
    const 막힘 = { ...주자있는경기() }
    const before = { ...막힘, game: { ...막힘.game, bases: { first: true, second: true, third: false } } }

    expect(startSteal(before, 1)).toBe(before)
  })

  it('주자가 없으면 아무 일도 없다', () => {
    const before = startGame(씨앗(20100901))

    expect(startSteal(before, 2)).toBe(before)
  })
})
