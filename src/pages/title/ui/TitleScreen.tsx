import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { useTitleIntro } from '@/pages/title/model/useTitleIntro'
import * as styles from '@/pages/title/ui/TitleScreen.css'

const SPRITE = './sprites/main_title'

/** 원본 좌표. titleIntro.ts 주석에 프레임 번호별 근거가 있다. */
const PLAYER_X = 126
const LOGO_Y = 144
const DUST = { x: 131, y: 226 }
const PROMPT = { x: 88, y: 254 }
/** 추정: f28 에 따로 들어 있는 문구라 좌표가 없다. 화면 맨 아래 가운데에 둔다. */
const COPYRIGHT = { x: 55, y: 306 }

interface TitleScreenProps {
  readonly onStart: () => void
}

/** 원작 타이틀. 인트로가 끝나면 TOUCH SCREEN 이 깜빡이고, 누르면 메인 메뉴로 간다. */
export function TitleScreen({ onStart }: TitleScreenProps) {
  const { pose, press } = useTitleIntro(onStart)

  return (
    <RawScreen onPress={press}>
      <Layer kind="under" sprite="003" x={PLAYER_X} y={pose.playerY} />
      {pose.logoX !== null && <Layer kind="under" sprite="002" x={pose.logoX} y={LOGO_Y} label="2010 프로야구" />}
      {pose.isBackgroundVisible && <Layer kind="background" sprite="000" x={0} y={0} />}
      {pose.isDustVisible && <Layer kind="over" sprite="004" x={DUST.x} y={DUST.y} />}
      <Layer kind="over" sprite="005" x={pose.ball.x} y={pose.ball.y} />
      {pose.isRatingVisible && <Layer kind="over" sprite="007" x={0} y={5} label="전체이용가" />}
      {pose.isPromptVisible && <Layer kind="over" sprite="008" x={PROMPT.x} y={PROMPT.y} label="TOUCH SCREEN" />}
      {pose.isSettled && <Layer kind="over" sprite="006" x={COPYRIGHT.x} y={COPYRIGHT.y} label="© 2009 GAMEVIL" />}
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
}

/** main_title 조각 하나를 원본 좌표에 찍는다. */
function Layer({ kind, sprite, x, y, label = '' }: LayerProps) {
  return (
    <img className={LAYER_CLASS[kind]} style={{ left: x, top: y }} src={`${SPRITE}/${sprite}.png`} alt={label} />
  )
}
