import { useEffect, useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { Collection } from '@/entities/collection/model/collection'
import { HALL_OF_FAME_BATTER_SLOTS } from '@/entities/collection/model/collection'
import { RecordAnnals } from '@/pages/record/ui/RecordAnnals'
import {
  DESCRIPTION_PANEL, FOOTER, HALL_OF_FAME_BUBBLE, HALL_OF_FAME_DETAIL, HALL_OF_FAME_GRID,
  HALL_OF_FAME_PITCHER_SLOTS, HALL_OF_FAME_SLOTS, HALL_OF_FAME_SLOT_ART, HALL_OF_FAME_TAGS,
  HEADBAND, ITEM_COUNT, ROW, SCREEN, SLT_FRAME, SPECIAL_ITEMS, WHEEL,
  descriptionPanelTopOf, hallOfFameBubblePositionOf, hallOfFameCellOf, rowLeftOf, rowTopOf,
} from '@/pages/special/lib/specialLayout'
import * as styles from '@/pages/special/ui/SpecialScreen.css'

const MAIN_UI = './sprites/main_ui'
const MAIN_UI_FRAMES = `${MAIN_UI}/frames`
const MAIN_BALL_FRAMES = './sprites/main_ball/frames'
const GAME_FRAME = './sprites/game_frame'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

type SpecialView = '목록' | '기록연감' | '명예의 전당'

interface SpecialScreenProps {
  readonly collection: Collection
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
 * 오프라인 웹판에서 실제로 도는 칸은 **명예의전당·기록연감** 둘뿐이지만, 원본에 있는 칸을 지우지 않고
 * 여덟 칸을 다 그린다. 나머지는 흐리게 그리고 누르면 안내를 띄운다
 * (통신 기능 = 충전·선물·친구추천·선물받기 / 아직 안 만든 화면 = 마선수선택·에디트).
 *
 * ⚠️ 근사한 곳: 줄 y(원본은 굴러가는 목록이라 여덟 줄을 한 번에 세우려고 간격을 벌렸다 — `ROW` 주석),
 * 바퀴는 호와 공만(칸 여섯은 메인 메뉴 몫), 배경은 원본이 무엇을 까는지 아직 못 읽어 검정 그대로다.
 */
export function SpecialScreen({ collection, onBack }: SpecialScreenProps) {
  const [view, setView] = useState<SpecialView>('목록')
  const [cursor, setCursor] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const openItem = (index: number) => {
    const item = SPECIAL_ITEMS[index]
    setCursor(index)
    if (item.availability !== '됨') return setNotice(item.blockedText ?? '')
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
    return <RecordAnnals collection={collection} onBack={() => setView('목록')} />
  }

  if (view === '명예의 전당') {
    return <HallOfFameView collection={collection} onBack={() => setView('목록')} />
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

      <SpecialBands onBack={onBack} />

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

/**
 * 명예의 전당 (하위 상태 27 = 공용 목록 페이지 `0x63b15` 의 k = 8 — P6 2a-3 · S9 3~4절).
 *
 * 위쪽 A(58,110) 자리에 고른 슬롯 한 명, B(178,96) 자리에 능력치, 아래쪽에 **5×3 격자 15칸**,
 * 커서 칸 옆에 **말풍선**(친구에게 선물 / 슬롯에서 삭제)이 뜬다.
 *
 * ⚠️ **웹에 값이 없어 못 그린 것**
 *  - 찬 슬롯의 **캐릭터 그림**([skin+0x290])과 **팀 로고**(캐릭터+0x30): 명예의 전당 기록에
 *    팀·외모가 없다. 원 두 개만 깔고 이름 막대를 얹는다.
 *  - **능력치 도형** `0x5aefd`: S9 가 "능력치 값 → 꼭짓점 길이 식" 을 못 풀어 남긴 자리라
 *    B 딱지만 두고 도형은 안 그린다.
 *  - **슬롯 상태 표** `[skin+0x20c + 슬롯×8]`(2·4 = EMPTY · 5 = LOCK · 그 밖 = EMPTY+자물쇠)을
 *    못 읽어, 웹은 기본 칸(타자 4 · 투수 2 — `collection.ts` 머리말)만 EMPTY 로 열고
 *    나머지는 LOCK 으로 둔다 — **근사**.
 *  - "친구에게 선물" 은 통신이 필요하고, "슬롯에서 삭제" 는 기록을 고치는 길이 이 화면에
 *    안 들어와 있어 둘 다 안내만 띄운다.
 */
function HallOfFameView({ collection, onBack }: { readonly collection: Collection; readonly onBack: () => void }) {
  const [slot, setSlot] = useState(HALL_OF_FAME_PITCHER_SLOTS)
  const [isBubbleOpen, setIsBubbleOpen] = useState(false)
  const [bubbleCursor, setBubbleCursor] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const slots = hallOfFameSlotsOf(collection)
  const current = slots[slot]
  const cell = hallOfFameCellOf(slot)
  const { a, b } = HALL_OF_FAME_DETAIL

  useEffect(() => {
    if (notice !== null) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      if (isBubbleOpen) {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          return setBubbleCursor((previous) => 1 - previous)
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          return setNotice(HALL_OF_FAME_BUBBLE_NOTICES[bubbleCursor])
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
        return setSlot((previous) => moveHallOfFameSlot(previous, dx, dy))
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setBubbleCursor(0)
        return setIsBubbleOpen(true)
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  const bubble = hallOfFameBubblePositionOf(cell)

  return (
    <RawScreen>
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
          src={imageSrc(SLT_FRAME, hallOfFameIconOf(slot, current.kind).image)}
          style={{
            left: a.x - Math.floor(hallOfFameIconOf(slot, current.kind).width / 2),
            top: a.y - Math.floor(hallOfFameIconOf(slot, current.kind).height / 2),
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
          {current.famer.name}
        </div>
      ) : (
        <img
          className={styles.sprite}
          alt={current.kind === '잠김' ? 'LOCK' : 'EMPTY'}
          src={imageSrc(SLT_FRAME, hallOfFameBarLabelOf(current.kind).image)}
          style={{
            left: a.x + HALL_OF_FAME_SLOT_ART.nameBar.dx
              + Math.floor((HALL_OF_FAME_SLOT_ART.nameBar.width - hallOfFameBarLabelOf(current.kind).width) / 2),
            top: a.y + HALL_OF_FAME_SLOT_ART.nameBar.dy
              + Math.floor((HALL_OF_FAME_SLOT_ART.nameBar.height - hallOfFameBarLabelOf(current.kind).height) / 2),
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

      {/* 5×3 격자 — 칸마다 둥근 네모 RGB(48,69,205) 를 (x−3, y−3, 칸+3) 에 (0x7a844) */}
      {slots.map((entry, index) => {
        const box = hallOfFameCellOf(index)
        return (
          <button
            key={index}
            type="button"
            className={styles.hofCell}
            aria-label={`${index + 1}번 슬롯`}
            aria-current={index === slot}
            data-slot={index}
            data-kind={entry.kind}
            style={{
              left: box.x - HALL_OF_FAME_GRID.backingInset,
              top: box.y - HALL_OF_FAME_GRID.backingInset,
              width: box.width + HALL_OF_FAME_GRID.backingInset,
              height: box.height + HALL_OF_FAME_GRID.backingInset,
              background: HALL_OF_FAME_GRID.backingColor,
              borderRadius: HALL_OF_FAME_GRID.cornerRadius,
            }}
            onMouseEnter={() => setSlot(index)}
            onClick={() => { setSlot(index); setBubbleCursor(0); setIsBubbleOpen(true) }}
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
              onClick={() => setNotice(HALL_OF_FAME_BUBBLE_NOTICES[index])}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <SpecialBands onBack={onBack} />

      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />}
    </RawScreen>
  )
}

/** 말풍선 두 칸은 웹에서 아직 못 하는 일이라 안내만 띄운다 (원본 글은 통신·삭제 실행이다) */
const HALL_OF_FAME_BUBBLE_NOTICES = [
  '친구에게 선물은!N통신이 필요합니다',
  '슬롯에서 삭제는!N아직 만들지 않았습니다',
] as const

type HallOfFameSlot =
  | { readonly kind: '찬칸'; readonly famer: Collection['hallOfFame'][number] }
  | { readonly kind: '빈칸' }
  | { readonly kind: '잠김' }

/**
 * 슬롯 15칸. **0~4 투수 · 5~14 타자** (0x653ee 확정).
 * ⚠️ 원본 슬롯 상태 표 `[skin+0x20c]` 를 못 읽어, 기본으로 열려 있는 칸(타자 4 · 투수 2)만
 * 빈칸으로 두고 나머지는 잠김으로 둔다 — **근사**.
 */
const OPEN_PITCHER_SLOTS = 2

function hallOfFameSlotsOf(collection: Collection): readonly HallOfFameSlot[] {
  return Array.from({ length: HALL_OF_FAME_SLOTS }, (_unused, index): HallOfFameSlot => {
    if (index < HALL_OF_FAME_PITCHER_SLOTS) {
      return index < OPEN_PITCHER_SLOTS ? { kind: '빈칸' } : { kind: '잠김' }
    }
    const batterIndex = index - HALL_OF_FAME_PITCHER_SLOTS
    const famer = collection.hallOfFame[batterIndex]
    if (famer !== undefined) return { kind: '찬칸', famer }
    return batterIndex < HALL_OF_FAME_BATTER_SLOTS ? { kind: '빈칸' } : { kind: '잠김' }
  })
}

/** 막대 글씨 — 잠긴 칸은 LOCK(114), 그 밖은 EMPTY(113) */
function hallOfFameBarLabelOf(kind: HallOfFameSlot['kind']) {
  return kind === '잠김' ? HALL_OF_FAME_SLOT_ART.lock : HALL_OF_FAME_SLOT_ART.empty
}

/** A 가운데 아이콘 — 잠기면 자물쇠 31, 투수 칸(≤ 4)이면 글러브 23, 타자 칸이면 방망이 24 */
function hallOfFameIconOf(slot: number, kind: HallOfFameSlot['kind']) {
  if (kind === '잠김') return HALL_OF_FAME_SLOT_ART.padlock
  return slot < HALL_OF_FAME_PITCHER_SLOTS ? HALL_OF_FAME_SLOT_ART.glove : HALL_OF_FAME_SLOT_ART.bat
}

/** 격자 안에서 커서 옮기기 (5열 3행, 가장자리에서 멈춘다) */
function moveHallOfFameSlot(slot: number, dx: number, dy: number): number {
  const columns = HALL_OF_FAME_GRID.columns
  const column = Math.min(columns - 1, Math.max(0, (slot % columns) + dx))
  const row = Math.min(HALL_OF_FAME_GRID.rows - 1, Math.max(0, Math.trunc(slot / columns) + dy))
  return row * columns + column
}
