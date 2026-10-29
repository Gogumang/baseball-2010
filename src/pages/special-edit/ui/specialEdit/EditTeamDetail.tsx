import { TEAMS } from '@/shared/config/original/teams'
import * as styles from '@/pages/special-edit/ui/SpecialEditScreen.css'
import {
  ABILITY_CHART,
  ABILITY_RADAR_LABELS,
  ANCHOR_A,
  ANCHOR_B,
  AbilityRadarPanel,
  NAME_BAR,
  TAG,
  abilityAxisMaximumLengthOf,
} from '@/pages/special-edit/ui/specialEdit/otherSlices'
import { BIG_LOGO_HALF, IMG_TEXT, SLT_IMAGE, imageSrc } from '@/pages/special-edit/ui/specialEdit/editAssets'

/** 딱지 157 "PLAYER"(A) · 159 "ABILITY"(B) — 막대 + 글 */
const TAGS = [
  { anchor: ANCHOR_A, bar: TAG.aBarImage, barDy: TAG.aDy, textDy: TAG.aTextDy, frame: TAG.aTextFrame },
  { anchor: ANCHOR_B, bar: TAG.bBarImage, barDy: TAG.bDy, textDy: TAG.bTextDy, frame: TAG.bTextFrame },
] as const

type Team = (typeof TEAMS)[number]

/** A (58,110) 에 팀 로고 · 이름 막대, B (178,96) 에 능력치 도형, 딱지 둘 */
export function EditTeamDetail({ team, cursor, slides }: { readonly team: Team; readonly cursor: number; readonly slides: boolean }) {
  const radius = ABILITY_CHART.radius
  return (
    <>
      {TAGS.map(({ anchor, bar, barDy, textDy, frame }) => (
        <span key={frame}>
          <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, bar)} style={{ left: anchor.x + TAG.dx, top: anchor.y + barDy }} />
          <img
            className={styles.layer}
            alt=""
            src={imageSrc(IMG_TEXT, frame)}
            style={{ left: anchor.x + TAG.dx, top: anchor.y + textDy, width: TAG.barWidth, objectFit: 'none' }}
          />
        </span>
      ))}

      <img
        className={styles.layer}
        alt={team.name}
        src={team.logoUrl}
        style={{ left: ANCHOR_A.x - BIG_LOGO_HALF, top: ANCHOR_A.y - BIG_LOGO_HALF }}
      />
      <img
        className={styles.layer}
        alt=""
        src={imageSrc(SLT_IMAGE, NAME_BAR.image)}
        style={{ left: ANCHOR_A.x + NAME_BAR.dx, top: ANCHOR_A.y + NAME_BAR.dy }}
      />
      <span className={styles.centeredText} style={{ left: ANCHOR_A.x + NAME_BAR.dx, top: ANCHOR_A.y + 42, width: NAME_BAR.width }}>
        {team.name}
      </span>

      {/* 능력치 도형 0x5aefd(…, 종류 0, 0, 칸(≤ 9 라 잠김 없음), 반지름 30) — 공용 목록 k 9 도 점프표 0xd1edc 로 팀 고르기와 같은
      본문 0x63dee 를 타고 0x63f38 에서 ABILITY 판 전체(바탕 · 축 · 이름 상자 46 · 45 · 204 · 205 · 숫자)를 그린다.
      값 도형은 레이더 [skin+0xd4] 의 자라는 애니 — 들어옴 0x24804 가 +0xad = 0 으로 두어 0 에서, 커서가 움직인 그림(커서 +0x25)엔
      0x63b14 가 +0x1e3 = 0 으로 두어 지난 값에서. 하위 1 · 2 에서 돌아오면 들어옴도 틱 0 도 안 거쳐 다 자란 그대로다 */}
      <AbilityRadarPanel
        center={{ x: ANCHOR_B.x + ABILITY_CHART.dx, y: ANCHOR_B.y + ABILITY_CHART.dy }}
        radius={radius}
        maximumLength={abilityAxisMaximumLengthOf(radius)}
        labelFrames={ABILITY_RADAR_LABELS.team}
        targets={team.values.slice(2)}
        restartKey={cursor}
        fromZero={slides}
      />
    </>
  )
}
