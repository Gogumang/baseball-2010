import { describe, expect, it } from 'vitest'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { DEFENSE_SCENE_START } from '@/features/defense-play/model/defenseScene'
import { pickoff, resumeTeamGame, startTeamGame, type TeamGameOptions, type TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}
const 남김 = { ...DEFENSE_SCENE_START, fielderSlack: Array.from({ length: 9 }, () => 5) }

describe('팀 경기 — 판 사이 야수 +0xcc 를 넘겨받는다 (`DefenseScene.fielderSlack`, r196)', () => {
  it('파울 판이 남긴 5 를 사람 견제(vt20(0) — b28ca)가 들고 연다 · 판이 끝난 값을 다시 받는다', () => {
    const 시작 = startTeamGame(기본옵션, createSeededRandom(20100901))
    const 판: TeamGameProgress = { ...시작, game: { ...시작.game, bases: { first: true, second: false, third: false } } }
    const 그냥 = pickoff(판, '3', createSeededRandom(1))
    const 남은 = pickoff({ ...판, defenseScene: 남김 }, '3', createSeededRandom(1))
    expect(남은.lastDefensePlay?.ticks[0]?.fielders).not.toEqual(그냥.lastDefensePlay?.ticks[0]?.fielders)
    expect(남은.defenseScene?.fielderSlack).toEqual(Array.from({ length: 9 }, () => 0))
  })

  it('이어하기는 경기 장면을 새로 연다(상태 7 0x3e340) — 저장 블록에 야수가 없어 +0xcc 는 0 부터', () => {
    const 시작 = startTeamGame({ ...기본옵션, mode: 1 }, createSeededRandom(20100901))
    const 저장 = 시작.halfInningSave
    expect(저장).not.toBeNull()
    if (저장 == null) return
    const 이어 = resumeTeamGame({ ...저장, defenseScene: 남김 }, createSeededRandom(5))
    expect(이어.defenseScene?.fielderSlack ?? DEFENSE_SCENE_START.fielderSlack).not.toEqual(남김.fielderSlack)
  })
})
