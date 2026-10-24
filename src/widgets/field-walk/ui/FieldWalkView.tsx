import type { ReactNode } from 'react'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useRecoloredSprite, useWarmRecoloredFolder } from '@/shared/lib/sprite/paletteSwap'
import { toScreenX, toScreenY } from '@/pages/defense/lib/defenseCamera'
import {
  DEFENSE_BACKGROUND_HEIGHT,
  DEFENSE_BACKGROUND_URL,
  DEFENSE_BACKGROUND_WIDTH,
  DEFENDER_FRAMES,
  defenderPaletteIndexOf,
} from '@/pages/defense/lib/defenseView'
import type { FieldWalker } from '@/widgets/field-walk/lib/fieldWalker'
import { type WalkerAceSprite, walkerSpriteOf } from '@/widgets/field-walk/lib/walkerAces'
import * as styles from '@/widgets/field-walk/ui/FieldWalkView.css'

/** 한 줄 9명 — 0x43010(장면, 그림, 줄, 공격?) 한 번 */
export interface FieldWalkRow {
  /** 칸 i (0 투수 … 8 중견) */
  readonly walkers: readonly FieldWalker[]
  /** 그림 팔레트 = 그 팀 번호 (`defender.mpl` 벌). 없으면 구운 색 */
  readonly teamIndex?: number | null
  /**
   * 칸별 마선수 그림 — 0x79b48 의 a(칸 0 이고 그 줄 팀 지금 투수가 마선수 → 투수 마선수 그림) ·
   * b(칸 선수 +0xec 가 마선수 → 그 팀 첫 마타자 그림). 없으면(null) 보통 그림 (`lib/walkerAces`)
   */
  readonly aceSprites?: readonly (WalkerAceSprite | null)[]
}

interface FieldWalkViewProps {
  /** 카메라 오프셋 0x41230 (+0xfec, +0xff0) */
  readonly offset: { readonly x: number; readonly y: number }
  /** 수비 바탕 잔디 팔레트 줄 (`DefenseScreen.grassPalette` 와 같다). null 이면 구운 그림 */
  readonly grassPalette?: number | null
  /** 그리기 목록에 넣는 차례대로 — 0x4fb8c 는 수비 줄 → 공격 줄, 0x43228 도 같다 */
  readonly rows: readonly FieldWalkRow[]
  /** 선수 위에 얹을 것 (이름표 따위) */
  readonly children?: ReactNode
}

/**
 * **운동장 전경 한 장** — 바탕 0x41230 → 0x411e0 → 0x78930(defense.pzx 를 카메라 오프셋에, 같은 그림을 효과 0x11 로 (x + 폭 − 1) 에)
 * 위에 0x43010 이 넣은 선수들을 그리기 목록 0xbe6a0 차례로 그린다.
 *
 * 0x43010 (직접 뜸 2026-10-14): 줄의 i = 8 → 0 마다 자리 = 0xb94b4(카메라, x, z − y) + 오프셋 · 프레임 = vt40 · 깊이 키 = z 로
 * 0x79b48 → 0xbe8d4 (넣는 차례가 같으면 먼저 넣은 것이 아래). 0x79b48 의 넷째 뒤 인자(움직이나 · +0xb 니블)는 0x79b48 이 안 읽는다 —
 * 효과 · 부착 그림 없이 몸만 그린다(수비 인플레이 0x43278 과 다르다).
 */
export function FieldWalkView({ offset, grassPalette = null, rows, children }: FieldWalkViewProps) {
  const backgroundUrl = useRecoloredSprite(DEFENSE_BACKGROUND_URL, grassPalette)
  // 걷는 칸마다 그림이 바뀐다 — 줄(팀) 벌로 defender 칸 전부를 미리 칠해 처음 딛는 칸에 구운 벌이 비치지 않게
  useWarmRecoloredFolder(DEFENDER_FRAMES, rows.map((row) => defenderPaletteIndexOf(row.teamIndex)))
  const size = { width: DEFENSE_BACKGROUND_WIDTH, height: DEFENSE_BACKGROUND_HEIGHT }
  const actors = rows
    .flatMap((row, rowIndex) =>
      [...row.walkers.keys()].reverse().map((slot) => ({ row, rowIndex, slot, walker: row.walkers[slot] })),
    )
    .filter((entry) => entry.walker !== undefined)
    .map((entry, order) => ({ ...entry, order }))
    .sort((a, b) => a.walker.z - b.walker.z || a.order - b.order)

  return (
    <div className={styles.field} data-testid="운동장-전경">
      <img className={styles.background} style={{ left: offset.x, top: offset.y, ...size }} src={backgroundUrl} alt="" />
      <img className={styles.backgroundMirrored}
        style={{ left: offset.x + DEFENSE_BACKGROUND_WIDTH - 1, top: offset.y, ...size }} src={backgroundUrl} alt="" />
      {actors.map(({ row, rowIndex, slot, walker }) => {
        const ace = row.aceSprites?.[slot] ?? null
        const sprite = walkerSpriteOf(walker, ace)
        return (
          <div key={`${rowIndex}-${slot}`} className={styles.actor}
            style={{ left: toScreenX(walker.x) + offset.x, top: toScreenY(walker.z) + offset.y }}
            data-testid={`운동장-선수-${rowIndex}-${slot}`} data-frame={sprite.frame} data-ace={ace === null ? undefined : `${ace.kind}-${ace.index}`} data-x={walker.x} data-z={walker.z}>
            <WalkerSprite folder={sprite.folder} frame={sprite.frame}
              paletteIndex={ace === null ? defenderPaletteIndexOf(row.teamIndex) : null} />
          </div>
        )
      })}
      {children}
    </div>
  )
}

/** 그림 한 장 — 원점은 폴더마다 읽고, 칠한 그림은 프레임마다 새로 마운트한다(`DefenseScreen` 의 `PaintedSprite` 와 같은 까닭) */
function WalkerSprite({ folder, frame, paletteIndex }: {
  readonly folder: string
  readonly frame: number
  readonly paletteIndex: number | null
}) {
  const origins = useFrameOrigins(folder)
  const key = String(frame).padStart(3, '0')
  const origin = origins?.[key]
  if (origin === undefined) return null
  return <PaintedFrame key={key} url={`${folder}/${key}.png`} paletteIndex={paletteIndex} left={origin.x} top={origin.y} />
}

function PaintedFrame({ url, paletteIndex, left, top }: {
  readonly url: string
  readonly paletteIndex: number | null
  readonly left: number
  readonly top: number
}) {
  return <img className={styles.sprite} style={{ left, top }} src={useRecoloredSprite(url, paletteIndex)} alt="" />
}
