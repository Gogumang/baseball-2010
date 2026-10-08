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
import { ACE_CUT_IN_DRAWS } from '@/features/play-game/model/aceCutIn'
import { AceCutInCanvas } from '@/features/play-game/ui/AceCutInCanvas'

const GAME_UI_FOLDER = './sprites/game_ui/frames'

interface SubstitutionSceneOverlayProps {
  /**
   * 0x16 이 끝났다 — 끝 비트를 본 그림(17 번째)이 보낸 메시지 0xd 로 다음 그림이 0xd 다.
   * 부르는 쪽은 그때부터 0xd 두 그림 → 0xe 를 센다.
   */
  readonly onDone: () => void
  /**
   * 들어온 선수가 마선수면 그 컷인 번호(투수 0~4 · 타자 5~9, 표 0xd0108) — +0x195c 비트 2. 그러면 4dafa 가 컷인 0x473f0 을 그리고
   * 끝 비트 갈래(4daf0) 대신 **컷인이 단계 22 에 메시지 13** 을 보낼 때(27 번째 그림) 0x16 이 끝난다. 아니면 null.
   */
  readonly aceSlot?: number | null
}

/**
 * **교체 연출 0x16 그리기 0x4da30** 의 "CHANGE" 애니 (`features/play-game/model/substitutionScene`).
 * 타석 그림은 그 아래 타석 화면이 그대로 그린다(0x16 에는 갱신이 없어 공 · 선수가 멈춰 있다 — 부르는 쪽이 타석을 멈춘다).
 * 세울 때 그림 0 이고 한 갱신마다 한 그림씩 나아간다.
 */
export function SubstitutionSceneOverlay({ onDone, aceSlot = null }: SubstitutionSceneOverlayProps) {
  const origins = useFrameOrigins(GAME_UI_FOLDER)
  const [draw, setDraw] = useState(0)
  const drawRef = useRef(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const totalDraws = aceSlot === null ? SUBSTITUTION_SCENE_DRAWS : ACE_CUT_IN_DRAWS
  useEffect(() => {
    const handle = window.setInterval(() => {
      drawRef.current += 1
      const next = drawRef.current
      if (next >= totalDraws) {
        window.clearInterval(handle)
        onDoneRef.current()
        return
      }
      setDraw(next)
    }, millisecondsPerFrame())
    return () => window.clearInterval(handle)
  }, [totalDraws])

  const frame = substitutionFrameAt(draw)
  return (
    <div className={styles.stage} data-testid="교체연출" data-frame={frame}>
      <FrameSprite folder={GAME_UI_FOLDER} frame={frame} origins={origins} x={SUBSTITUTION_ANCHOR.x} y={SUBSTITUTION_ANCHOR.y} />
      {/* 4dafa — 마선수면 "CHANGE" 위에 등장 컷인 0x473f0 */}
      {aceSlot !== null && <AceCutInCanvas draw={draw} aceSlot={aceSlot} />}
    </div>
  )
}
