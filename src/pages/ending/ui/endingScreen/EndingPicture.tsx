import { romanceEndingIndexOf, romanceEventsSeenOf } from '@/entities/career/model/seasonFlow'
import type { ModeBackSprite } from '@/shared/lib/phoneClock/useModeBackSprite'
import { LAST_WALK_IN_ENDING } from '@/pages/ending/lib/endingLayout'
import { EndingCredits } from './EndingCredits'
import { stageZeroCoverAt, type Phase } from './endingPhase'
import { DEFAULT_WALK_IN_LOOK, NO_EVENTS, type EndingScreenProps } from './endingProps'
import { RetirementEnding } from './RetirementEnding'
import { ShortEnding } from './ShortEnding'
import { StageZeroFrame } from './StageZeroFrame'

/**
 * 이 틀의 엔딩 판 — 단계 0 은 남은 앞 화면, 제작진(은퇴 엔딩 e 2~9 에만 있고 그 뒤 보너스·등록 팝업도 제작진 위에 뜬다 — 단계 > 2 의 키),
 * 부상·방출의 띠 창, 은퇴 엔딩의 그림 · 원형 전환 · 올라오는 글
 */
export function EndingPicture({
  props,
  phase,
  stage,
  tick,
  creditsAt,
  band,
}: {
  readonly props: EndingScreenProps
  readonly phase: Phase
  readonly stage: 0 | 1 | 2 | 3
  readonly tick: number
  readonly creditsAt: number | null
  readonly band: ModeBackSprite
}) {
  const { endingIndex } = props
  const walkInLook = props.walkInLook ?? DEFAULT_WALK_IN_LOOK
  const seenEventIds = props.seenEventIds ?? NO_EVENTS
  const romanceEndingIndex = romanceEndingIndexOf(endingIndex, seenEventIds)
  if (stage === 0) return <StageZeroFrame cover={stageZeroCoverAt(tick, props.isResumed === true)} />
  if (romanceEndingIndex !== null && phase !== '엔딩' && creditsAt !== null) {
    return (
      <EndingCredits
        romanceEndingIndex={romanceEndingIndex}
        romanceEvents={romanceEventsSeenOf(seenEventIds)}
        look={walkInLook}
        tick={Math.max(0, tick - creditsAt)}
        band={band}
      />
    )
  }
  if (endingIndex <= LAST_WALK_IN_ENDING) return <ShortEnding endingIndex={endingIndex} look={walkInLook} tick={tick} band={band} />
  return <RetirementEnding endingIndex={endingIndex} playerName={props.playerName} tick={tick} />
}
