import { useEffect, useEffectEvent } from 'react'
import { RawScreen } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { SeasonTeamCard } from '@/pages/season/ui/SeasonTeamCard'
import type { TeamInfoRow } from '@/pages/season/lib/seasonTeamInfo'
import { SkinBackdrop } from './seasonTeamInfoScreen/otherSlices'
import { SeasonTeamInfoPanel } from './seasonTeamInfoScreen/SeasonTeamInfoPanel'

export { SeasonTeamInfoPanel } from './seasonTeamInfoScreen/SeasonTeamInfoPanel'

export interface SeasonTeamInfoScreenProps {
  readonly teamId: number
  /** 팀 레코드 +4 · +6 · +8 · +0xa — 팀 도형 0x5aefc 종류 0 */
  readonly teamAbilities: readonly number[]
  /** 정보 칸 일곱 줄 — `seasonTeamInfoRowsOf` */
  readonly rows: readonly TeamInfoRow[]
  readonly gamePoint?: number
  /** 딱지 [gfx+0x168] — 이 장면에서 팀 고르기 0xca · 트레이드 0xe4 를 거쳤는가 (`seasonPlayerCard.ts` 머리말) */
  readonly hasCardBadge?: boolean
  /** 0x4884 — 취소(−16) → 0xcd */
  readonly onBack: () => void
}

/**
 * **구단정보 0xd5** — 카드 0x7ba44(로고 · 팀 이름 · ABILITY · 팀 도형) + 정보 칸 0x7c450(일곱 줄).
 * 값과 차례는 `pages/season/lib/seasonTeamInfo.ts` 머리 주석(직접 떴다).
 *
 * 카드 0x7ba44 의 0xd5 갈래 (직접 떴다):
 * ```
 * 0x76725([gfx+0x134])                      ; 계단형 판 — 들어옴 0x5324 가 0x76705([장면+0xc4], 0x67, 0x38, 0) (0x53c6~0x53d4)
 * 로고 [gfx+0x140] (W/2 − w/2 − 0x3e, H/2 − h/2 − 0x32) 0xba1d5(…, 0, 0, 0)   ; 0xd9 · 0xdc 밖이라 효과 0 (0x7bb20~0x7bb70)
 * [gfx+0x168] 이 있으면 로고 아래 · 위 딱지 — 팀 이름은 이 안에서만 그린다 (0x7bbca~0x7bdca, `SEASON_CARD_BADGE`)
 * mode_ui 8 (W/2 + 0x3a − w/2, H/2 − 0x6b) · img_text 159 (…, H/2 − 0x42 − 0x25)   ; 0x7bdce~0x7bea4
 * 0x5aefd(skin, W/2 + 0x3a, H/2 − 0x42 + 10, 종류 0, 팀 레코드, idx 0, 0x1e)    ; 0x7becc 상태 0xd5 → 0x7bf9c (리터럴 0x7c100)
 * ```
 * 0x5aefc 종류 0 은 ABILITY 판 전체(둥근 바탕 · 축 이름 상자 img_text 46 · 45 · 204 · 205 · 숫자)다 — `SeasonTeamCard` → `AbilityRadarPanel`.
 * 이름 입력 0xc8(그림 0xba28)도 같은 카드 갈래라 `SeasonTeamCard` 를 같이 쓴다.
 * 구장 줄은 흐르는 글 0x5a8c8 (`StadiumTicker`).
 */
export function SeasonTeamInfoScreen({ teamId, teamAbilities, rows, gamePoint = 0, hasCardBadge = false, onBack }: SeasonTeamInfoScreenProps) {
  const latestBack = useEffectEvent(onBack)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Backspace') return
      event.preventDefault()
      latestBack()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <RawScreen>
      {/* 공통 앞그림 0xb810 — 0xd5 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      <div role="group" aria-label="구단정보">
        <SeasonTeamCard teamId={teamId} teamAbilities={teamAbilities} hasCardBadge={hasCardBadge} testIdPrefix="구단정보" />
        <SeasonTeamInfoPanel rows={rows} />
      </div>
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={onBack} footer={5} slides={false} />
    </RawScreen>
  )
}
