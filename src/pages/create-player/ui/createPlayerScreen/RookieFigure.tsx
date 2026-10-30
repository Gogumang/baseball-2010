import { batterLayersOf, NO_EQUIPMENT } from '@/widgets/batting-stage/lib/batterLayers'
import type { RookieProfile } from '@/entities/career/model/playerCareer'
import { FIGURE_POSE_FRAME } from '@/pages/create-player/lib/createPlayerLayout'
import * as styles from '@/pages/create-player/ui/CreatePlayerScreen.css'
import { FIGURE_FOOT } from './otherSlices'
import { LayerSprite } from './LayerSprite'

/**
 * 선수 그림 — 줄 1(타입)·3(손)을 바꾸면 원본은 그림을 다시 적재한다 (0x10810 → 0x78ab0): 타입이 몸통 파일(balancer/sluger)을,
 * 손이 좌우를 고른다. 좌우 반전 자체는 C-5 에서 "유력" 이라 좌타일 때 발 기준(57,160)을 축으로 뒤집는 것으로 옮겼다.
 */
export function RookieFigure({ profile, teamId }: { readonly profile: RookieProfile; readonly teamId: number }) {
  return (
    <div
      className={styles.figure}
      style={{ transformOrigin: `${FIGURE_FOOT.x}px 0`, transform: profile.battingSide === 1 ? 'scaleX(-1)' : undefined }}
    >
      {/* 열쇠가 폴더·프레임인 이유: 타입을 바꾸면 몸통 파일이 갈리는데, 그대로 두면 `useRecoloredSprite`
        가 앞 그림 주소를 한 번 더 내보내 엉뚱한 겹이 비친다 (상태가 한 박자 늦는다) */}
      {/*
      장비를 안 넘긴다 — 원본 등록 화면도 같은 그림 객체(0x10810)라 장비 니블 루프(0x10866)를
      똑같이 돌지만, **아직 만들지 않은 선수**라 레코드 `rec[0x19]`·`rec[0x1a]` 니블이 모두 0 이고
      `subs r2,니블,#1 ; bmi` 에서 네 부위가 다 걸러진다. 곧 원본도 여기서는 맨몸이다.
      그림자는 끈다 — 상태 102 등록 0x5f3c 의 0x613a 가 `fig+0x48 = 0` 으로 둔다 (0x78dc6).
    */}
      {batterLayersOf(FIGURE_POSE_FRAME, profile.battingTypeIndex, NO_EQUIPMENT, false).map((layer) => (
        <LayerSprite key={`${layer.folder}#${layer.frame}`} layer={layer} skinIndex={profile.skinIndex} teamIndex={teamId} />
      ))}
    </div>
  )
}
