import { afterEach, describe, expect, it } from 'vitest'
import { startGame } from '@/features/play-game/model/gameFlow'
import { gatedOffenseRecords } from '@/features/play-game/model/gameFlow/records/gameRecords'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { playOpponentInning } from '@/features/play-game/model/gameFlow/autoPlay/opponentInning'
import { playTeammateAtBat } from '@/features/play-game/model/gameFlow/autoPlay/teammateAtBat'
import { ourHalfOf } from '@/entities/game/model/gameState'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { OWN_POSITION_RECORDS_BUGFIX_ID, isDefenseSideRecord } from '@/entities/game/model/ownPositionRecords'

/**
 * 나만의 타자(모드 4)의 삼진 계열 기록 16~23 · 삼구 삼자범퇴 25 가 **어느 반 이닝**에서 나는지 (r357).
 *
 * 원본: 지급 0xa77f0 은 선수가 아니라 **팀** 의 조작 칸 state[0x31 + 팀] 을 본다(a785e 공격 · a78bc 수비).
 * 경기 준비 0x39fdc 의 모드 3·4 갈래(점프표 0xcfef8 → 0x3a0e8)가 a20a~a21e 에서 **내 팀 측 = 0(사람)**,
 * 상대 측 = 1(CPU) 로 경기 내내 고정한다 → 우리 팀이 수비하는 반 이닝(동료 CPU 투수, 간이 엔진 0xc1818 · 0xc15a4 →
 * 0xa7c4c · 0xa8024 → 0xa7998)에서 a78bc(수비 팀 사람) 가 참이 되어 16~31 이 들어간다. 공격 반 이닝(내 타석 · 동료 타석)
 * 은 a785e 갈래가 k ≤ 15 · 32~39 만 받아 16~25 를 막는다.
 */
const 삼진계열 = (id: number): boolean => id >= 16 && id <= 25

interface 반이닝기록 {
  readonly 수비: number[]
  readonly 공격: number[]
  readonly 점수: readonly [number, number]
}

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 반 이닝을 손으로 돌려(우리 공격은 모든 타석을 간이 엔진으로) 새로 붙은 기록을 그 반 이닝 편에 적는다 */
function 반이닝별기록(seed: number): 반이닝기록 {
  const random = createSeededRandom(seed)
  let progress: GameProgress = startGame(random)
  const 수비: number[] = []
  const 공격: number[] = []
  for (let guard = 0; guard < 400 && !progress.game.isFinished; guard += 1) {
    const before = progress.recordIds.length
    const 우리공격 = progress.game.half === ourHalfOf(progress.game)
    progress = 우리공격 ? playTeammateAtBat(progress, random) : playOpponentInning(progress, random)
    ;(우리공격 ? 공격 : 수비).push(...progress.recordIds.slice(before))
  }
  return { 수비, 공격, 점수: [progress.game.ourScore, progress.game.opponentScore] }
}

describe('나만의 타자 — 삼진 계열 기록은 우리 팀이 수비하는 반 이닝에서 난다 (원본 0xa77f0 팀 게이트)', () => {
  it('여러 시드에서 16~25 는 모두 상대 공격(우리 수비) 반 이닝에서 나고, 우리 공격 반 이닝에서는 하나도 안 난다', () => {
    const 수비전체: number[] = []
    const 공격전체: number[] = []
    for (let seed = 1; seed <= 40; seed += 1) {
      const 기록 = 반이닝별기록(seed)
      수비전체.push(...기록.수비.filter(삼진계열))
      공격전체.push(...기록.공격.filter(삼진계열))
    }
    expect(공격전체).toEqual([])
    expect(수비전체).toContain(16)
    expect(new Set(수비전체).size).toBeGreaterThan(1)
  })

  it('공격 반 이닝(내 타석 · 동료 타석) 기록 거름은 16~25 를 모두 막는다 — a785e: 공격 팀 사람이면 k ≤ 15 · 32~39 만', () => {
    const 삼진계열번호 = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
    expect(gatedOffenseRecords(삼진계열번호)).toEqual([])
  })
})

describe('B-129 고친 길 — 나만의 타자는 자기 포지션(공격 쪽) 기록만 받는다', () => {
  it('우리 수비 반 이닝의 수비 쪽 기록(16~31 · 36)이 0 이고, 공격 기록 · 점수(굴림 차례)는 원본 길과 같다', () => {
    let 원본수비 = 0
    for (let seed = 1; seed <= 40; seed += 1) {
      const 원본 = 반이닝별기록(seed)
      setBugfixConfigForTests(bugfixConfigWith([OWN_POSITION_RECORDS_BUGFIX_ID]))
      const 고침 = 반이닝별기록(seed)
      setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG)

      원본수비 += 원본.수비.filter(isDefenseSideRecord).length
      expect(고침.수비.filter(isDefenseSideRecord), String(seed)).toEqual([])
      expect(고침.공격, String(seed)).toEqual(원본.공격)
      expect(고침.점수, String(seed)).toEqual(원본.점수)
    }
    // 원본 길에서는 같은 시드들이 수비 쪽 기록을 실제로 냈다 — 거를 것이 있었다
    expect(원본수비).toBeGreaterThan(0)
  })
})
