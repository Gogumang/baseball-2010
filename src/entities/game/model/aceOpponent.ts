import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { ACE_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'

/**
 * 마선수 등판.
 *
 * 정규 경기에 마선수가 무작위로 나오는 코드는 원본에 없다 — 나리에서는 이벤트 `match` 명령만이
 * 마선수 대결을 연다 (`entities/story/model/aceMatch`). 등장 인물과 능력치는 원본 그대로다.
 *
 * **표의 차례 = 파일의 줄 차례다 (확정, S13 5-2).** 적재기 `0x20094` 가 `XlsACE_PIT_DATA.zt1`·
 * `XlsACE_BAT_DATA.zt1` 의 머리(33·32바이트)만 건너뛰고 **본문을 통째로 `memcpy`** 한다 —
 * 줄을 하나씩 읽어 자리를 고르는 코드가 없다. `0x1f824` 도 번호를 그대로 배열 첨자로 쓴다.
 * 그래서 투수 줄 차례 **0 싸이커 · 1 레오니 · 2 붕붕머신 · 3 발렌타인 · 4 드래고나** 가
 * 그대로 메모리 차례이고, 아래 `ACE_PITCHERS` 의 차례와 같다.
 * (앞서 "행 순서 = 메모리 순서" 로 적혀 있던 **가정이 확정으로 바뀌었다**.)
 */

export const ACE_PITCHERS: readonly AcePlayer[] = ACE_PLAYERS.filter(
  (ace) => ace.role === '투수',
)

export const ACE_BATTERS: readonly AcePlayer[] = ACE_PLAYERS.filter(
  (ace) => ace.role === '타자',
)

/**
 * 홈런더비 마투수 난입 표 (`0xcfce8` = `[1, 2, 3, 4]`, 읽는 곳 `0x48daa`) — **확정**.
 * 단계 `s`(1부터)에서 `0x1f824(전역, 표[s−1])` 레코드를 상대 투수에 0x30 바이트 통째로 덮어쓴다.
 * 단계 0 은 마투수가 없다(`0x48d9a` 가 `s <= 0` 이면 건너뛴다).
 *
 * → 단계 1~4 = **레오니 · 붕붕머신 · 발렌타인 · 드래고나** 이고, **싸이커(0번)는 안 나온다.**
 * (홈런더비 화면 자체는 아직 없다 — `shared/config/original/mainMenu.ts` 의 `isAvailable: false`.
 *  만들 때 이 표를 그대로 쓰면 된다.)
 */
export const DERBY_ACE_PITCHER_INDEXES: readonly number[] = [1, 2, 3, 4]

/** 홈런더비 단계(1부터)의 마투수. 단계 0 이나 표 밖이면 없다 */
export function derbyAcePitcherOf(stage: number): AcePlayer | null {
  if (stage <= 0) return null
  const index = DERBY_ACE_PITCHER_INDEXES[stage - 1]
  return index === undefined ? null : ACE_PITCHERS[index] ?? null
}

/*
 * ⚠️ **원본 버그 그대로** (S13 1-4, 옮길 곳이 생기면 그대로 옮길 것) —
 * 일반·대전모드에서 AI 쪽 마선수를 뽑는 `0x66968`(마투수)·`0x66994`(마타자)는 글자 하나까지 같다:
 * ```
 * v = bfa54(0, 5)                     ; 0~4 균등
 * if v == 내_id: v = (v != 0) ? v − 1 : 4
 * return v
 * ```
 * 인자를 `ldrb`(부호 없음)로 받아 **사람이 "없음"(−1 = 0xff)을 골라도 `v == 0xff` 가 성립하지 않는다**
 * → 사람이 마선수를 안 써도 **AI 는 늘 마투수·마타자를 하나씩 얻는다**.
 * (사람 쪽은 `0xb88c8` 안의 `0xb521c` 가 −1 이면 건너뛴다 — `0xb88ec: adds r0,#1 ; beq`.)
 *
 * 웹판에는 아직 **일반모드·대전모드가 없어** 이 경로를 둘 곳이 없다 — 사실만 적어 둔다.
 */

/**
 * 미션 레코드의 상대 마선수 순번(1부터, 0 은 일반 선수)을 마선수로 바꾼다.
 * 순번은 원본 마선수 표 순서와 같다 — 타자 미션 4번(레오니 이름)이 2, 투수 미션 12번(킹타이거)이 5.
 */
export function missionOpponentOf(opponentRole: AcePlayer['role'], order: number): AcePlayer | null {
  const candidates = opponentRole === '투수' ? ACE_PITCHERS : ACE_BATTERS
  return candidates[order - 1] ?? null
}

/**
 * 마선수의 투수 능력치.
 * 원본 표는 타자와 같은 4칸을 쓰는데, 투수는 그 값이 제구·구속·변화·체력을 뜻한다 (0xb570c, 누락 탐색 5차).
 * 타자 필드 이름으로 읽었으므로 hit = 제구, power = 구속이다.
 */
const PITCHER_ENGINE_DIVISOR = 10

export function pitcherAbilityOf(ace: AcePlayer): PitcherAbility {
  // 투구 엔진은 아직 0~100 눈금이라 경계에서 줄인다 — 원본 투구식 이식 때 없앤다
  // 폼·보유 구질은 같은 표(XlsACE_PIT_DATA)의 +0xb · +0x1c 에서 온다 — 마구(+0x18)는 아직 쓰지 않는다
  const repertoire = ACE_PITCHER_REPERTOIRES.find((candidate) => candidate.name === ace.name)
  return {
    control: Math.round(ace.ability.hit / PITCHER_ENGINE_DIVISOR),
    velocity: Math.round(ace.ability.power / PITCHER_ENGINE_DIVISOR),
    breaking: Math.round(ace.ability.defense / PITCHER_ENGINE_DIVISOR),
    ...(repertoire === undefined ? {} : { repertoire: { form: repertoire.form, pitchMask: repertoire.pitchMask, magicId: repertoire.magicId } }),
  }
}
