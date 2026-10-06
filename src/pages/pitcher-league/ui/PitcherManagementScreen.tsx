import { MenuList, MessageBox, Panel, RawScreen } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { createCareer } from '@/entities/career/model/playerCareer'
import { TitleListWindow } from '@/widgets/management/ui/TitleListWindow'
import { SkillWindow } from '@/widgets/skill-window/ui/SkillWindow'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import { usePitcherManagementMenu } from '@/pages/pitcher-league/model/usePitcherManagementMenu'
import { PitcherStatusBoard } from '@/pages/pitcher-league/ui/PitcherStatusBoard'
import { PitcherBasicInfoPanel } from '@/pages/pitcher-league/ui/PitcherBasicInfoPanel'
import { PitcherRepertoirePanel } from '@/pages/pitcher-league/ui/PitcherRepertoirePanel'
import { PitcherRecordPanel } from '@/pages/pitcher-league/ui/PitcherRecordPanel'
import { PitchTrainingScreen } from '@/pages/pitcher-league/ui/PitchTrainingScreen'
import { DetailWindow } from '@/pages/management/ui/DetailPopup'
import * as styles from '@/pages/pitcher-league/ui/PitcherManagementScreen.css'

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
 * ⚠️ 본문(상태판·하위 창)은 여전히 **원본 배치 미해독 — 근사**: 머리띠와 바닥띠 사이 판에 줄로 세운다.
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
}

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

export function PitcherManagementScreen(props: PitcherManagementScreenProps) {
  const { career } = props
  const menu = usePitcherManagementMenu(props)

  // 구질 훈련(상태 108 의 구질 탭)은 이미 있는 창을 그대로 쓴다 — 새로 만들지 않는다
  if (menu.subWindow === '구질훈련') {
    return (
      <PitchTrainingScreen
        career={career}
        onTrained={menu.saveTrainedPitch}
        onClose={menu.closeWindow}
      />
    )
  }

  const isBasicInfo = menu.subWindow === '기본정보'
  return (
    <RawScreen>
      {/* 하위 메뉴(106·107)가 열려도 화면은 그대로고 아래 줄만 바뀐다 (0x7e84c). 본문은 근사 — 머리띠·바닥띠 사이 판 */}
      <div className={styles.frameBody}>
        {menu.subWindow === null && <PitcherStatusBoard career={career} />}
        {isBasicInfo && <PitcherBasicInfoPanel career={career} />}
        {menu.subWindow === '구질목록' && (
          <PitcherRepertoirePanel
            career={career}
            tab={menu.pitchWindowTab}
            onChangeTab={menu.changePitchTab}
            onSelectMagic={menu.selectMagicCell}
            onSelectPitch={menu.selectPitchCell}
          />
        )}
        {menu.subWindow === '기록실' && <PitcherRecordPanel career={career} tab={menu.recordWindowTab} />}

        {menu.subWindow === null && menu.choice === null && menu.detail === null && (
          <Panel heading={menu.kind === '관리' ? '커맨드' : menu.kind}>
            <MenuList items={menu.items} onSelect={menu.select} />
          </Panel>
        )}

        {/*
          팝업 0x78 — StrMODE[59] "원하는 항목을 선택해주세요".
          원본은 좌우 키로 `+0x166` 을 토글하고 확인으로 고르는 작은 창이다
          (그리기 0x190f8 · 키 0x19398) — 키는 `usePitcherManagementMenu` 가 본다.
          ⚠️ **원본 배치 미해독 — 근사**: 여기서는 두 칸 버튼을 가로로 놓고 고른 칸을 눌러 그린다.
        */}
        {menu.choice !== null && (
          <Panel heading={menu.choice.text}>
            <div className={styles.tabRow}>
              {menu.choice.labels.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={index === menu.choiceIndex}
                  className={`${styles.tab} ${index === menu.choiceIndex ? styles.tabSelected : ''}`}
                  onPointerEnter={() => menu.moveChoice(index)}
                  onClick={() => menu.chooseOption(index)}
                >
                  {label}
                </button>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {/*
        머리띠 제목 9 · 바닥 — 기본정보(119)·칭호(129)는 0x87, 그 밖은 0x16928 의 5. 되돌아가기 = 취소(−16):
        105 는 메인 메뉴로, 그 아래 화면은 한 단계 위로.
      */}
      <ScreenFrame title="나만의리그투수편" gamePoint={career.gamePoint} onBack={menu.back}
        footer={isBasicInfo ? BASIC_INFO_FOOTER : undefined} />

      {/*
        칭호 목록 창 — 원본 하위 상태 **129** (P3 10-1). 기본정보(119) 위에 겹쳐 뜨고
        '*' 키로 여닫는다 (`usePitcherManagementMenu` 의 키 처리 주석 참고).
      */}
      {isBasicInfo && menu.isTitleWindowOpen && (
        <TitleListWindow
          career={titleViewOf(career)}
          onEquip={menu.equipTitle}
          onClose={menu.closeTitleWindow}
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
        <DetailWindow rows={menu.detail.rows} messages={menu.detail.messages} onClose={menu.closeDetail} />
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
