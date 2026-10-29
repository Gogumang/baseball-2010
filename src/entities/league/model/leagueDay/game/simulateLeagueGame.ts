import { EMPTY_DECISION_STATE } from '@/entities/game/model/winLossSave'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createLeagueGameSides } from '@/entities/league/model/leagueDay/game/gameSides'
import { leagueGameScoreOf } from '@/entities/league/model/leagueDay/game/gameScore'
import { createLeagueGameTally } from '@/entities/league/model/leagueDay/game/gameTally'
import { playLeagueHalfInning } from '@/entities/league/model/leagueDay/game/halfInning'
import type { LeagueGameRun } from '@/entities/league/model/leagueDay/game/halfInning'
import type { LeagueMatchup } from '@/entities/league/model/leagueDay/schedule/matchups'
import type { LeagueGameExtras } from '@/entities/league/model/leagueDay/types/leagueGameExtras'
import type { LeagueGameScore } from '@/entities/league/model/leagueDay/types/leagueGameScore'

/**
 * 한 경기를 9이닝(동점이면 연장)까지 돌린다.
 *
 * `matchup` 은 **명단**으로 본 두 팀이다 — `away` 의 선수가 초(칸 0), `home` 의 선수가 말(칸 1)에 공격한다.
 * CPU 끼리 경기 준비는 칸의 팀 번호와 명단이 엇갈리므로 부르는 쪽이 `cpuGameSidesOf` 로 바꿔 넘긴다.
 *
 * `startingPitcherSlot` 이 선발 칸이다(수 하나면 양 팀 같은 칸) — 정규 리그와 포스트시즌(0xc2760)은 같은 준비
 * `0xc239c` 의 4인 로테이션(`0xb8c80` → `0xb5ca8`, 포스트시즌은 이어 온 칸 + 시리즈 g — `postseasonStarterSlotOf`),
 * 국가대항전은 준비 `0xc2c4c` 의 `L+0x32 % 4` 0↔k 맞바꿈(`0xb6c34` → `0xb8c94`)이 같은 레코드에 두 번 걸려 제자리라
 * 그 레코드의 0번이다(`nationalCupStartingPitcherIndex`). CPU 끼리 경기에 `rand(0,4)` 선발은 없다.
 * 안 주면 `rand(0,4)` 두 번으로 뽑는다 — 지금은 이 길을 쓰는 원본 CPU 경기가 없다(테스트·예비용).
 *
 * **마선수** — `0xc239c` 는 두 팀 객체를 만든 직후 굴림 다섯(`rollCpuGamePrep`)으로 양 팀에 마타자·마투수를 하나씩
 * 넣는다(정규·포스트시즌 모두). `extras.aces` 로 받아 마타자는 첫 벤치(9번, 옛 9번은 맨 끝), 마투수는 투수 명단 8번
 * (벤치 맨 끝)에 앉힌다 — 선발이 아니다. 마타자는 **CPU 대타**(0xac228)로 들어오고, 들어온 뒤로는 다시 대타로 안 바뀐다.
 * 마투수는 58066a1 뒤 CPU 투수 교체의 벤치 고르기 `0xabfcc` 가 마선수를 고르지 않아(ac084) CPU 끼리 경기 마운드에는
 * 거의 안 나온다 — 벤치에 있는 것만으로 0xb8a8d 가 참이 되어 마무리 굴림·벤치 수에 비친다. 능력치 네 칸은 레벨 배율
 * `0xd88aa` 을 먹는다(`extras.aceLevels`). 국가대항전 준비 `0xc2c4c` 에는 이 굴림이 없다(`state+0x30 = 0xff`).
 * 마투수 스태미나는 저장의 마투수 레코드(`0x1f824`) +0x2c 를 통째로 복사한 값(늘 10000, `ACE_PITCHER_RECORD_STAMINA`)
 * 에서 시작하고, 끝 값은 팀 레코드 8번 칸에 남는다(`acePitcherStaminas`).
 * 원본은 마선수를 팀 **저장 레코드**에 넣는다(0xb53f0 0x40 · 0xb521c 0x60 갈래가 0xb8680 의 레코드를 늘리거나, 8 · 9번이 이미
 * 마선수면 덮는다). 덮기와 새로 늘리기는 같은 배열 꼴(투수 [0..7, 마투수, 옛 8] · 타자 [0..8, 마타자, 10, 11, 옛 9])이고 경기마다
 * 두 팀에 늘 넣으므로, 이 경기의 명단은 레코드에 남은 지난 마선수와 상관없이 같다 — 여기서는 붙박이 표 위에 새로 세운다.
 * 남는 쪽은 부르는 쪽이 저장에 든다: 시즌 `SeasonSave.recordAces`(U-105) · 나리 `withCpuGameRecordAces`(A-05, `nariTeams`).
 */
export function simulateLeagueGame(
  matchup: LeagueMatchup,
  random: RandomPort,
  /**
   * 선발 칸 — 수 하나면 양 팀 같은 칸, `{ away, home }` 이면 명단마다 따로(포스트시즌은 앞 시리즈에서 이어 온 칸이
   * 팀마다 달라 `postseasonStarterSlotOf` 가 팀별로 준다).
   */
  startingPitcherSlot?: number | { readonly away: number; readonly home: number },
  /**
   * 두 팀 투수 칸(0~7)별 **시작 스태미나** `+0x2c` — 정규시즌은 첫날만 10000(`0xb6190`)이고 그 뒤로는 경기에서
   * 깎인 값에 하루 끝 `0xb617c` +20% 만 더한 값이다 (a583fe0). 안 넘기면 모두 10000.
   */
  startingStaminas?: { readonly away?: readonly number[]; readonly home?: readonly number[] },
  /** 경기 준비가 넣는 마선수 (`0xc239c` → `rollCpuGamePrep`·`cpuGameAcesOf`). 안 넘기면 없다 */
  extras?: LeagueGameExtras,
): LeagueGameScore {
  const game: LeagueGameRun = {
    ...createLeagueGameSides(matchup, random, startingPitcherSlot, startingStaminas, extras),
    random,
    abilityContext: extras?.abilityContext,
    tally: createLeagueGameTally(),
    pinchHitUsed: false,
    decision: EMPTY_DECISION_STATE,
    awayRecordTouched: false,
  }
  // **연장 상한은 없다** (E 3d 확정): CPU 끼리 경기 루프 0xc2760 · 0xc2a48 · 0xc2dac 는 `while (0xc2198(sim, 1))` 뿐이고
  // 0xc2198 은 경기 끝 판정 0xb68fc 가 참이면 멈춘다 — 0xb68fc 는 동점이면 끝을 안 내고, 이닝 넘김 0xb6b6c 에 막는 값이
  // 없으며, 점수판 0xb6988 은 `이닝 mod 9` 로 칸을 돌려 쓴다. 그래서 아래 루프도 점수가 갈릴 때까지 돈다
  // (예전 웹의 30회 안전망 `MAXIMUM_INNINGS` 는 원본에 없어 뺐다). 0xc262c 의 이닝 14 는 상한이 아니라 "15회에 스윙 강제"
  // 였다(`quickAtBat.ts`).
  // 경기 끝은 **타석마다** 본다: 고리 `do 0xc262c(한 타석) while 0xc2198(sim, 1)` 의 0xc2198 머리 c21d6 이 0xb68fc 를 부르고
  // (반 이닝 넘김 0xb6b6c 보다 먼저), 참이면 그 자리에서 고리가 멈춘다 — 말 공격 중의 끝내기(9회 이후 홈이 앞서는 타석)와
  // 콜드(7회 이후 — 말 공격 중 홈 10점 차 · 초 3아웃 뒤 홈 10점 차 · 말 3아웃 뒤 원정 10점 차)가 3아웃을 기다리지 않는다.
  // 반 이닝 엔진에 `endsGame`(= `isGameOverAt`)을 넘겨 타석마다 끊는다.
  for (let inning = 1; ; inning += 1) {
    // 0xb68fc 가 끝을 냈으면(초 3아웃 뒤 — 9회 이후 홈이 앞섬 · 7회 이후 홈 10점 차) 말은 치르지 않는다
    if (playLeagueHalfInning(game, inning, '초').gameEnded === true) break
    if (playLeagueHalfInning(game, inning, '말').gameEnded === true) break
  }
  return leagueGameScoreOf(game)
}
