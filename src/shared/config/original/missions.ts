// 이 파일은 tools/generate_game_data.py 가 원본 패키지에서 생성했다.
// 직접 고치지 말고 생성기를 고칠 것.

export interface OriginalMission {
  readonly id: number
  readonly side: '타자' | '투수'
  /** 난이도 단계. 원본 레코드의 두 번째 열이며 세 미션마다 오른다. */
  readonly stage: number
  readonly name: string
  /** 목표 종류. 원본은 여러 개를 | 로 묶는다. */
  readonly goals: readonly string[]
  /** 원작 설명문. !N 은 줄바꿈 마크업이다. */
  readonly briefing: string
  /** 초 단위. 0이면 시간 제한이 없다. */
  readonly timeLimitSeconds: number
  /** 타석 제한. 0이면 없다. */
  readonly plateAppearanceLimit: number
  /** 스윙 제한. 0이면 없다. */
  readonly swingLimit: number
  /** 투구 수 제한. 0이면 없다. */
  readonly pitchLimit: number
  /** 상대 마선수 순번 (1부터, 상대 편 ACE_PLAYERS 순서). 0이면 일반 선수. */
  readonly opponentAce: number
  /**
   * 원본 레코드 바이트 13 = **투수 미션의 조준점 흔들림 세기** 0~3 (0xaa57c → 0x39c5c).
   * 0 이면 흔들리지 않는다. 1~3 의 뜻은 `MISSION_AIM_SHAKES` 를 볼 것. 타자편은 모두 0 이다.
   */
  readonly conditionCode: number
  /** 목표별 필요 개수 (레코드 뒤쪽 칸). 사이클링히트는 단타·2루타·3루타·홈런 각각이다. */
  readonly goalCounts: Readonly<Record<string, number>>
  /** 시작 상황 — 이닝(1부터)·아웃·볼·스트라이크·주자 */
  readonly start: {
    readonly inning: number
    readonly outs: number
    readonly balls: number
    readonly strikes: number
    readonly runners: { readonly first: boolean; readonly second: boolean; readonly third: boolean }
    readonly ourScore: number
    readonly opponentScore: number
  }
  /** 투수편 실패 한도 — 실점·볼넷·피안타가 이 값에 닿으면 실패. 0 이면 없음 */
  readonly failLimits: { readonly runs: number; readonly walks: number; readonly hits: number }
}

/** 원본 XlsBATTER_MISSION / XlsPITCHER_MISSION */
export const MISSIONS: readonly OriginalMission[] = [
  { id: 1, side: '타자', stage: 2, name: '명품 타자의 첫 걸음', goals: ['안타', '타점'], briefing: '2안타와 1타점을 올리자!', timeLimitSeconds: 0, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '타점': 1, '안타': 2 }, start: { inning: 1, outs: 1, balls: 0, strikes: 0, runners: { first: false, second: false, third: true }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 2, side: '타자', stage: 2, name: '번트의 달인', goals: ['번트'], briefing: '찬스를 만들어라!!N번트를 성공시키자!', timeLimitSeconds: 0, plateAppearanceLimit: 3, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '번트': 1 }, start: { inning: 1, outs: 0, balls: 2, strikes: 0, runners: { first: true, second: false, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 3, side: '타자', stage: 2, name: '찬스를 노려라', goals: ['2루타', '타점'], briefing: '득점 찬스가 왔다!!N2루타와 1타점을 올리자!', timeLimitSeconds: 0, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '2루타': 1, '타점': 1 }, start: { inning: 4, outs: 2, balls: 0, strikes: 0, runners: { first: false, second: false, third: true }, ourScore: 2, opponentScore: 3 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 4, side: '타자', stage: 4, name: '밀림의 공주 레오니', goals: ['안타'], briefing: '마투수 레오니와 승부!!!N안타 아니면 죽음!', timeLimitSeconds: 0, plateAppearanceLimit: 2, swingLimit: 0, pitchLimit: 0, opponentAce: 2, conditionCode: 0, goalCounts: { '안타': 1 }, start: { inning: 5, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 3, opponentScore: 4 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 5, side: '타자', stage: 4, name: '기동력은 나의 힘', goals: ['번트', '도루'], briefing: '번트와 도루를!N1개씩 성공시키자!', timeLimitSeconds: 0, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '도루': 1, '번트': 1 }, start: { inning: 1, outs: 0, balls: 2, strikes: 0, runners: { first: true, second: false, third: false }, ourScore: 4, opponentScore: 5 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 6, side: '타자', stage: 4, name: '추격타의 주인공', goals: ['홈런'], briefing: '추격의 기회!!N2타석 내에 홈런을 날려라!', timeLimitSeconds: 0, plateAppearanceLimit: 2, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '홈런': 1 }, start: { inning: 5, outs: 1, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 7, side: '타자', stage: 6, name: '폭발하는 방망이', goals: ['홈런', '2루타'], briefing: '장타력 대폭발!!!N홈런과 2루타를 터트려라!', timeLimitSeconds: 0, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '2루타': 1, '홈런': 1 }, start: { inning: 1, outs: 0, balls: 2, strikes: 0, runners: { first: true, second: false, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 8, side: '타자', stage: 6, name: '치명적인 유혹', goals: ['안타'], briefing: '마투수 발렌타인과 승부!!!N3타석 내에 2안타를 날려라!', timeLimitSeconds: 0, plateAppearanceLimit: 3, swingLimit: 0, pitchLimit: 0, opponentAce: 4, conditionCode: 0, goalCounts: { '안타': 2 }, start: { inning: 1, outs: 1, balls: 0, strikes: 1, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 9, side: '타자', stage: 6, name: '미스터 타점왕', goals: ['타점'], briefing: '타격감 대폭발!!!N한 경기 4타점을 달성하라!', timeLimitSeconds: 0, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '타점': 4 }, start: { inning: 1, outs: 1, balls: 0, strikes: 0, runners: { first: false, second: true, third: true }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 10, side: '타자', stage: 8, name: '빠르게 제압하라', goals: ['안타', '타점'], briefing: '3번의 스윙으로 3안타와!N1타점을 올려라!', timeLimitSeconds: 0, plateAppearanceLimit: 0, swingLimit: 3, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '타점': 1, '안타': 3 }, start: { inning: 2, outs: 1, balls: 0, strikes: 1, runners: { first: false, second: false, third: true }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 11, side: '타자', stage: 8, name: '도전! 그라운드 홈런', goals: ['그라운드홈런'], briefing: '3타석 내에 안타로 그라운드를!N돌아 홈으로 들어와라!', timeLimitSeconds: 0, plateAppearanceLimit: 3, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '그라운드홈런': 1 }, start: { inning: 1, outs: 1, balls: 0, strikes: 1, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 12, side: '타자', stage: 8, name: '운명의 대결', goals: ['만루홈런'], briefing: '마투수 드래고나와 승부!!!N3회의 스윙 내 홈런을 날려라!', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 3, pitchLimit: 0, opponentAce: 5, conditionCode: 0, goalCounts: { '만루홈런': 1 }, start: { inning: 9, outs: 2, balls: 0, strikes: 0, runners: { first: true, second: true, third: true }, ourScore: 4, opponentScore: 7 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 13, side: '타자', stage: 10, name: '미라클 홈런왕', goals: ['홈런'], briefing: '3번의 타석을 모두!N홈런으로 장식하라!', timeLimitSeconds: 0, plateAppearanceLimit: 3, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '홈런': 3 }, start: { inning: 1, outs: 1, balls: 0, strikes: 0, runners: { first: false, second: false, third: true }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 14, side: '타자', stage: 10, name: '폭주!! 사이클링 히트', goals: ['사이클링히트'], briefing: '제한 시간 내에 단타, 2루타,!N3루타, 홈런을 성공시켜라!', timeLimitSeconds: 120, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '단타': 1, '2루타': 1, '3루타': 1, '홈런': 1, '타점': 1, '안타': 2 }, start: { inning: 1, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 16, side: '타자', stage: 0, name: '싸이커', goals: ['안타'], briefing: '싸이커 공략', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 0, pitchLimit: 0, opponentAce: 1, conditionCode: 0, goalCounts: { '안타': 1 }, start: { inning: 1, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 17, side: '타자', stage: 0, name: '레오니', goals: ['안타'], briefing: '레오니 공략', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 0, pitchLimit: 0, opponentAce: 2, conditionCode: 0, goalCounts: { '안타': 1 }, start: { inning: 1, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 18, side: '타자', stage: 0, name: '붕붕머신', goals: ['안타'], briefing: '붕붕머신 공략', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 0, pitchLimit: 0, opponentAce: 3, conditionCode: 0, goalCounts: { '안타': 1 }, start: { inning: 1, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 19, side: '타자', stage: 0, name: '발렌타인', goals: ['안타'], briefing: '발렌타인 공략', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 0, pitchLimit: 0, opponentAce: 4, conditionCode: 0, goalCounts: { '안타': 1 }, start: { inning: 1, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 20, side: '타자', stage: 0, name: '드래고나', goals: ['안타'], briefing: '드래고나 공략', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 0, pitchLimit: 0, opponentAce: 5, conditionCode: 0, goalCounts: { '안타': 1 }, start: { inning: 1, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 1, side: '투수', stage: 2, name: '깔끔한 마무리', goals: ['아웃', '탈삼진'], briefing: '삼진 한개를 곁들여 깔끔하게!N경기를 마무리하라!', timeLimitSeconds: 0, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '탈삼진': 1, '아웃': 3 }, start: { inning: 9, outs: 0, balls: 0, strikes: 1, runners: { first: false, second: false, third: false }, ourScore: 3, opponentScore: 1 }, failLimits: { runs: 2, walks: 0, hits: 0 } },
  { id: 2, side: '투수', stage: 2, name: '최고의 집중력', goals: ['MAX게이지', '아웃'], briefing: '제한 시간 내에 MAX투구게이지!N6구와 2아웃을 잡아라!', timeLimitSeconds: 120, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { 'MAX게이지': 6, '아웃': 2 }, start: { inning: 4, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 1 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 3, side: '투수', stage: 2, name: '혼이 실린 스트라이크', goals: ['탈삼진'], briefing: '10개의 공으로 2삼진을 잡아라!', timeLimitSeconds: 0, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 10, opponentAce: 0, conditionCode: 0, goalCounts: { '탈삼진': 2 }, start: { inning: 4, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 4, opponentScore: 5 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 4, side: '투수', stage: 4, name: '착...착각하지마!!', goals: ['탈삼진'], briefing: '마타자 로제와 승부!!!N6개의 공으로 삼진을 잡아라!', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 0, pitchLimit: 6, opponentAce: 3, conditionCode: 1, goalCounts: { '탈삼진': 1 }, start: { inning: 5, outs: 0, balls: 1, strikes: 0, runners: { first: true, second: false, third: false }, ourScore: 5, opponentScore: 7 }, failLimits: { runs: 1, walks: 1, hits: 1 } },
  { id: 5, side: '투수', stage: 4, name: '흔들리지 않는 마음', goals: ['아웃'], briefing: '제한 시간 내 무실점으로!N3아웃을 잡아라!', timeLimitSeconds: 90, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 1, goalCounts: { '아웃': 3 }, start: { inning: 3, outs: 0, balls: 1, strikes: 1, runners: { first: false, second: true, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 1, walks: 0, hits: 0 } },
  { id: 6, side: '투수', stage: 4, name: '연속 삼진 쇼', goals: ['삼진콤보'], briefing: '제한 시간 내에 2타자를!N연속으로 삼진시켜라!', timeLimitSeconds: 90, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '삼진콤보': 2 }, start: { inning: 6, outs: 0, balls: 1, strikes: 1, runners: { first: true, second: false, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 7, side: '투수', stage: 6, name: '에이스 투수의 기량', goals: ['탈삼진', '무실점'], briefing: '제한 시간 동안 3삼진!N무실점으로 틀어막아라!', timeLimitSeconds: 240, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '탈삼진': 3 }, start: { inning: 6, outs: 0, balls: 3, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 2, opponentScore: 3 }, failLimits: { runs: 1, walks: 0, hits: 0 } },
  { id: 8, side: '투수', stage: 6, name: '영혼의 사우팅을 들려줘', goals: ['탈삼진'], briefing: '마타자 크라이져와 승부!!!N5개의 공으로 삼진을 잡아라!', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 0, pitchLimit: 5, opponentAce: 4, conditionCode: 2, goalCounts: { '탈삼진': 1 }, start: { inning: 4, outs: 0, balls: 1, strikes: 0, runners: { first: false, second: true, third: false }, ourScore: 4, opponentScore: 4 }, failLimits: { runs: 1, walks: 1, hits: 1 } },
  { id: 9, side: '투수', stage: 6, name: '투혼의 삼진 행진', goals: ['MAX게이지', '탈삼진'], briefing: '제한 시간 내에 MAX투구게이지!N10구와 4삼진을 잡아라!', timeLimitSeconds: 180, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '탈삼진': 4, 'MAX게이지': 10, '아웃': 1 }, start: { inning: 1, outs: 0, balls: 1, strikes: 1, runners: { first: false, second: false, third: false }, ourScore: 3, opponentScore: 0 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 10, side: '투수', stage: 8, name: '난공불락의 철벽마무리', goals: ['아웃'], briefing: '제한 시간 내 무안타로!N3아웃을 잡아라!', timeLimitSeconds: 90, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 3, goalCounts: { '아웃': 3 }, start: { inning: 8, outs: 0, balls: 2, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 0 }, failLimits: { runs: 1, walks: 0, hits: 1 } },
  { id: 11, side: '투수', stage: 8, name: '불꽃같은 투구', goals: ['삼진콤보'], briefing: '제한 시간 내에 3타자를!N연속으로 삼진시켜라!', timeLimitSeconds: 120, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: { '삼진콤보': 3 }, start: { inning: 5, outs: 0, balls: 0, strikes: 1, runners: { first: false, second: false, third: false }, ourScore: 2, opponentScore: 3 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 12, side: '투수', stage: 8, name: '최강의 챔피언', goals: ['탈삼진'], briefing: '마타자 킹타이거와 승부!!!N4개의 공으로 삼진을 잡아라!', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 0, pitchLimit: 4, opponentAce: 5, conditionCode: 2, goalCounts: { '탈삼진': 1 }, start: { inning: 9, outs: 1, balls: 2, strikes: 0, runners: { first: true, second: false, third: true }, ourScore: 6, opponentScore: 8 }, failLimits: { runs: 0, walks: 0, hits: 0 } },
  { id: 13, side: '투수', stage: 10, name: '도전! 노히트 노런', goals: ['노히트노런'], briefing: '제한 시간 내에 5이닝을!N노히트노런으로 틀어막아라!', timeLimitSeconds: 300, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: {  }, start: { inning: 5, outs: 0, balls: 2, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 2, opponentScore: 0 }, failLimits: { runs: 1, walks: 0, hits: 1 } },
  { id: 14, side: '투수', stage: 10, name: '완벽한 승리자', goals: ['퍼펙트게임'], briefing: '제한 시간 내에 6이닝을!N퍼펙트로 틀어막아라!', timeLimitSeconds: 300, plateAppearanceLimit: 0, swingLimit: 0, pitchLimit: 0, opponentAce: 0, conditionCode: 0, goalCounts: {  }, start: { inning: 4, outs: 0, balls: 3, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 1, opponentScore: 0 }, failLimits: { runs: 1, walks: 1, hits: 1 } },
  { id: 16, side: '투수', stage: 0, name: '메디카', goals: ['아웃'], briefing: '메디카 공략', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 0, pitchLimit: 5, opponentAce: 1, conditionCode: 0, goalCounts: { '아웃': 1 }, start: { inning: 1, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 1 }, failLimits: { runs: 1, walks: 1, hits: 1 } },
  { id: 17, side: '투수', stage: 0, name: '킹타이거', goals: ['아웃'], briefing: '킹타이거 공략', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 0, pitchLimit: 5, opponentAce: 5, conditionCode: 0, goalCounts: { '아웃': 1 }, start: { inning: 1, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 1 }, failLimits: { runs: 1, walks: 1, hits: 1 } },
  { id: 18, side: '투수', stage: 0, name: '로제', goals: ['아웃'], briefing: '로제 공략', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 0, pitchLimit: 5, opponentAce: 3, conditionCode: 0, goalCounts: { '아웃': 1 }, start: { inning: 1, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 1 }, failLimits: { runs: 1, walks: 1, hits: 1 } },
  { id: 19, side: '투수', stage: 0, name: '크라이져', goals: ['아웃'], briefing: '크라이져 공략', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 0, pitchLimit: 5, opponentAce: 4, conditionCode: 0, goalCounts: { '아웃': 1 }, start: { inning: 1, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 1 }, failLimits: { runs: 1, walks: 1, hits: 1 } },
  { id: 20, side: '투수', stage: 0, name: '어거지죠', goals: ['아웃'], briefing: '어거지죠 공략', timeLimitSeconds: 0, plateAppearanceLimit: 1, swingLimit: 0, pitchLimit: 5, opponentAce: 2, conditionCode: 0, goalCounts: { '아웃': 1 }, start: { inning: 1, outs: 0, balls: 0, strikes: 0, runners: { first: false, second: false, third: false }, ourScore: 0, opponentScore: 1 }, failLimits: { runs: 1, walks: 1, hits: 1 } },
]

/** 투수 미션 조준점 흔들림 (0x39c5c) — `conditionCode` 가 색인이다 */
export interface MissionAimShake {
  /** 틱마다 흔들릴 확률 % — 원본은 rand(0,100) <= 50 이라 51% 다 (⚠️ 원본 그대로) */
  readonly chancePercent: number
  /** 가로 흔들림 폭 (rand(−x, x)) */
  readonly shakeX: number
  /** 세로 흔들림 폭 (0 이면 세로는 안 흔든다) */
  readonly shakeY: number
  /** true 면 흔드는 대신 존 안 아무 데로 조준점을 옮긴다 */
  readonly teleport: boolean
}

/** 조준점이 존 중심에서 벗어날 수 있는 한계 (0x39c5c) */
export const MISSION_AIM_CLAMP = { x: 600, y: 400 }

/** MISSION_AIM_SHAKES[conditionCode] — 0 은 흔들림 없음 */
export const MISSION_AIM_SHAKES: readonly (MissionAimShake | null)[] = [
  null,
  { chancePercent: 50, shakeX: 40, shakeY: 0, teleport: false }, // 조건코드 1
  { chancePercent: 50, shakeX: 80, shakeY: 80, teleport: false }, // 조건코드 2
  { chancePercent: 50, shakeX: 600, shakeY: 400, teleport: true }, // 조건코드 3
]
