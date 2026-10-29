import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import type { PitchPatternDifficulty } from '@/shared/config/original/pitchPatterns'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import { releaseCpuPitch } from '@/entities/pitching/model/selectPitch/release'
import { CPU_PITCH_TYPE_TICKS, cpuPitchAimOf, cpuPitchTypeTickOf } from '@/entities/pitching/model/selectPitch/tickRolls'
import type { CpuPickoffInput, CpuPitchArgs, CpuPitchChoice, PitchSituation } from '@/entities/pitching/model/selectPitch/types'

/**
 * CPU 투구 — 원본 순서 그대로 난수를 뽑는다:
 *   구질(0x344dc, 상태 0xf 틱 0~8 에 **9번** — `CPU_PITCH_TYPE_TICKS`) → 목표 종류(0x9eeac) → 목표점(0x345fc) → 제구 등급(0xb74bc, 마구면 굴림 없이 5 — 0x4dbac)
 *   → 표시 구속(0x34968, rand 한 번 — `displaySpeed`) → 제구 오차(0x4dc78, 홈런더비면 4dcce 에서 건너뜀)
 *   → 실투 판정(0x33cbc, 0x4dea0 — 마구가 아니면 rand(0,100) 한 번) → 곡선(0x9e3c9, 실투면 한가운데 · N 18/20)
 * 목표 종류가 4(견제)이고 주자가 1·2명이면(`isCpuPickoff`, 0x34684) 목표점을 만들지 않고 0x34848 이
 * **견제 루**를 굴린 뒤 끝난다 — 목표점·제구 등급·제구 오차·곡선 굴림이 **없다** (`{ kind: '견제' }`).
 *   0x51214 bl 0x344dc(구질) → 0x5121e bl 0x345fc(→ 0x9eeac 종류 → 종류 4 면 0x34848 루프 → 메시지 0x10 → 0x348d6 끝)
 * 셋은 서로 다른 메시지·틱이다 (CPU 조작 0x53874, 조작은 매 틱 상태 틱 처리보다 **먼저** 돈다):
 *   상태 0xf  틱 0~8  0x53850 → 0x644 → 0x51212 → 0x344dc            구질 (9번, 마지막 값)
 *   상태 0x10 틱 6    0x53824(틱 > 5) → 0x645 → 0x5121c → 0x345fc   종류·목표점 또는 견제 — 한 번뿐: 0x345fc 가
 *                     0x11(0x34888) 이나 견제 0x17(메시지 0x10 → 0x50f68)을 예약해 다음 틱엔 0x10 이 아니다
 *   상태 0x11 틱 10   0x4e060 의 0x4e078(틱 > 9, 한 번 표 +0x1980) → 0x4dc78   제구 등급·오차·곡선·실투
 * 등급을 목표점 뒤에 뽑는 순서와, 구속 단계(등급이 필요)를 곡선 직전에 정하는 것은 호출 흐름에서 추정했다.
 *
 * 마구(구질 22)는 투수 레코드 **+0x18(= `repertoire.magicId`)** 이 0 이 아니면 구질 칸 5 에 들어간다
 * (0xb6d6a). 남은 횟수는 `magicPitchGame` 이 들고 있다 — 일반 선수 레코드는 +0x18 이 모두 0 이라
 * (H2 4-2) 마구를 던지는 것은 마투수와 육성·명전 투수뿐이다.
 */
export function selectPitch(
  pitcher: PitcherAbility,
  situation: PitchSituation,
  random: RandomPort,
  /**
   * 원본은 늘 `pitchpattern_hard` 를 쓴다 — 옵션 `+0x2c` 가 난이도이고 **기본값 2 = hard** 이며
   * 뒤로 바꾸는 코드가 없다 (L 4-A · P7 K2 확정 · DECISIONS 2026-09-20 ②).
   */
  difficulty: PitchPatternDifficulty = 'hard',
  /**
   * 경기 내내 이어지는 마구 상태 (남은 횟수 · 공+0x10). 원본이 팀+0x28 과 공 객체를 고치듯
   * **제자리에서 고친다** — 경기마다 `createMagicPitchGameState(레퍼토리)` 로 하나 만들어
   * 투구마다 같은 객체를 넘겨야 한다.
   *
   * ⚠️ **안 넘기면 마구가 나오지 않는다** (남은 횟수 0). 마구 조건(0x344dc)이 볼카운트 48칸 중
   * 36칸(75%)에서 참이라, 남은 횟수를 줄이는 이 객체가 없으면 마구가 경기 내내 계속 나가
   * 원본(한 경기 4~9회)과 크게 어긋난다 — 그래서 기본값은 "꺼짐" 이다.
   * 타석 화면 호출처는 `widgets/batting-stage/model/useStageAnimation.ts` 다.
   */
  magic?: MagicPitchGameState,
  /**
   * CPU 견제를 켠다 (0x34848). 원본은 홈런더비(모드 7, 0x3460e 에서 0x345fc 를 일찍 끝낸다) 말고는
   * 모드를 가리지 않고 견제한다.
   *
   * ⚠️ **안 넘기면 견제가 꺼진다** — 종류 4 가 종류 1(모서리 투구)로 내려앉아 원본이 굴리지 않는
   *    목표점·제구·곡선 난수를 굴리고 원본이 던지지 않는 공을 던진다. 지금 타석 화면을 쓰는 팀 경기·
   *    나만의리그 타자편(`GameRoute`)·미션(`MissionRoutes`)은 모두 `onPickoff` 로 이것을 켠다.
   *    안 켜는 곳은 홈런더비뿐인데, 원본 모드 7 은 0x3460e 에서 종류를 굴리지 않고 존 한가운데(표 0xcfbcc)를
   *    목표로 끝나므로 견제와 상관없다 — 그 갈래는 `derbyPitchType` 이 따른다.
   */
  cpuPickoff?: CpuPickoffInput,
  /**
   * 타석의 (사람) 타자가 스킬 22 압도를 **장착**했는가 (0xb62b4(타자, 22)) — 실투율 +5 (0x33d52).
   * 안 넘기면 거짓.
   */
  batterIntimidates = false,
  /**
   * **홈런더비(원본 모드 7)** 면 그 판의 구질 번호 (`derbyPitcherOf(…).pitchType`), 아니면 undefined.
   * 넘기면 원본 모드 7 갈래를 그대로 탄다:
   * - 0x344ea: 구질 = `state+0x38`(등장한 마투수 수) > 0 ? 22 : 1 — **굴림 없이** 이 값 (0x344fc~0x34504 → 끝)
   * - 0x3460e: 목표 종류(0x9eeac)·목표점 굴림 없이 존 한가운데(`derbyPitchTargetOf`). 견제도 없다
   * - 0x34644 → 0x348d6: 마구 소모 0x34894 를 안 지난다 (`advanceMagicPitchGameState` 의 `isHomeRunDerby`)
   */
  derbyPitchType?: number,
): CpuPitchChoice {
  const args: CpuPitchArgs = { pitcher, situation, difficulty, magic, cpuPickoff, batterIntimidates, derbyPitchType }
  // 상태 0xf 틱 0~8 — 0x644 마다 0x344dc 를 다시 부른다. 마지막 값이 +0xfc8 에 남는다 (`CPU_PITCH_TYPE_TICKS`)
  let typeNumber = derbyPitchType ?? 0
  for (let tick = 0; tick < CPU_PITCH_TYPE_TICKS; tick += 1) typeNumber = cpuPitchTypeTickOf(args, random)
  // 상태 0x10 틱 6 — 0x345fc
  const aim = cpuPitchAimOf(args, random)
  if (aim.kind === '견제') return aim
  // 상태 0x11 틱 10 — 0x4dc78
  return releaseCpuPitch(args, typeNumber, aim.target, random)
}
