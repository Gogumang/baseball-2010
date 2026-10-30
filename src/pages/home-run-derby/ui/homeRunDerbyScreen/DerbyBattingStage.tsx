import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { sceneFieldPaletteOf } from '@/features/play-team-game/model/sceneStadium'
import type { HomeRunDerbySession } from '@/pages/home-run-derby/model/useHomeRunDerby'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { acePitcherFramesOf } from '@/widgets/batting-stage/model/stageRefs'
import type { ComponentProps } from 'react'
import { DERBY_MODE } from './derbyScreenProps'
import { derbyPitcherSkinIndexOf, type DerbyStageBatter } from './derbyStageBatter'

/** 타석 캔버스 — RawScreen 판 (0, 0) 에 맞춘다(`stageScreen.css`). 판(0x17) 동안은 밑의 필드 화면이 비치게 비운다 */
export function DerbyBattingStage({
  session,
  batter,
  aceLevels,
  settings,
  random,
  isOverlayShown,
  fieldPlayShotsAt,
}: {
  readonly session: HomeRunDerbySession
  readonly batter: DerbyStageBatter
  readonly aceLevels: Readonly<Record<number, number>> | undefined
  readonly settings: GameSettings | undefined
  readonly random: RandomPort
  /** 조작방법 · 설정이 떠 있다 */
  readonly isOverlayShown: boolean
  readonly fieldPlayShotsAt: ComponentProps<typeof BattingStage>['fieldPlayShotsAt']
}) {
  const { pitcher } = session
  const ace = pitcher.ace
  const isResultShown = session.result !== null
  return (
    <BattingStage
      // 하늘 줄 — 세션이 장면 시작 · 결과 진입 0x4f574 에 굴린 구장 +0x10
      skyRow={session.skyRow}
      // 구장 객체 둘(0x39fdc 모드 7 — 내 팀 r7) — 타석 +0x70 펜스 프레임 · +0xc 바닥 팔레트 줄
      {...(session.sceneStadium === null ? {} : { stadium: session.sceneStadium.stadium })}
      fieldPalette={sceneFieldPaletteOf(session.sceneStadium)}
      batterAbility={batter.ability}
      batterForm={batter.form}
      batterSkinIndex={batter.skinIndex}
      batterEquipmentLevels={batter.equipmentLevels}
      batterSkillIds={batter.skillIds}
      // 투수 스킬 31 의 0xb6394 — 3a53c~3a550 이 모드 타자 P 를 칸 k(+0xa & 0x1f)에 넣고(0xb87cc → 0xb8768 다시 매김) 팀+0x32 =
      // 0xb6394(P) = k 로 선다. 그 뒤 마스터 줄도 배열 첨자 = 타순 칸이라 늘 지금 타순 팀+0x32 와 같다
      batterRecordSlot={session.batter.order}
      pitcherAbility={pitcher.ability}
      // 단계 0 마스터 줄 2 의 장비 니블 → 장비 겹 (0x47cc8 48138~4816a). 마투수 단계는 없다
      pitcherEquipmentNibbles={pitcher.equipment}
      // 마운드 바탕 벌 = 피부 × 15 + 수비 팀 v(hud 상대 팀) — 마스터 줄 2 의 +0xb (482c0~482fc → 0x793b0 의 794c2)
      pitcherSkinIndex={derbyPitcherSkinIndexOf(pitcher)}
      aceLevels={aceLevels}
      swingMode="홈런더비"
      // 번트 '7'/'8'/'9' — 0x535a4 → 0x6a7 → 0x51e48 은 모드 7 도 막지 않는다(모드 갈림 없음). 내 선수가 쳐서 마선수가 아니다
      canBunt
      gameMode={DERBY_MODE}
      // 0x344ea 모드 7 갈래 — 단계 0 은 구질 1, 마투수가 나온 뒤로는 22(마구)만, 굴림 없음
      derbyPitchType={pitcher.pitchType}
      // 환경설정 전광판(저장 +0x3a) — OFF 면 흐르는 글자를 안 그린다 (0x77726)
      isScoreboardOn={settings?.isScoreboardOn}
      // 환경설정 진동(저장 +0x3b) — 맞은 공·사구 진동 (0x3a44)
      isVibrationOn={settings?.isVibrationOn}
      isEagleEyeEnabled={false}
      // 홈런더비는 일반 점수판을 안 그린다 (0x4c4bc 가 0x373d0 대신 0x45a54 로 간다).
      // 루상 주자(runnerAces)는 주자가 없어, 투수 체력 · 실투 "!"(pitcherStaminaPercent)는 투수 그리기 0x38d1c 가 모드 7 이면
      // 38ed6 에서 건너뛰어 넘기지 않는다
      hud={null}
      acePitcher={ace === null ? null : acePitcherFramesOf(ace)}
      // 조작방법 뷰어 동안은 일시정지 팝업이 떠 있어 경기 갱신이 멈춘다 (0x52cc6 0x754f9)
      // 조작방법 뷰어 동안은 일시정지 팝업이 떠 있어 경기 갱신이 멈춘다 (0x52cc6 0x754f9)
      isPaused={session.isPaused || isOverlayShown}
      // 좌우 이동은 0xd 진입(48f88)에서만 0 — 공 사이 0xf 에는 남는다
      shiftResetSerial={session.sceneDSerial}
      // 결과 창(0x45c18)은 창 뒤에 구름·구장(+0x17e2 만큼 가라앉는다)만 그린다
      isResultBackdrop={isResultShown}
      // HOMERUN 글자는 판의 홈런 틱에 더비 칸(0x5279a — 단계만 0)으로 켠다. 타석 임시 결과로는 안 켠다
      homeRunText={session.homeRunText}
      // 키 건너뛰기 0x519cc · 판 끝 0x35108 이 파티클을 치운다 — 홈런 효과 굴림은 타석 화면이 글자 창대로 돈다
      effectsClearedAt={session.effectsClearedAt}
      // 판(0x17) 동안은 밑의 필드 화면이 비치게 캔버스를 비운다 — 0x46c88 은 타석 그림 0x4c4bc 를 안 부른다
      isFieldPlay={session.distanceBoard !== null && !isResultShown}
      fieldPlayShotsAt={fieldPlayShotsAt}
      random={random}
      onPitchResolved={(detail, _pitch, _isUncatchable, _buntKind, sceneTick) => session.onPitchResolved(detail, sceneTick)}
      // 맞은 판정 틀 — 판 공 · [경기+0xf2c] 공의 폴 굴림 (A-37)
      onContact={(detail) => session.preRollContact(detail)}
    />
  )
}
