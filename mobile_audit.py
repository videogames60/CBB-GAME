"""Phone-size audit: every main screen at 390x844 (an iPhone 14).
For each screen: how far the page scrolls sideways, and the widest offenders.
   python3 -m http.server 8765   (in the game folder)   then   python3 tests/mobile_audit.py"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/dynasty.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mshots")
MEASURE = """() => {
  const W = document.documentElement.clientWidth, doc = document.documentElement.scrollWidth, bad = [];
  const inScroller = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= W + 1 || inScroller(el)) continue;
    // report the outermost overflowing element only
    if (el.parentElement && el.parentElement !== document.body && el.parentElement.getBoundingClientRect().right > W + 1 && !inScroller(el.parentElement)) continue;
    bad.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : ''} → ${Math.round(r.right)}px`);
  }
  const small = [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && r.height && r.height < 32; }).length;
  return { over: doc - W, bad: bad.slice(0, 5), smallButtons: small };
}"""
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
        pg = await ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await pg.add_init_script("localStorage.setItem('hoopsDynasty.help', JSON.stringify({off:true}))")
        await pg.goto(URL)
        rows = []
        async def shot(name, js=None):
            if js: await pg.evaluate(js)
            await pg.wait_for_timeout(80)
            m = await pg.evaluate(MEASURE)
            await pg.screenshot(path=os.path.join(OUT, f"{len(rows)+1:02d}_{name}.png"), full_page=True)
            rows.append((name, m)); print(f"{name:14s} sideways +{m['over']:4d}px  small buttons {m['smallButtons']:3d}  {'; '.join(m['bad'][:3])}")
        await shot("setup")
        await pg.evaluate("$('sCity').value='Laramie, WY'")
        await pg.click("text=Start dynasty")
        await shot("hub")
        for tab in ["schedule", "roster", "rotation", "recruiting", "program", "staff", "standings", "rankings", "postseason", "leaders", "league", "history", "draft", "map"]:
            await shot(tab, f"go('{tab}')")
        rid = await pg.evaluate("LG.recruiting.pool.find(r=>r.status==='open'&&r.rank>40).id")
        await shot("recruit card", f"go('recruiting'); openRecruit('{rid}')")
        await pg.evaluate("closeCard()")
        await pg.evaluate("startLive()")
        await pg.wait_for_function("typeof LIVE !== 'undefined' && LIVE && !SIMMING", timeout=120000)
        await shot("live game", "tipOff(); for(let i=0;i<30;i++) gStep()")
        print("page errors:", errs[:3] if errs else "none")
        await b.close()
asyncio.run(main())
