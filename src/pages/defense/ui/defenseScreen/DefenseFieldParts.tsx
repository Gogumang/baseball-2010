import {
  DEADLY_EFFECT_FRAMES,
  DEFENSE_BACKGROUND_HEIGHT,
  DEFENSE_BACKGROUND_WIDTH,
  ballShadowOf,
  flashOffsetOf,
  isBallDrawn,
} from '@/pages/defense/lib/defenseView'
import { toScreenY } from '@/pages/defense/lib/defenseCamera'
import type { DefenseBall, DefenseFlash } from '@/entities/fielding/model/defenseView/defenseViewState'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'
import { ActorSprite } from './ActorSprite'
import type { ScreenPoint } from './defenseProjection'

/** 배경 stadium/defense.pzx(310×500)를 좌우 반전 두 장으로 620×500 을 만들어(I 1b) 카메라 오프셋만큼 옮겨 깐다 */
export function DefenseBackground({ offset, url }: { readonly offset: ScreenPoint; readonly url: string }) {
  return (
    <>
      <img
        className={styles.background}
        style={{ left: offset.x, top: offset.y, width: DEFENSE_BACKGROUND_WIDTH, height: DEFENSE_BACKGROUND_HEIGHT }}
        src={url}
        alt=""
        data-testid="defense-background-left"
      />
      <img
        className={styles.backgroundMirrored}
        style={{ left: offset.x + DEFENSE_BACKGROUND_WIDTH, top: offset.y, width: DEFENSE_BACKGROUND_WIDTH, height: DEFENSE_BACKGROUND_HEIGHT }}
        src={url}
        alt=""
        data-testid="defense-background-right"
      />
    </>
  )
}

/**
 * 공 그림자 0x356f8 — 0x36dfc(37268)가 땅점 (x, z) 자리에 검정 (s+1)² 칸 + 회색 테두리 넷을 **곧바로** 칠한다
 * (공중 s = 3 · 땅 s = 5). 그리기 목록보다 먼저라 모든 야수 · 주자 · 공 아래다. ball.pzx 023~033(날개 달린 마구 공)은
 * 그림자가 아니다 — 예전에 그것을 깔던 것과 다르다. 쥔 공 · 담장 뒤로 사라진 공은 안 그린다
 */
export function DefenseBallShadow({ ball, ground }: { readonly ball: DefenseBall; readonly ground: ScreenPoint }) {
  if (!isBallDrawn(ball)) return null
  return ballShadowOf(ground, toScreenY(ball.height)).map((piece, index) => (
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
  ))
}

/** 필살 포구 연출 B 0x441c4 · C 0x44398(그리기 46e0e · 46e14 — 결과 판 뒤) — 공 가진 야수 자리에서 B 는 y − 50, C 는 방향대로 ±10 */
export function DefenseFlashSprite({ flash, base }: { readonly flash: DefenseFlash; readonly base: ScreenPoint }) {
  return (
    <div className={styles.actor} style={{ left: base.x + flashOffsetOf(flash).x, top: base.y + flashOffsetOf(flash).y }} data-testid="defense-flash">
      <ActorSprite folder={DEADLY_EFFECT_FRAMES} frame={flash.step} />
    </div>
  )
}
