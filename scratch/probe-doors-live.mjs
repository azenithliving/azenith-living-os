import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';
const BASE='https://azenith-living.vercel.app';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z]/.test(l)&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));
const b=await chromium.launch({headless:true});
const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
await p.goto(`${BASE}/gate/login`,{waitUntil:'domcontentloaded',timeout:60000});
await p.fill('input[type=email]',env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]',env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]',{timeout:30000});
const s=env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g,'').replace(/-/g,'').toUpperCase();
await p.fill('input[placeholder="000000"]',speakeasy.totp({secret:s,encoding:'base32',step:30,digits:6}));
await p.click('button[type=submit]');
for(let i=0;i<15&&!p.url().includes('/admin');i++) await p.waitForTimeout(2000);
for (const path of ['/api/admin/customers','/api/admin/agents/approval-queue','/api/analytics?period=30days','/api/admin/notifications','/api/admin/leads']) {
  const r = await p.evaluate(async (u)=>{ try { const res=await fetch(u); const t=await res.text(); return {st:res.status, len:t.length, head:t.slice(0,70)}; } catch(e){ return {err:String(e.message).slice(0,50)}; } }, path);
  console.log(`${path} -> ${JSON.stringify(r)}`);
}
await b.close();
