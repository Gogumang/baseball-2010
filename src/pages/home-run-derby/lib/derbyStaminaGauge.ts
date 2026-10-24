import type { DerbyPitcher } from '@/entities/home-run-derby/model/derbyPitcher'
import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { staminaGaugeOf } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { StaminaGauge } from '@/widgets/matchup-cards/lib/matchupCardsLayout'

/** `0xaebb0` 의 모드 7 갈래(aebbc~aebc0) — 홈런더비 투수 체력%는 늘 100 */
const DERBY_STAMINA_PERCENT = 100

/**
 * **홈런더비 소개 판(0x44944)의 투수 체력 막대** — 길이 `0x66e44(V, P, f)` · % `0xaebb0`.
 *
 * - V = `0xb8680(수비 팀)` — 모드 7 은 점프표 0xd8a30[6] = 0xb8728 → `0x1f8c1(앱, 팀+0x25)` 마스터 팀 레코드. 수비 팀 1 은
 *   3a520 `0xb891c(장면[0x22c], 7, v, −1)` 라 팀+0x25 = v → 사기 `V+2` = XlsTEAM_DATA 표값(`teamRecordMoraleOf(v)`).
 * - P = 지금 투수 — 단계 0 마스터 줄 2, 단계 ≥ 1 은 0x48d50 이 통째 복사한 마투수 레코드. 체력 `0xb6415(P, 3, 1)`.
 * - f = 팀[+0x26] − [+0x33] == 1 — **더비에서는 늘 참이다** (R9 19-6, 직접 뜸):
 *   0xb891c(b896c~b8992)가 +0x33 = 투수 수 − 1 · +0x26 = +0x33 + 1 로 세우고, +0x33 을 줄이는 곳은 교체 예약을 먹는
 *   0xaebe4 의 aec22~aec32 뿐인데 그 예약 0xaf09c 를 부르는 셋 중
 *   (1) 0xac428 은 더비에서 늘 0 을 돌린다 — 0xaebb0 = 100 이라 체력 문턱(0x13 · 0x1d · 0x27 · 0x31)이 하나도 안 서고,
 *       득점 칸 팀+0x280 · +0x284(0xa61b8 종류 1 · 0, 득점 처리 0xa5c34 만 +1)은 더비 판에 주자가 없어(0x46418 · 0xae24c 모드 7
 *       갈래가 밀어내기 0x17 앞에 0xd / 0x1a) 메시지 0x13 이 안 나 0 이고, 이닝 state[0x6b] 는 0(0xb67c0)이라
 *       보직 갈래(ac50e~ac5c4) 어디서도 예약 표시 [sp+8] 이 서지 않는다,
 *   (2) 사람 교체 메뉴 0x49598 은 공격 팀이 사람이면 대타 0xaf06c 쪽이고(더비는 사람이 공격),
 *   (3) 간이 엔진 0xc1ba4 는 더비에 안 돈다. 난입 0x48d50 도 두 칸을 안 건드린다(48dc2~48dca).
 *   → 첫 투수 +200 · 최대 0x5a9.
 * - % = 100 → 막대는 늘 용량만큼 가득이다.
 * 상대 팀 v 를 모르면(예전 시험 길) 막대를 비운다.
 */
export function derbyStaminaGaugeOf(
  pitcher: Pick<DerbyPitcher, 'staminaAbility'>,
  opponentTeamId: number | undefined,
): StaminaGauge | undefined {
  if (pitcher.staminaAbility === undefined || opponentTeamId === undefined) return undefined
  return staminaGaugeOf({
    staminaAbility: pitcher.staminaAbility,
    teamMorale: teamRecordMoraleOf(opponentTeamId),
    isFirstPitcher: true,
    stamina: 0,
    percent: DERBY_STAMINA_PERCENT,
  })
}
