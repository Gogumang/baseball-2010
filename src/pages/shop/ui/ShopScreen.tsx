import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { EQUIPMENT_PARTS } from '@/entities/career/model/equipment'
import { purchaseQuestionOf } from '@/features/shop/model/shopSelection'
import type { ShopTab, GpDetailOf } from '@/features/shop/model/shopSelection'
import { shopEntriesOf, windowKindNameOf } from '@/pages/shop/lib/shopEntries'
import { batterEquipmentRowsOf } from '@/pages/shop/lib/equipmentRows'
import { currentTitleOf } from '@/entities/career/model/titles'
import { batterGpDetailViewOf } from '@/pages/shop/lib/gpDetailView'
import { BasicInfoCard, ManagementBoard } from '@/pages/shop/ui/shopScreen/otherSlices'
import { ShopScreenView } from '@/pages/shop/ui/shopScreen/ShopScreenView'

interface ShopScreenProps {
  /** 관리 화면 [아이템] 하위 메뉴에서 고른 탭 */
  readonly initialTab: string
  readonly career: PlayerCareer
  readonly noticeText: string
  /** GP 칸 0~4·6 을 산 뒤의 상세 결과 창 재료 (`selectShopItem` 의 detail) */
  readonly gpDetail?: GpDetailOf<PlayerCareer> | null
  readonly onCloseGpDetail?: () => void
  readonly onPurchase: (itemId: string) => void
  readonly onBack: () => void
}

const TABS: readonly ShopTab[] = ['장착', '서브', 'GP', '착용']

/**
 * 상점·아이템 창 (0x8453c). 관리 화면 [아이템] 의 네 갈래가 모두 여기로 온다 (R12 1a):
 *   창 종류 1 서브아이템 · 2 GP아이템 → 0x81dc0 (mode_ui 프레임 33 박스 6개 + 프레임 34 격자 10칸, `ShopWindow`)
 *   창 종류 3 장비 상점(111) · 장비착용(121) → **0x83378** (mode_ui 프레임 30 — `EquipmentWindow`)
 *   — 0x8453c 는 `[창+0x1a4] == 3` 이면 0x83378, 아니면 0x81dc0 이다(0x84546). 종류 4 구장 아이템도 0x83378 이고
 *     시즌 구단관리(0xb158)가 직접 부른다 — 웹에 아직 데이터가 없어 좌표만 `shopLayout.STADIUM_BOXES` 에 있다.
 *
 * 앞그림 0x16a34 → 0x16928 이 공 무늬 바탕 0x5fd61 을 깔고(142~144 밖 — 상점도), 그리기 0x167cc:
 * 종류 3 이면 창 → 기본정보 카드 0x15e20(선수 그림 · 레이더, 정보 칸은 건너뜀) → 머리띠,
 * 그 밖이면 상태판 0x7d34c(gfx, 0) → 커맨드 줄 0x7e418(gfx, 틱) → 창 → 머리띠 (`statusPanel` · `NariItemCommandBar`).
 */
export function ShopScreen({ initialTab, career, noticeText, gpDetail = null, onCloseGpDetail, onPurchase, onBack }: ShopScreenProps) {
  const tab = TABS.find((candidate) => candidate === initialTab) ?? '장착'
  const isEquipment = tab === '장착' || tab === '착용'
  return (
    <ShopScreenView
      kind={windowKindNameOf(tab)}
      entriesOf={() => (tab === '서브' || tab === 'GP' ? shopEntriesOf({ tab, career }) : [])}
      // 0x7d34c(gfx, 0) — 둘째 인자 0 이라 전 경기 표시 없음
      // oxlint-disable-next-line react/purity -- 원본처럼 그릴 때마다 지금 시각(시)을 읽는다 (ESLint react-hooks/purity 는 못 잡던 자리)
      statusPanel={<ManagementBoard career={career} titleName={currentTitleOf(career)} hour={new Date().getHours()} />}
      equipment={
        isEquipment
          ? {
              edition: '타자',
              rowsOf: (part) => batterEquipmentRowsOf(career, part, tab === '착용'),
              // 0x15e20 의 타자 갈래 — 그림 객체를 (박스 가운데, 박스 아래 − 10) 에 그린다. 줄을 훑으면 그 장비를 끼워 보인다(0x81938)
              preview: (part, level) => (
                <BasicInfoCard
                  career={career}
                  showsInfoTable={false}
                  figureEquipment={
                    level === null
                      ? undefined
                      : {
                          ...career.equipmentLevels,
                          [EQUIPMENT_PARTS[part].ability]: level + 1,
                        }
                  }
                />
              ),
            }
          : undefined
      }
      questionOf={(itemId) => purchaseQuestionOf(career, itemId)}
      money={career.money}
      gamePoint={career.gamePoint}
      title="나만의리그타자편"
      noticeText={noticeText}
      detail={gpDetail === null ? null : batterGpDetailViewOf(gpDetail)}
      onCloseDetail={onCloseGpDetail}
      onPurchase={onPurchase}
      onBack={onBack}
    />
  )
}
