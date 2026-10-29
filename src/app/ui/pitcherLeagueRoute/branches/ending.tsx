import type { ComponentProps, ReactNode } from 'react'
import { EndingScreen } from '@/pages/ending/ui/EndingScreen'
import { isContinuablePitcherEnding, pitcherEndingBonusOf } from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { nariPitcherOf } from '@/app/model/useCollection'
import type { PitcherBranchInput } from '@/app/ui/pitcherLeagueRoute/branchInput'

/** 등록 목록 머리띠의 전역 G · 완료 창 뒤 히든 17 — 안 넘겼으면 빼 둔다 */
function hallOfFameExtrasOf(hallOfFame: PitcherBranchInput['hallOfFame']) {
  return {
    ...(hallOfFame?.gamePoint === undefined ? {} : { gamePoint: hallOfFame.gamePoint }),
    ...(hallOfFame?.openRegisteredHidden === undefined ? {} : { openRegisteredHidden: hallOfFame.openRegisteredHidden }),
  }
}

/** 명예의 전당 145 — 모드 3 은 투수 칸(+0x880, 기본 2칸)에 0x1f654 로 넣는다 */
function endingHallOfFameOf({ hallOfFame, career, actions }: PitcherBranchInput): ComponentProps<typeof EndingScreen>['hallOfFame'] {
  return {
    collection: hallOfFame?.collection ?? EMPTY_COLLECTION,
    edition: '투수',
    nari: { 투수: nariPitcherOf(career), 타자: hallOfFame?.nariBatter ?? null },
    // 등록이 된 그 순간 0x62dbe 가 모드 저장을 지운다(0x224ec) — 완료 창을 닫기 전이다
    onRegister: (slot) => {
      const result = hallOfFame?.register(career, slot) ?? '빈칸없음'
      if (result === '등록') actions.eraseSaveForHallOfFame()
      return result
    },
    ...hallOfFameExtrasOf(hallOfFame),
  }
}

export function endingBranch(input: PitcherBranchInput): ReactNode {
  const { session, onExit, career, scene, actions } = input
  // 방출 이어하기 뒤 아홉 틀은 선수의 엔딩 칸이 이미 비었다 — 141 이 그리던 번호 그대로 (`heldEndingIndex`)
  const shownEndingIndex = career.endingIndex ?? session.heldEndingIndex
  if (scene !== '엔딩' || shownEndingIndex === null) return null
  const endingIndex = shownEndingIndex
  return (
    <EndingScreen
      playerName={career.name}
      isResumed={session.endingFromResume}
      endingIndex={endingIndex}
      seenEventIds={career.seenEventIds}
      bonusGamePoint={pitcherEndingBonusOf(endingIndex)}
      // S+0x7b — 141 로 이어하기한 엔딩은 보너스를 이미 받았다. 팝업 0x2b 를 닫을 때 보너스 · S+0x7b · 저장 (1bbf4~1bc70)
      isBonusReceived={career.endingBonusReceived === true}
      onBonusReceived={actions.receiveEndingBonus}
      isContinuable={isContinuablePitcherEnding(endingIndex)}
      // 선수 애니 바탕은 모드 3 이면 0 으로 고정이다 (endingLayout `endingWalkInAnimationOf`)
      walkInLook={{
        mode: PITCHER_EDITION_MODE,
        typeIndex: career.typeIndex,
        handIndex: career.handIndex,
        skinIndex: career.skinIndex,
      }}
      hallOfFame={endingHallOfFameOf(input)}
      onContinue={actions.continueAfterEnding}
      onFinish={(isRegistered) => {
        actions.finishEnding(isRegistered)
        // 141 끝 0x1bfd4 · 145 목록 0x1ca92 — 등록 여부와 상관없이 [0x140006c] = 5(게임시작 목록으로 바로)
        onExit(5)
      }}
    />
  )
}
