import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { ACE_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import type { RandomPort } from '@/shared/api/random/randomPort'

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

/** 마투수 5 · 마타자 5 — `0x1f824`·`0x1f84c` 가 번호를 `[0,4]` 로 자른다 (`1f826~1f832`) */
export const ACE_PER_ROLE = 5

/**
 * **AI 팀이 쓸 마선수 번호** — `0x66968`(마투수) · `0x66994`(마타자). 두 함수는 **글자 하나까지 같다**
 * (`66968~6698e` 와 `66994~669ba` 가 바이트 단위로 동일, 리터럴도 둘 다 `0xbfa55`):
 * ```
 * f(내_번호):
 *   v = bfa54(0, 5)                   ; 6696e~66978  0~4 균등 (rand 는 위끝 제외)
 *   if v == 내_번호:                   ; 6697c       인자는 ldrb 로 들어온다
 *       v = (v != 0) ? v − 1 : 4      ; 66980~66988
 *   return v
 * ```
 * 일반모드 경기 세우기 `0x30f20` 이 준비 기록으로 이렇게 부른다:
 * ```
 * 31042: 0xb88c8(사람팀, 기록+0xe)          ; 마투수 — team[+0x26]·[+0x33] +1
 * 3104c: 0xb8870(사람팀, 기록+0xd)          ; 마타자 — team[+0x27]·[+0x28c] +1
 * 31058: v = 0x66968(기록+0xe)   ← 굴림 1
 * 31064: 0xb88c8(AI팀, v)
 * 3106c: w = 0x66994(기록+0xd)   ← 굴림 2
 * 31076: 0xb8870(AI팀, w)
 * 3107a: 0xb8c94(AI팀, 0, rand(0,4))    ← 굴림 3 (AI 선발)
 * 31090: 0xb8c94(사람팀, 0, rand(0,4))  ← 굴림 4 (사람 선발)
 * ```
 * ⚠️ **원본 버그 그대로** (S13 1-4): 인자를 `ldrb`(부호 없음)로 받아 **사람이 "없음"(−1 = 0xff)을
 * 골라도 `v == 0xff` 가 성립하지 않는다** → 사람이 마선수를 안 써도 **AI 는 늘 마투수·마타자를
 * 하나씩 얻는다**. 고치지 말 것.
 */
export function rollOpponentAceIndex(playerAceIndex: number, random: RandomPort): number {
  const value = Math.trunc(random.nextInRange(0, ACE_PER_ROLE))
  // 원본은 사람이 고른 번호를 ldrb 로 읽는다 — −1(없음)은 0xff 가 되어 절대 같아지지 않는다
  if (value !== (playerAceIndex & 0xff)) return value
  return value !== 0 ? value - 1 : ACE_PER_ROLE - 1
}

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
