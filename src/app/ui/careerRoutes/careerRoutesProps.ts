import type { Screen } from '@/app/model/screen'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { useCareerSession } from '@/app/model/useCareerSession'
import type { useGameSettings } from '@/app/model/useGameSettings'
import type { Collection, HallOfFameResult } from '@/entities/collection/model/collection'
import type { HallOfFameNariPlayer } from '@/pages/special/ui/SpecialScreen'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MatchCommand } from '@/pages/story/model/useEventPlayback'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { StoryContext } from '@/app/model/useStorySchedule'

export type AceMatchStarter = (command: MatchCommand, carried: StoryCarry, context: StoryContext) => void

export interface CareerRoutesProps {
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  readonly session: ReturnType<typeof useCareerSession>
  readonly runner: AtBatRunner
  readonly random: RandomPort
  /** 커리어가 있는 화면만 이 컴포넌트로 온다 — App이 먼저 걸러준다. */
  readonly career: PlayerCareer
  /** 명예의 전당 등록 목록 (나리 상태 145) — 기록연감·나리 투수편 저장·등록 (G·통계는 App 이 지갑으로 치른다) */
  readonly hallOfFame: {
    readonly collection: Collection
    /** 칸 0 나리 투수 — 투수편 저장이 있으면 (0x5eb8c 의 g+0x43 · 0x1fbd0) */
    readonly nariPitcher: HallOfFameNariPlayer | null
    readonly register: (career: PlayerCareer, slot: number | null) => HallOfFameResult['kind']
    /**
     * 완료 창(꼬리표 0x30)을 닫았을 때 0x1ca4c 가 여는 히든 17(전광판 "고대의전광판") — 열고 알림을 띄웠으면 참이고
     * 그 창을 닫을 때 `then` 을 부른다 (`SpecialScreen` 등록 모드의 같은 이름 머리말)
     */
    readonly openRegisteredHidden?: (then: () => void) => boolean
    /** 전역 G(`mgr+0x64`) — 등록 목록(상태 145) 머리띠 0x54d95 가 그린다 */
    readonly gamePoint?: number
  }
  readonly onAceMatch: AceMatchStarter
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정 — 안 넘기면 그 칸이 잠긴다 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  /** 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`) — 마선수 대결 경기(`GameRoute`)가 본다 */
  readonly aceLevels?: Readonly<Record<number, number>>
}
