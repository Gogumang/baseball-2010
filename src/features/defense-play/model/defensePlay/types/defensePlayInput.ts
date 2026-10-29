import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import type { BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import type { DefensePlayControls } from '@/features/defense-play/model/defensePlay/types/defenseKeyPress'
import type { HolderPlate } from '@/entities/fielding/model/defenseView/holderMark'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { RandomPort } from '@/shared/api/random/randomPort'

export interface DefensePlayInput {
  /**
   * 타석을 끝낸 **임시 결과** — ⚠️ 진행기는 이 칸을 **보지 않는다**. 결과는 판 끝 정산이 낸다(`DefensePlayResult.outcome`).
   * 받는 쪽(세션 · 화면)이 판이 끝나기 전에 그림·소리를 고르는 데만 남겨 둔 칸이다(`battedContact.provisionalOutcomeOf`).
   */
  readonly outcome: AtBatOutcome
  /**
   * ⚠️ **결과를 넘겨받은 호출**(쏜 패턴 없이 결과만 준 시험·옛 호출 — 원본에 없는 길)인가. 서 있으면 판은 결과에 맞춰 고른
   * 패턴(`fixturePatternFor`)으로 돌고, 기록은 넘겨받은 `outcome` 그대로다(`recordedOutcomeOf`). 진행기는 보지 않는다.
   * 실제 타석(쏜 패턴이 있는 판)은 늘 거짓이다.
   */
  readonly outcomeIsGiven?: boolean
  /**
   * 친 타자의 손 `0xb63c0`(1 = 좌타) — 타자주자가 서는 타석 자리(`batterBoxPosition`, vt94 0xa0884)를 고른다.
   * 안 주면 쏜 공(`contactOfOutcome(outcome).batterHand` — 쏜 공은 손이 필수다)의 손을 쓴다. 쏜 공이 없는 결과 넘김 길
   * (시험 · `fixturePatternFor` · `homeRunPlaybackOf` 처럼 결과만 들고 오는 웹 다리 — 타자가 없다)만 ⚠️ 홈에서 뛴다(웹 근사).
   * 이 길은 앱에서 안 지난다(r326 계측: soak 짧은 판 원본 · json, `yarn test:browser`, e2e 경기 장면 — 0번)
   */
  readonly batterHand?: number
  /** 원본 패턴에서 만든 타구 궤적 */
  readonly trajectory: BattedBallTrajectory
  /** 투구 때의 루 상황 */
  readonly bases: BaseState
  /** 투구 때의 아웃 수 */
  readonly outs: number
  /** 수비 9명의 수비 능력치 (칸 순서). 기본 500 */
  readonly defenseAbilities?: readonly (number | null)[]
  /**
   * **수비 팀 보너스** (판 시작 0xb0fb4 b10d0 — `defenseTeamBonusOf`): 모드 1·2·8·9 에서 수비 팀 '집중' 등급.
   * 아홉 칸(칸 0 포함) 송구 속도에 더한다. 안 주면 0(모드 3~7 과 같다)
   */
  readonly defenseTeamBonus?: number
  /**
   * **주자 속도의 팀 등급** (주자 만들기 0xa93ac a9488 — `runnerTeamGradeOf`): 모드 1·2·8 에서 공격 팀 '근성' 등급.
   * 모든 주자(타자주자 포함) 속도에 더한다. 안 주면 0(그 밖의 모드와 같다)
   */
  readonly runnerTeamGrade?: number
  /** 주자들의 주루 능력치. 기본 500 */
  readonly runAbility?: number
  /**
   * **루별 주자 주루** (0 = 타자주자, 1~3 = 그 루에서 출발한 주자). 없는 루는 `runAbility` 다.
   * 원본은 주자마다 제 레코드로 속도를 잡는다 — 타자주자 만들기 0xa93ac 의 a9462 `0xb570c(팀, 3, 타자, 90)` 이
   * 주자+0xa4 에 적고, 루에 선 주자는 제 타석에서 만든 그 칸을 그대로 들고 간다(I-controls 3a).
   */
  readonly runAbilities?: Partial<Record<0 | 1 | 2 | 3, number>>
  /**
   * 이번 투구에 출발한 도루 주자들의 루 — state[0x14 + 루] (`0xa9bd4`). 판이 열릴 때 `0x3d7b8` 이 이 주자들은
   * 다음 루를 목표로 `0xcffa8`[루] + rand(0,9)(2 이하 → 3) 틱, 나머지는 `0xcffb0`[루] 틱 몰아 돌린다.
   * 안 주면 아무도 출발 안 했다.
   */
  readonly stealingFrom?: readonly number[]
  /**
   * 장면 +0xfdc — 이번 투구의 번트 종류(0 = 없음). 서 있으면 도루 안 한 주자 리드가 +3 틱(`0x3d7b8`).
   * 부르는 쪽이 싣는다 — 타자편 `gameFlow.defensePlayInputOf`(타석 화면 넷째 인자) · 투수편 `pitcherGameFlow`(`thrown.buntKind`). 안 주면 0.
   */
  readonly buntKind?: number
  /**
   * **첫 야수가 쥐지 못하는 타구** — 필살타법이 성공한 타구 (0x51800, S13 6절 확정).
   *
   * 원본은 확률 굴림에 성공하면 공 객체(`[경기+0x204]`)의 속성 목록 `+0x5c` 에
   * `0xaf180(목록, 4, 0, −1)` 로 **속성 4 = 필살타법 표시**를 단다(이 속성을 다는 곳은 0x51408 안 51812 · 518b8 뿐 — 송구 공에는
   * 달리지 않는다). 야수는 포구 틱에 그 속성을 보고(0xb41c6 목록.vt24(4)) 펌블 굴림(b4224) 뒤 b4246 에서 속성을 떼고(b425e 목록.vt1c(4))
   * 메시지 `0xbc3`(필살타법 공 맞음 — 송구 받기가 아니다. 보통 공·송구 공을 받는 것은 b42c8 쥐기 0xb2710)만 보낸 뒤 **쥐기(0xb2710)로 가지 않고** 사건(sp+0x24) = 1 이 된다(b4250). 그 `0xbc3` 은
   * 전용 처리기가 없고, 틱 끝 b45a0 의 사건 갈래가 플레이.vt70 = 0xb3148 로 공을 그 야수에게서 튕겨 다시 쏜다 —
   * 다시 쏜 공은 0xa2610 이 속성 목록을 비워 보통 공이라 새 예보의 야수가 줍는다 (`rollRelaunchFromFielder`).
   */
  readonly isUncatchable?: boolean
  /**
   * **state[0x19] — 투구 판정 0.1% 사건** (0x3e04e: 상태 0x12 진입 0x3dfac 가 0x35034 = `모드 ≠ 7 && rand(0, 10000) < cfg+0x2e(10)` 를 적는다).
   * 서 있으면 판 끝 결과 코드 0x9d5bc 가 0(9d5ce)이라 낙구·담장선 틱에 사건 코드가 안 난다. 굴림은 투구 흐름 쪽 자리라
   * 부르는 쪽이 실어 보낸다 — 안 주면 0(지금까지와 같다). 이 사건이 화면에 무엇인지는 미확인(P2 6절).
   */
  readonly specialEvent?: boolean
  /**
   * **state[4] — 이 공을 먹이기 전의 스트라이크 수**. 파울 판에서만 본다: 판 끝 결과 코드 0x9d5bc 의 2스트라이크 번트 파울(11)과
   * 판이 닫힌 뒤 0x35108 → 0xb6b58 의 스트라이크 +1(≤ 1 일 때, `foulStrikesAfter`). 안 주면 0.
   */
  readonly strikes?: number
  readonly maximumTicks?: number
  /**
   * 난수. **주면 원본 확률 굴림이 돈다** — 필살수비(0x66b30/0x66be4) · 펌블(0xb41d0) ·
   * 악송구(0xa1828) · 레이저 송구(0x66a8c). 안 주면 하나도 굴리지 않아 지금까지와 똑같이 결정론이다.
   */
  readonly random?: RandomPort
  /** 수비 9명의 스킬 번호 (칸 순서). 21(초감각)이면 필살수비·레이저 확률 +3%p */
  readonly fielderSkillIds?: readonly (readonly number[])[]
  /** 전역 모드 0x1552d10 — 7(홈런더비)이면 필살수비를 안 굴리고, 4(나리 타자편)면 기준이 절반이다 */
  readonly gameMode?: number
  /**
   * **수비를 CPU 가 맡았는가** — 협살(AI 상태 8)은 `state[0x31 + 수비측] == 1` 일 때만 시작한다
   * (S8 1-4, 확정). 사람이 수비하면 원본에서도 협살이 절대 안 일어난다 — 원본 버그 B-11. 고친 길(`isBugFixed('B-11')`)은
   * 이 값과 상관없이 협살을 건다(사람 수비면 포스로 밀려 가는 주자 0xb1b54 는 빼고).
   *
   * 안 주면 **안 도는 쪽**으로 둔다. 원본은 경기 상태가 늘 답을 알지만 이 진행기는 부르는 쪽이
   * 말해 줘야 알 수 있어서, 모르면 시작하지 않는 쪽이 안전하다.
   */
  readonly defenseIsCpu?: boolean
  /**
   * **공격을 CPU 가 맡았는가** — 자동 주루 제어기를 켜는 조건의 한쪽이다.
   * 원본 `0xae690(x, 설정+0xbd)` 의 앞 항: `경기[0x31 + 경기[9](공격측)] == 1` (확정, 아래 참고).
   *
   * 안 주면 `false`(사람 공격)로 둔다 — 그러면 `runningMode` 혼자가 답을 정한다.
   */
  readonly offenseIsCpu?: boolean
  /**
   * **주루 수동/자동** (환경설정 옵션 +0xbd, 기본 자동). 안 주면 자동이다.
   *
   * 원본 배선(직접 뜬 것, 매 틱 도는 경기 장면 슬롯 2 = `0x524c0` 안):
   * ```
   * 5261c: 설정 = 0x1f1d8([0x1400054])
   * 52628: r1 = 설정+0xbd                         ; 주루 수동(0)/자동(1)
   * 5262e: bl 0xae690([장면+0x214], r1)
   *        ae692~ae6be: r2 = [x+0x174](= 경기) ; 공격측 = 경기[9]
   *                     반환 = (경기[0x31 + 공격측] == 1)  ||  (설정+0xbd != 0)
   * 52638: 그 값이 0 이면 → 플레이+0x111(홈런 코드 8)·+0x129(폴 홈런 코드 12) 를 보고, 종류 7(바운드 2루타 코드 10)이면 그래도 돈다
   * 52660: 0xaf8c0(제어기 = 장면+0x210, 0)        ; = 제어기.vt8 = 0xaf918 자동 추가 진루
   * ```
   * 곧 **"공격이 CPU 거나 설정이 자동이면 자동 진루 제어기를 돌리고, 사람이 공격하면서 설정이
   * 수동이면 아예 안 돌린다"**. 예외 셋(플레이 끝남 +0x111 · +0x129 · 종류 7)은 수동이어도 돈다.
   *
   * ⚠️ `경기+0x24` 는 이 갈림과 **아무 상관이 없다** — 아래 `autoBaserunning` 주석 참고.
   */
  readonly runningMode?: ManualAutoMode
  /**
   * **송구 수동/자동** (환경설정 옵션 +0xf4, **원본 기본 0 = 수동**). 안 주면 수동이다.
   *
   * 원본 배선은 바로 위 주루 갈림(`0xae690`)과 **판박이**다. 같은 경기 장면 슬롯 2
   * (`0x524c0`, 매 틱) 안에서 주루 갈림 스물여섯 바이트 뒤에 붙어 있다 (직접 뜬 것):
   * ```
   * 52690: 설정 = 0x1f1d8([0x1400054])
   * 5269c: r3 = 설정+0xf4 ; r1 = [r3]              ; 송구 수동(0)/자동(1)
   * 526a4: bl 0xae6c8([장면+0x214], r1)
   *        ae6ca~ae6f6: r2 = [x+0x174](= 경기) ; 수비측 = 경기[0xa](부호 있는 바이트)
   *                     반환 = (경기[0x31 + 수비측] == 1)  ||  (설정+0xf4 != 0)
   * 526ac: 그 값이 0 이면 건너뛴다                  ; ★ 주루와 달리 예외가 하나도 없다
   * 526ae: 0xaf8e0(제어기 = 장면+0x210)             ; = 제어기.vt0xc = 0xafa60 CPU 송구 결정
   * ```
   * `0xae6c8` 은 `0xae690` 과 **오프셋 한 글자만 다른 쌍둥이**다 — `경기[9]`(공격측) 자리가
   * `경기[0xa]`(수비측)이고 나머지는 한 명령도 다르지 않다.
   *
   * 곧 **"수비가 CPU 거나 설정이 자동이면 CPU 송구 결정을 돌리고, 사람이 수비하면서 설정이
   * 수동이면 아예 안 돌린다"**.
   *
   * 그러면 사람 수비는 무엇으로 던지나 — **사람이 키를 누를 때만 던진다** (2026-10-06 확정, 직접 뜬 것).
   * 공을 내보내는 호출(플레이.vt58 = 0xb2c90 · vt5c = 0xb2e38)을 전부 따라가면:
   * - `0xafa60`(CPU 송구 결정): 위 슬롯 2 갈림 · 도루 시작 메시지 0x583(0x52222) · 결과 메시지 0xbba(0x51dae, 아래)
   * - 플레이 틱 vt4c `0xb45dc`: b4616 중계 이어 던지기(앞선 송구가 세운 +0x14c 계획) ·
   *   **b4660~b46a8 사람 목표 +0x160**(메시지 0x588 → vt0x60 `0xb3118`) · AI 상태 9(0xb2e38 이 미룬 송구) ·
   *   AI 상태 0xe(견제) — 모두 앞선 송구나 견제에서만 선다
   * - 협살 `0xb3a94`: CPU 수비 전용 (0xb4358)
   * - `0xb1c90`(플레이 vt0x30, 매 틱): **송구 호출이 없다**. 자동 가지(+0x160 = −1)가 고른 루는 0xb203a 뒤
   *   2루 커버/중계 야수 자리 잡기에만 쓰인다(c8649a3).
   * 곧 **사람 수비 + 수동 송구에서 키를 안 누르면 공 쥔 야수는 공을 들고 서 있다**. 예외는 결과 메시지
   * 0xbba 하나다 — 결과 코드 9·13(아웃)이 나면 0x51d40~0x51db4 가 수비 조작이 사람(0x33fe4)이든 CPU(0x3403c)든
   * `아웃 ≤ 2` 일 때 플레이+0x128 = 1 로 세우고 `0xafa60` 을 **한 번** 부른다(이 파일 6c 절).
   *
   * 정정: 예전 해독(S8 4-3 · I-controls 2b)의 "메시지 처리기 `0x509a0` 앞머리가 메시지마다 0xafa60 을 부른다" 는
   * **틀렸다**. 앞머리가 부르는 것은 `[장면+0x214]`(경기 로직, 생성 0xae1d8 · vtable **0xd84cc**)의 vt0xc =
   * **`0xae5f8` = `sub sp ; movs r0,#0 ; add sp ; bx lr` 빈 함수**다. 0xafa60 은 `[장면+0x210]`(제어기,
   * 생성 0xaf20c · vtable 0xd8554, 0x3ea84 가 +0x210 에 넣는다)의 vt0xc 이고 둘은 다른 객체다.
   * (메시지 받는 곳 = 장면+0x70, vt0xc 썽크 0x53138 이 this −= 0x70 뒤 0x509a0 으로 간다.)
   *
   * 배선: 사람이 수비하는 자리(`pitcherGameFlow` · `teamGameFlow` 수비 타석 · 투수편 미션)가
   * 이 칸을 넘기면 된다. 안 넘기면 원본 기본값(수동)이다.
   */
  readonly throwMode?: ManualAutoMode
  /** 사람 조작 (I-controls 0절 상태 0x17 표). 안 주면 전부 자동이다 */
  readonly controls?: DefensePlayControls
  /**
   * **앞 판에서 넘어온 수비 장면 연출 칸** (`defenseScene` — 결과 판 +0x1997~+0x1999 · 연출 단계 · deadly_effect 애니 · 줌).
   * 원본은 경기 장면 객체 칸이라 판마다 안 지워진다. 경기 흐름이 앞 판 결과의 `scene` 을 넘긴다 — 안 주면 경기 첫 판(장면을
   * 막 만든 상태)이다. 진행(아웃 · 진루 · 난수)에는 안 닿고 그림 · 필살송구 아웃 기록(state[0x8b])에만 닿는다.
   */
  readonly scene?: DefenseScene

  // ── 아래 셋은 **그림에만 쓰인다** — 진행(아웃·진루·난수)에는 한 톨도 안 닿는다 ──

  /**
   * 수비 칸별 **마선수 번호 0~4** (마선수가 아닌 칸은 null·undefined). 안 주면 아홉 칸 모두
   * 보통 수비수 그림(`defender.pzx`)이다.
   *
   * 번호는 `0xb63a0(선수)` = 마선수(레코드 `+0xa` 비트6)면 `+0xa & 0x1f`, 아니면 −1 이다.
   * 타자 마선수 다섯의 그림 이름은 표 `0xd3f0c`("ace/defender_medica", 20바이트 간격 — 읽는 함수 0x79a5c · 0x79cbc, R3 7-1)에서 고른다:
   * 0 메디카 · 1 어거지죠 · 2 로제 · 3 크라이져 · 4 킹타이거.
   *
   * **원본 그대로**: 원본은 타자 마선수 그림을 **팀당 첫 한 명만** 적재해 놓고 그리는 쪽
   * (`0x79b48` 의 b 갈래)은 "그 칸 선수가 마선수인가" 만 보므로, 한 팀에 타자 마선수가 둘 이상이면
   * 둘째부터도 첫째의 그림으로 나온다(R3 7-3). 그 버그를 되살리려면 **부르는 쪽이** 마선수인 칸에
   * 전부 같은(첫째의) 번호를 넣어 주면 된다 — 여기서 고쳐 주지 않는다.
   * (`defensePlayView.aceIndexesWithOriginalBug` 가 그 일을 한 번에 해 준다.)
   *
   * 칸 0(투수)은 표가 다르다 — 투수 마선수 그림 `0xd4008`(38장)은 `+17` 을 안 쓴다.
   * 그 갈림은 `pages/defense/lib/defenseView.fielderSpriteOf` 가 칸 0 인지로 이미 처리한다(S12 8-2).
   */
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /** 수비 팀 번호 0~14 — 야수 그림 팔레트 `defender.mpl` (C-1, 15색) */
  readonly defenseTeamIndex?: number
  /** 야수 +0xec — 칸별 선수 레코드(판 시작 뒤 값, `entities/fielding/model/fielderRecords`). 그림이 야수마다 싣는다. 안 주면 싣지 않는다 */
  readonly fielderRecords?: readonly (FielderRecordSeat | null)[]
  /** 공격 팀 번호 0~14 — 주자 그림 팔레트 */
  readonly offenseTeamIndex?: number
  /**
   * 수비 칸별 **이름 판에 적을 선수** (0x43cb0 의 오른쪽 아래 판). 칸 0 은 지금 마운드 투수(이름 + 보직 +0xb & 3),
   * 칸 1~8 은 그 칸 야수(이름 + 수비 코드 +0x1c & 0xf). 안 주면 고리만 그리고 판은 없다.
   */
  readonly fielderPlates?: readonly (HolderPlate | null | undefined)[]
  /**
   * 공격 팀 주자 · 타자의 **마선수 번호** (타자 마선수 0~4) — 주자 그림 0x79d10 이 마선수 그림으로 그린다(`runnerAces` 머리말).
   * 안 주면 모두 보통 주자 그림이다.
   */
  readonly runnerAces?: RunnerAces
  /**
   * 경기 +0x199a — 큰 타구 감상 플래그(0x392ac, 상태 0x13 이 세운다). 수비 화면 공 그리기 0x36dfc 가 서 있는 동안
   * 판 종류 1 · 8 이면 그림마다 큰 타구 파티클을 쏜다. 안 주면 이 판의 타구(결과 코드 · 궤적 폴 틱 · 거리 눈금)로 0x392ac 를 다시 본다
   * — 0x13 과 같은 공이라 같은 값이다.
   */
  readonly bigHitWatch?: boolean
}
