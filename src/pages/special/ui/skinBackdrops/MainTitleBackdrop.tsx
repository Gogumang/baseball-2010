import { useEffect, useState } from 'react'
import { MAIN_TITLE_BACKDROP, SKIN_SCREEN, mainTitleLineYs } from '@/pages/special/lib/skinBackdrops'
import * as styles from '@/pages/special/ui/SpecialScreen.css'
import { MAIN_TITLE_BADGE_SRC, MAIN_TITLE_FRAME_SRC, buildMainTitleBuffer, mainTitleBuffer } from '@/pages/special/ui/skinBackdrops/mainTitleBuffer'

/**
 * 0x58371 — 메인 메뉴에 들어올 때 떠 둔 버퍼(흰 바탕 · 프레임 13 · 이미지 7 · 흐리기 0xbdd65(1) · 3줄 선 · 흰 단계 3)를
 * 그대로 찍는다. 버퍼는 16비트 화면 연산 그대로 캔버스에서 한 번 지어 앱에 하나 둔다([skin+0x450] 처럼).
 * 캔버스가 없으면(테스트) 겹쳐 그리기 근사(흐리기 없음 · 덮기 4/16)로 둔다.
 */
export function MainTitleBackdrop() {
  const { width, height } = SKIN_SCREEN
  const [built, setBuilt] = useState<string | null>(mainTitleBuffer.url)
  useEffect(() => {
    if (built !== null) return undefined
    let isActive = true
    void buildMainTitleBuffer().then((url) => {
      if (isActive && url !== null) setBuilt(url)
    })
    return () => {
      isActive = false
    }
  }, [built])
  if (built !== null) {
    return (
      <div className={styles.skinBackdrop} data-testid="바탕-메뉴" style={{ width, height }}>
        <img className={styles.sprite} alt="" src={built} style={{ left: 0, top: 0 }} />
      </div>
    )
  }
  return (
    <div className={styles.skinBackdrop} data-testid="바탕-메뉴" style={{ width, height, background: '#fff' }}>
      <img className={styles.sprite} alt="" src={MAIN_TITLE_FRAME_SRC} style={{ left: 0, top: 0 }} />
      <img
        className={styles.sprite}
        alt=""
        src={MAIN_TITLE_BADGE_SRC}
        style={{ left: MAIN_TITLE_BACKDROP.badgeX, top: MAIN_TITLE_BACKDROP.badgeY }}
      />
      <svg
        className={styles.sprite}
        style={{ left: 0, top: 0 }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        shapeRendering="crispEdges"
      >
        {mainTitleLineYs().map((y) => (
          <rect key={y} x={0} y={y} width={width} height={1} fill="#000" fillOpacity={MAIN_TITLE_BACKDROP.lineOpacity} />
        ))}
        <rect x={0} y={0} width={width} height={height} fill="#fff" fillOpacity={MAIN_TITLE_BACKDROP.whitenOpacity} />
      </svg>
    </div>
  )
}
