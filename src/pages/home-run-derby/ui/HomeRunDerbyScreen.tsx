import { useState } from 'react'
import { BigResult, Hint, PixelScreen } from '@/shared/ui'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { DerbyResult } from '@/entities/home-run-derby/model/derbyRun'
import { derbyBallCountOf, derbyBallNumberOf } from '@/entities/home-run-derby/model/derbyRun'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { useHomeRunDerby } from '@/pages/home-run-derby/model/useHomeRunDerby'
import { DerbyHud } from '@/pages/home-run-derby/ui/DerbyHud'
import { DerbyResultWindow } from '@/pages/home-run-derby/ui/DerbyResultWindow'
import * as styles from '@/pages/home-run-derby/ui/HomeRunDerbyScreen.css'

interface HomeRunDerbyScreenProps {
  /**
   * 치는 선수의 능력치. 원본은 모드 7 로 들어갈 때 `0x213c0(앱, 4, 0)` 으로 **나리 타자편 저장**을
   * 올린다 — 선수 고르기 창 결과 2 = 육성 타자 · 4 = 명예 타자다(H-2, Q2 확정).
   * 웹에는 아직 명예의 전당 선수를 경기에 넣는 길이 없어 부르는 쪽이 육성 선수를 넘긴다.
   */
  readonly ability: BatterAbility
  /**
   * 치는 선수의 겉모습 — 원본이 나리 타자편 저장을 올리므로 **그 선수의 피부·폼·장비**가 그대로 나온다.
   * 안 넘기면 구운 벌(피부 0)과 맨몸으로 그려진다.
   */
  readonly batterForm?: number
  readonly batterSkinIndex?: number
  readonly batterEquipmentLevels?: BatterAbility
  /**
   * 치는 선수의 **장착** 스킬 (0xb62b4 — 선수 기록 +0x14). 같은 저장을 올리니 그 선수 것이다.
   * 압도 22 면 CPU 실투율 +5 (0x33d52). 안 넘기면 스킬 없음.
   */
  readonly batterSkillIds?: readonly number[]
  /**
   * 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`, 격자 칸 → 0~4). 난입 마투수 능력치 배율
   * 0xd88aa(0xb6414)·마구 횟수 0xd8509(0xaebe4)가 본다. 안 넘기면 배율 없이 날 값 · 마구 Lv1.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  readonly random: RandomPort
  /** 저장된 최고 비거리 (저장 +0x5c, u16) */
  readonly bestDistance: number
  /** 보유 G (app+0x64) — 결과 화면 "보유 GP" 칸 */
  readonly gamePoint: number
  /** 한 판이 끝났을 때. 최고 기록 갱신과 G 지급은 부르는 쪽이 한다 */
  readonly onFinish?: (result: DerbyResult) => void
  /** 결과 화면에서 "아니오" — 메인 메뉴로 (전역 0x140006c = 4) */
  readonly onExit: () => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
}

/** 홈런더비 = 원본 전역 모드 7 — 경기 중 메뉴 표 0xcfcfc 의 **행 1**(자동진행 자리에 다시하기) */
const DERBY_MODE = 7
type MenuOverlay = '조작방법' | '설정'

/**
 * 홈런더비 (게임 모드 7) — `docs/re/H-modes.md` H-2 절의 규칙 전체를 옮긴 화면이다.
 *
 * 10구(+보너스) 동안 타석만 치고, 결과는 `entities/home-run-derby` 의 순수 모델이 센다.
 * 타석 연출은 다른 모드와 똑같이 `widgets/batting-stage` 를 쓰되 **일반 점수판 대신
 * 홈런더비 HUD(0x45a54)** 를 겹친다 — 원본도 `0x4c4bc` 에서 그렇게 갈린다.
 *
 * 판정 모드는 `'홈런더비'` 다: `0xab214` 는 모드 7(sp44)이면 contact·B·C 를 보정 없는 능력치로 세는
 * 다른 갈래(0xab69a)로 가고, 18 자리에서 24 를 한 번 더 굴린다 (`entities/batting/model/swingResult` 머리말).
 */
export function HomeRunDerbyScreen({
  ability,
  batterForm,
  batterSkinIndex,
  batterEquipmentLevels,
  batterSkillIds,
  aceLevels,
  random,
  bestDistance,
  gamePoint,
  onFinish,
  onExit,
  settings,
  onSettingsChange,
}: HomeRunDerbyScreenProps) {
  const session = useHomeRunDerby({ bestDistance, onFinish, aceLevels })
  const tick = useUpdateCounter()
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)

  // 경기 중 메뉴의 "조작방법"(0x3c212)·"설정"(0x3c326)
  if (overlay === '조작방법') return <HelpScreen onBack={() => setOverlay(null)} />
  if (overlay === '설정' && settings !== undefined && onSettingsChange !== undefined) {
    return (
      <SettingsScreen
        settings={settings}
        hasSavedCareer={false}
        onChange={onSettingsChange}
        onResetCareer={() => {}}
        onBack={() => setOverlay(null)}
      />
    )
  }

  if (session.result !== null) {
    return (
      <DerbyResultWindow
        result={session.result}
        heldGamePoint={gamePoint}
        onRetry={session.restart}
        onExit={onExit}
      />
    )
  }

  const { run, pitcher } = session
  const ace = pitcher.ace

  return (
    <PixelScreen
      title="홈런더비"
      badge={`${derbyBallNumberOf(run)} / ${derbyBallCountOf(run)}구${run.isBonusGame ? ' · 보너스' : ''}`}
      rightKey={{
        label: isMenuOpen ? '닫기' : '메뉴',
        onPress: () => setMenuOpen((open) => !open),
      }}
    >
      {isMenuOpen && (
        <InGameMenu
          // 홈런더비 행은 자동진행 자리에 **다시하기**가 온다 (표 0xcfcfc 행 1)
          mode={DERBY_MODE}
          onContinue={() => setMenuOpen(false)}
          onQuit={onExit}
          onRestart={() => {
            setMenuOpen(false)
            session.restart()
          }}
          onOpenHelp={() => {
            setMenuOpen(false)
            setOverlay('조작방법')
          }}
          onOpenSettings={
            settings === undefined || onSettingsChange === undefined
              ? undefined
              : () => {
                  setMenuOpen(false)
                  setOverlay('설정')
                }
          }
        />
      )}
      <div className={styles.stageArea}>
        <BattingStage
          batterAbility={ability}
          batterForm={batterForm}
          batterSkinIndex={batterSkinIndex}
          batterEquipmentLevels={batterEquipmentLevels}
          batterSkillIds={batterSkillIds}
          pitcherAbility={pitcher.ability}
          aceLevels={aceLevels}
          swingMode="홈런더비"
          gameMode={DERBY_MODE}
          // 0x344ea 모드 7 갈래 — 단계 0 은 구질 1, 마투수가 나온 뒤로는 22(마구)만, 굴림 없음
          derbyPitchType={pitcher.pitchType}
          // 환경설정 전광판(저장 +0x3a) — OFF 면 흐르는 글자를 안 그린다 (0x77726)
          isScoreboardOn={settings?.isScoreboardOn}
          // 환경설정 진동(저장 +0x3b) — 맞은 공·사구 진동 (0x3a44)
          isVibrationOn={settings?.isVibrationOn}
          isEagleEyeEnabled={false}
          // 홈런더비는 일반 점수판을 안 그린다 (0x4c4bc 가 0x373d0 대신 0x45a54 로 간다)
          hud={null}
          acePitcher={
            ace === null
              ? null
              : { framesUrl: ace.framesUrl, frameCount: ace.frameCount, stillUrl: ace.stillUrl }
          }
          isPaused={session.isPaused}
          random={random}
          onPitchResolved={(detail) => session.onPitchResolved(detail)}
        />

        <DerbyHud
          run={run}
          bestDistance={bestDistance}
          aceName={ace?.name ?? null}
          isEventZoneShown={session.isEventZoneShown}
          tick={tick}
        />

        <div className={styles.overlay}>
          {session.banner === '' ? (
            <Hint>
              {run.isBonusGame ? '보너스 게임' : '10구 안에 멀리 쳐라'} · 누적 {run.totalDistance}M
            </Hint>
          ) : (
            <BigResult>{session.banner}</BigResult>
          )}
        </div>
      </div>
    </PixelScreen>
  )
}
