import { useState, type ReactNode } from 'react'
import { FrameSprite, MarkupText, MessageBox, RawScreen } from '@/shared/ui'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'
import type { HallOfFameResult } from '@/entities/collection/model/collection'
import {
  BAND_BACKGROUND, BAND_WINDOW, CREDITS, ENDING_IMAGE, ENDING_IMAGE_TICKS, ENDING_TEXT,
  IRIS, IRIS_STAGES, SCREEN, WALK_IN, creditsTopOf, endingImageXOf, irisRadiusOf,
} from '@/pages/ending/lib/endingLayout'
import * as styles from '@/pages/ending/ui/EndingScreen.css'

const ENDING_FRAMES = './sprites/ending/frames'
const MODE_BACK_FRAMES = './sprites/mode_back/frames'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

interface EndingScreenProps {
  readonly playerName: string
  readonly endingIndex: number
  /** 엔딩 보너스(0이면 부상·방출 엔딩) */
  readonly bonusGamePoint: number
  readonly isContinuable: boolean
  readonly onRegister: () => HallOfFameResult['kind']
  /** 5000 G포인트로 이어하기. 모자라면 false */
  readonly onContinue: () => boolean
  readonly onFinish: () => void
}

/** 엔딩 뒤 원문 문구 */
const TEXT = {
  bonus: '!C엔딩 보너스 획득!N[!cFFFF00%d G포인트!cFFFFFF]', // StrMODE[214]
  ask: '!C나만의 리그 선수를!N[!cFFFF00명예의 전당!cFFFFFF]에!N등록 하시겠습니까?', // StrMODE[215]
  later: '!C나중에 등록 하시겠습니까?!N메인 메뉴로 이동합니다', // StrMODE[219]
  continue: '!C!cFFFF005000 G포인트!cFFFFFF를 소모하여 현재!N상태에서 이어하시겠습니까? ', // StrMODE[221]
  shortage: '!C!cFF0000%d G포인트!cFFFFFF가 부족합니다', // StrCOMMON[41]
  full: '!C!cffffff명예의 전당에!N빈슬롯이 없습니다', // StrCOMMON[51]
  done: '!C!cffffff명예의 전당에!N등록이 완료되었습니다', // StrCOMMON[52]
}
const CONTINUE_COST = 5000

type Phase = '엔딩' | '제작진' | '보너스' | '이어하기질문' | '등록질문' | '나중질문' | '안내'
type QuestionPhase = '이어하기질문' | '등록질문' | '나중질문'

interface Question {
  readonly text: string
  readonly onYes: () => void
  readonly onNo: () => void
}

/**
 * 나만의리그 엔딩 (그리기 0x882b4, 적재 0x87c7c — P6 4b).
 *
 * 띠 창(mode_ui 프레임 10 박스 0 = (0, 65, 240, 72)) 안에 mode_back 배경을 깔고,
 * ending.pzx 이미지 0 두 조각이 **1px/틱**으로 미끄러져 들어온 뒤(S9 8-1),
 * 검정 판에 뚫린 원이 커지는 **원형 전환**(S9 8-2)으로 화면이 열린다.
 * 글은 StrENDING[결과] 흰 글 가운데고, 끝에 **[21] 제작진**이 아래에서 위로 흐른다.
 *
 * 엔딩 번호(판정표 0xa3a84): 0 부상 · 1 방출 · 2~9 은퇴 뒤 진로 · 10~14 연애 · 20 최고 엔딩.
 * 부상·방출(0·1)은 이어하기를 묻고, 그 밖은 엔딩 보너스를 준 뒤 명예의 전당 등록을 묻는다.
 * "나중에 등록" 은 원본에서 선수를 남겨 두지만, 웹판은 저장이 하나라 등록하지 않으면 사라진다.
 * G포인트가 모자랄 때 원본이 어디로 가는지는 미확인 — StrCOMMON[41] 을 띄우고 끝낸다 (추정).
 *
 * ⚠️ 근사한 곳: 제작진은 **게임이 실제로 끝나는 엔딩에서만** 흐르게 했다(부상·방출은 이어하기를
 * 묻는 자리라 건너뛴다) — 원본이 어느 엔딩에서 제작진을 돌리는지는 못 읽었다.
 * 그림 시작 오프셋은 `endingLayout.ts` 주석 참고. 아이리스 D(140 → 240)와 걸어 들어오는 그림
 * (event_char_0 애니 + mode_ui 프레임 87)은 S12 6·7 절에서 확정됐다.
 */
export function EndingScreen(props: EndingScreenProps) {
  const { playerName, endingIndex, bonusGamePoint, isContinuable, onRegister, onContinue, onFinish } = props
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
    등록질문: {
      text: TEXT.ask,
      onYes: () => inform(onRegister() === '등록' ? TEXT.done : TEXT.full),
      onNo: () => setPhase('나중질문'),
    },
    나중질문: { text: TEXT.later, onYes: onFinish, onNo: () => setPhase('등록질문') },
  }
  const question = phase === '이어하기질문' || phase === '등록질문' || phase === '나중질문'
    ? questions[phase]
    : null

  /** 엔딩 글 → (부상·방출이면 이어하기 / 그 밖이면 제작진) → 보너스 → 등록 */
  const onPress = phase === '엔딩'
    ? () => setPhase(isContinuable ? '이어하기질문' : '제작진')
    : phase === '제작진'
      ? () => setPhase(bonusGamePoint > 0 ? '보너스' : '등록질문')
      : undefined

  return (
    <EndingStage playerName={playerName} endingIndex={endingIndex} isCredits={phase === '제작진'} onPress={onPress}>
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
    </EndingStage>
  )
}

interface EndingStageProps {
  readonly playerName: string
  readonly endingIndex: number
  readonly isCredits: boolean
  /** 화면을 눌러 다음으로 갈 수 있을 때만 준다 — 없으면 연출이 제자리에 멈춘다 */
  readonly onPress?: () => void
  readonly children?: ReactNode
}

/** 엔딩 연출 한 장 — 띠 창 + 엔딩 그림 + 원형 전환 + 글/제작진 (0x882b4) */
function EndingStage({ playerName, endingIndex, isCredits, onPress, children }: EndingStageProps) {
  /** 그림이 다 들어오면 연출이 끝난다 — 그 뒤로는 움직이는 것이 없다 */
  const settledTick = Math.max(ENDING_IMAGE_TICKS, IRIS.fullTick)
  const tick = Math.min(useUpdateCounter(), settledTick)

  /**
   * 원형 전환은 그림 이동량과 **다른 칸**(전환 틱 [this+0x308])이 몬다 — 화면이 열리는 것이 먼저고
   * 그림은 그 뒤로도 계속 미끄러진다. 웹판도 같은 틱을 그대로 넣어 t ≥ 7 에 원이 화면을 다 덮는다.
   */
  /**
   * 단계에 따라 D 가 다르다 (S12 6절) — 첫 단계 `0x879b6` 은 D = 140 에 중심 보정 (−58, −55),
   * 뒤 단계 `0x87e2c` 는 D = 240 에 보정 없음이라 화면을 다 덮는다.
   * ⚠️ 단계가 **언제** 바뀌는지는 아직 못 읽어, 첫 단계가 다 열리는 틱에 뒤 단계로 넘긴다 (근사).
   */
  const isFirstStage = tick < IRIS.fullTick
  const stage = isFirstStage ? IRIS_STAGES.open : IRIS_STAGES.reveal
  const radius = isFirstStage ? irisRadiusOf(tick, stage.diameter) : stage.diameter
  const irisX = IRIS.centerX + stage.dx
  const irisY = IRIS.centerY + stage.dy
  const bandEdgeY = BAND_WINDOW.y + BAND_WINDOW.height - BAND_WINDOW.edgeHeight

  return (
    <RawScreen>
      {/* 띠 창 (0x882b4 차례 1) — 검정 박스 + 위·아래 11px 띠 + 테두리 선 */}
      <svg
        className={styles.overlay}
        viewBox={`0 0 ${SCREEN.width} ${SCREEN.height}`}
        width={SCREEN.width}
        height={SCREEN.height}
        shapeRendering="crispEdges"
      >
        {/* 화면 검정(0x6a735) → 박스 (0, 65, 240, 72) 검정 채움 → 위·아래 띠 (차례 그대로) */}
        <rect x={0} y={0} width={SCREEN.width} height={SCREEN.height} fill={BAND_WINDOW.fill} />
        <rect x={BAND_WINDOW.x} y={BAND_WINDOW.y} width={BAND_WINDOW.width} height={BAND_WINDOW.height} fill={BAND_WINDOW.fill} />
        <rect x={BAND_WINDOW.x} y={BAND_WINDOW.y} width={BAND_WINDOW.width} height={BAND_WINDOW.edgeHeight} fill={BAND_WINDOW.edgeColor} />
        <rect x={BAND_WINDOW.x} y={bandEdgeY} width={BAND_WINDOW.width} height={BAND_WINDOW.edgeHeight} fill={BAND_WINDOW.edgeColor} />
        <rect x={BAND_WINDOW.x} y={BAND_WINDOW.y} width={BAND_WINDOW.width} height={1} fill={BAND_WINDOW.outerLine} />
        <rect x={BAND_WINDOW.x} y={BAND_WINDOW.y + 1} width={BAND_WINDOW.width} height={1} fill={BAND_WINDOW.innerLine} />
        <rect x={BAND_WINDOW.x} y={BAND_WINDOW.y + BAND_WINDOW.height - 1} width={BAND_WINDOW.width} height={1} fill={BAND_WINDOW.outerLine} />
        <rect x={BAND_WINDOW.x} y={BAND_WINDOW.y + BAND_WINDOW.height - 2} width={BAND_WINDOW.width} height={1} fill={BAND_WINDOW.innerLine} />
      </svg>

      {/* 띠 안 배경 0x7b9ad — mode_back 을 (1, 66) 에 70 높이로 자른다 */}
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

      {/* 엔딩 그림 두 조각 — 1px/틱으로 미끄러져 들어온다 (S9 8-1) */}
      {[0, 1].map((piece) => (
        <img
          key={piece}
          className={styles.sprite}
          alt=""
          src={imageSrc(ENDING_FRAMES, ENDING_IMAGE.image)}
          style={{ left: endingImageXOf(tick, piece), top: ENDING_IMAGE.y }}
        />
      ))}

      {/* 걸어 들어오는 그림 둘 — 3틱에 1px 왼쪽으로 온다 (S12 7절) */}
      <WalkIn tick={tick} />

      {/* 원형 전환 — 검정 판에 원을 뚫어 덮는다 (S9 8-2). evenodd 라 원 안쪽이 구멍이 된다 */}
      <svg
        className={styles.overlay}
        aria-label="원형 전환"
        viewBox={`0 0 ${SCREEN.width} ${SCREEN.height}`}
        width={SCREEN.width}
        height={SCREEN.height}
      >
        <path
          fillRule="evenodd"
          fill={IRIS.cover}
          d={`M0,0H${SCREEN.width}V${SCREEN.height}H0Z`
            + `M${irisX - radius},${irisY}`
            + `a${radius},${radius} 0 1,0 ${radius * 2},0`
            + `a${radius},${radius} 0 1,0 ${-radius * 2},0`}
        />
      </svg>

      {isCredits
        ? <EndingCredits />
        : (
          <div
            className={styles.endingText}
            style={{ left: ENDING_TEXT.x, top: ENDING_TEXT.y, width: ENDING_TEXT.width }}
          >
            <MarkupText raw={ORIGINAL_ENDINGS[endingIndex] ?? ''} replacements={[playerName]} />
          </div>
        )}

      {onPress !== undefined && (
        <button type="button" className={styles.pressArea} aria-label="확인" onClick={onPress} />
      )}
      {children}
    </RawScreen>
  )
}

/**
 * 걸어 들어오는 그림 (S12 7절 확정) — `event_char_0.pzx` 애니(육성 선수 캐릭터)와
 * `ui/mode_ui.pzx` 프레임 87(부상 아이콘)이 오른쪽에서 **3틱에 1px** 씩 온다.
 * `n & 7 == 0` 인 틱만 1px 위로 튄다(걸음 흔들림).
 *
 * ⚠️ 애니 번호는 원본이 육성 선수 레코드의 외모 비트로 0+2 / 8+2 를 고르는데(0x63a5c),
 * 웹판은 그 비트를 아직 안 옮겨 **기본 2** 를 쓴다. 팔레트 고르기도 아직 없다.
 */
function WalkIn({ tick }: { readonly tick: number }) {
  const origins = useFrameOrigins(WALK_IN.characterFolder)
  const animations = useAnimations(WALK_IN.characterFolder)
  const iconOrigins = useFrameOrigins(WALK_IN.iconFolder)
  const entries = animations?.[WALK_IN.characterAnimation]
  const step = entries === undefined ? null : animationStepAt(entries, tick)

  return (
    <>
      {step !== null && (
        <FrameSprite
          folder={WALK_IN.characterFolder}
          frame={step.frame}
          origins={origins}
          x={WALK_IN.xOf(tick, WALK_IN.characterDx) + step.dx}
          y={WALK_IN.characterYOf(tick) + step.dy}
        />
      )}
      <FrameSprite
        folder={WALK_IN.iconFolder}
        frame={WALK_IN.iconFrame}
        origins={iconOrigins}
        x={WALK_IN.xOf(tick, WALK_IN.iconDx)}
        y={WALK_IN.iconYOf(tick)}
      />
    </>
  )
}

/**
 * 제작진 StrENDING[21] — `(0, H − 카운터, W)` 로 아래에서 위로 흐른다 (P6 4b-6).
 * 틱을 따로 세려고 따로 뗐다 — 이 칸이 뜨는 순간부터 0 에서 시작해야 화면 아래에서 올라온다.
 */
function EndingCredits() {
  const tick = useUpdateCounter()
  return (
    <div
      className={styles.creditsText}
      style={{ left: CREDITS.x, top: creditsTopOf(tick), width: CREDITS.width }}
    >
      <MarkupText raw={ORIGINAL_ENDINGS[CREDITS.index] ?? ''} />
    </div>
  )
}
