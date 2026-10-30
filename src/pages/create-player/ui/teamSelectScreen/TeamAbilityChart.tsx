import { ABILITY_CHART, ANCHOR_B, abilityAxisMaximumLengthOf } from '@/pages/create-player/lib/teamSelectLayout'
import { AbilityRadarPanel } from '@/pages/create-player/ui/AbilityRadarPanel'
import { ABILITY_RADAR_LABELS } from '@/pages/create-player/lib/abilityRadarPanel'

/**
 * 팀 능력치 도형 — 공용 목록 0x63dee 의 `0x5aefd(skin, [skin+0xd4], B.x, B.y + 8, 종류 0, 0, 팀 idx(잠김이면 −1), 반지름 30, 0, 0, 0)`
 * (열린 팀 0x63e5c~0x63e74 · 잠긴 팀 0x63f14~0x63f38 → BL 0x63f38). 0x5aefc 는 종류와 상관없이 **ABILITY 판 전체**를 그린다 —
 * 둥근 바탕 slt_frame 3 · 바탕 테두리(고정 29, #6B92F4) · 값 도형 · 축 선 · 이름 상자 slt_frame 17 · 이름 img_text 46 · 45 · 204 · 205
 * (서술자 +6 = 8~11, 0x5b042~0x5b060) · 숫자 또는 "???" (`AbilityRadarPanel`, `lib/abilityRadarPanel` 머리말).
 * 값 = 팀 레코드 0x1f8c1(전역, idx) 의 +4 · +6 · +8 · +0xa (0x5b02a~0x5b08c), 축 최대 999(서술자 표 0xd1b2c 그대로) → 최대길이 = 반지름.
 * 잠긴 팀은 idx −1 이라 값 네 개 0 이고 [anim+0x1e4] = 0 (0x5afe8~0x5b026) 이라 줄어드는 동안에도 숫자 대신 "???" 다.
 *
 * 축별 최대 꼭짓점을 잇는 **빨간 테두리**(`anim+0x1dc` = 0x5b36c 의 RGB(255,0,0))는 그리기 0x7633c 가 `anim+0x1e0` 이 설 때만
 * 긋는다(0x76424). 그런데 바이너리 전체에서 그 칸을 쓰는 곳은 `[skin+0xd4]+0x1e0 = 0` 셋뿐이다(0x5376 · 0xb93e · 0x173b0 —
 * `#0xf0 << 1` 꼴 전수와 리터럴 풀 0x1e0 훑기, 셋 다 같은 자리에서 만들기 깃발 +0x1e3 도 0 으로 지운다). 만들기 0x5aefc(0x5b344~0x5b3b8)는
 * +0x1d0 · +0x1d4 · +0x1d8 · +0x1dc · +0x1e1 = 1 · +0x1e2 · +0x1e3 = 1 만 쓰고 +0x1e0 은 안 쓴다 → **원본에서 빨간 테두리는 안 나온다**.
 * 웹도 안 그린다(원본 그대로). ⚠️ 꼭짓점 그림(프레임 8·9·10·11)은 웹에 그림 근거가 없다.
 *
 * 값 도형은 레이더 [skin+0xd4] 의 자라는 애니로 그린다: 들어옴(나리 101 0x10790 · 메인 메뉴 18 0x23e08 ·
 * 19 0x23e70 · 시즌 0xca · 0xe4 …)이 +0xac = 1 · +0xad = 0 으로 두어 본문 첫 그림에 0 에서 자라고, 커서가 움직인 그림
 * (격자 키 0x6c030 이 칸이 바뀌면 커서 +0x25 = 1 — 0x6c17c~0x6c192)에 0x63b14 가 [anim+0x1e3] = 0 으로 두어(0x63c36~0x63c56)
 * 지난 목표값에서 새 팀 값으로 오르내린다.
 */
export function TeamAbilityChart({
  values,
  cursor,
  isOpen,
}: {
  readonly values: readonly number[]
  readonly cursor: number
  readonly isOpen: boolean
}) {
  const center = { x: ANCHOR_B.x + ABILITY_CHART.dx, y: ANCHOR_B.y + ABILITY_CHART.dy }
  return (
    <AbilityRadarPanel
      center={center}
      radius={ABILITY_CHART.radius}
      maximumLength={abilityAxisMaximumLengthOf(ABILITY_CHART.radius)}
      labelFrames={ABILITY_RADAR_LABELS.team}
      targets={values}
      restartKey={cursor}
      showsNumbers={isOpen}
    />
  )
}
