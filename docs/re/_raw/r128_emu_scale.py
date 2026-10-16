"""0x662dc → 0x65f64 를 unicorn 으로 그대로 돌려 로고 축소 결과 바이트를 낸다 (r128)."""
import json, struct, sys
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_THUMB, UC_HOOK_CODE
from unicorn.arm_const import *

PATH = '/Users/evan123/Desktop/code/baseball-2010/base/work/jar/binary.mod'
RAW = open(PATH, 'rb').read()
TEXT_VA, TEXT_OFF, TEXT_SIZE = 0x1000, 0x34, 0xd9ac8

def lcg_image(w, h, seed):
    """시험과 같은 결정적 그림 — 0 이 군데군데 섞인 색 번호"""
    s = seed & 0xffffffff
    px = []
    for _ in range(w * h):
        s = (s * 1103515245 + 12345) & 0x7fffffff
        v = (s >> 16) & 0xff
        px.append(0 if v < 64 else v)
    return px

def rle(px):
    """0 묶음은 0 줄(비트15 끔), 나머지는 낱값 줄(비트15 켬). 끝 0xffff"""
    out = bytearray(); i = 0
    while i < len(px):
        if px[i] == 0:
            j = i
            while j < len(px) and px[j] == 0 and j - i < 0x7000: j += 1
            out += struct.pack('<H', j - i)
        else:
            j = i
            while j < len(px) and px[j] != 0 and j - i < 0x7000: j += 1
            out += struct.pack('<H', 0x8000 | (j - i)) + bytes(px[i:j])
        i = j
    out += struct.pack('<H', 0xffff)
    return bytes(out)

def run(w, h, px, dw=0x23, dh=0x22):
    mu = Uc(UC_ARCH_ARM, UC_MODE_THUMB)
    mu.mem_map(0, 0x100000)
    mu.mem_write(TEXT_VA, RAW[TEXT_OFF:TEXT_OFF + TEXT_SIZE])
    mu.mem_map(0x1400000, 0x1000)
    BXLR_ARM = struct.pack('<I', 0xe12fff1e)
    for a in (0x1400498, 0x1400428, 0x14004a8):
        mu.mem_write(a, BXLR_ARM)
    HEAP, STUB, OBJ, STACK, END = 0x2000000, 0x3000000, 0x3100000, 0x3200000, 0x3300000
    mu.mem_map(HEAP, 0x100000); mu.mem_map(STUB, 0x1000); mu.mem_map(OBJ, 0x100000)
    mu.mem_map(STACK, 0x100000); mu.mem_map(END, 0x1000)
    heap = [HEAP]
    # 그림 객체: [img] = vtable · +0x18 = RLE 자료
    stubs = STUB
    def thumb_ret(val):
        nonlocal stubs
        a = stubs
        mu.mem_write(a, struct.pack('<HHHH', 0x4801, 0x4770, 0, 0) + struct.pack('<I', val))  # ldr r0,[pc,#0]; bx lr; pad; val
        stubs += 0x10
        return a | 1
    vt = OBJ + 0x100
    img = OBJ
    data = OBJ + 0x1000
    mu.mem_write(img, struct.pack('<I', vt))
    mu.mem_write(img + 0x18, struct.pack('<I', data))
    mu.mem_write(vt + 0x1c, struct.pack('<I', thumb_ret(w)))
    mu.mem_write(vt + 0x20, struct.pack('<I', thumb_ret(h)))
    mu.mem_write(data, rle(px))
    dst = OBJ + 0x200
    mu.mem_write(dst, b'\0' * 16)
    def hook(uc, addr, size, _):
        if addr == 0x1400498:
            n = uc.reg_read(UC_ARM_REG_R0)
            p = heap[0]; heap[0] += (n + 7) & ~3
            uc.mem_write(p, b'\0' * n)  # ⚠️ 0 으로 채운다고 둔다
            uc.reg_write(UC_ARM_REG_R0, p)
        elif addr == 0x1400428:
            p, v, n = (uc.reg_read(r) for r in (UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2))
            if n: uc.mem_write(p, bytes([v & 0xff]) * n)
    mu.hook_add(UC_HOOK_CODE, hook, begin=0x1400000, end=0x1400fff)
    sp = STACK + 0x80000
    sp -= 12
    mu.mem_write(sp, struct.pack('<III', 0, dw, dh))
    mu.reg_write(UC_ARM_REG_SP, sp)
    mu.reg_write(UC_ARM_REG_R0, OBJ + 0x800)
    mu.reg_write(UC_ARM_REG_R1, img)
    mu.reg_write(UC_ARM_REG_R2, dst)
    mu.reg_write(UC_ARM_REG_R3, 0)
    mu.reg_write(UC_ARM_REG_LR, END | 1)
    mu.emu_start(0x662dc | 1, END, count=50_000_000)
    W, H, P = struct.unpack('<III', mu.mem_read(dst, 12))
    return W, H, bytes(mu.mem_read(P, W * H))

if __name__ == '__main__':
    cases = [(77, 76, 1), (75, 76, 2), (76, 78, 3), (78, 76, 4), (70, 68, 5), (30, 20, 6), (10, 10, 7), (12, 17, 8)]
    out = []
    for w, h, seed in cases:
        W, H, b = run(w, h, lcg_image(w, h, seed))
        out.append({'width': w, 'height': h, 'seed': seed, 'outWidth': W, 'outHeight': H, 'hex': b.hex()})
        print(w, h, '→', W, H, file=sys.stderr)
    print(json.dumps(out, indent=1))
