/**
 * **키 사건 칸 — 받은 키는 다음 틀의 키 처리가 읽는다** (2026-10-24 직접 떴다, r160 · r167).
 *
 * 원본은 키 콜백이 장면 키 객체(장면+0x18)의 받은 칸 [+0x20](누름) · [+0x24](뗌)에 적어 두기만 하고, 장면 틀 머리가 그것을 읽는다.
 * 경기 장면 0x52c50 의 한 틀:
 * ```
 * 52cbc  0xbca05(장면+0x18) — bca0a~bca16 이 사건 칸 +0x1c · +0x28 · +0x34 · +0x38 · +0x3c · +0x54 를 지우고, [+0x20] 을 0xbca00 으로
 *        바꿔 +0x28(이번 틀 키)에, [+0x24](뗌)면 bcaf0~bcb02 가 +0x54 |= 0x200 · +0x3c 에 적은 뒤 bcb04~bcb08 이 [+0x20] · [+0x24] 를 비운다
 * 52cc6  공용 창 게이트 0x754f9 — 창이 서 있으면 아래를 다 건너뛴다(그 틀의 키 사건은 다음 틀 0xbca05 머리가 지운다 — 모아 두지 않는다)
 * 52cd4  0xbc9c9 — 예약된 상태가 선다(틱 0 · 진입 깃발) · 52cdc 진입 표 0xd04bc
 * 52d9e  키 0x498d4 — '*'(49918~49948: 상태 0xd~0x15 면 0x741a1 메뉴 창 · 0x3c02c) · '#'(4994a~499f8: 0x38984 참이고 상태 0xe · 0xf 면
 *        모드 3 은 StrGAME[104] 물음 0xbbef9, 그 밖은 0x49598 → 0xb)를 본 뒤 499fa~49ab4 가 사람 조작 객체 둘에 이 틀의 누름(+0x28) →
 *        되풀이(+0x38) → 뗌(+0x3c) 차례로 보낸다(0x53670 · 0x536bc · 0x53420 …)
 * 52da2  [장면+0x34](이 틀에 누름이 있다)면 상태별 키 함수 — 0xb 0x495fc · 0xc 인트로 0x39b54 · 0x19 0x407f0 · 0x1a 0x40a08 ·
 *        0x1e 벤치 클리어링 0x40628 · 0x21 0x3e25c · 0x23 감독 대사 창 0x50794 (52da2~52e10)
 * 52e14  갱신 표 0xd0530 → 그리기
 * ```
 * 곧 틀 T 안쪽에 들어온 키는 **틀 T+1** 의 진입 뒤 · 갱신 앞에서 처리된다. 웹 키 사건(keydown)은 아무 때나 오므로, 받은 키를 그 때의
 * 장면 틱과 함께 이 칸에 넣어 두고 장면 부품의 틀(틱 머리)이 진입 뒤 · 갱신 앞에서 꺼낸다(`take`) — 받은 틱보다 뒤 틱에서만 꺼낸다.
 * 창이 서 있는 틀에 꺼내려 하면 버린다(`clear`, 52cc6).
 *
 * **받은 칸은 하나다** (r167 직접 떴다): 장면 vtable 0xcfa0c 의 누름 칸 [3] 0x39f4c 는 `[장면+0x38](= 키 객체+0x20) = 키`, 뗌 칸 [4]
 * 0x39f68 은 `[장면+0x3c](= +0x24) = 키` 를 덮어쓰기만 한다(쌓는 줄이 없다). 그래서 한 틀 안에 키가 둘 오면 **뒤 키만** 다음 틀에
 * 처리되고, 뗌도 같다(마지막 뗌 하나). 한 틀의 누름 하나 · 뗌 하나는 0x498d4 가 누름 먼저 · 뗌 나중으로 보낸다.
 * 웹은 받은 틱마다 마지막 누름 · 마지막 뗌만 남긴다. 처리 손잡이가 없는 키(원본에서 아무 일 없는 키)도 칸을 덮어야 하므로, 칸이 올라
 * 있는 동안 창 잡기 단계에서 폰 키(`SLOT_KEYS`)마다 빈 칸 하나를 먼저 넣고, 같은 사건의 손잡이들(`push` · `pushSceneKey`)이 그 칸에
 * 붙는다 — 키 하나가 0x498d4 안에서 '*' 가지와 상태 키 함수에 함께 가는 것과 같다.
 *
 * 경기 장면 밖 장면 틀도 같은 차례다(r167 직접 떴다): 시즌 0xe9ac(e9b4 0xbca05 → e9c0 0xbc9c9 → 상태 표 0xcbea0) · 나리 0x1cdec
 * (1cdf4 0xbca05 → 1ce00 0xbc9c9 → 상태 표 0xcc728) · 메인 메뉴 0x32fa0(32fb8 0xbc9c9 → 32fc0 0xbca05 → 진입 → 갱신 0x32634 · 0x32dd8)
 * 모두 틀 머리에서 받은 칸을 이번 틀 키로 옮기고 그 틀의 상태 함수가 읽는다 — 받은 다음 틀에 처리하고 칸은 하나다. 앱 틱으로 세는
 * 칸은 `createSceneKeyLatch(appTickNow)` 로 만든다.
 *
 * 쪼갠 파일: `latchCore`(칸 · 받기/꺼내기) · `runSceneKeys`(틀 머리 처리) · `slotKeys`(장면 부품 칸 올리기 · 창 잡기 단계 빈 칸) · `useSceneKeyLatchOwner`
 */
export { createSceneKeyLatch, type SceneKeyKind, type SceneKeyLatch } from '@/shared/lib/sceneKeyLatch/latchCore'
export { isRunningSceneKeys, runSceneKeys } from '@/shared/lib/sceneKeyLatch/runSceneKeys'
export { hasOpenSceneKeyLatch, isSlotKey, openSceneKeyLatch, pushSceneKey, resetSceneKeyLatchesForTest } from '@/shared/lib/sceneKeyLatch/slotKeys'
export { useSceneKeyLatchOwner } from '@/shared/lib/sceneKeyLatch/useSceneKeyLatchOwner'
