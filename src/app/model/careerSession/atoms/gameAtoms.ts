import { atom } from 'jotai'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { SceneStadium } from '@/features/play-team-game/model/sceneStadium'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import { EMPTY_AT_BAT_PITCH_TALLY, type AtBatPitchTally } from '@/features/play-at-bat/model/atBatPitchTally'
import type { ArrivalContext } from '@/app/model/careerSession/game/arrivalContext'

/** 경기 칸 atom — 지금 경기 진행과 그 경기 장면이 든 칸 */

/** 지금 경기 진행 — 캔버스 고리 · 콜백도 이 칸 하나를 본다(옛 `progressRef` 몫도 이 칸이다) */
export const progressAtom = atom<GameProgress | null>(null)
/**
 * 사람이 치르고 있는 국가대항전 경기 (상태 142 `0x1c46c`) — 경기가 끝나면 이 대회로 하루를 넘긴다.
 * 정규 경기일 때는 늘 null 이다. (그림에 안 쓰는 칸)
 */
export const cupGameAtom = atom<NationalCup | null>(null)
/** 경기 전 원작 로딩 화면에 띄울 팁. null 이면 로딩 중이 아니다. */
export const loadingTipAtom = atom<string | null>(null)
/**
 * 이 경기 장면의 하늘 줄 — 구장 +0x10 (0x783b0 모드 4 갈래: 나리 저장 +0xb2 = 리그 날짜 g mod 6, 굴림 없음). 경기를 세울 때 정하고
 * 타석 화면과 정산 결과 그림(0x4a384)이 같이 쓴다 (`stadiumSkyRowOf`)
 */
export const stadiumSkyRowAtom = atom(0)
/**
 * 이 경기 장면의 두 구장 객체 — 셋업 0x39fdc 모드 3·4 갈래(`nariSceneStadium`): 홈(측 1) 팀, 국가대항전이면 풀리그 2 · 결승 8.
 * 타석 펜스 프레임(+0x70)과 바닥 · 수비 바탕 팔레트 줄(+0xc). 정산 결과 그림도 같은 구장이다. 경기를 세우기 전엔 null
 */
export const sceneStadiumAtom = atom<SceneStadium | null>(null)
/**
 * 지금 타석의 공 수·연속 파울 (`atBatPitchTally`). 타석 결과(`AtBatState`)에 남지 않아 따로 든다 —
 * 타석이 끝나거나 경기를 세우거나 나갈 때 비운다. (그림에 안 쓰는 칸)
 */
export const pitchTallyAtom = atom<AtBatPitchTally>(EMPTY_AT_BAT_PITCH_TALLY)
/**
 * 지금 붙든 수비 판이 **파울 각 공 판**인가 (`startPlayerFoulPlay`) — 판이 파울로 닫히면 같은 타석이 이어지고, 낙구 전에
 * 잡히면(파울 뜬공 아웃) 이 타석에서 앞서 난 연속 파울 기록을 판 끝 정산과 함께 넘긴다.
 */
export const foulPlayAtom = atom(false)
/**
 * 붙든 공 도착 판(`progress.pendingRunnerPlay` — 사람 주루 키를 받는 도루 · 폭투 판)이 끝나면 `handlePitchResolved` 의 나머지가
 * 쓸 이 공의 값 — 판이 도는 동안 들고 있는다
 */
export const arrivalContextAtom = atom<ArrivalContext | null>(null)
