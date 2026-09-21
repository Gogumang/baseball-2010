import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { useTitleIntro } from '@/pages/title/model/useTitleIntro'
import * as styles from '@/pages/title/ui/TitleScreen.css'

const SPRITE = './sprites/main_title'
/** 판 번호는 main_title 이 아니라 ui/num.pzx 의 131 번 그림이다 (0x2cd2a: 기준 0x81 = 129 + 값 2) */
const NUM_SPRITE = './sprites/num'

/** 원본 좌표. titleIntro.ts 주석에 프레임 번호별 근거가 있다. */
const PLAYER_X = 126
const LOGO_Y = 144
const DUST = { x: 131, y: 226 }
/**
 * 이 빌드의 문구는 **PRESS ANY KEY**(이미지 1, 82×10)다 — TOUCH SCREEN(이미지 8)은 안 쓴다.
 * 좌표는 원본이 프레임 16·17 안에 넣어 두었고 그 프레임을 파서가 못 읽어 예전 값(88,254)을 그대로 둔다 (근사).
 */
const PROMPT = { x: 88, y: 254 }
/** 흐린 프레임 16 은 같은 글자의 어두운 판이라 따로 뽑힌 그림이 없다 — 반투명으로 흉내 낸다 (근사) */
const DIM_PROMPT_OPACITY = 0.45
/** 저작권 프레임 18(129×10) — x = W/2 − w/2 + 3 = 59, y = H − h − 2 = 308 (0x2cc78 확정) */
const COPYRIGHT = { x: 59, y: 308 }
/** 판 번호 num 131 "2" — x = W/2 − w/2 + w + 4 = 189, y = 308 (0x2cd2a 확정) */
const VERSION = { x: 189, y: 308 }
/** 전체이용가 이미지 7(40×46) — x = W − w − 2 = 198, y = 2 (0x2ccbc 확정) */
const RATING = { x: 198, y: 2 }

interface TitleScreenProps {
  readonly onStart: () => void
}

/**
 * 원작 타이틀. 인트로가 끝나면 PRESS ANY KEY 가 깜빡이고, 누르면 메인 메뉴로 간다.
 *
 * 저작권·판 번호·**전체이용가**는 그리기 0x2cbac 가 애니 0 이 끝난 **뒤에만** 지나가는 자리라
 * 셋 다 `isSettled` 에 걸어 둔다 (F-4·4-1 확정). 예전에는 전체이용가를 인트로 중에만
 * (0,5) 에 붙여, 원본과 정반대로 왼쪽 끝에 나왔다가 인트로가 끝나면 사라졌다.
 */
export function TitleScreen({ onStart }: TitleScreenProps) {
  const { pose, press } = useTitleIntro(onStart)

  return (
    <RawScreen onPress={press}>
      <Layer kind="under" sprite="003" x={PLAYER_X} y={pose.playerY} />
      {pose.logoX !== null && <Layer kind="under" sprite="002" x={pose.logoX} y={LOGO_Y} label="2010 프로야구" />}
      {pose.isBackgroundVisible && <Layer kind="background" sprite="000" x={0} y={0} />}
      {pose.isDustVisible && <Layer kind="over" sprite="004" x={DUST.x} y={DUST.y} />}
      <Layer kind="over" sprite="005" x={pose.ball.x} y={pose.ball.y} />
      {pose.promptPhase !== 'hidden' && (
        <Layer kind="over" sprite="001" x={PROMPT.x} y={PROMPT.y} label="PRESS ANY KEY"
          opacity={pose.promptPhase === 'dim' ? DIM_PROMPT_OPACITY : 1} />
      )}
      {pose.isSettled && (
        <>
          <Layer kind="over" sprite="006" x={COPYRIGHT.x} y={COPYRIGHT.y} label="© 2009 GAMEVIL" />
          <Layer kind="over" sprite="131" folder={NUM_SPRITE} x={VERSION.x} y={VERSION.y} label="2" />
          <Layer kind="over" sprite="007" x={RATING.x} y={RATING.y} label="전체이용가" />
        </>
      )}
    </RawScreen>
  )
}

const LAYER_CLASS = {
  under: styles.underBackground,
  background: styles.background,
  over: styles.overBackground,
} as const

interface LayerProps {
  readonly kind: keyof typeof LAYER_CLASS
  readonly sprite: string
  readonly x: number
  readonly y: number
  readonly label?: string
  /** 판 번호만 ui/num.pzx 에서 가져온다 */
  readonly folder?: string
  readonly opacity?: number
}

/** main_title 조각 하나를 원본 좌표에 찍는다. */
function Layer({ kind, sprite, x, y, label = '', folder = SPRITE, opacity = 1 }: LayerProps) {
  return (
    <img className={LAYER_CLASS[kind]} style={{ left: x, top: y, opacity }} src={`${folder}/${sprite}.png`} alt={label} />
  )
}
