import type { MutableRefObject } from 'react'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { SwingMode } from '@/entities/batting/model/swingResult'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { RunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import type { HomeRunTextWindow } from '@/widgets/batting-stage/lib/homeRunBanner'
import type { LaunchedShot } from '@/widgets/batting-stage/lib/hitPause'
import type { StageParticleShot } from '@/widgets/batting-stage/lib/homeRunEffects'
import type { StageMissionStrip, StageWarmCast } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery'
import type { PitchResolvedReply } from '@/widgets/batting-stage/lib/stageText'
import type { AcePitcherFrames, SettlementEffectSource, SkillPanelSource, StageHud } from '@/widgets/batting-stage/model/stageRefs'

/** 타석 장면(`BattingStage`)의 props */
export interface BattingStageProps {
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
   * 피부를 안 넘기면 0, 팀을 안 넘기면 `hud.opponentTeamId` 다 — 0x47cc8 47d06 0xb6c09(경기) = state[10](수비 측)의 팀(0xb6c08)을
   * [sp+0x30] 에 두고 482f6 이 넘긴다. 이 부품은 사람이 치는 타석에만 서므로 수비 팀 = 상대 팀이다(`batterTeamIndex` 와 같은 근거)
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
   * 원본 팀 = **공격 팀**: 타석 교대 0x47cc8 이 47cfe 0xb6bf9(경기) — state[9](공격 측)의 팀 번호(0xb6bf8 b6bfc) — 를 [sp+0x34] 에 두고
   * 47dd0 에서 몸통 적재에 넘긴다(Q-12, 2026-10-27 직접 떴다). 이 부품은 사람이 치는 타석(state[9] = 사람 측)에만 서므로 공격 팀 = 내 팀
   * = `hud.ourTeamId` 다. 사람이 던지는 타석(상대 공격)은 `PitcherSideStage` 가 `batterTeamIndex` 로 상대 팀을 받는다
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
   * **HUD 를 안 그리는 상태가 섰다** — 돌발 제안 창 0x1b(그리기 0x4a198) · 강판 감독 대사 0x23(0x50828)은 0x42f2c · 0x4c4bc 를 안 부른다
   * (점수판 · 램프 · 존 · 소프트키 · 구속 · 필살 · 스킬 판이 없다 — `renderBattingStage` 의 `omitsHud`). 안 주면 거짓
   */
  readonly isHudOmitted?: boolean
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
    detail: PitchOutcomeDetail,
    pitch: Pitch,
    isUncatchable?: boolean,
    buntKind?: number,
    sceneTick?: number,
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
