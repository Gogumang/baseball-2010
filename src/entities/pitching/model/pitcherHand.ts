/**
 * **투수의 손** — 손 게터 `0xb63c0(rec)` 의 투수 갈래 (디스어셈 b63c0~b640e, 확정). 0 = 우투 · 1 = 좌투.
 * 타석 판정 0xab214 가 타자 스킬 13 좌완UP(0xab9f0, 참이면 B +2%)·14 우완UP(0xaba1e, 거짓이면 B +2%)에 쓴다.
 *
 * ```
 * b63c2  f = rec[0xb] >> 4                      ; 폼 니블 (= Pitch.pitcherForm · 레퍼토리 form)
 * b63c8  0xb6278(rec) 참(투수):
 * b63d4    0xb63a0(rec) == −1 (마선수 아님 — rec[0xa] 비트6 이 0) → f & 1
 * b63dc    마투수: f ∈ {7, 9, 10} → 0 , 그 밖 → 1
 * b63ea  타자: 0xb63a0(rec) 가 0~4(마타자 순번)면 표 0xd88b0 → [1, 0, 0, 0, 1], 아니면 f & 1
 * ```
 * 곧 마투수 다섯(폼 6·7·8·9·10)은 싸이커 1 · 레오니 0 · 붕붕머신 1 · 발렌타인 0 · 드래고나 0 이다 —
 * 폼의 낮은 비트와 다르다.
 */

/** 마투수 중 손이 0 인 폼 (b63dc~b63e6) */
const ACE_RIGHT_FORMS: readonly number[] = [7, 9, 10]

/** 마선수 레코드 +0x18 의 시작 번호 — 마선수 5~9, 육성·명전 마구 1~4, 일반 선수 0 (H2 4-1·4-2) */
const ACE_MAGIC_NUMBER_FROM = 5

/** 투수 손 0xb63c0 — `isAce` 는 레코드 +0xa 비트6(0xb63a0 ≠ −1) */
export function pitcherHandOf(form: number, isAce: boolean): number {
  if (!isAce) return form & 1
  return ACE_RIGHT_FORMS.includes(form) ? 0 : 1
}

/**
 * 던진 공에 실린 투수 칸(폼 `rec[0xb]>>4` · 레코드 +0x18)으로 손을 낸다.
 * 마투수인가(비트6)는 공에 없어 +0x18 이 5~9 인가로 본다 — 원본 레코드에서 +0x18 이 5~9 인 것은
 * 마선수뿐이다(마투수 표 XlsACE_PIT_DATA 의 +0x18 = 5 + 순번).
 */
export function pitcherHandOfPitch(pitch: {
  readonly pitcherForm?: number
  readonly pitcherMagicNumber?: number
}): number {
  return pitcherHandOf(pitch.pitcherForm ?? 0, (pitch.pitcherMagicNumber ?? 0) >= ACE_MAGIC_NUMBER_FROM)
}
