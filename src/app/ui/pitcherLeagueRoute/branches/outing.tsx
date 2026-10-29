import type { ReactNode } from 'react'
import { SeasonOutingPopup } from '@/pages/season/ui/SeasonOutingPopup'
import { nariOutingPresentationOf } from '@/pages/season/lib/seasonOutingPopup'
import { portraitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'
import { OutingMapScreen } from '@/pages/outing-map/ui/OutingMapScreen'
import type { PitcherBranchInput } from '@/app/ui/pitcherLeagueRoute/branchInput'

/** 112 외출 지도 — 타자편 화면(`OutingMapScreen`)을 그대로 쓴다 (모드 3·4 같은 상태 · 같은 코드) */
export function outingBranch({ session, career, scene, actions }: PitcherBranchInput): ReactNode {
  if (scene !== '외출') return null
  return (
    <OutingMapScreen
      noticeText={session.outingNotice}
      onCloseNotice={actions.closeOutingNotice}
      onRun={actions.runOutingFunction}
      // 112 취소 → 105 (키 0x13ba4) — 원본 13bc0~13bca 는 S+4(행동함) = 0 으로 내린다(두 편 공용 키). B-26 고침이면 들어설 때 값으로
      onBack={() => {
        const acted = actions.actedAfterOutingCancel()
        if (career.hasActedThisCycle !== acted) actions.save({ ...career, hasActedThisCycle: acted })
        actions.goto('관리')
      }}
      // 장소 이벤트 배정 0x8cdc0 — 장소마다 파일 순서 첫 이벤트(대상 1·3)
      eventPlaceIds={session.eventPlaceIds}
      onEnter={actions.enterOutingPlace}
      // 빈 장소(440~444) 뒤는 113 그 장소 말풍선 · 113 취소는 112 에 다시 들어선다(Q-22)
      initialOpenPlaceId={session.outingReturnPlaceId}
      onCloseBubble={actions.reenterOutingMap}
      // 126 효과 팝업 → [확인] → 105 (입원 회복 글은 관리 화면 위 팝업으로)
      resultText={session.outingResult?.effectText ?? null}
      onCloseResult={actions.closeOutingResult}
      presentation={
        session.outingPresentation === null ? null : (
          <SeasonOutingPopup
            place={session.outingPresentation.place}
            presentation={nariOutingPresentationOf(session.outingPresentation.place, { isSlugger: false })}
            char0Palette={portraitPaletteIndex(career.skinIndex)}
            onFinished={actions.finishOutingPresentation}
          />
        )
      }
    />
  )
}
