import {
  PASSED_BALL_PLAY_KIND,
  type PassedBallStrikeout,
  passedBallShot,
  passedBallStrikeoutOf,
  rollPassedBall,
} from '@/entities/fielding/model/passedBall'
import { pitchPlayKindOf } from '@/entities/fielding/model/stealStart'
import {
  type PassedBallPlayInput,
  passedBallCallSoundIdOf,
  passedBallPlayEngineInputOf,
  passedBallPlayResultOf,
} from '@/features/defense-play/model/passedBallPlay'
import { stealRecordIdsOf } from '@/features/defense-play/model/pitchArrival/arrivalRecords'
import type { OpenedPitchArrivalPlay, PitchArrivalPlay, PitchArrivalPlayInput } from '@/features/defense-play/model/pitchArrival/pitchArrivalTypes'
import { PITCH_JUDGEMENT } from '@/features/defense-play/model/pitchArrival/pitchJudgement'
import { type RunnerPlayEngineResult, runRunnerPlay } from '@/features/defense-play/model/runnerPlayEngine'
import { type StealPlayInput, stealCallSoundIdOf, stealPlayEngineInputOf, stealPlayResultOf } from '@/features/defense-play/model/stealPlay'
import { runWalkPlay } from '@/features/defense-play/model/walkPlay'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 공 도착 한 번. **난수 차례**: `rollPassedBall` 1번(모드 7 제외) → 종류 9 면 `passedBallShot` 2번 → 판 안의 굴림
 * (펌블 · 악송구 · 특수 송구) / 종류 5 면 판 안의 굴림(도루 주자마다 리드 rand(0,9) · 악송구 · 특수 송구) /
 * 종류 2(볼넷 · 사구)는 굴림 없음. 판이 안 열리면 null.
 */
export function runPitchArrivalPlay(input: PitchArrivalPlayInput, random: RandomPort): PitchArrivalPlay | null {
  const opened = openPitchArrivalPlay(input, random)
  return opened === null ? null : runOpenedPitchArrivalPlay(opened)
}

/** 공 도착 판을 판 시작까지 연다 — 판이 안 열리면 null (굴림: `runPitchArrivalPlay` 의 앞부분) */
export function openPitchArrivalPlay(arrival: PitchArrivalPlayInput, random: RandomPort): OpenedPitchArrivalPlay | null {
  // 도루 키 0x583 의 0xafa60 은 여기서 안 돈다 — 출발한 그 자리(`stealStartSceneOf`)에서 굴려 `scene` 에 이미 들어 있다(r214)
  const input = arrival
  const passedBall = rollPassedBall(input.gameMode, random)
  const kind = pitchPlayKindOf({
    passedBall,
    pitchJudgement: input.pitchJudgement,
    stealing: input.stealingFrom.length > 0,
    outs: input.outs,
  })
  // 0x3e1cc — 볼넷·사구면 판정 칸 스위치가 종류를 2(밀어내기)로 덮어쓴다 — 0x3e062 의 종류 9 는 v ≠ 3·4 일 때만이라
  // 여기 오는 것은 종류 없음 · 종류 5(도루) 둘뿐이고, 어느 쪽이든 밀어내기 판이 열린다
  if (input.pitchJudgement === PITCH_JUDGEMENT.WALK || input.pitchJudgement === PITCH_JUDGEMENT.HIT_BY_PITCH) {
    return {
      kind: 2,
      walkInput: {
        bases: input.bases,
        outs: input.outs,
        pitchJudgement: input.pitchJudgement,
        batterHand: input.batterHand,
        stealingFrom: input.stealingFrom,
        defenseAbilities: input.defenseAbilities,
        defenseTeamBonus: input.defenseTeamBonus,
        runAbilities: input.runAbilities,
        runAbility: input.runAbility,
        runnerTeamGrade: input.runnerTeamGrade,
        aceIndexes: input.aceIndexes,
        defenseTeamIndex: input.defenseTeamIndex,
        fielderRecords: input.fielderRecords,
        offenseTeamIndex: input.offenseTeamIndex,
        fielderPlates: input.fielderPlates,
        runnerAces: input.runnerAces,
        scene: input.scene,
        sceneResultCode: input.sceneResultCode,
      },
    }
  }
  if (kind === null) return null
  const strikeout =
    kind === PASSED_BALL_PLAY_KIND
      ? passedBallStrikeoutOf({
          pitchJudgement: input.pitchJudgement,
          firstBaseOccupied: input.bases.first,
          outs: input.outs,
        })
      : 'none'
  const common = {
    bases: input.bases,
    outs: playOutsOf(input.outs, input.pitchJudgement, strikeout),
    defenseAbilities: input.defenseAbilities,
    defenseTeamBonus: input.defenseTeamBonus,
    runAbility: input.runAbility,
    runnerTeamGrade: input.runnerTeamGrade,
    random,
    defenseIsCpu: input.defenseIsCpu,
    throwMode: input.throwMode,
    offenseIsCpu: input.offenseIsCpu,
    runningMode: input.runningMode,
    aceIndexes: input.aceIndexes,
    defenseTeamIndex: input.defenseTeamIndex,
    fielderRecords: input.fielderRecords,
    offenseTeamIndex: input.offenseTeamIndex,
    fielderPlates: input.fielderPlates,
    fielderSkillIds: input.fielderSkillIds,
    runnerAces: input.runnerAces,
    scene: input.scene,
    sceneResultCode: input.sceneResultCode,
  }
  if (kind === PASSED_BALL_PLAY_KIND) {
    const shot = passedBallShot(random)
    const playInput: PassedBallPlayInput = {
      ...common,
      shot,
      batterRuns: strikeout === 'batterRuns',
      batterHand: input.batterHand,
      runAbilities: input.runAbilities,
      // 0x3d7b8 — 도루 주자 리드(rand(0,9)) · 도루 안 한 주자의 번트 +3 틱
      stealingFrom: input.stealingFrom,
      buntKind: input.buntKind,
    }
    return { kind: 9, strikeout, playInput, engineInput: passedBallPlayEngineInputOf(playInput) }
  }
  const runAbilities = input.runAbilities
  const playInput: StealPlayInput = {
    ...common,
    stealingFrom: input.stealingFrom,
    // 0x3d7b8 — 도루 안 한 주자의 리드 +3 틱(번트 종류가 서 있으면)
    buntKind: input.buntKind,
    runAbilities: runAbilities === undefined ? undefined : { 1: runAbilities[1], 2: runAbilities[2], 3: runAbilities[3] },
  }
  // 리드 굴림(도루 주자마다 rand(0,9))은 판 시작 — 진행기 입력을 세울 때 돈다
  return { kind: 5, strikeout: 'none', playInput, engineInput: stealPlayEngineInputOf(playInput) }
}

/** 다 돈 진행기 결과로 공 도착 판을 마무리한다 — 판정 콜 · 판 기록 후보 */
export function finishPitchArrivalPlay(
  opened: Exclude<OpenedPitchArrivalPlay, { readonly kind: 2 }>,
  engineResult: RunnerPlayEngineResult,
  shownLive = false,
): PitchArrivalPlay {
  const live = shownLive ? { shownLive: true } : {}
  if (opened.kind === 9) {
    const result = passedBallPlayResultOf(opened.playInput, engineResult)
    return { kind: 9, result, strikeout: opened.strikeout, callSoundId: passedBallCallSoundIdOf(result), recordIds: [], ...live }
  }
  const result = stealPlayResultOf(opened.playInput, engineResult)
  return {
    kind: 5,
    result,
    strikeout: 'none',
    callSoundId: stealCallSoundIdOf(result),
    recordIds: stealRecordIdsOf(result),
    ...live,
  }
}

/** 열어 둔 판을 미리 끝까지 돌려 마무리한다(키 없음 — 재생만 할 판) */
export function runOpenedPitchArrivalPlay(opened: OpenedPitchArrivalPlay): PitchArrivalPlay {
  if (opened.kind === 2) {
    return { kind: 2, result: runWalkPlay(opened.walkInput), strikeout: 'none', callSoundId: null, recordIds: [] }
  }
  return finishPitchArrivalPlay(opened, runRunnerPlay(opened.engineInput))
}

/**
 * 판을 여는 아웃 수 — 0x3e15e 가 삼진(v == 5)이면 판 앞에서 state[6]++ 한다. 도루 판(5)은 1아웃 이하 삼진만 열리고,
 * 폭투 판(9)은 삼진이 선 판(`'strikeoutStands'`)만 아웃이 붙는다(낫아웃은 0x3e0aa 가 판정 칸을 0 으로 지워 스위치를 건너뛴다).
 */
function playOutsOf(outs: number, pitchJudgement: number, strikeout: PassedBallStrikeout | 'none'): number {
  if (pitchJudgement !== PITCH_JUDGEMENT.STRIKEOUT) return outs
  return strikeout === 'batterRuns' ? outs : outs + 1
}
