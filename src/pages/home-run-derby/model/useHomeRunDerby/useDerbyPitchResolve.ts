import { useCallback, useRef, type RefObject } from 'react'
import type { LaunchedShot } from '@/widgets/batting-stage/lib/hitPause'
import { derbyBattedBallOf, type DerbyBattedBall } from '@/entities/home-run-derby/model/derbyBattedBall'
import type { DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import { eventZoneRewardXOf } from '@/entities/home-run-derby/model/eventZone'
import { derbyNoContactWaitFramesOf, derbyPitchCallOf, type DerbyPitchCall } from '@/pages/home-run-derby/lib/derbyPitchCall'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { BATTER_PITCH_RESULT_ENTRY_TICKS, playSoundIdsAfterSceneTicks } from '@/features/play-game/model/sceneTickSounds'
import { playSoundIds, type SoundPort } from '@/shared/api/audio/soundPort'
import { gameSceneTickNow, gameSceneTickStartTime } from '@/shared/lib/commonWindow/commonWindow'
import { derbyFieldPlayOf, type DerbyFieldPlay } from './derbyPlayView'
import type { HomeRunDerbyOptions } from './homeRunDerbyTypes'
import type { DerbyPlay } from './useDerbyPlayShow'

type StartPlay = (
  batted: DerbyBattedBall | null,
  field: DerbyFieldPlay | null,
  startedAt: number,
  runBefore: DerbyRun,
  rewardX: number | null,
) => void
type SkipPlay = (keySceneTick: number) => { readonly before: DerbyPlay; readonly after: DerbyPlay; readonly endTick: number } | null
type ApplyPlayResult = (before: DerbyRun, batted: DerbyBattedBall | null, zoneHit: boolean) => void

/** 판이 달라졌나 — 두 번 더할 갈래가 키 뒤였으면 비거리가, 이벤트 존이 키 뒤 그림에서 놓일 차례였으면 존이 빠진다 */
function playChangedBySkip(before: DerbyPlay, after: DerbyPlay) {
  return (
    after.batted.distance !== before.batted.distance ||
    after.batted.displayDistance !== before.batted.displayDistance ||
    after.isEventZoneHit !== before.isEventZoneHit
  )
}

/** 존을 놓은 공의 "200G" 애니 자리 — 0x41098 4111c 가 +0xfcc(판정 수평각)로 가른다 */
function eventZoneRewardXAt(detail: PitchOutcomeDetail) {
  return detail.pattern != null ? eventZoneRewardXOf(detail.pattern[0]) : null
}

/** 공 끝 시계의 장면 틱 — 맞지 않은 공은 0x12 진입 틀(넘긴 틀 + 1)부터 대기(`derbyNoContactWaitFramesOf`), 맞은 공은 판 끝(`endTicks`) */
function pitchEndTickOf(batted: DerbyBattedBall | null, passedTick: number, judgment: DerbyPitchCall['judgment']) {
  if (batted === null) return passedTick + BATTER_PITCH_RESULT_ENTRY_TICKS + derbyNoContactWaitFramesOf(judgment)
  return passedTick + batted.endTicks
}

/**
 * **공 하나의 결과를 받는다** — 심판 콜 · 타순 예약 · 맞은 공의 홈런더비 판(종류 8) · 판 끝 시계, 그리고 판 동안의 키 건너뛰기.
 *
 * 맞은 공(파울 · 번트 포함)은 판을 돈다 (2026-10-07 직접 뜸 — `derbyBattedBall` 머리말). 원본은 모드 7 도 맞은 공이면 각과 무관하게
 * 판(상태 0x17)을 돌고 그 끝 0x52a52 → 0xae3e8 모드 7 갈래로 간다(H-2). 판 시작은 폴 충돌 rand(−25, 25)(쏘기 · 세계 51172~511a4 안 —
 * 필살수비 굴림은 0x50fba 가 모드 7 이면 없다)와 [경기+0xf2c] 공의 같은 굴림만 돈다. 공 틱 0xb401c 가 안 돌아 포구 · 쥐기(b2766) ·
 * 펌블 · 판 끝 결과 코드 · 메시지 0xbba 가 없다 — **파울 뜬공 아웃도 없다**. 필살타법은 더비 타석에 번호가 없어(`HomeRunDerbyScreen` 이
 * `specialSwingNumber` 를 안 넘김) 0x517e6 굴림 차례 문제가 없다.
 */
export function useDerbyPitchResolve(
  optionsRef: RefObject<HomeRunDerbyOptions>,
  audioRef: RefObject<SoundPort>,
  runRef: RefObject<DerbyRun>,
  ballsRef: RefObject<number>,
  reserveNextBatter: () => void,
  endShownComboIfOn: () => void,
  startPlay: StartPlay,
  skipPlay: SkipPlay,
  applyPlayResult: ApplyPlayResult,
  awaitPitchEnd: (dueTick: number, isHitByPitch: boolean) => void,
  armPlayEnd: (dueTick: number) => void,
) {
  /**
   * **맞은 판정 틀에 쏜 공** (A-37) — 원본은 맞은 틀의 0x51408 이 판 공(51188) · [경기+0xf2c] 공(5174c)을 쏘며 폴 굴림을 돌린 뒤
   * 0x13 을 세운다(모드 7 이라 필살수비 · 표시 패턴은 없다 — 0x50fba). 그래서 0x13 그림의 파티클 굴림보다 앞이다. 타석 화면이 그 틀에
   * `preRollContact` 를 부르면 여기서 깔아 두고, 0x13 뒤 `onPitchResolved` 가 같은 공이면 그 판을 쓴다
   */
  const contactShotRef = useRef<{ readonly detail: PitchOutcomeDetail; readonly batted: DerbyBattedBall } | null>(null)
  const preRollContact = useCallback(
    (detail: PitchOutcomeDetail): LaunchedShot | null => {
      contactShotRef.current = null
      if (detail.pattern === undefined || runRef.current.isFinished) return null
      const batted = derbyBattedBallOf(detail.pattern, optionsRef.current.random, detail.batterHand)
      contactShotRef.current = { detail, batted }
      return { launchedPattern: detail.pattern, trajectory: batted.trajectory }
    },
    [optionsRef, runRef],
  )

  /** 이 공의 판 — 맞은 판정 틀에 이미 쏜 공이면(`preRollContact`) 그 판(굴림은 그 틀에 돌았다), 아니면 지금 깐다. 맞지 않은 공은 null */
  const rollBattedBall = useCallback(
    (detail: PitchOutcomeDetail) => {
      const shot = contactShotRef.current
      contactShotRef.current = null
      if (detail.pattern === undefined) return null
      if (shot !== null && shot.detail === detail) return shot.batted
      // [경기+0xf2c] 공(수평각 d)의 점 깔기 — 폴에 맞으면 굴림이 하나 더 (`derbyBattedBallOf` 머리말)
      return derbyBattedBallOf(detail.pattern, optionsRef.current.random, detail.batterHand)
    },
    [optionsRef],
  )

  const onPitchResolved = useCallback(
    (detail: PitchOutcomeDetail, sceneTick?: number) => {
      const passedTick = sceneTick ?? gameSceneTickNow()
      endShownComboIfOn()
      const current = runRef.current
      if (current.isFinished) return
      // 상대 투수 투구 소모(0x3dec6 → 0xa5e14)는 모드를 가리지 않아 홈런더비에서도 돌지만 **결과에 닿지 않는다** —
      // 체력%를 읽는 0xaebb0 이 모드 7 이면 늘 100 을 돌려준다 (0xaebbc `cmp r3,#7` → `movs r0,#0x64`).
      // 그래서 CPU 제구 등급(0x4dbac)·피로(0xb58e6)·교체(0xac428) 모두 지치지 않은 투수로 본다. `detail.pitchTypeNumber` 로 깎을 칸을 두지 않는다.
      // **심판 콜** — 판정 스위치 0x3dfac · 화면 0x51a56 은 모드를 안 가린다: 스트라이크 · 헛스윙 18, 볼 16, 0xd 뒤 넷째 볼부터 24,
      // 사구 23 (`derbyPitchCallOf` 머리말). 볼 수 st[5] 는 0xd 진입만 지운다
      const call = derbyPitchCallOf(detail.resolution, ballsRef.current)
      ballsRef.current = call.balls
      // 볼넷 v3 → 사구 v4 — 다음 타순 예약. 확정은 다음 0xd 진입
      if (call.judgment === 3 || call.judgment === 4) reserveNextBatter()
      // **타구 순간 소리** (0x515de~0x5164a — 강 5 · 보통 6 · 약 59 · 큰 타구 7 · 헛스윙 8)는 판정 틀 — 타석 화면이 이미 냈다
      // (`contactSoundId` 는 비어 온다). 심판 콜은 다음 틀 0x12 진입 0x3dfac → 0xbba
      playSoundIds(audioRef.current, [detail.contactSoundId])
      playSoundIdsAfterSceneTicks(audioRef.current, [call.soundId], passedTick + BATTER_PITCH_RESULT_ENTRY_TICKS - gameSceneTickNow())
      // 홈런 = 땅에 닿기 전에 담장선 · 폴을 넘은 페어 공(0x52720)
      const batted = rollBattedBall(detail)
      // 공 틱 0 = 이 자리(타석 화면이 상태 0x13 을 지나 판을 넘긴 틀)의 장면 틱 — 판을 넘긴 틀의 틱은 타석 화면이 그 틀의 틱으로
      // 넘긴다(`sceneTick`). 이 자리에서 `gameSceneTickNow()` 를 다시 읽으면 rAF 틀 머리와 이 자리 사이에 틱 머리가 지났을 때 한 틱 늦게 선다.
      // HOMERUN 글자(0x5279a~0x527ac)는 판의 홈런 틱에 켜고(`derbyHomeRunTextOf`), 비거리 판(0x36cd4)은 판 내내 띄운다.
      // 0x90191(…, 2, 1) 홈런 효과 객체(알갱이 7 · 난수)는 글자 창의 첫 그림(홈런 틱)에 타석 화면이 깔고, 유지 단계 그림마다 굴린다
      // (widgets/batting-stage `homeRunEffects`). 파티클 · 효과 틱은 타석 화면이 장면 틱마다 돌린다(rAF 가 건너뛴 틱은 4 틱까지 따라잡는다).
      // 원본은 단말이 틀을 부를 때마다 한 번 갱신하고 밀린 시간을 따라잡는 셈이 없다 — 탭이 쉬는 동안 틀이 안 도는 것은 단말 몫이다
      // (일시정지 0x2da0 은 소리 0x6e690 · 장면 vt+0x18 · 0x74458 뿐이고, 경기 장면 0x463ac 는 판 0x17 이면 메뉴를 안 연다 — TODO C-18)
      const startedAt = gameSceneTickStartTime(passedTick)
      // 판의 필드 화면(A-01) — 카메라 · 공 틱 · 이벤트 존을 미리 셈한다(`lib/derbyField`). 존은 그 그림의 공 그리기 0x36dfc 가 놓는다:
      // 공을 그리는 그림 · 높이 투영 ≤ 54 · 땅점 화면 y < 화면 높이/3 · 결과 코드 24~26 · 패턴 플래그 & 2 (U-93)
      const field = batted === null ? null : derbyFieldPlayOf(batted, detail)
      const zoneHit = field?.timeline.zone != null
      startPlay(batted, field, startedAt, current, zoneHit ? eventZoneRewardXAt(detail) : null)
      applyPlayResult(current, batted, zoneHit)
      // 맞지 않은 공은 상태 0x12 — 넘긴 틀이 0x12 를 예약했고(공 끝 0x4e24e) 다음 틀이 0x12 틱 0 이다. 갱신 0x4e6d4 는 상태 틱이
      // 15(볼넷 · 사구면 31)에 닿은 틀(4e72c)에서 0x4e740(사구면 벤치 클리어링 굴림) · 판정 A 0xae24c 를 돈다 — 그 틀이 시계 끝이다.
      // 맞은 공은 판 틱 0 = 넘긴 틀에서 `endTicks` 뒤. 둘 다 **넘긴 틀의 틱**에서 센다
      awaitPitchEnd(pitchEndTickOf(batted, passedTick, call.judgment), call.judgment === 4)
    },
    [applyPlayResult, audioRef, awaitPitchEnd, ballsRef, endShownComboIfOn, reserveNextBatter, rollBattedBall, runRef, startPlay],
  )

  /**
   * 판(0x17)이 도는 동안 받은 키 — 0x17 키 처리 0x53420 이 키마다 보내는 메시지 0x587 → 0x519cc (`skipDerbyBattedBall` 머리말).
   * `keySceneTick` 은 키를 처리하는 틀의 장면 틱(받은 틀 + 1). 원본도 0xae3e8 은 판 끝에서 돌아 판이 달라졌으면 판 앞 진행에서 다시 셈한다
   */
  const skipHomeRun = useCallback(
    (keySceneTick: number = gameSceneTickNow() + 1) => {
      const skipped = skipPlay(keySceneTick)
      if (skipped === null) return
      const { before, after } = skipped
      if (playChangedBySkip(before, after)) applyPlayResult(before.runBefore, after.batted, after.isEventZoneHit)
      armPlayEnd(skipped.endTick)
    },
    [applyPlayResult, armPlayEnd, skipPlay],
  )

  return { preRollContact, onPitchResolved, skipHomeRun }
}
