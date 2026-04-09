module.exports=[18622,(e,r,t)=>{r.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,r,t)=>{r.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,r,t)=>{r.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,r,t)=>{r.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},93695,(e,r,t)=>{r.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},21517,(e,r,t)=>{r.exports=e.x("http",()=>require("http"))},24836,(e,r,t)=>{r.exports=e.x("https",()=>require("https"))},88947,(e,r,t)=>{r.exports=e.x("stream",()=>require("stream"))},92509,(e,r,t)=>{r.exports=e.x("url",()=>require("url"))},6461,(e,r,t)=>{r.exports=e.x("zlib",()=>require("zlib"))},92097,(e,r,t)=>{r.exports=e.x("punycode",()=>require("punycode"))},98134,e=>{"use strict";let r=new(e.i(29642)).GoogleGenerativeAI(process.env.GEMINI_API_KEY||""),t={"luxury master bedroom":["desk","monitor","computer","office chair","office","workstation","filing cabinet","printer","scanner","office equipment","commercial space","meeting room","conference table","whiteboard","projector","office lighting","task lamp","nursery","crib","baby bed","playpen","changing table","person","people","human","man","woman","child","clutter","mess","disorganized","low quality","poor lighting","dark","grainy","blurry"],"bespoke walk-in closet":["bed","mattress","nightstand","bedside table","toilet","bidet","urinal","shower","bathtub","bathroom sink","vanity mirror with plumbing","towel rack","bathroom fixture","shower curtain","bath mat","sleeping area","bedroom furniture","person","people","human","man","woman","child","clutter","mess","disorganized","low quality","poor lighting","dark","grainy","blurry"],"luxury living room":["bed","bedroom furniture","mattress","kitchen stove","refrigerator","kitchen sink","dishwasher","kitchen counter","toilet","shower","bathtub","office desk","office chair","commercial space","retail space","restaurant","cafe","bar counter","kitchen appliance","cooking equipment","pantry shelf","person","people","human","man","woman","child","clutter","mess","disorganized","low quality","poor lighting","dark","grainy","blurry"],"modern high-end kitchen":["bed","sofa","living room","bedroom","bathroom","toilet","shower","bathtub","office","desk","dining room table","restaurant seating","cafe","commercial kitchen","industrial equipment","garage","workshop","tools","person","people","human","man","woman","child","clutter","mess","disorganized","low quality","poor lighting","dark","grainy","blurry"],"luxury home office":["bed","sofa","television","kitchen","stove","refrigerator","dining table","restaurant","cafe","bar","living room entertainment","game room","playroom","nursery","children's room","toys","play equipment","person","people","human","man","woman","child","clutter","mess","disorganized","low quality","poor lighting","dark","grainy","blurry"],"modern kids bedroom":["office desk","office chair","computer","monitor","workstation","kitchen","stove","refrigerator","adult furniture","formal dining","meeting room","conference room","commercial space","person","people","human","man","woman","adult","clutter","mess","disorganized","low quality","poor lighting","dark","grainy","blurry"],"luxury dining room":["bed","sofa","television","kitchen stove","refrigerator","office desk","computer","bathroom","toilet","shower","bathtub","living room entertainment","bedroom furniture","person","people","human","man","woman","child","clutter","mess","disorganized","low quality","poor lighting","dark","grainy","blurry"],"luxury interior design":["garage","workshop","tools","industrial equipment","storage unit","warehouse","commercial signage","retail display","restaurant kitchen","outdoor only","construction","renovation in progress","person","people","human","man","woman","child","clutter","mess","disorganized","low quality","poor lighting","dark","grainy","blurry"]},o={"luxury master bedroom":["prominent bed","mattress","headboard","bed frame"],"bespoke walk-in closet":["cabinetry","closet","wardrobe","hanging rods","shelving"],"luxury living room":["sofa","couch","seating area","lounge furniture"],"modern high-end kitchen":["kitchen island","countertop","cabinetry","appliance"],"luxury home office":["desk","office chair","workspace"],"modern kids bedroom":["bed","kids bed","play area"],"luxury dining room":["dining table","chairs","seating"],"luxury interior design":["open plan","spacious","architectural detail"]},a={Classic:["Industrial","Ultra-Modern","exposed pipes","concrete walls","metal beams","raw materials","exposed brick","ductwork","minimalist","Bohemian","Boho","macrame","wicker","rattan","beads","tapestry","eclectic mix"],Modern:["Ornate","Baroque","Victorian","heavy carvings","gold leaf","antique","frilly","floral patterns","traditional","ornamental","rococo"],Minimalist:["Cluttered","Busy patterns","Ornate","Heavy decoration","Maximalist","excess","too many objects","visual noise"],Industrial:["Soft curves","Pastel colors","Feminine","Delicate","Ornate details","frilly","lace","soft fabrics"],Scandinavian:["Dark heavy wood","Gothic","Baroque","Heavy patterns","Industrial metal","ornate","heavy ornamentation"],Bohemian:["Minimalist","Sterile","Corporate","Uniform","Monochromatic","rigid structure","too organized"],Contemporary:["Vintage","Retro","Rustic","Shabby chic","Outdated","dated design","old-fashioned"]};async function i(e,i,n){let s=Date.now();if(!process.env.GEMINI_API_KEY)return console.warn("[AI Filter] GEMINI_API_KEY not configured, returning all photos"),{approvedPhotos:e,rejectedCount:0,processingTime:0};if(0===e.length)return{approvedPhotos:[],rejectedCount:0,processingTime:0};try{let l=e.map(e=>e.src.small||e.src.medium||e.url),c=t[i]||[],d=a[n]||[],m=o[i]||[],p=`SYSTEM ROLE: You are a High-End Art Director for a luxury interior design firm. You have ZERO TOLERANCE for off-category elements.

EXTREME STRICTNESS PROTOCOL:

EXPLICIT REJECTION CRITERIA FOR "${i.toUpperCase()}":
${c.map(e=>`- ${e}`).join("\n")}

POSITIVE REQUIREMENTS - MUST HAVE for ${i}:
${m.map(e=>`- ${e}`).join("\n")}

STYLE MATCHING - ZERO TOLERANCE FOR CLASHES:
Request Style: "${n}"
FORBIDDEN STYLE ELEMENTS in this ${n} context:
${d.map(e=>`- ${e}`).join("\n")}

LOGICAL CHECK CHAIN - Follow this EXACTLY:
1. IDENTIFY: List every visible object, furniture piece, and architectural element in the image
2. BLACKLIST CHECK: If ANY object matches the blacklist above → IMMEDIATE REJECTION
3. POSITIVE CHECK: If ANY positive requirement is MISSING → REJECT (e.g., bedroom without prominent bed)
4. STYLE CHECK: If ANY element clashes with "${n}" aesthetic → IMMEDIATE REJECTION
5. CONFIDENCE: Only approve if you are 100% certain the image is a PERFECT "${n} ${i}"

TASK:
Analyze these ${e.length} images for a ${n} style ${i}.

Image URLs to analyze:
${l.map((e,r)=>`${r}: ${e}`).join("\n")}

MANDATORY OUTPUT FORMAT:
Return ONLY a JSON object. NO markdown, NO explanation, NO comments.

{
  "approvedIndices": [],
  "analysis": [
    {"index": 0, "objects": ["list all objects"], "verdict": "PASS or REJECT", "reason": "if rejected, specify which rule was violated (blacklist/missing_positive/style_clash)"},
    {"index": 1, "objects": ["list all objects"], "verdict": "PASS or REJECT", "reason": "if rejected, specify which rule was violated"}
  ]
}

CRITICAL RULES:
- If a Master Bedroom shows even a corner of a desk or monitor → REJECT
- If a Master Bedroom has NO prominent bed (only a sofa or chair) → REJECT
- If a Dressing Room shows a bed or toilet → REJECT  
- If a Dressing Room has NO cabinetry/wardrobe → REJECT
- If requesting 'Classic' and image has exposed pipes, Industrial, OR Boho elements → REJECT
- If requesting 'Modern' and image has Baroque or heavy carvings → REJECT
- If image contains people, clutter, mess, or low-quality lighting → REJECT
- If you are not 100% certain → REJECT
- It is BETTER to return an EMPTY ARRAY [] than include a "half-correct" image
- Approve ONLY images that are PERFECT matches

STRICT OUTPUT: Return JSON only. Empty approvedIndices if nothing passes.`,u=r.getGenerativeModel({model:"gemini-2.0-flash-lite"}),h=(await u.generateContent(p)).response.text().trim(),g=[];try{let r=h.match(/\{[\s\S]*\}/),t=r?r[0]:h,o=JSON.parse(t);Array.isArray(o.approvedIndices)&&(g=o.approvedIndices.filter(r=>"number"==typeof r&&r>=0&&r<e.length)),o.analysis&&Array.isArray(o.analysis)&&o.analysis.forEach(e=>{"REJECT"===e.verdict&&console.log(`[AI Filter] Rejected index ${e.index}: ${e.reason||"Zero-tolerance violation"}`)}),console.log("[AI Filter] Extreme Strictness Protocol complete:",{total:e.length,approved:g.length,rejected:e.length-g.length,roomType:i,style:n,strictness:"ZERO_TOLERANCE"})}catch(r){return console.error("[AI Filter] Failed to parse response:",h),{approvedPhotos:[],rejectedCount:e.length,processingTime:Date.now()-s}}let f=g.map(r=>e[r]),y=e.length-f.length;return{approvedPhotos:f,rejectedCount:y,processingTime:Date.now()-s}}catch(r){return console.error("[AI Filter] Gemini API error:",r),{approvedPhotos:[],rejectedCount:e.length,processingTime:Date.now()-s}}}e.s(["filterImagesWithAI",0,i])},36145,e=>{e.v(e=>Promise.resolve().then(()=>e(2808)))},64669,e=>{e.v(r=>Promise.all(["server/chunks/[externals]__05.c~58._.js","server/chunks/node_modules_ws_0mc1dis._.js"].map(r=>e.l(r))).then(()=>r(71247)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__05um6g_._.js.map