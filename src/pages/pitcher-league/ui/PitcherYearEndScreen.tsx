import { MenuList, Notice, Panel, PixelScreen } from '@/shared/ui'
import type { MenuItem } from '@/shared/ui'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'

/**
 * 나만의리그 **투수편 연말 — 은퇴 선택**(원본 상태 132 `0x10c54` 의 이벤트 **502**).
 *
 * 7~12년차 연말에 나오는 갈림길이다. 원본은 대사 세 줄 뒤에 선택지 두 개를 띄우고
 * "연봉 협상한다" → 380(다음 연차), "은퇴한다" → 496 → 503 → 엔딩 화면 141 로 간다
 * (B-season-awards.md 6절 "연말 분기(상태 132)" · `events.json` 의 502·496·503).
 *
 * 연말 사슬은 이제 이벤트 재생기(114, `StoryScreen`)가 502 를 대사·선택지 그대로 튼다 — 이 화면은 같은
 * 갈림길을 한 장으로 보여 주는 곁길이다. 고르면 원본 선택지의 gotoEvent 와 같은 이벤트로 간다:
 * "연봉 협상한다" → 380, "은퇴한다" → 496(“정말로 은퇴하려는 거냐?”).
 */
export function PitcherYearEndScreen({
  career,
  onContinueCareer,
  onRetire,
}: {
  readonly career: PitcherCareer
  /** "연봉 협상한다" — 이벤트 380 (연봉협상) */
  readonly onContinueCareer: () => void
  /** "은퇴한다" — 이벤트 496 (→ 503 → 엔딩 화면 141) */
  readonly onRetire: () => void
}) {
  // 원본 502 의 선택지 글 그대로 (색 마크업은 뺀다)
  const items: readonly MenuItem[] = [
    { id: '계속', label: '연봉 협상한다 (다음연차 진행)' },
    { id: '은퇴', label: '은퇴한다 (명예의 전당 등록)' },
  ]

  return (
    <PixelScreen title={`${career.season}년차 연말`}>
      <Panel heading={<>{career.name} 선수</>}>
        <Notice>아직 할 것이 남은 것 같기도 하고... 어떡하지?</Notice>
      </Panel>
      <MenuList items={items} onSelect={(id) => (id === '은퇴' ? onRetire() : onContinueCareer())} />
    </PixelScreen>
  )
}
