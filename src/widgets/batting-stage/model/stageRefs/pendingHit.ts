import type { Pitch } from '@/entities/pitching/model/pitch'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { HitBallPath } from '@/widgets/batting-stage/lib/hitBallPath'
import type { SpecialSwingStageEffect } from '@/widgets/batting-stage/lib/specialSwingEffect'

/**
 * 상태 0x13 동안 손에 들고 있는 타격 결과 — 이 단계가 끝나야 인플레이(0x17)로 넘긴다.
 * 결과 문구·HOMERUN 글자도 여기서 꺼내므로 붙잡아 두는 동안에는 화면에 뜨지 않는다.
 */
export interface PendingHit {
  /** 붙잡아 둘 틱 수 (0x406a4 문턱 또는 틱 8) */
  readonly ticks: number
  readonly detail: PitchOutcomeDetail
  readonly pitch: Pitch
  readonly isUncatchable: boolean
  readonly isHomeRun: boolean
  /**
   * 큰 타구 멈춤이 풀리는 0x13 그림(틱 7)에 쏠 파티클의 화면 좌표 (0x4cb1c → 0x4cd14 의 `016.ptc`, `hitPause.HIT_STOP_TICKS`).
   * 감상 플래그 `+0x199a` 가 꺼진 타구면 null 이라 그 그리기 갈래(4cb76)를 안 탄다.
   */
  readonly bigHitAt: { readonly x: number; readonly y: number } | null
  /** 감상 플래그 `+0x199a` — 켜졌을 때만 OK·'5' 로 건너뛴다 (0x406e8 40708) */
  readonly watchesBigHit: boolean
  readonly resultText: string
  /** 이 공의 번트 종류 장면 +0xfdc (0 스윙 · 1~3 번트) — 인플레이로 넘길 때 함께 알린다 */
  readonly buntKind: number
  /**
   * 필살 스윙 연출 그림(0x49aec) — 상태 0x13 동안 타격점에 그림 애니 · 미라지 타자를 그린다 (`specialSwingEffect`).
   * 필살 갈래를 안 타는 스윙이면 null
   */
  readonly specialEffect?: (SpecialSwingStageEffect & { readonly x: number; readonly y: number }) | null
  /**
   * 보통 타격 불꽃(0x49e64 49faa~4a0a2) — game_effect 애니 2 · 3 을 타격점에 (`batterOverlayMarks`). 필살 그림 갈래 · 큰 타구면 null
   */
  readonly hitFlame?: { readonly animation: number; readonly x: number; readonly y: number } | null
  /**
   * 0x13 의 타구 공 경로 — 0x13 진입이 0x33e34 로 [경기+0xf2c] 공의 점을 옮겨 채운 +0x1140 (`hitBallPath`). 패턴을 모르면 null
   */
  readonly hitPath?: HitBallPath | null
  /** 0x13 꼬리선 0x3b188 을 긋는가 — 0x35988(강한 타구) || 0x357e0(결과 코드 24~26) (3b440~3b45c) */
  readonly showsHitTrail?: boolean
  /** 판정 각 s16 [+0xfcc] — 0x13 카메라 따라가기(0x3f060 3f23e, `hitCamera`)가 본다. 패턴을 모르면 null */
  readonly hitAngle?: number | null
}
