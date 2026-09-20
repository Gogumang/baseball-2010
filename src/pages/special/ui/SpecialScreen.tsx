import { useEffect, useState } from 'react'
import { MessageBox, Notice, Panel, PixelScreen, RawScreen } from '@/shared/ui'
import type { Collection } from '@/entities/collection/model/collection'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { RecordAnnals } from '@/pages/record/ui/RecordAnnals'
import {
  DESCRIPTION_PANEL, FOOTER, HEADBAND, ITEM_COUNT, ROW, SCREEN, SPECIAL_ITEMS, WHEEL,
  descriptionPanelTopOf, rowLeftOf, rowTopOf,
} from '@/pages/special/lib/specialLayout'
import * as styles from '@/pages/special/ui/SpecialScreen.css'

const MAIN_UI = './sprites/main_ui'
const MAIN_UI_FRAMES = `${MAIN_UI}/frames`
const MAIN_BALL_FRAMES = './sprites/main_ball/frames'
const GAME_FRAME = './sprites/game_frame'

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
 * 명예의 전당 (하위 상태 27 = 공용 목록 페이지 k 8).
 * 원본은 선수 슬롯 5×3 격자 + 말풍선인데(P6 2a-3) 아직 안 옮겼다 — 지금 있는 글자 화면을 그대로 쓴다.
 */
function HallOfFameView({ collection, onBack }: { readonly collection: Collection; readonly onBack: () => void }) {
  return (
    <PixelScreen title="명예의 전당" rightKey={{ label: '돌아가기', onPress: onBack }}>
      {collection.hallOfFame.length === 0 && <Notice>등록된 선수가 없습니다</Notice>}
      {collection.hallOfFame.map((famer, index) => (
        <Panel key={`${famer.name}-${index}`} heading={famer.name}>
          <Notice>
            {famer.season}년차 · 히트 {famer.ability.hit} · 파워 {famer.ability.power} · 수비 {famer.ability.defense} · 주루{' '}
            {famer.ability.run}
          </Notice>
          <Notice>{stripGameMarkup(ORIGINAL_ENDINGS[famer.endingIndex] ?? '', [famer.name]).split('\n')[0]}</Notice>
        </Panel>
      ))}
    </PixelScreen>
  )
}
