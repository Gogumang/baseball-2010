import type { ManagementCommand } from '@/pages/management/ui/ManagementScreen'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { restBlockReasonOf, runRest } from '@/entities/career/model/outing'
import { restResultTextOf } from '@/entities/career/model/trainingText'
import { restDetailChangesOf } from '@/pages/management/lib/detailPopup'
import { EVENT_TRIGGER } from '@/entities/story/model/storyScene'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { isAutoScanHeldByAceMatch } from '@/app/model/aceMatchScanGuard'
import type { CareerStoryScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'
import * as uiAtoms from '@/app/model/careerSession/atoms/uiAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import { useMatchPrepare } from '@/app/model/careerSession/nextGame/useMatchPrepare'

/** 105 관리 메뉴 커맨드 — [다음경기] · [휴식] · [외출] (그림마다 새 함수 — 옛 꼴 그대로) */
export function useRunCommand(scope: CareerStoryScope): (command: ManagementCommand) => void {
  const { atoms, random, setScreen, story } = scope
  const career = useShownCareer(scope)
  const { enterNextGameStandings } = useMatchPrepare(scope)

  /** 원작 [휴식] 커맨드 — 사기를 회복한다. 105 키 0x1261c 12682~126bc 는 사기 최고만 본다(행동함은 안 본다) */
  const rest = (current: PlayerCareer) => {
    if (restBlockReasonOf(current) !== null) return atoms.set(uiAtoms.managementNoticeAtom, ORIGINAL_MODE_TEXT[91] ?? '') // StrMODE[91] (1269a)
    // 관리 화면은 팝업 0x2a "예" 뒤 127 연출(0x85230, `RestScene`)이 끝난 틀에 이 길을 부른다 — 0x19080 → 0x18e3c 의
    // 굴림 · 결과 창 · 저장이 연출 뒤라서다(연출에는 난수가 없어 굴림 차례는 그대로다)
    const rested = runRest(current, random)
    atoms.set(rawCareerAtom, rested.career)
    // StrMODE[24] "사기" + " " + 수치 + [83] (0x18e3c — 원문 표, 색 마크업 그대로)
    atoms.set(uiAtoms.managementDetailAtom, {
      before: current,
      after: rested.career,
      messages: [restResultTextOf(rested.moraleGain)],
      // 변화량 칸은 굴린 회복값 그대로 — 100 에서 잘리기 전 [sp+0x10] (0x18fb4)
      changes: restDetailChangesOf(rested.moraleGain),
      afterClose: { kind: '휴식' },
    })
  }

  /** [외출] — 105 에서 112 외출 지도로 */
  const goOuting = (current: PlayerCareer) => {
    // B-26 — 105 에서 지도로 들어설 때의 행동함을 떠 둔다(취소 `leaveOutingMap` 이 되돌린다)
    atoms.set(uiAtoms.outingEntryActedAtom, current.hasActedThisCycle)
    atoms.set(uiAtoms.outingNoticeAtom, '')
    atoms.set(uiAtoms.outingResultAtom, null)
    atoms.set(uiAtoms.outingPresentationAtom, null)
    // 112 진입 0x118e4 → 0x8cdc0 이 커서를 0 으로 되감은 **뒤에** 자동 발동 0x1cf9c 가 훑는다 — 웹은 그 훑기를 화면을
    // 바꾸기 전에 하므로 되감기를 먼저 한다
    story.rewindCursor()
    // trigger 1 — 외출 지도에 들어설 때 먼저 보는 이벤트. 0x1cf9c 는 112 에서도 105 와 같은 0x8be80 이라 무작위 조건까지
    // 굴린다(지금 trigger 1 이벤트에는 무작위 조건이 없어 굴림은 안 생긴다). 대결 대기 가드 1cfe4~1d008 도 같다(B-124)
    const isHeld = isAutoScanHeldByAceMatch(atoms.get(portsMirrorAtom).current.aceMatchHold)
    const event = isHeld ? null : story.eventFor(current, EVENT_TRIGGER.외출, random)
    setScreen(event === null ? { kind: '외출' } : { kind: '이벤트', eventId: event.id, context: '외출진입' })
  }

  return (command: ManagementCommand) => {
    if (career === null) return
    // 알림은 [확인] 을 눌러야 지워진다 — "다음경기 때까지 남긴다" 는 원본 근거가 없어 없앴다
    // [다음경기](105 칸 5) → 109 순위표 (R9). 확인하면 142 → 경기 (웹은 142 없이 곧바로 경기)
    if (command === '다음경기') return enterNextGameStandings(true)
    if (command === '휴식') return rest(career)
    if (command === '외출') goOuting(career)
  }
}
