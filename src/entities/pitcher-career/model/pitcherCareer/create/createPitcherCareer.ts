import { EMPTY_LEAGUE } from '@/entities/league/model/league'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import { NO_EQUIPPED_TITLE } from '@/entities/career/model/titles'
import { createNariTeamRecords } from '@/entities/career/model/nariTeamRecord'
import type { NariTeamRecords } from '@/entities/career/model/nariTeamRecord'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import { EMPTY_PITCHER_STREAKS } from '@/entities/pitcher-career/model/pitcherStreaks'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { myPitcherRegistrationSlotOf, registeredMyPitcherOrderOf } from '@/entities/pitcher-career/model/myPitcherRecord'
import { DEFAULT_PITCHER_ROOKIE_PROFILE, rookiePitcherAbilityOf, rookiePitchMaskOf } from '@/entities/pitcher-career/model/pitcherRegistration'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import {
  DEFAULT_TEAM_ID,
  HIDDEN_PITCH_ROW_COUNT,
  PITCH_TRAINING_CELL_COUNT,
  STARTING_GAME_POINT,
  STARTING_MONEY,
  STARTING_MORALE,
  STARTING_POPULARITY,
  STARTING_REPUTATION,
  STARTING_SALARY,
  STARTING_SKILL_IDS,
} from '@/entities/pitcher-career/model/pitcherCareer/constants'
import { EMPTY_PITCHER_SEASON_STATS } from '@/entities/pitcher-career/model/pitcherCareer/stats/seasonStats'
import { EMPTY_COMPLETE_GAME_COUNTS } from '@/entities/pitcher-career/model/pitcherCareer/stats/completeGames'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/** 등록 꼴 열 팀 레코드 — 타자 배열은 붙박이, 내 팀은 투수 배열에 내 투수 */
function registeredNariTeamsOf(teamId: number, role: PitcherRole): NariTeamRecords {
  return createNariTeamRecords(teamId, null).map((record, team) =>
    team === teamId ? { ...record, pitchers: registeredMyPitcherOrderOf(role) } : record,
  )
}

export function createPitcherCareer(name: string, profile: PitcherRookieProfile = DEFAULT_PITCHER_ROOKIE_PROFILE): PitcherCareer {
  return {
    name,
    ability: rookiePitcherAbilityOf(profile.role, profile.typeIndex),
    role: profile.role,
    // 생성 0x17360 이 rec[+0xa] 에 0x80(bit7 = 내 육성 선수)을 쓰고, 등록 0x10fb4 가 보직대로 아래 5비트를 고친다 —
    // 선발 0 · 구원 7 (`0xb6605`, 0x111a8~0x111ae). 포지션 코드 `0xb6394` 가 그 칸이라 구원은 116 평가에서 **구원형**(> 3)이다.
    // 그 칸에 내 투수를 넣은 열 팀 레코드는 아래 `nariTeams` (`0xb521d`)
    positionCode: myPitcherRegistrationSlotOf(profile.role),
    typeIndex: profile.typeIndex,
    handIndex: profile.handIndex,
    skinIndex: profile.skinIndex,
    pitchMask: rookiePitchMaskOf(profile.breakingPitchSlots),
    magicLevel: 0,
    // 신인은 마구가 없다 (레코드 +0x18 = 0)
    selectedMagicNumber: 0,
    magicSessions: 0,
    pitchTrainingStages: rookiePitchTrainingStagesOf(profile.breakingPitchSlots),
    hiddenPitchRows: new Array<boolean>(HIDDEN_PITCH_ROW_COUNT).fill(false),
    stamina: FULL_STAMINA,
    gamePoint: STARTING_GAME_POINT,
    season: 1,
    gamesPlayed: 0,
    stats: EMPTY_PITCHER_SEASON_STATS,
    careerStats: EMPTY_PITCHER_SEASON_STATS,
    teamId: profile.teamId ?? DEFAULT_TEAM_ID,
    popularity: STARTING_POPULARITY,
    reputation: STARTING_REPUTATION,
    morale: STARTING_MORALE,
    money: STARTING_MONEY,
    salary: STARTING_SALARY,
    skillIds: STARTING_SKILL_IDS,
    // 신인 스킬은 공통 초기화 0x11230 이 0xa4bd9 로 얻는다 — 그 자리에서 자동 장착(0xa4b04(P,s,1))된다
    equippedSkillIds: STARTING_SKILL_IDS,
    // +0x1c6 을 쓰는 곳은 확장(0x148f8) 하나뿐 — 새 선수는 0 으로 본다 (타자편과 같은 추정)
    skillSlotLevel: 0,
    removedMinusSkillIds: [],
    titleIds: [],
    // 선수 +0x1c4 는 만들 때 −1 이다 — 기본정보 카드가 그 값이면 칭호 줄을 안 그린다 (0x11292)
    equippedTitle: NO_EQUIPPED_TITLE,
    subItemIds: [],
    equipmentLevels: { control: 0, velocity: 0, breaking: 0, stamina: 0 },
    ownedEquipment: [],
    openedHiddenIds: [],
    affection: {},
    seenEventIds: [],
    storySceneIndex: 0,
    trainingCounts: {},
    seasonStartTrainingCounts: {},
    consecutiveTrainingCounts: {},
    releaseTrainingStreaks: [0, 0, 0, 0, 0],
    badBodyTrainings: 0,
    fragileTrainings: 0,
    hasActedThisCycle: false,
    outingsThisSeason: 0,
    outingsLastSeason: 0,
    isInjured: false,
    injuredGamesPlayed: 0,
    injuryRemaining: 0,
    isSick: false,
    illnessName: null,
    illnessRemaining: 0,
    illnessCooldown: 0,
    mvpSeasonBits: 0,
    lotteryPurchases: 0,
    lotteryFirstPrizes: 0,
    completeGameCounts: EMPTY_COMPLETE_GAME_COUNTS,
    seasonPopularityGain: 0,
    popularityAtSeasonStart: STARTING_POPULARITY,
    hasSeenYearGoalWindow: false,
    yearGoalEventDone: false,
    endingIndex: null,
    league: EMPTY_LEAGUE,
    // 등록 0x204e1(저장, 3, 1) 로 열 팀을 마스터에서 다시 짓고 내 팀 투수 배열 칸 t 에 내 투수 (0xb521d, `myPitcherRecord`)
    nariTeams: registeredNariTeamsOf(profile.teamId ?? DEFAULT_TEAM_ID, profile.role),
    leaguePlayerStats: EMPTY_LEAGUE_PLAYER_STATS,
    regularSeasonFirstCount: 0,
    regularSeasonRewardTaken: false,
    seasonEndState: null,
    streaks: EMPTY_PITCHER_STREAKS,
    postseason: null,
    lastMidSeasonGoalCount: 0,
    reputationZeroGames: 0,
    midSeasonEvaluatedYears: [],
    wins: 0,
    draws: 0,
    losses: 0,
  }
}

/**
 * 등록에서 고른 기본 변화구 두 개는 **단계 1** 로 적힌다
 * (`커리어+0x208+k·4+1 = 1`, J 3-1). 칸 번호는 구질 훈련 표의 (행·2 + 열%2) 와 같다.
 */
function rookiePitchTrainingStagesOf(slots: readonly number[]): number[] {
  const stages = new Array<number>(PITCH_TRAINING_CELL_COUNT).fill(0)
  for (const slot of slots) {
    if (slot >= 0 && slot < PITCH_TRAINING_CELL_COUNT) stages[slot] = 1
  }
  return stages
}
