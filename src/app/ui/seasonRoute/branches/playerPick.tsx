import type { ReactNode } from 'react'
import { SeasonPlayerPickScreen, SeasonPlayerCardScreen, seasonCardAbilitiesOf, seasonPlayerDetailViewOf, seasonCardInfoOf } from '@/pages/season'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { TEAMS } from '@/shared/config/original/teams'
import { MessageBox } from '@/shared/ui'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { NARI_EQUIP_REFUSAL_TEXT_ID, PLAYER_PICK_PURPOSE, playerPickCancelTarget, refusesEquipment } from '@/entities/season-mode/model/playerPick'
import { seasonPlayerRecordOf } from '@/entities/season-mode/model/seasonPlayerRecord'
import { ENTRY_TAB } from '@/entities/season-mode/model/entryEditor'
import { withEntryCells } from '@/app/ui/seasonRoute/entryCells'
import type { SeasonBranchInput } from '@/app/ui/seasonRoute/branchInput'

// 공용 선수 고르기 0xdf — 목적 1(장착아이템)·2(선수정보). 목록은 내 팀 레코드 차례(투수는 로테이션으로 섞인 차례)
export function playerPickBranch({
  scene,
  state,
  session,
  actions,
  pickNotice,
  setPickNotice,
  playerPick,
  setPlayerPick,
}: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.선수고르기 || playerPick === null || playerPick.purpose === PLAYER_PICK_PURPOSE.선수영입) return null
  const pick = playerPick
  return (
    <SeasonPlayerPickScreen
      teamId={state.record.teamId}
      roster={session.tradeRoster}
      {...withEntryCells(session.entryCellSourceOf(state.record.teamId))}
      initialTab={pick.tab}
      gamePoint={session.gamePoints}
      overlay={pickNotice === null ? undefined : <MessageBox text={pickNotice} buttons={['OK']} onAnswer={() => setPickNotice(null)} />}
      onPick={(tab, index) => {
        setPlayerPick({ ...pick, tab, cursor: index })
        // 0xc3e8 확인 — 목적 2 → 카드 0xd9
        if (pick.purpose === PLAYER_PICK_PURPOSE.선수정보) return actions.goto(SEASON_SCENE_STATE.선수상세)
        // 목적 1 — 0xb5694(팀, ed+0x33f ? 0 : 1, 커서) 가 나리 선수(0xb6388)면 StrMODE[220], 아니면 장비 창 0xdc(종류 3).
        // 장비 창에서 부위 목록 취소 → 0xdf (0x97bc~0x97d6)
        const player = (tab === ENTRY_TAB.투수 ? session.tradeRoster.pitchers : session.tradeRoster.batters)[index]
        if (player === undefined) return undefined
        if (refusesEquipment(player)) return setPickNotice(ORIGINAL_MODE_TEXT[NARI_EQUIP_REFUSAL_TEXT_ID] ?? '')
        return actions.goto(SEASON_SCENE_STATE.아이템상점)
      }}
      onBack={() => {
        setPlayerPick(null)
        actions.goto(playerPickCancelTarget(pick.purpose))
      }}
    />
  )
}

// 선수 카드 0xd9 ↔ 능력치 상세 창 0xda — 0xdf 목적 2 에서 고른 선수 (0x5404: 0xb5694(팀, 탭 == 0 ? 1 : 0, 커서))
export function playerCardBranch({ scene, state, session, actions, hasCardBadge, playerPick, setPlayerPick }: SeasonBranchInput): ReactNode {
  if ((scene !== SEASON_SCENE_STATE.선수상세 && scene !== SEASON_SCENE_STATE.능력치상세) || playerPick === null) return null
  const pick = playerPick
  const isPitcher = pick.tab === ENTRY_TAB.투수
  const players = isPitcher ? session.tradeRoster.pitchers : session.tradeRoster.batters
  const player = players[pick.cursor]
  if (player === undefined) return null
  const recordOf = session.recordSource()
  const view = seasonPlayerRecordOf(state.record.teamId, player, isPitcher, pick.cursor, recordOf)
  const context = { record: state.record, teamMorale: state.teamMorale }
  return (
    <SeasonPlayerCardScreen
      teamId={state.record.teamId}
      view={view}
      abilities={seasonCardAbilitiesOf(view, context)}
      info={seasonCardInfoOf(view, TEAMS[state.record.teamId]?.name ?? '', player.kindByte)}
      detail={seasonPlayerDetailViewOf(view, context)}
      isDetailOpen={scene === SEASON_SCENE_STATE.능력치상세}
      gamePoint={session.gamePoints}
      hasCardBadge={hasCardBadge}
      onOpenDetail={() => actions.goto(SEASON_SCENE_STATE.능력치상세)}
      onCloseDetail={() => actions.goto(SEASON_SCENE_STATE.선수상세)}
      onBack={() => {
        // 0x48a0 취소 → 0xdf. 0x5980 이 목록을 다시 채워 커서 0 · 탭은 창+0x24c(이 선수가 타자였는가)대로
        setPlayerPick({ ...pick, cursor: 0 })
        actions.goto(SEASON_SCENE_STATE.선수고르기)
      }}
    />
  )
}
