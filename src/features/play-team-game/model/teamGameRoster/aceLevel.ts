import { recordAbilityOf } from '@/entities/team/model/recordAbility'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { aceLevelOf, aceLevelSlotOf, applyAceLevelRate } from '@/entities/mission/model/aceLevel'

/**
 * **마선수 레벨 배율** — 실효 능력치 0xb6414 의 첫 단계 (0xb570c 가 맨 앞 b5720 에서 부른다):
 * ```
 * b6426  v = s16 rec[+0xc + 2·칸]
 * b6438  i = 0xb63a0(rec)              ; 마선수(+0xa 비트 6)면 +0xa & 0x1f = 순번, 아니면 −1
 * b6442  if !0xb6278(rec): i += 5      ; 타자면 +5
 * b6458  lv = s8 mgr[0x13a + i]
 * b645e  v = v · s8 0xd88aa[lv] / 100  ; 0 쪽 버림, 자르지 않는다. 0xd88aa = [60,70,80,90,100]
 * ```
 * 모드·플래그·칸을 가리지 않으니 팀 경기(모드 1·2·8·9)의 마선수도 이 배율 **뒤에** 시즌·팀 보정을 먹는다.
 * 배율 뒤에는 같은 0xb6415(rec, k, 1) 의 장비 니블(b6494 — 마선수 열 줄 모두 0) · 장착 스킬(b64b0~b6512, 레코드 +0x14 = XlsACE 행
 * 비트) 단계를 그대로 지난다 — 발렌타인 냉정 22 가 제구에 1/10 을 얹는다(`aceRecordAbilityAtLevel` 와 같은 단계).
 * 마선수가 아니면(순번 −1) 그대로다(붙박이 줄의 `ability` 는 이미 0xb6414 값).
 */
export function aceLeveledAbility(
  ability: readonly [number, number, number, number],
  role: '타자' | '투수',
  aceIndex: number,
  levels: Readonly<Record<number, number>> | undefined,
): readonly [number, number, number, number] {
  if (aceIndex < 0) return ability
  const level = aceLevelOf(levels, aceLevelSlotOf(role, aceIndex + 1))
  const scaled: [number, number, number, number] = [
    applyAceLevelRate(ability[0], level),
    applyAceLevelRate(ability[1], level),
    applyAceLevelRate(ability[2], level),
    applyAceLevelRate(ability[3], level),
  ]
  const ace = (role === '투수' ? ACE_PITCHERS : ACE_BATTERS)[aceIndex]
  if (ace === undefined) return scaled
  return recordAbilityOf({ ability: scaled, skillBits: ace.skillBits, equipment: [] }, role === '투수')
}
