import type { ReactNode } from 'react'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { CpuSwingPose } from '@/entities/pitching/model/simulateBatter'
import type { StageMissionStrip, StageWarmCast } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { HudState } from '@/widgets/batting-stage/lib/renderHud'
import type { SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery'
import type { BatterEquipment, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import type { PitcherHitScene } from '@/widgets/batting-stage/lib/pitcherSideStage'
import type { PitchInputOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import type { AcePitcherFrames, PitcherSideSkillPanelSource } from '@/widgets/batting-stage/model/stageRefs'

/** 사람이 던지는 타석 장면(`PitcherSideStage`)의 props — 루프(`pitcherSideLoop`)가 그림마다 최신 값을 읽는다 */
export interface PitcherSideStageProps {
  /** 이 화면에서 마지막으로 던진 공(진행기 `lastPitch`). 화면이 설 때 이미 있던 공은 다시 날리지 않는다 */
  readonly pitch: Pitch | null
  /** 그 공의 판정 — 0x12 를 지나는지 · 판정 글자 */
  readonly resolution: PitchResolution | null
  /**
   * 그 공에 CPU 타자가 휘둘렀으면 스윙 프레임 F(+0xfd8) · 번트 종류(+0xfdc). 0x11 갱신 0x4e0dc 가 공 틱 ≥ F 인 틱에
   * 스윙 객체 vtable +0x14(스윙) · +0x18(번트)을 건다 — 타자 그림 0x49e64 가 그 자세를 그린다
   */
  readonly cpuSwing?: CpuSwingPose | null
  /** 0x12 대기 틱 (0x4e6d4 — `resultWaitTicksOf`) */
  readonly resultTicks: number
  /**
   * 그 공의 0x12 진입 0x3dfac 가 판정 칸 [장면+0x10ac] 를 지웠나 — 낫아웃 갈래 3e0aa (`clearsPitchJudgement`). 서 있으면 0x12 틱 0 의
   * 판정 글자 '삼진'과 그 양끝 파티클(39498)이 없다(`judgeTextOf`). 진행기가 공을 정할 때 공 도착까지 돌려 실어 준다. 안 넘기면 거짓
   */
  readonly isJudgementCleared?: boolean
  readonly hud: HudState | null
  /**
   * 마운드 투수 체력 % — 34 이하면 투수 자리에 체력 그림(player_effect 애니 9 · 10, 0x38d1c)을 그린다. 안 넘기면 안 그린다
   */
  readonly pitcherStaminaPercent?: number | null
  /**
   * `pitch` 가 실투였나 — 놓기 0x4dc78 의 4deae 가 투구 객체 +8 = 4 를 적어 투수 그리기 0x38d1c 38ee0 이 놓은 그림부터 네 번
   * 머리 위 "!"(player_effect 애니 13)를 그린다 (`pitcherFatigue` 의 실투 "!"). 안 넘기면 안 그린다
   */
  readonly isMistakePitch?: boolean
  /**
   * 타자 · 루 주자의 마선수 번호(0~4, 주자 +0x9c) — 루상 마선수 주자를 실린 ace/defender 그림으로 그린다(0x35c62 · 0x79da9,
   * `renderBattingStage` 의 같은 이름). 안 넘기면 모두 defender 그림이다
   */
  readonly runnerAces?: RunnerAces
  /** 타석에 선 (CPU) 타자의 폼 `rec[0xb] >> 4` · 피부 `(rec[0xb] >> 2) & 3` · 팀 */
  readonly batterForm: number
  readonly batterSkinIndex: number
  readonly batterTeamIndex: number
  /**
   * 타자 손 0xb63c0 (화면 배치 +0x17e1) — 안 주면 폼의 낮은 비트. 마타자는 폼이 아니라 표 0xd88b0 이라 부르는 쪽이 준다
   */
  readonly batterSide?: number
  /**
   * 마타자 순번 `0xb63a0(타자)` (0~4) — 타석 교대 0x47dd6 이 몸통 적재 0x78ab0 에 넘겨 `ace/batter_*` 한 장을 싣고, 스윙 객체
   * +0x24(0x35686)로 자세표 0xb905c 의 마타자 갈래를 고른다. 없으면 일반 타자
   */
  readonly aceBatterOrder?: number
  /**
   * 타자 장비 겹 — 타석 교대 0x47cc8 이 타자 그림(장면 +0xf18)을 0x768b4 로 비운 뒤, 마타자(0xb63a0 ≥ 0)가 아니면 47e80~47eb6 에서
   * 지금 타자 레코드(0xae89c(공격 팀)) +0x19 · +0x1a 의 니블 네 칸 − 1 을 장비 적재 0x78fd8 로 싣는다 — 모드를 가리지 않는다(직접 떴다).
   * 안 주면 맨몸
   */
  readonly batterEquipment?: BatterEquipment
  /** 마운드의 내 투수 — 폼(단계 표) · 손(좌투 뒤집기) · 장비 겹(0x79790) */
  readonly pitcherForm: number
  /**
   * 마운드 투수 레코드 +0x18 (마구 · 마선수 번호) — 공 그림 0x3b2f4 3b4dc 가 마구 공 파티클 갈래(0xcff20)를 고른다. 놓기 전 0x11 그림
   * (틱 0~9)은 아직 공이 없어 이 값으로 쏜다(Q-09). 안 넘기면 0(파티클 없음)
   */
  readonly pitcherMagicNumber?: number
  readonly pitcherHand: number
  readonly pitcherEquipment?: PitcherEquipment
  /**
   * 마운드 내 투수 레코드의 피부 `(rec[0xb] >> 2) & 3` · 수비 팀 0xb6c08(게임) — 타석 교대 0x47cc8 의 482c0~482fc 가 적재 0x793b0 에
   * 넘겨 794c2 가 `pitcher.pzx` 를 **피부 × 15 + 팀** 벌로 연다. 피부를 안 주면 0, 팀을 안 주면 `hud.ourTeamId`(던지는 쪽이 내 팀)
   */
  readonly pitcherSkinIndex?: number
  readonly pitcherTeamIndex?: number
  /** 곧 설 선수들(다음 CPU 타자 · 대타 · 교체 투수)의 생김새 — 그림마다 칠하기를 미리 건다 (`BattingStage.warmCast`) */
  readonly warmCast?: StageWarmCast
  /**
   * 마운드의 마투수 그림 — 타석 교대 0x482fc 의 적재 0x793b0 이 순번 0xb63a0 으로 `ace/pitcher_*` 를 싣는다. 없으면 평범한 투수
   */
  readonly acePitcher?: AcePitcherFrames | null
  /** 구장 +0x70 · 바닥 줄 +0xc · 하늘 줄 +0x10 */
  readonly stadium: number
  readonly fieldPalette: number | null
  readonly skyRow: number
  /** 시즌 홈경기 구장 (0x77494) — 있으면 배경이 시즌 구장으로 갈린다 */
  readonly seasonStadium?: SeasonStadium
  readonly gameMode: number
  readonly isScoreboardOn?: boolean
  /** 0xd · 0xe 대기(확인 · 소개 판) — 쉬는 '대기' */
  readonly isPaused: boolean
  /**
   * **HUD 를 안 그리는 상태가 섰다** — 돌발 제안 창 0x1b(그리기 0x4a198) · 강판 감독 대사 0x23(0x50828)은 0x42f2c · 0x4c4bc 를 안 부른다
   * (점수판 · 램프 · 존 · 소프트키 · 구속 · 필살 · 스킬 판이 없다 — `renderBattingStage` 의 `omitsHud`). 안 주면 거짓
   */
  readonly isHudOmitted?: boolean
  /** 일시정지 팝업(0x741a0) — 장면 틱이 멈춘다(0x52cc6). 그림은 그 자리에 둔다 */
  readonly isFrozen?: boolean
  /**
   * 사람 투구 UI 의 그림 재료 — 구질 · 조준 · 게이지 단추가 싣는다(`pitchInputOverlay`). 그림마다 읽어 장면 안에 그린다
   * (원본 0x4c4bc · 0x4d780 · 0x4d2ac). 공이 날거나 0x12 인 동안은 안 그린다
   */
  readonly inputOverlayRef?: { readonly current: PitchInputOverlay | null }
  /**
   * "#TIME" 의 벤치 수 n — 사람 수비면 수비팀[+0x33](벤치 투수, 0x4c940). '#' 교체 검사 0x38984 가 거짓인 화면(미션)은 null.
   * 상태 0xe(쉬는 대기) · 0xf(구질 목록이 실린 동안)에만 그린다
   */
  readonly timeKeyCount?: number | null
  /** 미션 HUD 띠 — 타자편 `BattingStage` 의 같은 이름 props 주석 참고 (Q-03 r301) */
  readonly missionStrips?: readonly StageMissionStrip[]
  /** 교체 창(상태 0xb)이 떠 있는가 — 소프트키 글자 "*MENU" · "#TIME" 을 안 그린다 (`BattingStage` 의 같은 이름 props 주석 참고) */
  readonly isSubstitutionWindowOpen?: boolean
  /**
   * **경기 스킬 표시 판** (장면 +0x19b0, 0xd 진입 48fa4 · 0xf 진입 3dd78 · 그리기 0x4b5b4) — CPU 타자 · 사람 투수가 장착한 스킬 중
   * 지금 걸리는 이름을 20 그림 동안 보이고, 그 CPU 타자가 전국구 · 먹튀면 함성 29 를 낸다. 공용 HUD 0x4c4bc 꼬리라 누가 던지든 같다.
   * 0xf = 구질 목록이 실린 대기 · 0x10 = 조준 · 0x11 = 게이지 또는 공이 나는 동안. 안 넘기면 안 그린다
   */
  readonly skillPanel?: PitcherSideSkillPanelSource
  /**
   * 0xd 진입(0x48d50)마다 바뀌는 표지(`useSceneConfirm` 의 `sceneDEntryMark`) — 48ee4 0x35650 → 0x340c0 이 투수 그림 객체를 상태 0 으로
   * 되돌린다. 0xf → 0xb('#' 교체 창) → '#' · CLR → 곧장 0xe(0x4984a) 길은 0xd 가 없어 안 바뀐다 — 그동안(0xb · 0xe) 투수 갱신
   * 0x9e004 가 안 불려(0xf 0x39c1c · 0x11 0x4e060 만 부른다) 대기 동작이 굳은 채 남고, OK 뒤 0xf 진입 0x3d954 가 되돌린다.
   * 교체를 확정한 길(0xb → 0x16 → 0xd)은 0x16 동안 굳어 있다가 0xd 에서 되돌린다. 안 넘기면 0xf 진입만 본다
   */
  readonly sceneDEntryMark?: number
  /**
   * `pitch` 를 CPU 타자가 맞혔으면 그 0x11 끝 · 0x13 재료(`pitcherHitSceneOf`) — 이 장면이 판정 틀까지 0x11 을, 이어 0x13 을 그리고
   * 0x17 이 서는 틀에 `onHitSceneEnd` 를 부른다(부르는 화면이 그때 수비 판을 띄운다). 안 넘기면 맞은 공은 공 틱 N + 1 에서 대기다
   */
  readonly hitScene?: PitcherHitScene | null
  /** 0x13 이 끝나 0x17 이 선 틀 — 이 장면이 그 공을 날리지 않았으면(화면이 설 때 이미 있던 공) 첫 그림에 부른다 */
  readonly onHitSceneEnd?: () => void
  /**
   * 판정 틀(0x6aa → 0x51408) — 메시지 0x11 이 필살수비 · 표시 패턴 · 두 공 폴 · 필살타법을 굴린 뒤 0x13 이 선다(A-37). 부르는 화면이
   * 판 입력으로 그 묶음을 미리 굴리고 표시 패턴으로 다시 만든 0x13 재료를 돌려준다(`usePitcherHitScene.judge`). 안 넘기면 굴리지 않는다
   */
  readonly onHitJudged?: () => PitcherHitScene | null
  /** 장면 위에 얹는 UI (소개 판 · 교체 연출 · 조준 그림 따위) — 원본도 상태 그리기가 장면 다음에 그린다 */
  readonly children?: ReactNode
}
