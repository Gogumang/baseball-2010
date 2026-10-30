import { useEffect, useEffectEvent, useState } from 'react'
import { addSkinStepCounter } from '@/shared/lib/skinStepCounter/skinStepCounter'
import { RawScreen } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { RankingBoard } from '@/pages/nari-record-room/ui/RankingBoard'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { moveRankingPage, rankingCategoriesOf } from '@/entities/season-mode/model/seasonRecordRanking'
import { nariRankingEntriesOf, nariRankingSideOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
import type { NariRecordEdition } from '@/pages/nari-record-room/lib/nariRecordRoom'
import { isCancelKey } from '@/pages/nari-record-room/ui/nariRecordRoom/yearRecordConstants'
import { SkinBackdrop } from '@/pages/nari-record-room/ui/nariRecordRoom/otherSlices'

/**
 * 순위 판 키 0x5787d 까지 가지만 쪽을 안 넘기는 키 — 0x1463c 의 '0' · '*' 버리기(1465e~14664)는 [+0x164] == 0(연도 기록) 갈래에만 있고
 * 순위([+0x164] ≠ 0 → 1465c 에서 14670)는 키를 가리지 않고 0x5787d 로 넘긴다(r168). 시즌 0xdb 의 0x74c4 와 같은 키 묶음.
 */
const RANKING_OTHER_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'Enter', '0', '1', '2', '3', '5', '7', '8', '9', '*', '#'])

interface NariRankingScreenProps {
  readonly edition: NariRecordEdition
  readonly career: PlayerCareer | PitcherCareer
  readonly title: '나만의리그타자편' | '나만의리그투수편'
  readonly gamePoint: number
  readonly onBack: () => void
}

/**
 * 124 둘째 갈래 — 0x5796c(나리 판 목록) · 키 0x5787d(좌·우로 쪽 [편집기+0x444], 끝에서 멈춘다 · 쪽이 바뀌면 다시 뽑는다).
 * 그림은 시즌 기록순위 0xdb 와 같은 함수다 — `RankingBoard`(배치 `lib/rankingBoard.ts` 머리말). 내 팀 = [편집기+0x448] = S[1].
 */
export function NariRankingScreen({ edition, career, title, gamePoint, onBack }: NariRankingScreenProps) {
  const side = nariRankingSideOf(edition)
  const [page, setPage] = useState(0)
  const latest = useEffectEvent(() => ({ onBack }))
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 0x1463c: 취소는 106 을 걸고도 아래로 흘러(14650) 순위 갈래(14670)에서 0x5787d(−16) 로 간다 — 쪽은 안 바뀌고
      // [편집기+0x40c] 만 += 1 (5793e~57948). 시즌 0xdb 의 0x74c4 는 취소를 0xcd 로 보내고 0x5787d 를 건너뛰는 것과 다르다(r168).
      // 그 밖의 키는 모두 0x5787d — 쪽이 바뀌든 말든 += 1.
      if (isCancelKey(event.key)) {
        addSkinStepCounter()
        latest().onBack()
      } else if (event.key === 'ArrowRight' || event.key === '6') {
        addSkinStepCounter()
        setPage((held) => moveRankingPage(side, held, 1))
      } else if (event.key === 'ArrowLeft' || event.key === '4') {
        addSkinStepCounter()
        setPage((held) => moveRankingPage(side, held, -1))
      } else if (RANKING_OTHER_KEYS.has(event.key)) addSkinStepCounter()
      else return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [side])

  const categories = rankingCategoriesOf(side)
  const category = categories[page] ?? categories[0]
  const entries = nariRankingEntriesOf(edition, career, page)
  return (
    <RawScreen>
      <SkinBackdrop kind="공무늬" />
      <div role="group" aria-label={`순위기록 ${side} ${category.label}`}>
        <RankingBoard
          kind={category.kind}
          kindLabelFrame={category.labelFrame}
          entries={entries}
          myTeamId={career.teamId}
          hasPreviousPage={page > 0}
          hasNextPage={page < categories.length - 1}
          testIdPrefix="순위기록"
        />
      </div>
      <ScreenFrame title={title} gamePoint={gamePoint} onBack={onBack} slides={false} />
    </RawScreen>
  )
}
