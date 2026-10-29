import type { ReactNode } from 'react'
import { ITEM_WINDOW_KIND } from '@/widgets/season/lib/seasonItemMenu'
import { StadiumShopScreen, SeasonItemShopScreen, SeasonStaminaPickScreen } from '@/pages/season'
import { SEASON_STAMINA_ITEM } from '@/entities/season-mode/model/seasonItemShop'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { seasonPlayerRecordOf } from '@/entities/season-mode/model/seasonPlayerRecord'
import { withEntryCells } from '@/app/ui/seasonRoute/entryCells'
import type { SeasonBranchInput } from '@/app/ui/seasonRoute/branchInput'

/** 기록연감 해금표에서 히든 팀이 쓰는 마지막 번호 (팀 10~14) */
const LAST_HIDDEN_TEAM_ID = 14

// 아이템 상점 0xdc 종류 1·2 (키 0x957c · 적용 0x7d90) — 취소는 아이템 메뉴 0xd0 (0x9be8)
export function itemShopBranch({ scene, state, session, actions, shopKind, setShopKind, shopCursor }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.아이템상점 || shopKind === null) return null
  return (
    <SeasonItemShopScreen
      key={`${shopKind}-${shopCursor}`}
      kind={shopKind}
      record={state.record}
      teamMorale={state.teamMorale}
      gamePoint={session.gamePoints}
      initialCursor={shopCursor}
      onBuySubItem={actions.buySeasonSubItem}
      onBuyGpItem={(slot) => {
        const text = actions.buySeasonGpItem(slot)
        // 칸 3 십전대보탕 — 0x7d90 0x8012: 상태 0xe8 로
        if (text === null) actions.goto(SEASON_SCENE_STATE.스태미나회복)
        return text
      }}
      onBack={() => {
        setShopKind(null)
        actions.goto(SEASON_SCENE_STATE.아이템)
      }}
    />
  )
}

// 십전대보탕 투수 고르기 0xe8 (들어옴 0x5870 · 키 0x7c00) — 취소·회복 뒤 0xdc(GP 창 커서 3)
export function staminaPickBranch({ scene, state, session, actions, aceSelect, setShopKind, setShopCursor }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.스태미나회복) return null
  const recordOf = session.recordSource()
  return (
    <SeasonStaminaPickScreen
      teamId={state.record.teamId}
      // 0x5870 — 내 팀 레코드(로테이션으로 섞인 차례). 0xb512c 를 안 불러 레코드에 남은 마선수 줄도 보인다 (U-105 r154)
      roster={session.tradeRoster}
      recordAces={session.myRecordAces}
      {...(aceSelect === undefined ? {} : { aceLevels: aceSelect.levels })}
      nameOf={(player, isPitcher, index) => seasonPlayerRecordOf(state.record.teamId, player, isPitcher, index, recordOf).name}
      {...withEntryCells(session.entryCellSourceOf(state.record.teamId))}
      state={state}
      gamePoint={session.gamePoints}
      onPick={actions.recoverSeasonPitcherStamina}
      onBack={() => {
        setShopKind(ITEM_WINDOW_KIND.GP아이템)
        setShopCursor(SEASON_STAMINA_ITEM)
        actions.goto(SEASON_SCENE_STATE.아이템상점)
      }}
    />
  )
}

export function stadiumShopBranch({
  scene,
  state,
  session,
  actions,
  hallOfFame,
  stadiumPreviewScene,
  setStadiumPreviewScene,
  backToTeamMenu,
}: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.구장관리 && scene !== SEASON_SCENE_STATE.아이템상점) return null
  return (
    <StadiumShopScreen
      record={state.record}
      mode={scene === SEASON_SCENE_STATE.구장관리 ? '구장관리' : '상점'}
      gamePoint={session.gamePoints}
      // 히든 칸 해금 플래그 `app[0xe0 + 종류×4 + (칸−4)]` (S3 7절) — 전역 저장 칸이라
      // 시즌 레코드가 아니라 세션이 들고 있다. 안 넘기면 히든이 영영 안 열린다
      // 나리 명전 등록(0x1ca4c)이 연 전광판 17 은 기록연감의 전역 해금표에 든다. 그 표는 히든 팀을 팀 번호 10~14 로 들어
      // 관중석 13 · 14 와 번호가 겹치므로 거기서는 15 이상만 읽는다
      isHiddenOpen={(unlockId) =>
        session.openedStadiumIds.includes(unlockId) || (unlockId > LAST_HIDDEN_TEAM_ID && (hallOfFame?.openedHiddenIds ?? []).includes(unlockId))
      }
      onUnlock={actions.openStadiumItems}
      onChange={actions.updateRecord}
      previewScene={stadiumPreviewScene}
      onPreviewSceneChange={setStadiumPreviewScene}
      // 상점(0xdc 종류 4) 취소는 아이템 메뉴 0xd0 (0x957c 종류 4 갈래 0x9aa2 → 0x9bd4~0x9bec)
      onBack={scene === SEASON_SCENE_STATE.구장관리 ? backToTeamMenu : () => actions.goto(SEASON_SCENE_STATE.아이템)}
    />
  )
}
