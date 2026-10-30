import { useState } from 'react'
import { useListPageEntry } from '@/widgets/screen-frame/model/useListPageEntry'
import { RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { isTeamOpen } from '@/pages/create-player/lib/teamSelectLayout'
import { useGridCursorBounce } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import { SkinBackdrop } from './teamSelectScreen/otherSlices'
import { TeamAbilityChart } from './teamSelectScreen/TeamAbilityChart'
import { TeamAnchorA, TeamTags } from './teamSelectScreen/TeamAnchors'
import { TeamGrid } from './teamSelectScreen/TeamGrid'
import { TeamSelectFrame } from './teamSelectScreen/TeamSelectFrame'
import { TEAM_GRID_OPEN } from './teamSelectScreen/teamSelectAssets'
import type { TeamSelectScreenProps } from './teamSelectScreen/teamSelectProps'
import { isTeamSelectable, useTeamSelectKeys } from './teamSelectScreen/useTeamSelectKeys'

/**
 * 팀 고르기 (나만의리그 상태 **0x65** — 진입 0x10790 · 그리기 0x14114 → 공용 목록 0x63b15 의 k=0,
 * 본문 0x63dee. P6 2a-1·2a-2 확정).
 *
 * 고른 팀의 로고가 A 에, 능력치 도형이 B 에 뜨고 아래에 15팀 격자가 깔린다.
 * 히든 다섯 팀(10~14 — 국가대표 넷과 외인구단)은 해금 전까지 파란 원 두 개와 `???` 로 가린다.
 *
 * 격자 칸 배치(0x79ed5 · 0x7a571)와 칸 그림(종류 9 — 0x7b2ae)은 확정이다 (`lib/teamSelectLayout` · 위 CELL_* 머리말).
 * 능력치 도형은 0x5aefc 종류 0 의 ABILITY 판 전체다 (아래 `TeamAbilityChart` — 값 도형 채우기 0x75c70 · 테두리 0x75dc4 까지 풀렸다).
 */
export function TeamSelectScreen({
  openedHiddenIds = [],
  title,
  gamePoint,
  gridShape,
  onSelect,
  onSelectLocked,
  onCancel,
  overlay,
  coveredTeamId,
  hiddenTeamsSelectable = true,
  initialCursor = 0,
  isEntryAnimated = true,
}: TeamSelectScreenProps) {
  const [cursor, setCursor] = useState(initialCursor)
  const team = TEAMS[cursor] ?? TEAMS[0]
  const isOpen = isTeamOpen(cursor, openedHiddenIds)

  // 머리띠가 미끄러지는 동안은 본문이 없고, 본문 첫 그림에 지은 격자가 열림 애니(0x79fa8)를 다 돌 때까지 키 함수가
  // [skin+0xe4] == 0 을 보고 아무것도 안 한다 (`useListPageEntry`). 격자 시작 애니 = [skin+0xe8] — 넷째 인자가 1 이면 켜고, 0 이면
  // (일반모드 18 ↔ 19 사이) 머리띠도 안 미끄러지고 격자도 곧바로 다 연다 (`isEntryAnimated`, r333)
  const entry = useListPageEntry({ slides: isEntryAnimated, grid: { shape: TEAM_GRID_OPEN, isAnimated: isEntryAnimated } })
  const { keyLock } = entry
  const gridOpen = entry.grid
  // 격자 시작 0x7a005(격자, [skin+0xe8], 1, 1) — 셋째 인자 [격자+6] = 1 이라 커서 튕김이 있다 (0x6409c)
  const bounce = useGridCursorBounce()
  useTeamSelectKeys(cursor, setCursor, keyLock, bounce.start, {
    gridShape,
    openedHiddenIds,
    hiddenTeamsSelectable,
    onSelect,
    onSelectLocked,
    onCancel,
  })
  const pressCell = (index: number) => {
    if (isTeamSelectable(index, openedHiddenIds, hiddenTeamsSelectable)) return onSelect(index)
    setCursor(index)
    onSelectLocked?.(index)
  }

  return (
    <RawScreen>
      {/*
        공 무늬 바탕 0x5fd61(skin, 0, 0, W, H) — 이 화면을 쓰는 모든 자리가 목록보다 먼저 깐다:
        일반모드 18 · 19 그림 0x2de3c · 0x2ddb0 (맨 앞에서 직접) · 나만의리그 타자편/투수편 0x65 (장면 틀 0x16a34 → 0x16928, 142~144 밖) ·
        시즌 0xca · 트레이드 0xe4 (공통 앞그림 0xb810, 0xdd · 0xe0 · 0xe1 밖 → 0xb864). 공용 목록 0x63b15 는 화면을 칠하지 않는다
      */}
      <SkinBackdrop kind="공무늬" />
      {gridOpen !== null && (
        <>
          <TeamTags />
          <TeamAnchorA cursor={cursor} isOpen={isOpen} />
          {/* B — 능력치 도형. 잠긴 팀은 원본도 idx −1 을 넘겨 네 값을 0 으로 채운다 */}
          <TeamAbilityChart values={isOpen ? team.values.slice(2) : []} cursor={cursor} isOpen={isOpen} />
          <TeamGrid
            cursor={cursor}
            bounceOffset={bounce.offset}
            openState={gridOpen.state}
            openedHiddenIds={openedHiddenIds}
            coveredTeamId={coveredTeamId}
            onPressCell={pressCell}
          />
        </>
      )}

      <TeamSelectFrame title={title} gamePoint={gamePoint} slides={isEntryAnimated} onBack={onCancel} overlay={overlay} />
    </RawScreen>
  )
}
