import type { Screen } from '@/app/model/screen'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { EVENT_TRIGGER, NARI_YEAR_START_EVENT_ID } from '@/entities/story/model/storyScene'
import {
  achievedGoalCount,
  INJURY_ENDING_EVENT_ID,
  judgeEnding,
  MID_SEASON_GAME,
  midSeasonEventId,
  midSeasonTitlesOf,
} from '@/entities/career/model/seasonFlow'
import { battingOrderEventId } from '@/entities/career/model/battingOrder'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { isAutoScanHeldByAceMatch } from '@/app/model/aceMatchScanGuard'
import type { CareerAtoms, CareerStoryScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { heldTitleAtom, newPlayerAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'
import { pendingAceMatchScreenOf } from '@/app/model/careerSession/events/pendingAceMatch'

/** 진입 검사 한 번이 쓰는 것 — 그림의 커리어와 이벤트 일정 */
export interface ManagementEntryInput {
  readonly atoms: CareerAtoms
  readonly career: PlayerCareer
  readonly story: CareerStoryScope['story']
  readonly random: RandomPort
  readonly setScreen: (screen: Screen) => void
}

const managementEventScreen = (eventId: number): Screen => ({ kind: '이벤트', eventId, context: '관리' })

/**
 * **새 선수 오프닝 451 이 115 보다 먼저다** (모드 3·4 공용). 진입 0x11910 이 0x11bd6 에서 `0xbcb49(115)` 로 예약해도,
 * 같은 틀에 상태 틀 0x1cdec 가 진입(점프표 0xcc728) 뒤 곧장 자동 발동 0x1cf9c 로 떨어지고, 거기 1cfa6 이
 * 장면+0x165(새 선수 — 100 진입 끝 0x1c3be 가 이전 상태 104 면 켠다) ≠ 0 이면 `0x8bde0`(모드 2 → 400 · 3·4 → 451) ·
 * `0xbcb49(105)` · `0xbcb49(114)` 로 예약을 덮는다(0xbcb48: +0xc = +8 ; +8 = s — 115 는 밀려 사라진다).
 * 451 이 끝나 114 → 뒤 105 로 다시 들어오면 진입이 115 를 또 세운다 → **451 → 115**.
 * 판정은 새 선수 플래그 하나다 — "451 을 봤는가" 가 아니다(A-54: 451 도중 끊고 이어하면 원본은 다시 틀지 않는다). 굴림 없음.
 */
function newPlayerOpeningOf({ atoms, story }: ManagementEntryInput): Screen | null {
  if (!atoms.get(newPlayerAtom)) return null
  atoms.set(newPlayerAtom, false)
  const opening = story.openingEvent()
  return opening === null ? null : managementEventScreen(opening.id)
}

/**
 * 105 진입 0x11910 곁가지(0x11b24~): S+0x1b7 == 0(올해 목표 창 아직 안 봄) → **115 연초** 가 138 보다 먼저다.
 * 115 진입 0x16aac: 내장 이벤트 0x8a681 → `[다음 114, 뒤 105]` → `0xa4ee9(S)` — 마이너스 스킬 해제 기록
 * +0x1d0~+0x1d7 을 지운다(R9 7절). 그래서 해제 기록(0xa4f31)은 "그 해" 것만 남는다. 창이 닫히면 0x7fe90 이 S+0x1b7 = 1.
 * 1b8807f 앞의 옛 저장은 이 칸이 늘 거짓이라 불러온 뒤 한 번 더 115 를 본다 — 원본과의 차이 판단은 `hasSeenYearGoalWindow` 주석.
 */
function enterYearStart({ atoms, career, setScreen }: ManagementEntryInput): void {
  // 지금 칸에서 지운다 — 같은 그림에 커리어 쪽 G 가 움직였으면 내보인 커리어는 아직 지갑 값이다(반복 이벤트 지움과 같다)
  if (career.removedMinusSkillIds.length > 0) {
    atoms.set(rawCareerAtom, (current) => (current === null ? current : { ...current, removedMinusSkillIds: [] }))
  }
  setScreen({ kind: '이벤트', eventId: NARI_YEAR_START_EVENT_ID, context: '연초' })
}

/**
 * **117 중간 성적표** — 진입 곁가지 11bda~11c0e: 115 다음, 138 앞. `S+0xb2 == 22 && 0xa4280(S, 모드 == 4, S+0xb3) == 0`
 * (그 해 비트 S+0x180 — `midSeasonEvaluatedYears`)이면 `0xbcb49(117)` 로 예약하고 11c1a 로 건너뛰어 138 은 안 본다.
 * 117 은 114 · 115 가 아니라 같은 틀의 자동 훑기(1cfdc)가 돌고, 찾으면 `[다음 114, 뒤 105]` 로 예약을 덮는다 — 그래서 훑기가 먼저다
 * (덮인 117 은 이벤트 뒤 105 재진입이 다시 세운다. 비트는 452~454 의 보상이 돌아야 켜진다 — `applyEventRewards`).
 * 117 진입 0x11e84: k = 0xa3de9(S, 1) → 452 · 453 · 454 · 칭호 1 · 9 를 +0x270 에 · 끝에 S+0x1cc = k → `[다음 114, 뒤 105]`.
 * 원래 웹은 116 [확인]에서 곧장 117 을 띄웠다(105 진입 · 훑기 · 저장을 건너뛰었다).
 */
const isMidSeasonEvaluationDue = (career: PlayerCareer) =>
  leagueDayCounterOf(career) === MID_SEASON_GAME && !career.midSeasonEvaluatedYears.includes(career.season - 1)

function enterMidSeasonEvaluation({ atoms, career, setScreen }: ManagementEntryInput): void {
  const achieved = achievedGoalCount(career, '중간')
  // 11ee6~11f4a — 칭호는 +0x270 에 넣기만 한다(조건이 안 서면 +0x270 은 그대로). 팝업 · 비트는 105 둘째 틀(`pendingTitle`)
  const [midSeasonTitle] = midSeasonTitlesOf(career, achieved).filter((title) => !career.titleIds.includes(title))
  if (midSeasonTitle !== undefined) atoms.set(heldTitleAtom, midSeasonTitle)
  atoms.set(rawCareerAtom, { ...career, lastMidSeasonGoalCount: achieved })
  setScreen(managementEventScreen(midSeasonEventId(achieved)))
}

/** 훑기 앞에 서는 번호 이벤트 — 새 선수 451 → 부상 엔딩 500 → 나간 대결 140. 없으면 null */
function numberedEntryScreenOf(input: ManagementEntryInput): Screen | null {
  const opening = newPlayerOpeningOf(input)
  if (opening !== null) return opening
  /*
   * **부상 엔딩** — 105 진입 0x11910 곁가지의 첫 줄(0x11b32~0x11b44): `0xa3a85(S) == 0`(부상 누적 +0x1b6 > 19)이면 0x113e8 이
   * 이벤트 500 을 번호로 틀고(0x8bdc8 — 대상 0 이라 훑기로는 안 나온다) `[다음 114, 뒤 141]` 을 예약한다(0x11442~0x11454).
   * 500 의 끝 명령(첫 종류 21)이 [0x1552adc] 를 켜 114 끝 1c088 이 141 로 간다(`completeScene`). 새 선수 오프닝 451(위)은
   * 같은 틀의 1cfa6 이 예약을 덮어 먼저다 — 451 이 끝나 105 로 다시 들어오면 진입이 500 을 다시 세운다. 0x113e8 은 500 을
   * 틀며 전역기록 +0xa8 = 1 도 쓰는데(0x11412~0x1141c) 엔딩 판 0x87c7c 가 같은 칸(+0xa8 + 0)을 다시 쓴다(`mergeEndingIntoCollection`).
   */
  if (judgeEnding(input.career) === 0) return managementEventScreen(INJURY_ENDING_EVENT_ID)
  // 나간 마선수 대결 — 곁가지 0x11b46~0x11bbe 가 112 → 140 (`pendingAceMatchScreenOf`)
  return pendingAceMatchScreenOf(input.atoms.get(portsMirrorAtom).current.aceMatchPending)
}

/**
 * 105 진입 곁가지(0x11910)와 자동 훑기(0x1cf9c) — 서 있는 진입 표지 하나를 다 본다. 차례: 새 선수 451 → 부상 엔딩 500 →
 * 나간 대결 140 → 연초 115 → 자동 훑기 → 117 중간 성적표 → 138 타순.
 */
export function scanManagementEntry(input: ManagementEntryInput): void {
  const { atoms, career, story, random, setScreen } = input
  const numbered = numberedEntryScreenOf(input)
  if (numbered !== null) return setScreen(numbered)
  if (!career.hasSeenYearGoalWindow) return enterYearStart(input)
  /*
   * 타순 138 — 진입 곁가지 끝 `r4 = 0xa4c2d(S) > 0` 이면 `0xbcb49(138)` 예약(경기 뒤만이 아니라 105 진입마다). 그런데 같은 틀의
   * 자동 훑기는 다음 상태가 114 · 115 일 때만 건너뛰어(1cfdc) 138 예약 위에서도 돌고, 찾으면 `[다음 114, 뒤 105]` 로 예약을
   * 덮는다(1d03a~1d048). 그래서 **훑기가 먼저**이고 138 은 훑기가 빈 진입에서만 선다(덮인 138 은 이벤트 뒤 105 재진입이 다시 세운다).
   * 훑기 0x8be80 은 늘 무작위 조건까지 굴린다.
   */
  const orderEventId = battingOrderEventId(career)
  // 1cfe4~1d008 — 대결 대기(어느 편이든)가 서 있으면 훑지 않는다(B-124 원본 길, `isAutoScanHeldByAceMatch`)
  const isHeld = isAutoScanHeldByAceMatch(atoms.get(portsMirrorAtom).current.aceMatchHold)
  const event = isHeld ? null : story.eventFor(career, EVENT_TRIGGER.관리, random)
  if (event !== null) return setScreen(managementEventScreen(event.id))
  if (isMidSeasonEvaluationDue(career)) return enterMidSeasonEvaluation(input)
  if (orderEventId !== null) setScreen(managementEventScreen(orderEventId))
}
