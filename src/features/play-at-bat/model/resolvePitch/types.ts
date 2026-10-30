import type { SwingMode } from '@/entities/batting/model/swingResult'
import type { SwingSituation } from '@/entities/batting/model/swingSkills'
import type { SwingBoost } from '@/entities/batting/model/swingBoost'
import type { BattedContact } from '@/entities/batting/model/battedContact'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'

/** 스윙 입력 — 원본 컨트롤러 0x53670 */
export interface BattingSwing {
  /** 키 틱 F = 경기+0xfd8 (보이던 공 틱 + 1 — `widgets/batting-stage/lib/swingWindow.keyTickOf`). 판정은 F + 2 에 난다 */
  readonly frame: number
  /** 타자 좌우 이동 fe4 (−9~9, 3 단위) */
  readonly shift: number
  /** 0 스윙 · 1~3 번트 종류 */
  readonly buntKind: number
  /**
   * 필살타법 스윙인가 — 스윙 객체 `S+0x10`(필살 번호) ≠ 0 (0x51e40). '0' 키(메시지 0x6a6)는 일반 스윙
   * (0x6a5 → 0x51db6)과 똑같이 **그 틱에 스윙을 예약**하고 S+0x10 만 다르게 쓴다 — 따로 거는 단계는 없다.
   * 헛스윙 바람 소리를 8 대신 27 로 바꾸고 (0x51350), 맞으면 성공 굴림 0x34c74 를 한다. 안 넘기면 보통 스윙이다.
   */
  readonly isSpecial?: boolean
}

export interface BattingContext {
  readonly batter: BatterAbility
  /** 투구 엔진 눈금 0~100 */
  readonly pitcher: PitcherAbility
  readonly mode: SwingMode
  readonly batterSkillIds: readonly number[]
  readonly situation: SwingSituation
  /**
   * 타자·투수가 **육성·명전 선수**(rec[0xa] 비트7, `0xb6389`)인가 — 나리(모드 3·4)의 내 선수 보너스와 계수,
   * 투수 미션(모드 5)의 +100 을 켠다. 마선수(비트6)는 해당하지 않는다. 안 넘기면 거짓.
   */
  readonly isBatterOwnPlayer?: boolean
  readonly isPitcherOwnPlayer?: boolean
  /** 나리 연차 idx (0 = 1년차, 저장 레코드 +0xb3) — 내 선수 보너스를 깎는다. 안 넘기면 0 = 보너스 최대 */
  readonly careerYearIndex?: number
  /**
   * 이번 스윙·공의 **보정 구조체 0x34d6c** (필살타법 = 타자 쪽, 공에 실린 마구 = 투수 쪽).
   * 원본은 판정 바로 앞(0x51294)에서 매번 만든다 — 타석 화면이 `swingBoostOf` 로 채운다. 안 넘기면 0.
   */
  readonly swingBoost?: SwingBoost
  /**
   * 필살 성공 굴림(0x34c74)이 볼 값 — 고른 번호(+0x18)와 마타자 여부. `swing.isSpecial` 일 때만 쓴다.
   * 안 넘기면 번호 0 으로 보아 확률 0 (굴리지 않는다).
   */
  readonly specialSwing?: { readonly number: number; readonly isAceBatter: boolean }
}

export interface PitchOutcomeDetail {
  readonly resolution: PitchResolution
  /** 배트를 냈는가 (번트 포함). 미션 스윙 수 제한에 쓴다 */
  readonly hasSwung: boolean
  /** 번트 성공 타구인지. 미션 목표 판정에 쓴다 */
  readonly isBunt: boolean
  /** 방향까지 붙인 원본 결과 코드. 스윙하지 않았으면 null */
  readonly resultCode: number | null
  /**
   * 이 타구가 덱에서 **실제로 뽑은 원본 패턴** [각, 세기, 높이, 플래그] (0x51408 이 각·속도·높이를 꺼내는 그 한 장).
   * 맞은 공(파울 포함)에만 있다. 홈런더비는 이 패턴으로 비거리(0xa600c)와 이벤트 존 플래그(0xb07c8 = flags & 2)를 본다.
   */
  readonly pattern?: BattedBallPattern
  /**
   * **판을 돌 파울 각 공** — 쏜 패턴 · 결과 코드 · 필살 스윙 재료(`BattedContact`). 파울(`resolution.kind === '파울'`)에만 있다.
   * 원본은 맞은 공이면 파울 각이라도 판(상태 0x17)을 돌아 낙구 · 담장선 틱에 0x9d5bc 가 7 을 내야 파울이고, 그 전에 잡히면
   * 뜬공 아웃(13)이다. 받는 쪽이 이것으로 수비 판을 돌리고(필살타법 성공 굴림 0x517e6 도 판 시작이 한다), 판이 파울로 닫히면
   * 그제야 스트라이크를 올린다(0x35108 → 0xb6b58). CPU 타자의 `CpuPitchOutcome.foulContact` 와 같은 칸이다.
   */
  readonly foulContact?: BattedContact
  /**
   * **타구 순간에 울릴 소리 번호** (`atBatSounds.contactSoundIdOf`). 울릴 것이 없으면 null.
   *
   * 여기서 정해 실어 보내는 이유: 번호를 고르는 데 **방금 뽑은 타구 패턴**(각·세기·높이)이
   * 필요한데 그 패턴을 밖으로 내보내지 않기 때문이다. 심판 콜은 볼카운트를 알아야 해서
   * 받는 쪽(`app/model`)이 `pitchCallSoundIdOf` 로 따로 고른다.
   * 타석 화면(`BattingStage`)은 이 소리를 **판정 틀에 스스로 내고**(원본 0x51408 의 타구 순간 0x515de~ 가 판정 메시지를 받은 그 틀이다)
   * 받는 쪽에는 null 로 비워 넘긴다 — 받는 쪽은 맞은 공을 0x13 이 끝난 틀에, 못 맞힌 공을 0x12 를 예약한 틀에 받기 때문이다.
   */
  readonly contactSoundId?: number | null
  /**
   * 지금 타자의 손 0xb63c1 (`situation.batterSide`, 1 = 좌타) — 모든 공에 싣는다. 맞은 공이면 [경기+0xf2c] 공의 수평각 d
   * (`BattedContact.batterHand`), 못 맞힌 공이면 공 도착 판(밀어내기 · 낫아웃)의 타자주자 타석 자리(0xa93ac a9446 → vt94 0xa0884,
   * `PitchArrivalPlayInput.batterHand`)를 고른다
   */
  readonly batterHand: number
  /**
   * 이 공의 **구질 번호** 1~22 (`game+0xfc8`). 원본은 공이 손을 떠날 때(0x3de10 의 0x3dec6)
   * `0xa5e14(ctx, 구질)` 로 상대 투수 투구 수·스태미나를 깎는다 — 받는 쪽이 그 일을 하라고 싣는다.
   * 타석 화면(`BattingStage`)이 CPU 공에 채운다. 견제는 공이 아니라 여기 오지 않는다.
   */
  readonly pitchTypeNumber?: number
}
