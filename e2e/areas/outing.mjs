// 도메인 outing — 외출 지도: 나리 타자편 112 · 시즌모드 0xd1 (장면 표 `src/app/dev/scenes/outing.ts`).
export const sources = [
  'src/pages/outing-map/', 'src/pages/shop/', 'src/features/shop/', 'src/pages/special/', 'src/pages/special-edit/',
  'src/pages/management/lib/outingMapUnderlay', 'src/entities/wallet/', 'src/entities/collection/', 'src/app/model/useCollection',
]
export const representative = 'nari-outing'

export const actions = {
  'nari-outing': [
    { name: '번화가 말풍선', steps: ['@번화가'], expect: '들어가기', undo: ['Escape'] },
    { name: '병원 말풍선', steps: ['@병원'], expect: '들어가기', undo: ['Escape'] },
    { name: '학교 말풍선', steps: ['@학교'], expect: '들어가기', undo: ['Escape'] },
  ],
  'season-outing': [
    // 시즌 외출은 건물을 누르면 말풍선 대신 알림 상자(0xd1 — 오늘 외출 막힘 따위)
    { name: '번화가 알림 상자', steps: ['@번화가'], expect: '알림', undo: ['Escape'] },
  ],
}

const PLACES = /"(경기장|번화가|병원|학교|방송국)"$/
const CORNERS_ONLY = (row) => !row.points.includes('가운데')

/** 허용 목록(이 도메인 몫) — `e2e/lib/hits.mjs` 의 `ALLOWED_OVERLAPS` 와 같은 꼴 */
export const allowed = [
  {
    match: (scene, row) => /outing$/.test(scene) && PLACES.test(row.label) && PLACES.test(row.by) && CORNERS_ONLY(row),
    why: '외출 지도 건물 칸은 건물 그림 사각형이라 이웃 건물과 모서리가 겹친다 — 고른 건물을 뒤에 그리는 원본 차례(0x7ec04) 그대로 위. 가운데는 제 건물',
  },
  {
    match: (scene, row) => /outing$/.test(scene) && PLACES.test(row.label) && /PlaceBubble_/.test(row.byPath),
    why: '외출 말풍선(PlaceBubble)이 떠 있는 동안 그 아래 건물 칸 — 키도 말풍선 것이고 CLR(취소 · 뒤로)로 닫는다',
  },
]
