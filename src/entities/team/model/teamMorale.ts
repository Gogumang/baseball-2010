import { TEAMS } from '@/shared/config/original/teams'

/**
 * **팀 레코드 사기** — 모드별 팀 레코드 s16 `+2` (XlsTEAM_DATA 행의 둘째 u16). 표에서는 전 팀이 100 이다.
 *
 * 스태미나 용량 `0x66e44(V, P, f)` 의 `V[+2]` 가 이 칸이다 — `V = 0x1f9a8(전역, 모드 = state[1], 팀+0x25)` 로 **그 투수 팀의**
 * 레코드를 찾으므로(0xaeb08, P1 3-2) 상대 팀 투수는 상대 팀 레코드의 사기를 쓴다. 모드 3·4(나리)는 `0x1f940`(전역+0xb8) 의
 * 팀 레코드다. 투수편 내 팀 사기(`pitcherGameOptions.teamMoraleOf`)도 같은 칸이다.
 *
 * **모드 3·4 의 팀 레코드 +2 를 바꾸는 곳 (확정, 2026-10 r87 직접 뜸)**: 나리 사기 쓰기 `0xa3a44(R, v)`(0..100 으로 잘라
 * a3a64 `strh [0x1f988(저장, R[1]), #2]`) 하나다. `0x1f988` 은 `[저장+0x40]`(3 → `0x1f940` · 4 → `0x1f8f8`)로 **내 팀 칸**을 고르고,
 * 사기 읽기 `0xa3a24` 도 같은 칸을 읽는다 — 곧 나리 **커리어 사기가 내 팀 레코드 +2 그 자체**다(경기 끝 평가 0xa719c 의 a7430 ·
 * a7436, 훈련 · 외출 · 이벤트 0x8c460 · 돌발 0x8e34c · GP 아이템이 이 둘로 바꾼다). 상대 팀 칸 +2 에 쓰는 곳은 없다
 * (`0x1f9a8` · `0x1f940` · `0x1f988` · `0x1f8f8` · `0x1f874` · `0x1f890` · `0x1f8a8` 의 모든 부르는 곳 뒤 `strh …,#2]` 를 훑었다 —
 * 나머지 하나 `0x8e404` 는 모드 2 갈래) → 등록 `0x204e0(저장, 3/4, 1)` 이 마스터(`0x1f8c0`)에서 복사한 표값 그대로다.
 * 그래서 웹은 나리 내 팀 = 커리어 사기(`GameProgress.ourTeamMorale` · `pitcherGameOptionsOf`), 상대 팀 = 표값이다.
 *
 * ⚠️ 원본 버그(미반영): 나리 국가대항전 중(R+0x12c ≠ 0)에는 `0x1f940` · `0x1f8f8` 이 팀 10 → 대표팀 칸 +0xbc4, **그 밖 팀 →
 * 상대국 칸 +0xbe0** 을 돌려준다(1f95e~1f97a). R[1] 은 대한민국(10)이 아니라 내 리그 팀이라 대회 동안 `0xa3a24` · `0xa3a44` 는
 * 상대국 칸 +2 를 읽고 쓴다 — 커리어 사기가 대회 동안 상대국 칸 값(대회 시작 0xb7bf0(b7ca4) · 하루 끝 0xb818c(b8216)마다 `0x20648` 이 마스터에서 새로 복사)으로 바뀌어
 * 보이고, 대회 중 바뀐 사기는 상대국 칸에 쌓인다. 웹은 대회 중에도 커리어 사기 하나로 둔다.
 */
const TEAM_MORALE_VALUE_INDEX = 1
export const DEFAULT_TEAM_MORALE = 100

export function teamRecordMoraleOf(teamId: number): number {
  return TEAMS[teamId]?.values[TEAM_MORALE_VALUE_INDEX] ?? DEFAULT_TEAM_MORALE
}
