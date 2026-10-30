import { useEffect, useState } from 'react'
import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
import { shinedSpriteUrl } from '@/pages/defense/lib/laserShine'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'

/**
 * 그림 한 장 — 폴더마다 원점을 따로 읽는다(폴더가 칸마다 다르므로 컴포넌트로 뺀다).
 *
 * 팀 팔레트 번호를 주면 `defender.mpl` 벌로 다시 칠하고(C-1), 안 주면 구운 그림 그대로다.
 * 원점 읽기(`useFrameOrigins`)는 **여기에 남겨 둔다** — 칠하는 쪽만 프레임마다 새로 마운트해야
 * 하는데(아래 `PaintedSprite` 주석), 원점까지 같이 새로 마운트하면 틱마다 그림이 한 번씩 사라진다.
 */
export function ActorSprite({
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

/**
 * 팀 색으로 칠한 그림 한 장.
 *
 * 프레임마다 **따로 마운트**해야 한다(`key` = 프레임 번호): `useRecoloredSprite` 는 칠한 주소를
 * 상태로 들고 있어서, 프레임이 바뀐 그 그리기 한 번은 **앞 프레임 주소**를 내보낸다
 * (초상화 `EventPortraits.tsx` 의 `PaintedFrame` 에서 실제로 걸렸던 함정이다).
 * 새로 마운트하면 처음 상태가 이번 프레임의 구운 주소라 엉뚱한 칸이 비칠 일이 없다.
 * ⚠️ 캔버스가 없거나(시험 DOM) 아직 다 안 칠했으면 구운 그림을 그대로 쓴다 — 색만 한 박자 늦는다.
 *   (남김, Q-13: 앱 길에서도 지난다 — 팔레트 JSON · 그림을 비동기로 받아 칠하는 동안의 첫 그림들. 원본은 팔레트를 적재 때 다 들고 있어
 *   대응이 없는 웹 적재 몫이다. 칠한 그림은 `useRecoloredSprite` 가 모아 두어 두 번째부터는 곧장 쓴다)
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
