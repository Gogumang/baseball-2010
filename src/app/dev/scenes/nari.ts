// 장면 표 — 나리 타자편 — 관리 105 · 경기 뒤 평가 · 첫 타석 · 돌발미션 결과 창. 도메인 이름은 파일 이름(`yarn e2e:only --area <도메인>`).
import { scenePeeksNow } from '@/shared/lib/scenePeek/scenePeek'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import type { SceneDefinition } from '@/app/dev/scenes/steps'
import { call, until, key, wait, keyUntil, offersHave, burstWindowOf, screenIs } from '@/app/dev/scenes/steps'
import { TO_NARI_MANAGEMENT } from '@/app/dev/scenes/routes'

export const NARI_SCENES: Readonly<Record<string, SceneDefinition>> = {
  'nari-management': {
    description: '나리 타자편 관리 화면 105',
    fixture: 'nari-y1',
    steps: [...TO_NARI_MANAGEMENT, wait(900)],
  },
  'nari-evaluation': {
    description:
      '나리 타자편 116 경기 뒤 평가 — 경기 결과(정산 판, 경기 장면 0x19)를 세우고 OK 로 나가면(0x3f3) 나리 장면 116 → 114 평가 대사 (r287)',
    fixture: 'nari-y1',
    steps: [
      ...TO_NARI_MANAGEMENT,
      call('경기 결과 0x19 를 세운다(정산 효과 없이 정산 판만)', (h) =>
        h.setScreen({
          kind: '경기결과',
          summary: {
            result: '승',
            ourScore: 5,
            opponentScore: 3,
            stats: EMPTY_SEASON_STATS,
            popularityPoints: 0,
            doublePlays: 0,
            scoringPositionOuts: 0,
            reputationCounts: { grandSlams: 0, walkOffs: 0, buntHits: 0, walks: 0, goAheadRuns: 0, tyingRuns: 0 },
            ourTeamId: h.career.career?.teamId ?? 0,
            opponentTeamId: 1,
            recordIds: [],
          },
          gamePointReward: 0,
          newTitles: [],
          evaluation: { popularityChange: 2, reputationChange: 3, moraleChange: 1, commentIndex: 40 },
          streakNotices: [],
        }),
      ),
      screenIs('경기결과'),
      wait(600),
      key('Enter'),
      screenIs('경기평가'),
      wait(900),
    ],
  },
  'nari-bat': {
    description: '나리 타자편 경기 — 1년차 첫 경기 내 첫 타석 0xe (관리 [다음경기] → 순위표 · 경기 준비 OK → 경기). 타이밍 재기 r242',
    fixture: 'nari-y1',
    // 픽스처는 부팅 씨앗이 없어 시계로 굴린다 — 브라우저 · 기기마다 같은 공 · 같은 판에 닿게 정한다
    seed: 1,
    steps: [
      ...TO_NARI_MANAGEMENT,
      call('관리 [다음경기] (runCommand)', (h) => h.career.actions.runCommand('다음경기')),
      // 타석 화면(`BattingStage`)이 서면 멈춘다 — 그 뒤 OK 는 스윙이라 누르지 않는다
      keyUntil('Enter', '나리 타석 0xe', () => scenePeeksNow().battingStage !== undefined, 400, 90000),
      wait(400),
    ],
  },
  'nari-burst-result': {
    description:
      '나리 타자편 돌발미션 결과 창 — 꺼진 화면 전체 확인 칸 위 (r195). 씨앗 5: 첫 경기 9회말 넷째 타석 앞 제안(약 63초) → 삼진 뒤 경기 끝 앞 결과 창(약 85초)',
    fixture: 'nari-y1',
    // 씨앗 0~19 를 훑어 제안 창이 가장 일찍 뜬 씨앗(r227 — 그때 5 는 약 43초에 결과 창). r289~r302 타자편 변경 뒤 같은 씨앗의 제안이
    // 첫 경기 마지막 내 타석(9회말)으로 밀렸고, 그 타석 뒤 남은 반 이닝이 경기를 끝내 웹이 결과 창 없이 정산으로 갔다(r315 고침 —
    // 0x12 끝 돌발 판정이 참이면 0x1d 를 먼저 거친다). 이제 이 장면은 경기 끝 앞 결과 창 길을 밟는다
    seed: 5,
    snapshot: 'nari-burst-result',
    steps: [
      ...TO_NARI_MANAGEMENT,
      call('관리 [다음경기]', (h) => h.career.actions.runCommand('다음경기')),
      // 순위 · 경기준비 · 타석 앞 OK 는 Enter, 타석(번트 '8' 이 뜸)에서는 누르지 않고 공을 보낸다 — 난수 차례만으로 간다
      keyUntil('Enter', '돌발미션 제안 창', (h) => burstWindowOf(h) === '제안', 250, 150000, offersHave('번트')),
      // 제안 창만 Enter 로 닫고 그 뒤로는 누르지 않는다 — 타석이 끝나면 결과 창이 저절로 선다(다음 타석 OK 대기 · 경기 끝 정산 앞)
      keyUntil(
        'Enter',
        '돌발미션 결과 창',
        (h) => burstWindowOf(h) === '결과',
        250,
        60000,
        (h) => burstWindowOf(h) !== '제안',
      ),
      // 판이 오르고 글이 다 나올 때까지 — 결과 창이 선 직후 한 그림쯤 경기 화면이 다시 서며 창이 잠깐 빠지는 틈이 있어 넉넉히
      wait(3000),
      until('돌발미션 결과 창 그대로', (h) => burstWindowOf(h) === '결과', 3000),
    ],
  },
}
