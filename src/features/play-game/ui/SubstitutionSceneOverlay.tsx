import { useEffect, useRef, useState } from 'react'
import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import {
  SUBSTITUTION_ANCHOR,
  SUBSTITUTION_SCENE_DRAWS,
  substitutionFrameAt,
} from '@/features/play-game/model/substitutionScene'
import * as styles from '@/features/play-game/ui/SubstitutionSceneOverlay.css'

const GAME_UI_FOLDER = './sprites/game_ui/frames'

interface SubstitutionSceneOverlayProps {
  /**
   * 0x16 이 끝났다 — 끝 비트를 본 그림(17 번째)이 보낸 메시지 0xd 로 다음 그림이 0xd 다.
   * 부르는 쪽은 그때부터 0xd 두 그림 → 0xe 를 센다.
   */
  readonly onDone: () => void
}

/**
 * **교체 연출 0x16 그리기 0x4da30** 의 "CHANGE" 애니 (`features/play-game/model/substitutionScene`).
 * 타석 그림은 그 아래 타석 화면이 그대로 그린다(0x16 에는 갱신이 없어 공 · 선수가 멈춰 있다 — 부르는 쪽이 타석을 멈춘다).
 * 세울 때 그림 0 이고 한 갱신마다 한 그림씩 나아간다.
 */
export function SubstitutionSceneOverlay({ onDone }: SubstitutionSceneOverlayProps) {
  const origins = useFrameOrigins(GAME_UI_FOLDER)
  const [draw, setDraw] = useState(0)
  const drawRef = useRef(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const handle = window.setInterval(() => {
      drawRef.current += 1
      const next = drawRef.current
      if (next >= SUBSTITUTION_SCENE_DRAWS) {
        window.clearInterval(handle)
        onDoneRef.current()
        return
      }
      setDraw(next)
    }, millisecondsPerFrame())
    return () => window.clearInterval(handle)
  }, [])

  const frame = substitutionFrameAt(draw)
  return (
    <div className={styles.stage} data-testid="교체연출" data-frame={frame}>
      <FrameSprite folder={GAME_UI_FOLDER} frame={frame} origins={origins} x={SUBSTITUTION_ANCHOR.x} y={SUBSTITUTION_ANCHOR.y} />
    </div>
  )
}
