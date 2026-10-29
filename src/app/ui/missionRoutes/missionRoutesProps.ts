import type { Screen } from '@/app/model/screen'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { useMissionSession } from '@/app/model/useMissionSession'
import type { HallOfFameNariPlayer } from '@/pages/special/ui/SpecialScreen'
import type { Collection } from '@/entities/collection/model/collection'
import type { ModeBatter } from '@/app/model/modeBatter'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitchControl } from '@/entities/settings/model/gameSettings'
import type { useGameSettings } from '@/app/model/useGameSettings'

export interface MissionRoutesProps {
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  readonly session: ReturnType<typeof useMissionSession>
  readonly runner: AtBatRunner
  readonly random: RandomPort
  /** 치는 육성 타자 — 0xb6414 능력치와 장착 스킬 (`modeBatterOf`). 명예 타자를 고르면 세션의 `hallOfFameBatter` 가 대신한다 */
  readonly batter: ModeBatter
  /** 선수 고르기 창(하위 17)이 그리는 명예의 전당 칸 */
  readonly hallOfFame: Collection
  /** 선수 고르기 칸 0·5 의 나리 투수·타자 (투수편·타자편 저장, `nariPitcherOf` · `nariBatterOf`) — 없으면 null */
  readonly nari: { readonly 투수: HallOfFameNariPlayer | null; readonly 타자: HallOfFameNariPlayer | null }
  /** 경기 중 메뉴 "설정" 칸 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  readonly pitchControl: PitchControl
  /**
   * 선수 고르기 창(하위 17) 머리띠의 G포인트 — 전역 기록 `mgr+0x64` (App 의 지갑 `wallet.balance`).
   * 머리띠 0x54d95 는 제목이 −1 이 아니면 G포인트(0x54a60)를 늘 그린다. 안 넘기면 머리띠를 예전(명예의 전당 띠)대로 둔다.
   */
  readonly gamePoint?: number
}
