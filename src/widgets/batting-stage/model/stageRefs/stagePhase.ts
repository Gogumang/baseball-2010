import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'

/** 원본 경기 상태 — 대기·투구중 0xf/0x11 · **타격 0x13** · 결과 0x12/0x17 */
export type StagePhase = '대기' | '투구중' | '타격' | '결과'

export type StageHud = StageScene['hud']

export interface AcePitcherFrames {
  readonly framesUrl: string
  readonly frameCount: number
  readonly stillUrl: string
  /**
   * 마투수 순번 `0xb63a0(투수)` (0~4) — 0x35650 이 투수 그림 객체 +0x24 에 적어 단계 표(유지 0xd73fa · 프레임 0xd7483 ·
   * 마지막 0xd744f)와 놓는 단계(0xcfbe4)를 고른다 (`stageScenery` 의 투수 그림 객체)
   */
  readonly order: number
}

/** 마투수 한 명의 그림 재료 — 순번은 `ACE_PITCHERS`(XlsACE_PIT_DATA 줄 차례 = 0xb63a0) 의 칸이다 */
export function acePitcherFramesOf(player: AcePlayer): AcePitcherFrames {
  return {
    framesUrl: player.framesUrl,
    frameCount: player.frameCount,
    stillUrl: player.stillUrl,
    order: ACE_PITCHERS.indexOf(player),
  }
}

/** 번트 자세 — 종류와 누른 순간의 공 프레임 (0x53670 토글) */
export interface BuntStance {
  readonly kind: number
  readonly frame: number
}

/**
 * **스윙 예약** — 0x51db6 · 0x51dee 가 적는 경기+0xfe0 = 1 · +0xfd8 = 키 틱 F · S+0x10(필살).
 * 다음 갱신(F + 1, 0x4e0ce)에서 풀려 스윙이 나가고, F + 2 에 깊이를 보고 판정(0x6aa)한다.
 */
export interface SwingReservation {
  /** 키 틱 F (+0xfd8) — 판정 타이밍 0x34be0 이 읽는다 */
  readonly frame: number
  /** 필살 스윙(S+0x10 ≠ 0) */
  readonly isSpecial: boolean
  /** 스윙이 나갔다(0xb9374) */
  readonly isReleased: boolean
  /** 판정 틱에 공이 타자 근처가 아니어서 0x6aa 를 안 탄 헛스윙(0x4e21c) */
  readonly isUnjudgedWhiff: boolean
}
