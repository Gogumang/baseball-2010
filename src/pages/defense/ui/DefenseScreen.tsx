import { useRef, type ReactNode } from 'react'
import { FrameSprite, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
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
  cameraTargetOf,
  defenderPaletteIndexOf,
  fielderSpriteOf,
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

/**
 * 그림 한 장 — 폴더마다 원점을 따로 읽는다(폴더가 칸마다 다르므로 컴포넌트로 뺀다).
 *
 * 팀 팔레트 번호를 주면 `defender.mpl` 벌로 다시 칠하고(C-1), 안 주면 구운 그림 그대로다.
 * 원점 읽기(`useFrameOrigins`)는 **여기에 남겨 둔다** — 칠하는 쪽만 프레임마다 새로 마운트해야
 * 하는데(아래 `PaintedSprite` 주석), 원점까지 같이 새로 마운트하면 틱마다 그림이 한 번씩 사라진다.
 */
function ActorSprite({
  folder,
  frame,
  paletteIndex = null,
}: {
  readonly folder: string
  readonly frame: number
  readonly paletteIndex?: number | null
}) {
  const origins = useFrameOrigins(folder)
  if (paletteIndex === null) {
    return <FrameSprite folder={folder} frame={frame} origins={origins} x={0} y={0} />
  }
  const key = String(frame).padStart(3, '0')
  const origin = origins?.[key]
  if (origin === undefined) return null
  return (
    // ⚠️ `key` = 프레임 번호 — 아래 주석 참고. 수비 화면은 매 틱 동작이 바뀌어 반드시 걸린다.
    <PaintedSprite
      key={key}
      url={`${folder}/${key}.png`}
      paletteIndex={paletteIndex}
      left={origin.x}
      top={origin.y}
    />
  )
}

/**
 * 팀 색으로 칠한 그림 한 장.
 *
 * 프레임마다 **따로 마운트**해야 한다(`key` = 프레임 번호): `useRecoloredSprite` 는 칠한 주소를
 * 상태로 들고 있어서, 프레임이 바뀐 그 그리기 한 번은 **앞 프레임 주소**를 내보낸다
 * (초상화 `EventPortraits.tsx` 의 `PaintedFrame` 에서 실제로 걸렸던 함정이다).
 * 새로 마운트하면 처음 상태가 이번 프레임의 구운 주소라 엉뚱한 칸이 비칠 일이 없다.
 * ⚠️ 캔버스가 없거나(테스트의 jsdom) 아직 다 안 칠했으면 구운 그림을 그대로 쓴다 — 색만 한 박자 늦는다.
 */
function PaintedSprite({
  url,
  paletteIndex,
  left,
  top,
}: {
  readonly url: string
  readonly paletteIndex: number | null
  readonly left: number
  readonly top: number
}) {
  return (
    <img className={styles.paintedSprite} style={{ left, top }} src={useRecoloredSprite(url, paletteIndex)} alt="" />
  )
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

        {/*
          공은 바닥(z)에서 높이만큼 위에 그린다 (높이 단위도 월드 단위다 — R3 1-3).

          ⚠️ **공 그림자는 그리지 않는다.** 예전에는 ball.pzx 023~033 을 "납작한 그림자"로 알고
             바닥에 깔았는데, 그 칸들은 그림자가 아니라 **날개 달린 마구 공**이라 공 양옆에
             검은 날개가 붙어 보였다. 원본이 공 그림자를 그린다는 근거는 문서 어디에도 없고
             (R3 1-3 은 대상을 "공 (x, z−높이)" 하나로만 적는다), 고르는 식이 든 궤적 코드
             0xb3b38·0xb401c 는 아직 안 읽었다. **모르는 것을 그리느니 안 그린다.**
        */}
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
  // 그림판마다 프레임 기준이 다르다 — 보통·타자 마선수는 +17, 투수 마선수는 날값 (S12 8절)
  const { folder, frame } = fielderSpriteOf(fielder)
  // 마선수 그림은 팀 색을 안 탄다 — 제 색을 가진 인물이고 `.mpl` 대체 팔레트도 굽지 않았다
  const paletteIndex = fielder.aceIndex == null ? defenderPaletteIndexOf(fielder.teamIndex) : null
  return (
    <div
      className={styles.actor}
      style={{ left: point.x, top: point.y }}
      data-testid={`defense-fielder-${fielder.slot}`}
      data-frame={frame}
    >
      <ActorSprite folder={folder} frame={frame} paletteIndex={paletteIndex} />
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
      {/* 주자도 defender.pzx 를 쓴다 — 앞 17장(000~016)이 주자 칸이다 (S12 4-1 확정) */}
      <ActorSprite
        folder={DEFENDER_FRAMES}
        frame={frame}
        paletteIndex={defenderPaletteIndexOf(runner.teamIndex)}
      />
    </div>
  )
}
