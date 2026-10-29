import { BALANCE } from '@/shared/config/original/balance'

/** 기록 이름 — StrGAME[id+8]. 금액 표는 두 벌이고 값은 같다: 경기 끝 지급이 0xcfbf8, 경기 중 누계가 0xd8158 */
export const RECORD_NAMES: readonly string[] = [
  '3루타',
  '솔로 홈런',
  '2점 홈런',
  '3점 홈런',
  '만루 홈런',
  '대타 홈런',
  '백투백 홈런',
  '백투백투백 홈런',
  '도루 성공',
  '연타석 히트 x3',
  '연타석 히트 x4',
  '연타석 히트 x5',
  '한 타자 2홈런',
  '한 타자 3홈런',
  '한 타자 4홈런',
  '사이클링 히트',
  '삼구 삼진',
  '풀카운트 삼진',
  '삼진 콤보 x3',
  '삼진 콤보 x6',
  '삼진 콤보 x9',
  '한 투수 10삼진',
  '한 투수 15삼진',
  '한 투수 20삼진',
  '도루 저지',
  '삼구 삼자범퇴',
  '더블플레이',
  '트리플플레이',
  '완투승',
  '완봉승',
  '노히트노런',
  '퍼펙트게임',
  '3연속 파울',
  '4연속 파울',
  '한 타자 2볼넷',
  '한 타자 3볼넷',
  '필살송구 아웃',
  '10점차 이상 승',
  '20점차 이상 승',
  '30점차 이상 승',
]

const RECORD_GAME_POINTS: readonly number[] = BALANCE.recordGamePoints

/** 경기 끝 지급 0x4ea0c 의 Σ 횟수 × 금액 0xcfbf8[k] */
export function recordGamePointsOf(recordIds: readonly number[]): number {
  return recordIds.reduce((total, id) => total + (RECORD_GAME_POINTS[id] ?? 0), 0)
}
