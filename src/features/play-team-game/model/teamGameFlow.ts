/**
 * **사람이 팀을 조작하는 경기** — 원본 게임 모드 **1 일반 · 2 시즌 · 8·9 대전** 이 쓰는 경기다
 * (장면 0x104, H-1 모드표).
 *
 * 나만의리그 두 흐름과 뼈대는 같지만 **공수를 모두 사람이 맡는다**:
 *   - 우리 팀 공격 반 이닝 → 타순 아홉 칸을 사람이 **친다** (`applyBatterPitch`)
 *   - 우리 팀 수비 반 이닝 → 사람이 공을 하나씩 **던진다** (`throwPitch`)
 *   - 어느 타석을 사람이 잡고 어느 타석을 자동으로 넘길지는 **경기진행 설정**(J-3, `matchSettings`)이 정한다
 *
 * 자동으로 넘기는 타석은 원본과 같이 간이 엔진(0xc11f0·0xc262c)이 한 타석씩 돌린다.
 * 사람이 잡은 타석의 인플레이 타구만 수비 시뮬레이션(`features/defense-play`)을 거친다 —
 * 원본도 CPU 끼리의 타석에만 간이 엔진을 쓴다 (`play-game/gameFlow` 의 같은 주석).
 *
 * 들어와 있는 것: 엔트리 편집기(0x55864)가 고친 명단(`ourEntryOrder`) · 사람·CPU 대타(`pinchHit`·0xac228, Q1 4절) ·
 * 경기 중 투수 교체(자동 타석은 CPU 교체 AI 0xac428 이 양 팀을, 사람 장면은 0xf 진입 0x3d954 가 CPU 쪽을, 우리 투수는
 * `#` 메뉴만 — `changePitcher`, R4 1a·1b·1c) · 30G 자동진행(`runAutoProgress` — 끝나는 조건 0xc2198 확정).
 *
 * 자동진행 **중계 화면**(경기 상태 0x21, R10 7절 — 속도 칸 +0xbc · CLR 중단 질문)도 들어와 있다: `stepAutoRelay` 가
 * 0xc262c 한 번씩 돌며 남긴 `TeamAutoRelay` 를 `pages/team-game` 의 `TeamAutoRelay` 화면이 그린다.
 * 감독 강판은 **투수편(모드 3) 전용**이라(P1 2절) 팀 경기에는 원본에도 없다.
 *
 * ## 부르는 쪽에게 (시즌 세션 · 포스트시즌 · 국가대항전)
 * 시즌은 `app/ui/SeasonRoute` 가 `pages/team-game/ui/TeamGameScreen`(또는 `pages/team-game/model/useTeamGame`)을
 * 띄우고 `onFinish(summary)` 를 `useSeasonSession` 의 `finishGame` 이 받는다. 요약에서 읽을 칸:
 * ```
 *   summary.won · ourScore · opponentScore            → 리그 전적 · 시즌 평가 evaluateSeasonGame
 *   summary.popularityCompleteGame · reputationCompleteGame · gameRecord(평판 16칸, 평가 앞에 꽂는다)
 *   summary.leaguePlateAppearances · leaguePitchers   → 리그 타자·투수 기록표
 *   summary.recordIds · gamePoints                    → 기록달성 G (경기 끝 0x4ea0c)
 *   summary.ourPitcherStaminas · opponentPitcherStaminas → 다음 경기로 잇는 투수 +0x2c
 *   summary.burstRewardDeltas                         → 돌발 보상 (0x8e34c 모드 2 — 종류 1 사기 · 2 인기도 · 3 평판 ·
 *                                                       4 소지금). 원본은 경기 중에 더하므로 평가 **앞에** 얹는다
 * ```
 * 돌발 결과 창은 `closeBurstWindow` 로 닫는다.
 * 포스트시즌·국가대항전도 같은 화면을 쓴다 — `mode` 는 그대로 2 이고 상대 팀만 바뀐다.
 */
export type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow/types/options'
export type {
  TeamGameLogEntry,
  TeamPitchingLine,
  TeamRecordTally,
  PendingDefensePlay,
} from '@/features/play-team-game/model/teamGameFlow/types/records'
export type { TeamGameProgress, TeamAutoRelay, TeamAutoRelayTick } from '@/features/play-team-game/model/teamGameFlow/types/progress'
export { TEAM_GAME_RESUME_SAVE } from '@/features/play-team-game/model/teamGameFlow/setup/savePoint'
export { resumeTeamGame, migrateTeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/setup/resume'
export { rollOpponentAces, rollTeamSetup } from '@/features/play-team-game/model/teamGameFlow/setup/opponentAces'
export type { TeamSetupRolls } from '@/features/play-team-game/model/teamGameFlow/setup/opponentAces'
export { teamGameStartPointOf } from '@/features/play-team-game/model/teamGameFlow/setup/startPoint'
export { startTeamGame } from '@/features/play-team-game/model/teamGameFlow/setup/startTeamGame'
export { DEFAULT_PLAYER_SIDE, isOurOffense, isHumanTurn, isBatterTurn, isPitchTurn } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
export {
  currentBatterEntry,
  entryBatterSkillIdsOf,
  entryPitcherSkillIdsOf,
  humanDefenseSkillPanelOf,
  currentBatterAbility,
} from '@/features/play-team-game/model/teamGameFlow/roster/batters'
export { specialSwingRemainingAt, spendOurSpecialSwing } from '@/features/play-team-game/model/teamGameFlow/roster/specialSwing'
export { recordDrawnTeamFieldingErrors } from '@/features/play-team-game/model/teamGameFlow/records/fieldingErrors'
export {
  currentPitcherAbility,
  opponentMagicStateOf,
  currentPitcherAceIndex,
  currentPitcherEquipment,
  currentPitcherSkinIndex,
  ourPitcherStats,
  pitchSlotsFor,
} from '@/features/play-team-game/model/teamGameFlow/roster/currentPitcher'
export { substitutionDetailAbilities, substitutionStaminaOf } from '@/features/play-team-game/model/teamGameFlow/substitution/substitutionDetail'
export { runnerAcesFor } from '@/features/play-team-game/model/teamGameFlow/defense/fielders'
export type {
  BatterOutcomeOptions,
  TeamPitchInput,
  TeamPendingPitchArrival,
  TeamPendingRunnerPlay,
} from '@/features/play-team-game/model/teamGameFlow/types/plays'
export { applyBatterPitch, startBatterPitch, batterContactDefenseInputOf } from '@/features/play-team-game/model/teamGameFlow/batting/batterPitch'
export { applyBatterOutcome, startBatterOutcome } from '@/features/play-team-game/model/teamGameFlow/batting/batterOutcome'
export { resolveBenchClearing, judgeHitByPitch, enterBenchClearing } from '@/features/play-team-game/model/teamGameFlow/benchClearing/benchClearing'
export { throwPitch, startThrowPitch } from '@/features/play-team-game/model/teamGameFlow/pitching/throwPitch'
export { enterPitchResult, resolveRunnerPlay } from '@/features/play-team-game/model/teamGameFlow/pitching/ourPitchArrival'
export { resolveDefensePlay } from '@/features/play-team-game/model/teamGameFlow/defense/resolveDefensePlay'
export { pickoff, cpuPickoff } from '@/features/play-team-game/model/teamGameFlow/baseRunning/pickoff'
export { runnerRunAbilitiesOf } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
export { withLeagueStolenBases, stealableBases, startSteal } from '@/features/play-team-game/model/teamGameFlow/baseRunning/steals'
export { confirmScene } from '@/features/play-team-game/model/teamGameFlow/scene/prepareAtBat'
export { burstGameRecordOf, closeBurstWindow } from '@/features/play-team-game/model/teamGameFlow/burst/burst'
export { returnToPitchSelection } from '@/features/play-team-game/model/teamGameFlow/scene/enterPitchSelection'
export { replacementPitcherIndexOf } from '@/features/play-team-game/model/teamGameFlow/substitution/replacementPick'
export type { ReplacementPickInput } from '@/features/play-team-game/model/teamGameFlow/substitution/replacementPick'
export {
  changePitcher,
  cancelSubstitution,
  availablePitchers,
  canOpenPitcherChange,
} from '@/features/play-team-game/model/teamGameFlow/substitution/pitcherChange'
export { availablePinchHitters, canOpenPinchHit, pinchHit } from '@/features/play-team-game/model/teamGameFlow/substitution/pinchHit'
export {
  AUTO_PROGRESS_COST_VERSUS,
  AUTO_PROGRESS_COST,
  autoProgressCostOf,
  canAutoProgress,
} from '@/features/play-team-game/model/teamGameFlow/autoProgress/autoProgressCost'
export { runAutoProgress, stepAutoRelay } from '@/features/play-team-game/model/teamGameFlow/autoProgress/autoRelay'
export { stopAutoRelay } from '@/features/play-team-game/model/teamGameFlow/autoProgress/relayTick'
export { moundStaminaOf } from '@/features/play-team-game/model/teamGameFlow/stamina/moundStamina'
export { pitchersOfRecordOf } from '@/features/play-team-game/model/teamGameFlow/settlement/decisions'
export { summaryOf } from '@/features/play-team-game/model/teamGameFlow/summary/summary'
export type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow/summary/summary'
/** 도루 대상 주자가 선 루 */
export type { StealBase } from '@/entities/fielding/model/stealStart'
