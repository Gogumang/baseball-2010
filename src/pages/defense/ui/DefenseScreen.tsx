import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FrameSprite, LayeredFrameSprite, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
import { useGameSceneUpdateCounter } from '@/shared/lib/commonWindow/useGameSceneUpdateCounter'
import { shinedSpriteUrl } from '@/pages/defense/lib/laserShine'
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
  DEFENSE_BACKGROUND_HEIGHT,
  DEFENSE_BACKGROUND_URL,
  DEFENSE_BACKGROUND_WIDTH,
  type DefenseFielder,
  type DefenseRunner,
  type DefenseViewState,
  ballFrameOf,
  ballShadowOf,
  cameraTargetOf,
  defenderPaletteIndexOf,
  fielderSpriteOf,
  flashOffsetOf,
  isBallDrawn,
  runnerFrameOf,
  runnerSpriteFolderOf,
} from '@/pages/defense/lib/defenseView'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'
import { DefenseFieldMap } from '@/pages/defense/ui/DefenseFieldMap'
import { DefenseHolderMark } from '@/pages/defense/ui/DefenseHolderMark'
import { DefensePlayerEffect } from '@/pages/defense/ui/DefensePlayerEffect'
import { DefenseLaserTrail } from '@/pages/defense/ui/DefenseLaserTrail'
import { playerEffectMarksOf } from '@/pages/defense/lib/playerEffectMarks'
import { zoomSourceRect } from '@/features/defense-play/model/laserPresentation'

/** 판정 글자 그림 (game_judge.pzx, 게임+0x101c) */
const JUDGE_FRAMES = './sprites/game_judge/frames'
/** 0x46844 의 큰 OUT 은 자리에서 60 위 (468e2 `subs r3, #0x3c`) */
const BIG_OUT_RAISE = 60
/** 0x46844 의 보통 판정 글자는 자리에서 30 위 (468c8 `subs r2, #0x1e`) */
const JUDGE_TEXT_RAISE = 30

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
  /**
   * 수비 바탕의 **잔디 팔레트 줄** — `stadium/defense.mpl` 의 줄 (`0x7885c`, S3 6-2).
   *
   * 타석 바닥을 칠하는 `0x786c8` 과 **명령어까지 같은 함수**다 (슬롯만 구장 `+0x2c` → `+0x14`,
   * 문자열만 `stadium/attack.*` → `stadium/defense.*`). 셋째 인자 뒤집기 `줄 = 1 − idx` 도 같고,
   * 리터럴 `0x0007885d` 는 온 파일에 딱 하나(풀 `0x352cc`)뿐이라 부르는 곳도 하나다 —
   * 수비 화면 준비 `0x35218` 의 `0x3529c` 가 `(SR[0x1ba] − 1, 1)` 을 넘긴다. 곧 **줄 = 2 − 칸**
   * 으로 타석 잔디와 **같은 값**이라, 줄을 내는 곳은 `grassPaletteRowOf` 하나면 된다.
   * (예전 메모의 "주/야간 3벌" 은 틀렸다 — 벌 셋은 거친인조·인조·천연 잔디다.)
   *
   * null 이면 구운 그림 그대로다 = PZX 기본 팔레트 = 칸 3 특급천연잔디, 그리고 시즌 홈경기가
   * 아닐 때의 색이기도 하다. ⚠️ 타석 준비(`0x352e8`)에 있는 **대전 모드 8·9 갈래가 여기엔 없다** —
   * 수비 바탕은 `[app+0x1104] == 2`(시즌) 이고 홈경기일 때만 바뀐다.
   */
  readonly grassPalette?: number | null
  /**
   * 그림자 위 · 선수 아래에 깔 것 — 비거리 판 0x36cd4 자리다. 0x46c88 머리(46cb6)가 그리기 목록보다 먼저 곧바로 칠하고(바탕은
   * 프레임 0x52c50 의 0x41230 → 0x411e0 이 그 앞), 공 그리기 0x36dfc 끝(37388)이 그림자 뒤에 한 번 더 칠한다 — 곧 바탕 · 그림자
   * 위, 야수 · 주자 · 공 아래이고 줌 펀치(46e24 0xbb84c)가 함께 늘린다.
   */
  readonly underActors?: ReactNode
  /**
   * 이 그림의 **카메라 오프셋**(+0xfec, +0xff0 — 0x41230)을 적어 둘 칸. 공 그리기 0x36dfc 의 파티클(`lib/ballParticles`)은
   * 화면 좌표로 쏘는데 파티클 장면은 재생 쪽(`DefensePlayback`)이 들고 있어서, 그쪽이 이 값을 읽는다. 그릴 때마다 덮어쓴다.
   */
  readonly cameraOffsetRef?: { current: { readonly x: number; readonly y: number } | null }
  /**
   * 지금까지 든 **창이 선 첫 그림([창+0x250])** 의 수 (`useGameSceneRedrawCount`). 그 그림은 갱신 없이 0x46c88 을 한 번 더 돌아 그리기에서
   * 0x93d91 로 넘기는 애니 — 부착 효과(0x43278 의 애니 0~4 · 13 · 15 · 0x43a0c 의 5~8)와 공 가진 야수 고리(0x43cb0 43e38) — 가 한 칸 더 간다.
   * 웹은 그 애니 칸을 화면 갱신 수로 고르므로(근사) 이 수를 더한다. 카메라(갱신 0x3f060)는 안 움직인다. 안 주면 0
   */
  readonly drawRedraws?: number
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
  isLaserShining = false,
}: {
  readonly folder: string
  readonly frame: number
  readonly paletteIndex?: number | null
  /** 그리기 효과 0xc · 빨강 (`lib/laserShine`) — 그림 픽셀과 색을 반반 섞는다 */
  readonly isLaserShining?: boolean
}) {
  const origins = useFrameOrigins(folder)
  if (paletteIndex === null && !isLaserShining) {
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
      isLaserShining={isLaserShining}
      left={origin.x}
      top={origin.y}
    />
  )
}

/** 판정 글자 한 장 — 0x67 겹은 아래 수비 화면에 더한다 */
function JudgeTextSprite({ frame }: { readonly frame: number }) {
  const origins = useFrameOrigins(JUDGE_FRAMES)
  return <LayeredFrameSprite folder={JUDGE_FRAMES} frame={frame} origins={origins} x={0} y={0} />
}

/**
 * 팀 색으로 칠한 그림 한 장.
 *
 * 프레임마다 **따로 마운트**해야 한다(`key` = 프레임 번호): `useRecoloredSprite` 는 칠한 주소를
 * 상태로 들고 있어서, 프레임이 바뀐 그 그리기 한 번은 **앞 프레임 주소**를 내보낸다
 * (초상화 `EventPortraits.tsx` 의 `PaintedFrame` 에서 실제로 걸렸던 함정이다).
 * 새로 마운트하면 처음 상태가 이번 프레임의 구운 주소라 엉뚱한 칸이 비칠 일이 없다.
 * ⚠️ 캔버스가 없거나(테스트의 jsdom) 아직 다 안 칠했으면 구운 그림을 그대로 쓴다 — 색만 한 박자 늦는다.
 * 반짝임(효과 0xc)은 팀 색을 칠한 **뒤** 그림에 입힌다 — 원본도 팔레트 색 칸(0x98394 의 `ldrh [팔레트]`)을 섞는다.
 */
function PaintedSprite({
  url,
  paletteIndex,
  isLaserShining = false,
  left,
  top,
}: {
  readonly url: string
  readonly paletteIndex: number | null
  readonly isLaserShining?: boolean
  readonly left: number
  readonly top: number
}) {
  const painted = useRecoloredSprite(url, paletteIndex)
  const shown = useShinedSprite(painted, isLaserShining)
  return <img className={styles.paintedSprite} style={{ left, top }} src={shown} alt="" />
}

/** 효과 0xc 를 입힌 주소 — 꺼져 있거나 아직 다 안 칠했으면 받은 주소 그대로 */
function useShinedSprite(url: string, isOn: boolean): string {
  const [shined, setShined] = useState<{ readonly from: string; readonly to: string } | null>(null)
  useEffect(() => {
    if (!isOn) return
    let isActive = true
    shinedSpriteUrl(url).then((to) => {
      if (isActive) setShined({ from: url, to })
    })
    return () => {
      isActive = false
    }
  }, [url, isOn])
  return isOn && shined !== null && shined.from === url ? shined.to : url
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
  grassPalette = null,
  underActors,
  cameraOffsetRef,
  drawRedraws = 0,
  children,
}: DefenseScreenProps) {
  // 카메라 0x3f060 은 경기 장면 갱신이다 — 공용 창이 서 있으면 52cc6 이 건너뛰어 카메라도 선다(`useGameSceneUpdateCounter`)
  const update = useGameSceneUpdateCounter(isRunning)
  /** 그리기 쪽 애니가 넘어간 수 — 갱신마다 한 그림 + 창이 선 첫 그림 (`drawRedraws`) */
  const drawnPictures = update + drawRedraws
  // 시즌 잔디 (`0x7885c`) — 아직 다 안 칠했거나 캔버스가 없으면 구운 그림을 그대로 쓴다.
  const backgroundUrl = useRecoloredSprite(DEFENSE_BACKGROUND_URL, grassPalette)
  const bounds = cameraBoundsOf(styles.SCREEN_WIDTH, styles.SCREEN_HEIGHT)
  const target = cameraTargetOf(state)

  // 진입 때는 즉시 가운데 맞춤(vt10, 0x466d0), 그 뒤로는 갱신마다 followPercent 씩 따라간다.
  // 진입 0x46418 의 맞춤(466e0~46708)은 공 점 0xa25d4 의 **(x, z)** 다 — 갱신 0x3f060 과 달리 높이를 안 뺀다.
  // (따로 정한 대상 `cameraTarget` 이 있으면 그것 — 원본 진입에는 없는 칸이라 상태 0x18 · 시험용이다)
  const cameraRef = useRef<{ update: number; state: CameraState } | null>(null)
  if (cameraRef.current === null) {
    cameraRef.current = { update, state: centerOn(bounds, state.cameraTarget ?? { x: state.ball.x, z: state.ball.z }) }
  } else if (cameraRef.current.update !== update) {
    // 경기 멈춤(+0x1993) · 판이 닫힌 그림은 0x3f060 이 대상 · 따라가기 앞에서 돌아간다(3f0a4 · 3f0ea) — 카메라가 그 자리에 선다
    const ticks =
      state.cameraFrozen === true ? 0 : Math.min(Math.max(update - cameraRef.current.update, 0), MAX_CATCH_UP_TICKS)
    let moved = cameraRef.current.state
    for (let i = 0; i < ticks; i += 1) moved = stepCamera(bounds, moved, target, followPercent)
    cameraRef.current = { update, state: moved }
  }
  const camera = cameraRef.current.state
  const offset = screenOffsetOf(camera)
  if (cameraOffsetRef !== undefined) cameraOffsetRef.current = offset

  const screenOf = (point: { readonly x: number; readonly z: number }) => ({
    x: toScreenX(point.x) + offset.x,
    y: toScreenY(point.z) + offset.y,
  })
  /** 야수 그림 자리 — 0x43278(432f0~43318)이 0xb94b4(카메라, x, z − y)로 투영한다. 결과 판 0x46844 도 이 자리를 쓴다 */
  const fielderScreenOf = (fielder: DefenseFielder) => screenOf({ x: fielder.x, z: fielder.z - (fielder.y ?? 0) })

  /**
   * 레이저 줌 펀치 0xbb84c → 0xbb43c — 원본 사각형(화면 W·100/s × H·100/s, 중심 = 바탕 좌표 + 카메라 오프셋, 화면 안으로 자름)을
   * 화면 전체로 늘린다. 결과 판(큰 OUT)까지 늘린다(`laserPresentation`).
   */
  const zoom = state.zoom ?? null
  const zoomRect =
    zoom === null || zoom.percent === 100
      ? null
      : zoomSourceRect(zoom, offset, { width: styles.SCREEN_WIDTH, height: styles.SCREEN_HEIGHT })
  const zoomStyle =
    zoomRect === null
      ? undefined
      : {
          transformOrigin: '0 0',
          transform: `scale(${styles.SCREEN_WIDTH / zoomRect.width}, ${styles.SCREEN_HEIGHT / zoomRect.height}) translate(${-zoomRect.x}px, ${-zoomRect.y}px)`,
        }
  /** 결과 판 0x46844 의 자리 — 공 가진 야수(+0x1088)의 그림 자리, 없으면 화면 가운데 (46866) */
  const popupPointOf = (holderSlot: number) => {
    const holder = state.fielders.find((fielder) => fielder.slot === holderSlot)
    return holder === undefined ? { x: styles.SCREEN_WIDTH >> 1, y: styles.SCREEN_HEIGHT >> 1 } : fielderScreenOf(holder)
  }
  const bigOut = state.bigOut ?? null
  const bigOutPoint = bigOut === null ? null : popupPointOf(bigOut.holderSlot)
  const judgeText = state.judgeText ?? null
  const judgeTextPoint = judgeText === null ? null : popupPointOf(judgeText.holderSlot)

  const holderMark = state.holderMark ?? null
  const holderFielder = holderMark === null ? undefined : state.fielders.find((fielder) => fielder.slot === holderMark.slot)

  const ballGround = screenOf(state.ball)
  const ballPoint = { x: ballGround.x, y: ballGround.y - toScreenY(state.ball.height) }
  const flash = state.flash ?? null
  const flashBase =
    flash !== null && flash.x !== undefined && flash.z !== undefined ? screenOf({ x: flash.x, z: flash.z }) : ballPoint

  /**
   * 그리기 목록 0xbe810(장면 +0x234) — 넣을 때 **키 오름차순 자리**에 끼우고(be85a~be86a: 처음으로 `새 키 < 그 칸 키` 인 칸 앞),
   * 같은 키는 **먼저 넣은 것 뒤**에 놓인다. 0xbe6a0 이 0 번부터 그려 뒤 칸이 위다. 넣는 차례와 키(직접 뜸):
   * ```
   * 0x43278  야수 — 칸 8 → 0 내림차순(439be `subs` · `bmi`), 키 = 야수 z(+0x28, 43484)
   * 0x43a0c  주자 — 목록 0 번부터 오름차순(+0xbb 면 건너뜀), 키 = 주자 z + 1(43aec)
   * 0x36dfc  공 — 키 = 공 z(36f62)
   * ```
   * 그래서 홈 쪽(z 큰 쪽)이 앞이고, 같은 줄이면 주자가 야수 위, 공은 같은 z 의 야수 · 주자보다 늦게 넣어 위다.
   * `Array.prototype.sort` 는 안정 정렬이라 넣는 차례대로 늘어놓고 키로 정렬하면 같은 자리가 된다.
   */
  const actors: { readonly key: number; readonly node: ReactNode }[] = [
    ...[...state.fielders]
      .sort((a, b) => b.slot - a.slot)
      .map((fielder) => ({
        key: fielder.z,
        node: (
          <Fielder
            key={`fielder-${fielder.slot}`}
            fielder={fielder}
            point={fielderScreenOf(fielder)}
            // 레이저 송구 반짝임은 **공 쥔 야수 한 명**만 빨갛게 한다 (0x43406~0x4342c)
            isLaserShining={state.laserShiningSlot === fielder.slot}
          />
        ),
      })),
    ...[...state.runners]
      .filter((runner) => runner.isVisible !== false)
      .sort((a, b) => a.index - b.index)
      .map((runner) => ({
        key: runner.z + 1,
        node: (
          <Runner
            key={`runner-${runner.index}`}
            runner={runner}
            point={screenOf(runner)}
            loadedAce={state.runnerAceSprite ?? null}
          />
        ),
      })),
    // player_effect 부착 효과(0x43278 · 0x43a0c) — 야수 · 주자를 그리며 같은 그리기 목록에 깊이 키로 넣는다(공 0x36dfc 보다 먼저).
    // 같은 키면 먼저 넣은 선수 그림 뒤(위)다
    ...playerEffectMarksOf(state).map((mark) => ({
      key: mark.zKey,
      node: <DefensePlayerEffect key={`effect-${mark.key}`} mark={mark} point={screenOf(mark)} update={drawnPictures} />,
    })),
    // 0x36dfc 36e86~36ea4 — 쥔 공(+0x12c) · 담장 뒤로 사라진 공은 안 그린다
    ...(isBallDrawn(state.ball)
      ? [
          {
            key: state.ball.z,
            node: (
              <div key="ball" className={styles.actor} style={{ left: ballPoint.x, top: ballPoint.y }} data-testid="defense-ball">
                <ActorSprite folder={BALL_FRAMES} frame={ballFrameOf(state.ball.height)} />
              </div>
            ),
          },
        ]
      : []),
  ].sort((a, b) => a.key - b.key)

  return (
    <RawScreen>
      <div className={styles.field} data-testid="defense-field">
        <div className={styles.zoomLayer} style={zoomStyle} data-testid="defense-zoom" data-zoom={zoom?.percent ?? 100}>
        <img
          className={styles.background}
          style={{ left: offset.x, top: offset.y, width: DEFENSE_BACKGROUND_WIDTH, height: DEFENSE_BACKGROUND_HEIGHT }}
          src={backgroundUrl}
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
          src={backgroundUrl}
          alt=""
          data-testid="defense-background-right"
        />

        {/*
          공 그림자 0x356f8 — 0x36dfc(37268)가 땅점 (x, z) 자리에 검정 (s+1)² 칸 + 회색 테두리 넷을 **곧바로** 칠한다
          (공중 s = 3 · 땅 s = 5). 그리기 목록보다 먼저라 모든 야수 · 주자 · 공 아래다. ball.pzx 023~033(날개 달린 마구 공)은
          그림자가 아니다 — 예전에 그것을 깔던 것과 다르다.
        */}
        {isBallDrawn(state.ball) &&
          ballShadowOf(ballGround, toScreenY(state.ball.height)).map((piece, index) => (
            <div
              key={index}
              className={styles.ballShadowPiece}
              style={{
                left: piece.x,
                top: piece.y,
                width: piece.width,
                height: piece.height,
                background: `rgb(${piece.color.r}, ${piece.color.g}, ${piece.color.b})`,
              }}
              data-testid="defense-ball-shadow"
            />
          ))}

        {underActors}

        {/* 공 가진 야수 고리 + 이름 판 0x43cb0 — 0x46cbc, 비거리 판 뒤 · 야수 목록(0x43278) 앞에 곧바로 그린다 */}
        {holderMark !== null && (
          <DefenseHolderMark
            mark={holderMark}
            plate={state.holderPlate ?? null}
            fielderPoint={holderFielder === undefined ? null : fielderScreenOf(holderFielder)}
            update={drawnPictures}
            screen={{ width: styles.SCREEN_WIDTH, height: styles.SCREEN_HEIGHT }}
          />
        )}

        {/* 그리기 목록 차례 — 공은 바닥(z)에서 높이만큼 위에 그린다 (높이 단위도 월드 단위다 — R3 1-3) */}
        {actors.map((actor) => actor.node)}

        {/* 레이저 잔상 0x37076 — 장면 +0x1991 동안 궤적 첫 점에서 공까지 */}
        {state.laserTrailFrom != null && (
          <DefenseLaserTrail
            folder={BALL_FRAMES}
            frame={ballFrameOf(state.ball.height)}
            from={(() => {
              const ground = screenOf(state.laserTrailFrom)
              return { x: ground.x, y: ground.y - toScreenY(state.laserTrailFrom.height) }
            })()}
            ball={ballPoint}
            ballHeight={toScreenY(state.ball.height)}
            ballGroundY={ballGround.y}
          />
        )}

        {/* 결과 판 0x46844 — 보통 판정 글자(0x393b4)를 (x + dx, y − 30 + dy) 에 */}
        {judgeText !== null && judgeTextPoint !== null && (
          <div
            className={styles.actor}
            style={{ left: judgeTextPoint.x + judgeText.dx, top: judgeTextPoint.y - JUDGE_TEXT_RAISE + judgeText.dy }}
            data-testid="defense-judge-text"
            data-frame={judgeText.frame}
          >
            {/* 0x393b4 → 0xbe8a5 효과 [sp+8] = 0 (393f6) — 0xc9f98 이 파트 효과를 따른다: 애니 0 · 9 의 0x67 파트(칸 20 · 21 · 23 · 24 ·
                26 · 28 · 29)는 화면에 더한다(`LayeredFrameSprite` — plus-lighter) */}
            <JudgeTextSprite frame={judgeText.frame} />
          </div>
        )}

        {/* 결과 판 0x46844 — 레이저 · 필살 포구 연출 뒤 아웃(코드 13)이면 game_judge 애니 2 "큰 OUT" 을 (x, y − 60) 에 */}
        {bigOut !== null && bigOutPoint !== null && (
          <div
            className={styles.actor}
            style={{ left: bigOutPoint.x, top: bigOutPoint.y - BIG_OUT_RAISE }}
            data-testid="defense-big-out"
            data-frame={bigOut.frame}
          >
            <ActorSprite folder={JUDGE_FRAMES} frame={bigOut.frame} />
          </div>
        )}

        {/* 작은 지도 0x395f4(장면, 0x1e, 0x1e) — 0x46c88 의 0x46e02, 결과 판(0x46844) 뒤 · 번쩍임(0x4403c~) 앞 */}
        <DefenseFieldMap runners={state.runners} />

        {/* 필살 포구 연출 B 0x441c4 · C 0x44398(그리기 46e0e · 46e14 — 결과 판 뒤) — 공 가진 야수 자리에서 B 는 y − 50, C 는 방향대로 ±10 */}
        {state.flash != null && (
          <div
            className={styles.actor}
            style={{
              left: flashBase.x + flashOffsetOf(state.flash).x,
              top: flashBase.y + flashOffsetOf(state.flash).y,
            }}
            data-testid="defense-flash"
          >
            <ActorSprite folder={DEADLY_EFFECT_FRAMES} frame={state.flash.step} />
          </div>
        )}
        </div>
      </div>
      {children}
    </RawScreen>
  )
}

function Fielder({
  fielder,
  point,
  isLaserShining = false,
}: {
  readonly fielder: DefenseFielder
  readonly point: { readonly x: number; readonly y: number }
  /** 레이저 송구 반짝임(경기+0x19ad) — 이 야수를 효과 0xc · 빨강(255,0,0)으로 그린다(그림과 색 반반, `lib/laserShine`) */
  readonly isLaserShining?: boolean
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
      // 반짝이는 순간은 그림이 아니라 색만 바뀌므로 테스트가 볼 표시를 따로 남긴다
      data-laser-shining={isLaserShining ? 'true' : undefined}
    >
      <ActorSprite folder={folder} frame={frame} paletteIndex={paletteIndex} isLaserShining={isLaserShining} />
    </div>
  )
}

function Runner({
  runner,
  point,
  loadedAce = null,
}: {
  readonly runner: DefenseRunner
  readonly point: { readonly x: number; readonly y: number }
  /** 타석 교대 때 실린 주자 마선수 그림 (0x483a0) */
  readonly loadedAce?: number | null
}) {
  const frame = runnerFrameOf(runner.action, runner.actionTick, runner.base, runner.isAdvancing)
  // 0x79d10 — 마선수 주자는 실린 마선수 그림(+0x1c, 팔레트 없음), 아니면 defender(+0xc, 팀 팔레트). 프레임은 둘 다 vt40 날값
  const sprite = runnerSpriteFolderOf(runner, loadedAce)
  return (
    <div
      className={styles.actor}
      style={{ left: point.x, top: point.y }}
      data-testid={`defense-runner-${runner.index}`}
      data-frame={frame}
      data-folder={sprite.folder}
    >
      {/* 주자도 defender.pzx 를 쓴다 — 앞 17장(000~016)이 주자 칸이다 (S12 4-1 확정). 마선수 그림도 같은 125장 짜임이다 */}
      <ActorSprite
        folder={sprite.folder}
        frame={frame}
        paletteIndex={sprite.isAce ? null : defenderPaletteIndexOf(runner.teamIndex)}
      />
    </div>
  )
}
