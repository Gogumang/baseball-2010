import { useRef, useState } from 'react'
import { MessageBox, PressArea, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { currentTitleOf } from '@/entities/career/model/titles'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { FOOTER_BITS } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { TrainingScene } from '@/widgets/training-scene/ui/TrainingScene'
import { RestScene } from '@/widgets/training-scene/ui/RestScene'
import { nariRestPresentationOf } from '@/widgets/training-scene/lib/restPresentation'
import { TRAINING_PRESENTATION_OF } from '@/shared/config/original/trainingAnimation'
import { COMMAND_MENUS, COMMAND_SLOTS } from '@/pages/management/lib/managementLayout'
import type { ManagementCommand } from '@/pages/management/lib/managementLayout'
import { useManagementMenu } from '@/pages/management/model/useManagementMenu'
import type { NariMainMenuCursor } from '@/pages/management/model/nariMainMenuCursor'
import { ManagementBoard } from '@/pages/management/ui/ManagementBoard'
import { CommandBar } from '@/pages/management/ui/CommandBar'
import { nariMainMenuOffIdsOf } from '@/pages/management/lib/nariMenuEnable'
import { BasicInfoCard, basicInfoFigureRecolorRequestsOf } from '@/pages/management/ui/BasicInfoCard'
import { portraitPaletteIndex, useWarmRecoloredSprites } from '@/shared/lib/sprite/paletteSwap'
import { DetailPopup, DetailWindow } from '@/pages/management/ui/DetailPopup'
import { batterAbilityDetailViewOf } from '@/pages/management/lib/abilityDetail'
import { NariRecordPickPopup, NariRecordView } from '@/pages/nari-record-room'
import type { RecordRoomPick } from '@/pages/nari-record-room'
// 리그 전적을 경기 결과에 잇는 일은 팀 리드 담당이라, 그때까지는 빈 리그(전부 0승 0패)를 보여 준다
import { SpecialSwingWindow } from '@/widgets/special-swing/ui/SpecialSwingWindow'
import { TitleListWindow } from '@/widgets/management/ui/TitleListWindow'
import { SkillWindow } from '@/widgets/skill-window/ui/SkillWindow'
import type { DetailResult } from '@/pages/management/lib/detailPopup'
import { CenterStage } from '@/pages/management/ui/CenterStage'
import { nariStageCharactersOf } from '@/pages/management/lib/centerStage'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import * as styles from '@/pages/management/ui/ManagementScreen.css'

export type { ManagementCommand } from '@/pages/management/lib/managementLayout'

export interface ManagementScreenProps {
  readonly career: PlayerCareer
  readonly noticeText: string
  /** 휴식·외출·다음경기 */
  readonly onSelect: (command: ManagementCommand) => void
  /** 훈련 하위 메뉴 — 연출이 끝난 뒤 불린다 */
  readonly onTraining: (menuId: string) => void
  /** 훈련할 수 없는 칸을 골랐을 때 알림을 띄운다 */
  readonly onTrainingBlocked: (menuId: string) => void
  readonly isTrainingBlocked: (menuId: string) => boolean
  readonly isRestBlocked: () => boolean
  /** 상세정보 결과 창 — 닫을 때 onCloseDetail */
  readonly detail: DetailResult | null
  readonly onCloseDetail: () => void
  /**
   * 알림 상자에서 [확인] 을 눌렀다 — 알림을 가진 쪽이 비워야 한다.
   * 화면이 "이미 본 문구"를 기억하면 같은 문구가 다시 와도 안 뜨고 (막힌 칸을 두 번 고르는 경우),
   * 다른 화면을 다녀와 다시 마운트되면 지난 알림이 되살아난다.
   */
  readonly onDismissNotice: () => void
  readonly onOpenShop: (tab: string) => void
  readonly onOpenPlayerInfo: (itemId: string) => void
  /**
   * 칭호 목록(하위 상태 129)에서 하나를 골랐다 — 선수 +0x1c4 에 쓰고 저장한다 (0x11f78).
   * 안 넘기면 그 창이 열리지 않는다.
   */
  readonly onEquipTitle?: (title: string) => void
  /**
   * 필살타법 창(상태 0x7b)에서 기술을 골랐다 — 선수 +0x18 에 쓰고 저장한다 (틀 0x17bf4 의 0x17c64,
   * `selectSpecialSwingNumber`). 안 넘기면 창이 고른 번호를 스스로만 들고 있다(저장 안 됨).
   */
  readonly onSelectSpecialSwing?: (number: number) => void
  /**
   * 스킬 창(선수정보 "아이템/스킬", 하위 상태 122)의 장착·해제 — 대화 0x147b0 번호 4·3 → 0xa4b04(P, s, on).
   * 안 넘기면 그 칸은 `onOpenPlayerInfo` 로 간다.
   */
  readonly onEquipSkill?: (skillId: number, on: boolean) => void
  /** 같은 창의 슬롯 확장 — 대화 번호 6 (0x1484c) */
  readonly onExpandSkillSlots?: () => void
  /** 하위 메뉴 106 · 107 · 110 취소로 105 에 다시 들어온다 — 세션이 진입 0x11910 · 자동 훑기 0x1cf9c 를 돈다 */
  readonly onReenter?: () => void
  /** 105 메인 메뉴의 확인 키 — 0x12654 가 칸을 보기 전에 mgr+0x304 = 0 (세션 `pressManagementConfirm`) */
  readonly onMainConfirm?: () => void
  /** 메인 메뉴로 나간다. 진행 상황은 이미 저장되어 있다. */
  readonly onExit: () => void
  /**
   * 가운데 판 0x7f814 의 선수가 미끄러져 들어오는가 — 105 진입 0x11910 이 이전 상태 1 · 114(이벤트) · 100(경기 뒤)이면
   * 0x8a2d8 을 부른다(0x11c6e~0x11c80). 그 밖(상점 · 외출 취소 등)에서 돌아오면 제자리에 선다.
   */
  readonly centerSlidesIn?: boolean
  /**
   * 관리 메뉴 [this+0x8c] 의 커서 — 장면이 서 있는 동안 남는 값이라 루트가 들고(105 진입 규칙 `nariMainCursorOnEntry` 도 루트가
   * 화면이 바뀔 때 친다), 이벤트 끝 틀(`NariMainCommandBar`)도 같은 값을 그린다. 안 넘기면 화면이 스스로 0 부터 든다.
   */
  readonly mainCursor?: NariMainMenuCursor
}

/** 기본정보 카드 그림 0x166cc 의 바닥비트 (0x166f2 `movs r2, #0x87`) */
/** 누름 칸이 보내는 키 — 메뉴 훅의 window 키 듣개가 그대로 받는다 */
const pressKey = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))

const BASIC_INFO_FOOTER = 0x87

/**
 * 관리 메뉴 — 원본 좌표 그대로. 앞그림 0x16a34 → 0x16928 이 공 무늬 바탕 0x5fd61(142~144 밖)을 깔고,
 * 105~108·110·122·123 그림 0x19da4 가 커맨드 줄 0x7e418 → 상태판 0x7d34c → 가운데 판 0x7f814(114 · 125 · 126 · 127 · 136 밖,
 * 선수 하나 — `lib/centerStage`) → 머리띠·바닥띠 0x54d94 를 그린다. 훈련 팝업은 0x848d0 이다.
 * [선수정보]·[트레이닝]·[아이템] 은 화면을 바꾸지 않고 하단 줄이 하위 메뉴로 바뀐다 (0x7e84c).
 */
export function ManagementScreen(props: ManagementScreenProps) {
  const { career, noticeText } = props
  const menu = useManagementMenu(props)
  // '기본정보' 카드 선수 그림을 미리 칠한다 — 열린 첫 그림부터 제 색(원본은 0x10810 의 그림 적재 때 칠한다). 그림만 — 메뉴 진행은 안 건드린다
  useWarmRecoloredSprites(basicInfoFigureRecolorRequestsOf(career))
  /** 칭호 목록 윗줄을 장면 동안 들고 있는 곳 — 루트가 준 커서 객체, 없으면 이 화면 몫 */
  const ownTitleHolder = useRef<{ titleListTop?: number }>({}).current
  const titleHolder = props.mainCursor ?? ownTitleHolder
  /** 108 필살타법 창에 들어선 횟수 — 139 G 충전에서 돌아오면 108 진입 0x17730 이 다시 돈다(창을 새로 마운트) */
  const [swingTrainingEntry, setSwingTrainingEntry] = useState(0)
  const labelOrigins = useFrameOrigins('./sprites/img_text/frames')
  const slots = menu.kind === 'main' ? COMMAND_SLOTS : COMMAND_MENUS[menu.kind]
  const labelWidths = Object.fromEntries(
    slots.map((slot) => [slot.labelFrame, labelOrigins?.[String(slot.labelFrame).padStart(3, '0')]?.width ?? 0]),
  )
  /** 124 — 팝업 0x80 에서 고른 [장면+0x164]. null 이면 124 가 아니다 */
  const [recordPick, setRecordPick] = useState<RecordRoomPick | null>(null)
  /** 기록실 팝업이 124 위에서 다 줄어들었다 — 다시 [기록실] 을 열 때 내린다 */
  const [isRecordPopupGone, setRecordPopupGone] = useState(false)
  const closeRecordRoom = () => {
    setRecordPick(null)
    setRecordPopupGone(false)
    menu.closeOverlay()
  }
  /**
   * 106 칸 4 [기록실] — 팝업 0x80(0x19448) → 124(0x116d4 · 0x1463c · 0x16778), 취소는 106. 확인한 다음 틀에 124 가 서고 창은
   * 그 위에서 줄어든다(0x196ec → 0xbcb49) — 화면 갈래 밖 한 자리에 둬야 창이 새로 서지 않는다
   */
  const recordPopup = menu.overlay === '기록실' && !isRecordPopupGone && (
    <NariRecordPickPopup onChoose={setRecordPick} onCancel={closeRecordRoom} onClosed={() => setRecordPopupGone(true)} />
  )
  return <>{managementBodyOf()}{recordPopup}</>

  function managementBodyOf() {
  // 124 그림 0x16778 은 목록 판과 머리띠만 그린다 — 관리 화면(상태판 · 커맨드 줄)은 없다. 취소 → 106
  if (menu.overlay === '기록실' && recordPick !== null) {
    return <NariRecordView edition="타자" career={career} pick={recordPick} gamePoint={career.gamePoint}
      onBack={closeRecordRoom} />
  }

  return (
    <RawScreen>
      <SkinBackdrop kind="공무늬" />
      {!menu.isShowingBasicInfo && (
        <ManagementBoard career={career} titleName={currentTitleOf(career)} />
      )}
      {/* 가운데 판 0x7f814 — 기본정보(119, 그림 0x166cc) · 훈련(125 — 연출과 결과 창) · 휴식(127 — 연출과 결과 창)에는 없다 */}
      {!menu.isShowingBasicInfo && !menu.isTrainingState && menu.restPhase === null && (
        <CenterStage slidesIn={props.centerSlidesIn ?? false} characters={nariStageCharactersOf({
          morale: career.morale,
          isSick: career.isSick,
          isInjured: career.isInjured,
          isSlugger: career.battingTypeIndex >= 1,
          skinIndex: career.skinIndex,
        })} />
      )}
      {menu.playingMenuId !== null && (
        <div className={styles.trainingPopup}>
          <TrainingScene presentation={TRAINING_PRESENTATION_OF[menu.playingMenuId] ?? null}
            caption={`${menu.playingMenuId}훈련`}
            // 장타형은 동작표가 따로다 (0xd4a18·0xd4a6c — F-6). 0 만 타격형이고 그 밖은 장타형이다
            battingTypeIndex={career.battingTypeIndex}
            // 손은 넘기지 않는다 — 0x10810 이 +0x3c 에 넣은 손을 진입 0x11744 가 1 로 덮어써 안 뒤집는다(11802~1181e)
            // 훈련 팝업 캐릭터도 0x10810 이 세운 그림 객체 그대로라 장착 장비를 입고 나온다
            equipmentLevels={career.equipmentLevels}
            // 몸통 = 피부 × 15 + 팀 · 헬멧 = 팀 (기본정보 카드와 같은 0x10810 → 0x78be8·0x78c14)
            skinIndex={career.skinIndex}
            teamIndex={career.teamId}
            onFinished={menu.finishTraining} />
        </div>
      )}
      {/* 127 그리기 0x19e08 → 0x8532c = 0x848d0(gfx, 0, 0) — 캐릭터 없는 훈련 팝업 (`RestScene`) */}
      {menu.restPhase === 'playing' && (
        <RestScene presentation={nariRestPresentationOf({ isBatter: true, battingTypeIndex: career.battingTypeIndex })}
          char0Palette={portraitPaletteIndex(career.skinIndex)} onFinished={menu.finishRest} />
      )}
      <CommandBar slots={slots} cursor={menu.cursor} bounce={menu.bounce} slideUpdates={menu.slideUpdates}
        disabledIds={menu.disabledIds} labelWidths={labelWidths} parent={menu.parent}
        // 켬 표 0 칸은 흑백 — 105 진입 0x11910(첫 해 10경기 전 외출 포함). 0x7e418 은 하위 메뉴가 없을 때만 본다
        grayedIds={menu.parent === null ? nariMainMenuOffIdsOf(career) : undefined}
        onHover={menu.moveCursor} onSelect={menu.select} />
      {/* 125 연출 중 화면 탭 = 확인 키 — 0x105a4 가 게이지를 끝으로 보낸다(`TrainingScene` 이 키로 받는다) */}
      {menu.playingMenuId !== null && (
        <PressArea label="훈련 연출 건너뛰기" testId="훈련연출-건너뛰기" onPress={() => pressKey('5')} />
      )}
      {/*
        기본정보 카드는 커맨드 줄 **뒤에** 그린다. 원본 그리기 순서(0x167cc)도 상태판 → 커맨드 줄 →
        덮개(훈련 팝업 0x7f814) 순이라 덮개가 커맨드 줄을 가린다.
        커맨드 줄보다 먼저 그리면 정보 칸 넷째 줄("필살"·"타순")이 아이콘에 덮여 사라진다.
      */}
      {menu.isShowingBasicInfo && <BasicInfoCard career={career} />}
      {/* 능력치 상세(120) — 그림 0x1b2e4 = 기본정보 카드 → 창 0x8a0a4 → 머리띠(0x7f4ed). 표·글은 0x88fe8 */}
      {menu.abilityDetailOffset !== null && (() => {
        const view = batterAbilityDetailViewOf(career)
        return <DetailWindow rows={view.rows} messages={view.messages} scrollOffset={menu.abilityDetailOffset}
          onClose={menu.closeAbilityDetail} />
      })()}
      {/* 기본정보(119)·칭호(129 — 0x198fc 가 0x166cc 를 먼저 그린다)는 바닥 0x87 "#닉네임"·"0상세정보"·되돌아가기 (0x166f2).
          표시는 "#" 지만 칭호 키는 '*'(0x1056c) — 원본 그대로. 120 은 0x16928 "그 밖"이라 5, 그 밖 상태도 5 */}
      <ScreenFrame title="나만의리그타자편" gamePoint={career.gamePoint} onBack={menu.back}
        footer={menu.isShowingBasicInfo && menu.abilityDetailOffset === null ? BASIC_INFO_FOOTER : undefined} slides={false}
        // 기본정보(119) 바닥띠 "*닉네임" · "0상세정보" 표시 = '*'(129 칭호) · '0'(120 능력치 상세) 키 — 그 표시 위 투명 누름 칸
        footerPresses={{
          [FOOTER_BITS.nickname]: { label: '* 칭호', onPress: () => pressKey('*') },
          [FOOTER_BITS.detail]: { label: '0 상세정보', onPress: () => pressKey('0') },
        }} />
      {/* 칭호 목록(상태 129) — 기본정보 카드 위에 뜨고, 취소하면 그 카드(119)로 돌아간다 */}
      {menu.overlay === '칭호' && props.onEquipTitle !== undefined && (
        <TitleListWindow career={career} onEquip={props.onEquipTitle} onClose={menu.closeOverlay}
          initialTop={titleHolder.titleListTop ?? 0} onTopChange={(top) => { titleHolder.titleListTop = top }} />
      )}
      {menu.overlay === '필살타법' && (
        <SpecialSwingWindow level={career.specialSwingLevel} sessions={career.specialSwingSessions} battingTypeIndex={career.battingTypeIndex}
          selectedNumber={props.onSelectSpecialSwing === undefined ? undefined : career.specialSwingNumber}
          onSelectNumber={props.onSelectSpecialSwing}
          onClose={menu.closeOverlay} />
      )}
      {menu.overlay === '아이템/스킬' && props.onEquipSkill !== undefined && (
        <SkillWindow career={career} onEquip={props.onEquipSkill}
          onExpandSlots={props.onExpandSkillSlots ?? (() => {})} onClose={menu.closeOverlay} />
      )}
      {menu.overlay === '필살타법훈련' && (
        /*
         * G 부족([65])의 "예" → 틀 0x106bc → 139 G포인트 충전(실제 현금 결제 0x65a65 / 0x65b01). 웹에는 결제가 없어 **결제하지
         * 않고 139 를 떠난 길**(목록 CLR → 틀 0x15954 가 뒤 상태 108 로)만 옮긴다 — G 는 그대로이고 108 진입 0x17730 이 다시 돈다
         * (창을 새로 마운트한다). 자세한 139 흐름은 투수편 `usePitcherManagementMenu` 의 `confirmMagicTrainingCell` 주석.
         */
        <SpecialSwingWindow key={swingTrainingEntry} onBuyGamePoint={() => setSwingTrainingEntry((entry) => entry + 1)}
          mode="훈련" level={career.specialSwingLevel} sessions={career.specialSwingSessions}
          battingTypeIndex={career.battingTypeIndex} selectedNumber={career.specialSwingNumber}
          popularity={career.popularity} gamePoint={career.gamePoint}
          onTrain={menu.startSpecialSwingTraining} onClose={menu.closeOverlay} />
      )}
      {props.detail !== null && <DetailPopup result={props.detail} onClose={props.onCloseDetail} />}
      {menu.question !== null && (
        <MessageBox text={menu.question.text} buttons={['예', '아니오']} onAnswer={(index) => menu.answer(index === 0)} />
      )}
      {props.detail === null && menu.question === null && noticeText !== '' && (
        <MessageBox text={`!C${noticeText}`} buttons={['확인']} onAnswer={props.onDismissNotice} />
      )}
    </RawScreen>
  )
  }
}
