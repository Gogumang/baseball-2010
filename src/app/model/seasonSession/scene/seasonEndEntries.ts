import { SEASON_SCENE_STATE, SEASON_PHASE, SEASON_END_CHAIN, regularSeasonRankEventId } from '@/entities/season-mode/model/seasonStateMachine'
import { SEASON_GOAL_INTRO_EVENT_ID } from '@/entities/season-mode/model/seasonEventFlow'
import { activeSound } from '@/shared/api/audio/soundPort'
import { opensSeasonAutobotBat, SEASON_AUTOBOT_BAT_HIDDEN_ID, judgeSeasonEnding } from '@/entities/season-mode/model/seasonRewards'
import { seasonEndingBgmOf } from '@/app/model/screenBgm'
import { rankingOf } from '@/entities/league/model/league'
import { SEASON_AWARD_INTRO_EVENT_ID } from '@/widgets/season/lib/seasonAwardEvents'
import { rollSeasonMvpKind } from '@/app/model/seasonSession/awards/seasonAwards'
import { SEASON_MANAGEMENT_BGM } from '@/app/model/seasonSession/constants/seasonConstants'
import { openedHiddenIdsAtom, summaryEntryAtom } from '@/app/model/seasonSession/atoms/uiAtoms'
import { seasonMvpKindAtom, summaryEntrySerialAtom } from '@/app/model/seasonSession/atoms/eventAtoms'
import { type SceneEntry, withSeasonRecord } from '@/app/model/seasonSession/scene/sceneEntry'

/**
 * 결산 0xef 진입 0x6900 — 들어갈 때마다 머리에서 세 모드 해금 0x29 를 본다. 새로 열리면 해금 알림 창(0x62368 →
 * 0x74ef5, 꼬리표 0)을 띄우고 그 진입의 리그 1위 G 검사를 건너뛴다(0x69ce → 0x6ac8). 창을 닫으면 0x87e8 이 G 검사를
 * 한 번 돌린다. 안 열리면 진입이 곧장 G 검사를 한 번(0x69d4~0x6ac0) — 결산 화면(`SeasonSummaryScreen`)이 이 값으로
 * 그 창과 검사를 맡는다
 */
export function enterSummaryScene({ atoms, save, commit, readAutobotBatInput, openedHiddenIds }: SceneEntry): void {
  const { record } = save.state
  // 0xef 진입 0x6900 — SR+0x50 = 0xf · 저장 뒤 조건 없이 관리 화면 배경음 4 (6926~6934 `0x6ea6d(소리, 4, −1, 1)`)
  activeSound().playBgm(SEASON_MANAGEMENT_BGM)
  const input = readAutobotBatInput()
  const opens =
    input !== undefined && opensSeasonAutobotBat(record, { ...input, globalOpenedHiddenIds: [...input.globalOpenedHiddenIds, ...openedHiddenIds] })
  if (opens) atoms.set(openedHiddenIdsAtom, (opened) => [...opened, SEASON_AUTOBOT_BAT_HIDDEN_ID])
  const serial = atoms.get(summaryEntrySerialAtom) + 1
  atoms.set(summaryEntrySerialAtom, serial)
  atoms.set(summaryEntryAtom, { serial, opensAutobotBat: opens })
  // 0x690e~0x6922 — 머리에서 SR+0x50 = 0xf 를 쓰고 0x1fded · 0x22755 로 저장한다(조건 없이, 포스트시즌 경기 뒤 다시 들어와도)
  commit(withSeasonRecord(save, { ...record, phase: SEASON_PHASE.결산 }))
}

/**
 * 10년차 엔딩 0xf5 진입 0x6be8 — 엔딩 판정 0xa3085 가 0(비 인기 구단 — 보너스 표 0xcbc2e[0] = 0)이면 SR+0x7b = 1 · 저장
 * (6c12~6c2e) — 키 0x6b3c 가 보너스 팝업 없이 넘긴다. 이어서 배경음을 예약한다(0 → 52 · 그 밖 46, `seasonEndingBgmOf`)
 */
export function enterEndingScene({ save, commit }: SceneEntry): void {
  const { record } = save.state
  const endingIndex = judgeSeasonEnding(record)
  if (endingIndex === 0 && !record.endingBonusReceived) commit(withSeasonRecord(save, { ...record, endingBonusReceived: true }))
  activeSound().playBgm(seasonEndingBgmOf(endingIndex))
}

/**
 * 시즌 끝 사슬 — 진입 함수마다 phase 를 세우고 저장한 뒤 그 칸의 이벤트를 튼다
 * (0x6d6c 0xb · 0xe854 0xc · 0xe900 0xd · 0xe7ac 0xe · 0x6c90 0x10). 사슬 칸이 아니면 아무것도 안 한다
 */
export function enterSeasonEndChainScene(entry: SceneEntry): void {
  const { atoms, scene, save, random, commit, startEvent, recordSourceNow } = entry
  const step = SEASON_END_CHAIN.find((candidate) => candidate.state === scene)
  if (step === undefined) return
  const { record } = save.state
  commit(withSeasonRecord(save, { ...record, phase: step.phase }))
  // 0xee — 392 를 틀고 [다음 0xeb] (6d9c~6db0)
  if (scene === SEASON_SCENE_STATE.포스트시즌시작) return startEvent(SEASON_GOAL_INTRO_EVENT_ID, step.next)
  // 0xf0 — 정규시즌 순위 0xb7aa0(L, 팀, 1) 로 401 · 402 · 403 (6cb2~6cee)
  if (scene === SEASON_SCENE_STATE.정규시즌순위) {
    const rank = Math.max(0, rankingOf(save.league).indexOf(record.teamId))
    return startEvent(regularSeasonRankEventId(rank), step.next)
  }
  // 0xeb 0xe854 · 0xec 0xe900 — 0x8dad5(evmgr, 0xc · 0xd) 로 타이틀 칸을 채우고 370 · 371 을 튼다(이전 = 다음 상태, 다음 = 0xd3)
  if (scene === SEASON_SCENE_STATE.타자시상) return startEvent(SEASON_AWARD_INTRO_EVENT_ID.타자, step.next)
  if (scene === SEASON_SCENE_STATE.투수시상) return startEvent(SEASON_AWARD_INTRO_EVENT_ID.투수, step.next)
  // 0xed 0xe7ac — 0x8dd61(evmgr) 가 표 0xd4f34 에서 rand(0..6) 으로 MVP 순위 종류를 고른 뒤(빈 순위표면 다시) 376 을 튼다
  if (scene === SEASON_SCENE_STATE.최우수선수) {
    atoms.set(seasonMvpKindAtom, rollSeasonMvpKind(save, recordSourceNow(), random))
    return startEvent(SEASON_AWARD_INTRO_EVENT_ID.MVP, step.next)
  }
}
