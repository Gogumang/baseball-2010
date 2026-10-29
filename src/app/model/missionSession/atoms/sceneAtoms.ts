import { atom } from 'jotai'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import type { HalfInningFielderRoll } from '@/features/play-game/model/halfInningBoard'

/** 장면 흐름 칸 atom — 0xe 대기 · 첫 0x18 판 · 로딩 판 · 교체 연출 · 하늘 줄 */

/**
 * **상태 0xe 의 OK 대기** (`features/play-game/model/sceneConfirm`) — 미션(모드 5·6)도 보통 경기 장면 0x104 라 새 타석마다
 * 0xd → 0xe 를 지나 사람 OK 를 기다린다(0x39e14 · 0x532b0 에 모드 갈림 없음). 미션 시작(0x18 판 뒤)·타석이 끝난 뒤·
 * 3아웃으로 끊긴 뒤마다 새 객체를 싣는다. 화면(`MissionPlayScreen`·`PitchingScreen`)이 `useSceneConfirm` 으로 받는다.
 * 제한 시간은 그 동안에도 흐른다 — 모드 5·6 의 0xaada4 는 장면 상태 갱신 뒤(0x52ed0) 상태를 안 가리고 돈다.
 */
export const sceneConfirmAtom = atom<SceneConfirmWait | null>(null)
/**
 * 새 타석의 0xe 대기 — 이 대기가 OK 를 받으면(메시지 1 → 0xf 진입 0x3d954) CPU 교체를 묻는다(`confirmScene`).
 * 그 뒤 교체 연출이 다시 세운 대기는 0xf 재진입이 state[0xd] · state[0xe] 로 굴림 없이 지나므로 묻지 않는다. (그림에 안 쓰는 칸)
 */
export const newAtBatWaitAtom = atom<SceneConfirmWait | null>(null)

export interface HalfInningBoard {
  readonly serial: number
  readonly inning: number
  readonly half: '초' | '말'
  /** 판 틱 0 의 0x3fac4 굴림 36 개 — 운동장 전경 0x4fb8c (`rollHalfInningFielders`) */
  readonly fielderRolls: readonly HalfInningFielderRoll[]
}
/**
 * **미션 시작의 첫 0x18 판** — 상태 8 끝(48bf0)이 인트로 없이 0x18 로 보내고, 첫 반 이닝이 사람 몫이면(0xc2198 거짓 —
 * `missionFirstHalfIsHuman`) 판이 서서 OK 를 기다린다. 틱 0 의 4fb20 0x3fac4 가 굴림 36 개를 쓴다(세울 때 굴린다).
 * OK(메시지 1 인자 0x18) → 0xae3a0 → 0xd → 0xe. 판이 서 있는 동안 0xe 대기는 없다. 3아웃 뒤 0x18 은 늘 0x21 이라(Q2 2e-2) 이 판은
 * 미션 한 판에 이 하나뿐이다. `serial` 은 판마다 새로.
 */
export const halfInningBoardAtom = atom<HalfInningBoard | null>(null)
/** 판 번호를 센다 (그림에 안 쓰는 칸) */
export const halfInningBoardSerialAtom = atom(0)
/**
 * **경기 장면 로딩 판** — 상태 7 진입 0x39f88 이 로딩 판(0x667f8 — loadingbar.pzx · StrTIP)을 세우고 0x53dbc 가 팁 칸
 * +0x315 = rand(0, 73)을 굴린다. 상태 7 · 9 · 8 의 적재가 한 단계씩 0x54128(진행 칸 +0x10 += 1, 끝 +0x14 = 0x24)과 그리기
 * 0x53e04(StrTIP[1 + +0x315] · 진행 막대 · 막대 끝의 달리는 선수)를 부른다. 서 있으면 라우트가 로딩 판(`LoadingTip`)을 그리고,
 * 다 그리면 `actions.finishLoading` 으로 내린다 — 그 뒤 첫 0x18 판(인트로 0xc 없음, 48bf0). 굴림은 세울 때 이미 썼다.
 */
export const loadingTipAtom = atom<string | null>(null)
/**
 * **교체 연출 0x16** (`features/play-game/model/substitutionScene`) — 0xf 진입이 CPU 교체를 내면 싣고, 화면이 "CHANGE" 애니를
 * 다 그리면(`finishSubstitutionScene`) 내린다. 서 있는 동안 화면은 0xe 대기를 세지 않는다(0x16 → 0xd → 0xe).
 */
export const substitutionSceneAtom = atom<SubstitutionScene | null>(null)
/**
 * **하늘 줄 — 구장 +0x10** (0x783b0, `stadiumSkyRowOf`). 미션(모드 5 · 6)은 그 밖 갈래라 rand(0, 6) — 경기 적재(상태 8 갱신
 * 0x48658 의 48774 → 구장 준비 0x352e8(354d2))가 **장면마다 한 번** 굴리고 정산 결과 그림까지 같은 줄이다. 차례는 상태 7 장면 초기화
 * (0x3e340 — 패턴 덱 0xb08e8) → 상태 9 경기 시작 꼬리(0x3fa0e — 0xc0dac rand(0, 2)) → 상태 8 **뒤**다 — 갱신 표 0x52e2a 7 → 0x3e340 ·
 * 0x52e3a 9 → 0x3f584 · 0x52e32 8 → 0x48658, 예약 3efe6(상태 7 끝) → 9 · 3fa5e(상태 9 끝) → 8.
 */
export const skyRowAtom = atom(0)
