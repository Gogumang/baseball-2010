import { useEffect, useState } from 'react'
import { MarkupText, RawScreen } from '@/shared/ui'
import { GAME_VERSION, HELP_SECTIONS } from '@/shared/config/helpSections'
import {
  BODY_PANEL, DESCRIPTION_PANEL, FOOTER, HEADBAND, HELP_ITEMS, ITEM_COUNT, ROW, SCREEN, WHEEL,
  descriptionPanelTopOf, rowLeftOf, rowTopOf,
} from '@/pages/help/lib/helpLayout'
import * as styles from '@/pages/help/ui/HelpScreen.css'

const MAIN_UI = './sprites/main_ui'
const MAIN_UI_FRAMES = `${MAIN_UI}/frames`
const MAIN_BALL_FRAMES = './sprites/main_ball/frames'
const GAME_FRAME = './sprites/game_frame'
const SLT_FRAME = './sprites/slt_frame'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

interface HelpScreenProps {
  readonly onBack: () => void
}

/**
 * 원작 메인 메뉴 [도움말] = 하위 상태 9 (StrMAINMENU[2] "게임에 대한 각종 도움말을 살펴볼 수 있습니다").
 *
 * 그리기는 스페셜(상태 6)과 같은 **하위 목록 0x2524c** 다 — 반원 바퀴(0x24b1c) 위에 세로 목록이 서고
 * 머리띠 0x54d95(제목 0 "2010프로야구", 바닥 5 = 되돌아가기)가 위아래를 덮는다.
 * 칸은 표 **0xceb37** 이 정한 다섯 = main_ui 프레임 **7 일반모드 · 8 나만의리그 · 9 시즌모드 ·
 * 10 대전모드 · 13 홈런더비** (P6 2d 확정).
 *
 * 고르면 상태 37(그리기 0x2fccc) = 가운데 192 폭 창에 **StrHOWTO 본문**을 쪽 단위로 보여 준다.
 *
 * ⚠️ 근사한 곳: 줄 y(스페셜과 같은 이유로 간격을 벌렸다 — `specialLayout.ts` ROW 주석),
 * 바퀴는 호와 공만, 본문 창 안쪽 배치(표 0xcedf4 미해독)는 기록연감 쪽 제목 줄에 맞췄다.
 */
export function HelpScreen({ onBack }: HelpScreenProps) {
  const [cursor, setCursor] = useState(0)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    if (openIndex !== null) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (step !== 0) {
        event.preventDefault()
        return setCursor((previous) => (previous + step + ITEM_COUNT) % ITEM_COUNT)
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        return setOpenIndex(cursor)
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (openIndex !== null) {
    return <HelpBody index={openIndex} onBack={() => setOpenIndex(null)} />
  }

  const selected = HELP_ITEMS[cursor]

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

      {/* 다섯 칸 — 고른 줄은 설명 판이 그리므로 목록에서는 빼고 그린다 (원본도 판이 그 자리를 덮는다) */}
      {HELP_ITEMS.map((item, index) => (
        index === cursor ? null : (
          <img
            key={item.id}
            className={styles.sprite}
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
        className={styles.sprite}
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
      {HELP_ITEMS.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={styles.row}
          aria-label={item.id}
          aria-current={index === cursor}
          style={{ left: rowLeftOf(item), top: rowTopOf(index), width: item.labelWidth, height: ROW.step }}
          onMouseEnter={() => setCursor(index)}
          onClick={() => setOpenIndex(index)}
        />
      ))}

      <HelpBands onBack={onBack} />
    </RawScreen>
  )
}

/** 머리띠·바닥띠 0x54d95(skin, 0, 5) — 제목 "2010프로야구" + 바닥 되돌아가기 (P6 1-1) */
function HelpBands({ onBack }: { readonly onBack: () => void }) {
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
 * 도움말 본문 (상태 37, 그리기 0x2fccc) — 가운데 192 폭 창 + 표 0xcedf4.
 * 본문은 원본 StrHOWTO 원문(`shared/config/original/data/howto.json`)을 쪽 단위로 보여 준다.
 */
function HelpBody({ index, onBack }: { readonly index: number; readonly onBack: () => void }) {
  const item = HELP_ITEMS[index]
  const section = HELP_SECTIONS.find((candidate) => candidate.title === item.sectionTitle)
  const pages = section?.pages ?? []
  const [page, setPage] = useState(0)
  const pageCount = Math.max(pages.length, 1)
  const movePage = (step: number) => setPage((previous) => (previous + step + pageCount) % pageCount)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        return onBack()
      }
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step !== 0) {
        event.preventDefault()
        movePage(step)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <RawScreen>
      <div
        className={styles.panel}
        style={{ left: BODY_PANEL.x, top: BODY_PANEL.y, width: BODY_PANEL.width, height: BODY_PANEL.height }}
      />

      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, BODY_PANEL.bullet.image)}
        style={{ left: BODY_PANEL.bullet.x, top: BODY_PANEL.bullet.y }}
      />
      <div className={styles.bodyTitle} style={{ left: BODY_PANEL.titleX, top: BODY_PANEL.titleY }}>{item.id}</div>
      <div className={styles.pagerText} style={{ left: BODY_PANEL.pager.numberX, top: BODY_PANEL.pager.y }}>
        {page + 1}/{pageCount}
      </div>

      <div
        className={styles.bodyText}
        style={{
          left: BODY_PANEL.textX,
          top: BODY_PANEL.textY,
          width: BODY_PANEL.textWidth,
          height: BODY_PANEL.y + BODY_PANEL.height - BODY_PANEL.textY - 10,
        }}
      >
        <MarkupText raw={pages[page] ?? ''} replacements={[GAME_VERSION]} />
      </div>

      {/* 쪽 넘기기 화살 slt_frame 이미지 20 — 원본은 좌우 키지만 웹판은 누를 수 있게 둔다 */}
      <button
        type="button"
        className={styles.backButton}
        aria-label="이전 쪽"
        style={{ left: BODY_PANEL.pager.leftX, top: BODY_PANEL.pager.arrowY }}
        onClick={() => movePage(-1)}
      >
        <img src={imageSrc(SLT_FRAME, BODY_PANEL.pager.arrowImage)} alt="" />
      </button>
      <button
        type="button"
        className={styles.backButton}
        aria-label="다음 쪽"
        style={{ left: BODY_PANEL.pager.rightX, top: BODY_PANEL.pager.arrowY, transform: 'scaleX(-1)' }}
        onClick={() => movePage(1)}
      >
        <img src={imageSrc(SLT_FRAME, BODY_PANEL.pager.arrowImage)} alt="" />
      </button>

      <HelpBands onBack={onBack} />
    </RawScreen>
  )
}
