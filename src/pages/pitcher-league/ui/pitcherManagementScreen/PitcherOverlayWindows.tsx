import { MessageBox } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { FOOTER_BITS } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { TitleListWindow } from '@/widgets/management/ui/TitleListWindow'
import { SkillWindow } from '@/widgets/skill-window/ui/SkillWindow'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherManagementMenu } from '@/pages/pitcher-league/model/usePitcherManagementMenu'
import { PitcherTrainingScene } from '@/pages/pitcher-league/ui/PitcherTrainingScene'
import { pitcherCardLookOf } from '@/pages/pitcher-league/lib/pitcherCardFigure'
import { DetailWindow } from './otherSlices'
import type { NariMainMenuCursor } from './otherSlices'

/** 누름 칸이 보내는 키 — 메뉴 훅의 window 키 듣개가 그대로 받는다 */
const pressKey = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))

/** 기본정보 카드 그림 0x166cc 의 바닥비트 (0x166f2 `movs r2, #0x87`) */
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

/** 칭호 목록 윗줄을 장면 동안 들고 있는 관리 메뉴 커서 칸에 적는다 */
function rememberTitleTop(mainCursor: NariMainMenuCursor, top: number) {
  mainCursor.titleListTop = top
}

/**
 * 머리띠 제목 9 · 바닥 — 기본정보(119)·칭호(129)는 0x87, 120 과 그 밖은 0x16928 의 5. 되돌아가기 = 취소(−16):
 * 105 는 메인 메뉴로, 그 아래 화면은 한 단계 위로.
 */
export function PitcherScreenFrame({
  career,
  menu,
  slidingRef,
}: {
  readonly career: PitcherCareer
  readonly menu: PitcherManagementMenu
  readonly slidingRef: { current: boolean }
}) {
  const isBasicInfo = menu.subWindow === '기본정보'
  return (
    <ScreenFrame
      title="나만의리그투수편"
      gamePoint={career.gamePoint}
      onBack={() => {
        if (!slidingRef.current) menu.back()
      }}
      footer={isBasicInfo && menu.abilityDetailOffset === null ? BASIC_INFO_FOOTER : undefined}
      slides={false}
      // 기본정보(119) 바닥띠 "*닉네임" · "0상세정보" 표시 = '*'(129 칭호) · '0'(120 능력치 상세) 키 — 그 표시 위 투명 누름 칸.
      // 칭호 목록(129)이 떠 있으면 '0' 칸은 걷는다 — 129 키 0x11f78 은 '0' 을 목록에 넘기고 목록이 버린다(타자편 `ManagementScreen`
      // 같은 자리 주석, r212). '*' 칸은 129 에서도 119 로 돌아가는 키라 둔다
      footerPresses={{
        [FOOTER_BITS.nickname]: { label: '* 칭호', onPress: () => pressKey('*') },
        ...(menu.isTitleWindowOpen ? {} : { [FOOTER_BITS.detail]: { label: '0 상세정보', onPress: () => pressKey('0') } }),
      }}
    />
  )
}

/** 머리띠 위에 뜨는 것 — 125 훈련 연출 · 129 칭호 목록 · 122 스킬 창 · 결과 창 · 질문 · 알림 */
export function PitcherOverlayWindows({
  career,
  menu,
  mainCursor,
}: {
  readonly career: PitcherCareer
  readonly menu: PitcherManagementMenu
  readonly mainCursor: NariMainMenuCursor
}) {
  return (
    <>
      {/*
        125 그림 0x19eb8 — 0x19da4(커맨드 줄 · 상태판 · 머리띠) 다음 훈련 팝업 0x848d0(팝업, 1, 0). 게이지가 차면 틀 0x18dd8 이
        훈련 0x17f5c 로 간다(굴림은 연출 뒤). 그림 객체 값은 0x11744 → 0x10810(내 기록) — 기본정보 카드와 같다
      */}
      {menu.trainingPresentation !== null && (
        <PitcherTrainingScene
          presentation={menu.trainingPresentation}
          look={pitcherCardLookOf(career, career.equipmentLevels)}
          onFinished={menu.finishTraining}
        />
      )}

      {/* 칭호 목록 창 — 원본 하위 상태 **129** (P3 10-1). 기본정보(119) 위에 겹쳐 뜨고 '*' 키로 여닫는다 (`usePitcherManagementMenu` 의 키 처리 주석 참고) */}
      {menu.subWindow === '기본정보' && menu.isTitleWindowOpen && (
        <TitleListWindow
          career={titleViewOf(career)}
          onEquip={menu.equipTitle}
          onClose={menu.closeTitleWindow}
          initialTop={mainCursor.titleListTop ?? 0}
          onTopChange={(top) => rememberTitleTop(mainCursor, top)}
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

      <PitcherMessages menu={menu} />
    </>
  )
}

/** 질문(예 · 아니오)과 알림(확인) 창 — 질문이 먼저 선다 */
function PitcherMessages({ menu }: { readonly menu: PitcherManagementMenu }) {
  return (
    <>
      {menu.question !== null && (
        <MessageBox text={`!C${menu.question.text}`} buttons={['예', '아니오']} onAnswer={(index) => menu.answerQuestion(index === 0)} />
      )}
      {menu.question === null && menu.notice !== '' && <MessageBox text={`!C${menu.notice}`} buttons={['확인']} onAnswer={menu.dismissNotice} />}
    </>
  )
}
