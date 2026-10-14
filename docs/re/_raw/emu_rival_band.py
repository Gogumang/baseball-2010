import struct, sys, collections
PCS=collections.deque(maxlen=60)
from unicorn import *
from unicorn.arm_const import *

PATH='/Users/evan123/Desktop/code/baseball-2010/base/work/jar/binary.mod'
RAW=open(PATH,'rb').read()
TEXT_VA, TEXT_OFF, TEXT_SIZE = 0x1000, 0x34, 0xd9ac8
DATA_VA, DATA_OFF, DATA_SIZE = 0x1400000, 0x101d4c, 0x998

STOP=0x3000000
SCENE=0x4000000
GC=0x4100000
HEAP=0x5000000
SKIN=0x4200000
LOGO=0x4300000
FAKEVT=0x4400000
STACK=0x6000000

def run(frame, W=240, H=320, verbose=False):
    mu=Uc(UC_ARCH_ARM, UC_MODE_THUMB)
    mu.mem_map(0, 0x100000)
    mu.mem_write(TEXT_VA, RAW[TEXT_OFF:TEXT_OFF+TEXT_SIZE])
    mu.mem_map(0x1400000, 0x200000)
    mu.mem_write(DATA_VA, RAW[DATA_OFF:DATA_OFF+DATA_SIZE])
    mu.mem_map(STOP, 0x1000)
    for base in (SCENE, GC, SKIN, LOGO, FAKEVT):
        mu.mem_map(base, 0x10000)
    mu.mem_map(HEAP, 0x100000)
    mu.mem_map(STACK-0x10000, 0x20000)
    w32=lambda a,v: mu.mem_write(a, struct.pack('<I', v & 0xffffffff))
    r32=lambda a: struct.unpack('<I', mu.mem_read(a,4))[0]
    s32=lambda a: struct.unpack('<i', mu.mem_read(a,4))[0]
    w32(0x1400070, GC); w32(GC+8, GC+0x100); w32(GC+0x100, 0x1234)
    w32(0x1552cfc, SKIN)
    w32(0x15606f4, (H-290)>>1)
    w32(SCENE+0x194c, frame)
    w32(SCENE+0x1950, LOGO)
    w32(LOGO, FAKEVT)
    # fake vtable: [4] = delete stub
    for k in range(0, 0x100, 4): w32(FAKEVT+k, STOP+0x100+k)
    heap=[HEAP]
    log=[]
    polys={}
    def ret(v=None):
        if v is not None: mu.reg_write(UC_ARM_REG_R0, v & 0xffffffff)
        mu.reg_write(UC_ARM_REG_PC, mu.reg_read(UC_ARM_REG_LR))
    def stack(i):
        return s32(mu.reg_read(UC_ARM_REG_SP)+4*i)
    def hook(uc, addr, size, ud):
        PCS.append(addr)
        r=[mu.reg_read(x) for x in (UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2,UC_ARM_REG_R3)]
        if addr == STOP:
            uc.emu_stop(); return
        if STOP+0x100 <= addr < STOP+0x200:
            log.append(('vt', hex(addr-STOP-0x100), hex(r[0]), [hex(x) for x in r[1:]], hex(mu.reg_read(UC_ARM_REG_LR)))); ret(0); return
        if addr == 0x1238:
            p=heap[0]; heap[0]+= (r[0]+15)&~15; ret(p); return
        if addr == 0x75b18:
            w32(r[0], FAKEVT); w32(r[0]+0x7c, 0xffffff); w32(r[0]+0x80, 0xff0000); ret(r[0]); return
        if addr == 0x75ba4:
            n=r[2]&0xff; pts=[(s32(r[1]+8*i), s32(r[1]+8*i+4)) for i in range(n)]
            polys[r[0]]=pts; ret(1); return
        if addr == 0x75e30:
            log.append(('poly', polys.get(r[0]), hex(r32(r[0]+0x80)), hex(r32(r[0]+0x7c)))); ret(); return
        if addr == 0x6a904:
            log.append(('line', (s32ofs(r[1]), s32ofs(r[2]), s32ofs(r[3]), stack(0)), hex(stack(1)&0xffffffff))); ret(); return
        if addr == 0xbb91c:
            log.append(('img', [hex(x) for x in r], [stack(i) for i in range(6)])); ret(); return
        if addr == 0xcb618:
            mu.mem_write(r[0], bytes([r[1]&0xff])*r[2]); ret(r[0]); return
        if bytes(mu.mem_read(addr,4)) == b'\x04\xe0\x2d\xe5' and not (0x1400000 <= addr < 0x1401000):
            log.append(('api', hex(addr), hex(mu.reg_read(UC_ARM_REG_LR)), [hex(x) for x in r])); ret(0); return
        if 0x1400000 <= addr < 0x1401000 and addr not in (0x14008b8, 0x14008c8, 0x1400748):
            log.append(('plat', hex(addr), hex(mu.reg_read(UC_ARM_REG_LR)), [hex(x) for x in r])); ret(0); return
        if 0x1400000 <= addr < 0x1401000:
            if addr == 0x14008b8: ret(W); return
            if addr == 0x14008c8: ret(H); return
            if addr == 0x1400748: ret((r[0]&0xff)<<16 | (r[1]&0xff)<<8 | (r[2]&0xff)); return
            log.append(('plat', hex(addr), [hex(x) for x in r])); ret(0); return
    def s32ofs(v): return struct.unpack('<i', struct.pack('<I', v & 0xffffffff))[0]
    mu.hook_add(UC_HOOK_CODE, hook)
    mu.reg_write(UC_ARM_REG_SP, STACK)
    mu.reg_write(UC_ARM_REG_LR, STOP|1)
    mu.reg_write(UC_ARM_REG_R0, SCENE)
    try:
        mu.emu_start(0x3b80c|1, STOP, count=3000000)
    except UcError as e:
        print('ERR', e, hex(mu.reg_read(UC_ARM_REG_PC)))
    return log, s32(SCENE+0x194c)

if __name__=='__main__':
    for f in [int(a) for a in sys.argv[1:]] or range(0, 11):
        log, after = run(f)
        print('=== frame', f, '→', after)
        for e in log: print('  ', e)
