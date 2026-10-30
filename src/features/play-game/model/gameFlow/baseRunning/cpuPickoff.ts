import { type PickoffBase, PICKOFF_PLAY_KIND } from '@/entities/defense-controls/model/pickoff'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { isPlayerTurn } from '@/entities/game/model/gameState'
import { type PickoffPlayInput, runPickoffPlay, type PickoffPlayResult, PICKOFF_RESULT } from '@/features/defense-play/model/pickoffPlay'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { recordPlateAppearance, EMPTY_BATTER_GAME_RECORD } from '@/entities/batting/model/pinchHitAi'
import { withSettlementEvents, settlementEventsOfPlay } from '@/features/defense-play/model/settlementEvents'
import { enterPitchSelection } from '@/features/play-game/model/gameFlow/atBat/pitchSelection'
import { advanceUntilPlayerTurn } from '@/features/play-game/model/gameFlow/autoPlay/advance'
import { withRunnerOnlyPlay } from '@/features/play-game/model/gameFlow/baseRunning/runnerOnlyPlay'
import { withRunnerPlaySettlement } from '@/features/play-game/model/gameFlow/baseRunning/runnerPlaySettlement'
import { ourRunnerAcesOf, ourRunnerRunsOnBaseOf, runnerRunAbilityOf } from '@/features/play-game/model/gameFlow/baseRunning/runners'
import {
  opponentDefenseAbilitiesOf,
  opponentFielderPlatesOf,
  opponentFielderRecordsOf,
  opponentFielderSkillIdsOf,
} from '@/features/play-game/model/gameFlow/defense/opponentFielders'
import { appendLog } from '@/features/play-game/model/gameFlow/log/appendLog'
import type { AtBatCount } from '@/features/play-game/model/gameFlow/types/plays'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * **CPU 투수의 견제** — 내 타석에서 상대(CPU) 투수 AI 가 목표점 대신 견제를 골랐다.
 *
 * ## 원본 길 (모드 4 에서도 돈다 — 확정)
 * - CPU 조작 객체(vtable `0xd0a60`, 슬롯 3 = `0x53874`)가 수비일 때 이벤트 0xf 에 메시지 **0x644**(`0x53850`),
 *   0x10 에 **0x645**(`0x53824`, `[+0x18] > 5`)를 보낸다. 모드는 안 본다.
 * - 경기 장면 메시지 처리기 `0x509a0` 은 비교 나무다: `0x50b1e~0x50b24` 0x5de+0x66 = **0x644 → 0x51212**
 *   (`0x344dc` 구질), `0x50ae0~0x50ae6` 0x6a9−0x64 = **0x645 → 0x5121c**(`0x345fc` 목표점). 여기도 모드 갈림이 없다.
 * - `0x345fc` 의 모드 갈림은 `0x3460e` `+0x1104 == 7`(홈런더비) 하나뿐 → 모드 4 에서는 목표 종류 4 가
 *   `0x34848` 견제(rand(1,4) 를 주자 있는 루까지 반복 → 메시지 0x10)로 간다 (I-controls 4a-2).
 * - 메시지 0x10 → `0x50f28` → 플레이 종류 4 · 상태 0x17 → 판 끝 `0xae3e8`: 아웃 ≤ 2 면 **같은 타석 다음 공(0xf)**,
 *   정산 `0xa8024` 는 불리지만 종류 4 라 타석 칸(+0x14)이 안 오른다.
 *
 * 여기는 **그 루가 정해진 뒤**다 — 루 굴림은 타석 화면(`selectPitch` 의 `cpuPickoff`)이 이미 했다.
 * 볼카운트·타순·투구 수·스태미나는 그대로다(공을 안 던졌다 — `throwOpponentPitch` 를 안 부른다).
 * 수비는 상대 팀, 주루는 환경설정 "주루"(`0xae690` 둘째 항, 타자편은 사람이 늘 공격).
 * 난수는 견제 판 안의 **악송구 굴림(0xa1828) 1번 · 악송구면 +2번**뿐이다.
 *
 * 내 타석이 아니거나(경기 끝·수비 진행 중) 그 루가 비었으면 아무 일도 없다 — 같은 객체를 돌려준다
 * (`0x34848` 은 주자 있는 루가 나올 때까지 굴리므로 빈 루가 들어오면 부르는 쪽 잘못이다).
 *
 * 0xae3e8 의 3아웃 갈래(0xae554 → 0x18)는 정산 0xa8024 와 모드 5·6 의 0xaaa6c 만 부르고 타순 커서 예약 0xaf020 은 0x35108 이 종류 4 면
 * 안 부른다(3513a~3515c, r276 직접 뜸) — 3아웃으로 끊겨도 타순은 그대로다. 판은 웹이 미리 돌린다 (`teamGameFlow.cpuPickoff` 와 같은 자리)
 * - 견제사·진루·득점은 루·아웃·점수·반 이닝 교대와 상대 투수 실점 A·B 에 먹이고, 0xa8024(종류 4)의 거르지 않는 칸은
 *   `withRunnerPlaySettlement`(상대 투수 +0x20 · 모드 4 의 0xa59c0 인기도 · 병살 · 득점권 아웃) — 같은 투구 틈 앞 판의 사건까지.
 *   돌발 판정 0x8f414 는 결과비트 0 이라 판정이 없다.
 * - 같은 타석이 이어지면 원본은 0xf 에 다시 들어서며 `0x3d954` 가 CPU 투수 교체(0xac428)를 다시 부른다 —
 *   `enterPitchSelection` 이 그 자리다 (반 이닝이 바뀌어 내 타석이 끊긴 때는 `advanceUntilPlayerTurn` 이 부른다).
 * - 3아웃으로 내 타석이 끊기면 타순 커서를 안 민다(타석이 안 끝났다) — 다음 이닝 나부터 다시 선다.
 */
export function cpuPickoff(
  progress: GameProgress,
  base: PickoffBase,
  random: RandomPort,
  options: {
    /** 0xa56dc(ctx, 지금 타자, 1) — 포스트시즌 · 국가대항전이면 거짓 (`resolveDefensePlay` 의 `isRecorded`). 안 넘기면 참 */
    readonly isRecorded?: boolean
    /** 지금 볼카운트 — 견제는 카운트를 안 바꾼다. 판 끝 0xf 진입의 교체 틱 굴림(0x344dc)이 본다 (`AtBatCount`) */
    readonly count: AtBatCount
    /**
     * 화면이 판을 실시간으로 돌린다 — 판을 붙들고(`pendingRunnerPlay`, 사람 공격) 끝나면 `resolveRunnerPlay`. 견제 판(종류 4)은
     * 0xae794 마스크 0x232 안이라 사람 주루 키(0x5331c → 0x582 · 0x584 → 0xa9b04)와 OK 슬라이딩(0x585)을 받는다
     */
    readonly live?: boolean
  },
): GameProgress {
  if (!canPickoff(progress, base)) return progress
  const input = pickoffInputOf(progress, base, random)
  const isRecorded = options.isRecorded !== false
  if (options.live === true) {
    return {
      ...progress,
      pendingRunnerPlay: {
        kind: 'pickoff',
        input,
        side: '공격',
        pickoff: { isRecorded, count: options.count },
      },
    }
  }
  return applyCpuPickoff(progress, base, runPickoffPlay(input), random, { isRecorded, shownLive: false, count: options.count })
}

/** 내 타석 중(경기 끝 · 붙든 판 없음)이고 그 루에 주자가 있나 */
function canPickoff(progress: GameProgress, base: PickoffBase): boolean {
  const before = progress.game
  if (before.isFinished || !isPlayerTurn(before)) return false
  if (progress.pendingDefensePlay !== null || progress.pendingRunnerPlay != null) return false
  const occupied = { 1: before.bases.first, 2: before.bases.second, 3: before.bases.third }
  return occupied[base]
}

/** 견제 판 입력 — 우리 공격이니 수비는 상대 팀이다(타구 진행기와 같은 아홉 칸 · 같은 주루 근사) */
function pickoffInputOf(progress: GameProgress, base: PickoffBase, random: RandomPort): PickoffPlayInput {
  const before = progress.game
  return {
    targetBase: base,
    bases: before.bases,
    outs: before.outs,
    defenseAbilities: opponentDefenseAbilitiesOf(progress),
    fielderPlates: opponentFielderPlatesOf(progress),
    // 초감각(21) — 같은 칸 고르기의 상대 야수 레코드 +0x14 (`defenseSkillIdsOf`)
    fielderSkillIds: opponentFielderSkillIdsOf(progress),
    // 야수 · 주자 그림 팔레트 (defender.mpl 15벌 — 팀 번호, C-1)
    defenseTeamIndex: progress.opponentTeamId,
    fielderRecords: opponentFielderRecordsOf(progress),
    offenseTeamIndex: progress.ourTeamId,
    runnerAces: ourRunnerAcesOf(progress),
    runAbility: runnerRunAbilityOf(progress),
    // 루별 주자 주루 — 루에 선 주자는 제 타석 0xa93ac 가 적은 주자+0xa4(제 레코드 0xb570c(팀, 3, 주자, …, 90))를 든다
    runAbilities: ourRunnerRunsOnBaseOf(progress),
    random,
    // 타자편은 사람이 늘 공격이다 — 환경설정 "주루" 혼자가 자동 진루 제어기를 켠다 (0xae690)
    offenseIsCpu: false,
    runningMode: progress.runningModeManual ? '수동' : '자동',
    // 수비는 CPU 다 — 슬롯 2 의 0xae6c8 첫 항(경기[0x31 + 수비측] == 1)이 서서 받은 야수의 0xafa60 이 매 틱 돈다 (d80918a)
    defenseIsCpu: true,
    scene: progress.defenseScene,
    // 경기 +0xfd4 — 견제는 0x11 을 안 지나 앞 공의 값(앞 타석 마지막 공일 수도 있다)이 남는다
    sceneResultCode: progress.sceneResultCode,
  }
}

/** 다 돈 CPU 견제 판을 경기에 먹인다 — `cpuPickoff` 의 뒷부분. 실시간으로 보여 준 판(`shownLive`)은 재생 칸에 다시 안 넣는다 */
export function applyCpuPickoff(
  progress: GameProgress,
  base: PickoffBase,
  result: PickoffPlayResult,
  random: RandomPort,
  options: {
    readonly isRecorded: boolean
    readonly shownLive: boolean
    /** 지금 볼카운트 — 판 끝 0xf 진입의 교체 틱 굴림(0x344dc)이 본다 (`AtBatCount`) */
    readonly count: AtBatCount
  },
): GameProgress {
  const before = progress.game
  // 득점 처리 0xa5c34 는 1점마다 수비 팀 실점 A·B 와 승·패·세 칸을 고친다 (내 타석 정산과 같은 칸)
  let next = withRunnerOnlyPlay(withPickoffPlateAppearance(progress), result, true, options.shownLive)
  // 정산 0xa8024(종류 4)의 거르지 않는 칸 — 사건 목록은 0x11 을 안 지나 같은 투구 틈 앞 판의 몫이 함께 든다
  const events = withSettlementEvents(progress.pendingSettlementEvents, settlementEventsOfPlay(result))
  next = withRunnerPlaySettlement(next, progress, result, events, options.isRecorded)
  const ended = next.game.isFinished || next.game.inning !== before.inning || next.game.half !== before.half
  next = { ...next, pendingSettlementEvents: ended ? undefined : events }
  next = appendLog(next, pickoffLogOf(before, base, result, next.game.ourScore - before.ourScore), true)
  // 같은 타석이 이어지면(판정 B ae592 → 상태 0xf) 0xf 진입 0x3d954 가 CPU 투수 교체를 다시 본다.
  // 반 이닝이 바뀌었거나 끝났으면 다음 내 차례까지 넘긴다
  return isPlayerTurn(next.game) && !next.game.isFinished ? enterPitchSelection(next, random, options.count) : advanceUntilPlayerTurn(next, random)
}

/** 정산 0xa8024 — 종류 4 라 타석 칸(+0x14)이 안 오르고 안타·홈런 가지도 안 선다 (pinchHitAi 게이트) */
function withPickoffPlateAppearance(progress: GameProgress): GameProgress {
  const slot = lineupSlotOf(progress.game.battingOrderIndex)
  const records = [...progress.ourLineup.records]
  records[slot] = recordPlateAppearance(records[slot] ?? EMPTY_BATTER_GAME_RECORD, {
    isHit: false,
    isHomeRun: false,
    playKind: PICKOFF_PLAY_KIND,
  })
  return { ...progress, ourLineup: { ...progress.ourLineup, records } }
}

/** 기록 줄 — `n회초 상대 b루 견제 — 견제사 · 악송구 · 세이프 (k점)` */
function pickoffLogOf(before: GameProgress['game'], base: PickoffBase, result: PickoffPlayResult, runs: number): string {
  const call = result.resultCode === PICKOFF_RESULT.OUT ? '견제사' : result.errantThrow ? '악송구' : '세이프'
  return `${before.inning}회${before.half} 상대 ${base}루 견제 — ${call}${runs > 0 ? ` (${runs}점)` : ''}`
}
