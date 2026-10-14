/**
 * **화면 버퍼에 남은 앞 화면** — 원본은 화면 버퍼 하나에 매 틀 덮어 그린다. 새 상태가 첫 틀에 아무것도 안 그리면 버퍼에는
 * 앞 화면의 마지막 틀이 그대로 남고, 효과기(0xbd844)는 그 위에 덮개를 칠한다 (예: 엔딩 141 의 단계 0 — 그리기 0x882c4 가
 * 단계 0 에서 바로 돌아가고 진입 0x12300 이 건 효과기 종류 1 이 남은 화면을 어둡게 덮는다).
 *
 * 웹은 화면이 바뀌면 앞 화면의 DOM 이 지워진다. `RawScreen` 이 내려갈 때 그 판(원작 240×320 자리)을 여기 맡기고
 * (React 는 지운 가지의 맨 위 노드만 떼어 내므로 판 안쪽은 그대로다), 같은 커밋에 선 화면이 `takeLeftFrames` 로 받아 복제해 깐다.
 * 마이크로태스크 하나가 지나면(커밋이 끝나면) 맡긴 것을 잊는다 — 다른 때 선 화면이 오래된 판을 받지 않게.
 * ⚠️ 근사: 판 밖에 그려진 덮개(판과 형제인 창 · 대화창)는 빠지고, 캔버스는 복제하면 비어 있다.
 */
let left: HTMLElement[] = []
let isOpen = false

/** 내려가는 화면 판을 맡긴다 — 같은 커밋에 여러 판이 내려가면 내려간 차례(트리 차례)로 쌓는다 */
export function leaveFrame(stage: HTMLElement): void {
  if (!isOpen) {
    left = []
    isOpen = true
    queueMicrotask(() => {
      isOpen = false
      left = []
    })
  }
  left.push(stage)
}

/** 같은 커밋에 내려간 앞 화면 판들 (없으면 빈 목록) */
export function takeLeftFrames(): readonly HTMLElement[] {
  return isOpen ? left.slice() : []
}
