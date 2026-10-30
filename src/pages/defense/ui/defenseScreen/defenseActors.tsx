import type { ReactNode } from 'react'
import { BALL_FRAMES, ballFrameOf, isBallDrawn } from '@/pages/defense/lib/defenseView'
import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'
import { DefensePlayerEffect } from '@/pages/defense/ui/DefensePlayerEffect'
import { playerEffectMarksOf } from '@/pages/defense/lib/playerEffectMarks'
import { ActorSprite } from './ActorSprite'
import { Fielder, Runner } from './DefenseFigures'
import { fielderScreenOf, type ScreenOf, type ScreenPoint } from './defenseProjection'

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
export function defenseActorsOf(state: DefenseViewState, screenOf: ScreenOf, ballPoint: ScreenPoint, drawnPictures: number): ReactNode[] {
  const actors: { readonly key: number; readonly node: ReactNode }[] = [
    ...[...state.fielders]
      .sort((a, b) => b.slot - a.slot)
      .map((fielder) => ({
        key: fielder.z,
        node: (
          <Fielder
            key={`fielder-${fielder.slot}`}
            fielder={fielder}
            point={fielderScreenOf(screenOf, fielder)}
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
        node: <Runner key={`runner-${runner.index}`} runner={runner} point={screenOf(runner)} loadedAce={state.runnerAceSprite ?? null} />,
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
  return actors.map((actor) => actor.node)
}
