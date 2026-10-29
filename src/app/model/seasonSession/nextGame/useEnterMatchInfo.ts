import { useCallback } from 'react'
import type { PreGameAces } from '@/entities/season-mode/model/preGameFlow'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import { rollOpponentAces } from '@/features/play-team-game/model/teamGameFlow'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { seasonMatchInfoStageOf } from '@/app/model/seasonSession/game/sceneSetup'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import { withSeasonFirstDayStamina } from '@/app/model/seasonSession/stamina/stamina'
import type { PendingSeasonGame } from '@/app/model/seasonSession/types/session'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SeasonScope } from '@/app/model/seasonSession/atoms/seasonScope'
import { sceneAtom } from '@/app/model/seasonSession/atoms/sceneAtoms'
import { isMatchSettingsOpenAtom, matchInfoStageAtom, pendingGameAtom } from '@/app/model/seasonSession/atoms/nextGameAtoms'
import { useSeasonSaveWriters } from '@/app/model/seasonSession/state/useSeasonSaveWriters'

/** 상대 팀 마선수 굴림 66ee~670a — 국가대항전이거나 0xd7 을 거치지 않았으면(마선수 없음) 굴리지 않는다 */
function rollPendingOpponentAces(pending: PendingSeasonGame, aces: PreGameAces | null, random: RandomPort): PendingSeasonGame {
  if (pending.kind === '국가대항전' || aces === null) return pending
  return { ...pending, options: { ...pending.options, opponentAces: rollOpponentAces(aces.pitcher, aces.batter, random) } }
}

/** 경기진행 설정 창을 이미 봤는가 — 시즌 저장 +0x11e, 또는 일반모드 22 가 먼저 본 전역 칸 */
function isMatchSettingsSeen(current: SeasonSave, slot: SeasonScope['matchSettingsSeenSlot']): boolean {
  return current.matchSettingsSeen === true || slot?.read() === true
}

/**
 * 0xdd 진입이 저장할 시즌 — 처음 본 설정 창(+0x11e = 1)과 시즌 첫날 6850(열 팀 투수 10000). 둘 다 아니면 저장하지 않는다(null).
 * 6850 은 SR+0xb2 만 본다 — 포스트시즌도 시리즈 첫 경기(g = 0)면 열 팀을 채운다(`postseasonDayOf`)
 */
function matchInfoEnteredSaveOf(current: SeasonSave, pending: PendingSeasonGame, firstTime: boolean): SeasonSave | null {
  const firstDay = pending.kind !== '국가대항전' && current.state.record.games === 0
  if (!firstTime && !firstDay) return null
  const seen = firstTime ? { ...current, matchSettingsSeen: true } : current
  return firstDay ? withSeasonFirstDayStamina(seen) : seen
}

/** 0xdd 경기정보 들어가기 — 경기 전 선수단(0xd7) OK 와 포스트시즌 · 국가대항전이 부른다 */
export function useEnterMatchInfo(scope: SeasonScope) {
  const { atoms, random, matchSettingsSeenSlot } = scope
  const { commit } = useSeasonSaveWriters(scope)
  /**
   * 0xdd 경기정보로 — 들어옴 0x6548 (이전 상태가 0xe0 이면 6556 에서 곧장 6850 으로 — 웹은 0xe0 에서 돌아올 때
   * 이 함수를 안 부른다):
   *   - 저장 +0x11e 가 0 이면 **경기진행 설정 창을 저절로 열고** 그 칸을 1 로 써서 저장한다 (6564~659c).
   *   - 국가대항전(SR+0x12c)이 아니면(66ae) 0xd7 에서 고른 마선수를 내 팀에 싣고(66da·66e6) 이어 **상대 팀 마선수를
   *     굴린다** — `v = 0x66968(rec+0xe)`(66ee) → `0xb88c8(상대, v)`(66f8) · `w = 0x66994(rec+0xd)`(6700) →
   *     `0xb8870(상대, w)`(670a). 이 둘(rand 2)이 0xdd 진입의 유일한 굴림이다. 웹은 굴린 값을 옵션 `opponentAces` 로
   *     싣고 경기정보·CPU 엔트리 화면이 같은 값을 본다. 다시 0xd7 → 0xdd 로 들어오면 다시 굴린다(원본 그대로).
   *   - 두 팀 명단 세우기(0xb891c)·로테이션(0xb8c80)은 웹에서는 경기를 세울 때(`startTeamGame`) 한다.
   *   - 6850: `SR+0xb2 == 0`(시즌 첫날)이면 열 팀 투수 전원 10000 (`withSeasonFirstDayStamina`, 모듈 머리 주석).
   *     포스트시즌도 SR+0xb2 = L+0x32 가 시리즈마다 0 부터라(0xb80a8 b811c · 0xb7724 b777a −1 · 0xb818c +1) 시리즈 첫 경기면
   *     이 고리를 돈다 — L+0x34 를 보지 않는다(6850~6860 직접 떴다). 국가대항전 첫날도 이 고리를
   *     돌지만 대회 중 0x1f9a9 는 상대국 슬롯을 돌려주므로 리그 팀은 안 바뀐다 — 웹은 건너뛴다.
   *
   * **투수 스태미나 (P1 3절 · 직접 떴다)** — 투수 레코드 +0x2c 는 경기용 칸이 아니라 **시즌 내내 이어지는 값**이다.
   *   - `0xb6190(팀)` = 그 팀 투수 전원(팀+0xc 명, 팀+0x14 배열, 0x30 간격) +0x2c = 10000 (b6192~b61aa, 확정).
   *   - 정규·포스트시즌: 첫날 6850 뒤로는 하루 끝 4f2bc 의 열 팀 `0xb617c`(+20%)만 회복한다 — 경기에서 깎인 값(0xaeb08)이
   *     다음 경기로 **이어진다**. 내 팀은 `roster.pitchers[i].stamina`, 다른 아홉 팀은 `cpuPitcherStaminas` 에 두고
   *     경기 옵션 `ourPitcherStaminas`·`opponentPitcherStaminas` 로 넘겨 요약으로 받는다 (`finishGame`).
   *   - 국가대항전: 대회 초기화 b7c88 과 하루 끝 0xb818c 대회 갈래가 **대한민국을 매일 10000** 으로 채우고,
   *     상대국은 매일 마스터에서 새로 복사된다(0x20648) — 웹 팀 경기 기본값(늘 10000)과 같아 넘기지 않는다.
   */
  return useCallback(
    (current: SeasonSave, pending: PendingSeasonGame, aces: PreGameAces | null) => {
      // 0x6548 의 65ec~6626 — 0xb6814(전역 상태): +0x6b = 0 (`liveGameState`). 0xe0 에서 돌아온 길(6556 → 6850)은 안 지난다
      resetLiveGameState()
      atoms.set(pendingGameAtom, rollPendingOpponentAces(pending, aces, random))
      // 67dc~6834 — 무대 new · 0x78664(무대, 홈 팀) · +0x80/+0x84 · 0x78688(무대, 홈 팀, 1) · 0x5fd04(스킨, 무대).
      // 홈은 측 1 팀 — 대회면 대표팀(10~13)이라 rand(0, 10) 하나(마선수 굴림 뒤), 정규 · 포스트시즌은 0~9 라 안 굴린다
      atoms.set(matchInfoStageAtom, seasonMatchInfoStageOf(pending.options, random))
      // +0x11e — 일반모드 22 가 먼저 봤으면 전역 칸이 이미 1 이다
      const firstTime = !isMatchSettingsSeen(current, matchSettingsSeenSlot)
      if (firstTime) matchSettingsSeenSlot?.markSeen()
      const entered = matchInfoEnteredSaveOf(current, pending, firstTime)
      if (entered !== null) commit(entered)
      atoms.set(isMatchSettingsOpenAtom, firstTime)
      atoms.set(sceneAtom, SEASON_SCENE_STATE.경기정보)
    },
    [atoms, commit, random, matchSettingsSeenSlot],
  )
}
