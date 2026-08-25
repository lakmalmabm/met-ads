import json, struct, io, os, sys
from PIL import Image
SRC, DST, LIMIT = sys.argv[1], sys.argv[2], int(sys.argv[3])
f=open(SRC,'rb'); struct.unpack('<III',f.read(12))
g=None; binoff=None
while True:
    h=f.read(8)
    if len(h)<8: break
    cl,ct=struct.unpack('<II',h)
    if ct==0x4E4F534A: g=json.loads(f.read(cl))
    else: binoff=f.tell(); f.seek(cl,1)
def vb(i):
    v=g['bufferViews'][i]; f.seek(binoff+v.get('byteOffset',0)); return f.read(v['byteLength'])
new={}
for im in g.get('images',[]):
    bv=im.get('bufferView')
    if bv is None or bv in new: continue
    raw=vb(bv); p=Image.open(io.BytesIO(raw)); w,h=p.size
    s=min(1.0, LIMIT/max(w,h))
    if s<1.0: p=p.resize((max(1,round(w*s)),max(1,round(h*s))), Image.LANCZOS)
    o=io.BytesIO()
    if im.get('mimeType')=='image/jpeg': p.convert('RGB').save(o,'JPEG',quality=92,optimize=True)
    else: p.save(o,'PNG',optimize=True)
    new[bv]=o.getvalue()
blobs=[];cur=0
for i,v in enumerate(g['bufferViews']):
    d=new.get(i) or vb(i); pad=(-len(d))%4
    v['byteOffset']=cur; v['byteLength']=len(d)
    blobs.append(d)
    if pad: blobs.append(b'\0'*pad)
    cur+=len(d)+pad
binary=b''.join(blobs); g['buffers']=[{'byteLength':len(binary)}]; f.close()
js=json.dumps(g,separators=(',',':')).encode(); js+=b' '*((-len(js))%4)
with open(DST,'wb') as o:
    o.write(struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(binary)))
    o.write(struct.pack('<II',len(js),0x4E4F534A)); o.write(js)
    o.write(struct.pack('<II',len(binary),0x004E4942)); o.write(binary)
print(f"{SRC} {os.path.getsize(SRC)/1e6:.1f}MB -> {DST} {os.path.getsize(DST)/1e6:.1f}MB  ({len(new)} images)")
