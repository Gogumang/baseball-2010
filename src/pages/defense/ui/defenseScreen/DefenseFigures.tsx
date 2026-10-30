import { defenderPaletteIndexOf, fielderSpriteOf, runnerFrameOf, runnerSpriteFolderOf } from '@/pages/defense/lib/defenseView'
import type { DefenseFielder, DefenseRunner } from '@/entities/fielding/model/defenseView/defenseFigures'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'
import { ActorSprite } from './ActorSprite'

/** 야수 한 명 — 수비 화면 그리기 목록 0x43278 의 한 칸 */
export function Fielder({
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

/** 주자 한 명 — 그리기 목록 0x43a0c 의 한 칸 */
export function Runner({
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
      <ActorSprite folder={sprite.folder} frame={frame} paletteIndex={sprite.isAce ? null : defenderPaletteIndexOf(runner.teamIndex)} />
    </div>
  )
}
