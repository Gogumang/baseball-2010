import type { Screen } from '@/app/model/screen'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import type { Collection } from '@/entities/collection/model/collection'
import type { AceMatchHold, AceMatchHoldPort } from '@/entities/mode-save/model/modeSave'
import { NO_ACE_MATCH_HOLD } from '@/entities/mode-save/model/modeSave'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MissionRecordPort } from '@/shared/api/save/missionRecordPort'
import type { ModePitcher } from '@/app/model/modePitcher'
import { NO_SKILLS } from '@/app/model/missionSession/constants/missionConstants'

export interface MissionSessionInput {
  readonly runner: AtBatRunner
  readonly random: RandomPort
  readonly missionRecord: MissionRecordPort
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  /**
   * 미션 클리어 보상 G 를 받아 갈 곳 (0xa52b0). 원본은 전역 저장에 쌓지만 웹은 커리어에 둔다 —
   * 육성 선수가 없으면 받아 갈 곳이 없으므로 넘기지 않아도 된다.
   */
  readonly onGamePointReward?: (amount: number) => void
  /**
   * `0x62368(ui, k, 0)` — 전역 해금표에 히든 k 를 열고 공용 창에 알림(이미 열렸으면 아무것도 안 한다). 정산의 편별 올클리어
   * (4ef86)가 부른다. 새로 열었으면 참
   */
  readonly openHidden?: (id: number) => boolean
  /**
   * 기록연감 통계 `[mgr+0xc8]` 에 한 건 쌓는다 — 정산 0x4ea0c 끝의 플레이 시간 누계 0x4e8b0(모드 5 · 6 → 칸 +0x54).
   * 안 넘기면 아무것도 안 쌓는다
   */
  readonly recordStat?: (event: AnnalsStatEvent) => void
  /** 소리 통로 (원본 사운드 객체 `[0x1400058]`). 안 넘기면 아무 소리도 안 난다 */
  readonly sound?: SoundPort
  /**
   * 환경설정 "송구" 가 **수동**인가 (설정 +0xf4). 안 넘기면 원본 기본값인 수동이다.
   * **투수편 미션은 사람이 수비**라 `0xae6c8` 의 앞 항(`경기[0x31 + 수비측] == 1`)이 거짓이어서
   * 이 설정이 그대로 답이 된다 (타자편 미션은 수비가 CPU 라 상관이 없다 —
   * `missionDefensePlayInputOf` 주석).
   */
  readonly throwModeManual?: boolean
  /**
   * 환경설정 "주루" 가 **수동**인가 (설정 +0xbd). 안 넘기면 자동이다.
   * `0xae690` = `(경기[0x31 + 공격측] == 1) || (설정+0xbd != 0)` 이고 0x46418 이 설정+0xbd 를 넘긴다 — 모드를 안 본다.
   * **타자편 미션은 사람이 공격**이라 앞 항이 거짓이어서 이 설정이 그대로 답이 된다(나리 타자편 0xae690 과 같다).
   * 투수편 미션은 공격이 CPU 라 앞 항이 늘 참이어서 상관이 없다.
   */
  readonly runningModeManual?: boolean
  /**
   * 마선수 레벨 `mgr[0x13a + idx]` (idx 0~4 마투수 · 5~9 마타자 → 0~4 = Lv1~5).
   * 0xb6414 가 마선수 능력치마다 배율 0xd88aa[레벨] 을 곱한다 (`entities/mission/model/aceLevel`).
   * 앱은 전역 저장 칸(`useAceLevels`, 올리는 곳은 레벨업 창 0x5fb24 하나 — 스페셜 마선수 · 일반모드 `0` 키)의
   * 값을 넘긴다 (28af409). 안 넘기면 새 저장 값(0x9f26c 가 0 으로 채움) = Lv1 = 60% 로 본다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * 투수 미션(모드 5)에서 던지는 투수 — 나리 투수편 저장(0x213c0 5→3) 또는 명예 투수(0x1fbd0)의
   * 0xb6414 능력치·레퍼토리·실투 스킬 (`modePitcherOf`). 안 넘기면 신인 투수다 (원본에 없는 대체).
   */
  readonly pitcher?: ModePitcher
  /** 타자 미션에서 치는 타자의 장착 스킬 (`modeBatterOf(...).skillIds`) — 압도 22 가 마투수 투구 소모를 ×2 한다 */
  readonly batterSkillIds?: readonly number[]
  /**
   * 타자 미션에서 치는 나리 타자의 경기용 주력 (`modeBatterOf(...).ability.run`) — 루에 선 미션 타자의 도루 판 · 주루 칸이 읽는다
   * (`missionRunners`). 명예 타자를 고르면 그 선수 값이 대신한다. 안 넘기면 진행기 기본값(500)
   */
  readonly batterRunAbility?: number
  /**
   * 명예의 전당 (전역기록 +0x880 투수 · +0x940 타자). 미션 선수 고르기에서 명예 선수를 고르면(+0xa5/+0xa6 ≥ 0)
   * 선수 게터 0x1fbd0 · 0x1fc20 이 이 기록을 준다 — `pitcher`·`batterSkillIds` 대신 그 선수의 값이다.
   * 안 넘기면 늘 나리 선수다.
   */
  readonly hallOfFame?: Collection
  /**
   * 환경설정 진동(저장 +0x3b) — 거짓이면 0x3a44 가 안 울린다. 안 넘기면 켬 (`BattingStage` · `usePitcherGame` 과 같다).
   * 투수 미션(모드 5)의 사람 공 삼진 진동(상태 0x12 그리기 0x4ce9c 의 0x4d0d6)이 본다.
   */
  readonly isVibrationOn?: boolean
  /**
   * **마선수 대결의 사람 칸 팀** — 0xaa57c aa6dc~aa728: g[0x11f](타자편) · g[0x176](투수편)이 서 있으면 g[0xf6](SYS 8 이 0x8d836 에서 적은
   * 그때 모드 — 나리 타자편 4 · 투수편 3)의 저장 레코드 +1 = 그 편 나리 저장의 팀 (`missionHumanTeamIdOf`).
   * 웹은 그 편 나리 커리어의 `teamId` 다 — 타자편 대결(`beginAceMatch`)은 `batter`, 투수편 대결(`beginPitcherAceMatch`)은 `pitcher`.
   * 안 넘기면(그 편 저장이 없으면) 레코드 팀 그대로다 (원본은 저장 없이 그 편 이벤트가 돌 수 없다).
   */
  readonly nariTeamIds?: { readonly batter?: number; readonly pitcher?: number }
  /**
   * **나리 타자편 저장 선수의 `+0xa & 0x1f`** — 타자 미션 0xaa57c 의 0xb87cc · 0xb53f0(0x80 갈래 · 0xb6720)이 미션 타자를 넣는 레코드
   * 칸 k (`MissionGameSetup.nariRecordSlot`). App 은 자기 나리 팀 레코드의 내 줄 첨자를 넘긴다(`myBatterIndexOf`, 홈런더비 타순
   * `EntryRoutes` 와 같은 칸). **확정** — 0x1fc20 이 주는 선수는 `[저장+0x38]` = 0x1faa1 이 나리 팀 레코드 타자 배열에서 +0xa 가
   * 음수(0x80)인 첫 줄의 포인터(1fb02~1fb1e)라 레코드 안 내 줄 그 자체이고, 그 +0xa 를 적는 곳은 모두 아랫 5비트 = 지금 배열
   * 첨자다: 생성 0x17360(0xa7 → 칸 7) · 첨자 다시 매기기 0xb8768 → 0xb603c(마선수 0xb633c 가 아닌 줄 i 마다 0xb6605(rec, i) —
   * 윗 3비트를 두고 아랫 5비트 = i, 142 진입 0x1c54a · 경기 0x3a2fa · 0x3a302 · 마선수 넣기 0xb8870 · 0xb88c8) · 타순 보상 0xb5d09
   * (0x30 바이트 복사마다 곧바로 0xb6605(rec[x], x) — b5de4 · b5e16 · b5e44, 그 뒤 0x1faa1). 그래서 +0xa & 0x1f = 레코드 배열 첨자다.
   * 안 넘기면(내 줄이 없으면) 끝 칸 12. 내 줄이 레코드에서 사라진 경우(타순 보상 0xb5d09 의 i == b) 원본은 0x1faa1 이 못 찾아
   * `[저장+0x38]` 에 옛 &rec[a] 가 남고, 타자편 저장이 올라 있으면 미션 0x213c0(앱, 6, 1) 의 0x218ee 도 다시 안 찾는다 → P = 옛 칸 선수
   * (+0xa = a, 윗 비트 0)라 0xb53f0 이 −1(안 끼움) · k = a 맞바꿈 → 사람 칸 팀에 육성 · 명예 줄이 없어 미션 칸이 안 오르고 0xc1e04 가
   * 자동진행한다(R9 19-5, U-111). ⚠️ 그 주소는 레코드 재할당(0xb4e34) · 앱 재시작이면 정의 밖(푼 메모리 · NULL)이라 원본의 메모리
   * 상태에 달려 웹 저장 꼴로 옮길 값이 없다 — 웹은 12 로 둔다.
   */
  readonly nariBatterRecordSlot?: number
  /**
   * **나간 마선수 대결 대기 칸** (전역기록 g[0x11f] 타자편 · g[0x176] 투수편 · g[0xf6] 그때 모드 — `entities/mode-save`). 대기가 서
   * 있는 동안은 **보통 미션도 대결 꼴**로 돈다(직접 떴다): 사람 칸 팀 0xaa57c aa6dc~aa728 · 선수 게터 0x1fc20(+0x11f) · 0x1fbd0(+0x176)
   * 가 명예 선수 대신 나리 선수 · 정산 0x4ea0c 의 G 건너뜀 4ef3e · 결과 바이트 덮어쓰기 4efc6~4f018 · 결과 판 0x4a384 대결 꼴 ·
   * 결과 판 키 0x407f0 4090c / 0x4b100 4b344 가 목록 대신 g[0xf6] 의 장면으로. 안 넘기면 대기가 없다.
   */
  readonly aceMatchHold?: AceMatchHoldPort
  /**
   * 대기 중 보통 미션의 결과 판을 닫았다 — 0x407f0 4090c: g[0xf6] ∈ {3, 4} 면 0x140006c = 0x69 · 전환 → 0x4b100 4b344~4b376 이
   * 전역 모드 = g[0xf6] · 장면 0x106(나리, 0x140006c 는 안 읽고 100 → 0x1c154 이어하기) — 그 편 105 진입이 140 결과 이벤트를 띄운다.
   * 부르는 쪽이 그 편으로 들어간다
   */
  readonly onReturnToNari?: (mode: 3 | 4) => void
}

/**
 * 하위 훅이 받는 세션 매개변수 — 받은 값을 이름대로 정리한 것(조용한 소리 · 나리 투수 · 지금 대기 칸 · 환경설정 주루).
 */
export interface MissionSessionArgs extends Omit<MissionSessionInput, 'sound' | 'pitcher' | 'batterSkillIds' | 'batterRunAbility'> {
  readonly audio: SoundPort
  /** 나리 투수편 저장 투수 (`pitcher` 입력, 안 넘기면 신인 투수) — 명예 투수를 고르면 `usePlayerPick` 이 갈음한다 */
  readonly nariPitcher: ModePitcher
  readonly nariBatterSkillIds: readonly number[]
  readonly nariBatterRunAbility: number | undefined
  /** 지금 대기 칸 — 전역기록이라 렌더마다 읽는다 */
  readonly hold: AceMatchHold
  /**
   * 타자편 미션(사람 공격) 판에 싣는 환경설정 "주루" — 0x46418 이 설정+0xbd 를 0xae690 의 둘째 인자로 넘긴다.
   * 사람이 공격이라 첫 항(`경기[0x31 + 공격측] == 1`)이 거짓이어서 이 값이 자동 진루 제어기 0xaf8c0 을 켜고 끈다
   */
  readonly batterRunningMode: '수동' | '자동'
}

/** 받은 입력을 하위 훅의 매개변수로 — 소리가 없으면 조용한 포트, 대기 칸은 이 그림에 읽는다 */
export function missionSessionArgsOf(input: MissionSessionInput, silent: SoundPort, nariPitcher: ModePitcher): MissionSessionArgs {
  const { sound, pitcher: _pitcher, batterSkillIds, batterRunAbility, ...rest } = input
  return {
    ...rest,
    audio: sound ?? silent,
    nariPitcher,
    nariBatterSkillIds: batterSkillIds ?? NO_SKILLS,
    nariBatterRunAbility: batterRunAbility,
    hold: input.aceMatchHold?.read() ?? NO_ACE_MATCH_HOLD,
    batterRunningMode: input.runningModeManual === true ? '수동' : '자동',
  }
}
