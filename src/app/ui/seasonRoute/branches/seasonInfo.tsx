import type { ReactNode } from 'react'
import {
  SeasonInfoScreen,
  SeasonTeamInfoScreen,
  seasonTeamInfoRowsOf,
  SeasonOwnedItemsScreen,
  SeasonRecordPickPopup,
  SeasonRecordRankScreen,
} from '@/pages/season'
import { moveRankingPage, rankSeasonRecords, rankingCategoriesOf } from '@/entities/season-mode/model/seasonRecordRanking'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { seasonLeagueRecordsOf } from '@/app/model/useSeasonSession'
import { PLAYER_PICK_PURPOSE } from '@/entities/season-mode/model/playerPick'
import { ENTRY_TAB } from '@/entities/season-mode/model/entryEditor'
import type { SeasonBranchInput } from '@/app/ui/seasonRoute/branchInput'

// 구단정보 0xd5 (들어옴 0x5324 · 키 0x4884 취소 → 0xcd · 그림 0xae68)
export function teamInfoBranch({ scene, state, session, actions, hasCardBadge, goalInput }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.구단정보) return null
  const teamAbilities = state.teamAbilities[state.record.teamId] ?? []
  return (
    <SeasonTeamInfoScreen
      teamId={state.record.teamId}
      teamAbilities={teamAbilities}
      // 순위 0xb7aa1(SR+0x80, 내 팀, 0) — 목표 ① 과 같은 함수·같은 인자
      rows={seasonTeamInfoRowsOf({ record: state.record, teamAbilities, rank: goalInput.rank })}
      gamePoint={session.gamePoints}
      hasCardBadge={hasCardBadge}
      onBack={() => actions.goto(SEASON_SCENE_STATE.시즌정보)}
    />
  )
}

// 시즌정보 칸 1 아이템 0xd6 (들어옴 0x5ee4 창 종류 5 · 키 0x5f10 취소 → 0xcd · 그림 0xb1b4)
export function ownedItemsBranch({ scene, state, session, actions }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.보유아이템) return null
  return (
    <SeasonOwnedItemsScreen
      record={state.record}
      teamMorale={state.teamMorale}
      gamePoint={session.gamePoints}
      onBack={() => actions.goto(SEASON_SCENE_STATE.시즌정보)}
    />
  )
}

// 기록순위 0xdb (들어옴 0x56fc → 0x5761c · 키 0x74c4 → 0x5787c · 그림 0xafa8 → 0x5796c)
export function recordRankBranch({ scene, state, session, actions, recordRank, setRecordRank, leagueRecordSourceOf }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.기록순위) return null
  const category = rankingCategoriesOf(recordRank.side)[recordRank.page] ?? rankingCategoriesOf(recordRank.side)[0]
  // 순위 객체 0x9d789(…, 종류, 모드 2, 큰쪽 1, 고정문턱 0) — 열 팀 레코드를 훑는다. 규정 문턱은 SR+0xb2 경기 수
  const entries = rankSeasonRecords(seasonLeagueRecordsOf(leagueRecordSourceOf(), recordRank.side === '투수'), category.kind, state.record.games)
  return (
    <SeasonRecordRankScreen
      side={recordRank.side}
      page={recordRank.page}
      entries={entries}
      myTeamId={state.record.teamId}
      gamePoint={session.gamePoints}
      onMovePage={(step) => setRecordRank((held) => ({ ...held, page: moveRankingPage(held.side, held.page, step) }))}
      onBack={() => actions.goto(SEASON_SCENE_STATE.시즌정보)}
    />
  )
}

// 시즌정보 0xcd — 네 칸 하위 메뉴 (키 0x9008)
export function seasonInfoBranch({
  scene,
  state,
  session,
  actions,
  recordPick,
  setRecordPick,
  setRecordRank,
  setPlayerPick,
  backToManagement,
}: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.시즌정보) return null
  return (
    <SeasonInfoScreen
      state={state}
      gamePoint={session.gamePoints}
      isKeyEnabled={recordPick === null}
      overlay={
        recordPick === null ? undefined : (
          <SeasonRecordPickPopup
            side={recordPick}
            onToggle={() => setRecordPick((held) => (held === '타자' ? '투수' : '타자'))}
            onConfirm={() => {
              setRecordRank({ side: recordPick, page: 0 })
              setRecordPick(null)
              actions.goto(SEASON_SCENE_STATE.기록순위)
            }}
            onCancel={() => setRecordPick(null)}
          />
        )
      }
      // 메뉴 객체 this+0x74 의 커서 — 관리 메뉴에서 들어오면 0 (0x4d58), 하위 화면에서 돌아오면 남는다
      cursor={session.menuCursors.seasonInfo}
      onCursorChange={(index) => actions.moveMenuCursor('seasonInfo', index)}
      onSelect={(entry) => {
        const { action } = entry
        // 칸 0 구단정보 0xd5 · 칸 1 아이템 0xd6
        if (action.kind === '상태') return actions.goto(action.target)
        // 칸 3 — this+0x16c = 1(타자기록) · 창 0x80
        if (action.kind === '기록순위창') return setRecordPick('타자')
        // 칸 2 — this+0x110 = 2 · 0xdf. 이전 상태가 0xcd 라 탭은 1(투수)
        setPlayerPick({ purpose: PLAYER_PICK_PURPOSE.선수정보, tab: ENTRY_TAB.투수, cursor: 0 })
        actions.goto(SEASON_SCENE_STATE.선수고르기)
      }}
      onBack={backToManagement}
    />
  )
}
