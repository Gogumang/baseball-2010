import { useEffect, useRef } from 'react'
import type { SoundPort } from '@/shared/api/audio/soundPort'

/** 시즌 트레이닝 0xcf · 그 연출 0xde (웹은 0xde 를 0xcf 화면 안 결과 팝업으로 갈음한다) */
const SEASON_TRAINING = 0xcf

const SEASON_TRAINING_EFFECT = 0xde

/** 시즌 관리 메뉴 상태 0xc9 · 장면 생성 뒤 첫 상태(진입 분기) 0xcb · 팀 고르기 0xca */
const SEASON_MANAGEMENT_MENU = 0xc9

const SEASON_ENTRY_BRANCH = 0xcb

const SEASON_TEAM_SELECT = 0xca

/** 팀 고르기 0xca 진입 0x50a8 의 배경음 — 50a8~50ba `0x6ea6d(소리, 3, −1, 1)` 조건 없이 (모드 준비 배경음) */
const SEASON_TEAM_SELECT_BGM = 3

/** 관리 메뉴 배경음 (`0x6ea6d(소리, 4, −1, 1)`) */
const SEASON_MANAGEMENT_BGM = 4

/**
 * 시즌 관리 메뉴 0xc9 의 틀 0x73b8 이 배경음 4 를 트는 이전 상태 (0x73c2~0x73ea 직접 떴다):
 * ```
 * 0x73ba  [sm+0x2c](상태 틀 수) == 2 일 때만
 * 0x73c2  이전 상태 ∈ {0xcb, 0xcc, 0xe3, 0xde, 0xf9, 0xe4, 0xe6, 0xe5, 0xd3, 1}
 * 0x73ec  0x6ea6d([0x1400058], 4, −1, 1)   ; 배경음 4 반복 즉시 재생
 * ```
 */
const SEASON_MENU_BGM_FROM: ReadonlySet<number> = new Set([0xcb, 0xcc, 0xe3, 0xde, 0xf9, 0xe4, 0xe6, 0xe5, 0xd3, 1])

/**
 * 웹이 원본 상태를 건너뛰는 자리 — 원본에서는 아래 상태가 위 목록의 상태를 거쳐 0xc9 에 온다.
 * - 0xca 팀고르기 · 0xc8 팀결정확인: 웹은 곧장 0xc9 로 간다. 원본은 0xcc(새 시즌 초기화) → 0xcb → 0xc9.
 * - 0xcf 트레이닝: 웹은 0xde 연출과 결과 팝업을 0xcf 화면 안에서 띄우고 닫으면 0xc9 로 간다(원본 0xde → 0xc9 — 4 를
 *   처음부터 다시 튼다). 결과 팝업이 섰던 0xcf 는 0xde 로 본다(`useSeasonMenuBgm` 의 `trainingShown`). 취소로 돌아오는
 *   0xcf → 0xc9 는 목록 밖이라 안 부른다 — 0x6ea6c 는 같은 번호도 처음부터 다시 트니 이 둘이 갈린다.
 * - 0xe1 경기: 원본은 경기 장면 0x104 를 나와 장면 0x105 를 새로 지으므로 0xcb 를 지난다.
 */
const SEASON_MENU_BGM_WEB_STAND_INS: ReadonlySet<number> = new Set([0xca, 0xc8, 0xe1])

/**
 * 관리 메뉴 0xc9 에 들어설 때 틀 배경음 — 이전 상태가 목록에 들면 4, 아니면 null(안 바꾼다).
 * `previous` 가 null 이면 시즌 장면에 막 들어선 때다 — 원본은 장면 생성 0x3b14 의 첫 상태가 진입 분기 0xcb 다.
 */
export function seasonMenuBgmOf(previous: number | null): number | null {
  const from = previous ?? SEASON_ENTRY_BRANCH
  return SEASON_MENU_BGM_FROM.has(from) || SEASON_MENU_BGM_WEB_STAND_INS.has(from) ? SEASON_MANAGEMENT_BGM : null
}

/**
 * 시즌 상태에 들어설 때 그 상태가 트는 배경음 — 0xc9 는 틀 0x73b8 이 이전 상태를 보고 4(`seasonMenuBgmOf`), 0xca 는 진입 0x50a8 이
 * 조건 없이 3. 그 밖 상태의 소리(0xd3 40 · 0xe9 징글 · 0xef 4 · 0xf1 4 · 0xf5 46/52)는 세션이 그 자리에서 낸다. null 이면 안 바꾼다.
 */
export function seasonSceneBgmOf(previous: number | null, scene: number): number | null {
  if (scene === SEASON_TEAM_SELECT) return SEASON_TEAM_SELECT_BGM
  if (scene === SEASON_MANAGEMENT_MENU) return seasonMenuBgmOf(previous)
  return null
}

/**
 * 시즌모드(장면 0x105) 상태 진입의 배경음 — 관리 메뉴 0xc9 의 4(틀 0x73b8, 이전 상태를 보고 **한 번**) · 팀 고르기 0xca 의 3(진입 0x50a8).
 * 최상위 화면 표는 '시즌모드' 에 배경음이 없다(null) — 장면에 들어선 첫 상태가 무엇이냐(0xcb 진입 분기 0x4b50)로 갈린다.
 * 둘 다 0x6ea6c 라 같은 번호가 울려도 처음부터 다시 튼다(0xca 를 다시 지나면 3 이 다시 운다).
 */
export function useSeasonMenuBgm(
  sound: SoundPort,
  isActive: boolean,
  scene: number,
  /** 0xcf 화면 안에 팀 트레이닝 결과 팝업이 섰다 — 원본은 그때 0xde 다 */
  trainingShown = false,
): void {
  /** 앞 틀의 상태 — 시즌모드가 아니었으면 null */
  const previousRef = useRef<number | null>(null)
  useEffect(() => {
    const previous = previousRef.current
    previousRef.current = !isActive ? null : scene === SEASON_TRAINING && trainingShown ? SEASON_TRAINING_EFFECT : scene
    if (!isActive || previous === scene) return
    const bgm = seasonSceneBgmOf(previous, scene)
    if (bgm !== null) sound.playBgm(bgm)
  }, [sound, isActive, scene, trainingShown])
}
