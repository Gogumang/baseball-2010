import type { RefObject } from 'react'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import type { StageWarmCast } from '@/widgets/batting-stage/lib/renderBattingStage'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import { withNariGameMorale } from '@/entities/career/model/nariMorale'
import { RUTHLESS_SKILL_ID } from '@/entities/batting/model/specialSwing'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { sceneFieldPaletteOf } from '@/features/play-team-game/model/sceneStadium'
import {
  mySpecialSwingRemainingOf,
  opponentMoundStaminaPercentOf,
  opponentPitcherEquipmentOf,
  opponentPitcherSkinIndexOf,
  ourRunnerAcesOf,
} from '@/features/play-game/model/gameFlow'
import { gameStageAcePitcherOf } from '@/pages/game/lib/gameStageAcePitcher'
import { BATTER_CAREER_MODE, type GameScreenProps } from './gameScreenProps'
import { gameStageHudOf, gameStageSkillPanelOf } from './gameStageInputs'

/** 환경설정을 안 넘기면 전광판 · 진동 칸도 안 넘긴다 */
const NO_SETTINGS: Partial<GameSettings> = {}

interface GameBattingStageProps {
  /** 경기 화면이 받은 값 — 대부분 타석 캔버스에 그대로 간다 */
  readonly props: GameScreenProps
  readonly warmCast: StageWarmCast
  /** 일시정지 · 경기 중 메뉴 · 하위 화면 · 0xe(OK 대기) */
  readonly isPaused: boolean
  readonly shiftResetSerial: number
  readonly flightProbeRef: RefObject<(() => boolean) | null>
}

/**
 * 타석 캔버스 — 나만의리그 타자편(모드 4)의 `BattingStage`.
 * 원본 타석 화면에는 글자 안내가 없다 — 마선수 등판은 컷인 0x473f0 · 판정은 game_judge 애니뿐이라
 * 웹 전용 "등판!" 띠 · 조작 안내(Hint) · 큰 결과 글자(BigResult)를 걷어 냈다
 */
export function GameBattingStage({ props, warmCast, isPaused, shiftResetSerial, flightProbeRef }: GameBattingStageProps) {
  const { career, progress, atBat, pitcherAbility, aceLevels, cpuMagic, random, onPitchResolved, onContact, onPickoff } = props
  const { onSpecialSwingUsed, sceneBuntKind, runnerAnimationClock, skillPanelScene, skyRow, sceneStadium = null, isHudOmitted = false } = props
  const { isScoreboardOn, isVibrationOn } = props.settings ?? NO_SETTINGS
  return (
    <BattingStage
      isHudOmitted={isHudOmitted}
      // 0xb570c 의 사기 감소는 b5768 이 넘겨 받은 팀 레코드 +2 에 쓴 0xa3a24 값을 읽는다 — 국가대항전 중이면 상대국 칸 +2
      // (원본 버그, `withNariGameMorale`)
      batterAbility={effectiveAbilityOf(withNariGameMorale(career))}
      // 번트 '7'/'8'/'9' — 0x535a4 → 0x6a7 → 0x51e48 은 모드를 안 본다. 타자편은 내 선수가 쳐서 마선수(0xb633c)가 아니다
      canBunt
      swingMode="나만의리그"
      gameMode={BATTER_CAREER_MODE}
      // 환경설정 전광판(저장 +0x3a) — OFF 면 흐르는 글자를 안 그린다 (0x77726)
      isScoreboardOn={isScoreboardOn}
      // 환경설정 진동(저장 +0x3b) — 맞은 공·사구 진동 (0x3a44)
      isVibrationOn={isVibrationOn}
      // 타자 폼 = 원본 rec[0xb] 윗니블 `2 × 타입 + 손` (C 5절 0x16f9a) — 장타형이면 sluger 몸통이 나온다
      batterForm={career.battingTypeIndex * 2 + career.battingSide}
      // 고른 피부(0 황인 · 1 백인 · 2 흑인)와 장비를 타석 그림에 입힌다 —
      // 안 넘기면 구운 벌(피부 0)과 맨몸으로 나간다
      batterSkinIndex={career.skinIndex}
      batterEquipmentLevels={career.equipmentLevels}
      // 스윙 결과 0xab214 는 0xb62b4 = 장착 비트(+0x14)만 본다 — 보유 전부가 아니다
      batterSkillIds={career.equippedSkillIds}
      recentAtBatCodes={progress.recentAtBatCodes}
      // 투수 스킬 31 의 0xb6394(내 선수) — 0xb53f1 이 내 선수를 칸 +0xa & 0x1f 에 앉히고 0xb8768 이 그 첨자로 다시 매긴다
      // (142 진입 0x1c54a 도 타순 = 레코드 안 내 줄 첨자 + 1 로 읽는다) — 곧 내 타순 칸.
      // 국가대항전도 같다(직접 떴다): 0x39fdc 3a0f0~3a162 가 S+0x12c 면 두 팀을 대진 0xb7614(L, L+0xad, 0/1)로 고르고 팀 10 을 우리
      // 쪽(r6)에 두며, 0xb891c → 0xb8680(모드 4) → 0x1f989 → 0x1f8f8 이 팀 10 을 대표팀 칸 +0xbc4 로 읽는다. 3a2fa 0xb8768 이
      // 그 배열을 다시 매기므로 내 칸 = 대표팀 안 내 첨자 = `nariCupBattingOrderOf` − 1 = playerOrderIndex
      batterRecordSlot={progress.game.playerOrderIndex}
      pitcherAbility={pitcherAbility}
      // 마운드 상대 투수 레코드 +0x19 · +0x1a 니블 → 장비 겹 (타석 교대 0x47cc8 의 48138~4816a, 마투수면 없음)
      pitcherEquipmentNibbles={opponentPitcherEquipmentOf(progress)}
      // 마운드 바탕 벌 = 피부 × 15 + 수비 팀(482c0~482fc → 0x793b0 의 794c2) — 수비 팀 = 상대
      pitcherSkinIndex={opponentPitcherSkinIndexOf(progress)}
      pitcherTeamIndex={progress.opponentTeamId}
      warmCast={warmCast}
      // 마선수 대결의 상대 마투수 마구 횟수 = 0xd8509[mgr[0x13a + 순번]] (0xaebe4)
      aceLevels={aceLevels}
      {...(cpuMagic === undefined ? {} : { cpuMagic })}
      hud={gameStageHudOf(progress, atBat)}
      // 루상 주자 0x35b94 — 주자 +0x9c ≠ −1(마선수)이면 타석 교대 0x483a0 이 +0x1c 에 실은 ace/defender 그림 (수비 판과 같은 값)
      runnerAces={ourRunnerAcesOf(progress)}
      // 투수 그리기 0x38d1c — 상대 마운드 체력% ≤ 34 면 지친 눈(모드 4 도 그린다 — 38ed6 은 모드 7 만 거른다). 마투수면 null
      pitcherStaminaPercent={opponentMoundStaminaPercentOf(progress)}
      isEagleEyeEnabled={career.eagleEyeGamesRemaining > 0}
      // 마운드 마투수 그림 — 마선수 대결 투수 · 142 가 8번 칸에 넣은 마투수 (`gameStageAcePitcherOf`, 0x793b0 의 793c2)
      acePitcher={gameStageAcePitcherOf(progress)}
      // 조작방법 뷰어 동안도 일시정지 팝업이 떠 있어 경기 갱신이 멈춘다 (0x52cc6 0x754f9)
      // 0xe(OK 대기)에서도 공이 안 나간다 — 타석 장면(0xd 그리기)만 선다
      isPaused={isPaused}
      // 좌우 이동 +0xfe4 는 0xd 진입 48f88 에서만 지운다 — 같은 타석의 다음 공(0xf)과 결과 연출 동안은 남는다(A-02)
      shiftResetSerial={shiftResetSerial}
      {...(skyRow === undefined ? {} : { skyRow })}
      // 구장 객체(0x39fdc 모드 4 — 홈 팀 · 대회 2/8) — 펜스 프레임 +0x70 · 바닥 팔레트 줄 +0xc
      {...(sceneStadium === null ? {} : { stadium: sceneStadium.stadium })}
      fieldPalette={sceneFieldPaletteOf(sceneStadium)}
      random={random}
      // 필살타법 '0' (0x535a4 → 0x51dee → 0x34c74). 레벨이 아니라 **고른 번호**(+0x18)를 넘긴다 —
      // 0 이면(아직 안 고름) '0' 키가 무시된다
      specialSwingNumber={career.specialSwingNumber}
      // 한 경기 횟수 s8 team[+0x29 + 타순] — 0xaebe4 가 표 0xd84f0[+0x18] (+ 스킬 23 무자비 1)로 채운다
      specialSwingRemaining={mySpecialSwingRemainingOf(progress, {
        swingNumber: career.specialSwingNumber,
        hasRuthlessSkill: career.equippedSkillIds.includes(RUTHLESS_SKILL_ID),
      })}
      onSpecialSwingUsed={onSpecialSwingUsed}
      sceneBuntKind={sceneBuntKind}
      {...(runnerAnimationClock === undefined ? {} : { runnerAnimationClock })}
      // 경기 스킬 표시 판(0xd 진입 48fa4 · 0x4b5b4) — 0xd 진입마다 새 0xe 대기 객체 · 사람 팀이 공격 측(st[9])
      skillPanel={gameStageSkillPanelOf(progress, skillPanelScene)}
      // 0xab214 의 내 선수 보너스 — 모드 4 에서 rec = 0x1f8d4(저장, 4) = [저장+0xbc]+0x11c 의 rec[0xa] 비트7(육성)이
      // 서고(0xb6389, ab3d6), 연차 idx 는 같은 레코드 +0xb3 (ab3f2) — 커리어 연차는 1부터라 1 을 뺀다
      isBatterOwnPlayer
      careerYearIndex={career.season - 1}
      onPitchResolved={onPitchResolved}
      onContact={onContact}
      flightProbeRef={flightProbeRef}
      onPickoff={onPickoff}
    />
  )
}
