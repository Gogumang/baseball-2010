import { describe, expect, it } from 'vitest'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { TEAM_GAME_MODE, isTeamAbilityMode } from '@/features/play-team-game/model/gameAbilities'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import { INITIAL_SETUP, NO_ACE, teamGameOptionsOf } from '@/pages/general-mode/lib/generalModeSetup'
import { MATCH_INFO_LABEL_FRAMES, matchInfoRowY } from '@/pages/general-mode/lib/prepareLayout'
import { EMPTY_VALUE, generalModeMatchInfoLines } from '@/pages/general-mode/lib/matchInfoLines'

/** 경기정보 값 줄 0x5dcc0 (R4 2d) · 경기 옵션 만들기 */

const 기록 = {
  ...INITIAL_SETUP,
  userTeamId: 2,
  aiTeamId: 5,
  playerSide: PLAYER_SIDE_FIRST_BAT,
  stadiumId: 2,
  acePitcherId: 1,
  aceBatterId: 3,
}

describe('경기정보 다섯 줄', () => {
  it('딱지는 순위·승패·선발·마투수·마타자 다섯이다', () => {
    const lines = generalModeMatchInfoLines(기록)

    expect(lines.map((line) => line.label)).toEqual(['순위', '승패', '선발', '마투수', '마타자'])
    expect(lines.map((line) => line.labelFrame)).toEqual([...MATCH_INFO_LABEL_FRAMES])
  })

  it('일반모드는 순위·승패가 양쪽 다 "-" 다', () => {
    const lines = generalModeMatchInfoLines(기록)

    expect(lines[0]).toMatchObject({ user: EMPTY_VALUE, cpu: EMPTY_VALUE })
    expect(lines[1]).toMatchObject({ user: EMPTY_VALUE, cpu: EMPTY_VALUE })
  })

  it('선발은 두 팀 모두 투수 0번이다', () => {
    const lines = generalModeMatchInfoLines(기록)

    expect(lines[2].user).toBe(teamPitchers(2)[0].name)
    expect(lines[2].cpu).toBe(teamPitchers(5)[0].name)
  })

  it('고른 마선수 이름을 유저 쪽에 적는다 — 웹판 ACE_PLAYERS 는 타자가 앞이라 번호를 갈아 준다', () => {
    const lines = generalModeMatchInfoLines(기록)

    expect(lines[3].user).toBe(ACE_PLAYERS[5 + 1].name)
    expect(lines[4].user).toBe(ACE_PLAYERS[3].name)
    // ⚠️ 고른 마선수가 어느 팀에 들어가는지 문서에 없어 CPU 는 "-" 로 둔다
    expect(lines[3].cpu).toBe(EMPTY_VALUE)
  })

  it('고른 마선수가 없으면 "-" 다', () => {
    const lines = generalModeMatchInfoLines({ ...기록, acePitcherId: NO_ACE, aceBatterId: NO_ACE })

    expect(lines[3].user).toBe(EMPTY_VALUE)
    expect(lines[4].user).toBe(EMPTY_VALUE)
  })

  it('줄 y 는 183·200·225·242·259 다 (둘째 무리부터 +8)', () => {
    expect([0, 1, 2, 3, 4].map(matchInfoRowY)).toEqual([183, 200, 225, 242, 259])
  })
})

describe('경기 옵션 만들기', () => {
  it('모드 1 로 두 팀과 선공을 그대로 옮긴다', () => {
    const options = teamGameOptionsOf(기록)

    expect(options.mode).toBe(TEAM_GAME_MODE.일반)
    expect(options.ourTeamId).toBe(2)
    expect(options.opponentTeamId).toBe(5)
    expect(options.playerSide).toBe(PLAYER_SIDE_FIRST_BAT)
  })

  it('모드 1 도 팀 능력치 보정을 탄다 (마스크 0x306)', () => {
    expect(isTeamAbilityMode(teamGameOptionsOf(기록).mode)).toBe(true)
  })

  it('보직 벌점 입력(lineup)·시즌 팀 상태(season)를 넘기지 않는다 — 일반모드에는 벌점이 없다', () => {
    const options = teamGameOptionsOf(기록)

    expect(options.lineup).toBeUndefined()
    expect(options.season).toBeUndefined()
  })
})
