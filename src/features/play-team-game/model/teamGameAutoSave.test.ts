import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import { MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import {
  applyBatterOutcome,
  isBatterTurn,
  startTeamGame,
} from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'

/** 상세 설정 — 타순 아홉 칸 모두 사람이 치고, 수비는 어느 이닝·주자도 안 잡는다(초 = 사람, 말 = 자동) */
const 공격만: TeamGameOptions = {
  mode: 1,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_FIRST_BAT,
  settings: {
    kind: MATCH_SETTING_KIND.상세,
    value: 0,
    battingOrderBits: 0x1ff,
    pitchingInningBits: 0,
    offenseRunnerBits: 0,
    defenseRunnerBits: 0,
  },
  liveAutoRelay: true,
}

describe('사람 반 이닝 뒤 자동 반 이닝 — 0x4f928 저장(4f990)이 0xc2198 자동 갈림(4fac2)보다 앞', () => {
  it('3아웃 → 0x18 → 저장 → 0x21: 중계에 들어서는 진행이 새 반 이닝 첫머리를 저장해 둔다', () => {
    const random = createSeededRandom(5)
    let progress: TeamGameProgress = startTeamGame(공격만, random)
    const first = progress.halfInningSave
    for (let step = 0; step < 50 && isBatterTurn(progress); step += 1) {
      progress = applyBatterOutcome(progress, { kind: '아웃', detail: '뜬공아웃' }, random)
    }
    expect(progress.autoRelay).toBeTruthy()
    const save = progress.halfInningSave
    expect(save).not.toBe(first)
    expect(save?.game.inning).toBe(1)
    expect(save?.game.half).toBe('말')
    expect(save?.game.outs).toBe(0)
    expect(save?.autoRelay ?? null).toBeNull()
    expect(save?.halfInningSave).toBeNull()
  })
})
