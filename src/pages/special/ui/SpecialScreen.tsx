import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type {
  Collection, HallOfFamePlayerPick, HallOfFameResult, HallOfFameSide,
} from '@/entities/collection/model/collection'
import {
  firstEmptyHallOfFameSlot, hallOfFameBatterAt, hallOfFamePitcherAt, isHallOfFameSlotOpen,
} from '@/entities/collection/model/collection'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { abilityChartFrameOf } from '@/pages/create-player/lib/teamSelectLayout'
import type { ChartPoint } from '@/pages/create-player/lib/teamSelectLayout'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { RecordAnnals } from '@/pages/record/ui/RecordAnnals'
import {
  DESCRIPTION_PANEL, FOOTER, HALL_OF_FAME_BUBBLE, HALL_OF_FAME_CHART, HALL_OF_FAME_DETAIL, HALL_OF_FAME_GRID,
  HALL_OF_FAME_PITCHER_SLOTS, HALL_OF_FAME_SLOTS, HALL_OF_FAME_SLOT_ART, HALL_OF_FAME_TAGS,
  HEADBAND, ITEM_COUNT, NARI_BATTER_SLOT, NARI_PITCHER_SLOT, ROW, SCREEN, SLT_FRAME, SPECIAL_ITEMS, WHEEL,
  descriptionPanelTopOf, hallOfFameBubblePositionOf, hallOfFameCellOf, hallOfFameChartVerticesOf,
  hallOfFameEntryOfSlot, hallOfFameKeyCodeOf, rowLeftOf, rowTopOf,
} from '@/pages/special/lib/specialLayout'
import type { HallOfFameSlotState } from '@/pages/special/lib/specialLayout'
import * as styles from '@/pages/special/ui/SpecialScreen.css'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import type { SkinBackdropKind } from '@/pages/special/ui/SkinBackdrops'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'

const MAIN_UI = './sprites/main_ui'
const MAIN_UI_FRAMES = `${MAIN_UI}/frames`
const MAIN_BALL_FRAMES = './sprites/main_ball/frames'
const GAME_FRAME = './sprites/game_frame'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

type SpecialView = '목록' | '기록연감' | '명예의 전당' | '마선수선택' | '에디트'

interface SpecialScreenProps {
  readonly collection: Collection
  /**
   * **스페셜 마선수 선택** (하위 상태 28 — 그리기 0x2df78 · 갱신 0x2af20): 마선수 오픈·레벨업 격자.
   * 화면은 `pages/general-mode` 의 마선수 고르기(`mode="레벨업"`)라 앱이 꽂아 준다.
   * `onBack` 은 CLR — 원본도 상태 6(이 목록)으로 돌아간다 (0x2b126 → 0xbcb49(…, 6)).
   * 안 넘기면 칸을 눌러도 아무 일이 없다.
   */
  readonly renderAceSelect?: (onBack: () => void) => ReactNode
  /**
   * **스페셜 에디트** (하위 상태 29 — 갱신 0x2b2e0 · 그리기 0x2e1e0): 선수 이름 바꾸기.
   * 화면은 `pages/special-edit` 이라 앱이 꽂아 준다. `onBack` 은 팀 고르기의 CLR — 원본도 상태 6(이 목록)으로
   * 돌아간다 (0x2b432 `0xbcb49(this+0x18, 6)`). 안 넘기면 칸을 눌러도 아무 일이 없다.
   */
  readonly renderEdit?: (onBack: () => void) => ReactNode
  /** 명예의 전당 말풍선 "슬롯에서 삭제" (0x2ac00 · 0x62994). 안 넘기면 안내만 띄운다 */
  readonly hallOfFameDeletion?: HallOfFameDeletion
  /**
   * 전역 G(`mgr+0x64`) — 머리띠 0x54d95 는 제목이 −1 이 아니면 오른쪽 위에 G포인트(0x54a60)를 그린다(0x550d8~0x550de).
   * 스페셜 목록(하위 6, 0x2860c → `0x54d95(skin, 0, 5)`)과 명예의 전당(하위 27, 0x2dcd8 → `0x54d95(skin, 16, 5)`)이 다 그렇다.
   * 넘기면 두 화면 머리띠를 G 까지 그리고, 안 넘기면 예전처럼 제목 0 띠만(G 없음) 그린다.
   */
  readonly gamePoint?: number
  readonly onBack: () => void
}

/**
 * 원작 메인 메뉴 [스페셜] = 하위 상태 6 (그리기 0x2860c — P6 2d).
 *
 * 반원 바퀴(0x24b1c) 위에 **하위 목록 0x2524c** 여덟 칸이 오른쪽 세로로 서고, 머리띠 0x54d95(제목 0
 * "2010프로야구", 바닥 5 = 되돌아가기)가 위아래를 덮는다. 칸 그림은 main_ui 프레임
 * **15 G포인트충전 · 16 G포인트선물 · 17 친구추천 · 18 명예의전당 · 19 마선수선택 · 20 에디트 ·
 * 21 기록연감 · 28 선물받기** (표 0xceb2f 확정).
 *
 * 오프라인 웹판에서 실제로 도는 칸은 **명예의전당·마선수선택·에디트·기록연감** 넷뿐이지만, 원본에 있는 칸을 지우지 않고
 * 여덟 칸을 다 그린다. 나머지(통신 기능 = 충전·선물·친구추천·선물받기)는 흐리게 그리고 누르면 안내를 띄운다.
 * 마선수선택(상태 28)은 앱이 `renderAceSelect` 로, 에디트(상태 29)는 `renderEdit` 로 꽂는다.
 *
 * ⚠️ 근사한 곳: 줄 y(원본은 굴러가는 목록이라 여덟 줄을 한 번에 세우려고 간격을 벌렸다 — `ROW` 주석),
 * 바퀴는 호와 공만(칸 여섯은 메인 메뉴 몫), 배경은 원본이 무엇을 까는지 아직 못 읽어 검정 그대로다.
 */
export function SpecialScreen({ collection, renderAceSelect, renderEdit, hallOfFameDeletion, gamePoint, onBack }: SpecialScreenProps) {
  const [view, setView] = useState<SpecialView>('목록')
  const [cursor, setCursor] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const openItem = (index: number) => {
    const item = SPECIAL_ITEMS[index]
    setCursor(index)
    if (item.availability !== '됨') return setNotice(item.blockedText ?? '')
    if (item.id === '마선수선택') return renderAceSelect === undefined ? undefined : setView('마선수선택')
    if (item.id === '에디트') return renderEdit === undefined ? undefined : setView('에디트')
    setView(item.id === '기록연감' ? '기록연감' : '명예의 전당')
  }

  useEffect(() => {
    if (view !== '목록' || notice !== null) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (step !== 0) {
        event.preventDefault()
        return setCursor((previous) => (previous + step + ITEM_COUNT) % ITEM_COUNT)
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        return openItem(cursor)
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (view === '기록연감') {
    return <RecordAnnals collection={collection} {...(gamePoint === undefined ? {} : { gamePoint })} onBack={() => setView('목록')} />
  }

  if (view === '마선수선택' && renderAceSelect !== undefined) {
    return <>{renderAceSelect(() => setView('목록'))}</>
  }

  if (view === '에디트' && renderEdit !== undefined) {
    return <>{renderEdit(() => setView('목록'))}</>
  }

  if (view === '명예의 전당') {
    const mode: HallOfFameMode = hallOfFameDeletion === undefined
      ? { kind: '보기' }
      : { kind: '보기', deletion: hallOfFameDeletion }
    // 하위 27 그리기 0x2dcd8: 배경 0x58371 · 목록 k 8 · 머리띠 0x54d95(skin, 16 "명예의전당", 5)
    return (
      <HallOfFameScreen collection={collection} mode={mode} onBack={() => setView('목록')}
        {...(gamePoint === undefined ? {} : { frame: { title: '명예의전당', gamePoint } })} />
    )
  }

  const selected = SPECIAL_ITEMS[cursor]

  return (
    <RawScreen>
      {/* 반원 바퀴 0x24b1c — 테두리 원 3겹 (120, 320) 반지름 93·95·97 */}
      <svg
        className={styles.sprite}
        style={{ left: 0, top: 0 }}
        viewBox={`0 0 ${SCREEN.width} ${SCREEN.height}`}
        width={SCREEN.width}
        height={SCREEN.height}
        shapeRendering="crispEdges"
      >
        {WHEEL.radii.map((radius, index) => (
          <circle key={radius} cx={WHEEL.centerX} cy={WHEEL.centerY} r={radius} fill="none" stroke={WHEEL.colors[index]} />
        ))}
      </svg>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(MAIN_BALL_FRAMES, WHEEL.ball.frame)}
        style={{ left: WHEEL.centerX + WHEEL.ball.dx, top: WHEEL.centerY + WHEEL.ball.dy }}
      />

      {/* 여덟 칸 — 고른 줄은 설명 판이 그리므로 목록에서는 빼고 그린다 (원본도 판이 그 자리를 덮는다) */}
      {SPECIAL_ITEMS.map((item, index) => (
        index === cursor ? null : (
          <img
            key={item.id}
            className={`${styles.sprite} ${item.availability === '됨' ? '' : styles.dimmed}`}
            alt=""
            src={imageSrc(MAIN_UI_FRAMES, item.labelFrame)}
            style={{ left: rowLeftOf(item), top: rowTopOf(index) }}
          />
        )
      ))}

      {/* 고른 줄 설명 판 = main_ui 이미지 3 (149×63) 을 (96, 줄 y − 31), 안에 항목 그림 + 설명 글 */}
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(MAIN_UI, DESCRIPTION_PANEL.image)}
        style={{ left: DESCRIPTION_PANEL.x, top: descriptionPanelTopOf(cursor) }}
      />
      <img
        className={`${styles.sprite} ${selected.availability === '됨' ? '' : styles.dimmed}`}
        alt=""
        src={imageSrc(MAIN_UI_FRAMES, selected.labelFrame)}
        style={{
          left: DESCRIPTION_PANEL.x + DESCRIPTION_PANEL.padding,
          top: descriptionPanelTopOf(cursor) + DESCRIPTION_PANEL.padding,
        }}
      />
      <div
        className={styles.description}
        style={{
          left: DESCRIPTION_PANEL.x + DESCRIPTION_PANEL.padding,
          top: descriptionPanelTopOf(cursor) + DESCRIPTION_PANEL.textDy,
          color: DESCRIPTION_PANEL.textColor,
        }}
      >
        {selected.description.split('!N').map((line) => <div key={line}>{line}</div>)}
      </div>

      {/* 눌림을 받는 투명 칸 — 그림 위에 얹어 설명 판에 가린 줄도 누를 수 있게 한다 */}
      {SPECIAL_ITEMS.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={styles.row}
          aria-label={item.id}
          aria-current={index === cursor}
          style={{ left: rowLeftOf(item), top: rowTopOf(index), width: item.labelWidth, height: ROW.step }}
          onMouseEnter={() => setCursor(index)}
          onClick={() => openItem(index)}
        />
      ))}

      {gamePoint === undefined
        ? <SpecialBands onBack={onBack} />
        : <ScreenFrame title="2010프로야구" gamePoint={gamePoint} onBack={onBack} />}

      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />}
    </RawScreen>
  )
}

/** 머리띠·바닥띠 0x54d95(skin, 0, 5) — 제목 "2010프로야구" + 바닥 되돌아가기 (P6 1-1) */
function SpecialBands({ onBack }: { readonly onBack: () => void }) {
  return (
    <>
      <svg
        className={styles.sprite}
        style={{ left: 0, top: 0 }}
        viewBox={`0 0 ${SCREEN.width} ${SCREEN.height}`}
        width={SCREEN.width}
        height={SCREEN.height}
        shapeRendering="crispEdges"
      >
        <rect x={0} y={HEADBAND.band.y} width={SCREEN.width} height={HEADBAND.band.height} fill={HEADBAND.band.color} />
        <rect x={0} y={HEADBAND.line.y} width={SCREEN.width} height={HEADBAND.line.height} fill={HEADBAND.line.color} />
        <rect x={0} y={FOOTER.band.y} width={SCREEN.width} height={FOOTER.band.height} fill={FOOTER.band.color} />
        <rect x={0} y={FOOTER.line.y} width={SCREEN.width} height={1} fill={FOOTER.line.color} />
      </svg>
      {HEADBAND.tileXs.map((x) => (
        <img key={x} className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, HEADBAND.tileImage)} style={{ left: x, top: HEADBAND.tileY }} />
      ))}
      <img className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, HEADBAND.cornerImage)} style={{ left: HEADBAND.cornerX, top: HEADBAND.tileY }} />
      <img className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, HEADBAND.title.image)} style={{ left: HEADBAND.title.x, top: HEADBAND.title.y }} />
      {FOOTER.tileXs.map((x) => (
        <img key={x} className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, FOOTER.tileImage)} style={{ left: x, top: FOOTER.tileY }} />
      ))}
      <img className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, FOOTER.cornerImage)} style={{ left: FOOTER.cornerX, top: FOOTER.tileY }} />
      <button
        type="button"
        className={styles.backButton}
        aria-label="되돌아가기"
        style={{ left: FOOTER.backIcon.x, top: FOOTER.backIcon.y }}
        onClick={onBack}
      >
        <img src={imageSrc(GAME_FRAME, FOOTER.backIcon.image)} alt="" />
      </button>
    </>
  )
}

/** 등록 목록에서 나리 선수 칸(0·5)에 그릴 선수 — 저장이 없으면 null (칸 상태 2) */
export interface HallOfFameNariPlayer {
  readonly name: string
  /** `0xb6415(기록, k, 1)` — 능력치 도형 값 */
  readonly equippedAbility: readonly number[]
}

/** 명예의 전당 목록의 두 쓰임 */
export type HallOfFameMode =
  /** 스페셜 명예의 전당 — 하위 상태 27, 목록 종류 2 (0x26024). `deletion` 을 넘기면 말풍선 "슬롯에서 삭제" 가 돈다 */
  | { readonly kind: '보기'; readonly deletion?: HallOfFameDeletion }
  /**
   * 엔딩 뒤 등록 — 나리 상태 145, 목록 종류 3 (0x1c91e). 키는 0x62568 이 `0x5eae0` 결과 코드와 모드로 가른다.
   * `onRegister(칸)` 은 칸 번호(없으면 첫 빈 칸)로 등록을 해 보고 결과를 돌려준다. `onDone` 은 등록 뒤 메인 메뉴,
   * `onLater` 는 "나중에 등록" 예.
   */
  | {
      readonly kind: '등록'
      readonly edition: HallOfFameSide
      readonly nari: { readonly 투수: HallOfFameNariPlayer | null; readonly 타자: HallOfFameNariPlayer | null }
      readonly onRegister: (slot: number | null) => HallOfFameResult['kind']
      readonly onDone: () => void
      readonly onLater: () => void
    }
  /**
   * **미션 선수 고르기** — 메인 메뉴 하위 17 (진입 0x2613c · 갱신 0x29a54), 목록 종류 0 (`[목록+0x1fc] = 0`, 0x261c2).
   * 0x5eb8c 가 종류 0 이면 나리 칸 0·5(1 있음 / 2 없음)와 명전 칸을 다 채운다. 키는 0x62568 의 종류 ≠ 3 갈래 0x627d4 —
   * 칸 코드 `0x5eae0` 을 표 0xd1da0 로: 1~4 → 결과 [목록+0x12c] = 코드 (0x627ec~0x627f8, `onPick`),
   * 5 → StrCOMMON[38] · 6 → StrCOMMON[39] · 7 → 칸 ≤ 4 ? [45] : [54] 현금 구매(🌐). 되돌아가기는 결과 0 (`onCancel`).
   * 편은 0x5ea1a 가 커서 칸으로 정한다(`[목록+0x288] = 칸 > 4`) — 칸 ≤ 4 가 투수다.
   */
  | {
      readonly kind: '선수고르기'
      /**
       * 어느 창인가 (기본 미션). **홈런더비** = 하위 16 (진입 0x25e6c · 갱신 0x29ac8): 목록 종류 1 이라 0x5eb8c 가
       * 투수 칸 0~4 를 안 채우고(상태 0), 격자는 5열 × **2행**(0x25e96), 키 0x62568 의 셋째 인자 5(0x29ae0)로
       * 칸 번호가 5 부터다 — 타자 칸 5~14 만 고른다. 결과 2·4 만 나온다.
       */
      readonly purpose?: '미션' | '홈런더비'
      readonly nari: { readonly 투수: HallOfFameNariPlayer | null; readonly 타자: HallOfFameNariPlayer | null }
      /**
       * 결과 1~4. 글을 돌려주면 목록 위에 알림으로 띄우고 목록에 남는다 — 시즌 선수영입(0xe340)의 중복 StrMODE[181] 자리다.
       */
      readonly onPick: (pick: HallOfFamePlayerPick) => string | undefined | void
      readonly onCancel: () => void
    }

/**
 * 말풍선 "슬롯에서 삭제" (하위 27 갱신 0x2ac00 의 하위 1, OK · 칸 1 — R11 3-1·3-2).
 * ```
 * 막기: 0x213c1(저장, 2, 1) ; team = 0x1f571(저장, 내 팀) ; 0xb50ad(team, 타자?1:0, 칸) && 전역기록+0x4e ≠ 0
 *       → StrMAINMENU[213] (팝업 종류 1, 하위 상태 그대로 — 말풍선이 남는다)
 * 통과: StrMAINMENU[128] 예/아니오 (skin+0x314 = 4) · 하위 0 (말풍선 닫힘)
 * 예(0x62994): 투수 0x22371 · 타자 0x22339 — 시즌 명단 정리 0x221dc 뒤 칸을 0 으로 · 0x5eb8c 다시 채움 · 저장 0x1f1b9 ·
 *       StrCOMMON[46]
 * ```
 * [128] 확인 창은 띄운 바로 뒤 `0x749d5(popup, 1)`(0x2ae42)로 처음 커서를 둘째 칸 **"아니오"** 에 둔다.
 */
export interface HallOfFameDeletion {
  /** 막기 검사 — 그 명전 선수가 시즌 내 팀 명단에 있고(0xb50ac) 시즌모드 경기가 진행 중(전역기록 +0x4e)인가 */
  readonly isBlocked: (side: HallOfFameSide, slot: number) => boolean
  /** "예" — 칸을 비우고 시즌 명단을 정리하고 저장한다 */
  readonly onDelete: (side: HallOfFameSide, slot: number) => void
}

/** 원본 문구 (StrCOMMON · 0xcc214 · StrMODE[219]) */
const HALL_OF_FAME_TEXT = {
  nariFirst: '!C!cFFFFFF나만의리그 선수를!N먼저 등록해야합니다', // StrCOMMON[38]
  confirm: '!C!cffffff명예의 전당에 선수를!N등록하시겠습니까?!N(!cFFFF0020000 G포인트 소모!cFFFFFF)', // StrCOMMON[50]
  full: '!C!cffffff명예의 전당에!N빈슬롯이 없습니다', // StrCOMMON[51]
  done: '!C!cffffff명예의 전당에!N등록이 완료되었습니다', // StrCOMMON[52]
  shortage: '!C!cFF0000G포인트가 부족합니다.!cFFFFFF 구매!N페이지로 이동하시겠습니까?', // 0xcc214
  later: '!C나중에 등록 하시겠습니까?!N메인 메뉴로 이동합니다', // StrMODE[219]
  deleteConfirm: '!C!cFFFFFF현재 명예선수를!N삭제 하시겠습니까?!N(!cFF0000삭제 시 복구 불가!cFFFFFF)', // StrMAINMENU[128]
  deleteBlocked: '!C!cFFFFFF시즌모드 경기 진행 중에는!N삭제 하실 수 없습니다', // StrMAINMENU[213]
  deleted: '!C!cffffff선수를 삭제하였습니다', // StrCOMMON[46]
  hallOfFameFirst: '!C!cFFFFFF명예의전당 선수를!N먼저 등록해야합니다', // StrCOMMON[39]
  // StrCOMMON[45] / [54] — 슬롯 현금 구매 (🌐)
  buyPitcherSlots: '!C!cFFFFFF슬롯을 오픈하여 명예선수를!N추가로 등록할 수 있습니다!N투수 슬롯 2개가 오픈됩니다!N!N!cFFFFFF실제 현금 !cFF0000500원!cFFFFFF의 추가 정보!N이용료 (통화료별도)가 부과!N됩니다. 아이템 구매 중 일부!N시간이 소요 될 수 있으므로!N강제종료 하지 마세요!N!N구매 하시겠습니까?',
  buyBatterSlots: '!C!cFFFFFF슬롯을 오픈하여 명예선수를!N추가로 등록할 수 있습니다!N타자 슬롯 4개가 오픈됩니다!N!N!cFFFFFF실제 현금 !cFF00001000원!cFFFFFF의 추가 정보!N이용료 (통화료별도)가 부과!N됩니다. 아이템 구매 중 일부!N시간이 소요 될 수 있으므로!N강제종료 하지 마세요!N!N구매 하시겠습니까?',
} as const

/** 등록 목록에 뜬 팝업 — 0x62568 의 창 종류 [목록+0x314] (0x16 확인 · 0x17 G 부족) 와 알림 */
type HallOfFamePopup =
  | { readonly kind: '확인'; readonly slot: number | null }
  | { readonly kind: 'G부족' }
  | { readonly kind: '나중에' }
  | { readonly kind: '완료' }
  | { readonly kind: '알림'; readonly text: string; readonly buttons: readonly string[] }
  /** 스페셜 말풍선 삭제 확인 StrMAINMENU[128] (skin+0x314 = 4) */
  | { readonly kind: '삭제확인'; readonly side: HallOfFameSide; readonly slot: number }

/**
 * 명예의 전당 목록 (공용 목록 페이지 `0x63b15` 의 k = 8 — P6 2a-3 · S9 3~4절). 스페셜(상태 27)과 엔딩 뒤 등록(나리 상태 145)이 같이 쓴다.
 *
 * 위쪽 A(58,110) 자리에 고른 칸의 선수, B(178,96) 자리에 능력치 도형, 아래쪽에 **5×3 격자 15칸**
 * (`NARI_PITCHER_SLOT` 머리말의 배치). 스페셜에서는 칸을 고르면 **말풍선**(친구에게 선물 / 슬롯에서 삭제)이 뜬다.
 *
 * ⚠️ **웹에 값이 없어 못 그린 것**
 *  - 찬 칸의 **캐릭터 그림**([skin+0x290])과 **팀 로고**(캐릭터+0x30) — 원 두 개만 깔고 이름 막대를 얹는다.
 *  - "친구에게 선물" 은 통신이 필요해 안내만 띄운다. "슬롯에서 삭제" 는 `deletion`(HallOfFameDeletion) 대로 돈다.
 *    슬롯 현금 구매·G 충전 페이지(🌐)도 열 수 없어 목록으로 돌아온다.
 */
export function HallOfFameScreen({ collection, mode, onBack, frame, backdrop }: {
  readonly collection: Collection
  readonly mode: HallOfFameMode
  readonly onBack: () => void
  /**
   * 머리띠를 다른 제목으로 그릴 때 — 머리띠 `0x54d95(skin, 제목, 5)` 는 제목이 −1 이 아니면 G포인트(0x54a60)도 그린다.
   * 시즌 선수영입 0xe2 는 공통 앞그림 0xb810 이 머리띠 객체를 `0x7f53c(hdr, 10, 5, 0)`(0xb8c8~0xb8d6, 0xe2 는 기본 갈래)로
   * 세우고 그리기 0xa10c 끝의 `0x7f4ec(hdr)` 가 `0x54d95(skin, 10 "시즌모드", 5)` 로 그린다. 안 주면 예전 그대로.
   */
  readonly frame?: { readonly title: ScreenFrameTitle; readonly gamePoint: number }
  /**
   * 바탕 — 안 주면 모드로 정한다: 등록(나리 상태 145 — 0x16928 이 `0x5fd61(skin, 0, 0, W, H)`)은 **공무늬**,
   * 보기(하위 27 0x2dcd8) · 선수고르기(미션 하위 17 0x2dec8 · 홈런더비 하위 16 0x2df20)는 **메뉴바탕** `0x58371(skin, main_title, 0)`.
   * 시즌 선수영입 0xe2 는 공통 앞그림 0xb810 이 0xdd · 0xe0 · 0xe1 밖이라 `0x5fd61` — 그 화면은 '공무늬' 를 넘겨야 원본과 같다.
   */
  readonly backdrop?: SkinBackdropKind
}) {
  const [slot, setSlot] = useState(initialHallOfFameSlotOf(mode))
  const [isBubbleOpen, setIsBubbleOpen] = useState(false)
  const [bubbleCursor, setBubbleCursor] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [popup, setPopup] = useState<HallOfFamePopup | null>(null)

  const slots = hallOfFameSlotsOf(collection, mode)
  const view = hallOfFameGridViewOf(mode)
  const current = slots[slot]
  const cell = hallOfFameCellOf(slot - view.firstSlot)
  const { a, b } = HALL_OF_FAME_DETAIL

  /** 등록 목록의 키 확인 (0x62604~0x627d0) — 결과 코드와 지금 모드(3 투수 · 4 타자)로 가른다 */
  const pressRegisterSlot = (target: number) => {
    if (mode.kind !== '등록') return
    const code = hallOfFameKeyCodeOf(slots[target].state, target)
    const entry = hallOfFameEntryOfSlot(target)
    const isMine = (side: HallOfFameSide) => mode.edition === side
    // 1·2 나리 선수 칸 → 첫 빈 칸이 있으면 [50] 확인, 없으면 [51] (0x62630 · 0x626a0)
    if ((code === 1 && isMine('투수')) || (code === 2 && isMine('타자'))) {
      const empty = firstEmptyHallOfFameSlot(collection, mode.edition)
      return setPopup(empty === null ? { kind: '알림', text: HALL_OF_FAME_TEXT.full, buttons: ['확인'] } : { kind: '확인', slot: null })
    }
    // 5 나리 선수 없음 → StrCOMMON[38] (0x62710 — 모드 3 칸 0 · 모드 4 칸 5)
    if (code === 5 && ((isMine('투수') && target === NARI_PITCHER_SLOT) || (isMine('타자') && target === NARI_BATTER_SLOT))) {
      return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.nariFirst, buttons: ['확인'] })
    }
    // 6 열린 빈 칸 — 자기 편 칸이면 그 칸으로 [50] 확인 (0x62728)
    if (code === 6 && entry !== null && isMine(entry.side)) return setPopup({ kind: '확인', slot: entry.index })
    // 7 잠긴 칸 — 자기 편이면 슬롯 현금 구매 [45]/[54] (0x62772, 🌐)
    if (code === 7 && entry !== null && isMine(entry.side)) {
      const text = entry.side === '투수' ? HALL_OF_FAME_TEXT.buyPitcherSlots : HALL_OF_FAME_TEXT.buyBatterSlots
      return setPopup({ kind: '알림', text, buttons: ['예', '아니오'] })
    }
    // 3·4 명예 선수 칸은 결과 3·4 를 남길 뿐 상태 145 가 그 결과로 하는 일이 없다 (⚠️ 0x1ca4c 가 0·7·팝업만 본다 — 유력)
    return undefined
  }

  /** 선수 고르기의 키 확인 (0x627d4~0x6286c) — 칸 코드 표 0xd1da0 */
  const pressPickSlot = (target: number) => {
    if (mode.kind !== '선수고르기') return undefined
    const code = hallOfFameKeyCodeOf(slots[target].state, target)
    const entry = hallOfFameEntryOfSlot(target)
    const pick = (chosen: HallOfFamePlayerPick) => {
      const refusal = mode.onPick(chosen)
      return typeof refusal === 'string' ? setPopup({ kind: '알림', text: refusal, buttons: ['확인'] }) : undefined
    }
    if (code === 1 || code === 2) return pick({ side: code === 1 ? '투수' : '타자', hallOfFameIndex: null })
    if ((code === 3 || code === 4) && entry !== null) return pick({ side: entry.side, hallOfFameIndex: entry.index })
    if (code === 5) return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.nariFirst, buttons: ['확인'] })
    if (code === 6) return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.hallOfFameFirst, buttons: ['확인'] })
    // 7 잠긴 칸 — 0x6282c: 칸 ≤ 4 면 [45] 투수 슬롯, 아니면 [54] 타자 슬롯 (팝업 종류 4 → 현금 구매 🌐, 웹은 목록으로)
    if (code === 7) {
      const text = target < HALL_OF_FAME_PITCHER_SLOTS ? HALL_OF_FAME_TEXT.buyPitcherSlots : HALL_OF_FAME_TEXT.buyBatterSlots
      return setPopup({ kind: '알림', text, buttons: ['예', '아니오'] })
    }
    return undefined
  }

  /**
   * 스페셜 목록의 키 확인 — 하위 27 갱신 0x2ac00 도 `0x62569(목록, 키, 0)` 이고 목록 종류 2(≠ 3)라 선수 고르기와 같은
   * 0x627d4 갈래다: 6 → StrCOMMON[39] · 7 → [45]/[54](🌐) 는 0x62568 안에서 띄우고, 결과 3·4(명예 선수 칸)만 0x2ac00 이
   * 하위 1(말풍선, 커서 0)로 받는다. 나리 칸(상태 0)은 코드 0 이라 아무 일이 없다.
   */
  const pressViewSlot = (target: number) => {
    const code = hallOfFameKeyCodeOf(slots[target].state, target)
    if (code === 3 || code === 4) {
      setBubbleCursor(0)
      return setIsBubbleOpen(true)
    }
    if (code === 6) return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.hallOfFameFirst, buttons: ['확인'] })
    if (code === 7) {
      const text = target < HALL_OF_FAME_PITCHER_SLOTS ? HALL_OF_FAME_TEXT.buyPitcherSlots : HALL_OF_FAME_TEXT.buyBatterSlots
      return setPopup({ kind: '알림', text, buttons: ['예', '아니오'] })
    }
    return undefined
  }

  const pressSlot = (target: number) => {
    if (mode.kind === '등록') return pressRegisterSlot(target)
    if (mode.kind === '선수고르기') return pressPickSlot(target)
    return pressViewSlot(target)
  }

  /** 말풍선 OK (0x2ac00 하위 1) — 0 선물(🌐, 안내만) · 1 슬롯에서 삭제 */
  const chooseBubble = (index: number) => {
    const entry = hallOfFameEntryOfSlot(slot)
    if (index !== HALL_OF_FAME_BUBBLE_DELETE || mode.kind !== '보기' || mode.deletion === undefined || entry === null) {
      return setNotice(HALL_OF_FAME_BUBBLE_NOTICES[index])
    }
    // 막히면 [213] 만 띄우고 말풍선은 그대로(하위 상태 그대로), 통과하면 [128] 확인 + 하위 0(말풍선 닫힘)
    if (mode.deletion.isBlocked(entry.side, entry.index)) {
      return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.deleteBlocked, buttons: ['확인'] })
    }
    setIsBubbleOpen(false)
    return setPopup({ kind: '삭제확인', side: entry.side, slot: entry.index })
  }

  /** 되돌아가기 — 등록 목록은 결과 0 → StrMODE[219] (0x1ca4c), 선수 고르기는 결과 0 (0x6286e), 스페셜은 상태 6 */
  const goBack = () => {
    if (mode.kind === '등록') return setPopup({ kind: '나중에' })
    if (mode.kind === '선수고르기') return mode.onCancel()
    return onBack()
  }

  useEffect(() => {
    if (notice !== null || popup !== null) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      if (isBubbleOpen) {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          return setBubbleCursor((previous) => 1 - previous)
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          return chooseBubble(bubbleCursor)
        }
        if (event.key === 'Escape' || event.key === 'Backspace') {
          event.preventDefault()
          return setIsBubbleOpen(false)
        }
        return
      }
      const dx = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      const dy = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (dx !== 0 || dy !== 0) {
        event.preventDefault()
        return setSlot((previous) => moveHallOfFameSlot(previous, dx, dy, view))
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        return pressSlot(slot)
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        goBack()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  /** 팝업 답 — 확인(0x16)·G 부족(0x17)·나중에(StrMODE[219])·완료(0x30) */
  const answerPopup = (index: number) => {
    // 삭제 확인 "예"(결과 0) → 0x62994: 칸 비우기 · 저장 · StrCOMMON[46]. "아니오" 는 0x62e54 — 창만 닫는다
    if (popup?.kind === '삭제확인' && mode.kind === '보기' && mode.deletion !== undefined) {
      if (index !== 0) return setPopup(null)
      mode.deletion.onDelete(popup.side, popup.slot)
      return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.deleted, buttons: ['확인'] })
    }
    if (popup === null || mode.kind !== '등록') return setPopup(null)
    if (popup.kind === '확인') {
      if (index !== 0) return setPopup(null)
      const result = mode.onRegister(popup.slot)
      if (result === 'G부족') return setPopup({ kind: 'G부족' })
      if (result === '빈칸없음') return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.full, buttons: ['확인'] })
      return setPopup({ kind: '완료' })
    }
    if (popup.kind === '나중에') return index === 0 ? mode.onLater() : setPopup(null)
    if (popup.kind === '완료') return mode.onDone()
    // G 부족 "예" 는 결과 7 → G 충전 페이지 139(🌐) — 웹은 목록으로 돌아온다
    return setPopup(null)
  }

  const popupView = popup === null ? null : popupTextOf(popup)
  const bubble = hallOfFameBubblePositionOf(cell)
  const chartValues = current.kind === '찬칸' ? current.chartValues : []
  const chartCenter = { x: b.x, y: b.y + HALL_OF_FAME_CHART.dy }

  return (
    <RawScreen>
      <SkinBackdrop kind={backdrop ?? (mode.kind === '등록' ? '공무늬' : '메뉴바탕')} />
      {/*
        ⚠️ 미해결(안 그림): 덧그림 0x669c1(목록) 은 바탕이 아니다 — 0x65e80(목록, &[0x1552ae0], [목록+0x298], [목록+0x204]) 이
        (0, 0, 54, 75) 를 RGB(255,0,255)(투명 키)로 채우고 고른 선수 그림 객체 [목록+0x298] 의 vt+0x10 으로 (27, 62) 에 그린 뒤
        그 54×75 를 이미지 [0x1552ae0] 로 떠 두고 화면을 검정으로 지운다(바탕은 그 뒤에 그린다). 목록 A 자리(0x655cc)가
        그 이미지를 0x98975 로 (A.x − ([목록+0x3c] ? 0x32 : 0x3b), A.y − 0x61) 에 찍는다 — 고른 선수의 **몸 그림**이다.
        부르는 곳: 메인 메뉴 그리기 0x32dd8(하위 17 · 27 앞) · 나리 0x16a34(상태 145) · 시즌 0xe9ac. 웹은 선수 몸 그림 합성을
        이 화면에 아직 잇지 않았다.
      */}
      {/* A 자리 — 원 두 개 (A−38 지름 77 · A−31 지름 63) 가 빈 칸·잠긴 칸의 바탕이다 */}
      {HALL_OF_FAME_SLOT_ART.circles.map((circle) => (
        <div
          key={circle.size}
          className={styles.hofCircle}
          style={{
            left: a.x - circle.offset, top: a.y - circle.offset,
            width: circle.size, height: circle.size, background: circle.color,
          }}
        />
      ))}

      {/* 빈 칸·잠긴 칸 아이콘은 A 가운데 (글러브 23 · 방망이 24 · 자물쇠 31) */}
      {current.kind !== '찬칸' && (
        <img
          className={styles.sprite}
          alt=""
          src={imageSrc(SLT_FRAME, hallOfFameIconOf(slot, current.state).image)}
          style={{
            left: a.x - Math.floor(hallOfFameIconOf(slot, current.state).width / 2),
            top: a.y - Math.floor(hallOfFameIconOf(slot, current.state).height / 2),
          }}
        />
      )}

      {/* 이름 막대 slt_frame 9 (82×15) 을 (A.x−41, A.y+40) + 글 (A.x−41, A.y+42, 폭 82) 가운데 */}
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, HALL_OF_FAME_SLOT_ART.nameBar.image)}
        style={{ left: a.x + HALL_OF_FAME_SLOT_ART.nameBar.dx, top: a.y + HALL_OF_FAME_SLOT_ART.nameBar.dy }}
      />
      {current.kind === '찬칸' ? (
        <div
          className={styles.hofName}
          style={{
            left: a.x + HALL_OF_FAME_SLOT_ART.nameBar.dx,
            top: a.y + HALL_OF_FAME_SLOT_ART.nameTextDy,
            width: HALL_OF_FAME_SLOT_ART.nameBar.width,
          }}
        >
          {current.name}
        </div>
      ) : (
        <img
          className={styles.sprite}
          alt={current.state === 5 ? 'LOCK' : 'EMPTY'}
          src={imageSrc(SLT_FRAME, hallOfFameBarLabelOf(current.state).image)}
          style={{
            left: a.x + HALL_OF_FAME_SLOT_ART.nameBar.dx
              + Math.floor((HALL_OF_FAME_SLOT_ART.nameBar.width - hallOfFameBarLabelOf(current.state).width) / 2),
            top: a.y + HALL_OF_FAME_SLOT_ART.nameBar.dy
              + Math.floor((HALL_OF_FAME_SLOT_ART.nameBar.height - hallOfFameBarLabelOf(current.state).height) / 2),
          }}
        />
      )}

      {/*
        딱지 — B(117 파란 막대 + img_text 159 "ABILITY") 만 그린다 (0x65744).
        ⚠️ **A 딱지는 원본도 명예의 전당(k 8)에서 안 그린다.** 공용 목록 0x63b15 가 A 딱지
        플래그 `[sp+0xb4]` 를 기본 1 로 두는데(0x63cea `movs r2,#1`), k 6·7·8·9 갈래가
        0x63da0~0x63da6 에서 0 으로 끈다 — 표 0xd1eac 가 라벨 157/159 를 적어 두어도
        그리는 쪽 0x65764~0x65768 이 `cmp r2,#0; beq` 로 A 를 통째로 건너뛴다.
        (0 으로 쓰는 곳 셋을 전수 확인했다 — A 가 그려지는 k 는 0·1·3·4·5 뿐이다.)
      */}
      {([['b', b] as const]).map(([side, point]) => {
        const tag = HALL_OF_FAME_TAGS[side]
        return (
          <div key={side}>
            <img
              className={styles.sprite}
              alt=""
              src={imageSrc(SLT_FRAME, tag.plate)}
              style={{ left: point.x + tag.plateDx, top: point.y + tag.plateDy }}
            />
            <img
              className={styles.sprite}
              alt="ABILITY"
              src={imageSrc(IMG_TEXT_FRAMES, tag.label)}
              style={{
                left: point.x - Math.floor(tag.labelWidth / 2),
                top: point.y + tag.labelDy,
              }}
            />
          </div>
        )
      })}

      <HallOfFameAbilityChart center={chartCenter} values={chartValues} />

      {/* 5×3 격자 — 칸마다 둥근 네모 RGB(48,69,205) 를 (x−3, y−3, 칸+3) 에 (0x7a844) */}
      {slots.map((entry, index) => {
        if (index < view.firstSlot || index >= view.firstSlot + view.rows * HALL_OF_FAME_GRID.columns) return null
        const box = hallOfFameCellOf(index - view.firstSlot)
        return (
          <button
            key={index}
            type="button"
            className={styles.hofCell}
            aria-label={`${index + 1}번 슬롯`}
            aria-current={index === slot}
            data-slot={index}
            data-kind={entry.kind}
            data-state={entry.state}
            style={{
              left: box.x - HALL_OF_FAME_GRID.backingInset,
              top: box.y - HALL_OF_FAME_GRID.backingInset,
              width: box.width + HALL_OF_FAME_GRID.backingInset,
              height: box.height + HALL_OF_FAME_GRID.backingInset,
              background: HALL_OF_FAME_GRID.backingColor,
              borderRadius: HALL_OF_FAME_GRID.cornerRadius,
            }}
            onMouseEnter={() => setSlot(index)}
            onClick={() => { setSlot(index); pressSlot(index) }}
          />
        )
      })}

      {/* 말풍선 (0x65866) — 판 76×36 #2E4694 + 흰 테, 칸 두 개 70×14 #213473 */}
      {isBubbleOpen && (
        <div className={styles.hofBubble} role="menu" aria-label="명예의 전당 슬롯"
          style={{
            left: bubble.x, top: bubble.y,
            width: HALL_OF_FAME_BUBBLE.width, height: HALL_OF_FAME_BUBBLE.height,
            background: HALL_OF_FAME_BUBBLE.panelColor,
            border: `1px solid ${HALL_OF_FAME_BUBBLE.borderColor}`,
            borderRadius: HALL_OF_FAME_BUBBLE.cornerRadius,
          }}>
          {HALL_OF_FAME_BUBBLE.labels.map((label, index) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              className={styles.hofBubbleCell}
              aria-current={index === bubbleCursor}
              style={{
                left: HALL_OF_FAME_BUBBLE.cell.dx,
                top: cell.y + HALL_OF_FAME_BUBBLE.cell.dys[index] - bubble.y,
                width: HALL_OF_FAME_BUBBLE.cell.width,
                height: HALL_OF_FAME_BUBBLE.cell.height,
                background: HALL_OF_FAME_BUBBLE.cell.color,
                outline: index === bubbleCursor ? `1px solid ${HALL_OF_FAME_BUBBLE.selectedBorderColor}` : undefined,
              }}
              onMouseEnter={() => setBubbleCursor(index)}
              onClick={() => chooseBubble(index)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {frame === undefined
        ? <SpecialBands onBack={goBack} />
        : <ScreenFrame title={frame.title} gamePoint={frame.gamePoint} onBack={goBack} />}

      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />}
      {popupView !== null && <MessageBox text={popupView.text} buttons={popupView.buttons}
        {...(popupView.initialSelected === undefined ? {} : { initialSelected: popupView.initialSelected })} onAnswer={answerPopup} />}
    </RawScreen>
  )
}

function popupTextOf(popup: HallOfFamePopup): {
  readonly text: string
  readonly buttons: readonly string[]
  /** 처음 커서 — 0x749d5 를 부르는 자리만 준다 (안 주면 첫 칸) */
  readonly initialSelected?: number
} {
  if (popup.kind === '확인') return { text: HALL_OF_FAME_TEXT.confirm, buttons: ['예', '아니오'] }
  if (popup.kind === 'G부족') return { text: HALL_OF_FAME_TEXT.shortage, buttons: ['예', '아니오'] }
  if (popup.kind === '나중에') return { text: HALL_OF_FAME_TEXT.later, buttons: ['예', '아니오'] }
  if (popup.kind === '완료') return { text: HALL_OF_FAME_TEXT.done, buttons: ['확인'] }
  // 0x2ae3a 0x74ef5(…[128], 종류 2) 바로 뒤 0x2ae42 `0x749d5(popup, 1)` — 처음 커서 "아니오"
  if (popup.kind === '삭제확인') return { text: HALL_OF_FAME_TEXT.deleteConfirm, buttons: ['예', '아니오'], initialSelected: 1 }
  return { text: popup.text, buttons: popup.buttons }
}

/**
 * 능력치 도형 (B 자리, `HALL_OF_FAME_CHART`) — 바탕 테두리(고정 29, #6B92F4)는 팀 도형과 같고, 값 마름모는 축 최대 800 이다.
 * 빈 칸·잠긴 칸은 기록이 없어 네 값이 0 이라 바탕만 남는다 (0x5b1de~0x5b1f6).
 * ⚠️ 축 딱지 그림(종류 2 → 4~7 · 종류 3 → 0~3 번)과 빨간 최대 테두리(anim+0x1e0)는 팀 도형과 같은 까닭으로 안 그린다.
 */
function HallOfFameAbilityChart({ center, values }: { readonly center: ChartPoint; readonly values: readonly number[] }) {
  const radius = HALL_OF_FAME_CHART.radius
  const size = radius * 2
  const pointsOf = (points: readonly ChartPoint[]) => points.map((point) => `${point.x},${point.y}`).join(' ')
  return (
    <svg className={styles.sprite} width={size} height={size} shapeRendering="crispEdges" aria-label="능력치 도형"
      viewBox={`${center.x - radius} ${center.y - radius} ${size} ${size}`}
      style={{ left: center.x - radius, top: center.y - radius }}>
      <polygon points={pointsOf(abilityChartFrameOf(center))} fill="none" stroke={ORIGINAL_COLORS.radarAxis} strokeWidth={1} />
      {values.length > 0 && (
        <polygon data-part="values" points={pointsOf(hallOfFameChartVerticesOf(center, values))}
          fill={ORIGINAL_COLORS.radarFill} fillOpacity={CHART_FILL_ALPHA} stroke={ORIGINAL_COLORS.radarEdge} strokeWidth={1} />
      )}
    </svg>
  )
}

/** 팀 도형과 같은 채움 불투명도 0xb4 (TeamSelectScreen) */
const CHART_FILL_ALPHA = 0xb4 / 0xff

/** 말풍선 둘째 칸 — 슬롯에서 삭제 */
const HALL_OF_FAME_BUBBLE_DELETE = 1

/**
 * 말풍선 칸을 웹이 못 할 때의 안내 — 선물은 통신(🌐)이라 늘 이 글이다. 삭제는 `deletion` 을 안 넘긴 화면에서만 뜬다.
 * ⚠️ 원본 선물 칸은 막기 검사(StrMAINMENU[214]) 뒤 [127] 설명 · 통신(0x62956)이다 — 통신이라 옮기지 않았다.
 */
const HALL_OF_FAME_BUBBLE_NOTICES = [
  '친구에게 선물은!N통신이 필요합니다',
  '슬롯에서 삭제는!N여기서 할 수 없습니다',
] as const

type HallOfFameSlotView =
  | { readonly kind: '찬칸'; readonly state: HallOfFameSlotState; readonly name: string; readonly chartValues: readonly number[] }
  | { readonly kind: '빈칸'; readonly state: HallOfFameSlotState }

const batterChartOf = (ability: BatterAbility) => [ability.hit, ability.power, ability.defense, ability.run]
const pitcherChartOf = (ability: PitcherAbility) => [ability.control, ability.velocity, ability.breaking, ability.stamina]

/** 칸 15개의 상태 (0x5eb8c) — `HallOfFameSlotState` 머리말 */
function hallOfFameSlotsOf(collection: Collection, mode: HallOfFameMode): readonly HallOfFameSlotView[] {
  return Array.from({ length: HALL_OF_FAME_SLOTS }, (_unused, index): HallOfFameSlotView => {
    // 홈런더비(목록 종류 1)는 투수 칸 0~4 를 채우지 않는다 (0x5ec8e → 0x5ed0e 건너뜀)
    if (mode.kind === '선수고르기' && mode.purpose === '홈런더비' && index < HALL_OF_FAME_PITCHER_SLOTS) {
      return { kind: '빈칸', state: 0 }
    }
    if (index === NARI_PITCHER_SLOT || index === NARI_BATTER_SLOT) {
      if (mode.kind === '보기') return { kind: '빈칸', state: 0 }
      const nari = index === NARI_PITCHER_SLOT ? mode.nari.투수 : mode.nari.타자
      return nari === null
        ? { kind: '빈칸', state: 2 }
        : { kind: '찬칸', state: 1, name: nari.name, chartValues: nari.equippedAbility }
    }
    const entry = hallOfFameEntryOfSlot(index)
    if (entry === null) return { kind: '빈칸', state: 0 }
    if (!isHallOfFameSlotOpen(entry.side, entry.index)) return { kind: '빈칸', state: 5 }
    if (entry.side === '투수') {
      const famer = hallOfFamePitcherAt(collection, entry.index)
      return famer === null
        ? { kind: '빈칸', state: 4 }
        : { kind: '찬칸', state: 3, name: famer.name, chartValues: pitcherChartOf(famer.equippedAbility) }
    }
    const famer = hallOfFameBatterAt(collection, entry.index)
    // 옛 저장(장비 얹은 값이 없는 선수)은 기본 능력치로 그린다
    return famer === null
      ? { kind: '빈칸', state: 4 }
      : { kind: '찬칸', state: 3, name: famer.name, chartValues: batterChartOf(famer.equippedAbility ?? famer.ability) }
  })
}

/**
 * 처음 커서 칸. 등록 목록은 자기 편 나리 칸 쪽(기존), 선수 고르기는 칸 0 —
 * 진입 0x2613c 가 목록 `+0x80` 을 0 으로 두고(0x261be) 0x5eb8c 를 부른다 (⚠️ +0x80 이 커서 칸이라는 것은 유력).
 */
function initialHallOfFameSlotOf(mode: HallOfFameMode): number {
  if (mode.kind === '선수고르기') return hallOfFameGridViewOf(mode).firstSlot
  return mode.kind === '등록' && mode.edition === '타자' ? NARI_BATTER_SLOT : NARI_PITCHER_SLOT + 1
}

/** 막대 글씨 — 잠긴 칸(5)은 LOCK(114), 그 밖은 EMPTY(113) (0x653ee~0x65432) */
function hallOfFameBarLabelOf(state: HallOfFameSlotState) {
  return state === 5 ? HALL_OF_FAME_SLOT_ART.lock : HALL_OF_FAME_SLOT_ART.empty
}

/** A 가운데 아이콘 — 상태 2·4 면 투수 칸(≤ 4) 글러브 23 · 타자 칸 방망이 24, 그 밖(0·5)은 자물쇠 31 */
function hallOfFameIconOf(slot: number, state: HallOfFameSlotState) {
  if (state !== 2 && state !== 4) return HALL_OF_FAME_SLOT_ART.padlock
  return slot < HALL_OF_FAME_PITCHER_SLOTS ? HALL_OF_FAME_SLOT_ART.glove : HALL_OF_FAME_SLOT_ART.bat
}

/** 격자 안에서 커서 옮기기 (5열 3행, 가장자리에서 멈춘다) */
function moveHallOfFameSlot(slot: number, dx: number, dy: number, view: HallOfFameGridView = FULL_GRID): number {
  const columns = HALL_OF_FAME_GRID.columns
  const cell = slot - view.firstSlot
  const column = Math.min(columns - 1, Math.max(0, (cell % columns) + dx))
  const row = Math.min(view.rows - 1, Math.max(0, Math.trunc(cell / columns) + dy))
  return view.firstSlot + row * columns + column
}

/** 보이는 격자 — 첫 칸 번호(키 0x62568 의 셋째 인자)와 행 수(목록 위젯 0x1c 의 행 인자) */
interface HallOfFameGridView {
  readonly firstSlot: number
  readonly rows: number
}

const FULL_GRID: HallOfFameGridView = { firstSlot: 0, rows: HALL_OF_FAME_GRID.rows }

/**
 * 홈런더비 선수 고르기는 칸 5 부터 5×2 (0x25e6c 위젯 (5열, 2행) · 0x29ae0 셋째 인자 5).
 * ⚠️ 그리는 자리: 두 줄을 미션·스페셜 격자의 첫 두 줄 자리(y 179·219)에 둔다 — 하위 16 그리기의 격자 y 는 안 읽었다(근사).
 */
function hallOfFameGridViewOf(mode: HallOfFameMode): HallOfFameGridView {
  if (mode.kind === '선수고르기' && mode.purpose === '홈런더비') return { firstSlot: NARI_BATTER_SLOT, rows: 2 }
  return FULL_GRID
}
