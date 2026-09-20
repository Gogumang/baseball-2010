import { describe, expect, it } from 'vitest'
import { applyPlayerOutcome, startGame } from '@/features/play-game/model/gameFlow'
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
    const progress = startGame(씨앗(20100901))
    const 돌발없음 = { ...progress, burst: progress.burst === null ? null : { ...progress.burst, current: null } }

    const after = applyPlayerOutcome(돌발없음, { kind: '삼진' }, 씨앗(3))

    expect(after.lastBurstResolution).toBeNull()
  })
})
