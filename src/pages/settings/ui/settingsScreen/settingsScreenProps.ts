import type { GameSettings } from '@/entities/settings/model/gameSettings'
import type { CareerResetEdition } from '@/entities/settings/model/modeReset'

export interface SettingsScreenProps {
  readonly settings: GameSettings
  readonly onChange: (settings: GameSettings) => void
  /**
   * 파일 저장 0x1f1b9 — 메인 메뉴 첫 화면을 OK 칸·CLR 로 나갈 때(0x295e2) 접기 전에 한 번 부른다. 상세 설정·모드 초기화
   * 하위 페이지를 오갈 때는 안 부른다. 안 넘기면 저장은 `onChange` 쪽 몫이다(경기 중 "설정")
   */
  readonly onSave?: () => void
  /**
   * 나만의리그 초기화 — 고르기 창 답 0 타자편 → `0x224ec(mgr, 4)` · 1 투수편 → `0x224ec(mgr, 3)` (하위 2 의 예).
   * 받는 쪽이 그 편 저장·경기 중간 저장 표시를 지우고 시즌 내 팀에서 그 편 나리 선수를 뺀다(0x223a8).
   */
  readonly onResetCareer: (edition: CareerResetEdition) => void
  /**
   * 하위 1 의 시즌 중 막기 — `0xb5054(내 시즌 팀, 편) && 전역기록 +0x4e` 면 띄울 글(타자편 [212] · 투수편 [213]), 통과면 null.
   * 안 넘기면 늘 통과(경기 중 "설정" — 모드 초기화 줄이 없다).
   */
  readonly careerResetBlockOf?: (edition: CareerResetEdition) => string | null
  /**
   * 에디트 초기화 `0x204c1` = 이름표 memset (모드 초기화 칸 2).
   * 메인 메뉴 환경설정(상태 8)만 넘긴다 — 경기 중 메뉴 "설정" 은 작은 판이라 모드 초기화 줄이 아예 없다
   * (`IN_GAME_PANEL`). 메인 메뉴에서 안 넘기면 칸 4 가 아무 일도 하지 않는다.
   */
  readonly onResetEditedNames?: () => void
  /**
   * 시즌모드 초기화 `0x224ec(mgr, 2)` (모드 초기화 칸 1) — 시즌 저장·경기 중간 저장(+0x4e)을 지운다.
   * 안 넘기면 칸은 보이되 OK 가 아무 일도 하지 않는다.
   */
  readonly onResetSeason?: () => void
  /**
   * 메인 메뉴 장면(0x103)의 환경설정일 때만 준다 — 상태 8·0x20·0x21 그리기(0x2dc90 · 0x2dc48 · 0x2dc00)가
   * 판 뒤에 머리띠 `0x54d95(skin, 0, 5, 0)`(제목 "2010프로야구" + G포인트 · 바닥 되돌아가기)를 그린다.
   * 경기 중 메뉴 그리기 0x3cdd0 은 0x593c8 종류 8 만 그리고 머리띠가 없어 안 준다.
   * **안 주면 경기 장면 안 "설정"** 이다 — 경기 장면이 세운 skin+0x125 로 작은 판(130)·세 줄·OK 칸이 된다
   * (`IN_GAME_PANEL`, 0x3301c · 0x5940c · 0x595d0).
   */
  readonly mainMenu?: { readonly gamePoint: number }
  readonly onBack: () => void
}
