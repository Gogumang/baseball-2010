import { useState, type CSSProperties, type ReactNode } from 'react'
import { MarkupText, MessageBox, RawScreen } from '@/shared/ui'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'
import type { Collection, HallOfFameResult, HallOfFameSide } from '@/entities/collection/model/collection'
import { HallOfFameScreen } from '@/pages/special/ui/SpecialScreen'
import type { HallOfFameNariPlayer } from '@/pages/special/ui/SpecialScreen'
import { romanceEndingIndexOf, romanceEventsSeenOf } from '@/entities/career/model/seasonFlow'
import {
  BAND_BACKGROUND, BAND_WINDOW, BATTER_EDITION_MODE, CREDITS, ENDING_IMAGE, INJURY_ENDING, IRIS_COVER,
  LAST_WALK_IN_ENDING, RISING_TEXT, SCREEN, SHORT_ENDING_TEXT_TOP, WALK_IN, creditsTopOf, creditsWalkersOf,
  endingImageOffsetOf, endingWalkInAnimationOf, endingWalkInPaletteOf, irisCircleOf, irisStartTickOf, risingTextTopOf,
} from '@/pages/ending/lib/endingLayout'
import type { CreditsWalker, EndingWalkInLook } from '@/pages/ending/lib/endingLayout'
import * as styles from '@/pages/ending/ui/EndingScreen.css'

const ENDING_FRAMES = './sprites/ending/frames'
const MODE_BACK_FRAMES = './sprites/mode_back/frames'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

interface EndingScreenProps {
  readonly playerName: string
  readonly endingIndex: number
  /** 본 이벤트 번호 — 연애 이벤트 300~303 이 연애 엔딩(9 + c)과 제작진 인물을 고른다 (0x87c7c) */
  readonly seenEventIds?: readonly string[]
  /** 엔딩 보너스(0이면 부상·방출 엔딩) */
  readonly bonusGamePoint: number
  readonly isContinuable: boolean
  /**
   * 명예의 전당 등록 목록 (나리 상태 145) — StrMODE[215] "예" 로 들어간다. `onRegister(칸)` 은 고른 빈 칸(없으면 첫 빈 칸)으로
   * 등록을 해 보고 결과를 돌려준다 (G 20000 · 통계는 부르는 쪽).
   */
  readonly hallOfFame: {
    readonly collection: Collection
    readonly edition: HallOfFameSide
    readonly nari: { readonly 투수: HallOfFameNariPlayer | null; readonly 타자: HallOfFameNariPlayer | null }
    readonly onRegister: (slot: number | null) => HallOfFameResult['kind']
    /**
     * 전역 G(`mgr+0x64`) — 상태 145 그리기 0x15d54 는 목록 0x63b15(…, 6, 1, [this+0x2c], −1) 뒤에 머리띠 객체
     * 0x7f4ec([this+0xe0]) = `0x54d95(skin, 제목, 바닥)` 을 부르고, 그 칸은 매 틱 0x16a34 → 0x16928 이 세운다:
     * 상태 0x76·0x6d·0x65·0x80 이 아니면 기본 갈래 0x169ea 로 `0x7f53c(hdr, [this+0xcc] == 4 ? 8 : 9, 5, 0)` —
     * 타자편(모드 4)은 제목 8 "나만의리그 + 타자편", 투수편(모드 3)은 9 "… + 투수편", 바닥 5 = 되돌아가기만.
     * 제목이 −1 이 아니라 G포인트도 그린다(0x550dc). 넘기면 그 머리띠를, 안 넘기면 예전 띠(제목 0, G 없음)를 그린다.
     */
    readonly gamePoint?: number
  }
  /** 5000 G포인트로 이어하기. 모자라면 false */
  readonly onContinue: () => boolean
  readonly onFinish: () => void
  /**
   * 선수의 생김새 (레코드 +0xb, 0x63a5c) — 걸어 들어오는 그림과 제작진의 선수 애니·팔레트를 고른다.
   * 안 주면 **타격형 황인 타자**로 본다 — 애니 바탕 0 · 팔레트 2 로, 원본이 그 비트에서 뽑는 값과 같다.
   */
  readonly walkInLook?: EndingWalkInLook
}

/** 안 주었을 때의 생김새 — 모두 0 (타자편 · 타격형 · 우타 · 황인) */
const DEFAULT_WALK_IN_LOOK: EndingWalkInLook = {
  mode: BATTER_EDITION_MODE,
  typeIndex: 0,
  handIndex: 0,
  skinIndex: 0,
}

const NO_EVENTS: readonly string[] = []

/** 엔딩 뒤 원문 문구 */
const TEXT = {
  bonus: '!C엔딩 보너스 획득!N[!cFFFF00%d G포인트!cFFFFFF]', // StrMODE[214]
  ask: '!C나만의 리그 선수를!N[!cFFFF00명예의 전당!cFFFFFF]에!N등록 하시겠습니까?', // StrMODE[215]
  continue: '!C!cFFFF005000 G포인트!cFFFFFF를 소모하여 현재!N상태에서 이어하시겠습니까? ', // StrMODE[221]
  shortage: '!C!cFF0000%d G포인트!cFFFFFF가 부족합니다', // StrCOMMON[41]
}
const CONTINUE_COST = 5000

type Phase = '엔딩' | '제작진' | '보너스' | '이어하기질문' | '등록질문' | '등록목록' | '안내'
type QuestionPhase = '이어하기질문' | '등록질문'

interface Question {
  readonly text: string
  readonly onYes: () => void
  readonly onNo: () => void
}

/**
 * 나만의리그 엔딩 (상태 141 — 적재 0x87c7c · 그리기 0x168fc → 0x882b4 / 0x88bb4, `endingLayout.ts` 머리말).
 *
 * 엔딩 번호(판정표 0xa3a84): 0 부상 · 1 방출 · 2~9 은퇴 뒤 진로. 10~14 연애는 **본 엔딩 뒤 제작진 앞에** 붙는 글이고
 * (`romanceEndingIndexOf`), 20 은 은퇴 엔딩 글 앞의 머리말, 21 은 제작진이다.
 *
 * 키 0x1220c: 부상·방출(0·1)은 곧장 StrMODE[221] 이어하기를 묻는다. 그 밖은 단계 1 의 키가 제작진으로 넘기고,
 * 제작진(단계 > 2)의 키가 엔딩 보너스(StrMODE[214]) → 명예의 전당 등록(StrMODE[215])을 묻는다.
 * 등록은 명예의 전당 목록(상태 145, `HallOfFameScreen` 의 '등록')에서 칸을 골라 한다. "나중에 등록" 은 원본에서 선수를
 * 남겨 두지만, 웹판은 저장이 하나라 등록하지 않으면 사라진다.
 * G포인트가 모자랄 때 원본이 어디로 가는지는 미확인 — StrCOMMON[41] 을 띄우고 끝낸다 (추정).
 *
 * ⚠️ 근사한 곳: 단계 0(배경음이 들어오는 동안 아무것도 안 그림)과 단계 2(키 뒤 배경음이 빠지는 동안)는 배경음 페이드
 * 끝(0x1bf54)을 기다리는데, 웹은 그 기다림 없이 바로 넘긴다 — 틀 수 n 도 화면이 뜬 때부터 센다.
 */
export function EndingScreen(props: EndingScreenProps) {
  const { playerName, endingIndex, bonusGamePoint, isContinuable, hallOfFame, onContinue, onFinish } = props
  const walkInLook = props.walkInLook ?? DEFAULT_WALK_IN_LOOK
  const seenEventIds = props.seenEventIds ?? NO_EVENTS
  const [phase, setPhase] = useState<Phase>('엔딩')
  const [message, setMessage] = useState('')
  const inform = (text: string) => {
    setMessage(text)
    setPhase('안내')
  }

  const questions: Record<QuestionPhase, Question> = {
    이어하기질문: {
      text: TEXT.continue,
      onYes: () => {
        if (!onContinue()) inform(TEXT.shortage.replace('%d', String(CONTINUE_COST)))
      },
      onNo: onFinish,
    },
    // 팝업 0x2d (0x1bbc4): 예 → 상태 145 등록 목록 · 아니오 → +0x278 = 1 → 곧장 메인 메뉴 (StrMODE[219] 는 목록의 취소다)
    등록질문: {
      text: TEXT.ask,
      onYes: () => setPhase('등록목록'),
      onNo: onFinish,
    },
  }
  const question = phase === '이어하기질문' || phase === '등록질문' ? questions[phase] : null

  if (phase === '등록목록') {
    return (
      <HallOfFameScreen
        collection={hallOfFame.collection}
        mode={{
          kind: '등록',
          edition: hallOfFame.edition,
          nari: hallOfFame.nari,
          onRegister: hallOfFame.onRegister,
          onDone: onFinish,
          onLater: onFinish,
        }}
        onBack={onFinish}
        {...(hallOfFame.gamePoint === undefined ? {} : {
          frame: {
            title: hallOfFame.edition === '타자' ? '나만의리그타자편' : '나만의리그투수편',
            gamePoint: hallOfFame.gamePoint,
          },
        })}
      />
    )
  }

  /** 엔딩 → (부상·방출이면 이어하기 / 그 밖이면 제작진) → 보너스 → 등록 */
  const onPress = phase === '엔딩'
    ? () => setPhase(isContinuable ? '이어하기질문' : '제작진')
    : phase === '제작진'
      ? () => setPhase(bonusGamePoint > 0 ? '보너스' : '등록질문')
      : undefined

  const romanceEndingIndex = romanceEndingIndexOf(endingIndex, seenEventIds)
  // 제작진은 은퇴 엔딩(연애 엔딩이 붙는 e 2~9)에만 있고, 그 뒤 보너스·등록 팝업도 제작진 위에 뜬다 (단계 > 2 의 키)
  const isCredits = romanceEndingIndex !== null && phase !== '엔딩'

  return (
    <RawScreen>
      {isCredits
        ? <EndingCredits romanceEndingIndex={romanceEndingIndex} romanceEvents={romanceEventsSeenOf(seenEventIds)} look={walkInLook} />
        : endingIndex <= LAST_WALK_IN_ENDING
          ? <ShortEnding endingIndex={endingIndex} look={walkInLook} />
          : <RetirementEnding endingIndex={endingIndex} playerName={playerName} />}

      {onPress !== undefined && (
        <button type="button" className={styles.pressArea} aria-label="확인" onClick={onPress} />
      )}
      {phase === '보너스' && (
        <MessageBox
          text={TEXT.bonus.replace('%d', String(bonusGamePoint))}
          buttons={['OK']}
          onAnswer={() => setPhase('등록질문')}
        />
      )}
      {phase === '안내' && <MessageBox text={message} buttons={['OK']} onAnswer={onFinish} />}
      {question !== null && (
        <MessageBox
          text={question.text}
          buttons={['예', '아니오']}
          onAnswer={(index) => (index === 0 ? question.onYes() : question.onNo())}
        />
      )}
    </RawScreen>
  )
}

/** 띠 창 (0x883b6~0x88556 · 제작진 0x88bcc~0x88d64) — 가운데 박스 검정 + 박스 **바깥** 위·아래 11px 띠 + 선 */
function BandWindow({ children }: { readonly children?: ReactNode }) {
  const { x, y, width, height, edgeHeight } = BAND_WINDOW
  const bottom = y + height
  return (
    <>
      <svg
        className={styles.overlay}
        aria-label="띠 창"
        viewBox={`0 0 ${SCREEN.width} ${SCREEN.height}`}
        width={SCREEN.width}
        height={SCREEN.height}
        shapeRendering="crispEdges"
      >
        <rect x={0} y={0} width={SCREEN.width} height={SCREEN.height} fill={BAND_WINDOW.fill} />
        <rect data-part="box" x={x} y={y} width={width} height={height} fill={BAND_WINDOW.fill} />
        <rect data-part="top" x={x} y={y - edgeHeight} width={width} height={edgeHeight} fill={BAND_WINDOW.edgeColor} />
        <rect x={x} y={y - edgeHeight} width={width} height={1} fill={BAND_WINDOW.outerLine} />
        <rect x={x} y={y - edgeHeight + 1} width={width} height={1} fill={BAND_WINDOW.innerLine} />
        <rect data-part="bottom" x={x} y={bottom} width={width} height={edgeHeight} fill={BAND_WINDOW.edgeColor} />
        <rect x={x} y={bottom + edgeHeight - 2} width={width} height={1} fill={BAND_WINDOW.innerLine} />
        <rect x={x} y={bottom + edgeHeight - 1} width={width} height={1} fill={BAND_WINDOW.outerLine} />
      </svg>
      {/* 띠 안 배경 0x7b9ac(this, 1, y' + 1, −14) */}
      <div
        className={styles.bandClip}
        style={{
          left: BAND_BACKGROUND.left,
          top: BAND_BACKGROUND.top,
          width: SCREEN.width - BAND_BACKGROUND.left,
          height: BAND_BACKGROUND.height,
        }}
      >
        <img className={styles.sprite} alt="" src={imageSrc(MODE_BACK_FRAMES, BAND_BACKGROUND.frame)} style={{ left: 0, top: 0 }} />
      </div>
      {children}
    </>
  )
}

/** 부상·방출 엔딩 (0x883b6 갈래) — 띠 창 + 걸어 들어오는 선수(+ 부상 아이콘) + StrENDING[e] */
function ShortEnding({ endingIndex, look }: { readonly endingIndex: number; readonly look: EndingWalkInLook }) {
  const tick = useUpdateCounter()
  return (
    <BandWindow>
      <WalkIn tick={tick} look={look} hasInjuryIcon={endingIndex === INJURY_ENDING} />
      <div
        className={styles.endingText}
        style={{ left: 0, top: SHORT_ENDING_TEXT_TOP, width: SCREEN.width }}
      >
        <MarkupText raw={ORIGINAL_ENDINGS[endingIndex] ?? ''} />
      </div>
    </BandWindow>
  )
}

/**
 * 은퇴 엔딩 2~9 (0x886ca 갈래) — ending.pzx 그림이 미끄러져 서고, 원형 전환이 e 의 자리로 닫히며,
 * StrENDING[20] 머리말 + 본 엔딩 글이 아래에서 올라온다.
 */
function RetirementEnding({ endingIndex, playerName }: { readonly endingIndex: number; readonly playerName: string }) {
  const tick = useUpdateCounter()
  const irisTick = tick - irisStartTickOf(endingIndex)
  const circle = irisTick < 0 ? null : irisCircleOf(irisTick, endingIndex)
  const prologue = ORIGINAL_ENDINGS[RISING_TEXT.prologueIndex] ?? ''
  const story = ORIGINAL_ENDINGS[endingIndex] ?? ''
  const risingText = `!C${prologue}${'!N'.repeat(RISING_TEXT.gapLines)}${story}`

  return (
    <>
      <div className={styles.blackScreen} />
      <img
        className={styles.sprite}
        alt=""
        data-part="ending-image"
        src={imageSrc(ENDING_FRAMES, ENDING_IMAGE.image)}
        style={{ left: ENDING_IMAGE.x + endingImageOffsetOf(tick, endingIndex), top: ENDING_IMAGE.y }}
      />
      {/* 원형 전환 — 검정 판에 원을 뚫어 덮는다. evenodd 라 원 안쪽이 구멍이 된다 */}
      {circle !== null && (
        <svg
          className={styles.overlay}
          aria-label="원형 전환"
          viewBox={`0 0 ${SCREEN.width} ${SCREEN.height}`}
          width={SCREEN.width}
          height={SCREEN.height}
        >
          <path
            fillRule="evenodd"
            fill={IRIS_COVER}
            d={`M0,0H${SCREEN.width}V${SCREEN.height}H0Z`
              + `M${circle.x},${circle.y + circle.diameter / 2}`
              + `a${circle.diameter / 2},${circle.diameter / 2} 0 1,0 ${circle.diameter},0`
              + `a${circle.diameter / 2},${circle.diameter / 2} 0 1,0 ${-circle.diameter},0`}
          />
        </svg>
      )}
      <div
        className={styles.endingText}
        style={{ left: RISING_TEXT.x, top: risingTextTopOf(tick), width: RISING_TEXT.width }}
      >
        <MarkupText raw={risingText} replacements={[playerName]} />
      </div>
    </>
  )
}

/** 프레임 한 장 — 팔레트를 갈아 끼우고, 뒤집기 깃발이면 원점을 거울로 놓는다 */
function FramePiece({ folder, frame, origins, x, y, palette = null, isFlipped = false }: {
  readonly folder: string
  readonly frame: number
  readonly origins: FrameOrigins | null
  readonly x: number
  readonly y: number
  readonly palette?: number | null
  readonly isFlipped?: boolean
}) {
  const key = String(frame).padStart(3, '0')
  const url = useRecoloredSprite(`${folder}/${key}.png`, palette)
  const origin = origins?.[key]
  if (origin === undefined) return null
  const style: CSSProperties = isFlipped
    ? { left: x - origin.x - origin.width, top: y + origin.y, transform: 'scaleX(-1)' }
    : { left: x + origin.x, top: y + origin.y }
  return <img className={styles.sprite} style={style} src={url} alt="" data-frame={frame} />
}

/**
 * 걸어 들어오는 그림 (S12 7절 · e 0·1) — `event_char_0.pzx` 애니(육성 선수 캐릭터)와 `ui/mode_ui.pzx`
 * 프레임 87(부상 아이콘, 부상 엔딩만)이 오른쪽에서 **3틱에 1px** 씩 온다. `n & 7 == 0` 인 틱만 1px 위로 튄다.
 *
 * 애니 번호는 육성 선수 레코드의 외모 비트가 고른다 — 타자 장타형이면 **8+2**, 그 밖 **0+2** (0x63a5c).
 * 팔레트는 `event_char_0.mpl` 의 `endingWalkInPaletteOf` 벌로 갈아 끼운다 (0x63a92).
 */
function WalkIn({ tick, look, hasInjuryIcon }: {
  readonly tick: number
  readonly look: EndingWalkInLook
  readonly hasInjuryIcon: boolean
}) {
  const origins = useFrameOrigins(WALK_IN.characterFolder)
  const animations = useAnimations(WALK_IN.characterFolder)
  const iconOrigins = useFrameOrigins(WALK_IN.iconFolder)
  const entries = animations?.[endingWalkInAnimationOf(look)]
  const step = entries === undefined ? null : animationStepAt(entries, tick)
  const palette = endingWalkInPaletteOf(look)

  return (
    <div data-palette={palette} data-animation={endingWalkInAnimationOf(look)}>
      {step !== null && (
        <FramePiece
          folder={WALK_IN.characterFolder}
          frame={step.frame}
          origins={origins}
          palette={palette}
          x={WALK_IN.xOf(tick, WALK_IN.characterDx) + step.dx}
          y={WALK_IN.characterYOf(tick) + step.dy}
        />
      )}
      {hasInjuryIcon && (
        <FramePiece
          folder={WALK_IN.iconFolder}
          frame={WALK_IN.iconFrame}
          origins={iconOrigins}
          x={WALK_IN.xOf(tick, WALK_IN.iconDx)}
          y={WALK_IN.iconYOf(tick)}
        />
      )}
    </div>
  )
}

/** 20틱 구간 — 짝수 구간은 깃발 0x11(뒤집기), 홀수는 0 (0x88dd4~0x88dee) */
const TURN_TICKS = 20

/** 제작진 인물 하나 — 애니를 돌리며 띠 아래(196)에 선다 (0x88d8c~0x88e8a) */
function CreditsWalkerSprite({ walker, tick, playerPalette }: {
  readonly walker: CreditsWalker
  readonly tick: number
  readonly playerPalette: number
}) {
  const origins = useFrameOrigins(walker.folder)
  const animations = useAnimations(walker.folder)
  const entries = animations?.[walker.animation]
  const step = entries === undefined ? null : animationStepAt(entries, tick)
  if (step === null) return null
  const isFlipped = walker.turnsEvery20 ? Math.trunc(tick / TURN_TICKS) % 2 === 0 : walker.isFlipped
  return (
    <FramePiece
      folder={walker.folder}
      frame={step.frame}
      origins={origins}
      palette={walker.isPlayer ? playerPalette : null}
      isFlipped={isFlipped}
      x={walker.x + step.dx}
      y={BAND_WINDOW.y + BAND_WINDOW.height + step.dy}
    />
  )
}

/**
 * 제작진 `0x88bb4` (단계 3) — 띠 창 + 선수와 본 연애 상대들 + `"!C" + StrENDING[9 + c] + "!N"×8 + StrENDING[21]` 이
 * `(0, H − n/2, W)` 로 올라온다. 띠 아래 20px 밑으로만 보인다 (0xbaf6d 잘라내기).
 * 인물은 나중 번호부터 그려 선수가 맨 앞이다.
 */
function EndingCredits({ romanceEndingIndex, romanceEvents, look }: {
  readonly romanceEndingIndex: number
  readonly romanceEvents: readonly number[]
  readonly look: EndingWalkInLook
}) {
  const tick = useUpdateCounter()
  const walkers = creditsWalkersOf(look, romanceEvents)
  const credits = `!C${ORIGINAL_ENDINGS[romanceEndingIndex] ?? ''}${'!N'.repeat(CREDITS.gapLines)}${ORIGINAL_ENDINGS[CREDITS.index] ?? ''}`
  const palette = endingWalkInPaletteOf(look)
  return (
    <BandWindow>
      <div data-part="credits-walkers">
        {[...walkers].reverse().map((walker, index) => (
          <CreditsWalkerSprite key={walkers.length - 1 - index} walker={walker} tick={tick} playerPalette={palette} />
        ))}
      </div>
      <div
        className={styles.creditsClip}
        style={{ left: 0, top: CREDITS.clipTop, width: SCREEN.width, height: SCREEN.height - CREDITS.clipTop }}
      >
        <div
          className={styles.creditsText}
          style={{ left: CREDITS.x, top: creditsTopOf(tick) - CREDITS.clipTop, width: CREDITS.width }}
        >
          <MarkupText raw={credits} />
        </div>
      </div>
    </BandWindow>
  )
}
