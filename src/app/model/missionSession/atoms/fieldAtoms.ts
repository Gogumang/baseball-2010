import { atom } from 'jotai'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import { SCENE_RESULT_CODE_START } from '@/features/defense-play/model/sceneResultCode'

/** 경기 장면 칸 atom — 결과 코드 · 수비 장면 칸 · 도루 출발(판 입력과 화면 표시) */

/**
 * 경기 +0xfd4 — 스윙 판정 결과 코드 칸(`features/defense-play/model/sceneResultCode`). 공마다 0x11 진입(3deea)이 0 으로 지우고
 * 휘두른 공만 판정(5130e)이 덮는다. 주자 판의 튐 파티클 · 홈런성 조건이 본다 — 견제는 앞 공의 값. 경기 장면을 새로 열면 0
 * (그림에 안 쓰는 칸)
 */
export const sceneResultCodeAtom = atom<number | null>(SCENE_RESULT_CODE_START)
/**
 * **수비 장면 칸** (`DefenseScene`) — 결과 판 · 연출 단계 · deadly_effect 애니 · 줌. 경기 장면 0x104 를 만들 때 한 번 만들어져
 * 판을 넘어 남는다. 미션도 판마다 이 칸을 넘기고(나리 · 팀 경기의 `defenseScene` 과 같다), 새 경기(장면 new)에서 비운다.
 * 플레이 객체 +0x160(사람 송구 목표)은 넘기지 않는다 — 0x17 진입 0x46418 이 부르는 판 시작 vt18 0xb27ec 가 종류 1·2·3·4·5·8·9
 * 모두 vt1c 0xb0edc 를 먼저 부르고 그 b0f66~b0f68 이 +0x160 = −1 을 적는다(종류 6·7 은 판 도중 0xb2bc4 만 쓴다) (그림에 안 쓰는 칸)
 */
export const missionSceneAtom = atom<DefenseScene | undefined>(undefined)
/**
 * **타자 미션: 이번 투구에 출발한 주자들의 루** — state[0x14 + 루]. 공이 나는 동안 키 '3'·'2'·'1' 로 쌓이고
 * (`actions.steal`, 난수 없음) 공이 도착하면(0x3dfac) 도루 판이 읽는다. 키와 같은 틱에 공이 도착할 수 있어
 * 판 입력 칸(`stealInputAtom`, 그림에 안 쓴다)과 화면 표시 칸(`stealingFromAtom`)을 따로 둔다.
 *
 * **화면 표시(st[0x15 + i] — 그 루 주자를 안 그린다)는 판정 때 지우지 않는다** (직접 재역어셈):
 * - 0xf 진입 `0x3d954` 3d966~3d976 — `for i in 0..3: st[0x14 + i] = 0 ; st[0xa4 + i] = 0`. 이 칸을 지우는 곳은 여기다.
 * - 판 시작 리드 `0x3d7b8` 3d8c6~3d8d2 — 판 종류가 **1(타구)** 일 때만 도루 주자의 st[0x14 + 루] = 0. 도루(5) · 폭투(9) ·
 *   밀어내기(2) 판은 안 지운다.
 * 그래서 공 도착 → 결과 띠 → 도루 판 재생 → (같은 타석이면 0xf, 새 타석이면 0xd · 0xe 를 지나 0xf) 까지 출발 루는 비어 보인다.
 * 새 타석 0xe 동안에는 출발 루에 새로 선 주자도 안 그린다(원본 그대로 — 0xe 그리기도 같은 칸을 본다).
 * 웹은 판 입력 칸은 판정 때 거두고(`takeStealingFrom` — 다음 공 전에 0xf 가 지우므로 같다), 표시는 0xf 진입(`askPitchSelection`)과
 * 타구 판 시작(`clearStealDisplay`)에서 지운다.
 */
export const stealingFromAtom = atom<readonly StealBase[]>([])
export const stealInputAtom = atom<readonly StealBase[]>([])
/**
 * **투수 미션: CPU 가 이번 공에 출발시킨 주자의 루** — 같은 칸 st[0x14 + 루](0x520de → 0xa9bd4)의 화면 표시.
 * 지우는 곳은 타자 미션과 같다(0xf 진입 3d966~3d976 · 타구 판 시작 0x3d7b8). 다만 투수 미션은 같은 타석 다음 공의 0xf 진입
 * (`askPitchSelection`)을 결과 0x12 를 기다리지 않고 공을 먹인 걸음에 바로 묻는다 — 그래서 0xf 진입은 `selectionEntered`
 * 로만 적고, 화면이 아직 공이 날거나 0x12 인 동안(`PitchingScreen` 의 `isPitchSceneBusy`)은 계속 숨긴다.
 * 새 타석이면 0xf 진입이 0xe 의 OK 뒤라 그때까지 숨긴다. 판정 입력은 이 칸이 아니라 공마다의 지역 값이다.
 */
export const pitcherStealDisplayAtom = atom<{
  readonly bases: readonly StealBase[]
  readonly selectionEntered: boolean
} | null>(null)
