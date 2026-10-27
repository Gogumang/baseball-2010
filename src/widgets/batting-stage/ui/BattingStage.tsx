import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { RunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import type { HomeRunTextWindow } from '@/widgets/batting-stage/lib/homeRunBanner'
import type { SettlementEffectSource } from '@/widgets/batting-stage/model/stageRefs'
import { plateErrorOf, resolvePitch, unjudgedSwingDetailOf } from '@/features/play-at-bat/model/resolvePitch'
import { unjudgedWhiffSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import type { BattingSwing } from '@/features/play-at-bat/model/resolvePitch'
import { nextBatterShift } from '@/features/play-at-bat/model/batterShift'
import { createPatternDeck, lastDrawnPattern, scenePatternDeckOf } from '@/entities/batting/model/battedBallOutcome'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import { emitParticles } from '@/entities/particle/model/particleScene'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'
import { useClaimSceneParticles } from '@/widgets/particles/model/useClaimSceneParticles'
import { batterEquipmentOf, NO_EQUIPMENT, pitcherEquipmentOfNibbles } from '@/widgets/batting-stage/lib/batterLayers'
import { canSkipHitPause, hitBallTrajectoryOf, hitPauseTicksOf, isBigHit, launchedPauseInputOf, pauseInputOf, type LaunchedShot } from '@/widgets/batting-stage/lib/hitPause'
import { hitBallPathOf } from '@/widgets/batting-stage/lib/hitBallPath'
import { hitCameraAngleOf } from '@/widgets/batting-stage/lib/hitCamera'
import type { StageParticleShot } from '@/widgets/batting-stage/lib/homeRunEffects'
import {
  HIT_PARTICLE_IMAGE,
  hitParticleIdOf,
  hitParticleInputOf,
  isHomeRunHitResult,
  isStrongHit,
  specialSwingParticlesOf,
} from '@/widgets/batting-stage/lib/hitParticles'
import { hitFlameAnimationOf } from '@/widgets/batting-stage/lib/batterOverlayMarks'
import { platePixelOf } from '@/widgets/batting-stage/lib/trajectory'
import { pitchVibrationMillisecondsOf } from '@/widgets/batting-stage/lib/pitchVibration'
import { vibrate } from '@/entities/defense-controls/model/vibration'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { specialSwingStageEffectOf } from '@/widgets/batting-stage/lib/specialSwingEffect'
import type { SwingMode } from '@/entities/batting/model/swingResult'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { StageMissionStrip, StageWarmCast } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery'
import { describeResolution, isHomeRunResolution, judgeTextOf, situationOf } from '@/widgets/batting-stage/lib/stageText'
import type { PitchResolvedReply } from '@/widgets/batting-stage/lib/stageText'
import { ballFrameOf, useStageRefs } from '@/widgets/batting-stage/model/stageRefs'
import type { AcePitcherFrames, SkillPanelSource, StageHud, SwingReservation } from '@/widgets/batting-stage/model/stageRefs'
import { useStageAnimation } from '@/widgets/batting-stage/model/useStageAnimation'
import { useStageCastPreload } from '@/widgets/batting-stage/model/useStageCastPreload'
import { gameSceneNow, gameSceneTickNow, gameSceneTickStartTime, useIsCommonWindowOpen } from '@/shared/lib/commonWindow/commonWindow'
import { activeSound } from '@/shared/api/audio/soundPort'
import { publishScenePeek, pushBattingLog } from '@/shared/lib/scenePeek/scenePeek'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { pitcherReleaseTicksOf } from '@/widgets/batting-stage/lib/stageScenery'
import { SCENE_STATE, markSceneStateEntries } from '@/shared/lib/commonWindow/sceneStateEntries'
import { useStageControls } from '@/widgets/batting-stage/model/useStageControls'
import { useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { acceptsBattingKey, keyTickOf, swingReleaseTickOf } from '@/widgets/batting-stage/lib/swingWindow'
import { RESULT_PHASE_TICKS, resultPhaseTicksOf } from '@/widgets/batting-stage/lib/stagePhaseTicks'
import {
  buntStanceAfterBuntKey,
  buntStanceAfterRelease,
  isBuntStanceSet,
  sceneBuntKindAfterKey,
  sceneBuntKindOnPitch,
} from '@/widgets/batting-stage/lib/buntStance'
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
  /**
   * 마운드 투수 체력 % — 34 이하면 투수 자리에 체력 그림(player_effect 애니 9 · 10, 0x38d1c)을 그린다. 안 넘기면 안 그린다
   */
  readonly pitcherStaminaPercent?: number | null
  /**
   * 타자 · 루 주자의 마선수 번호(0~4, 주자 +0x9c) — 루상 마선수 주자를 실린 ace/defender 그림으로 그린다(0x35c62 · 0x79da9,
   * `renderBattingStage` 의 같은 이름). 안 넘기면 모두 defender 그림이다
   */
  readonly runnerAces?: RunnerAces
  /** 등판한 마선수의 합성 프레임. 없으면 평범한 투수다. */
  readonly acePitcher: AcePitcherFrames | null
  /**
   * 마운드 투수(수비 팀 지금 투수 `0xae83c`) 레코드의 **장비 니블 네 칸** `+0x19 · +0x1a`(제구 · 구속 · 변화 · 체력 = 모자 · 글러브 ·
   * 아대 · 신발). 타석 교대 0x47cc8 이 마운드 그림(장면 +0xf1c)을 다시 싣고, 마투수(0xb633c)가 아니면 48138~4816a 가 이 니블 − 1 로
   * 장비 겹 0x79790 을 부른다 — 모드를 안 가린다. 마투수(`acePitcher`)면 넘기지 않는다. 없으면 맨몸
   */
  readonly pitcherEquipmentNibbles?: readonly number[] | undefined
  /**
   * 마운드 투수 레코드의 **피부** `(rec[0xb] >> 2) & 3` 와 **수비 팀 번호** 0xb6c08(게임). 타석 교대 0x47cc8 의 482c0~482fc 가 마운드 그림
   * `[장면+0xf1c]` 을 적재 0x793b0 으로 다시 실을 때 이 둘을 넘기고, 794c2 가 `pitcher.pzx` 를 **피부 × 15 + 팀** 벌로 연다(모드 무관).
   * 피부를 안 넘기면 0, 팀을 안 넘기면 `hud.opponentTeamId`(타석에 선 쪽이 내 팀이라는 `batterTeamIndex` 와 같은 근사)다
   */
  readonly pitcherSkinIndex?: number
  readonly pitcherTeamIndex?: number
  /**
   * 곧 설 선수들(타순 다음 · 벤치 대타 · 교체 투수)의 생김새 — 타석 그림이 그림마다 그 칠하기를 미리 건다(`StageScene.warmCast`).
   * 원본은 타석 교대 0x47cc8 의 적재 때 팔레트를 갈아 끼워 교대 직후 첫 그림부터 제 색이다. 안 넘기면 지금 선수만 칠한다
   */
  readonly warmCast?: StageWarmCast
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
   * **타자 손** `0xb63c0`(0 우타 · 1 좌타) — 마타자(0xb63a0 이 0~4)면 표 0xd88b0 [1, 0, 0, 0, 1](b63ea), 그 밖은 폼 & 1.
   * 타석 교대 0x47d58~0x47d70 이 장면 +0x17e1(배치 side) · 그림 +0x48 · +0x60 에 쓰고, 스윙 판정 0xab214 · CPU 투구가 같은 손을 본다.
   * 안 넘기면 폼 & 1 (마타자가 아니면 같다)
   */
  readonly batterHand?: number | undefined
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
   * **사람 타자 레코드 칸 `0xb6394`** = `+0xa & 0x1f` — 스윙 판정 0xab214 의 투수 스킬 31(0xabcd8)이 2 · 3 · 4 면 C −10%.
   * 타순이 아니라 레코드 칸이다: 경기 장면 셋업 0x39fdc(3a2fa · 3a302)의 0xb8768 → 0xb603c 가 마선수 아닌 줄을 배열 첨자로 다시
   * 매기고(0xb6605), 마타자는 순번 그대로, 레코드 맞바꿈 0xb5e98 은 +0xa 를 그대로 옮긴다. 안 넘기면 0
   */
  readonly batterRecordSlot?: number
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
   * **구장 번호** = 타석 구장 객체 +0x70 — 일반 구장 그리기 0x77974 가 `fence.pzf` 프레임·관중·전광판 상자를, 0x78046 이 하늘 단색(8)을
   * 이것으로 고른다. 모드 1·8·9 는 장면 셋업 0x39fdc 가 채운다(`TeamGameProgress.sceneStadium`). 안 넘기면 0번 구장
   */
  readonly stadium?: number
  /**
   * **바닥 그림 팔레트 줄** = 구장 객체 +0xc (0x76b6c 가 stadium/attack 을 이 줄로 싣는다). null · 생략이면 기본색.
   * `seasonStadium` 이 있으면 그쪽 `grassPalette` 가 먼저다
   */
  readonly fieldPalette?: number | null
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
   * 타석 준비 0xd 진입 번호 — 좌우 이동(+0xfe4)을 이 값이 바뀔 때만 0 으로 되돌린다(0x48d50 48f88). 쉬는 동안(`isPaused`)은
   * 안 지운다. 사람이 치는 화면은 `useSceneConfirm.sceneDEntryMark`(더비는 `sceneDSerial`)를 넘긴다(`StageLatest.shiftResetSerial`)
   */
  readonly shiftResetSerial?: number
  /**
   * **결과 창 뒤 배경** — 홈런더비 결과 창(상태 0x1a) 그리기 `0x45c18` 은 창보다 먼저 구름 `0x78448` 과
   * 구장 `0x78578(구장, +0x17e2, 1)` 만 그린다(선수·공·HUD 없음). +0x17e2 는 들어선 뒤 틱마다 5 씩 150 까지 올라
   * 구장·바닥이 아래로 가라앉는다(`resultBackdropOffsetAt`). 참인 동안은 공을 던지지 않는다. 파티클은 경기 장면 프레임 0x52c50 이
   * 상태를 안 가리고 프레임 끝(53048~53060)에 관리자 틱 · 그리기를 하므로 그대로 `random`(경기 난수)으로 굴리고 그린다 — 공용 창
   * [0x140005c]+9 가 서 있는 동안만 둘 다 건너뛴다(`isCommonWindowShown`).
   * 같은 캔버스를 그대로 쓰므로 구름·전광판 흐름은 타석에서 이어진다. 안 넘기면 타석 화면이다.
   */
  readonly isResultBackdrop?: boolean
  /**
   * **루상 주자 애니 시계** — 원본은 장면 +0xf24 의 애니 0~2 를 경기 장면이 사는 동안 들고 0x35b94 가 부를 때마다 한 칸씩 돌린다
   * (`RunnerAnimationClock`). 부르는 쪽이 장면 수명의 칸(`useSceneScopedRef(createRunnerAnimationClock(), 장면)`)을 넘기면 판 ·
   * 타석으로 화면이 다시 서도 이어진다. 안 넘기면 이 화면이 사는 동안만 센다
   */
  readonly runnerAnimationClock?: MutableRefObject<RunnerAnimationClock>
  /**
   * 결과 창 뒤 배경의 틱 t(0 = 들어선 틱) +0x17e2 — 안 넘기면 홈런더비 결과 창(0x3c0b8, 틱마다 +5)이다.
   * 팀경기 정산(0x19) 갱신 0x4b100 은 사람 팀이 이겼을 때만 +3 이라 부르는 쪽이 넘긴다.
   */
  readonly resultBackdropOffsetOf?: (tick: number) => number
  /**
   * **부르는 쪽이 모는 HOMERUN 글자** (원본 +0x1960 · 그리기 0x40b18). 넘기면(null 포함) 이 화면은 타석 임시 결과로 글자를
   * 켜지 않고 이 창대로만 그린다 — null 이면 지금 글자가 없다. 안 넘기면 예전처럼 홈런 결과에 일반 홈런 연출(칸 5+i)을 켠다.
   * 홈런더비는 판의 홈런 틱에 `derbyHomeRunTextOn` 칸으로 켜고, 관문이 닫히는 틱(0x40b18 을 부르는 0x46c88 의 조건)이나
   * 키 건너뛰기(0x519cc 의 +0x1960 = 0)에서 끝을 넘긴다.
   */
  readonly homeRunText?: HomeRunTextWindow | null
  /**
   * **효과를 치운 시각** (경기 장면 시계 `gameSceneNow()` ms) — 키 건너뛰기 0x519cc(효과 객체 칸 버리기 0x8fc70 · 파티클 0x6dee4)나
   * 0x17 끝 0x35108(0x6dee4)이 돈 때. 이 시각 뒤 첫 틱 프레임 머리에서 파티클 장면을 비우고 홈런 효과 객체를 버린다
   * (`lib/homeRunEffects`). 값이 바뀔 때마다 한 번씩. 안 넘기면 치우지 않는다.
   */
  readonly effectsClearedAt?: number | null
  /**
   * **홈런더비 판(0x17)의 필드 화면이 이 캔버스 밑에 깔렸다** — 0x17 그리기 0x46c88 은 타석 그림 0x4c4bc 를 안 부른다. 캔버스를 비워
   * (바탕색도 빼) HOMERUN 글자 0x40b18 과 프레임 끝 파티클만 그린다. 루프(갱신 · 효과 틱 · 파티클 틱)는 그대로 돈다
   */
  readonly isFieldPlay?: boolean
  /**
   * 필드 화면의 공 그리기 0x36dfc 가 장면 틱 그림에 쏘는 파티클(큰 타구 · 튐) — 이 캔버스의 루프가 그 틱 프레임에서 치우기 뒤 · HOMERUN
   * 글자 효과 틱 앞에 쏜다(`lib/homeRunEffects` 의 `drawShots`). 파티클 관리자 · 굴림(경기 난수)이 하나라 차례가 원본과 같다
   */
  readonly fieldPlayShotsAt?: (sceneTick: number) => readonly StageParticleShot[]
  /**
   * **경기 정산 효과** (결과 창 뒤 배경 `isResultBackdrop` 에서만). 0x4ea0c 가 이기고 밤하늘이면 종류 2 불꽃 · 지면 비를 깔고
   * 결과 그림 0x4a384 가 그림마다 굴린다 — 그 굴림과 파티클 틱은 **`random`(경기 난수)** 로 돈다(배경 `random` 은 하늘 줄만).
   * 하늘 색 번호는 이 화면의 하늘 줄과 `inning` 칸이다(`entities/batting` `settlementEffect`). 안 넘기면 효과 없음.
   */
  readonly settlement?: SettlementEffectSource
  /**
   * **하늘 줄 — 구장 +0x10** (`stadiumSkyRowOf`, 0x783b0). 원본은 경기 장면을 세울 때(적재 상태 8) 한 번 고르고 정산 결과 그림까지 같은 줄을
   * 쓴다 — 부르는 쪽이 경기 하나 동안 같은 값을 넘긴다. ⚠️ 안 넘기면 그림을 세울 때마다 `random` 으로 rand(0, 6) 을 굴린다(미션 · 홈런더비).
   */
  /**
   * **미션 HUD 띠** (0x36714 — trainning 프레임 13 · 효과 1 · 10) — 점수판 0x373d0 끝에서 그리므로 이 캔버스 화면에 원본 식으로 섞는다
   * (Q-03 r301). 띠 위 글 · 숫자는 부르는 쪽 DOM(`MissionHud`)이 그린다. 안 넘기면 안 그린다
   */
  readonly missionStrips?: readonly StageMissionStrip[]
  readonly skyRow?: number
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
   * 네 번째 인자는 이 공이 판정될 때의 **장면 +0xfdc**(0 스윙 · 1~3 번트 키 '8'·'7'·'9') — 타구 판 시작 리드(0x3d7b8)가
   * 도루 안 한 주자에게 +3 틱을 더하고(`DefensePlayInput.buntKind`) 공 도착 판도 본다. 사람 키만 쓴다(`sceneBuntKind` 주석) —
   * 이 공에 키가 없었으면 0 이다(0x11 진입의 memset — `sceneBuntKind` 주석).
   * 다섯 번째 인자는 **넘긴 틀의 장면 틱** — 못 맞힌 공은 0x12 를 예약한 틀(다음 틀이 0x12 틱 0), 맞은 공은 0x13 을 끝내고 0x17 을
   * 예약한 틀이다. 받는 쪽이 판 안의 때를 이 틱에 맞춘다(`gameSceneTickNow()` 를 다시 읽으면 틀 머리가 지난 뒤일 수 있다).
   */
  readonly onPitchResolved: (
    detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable?: boolean, buntKind?: number, sceneTick?: number,
  ) => PitchResolvedReply | void
  /**
   * **맞은 판정 틀**(0x6aa → 0x51408)에 부른다 — 원본은 이 틀 안에서 메시지 0x11(515c0 → 0x50faa: 필살수비 A · B · 표시 패턴 ·
   * 판 공 51188 · [경기+0xf2c] 공 5174c 의 폴 굴림)과 필살타법 517e6 을 다 굴린 뒤 0x13 을 세운다(A-37). 받는 쪽은 이 공으로 설
   * 판 입력을 지어 그 묶음을 미리 굴리고(`preRollContactMessage`) 쏜 공(+0xfcc 표시 패턴 · 판 공 궤적)을 돌려준다 — 0x13 의 경로 ·
   * 이른 넘김 · 각 · 카메라 · 불꽃이 그 공을 본다. 안 넘기거나 null 이면 굴리지 않고(판 시작이 굴린다) 쏜 패턴으로 그린다.
   */
  readonly onContact?: (detail: PitchOutcomeDetail, buntKind: number) => LaunchedShot | null | undefined
  /**
   * **상태 0x11 인가** 를 밖에서 물을 수 있게 이 칸에 묻는 함수를 넣어 준다. 원본 도루 키(0x53610 → 메시지 0x583)는
   * 0x11 의 키 함수 0x53670 이 부른다 — 0x11 은 투수 와인드업부터(공 틱 0 인 동안도) 맞은 공 판정 · 공 끝(틱 N + 1)까지다.
   * 타석 화면 밖 키 처리(`GameScreen` 등)가 이 함수로 거른다. 화면이 내려가면 null 로 되돌린다.
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
  /**
   * 이 공 앞의 **장면 +0xfdc** — 마지막으로 쓴 번트 종류. 쓰는 곳은 CPU 스윙 0x34436 과 사람 키 넷이다(직접 뜸):
   * ```
   * 51dce  스윙 0x6a5(상태 0x11 · S+4):        +0xfe0 = 1 · +0xfdc = 0 · +0xfd8 = 지금 틱 · S+0x10 = 0
   * 51e2c  필살 0x6a6(+ 남은 횟수 0xaea30 ≠ 0): +0xfe0 = 1 · +0xfdc = 0 · …                  ; S+0x10 = 타자 +0x18
   * 51e84  번트 0x6a7(+ 마선수 아님 0xb633c):  예약 +0xfe0 이 남아 있으면 지우고 +0xfdc = 0, 없으면 +0xfe0 = 1 · +0xfdc = 종류
   * 51eba  0x6a8(키 사건 +0x1c 비트 9 · '7'~'9'): +0xfdc ≠ 0 && S+4 == 0 && 마선수 아님 → +0xfe0 = +0xfdc = 0 · 번트 자세 풀기
   * ```
   * 키는 모두 상태 0x11(공이 나는 동안)에서만 받고, 그 0x11 **진입** 0x3de10 이 3deb8 에서 0x340dc = `memset(장면+0xfd8, 0, 12)` 로
   * +0xfd8 · +0xfdc · +0xfe0 을 공마다 지운다 — 그래서 키를 안 누른 공은 **0** 이다(앞 공의 값이 남지 않는다). 공 없이 도는 견제 판(0x34848 →
   * 0x10)은 0x11 을 안 지나 지우지 않는다. 번트 자세가 선 뒤에는 0xb915c 가 S+4 를 내려 스윙 · 필살 · 번트 키가 다 무시되고,
   * 자세는 '7'~'9' 를 뗄 때(0x6a8) 풀린다 — 번트는 누르고 있는 동안만이다.
   * 안 넘기면 이 화면이 마운트된 동안 스스로 든다(장면 new 의 0 에서).
   * 같은 틱에 예약이 남은 채 번트 키를 또 누르면 예약을 지우고 +0xfdc = 0 이다(51e98). 키 사건 비트 9 는 키를 뗀 사건이다(0xbca04).
   */
  readonly sceneBuntKind?: number
  /**
   * **"#TIME" 의 벤치 수 n** — 공용 그리기 0x4c4bc 의 0x4c940: 사람이 공격이면 u8 팀[+0x28c](벤치 타자), 수비면 팀[+0x33](벤치 투수).
   * 0x38984('#' 교체 가능)가 참인 화면만 넘긴다 — 모드 4 · 7 · 미션은 막혀 안 넘긴다. 상태 0xe · 0xf 이고 n > 0 이면
   * 오른쪽 아래에 game_ui 프레임 91 "#TIME" 을 그린다 (`softKeyLabels`). 안 넘기면 안 그린다.
   */
  readonly timeKeyCount?: number
  /**
   * **교체 창(경기 상태 0xb)이 떠 있는가** — 0xb 그리기 0x4db68 도 배경으로 공용 그리기 0x4c4bc 를 부르지만, 소프트키 글자 꼬리
   * 0x4c8e0 은 상태 0xd ~ 0x15 만 받아(`subs #0xd; cmp #8; bhi`) "*MENU" · "#TIME" 둘 다 안 그린다. 참이면 두 글자를 그리지 않는다
   */
  readonly isSubstitutionWindowOpen?: boolean
  /**
   * **경기 스킬 표시 판** (장면 +0x19b0, 0xd 진입 48fa4 · 0xf 진입 3dd78 · 그리기 0x4b5b4) — 타자 · 투수가 장착한 스킬 중 지금 걸리는
   * 이름을 20 그림 동안 화면 가장자리에 보이고, 전국구 · 먹튀 타자면 함성 29(0x4c39a)를 낸다(`lib/skillPanel`). 안 넘기면 안 그린다
   */
  readonly skillPanel?: SkillPanelSource
}

/** 터치 번트 '7' · '9' 의 버튼 차례 — `touchKeyOffer` 의 '8'(1) 과 '3'(2) 사이 */
const BUNT_7_TOUCH_ORDER = 1.25
const BUNT_9_TOUCH_ORDER = 1.5

/** 원작 타석 화면. 그리기는 lib, 루프와 조작은 model이 맡는다. */

export function BattingStage({ pitcherEquipmentNibbles, pitcherSkinIndex = 0, pitcherTeamIndex, batterHand, canBunt = false, swingMode = '일반', batterForm = 0, batterSkinIndex = 0, batterTeamIndex, batterEquipmentLevels, batterSkillIds = [], recentAtBatCodes = [], batterRecordSlot = 0, specialSwingNumber = 0, aceBatterIndex = -1, specialSwingRemaining, onSpecialSwingUsed, isBatterOwnPlayer = false, careerYearIndex = 0, flightProbeRef, sceneBuntKind, ...props }: BattingStageProps) {
  const isCommonWindowOpen = useIsCommonWindowOpen()
  // 지금 선 타자 · 투수의 스윙 · 번트 · 투구 그림을 미리 받는다(안 기다린다 — 그리기는 그대로)
  useStageCastPreload({
    batterForm,
    aceBatterIndex,
    batterEquipmentLevels,
    acePitcherOrder: props.acePitcher?.order ?? null,
    pitcherEquipmentNibbles,
  })
  const refs = useStageRefs({
    ...props,
    canBunt,
    swingMode,
    batterForm,
    ...(batterHand === undefined ? {} : { batterHand }),
    // 마타자 순번 — 타석 교대 0x47dd6 이 몸통 적재 0x78ab0 에, 0x35686 이 스윙 객체 +0x24 에 넣는 0xb63a0
    aceBatterOrder: aceBatterIndex,
    batterSkinIndex,
    batterEquipment: batterEquipmentLevels === undefined ? NO_EQUIPMENT : batterEquipmentOf(batterEquipmentLevels),
    // 마운드 장비 겹 (48138~4816a → 0x79790) — 마투수 그림이면 0x482fc 의 0x793b0 이 따로 싣는다
    pitcherEquipment: pitcherEquipmentOfNibbles(pitcherEquipmentNibbles),
    // 마운드 바탕 벌 = 피부 × 15 + 수비 팀 (482c0~482fc → 0x793b0 의 794c2)
    pitcherSkinIndex,
    pitcherTeamIndex: pitcherTeamIndex ?? props.hud?.opponentTeamId ?? null,
    // 팀을 안 넘기면 HUD 의 내 팀 번호를 쓴다 (근사 — props 주석 참고)
    batterTeamIndex: batterTeamIndex ?? props.hud?.ourTeamId ?? 0,
    batterSkillIds,
    recentAtBatCodes,
    batterRecordSlot,
    // 필살 남은 횟수 표시 0x38a30 이 그림마다 읽는다
    specialSwingRemaining,
    // 공용 창(히든 오픈 알림 등)이 떠 있으면 경기 장면 갱신이 멈춘다 (0x52cc6)
    isSceneFrozen: isCommonWindowOpen,
  })
  const { pitchRef, pitchTypeNumberRef, phaseRef, phaseStartTickRef, phaseEntryRef, hitSkipKeyTickRef, resultTextRef, homeRunStartTickRef, shiftRef, buntRef, deckRef, pendingHitRef, resultTicksRef, isInPlayResultRef, isHitByPitchResultRef, swingRef, heldResultRef, particlesRef, inPlayEnteredTickRef, latestRef } = refs
  // 0xd 진입 0x48d50 의 48f88 — 좌우 이동 +0xfe4 = 0 (번호가 바뀔 때만. 쉬는 동안은 안 지운다)
  useEffect(() => {
    if (props.shiftResetSerial !== undefined) shiftRef.current = 0
  }, [props.shiftResetSerial, shiftRef])
  /** 장면 +0xfdc — 사람 키가 쓰고(`sceneBuntKind` 주석) 판정된 공이 그 값을 넘긴다. 부르는 쪽이 들고 있으면 그 값을 따른다 */
  const sceneBuntKindRef = useRef(sceneBuntKind ?? 0)
  useEffect(() => {
    if (sceneBuntKind !== undefined) sceneBuntKindRef.current = sceneBuntKind
  }, [sceneBuntKind])
  /** +0xfdc 를 마지막으로 지운 공 — 새 공이면 0x11 진입 0x3de10(3deb8 0x340dc)의 memset 처럼 0 으로 지운다(`sceneBuntKindOnPitch`) */
  const sceneBuntPitchRef = useRef<Pitch | null>(null)
  const sceneBuntKindOfThisPitch = () => {
    const memory = sceneBuntKindOnPitch(
      { pitch: sceneBuntPitchRef.current, kind: sceneBuntKindRef.current },
      pitchRef.current,
    )
    sceneBuntPitchRef.current = memory.pitch
    sceneBuntKindRef.current = memory.kind
    return memory.kind
  }

  /** 타구 순간 소리 — 판정 틀에 곧바로 낸다(소리 통로 `activeSound`, 투구 순간 소리 `useStageAnimation` 과 같은 통로) */
  const playContactSoundNow = (soundId: number | null | undefined) => {
    if (soundId !== null && soundId !== undefined) activeSound().play(soundId)
  }

  const finishPitch = useCallback((swing: BattingSwing | null, tick: number) => {
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
      // 다섯째 인자는 타자 레코드 칸 0xb6394(투수 스킬 31) — 부르는 쪽이 그 모드의 레코드 칸을 넘긴다(`batterRecordSlot`)
      situation: situationOf(latest.hud, latest.recentAtBatCodes, latest.batterForm, pitch, latest.batterRecordSlot, latest.batterHand),
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
    if ((import.meta.env.DEV || import.meta.env.MODE === 'e2e') && swing !== null) {
      const { resolution } = resolved.detail
      pushBattingLog({
        kind: '판정', tick, keyTick: swing.frame, frameCount: pitch.frameCount, at: performance.now(),
        result: resolution.kind === '스트라이크' ? (resolution.isSwinging ? '헛스윙' : '스트라이크') : resolution.kind,
      })
    }
    // 진동 — 맞은 공은 0xbc5 → 0x5228c 의 100/200/300ms, 사구는 0x51b0e 의 200ms, 삼진은 0x4d0d6 의 100ms.
    // 환경설정 진동(+0x3b)이 켜졌을 때만. HUD 는 이 공 전 볼카운트다. 맞은 공은 판정 순간, 나머지는 결과(0x12)를 세울 때 울린다
    const vibrateNow = () =>
      vibrate(
        pitchVibrationMillisecondsOf(resolved.detail, swing?.frame ?? null, pitch, latest.hud?.strikes ?? null),
        latest.isVibrationOn !== false,
      )
    // 타구 순간 소리(배트 · 헛스윙 바람 — 0x515de~0x5164a)는 판정 메시지를 받은 0x51408 이 **이 판정 틀**에 낸다. 심판 콜(0x12 진입 ·
    // 수비 판)은 뒤 틀이라 받는 쪽이 낸다 — 그래서 받는 쪽에는 이미 낸 소리를 비워 넘긴다(`contactSoundId: null`)
    playContactSoundNow(resolved.detail.contactSoundId)
    // 구질 번호(game+0xfc8)를 실어 보낸다 — 받는 쪽이 0xa5e14 처럼 상대 투수 투구 수·스태미나를 깎는다
    const pitchTypeNumber = pitchTypeNumberRef.current
    const result = {
      ...resolved,
      detail: { ...resolved.detail, contactSoundId: null, ...(pitchTypeNumber === null ? {} : { pitchTypeNumber }) },
    }
    // 필살 성공(0x34c74 → 0x517e6)은 판정이 방향·패턴 뒤에 굴려 실어 준다 — 헛스윙이면 굴리지 않는다
    const isUncatchable = resolved.isUncatchable
    if (scene !== undefined) scene.deck = result.deck
    else deckRef.current = result.deck
    const resultText = describeResolution(result.detail)
    // 홈런이면 판정 글자 대신 HOMERUN 글자 연출을 켠다 (원본 0x51cd8 의 +0x1960, 사운드 11 은 웹에 없음)
    const isHomeRun = isHomeRunResolution(result.detail)

    // 맞은 공이면 인플레이(0x17) 앞에 **상태 0x13** 을 한 번 거친다. 헛스윙·볼은 0x12 라 그냥 결과다.
    if (result.detail.resultCode !== null) {
      // 맞은 판정 틀의 0x51408 — 515c0 메시지 0x11(0x50faa: 필살수비 · 표시 패턴 · 판 공 · [경기+0xf2c] 공 폴 굴림) · 517e6 필살타법을
      // 이 틀(아래 진동 0xbc5 · 0x13 예약 · 이 틀 그림의 불꽃보다 앞)에 굴린다 — 받는 쪽이 판 입력으로 미리 굴려 쏜 공을 돌려준다(A-37)
      const buntKindNow = sceneBuntKindOfThisPitch()
      const shot: LaunchedShot | null = latest.onContact?.(result.detail, buntKindNow) ?? null
      vibrateNow()
      buntRef.current = null
      const hitSide = latest.batterHand ?? batterSideOfForm(latest.batterForm)
      // 0x13 이 보는 +0xfcc — 메시지 0x11 이 고친 표시 패턴(창이 열렸으면), 아니면 쏜 패턴(0x514f2 특수 표 덮어쓰기 뒤). 쏜 공을 모르는
      // 결과(시험)만 덱에서 방금 꺼낸 패턴이다
      const shotContact =
        result.detail.resolution.kind === '타구' ? contactOfOutcome(result.detail.resolution.outcome) : result.detail.foulContact
      const pattern = shot?.launchedPattern ?? shotContact?.pattern ?? lastDrawnPattern(result.deck, result.detail.resultCode)
      const pauseInput =
        pattern === null
          ? pauseInputOf(result.detail.resultCode, result.deck, hitSide)
          : launchedPauseInputOf(result.detail.resultCode, pattern, hitSide, shot?.trajectory)
      const watchesBigHit = isBigHit(pauseInput)
      // 타격 순간 불꽃 (0x49e64 → 0x4a0ca) — 타격점은 (+0x10dc, +0x10e0) 투영 0xb94b5 + 카메라(4a03a · 필살 49b02 · 큰 타구 4cb80).
      // +0x10dc 는 놓기 0x4dc78(4dffa~4e024)만 적는 공 도착점(경로 끝 점의 투영)이라 `platePixelOf` 다 (r184 직접 떴다)
      const contact = swing === null ? null : platePixelOf(pitch)
      // 필살 스윙(S+0x10)이 0x49aec 의 그림 갈래를 타면 그 함수가 [sp+0x60] = 1 을 세워 보통 불꽃(49faa~4a0ce)을 건너뛰고,
      // 같은 타격점에 필살 파티클을 쏜다(49dbc · 49de0) — 0x49aec 는 0x13 · 맞은 공에서만 불리므로 헛스윙엔 아무것도 없다
      // 49faa 스윙 객체 S+8(번트 자세 — 0xb93a8 이 쓰는 번트 종류) ≠ 0 이면 보통 불꽃 · ptc 를 건너뛴다(직접 뜸, r215).
      // 번트 판정은 자세가 선 채 나므로(`buntStance`) 맞은 번트에는 불꽃 · 007/006 이 없다
      const isBuntStance = (swing?.buntKind ?? 0) !== 0
      const specialEffect =
        swing?.isSpecial === true
          ? specialSwingStageEffectOf(specialSwingNumber, latest.batterForm, aceBatterIndex, latest.batterHand ?? batterSideOfForm(latest.batterForm))
          : null
      if (specialEffect !== null && contact !== null) {
        for (const special of specialSwingParticlesOf(specialSwingNumber, latest.batterForm, aceBatterIndex)) {
          emitParticles(particlesRef.current, particleConfigOf(special.id), contact.x, contact.y + special.offsetY, special.img)
        }
      } else if (specialEffect === null && !isBuntStance && pattern !== null && contact !== null) {
        const particleId = hitParticleIdOf(hitParticleInputOf(pattern, result.detail.resultCode, watchesBigHit))
        if (particleId !== null) {
          emitParticles(particlesRef.current, particleConfigOf(particleId), contact.x, contact.y, HIT_PARTICLE_IMAGE)
        }
      }
      // 같은 갈래의 그림 — game_effect 애니 2 · 3 을 타격점에 (49fe6~4a0a2, `batterOverlayMarks`). 고르기는 ptc 와 같은 판정이다
      const flameAnimation =
        specialEffect !== null || isBuntStance || pattern === null || contact === null
          ? null
          : hitFlameAnimationOf(hitParticleIdOf(hitParticleInputOf(pattern, result.detail.resultCode, watchesBigHit)), watchesBigHit)
      // 0x13 진입 0x33e34 — [경기+0xf2c] 공(수평각 d 다른 공)의 점을 옮겨 타석 공 경로를 다시 채운다(`hitBallPath`). 꼬리선은
      // 강한 타구(0x35988) · 결과 코드 24~26(0x357e0)일 때만(3b440)
      const hitPath = pattern === null ? null : hitBallPathOf(hitBallTrajectoryOf(pattern, hitSide), hitSide)
      const showsHitTrail =
        pattern !== null &&
        (isHomeRunHitResult(result.detail.resultCode) ||
          // 0x35988 머리 359a0 — 스윙 객체 [+0xf9c]+8(번트 자세)이 서 있으면 거짓
          (!isBuntStance && isStrongHit(hitParticleInputOf(pattern, result.detail.resultCode, watchesBigHit))))
      pendingHitRef.current = {
        hitPath,
        showsHitTrail,
        // 0x13 카메라(0x3f060 3f23e)가 보는 판정 각 [+0xfcc] — 판 패턴 각의 부호를 뒤집은 값
        hitAngle: pattern === null ? null : hitCameraAngleOf(pattern[0]),
        ticks: hitPauseTicksOf(pauseInput),
        detail: result.detail,
        pitch,
        isUncatchable,
        isHomeRun,
        // 큰 타구 멈춤이 풀리는 0x13 그림(틱 7)에 016 을 쏜다 (0x4cb1c → 0x4cd14, `useStageAnimation`)
        bigHitAt: watchesBigHit ? contact : null,
        watchesBigHit,
        resultText,
        buntKind: buntKindNow,
        specialEffect: specialEffect === null || contact === null ? null : { ...specialEffect, x: contact.x, y: contact.y },
        hitFlame: flameAnimation === null || contact === null ? null : { animation: flameAnimation, x: contact.x, y: contact.y },
      }
      // 0x6aa 가 이 틀(판정 틱)의 갱신에서 0x13 을 예약한다 — 0x13 은 다음 틀이 틱 0 이다(`phaseEntryRef`)
      hitSkipKeyTickRef.current = null
      phaseEntryRef.current = { phase: '타격', tick: tick + 1 }
      markSceneStateEntries({ tick: tick + 1, state: SCENE_STATE.타격 })
      return
    }

    // 맞지 않은 스윙(헛스윙 · 번트 헛맞음)은 0x51226 이 0x51840 으로 끝나 상태를 안 바꾼다 — 공 끝(틱 N + 1, 0x4e24e)의
    // 0x12 에서 결과가 선다. 그때까지 들고 있는다(`endPitch`). 안 친 공은 이미 공 끝이라 곧바로 세운다
    const show = (at: number) => {
      vibrateNow()
      showResult(result.detail, pitch, isUncatchable, at)
    }
    if (swing !== null) heldResultRef.current = show
    else show(tick)
  }, [aceBatterIndex, specialSwingNumber, isBatterOwnPlayer, careerYearIndex])

  /** 결과(0x12)를 세운다 — 문구 · 결과 길이 · 알림 */
  const showResult = (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable: boolean, tick: number) => {
    const latest = latestRef.current
    buntRef.current = null
    const isHomeRun = isHomeRunResolution(detail)
    // 공 끝 0x4e24e 가 이 틀에 0x12 를 예약한다(4e26c → 0xbcb49) — 0x12 는 다음 틀이 틱 0 이다(`phaseEntryRef`)
    homeRunStartTickRef.current = isHomeRun ? tick + 1 : null
    resultTicksRef.current = resultPhaseTicksOf(detail.resolution, latest.hud)
    // 판정 v — 타석을 끝낸 스트라이크 · 볼은 삼진(애니 9) · 볼넷(애니 6) 글자다 (`judgeTextOf`)
    resultTextRef.current = judgeTextOf(detail.resolution, resultTicksRef.current > RESULT_PHASE_TICKS)
    isInPlayResultRef.current = false
    // 사구(st[0x12]) — 0x12 틱 0~7 에 타자 머리 위 표시(4a0ce, `batterOverlayMarks`)
    isHitByPitchResultRef.current = detail.resolution.kind === '사구'
    phaseEntryRef.current = { phase: '결과', tick: tick + 1 }
    // 0x12 는 다음 틀이 틱 0, 문턱 갱신이 예약한 다음 상태는 그 `resultTicks` 틀 뒤에 선다(0x4e6d4 → 판정 A)
    markSceneStateEntries(
      { tick: tick + 1, state: SCENE_STATE.결과 },
      // 타석을 끝낸 공(문턱 0x1f)이면 판정 A 가 0xd(밀어내기면 0x17 판) — 아니면 같은 타석 다음 공 0xf
      { tick: tick + 1 + resultTicksRef.current, state: resultTicksRef.current > RESULT_PHASE_TICKS ? SCENE_STATE.준비 : SCENE_STATE.선택 },
    )
    const reply = latest.onPitchResolved(detail, pitch, isUncatchable, sceneBuntKindOfThisPitch(), tick)
    // 0x3dfac 낫아웃 갈래가 판정 칸을 지웠으면(3e0aa) 0x12 틱 0 의 판정 글자 · 삼진 파티클이 없다 — 진입이 그 그림보다 먼저다
    if (reply != null && reply.judgementCleared === true) {
      resultTextRef.current = judgeTextOf(detail.resolution, resultTicksRef.current > RESULT_PHASE_TICKS, true)
    }
  }

  /**
   * **공 끝** — 0x4e060 의 4e24e: 공 틱 > N 이고 맞지 않았으면 0x12. 판정을 들고 있으면 그 결과, 스윙은 나갔는데 판정이 없었으면
   * (공이 타자 근처가 아니던 헛스윙 · 키 틱 N 의 늦은 스윙) 굴림 없는 헛스윙 스트라이크, 아니면 안 친 공 판정(사구 · 볼 · 스트라이크)이다.
   */
  const endPitch = useCallback(
    (tick: number) => {
      const held = heldResultRef.current
      if (held !== null) {
        heldResultRef.current = null
        held(tick)
        return
      }
      const pitch = pitchRef.current
      if (pitch === null) return
      const swing = swingRef.current
      if (swing !== null && swing.isReleased) {
        if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
          pushBattingLog({ kind: '판정', tick, keyTick: swing.frame, frameCount: pitch.frameCount, at: performance.now(), result: '판정없음' })
        }
        // 판정 없는 헛스윙은 이 틀(공 끝 0x4e060 의 4e21c — 0x12 예약 4e24e 와 같은 갱신)에 8/27 을 낸다. 심판 콜은 다음 틀 0x12 진입이다
        playContactSoundNow(swing.isUnjudgedWhiff ? unjudgedWhiffSoundIdOf(aceBatterIndex >= 0) : null)
        const pitchTypeNumber = pitchTypeNumberRef.current
        const detail = unjudgedSwingDetailOf(null)
        const latest = latestRef.current
        const withType = pitchTypeNumber === null ? detail : { ...detail, pitchTypeNumber }
        vibrate(
          pitchVibrationMillisecondsOf(withType, swing.frame, pitch, latest.hud?.strikes ?? null),
          latest.isVibrationOn !== false,
        )
        showResult(withType, pitch, false, tick)
        return
      }
      finishPitch(null, tick)
    },
    [aceBatterIndex, finishPitch],
  )

  /** 스윙이 나가는 틱(F + 1, 0x4e0ce) — 필살이면 남은 횟수 −1 (0x4e136: S+0x10 ≠ 0 && 남은 > 0, 결과와 무관) */
  const releaseSwing = useCallback(
    (swing: SwingReservation) => {
      if (!swing.isSpecial) return
      if (specialSwingRemaining !== undefined && specialSwingRemaining > 0) {
        onSpecialSwingUsed?.(remainingAfterSpecialSwing(specialSwingRemaining))
      }
    },
    [specialSwingRemaining, onSpecialSwingUsed],
  )

  /** 상태 0x13 을 끝내고 인플레이(0x17)로 넘긴다 — 시간이 다 됐거나 OK/'5' 로 건너뛸 때 */
  const commitHit = useCallback((tick: number) => {
    const pending = pendingHitRef.current
    if (pending === null) return
    pendingHitRef.current = null
    // 016(id 15, 프레임 10)은 0x13 끝이 아니라 멈춤이 풀리는 0x13 그림(틱 7)이 쏜다 — 정정(2026-10-24, 0x4cb1c 4ccba~4cd14 직접
    // 떴다): `useStageAnimation` 의 0x13 그리기 몫(`hitPause.HIT_STOP_TICKS`)
    // 0x13 → 0x17 — 0x17 진입 0x46418(4673e)이 다음 틱에 파티클 관리자를 비운다 (`useStageAnimation`)
    inPlayEnteredTickRef.current = tick
    hitSkipKeyTickRef.current = null
    resultTextRef.current = pending.resultText
    // 0x13 갱신이 이 틀에 0x17 을 예약한다(40786~407b0 → 0xbcb49) — 다음 틀이 틱 0 이다(`phaseEntryRef`)
    homeRunStartTickRef.current = pending.isHomeRun ? tick + 1 : null
    // 맞은 공은 원본이 0x12 가 아니라 인플레이(0x17)로 간다 — 웹 결과 문구는 보통 결과 길이로 둔다
    resultTicksRef.current = RESULT_PHASE_TICKS
    isInPlayResultRef.current = true
    isHitByPitchResultRef.current = false
    phaseEntryRef.current = { phase: '결과', tick: tick + 1 }
    markSceneStateEntries({ tick: tick + 1, state: SCENE_STATE.인플레이 })
    latestRef.current.onPitchResolved(pending.detail, pending.pitch, pending.isUncatchable, pending.buntKind, tick)
  }, [])

  const actions = useMemo(() => {
    /**
     * 키를 받은 장면 틱 `tick` 에 보이던 공 틱 — 단계 시작 틱과 같은 장면 틱 격자로 센다. 그 틀의 그림은 이미 돌았으므로 키는
     * 다음 틀의 키 처리 0x498d4(52d9e)가 읽는다(`keyTickOf`)
     */
    const frameNow = (tick: number) => ballFrameOf(tick - phaseStartTickRef.current, latestRef.current.acePitcher?.order)
    /** 키가 읽히는 틱 = 경기+0xfd8 — 보이던 공 틱 + 1 (`keyTickOf`) */
    const keyTickNow = (tick: number) => keyTickOf(frameNow(tick))
    // 스윙·번트는 공이 나는 동안(상태 0x11)만 받는다 — 릴리스 전에는 무시한다
    const isFlying = (tick: number) => phaseRef.current === '투구중' && pitchRef.current !== null && frameNow(tick) >= 0
    /**
     * 0x51db6 · 0x51dee 의 S+4 — 키 틱 F 가 1~N 이고(`acceptsBattingKey`) 이 공에 스윙이 아직 안 나갔을 때만.
     * 스윙이 나가면 0xb915c 가 S+4 를 내리고 +0xe 가 서 있어 0xb933c 가 다시 안 세운다 — 공마다 한 번이다.
     * 같은 그림 안에서 다시 누르면(예약이 아직 안 풀림) 0x51db6 이 같은 틱으로 다시 적는다.
     */
    const takesKey = (tick: number) => {
      const pitch = pitchRef.current
      if (pitch === null || !acceptsBattingKey(frameNow(tick), pitch.frameCount)) return false
      const keyTick = keyTickNow(tick)
      // 스윙이 나간 틱(F + 1) 뒤면 0xb915c(S, 3)가 S+4 를 내렸다 — 루프가 아직 못 풀었어도 틱으로 본다
      const swing = swingRef.current
      if (swing !== null && (swing.isReleased || keyTick >= swingReleaseTickOf(swing.frame))) return false
      // 번트 자세가 섰으면 0xb915c(S, 4)가 S+4 를 내렸다 — 스윙 · 필살 · 번트 키 모두 무시
      const bunt = buntRef.current
      return bunt === null || !isBuntStanceSet(bunt, keyTick)
    }
    /** 같은 틱에 예약이 아직 안 풀린 번트(자세 전)를 스윙 · 필살 키가 덮는다 — 0x51db6 이 +0xfdc = 0 으로 적어 스윙으로 풀린다 */
    const dropPendingBunt = () => {
      buntRef.current = null
    }
    return {
      // 화면 탭 배치만 본다 — 공이 나는 동안은 판 전체가 스윙(r256, `useStageControls`). 키 '4'/'6' 은 그대로 이동이다
      isBallInFlight: isFlying,
      swing: (tick: number) => {
        // 상태 0x13 은 감상 플래그(+0x199a)가 켜진 큰 타구만 OK(−5)·'5' 로 건너뛴다 (0x406e8 40708~40712).
        // 꺼진 타구(틱 8)는 키를 안 본다. 어느 쪽이든 스윙 키는 이 단계에서 스윙이 아니다
        // 키는 다음 틀의 0x13 갱신 0x406e8 이 [장면+0x40] 으로 읽는다 — 그 틀(키 틱 + 1)에 루프가 넘긴다. 0x13 을 예약한 틀(판정 틱)에
        // 누른 키도 다음 틀(0x13 틱 0)의 갱신이 읽는다
        if (phaseRef.current === '타격' || phaseEntryRef.current?.phase === '타격') {
          const pending = pendingHitRef.current
          if (pending !== null && canSkipHitPause(pending.watchesBigHit) && hitSkipKeyTickRef.current === null) {
            hitSkipKeyTickRef.current = tick + 1
          }
          return
        }
        if (!isFlying(tick) || !takesKey(tick)) return
        // 0x51dce — 스윙 키는 +0xfdc = 0 을 쓴다(번트 자세가 선 뒤에는 S+4 가 0 이라 여기 오지 않는다)
        sceneBuntKindRef.current = sceneBuntKindAfterKey(sceneBuntKindOfThisPitch(), { kind: '스윙' })
        dropPendingBunt()
        // 0x51db6: 예약 +0xfe0 = 1 · +0xfd8 = 지금 틱 — 스윙은 다음 갱신(F + 1)에 나가고 F + 2 에 판정한다(`useStageAnimation`)
        swingRef.current = { frame: keyTickNow(tick), isSpecial: false, isReleased: false, isUnjudgedWhiff: false }
        if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
          pushBattingLog({
            kind: '스윙', tick, tickNow: gameSceneTickNow(), keyTick: keyTickNow(tick),
            frameCount: pitchRef.current?.frameCount ?? -1, at: performance.now(),
          })
        }
      },
      /**
       * 번트 키 '7'/'8'/'9' 누름 (0x535a4 → 메시지 0x6a7 → 0x51e48). 상태 0x11 · S+4 가 아니면 무시하고, 지금 타자가
       * 마선수(0xb633c)면 예약하지 않는다(`buntStanceAfterBuntKey`). 모드 갈림은 없다 — 화면은 `canBunt` 로 키를 연다.
       * 자세는 누르고 있는 동안만이다 — 떼면 `releaseBunt`.
       */
      pressBunt: (kind: number, tick: number) => {
        if (!isFlying(tick) || !takesKey(tick)) return
        const isAceBatter = aceBatterIndex >= 0
        if (isAceBatter) return
        const keyTick = keyTickNow(tick)
        const swing = swingRef.current
        if (swing !== null) {
          // 51e98 — 같은 틱의 스윙 예약(+0xfe0)이 남아 있으면 지우고 +0xfdc = 0: 스윙도 번트도 안 나간다
          swingRef.current = null
          sceneBuntKindRef.current = 0
          return
        }
        // 0x51e84 — 예약이 없으면 +0xfdc = 종류(다음 갱신 0x4e100 이 풀어 자세를 세운다), 같은 틱 예약이 있으면 지우고 0
        const stance = buntStanceAfterBuntKey(buntRef.current, kind, keyTick, isAceBatter)
        sceneBuntKindRef.current =
          stance === null ? 0 : sceneBuntKindAfterKey(sceneBuntKindOfThisPitch(), { kind: '번트', buntKind: kind, isAceBatter })
        buntRef.current = stance
      },
      /**
       * 번트 키 '7'~'9' 뗌 (+0x1c 비트 9 → 0x5364c → 0x6a8 → 0x51eba) — 자세가 섰으면 풀고 +0xfdc = 0. 풀린 뒤 곧 0xb933c 가
       * S+4 를 다시 세워 그 공에 다시 스윙 · 번트할 수 있다. 상태 0x11 이 아니면 무시한다.
       */
      releaseBunt: (tick: number) => {
        if (phaseRef.current !== '투구중' || pitchRef.current === null) return
        const stance = buntRef.current
        const released = buntStanceAfterRelease(stance, keyTickNow(tick), aceBatterIndex >= 0)
        if (released === stance) return
        buntRef.current = released
        sceneBuntKindRef.current = 0
      },
      /**
       * 좌우 이동 '4'/'6' (0x53470 → 0x6a4 → 0x50f86) — 0x53470 은 상태 0xf · 0x10 · 0x11 의 키 함수에서만 불린다.
       * 웹 '대기'(0xf + 0x10, 타석이 끝나 쉬는 동안 제외) · '투구중'(0x11)만 받고 0x13 · 결과에서는 무시한다.
       */
      moveBatter: (direction: -1 | 1) => {
        const phase = phaseRef.current
        const takesShift = phase === '투구중' || (phase === '대기' && !latestRef.current.isPaused)
        if (!takesShift) return
        shiftRef.current = nextBatterShift(shiftRef.current, direction)
      },
      /**
       * '0' 은 **그 자리에서 필살 스윙**이다 (0x535a4 → 메시지 0x6a6 → 0x51dee). 일반 스윙(0x6a5 → 0x51db6)과
       * 똑같이 경기+0xfe0 = 1 · +0xfdc(번트) = 0 · +0xfd8 = 지금 틱으로 스윙을 예약하고, S+0x10 에 0 대신
       * 타자 +0x18 을 쓰는 것만 다르다 (0x51e40). 상태 0x11(공이 나는 중)·S+4 가 아니면 무시한다.
       */
      specialSwing: (tick: number) => {
        if (!isFlying(tick) || !takesKey(tick)) return
        // 0x51e14: 남은 횟수 0xaea30 이 0 이면 무시 — 번호(+0x18)가 0 이면 늘 0 이다
        if (!canSpecialSwing(specialSwingNumber, aceBatterIndex >= 0, specialSwingRemaining)) return
        // 0x51e2c — 필살 키도 +0xfdc = 0 (번트 자세가 선 뒤에는 S+4 가 0 이라 여기 오지 않는다)
        sceneBuntKindRef.current = sceneBuntKindAfterKey(sceneBuntKindOfThisPitch(), { kind: '필살' })
        dropPendingBunt()
        // 0x51dee: 일반 스윙과 같은 예약에 S+0x10 = 타자 +0x18. 남은 횟수 −1 은 예약이 풀리는 틱(0x4e136, `releaseSwing`)
        swingRef.current = { frame: keyTickNow(tick), isSpecial: true, isReleased: false, isUnjudgedWhiff: false }
      },
    }
  }, [commitHit, specialSwingNumber, aceBatterIndex, specialSwingRemaining])

  // 상태 0x11 인가 — 도루 키(0x53610)를 받는 화면이 묻는다. 0x53670 은 0x11 **전체**(와인드업 포함, 공 틱이 0 인 동안도)에서
  // 0x53610 을 부르므로 릴리스 전도 참이다. 0x11 은 맞은 공의 판정(→ 0x13)이나 공 끝(틱 N + 1 → 0x12)까지 이어진다
  useEffect(() => {
    if (flightProbeRef === undefined) return
    flightProbeRef.current = () => phaseRef.current === '투구중' && pitchRef.current !== null
    return () => {
      flightProbeRef.current = null
    }
  }, [flightProbeRef, phaseRef, pitchRef])

  // 장면 들여다보기(웹 개발 도구 — r242 타이밍 측정): 공 그림 · 틱 격자를 e2e 가 읽는다. 상태는 안 바꾼다
  useEffect(() => {
    if (!(import.meta.env.DEV || import.meta.env.MODE === 'e2e')) return
    publishScenePeek('battingStage', {
      probe: () => ({
        phase: phaseRef.current,
        phaseStartTick: phaseStartTickRef.current,
        frameCount: pitchRef.current?.frameCount ?? null,
        releaseTicks: pitcherReleaseTicksOf(latestRef.current.acePitcher?.order),
        tickNow: gameSceneTickNow(),
        tickStartTimeOf: (tick: number) => gameSceneTickStartTime(tick) + (performance.now() - gameSceneNow()),
        msPerTick: millisecondsPerFrame(),
        plateError: pitchRef.current === null ? null : plateErrorOf(pitchRef.current, 0),
      }),
    })
    return () => publishScenePeek('battingStage', null)
  }, [phaseRef, phaseStartTickRef, pitchRef, latestRef])

  // 타석 장면은 원본 틱 차례(갱신 → 그리기 → 프레임 끝 0x6de84)로 앱 전역 파티클 관리자를 직접 굴리고 그린다
  useClaimSceneParticles()
  useStageAnimation(refs, { judgePitch: finishPitch, endPitch, commitHit, releaseSwing })
  const pointerHandlers = useStageControls(refs, actions)
  // 터치 상황 버튼 (웹 껍데기, `touchKeyOffer`) — 이 타석이 그 키를 받는 동안만 띄운다. 버튼은 같은 키 사건을 쏜다(위 `useStageControls`).
  // 필살타 '0' 은 0x51e14 가드(번호 · 남은 횟수 — `canSpecialSwing`)가 열려 있을 때, 번트 '8' 은 화면이 번트 키를 열었고(`canBunt`)
  // 마타자가 아닐 때(0x51e48 이 마선수면 예약하지 않는다). 공을 안 던지는 동안(결과 연출 `isPaused` · 결과 창 배경 · 공용 창)은 거둔다
  const takesStageKeys = !props.isPaused && props.isResultBackdrop !== true && !isCommonWindowOpen
  useTouchKeyOffer(
    takesStageKeys && canSpecialSwing(specialSwingNumber, aceBatterIndex >= 0, specialSwingRemaining)
      ? { key: '0', label: '필살타' }
      : null,
  )
  // 번트 '7' · '9' 도 같은 0x51e48 로 종류 2 · 3 을 예약한다(0x535a4) — '8' 처럼 누르는 동안만(뗄 때 0x6a8). 버튼은 '8' 바로 뒤에 선다
  const offersBunt = takesStageKeys && canBunt && aceBatterIndex < 0
  useTouchKeyOffer(offersBunt ? { key: '8', label: '번트', isHold: true } : null)
  useTouchKeyOffer(offersBunt ? { key: '7', label: '번트 7', isHold: true, order: BUNT_7_TOUCH_ORDER } : null)
  useTouchKeyOffer(offersBunt ? { key: '9', label: '번트 9', isHold: true, order: BUNT_9_TOUCH_ORDER } : null)

  return (
    <canvas
      ref={refs.canvasRef}
      className={styles.stage}
      // 홈런더비 판(0x17) — 밑에 깔린 필드 화면이 비치도록 바탕을 뺀다(`isFieldPlay`)
      style={props.isFieldPlay === true ? { background: 'transparent' } : undefined}
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      {...pointerHandlers}
    />
  )
}
