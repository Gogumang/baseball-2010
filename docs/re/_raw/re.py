#!/usr/bin/env python3
"""binary.mod 역분석 도우미.

  re.py dis <VA> [줄수]          Thumb 디스어셈 (기본 60줄). BL 대상·리터럴 풀 값도 풀어 보여 준다
  re.py func <VA>                <VA> 를 품은 함수 시작(push {.., lr})을 찾아 거기서부터 pop pc 까지 디스어셈
  re.py xref <VA>                <VA> 를 부르는 BL, 리터럴 풀에 <VA>(또는 VA|1) 을 담은 곳과 그 풀을 읽는 LDR
  re.py xval <값>                 리터럴 풀 안에서 32비트 상수 <값> 을 담은 곳과 읽는 LDR (주소 아닌 상수 찾기)
  re.py bytes <VA> [n]           hexdump (.text 또는 .data)
  re.py u8|s8|u16|s16|u32 <VA> <개수>   표 읽기
  re.py str <VA>                 CP949 문자열 (.data 0x1400000~ 또는 .text 안)
  re.py findstr <글자>            CP949 로 인코딩해 파일 전체에서 찾고 VA 를 알려 준다

주소 체계: .text VA = 파일오프셋 + 0xfcc (VA 0x1000~0xdaac8)
           .data VA 0x1400000 = 파일오프셋 0x101d4c (0x998 바이트), .bss 0x1500000~
BL 대상은 Thumb 이라 짝수 주소로 보여 준다.
"""
import re, struct, sys
from functools import lru_cache
from pathlib import Path
import capstone

BIN = Path(__file__).resolve().parents[0]
PATH = '/Users/evan123/Desktop/code/baseball-2010/base/work/jar/binary.mod'
RAW = open(PATH, 'rb').read()
TEXT_VA, TEXT_OFF, TEXT_SIZE = 0x1000, 0x34, 0xd9ac8
DATA_VA, DATA_OFF, DATA_SIZE = 0x1400000, 0x101d4c, 0x998

md = capstone.Cs(capstone.CS_ARCH_ARM, capstone.CS_MODE_THUMB)
md.detail = False


def off(va):
    if TEXT_VA <= va < TEXT_VA + TEXT_SIZE:
        return va - TEXT_VA + TEXT_OFF
    if DATA_VA <= va < DATA_VA + DATA_SIZE:
        return va - DATA_VA + DATA_OFF
    raise ValueError('주소 범위 밖: %#x' % va)


def rd(va, n):
    o = off(va)
    return RAW[o:o + n]


def lit(ins):
    """ldr rX, [pc, #imm] → (풀 주소, 값)"""
    m = re.match(r'(\w+), \[pc, #(-?0x[0-9a-f]+|-?\d+)\]', ins.op_str)
    if ins.mnemonic.startswith('ldr') and m:
        a = ((ins.address + 4) & ~3) + int(m.group(2), 0)
        try:
            return a, struct.unpack('<I', rd(a, 4))[0]
        except ValueError:
            return a, None
    return None


def dis(va, count=60, stop_at_pop=False):
    va &= ~1
    out = []
    pos = va
    while len(out) < count:
        code = rd(pos, 4)
        ins = next(md.disasm(code, pos, 1), None)
        if ins is None:
            out.append('%08x: %s  .hword' % (pos, rd(pos, 2).hex()))
            pos += 2
            continue
        note = ''
        l = lit(ins)
        if l:
            a, v = l
            if v is not None:
                note = '   ; [%#x] = %#x' % (a, v)
                if DATA_VA <= v < DATA_VA + DATA_SIZE:
                    s = cstr(v)
                    if s:
                        note += ' "%s"' % s
        # BL 는 32비트 두 반쪽 — capstone 이 합쳐 준다
        out.append('%08x: %-8s %-10s %s%s' % (ins.address, ins.bytes.hex(), ins.mnemonic, ins.op_str, note))
        pos += ins.size
        if stop_at_pop and (ins.mnemonic == 'pop' and 'pc' in ins.op_str):
            break
        if stop_at_pop and ins.mnemonic == 'bx' and ins.op_str == 'lr':
            break
    return out


def cstr(va, maxlen=200):
    try:
        b = rd(va, maxlen)
    except ValueError:
        return None
    b = b.split(b'\0')[0]
    try:
        s = b.decode('cp949')
    except UnicodeDecodeError:
        return None
    return s if s and all(c.isprintable() for c in s) else None


def func_start(va):
    """뒤로 가며 push {..., lr} 를 찾는다."""
    va &= ~1
    for p in range(va, max(TEXT_VA, va - 0x4000), -2):
        h = struct.unpack('<H', rd(p, 2))[0]
        if (h & 0xff00) == 0xb500:  # push {..., lr}
            return p
    return None


@lru_cache(None)
def all_bl():
    """모든 BL 호출 (호출지, 대상)."""
    res = []
    t = RAW[TEXT_OFF:TEXT_OFF + TEXT_SIZE]
    for i in range(0, len(t) - 3, 2):
        h1, h2 = struct.unpack_from('<HH', t, i)
        if (h1 & 0xf800) == 0xf000 and (h2 & 0xf800) == 0xf800:
            offh = h1 & 0x7ff
            if offh & 0x400:
                offh -= 0x800
            tgt = TEXT_VA + i + 4 + (offh << 12) + ((h2 & 0x7ff) << 1)
            res.append((TEXT_VA + i, tgt))
    return res


@lru_cache(None)
def pc_loads():
    """모든 ldr rX,[pc,#imm] → {풀주소: [명령주소...]}"""
    m = {}
    t = RAW[TEXT_OFF:TEXT_OFF + TEXT_SIZE]
    for i in range(0, len(t) - 1, 2):
        h = struct.unpack_from('<H', t, i)[0]
        if (h & 0xf800) == 0x4800:
            va = TEXT_VA + i
            a = ((va + 4) & ~3) + (h & 0xff) * 4
            m.setdefault(a, []).append(va)
    return m


def find_word(val):
    hits = []
    t = RAW[TEXT_OFF:TEXT_OFF + TEXT_SIZE]
    pat = struct.pack('<I', val)
    i = t.find(pat)
    while i >= 0:
        if i % 2 == 0:
            hits.append(TEXT_VA + i)
        i = t.find(pat, i + 1)
    d = RAW[DATA_OFF:DATA_OFF + DATA_SIZE]
    i = d.find(pat)
    while i >= 0:
        hits.append(DATA_VA + i)
        i = d.find(pat, i + 1)
    return hits


def main(a):
    cmd = a[0]
    if cmd == 'dis':
        print('\n'.join(dis(int(a[1], 0), int(a[2]) if len(a) > 2 else 60)))
    elif cmd == 'func':
        s = func_start(int(a[1], 0))
        print('; 함수 시작 추정 %#x' % s)
        print('\n'.join(dis(s, int(a[2]) if len(a) > 2 else 2000, stop_at_pop=True)))
    elif cmd in ('xref', 'xval'):
        v = int(a[1], 0)
        if cmd == 'xref':
            for src, tgt in all_bl():
                if tgt == (v & ~1):
                    print('BL   %#x  (함수 %#x)' % (src, func_start(src) or 0))
        vals = [v] if cmd == 'xval' else [v & ~1, v | 1]
        for val in sorted(set(vals)):
            for w in find_word(val):
                users = pc_loads().get(w, [])
                print('WORD %#x = %#x  ← ldr %s' % (w, val, ', '.join('%#x(함수 %#x)' % (u, func_start(u) or 0) for u in users) or '-'))
    elif cmd == 'bytes':
        va = int(a[1], 0); n = int(a[2], 0) if len(a) > 2 else 64
        b = rd(va, n)
        for i in range(0, n, 16):
            print('%08x: %s' % (va + i, b[i:i + 16].hex(' ')))
    elif cmd in ('u8', 's8', 'u16', 's16', 'u32', 's32'):
        va = int(a[1], 0); n = int(a[2], 0)
        f = {'u8': 'B', 's8': 'b', 'u16': 'H', 's16': 'h', 'u32': 'I', 's32': 'i'}[cmd]
        sz = struct.calcsize(f)
        print(list(struct.unpack('<%d%s' % (n, f), rd(va, n * sz))))
    elif cmd == 'str':
        print(cstr(int(a[1], 0), 400))
    elif cmd == 'findstr':
        pat = a[1].encode('cp949')
        i = RAW.find(pat)
        while i >= 0:
            if TEXT_OFF <= i < TEXT_OFF + TEXT_SIZE:
                print('text VA %#x' % (i - TEXT_OFF + TEXT_VA))
            elif DATA_OFF <= i < DATA_OFF + DATA_SIZE:
                print('data VA %#x' % (i - DATA_OFF + DATA_VA))
            else:
                print('file off %#x' % i)
            i = RAW.find(pat, i + 1)


if __name__ == '__main__':
    main(sys.argv[1:])
