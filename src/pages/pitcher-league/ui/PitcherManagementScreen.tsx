import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { FOOTER_BITS } from '@/widgets/screen-frame/lib/screenFrameLayout'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { createCareer } from '@/entities/career/model/playerCareer'
import { nariMainMenuOffIdsOf } from '@/pages/management/lib/nariMenuEnable'
import { TitleListWindow } from '@/widgets/management/ui/TitleListWindow'
import { SkillWindow } from '@/widgets/skill-window/ui/SkillWindow'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import { usePitcherManagementMenu } from '@/pages/pitcher-league/model/usePitcherManagementMenu'
import { PitcherStatusBoard } from '@/pages/pitcher-league/ui/PitcherStatusBoard'
import { PitcherBasicInfoPanel } from '@/pages/pitcher-league/ui/PitcherBasicInfoPanel'
import { PitcherRepertoirePanel } from '@/pages/pitcher-league/ui/PitcherRepertoirePanel'
import { PitcherMagicTrainingPanel } from '@/pages/pitcher-league/ui/PitcherMagicTrainingPanel'
import { NariRecordPickPopup, NariRecordView } from '@/pages/nari-record-room'
import type { RecordRoomPick } from '@/pages/nari-record-room'
import { PitchTrainingScreen } from '@/pages/pitcher-league/ui/PitchTrainingScreen'
import { PitchChoicePopup } from '@/pages/pitcher-league/ui/PitchChoicePopup'
import { DetailWindow } from '@/pages/management/ui/DetailPopup'
import { pitcherAbilityDetailViewOf } from '@/pages/pitcher-league/lib/pitcherDetailPopup'
import { CommandBar } from '@/pages/management/ui/CommandBar'
import { CenterStage } from '@/pages/management/ui/CenterStage'
import { nariStageCharactersOf } from '@/pages/management/lib/centerStage'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { PITCHER_COMMAND_BAR, pitcherLabelDxOf, pitcherParentSlotOf } from '@/pages/pitcher-league/lib/pitcherCommandBar'
import type { PitcherCommandKind } from '@/pages/pitcher-league/lib/pitcherCommandBar'
import type { PitcherManagementMenu } from '@/pages/pitcher-league/model/usePitcherManagementMenu'
import {
  createNariMainMenuCursor, leaveNariSubMenu, nariMainCursorOnEntry, nariReturnSubMenuOf,
} from '@/pages/management/model/nariMainMenuCursor'
import type { NariMainMenuCursor } from '@/pages/management/model/nariMainMenuCursor'

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

export interface PitcherManagementScreenProps {
  readonly career: PitcherCareer
  /** 훈련·휴식 굴림에 쓴다 */
  readonly random: RandomPort
  /** 바뀐 커리어를 저장한다 — 세션의 `actions.save` */
  readonly onSave: (career: PitcherCareer) => void
  /** [다음경기] — 세션의 `actions.beginGame` (원본 109 → 142 → 144 → 경기 장면 0x104) */
  readonly onNextGame: () => void
  /** [외출] 상태 112. 투수편 외출 지도가 아직 없으면 넘기지 않는다 — 그러면 칸이 알림만 띄운다 */
  readonly onOuting?: () => void
  /**
   * 111 상점('장착'·'서브'·'GP', [아이템] → 110 하위 메뉴 칸 0·1·2) · 121 장비착용('착용', [선수정보] 칸 1).
   * 안 넘기면 그 칸은 알림만 띄운다 ([아이템/스킬] 122 는 화면이 스킬 창을 띄운다)
   */
  readonly onOpenShop?: (tab: PitcherShopTab) => void
  /** 105 취소 — 메인 메뉴 장면 0x103 */
  readonly onExit: () => void
  /** 화면이 '관리' 인 채 105 에 다시 들어온다 — 세션의 `actions.reenterManagement` (`usePitcherManagementMenu` 의 `onReenter`) */
  readonly onReenter?: (from?: number) => void
  /** 125 · 127 결과 창이 떠 있는가 — 세션의 `actions.setResultWindowOpen` (`usePitcherManagementMenu` 의 `onResultWindowChange`) */
  readonly onResultWindowChange?: (isOpen: boolean) => void
  /** 105 메인 메뉴의 확인 키 — 0x12654 가 칸을 보기 전에 mgr+0x304 = 0 (세션 `pressManagementConfirm`) */
  readonly onMainConfirm?: () => void
  /** 가운데 판의 선수가 미끄러져 들어오는가 — 105 진입 0x11910 의 이전 상태 1 · 114 · 100 (0x8a2d8) */
  readonly centerSlidesIn?: boolean
  /**
   * 관리 메뉴 [this+0x8c] 의 커서 — 루트가 들고(105 진입 규칙도 루트가 장면이 바뀔 때 친다) 이벤트 끝 틀도 같은 값을 그린다
   * (타자편 `ManagementScreen` 과 같다). 안 넘기면 화면이 스스로 0 부터 든다.
   */
  readonly mainCursor?: NariMainMenuCursor
}

const NO_DISABLED: ReadonlySet<string> = new Set()
/** 커서를 옮긴 뒤 두 번 그리는 동안 +1, −1 로 튄다 (카운터 [gfx+0x98]) */
const BOUNCE_BY_UPDATE = [1, -1]
/** 칸 등장 0x7ff8c 가 다 내려온 뒤의 갱신 수 — 하위 메뉴로 돌아올 때는 펼침(0x7ff55)이 없어 칸이 제자리다 */
const SETTLED_UPDATES = 1_000

/**
 * 커맨드 줄 0x7e418 (투수 표 `lib/pitcherCommandBar`). 칸 등장 0x7ff8c · 부모 칸 0x8003c 는 메뉴가 열린 뒤 갱신 수로,
 * 키는 위·아래·좌·우 칸 옮기기 · 확인(Enter · '5') · 취소(−16).
 * 하위 메뉴에서 돌아오면 커서가 그 하위 메뉴 칸에 선다(타자편 `useManagementMenu` 와 같다) — 단 그 105 진입이 행동함이면 첫 칸
 * (0x11910 1194a~11970, 110 아이템에서 오면 남는다). 관리 메뉴 커서는 루트의 `mainCursor` 에 산다.
 */
function PitcherCommandBar({ menu, isKeyEnabled, mainOffIds, mainCursor, hasActed }: {
  readonly menu: PitcherManagementMenu
  readonly isKeyEnabled: boolean
  /** 관리 메뉴 [this+0x8c] 켬 표가 0 인 칸 — 105 진입 0x11910 (`nariMainMenuOffIdsOf`) */
  readonly mainOffIds: ReadonlySet<string>
  readonly mainCursor: NariMainMenuCursor
  /** S+4(행동함) */
  readonly hasActed: boolean
}) {
  const kind = menu.kind as PitcherCommandKind
  const slots = PITCHER_COMMAND_BAR[kind]
  const update = useUpdateCounter()
  const labelOrigins = useFrameOrigins('./sprites/img_text/frames')
  // 하위 메뉴가 선 채로 마운트되면(하위 창 119 · 122~124 · 108 이나 상점 111 · 121 에서 돌아옴) 그 하위 메뉴 객체의 커서 그대로,
  // 칸은 다 펼쳐져 있다(106 진입 0x11530 은 이전 105 일 때만 · 107 · 110 진입은 커서를 안 건드리고 펼침 0x7ff55 도 없다)
  const [state, setState] = useState(() => ({
    kind,
    cursor: kind === '관리' ? mainCursor.current : mainCursor.subCursor ?? 0,
    openedAt: kind === '관리' ? 0 : -SETTLED_UPDATES,
    movedAt: null as number | null,
  }))
  if (state.kind !== kind) {
    if (kind === '관리') {
      const returning = Math.max(0, slots.findIndex((slot) => slot.id === state.kind))
      mainCursor.current = nariMainCursorOnEntry(returning, hasActed, state.kind === '아이템')
    } else {
      // 105 에서 하위 메뉴로 — 106 은 진입이, 107 · 110 은 앞선 105 진입이 커서를 0 으로 되감아 둔다
      mainCursor.subCursor = 0
    }
    setState({ kind, cursor: kind === '관리' ? mainCursor.current : 0, openedAt: update, movedAt: null })
  }
  const cursor = Math.min(kind === '관리' ? mainCursor.current : state.cursor, slots.length - 1)
  const moveTo = (index: number) => {
    if (index === cursor) return
    if (kind === '관리') mainCursor.current = index
    else mainCursor.subCursor = index
    setState((held) => ({ ...held, cursor: index, movedAt: update }))
  }
  const latest = useRef({ cursor, slots, moveTo, menu })
  latest.current = { cursor, slots, moveTo, menu }
  useEffect(() => {
    if (!isKeyEnabled) return undefined
    const onKey = (event: KeyboardEvent) => {
      const held = latest.current
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
      if (step !== 0) {
        event.preventDefault()
        return held.moveTo((held.cursor + step + held.slots.length) % held.slots.length)
      }
      if (event.key === 'Enter' || event.key === ' ' || event.key === '5') {
        event.preventDefault()
        return held.menu.select(held.slots[held.cursor].id)
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        held.menu.back()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isKeyEnabled])

  const labelWidths = Object.fromEntries(
    slots.map((slot) => [slot.labelFrame, labelOrigins?.[String(slot.labelFrame).padStart(3, '0')]?.width ?? 0]),
  )
  return (
    <CommandBar slots={slots} cursor={cursor}
      bounce={state.movedAt === null ? 0 : (BOUNCE_BY_UPDATE[update - state.movedAt] ?? 0)}
      slideUpdates={Math.max(0, update - state.openedAt)}
      // 메인 메뉴 켬 표(흑백 0xc37a8)는 105 진입 0x11910 이 타자편과 같은 코드로 끈다 — 0x7e418 은 하위 메뉴가 없을 때만
      // 그 표를 본다. 흑백은 그림만이고, 이미 행동한 칸을 고르면 r_event_txt[176] 알림이 막는다(`usePitcherManagementMenu`)
      disabledIds={NO_DISABLED}
      grayedIds={kind === '관리' ? mainOffIds : undefined}
      labelWidths={labelWidths} parent={pitcherParentSlotOf(kind)}
      labelDxOf={(slot) => pitcherLabelDxOf(kind, slot)}
      onHover={moveTo} onSelect={menu.select} />
  )
}

/** 기본정보 카드 그림 0x166cc 의 바닥비트 (0x166f2 `movs r2, #0x87`) */
/** 누름 칸이 보내는 키 — 메뉴 훅의 window 키 듣개가 그대로 받는다 */
const pressKey = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))

const BASIC_INFO_FOOTER = 0x87

/**
 * 칭호 목록 창은 **타자편 위젯을 그대로 쓴다** — 원본도 창 하나를 두 편이 같이 쓰고,
 * 투수 이름(48~63)은 이미 `TITLE_NAMES` 안에 들어 있어 번호 기반 구조가 그대로 맞는다.
 *
 * ⚠️ 다만 그 위젯의 프로프 타입이 **타자 커리어**라, 창이 실제로 보는 두 칸(`titleIds`·`equippedTitle`)
 * 만 빈 타자 커리어 위에 얹어 넘긴다. 위젯(`src/widgets/**`)은 손대지 않는다.
 */
function titleViewOf(career: PitcherCareer): PlayerCareer {
  return { ...createCareer(career.name), titleIds: career.titleIds, equippedTitle: career.equippedTitle }
}

export function PitcherManagementScreen(props: PitcherManagementScreenProps) {
  const { career } = props
  const ownMainCursor = useRef(createNariMainMenuCursor()).current
  const mainCursor = props.mainCursor ?? ownMainCursor
  /** 111 상점 · 121 장비착용에서 돌아왔으면 그 하위 메뉴(110 · 106) (`nariReturnSubMenuOf`) */
  const [returned] = useState(() => nariReturnSubMenuOf(mainCursor))
  useEffect(() => {
    mainCursor.returnSubMenu = null
  }, [mainCursor])
  const { onOpenShop } = props
  const menu = usePitcherManagementMenu({
    ...props,
    ...(returned === null ? {} : { initialKind: returned.kind }),
    // 110 확인 → 111(키 0x11478) · 106 칸 1 → 121(키 0x13010) — 그 취소는 하위 메뉴로 돌아온다(0x13460 의 13b1e → 110 ·
    // 0x17ad0 의 17aee → 106). 커서는 고른 칸 그대로
    ...(onOpenShop === undefined ? {} : {
      onOpenShop: (tab: PitcherShopTab) => {
        if (tab === '착용') {
          leaveNariSubMenu(mainCursor, '선수정보', PITCHER_COMMAND_BAR.선수정보.findIndex((slot) => slot.id === '장비착용'))
        } else {
          leaveNariSubMenu(mainCursor, '아이템', PITCHER_COMMAND_BAR.아이템.findIndex((slot) => slot.id === tab))
        }
        onOpenShop(tab)
      },
    }),
  })
  /*
   * 화면 안 행동(훈련 125 · 휴식 127 — S+4 = 1)은 그 상태를 거쳐 105 로 다시 들어온다 — 그 진입이 행동함이라 커서를 첫 칸으로.
   * 행동함이 막 서면, 결과 창 · 하위 창이 걷혀 관리 메뉴만 남는 때에 그 진입을 친다(타자편 `useManagementMenu` 와 같다).
   */
  /** 124 — 팝업 0x80 에서 고른 [장면+0x164]. null 이면 124 가 아니다 */
  const [recordPick, setRecordPick] = useState<RecordRoomPick | null>(null)
  const wasActed = useRef(career.hasActedThisCycle)
  const [awaitingEntry, setAwaitingEntry] = useState(false)
  const isIdleMain = menu.kind === '관리' && menu.subWindow === null && menu.detail === null && menu.question === null
    && menu.choice === null
  useLayoutEffect(() => {
    if (career.hasActedThisCycle && !wasActed.current) setAwaitingEntry(true)
    wasActed.current = career.hasActedThisCycle
  })
  useLayoutEffect(() => {
    if (!awaitingEntry || !isIdleMain) return
    mainCursor.current = nariMainCursorOnEntry(mainCursor.current, career.hasActedThisCycle, false)
    setAwaitingEntry(false)
  })

  // 124 그림 0x16778 — 목록 판과 머리띠만(관리 화면은 없다). 취소 → 106
  /**
   * 팝업 0x78(`PitchChoicePopup`)은 화면 밖 한 자리에 둔다 — 확인 키가 그 갱신에 상태를 108 · 123 으로 바꿔 아래 화면이 갈려도
   * 창은 그 위에서 줄어든다(0x19398 → 0xbcb49 뒤 [창+0x215]). 화면 갈래마다 따로 두면 창이 새로 서 버린다.
   */
  const choicePopup = menu.choice !== null && (
    <PitchChoicePopup selected={menu.choiceIndex} onMove={menu.moveChoice}
      onChoose={menu.chooseOption} onClosed={() => menu.chooseOption(-1)} />
  )
  /** 기록실 팝업이 124 위에서 다 줄어들었다 — 다시 [기록실] 을 열 때 내린다 */
  const [isRecordPopupGone, setRecordPopupGone] = useState(false)
  const closeRecordRoom = () => {
    setRecordPick(null)
    setRecordPopupGone(false)
    menu.closeWindow()
  }
  /** 106 칸 4 [기록실] 팝업 0x80 — 확인한 다음 틀에 124 가 서고 창은 그 위에서 줄어든다(0x196ec → 0xbcb49). 갈래 밖 한 자리 */
  const recordPopup = menu.subWindow === '기록실' && !isRecordPopupGone && (
    <NariRecordPickPopup onChoose={setRecordPick} onCancel={closeRecordRoom} onClosed={() => setRecordPopupGone(true)} />
  )
  return <>{managementBodyOf()}{choicePopup}{recordPopup}</>

  function managementBodyOf() {
  if (menu.subWindow === '기록실' && recordPick !== null) {
    return <NariRecordView edition="투수" career={career} pick={recordPick} gamePoint={career.gamePoint}
      onBack={closeRecordRoom} />
  }

  const isBasicInfo = menu.subWindow === '기본정보'
  // 106 칸 4 [기록실] 의 팝업 0x80 은 106 화면 위에 뜬다 — 124 로 가면 `NariRecordView` 가 화면을 덮는다
  const isRecordRoom = menu.subWindow === '기록실'
  // 108 탭 2 그림 0x19e44 = 관리 화면 0x19da4 위에 창 0x803d4 — 아래 줄은 107 하위 메뉴 그대로다
  const isPitchTraining = menu.subWindow === '구질훈련'
  // 108 탭 1 도 같은 그림 0x19e44 — 관리 화면 위에 창 0x803d4
  const isMagicTraining = menu.subWindow === '마구훈련'
  // 123 그림 0x19e24 = 관리 화면 0x19da4 위에 창 0x803d4(상태 0x7b) — 아래 줄은 106 하위 메뉴 그대로다
  const isRepertoire = menu.subWindow === '구질목록'
  const isMenuShown = menu.subWindow === null || isRecordRoom || isPitchTraining || isMagicTraining || isRepertoire
  return (
    <RawScreen>
      {/*
        105 · 106 · 107 · 110 그림 0x19da4 — 앞그림 0x16928 의 공 무늬 → 커맨드 줄 0x7e418 → 상태판 0x7d34c(모드 3) →
        가운데 판 0x7f814(선수 하나) → 머리띠. 하위 메뉴(106·107·110)가 열려도 화면은 그대로고 아래 줄만 바뀐다 (0x7e84c).
      */}
      {isMenuShown && (
        <>
          <SkinBackdrop kind="공무늬" />
          <PitcherCommandBar menu={menu} mainOffIds={nariMainMenuOffIdsOf(career)}
            mainCursor={mainCursor} hasActed={career.hasActedThisCycle}
            isKeyEnabled={!isRecordRoom && !isPitchTraining && !isMagicTraining && !isRepertoire && menu.choice === null && menu.detail === null && menu.question === null && menu.notice === ''} />
          <PitcherStatusBoard career={career} />
          <CenterStage slidesIn={props.centerSlidesIn ?? false} characters={nariStageCharactersOf({
            morale: career.morale, isSick: career.isSick, isInjured: career.isInjured, isSlugger: false, skinIndex: career.skinIndex,
          })} />
        </>
      )}
      {/*
        119 그림 0x166cc — 장면 틀 0x16928 의 공 무늬(0x5fd61, 상태 0x8e~0x90 밖은 다 깐다) 위에 기본정보 카드 0x15e20
        (카드 판 · 레이더 · 투수 그림 · 정보 칸 0x7c451) → 머리띠 0x54d95(제목 9 · 바닥 0x87)
      */}
      {isBasicInfo && (
        <>
          <SkinBackdrop kind="공무늬" />
          <PitcherBasicInfoPanel career={career} />
        </>
      )}
      {/* 123 창 0x803d4(상태 0x7b) — 키 0x17cec 는 창이 받는다, 취소는 106 */}
      {isRepertoire && (
        <PitcherRepertoirePanel
          career={career}
          tab={menu.pitchWindowTab}
          isKeyEnabled={menu.notice === '' && menu.question === null && menu.choice === null}
          onSelectMagic={menu.selectMagicCell}
          onSelectPitch={menu.selectPitchCell}
          onClose={menu.closeWindow}
        />
      )}

      {/* 108 탭 2 구질 훈련 창 0x803d4 — 키는 창이 받는다(0x17828 → 0x80268), 취소는 107 */}
      {isPitchTraining && <PitchTrainingScreen career={career} onTrain={menu.trainPitch} onClose={menu.closeWindow} />}
      {/* 108 탭 1 마구 창 0x803d4 — 키는 `usePitcherManagementMenu`(0x17828 → 0x80268), 취소는 107 */}
      {isMagicTraining && (
        <PitcherMagicTrainingPanel career={career} cursor={menu.magicTrainingCursor}
          onMoveCursor={menu.moveMagicTrainingCursor} onConfirm={menu.confirmMagicTrainingCell} />
      )}


      {/* 능력치 상세(120) — 그림 0x1b2e4 = 기본정보 카드 → 창 0x8a0a4 → 머리띠(0x7f4ed). 표·글은 0x88fe8 */}
      {isBasicInfo && menu.abilityDetailOffset !== null && (() => {
        const view = pitcherAbilityDetailViewOf(career)
        return <DetailWindow rows={view.rows} messages={view.messages} scrollOffset={menu.abilityDetailOffset}
          onClose={menu.closeAbilityDetail} />
      })()}

      {/*
        머리띠 제목 9 · 바닥 — 기본정보(119)·칭호(129)는 0x87, 120 과 그 밖은 0x16928 의 5. 되돌아가기 = 취소(−16):
        105 는 메인 메뉴로, 그 아래 화면은 한 단계 위로.
      */}
      <ScreenFrame title="나만의리그투수편" gamePoint={career.gamePoint} onBack={menu.back}
        footer={isBasicInfo && menu.abilityDetailOffset === null ? BASIC_INFO_FOOTER : undefined} slides={false}
        // 기본정보(119) 바닥띠 "*닉네임" · "0상세정보" 표시 = '*'(129 칭호) · '0'(120 능력치 상세) 키 — 그 표시 위 투명 누름 칸
        footerPresses={{
          [FOOTER_BITS.nickname]: { label: '* 칭호', onPress: () => pressKey('*') },
          [FOOTER_BITS.detail]: { label: '0 상세정보', onPress: () => pressKey('0') },
        }} />


      {/*
        칭호 목록 창 — 원본 하위 상태 **129** (P3 10-1). 기본정보(119) 위에 겹쳐 뜨고
        '*' 키로 여닫는다 (`usePitcherManagementMenu` 의 키 처리 주석 참고).
      */}
      {isBasicInfo && menu.isTitleWindowOpen && (
        <TitleListWindow
          career={titleViewOf(career)}
          onEquip={menu.equipTitle}
          onClose={menu.closeTitleWindow}
          initialTop={mainCursor.titleListTop ?? 0}
          onTopChange={(top) => { mainCursor.titleListTop = top }}
        />
      )}
      {/* 스킬 창 — 하위 상태 122. 타자편 위젯을 그대로 쓴다 (키 0x13140 · 대화 0x147b0 에 모드 갈림이 없다) */}
      {menu.subWindow === '아이템/스킬' && (
        <SkillWindow
          career={career}
          // 0x7b970 이 거짓 — 딱지 150 "투수" · 이름 0x8457c(비트 8 부터 표 번호 비트+16) · 서브아이템 능력치 StrMODE[40+i]
          side="투수"
          onEquip={menu.equipSkill}
          onExpandSlots={menu.expandSkillSlots}
          onClose={menu.closeWindow}
        />
      )}

      {/* 상세 결과 창(0x872a1) — 타자편 창을 그대로 쓴다 (두 모드 공용, 이름표만 340~343). 화면 기준 원본 좌표 */}
      {menu.detail !== null && (
        // 훈련 0x17f5c · 휴식 0x18e3c 결과 — 0x741a0(높이 0), 키 0x1b4c4 · 0x1b308 이 0x742a9 로 바로 치운다
        <DetailWindow rows={menu.detail.rows} messages={menu.detail.messages} onClose={menu.closeDetail} opensAsCommonPopup />
      )}

      {menu.question !== null && (
        <MessageBox
          text={`!C${menu.question.text}`}
          buttons={['예', '아니오']}
          onAnswer={(index) => menu.answerQuestion(index === 0)}
        />
      )}
      {menu.question === null && menu.notice !== '' && (
        <MessageBox text={`!C${menu.notice}`} buttons={['확인']} onAnswer={menu.dismissNotice} />
      )}
    </RawScreen>
  )
  }
}
