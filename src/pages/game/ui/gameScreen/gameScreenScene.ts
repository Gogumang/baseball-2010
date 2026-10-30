import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'

/** 경기 화면이 타석 대신 띄우는 장면 판정 — 벤치 클리어링(0x1e) · 1회초 판(0x18) · 타석이 덮였는가 · 기록 알림의 장면 갈래 */

type BenchClearing = NonNullable<GameProgress['pendingBenchClearing']>
type HalfInningBoard = NonNullable<GameProgress['halfInningBoard']>

/** 벤치 클리어링 연출(상태 0x1e) 중이면 그 붙든 사구 — 붙든 사구가 0x12 대기 · 진입 앞이면 아직 타석 화면이 0x12 를 그린다(A-22) */
export function benchClearingSceneOf(progress: GameProgress): BenchClearing | null {
  const pending = progress.pendingBenchClearing
  return pending?.phase === 'scene' ? pending : null
}

/**
 * 1회초 판(상태 0x18)이 OK 를 기다리고 있으면 그 판 — 진행기가 세웠고, OK 로 닫지 않았고, 경기 첫 공 앞일 때.
 * 판이 아직 OK 를 기다리는 자리인가 — 경기 첫 타석의 첫 공 전(아웃·주자·점수 없고 볼카운트 0-0).
 * 이 화면은 수비 재생 동안 앱이 내렸다 다시 올리므로(닫힘 상태가 사라진다) 판이 다시 서지 않게
 * 경기가 한 걸음이라도 나갔으면 판을 안 띄운다. 1회초 판은 경기 첫 장면에만 서므로 이것으로 충분하다.
 */
export function openHalfInningBoardOf(progress: GameProgress, atBat: AtBatState, isBoardClosed: boolean): HalfInningBoard | null {
  const board = progress.halfInningBoard ?? null
  if (isBoardClosed || board === null) return null
  return isAtFirstPitchOf(progress, atBat) ? board : null
}

const isBasesEmpty = (bases: GameProgress['game']['bases']) => !bases.first && !bases.second && !bases.third

function isAtFirstPitchOf(progress: GameProgress, atBat: AtBatState): boolean {
  const { game } = progress
  const isScoreless = game.ourScore === 0 && game.opponentScore === 0
  return game.inning === 1 && game.outs === 0 && isScoreless && isBasesEmpty(game.bases) && atBat.balls === 0 && atBat.strikes === 0
}

/**
 * **상태 0xe 의 OK 를 받을 수 있는가** (`features/play-game/model/sceneConfirm`, 0x39e14 → 0x532b0).
 * 타석 결과 연출·돌발 창·1회초 판·벤치 클리어링·경기 중 메뉴·조작방법·설정이 덮고 있으면 받지 않는다.
 * 받은 OK 는 진행기가 실은 대기 객체에 남아, 수비 화면을 갔다 와 이 화면이 다시 서도 다시 묻지 않는다.
 * 돌발 제안 창(0x1b)은 원본처럼 OK 뒤에 선다 — 그 창을 띄우는 `app/ui/GameRoute` 가 대기가 끝나기를 기다린다.
 */
export function isSceneUncoveredOf(isPaused: boolean, bannerText: string, isPopupShown: boolean, isStageReplaced: boolean): boolean {
  return !isPaused && bannerText === '' && !isPopupShown && !isStageReplaced
}

/** 기록 달성 알림의 장면 갈래 (`RecordAlertScene.key`) */
export function recordAlertSceneKeyOf(isBenchClearing: boolean, openBoard: HalfInningBoard | null, isConfirmAwaiting: boolean): string {
  if (isBenchClearing) return 'benchClearing'
  if (openBoard !== null) return `board-${openBoard.serial}`
  return isConfirmAwaiting ? 'confirm' : 'play'
}
