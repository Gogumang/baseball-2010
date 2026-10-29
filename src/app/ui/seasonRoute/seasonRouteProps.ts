import type { RandomPort } from '@/shared/api/random/randomPort'
import type { useGameSettings } from '@/app/model/useGameSettings'
import type { SeasonSession } from '@/app/model/useSeasonSession'
import type { HallOfFameNariPlayer } from '@/pages/special/ui/SpecialScreen'
import type { Collection, HallOfFameSide } from '@/entities/collection/model/collection'
import type { SeasonEntryBatterRecord, SeasonEntryPitcherRecord } from '@/entities/season-mode/model/seasonEntry'

export interface SeasonRouteProps {
  readonly session: SeasonSession
  readonly random: RandomPort
  /** 경기 중 메뉴 "설정" 칸과 자동진행 G 검사에 쓴다 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  /**
   * 시즌모드에서 나간다 — 메인 메뉴로 (원본은 `0xbc290(앱, 0x103)`). `openTier` 5 는 전역 [0x140006c] = 5(게임시작 목록으로 바로 —
   * 관리 메뉴 0xc9 취소 0x8f5a). 없으면 처음 단
   */
  readonly onExit: (openTier?: 5) => void
  /**
   * 마선수 오픈 플래그(`mgr[0x30..0x39]`)·레벨(`mgr[0x13a..]`)과 오픈·레벨업 처리 — 경기 전 마선수 고르기
   * 0xd7 이 일반모드 상태 21 과 **같은 전역 칸**을 본다(0xa248 의 `저장[0x30 + 칸]`). 앱의 `aceSelect` 를
   * 그대로 넘기면 된다. 안 넘기면 새 저장 기본 개방분(싸이커·메디카)만 열려 있고 오픈·레벨업이 안 된다.
   */
  readonly aceSelect?: {
    readonly openedAcePitcherIds: readonly number[]
    readonly openedAceBatterIds: readonly number[]
    readonly levels: Readonly<Record<number, number>>
    readonly onOpenAce: (cell: number) => void
    readonly onLevelUp: (cell: number, cost: number) => void
    /** 경기 전 0xd7(목록 k 2 = 격자 종류 7)에서 열 칸이 다 열렸으면 히든 팀 외인구단 12 (0x7b408) */
    readonly onAllAcesOpen?: () => void
  }
  /**
   * 기록연감의 명예의 전당 — 선수영입(0xe2 → 0xdf) 후보 칸 1~4(투수 +0x880)·6~(타자 +0x940). 안 넘기면 빈 칸이다.
   * 앱의 `collection.collection` 을 그대로 넘기면 된다.
   */
  readonly hallOfFame?: Collection
  /**
   * 장비 창 0xdc 의 적용 0x7d90 이 명예 선수(0xb6348)의 장비를 산 뒤 0x2328c 로 명전 기록에도 니블을 옮긴다.
   * 앱의 `collection.syncSeasonHallOfFameEquipment` 를 넘기면 된다. 안 넘기면 명전 기록은 그대로다.
   */
  readonly onHallOfFameEquipment?: (side: HallOfFameSide, recordId: number, nibbles: readonly number[]) => void
  /**
   * 선수영입 확정 0xc554 의 c578 `0xb6605(원본, j)` — 명전 칸에서 영입하면 그 **명전 기록**의 +0xa 아랫 5비트를 고른 자리 j 로 고치고
   * 0x22755 → 0x1f1b8 이 전역 블록째 저장한다(홈런더비 · 타자 미션의 k 가 이 값). 앱의 `collection.syncSeasonHallOfFameRecruit`.
   * 나리 칸은 그 저장을 쓰지 않고 풀어 남지 않는다 — 부르지 않는다. 안 넘기면 명전 기록은 그대로다.
   */
  readonly onHallOfFameRecruit?: (side: HallOfFameSide, recordId: number, recordSlot: number) => void
  /**
   * 영입 목록 나리 칸 0·5 (0x5eb8c 목록 종류 0 — 나리 투수편·타자편 저장이 있으면 상태 1, 없으면 2).
   * 안 넘기면 둘 다 없음(상태 2)으로 그린다.
   */
  readonly nari?: { readonly 투수: HallOfFameNariPlayer | null; readonly 타자: HallOfFameNariPlayer | null }
  /**
   * 나리 칸 0·5 를 고르면 영입할 기록 — `0x22168` · `0x220ec` 가 주는 나리 저장의 내 선수 기록(이름·0xb6414·레퍼토리·보직).
   * 앱이 `seasonNariPitcherRecordOf` · `seasonNariBatterRecordOf` 로 만든다. 없으면 그 칸은 영입 후보가 없다.
   */
  readonly nariRecords?: {
    readonly 투수: SeasonEntryPitcherRecord | null
    readonly 타자: SeasonEntryBatterRecord | null
  }
}
