import { useState } from 'react'
import { RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { currentTitleOf } from '@/entities/career/model/titles'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { FOOTER_BITS } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { COMMAND_MENUS, COMMAND_SLOTS } from '@/pages/management/lib/managementLayout'
import { useManagementMenu } from '@/pages/management/model/useManagementMenu'
import { ManagementBoard } from '@/pages/management/ui/ManagementBoard'
import { CommandBar } from '@/pages/management/ui/CommandBar'
import { nariMainMenuOffIdsOf } from '@/pages/management/lib/nariMenuEnable'
import { BasicInfoCard } from '@/pages/management/ui/BasicInfoCard'
import { basicInfoFigureRecolorRequestsOf } from '@/pages/management/lib/basicInfoFigure'
import { useWarmRecoloredSprites } from '@/shared/lib/sprite/paletteSwap'
import { CenterStage } from '@/pages/management/ui/CenterStage'
import { nariStageCharactersOf } from '@/pages/management/lib/centerStage'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { NariRecordPickPopup, NariRecordView, SkinBackdrop, type RecordRoomPick } from './managementScreen/otherSlices'
import type { ManagementScreenProps } from './managementScreen/managementScreenProps'
import { pressKey } from './managementScreen/pressKey'
import { RestLayer, TrainingLayer, TrainingSkipArea } from './managementScreen/ManagementSceneLayers'
import { AbilityDetailLayer, ManagementOverlayWindows, ManagementPopups } from './managementScreen/ManagementWindows'

export type { ManagementCommand } from '@/pages/management/lib/managementLayout'
export type { ManagementScreenProps } from './managementScreen/managementScreenProps'

/** 기본정보 카드 그림 0x166cc 의 바닥비트 (0x166f2 `movs r2, #0x87`) */
const BASIC_INFO_FOOTER = 0x87

/**
 * 관리 메뉴 — 원본 좌표 그대로. 앞그림 0x16a34 → 0x16928 이 공 무늬 바탕 0x5fd61(142~144 밖)을 깔고,
 * 105~108·110·122·123 그림 0x19da4 가 커맨드 줄 0x7e418 → 상태판 0x7d34c → 가운데 판 0x7f814(114 · 125 · 126 · 127 · 136 밖,
 * 선수 하나 — `lib/centerStage`) → 머리띠·바닥띠 0x54d94 를 그린다. 훈련 팝업은 0x848d0 이다.
 * [선수정보]·[트레이닝]·[아이템] 은 화면을 바꾸지 않고 하단 줄이 하위 메뉴로 바뀐다 (0x7e84c).
 */
export function ManagementScreen(props: ManagementScreenProps) {
  const { career } = props
  const menu = useManagementMenu(props)
  // '기본정보' 카드 선수 그림을 미리 칠한다 — 열린 첫 그림부터 제 색(원본은 0x10810 의 그림 적재 때 칠한다). 그림만 — 메뉴 진행은 안 건드린다
  useWarmRecoloredSprites(basicInfoFigureRecolorRequestsOf(career))
  /** 칭호 목록 윗줄을 장면 동안 들고 있는 곳 — 루트가 준 커서 객체, 없으면 이 화면 몫 */
  const [ownTitleHolder] = useState<{ titleListTop?: number }>(() => ({}))
  const titleHolder = props.mainCursor ?? ownTitleHolder
  /** 108 필살타법 창에 들어선 횟수 — 139 G 충전에서 돌아오면 108 진입 0x17730 이 다시 돈다(창을 새로 마운트) */
  const [swingTrainingEntry, setSwingTrainingEntry] = useState(0)
  const labelOrigins = useFrameOrigins(assetUrl('./sprites/img_text/frames'))
  const slots = menu.kind === 'main' ? COMMAND_SLOTS : COMMAND_MENUS[menu.kind]
  const labelWidths = Object.fromEntries(slots.map((slot) => [slot.labelFrame, labelOrigins?.[String(slot.labelFrame).padStart(3, '0')]?.width ?? 0]))
  /** 124 — 팝업 0x80 에서 고른 [장면+0x164]. null 이면 124 가 아니다 */
  const [recordPick, setRecordPick] = useState<RecordRoomPick | null>(null)
  /** 기록실 팝업이 124 위에서 다 줄어들었다 — 다시 [기록실] 을 열 때 내린다 */
  const [isRecordPopupGone, setRecordPopupGone] = useState(false)
  const closeRecordRoom = () => {
    setRecordPick(null)
    setRecordPopupGone(false)
    menu.closeOverlay()
  }
  const isRecordRoom = menu.overlay === '기록실'
  /**
   * 106 칸 4 [기록실] — 팝업 0x80(0x19448) → 124(0x116d4 · 0x1463c · 0x16778), 취소는 106. 확인한 다음 틀에 124 가 서고 창은
   * 그 위에서 줄어든다(0x196ec → 0xbcb49) — 화면 갈래 밖 한 자리에 둬야 창이 새로 서지 않는다
   */
  const recordPopup = isRecordRoom && !isRecordPopupGone && (
    <NariRecordPickPopup onChoose={setRecordPick} onCancel={closeRecordRoom} onClosed={() => setRecordPopupGone(true)} />
  )
  // 124 그림 0x16778 은 목록 판과 머리띠만 그린다 — 관리 화면(상태판 · 커맨드 줄)은 없다. 취소 → 106
  const body =
    isRecordRoom && recordPick !== null ? (
      <NariRecordView edition="타자" career={career} pick={recordPick} gamePoint={career.gamePoint} onBack={closeRecordRoom} />
    ) : (
      <ManagementBody
        props={props}
        menu={menu}
        slots={slots}
        labelWidths={labelWidths}
        titleHolder={titleHolder}
        swingTrainingEntry={swingTrainingEntry}
        onBuyGamePoint={() => setSwingTrainingEntry((entry) => entry + 1)}
      />
    )
  return (
    <>
      {body}
      {recordPopup}
    </>
  )
}

/** 가운데 판 선수 — 사기 · 질병 · 부상 · 장타형 · 피부 */
const stageCharactersOf = (career: ManagementScreenProps['career']) =>
  nariStageCharactersOf({
    morale: career.morale,
    isSick: career.isSick,
    isInjured: career.isInjured,
    isSlugger: career.battingTypeIndex >= 1,
    skinIndex: career.skinIndex,
  })

/**
 * 머리띠 · 바닥띠. 기본정보(119)·칭호(129 — 0x198fc 가 0x166cc 를 먼저 그린다)는 바닥 0x87 "#닉네임"·"0상세정보"·되돌아가기 (0x166f2).
 * 표시는 "#" 지만 칭호 키는 '*'(0x1056c) — 원본 그대로. 120 은 0x16928 "그 밖"이라 5, 그 밖 상태도 5.
 * 기본정보(119) 바닥띠 "*닉네임" · "0상세정보" 표시 = '*'(129 칭호) · '0'(120 능력치 상세) 키 — 그 표시 위 투명 누름 칸.
 * 칭호 목록(129)이 떠 있으면 '0' 칸은 걷는다 — 129 키 0x11f78 은 −5 · '5'(장착) · −16 · '*'(→ 119) 밖의 키를 목록
 * vt+0x18(0x6c298 → 0x6c520 → 0x6c030)에 넘기고, 숫자키 꼴 1 목록은 '0' 을 방향 없는 한 걸음(0x6be70 — dx = dy = 0)으로
 * 버린다. 칸이 남으면 칭호 창 덮개(4)보다 위(7)라 누름만 먹는다(r212). '*' 칸은 129 에서도 119 로 돌아가는 키라 둔다
 */
function ManagementFrame({ menu, gamePoint }: { readonly menu: ReturnType<typeof useManagementMenu>; readonly gamePoint: number }) {
  const isBasicInfoFooter = menu.isShowingBasicInfo && menu.abilityDetailOffset === null
  return (
    <ScreenFrame
      title="나만의리그타자편"
      gamePoint={gamePoint}
      onBack={menu.back}
      footer={isBasicInfoFooter ? BASIC_INFO_FOOTER : undefined}
      slides={false}
      footerPresses={{
        [FOOTER_BITS.nickname]: { label: '* 칭호', onPress: () => pressKey('*') },
        ...(menu.overlay === '칭호' ? {} : { [FOOTER_BITS.detail]: { label: '0 상세정보', onPress: () => pressKey('0') } }),
      }}
    />
  )
}

type Menu = ReturnType<typeof useManagementMenu>

/** 가운데 판 0x7f814 — 기본정보(119, 그림 0x166cc) · 훈련(125 — 연출과 결과 창) · 휴식(127 — 연출과 결과 창)에는 없다 */
const showsCenterStage = (menu: Menu) => !menu.isShowingBasicInfo && !menu.isTrainingState && menu.restPhase === null

interface ManagementBodyProps {
  readonly props: ManagementScreenProps
  readonly menu: Menu
  readonly slots: Parameters<typeof CommandBar>[0]['slots']
  readonly labelWidths: Readonly<Record<number, number>>
  readonly titleHolder: { titleListTop?: number }
  readonly swingTrainingEntry: number
  readonly onBuyGamePoint: () => void
}

/** 105~108·110·122·123 그림 0x19da4 — 공 무늬 · 상태판 · 가운데 판 · 연출 · 커맨드 줄 · 카드 · 띠 · 창 */
function ManagementBody({ props, menu, slots, labelWidths, titleHolder, swingTrainingEntry, onBuyGamePoint }: ManagementBodyProps) {
  const { career } = props
  return (
    <RawScreen>
      <SkinBackdrop kind="공무늬" />
      {!menu.isShowingBasicInfo && <ManagementBoard career={career} titleName={currentTitleOf(career)} />}
      {/* 가운데 판 0x7f814 — 기본정보(119, 그림 0x166cc) · 훈련(125 — 연출과 결과 창) · 휴식(127 — 연출과 결과 창)에는 없다 */}
      {showsCenterStage(menu) && <CenterStage slidesIn={props.centerSlidesIn ?? false} characters={stageCharactersOf(career)} />}
      <TrainingLayer menu={menu} career={career} />
      <RestLayer menu={menu} career={career} />
      <CommandBar
        slots={slots}
        cursor={menu.cursor}
        bounce={menu.bounce}
        slideUpdates={menu.slideUpdates}
        disabledIds={menu.disabledIds}
        labelWidths={labelWidths}
        parent={menu.parent}
        // 켬 표 0 칸은 흑백 — 105 진입 0x11910(첫 해 10경기 전 외출 포함). 0x7e418 은 하위 메뉴가 없을 때만 본다
        grayedIds={menu.parent === null ? nariMainMenuOffIdsOf(career) : undefined}
        // 흑백 칸에는 커서가 서지 못한다(vt+8 0x6c445) — 눌러도 고르지 않는다
        onHover={menu.hoverSlot}
        onSelect={menu.tapSlot}
      />
      <TrainingSkipArea menu={menu} />
      {/*
        기본정보 카드는 커맨드 줄 **뒤에** 그린다. 원본 그리기 순서(0x167cc)도 상태판 → 커맨드 줄 →
        덮개(훈련 팝업 0x7f814) 순이라 덮개가 커맨드 줄을 가린다.
        커맨드 줄보다 먼저 그리면 정보 칸 넷째 줄("필살"·"타순")이 아이콘에 덮여 사라진다.
      */}
      {menu.isShowingBasicInfo && <BasicInfoCard career={career} />}
      <AbilityDetailLayer props={props} menu={menu} />
      <ManagementFrame menu={menu} gamePoint={career.gamePoint} />
      <ManagementOverlayWindows
        props={props}
        menu={menu}
        titleHolder={titleHolder}
        swingTrainingEntry={swingTrainingEntry}
        onBuyGamePoint={onBuyGamePoint}
      />
      <ManagementPopups props={props} menu={menu} />
    </RawScreen>
  )
}
