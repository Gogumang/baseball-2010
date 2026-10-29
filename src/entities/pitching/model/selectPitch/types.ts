import type { Pitch, PitcherAbility, PitcherRepertoireInfo } from '@/entities/pitching/model/pitch'
import type { PitchPatternDifficulty } from '@/shared/config/original/pitchPatterns'
import type { CountSituation } from '@/entities/pitching/model/pitchIntelligence'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import type { MagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'

export interface PitchSituation extends CountSituation {
  readonly batterSide: number
  /** 화면 배치 side */
  readonly side: number
  /** 2루 주자가 있는가 (0xa97a1(_, 2)) — 실투 판정 0x33cbc 의 투수 비트 17 새가슴 조건. 안 넘기면 없음 */
  readonly hasSecondBaseRunner?: boolean
}

/** CPU 가 공을 던진다 */
export interface CpuPitchThrow {
  readonly kind: '투구'
  readonly pitch: Pitch
  /**
   * 구질 번호 1~22 (`game+0xfc8`) — 공이 손을 떠날 때(0x3de10 의 0x3dec6) `0xa5e14(ctx, 구질)` 이
   * 상대 투수 투구 수·스태미나를 깎는 데 쓴다 (`pitchStaminaCostOf`, 0x66ef0).
   */
  readonly pitchTypeNumber: number
  /**
   * 실투 판정 0x33cbc 의 결과 (참이면 원본은 `[scene+0xf98].byte8 = 4`, 0x4deae).
   *
   * 실투면 원본 0x4dc78 이 그 자리에서(0x4debc~0x4df5e) 공을 한가운데로 놓는다 — `selectPitch` 가 따른다:
   *      4dec0  N(scene+0x109c) = 구질(scene+0xfc8) == 1 ? 0x12(18) : 0x14(20)
   *      4df1e  0x9e301(공, N) — 공+0x10(점 수)만 바꾸고 점 버퍼를 다시 잡는다
   *      4df22  목표점 = 표 0xcfbcc[scene+0x17e1](타자 좌우별 존 한가운데, (19415|20585, 1202, 29705))
   *      4df5e  0x9e3c9(공, 투수판 0xcfa8c, 그 목표점) — 실투가 아니어도 같은 자리에서 제구 오차 낸 점으로 부른다
   *    그래서 실투 공의 `plate` 는 (0, 0), `frameCount` 는 18 · 20 이다.
   *    CPU 타자가 칠 때의 쓰임(0x34334 강제 치기·0x340f8 K = 10000)은 사람 타석과 상관없다.
   */
  readonly isMistakePitch: boolean
}

/**
 * CPU 가 공 대신 **견제**를 건다 (0x34848 → 메시지 0x10, I-controls 4a-2). 공은 없다 —
 * 상태 0x11 예약(0x34888)도, 마구 소모(0x34894)·싣기(0x3de10)도 안 지난다.
 */
export interface CpuPickoffChoice {
  readonly kind: '견제'
  /** 견제할 루 1·2·3 — 주자가 있는 루가 나올 때까지 rand(1,4) 를 다시 굴려 얻은 것 */
  readonly base: 1 | 2 | 3
}

export type CpuPitchChoice = CpuPitchThrow | CpuPickoffChoice

/**
 * CPU 견제를 켜는 입력 — 원본 `0xa9878(주자관리, 루)` 자리. 그 루에 주자가 있는가.
 * `situation.runnerCount` 와 같은 루 상태에서 와야 한다(`isCpuPickoff` 가 그 수로 거른다).
 */
export interface CpuPickoffInput {
  readonly hasRunnerOnBase: (base: number) => boolean
}

/**
 * `selectPitch` 의 재료 묶음 — 원본은 세 틱(0xf 틱 0~8 · 0x10 틱 6 · 0x11 틱 10)에서 나눠 굴린다. 타석 화면은 그 틱에
 * 아래 세 함수를 따로 부른다(`widgets/batting-stage/model/useStageAnimation`). 인자 뜻은 `selectPitch` 와 같다
 */
export interface CpuPitchArgs {
  readonly pitcher: PitcherAbility
  readonly situation: PitchSituation
  readonly difficulty: PitchPatternDifficulty
  readonly magic?: MagicPitchGameState | undefined
  readonly cpuPickoff?: CpuPickoffInput | undefined
  readonly batterIntimidates: boolean
  readonly derbyPitchType?: number | undefined
}

/** 0x345fc 의 결과 — 목표점, 또는 견제(목표점을 안 만든다) */
export type CpuPitchAim = { readonly kind: '목표'; readonly target: WorldPoint } | CpuPickoffChoice

/** 교체 틱 구질 굴림의 재료 — **내려가는** 투수(교체는 0xaf09c 가 예약만 하고 맞바꿈은 다음 확정 0xaebe4 다) */
export interface PitcherChangeTickRoll {
  /** 지금 마운드 투수 레코드 +0x1c · +0x18 — 구질 목록 scene+0xfac 는 그 투수로 채워져 있다(0x47fc4) */
  readonly repertoire: Pick<PitcherRepertoireInfo, 'pitchMask' | 'magicId'> | undefined
  /**
   * 그 투수 팀의 남은 마구 0xaea11(팀) — 타자편 진행기는 `opponentCpuMagic`(0xd 진입 48ddc 의 0xaebe4 aeea8 이 채운 값)로, 타자 미션은
   * 미션 CPU 팀이 든 +0x28(`missionCpuMagicStateOf`)로 넘긴다.
   * 안 넘기면 "남았다(1)" 로 본다 — 마구 칸이 있고 마구 조건(주자 2+ · 2스트라이크 · 0-0 · 0-3)일 때만 결과가 갈린다
   */
  readonly magicRemaining?: number
  readonly runnerCount: number
  readonly strikes: number
  readonly balls: number
}
