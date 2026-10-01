const dc=document.getElementById("drawCanvas"),oc=document.getElementById("overlayCanvas"),ctx=dc.getContext("2d"),octx=oc.getContext("2d");
const $=id=>document.getElementById(id),size=$("size"),alpha=$("alpha"),scale=$("scale"),preset=$("preset"),bpm=$("bpm"),vol=$("volume"),status=$("status");
const COLORS=[
{id:"red",label:"빨강",hex:"#ff5c6c",inst:"lead"},
{id:"yellow",label:"노랑",hex:"#ffd25e",inst:"bell"},
{id:"blue",label:"파랑",hex:"#64a7ff",inst:"piano"},
{id:"purple",label:"보라",hex:"#b184ff",inst:"pad"},
{id:"green",label:"초록",hex:"#59cc88",inst:"bass"},
{id:"white",label:"흰색",hex:"#ffffff",inst:"pluck"},
{id:"black",label:"검정",hex:"#171717",inst:"drum"}];
const INST={lead:"신스/리드",bell:"벨",piano:"피아노",pad:"패드",bass:"베이스",pluck:"플럭",drum:"드럼/퍼커션"};
const SCALES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],pentatonic:[0,2,4,7,9],japanese:[0,1,5,7,8],dream:[0,2,4,7,11],dark:[0,1,3,5,7,8,10],chaos:[0,1,2,3,4,5,6,7,8,9,10,11]};
const PRESETS={custom:{scale:"pentatonic"},dream:{scale:"dream"},night:{scale:"dark"},musicbox:{scale:"major"},piano:{scale:"minor"}};
let mode="draw",brush="pen",color="red",drawing=false,last=null,loopRegion=null,startSel=null,tempSel=null;
let undoStack=[],redoStack=[],audioReady=false,audio={},timer=null,playData=null,scanX=0,active={};
function msg(t){status.innerHTML=t}
function bg(){ctx.fillStyle="#fbfbfe";ctx.fillRect(0,0,dc.width,dc.height)}
function snap(){undoStack.push(dc.toDataURL());if(undoStack.length>30)undoStack.shift();redoStack=[]}
function restore(src){let i=new Image();i.onload=()=>{ctx.clearRect(0,0,dc.width,dc.height);ctx.drawImage(i,0,0);overlay()};i.src=src}
function undo(){if(undoStack.length<2)return;redoStack.push(undoStack.pop());restore(undoStack.at(-1))}
function redo(){if(!redoStack.length)return;let x=redoStack.pop();undoStack.push(x);restore(x)}
function pos(e){let r=dc.getBoundingClientRect(),p=e.touches?e.touches[0]:e;return{x:(p.clientX-r.left)*dc.width/r.width,y:(p.clientY-r.top)*dc.height/r.height}}
function rgb(h){h=h.slice(1);return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4),16)}}
function current(){return COLORS.find(c=>c.id===color)}
function drawLine(a,b){let c=current(),r=rgb(c.hex),s=+size.value,A=+alpha.value;ctx.save();
if(mode==="erase"){ctx.globalCompositeOperation="destination-out";ctx.lineWidth=s+8;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();return}
if(brush==="spray"){for(let n=0;n<Math.max(30,s*4);n++){let t=Math.random(),x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,ang=Math.random()*Math.PI*2,rad=Math.random()*s;ctx.fillStyle=`rgba(${r.r},${r.g},${r.b},${A*.18})`;ctx.beginPath();ctx.arc(x+Math.cos(ang)*rad,y+Math.sin(ang)*rad,Math.max(1,s*.12),0,Math.PI*2);ctx.fill()}ctx.restore();return}
ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=brush==="highlighter"?s*1.5:s;ctx.strokeStyle=`rgba(${r.r},${r.g},${r.b},${brush==="highlighter"?A*.3:A})`;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore()}
function overlay(x=null,w=0){octx.clearRect(0,0,oc.width,oc.height);if(loopRegion){octx.setLineDash([8,6]);octx.strokeStyle="#8d7cf5";octx.strokeRect(loopRegion.x,loopRegion.y,loopRegion.w,loopRegion.h);octx.setLineDash([])}if(tempSel){octx.setLineDash([8,6]);octx.strokeStyle="#51a9ff";octx.strokeRect(tempSel.x,tempSel.y,tempSel.w,tempSel.h);octx.setLineDash([])}if(x!==null){octx.fillStyle="#65bfff35";octx.fillRect(x,0,w,oc.height);octx.strokeStyle="#168cf0";octx.beginPath();octx.moveTo(x,0);octx.lineTo(x,oc.height);octx.stroke()}}
function midi(y){let sc=SCALES[scale.value],norm=1-y/dc.height,d=Math.round(norm*23),oct=Math.floor(d/sc.length);return 48+oct*12+sc[d%sc.length]}
async function initAudio(){if(audioReady)return;await Tone.start();let master=new Tone.Volume(+vol.value).toDestination(),comp=new Tone.Compressor(-22,2.2).connect(master),filter=new Tone.Filter(5200,"lowpass").connect(comp),rev=new Tone.Reverb({decay:5.2,wet:.28}).connect(filter);function bus(n){n.connect(filter);n.connect(rev);return n}
audio={master,lead:bus(new Tone.PolySynth(Tone.Synth,{oscillator:{type:"triangle"},envelope:{attack:.04,decay:.2,sustain:.16,release:.35}})),bell:bus(new Tone.PolySynth(Tone.Synth,{oscillator:{type:"sine"},envelope:{attack:.01,decay:.28,sustain:.03,release:.75}})),piano:bus(new Tone.PolySynth(Tone.Synth,{oscillator:{type:"sine"},envelope:{attack:.01,decay:.34,sustain:.1,release:.65}})),pad:bus(new Tone.PolySynth(Tone.Synth,{oscillator:{type:"sine"},envelope:{attack:.25,decay:.22,sustain:.42,release:1.8}})),pluck:bus(new Tone.PolySynth(Tone.Synth,{oscillator:{type:"sine"},envelope:{attack:.005,decay:.12,sustain:.02,release:.22}})),bass:bus(new Tone.MonoSynth({oscillator:{type:"triangle"},envelope:{attack:.03,decay:.24,sustain:.3,release:.38}})),drum:new Tone.NoiseSynth({noise:{type:"pink"},envelope:{attack:.002,decay:.14,sustain:0}}).connect(filter)};audioReady=true}
function mapping(){let m={};COLORS.forEach(c=>m[c.id]=$("map-"+c.id).value);return m}
async function live(p){if(!$("liveToggle").checked||mode!=="draw")return;await initAudio();let ins=mapping()[color],n=Tone.Frequency(midi(p.y),"midi").toNote();if(ins==="drum")audio.drum.triggerAttackRelease("32n");else if(ins==="bass")audio.bass.triggerAttackRelease(Tone.Frequency(midi(p.y)-12,"midi").toNote(),"8n");else audio[ins].triggerAttackRelease(n,brush==="highlighter"?"8n":"16n")}
function nearest(r,g,b){let best=null,d=1e9;for(let c of COLORS){let q=rgb(c.hex),x=Math.hypot(r-q.r,g-q.g,b-q.b);if(x<d){d=x;best=c.id}}return d<150?best:null}
function step(){if(!playData)return;let {img,region,loop}=playData,m=mapping(),groups={lead:new Set(),bell:new Set(),piano:new Set(),pad:new Set(),pluck:new Set()},bassNote=null,dr=false;
for(let x=scanX;x<Math.min(scanX+8,region.x+region.w);x+=2)for(let y=region.y;y<region.y+region.h;y+=5){let i=(y*dc.width+x)*4,r=img.data[i],g=img.data[i+1],b=img.data[i+2],a=img.data[i+3];if(a<10||Math.hypot(r-251,g-251,b-254)<15)continue;let id=nearest(r,g,b);if(!id)continue,ins=m[id];if(ins==="drum")dr=true;else if(ins==="bass")bassNote=midi(y)-12;else groups[ins].add(midi(y))}
overlay(scanX,8);for(let ins of ["lead","bell","piano","pad","pluck"]){let now=[...groups[ins]].slice(0,4).map(n=>Tone.Frequency(n,"midi").toNote());if(now.length)audio[ins].triggerAttackRelease(now,"16n")}if(bassNote!==null)audio.bass.triggerAttackRelease(Tone.Frequency(bassNote,"midi").toNote(),"16n");if(dr)audio.drum.triggerAttackRelease("32n");scanX+=8;if(scanX>=region.x+region.w){if(loop)scanX=region.x;else stop()}}
async function play(loop=false){await initAudio();stop();let region=loop?loopRegion:{x:0,y:0,w:dc.width,h:dc.height};if(!region){msg("먼저 루프 영역을 지정해 줘.");return}playData={img:ctx.getImageData(0,0,dc.width,dc.height),region,loop};scanX=region.x;timer=setInterval(step,(60000/(+bpm.value||120))/4)}
function stop(){if(timer)clearInterval(timer);timer=null;playData=null;overlay()}
function setMode(m){mode=m;["draw","erase","select"].forEach(x=>$(x+"Mode").classList.toggle("active",x===m))}
dc.addEventListener("pointerdown",e=>{e.preventDefault();let p=pos(e);if(mode==="select"){startSel=p;tempSel={x:p.x,y:p.y,w:0,h:0};overlay();return}snap();drawing=true;last=p;drawLine({x:p.x-.1,y:p.y-.1},p);live(p)});
dc.addEventListener("pointermove",e=>{let p=pos(e);if(mode==="select"&&startSel){tempSel={x:Math.min(startSel.x,p.x),y:Math.min(startSel.y,p.y),w:Math.abs(startSel.x-p.x),h:Math.abs(startSel.y-p.y)};overlay();return}if(!drawing)return;drawLine(last,p);last=p;live(p)});
window.addEventListener("pointerup",()=>{if(mode==="select"&&tempSel&&tempSel.w>8&&tempSel.h>8){loopRegion=tempSel;tempSel=null;startSel=null;overlay()}drawing=false;last=null});
$("drawMode").onclick=()=>setMode("draw");$("eraseMode").onclick=()=>setMode("erase");$("selectMode").onclick=()=>setMode("select");
document.querySelectorAll(".brush").forEach(b=>b.onclick=()=>{document.querySelectorAll(".brush").forEach(x=>x.classList.remove("active"));b.classList.add("active");brush=b.dataset.brush});
$("play").onclick=()=>play(false);$("loop").onclick=()=>play(true);$("stop").onclick=stop;$("undo").onclick=undo;$("redo").onclick=redo;$("clear").onclick=()=>{stop();bg();loopRegion=null;snap();overlay()};
vol.oninput=()=>{if(audioReady)audio.master.volume.rampTo(+vol.value,.05)};
preset.onchange=()=>{let p=PRESETS[preset.value];if(p)scale.value=p.scale};
window.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"&&!e.shiftKey){e.preventDefault();undo()}else if(((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y")||((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="z")){e.preventDefault();redo()}});
function build(){let pal=$("palette"),map=$("mapping"),leg=$("legend");COLORS.forEach((c,i)=>{let b=document.createElement("button");b.innerHTML=`<span class="dot" style="background:${c.hex}"></span>${c.label}`;if(i===0)b.classList.add("active");b.onclick=()=>{[...pal.children].forEach(x=>x.classList.remove("active"));b.classList.add("active");color=c.id};pal.appendChild(b);let row=document.createElement("label");row.textContent=c.label+" ";let s=document.createElement("select");s.id="map-"+c.id;Object.entries(INST).forEach(([v,l])=>{let o=new Option(l,v,v===c.inst,v===c.inst);s.add(o)});row.appendChild(s);map.appendChild(row);let x=document.createElement("span");x.textContent=c.label+" → "+INST[c.inst];leg.appendChild(x)})}
build();bg();snap();setMode("draw");