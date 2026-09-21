/**
 * 원본 소리 52개 (`sound/%03d.mmf`) 의 번호 → 쓰임 표.
 *
 * 원본은 `0x6ea6c play(obj, n, vol, loop)` 로 즉시 틀거나 `0x6e498 request(obj, n, loop)`
 * 로 예약한다. 경로는 `0x6e9d4` 의 `sprintf("%s/%03d.mmf", "sound", n)` 이다.
 * 웹판은 SMAF 를 브라우저가 못 읽어서 `tools/extract_sounds.py` 로 미리 구워 두고
 * `public/sounds/%03d.mp3` 를 튼다 — **파일 이름의 번호는 원본 번호 그대로**다.
 *
 * 음성·효과음 26개는 파일 안의 야마하 4비트 ADPCM 을 그대로 푼 것이라 원본 소리다.
 * 나머지 26개는 커스텀 FM 음색 악보라 WildMIDI 의 MA FM 합성으로 구웠다 —
 * **음색은 근사다** (원본 칩과 귀로 대조하지 못했다). 자세한 것은 그 스크립트 머리에 적어 두었다.
 *
 * 파일이 있는 번호는 52개: 0~18 · 20~40 · 42 · 44 · 46 · 48 · 50~53 · 59~62.
 * (19 · 41 · 43 · 45 · 47 · 49 · 54~58 은 원본에 파일이 없다 — 47 은 배경음 목록에만 이름이 있다.)
 *
 * 근거: docs/re/L-sound-effects.md 1-A~1-G · docs/re/R2-game-effects.md 8절 ·
 *       docs/re/R3-field-view.md 2-1 · docs/re/R10-game-states.md · docs/re/K-bursts-special.md ·
 *       docs/re/H-modes.md · docs/re/R14-game-side-screens.md.
 * 한 번호를 여러 장면이 나눠 쓰는 곳이 많다(22 = 타임 콜 겸 투수 교체, 31/32 = 승패 겸 신기록/실패,
 * 36/37 = 경기 평가 겸 돌발미션 결과). 원본 그대로 한 줄로 묶어 두었다.
 */

/** 소리의 쓰임새. 원본이 loop=1 로 트는 것만 `bgm` 이다. */
export type SoundRole = 'bgm' | 'jingle' | 'voice' | 'effect'

export interface OriginalSound {
  /** 원본 파일 번호 (`sound/%03d.mmf`) */
  readonly id: number
  readonly role: SoundRole
  /** 무슨 소리인지 */
  readonly name: string
  /** 원본이 어디서 트는지 */
  readonly scene: string
  /** 원본에 파일은 있으나 아무 데서도 안 트는 번호 */
  readonly unused?: true
}

/**
 * 원본이 **배경음으로 취급하는 번호 전체**.
 * 이벤트 스크립트 명령 6(0x8d470)의 loop 판정 목록 {1,3,4,40,33,46,47,52,44} 그대로다.
 * 47 은 파일이 없다. 앱 재개 0x2ddc 는 이 중 1~4 만 다시 튼다.
 */
export const LOOPING_SOUND_IDS: readonly number[] = [1, 3, 4, 33, 40, 44, 46, 47, 52]

export const ORIGINAL_SOUNDS: readonly OriginalSound[] = [
  { id: 0, role: 'voice', name: '로고 "GAMEVIL"', scene: '장면 0x103 상태 2 시작 인증·로고 화면 (0x69400)' },
  { id: 1, role: 'bgm', name: '메인메뉴 배경음', scene: '장면 0x103 상태 3~5 (타이틀 뒤 메뉴)' },
  { id: 2, role: 'bgm', name: '쓰이지 않는 배경음', scene: '부르는 곳이 없다 — 앱 재개 0x2ddc 의 "1~4 다시 틀기" 범위에만 든다', unused: true },
  { id: 3, role: 'bgm', name: '모드 준비·설정 화면 배경음', scene: '0x105 상태 202 · 0x106 상태 101 · 0x107 로비' },
  { id: 4, role: 'bgm', name: '관리 화면 배경음', scene: '시즌(0x105)·나만의리그(0x106) 관리 화면' },
  { id: 5, role: 'effect', name: '강한 타구 타격음', scene: '0x51620 (0x35988 참). 환경설정에서 소리 크기를 바꿀 때 미리듣기로도 쓴다' },
  { id: 6, role: 'effect', name: '보통 타구 타격음', scene: '0x51640 (강·약 둘 다 아닐 때)' },
  { id: 7, role: 'effect', name: '특수 타구 타격음', scene: '0x515ec (0x392ac 참 — 결과 24~26, 상태 19 연출)' },
  { id: 8, role: 'effect', name: '헛스윙 바람 소리 (보통)', scene: '0x51350 · 0x4e24a — 맞지 않고 필살 기술 번호가 0' },
  { id: 9, role: 'effect', name: '맞음(연출 없음, 번트로 보임)', scene: '0x51606 — 스윙 객체 +8 ≠ 0' },
  { id: 10, role: 'effect', name: '득점(홈인) 알림', scene: '0x51994·0x519bc·0x5268c 예약 — 한 플레이 한 번(+0x31c 잠금)' },
  { id: 11, role: 'effect', name: '홈런 함성', scene: '판정 v8·v12 (0x51c82) + 홈런 이벤트 0xa5fed · 0x527ce 예약' },
  { id: 12, role: 'effect', name: '투구 순간 소리 (보통)', scene: '0x3f378 — 투수 단계가 공을 놓는 칸에 닿을 때' },
  { id: 13, role: 'jingle', name: '공수 교대 징글', scene: '경기 상태 0x18 갱신 0x4f7ac — 상태 틱 2 에 한 번' },
  { id: 14, role: 'effect', name: '투수 등판음 (보통)', scene: '0x38b64, 경기 상태 0xe 투수 첫 등장' },
  { id: 15, role: 'effect', name: '투수 등판음 (득점권 위기)', scene: '같은 자리에서 2·3루에 주자가 있을 때' },
  { id: 16, role: 'voice', name: '"Ball!" 볼', scene: '경기 판정 스위치 v2 (0x51ac2)' },
  { id: 17, role: 'voice', name: '"Safe!" 세이프', scene: '판정 v9 (0x51c14) — game_judge 글자 애니 5' },
  { id: 18, role: 'voice', name: '"Strike!" 스트라이크', scene: '판정 v1 의 기본 갈래 (0x51aa2)' },
  { id: 20, role: 'voice', name: '아웃 콜 (기본)', scene: '판정 v13 (0x51b36) 기본 갈래 — 뜬공 포구 아웃' },
  { id: 21, role: 'voice', name: '"Strike out!" 삼진', scene: '판정 v5 (0x51bf6) + 삼진 기록 0xa7c4d' },
  { id: 22, role: 'voice', name: '"Time!" 타임', scene: '경기 중 창 0x3af06 · 0x3da88 · 투수 교체 연출 시작(효과음 0x16, 장면 상태 0x16) · 라인업 화면' },
  { id: 23, role: 'voice', name: '"Hit by pitch" 몸에 맞는 공', scene: '판정 v4 (0x51b08) — 진동 200ms 와 함께' },
  { id: 24, role: 'voice', name: '"Base on balls!" 볼넷', scene: '판정 v3 (0x51aca) — 이어서 조건부로 29(함성) 예약' },
  { id: 25, role: 'voice', name: '"Foul!" 파울', scene: '판정 v7 (0x51c5c) — game_judge 글자 애니 4 · 0x5284a 예약' },
  { id: 26, role: 'effect', name: '투수 등판음 (마투수)', scene: '0x38b64 에서 등판 투수가 마선수일 때' },
  { id: 27, role: 'effect', name: '헛스윙 바람 소리 (필살 스윙)', scene: '0x51350 에서 스윙 객체 +0x10 ≠ 0, 또는 마선수 타자' },
  { id: 28, role: 'effect', name: '투구 순간 소리 (마구)', scene: '0x3f378 에서 상태 0x16 이거나 마투수의 마구' },
  { id: 29, role: 'effect', name: '관중 함성 (볼넷 뒤 등)', scene: '0x51b0e 예약(+진동 200ms) · 0x43870 · 0x4c39a' },
  { id: 30, role: 'effect', name: '관중 함성', scene: '0x4657a · 0x51fd2 예약' },
  { id: 31, role: 'jingle', name: '승리 징글 · 신기록(0x1f)', scene: '경기 결과 승리 · 홈런더비 최고 비거리 갱신(0x4f574) · 최고 기록 저장 +0x5c 갱신' },
  { id: 32, role: 'jingle', name: '패배 징글 · 기록 실패(0x20)', scene: '경기 결과 패배 · 신기록이 아닐 때 · 돌발미션 결과 1(실패)' },
  { id: 33, role: 'bgm', name: '경기 배경음', scene: '경기 장면 0x104 상태 0x21 자동진행 중계 (0x3abf0) · 0x48480 · 0x4258c' },
  { id: 34, role: 'effect', name: '용도 미해결', scene: '경기 장면 0x52392 갈래 — 장면을 못 밝혔다' },
  { id: 35, role: 'effect', name: '돌발 결과 보상 (등급 3·4)', scene: '돌발 결과 대사 394·395' },
  { id: 36, role: 'jingle', name: '경기 평가 "좋음" · 돌발미션 성공(0x24)', scene: '경기 뒤 평가 창(0x105 상태 233·0x106) 값이 기준 초과 · 돌발 결과 2 · 돌발 결과 대사 393' },
  { id: 37, role: 'jingle', name: '경기 평가 "보통" · 돌발미션 무효(0x25)', scene: '평가 창 값이 0~기준 · 돌발 결과 3 (보상·페널티 없음)' },
  { id: 38, role: 'jingle', name: '경기 평가 "나쁨"', scene: '평가 창 값이 음수' },
  { id: 39, role: 'voice', name: '"Strike two!" 스트라이크(카운트 2)', scene: '판정 v1 에서 [sp+0xa4]+4 == 2' },
  { id: 40, role: 'bgm', name: '이벤트(스토리 대화) 배경음', scene: '0x106 상태 114 · 0x105 상태 211' },
  { id: 42, role: 'effect', name: '돌발미션 시작 (0x2a)', scene: '후보 추첨 뒤 대사 로드 0x8eba0 · 0x8e2dc' },
  { id: 44, role: 'bgm', name: '용도 미해결 (loop 목록에 든다)', scene: '0x3a8e0 끝에서 예약 — 무엇을 기록하는 함수인지 못 밝혔다' },
  { id: 46, role: 'bgm', name: '엔딩 배경음', scene: '0x106 상태 141 엔딩 화면 · 0x105 상태 245 예약' },
  { id: 48, role: 'effect', name: '용도 미해결', scene: '부르는 곳을 못 찾았다' },
  { id: 50, role: 'effect', name: '용도 미해결', scene: '부르는 곳을 못 찾았다' },
  { id: 51, role: 'effect', name: '돌발 결과 페널티', scene: '돌발 결과 대사 396 (인기도 −5 · 평판 −4)' },
  { id: 52, role: 'bgm', name: '용도 미해결 (loop 목록에 든다)', scene: '이벤트 스크립트 명령 6 의 loop 목록에만 있다' },
  { id: 53, role: 'effect', name: '선수 넘어짐 / 공 놓침(펌블)', scene: '야수 동작 0xd (0xa1e60) — +0xb4 = 15 동안 먼지·고리 애니' },
  { id: 59, role: 'effect', name: '약한 타구(빗맞음) 타격음', scene: '0x5163a (0x39304 참)' },
  { id: 60, role: 'effect', name: '관중 함성 (홈런더비 쪽)', scene: '0x52bb2 예약 (모드 7) · 0x51fc4' },
  { id: 61, role: 'effect', name: '타석 시작', scene: '경기 시작 인트로 상태 0xc · 상태 12 진입 0x3b084 에서 예약' },
  { id: 62, role: 'voice', name: '아웃 콜 (다른 하나)', scene: '판정 v11 (0x51b20) · v13 의 특수 모드 갈래' },
]

/** 번호로 찾기. 표에 없는 번호(= 원본에 파일이 없다)는 undefined. */
export function findOriginalSound(id: number): OriginalSound | undefined {
  return ORIGINAL_SOUNDS.find((sound) => sound.id === id)
}

/** 원본이 loop=1 로 트는 번호인가 (= 배경음인가). */
export function isLoopingSound(id: number): boolean {
  return LOOPING_SOUND_IDS.includes(id)
}

/** `sounds/%03d.mp3` — 원본 `sprintf("%s/%03d.mmf", dir, n)` 를 그대로 옮긴 것. */
export function soundFileUrl(id: number, baseUrl = 'sounds'): string {
  return `${baseUrl}/${String(id).padStart(3, '0')}.mp3`
}
