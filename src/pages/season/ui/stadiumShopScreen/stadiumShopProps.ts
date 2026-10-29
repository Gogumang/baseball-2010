import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import type { StadiumPreviewScene } from '@/pages/season/lib/stadiumPreviewScene'

export interface StadiumShopScreenProps {
  readonly record: SeasonRecord
  /**
   * **상점**(구단관리 → 아이템 창 종류 4, 키 0x957c)인가,
   * **구장관리**(구단관리 하위 칸 0, 키 0x7958)인가. 기본은 상점이다.
   */
  readonly mode?: '상점' | '구장관리'
  /** 히든 칸 해금 여부 — `app[0xe0 + 종류×4 + (칸−4)]` (S3 7절). 없으면 전부 잠긴 것으로 본다 */
  readonly isHiddenOpen?: (unlockId: number) => boolean
  /** 사거나 바꾼 뒤의 레코드. 저장(0x22755)은 부르는 쪽이 한다 */
  readonly onChange: (record: SeasonRecord) => void
  /** 컬렉터 해금 id (관중석 13 · 전광판 16) 를 새로 열었다 — 구매 완료 팝업이 닫힐 때 0x81d0 */
  readonly onUnlock?: (unlockIds: readonly number[]) => void
  /** 취소(−16) — 상점은 아이템 메뉴로, 구장관리는 구단관리(0xce)로 되돌아간다 */
  readonly onBack: () => void
  /** 머리띠 G포인트 */
  readonly gamePoint?: number
  /**
   * 장면 구장 칸(하늘 줄 +0x10 · 하늘 칸 +0x18 · 전광판 글자 +0x8c) — 장면 0x105 가 사는 동안 남는다(`StadiumPreviewScene`).
   * 들어올 때 이 값으로 서고, 구장관리 진입은 하늘을 새로 잰다. 생략하면 막 세운 장면(모두 0)
   */
  readonly previewScene?: StadiumPreviewScene
  /** 이 화면이 바꾼 장면 구장 칸 — 구장관리는 들어올 때 하늘을, 상점은 나갈 때 전광판 글자 자리를 돌려준다 */
  readonly onPreviewSceneChange?: (scene: StadiumPreviewScene) => void
}
