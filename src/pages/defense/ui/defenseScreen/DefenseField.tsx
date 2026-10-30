import type { ReactNode } from 'react'
import { toScreenY } from '@/pages/defense/lib/defenseCamera'
import { BALL_FRAMES, ballFrameOf } from '@/pages/defense/lib/defenseView'
import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'
import { DefenseFieldMap } from '@/pages/defense/ui/DefenseFieldMap'
import { DefenseHolderMark } from '@/pages/defense/ui/DefenseHolderMark'
import { DefenseLaserTrail } from '@/pages/defense/ui/DefenseLaserTrail'
import { defenseActorsOf } from './defenseActors'
import { DefenseBackground, DefenseBallShadow, DefenseFlashSprite } from './DefenseFieldParts'
import { fielderScreenOf, flashBaseOf, liftedPointOf, screenOfOffset, zoomStyleOf, type ScreenOf, type ScreenPoint } from './defenseProjection'
import { DefenseBigOut, DefenseJudgeText } from './DefenseResultPopups'

/** 공 가진 야수 고리 + 이름 판 0x43cb0 — 0x46cbc, 비거리 판 뒤 · 야수 목록(0x43278) 앞에 곧바로 그린다 */
function DefenseHolderLayer({ state, screenOf, update }: { readonly state: DefenseViewState; readonly screenOf: ScreenOf; readonly update: number }) {
  const holderMark = state.holderMark ?? null
  if (holderMark === null) return null
  const holderFielder = state.fielders.find((fielder) => fielder.slot === holderMark.slot)
  return (
    <DefenseHolderMark
      mark={holderMark}
      plate={state.holderPlate ?? null}
      fielderPoint={holderFielder === undefined ? null : fielderScreenOf(screenOf, holderFielder)}
      update={update}
      screen={{ width: styles.SCREEN_WIDTH, height: styles.SCREEN_HEIGHT }}
    />
  )
}

/** 그리기 목록 뒤 — 레이저 잔상 0x37076(장면 +0x1991 동안 궤적 첫 점에서 공까지) · 결과 판 0x46844 · 작은 지도 0x395f4 · 번쩍임 */
function DefenseOverActors({
  state,
  screenOf,
  ballPoint,
  ballGroundY,
  hidesFieldMap = false,
}: {
  readonly state: DefenseViewState
  readonly screenOf: ScreenOf
  readonly ballPoint: ScreenPoint
  readonly ballGroundY: number
  readonly hidesFieldMap: boolean | undefined
}) {
  return (
    <>
      {state.laserTrailFrom != null && (
        <DefenseLaserTrail
          folder={BALL_FRAMES}
          frame={ballFrameOf(state.ball.height)}
          from={liftedPointOf(screenOf, state.laserTrailFrom)}
          ball={ballPoint}
          ballHeight={toScreenY(state.ball.height)}
          ballGroundY={ballGroundY}
        />
      )}
      <DefenseJudgeText state={state} screenOf={screenOf} />
      <DefenseBigOut state={state} screenOf={screenOf} />
      {/* 작은 지도 0x395f4(장면, 0x1e, 0x1e) — 0x46c88 의 0x46e02, 결과 판(0x46844) 뒤 · 번쩍임(0x4403c~) 앞 */}
      {!hidesFieldMap && <DefenseFieldMap runners={state.runners} />}
      {state.flash != null && <DefenseFlashSprite flash={state.flash} base={flashBaseOf(state.flash, screenOf, ballPoint)} />}
    </>
  )
}

/**
 * 수비 필드 한 장 — 줌 층 안에 바탕 · 이벤트 존 · 공 그림자 · 비거리 판 · 공 가진 야수 고리 · 그리기 목록(야수 · 주자 · 부착 효과 · 공) ·
 * 그 위의 것들을 카메라 오프셋만큼 옮겨 깐다. 야수·주자·공은 월드 좌표를 같은 오프셋으로 화면에 찍는다
 */
export function DefenseField({
  state,
  offset,
  backgroundUrl,
  drawnPictures,
  overBackground,
  underActors,
  hidesFieldMap,
}: {
  readonly state: DefenseViewState
  readonly offset: ScreenPoint
  readonly backgroundUrl: string
  /** 그리기 쪽 애니가 넘어간 수 — 갱신마다 한 그림 + 창이 선 첫 그림 */
  readonly drawnPictures: number
  readonly overBackground: ReactNode
  readonly underActors: ReactNode
  readonly hidesFieldMap: boolean | undefined
}) {
  const screenOf = screenOfOffset(offset)
  const ballGround = screenOf(state.ball)
  const ballPoint = liftedPointOf(screenOf, state.ball)
  return (
    <div className={styles.field} data-testid="defense-field">
      <div className={styles.zoomLayer} style={zoomStyleOf(state.zoom, offset)} data-testid="defense-zoom" data-zoom={state.zoom?.percent ?? 100}>
        <DefenseBackground offset={offset} url={backgroundUrl} />
        {/* 0x411e0 의 구장 다음 0x41098 — 이벤트 존 · 200G (홈런더비 판). 공 그림자(0x46c88 의 0x36dfc)보다 먼저다 */}
        {overBackground}
        <DefenseBallShadow ball={state.ball} ground={ballGround} />
        {underActors}
        <DefenseHolderLayer state={state} screenOf={screenOf} update={drawnPictures} />
        {/* 그리기 목록 차례 — 공은 바닥(z)에서 높이만큼 위에 그린다 */}
        {defenseActorsOf(state, screenOf, ballPoint, drawnPictures)}
        <DefenseOverActors state={state} screenOf={screenOf} ballPoint={ballPoint} ballGroundY={ballGround.y} hidesFieldMap={hidesFieldMap} />
      </div>
    </div>
  )
}
