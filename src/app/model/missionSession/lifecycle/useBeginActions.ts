import type { OriginalMission } from '@/shared/config/original/missions'
import type { Screen } from '@/app/model/screen'
import { startMission } from '@/entities/mission/model/missionRun'
import { startPitcherMission } from '@/entities/mission/model/pitcherRun'
import type { MissionGameSetup } from '@/entities/mission/model/missionGame'
import { NO_ACE_MATCH_HOLD, isAceMatchHeld, type AceMatchHold } from '@/entities/mode-save/model/modeSave'
import {
  BATTER_EDITION_MODE,
  HALL_OF_FAME_BATTER_RECORD_SLOT,
  PITCHER_EDITION_MODE,
  UNFILLED_SPECIAL_SWING,
} from '@/app/model/missionSession/constants/missionConstants'
import type { MissionPlayScope, MissionScope } from '@/app/model/missionSession/atoms/missionScope'
import { missionRunAtom, pitcherAceMatchMissionAtom, pitcherRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { lastSideAtom } from '@/app/model/missionSession/atoms/recordAtoms'
import { batterSpecialSwingStoredAtom } from '@/app/model/missionSession/atoms/pitcherAtoms'
import {
  clearMatchScene,
  dropAutoRelay,
  openFirstHalfBoard,
  resetForNewMatch,
  rollMatchSceneStart,
} from '@/app/model/missionSession/lifecycle/matchStart'

/** 마선수 대결의 경기 세우기 재료 — 그 편 저장 팀을 모르면(저장 없음) 레코드 팀 그대로 둔다 */
function aceMatchSetupOf(originalMode: number, savedTeamId: number | undefined): MissionGameSetup {
  return savedTeamId === undefined ? {} : { aceMatch: { originalMode, savedTeamId } }
}

/**
 * **대기 중 보통 미션의 사람 칸 팀** — 0xaa57c aa6dc~aa728(직접 떴다): g[0x11f] || g[0x176] 이면 m = (s8) g[0xf6] — 2 면 시즌 SR 팀,
 * 3 · 4 면 0x1f8d5(저장, m) 나리 레코드 팀, 그 밖(140 이 지운 0)은 레코드 팀 그대로. 웹은 그 편 나리 커리어의 팀이다.
 * (g[0xf6] = 2 는 SYS 8 이 시즌에서 대기를 안 세워 대기와 함께 설 수 없다.)
 */
function heldAceMatchSetupOf(hold: AceMatchHold, nariTeamIds: MissionScope['nariTeamIds']): MissionGameSetup {
  if (!isAceMatchHeld(hold)) return {}
  if (hold.originalMode === BATTER_EDITION_MODE) return aceMatchSetupOf(BATTER_EDITION_MODE, nariTeamIds?.batter)
  if (hold.originalMode === PITCHER_EDITION_MODE) return aceMatchSetupOf(PITCHER_EDITION_MODE, nariTeamIds?.pitcher)
  return {}
}

/** 레코드 칸 k 를 넘길 때만 싣는다 */
const recordSlotSetupOf = (nariRecordSlot: number | undefined) => (nariRecordSlot === undefined ? {} : { nariRecordSlot })

/** 미션 · 마선수 대결을 세우는 액션 — 새 경기 장면(상태 7 → 9 → 8 → 첫 0x18 판)을 지난다 */
export function useBeginActions(scope: MissionPlayScope) {
  const { atoms, runner, random, audio, setScreen, aceMatchHold, nariTeamIds, nariBatterRecordSlot, pick } = scope
  const hallOfFameBatter = pick.hallOfFameBatter
  return {
    begin: (mission: OriginalMission) => {
      atoms.set(lastSideAtom, mission.side)
      resetForNewMatch(atoms, runner, random, audio, mission)
      // 목록에서 고른 보통 미션 — 투수편 대결 표시는 내린다
      atoms.set(pitcherAceMatchMissionAtom, null)
      // 0xaa57c aa6dc~aa728 — 대기(g[0x11f] · g[0x176])가 서 있으면 보통 미션도 사람 칸을 g[0xf6] 편 나리 저장의 팀으로
      const heldSetup = heldAceMatchSetupOf(aceMatchHold?.read() ?? NO_ACE_MATCH_HOLD, nariTeamIds)
      if (mission.side === '투수') {
        const started = startPitcherMission(mission, heldSetup)
        atoms.set(pitcherRunAtom, started)
        openFirstHalfBoard(atoms, random, started)
        setScreen({ kind: '투수미션', mission })
        return
      }
      // 0xaa57c aa7b0 — 미션 타자(0x1fc20: 명예 타자 또는 나리 타자편 저장 선수)가 드는 레코드 칸 k = +0xa & 0x1f
      const nariRecordSlot = hallOfFameBatter !== null ? (hallOfFameBatter.recordSlot ?? HALL_OF_FAME_BATTER_RECORD_SLOT) : nariBatterRecordSlot
      const started = startMission(mission, { ...heldSetup, ...recordSlotSetupOf(nariRecordSlot) })
      atoms.set(missionRunAtom, started)
      openFirstHalfBoard(atoms, random, started)
      setScreen({ kind: '미션진행', mission })
    },

    /** 이벤트 match — 공략 레코드를 치르고 결과 이벤트로 돌아간다 (이기면 정산이 클리어 칸을 올린다) */
    beginAceMatch: (mission: OriginalMission, pending: Omit<Extract<Screen, { kind: '마선수대결' }>, 'kind' | 'mission'>) => {
      atoms.set(batterSpecialSwingStoredAtom, UNFILLED_SPECIAL_SWING)
      // 시작 상황은 0x18 앞(48c86 0xaae7c aaf10) — 0xe 대기는 첫 0x18 판 OK 뒤 (`resetForNewMatch` 와 같다)
      clearMatchScene(atoms, runner, mission)
      dropAutoRelay(atoms)
      // 마선수 대결도 미션 장면(모드 6)으로 나간다 — 로딩 팁 · 장면 덱 · 시뮬 초기화 · 플레이 시계 · 하늘 줄 (`resetForNewMatch` 와 같다)
      rollMatchSceneStart(atoms, random, audio)
      // 0xaa57c aa6e0 — g[0x11f] 가 서 있고 g[0xf6] = 4(나리 타자편, SYS 8 0x8d836) → 사람 칸 = 타자편 저장 팀
      // 0x1fc20 은 g[0x11f] 면 명예 타자 갈래를 안 타 늘 나리 타자편 저장 선수 — k 도 그 선수 +0xa & 0x1f
      const started = startMission(mission, {
        ...aceMatchSetupOf(BATTER_EDITION_MODE, nariTeamIds?.batter),
        ...recordSlotSetupOf(nariBatterRecordSlot),
      })
      atoms.set(missionRunAtom, started)
      // 상태 8 끝 → 첫 0x18 판(사람 몫이라 판 · 굴림 36)
      openFirstHalfBoard(atoms, random, started)
      setScreen({ kind: '마선수대결', mission, ...pending })
    },

    /**
     * **투수편 마선수 대결** — 투수편 장소 이벤트의 `match`(SYS 8, 0x8d7e8)가 고른 **투수 미션 레코드 team − 1**
     * (16~20 메디카·킹타이거·로제·크라이져·어거지죠, 목표 아웃 1 · 투구 5 · 실점·피안타·볼넷 한도 1)를
     * 미션 장면(모드 5)과 같은 투구 길로 던진다. 던지는 투수는 세션의 `pitcher` — 0x1fbd0 은 `+0x176 ≠ 0` 이면
     * 명예 투수 갈래를 안 타고 늘 나리 투수편 저장 [저장+0x3c] 선수다 (`modePitcherOf(투수편 career)`).
     * 상대 명부 0xb86e2 도 `+0x176` 이 서 있고 원래 모드(g[0xf6])가 시즌(2)이 아니면 기본 팀 명부라 보통 미션과 같다.
     *
     * 화면 전환은 하지 않는다 — 투수편 라우트가 `PitcherAceMatchRoute` 를 그린다.
     */
    beginPitcherAceMatch: (mission: OriginalMission) => {
      if (mission.side !== '투수') return
      resetForNewMatch(atoms, runner, random, audio, mission)
      // 0xaa57c aa6e0 — g[0x176] 이 서 있고 g[0xf6] = 3(나리 투수편, SYS 8 0x8d836) → 사람 칸 = 투수편 저장 팀
      const started = startPitcherMission(mission, aceMatchSetupOf(PITCHER_EDITION_MODE, nariTeamIds?.pitcher))
      atoms.set(pitcherRunAtom, started)
      openFirstHalfBoard(atoms, random, started)
      atoms.set(pitcherAceMatchMissionAtom, mission)
    },
  }
}
