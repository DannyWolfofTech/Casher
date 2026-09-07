"""Render Casher's 24-second social ad. Requires Pillow, NumPy and FFmpeg."""
from pathlib import Path
import math, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent
W, H, FPS, DURATION = 1080, 1920, 24, 24
CREAM, NAVY, GREEN = '#F5F0E7', '#1A237E', '#1B7449'
MUTED, LINE = '#72758D', '#DEDDD9'
FONT = Path('C:/Windows/Fonts')
def font(size, kind='sans'):
    return ImageFont.truetype(str(FONT / {'sans':'segoeui.ttf','bold':'segoeuib.ttf','serif':'georgia.ttf','italic':'georgiai.ttf'}[kind]),size)
F = {(s,k):font(s,k) for s in [24,28,30,32,36,40,44,48,54,60,64,72,82,88,96,110,138,158] for k in ['sans','bold','serif','italic']}
def ease(x):
    x=max(0,min(1,x)); return 1-(1-x)**3
def txt(d, x,y,text,size=36,fill=NAVY,kind='sans',anchor=None):
    d.text((x,y),text,font=F[size,kind],fill=fill,anchor=anchor)
def rr(d,box,fill='white',r=28,outline=None,width=2):
    d.rounded_rectangle(tuple(map(int,box)),radius=r,fill=fill,outline=outline,width=width)
def title(d,lines,y=310,fill=NAVY,size=96):
    for i,line in enumerate(lines): txt(d,88,y+i*(size+12),line,size,fill,'serif')
def pill(d,text,x,y,w,fill=GREEN,fg='white'):
    rr(d,(x,y,x+w,y+76),fill,38); txt(d,x+w/2,y+38,text,30,fg,'bold','mm')

def render(t):
    scene=0 if t<4 else 1 if t<9 else 2 if t<14 else 3 if t<19 else 4
    start=[0,4,9,14,19][scene]; u=t-start
    dark=scene==4
    im=Image.new('RGB',(W,H),NAVY if dark else CREAM); d=ImageDraw.Draw(im)
    fg=CREAM if dark else NAVY
    # Quiet editorial framing, generous social-platform safe margins.
    txt(d,88,132,'Casher',54,fg,'italic')
    txt(d,992,166,'YOUR MONEY. CLEARER.',24,fg,'bold','rs')
    d.line((88,226,992,226),fill='#4B5397' if dark else LINE,width=2)
    if scene==0:
        title(d,['Still paying','for that?'],330,size=110)
        txt(d,90,620,'Small payments. Easy to miss.',36,MUTED)
        labels=[('STREAMING','£12.99'),('FITNESS','£24.00'),('SOFTWARE','£8.99')]
        for i,(label,amount) in enumerate(labels):
            p=ease((u-.25-i*.18)/.8); x=88+int((1-p)*1100); y=790+i*200+int(math.sin(t*1.7+i)*8)
            rr(d,(x+6,y+10,x+910,y+165),'#E6E1DA')
            rr(d,(x,y,x+904,y+155))
            txt(d,x+38,y+33,label,28,MUTED,'bold')
            txt(d,x+865,y+75,amount,60,NAVY,'serif','rm')
            txt(d,x+38,y+86,'Monthly payment',30,NAVY)
        txt(d,88,1510,'Get a clearer view with Casher.',40,NAVY)
        txt(d,88,1610,'Illustrative payments',24,MUTED)
    elif scene==1:
        pill(d,'01 / UPLOAD',88,285,250)
        title(d,['Your statement.','A clearer picture.'],410,size=88)
        y=760+int((1-ease(u/.7))*100)
        rr(d,(88,y,992,y+640),'white',40)
        rr(d,(380,y+62,700,y+355),CREAM,22)
        txt(d,540,y+140,'CSV',72,NAVY,'bold','mm')
        for j in range(4): d.line((425,y+207+j*28,650,y+207+j*28),fill=LINE,width=7)
        txt(d,540,y+422,'Upload a GBP bank CSV',40,NAVY,'bold','mm')
        rr(d,(175,y+492,905,y+506),'#E7EBE7',7)
        p=ease((u-.6)/2)
        if p>0: rr(d,(175,y+492,175+730*p,y+506),GREEN,7)
        txt(d,540,y+557,'Your transaction data, organised.',30,MUTED,'sans','mm')
        txt(d,88,1510,'No bank password needed.',40,NAVY)
    elif scene==2:
        pill(d,'02 / UNDERSTAND',88,285,340)
        title(d,['See where','your money goes.'],410,size=88)
        rr(d,(88,760,992,1415),'white',40)
        txt(d,130,805,'SPENDING BY CATEGORY',28,MUTED,'bold')
        cats=[('Shopping',320,GREEN),('Food & drink',180,NAVY),('Travel',95,'#727AB1'),('Entertainment',65,'#A2BDAA')]
        for i,(label,val,col) in enumerate(cats):
            y=885+i*120; p=ease((u-.3-i*.12)/1.1)
            txt(d,130,y,label,32,NAVY)
            txt(d,950,y,f'£{int(val*p)}',32,NAVY,'bold','ra')
            rr(d,(130,y+58,950,y+78),'#ECEDE9',10)
            if p>0: rr(d,(130,y+58,130+820*val/320*p,y+78),col,10)
        txt(d,88,1510,'Less guesswork. More clarity.',40,NAVY)
        txt(d,88,1610,'Illustrative data and visualisation',24,MUTED)
    elif scene==3:
        pill(d,'03 / REVIEW',88,285,250)
        title(d,['Spot the repeats.','Choose what stays.'],410,size=82)
        for i,(name,price) in enumerate([('Streaming','£12.99'),('Fitness','£24.00'),('Software','£8.99')]):
            y=760+i*200+int((1-ease((u-i*.15)/.7))*90)
            rr(d,(88,y,992,y+170),'white',28)
            txt(d,126,y+27,name,40,NAVY,'bold')
            txt(d,126,y+98,'Possible recurring payment',28,MUTED)
            txt(d,947,y+47,price,44,NAVY,'serif','ra')
            txt(d,947,y+109,'Review',28,GREEN,'bold','ra')
        txt(d,88,1438,'Find subscriptions worth a second look.',36,NAVY)
        txt(d,88,1535,'Cancel unwanted services with the provider.',30,MUTED)
        txt(d,88,1610,'Illustrative payments and interface',24,MUTED)
    else:
        # A clean, held end card gives the destination time to register.
        txt(d,88,365,'Casher',158,CREAM,'italic')
        title(d,['Plug your','financial leaks.'],660,CREAM,96)
        d.line((88,947,300+520*ease(u/1.4),947),fill='#63CB91',width=8)
        txt(d,88,1035,'Upload. Understand. Review.',40,CREAM)
        rr(d,(88,1190,992,1335),GREEN,72)
        txt(d,540,1261,'Try Casher',48,'white','bold','mm')
        txt(d,540,1440,'trycasher.com',60,CREAM,'sans','mm')
        txt(d,540,1550,'Start with your bank CSV.',32,'#CBD0EC','sans','mm')
    # Five subtle chapter indicators, held within the lower safe area.
    for i in range(5): rr(d,(88+i*184,1720,256+i*184,1725),('#63CB91' if dark else GREEN) if i==scene else ('#4B5397' if dark else LINE),2)
    # Smooth fades through the brand background at each scene boundary.
    end=[4,9,14,19,24][scene]
    alpha=min(1,u/.20,(end-t)/.18) if scene<4 else min(1,u/.20)
    if alpha<1: im=Image.blend(Image.new('RGB',(W,H),NAVY if dark else CREAM),im,max(0,alpha))
    return im

def music():
    sr=48000; a=np.zeros((sr*DURATION,2),dtype=np.float64)
    rng=np.random.default_rng(47)
    def add(sig,start,pan=0):
        n=int(start*sr); size=min(len(sig),len(a)-n)
        if size>0:
            a[n:n+size,0]+=sig[:size]*(.8-.2*pan)
            a[n:n+size,1]+=sig[:size]*(.8+.2*pan)
    # Original gentle electric-piano arpeggio; no samples or licensed music.
    chords=[[57,60,64,67],[53,57,60,64],[48,55,60,64],[55,59,62,67]]
    for beat in range(40):
        start=beat*.6; chord=chords[(beat//10)%4]
        for half in range(2):
            note=chord[(beat*2+half)%4]+12; f=440*2**((note-69)/12)
            tm=np.arange(int(sr*1.8))/sr
            env=(1-np.exp(-tm*80))*np.exp(-tm*3.4)
            sig=.075*env*(np.sin(2*np.pi*f*tm)+.22*np.sin(2*np.pi*f*2*tm))
            add(sig,start+half*.3,(-1)**half*.6)
        tm=np.arange(int(sr*.23))/sr
        add(.095*np.sin(2*np.pi*(48*tm+3*(1-np.exp(-tm*25))))*np.exp(-tm*18),start)
        tm=np.arange(int(sr*.07))/sr
        add(.017*rng.normal(size=len(tm))*np.exp(-tm*65),start+.3,.4)
    ramp=np.minimum(np.arange(len(a))/sr/1.2,1)*np.minimum((len(a)-np.arange(len(a)))/sr/1.6,1)
    a*=ramp[:,None]; a=np.clip(a,-.95,.95)
    with wave.open(str(OUT/'casher-original-music.wav'),'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(sr); f.writeframes((a*32767).astype('<i2').tobytes())

if __name__=='__main__':
    music()
    cmd=['ffmpeg','-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(OUT/'casher-original-music.wav'),'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-t',str(DURATION),str(OUT/'casher-social-vertical.mp4')]
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=open(OUT/'render.log','w'))
    for n in range(FPS*DURATION):
        p.stdin.write(render(n/FPS).tobytes())
        if n%96==0: print(f'Rendered {n//FPS}/{DURATION}s',flush=True)
    p.stdin.close()
    if p.wait(): raise RuntimeError('FFmpeg failed; see render.log')
    samples=[2,6.5,11.5,16.5,22]
    sheet=Image.new('RGB',(360*5,640))
    for i,t in enumerate(samples): sheet.paste(render(t).resize((360,640),Image.Resampling.LANCZOS),(i*360,0))
    sheet.save(OUT/'storyboard.jpg',quality=92)
    render(22).save(OUT/'casher-cover.png')
    print('Video, cover and storyboard ready.',flush=True)
