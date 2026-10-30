import { useLayoutEffect, useState } from 'react'
import { type CameraState, cameraBoundsOf, centerOn, screenOffsetOf, stepCamera } from '@/pages/defense/lib/defenseCamera'
import { cameraTargetOf } from '@/pages/defense/lib/defenseView'
import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'
import type { DefenseScreenProps } from './defenseScreenProps'

/** 한 번에 몰아서 따라갈 틱 수 상한 — 탭이 잠들었다 돌아와도 한 프레임에 다 돌지 않게 막는다 */
const MAX_CATCH_UP_TICKS = 30

/**
 * 카메라 따라가기 칸 — 그림마다 렌더가 읽고 갱신 수가 바뀐 그림에서 그만큼 걷는다(예전 ref 그대로 — 렌더 중에 고치고, 다시 그리지 않는다).
 * 처음 그림은 가운데 맞춤(`centered`), 그 뒤는 지난 갱신 수부터의 차이를 `follow` 가 걷는다
 */
function createCameraFollow() {
  let memory: { update: number; state: CameraState } | null = null
  return {
    cameraAt(update: number, centered: () => CameraState, follow: (moved: CameraState, ticks: number) => CameraState): CameraState {
      if (memory === null) memory = { update, state: centered() }
      else if (memory.update !== update) memory = { update, state: follow(memory.state, update - memory.update) }
      return memory.state
    },
  }
}

/**
 * **이 그림의 카메라 오프셋**(+0xfec, +0xff0 — 0x41230). 진입 때는 즉시 가운데 맞춤(vt10, 0x466d0), 그 뒤로는 갱신마다 `followPercent` 씩
 * 따라간다. 진입 0x46418 의 맞춤(466e0~46708)은 공 점 0xa25d4 의 **(x, z)** 다 — 갱신 0x3f060 과 달리 높이를 안 뺀다.
 * (따로 정한 대상 `cameraTarget` 이 있으면 그것 — 원본 진입에는 없는 칸이라 상태 0x18 · 시험용이다). 부르는 쪽이 카메라를 정했으면 그 자리다.
 * 판 쪽(공 그림자 자리 셈)이 볼 화면 밀림은 커밋 때 `cameraOffsetRef` 에 적는다(판 쪽 효과는 이 부품 효과 뒤에 돈다)
 */
export function useDefenseCamera(
  update: number,
  state: DefenseViewState,
  followPercent: number,
  fixedCamera: CameraState | undefined,
  cameraOffsetRef: DefenseScreenProps['cameraOffsetRef'],
) {
  const bounds = cameraBoundsOf(styles.SCREEN_WIDTH, styles.SCREEN_HEIGHT)
  const target = cameraTargetOf(state)
  const [cameraFollow] = useState(createCameraFollow)
  const followed = cameraFollow.cameraAt(
    update,
    () => centerOn(bounds, state.cameraTarget ?? { x: state.ball.x, z: state.ball.z }),
    (moved, ticks) => {
      // 경기 멈춤(+0x1993) · 판이 닫힌 그림은 0x3f060 이 대상 · 따라가기 앞에서 돌아간다(3f0a4 · 3f0ea) — 카메라가 그 자리에 선다
      const steps = state.cameraFrozen === true ? 0 : Math.min(Math.max(ticks, 0), MAX_CATCH_UP_TICKS)
      let next = moved
      for (let i = 0; i < steps; i += 1) next = stepCamera(bounds, next, target, followPercent)
      return next
    },
  )
  const offset = screenOffsetOf(fixedCamera ?? followed)
  useLayoutEffect(() => {
    if (cameraOffsetRef !== undefined) cameraOffsetRef.current = offset
  })
  return offset
}
