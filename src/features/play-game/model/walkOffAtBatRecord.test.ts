import { describe, expect, it } from 'vitest'
import {
  applyPlayerOutcome,
  resolveDefensePlay,
  startGame,
  startPlayerOutcome,
  summaryOf,
} from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { nariRecordLineOf } from '@/entities/career/model/playerCareer'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { BaseState } from '@/entities/game/model/baseState'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * **끝내기 타석도 기록에 든다** (r177 플레이 점검 "9회말 끝내기 2점인데 평가가 4타수 0안타 0타점" 조사, r188).
 *
 * 원본 차례 (직접 떴다):
 * ```
 * 판정 B 0xae3e8  ae3fa 0xb68fc(경기 끝) 참 → ae55c 다음 상태 0x18 → ae5b2 정산 0xa8024 를 부른다   ; 끝내기 판도 정산한다
 * 정산 0xa8024    a8512 0xa57f8(R, 0, 루타−1) → R+0xb4+4·(루타−1)  ; 안타 (홈런은 R+0xc0)
 *                 a889c 0xa57f8(R, 8) → R+0xec                     ; 타수 (a882e~a884c 의 타수 없는 갈래 밖)
 *                 a8946 state[0x11](맞힌 공) · 볼 4개 · state[0x12](사구) 이면 a8994 0xa57f8(R, 0xe, 득점) → R+0x104 ; 타점
 *                 (0xa57f8 a5818~a584c — 코드 ≤ 0x13 은 0xa56dc(R, 공격 팀 지금 타자, 1) 참일 때만 · 포스트시즌이면 거짓)
 * 정산 진입 0x4ea0c(상태 0x19) 4f268 → 평가 0xa719c 모드 4 a71d0~a7222:
 *                 S+0x1d8 = [R+0xec 타수, ΣR+0xb4..+0xc0 안타, R+0x104 타점, R+0xc0 홈런]  ; 116 줄 "N타수 N안타 N타점"
 * ```
 * 곧 끝내기 타석은 경기 끝(0x18)보다 **먼저** 정산돼 116 기록 줄에 든다. 웹도 `finishPlayerOutcome` 이 정산(`recordBatterAtBat`)을
 * 마친 뒤 경기를 닫으므로 이 경기 성적(`summaryOf().stats` → `nariRecordLineOf`)에 든다.
 * "0안타"가 정상인 끝내기는 득점 + 아웃 판(a882e 타수 없음 · 안타 아님 · 타점은 듦)과 볼넷 · 사구다. 실책(펌블)으로 산 타자는
 * 원본에 실책 갈래가 없어 안타다(a81a6~a8210 — 안타 사건 + 산 타자주자).
 * 포스트시즌 경기는 평가 0xa719c 를 안 돌아(0x4f268) 116 이 **앞 평가 경기 줄**을 띄운다 — 원본 그대로(`useCareerSession.finishGame`).
 */

const 기록줄 = (progress: GameProgress) => nariRecordLineOf(summaryOf(progress).stats)

/** 9회말 · 내 타석 · 후공 — 루 · 아웃 · 점수만 갈아 끼운다 */
function 끝내기판(options: { readonly bases: BaseState; readonly outs: number; readonly ourScore: number; readonly opponentScore: number }): GameProgress {
  const progress = startGame(createSeededRandom(7))
  const { first, second, third } = options.bases
  return {
    ...progress,
    game: {
      ...progress.game,
      inning: 9,
      half: '말',
      outs: options.outs,
      ourScore: options.ourScore,
      opponentScore: options.opponentScore,
      bases: options.bases,
      runners: { first: first ? 6 : null, second: second ? 5 : null, third: third ? 4 : null },
    },
  }
}

/** 타구를 판으로 끝까지 돌려 먹인다 — 화면이 판을 다 돌리고 `resolveDefensePlay` 를 부르는 길 그대로 */
function 타구를친다(progress: GameProgress, pattern: BattedBallPattern, random: RandomPort, outcome: AtBatOutcome) {
  const started = startPlayerOutcome(progress, outcome, random, { pattern })
  expect(started.pendingDefensePlay).not.toBeNull()
  const played = runDefensePlay(started.pendingDefensePlay!)
  return { played, finished: resolveDefensePlay(started, played, random) }
}

const 차례난수 = (values: readonly number[]): RandomPort => {
  let index = 0
  return createFractionRandom(() => values[Math.min(index++, values.length - 1)]!)
}

/** 2루수 땅볼 (runDefensePlay 시험의 `이루수땅볼`) — 펌블 · 아웃 굴림을 차례난수로 고른다 */
const 이루수땅볼: BattedBallPattern = [70, 1000, 202, 0]

describe('끝내기 타석의 기록 — 정산 0xa8024 가 경기 끝(0x18) 앞에 돈다 (0xae3e8 ae55c → ae5b2)', () => {
  it('끝내기 홈런 — 타수 · 안타 · 홈런 · 타점(홈런 주자 모두)이 이 경기 줄에 든다', () => {
    const 판 = 끝내기판({ bases: { first: false, second: false, third: false }, outs: 1, ourScore: 3, opponentScore: 3 })
    const pattern = BATTED_BALL_PATTERNS[24]![0]!
    const { played, finished } = 타구를친다(판, pattern, createSeededRandom(11), { kind: '홈런' })

    expect(played.outcome).toEqual({ kind: '홈런' })
    expect(finished.game.isFinished).toBe(true)
    expect(finished.game.ourScore).toBe(4)
    expect(기록줄(finished)).toEqual({ atBats: 1, hits: 1, runsBattedIn: 1, homeRuns: 1 })
  })

  it('끝내기 안타 — 2 · 3루 주자 둘이 들어온 2점 끝내기도 1타수 1안타 2타점이다', () => {
    const 판 = 끝내기판({ bases: { first: false, second: true, third: true }, outs: 1, ourScore: 2, opponentScore: 3 })
    // 원본 패턴 덱 코드 9 의 46번째 — 이 판에서 2루타로 끝난다
    const pattern = BATTED_BALL_PATTERNS[9]![45]!
    const { played, finished } = 타구를친다(판, pattern, createSeededRandom(11), { kind: '안타', bases: 1 })

    expect(played.outcome).toEqual({ kind: '안타', bases: 2 })
    expect(played.advance.runsScored).toBe(2)
    expect(finished.game.isFinished).toBe(true)
    expect(finished.game.ourScore).toBeGreaterThan(finished.game.opponentScore)
    expect(기록줄(finished)).toEqual({ atBats: 1, hits: 1, runsBattedIn: 2, homeRuns: 0 })
  })

  it('끝내기 볼넷 — 타수 · 안타는 없고 타점 1 (a8946 볼 4개 갈래)', () => {
    const 판 = 끝내기판({ bases: { first: true, second: true, third: true }, outs: 2, ourScore: 3, opponentScore: 3 })
    const finished = applyPlayerOutcome(판, { kind: '볼넷' }, createSeededRandom(11))

    expect(finished.game.isFinished).toBe(true)
    expect(finished.myStats.walks).toBe(1)
    expect(finished.myStats.plateAppearances).toBe(1)
    expect(기록줄(finished)).toEqual({ atBats: 0, hits: 0, runsBattedIn: 1, homeRuns: 0 })
  })

  it('끝내기 사구 — 타수 · 안타는 없고 타점 1 (a8946 state[0x12] 갈래). 벤치 클리어링을 지나도 같다', () => {
    const 판 = 끝내기판({ bases: { first: true, second: true, third: true }, outs: 0, ourScore: 5, opponentScore: 5 })
    for (const seed of [1, 2, 3, 4, 5]) {
      const finished = applyPlayerOutcome(판, { kind: '사구' }, createSeededRandom(seed))

      expect(finished.game.isFinished).toBe(true)
      expect(finished.myStats.plateAppearances).toBe(1)
      expect(기록줄(finished)).toEqual({ atBats: 0, hits: 0, runsBattedIn: 1, homeRuns: 0 })
    }
  })

  it('끝내기 실책(펌블) — 원본에는 실책 갈래가 없어 산 타자는 안타다 (a81a6~a8210: 안타 사건 + 산 타자주자)', () => {
    const 판 = 끝내기판({ bases: { first: false, second: false, third: true }, outs: 0, ourScore: 3, opponentScore: 3 })
    // 굴림 차례: 필살수비 A · B 실패 → 펌블 성공(0) → 0xb3148 튕김 (레이저 굴림은 외야수만 — 0x523e6, r201 에서 하나 빠졌다)
    const { played, finished } = 타구를친다(판, 이루수땅볼, 차례난수([0.9, 0.9, 0, 0.9]), { kind: '아웃', detail: '땅볼아웃' })

    expect(played.fumbled).toBe(true)
    expect(played.outcome).toEqual({ kind: '안타', bases: 1 })
    expect(finished.game.isFinished).toBe(true)
    expect(기록줄(finished)).toEqual({ atBats: 1, hits: 1, runsBattedIn: 1, homeRuns: 0 })
  })

  it('끝내기 땅볼(득점 + 아웃) — 타수에 안 들고(a882e) 안타 0 · 타점 1 — "0안타" 가 정상인 끝내기', () => {
    const 판 = 끝내기판({ bases: { first: false, second: false, third: true }, outs: 0, ourScore: 3, opponentScore: 3 })
    // 펌블 없이 1루 아웃 — 3루 주자는 들어온다 (필살수비 A · B · 펌블 실패 — 레이저 굴림은 외야수만, 0x523e6 · r201)
    const { played, finished } = 타구를친다(판, 이루수땅볼, 차례난수([0.9, 0.9, 0.9]), { kind: '아웃', detail: '땅볼아웃' })

    expect(played.advance.runsScored).toBe(1)
    expect(played.advance.outsAdded).toBe(1)
    expect(played.outcome).toEqual({ kind: '아웃', detail: '땅볼아웃', noAtBat: true })
    expect(finished.game.isFinished).toBe(true)
    expect(finished.myStats.plateAppearances).toBe(1)
    expect(기록줄(finished)).toEqual({ atBats: 0, hits: 0, runsBattedIn: 1, homeRuns: 0 })
  })
})
