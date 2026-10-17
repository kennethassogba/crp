from PIL import Image,ImageDraw
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
for size in [192,512]:
 im=Image.new('RGB',(size,size),'#6253c3')
 mark=Image.new('RGBA',(size,size))
 d=ImageDraw.Draw(mark)
 for x,y,h in [(0.28,.43,.30),(.46,.25,.48),(.64,.34,.39)]:d.rounded_rectangle((int(x*size),int(y*size),int((x+.1)*size),int((y+h)*size)),radius=int(size*.035),fill='white')
 mark=mark.rotate(16,resample=Image.Resampling.BICUBIC)
 im.paste(mark,mask=mark)
 im.save(root/'public'/f'icon-{size}.png')
(root/'public'/'docs').mkdir(exist_ok=True)
shutil.copy(root/'docs'/'data-access.json',root/'public'/'docs'/'data-access.json')
