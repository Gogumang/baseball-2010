import { useEffect, useRef, useState } from 'react'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import { usePitcherManagementMenu } from '@/pages/pitcher-league/model/usePitcherManagementMenu'
import type { PitcherManagementMenu } from '@/pages/pitcher-league/model/usePitcherManagementMenu'
import { PitchChoicePopup } from '@/pages/pitcher-league/ui/PitchChoicePopup'
import { PITCHER_COMMAND_BAR } from '@/pages/pitcher-league/lib/pitcherCommandBar'
import {
  clearNariReturnSubMenu,
  createNariMainMenuCursor,
  leaveNariSubMenu,
  nariReturnSubMenuOf,
  NariRecordPickPopup,
  NariRecordView,
} from './pitcherManagementScreen/otherSlices'
import type { NariMainMenuCursor, RecordRoomPick } from './pitcherManagementScreen/otherSlices'
import type { PitcherManagementScreenProps } from './pitcherManagementScreen/pitcherManagementScreenProps'
import { PitcherManagementBody } from './pitcherManagementScreen/PitcherManagementBody'
import { useActedEntry } from './pitcherManagementScreen/useActedEntry'

export type { PitcherManagementScreenProps } from './pitcherManagementScreen/pitcherManagementScreenProps'

/**
 * 나만의리그 **투수편 관리 화면** — 원본 장면 **0x106** 의 상태 **105(허브)** 와 그 하위
 * 106(선수정보) · 107(트레이닝) · 119·121·122·123·124·108 을 한 화면으로 옮긴 것이다 (R9 3·8절).
 *
 * 커맨드 여섯 칸은 타자편과 **같다** — 점프표 0xcc540 에 모드 갈림이 없고 설명서 StrHOWTO[11] 도
 * `[선수정보][트레이닝][휴식][외출][아이템][다음경기]` 여섯을 나만의리그 공통으로 적는다.
 * 투수편만 다른 곳은 **트레이닝 칸 0~3 이 제구·구속·변화·체력**이라는 것과,
 * 칸 4(그리고 선수정보 칸 3)가 **팝업 0x78** 로 마구·구질 두 갈래를 먼저 묻는다는 것이다.
 *
 * **머리띠·바닥띠** (직접 떴다): 장면 0x106 의 공통 틀 0x16928 이 판(0x7f53c)에 제목·바닥을 맡기고 각 그림이 끝에
 * 0x7f4ec 로 0x54d95 를 부른다 — 105·106·107·108·110·122·123 그림(0x19f0c · 0x19f00 · 0x19eb8 · 0x19e44 · 0x19eac ·
 * 0x19ee0 · 0x19e24)은 모두 0x19da4 를 거쳐 끝에 0x7f4ed. 틀의 "그 밖" 갈래(0x169ea~0x16a08)가
 * 제목 `[장면+0xcc] == 4 ? 8 : 9` · 바닥 5 다 — 투수편([장면+0xcc] = 3)은 **제목 9**(`나만의리그투수편`, 그림 9 + 11)·바닥 5.
 * 기본정보(119) 그림 0x166cc 는 판을 안 거치고 직접 0x54d95(같은 제목, **바닥 0x87**: "#닉네임"·"0상세정보"·되돌아가기,
 * 0x166f2)를 부르고, 칭호 목록(129) 0x198fc 도 0x166cc 를 먼저 그린다. 표시는 "#" 지만 칭호 키는 '*'(0x1056c) — 원본 그대로.
 * 하위 창: 119 기본정보는 카드 0x15e20(`PitcherBasicInfoPanel`), 123 구질은 창 0x803d4 상태 0x7b(`PitcherRepertoirePanel`).
 */

/** 110 확인 → 111(키 0x11478) · 106 칸 1 → 121(키 0x13010) — 그 취소는 하위 메뉴로 돌아온다(0x13460 의 13b1e → 110 · 0x17ad0 의 17aee → 106). 커서는 고른 칸 그대로 */
function leaveForShop(mainCursor: NariMainMenuCursor, tab: PitcherShopTab) {
  if (tab === '착용') {
    leaveNariSubMenu(
      mainCursor,
      '선수정보',
      PITCHER_COMMAND_BAR.선수정보.findIndex((slot) => slot.id === '장비착용'),
    )
    return
  }
  leaveNariSubMenu(
    mainCursor,
    '아이템',
    PITCHER_COMMAND_BAR.아이템.findIndex((slot) => slot.id === tab),
  )
}

/** 관리 메뉴만 남았는가 — 하위 창 · 상세 · 질문 · 두 갈래 팝업이 없다 */
const isIdleMainOf = (menu: PitcherManagementMenu) =>
  menu.kind === '관리' && menu.subWindow === null && menu.detail === null && menu.question === null && menu.choice === null

export function PitcherManagementScreen(props: PitcherManagementScreenProps) {
  const { career } = props
  const [ownMainCursor] = useState(createNariMainMenuCursor)
  const mainCursor = props.mainCursor ?? ownMainCursor
  /** 111 상점 · 121 장비착용에서 돌아왔으면 그 하위 메뉴(110 · 106) (`nariReturnSubMenuOf`) */
  const [returned] = useState(() => nariReturnSubMenuOf(mainCursor))
  useEffect(() => clearNariReturnSubMenu(mainCursor), [mainCursor])
  const { onOpenShop } = props
  /** 커맨드 줄 칸이 펼쳐지는 중(`PitcherCommandBar` 가 그릴 때마다 적는다) — 그동안 취소도 버린다 */
  const slidingRef = useRef(false)
  const menu = usePitcherManagementMenu({
    ...props,
    ...(returned === null ? {} : { initialKind: returned.kind }),
    onOpenShop: (tab: PitcherShopTab) => {
      leaveForShop(mainCursor, tab)
      onOpenShop(tab)
    },
  })
  /** 124 — 팝업 0x80 에서 고른 [장면+0x164]. null 이면 124 가 아니다 */
  const [recordPick, setRecordPick] = useState<RecordRoomPick | null>(null)
  useActedEntry(career.hasActedThisCycle, isIdleMainOf(menu), mainCursor)

  /**
   * 팝업 0x78(`PitchChoicePopup`)은 화면 밖 한 자리에 둔다 — 확인 키가 그 갱신에 상태를 108 · 123 으로 바꿔 아래 화면이 갈려도
   * 창은 그 위에서 줄어든다(0x19398 → 0xbcb49 뒤 [창+0x215]). 화면 갈래마다 따로 두면 창이 새로 서 버린다.
   */
  const choicePopup = menu.choice !== null && (
    <PitchChoicePopup selected={menu.choiceIndex} onMove={menu.moveChoice} onChoose={menu.chooseOption} onClosed={() => menu.chooseOption(-1)} />
  )
  /** 기록실 팝업이 124 위에서 다 줄어들었다 — 다시 [기록실] 을 열 때 내린다 */
  const [isRecordPopupGone, setRecordPopupGone] = useState(false)
  // 124 그림 0x16778 — 목록 판과 머리띠만(관리 화면은 없다). 취소 → 106
  const closeRecordRoom = () => {
    setRecordPick(null)
    setRecordPopupGone(false)
    menu.closeWindow()
  }
  /** 106 칸 4 [기록실] 팝업 0x80 — 확인한 다음 틀에 124 가 서고 창은 그 위에서 줄어든다(0x196ec → 0xbcb49). 갈래 밖 한 자리 */
  const recordPopup = menu.subWindow === '기록실' && !isRecordPopupGone && (
    <NariRecordPickPopup onChoose={setRecordPick} onCancel={closeRecordRoom} onClosed={() => setRecordPopupGone(true)} />
  )
  return (
    <>
      {menu.subWindow === '기록실' && recordPick !== null ? (
        <NariRecordView edition="투수" career={career} pick={recordPick} gamePoint={career.gamePoint} onBack={closeRecordRoom} />
      ) : (
        <PitcherManagementBody career={career} menu={menu} mainCursor={mainCursor} slidingRef={slidingRef} centerSlidesIn={props.centerSlidesIn} />
      )}
      {choicePopup}
      {recordPopup}
    </>
  )
}
