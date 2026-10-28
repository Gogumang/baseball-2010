import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { TEAMS } from '@/shared/config/original/teams'
import { abilityAxisMaximumLengthOf } from '@/pages/create-player/lib/teamSelectLayout'
import { ABILITY_RADAR_LABELS } from '@/pages/create-player/lib/abilityRadarPanel'
import { AbilityRadarPanel } from '@/pages/create-player/ui/AbilityRadarPanel'
import { ABILITY_TITLE, RADAR_CENTER, RADAR_RADIUS } from '@/pages/management/lib/basicInfoLayout'
import { SEASON_CARD_LOGO } from '@/pages/season/lib/seasonPlayerCard'
import { SeasonCardBadge, SteppedBoard } from '@/pages/season/ui/SeasonPlayerCard'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const MODE_UI = assetUrl('./sprites/mode_ui/frames')

/**
 * **시즌 카드 0x7ba44 의 팀 갈래** — 구단정보 0xd5(그림 0xae68) · 이름 입력 0xc8(그림 0xba28) 이 같은 차례로 그린다 (직접 떴다).
 * ```
 * 7ba4c  [gfx+0x138](mode_ui) 가 있으면 0x76725([gfx+0x134])        ; 계단형 판 (`SteppedBoard`)
 * 7ba98  로고 [gfx+0x140] 이 있으면 (W/2 − w/2 − 0x3e, H/2 − h/2 − 0x32) 에 0xba1d5
 *        7bab6 0x7b998([gfx+0x20] == 2 시즌) 이고 7bacc 상태가 0xd9 · 0xdc 가 아니면 (…, 0, 0, 0) = 효과 없이 (7bb20~7bb70)
 * 7bbca  [gfx+0x168] 이 있고 상태 ≠ 0xdc 면 로고 아래 · 위 딱지 + 팀 이름 img_text 0x41 + [gfx+0x24] (`SeasonCardBadge`)
 * 7bdce  mode_ui 8 (W/2 + 0x3a − w/2, H/2 − 0x6b) · img_text 159 (…, H/2 − 0x42 − 0x25)
 * 7beb6  0x7b998 이 서고 (상태 == 0xd5, 또는 창 종류 [gfx+0x1a4] ≠ 3 이고 상태 ≠ 0xd9) 이면 0x7bf9c 팀 갈래:
 *        0x5aefd(skin, [skin+0xd4], W/2 + 0x3a, H/2 − 0x42 + 0xa, 종류 0, rec = [gfx+0x154], idx 0, 반지름 0x1e, 0, 0, 0)   ; 리터럴 0x7c100
 * ```
 * 0x5aefc 종류 0 은 **ABILITY 판 전체**(둥근 바탕 · 바탕 테두리 · 값 도형 · 축 선 · 이름 상자 · img_text 46 · 45 · 204 · 205 ·
 * 숫자)를 그린다 — `AbilityRadarPanel`(`lib/abilityRadarPanel` 머리말). idx 0 이라 [anim+0x1e4] = 1(0x5afb6) 로 숫자가 선다.
 * 값 = rec +4 · +6 · +8 · +0xa, 축 최대 999 → 최대길이 = 반지름 30. 가운데 (W/2 + 0x3a, H/2 − 0x42 + 0xa) = (178, 104).
 *
 * [gfx+0x20] 은 창 객체 생성자 0x7b4dc 가 4 로 두고(0x7b4e0) 시즌 장면 셋업 0x3b14 가 [장면+0x15c] = 전역 모드 [0x1552d14] 로
 * 덮는다(0x3f8a~0x3f92) — 시즌 장면은 모드 2 라 늘 시즌 갈래다(나리 셋업 0xfa72 는 모드 3 · 4).
 * 상태 [gfx+0x174] 는 그리기 앞 0xe9ac 가 0x7e84c(창, 장면 상태) 로 매번 적는다(0xe9d8~0xe9e8, 0xd3 · 0xdf · 0xe8 은 건너뜀).
 * 값 도형은 레이더 [skin+0xd4] 의 자라는 애니 — 들어옴(0xd5 0x5324 0x534c~0x5376 · 0xc8 0xb8fc 0xb904~0xb940)이
 * +0xac = 1 · +0xad = 0 · +0x1e3 = 0 으로 두어 0 에서 자란다.
 */
export function SeasonTeamCard({
  teamId,
  teamAbilities,
  hasCardBadge,
  testIdPrefix,
}: {
  readonly teamId: number
  /** rec +4 · +6 · +8 · +0xa — 0xd5 는 시즌 팀 레코드 0x1f571(전역, SR+1) · 0xc8 은 마스터 팀 레코드 0x1f8c1(전역, 고른 팀) */
  readonly teamAbilities: readonly number[]
  /** [gfx+0x168] — 이 장면에서 0xca · 0xe4 를 거쳤는가 */
  readonly hasCardBadge: boolean
  readonly testIdPrefix: string
}) {
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  const team = TEAMS[teamId]
  return (
    <>
      <SteppedBoard />
      {team !== undefined && (
        <img
          className={styles.layer}
          alt={team.name}
          data-testid={`${testIdPrefix}-로고`}
          src={team.logoUrl}
          style={{ left: SEASON_CARD_LOGO.x, top: SEASON_CARD_LOGO.y, width: SEASON_CARD_LOGO.width, height: SEASON_CARD_LOGO.height }}
        />
      )}
      {team !== undefined && hasCardBadge && <SeasonCardBadge teamId={teamId} />}

      <FrameSprite folder={MODE_UI} frame={8} origins={modeUiOrigins} x={ABILITY_TITLE.plate.x} y={ABILITY_TITLE.plate.y} />
      <img
        className={styles.layer}
        alt=""
        src={`${IMG_TEXT}/${String(ABILITY_TITLE.frame).padStart(3, '0')}.png`}
        style={{ left: ABILITY_TITLE.centerX - 19, top: ABILITY_TITLE.y }}
      />
      <AbilityRadarPanel
        center={RADAR_CENTER}
        radius={RADAR_RADIUS}
        maximumLength={abilityAxisMaximumLengthOf(RADAR_RADIUS)}
        labelFrames={ABILITY_RADAR_LABELS.team}
        targets={teamAbilities}
        restartKey={teamId}
      />
    </>
  )
}
