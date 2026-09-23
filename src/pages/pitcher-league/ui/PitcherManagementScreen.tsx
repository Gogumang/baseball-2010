import { MenuList, MessageBox, Panel, PixelScreen } from '@/shared/ui'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { createCareer } from '@/entities/career/model/playerCareer'
import { TitleListWindow } from '@/widgets/management/ui/TitleListWindow'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { usePitcherManagementMenu } from '@/pages/pitcher-league/model/usePitcherManagementMenu'
import { PitcherStatusBoard } from '@/pages/pitcher-league/ui/PitcherStatusBoard'
import { PitcherBasicInfoPanel } from '@/pages/pitcher-league/ui/PitcherBasicInfoPanel'
import { PitcherRepertoirePanel } from '@/pages/pitcher-league/ui/PitcherRepertoirePanel'
import { PitcherRecordPanel } from '@/pages/pitcher-league/ui/PitcherRecordPanel'
import { PitchTrainingScreen } from '@/pages/pitcher-league/ui/PitchTrainingScreen'
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
 * 머리띠 제목은 `TITLE_IMAGES.나만의리그투수편`(그림 9 + 11) 자리다 —
 * ⚠️ 이 화면은 투수편의 다른 화면들처럼 공용 판(`PixelScreen`) 관례를 쓰므로 제목을 글자로 적는다
 * (**원본 배치 미해독 — 근사**).
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
  /** [아이템]·[장비착용]·[아이템/스킬] 상태 110·121·122. 투수편 상점이 없으면 넘기지 않는다 */
  readonly onOpenShop?: () => void
  /** 105 취소 — 메인 메뉴 장면 0x103 */
  readonly onExit: () => void
}

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

  const isHub = menu.kind === '관리' && menu.subWindow === null
  return (
    <PixelScreen
      title="나만의리그 투수편"
      badge={`${career.gamePoint} G`}
      /* 105 취소는 메인 메뉴로, 그 아래 화면의 취소는 한 단계 위로 (−16) */
      leftKey={{ label: isHub ? '나가기' : '되돌아가기', onPress: menu.back }}
    >
      {/* 하위 메뉴(106·107)가 열려도 화면은 그대로고 아래 줄만 바뀐다 (0x7e84c) */}
      {menu.subWindow === null && <PitcherStatusBoard career={career} />}
      {menu.subWindow === '기본정보' && <PitcherBasicInfoPanel career={career} />}
      {/*
        칭호 목록 창 — 원본 하위 상태 **129** (P3 10-1). 기본정보(119) 위에 겹쳐 뜨고
        '*' 키로 여닫는다 (`usePitcherManagementMenu` 의 키 처리 주석 참고).
      */}
      {menu.subWindow === '기본정보' && menu.isTitleWindowOpen && (
        <TitleListWindow
          career={titleViewOf(career)}
          onEquip={menu.equipTitle}
          onClose={menu.closeTitleWindow}
        />
      )}
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

      {menu.subWindow === null && menu.choice === null && (
        <Panel heading={menu.kind === '관리' ? '커맨드' : menu.kind}>
          <MenuList items={menu.items} onSelect={menu.select} />
        </Panel>
      )}

      {/*
        팝업 0x78 — StrMODE[59] "원하는 항목을 선택해주세요".
        ⚠️ 원본은 좌우 키로 `+0x166` 을 토글하는 작은 창(그리기 0x190f8 · 키 0x19398)이다.
        여기서는 두 칸 버튼으로 같은 고르기만 한다 (**원본 배치 미해독 — 근사**).
      */}
      {menu.choice !== null && (
        <Panel heading={menu.choice.text}>
          <div className={styles.tabRow}>
            {menu.choice.labels.map((label, index) => (
              <button key={label} type="button" className={styles.tab} onClick={() => menu.chooseOption(index)}>
                {label}
              </button>
            ))}
          </div>
        </Panel>
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
    </PixelScreen>
  )
}
