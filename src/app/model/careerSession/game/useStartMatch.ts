import { useCallback } from 'react'
import { startGame, type GamePitcherSetup, type GameProgress } from '@/features/play-game/model/gameFlow'
import type { GameAceSetup } from '@/features/play-game/model/gameAces'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import type { TeamRecordEquipment } from '@/entities/team/model/teamRoster'
import { PLAYER_SIDE_LAST_BAT, type PlayerSide } from '@/entities/game/model/gameState'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import { startPlayClock } from '@/entities/collection/model/playClock'
import { LOADING_TIPS } from '@/shared/config/loadingTips'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { nariSceneStadium } from '@/features/play-team-game/model/sceneStadium'
import { stadiumSkyRowOf } from '@/widgets/batting-stage/lib/stageScenery'
import { BATTER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import { EMPTY_AT_BAT_PITCH_TALLY } from '@/features/play-at-bat/model/atBatPitchTally'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'
import * as gameAtoms from '@/app/model/careerSession/atoms/gameAtoms'

/** 경기 한 판을 세우는 값 — 정규 · 포스트시즌은 `leagueMatchSetupOf`, 국가대항전은 `cupMatchSetupOf` 가 만든다 */
export interface MatchSetup {
  readonly ourTeamId: number
  readonly battingOrder: number | undefined
  readonly opponentTeamId: number | undefined
  /** 리그 날짜 카운터 g — 4인 로테이션이 본다 (`시즌+0xb2` 자리, 커리어는 `gamesPlayed`). 안 주면 0 */
  readonly dayCounter?: number
  /** 내 팀이 앉는 측 (`0xb7844` → `경기[0x28+side]`). 안 주면 후공 */
  readonly playerSide?: PlayerSide
  /** 리그 경기의 두 팀 투수 레코드 차례·칸별 +0x2c (`leagueGamePitchersOf`) · 국가대항전은 대회 레코드 두 칸의 차례 */
  readonly pitchers?: GamePitcherSetup
  /** 142 가 두 팀 명부에 넣은 마선수 (0xb88c8 · 0xb8870). 국가대항전은 안 넘긴다 */
  readonly aces?: GameAceSetup
  /** 내 팀 명단 — 나리 팀 레코드 타자 배열 차례(`nariQuickLineupOf`) · 국가대항전은 대표팀 칸(+0xbc4) */
  readonly ourRecordLineup?: QuickLineup
  /** 나리 저장 +0xb2 — 구장 하늘 줄(0x783b0 모드 4)이 본다. 정규 · 포스트시즌은 `dayCounter`(안 주면 그 값), 국가대항전은 대회 날짜(L+0x32) */
  readonly skyDayCounter?: number
  /**
   * 내 선수 주력 `0xb570d(ctx, 3, 나, 1, 0x5a, 1)` — 모드 4 는 팀 정액 · 코치를 안 타 피로 없는 실효값이다. 루에 선 내가
   * 간이 타석 도루 판정(c19a0) · 주자 판 주루에 쓰인다 (`GameProgress.myRunAbility`)
   */
  readonly myRunAbility?: number
  /**
   * 두 팀 레코드 +2 — 경기 셋업 0x39fdc(3a332)와 실효 능력치 0xb570c(b5768)가 두 팀 모두 **지금 나리 사기** 0xa3a24 로 덮는다
   * (`GameProgress.teamMorale`, `nariMoraleOf`). 국가대항전이면 원본 버그로 상대국 칸 +2 값이다
   */
  readonly teamMorale?: number
  /** 상대 리그 팀 레코드 +2 의 앞 값 — 이 경기에서 그 칸이 아직 안 덮였을 때 상대 첫 공만 본다 (`GameProgress.opponentStaleMorale`). 대회는 안 넘긴다 */
  readonly opponentStaleMorale?: number
  /** 상대 리그 팀 레코드 장비 니블 — 나리 새 시즌 CPU 장비 굴림 0x665e8 이 쓴 값 (`GameProgress.opponentEquipment`). 대회는 안 넘긴다 */
  readonly opponentEquipment?: TeamRecordEquipment
}

/** 안 준 칸 — 날짜 0 · 후공 · 하늘 줄 날짜는 리그 날짜 */
function withMatchDefaults({ dayCounter = 0, playerSide = PLAYER_SIDE_LAST_BAT, skyDayCounter = dayCounter }: MatchSetup) {
  return { dayCounter, playerSide, skyDayCounter }
}

/** 홈(측 1 — 후공) 팀 */
const homeTeamIdOf = (started: GameProgress, playerSide: PlayerSide) =>
  playerSide === PLAYER_SIDE_LAST_BAT ? started.ourTeamId : started.opponentTeamId

/** 경기 한 판을 세운다 — 로딩 화면(StrTIP)이 끝나야 첫 투구가 나간다 */
export function useStartMatch({ atoms, audio, random, runner, setScreen }: CareerScope): (setup: MatchSetup) => void {
  return useCallback(
    (setup: MatchSetup) => {
      const { dayCounter, playerSide, skyDayCounter } = withMatchDefaults(setup)
      // 경기 장면 셋업 0x39fdc 모드 3·4 갈래(0x3a200) — 0xb6814(전역 상태): +0x6b = 0 (`liveGameState`)
      resetLiveGameState()
      // 경기 장면 적재 0x3f584 의 0x3fa3e `0x3f554` — 플레이 시간 시계를 이때부터 잰다
      startPlayClock()
      // 상태 7 진입 0x39f88 → 0x53dbc 의 팁 rand(0, 73) — 경기 시작 굴림의 맨 앞(덱 1275 · 효과 1202 보다 앞, `rollSceneLoadingTip`)
      const tip = LOADING_TIPS[rollSceneLoadingTip(random)] ?? null
      // 상태 7 갱신 0x3e340 의 맨 앞 0x3e350 이 울리던 소리를 끊는다(0x6e418) — 로딩 판부터 배경음이 없다.
      // (관리 화면이 경기로 넘길 때 0x15cfa · 0x1e916 도 먼저 끊지만 들리는 것은 같다)
      audio.stop()
      // 환경설정 "주루" 를 경기에 태운다 — 타자편은 사람이 늘 공격이라 설정이 그대로 먹는다 (0xae690)
      const started = startGame(
        random,
        setup.ourTeamId,
        setup.battingOrder,
        setup.opponentTeamId,
        playerSide,
        dayCounter,
        atoms.get(portsMirrorAtom).current.runningModeManual,
        setup.pitchers,
        setup.aces,
        setup.ourRecordLineup,
        setup.myRunAbility,
        setup.teamMorale,
        setup.opponentStaleMorale,
        setup.opponentEquipment,
      )
      atoms.set(gameAtoms.progressAtom, started)
      // 상태 9 의 0x39fdc 모드 4 갈래 — 홈(측 1) 팀 구장, 대회(S+0x12c)면 L+0xad > 1 ? 2 : 8. 리그 팀 0~9 · 상수라 굴림 없음
      atoms.set(gameAtoms.sceneStadiumAtom, nariSceneStadium(homeTeamIdOf(started, playerSide), atoms.get(gameAtoms.cupGameAtom)?.stage ?? null))
      // 적재(상태 8)의 구장 준비 0x352e8 → 0x783b0 — 이 경기 내내 같은 하늘 줄
      atoms.set(gameAtoms.stadiumSkyRowAtom, stadiumSkyRowOf({ mode: BATTER_LEAGUE_MODE, dayCounter: skyDayCounter }) ?? 0)
      runner.resetAtBat()
      atoms.set(gameAtoms.pitchTallyAtom, EMPTY_AT_BAT_PITCH_TALLY)
      atoms.set(gameAtoms.foulPlayAtom, false)
      runner.setBannerText('')
      runner.setIsPaused(true)
      atoms.set(gameAtoms.loadingTipAtom, tip)
      setScreen({ kind: '경기' })
    },
    [atoms, audio, random, runner, setScreen],
  )
}
