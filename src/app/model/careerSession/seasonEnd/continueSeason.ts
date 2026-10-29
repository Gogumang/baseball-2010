import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { achievedGoalCount } from '@/entities/career/model/seasonFlow'
import { careerNationalTeamEventId, isCareerNationalCupYear, NATIONAL_CUP_EVENT } from '@/entities/national-cup/model/nationalCupFlow'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import { enterSeasonEvent, nextSeasonStep } from '@/app/model/seasonEvents'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { withNationalCupEntered } from '@/app/model/careerSession/nationalCup/nationalCupEntry'
import { seasonFlowOf } from '@/app/model/careerSession/seasonEnd/seasonFlow'

/** 시즌 사슬 이벤트(context '시즌')가 끝난 뒤 — 국가대표 이벤트 → 연말 사슬 다음 걸음 (그림마다 새 함수) */
export function continueSeasonOf(scope: CareerScope) {
  const { atoms, setScreen } = scope
  const { startNewSeason, enterPostseason, enterEnding } = seasonFlowOf(scope)

  /** 연말 상태 132 → 133 국가대표 선발 판정 (`0x1a090`). 연차 idx 는 **끝난 해**의 것이라 새 시즌을 올리기 전에 본다 */
  const enterNewSeasonStep = (viewed: PlayerCareer) => {
    if (!isCareerNationalCupYear(viewed.season - 1)) return startNewSeason(viewed)
    atoms.set(rawCareerAtom, viewed)
    setScreen({ kind: '이벤트', eventId: careerNationalTeamEventId(achievedGoalCount(viewed, '연말')), context: '시즌' })
  }

  /** 국가대표 이벤트(461~464)는 연말 사슬 밖이다 — 상태 133 이 따로 예약한 것이라 먼저 가른다. 아니면 false */
  const continueNationalTeamEvent = (viewed: PlayerCareer, viewedEventIds: readonly number[]): boolean => {
    if (viewedEventIds.includes(NATIONAL_CUP_EVENT.출전)) {
      // 463 출전 — 상태 133 이 `0xb7bf1(L)` 로 대회를 세우고 순위 화면 134 를 줄에 넣는다.
      // 134 의 틀 0x1b92c 머리가 들어온 첫 틀(장면+0x2c == 1)에 비트 8 이 없으면 칭호 8 "국가 대표" 팝업 — 화면이 띄우고
      // 확인(0x1b1e4)이 준다(`confirmCupTitle`). 진입 0x19f30 의 히든 팀 열기도 화면 몫이다(`syncOpenedHidden` 로 넣는다)
      // 0xb7bf0 대회 레코드 두 칸(+0xbc4 대표팀 · +0xbe0 첫날 상대) + 133 의 0xb53f1 — 대표팀 내 칸 t 에 내 선수 · 저장.
      // 463 보상 뒤 0x8cca2 — S+0x50 = 3(웹 null) · S+0x12c = 1 → 0x8cd44 저장: 대회 칸(L+0xa8~)째 파일에 든다(`nationalCup`)
      const entered = withNationalCupEntered(viewed)
      atoms.set(rawCareerAtom, entered)
      setScreen({ kind: '국가대항전', cup: entered.nationalCup ?? createNationalCup() })
      return true
    }
    if (!viewedEventIds.includes(NATIONAL_CUP_EVENT.거절) && !viewedEventIds.includes(NATIONAL_CUP_EVENT.탈락)) return false
    // 464 거절은 `S+0x12c = 0` 으로 바로 새 시즌이다 (P5 요약, 확정).
    // 462 탈락도 원본대로 새 시즌이다 — 114 틀 0x1c014 의 1c0a0~1c0b8 이 뒤 상태가 105 여도 관리자 +0x305/+0x306 이
    // 서 있으면 새 시즌 처리 `0x1b768` 로 간다(462 는 +0x306 갈래). 예전 "근사" 주석은 이 갈래를 못 본 것이다.
    startNewSeason(viewed)
    return true
  }

  return (viewed: PlayerCareer, viewedEventIds: readonly number[], endingRequested = false) => {
    if (continueNationalTeamEvent(viewed, viewedEventIds)) return
    const step = nextSeasonStep(viewed, viewedEventIds, endingRequested)
    if (step.kind === '포스트시즌') return enterPostseason(viewed)
    if (step.kind === '이벤트') {
      // 상태 함수가 이벤트를 틀기 전에 하는 일 — 131 은 375 앞에서 MVP 비트를 남긴다
      atoms.set(rawCareerAtom, enterSeasonEvent(viewed, step.eventId))
      return setScreen({ kind: '이벤트', eventId: step.eventId, context: '시즌' })
    }
    if (step.kind === '엔딩') return enterEnding(viewed, step.endingIndex)
    // 방출·13년차 은퇴는 위 '엔딩' 가지에서 이미 빠졌다
    if (step.kind === '새시즌') return enterNewSeasonStep(viewed)
    atoms.set(rawCareerAtom, viewed)
    setScreen({ kind: '관리' })
  }
}
