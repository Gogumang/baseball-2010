import type { ReactNode } from 'react'
import type { Collection, HallOfFameResult } from '@/entities/collection/model/collection'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { HallOfFameNariPlayer } from '@/pages/special/ui/SpecialScreen'
import type { PitcherAceMatch, PitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { useGameSettings } from '@/app/model/useGameSettings'

export interface PitcherLeagueRouteProps {
  readonly session: PitcherLeagueSession
  readonly random: RandomPort
  readonly openedHiddenIds?: readonly number[]
  /** 경기 중 메뉴 "설정" 칸 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  /** 메인 메뉴로 나간다 — `openTier` 5 는 전역 [0x140006c] = 5(게임시작 목록으로 바로, 105 취소 0x126e6). 없으면 처음 단 */
  readonly onExit: (openTier?: 5) => void
  /** 명예의 전당 등록 목록 (나리 상태 145, 모드 3) — 기록연감·칸 5 나리 타자·등록 (G·통계는 App 이 지갑으로 치른다) */
  readonly hallOfFame?: {
    readonly collection: Collection
    readonly nariBatter: HallOfFameNariPlayer | null
    readonly register: (career: PitcherCareer, slot: number | null) => HallOfFameResult['kind']
    /**
     * 완료 창(꼬리표 0x30)을 닫았을 때 0x1ca4c 가 여는 히든 17(전광판 "고대의전광판") — 열고 알림을 띄웠으면 참이고
     * 그 창을 닫을 때 `then` 을 부른다 (`SpecialScreen` 등록 모드의 같은 이름 머리말)
     */
    readonly openRegisteredHidden?: (then: () => void) => boolean
    /** 전역 G(`mgr+0x64`) — 등록 목록(상태 145) 머리띠 0x54d95 가 그린다 */
    readonly gamePoint?: number
  }
  /**
   * 마선수 대결 화면 — 투수 미션 레코드(team − 1)를 사람이 던지는 미션 장면(모드 5). 끝나면 `onFinish(이겼나)`.
   */
  readonly renderAceMatch: (match: PitcherAceMatch, onFinish: (isWin: boolean) => void) => ReactNode
}
