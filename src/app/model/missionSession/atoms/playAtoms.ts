import { atom } from 'jotai'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { LiveRunnerPlay } from '@/features/defense-play/model/liveRunnerPlay'
import type {
  MissionArrivalContext,
  MissionHeldResult,
  PendingMissionDefense,
  PitcherArrivalContext,
} from '@/app/model/missionSession/types/missionPlayTypes'

/** 판 위 붙든 것 atom — 수비 화면 · 주자 판 · 재생 · 붙든 타석 결과. 콜백도 이 칸을 본다(옛 `xxxRef` 몫도 이 칸이다) */

export const pendingDefensePlayAtom = atom<PendingMissionDefense | null>(null)
/**
 * 다 돌려 놓은 주자 판 하나 — CPU 견제(종류 4) · 공 도착 판(0x3dfac 종류 5 도루 · 9 폭투·포일).
 * 화면이 재생을 마치면 비운다 (`actions.finishPickoffReplay`)
 */
export const pickoffReplayAtom = atom<DefensePlayResult | null>(null)
/**
 * **사람 주루 키를 받으며 실시간으로 도는 주자 판** — 타자 미션의 도루(종류 5) · 폭투·포일(종류 9) · CPU 견제(종류 4).
 * 상태 0x17 키 0x53420 은 조작 [+0xc] == 0(사람 공격)이면 판 종류를 안 보고 주루 0x5331c(0x582 진루 · 0x584 귀루 → 0xa9b04)와
 * OK 슬라이딩 0x585 를 보낸다 — 미션(모드 6)도 같은 경기 장면 0x104 다. 화면이 한 틱씩 돌리고 `actions.finishRunnerPlay` 가 잇는다.
 * 밀어내기(종류 2)는 0xae794 마스크 0x232 · 0x518da 가 둘 다 막아 미리 돌린다
 */
export const pendingRunnerPlayAtom = atom<LiveRunnerPlay | null>(null)
/**
 * **붙든 볼넷 · 사구 · 삼진** — 0x12 대기(`'wait'`) · 벤치 클리어링 진입 앞(`'entry'`) · 연출 중(`'scene'`, 상태 0x1e)
 * (`HitByPitchHoldPhase`, A-22).
 * 원본 미션(모드 5 · 6)도 보통 경기 장면 0x104 라 상태 0x12 갱신 0x4e6d4 의 끝 0x4e72c~0x4e776 을 그대로 탄다:
 * 상태 갱신 표(0x52c50 52cee)는 상태 번호로만 고르고, 0x4e6d4 가 거르는 것은 플레이 종류 8(홈런더비, 0x4e740)과 사구 아님(0x4e748)뿐
 * 모드를 읽지 않는다. 진입 0x3a5f0 도 모드·미션 칸을 안 본다 → 연출과 그 전역 rand(진입 45 · 틱 10 의 8)가 미션에서도 돈다.
 * 공이 도착하면 굴림 없이 붙들고, 화면이 0x12 틱 31 에 `judgeHitByPitch`(4e74c 굴림 — 안 들어가면 판정 A 의 보통 길)를,
 * 들어갔으면 다음 틀에 `enterBenchClearing`(굴림 45 번)을 부른다. 출구 0xae24c 뒤에야 보통 길(밀어내기·정산)을 간다
 * — `finishBenchClearing`.
 * - `'투수'` — 투수 미션 · 투수편 마선수 대결: 볼넷 · 사구 · 판 없는 삼진(r289 · r295 · r298).
 * - `'타자'` — 타자 미션 · 타자편 마선수 대결: 볼넷 · 사구(r298). 들어가면 수비가 CPU 라 0x3ab82 CPU 마운드 +0x27c += 10.
 *   삼진은 정산 굴림이 없어 붙들지 않는다(타석 정산 `applyMissionOutcome` 은 난수를 안 쓴다).
 */
export const pendingBenchClearingAtom = atom<MissionHeldResult | null>(null)
/** 붙든 공 도착 판이 끝나면 그 공의 나머지(`settleMissionArrivalPlay`)가 쓸 값 (그림에 안 쓰는 칸) */
export const missionArrivalContextAtom = atom<MissionArrivalContext | null>(null)
/** 투수 미션의 붙든 공 도착 판이 끝나면 그 공의 나머지(`finishPitcherMissionArrival`)가 쓸 값 (그림에 안 쓰는 칸) */
export const pitcherArrivalContextAtom = atom<PitcherArrivalContext | null>(null)
