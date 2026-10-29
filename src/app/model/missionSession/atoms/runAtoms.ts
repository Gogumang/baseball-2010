import { atom } from 'jotai'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import type { MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import type { OriginalMission } from '@/shared/config/original/missions'

/** 판 칸 atom — 타자편 판 · 투수편 판 · 투수편 마선수 대결 표시 · 자동진행 중계. 콜백도 이 칸을 본다(옛 `missionRunRef` 몫도 이 칸이다) */

/** 타자 미션(모드 6) · 타자편 마선수 대결의 판 */
export const missionRunAtom = atom<MissionRun | null>(null)
/** 투수 미션(모드 5) · 투수편 마선수 대결의 판 */
export const pitcherRunAtom = atom<PitcherRun | null>(null)
/**
 * **투수편 마선수 대결로 연 투수 미션** — 아니면 null. 원본은 SYS 8(0x8d7e8)이 `g[0x175] = team − 1` ·
 * `g[0x176] = 1`(대기 표시)을 적고 미션 장면(모드 5)으로 나간다 (S13 4-1). 웹은 화면을 투수편 라우트가 그리므로
 * (`renderAceMatch`) 앱 화면(`screen`)을 '투수미션' 으로 바꾸지 않고 이 칸으로 대결 중임을 안다.
 */
export const pitcherAceMatchMissionAtom = atom<OriginalMission | null>(null)

/**
 * **자동진행 0x21 의 틱 묶음** — 사람 반 이닝이 3아웃으로 끝나면(`game.halfEnded`) 0x18 → 0x21 로 가서 갱신 0x48480 이 **틱마다**
 * 0xc2198 → 0xc262c 를 한 번 부른다(타석 하나 또는 교체 부름 하나). 웹은 중계 화면(`AutoPlayRelayScreen`)의 틱마다 `stepAutoRelay`
 * 가 이 묶음을 한 칸 굴린다(`batterMissionAutoTicks` · `pitcherMissionAutoTicks`) — 굴림이 그 틱에 나가고, 중계 도중 제한 시간이
 * 다 되면(0xaada4 → 실패) 다음 틱을 안 불러 남은 타석은 굴리지 않는다. 첫 틱에 그때 판으로 세운다. (그림에 안 쓰는 칸)
 */
export type AutoRelayTicks =
  | { readonly side: '타자'; readonly ticks: Generator<MissionAutoRelayStep, MissionRun, void> }
  | { readonly side: '투수'; readonly ticks: Generator<MissionAutoRelayStep, PitcherRun, void> }
export const autoTicksAtom = atom<AutoRelayTicks | null>(null)
/** 중계 칸 sim+0xb0 · +0xc4 — 마지막으로 굴린 틱의 중계 (`MissionAutoRelayStep`). 아직 안 굴렸으면 null */
export const autoRelayStepAtom = atom<MissionAutoRelayStep | null>(null)
