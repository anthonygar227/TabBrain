import struct, zlib, math

def read_png(path):
    with open(path, 'rb') as f:
        data = f.read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos = 8; chunks = []
    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos+4])[0]
        chunks.append((data[pos+4:pos+8], data[pos+8:pos+8+length]))
        pos += 12 + length
    ihdr = [c for c in chunks if c[0]==b'IHDR'][0][1]
    w,h,bd,ct = struct.unpack('>IIBB', ihdr[:10])
    idat = b''.join(c[1] for c in chunks if c[0]==b'IDAT')
    raw = zlib.decompress(idat)
    if ct==6: bpp=4
    elif ct==2: bpp=3
    elif ct==4: bpp=2
    else: bpp=1
    stride=w*bpp; pixels=[]; row_pos=0; prev_row=bytes(stride)
    for y in range(h):
        filt=raw[row_pos]; row_data=bytearray(raw[row_pos+1:row_pos+1+stride])
        if filt==1:
            for i in range(stride):
                a=row_data[i-bpp] if i>=bpp else 0; row_data[i]=(row_data[i]+a)&0xFF
        elif filt==2:
            for i in range(stride): row_data[i]=(row_data[i]+prev_row[i])&0xFF
        elif filt==3:
            for i in range(stride):
                a=row_data[i-bpp] if i>=bpp else 0; row_data[i]=(row_data[i]+(a+prev_row[i])//2)&0xFF
        elif filt==4:
            for i in range(stride):
                a=row_data[i-bpp] if i>=bpp else 0; b=prev_row[i]; c=prev_row[i-bpp] if i>=bpp else 0
                p=a+b-c; pa,pb,pc=abs(p-a),abs(p-b),abs(p-c)
                pr=a if(pa<=pb and pa<=pc) else(b if pb<=pc else c)
                row_data[i]=(row_data[i]+pr)&0xFF
        prev_row=bytes(row_data)
        for x in range(w):
            off=x*bpp
            if bpp==4: pixels.append((row_data[off],row_data[off+1],row_data[off+2],row_data[off+3]))
            elif bpp==3: pixels.append((row_data[off],row_data[off+1],row_data[off+2],255))
            elif bpp==2: pixels.append((row_data[off],row_data[off],row_data[off],row_data[off+1]))
            else: pixels.append((row_data[off],row_data[off],row_data[off],255))
        row_pos+=1+stride
    return w,h,pixels

def resize(sw,sh,spx,dw,dh):
    dst=[]
    for dy in range(dh):
        sy=dy*(sh-1)/max(1,dh-1); y0=int(sy); y1=min(y0+1,sh-1); fy=sy-y0
        for dx in range(dw):
            sx=dx*(sw-1)/max(1,dw-1); x0=int(sx); x1=min(x0+1,sw-1); fx=sx-x0
            p00=spx[y0*sw+x0];p10=spx[y0*sw+x1];p01=spx[y1*sw+x0];p11=spx[y1*sw+x1]
            r=int(p00[0]*(1-fx)*(1-fy)+p10[0]*fx*(1-fy)+p01[0]*(1-fx)*fy+p11[0]*fx*fy)
            g=int(p00[1]*(1-fx)*(1-fy)+p10[1]*fx*(1-fy)+p01[1]*(1-fx)*fy+p11[1]*fx*fy)
            b=int(p00[2]*(1-fx)*(1-fy)+p10[2]*fx*(1-fy)+p01[2]*(1-fx)*fy+p11[2]*fx*fy)
            a=int(p00[3]*(1-fx)*(1-fy)+p10[3]*fx*(1-fy)+p01[3]*(1-fx)*fy+p11[3]*fx*fy)
            dst.append((min(255,max(0,r)),min(255,max(0,g)),min(255,max(0,b)),min(255,max(0,a))))
    return dst

def write_png(path,w,h,pixels):
    def chunk(ct,d):
        c=ct+d; return struct.pack('>I',len(d))+c+struct.pack('>I',zlib.crc32(c)&0xffffffff)
    raw=b''
    for y in range(h):
        raw+=b'\x00'
        for x in range(w): raw+=bytes(pixels[y*w+x])
    data=(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+
          chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
    with open(path,'wb') as f: f.write(data)
    return len(data)

src = 'c:/Users/Anthony/Desktop/TabBrain/artifical-intelligence (1).png'
sw,sh,spx = read_png(src)
print(f'Source: {sw}x{sh}')

# --- Extension icons: white brain on orange circle ---
for sz in [16, 48, 128]:
    brain_sz = max(1, int(sz * 0.72))
    resized = resize(sw, sh, spx, brain_sz, brain_sz)
    pad = (sz - brain_sz) // 2

    cx, cy = sz/2, sz/2
    radius = sz/2

    final = []
    for y in range(sz):
        for x in range(sz):
            dist = math.sqrt((x+0.5-cx)**2 + (y+0.5-cy)**2)
            if dist > radius:
                final.append((0,0,0,0))
                continue

            # Orange background gradient
            t = ((x/sz)+(y/sz))/2
            bg_r = min(255, int(230 + t*20))
            bg_g = min(255, int(130 + t*20))
            bg_b = min(255, int(52 + t*15))

            edge_alpha = min(1.0, max(0.0, radius - dist))

            # Brain pixel — render dark source pixels as white
            bx = x - pad
            by = y - pad
            if 0 <= bx < brain_sz and 0 <= by < brain_sz:
                sr, sg, sb, sa = resized[by*brain_sz+bx]
                if sa > 10:
                    darkness = 1.0 - (sr+sg+sb)/(3*255)
                    brain_alpha = (sa/255) * darkness
                    fr = int(bg_r*(1-brain_alpha) + 255*brain_alpha)
                    fg = int(bg_g*(1-brain_alpha) + 255*brain_alpha)
                    fb = int(bg_b*(1-brain_alpha) + 255*brain_alpha)
                else:
                    fr, fg, fb = bg_r, bg_g, bg_b
            else:
                fr, fg, fb = bg_r, bg_g, bg_b

            fa = int(edge_alpha * 255)
            final.append((min(255,fr), min(255,fg), min(255,fb), min(255,fa)))

    nbytes = write_png(f'c:/Users/Anthony/Desktop/TabBrain/icons/icon{sz}.png', sz, sz, final)
    print(f'icon{sz}.png: {nbytes} bytes')

# --- Header icon: orange brain on transparent background (48px) ---
hsz = 48
resized = resize(sw, sh, spx, hsz, hsz)
# Accent color: #E8734A
accent_r, accent_g, accent_b = 232, 115, 74

header_pixels = []
for y in range(hsz):
    for x in range(hsz):
        sr, sg, sb, sa = resized[y*hsz+x]
        if sa > 10:
            darkness = 1.0 - (sr+sg+sb)/(3*255)
            fa = int(sa * darkness)
            header_pixels.append((accent_r, accent_g, accent_b, min(255, fa)))
        else:
            header_pixels.append((0, 0, 0, 0))

nbytes = write_png('c:/Users/Anthony/Desktop/TabBrain/icons/icon-header.png', hsz, hsz, header_pixels)
print(f'icon-header.png: {nbytes} bytes')

print('Done!')
