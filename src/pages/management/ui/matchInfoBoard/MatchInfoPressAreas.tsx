import { PressArea } from '@/shared/ui'
import { MATCH_INFO_LAYOUT, MATCH_INFO_PLAY_BALL_PRESS_RECT, matchInfoLogoPressRectOf } from './otherSlices'
import { pressKey } from './matchInfoAssets'

/**
 * 원본에 없던 웹 단추를 걷고 **투명 누름 칸**으로 — 누르면 그 키를 보낸다(들어올 때 연출 중 키 막음도 키 처리 그대로).
 * 가운데 PLAY BALL 공 = OK, 두 엠블럼 = ←/→ 엔트리(엔트리 길이 있을 때만).
 */
export function MatchInfoPressAreas({ hasEntry }: { readonly hasEntry: boolean }) {
  return (
    <>
      <PressArea label="경기 시작" rect={MATCH_INFO_PLAY_BALL_PRESS_RECT} onPress={() => pressKey('Enter')} />
      {hasEntry && (
        <>
          <PressArea label="PLAYER 엔트리" rect={matchInfoLogoPressRectOf(MATCH_INFO_LAYOUT.anchorA)} onPress={() => pressKey('ArrowLeft')} />
          <PressArea label="COM 엔트리" rect={matchInfoLogoPressRectOf(MATCH_INFO_LAYOUT.anchorB)} onPress={() => pressKey('ArrowRight')} />
        </>
      )}
    </>
  )
}
