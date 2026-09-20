import { useRef, type ReactNode } from 'react'
import { FrameSprite, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import {
  CAMERA_FOLLOW_PERCENT,
  type CameraState,
  cameraBoundsOf,
  centerOn,
  screenOffsetOf,
  stepCamera,
  toScreenX,
  toScreenY,
} from '@/pages/defense/lib/defenseCamera'
import {
  BALL_FRAMES,
  DEADLY_EFFECT_FRAMES,
  DEFENDER_FRAMES,
  DEFENSE_BACKGROUND_HEIGHT,
  DEFENSE_BACKGROUND_URL,
  DEFENSE_BACKGROUND_WIDTH,
  type DefenseFielder,
  type DefenseRunner,
  type DefenseViewState,
  ballFrameOf,
  ballShadowFrameOf,
  cameraTargetOf,
  fielderFrameOf,
  fielderFramesOf,
  flashOffsetOf,
  runnerFrameOf,
} from '@/pages/defense/lib/defenseView'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'

/** 한 번에 몰아서 따라갈 틱 수 상한 — 탭이 잠들었다 돌아와도 한 프레임에 다 돌지 않게 막는다 */
const MAX_CATCH_UP_TICKS = 30

interface DefenseScreenProps {
  /** 한 틱치 스냅샷 — 야수·주자·공을 굴리는 모델이 넘겨 준다 */
  readonly state: DefenseViewState
  /**
   * 따라가기 비율(%/틱). 기본 20 이고, 경기 끝 직전에 투수판으로 도는 구간은 1 이다
   * (R3 1-3 — 0xc0558(cam, 1)).
   */
  readonly followPercent?: number
  /** 꺼 두면 카메라·애니가 멈춘다 (테스트·일시정지) */
  readonly isRunning?: boolean
  /** 화면 위에 얹을 것 — 조작 버튼·점수판 같은 것 */
  readonly children?: ReactNode
}

/** 그림 한 장 — 폴더마다 원점을 따로 읽는다(폴더가 칸마다 다르므로 컴포넌트로 뺀다) */
function ActorSprite({ folder, frame }: { readonly folder: string; readonly frame: number }) {
  const origins = useFrameOrigins(folder)
  return <FrameSprite folder={folder} frame={frame} origins={origins} x={0} y={0} />
}

/**
 * 수비 화면 (R3-field-view 1~6절).
 *
 * 배경 stadium/defense.pzx(310×500)를 좌우 반전 두 장으로 620×500 을 만들고
 * (I 1b), 카메라 오프셋 0x41230 만큼 옮겨 깐다. 야수·주자·공은 월드 좌표를
 * 같은 오프셋으로 화면에 찍는다.
 *
 * 화면이 하지 않는 것: 이동·포구·송구·판정은 전부 모델 몫이다. 여기서는
 * 받은 스냅샷을 그리고 카메라만 굴린다.
 */
export function DefenseScreen({
  state,
  followPercent = CAMERA_FOLLOW_PERCENT,
  isRunning = true,
  children,
}: DefenseScreenProps) {
  const update = useUpdateCounter(isRunning)
  const bounds = cameraBoundsOf(styles.SCREEN_WIDTH, styles.SCREEN_HEIGHT)
  const target = cameraTargetOf(state)

  // 진입 때는 즉시 가운데 맞춤(vt10, 0x466d0), 그 뒤로는 갱신마다 followPercent 씩 따라간다.
  const cameraRef = useRef<{ update: number; state: CameraState } | null>(null)
  if (cameraRef.current === null) {
    cameraRef.current = { update, state: centerOn(bounds, target) }
  } else if (cameraRef.current.update !== update) {
    const ticks = Math.min(Math.max(update - cameraRef.current.update, 0), MAX_CATCH_UP_TICKS)
    let moved = cameraRef.current.state
    for (let i = 0; i < ticks; i += 1) moved = stepCamera(bounds, moved, target, followPercent)
    cameraRef.current = { update, state: moved }
  }
  const camera = cameraRef.current.state
  const offset = screenOffsetOf(camera)

  const screenOf = (point: { readonly x: number; readonly z: number }) => ({
    x: toScreenX(point.x) + offset.x,
    y: toScreenY(point.z) + offset.y,
  })

  const ballGround = screenOf(state.ball)
  const ballPoint = { x: ballGround.x, y: ballGround.y - toScreenY(state.ball.height) }

  /**
   * 그리는 차례는 z 오름차순으로 둔다 — 홈 쪽(z 큰 쪽)이 앞에 오게 하려는 것이다.
   * 원본은 야수 9명 → 주자 순서로 고정해 그리지만(0x43278 · 0x43a0c), 그러면
   * 외야수가 내야수를 가린다. 겹칠 일이 드문 곳이라 화면 쪽에서 정한다.
   */
  const actors: { readonly z: number; readonly node: ReactNode }[] = [
    ...state.runners
      .filter((runner) => runner.isVisible !== false)
      .map((runner) => ({
        z: runner.z,
        node: <Runner key={`runner-${runner.index}`} runner={runner} point={screenOf(runner)} />,
      })),
    ...state.fielders.map((fielder) => ({
      z: fielder.z,
      node: <Fielder key={`fielder-${fielder.slot}`} fielder={fielder} point={screenOf(fielder)} />,
    })),
  ].sort((a, b) => a.z - b.z)

  return (
    <RawScreen>
      <div className={styles.field} data-testid="defense-field">
        <img
          className={styles.background}
          style={{ left: offset.x, top: offset.y, width: DEFENSE_BACKGROUND_WIDTH, height: DEFENSE_BACKGROUND_HEIGHT }}
          src={DEFENSE_BACKGROUND_URL}
          alt=""
          data-testid="defense-background-left"
        />
        <img
          className={styles.backgroundMirrored}
          style={{
            left: offset.x + DEFENSE_BACKGROUND_WIDTH,
            top: offset.y,
            width: DEFENSE_BACKGROUND_WIDTH,
            height: DEFENSE_BACKGROUND_HEIGHT,
          }}
          src={DEFENSE_BACKGROUND_URL}
          alt=""
          data-testid="defense-background-right"
        />

        {/* 공 그림자는 바닥(z)에, 공은 높이만큼 위에 (높이 단위도 월드 단위다 — R3 1-3) */}
        <div className={styles.actor} style={{ left: ballGround.x, top: ballGround.y }} data-testid="defense-ball-shadow">
          <ActorSprite folder={BALL_FRAMES} frame={ballShadowFrameOf(state.ball.height)} />
        </div>

        {actors.map((actor) => actor.node)}

        <div className={styles.actor} style={{ left: ballPoint.x, top: ballPoint.y }} data-testid="defense-ball">
          <ActorSprite folder={BALL_FRAMES} frame={ballFrameOf(state.ball.height)} />
        </div>

        {state.flash != null && (
          <div
            className={styles.actor}
            style={{
              left: ballPoint.x + flashOffsetOf(state.flash).x,
              top: ballPoint.y + flashOffsetOf(state.flash).y,
            }}
            data-testid="defense-flash"
          >
            <ActorSprite folder={DEADLY_EFFECT_FRAMES} frame={state.flash.step} />
          </div>
        )}
      </div>
      {children}
    </RawScreen>
  )
}

function Fielder({
  fielder,
  point,
}: {
  readonly fielder: DefenseFielder
  readonly point: { readonly x: number; readonly y: number }
}) {
  const frame = fielderFrameOf(fielder.action, fielder.actionTick)
  return (
    <div
      className={`${styles.actor}${fielder.isFlipped === true ? ` ${styles.flipped}` : ''}`}
      style={{ left: point.x, top: point.y }}
      data-testid={`defense-fielder-${fielder.slot}`}
      data-frame={frame}
    >
      <ActorSprite folder={fielderFramesOf(fielder, frame)} frame={frame} />
    </div>
  )
}

function Runner({
  runner,
  point,
}: {
  readonly runner: DefenseRunner
  readonly point: { readonly x: number; readonly y: number }
}) {
  const frame = runnerFrameOf(runner.action, runner.actionTick, runner.base, runner.isAdvancing)
  return (
    <div
      className={styles.actor}
      style={{ left: point.x, top: point.y }}
      data-testid={`defense-runner-${runner.index}`}
      data-frame={frame}
    >
      {/* 주자 전용 그림판이 저장소에 없다 — 원본도 같은 그림 객체를 쓰므로 defender 를 쓴다 (R10 4절) */}
      <ActorSprite folder={DEFENDER_FRAMES} frame={frame} />
    </div>
  )
}
