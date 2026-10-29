/** CPU 투구 굴림(`selectPitch`)에 넘기는 그 틱의 재료 — 볼카운트 · 주자 · 마구 · 투수 */
import { DEFAULT_REPERTOIRE } from '@/entities/pitching/model/selectPitch'
import type { CpuPitchArgs } from '@/entities/pitching/model/selectPitch'
import { aceOrderOfMagicNumber, createMagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import type { MagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import { aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import type { PitcherRepertoireInfo } from '@/entities/pitching/model/pitch'
import { DERBY_ORDINARY_PITCH_TYPE } from '@/entities/home-run-derby/model/derbyRules'
import { pitchSituationOf } from '@/widgets/batting-stage/lib/stageText'
import type { StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'

/** 홈런더비 = 원본 전역 모드 7 */
const HOME_RUN_DERBY_GAME_MODE = 7
/** 타자 스킬 22 압도 (skills.json 22) — 상대 투수 실투율 +5 */
const INTIMIDATE_SKILL_ID = 22

/**
 * 마구 상태 — 원본이 **팀 +0x28**(남은 횟수)과 **공 +0x10**(이번 공에 실린 번호)을
 * 제자리에서 고치듯, 경기 하나 동안 같은 객체를 계속 넘긴다.
 * 안 넘기면 남은 횟수가 늘 0 이라 마구가 아예 안 나가고, 매 투구 새로 만들면
 * 마구 조건(0x344dc)이 볼카운트 48칸 중 36칸에서 참이라 **투구마다 마구**가 된다.
 *
 * 마운드에 선 투수가 바뀌면 새로 만든다 — 남은 횟수는 원본도 그렇다: 교체 가지가 팀+0x28 을 −1 로
 *    비우고(0xaebe4 aec7a) 같은 함수 끝이 새 투수로 채운다. ⚠️ 다만 공+0x10 은 경기에 하나라 원본은
 *    이어지는데 여기서는 0 으로 돌아가고, 화면이 내려가면(반 이닝) 둘 다 잃는다 — 그래서 경기를 드는 진행기는
 *    `cpuMagic` 으로 넘긴다(팀 경기 · 나리 타자편 · 타자 미션 — 0xaebe4 aeea8 은 +0x28 이 음수일 때만 채운다).
 *    안 넘기는 화면(투수편 · 홈런더비 · 결과 배경)만 이 자리 상태를 쓴다.
 */
function magicStateOf(loop: StageLoop, repertoire: PitcherRepertoireInfo | undefined): MagicPitchGameState {
  const { latestRef } = loop.refs
  // 부르는 쪽이 팀+0x28·공+0x10 을 들면 그 사본 — 고친 값은 버리고 부르는 쪽이 같은 차례로 다시 고친다
  const held = latestRef.current.cpuMagic
  if (held !== undefined) return { remaining: held.remaining, ballMagicNumber: held.ballMagicNumber }
  const info = repertoire ?? DEFAULT_REPERTOIRE
  if (loop.magic === null || loop.magic.magicId !== info.magicId) {
    // 0xaebe4: 마투수(0xb633d)면 횟수 = 0xd8509[mgr[0x13a + 순번(0xb63a1)]] — 레벨은 상태를 세울 때 한 번 읽는다
    const order = aceOrderOfMagicNumber(info.magicId)
    const aceLevel = order < 0 ? 0 : aceLevelOf(latestRef.current.aceLevels, aceLevelSlotOf('투수', order + 1))
    loop.magic = { magicId: info.magicId, state: createMagicPitchGameState(info, { aceLevel }) }
  }
  return loop.magic.state
}

/** 1 · 2 · 3 루에 주자가 있는가 — 주자 루는 HUD 루 그대로 (원본 0xa9878 자리) */
function hasRunnerOnBaseOf(bases: { readonly first: boolean; readonly second: boolean; readonly third: boolean }): (base: number) => boolean {
  const occupied: Readonly<Record<number, boolean>> = { 1: bases.first, 2: bases.second, 3: bases.third }
  return (base) => occupied[base] ?? false
}

/** 그 틱에 원본이 읽는 재료 — 볼카운트 · 주자 · 마구 · 투수 (`selectPitch` 와 같은 인자) */
export function cpuPitchArgsNow(loop: StageLoop): CpuPitchArgs {
  const latest = loop.refs.latestRef.current
  const { pitcherAbility, hud, onPickoff } = latest
  const bases = hud?.bases ?? { first: false, second: false, third: false }
  return {
    pitcher: pitcherAbility,
    situation: pitchSituationOf(hud, latest.batterForm, latest.batterHand),
    difficulty: 'hard',
    magic: magicStateOf(loop, pitcherAbility.repertoire),
    // 견제를 받아 줄 쪽이 있을 때만 켠다
    cpuPickoff: onPickoff === undefined ? undefined : { hasRunnerOnBase: hasRunnerOnBaseOf(bases) },
    // 실투 판정 0x33cbc 의 타자 비트 22 압도 — 0xb62b4 는 **장착** 비트라 장착 스킬 번호로 본다
    batterIntimidates: latest.batterSkillIds.includes(INTIMIDATE_SKILL_ID),
    // 홈런더비(모드 7)는 0x344ea 가 구질을 굴리지 않고(마투수가 나왔으면 22, 아니면 1),
    // 0x345fc 가 종류·목표점을 굴리지 않고 존 한가운데를 노리며(0x3460e) 마구 소모(0x34894)도 건너뛴다
    derbyPitchType: latest.gameMode === HOME_RUN_DERBY_GAME_MODE ? (latest.derbyPitchType ?? DERBY_ORDINARY_PITCH_TYPE) : undefined,
  }
}
