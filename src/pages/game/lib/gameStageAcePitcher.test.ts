import { describe, expect, it } from 'vitest'
import { startGame } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { ACE_PITCHER_SLOT } from '@/features/play-game/model/gameAces'
import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { gameStageAcePitcherOf } from '@/pages/game/lib/gameStageAcePitcher'

/**
 * 나리 타자편 마운드 그림 — 타석 교대 0x47cc8 482d4~482da 가 0xb63a0(투수)(마선수면 순번, 아니면 −1)를 적재 0x793b0 에 넘기고
 * 793c2 `cmp r6, #0 ; blt 79454` 가 순번 ≥ 0 이면 점프표 0xd3d64 의 ace/pitcher_*.pzx 를 연다 (r229 사용자 보고: 마투수가 일반 투수 그림으로 던졌다)
 */
describe('나리 타자편 마운드 마투수 그림 — 0x793b0 의 마투수 갈래(+0x3d ≥ 0)', () => {
  const 시작 = startGame(createSeededRandom(1), 0, 9, 3)

  it('142 가 상대 명부 8번 칸에 넣은 마투수가 마운드에 서면 그 마투수 그림(ace 프레임 · 순번)을 쓴다', () => {
    ACE_PITCHERS.forEach((ace, k) => {
      const progress: GameProgress = {
        ...시작,
        aceOpponent: null,
        aces: { ours: { batter: -1, pitcher: -1 }, opponent: { batter: -1, pitcher: k } },
        opponentMound: { ...시작.opponentMound, pitcherSlot: ACE_PITCHER_SLOT },
      }
      const frames = gameStageAcePitcherOf(progress)
      expect(frames).not.toBeNull()
      expect(frames?.order).toBe(k)
      expect(frames?.framesUrl).toBe(ace.framesUrl)
      expect(frames?.framesUrl).toMatch(/pitcher_/)
    })
  })

  it('마투수를 들었어도 8번 칸이 아닌 평범한 투수가 서 있으면 평범한 투수 그림(null)', () => {
    const progress: GameProgress = {
      ...시작,
      aceOpponent: null,
      aces: { ours: { batter: -1, pitcher: -1 }, opponent: { batter: -1, pitcher: 0 } },
    }
    expect(progress.opponentMound.pitcherSlot).not.toBe(ACE_PITCHER_SLOT)
    expect(gameStageAcePitcherOf(progress)).toBeNull()
  })

  it('마선수 대결 투수(aceOpponent)는 예전처럼 그 마투수 그림', () => {
    expect(gameStageAcePitcherOf({ ...시작, aceOpponent: ACE_PITCHERS[1]! })?.order).toBe(1)
  })
})
