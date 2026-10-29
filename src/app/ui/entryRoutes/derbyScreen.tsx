import type { ComponentProps, ReactNode } from 'react'
import { modeBatterOf, modeBatterOfHallOfFame } from '@/app/model/modeBatter'
import { nariBatterOf } from '@/app/model/useCollection'
import { hallOfFameBatterAt } from '@/entities/collection/model/collection'
import { derbyHallOfFameBatterIndexOf } from '@/pages/home-run-derby/lib/derbyModeBatter'
import { DERBY_NO_BATTER_SAVE_TEAM_ID } from '@/entities/home-run-derby/model/derbyRules'
import { lapPlayClock } from '@/entities/collection/model/playClock'
import { HallOfFameScreen, HomeRunDerbyScreen } from '@/app/ui/entryRoutes/lazyScreens'
import { derbyMatchupBatterOf, derbyModeBatterSlotOf } from '@/app/ui/entryRoutes/derbyBatter'
import { HOME_RUN_DERBY_MODE } from '@/app/ui/entryRoutes/entryModes'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { EntryRouteView } from '@/app/ui/entryRoutes/useEntryRouteState'

type Career = PlayerCareer | null
type DerbyFamer = ReturnType<typeof hallOfFameBatterAt>
type DerbyResult = Parameters<NonNullable<ComponentProps<typeof HomeRunDerbyScreen>['onFinish']>>[0]

/** 홈런더비 타자의 겉모습 — 그 기록의 생김새(+0xb: 폼 = 2×타입 + 손 · 피부)와 장비 니블. 옛 명전 기록에 없으면 기본 그림 */
function derbyLookOf(famer: DerbyFamer, career: Career) {
  if (famer !== null) {
    return {
      form: famer.look === undefined ? undefined : famer.look.typeIndex * 2 + famer.look.handIndex,
      skinIndex: famer.look?.skinIndex,
      equipmentLevels: famer.equipmentLevels,
    }
  }
  if (career === null) return null
  return { form: career.battingTypeIndex * 2 + career.battingSide, skinIndex: career.skinIndex, equipmentLevels: career.equipmentLevels }
}

/** 같은 저장(또는 명전 기록)을 올리니 겉모습도 그 선수 것이다 — 폼(몸통·손)·피부·장비, 없는 칸은 넘기지 않는다 */
function derbyLookPropsOf(look: ReturnType<typeof derbyLookOf>) {
  return {
    ...(look?.form === undefined ? {} : { batterForm: look.form }),
    ...(look?.skinIndex === undefined ? {} : { batterSkinIndex: look.skinIndex }),
    ...(look?.equipmentLevels === undefined ? {} : { batterEquipmentLevels: look.equipmentLevels }),
  }
}

/** 판 끝 0x52a00 — 누적 비거리 > 1999 면 히든 39 (0x62368) */
function openHiddenPropsOf(openHidden: EntryRouteView['openHidden']) {
  return openHidden === undefined ? {} : { onOpenHidden: (id: number, then: () => void) => openHidden(id, then) }
}

/** 더비 결과 — 최고 비거리 · 보상 G · 기록연감 (0x4f574 → 0x4f6cc · 0x4f70a · 0x4f6be) */
function finishDerby({ session, recordStat, derbyStore, derbyBest, setDerbyBest }: EntryRouteView, result: DerbyResult) {
  if (result.bestDistance > derbyBest) {
    setDerbyBest(result.bestDistance)
    derbyStore.save({ bestDistance: result.bestDistance })
  }
  // 결과 보상도 전역 +0x64 에 쌓는다 (0x4f6cc, 상한 99999) — 지갑으로 들어간다
  session.actions.gainGamePoint(result.gainedGamePoint)
  // 이어 0x4f70a `0x22c7d(앱, scene+0x17f4 = 번 G, scene+0x1104 = 7)` — 기록연감 모드별 획득 G (칸 6)
  recordStat?.({ kind: 'G획득', mode: HOME_RUN_DERBY_MODE, amount: result.gainedGamePoint })
  // 결과 0x4f574 의 0x4f6be `0x4e8b0` — 지난 시간을 칸 6(홈런더비) 플레이 시간에 (0x22efc)
  recordStat?.({ kind: '플레이시간', mode: HOME_RUN_DERBY_MODE, elapsed: lapPlayClock() })
}

// 하위 16 선수 고르기 — 결과 0(되돌아가기)은 하위 5 게임시작 목록, 2·4 → 모드 7 (0x29ac8).
// 같은 장면 0x103 안이라 생성자를 안 지난다 — 커서 [0x1552d24] 는 [홈런더비] 그대로, 띠 [0xe4] 는 이미 다 자랐다
// 육성·명예 타자가 다 없으면 코드 5·6 팝업만 떠서 들어갈 수 없다 (신인 대체 없음, Q2 3-1)
function derbyPickScreenOf(view: EntryRouteView, career: Career): ReactNode {
  const { setScreen, collection, wallet, onLastPlayedMode, setDerbyPick } = view
  const cancelPick = () => {
    setDerbyPick(null)
    setScreen({ kind: '메인메뉴', openTier: 5, isBandGrown: true })
  }
  return (
    <HallOfFameScreen
      // 하위 16 그리기 0x2df20: 배경 0x58371 · 목록 k 7 · 머리띠 0x54d95(skin, 14 "홈런더비", 5) — G포인트도 그린다
      frame={{ title: '홈런더비', gamePoint: wallet.balance }}
      collection={collection}
      mode={{
        kind: '선수고르기',
        purpose: '홈런더비',
        nari: { 투수: null, 타자: nariBatterOf(career) },
        // 하위 16 의 답 2·4 → this+0x13c = 7 → 상태 0x27 → 0x327b8(this, 7) 이 +0x3c = 7
        onPick: (pick) => {
          onLastPlayedMode?.(HOME_RUN_DERBY_MODE)
          setDerbyPick(pick)
        },
        onCancel: cancelPick,
      }}
      onBack={cancelPick}
    />
  )
}

function derbyGameScreenOf(view: EntryRouteView, career: Career, famer: DerbyFamer): ReactNode {
  const { setScreen, gameSettings, random, wallet, aceSelect, openHidden, setDerbyPick, derbyBest } = view
  const leave = () => {
    setDerbyPick(null)
    setScreen({ kind: '메인메뉴' })
  }
  const derbyBatter = famer === null ? modeBatterOf(career) : modeBatterOfHallOfFame(famer)
  return (
    <HomeRunDerbyScreen
      // 원본은 모드 7 로 들어갈 때 0x213c0(앱,4,0) 으로 나만의리그 타자편 저장을 올린다.
      // 능력치는 0xb6414 까지 — 0xb570c 의 질병·부상·사기 감소는 모드 3·4 갈래라 안 먹는다 (`modeBatterOf`)
      ability={derbyBatter.ability}
      batterSkillIds={derbyBatter.skillIds}
      // 같은 저장(또는 명전 기록)을 올리니 겉모습도 그 선수 것이다 — 폼(몸통·손)·피부·장비
      {...derbyLookPropsOf(derbyLookOf(famer, career))}
      // 단계 1~4 난입 마투수도 전역 마선수 레벨을 본다 — 0xb6414 는 모드 7 도 가리지 않는다
      aceLevels={aceSelect?.levels}
      random={random}
      bestDistance={derbyBest}
      // 보유 G 는 전역 기록 `mgr[+0x64]` 다 (0x461f2) — 선수 칸이 아니라 지갑을 본다
      gamePoint={wallet.balance}
      // 판 끝 0x52a00 — 누적 비거리 > 1999 면 히든 39 (0x62368)
      {...openHiddenPropsOf(openHidden)}
      onFinish={(result) => finishDerby(view, result)}
      settings={gameSettings.settings}
      onSettingsChange={gameSettings.setSettings}
      // 상태 0xe 소개 판의 타자 판 — 모드 타자 기록(0x1fc20)에서 (`derbyMatchupBatterOf`)
      matchupBatter={derbyMatchupBatterOf(famer, career)}
      // 공격 팀 타순의 첫 칸 = 모드 타자 칸 k (3a550) — 볼넷 · 사구 뒤로는 내 팀 r7 마스터 명부의 다음 칸이 친다
      modeBatterSlot={derbyModeBatterSlotOf(famer, career)}
      // 상대 팀 굴림 3a454 가 피하는 내 팀 r7 = 나리 타자편 저장의 팀 (명예 타자를 골라도 같은 저장을 본다).
      // 저장이 없으면 0x213c0 이 0 으로 세운 버퍼의 바이트라 0 (`DERBY_NO_BATTER_SAVE_TEAM_ID`)
      myTeamId={career === null ? DERBY_NO_BATTER_SAVE_TEAM_ID : career.teamId}
      onExit={leave}
    />
  )
}

export function derbyScreenOf(view: EntryRouteView): ReactNode {
  const { session, collection, aceMatchHold, derbyPick } = view
  const career = session.career ?? session.savedCareer
  if (derbyPick === null) return derbyPickScreenOf(view, career)
  // 선수 게터 0x1fc20: 모드 7 · +0x11f == 0 · +0xa6 ≥ 0 → 명전 기록 0x1f640, 그 밖은 나리 타자편 저장(0x213c0(앱,4,0)) —
  // 타자편 대결 대기(g[0x11f])가 서 있으면 명예 타자를 골랐어도 나리 타자 (`derbyHallOfFameBatterIndexOf`)
  const famerIndex = derbyHallOfFameBatterIndexOf(derbyPick, aceMatchHold?.read().batter ?? false)
  const famer = famerIndex === null ? null : hallOfFameBatterAt(collection, famerIndex)
  if (famer === null && career === null) return null
  return derbyGameScreenOf(view, career, famer)
}
