import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherInjuryEndingOf } from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import { PITCHER_YEAR_START_EVENT_ID, pitcherOpeningScanOf } from '@/entities/pitcher-career/model/pitcherStoryScene'
import { achievedPitcherGoalCount } from '@/entities/pitcher-career/model/pitcherYearGoals'
import { INJURY_ENDING_EVENT_ID, MID_SEASON_GAME, midSeasonEventId, midSeasonTitlesOf } from '@/entities/career/model/seasonFlow'
import { matchResultEventOf } from '@/entities/story/model/aceMatch'
import { EVENT_TRIGGER } from '@/entities/story/model/storyScene'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitcherAtoms } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { cursorAtom, heldTitleAtom, newPlayerAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { portsMirrorAtom } from '@/app/model/pitcherLeagueSession/atoms/portsAtoms'
import type { PitcherStory } from '@/app/model/pitcherLeagueSession/types/scene'

/** 105 도착 한 번이 쓰는 것 — 그 고리가 본 커리어 · 이벤트 본문과 세션 콜백 */
export interface ManagementArrivalContext {
  readonly atoms: PitcherAtoms
  readonly career: PitcherCareer
  readonly fileEvents: readonly OriginalEvent[]
  readonly random: RandomPort
  readonly openStory: (next: PitcherStory) => void
  readonly commitWith: (update: (current: PitcherCareer) => PitcherCareer) => void
  readonly scanAuto: (
    current: PitcherCareer,
    events: readonly OriginalEvent[],
    trigger: number,
    rolling: RandomPort | undefined,
  ) => OriginalEvent | null
  readonly enterOutingMap: () => void
}

/** 새 선수 오프닝 451 — 1cfa6: 장면+0x165 ≠ 0 → 0x8bde0(모드 3 → 451) · [다음 114, 뒤 105] · 플래그 지움(예약을 덮는다) */
function openNewPlayerOpening({ atoms, fileEvents, openStory }: ManagementArrivalContext): boolean {
  if (!atoms.get(newPlayerAtom)) return false
  atoms.set(newPlayerAtom, false)
  const opening = pitcherOpeningScanOf(fileEvents, atoms.get(cursorAtom))
  atoms.set(cursorAtom, opening.cursor)
  if (opening.event === null) return false
  openStory({ eventId: opening.event.id, context: '관리', viewed: [] })
  return true
}

/**
 * **부상 엔딩** — 105 진입 곁가지 첫 줄 0x11b32~0x11b44: `0xa3a85(S) == 0` → 0x113e8 이 이벤트 500 을 번호로 틀고
 * (대상 0 — 훑기로는 안 나온다) `[다음 114, 뒤 141]`(0x11442~0x11454). 500 의 끝 명령(첫 종류 21)이 [0x1552adc] 를 켜
 * 114 끝 1c088 이 141 로 간다(`completeStory`). 예전 웹은 500 을 건너뛰고 곧장 엔딩 화면을 띄웠다.
 * 새 선수 오프닝(1cfa6)이 같은 틀에 예약을 덮으므로 그 뒤 — 451 이 끝나 105 로 다시 들어오면 진입이 500 을 다시 세운다.
 */
function openInjuryEnding({ career, openStory }: ManagementArrivalContext): boolean {
  if (pitcherInjuryEndingOf(career) === null) return false
  openStory({ eventId: INJURY_ENDING_EVENT_ID, context: '관리', viewed: [] })
  return true
}

/**
 * **나간 마선수 대결** — 진입 곁가지 0x11b6c~0x11bbe: 전역 g[0x176] 이 서 있고 모드가 4 가 아니면 현재를 112(0x70)로 ·
 * 0x7e84d(그림, 0x70) · 0x118e4([!] 칸 다시 찍기) · 다음 140. 140 진입 0x10df8 이 결과 바이트 g[0x177](SYS 8 이 적은 0 —
 * 짐, 대기 중 미션을 치렀으면 그 판 결과)로 resultEvents[이김 ? 0 : 1] 을 0x8bdc9 로 틀고 칸들을 지운 뒤 전역기록을 저장한다(10f72) · [다음 114, 뒤 105].
 */
function openPendingAceMatchResult({ atoms, openStory, enterOutingMap }: ManagementArrivalContext): boolean {
  const pending = atoms.get(portsMirrorAtom).current.aceMatchPending
  const pendingResultEvents = pending.read()
  if (pendingResultEvents === null) return false
  // 결과 바이트 g[0x177] — SYS 8 이 0, 대기 중 미션 정산 0x4ea0c 가 그 판 성공 여부로 덮어쓴다 (`withAceMatchResultWritten`)
  const isWon = pending.isWon()
  enterOutingMap()
  pending.clear()
  openStory({ eventId: matchResultEventOf(pendingResultEvents, isWon), context: '대결결과', viewed: [] })
  return true
}

/** 115 진입 0x16aac: 0x8a681 로 내장 이벤트를 세우고 `0xa4ee9(S)` — 마이너스 스킬 해제 기록 +0x1d0~+0x1d7 을 지운다 */
function openYearStart({ career, commitWith, openStory }: ManagementArrivalContext): boolean {
  if (career.hasSeenYearGoalWindow) return false
  commitWith((current) => (current.removedMinusSkillIds.length === 0 ? current : { ...current, removedMinusSkillIds: [] }))
  openStory({ eventId: PITCHER_YEAR_START_EVENT_ID, context: '연초', viewed: [] })
  return true
}

/** 자동 발동 0x1cf9c 1d02c — 0x8be80(…, 화면코드 105) 찾으면 [다음 114, 뒤 105] (117 예약을 덮는다) */
function openAutoScanned({ career, fileEvents, random, scanAuto, openStory }: ManagementArrivalContext): boolean {
  const event = scanAuto(career, fileEvents, EVENT_TRIGGER.관리, random)
  if (event === null) return false
  openStory({ eventId: event.id, context: '관리', viewed: [] })
  return true
}

/**
 * 117 진입 0x11e84: k = 0xa3de9(S, 1) (투수 갈래 — 방어율 칸 그대로, 나머지 넷 >>1) →
 * k ∈ {4,5} 452 · k ≤ 1 454 · 그 밖 453. 칭호 1(1년차·k > 4) · 9(2년차~·지난 k ≤ 1·k > 4) 를
 * +0x270 에 넣고(0x11ee6~0x11f4a, 공통 칭호라 두 편 같다) 끝에 +0x1cc = k (0x11f5a).
 */
function openMidSeasonEvaluation({ atoms, career, commitWith, openStory }: ManagementArrivalContext): void {
  if (career.gamesPlayed !== MID_SEASON_GAME || career.midSeasonEvaluatedYears.includes(career.season - 1)) return
  const achieved = achievedPitcherGoalCount(career, '중간')
  // 칭호는 +0x270 에 넣기만 한다(조건이 안 서면 그대로) — 팝업 · 비트 · 장착은 105 둘째 틀의 확인(`heldTitle` · `confirmTitle`)
  const [midSeasonTitle] = midSeasonTitlesOf(career, achieved).filter((title) => !career.titleIds.includes(title))
  if (midSeasonTitle !== undefined) atoms.set(heldTitleAtom, midSeasonTitle)
  // 직전 값을 받아 고친다 — 같은 프레임의 칭호·지갑 고리가 고친 것을 덮지 않게
  commitWith((current) => ({ ...current, lastMidSeasonGoalCount: achieved }))
  openStory({ eventId: midSeasonEventId(achieved), context: '중간평가', viewed: [] })
}

/** 앞에서부터 처음 선 하나만 — 451 → 500 → 140 → 115 → (trigger 0 훑기) → 117 */
const ARRIVAL_STEPS = [openNewPlayerOpening, openInjuryEnding, openPendingAceMatchResult, openYearStart, openAutoScanned] as const

export function runManagementArrival(context: ManagementArrivalContext): void {
  if (ARRIVAL_STEPS.some((step) => step(context))) return
  openMidSeasonEvaluation(context)
}
