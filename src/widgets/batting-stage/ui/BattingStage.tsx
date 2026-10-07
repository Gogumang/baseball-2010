import { useCallback, useEffect, useMemo } from 'react'
import { resolvePitch } from '@/features/play-at-bat/model/resolvePitch'
import type { BattingSwing } from '@/features/play-at-bat/model/resolvePitch'
import { nextBatterShift } from '@/features/play-at-bat/model/batterShift'
import { createPatternDeck, lastDrawnPattern, scenePatternDeckOf } from '@/entities/batting/model/battedBallOutcome'
import { emitParticles } from '@/entities/particle/model/particleScene'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'
import { batterEquipmentOf, NO_EQUIPMENT } from '@/widgets/batting-stage/lib/batterLayers'
import { hitPauseTicksOf, isBigHit, pauseInputOf } from '@/widgets/batting-stage/lib/hitPause'
import {
  BIG_HIT_PARTICLE,
  HIT_PARTICLE_IMAGE,
  hitParticleIdOf,
  hitParticleInputOf,
  specialSwingParticlesOf,
} from '@/widgets/batting-stage/lib/hitParticles'
import { ballPixelAt } from '@/widgets/batting-stage/lib/trajectory'
import { pitchVibrationMillisecondsOf } from '@/widgets/batting-stage/lib/pitchVibration'
import { vibrate } from '@/entities/defense-controls/model/vibration'
import { batterSideOfForm, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import type { SwingMode } from '@/entities/batting/model/swingResult'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery'
import { describeResolution, isHomeRunResolution, situationOf } from '@/widgets/batting-stage/lib/stageText'
import { ballFrameAt, useStageRefs } from '@/widgets/batting-stage/model/stageRefs'
import type { AcePitcherFrames, StageHud } from '@/widgets/batting-stage/model/stageRefs'
import { useStageAnimation } from '@/widgets/batting-stage/model/useStageAnimation'
import { useStageControls } from '@/widgets/batting-stage/model/useStageControls'
import { buntStanceAfterBuntKey, buntStanceAfterSwingKey } from '@/widgets/batting-stage/lib/buntStance'
import { canSpecialSwing, remainingAfterSpecialSwing } from '@/entities/batting/model/specialSwing'
import { pitcherBoostSideOf, swingBoostOf } from '@/entities/batting/model/swingBoost'
import { aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import * as styles from '@/widgets/batting-stage/ui/BattingStage.css'

interface BattingStageProps {
  readonly batterAbility: BatterAbility
  readonly pitcherAbility: PitcherAbility
  readonly isEagleEyeEnabled: boolean
  /** 화면에 겹쳐 그릴 경기 상황 */
  readonly hud: StageHud | null
  /** 등판한 마선수의 합성 프레임. 없으면 평범한 투수다. */
  readonly acePitcher: AcePitcherFrames | null
  /** 번트를 쓸 수 있는지 */
  readonly canBunt?: boolean
  /** 판정 모드 — 나만의리그(모드 3·4)는 "내 선수"(비트7) 보너스, '미션'(모드 6)은 사람 공격 +100 (0xab214) */
  readonly swingMode?: SwingMode
  /**
   * **타자 폼** = 원본 선수 레코드 `rec[0xb]` 의 윗니블 `2 × 타입 + 손` (C 5절 0x16f9a).
   * 몸통 파일(balancer/sluger)과 자세표를 `폼 >> 1` 로 고른다 (0x78ab0).
   * 안 넘기면 0 = 타격형·우타라 예전과 같은 밸런스형 몸통이다.
   */
  readonly batterForm?: number
  /**
   * **피부** (선수 레코드 `rec[0xb]` bit2-3 — 0 황인 · 1 백인 · 2 흑인) 와 **소속 팀 번호**.
   * 원본은 타자 그림 객체를 세울 때 이 둘을 같이 넘겨 몸통 팔레트 `피부 × 15 + 팀`,
   * 헬멧 팔레트 `팀` 을 고른다 (0x10810 → 0x78be8·0x78c14, C-1).
   *
   * 안 넘기면 피부는 0(황인 — 구운 PNG 가 쓰는 벌도 피부 0 이다), 팀은 `hud.ourTeamId` 다.
   * ⚠️ 팀을 hud 에서 꺼내는 것은 **근사**다 — "타석에 선 쪽이 내 팀" 이라고 본 것이라
   * 상대 팀 공격을 그리는 화면이 생기면 `batterTeamIndex` 를 따로 넘겨야 한다.
   */
  readonly batterSkinIndex?: number
  readonly batterTeamIndex?: number
  /**
   * **장착 장비 니블** = `career.equipmentLevels` (0 미장착 · 1~11 = 레벨+1, 부위 순서는
   * 히트·파워·수비·주루 = 헬멧·배트·밴드·슈즈). 원본도 이 니블에서 `등급 − 1` 을 꺼내
   * 머리·손·다리 그림 슬롯을 채운다 (0x10866 → 0x78fd8).
   * 안 넘기면 아무것도 장착하지 않은 선수로 그린다.
   */
  readonly batterEquipmentLevels?: BatterAbility
  readonly batterSkillIds?: readonly number[]
  readonly recentAtBatCodes?: readonly number[]
  /**
   * **시즌 구장 세 값** — `{ stand: 관중석 칸, crowd: 관중 단계, board: 전광판 칸 }`.
   * 넘기면 배경을 시즌 구장 0x77494 로 그려 **장착한 전광판**이 뒤에 선다.
   *
   * 원본 `0x40ff0` 은 **모드 2(시즌)이고 내 팀 == 홈팀**일 때만 이 묶음을 쓴다 — 원정이면
   * 안 넘겨야 원본과 같다. 값은 `0x353ac~0x353e6` 이 시즌 기록에서 그대로 옮기므로
   * `stand = record.stadiumEquipped[0]` · `board = record.stadiumEquipped[1]` 이다.
   * `crowd` 는 아이템이 아니라 **관중 수 그림 단계**다 — 시즌 홈경기면 만원 판정 `SR[0x65]` + 1,
   * 대전 모드면 3 고정이다 (`SeasonStadium` 주석 참고). 잔디 칸은 이 길로 들어가지 않는다.
   */
  readonly seasonStadium?: SeasonStadium
  /**
   * **게임 모드** = 원본 전역 `0x1552d10` (1 일반 · 2 시즌 · 4 나리 타자편 · 6 타자 미션 · 7 홈런더비 · 8·9 대전).
   * 지금은 하늘 조명 `0x78490` 만 본다 — 모드 5·6·7 이면 조명을 안 그린다 (0x784a2~0x784b0).
   * 안 넘기면 그 셋이 아닌 것으로 본다.
   */
  readonly gameMode?: number
  /**
   * **홈런더비(모드 7) 상대 투수의 구질** — 0x344ea: `state+0x38`(등장한 마투수 수) > 0 ? 22(마구) : 1, 굴림 없음.
   * `derbyPitcherOf(단계).pitchType` 을 넘긴다. `gameMode` 가 7 일 때만 읽고, 안 넘기면 마투수가 아직 안 나온 것(1)으로 본다.
   */
  readonly derbyPitchType?: number
  /**
   * **환경설정 "전광판"** = 저장 +0x3a (`GameSettings.isScoreboardOn`). 꺼져 있으면 전광판 흐르는 글자를
   * 그리지 않는다 — 0x77494 의 0x77726 이 `0x1f1d9() + 0x3a ≠ 0` 을 본다 (R2 6절). 안 넘기면 켠 것으로 본다.
   */
  readonly isScoreboardOn?: boolean
  /**
   * **환경설정 "진동"** = 저장 +0x3b (`GameSettings.isVibrationOn`). 게임 쪽 진동 0x3a44 가 이 칸이 켜졌을 때만 울린다 —
   * 맞은 공(0xbc5, 100/200/300ms)·사구(200ms). 안 넘기면 켠 것으로 본다(원본 기본값 켬).
   */
  readonly isVibrationOn?: boolean
  /**
   * **마선수 레벨 열 칸** = 원본 전역 기록 `mgr[0x13a..0x143]` (칸 0~4 마투수 · 5~9 마타자 → 레벨 0~4).
   * `entities/mission/model/useAceLevels` 의 `levels` 를 그대로 넘긴다. 상대가 마투수면 경기 첫 마구 상태를
   * 세울 때 `0xd8509[레벨]` = [3,4,5,6,7] 로 마구 횟수를 정한다 (타석 교대 0xaebe4, aeec2~aeeea).
   * 안 넘기면 모두 Lv1 = 3 회다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * **부르는 쪽이 드는 CPU 마구 상태** — 수비 팀 남은 마구 팀+0x28 과 경기에 하나뿐인 공 객체 +0x10.
   * 넘기면 화면은 자기 마구 상태를 만들지 않고 **공마다 이 값의 사본**으로 구질을 고른다(0x344dc·0x345fc·0x3de10).
   * 던진 뒤 값은 부르는 쪽이 `onPitchResolved` 의 구질 번호로 같은 차례를 밟아 고친다(`advanceMagicPitchGameState`).
   * 원본 공 객체는 사람 투구와 CPU 투구가 함께 쓰므로, 두 쪽을 다 드는 진행기(팀 경기)가 넘긴다.
   * 안 넘기면 예전처럼 화면이 투수마다 상태를 세운다.
   */
  readonly cpuMagic?: { readonly remaining: number; readonly ballMagicNumber: number }
  /** 참이면 새 공을 던지지 않는다. 타석 결과 연출 중에 쓴다. */
  readonly isPaused: boolean
  /**
   * **결과 창 뒤 배경** — 홈런더비 결과 창(상태 0x1a) 그리기 `0x45c18` 은 창보다 먼저 구름 `0x78448` 과
   * 구장 `0x78578(구장, +0x17e2, 1)` 만 그린다(선수·공·HUD 없음). +0x17e2 는 들어선 뒤 틱마다 5 씩 150 까지 올라
   * 구장·바닥이 아래로 가라앉는다(`resultBackdropOffsetAt`). 참인 동안은 공을 던지지 않고 파티클도 굴리지 않는다.
   * 같은 캔버스를 그대로 쓰므로 구름·전광판 흐름은 타석에서 이어진다. 안 넘기면 타석 화면이다.
   */
  readonly isResultBackdrop?: boolean
  /**
   * 결과 창 뒤 배경의 틱 t(0 = 들어선 틱) +0x17e2 — 안 넘기면 홈런더비 결과 창(0x3c0b8, 틱마다 +5)이다.
   * 팀경기 정산(0x19) 갱신 0x4b100 은 사람 팀이 이겼을 때만 +3 이라 부르는 쪽이 넘긴다.
   */
  readonly resultBackdropOffsetOf?: (tick: number) => number
  readonly random: RandomPort
  /**
   * **고른 필살타법 번호** (선수 레코드 +0x18, 1~4). 레벨(+0x201)이 아니다 — 경기는 이 번호만 본다
   * (H2 1-2 "레벨은 여기서 직접 쓰이지 않는다"). 0 이면 '0' 키가 무시된다(0x51e14: 0xaea30 이
   * `+0x18 == 0 → 0` 을 준다). 성공 확률은 표 `0xcfdbe[번호−1]` (0x34c74) — 장타형 메테오도 저장 번호가
   * 4 라 넷째 값 25% 다. 마타자는 번호와 무관하게 30% 라 `aceBatterIndex` 로 따로 알린다 (H2 2-2).
   */
  readonly specialSwingNumber?: number
  /**
   * **마타자 순번** (0~4). `ACE_PLAYERS` 중 `role === '타자'` 다섯의 배열 색인 그대로다
   * (medica 0 · kao 1 · roze 2 · death 3 · tiger 4). 마타자가 아니면 −1 이거나 안 넘긴다.
   *
   * 원본은 `0xb63a0(타자)` 가 같은 값을 준다 — 마선수(`rec[0xa]` 비트 0x40)면 `rec[0xa] & 0x1f`,
   * 아니면 −1 이다. 필살 연출 점프표 `0xd01e4` 가 이 순번으로 파티클을 고른다 (0x49b7c).
   * 확률 쪽은 순번을 안 보고 "마타자인가" 만 본다 (H2 2-2 — 번호 무관 30%).
   */
  readonly aceBatterIndex?: number
  /**
   * 지금 타자의 **이 경기 남은 필살 횟수** = s8 팀[+0x29 + 타순] (`0xaea30`). 채우는 값은
   * `specialSwingCountOf` (표 0xd84f0 · 0xd84fa, 스킬 23 +1 — 타석 교대 0xaebe4 가 남은 칸이 음수일 때만 채운다).
   * 0 이면 '0' 키를 무시한다 (0x51e14). **안 넘기면 횟수 제한 없이** 번호만 본다(예전 동작).
   */
  readonly specialSwingRemaining?: number
  /**
   * 타자가 **육성·명전 선수**(선수 레코드 `rec[0xa]` 비트7, `0xb6389`)인가. 나리(swingMode '나만의리그')에서
   * 내 선수 보너스 `400 − 35 × 연차` 와 그 계수(K 1000 …)를 켠다 (0xab3d4 · 0xab628). 안 넘기면 거짓(예전 동작).
   */
  readonly isBatterOwnPlayer?: boolean
  /** 나리 연차 idx (0 = 1년차, 저장 레코드 +0xb3 — 웹 커리어 `season − 1`). 안 넘기면 0 */
  readonly careerYearIndex?: number
  /**
   * 필살 스윙이 실제로 나가 남은 횟수가 줄 때 부른다 — `0x4e136`: `S+0x10 ≠ 0 && 남은 > 0` 이면 −1.
   * 결과와 무관하다(헛스윙도). 인자는 줄인 뒤의 남은 횟수다 — 받는 쪽이 그 값을 다시 `specialSwingRemaining` 으로 넘긴다.
   * `specialSwingRemaining` 이 양수일 때만 부른다.
   */
  readonly onSpecialSwingUsed?: (remaining: number) => void
  /**
   * 세 번째 인자는 **필살타법이 성공한 타구인가** — 성공하면 야수가 쥐지 않고 지나친다
   * (0x51800 → `features/defense-play` 의 `isUncatchable`).
   * 네 번째 인자는 이 공의 **번트 종류** 장면 +0xfdc (0 스윙 · 1~3 번트 키 '8'·'7'·'9') — 타구 판 시작 리드(0x3d7b8)가
   * 도루 안 한 주자에게 +3 틱을 더한다(`DefensePlayInput.buntKind`). 안 휘둘렀으면 0.
   */
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable?: boolean, buntKind?: number) => void
  /**
   * **공이 나는 동안(상태 0x11)인가** 를 밖에서 물을 수 있게 이 칸에 묻는 함수를 넣어 준다. 원본 도루 키(0x53610 →
   * 메시지 0x583)는 상태 0x11 에서만 받는다 — 타석 화면 밖 키 처리(`GameScreen` 등)가 이 함수로 거른다.
   * 스윙·번트 키와 같은 판정(`isFlying` — '투구중' 단계이고 공 프레임 ≥ 0 = 릴리스 뒤. 스윙·번트가 판정되면 단계가
   * 넘어가 거짓이 된다)이다. 화면이 내려가면 null 로 되돌린다.
   */
  readonly flightProbeRef?: { current: (() => boolean) | null }
  /**
   * **CPU 투수의 견제** — 투구 AI 목표점 고르기 `0x345fc` 가 종류 4 를 뽑고 주자가 1·2명이면 `0x34848` 이
   * 주자 있는 루(1·2·3)를 굴려 메시지 0x10 을 보낸다. 그 투구는 **공이 없다** — 이 콜백만 부르고 다시 대기로 간다.
   * 주자 루는 `hud.bases` 로 본다.
   *
   * ⚠️ **안 넘기면 CPU 견제가 꺼진다**(`selectPitch` 의 옵션 없음) — 종류 4 를 예전처럼 모서리 투구로 던져
   *    원본과 난수 차례·결과가 어긋난다(미해결). 원본은 홈런더비(모드 7)만 빼고 견제하므로
   *    나만의리그 타자편(`pages/game`)·미션(`pages/mission-play`)도 진행기에 견제 판이 생기면 넘겨야 한다.
   */
  readonly onPickoff?: (base: 1 | 2 | 3) => void
}

/** 원작 타석 화면. 그리기는 lib, 루프와 조작은 model이 맡는다. */
export function BattingStage({ canBunt = false, swingMode = '일반', batterForm = 0, batterSkinIndex = 0, batterTeamIndex, batterEquipmentLevels, batterSkillIds = [], recentAtBatCodes = [], specialSwingNumber = 0, aceBatterIndex = -1, specialSwingRemaining, onSpecialSwingUsed, isBatterOwnPlayer = false, careerYearIndex = 0, flightProbeRef, ...props }: BattingStageProps) {
  const refs = useStageRefs({
    ...props,
    canBunt,
    swingMode,
    batterForm,
    batterSkinIndex,
    batterEquipment: batterEquipmentLevels === undefined ? NO_EQUIPMENT : batterEquipmentOf(batterEquipmentLevels),
    // 팀을 안 넘기면 HUD 의 내 팀 번호를 쓴다 (근사 — props 주석 참고)
    batterTeamIndex: batterTeamIndex ?? props.hud?.ourTeamId ?? 0,
    batterSkillIds,
    recentAtBatCodes,
  })
  const { pitchRef, pitchTypeNumberRef, phaseRef, phaseStartedAtRef, resultTextRef, homeRunStartedAtRef, swingStartedAtRef, shiftRef, buntRef, deckRef, pendingHitRef, particlesRef, latestRef } = refs

  const finishPitch = useCallback((swing: BattingSwing | null, now: number) => {
    const pitch = pitchRef.current
    if (pitch === null) return
    const latest = latestRef.current
    // 장면 덱(0x3e340 이 경기 시작에 연 하나 — 같은 난수로 도는 진행기가 연다)을 CPU 타자와 같이 쓴다.
    // 장면을 열지 않은 화면(시험 · 장면 없는 연습)만 이 화면이 첫 공에 덱을 섞어 들고 있는다(웹 전용)
    const scene = scenePatternDeckOf(latest.random)
    const deck = scene?.deck ?? deckRef.current ?? createPatternDeck(latest.random)
    const context = {
      batter: latest.batterAbility,
      pitcher: latest.pitcherAbility,
      mode: latest.swingMode,
      batterSkillIds: latest.batterSkillIds,
      // 0xab214 는 투수 레코드로 손 0xb63c0 을 바로 읽는다(스킬 13 좌완UP · 14 우완UP) — 던진 공이 그 투수의 폼·+0x18 을 든다.
      // ⚠️ 다섯째 인자(타자 레코드 칸 0xb6394, 투수 스킬 31)는 이 화면이 타자 레코드를 몰라 0 — 미해결
      situation: situationOf(latest.hud, latest.recentAtBatCodes, latest.batterForm, pitch),
      // 내 선수 보너스·계수는 비트7(육성·명전)만 본다 — 마선수(비트6) 등판은 해당하지 않는다 (0xb6389).
      // 마구 번호(+0x18) 1~4 를 가진 투수는 비트7 이다 (일반 레코드 +0x18 은 모두 0 — H2 4-2)
      isBatterOwnPlayer,
      isPitcherOwnPlayer: (pitch.pitcherMagicNumber ?? 0) >= 1 && (pitch.pitcherMagicNumber ?? 0) <= 4,
      careerYearIndex,
      // 보정 구조체 0x34d6c — 판정 바로 앞(0x51294)에서 이번 스윙(S+0x10)·공(P+0x10)으로 만든다
      swingBoost: swingBoostOf(
        {
          // S+0x10 = 타자 +0x18 (0x51e40). 마타자 레코드 +0x18 은 5~9 (H2 4-1) — 0 만 아니면 된다
          number: swing?.isSpecial === true ? (aceBatterIndex >= 0 ? aceBatterIndex + 5 : specialSwingNumber) : 0,
          isAce: aceBatterIndex >= 0,
          aceOrder: Math.max(aceBatterIndex, 0),
          aceLevel: aceBatterIndex >= 0 ? aceLevelOf(latest.aceLevels, aceLevelSlotOf('타자', aceBatterIndex + 1)) : 0,
          // 번호(+0x18)를 가진 비마선수는 육성·명전(비트7)뿐이다 — 일반 선수 레코드는 +0x18 이 모두 0 (H2 4-2)
          isOwnPlayer: aceBatterIndex < 0 && specialSwingNumber > 0,
        },
        pitcherBoostSideOf(pitch.magicNumber ?? 0, pitch.pitcherMagicNumber ?? 0, (order) =>
          aceLevelOf(latest.aceLevels, aceLevelSlotOf('투수', order + 1)),
        ),
      ),
      // 필살 성공 굴림 0x34c74 — 확률은 번호(+0x18)로, 마타자는 30% (판정 안에서 맞은 공일 때만 굴린다)
      specialSwing: { number: specialSwingNumber, isAceBatter: aceBatterIndex >= 0 },
    }
    const resolved = resolvePitch(pitch, swing, context, deck, latest.random)
    // 진동 — 맞은 공은 0xbc5 → 0x5228c 의 100/200/300ms, 사구는 0x51b0e 의 200ms, 삼진은 0x4d0d6 의 100ms.
    // 환경설정 진동(+0x3b)이 켜졌을 때만. HUD 는 이 공 전 볼카운트다
    vibrate(
      pitchVibrationMillisecondsOf(resolved.detail, swing?.frame ?? null, pitch, latest.hud?.strikes ?? null),
      latest.isVibrationOn !== false,
    )
    // 구질 번호(game+0xfc8)를 실어 보낸다 — 받는 쪽이 0xa5e14 처럼 상대 투수 투구 수·스태미나를 깎는다
    const pitchTypeNumber = pitchTypeNumberRef.current
    const result =
      pitchTypeNumber === null ? resolved : { ...resolved, detail: { ...resolved.detail, pitchTypeNumber } }
    // 필살 성공(0x34c74 → 0x517e6)은 판정이 방향·패턴 뒤에 굴려 실어 준다 — 헛스윙이면 굴리지 않는다
    const isUncatchable = resolved.isUncatchable
    // 필살 연출 파티클은 **성공 여부와 무관**하게 `S+0x10` 이 켜져 있으면 나간다 (0x49aec).
    // ⚠️ 원본은 상태 0x13 그리기에서 한 번(경기+0x196b) 쏜다. 웹도 이제 상태 0x13('타격' 단계)을 두지만
    //    파티클은 여전히 스윙이 판정되는 이 시점(헛스윙 포함)에 쏜다 — 0x13 은 맞은 공만 거치므로 헛스윙에서도
    //    나가는지는 미확인이다. **때는 근사**고 고르는 번호만 원본 그대로다.
    if (swing?.isSpecial === true) {
      // 한 줄이 파티클을 두 개까지 쏜다 — 원본 0x49dbc·0x49de0 의 차례 그대로다
      const specials = specialSwingParticlesOf(specialSwingNumber, latest.batterForm, aceBatterIndex)
      const anchor = stageLayoutOf(batterSideOfForm(latest.batterForm)).batterAnchor
      for (const special of specials) {
        emitParticles(
          particlesRef.current,
          particleConfigOf(special.id),
          anchor.x + shiftRef.current,
          anchor.y + special.offsetY,
          special.img,
        )
      }
    }
    if (scene !== undefined) scene.deck = result.deck
    else deckRef.current = result.deck
    buntRef.current = null
    const resultText = describeResolution(result.detail)
    // 홈런이면 판정 글자 대신 HOMERUN 글자 연출을 켠다 (원본 0x51cd8 의 +0x1960, 사운드 11 은 웹에 없음)
    const isHomeRun = isHomeRunResolution(result.detail)

    // 맞은 공이면 인플레이(0x17) 앞에 **상태 0x13** 을 한 번 거친다. 헛스윙·볼은 0x12 라 그냥 결과다.
    if (result.detail.resultCode !== null) {
      const pauseInput = pauseInputOf(result.detail.resultCode, result.deck)
      const watchesBigHit = isBigHit(pauseInput)
      // 타격 순간 불꽃 (0x49e64 → 0x4a0ca) — 타격점은 맞은 틱의 공 자리로 본다 (근사)
      const pattern = lastDrawnPattern(result.deck, result.detail.resultCode)
      const contact = swing === null ? null : ballPixelAt(pitch, swing.frame)
      if (pattern !== null && contact !== null) {
        const particleId = hitParticleIdOf(hitParticleInputOf(pattern, result.detail.resultCode, watchesBigHit))
        if (particleId !== null) {
          emitParticles(particlesRef.current, particleConfigOf(particleId), contact.x, contact.y, HIT_PARTICLE_IMAGE)
        }
      }
      pendingHitRef.current = {
        ticks: hitPauseTicksOf(pauseInput),
        detail: result.detail,
        pitch,
        isUncatchable,
        isHomeRun,
        // 큰 타구 감상이 끝나는 자리에 016 을 쏜다 (0x4cb1c → 0x4cd14)
        bigHitAt: watchesBigHit ? contact : null,
        resultText,
        buntKind: swing?.buntKind ?? 0,
      }
      phaseRef.current = '타격'
      phaseStartedAtRef.current = now
      return
    }

    resultTextRef.current = resultText
    homeRunStartedAtRef.current = isHomeRun ? now : -1
    phaseRef.current = '결과'
    phaseStartedAtRef.current = now
    latest.onPitchResolved(result.detail, pitch, isUncatchable, swing?.buntKind ?? 0)
  }, [aceBatterIndex, specialSwingNumber, isBatterOwnPlayer, careerYearIndex])

  /** 상태 0x13 을 끝내고 인플레이(0x17)로 넘긴다 — 시간이 다 됐거나 OK/'5' 로 건너뛸 때 */
  const commitHit = useCallback((now: number) => {
    const pending = pendingHitRef.current
    if (pending === null) return
    pendingHitRef.current = null
    // 상태 19 카운터가 다 되면 타격점에 016 (id 15, 프레임 10) 을 쏜다 (R2 3-4)
    if (pending.bigHitAt !== null) {
      emitParticles(
        particlesRef.current,
        particleConfigOf(BIG_HIT_PARTICLE.id),
        pending.bigHitAt.x,
        pending.bigHitAt.y,
        BIG_HIT_PARTICLE.img,
      )
    }
    resultTextRef.current = pending.resultText
    homeRunStartedAtRef.current = pending.isHomeRun ? now : -1
    phaseRef.current = '결과'
    phaseStartedAtRef.current = now
    latestRef.current.onPitchResolved(pending.detail, pending.pitch, pending.isUncatchable, pending.buntKind)
  }, [])

  const actions = useMemo(() => {
    const frameNow = (now: number) => ballFrameAt(now, phaseStartedAtRef.current, millisecondsPerFrame())
    // 스윙·번트는 공이 나는 동안(상태 0x11)만 받는다 — 릴리스 전에는 무시한다
    const isFlying = (now: number) => phaseRef.current === '투구중' && pitchRef.current !== null && frameNow(now) >= 0
    return {
      swing: (now: number) => {
        // 상태 0x13 은 OK(−5)·'5' 로 건너뛴다 (0x406e8). 그때 스윙 키는 건너뛰기로만 쓰인다
        if (phaseRef.current === '타격') return commitHit(now)
        if (!isFlying(now)) return
        // 번트 자세면 스윙이 안 나가고(0xb9374 가 S+8 을 보고 그냥 돌아간다) 판정 F(+0xfd8)만 이 틱으로 바뀐다
        const bunt = buntRef.current
        if (bunt !== null) {
          buntRef.current = buntStanceAfterSwingKey(bunt, frameNow(now))
          return
        }
        swingStartedAtRef.current = now
        finishPitch({ frame: frameNow(now), shift: shiftRef.current, buntKind: 0 }, now)
      },
      /**
       * 번트 키 '7'/'8'/'9' (0x535a4 → 메시지 0x6a7 → 0x51e48). 상태 0x11 · S+4 가 아니면 무시하고, 지금 타자가
       * 마선수(0xb633c)면 예약하지 않는다(`buntStanceAfterBuntKey`). 모드 갈림은 없다 — 화면은 `canBunt` 로 키를 연다.
       */
      toggleBunt: (kind: number, now: number) => {
        if (!isFlying(now)) return
        buntRef.current = buntStanceAfterBuntKey(buntRef.current, kind, frameNow(now), aceBatterIndex >= 0)
      },
      moveBatter: (direction: -1 | 1) => {
        shiftRef.current = nextBatterShift(shiftRef.current, direction)
      },
      /**
       * '0' 은 **그 자리에서 필살 스윙**이다 (0x535a4 → 메시지 0x6a6 → 0x51dee). 일반 스윙(0x6a5 → 0x51db6)과
       * 똑같이 경기+0xfe0 = 1 · +0xfdc(번트) = 0 · +0xfd8 = 지금 틱으로 스윙을 예약하고, S+0x10 에 0 대신
       * 타자 +0x18 을 쓰는 것만 다르다 (0x51e40). 상태 0x11(공이 나는 중)·S+4 가 아니면 무시한다.
       */
      specialSwing: (now: number) => {
        if (!isFlying(now)) return
        // 0x51e14: 남은 횟수 0xaea30 이 0 이면 무시 — 번호(+0x18)가 0 이면 늘 0 이다
        if (!canSpecialSwing(specialSwingNumber, aceBatterIndex >= 0, specialSwingRemaining)) return
        // 0x4e136: 예약이 풀리는 틱에 S+0x10 ≠ 0 이고 남은 > 0 이면 −1 (결과와 무관 — 번트 자세라 스윙이 안 나가도)
        if (specialSwingRemaining !== undefined && specialSwingRemaining > 0) {
          onSpecialSwingUsed?.(remainingAfterSpecialSwing(specialSwingRemaining))
        }
        const bunt = buntRef.current
        if (bunt !== null) {
          // 번트 자세면 스윙은 안 나가고(0xb9374) 판정 F(+0xfd8)만 이 틱으로 바뀐다.
          // ⚠️ 미해결: 원본은 S+0x10 = 필살 번호가 남은 채 번트 판정(0x51226)으로 간다 — 그 쓰임은 안 옮겼다
          buntRef.current = buntStanceAfterSwingKey(bunt, frameNow(now))
          return
        }
        swingStartedAtRef.current = now
        finishPitch({ frame: frameNow(now), shift: shiftRef.current, buntKind: 0, isSpecial: true }, now)
      },
    }
  }, [commitHit, finishPitch, specialSwingNumber, aceBatterIndex, specialSwingRemaining, onSpecialSwingUsed])

  // 공이 나는 동안(상태 0x11)인가 — 도루 키(0x53610)를 받는 화면이 묻는다. 스윙·번트 키의 `isFlying` 과 같은 판정이다
  useEffect(() => {
    if (flightProbeRef === undefined) return
    flightProbeRef.current = () =>
      phaseRef.current === '투구중' &&
      pitchRef.current !== null &&
      ballFrameAt(performance.now(), phaseStartedAtRef.current, millisecondsPerFrame()) >= 0
    return () => {
      flightProbeRef.current = null
    }
  }, [flightProbeRef, phaseRef, pitchRef, phaseStartedAtRef])

  useStageAnimation(refs, finishPitch, commitHit)
  const pointerHandlers = useStageControls(refs, actions)

  return (
    <canvas
      ref={refs.canvasRef}
      className={styles.stage}
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      {...pointerHandlers}
    />
  )
}
