import { useLayoutEffect } from 'react'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { Screen } from '@/app/model/screen'
import type { MissionClearCounts } from '@/shared/api/save/missionRecordPort'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import { isMissionSideAllCleared, MISSION_ALL_CLEAR_HIDDEN_ID } from '@/entities/mission/model/missionGoal'
import { MISSION_BATTER_MODE, type MissionRun } from '@/entities/mission/model/missionRun'
import { MISSION_PITCHER_MODE, type PitcherRun } from '@/entities/mission/model/pitcherRun'
import { lapPlayClock } from '@/entities/collection/model/playClock'
import { NO_ACE_MATCH_HOLD, isAceMatchHeld } from '@/entities/mode-save/model/modeSave'
import { LOSE_SOUND, WIN_SOUND } from '@/features/play-game/model/gameSounds'
import { type MissionScope, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import { missionRunAtom, pitcherAceMatchMissionAtom, pitcherRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { clearCountsAtom, isSettledAtom, settledAtom } from '@/app/model/missionSession/atoms/recordAtoms'
import { rememberAceMatchCleared, rememberCleared } from '@/app/model/missionSession/result/clearRecords'

/** 판이 끝났나(성공 · 실패) — 진행 중이거나 판이 없으면 아니다 */
function isRunEnded(run: { readonly status: string } | null): boolean {
  return run !== null && run.status !== '진행중'
}

/** 끝난 판 번호 — 끝난 판에서 진행(또는 판 없음)으로 돌아간 그림에 하나 오른다 */
function advanceSettlementEpisode(previous: { readonly episode: number; readonly wasEnded: boolean } | null, isEnded: boolean) {
  const episode = previous === null ? 0 : previous.episode + (previous.wasEnded && !isEnded ? 1 : 0)
  return { episode, wasEnded: isEnded }
}

/** 이 판의 클리어 칸 · 번 G — 대결은 0x4ef3e 가 G 를 건너뛰고, 0xa5368 은 +0xbd(team − 1) ≤ 15 일 때만 그 편 칸을 올린다 */
function settleClears(
  scope: Parameters<typeof rememberCleared>[0],
  run: MissionRun | PitcherRun,
  aceMission: OriginalMission | null,
  clearCounts: MissionClearCounts,
): { readonly countsAfter: MissionClearCounts; readonly earned: number } {
  if (aceMission === null) {
    const cleared = rememberCleared(scope, run.mission, run.status)
    return { countsAfter: cleared.counts, earned: cleared.earned }
  }
  return { countsAfter: run.status === '성공' ? rememberAceMatchCleared(scope, aceMission) : clearCounts, earned: 0 }
}

/** 타자편 마선수 대결 화면이면 그 공략 레코드 */
const aceMatchMissionOf = (screen: Screen) => (screen.kind === '마선수대결' ? screen.mission : null)

type SettleHands = Parameters<typeof rememberCleared>[0] & Pick<MissionScope, 'openHidden' | 'recordStat' | 'audio'>

/** 편별 올클리어 0xa5184 — 성공이면(대기로 G 를 건너뛴 판도) 그 편이 다 깼을 때 0x62368(ui, 모드 6 ? 37 : 21, 0) */
function openAllClearHidden({ openHidden }: SettleHands, isWin: boolean, side: OriginalMission['side'], countsAfter: MissionClearCounts): void {
  if (isWin && isMissionSideAllCleared(countsAfter, side)) openHidden?.(MISSION_ALL_CLEAR_HIDDEN_ID[side])
}

/** 정산 진입 0x4ea0c 의 곁일 — 올클리어 히든 · 플레이 시간 · 결과 바이트 · 결과 징글 */
function announceSettlement(hands: SettleHands, isWin: boolean, side: OriginalMission['side'], countsAfter: MissionClearCounts): void {
  const { recordStat, aceMatchHold, audio } = hands
  // 4ef84~4efae
  openAllClearHidden(hands, isWin, side, countsAfter)
  // 기록연감 G획득 · 기록달성은 **쌓지 않는다** (확정) — 0x4ea0c 4eb60~4eb6a 가 모드([장면+0x1104]) − 5 ≤ 1 이면 곧바로
  // 4ecde 로 뛰어 기록 G 합(4ebe0~4ec36) · G 더하기(4ec5a) · `0x22c7d`(4ec82) · `0x22e11`(4ec8a) · 0x1fd45 · 0x1f1e1 을 통째로 건너뛰고,
  // 미션 갈래 0x4ef18~0x4f018 은 G 를 더하기만 한다(4ef82 `str [g,#0x64]`) — `0x22c7d` 를 부르는 곳(전수: 0x8afa · 0x8c76 · 0x1bb14 ·
  // 0x1bc4a · 0x293e6 · 0x4ec82 · 0x4ee90/0x4eeba(대전 8·9 갈래) · 0x4f708 · 0x8c6e2)에 미션 갈래가 없다. 미션 칸(모드 5·6 → 칸 5)
  // GP 통계는 메인 메뉴 달성 팝업 0x292f8(k = 3·4·7 → 293dc `movs r2,#6`)만 쌓는다(`collectionRewardStatModeOf`)
  // 0x4ea0c 끝 0x4f54a `0x4e8b0` — 모든 모드를 센다: 모드 5 · 6 은 0x22efc 의 미션 칸 +0x54 (점프표 0xcdaac)
  recordStat?.({ kind: '플레이시간', mode: side === '타자' ? MISSION_BATTER_MODE : MISSION_PITCHER_MODE, elapsed: lapPlayClock() })
  // 0x4efc6~0x4f018 — 서 있는 대기마다(대결이면 SYS 8 이 세운 그 편 칸도) 결과 바이트를 이 판 결과로. g[0xf6] 은 안 본다
  if (isAceMatchHeld(aceMatchHold?.read() ?? NO_ACE_MATCH_HOLD)) aceMatchHold?.writeResult(isWin)
  // 결과 징글 — 0x4ea0c 의 모드 표 0xd0428[5 · 6] = 0x4ef18 이 [sp+0x50] 을 [미션+0xbc](성공?)로 덮고(4ef36 · 4efb4),
  // 모든 모드가 모이는 4f41a 가 1 이면 31 · 0 이면 32 를 예약한다(4f544) — 마선수 대결도 같다
  audio.play(isWin ? WIN_SOUND : LOSE_SOUND)
}

/** 끝난 판 하나를 정산한다 — 클리어 칸 · 번 G · 편별 올클리어 · 플레이 시간 · 결과 바이트 · 결과 징글 */
function settleEndedRun(
  hands: SettleHands,
  run: MissionRun | PitcherRun,
  ended: {
    readonly aceMission: OriginalMission | null
    readonly side: OriginalMission['side']
    readonly clearCounts: MissionClearCounts
    readonly episode: number
  },
): void {
  const { atoms } = hands
  const { side } = ended
  const isWin = run.status === '성공'
  const { countsAfter, earned } = settleClears(hands, run, ended.aceMission, ended.clearCounts)
  // 0x4ea0c 정산 — 판이 끝난 커밋에 횟수 · G 를 적고(곁일 — 그리는 중엔 못 한다) 그때 번 G 를 결과 판에 싣는다
  atoms.set(settledAtom, { earned, episode: ended.episode })
  announceSettlement(hands, isWin, side, countsAfter)
}

/**
 * **미션 끝 → 정산 진입** (직접 떴다). 미션이 끝나면 메시지 0x76c/0x76d 를 받은 0x509a0(50cfa~50d0e · 50d18~50d2c)이
 * `0xa5368(미션, 성공?)` — 성공이면 클리어 횟수 칸 +1 · [미션+0xa0] = 보상 0xa52b0, 실패(0)면 아무 일도 안 함(a538a~a538e) — 뒤
 * 0x19 를 예약하고, 다음 틀 0x19 진입 0x4ea0c 가 G(4ef3e — 대기가 없을 때만, [+0x17f4] = 보상 · G += 보상) · 결과 바이트(4efc6~4f018
 * — 서 있는 대기마다 이 판 성공 여부)를 적는다. 곧 결과 판이 **서는 그 순간** 다 적혀 있다 — 판에서 앱을 꺼도 남는다.
 * 웹은 판 상태가 진행중에서 끝으로 바뀐 그 그리기 전에 한 번 한다. 결과 판의 번 G 는 그때 적은 값(`settledEarned`)이다.
 * 판을 닫는 키(목록 · 다시하기 · 대결 결과 이벤트)는 더 적지 않는다 — 다시하기 0x1e908 의 `0xa5368(미션, 0)` 은 아무 일도 안 한다.
 *
 * 돌려주는 값은 결과 판 0x4a384 의 번 G [+0x17f4] — 판이 끝났다가 다시 진행(또는 판 없음)으로 돌아간 횟수(끝난 판 하나가 한 번호)가
 * 같은 판에만 보인다. 정산을 안 지났으면 null
 */
export function useSettlement(scope: MissionScope): number | null {
  const { atoms, screen, audio, openHidden, recordStat, aceMatchHold, missionRecord, onGamePointReward } = scope
  const missionRun = useMissionValue(atoms, missionRunAtom)
  const pitcherRun = useMissionValue(atoms, pitcherRunAtom)
  const pitcherAceMatchMission = useMissionValue(atoms, pitcherAceMatchMissionAtom)
  const clearCounts = useMissionValue(atoms, clearCountsAtom)
  const settled = useMissionValue(atoms, settledAtom)
  const settlementEpisode = useRenderMachine(advanceSettlementEpisode, isRunEnded(missionRun ?? pitcherRun)).episode
  useLayoutEffect(() => {
    const run = missionRun ?? pitcherRun
    if (run === null || run.status === '진행중') {
      atoms.set(isSettledAtom, false)
      return
    }
    if (atoms.get(isSettledAtom)) return
    atoms.set(isSettledAtom, true)
    const aceMission = missionRun !== null ? aceMatchMissionOf(screen) : pitcherAceMatchMission
    const hands = { atoms, missionRecord, aceMatchHold, onGamePointReward, openHidden, recordStat, audio }
    settleEndedRun(hands, run, { aceMission, side: missionRun !== null ? '타자' : '투수', clearCounts, episode: settlementEpisode })
  }, [
    aceMatchHold,
    atoms,
    audio,
    clearCounts,
    missionRecord,
    missionRun,
    onGamePointReward,
    openHidden,
    pitcherAceMatchMission,
    pitcherRun,
    recordStat,
    screen,
    settlementEpisode,
  ])
  return settled !== null && settled.episode === settlementEpisode ? settled.earned : null
}
