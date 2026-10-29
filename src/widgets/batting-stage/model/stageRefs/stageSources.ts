import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import type { MutableRefObject, RefObject } from 'react'

/** 경기 스킬 표시 판 재료 (`widgets/batting-stage/lib/skillPanel`) */
export interface SkillPanelSource {
  /**
   * **0xd 진입마다 새 값** — 그 타석의 0xe 대기 객체(`SceneConfirmWait`)를 넘긴다. 바뀐 뒤 첫 0xf 진입에서 0xd 진입 0x48d50 처럼
   * 두 비트를 다시 정한다(0xd · 0xe 동안은 판이 안 그려지고 상황도 안 바뀐다). null 은 무시한다
   */
  readonly entryKey: unknown
  /** st[9] — 공격 측(사람 타석이라 사람 팀 측). 함성 29 의 비트 칸을 고른다 */
  readonly attackSide: number
  /** 경기 장면 수명의 칸(`useSceneScopedRef`) — 비트 칸 skin+0x44c · 애니 7 · 8. 없으면 이 타석 화면이 사는 동안만 */
  readonly scene?: MutableRefObject<SkillPanelScene>
  /** 0xb6c20(st, st[0xa]) — 수비 측이 CPU 인가. 없으면 참(사람 타석) */
  readonly isDefenseCpu?: boolean
}

/**
 * 사람이 던지는 타석의 판 재료 (`PitcherSideStage.skillPanel`) — 지금 CPU 타자 레코드 · 마운드의 사람 투수 레코드.
 * 0xd 진입 0x445cc · 0x3d160 · 함성 29 는 사람이 치는 타석과 같은 함수다(모드 · 조작 갈래 없음 — 445cc · 3d160 · 4c26a).
 * `attackSide` 는 CPU 공격 측(st[9]), `isDefenseCpu` 는 없으면 거짓(투수 아이콘 칸 앵커 y − 0x4e, 4c098)
 */
export interface PitcherSideSkillPanelSource extends SkillPanelSource {
  /** 지금 CPU 타자 레코드 +0x14 의 장착 스킬 번호 (`0xb62b4(타자, n)`) */
  readonly batterSkillIds: readonly number[]
  /** 0xb6394(타자) = rec[0xa] & 0x1f — 투수 스킬 15 · 함성 비트 칸 */
  readonly batterRecordSlot: number
  /** 마운드 사람 투수 레코드 +0x14 의 장착 스킬 번호(비트 + 16) */
  readonly pitcherSkillIds: readonly number[]
  /** 그 타순 칸의 오늘 타석 결과 링(팀 + 타순×0x18 + 0x34, 0x53100) — 타자 스킬 16 · 17 */
  readonly recentAtBatCodes: readonly number[]
}

/** 경기 정산 0x4ea0c 의 효과를 고르는 재료 */
export interface SettlementEffectSource {
  /** 0x4a350 — 사람 팀이 이겼나 */
  readonly isWin: boolean
  /** 0xb69b0(st, 0) · (st, 1) */
  readonly side0Score: number
  readonly side1Score: number
  /** 하늘 표 칸(구장객체 +0x14) — 타석 하늘과 같은 이닝 */
  readonly inning: number
  /** 경기 난수 — 효과 깔기 · 틱 · 파티클 틱 */
  readonly random: RandomPort
  /**
   * 효과를 그릴 **판 쪽 캔버스 두 장** (`useSettlementEffectLayers`). 원본 그리기 차례 0x4a384 는
   * 배경(0x40ff0) → 진 판 덮개(4a404) → **효과 틱 0x4a452(비)** → 띠 · 승패 그림 · 판(4a448~) → 프레임 끝 **0x6dd69(파티클)** 라
   * 비는 덮개 위 · 띠 아래, 파티클(불꽃)은 판 맨 위다. 판이 DOM 이라 그 사이에 끼울 캔버스를 판이 깔고 타석 캔버스는 배경만 그린다.
   * 안 넘기면 둘 다 배경 캔버스(판 아래)에 그린다.
   */
  readonly layers?: SettlementEffectLayers
}

/** 정산 효과 층 — `rain` 은 진 판 덮개 바로 위, `particles` 는 판 맨 위에 판이 까는 240×320 캔버스 */
export interface SettlementEffectLayers {
  readonly rain: RefObject<HTMLCanvasElement | null>
  readonly particles: RefObject<HTMLCanvasElement | null>
}
