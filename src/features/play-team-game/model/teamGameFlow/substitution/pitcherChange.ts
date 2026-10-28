import type { TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster'
import { magicPitchCountOf } from '@/entities/pitcher-career/model/magicPitch'
import { aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import { decisionsAfterPitcherChange } from '@/features/play-game/model/gameDecisions'
import { freezeRunnerPitchers } from '@/entities/game/model/runnerPitchers'
import { runnersOfGame } from '@/entities/game/model/gameState'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { EMPTY_MOUND_COUNTERS } from '@/entities/pitching/model/pitcherChange'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { enterSceneConfirmFromSubstitutionWindow } from '@/features/play-game/model/sceneConfirm'
import { appendLog } from '@/features/play-team-game/model/teamGameFlow/log/appendLog'
import { pitcherEntryAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import { SPIRIT_SKILL_BIT } from '@/features/play-team-game/model/teamGameFlow/roster/specialSwing'
import { enterConfirmWait, substitutionSceneAfter } from '@/features/play-team-game/model/teamGameFlow/scene/sceneConfirm'
import { isHumanTurn, isPitchTurn } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow/types/options'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 벤치에 남은 투수 칸 (`team+0x33`) — 이미 던진 투수와 지금 투수는 빠진다.
 *
 * 칸 수는 **투수 명단 길이**다. 원본도 `team+0x33 = 명부[0xc] − 1` 로 명부 길이에서 셈하므로
 * (0xb896c), 마투수가 들어와 명부가 8 → 9 로 늘면 벤치 투수도 7 → 8 로 는다.
 */
export function benchIndexesOf(current: number, used: readonly number[], entryLength: number): readonly number[] {
  const out: number[] = []
  for (let index = 0; index < entryLength; index += 1) {
    if (index === current || used.includes(index)) continue
    out.push(index)
  }
  return out
}

/**
 * 마운드에 오른 투수의 **한 경기 마구 횟수** — 팀+0x28 을 채우는 `0xaebe4` (aee9a~aef24, H2 1-2):
 * ```
 * aee9a  P = 0xae83c(팀) ; P+0x18 == 0 → 0xae9c4(팀, 0)          ; 마구 없음
 * aeea8  0xaea10(팀) < 0 일 때만:
 * aeeb6    마투수 0xb633d(P) → n = s8 0xd8509[ s8 mgr[0x13a + 순번 0xb63a1(P)] ]   ; [3,4,5,6,7]
 *          아니면           → n = u8 0xd84ff[ P+0x18 ]                          ; [0,4,5,6,7…]
 * aef06    스킬 23(0xb62b4(P, 0x17)) 이면 n += 2
 * ```
 * 칸이 −1 이 되는 곳은 팀 new(0xb891c, b89b4~b89ba)와 투수 교체(aec7a · aee3e) 뿐이라, 이 값은 **그 투수가
 * 마운드에 오를 때 한 번** 주어지고 이닝이 바뀌어도 다시 차지 않는다.
 * 쓰기 0xae9c4 는 지금 투수 +0x18 이 0 이면 칸을 안 건드리지만, 읽기 0xaea10 도 그때 0 을 주므로 0 과 같다.
 *
 * 스킬 23 혼신(+2)은 `0xb62b4(P, 0x17)` — 명단 줄 레코드 +0x14(`TeamEntryPitcher.skillBits`, 마투수는 XlsACE_PIT 행)로 본다.
 */
export function magicCountOfPitcher(pitcher: TeamEntryPitcher | undefined, aceLevels: TeamGameOptions['aceLevels']): number {
  if (pitcher === undefined) return 0
  const isAce = pitcher.aceIndex >= 0
  return magicPitchCountOf({
    number: pitcher.repertoire.magicId,
    isAce,
    // 레벨 = 전역 기록 mgr[0x13a + 순번] — 마투수는 열 칸 중 앞 다섯 (aeec8~aeee4)
    aceLevel: isAce ? aceLevelOf(aceLevels, aceLevelSlotOf('투수', pitcher.aceIndex + 1)) : 0,
    hasSpiritSkill: (((pitcher.skillBits ?? 0) >>> SPIRIT_SKILL_BIT) & 1) === 1,
  })
}

/**
 * 교체 실행 `0xaf09c` → `0xaebe4`. 새 투수는 **제 레코드 스태미나**(`+0x2c`)로 서고 카운터가 0 이며,
 * `state[0xd]` 가 서서 **다음 한 투구 동안**은 다시 바뀌지 않는다 (0xaec64 memset · 0xa5e72).
 * 내려간 투수의 깎인 스태미나는 그 칸에 남는다 (`ourPitcherStaminas` 주석).
 *
 * 마구 횟수 팀+0x28: 교체 가지(aebfe~aec8a)가 투수 명단 0번 ↔ 고른 칸을 맞바꾼 뒤 `0xae9c4(팀, −1)` 로 칸을 비우고
 * 같은 함수 끝(aee9a~)이 **새 투수로 다시 채운다** (`magicCountOfPitcher`). 내려간 투수의 남은 횟수는 버려진다.
 * 내려간 투수는 다시 오를 수 없다 — 맞바꾼 뒤 0xb95b0 이 벤치 칸을 돌려 그를 맨 끝으로 보내고 벤치 투수 수
 * 팀+0x33 을 하나 줄인다(aec1e~aec32) (웹은 `ourUsedPitchers` 로 벤치에서 뺀다).
 */
export function applyPitcherChange(
  progress: TeamGameProgress,
  ours: boolean,
  nextIndex: number,
  /**
   * 사람 경기 장면에서 바뀌었는가 — 그러면 세이브 후보 `0xa60c0` 을 잡는다. 장면 교체(사람 `#` 교체 · 0xf 진입의 CPU 교체)는
   * 0x16 진입 0x3d458 이 +0x195c 비트1 을 세우고 0xe 그림 0x38b64(38ba2 비트1 → 38bdc)가 메시지 0xbc0 을 보내 0x5227c 가 0xa60c0 을
   * 부른다(그 사이 플레이가 없어 이닝·아웃·주자·점수는 교체 순간과 같다). 간이 엔진 교체는 c268e~c26b2 가 수비 팀 +0x296 과 함께
   * `engine[1]` 을 보는데, 경기 장면(3fa06)·자동진행(3c93a)은 시뮬 초기화 0xc0dac 에 0 을 넘기고(c0e18) 1 은 CPU 끼리 경기
   * 0xc2760(c2858)만 쓴다 — 그래서 **간이 엔진 교체는 후보를 안 잡는다**(직접 떴다). 세이브는 어차피 +0x64 때문에 기록되지 않는다(S1 4-1).
   */
  inScene: boolean,
): TeamGameProgress {
  // 교체 자리에서 세이브 후보를 잡는다 (0xa60c0 — 수비 측의 새 투수, 그 순간 이닝·아웃·주자) — 장면 교체만
  const decisions = inScene
    ? decisionsAfterPitcherChange(progress.decisions, progress.game, {
        our: ours ? nextIndex : progress.ourPitcherIndex,
        opponent: ours ? progress.opponentPitcherIndex : nextIndex,
      })
    : progress.decisions
  // 루에 남은 주자는 책임 투수(주자+0x30)를 그대로 든다 — 모르는 루는 내려가는 투수 몫으로 굳힌다
  const runnerPitchers = freezeRunnerPitchers(
    progress.runnerPitchers,
    ours ? runnersOfGame(progress.game, progress.opponentOrderIndex) : runnersOfGame(progress.game),
    ours ? progress.ourPitcherIndex : progress.opponentPitcherIndex,
  )
  const base = { ...progress, pitcherJustChanged: true, decisions, runnerPitchers }
  if (ours) {
    return {
      ...base,
      ourUsedPitchers: [...progress.ourUsedPitchers, progress.ourPitcherIndex],
      ourPitcherIndex: nextIndex,
      ourPitcherStaminas: withValueAt(progress.ourPitcherStaminas, progress.ourPitcherIndex, progress.stamina),
      stamina: progress.ourPitcherStaminas[nextIndex] ?? FULL_STAMINA,
      magicRemaining: magicCountOfPitcher(pitcherEntryAt(progress, progress.options.ourTeamId, nextIndex), progress.options.aceLevels),
      ourPitcherCounters: EMPTY_MOUND_COUNTERS,
      pitchCount: 0,
      // 기록달성이 보는 R 은 **새 투수의** 경기 기록이다(0xb8cec = team+0x244+4·team[0]) — 이 경기에 처음 서니 0
      recordTally: { ...progress.recordTally, moundStrikeouts: 0, moundStrikeoutCombo: 0, moundOuts: 0 },
    }
  }
  return {
    ...base,
    opponentUsedPitchers: [...progress.opponentUsedPitchers, progress.opponentPitcherIndex],
    opponentPitcherIndex: nextIndex,
    opponentPitcherStaminas: withValueAt(progress.opponentPitcherStaminas, progress.opponentPitcherIndex, progress.opponentStamina),
    opponentStamina: progress.opponentPitcherStaminas[nextIndex] ?? FULL_STAMINA,
    opponentMagicRemaining: magicCountOfPitcher(pitcherEntryAt(progress, progress.options.opponentTeamId, nextIndex), progress.options.aceLevels),
    opponentPitcherCounters: EMPTY_MOUND_COUNTERS,
    // 새 투수의 경기 기록 R 은 이 경기에 처음 서니 0 이다 (우리 쪽 `recordTally.moundStrikeouts` 와 같다)
    opponentAceStrikeouts: 0,
  }
}

/** 배열 한 칸만 바꾼 새 배열 — 칸이 없으면 그대로 */
function withValueAt(values: readonly number[], index: number, value: number): readonly number[] {
  if (index < 0 || index >= values.length) return values
  const next = [...values]
  next[index] = value
  return next
}

/**
 * 사람이 `#` 메뉴로 투수를 바꾼다 (R4 1b — 원본도 **사람 손으로만** 우리 투수를 바꾼다).
 * `benchIndex` 는 아직 안 쓴 우리 팀 투수 칸이어야 한다.
 *
 * 교체 화면(상태 0xb) 키 `0x495fc` 의 OK(0x496f0~0x4970c)는 상태 **0x16**(교체 연출)로 가고, 0x16 → 0xd(이전 상태
 * 0x16 이라 카운트·타석 초기화·state[0xe] 지우기를 건너뜀, 48e94) → 0xe(모드 1·2·8·9 는 0x504cc 강판이 늘 거짓)
 * → 메시지 1(0xf 예약 · 돌발 0x8f158) → 0xf 진입 `0x3d954` 로 다시 들어온다 — `readyAtBat` 을 다시 지난다.
 * 사람 수비라 0x3d954 는 CPU 대타 `0xac228`(3da70)를 묻는다.
 */
export function changePitcher(
  progress: TeamGameProgress,
  benchIndex: number,
  /** 굴림 없음 — 다시 선 0xe 의 OK 뒤에 돈다 (`confirmScene`) */
  _random?: RandomPort,
): TeamGameProgress {
  if (progress.game.isFinished) return progress
  if (!availablePitchers(progress).includes(benchIndex)) return progress
  const applied = applyPitcherChange(progress, true, benchIndex, true)
  const changed = appendLog(
    {
      ...applied,
      // 0x496f0 → 0x16 진입 0x3d458 이 투수 예약을 보고 +0x195c 비트1(마선수면 6) → 0xe 등판음
      substitutionScene: substitutionSceneAfter(applied, '투수', applied.ourPitcherEntry[benchIndex]?.aceIndex ?? -1),
    },
    `${progress.game.inning}회${progress.game.half} 투수 교체 — ${progress.ourPitcherIndex + 1}번 → ${benchIndex + 1}번`,
    true,
  )
  // 0x16 → 0xd → 0xe — 사람 OK 를 다시 기다린다 (굴림은 OK 뒤, `confirmScene`)
  return enterConfirmWait(changed)
}

/**
 * **교체 화면 취소** — `0x495fc` 의 '#'·CLR 가지: 두 팀 예약을 지우고(`0xae989` = team+0x290·+0x291 = 0) 경기 상태
 * **0xe** 로 간다 (R4 1a). 0xe 의 메시지 1 이 다시 0xf 를 예약하고 돌발 `0x8f158` 을 굴린 뒤 0xf 진입 `0x3d954` 를
 * 지나므로(`readyAtBat`), 바꾼 것이 없어도 그 둘이 한 번 더 돈다. 화면이 교체 창을 닫을 때 부른다.
 * 교체 창은 0xe·0xf 에서만 열리므로(0x498d4) 사람 차례이고 타석 준비를 지난 때만 먹는다.
 */
export function cancelSubstitution(
  progress: TeamGameProgress,
  /** 굴림 없음 — 다시 선 0xe 의 OK 뒤에 돈다 (`confirmScene`) */
  _random?: RandomPort,
): TeamGameProgress {
  if (progress.game.isFinished || !isHumanTurn(progress) || !progress.atBatPrepared) return progress
  // '#'·CLR → 곧장 0xe(0x4984a) — 0xd 를 안 거친다(투수 그림 · 파티클을 안 건드린다). 사람 OK 를 다시 기다린다 (굴림은 OK 뒤, `confirmScene`)
  return { ...enterConfirmWait(progress), sceneConfirm: enterSceneConfirmFromSubstitutionWindow() }
}

/** 지금 바꿔 넣을 수 있는 우리 팀 투수 칸 — 화면의 투수 교체 목록이 쓴다 */
export function availablePitchers(progress: TeamGameProgress): readonly number[] {
  return benchIndexesOf(progress.ourPitcherIndex, progress.ourUsedPitchers, progress.ourPitcherEntry.length)
}

/**
 * `#` 로 교체 화면(경기 상태 0xb)을 열 수 있는가 — 진입 조건 `0x498d4` 의 '#' 가지 (I-controls 4b · R4 1a).
 *
 * 원본 조건 셋: ① `0x38984` 참(모드 4·7 은 막는다 — 팀 경기 모드 1·2·8·9 는 통과),
 * ② 경기 상태가 **0xe 또는 0xf**(투구 전·구질 고르기) — 웹에서는 *사람이 던질 차례이고 아직 안 던진 상태*,
 * ③ 사람 팀 벤치 투수 수 `팀+0x33` > 0.
 *
 * 사람이 **공격** 중이면 같은 키가 **대타**로 간다 (`canOpenPinchHit`) — 갈림길은 `0x49598`
 * 한 줄이다: `state[0x31+공격] == 0`(공격이 사람) → `0xaf06c`(대타), 아니면 `0xaf09c`(투수 교체).
 */
export function canOpenPitcherChange(progress: TeamGameProgress): boolean {
  if (progress.game.isFinished) return false
  if (!isPitchTurn(progress)) return false
  return availablePitchers(progress).length > 0
}
