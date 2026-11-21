"""
HOOPS DYNASTY — BROWSER SMOKE TEST
Clicks through a whole year (every tab, a recruit, a season, roster
decisions, the transfer portal, the offseason report, the next season)
and fails on any JavaScript error.

  1. serve the game folder:      python3 -m http.server 8765
  2. one-time setup:             pip install playwright && playwright install chromium
  3. run:                        python3 tests/ui_smoke.py
     (another address:           python3 tests/ui_smoke.py http://localhost:8000/dynasty.html)
     (a specific Chromium:       set CHROMIUM=/path/to/chrome)
     (the 352-team league:       LEAGUE=full python3 tests/ui_smoke.py  — a few minutes)
     (take over a school:        TAKEOVER=1 python3 tests/ui_smoke.py)

Screenshots of each screen go to tests/shots/.
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/dynasty.html"
LEAGUE = os.environ.get("LEAGUE")          # e.g. LEAGUE=full runs the 352-team league (slow: a full season in the page)
TAKEOVER = os.environ.get("TAKEOVER")      # TAKEOVER=1: coach an existing school instead of a new one
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        kw = {"executable_path": os.environ["CHROMIUM"]} if os.environ.get("CHROMIUM") else {}
        b = await p.chromium.launch(**kw)
        pg = await b.new_page(viewport={"width": 1400, "height": 1000})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        steps = []
        async def step(name, js=None, shot=True):
            if js: await pg.evaluate(js)
            await pg.wait_for_timeout(50)
            if shot: await pg.screenshot(path=os.path.join(SHOTS, f"{len(steps)+1:02d}_{name}.png"))
            steps.append((name, len(errs)))
            print(f"  {'ok ' if not errs else 'ERR'} {name}")

        # first-time tip popups would sit over the screens: switch them off (the help step turns them back on to test them)
        await pg.add_init_script("localStorage.setItem('hoopsDynasty.help', JSON.stringify({off:true}))")
        await pg.goto(URL)
        # setup: league picker, school picker (take over an existing school), league-file checks
        if LEAGUE:
            await pg.select_option("#sLeague", LEAGUE); await pg.evaluate("fillConfs()")
        await step("setup city", "$('sCity').value='Laramie, WY'; if($('sCity').value!=='Laramie, WY') throw new Error('city list')", shot=False)
        await step("setup schools", "const o=$('sSchool').options; if(o.length<3) throw new Error('no schools listed'); $('sSchool').value=o[1].value; schoolPicked(); if(!$('sName').disabled) throw new Error('own-program fields should lock'); $('sSchool').value=''; schoolPicked()")
        await step("league file check", "const c=Leagues.check({conferences:[{id:'A',size:4},{id:'B',size:4,schools:[{name:'X',prestige:300}]}]}); if(c.errors.length!==1) throw new Error('league file check: '+c.errors.join('; ')); const e=Leagues.check(JSON.parse(JSON.stringify(League.exportDefinition(previewLeague())))); if(e.errors.length) throw new Error('exported league file: '+e.errors[0])", shot=False)
        if TAKEOVER:
            await pg.evaluate("$('sSchool').value=$('sSchool').options[1].value; schoolPicked()")
        await pg.click("text=Start dynasty")
        await step("hub")
        await step("hot seat banner", "const c=me().coach, s0=c.security, t0=c.tenure; c.security=15; c.tenure=3; go('hub'); if(!document.body.innerText.toLowerCase().includes('hot seat')) throw new Error('no hot seat banner'); c.security=s0; c.tenure=t0; render()", shot=False)
        await step("preseason picks", "go('leaders'); if(!document.body.innerText.toLowerCase().includes('preseason')) throw new Error('no preseason picks'); go('hub')", shot=False)
        await step("help popup", "HELPST.off=false; HELPST.seen={}; render(); if(!$('helpBg').classList.contains('show')) throw new Error('no first-time tip'); for(const k in HELP) helpBody(k)")
        await step("help bar + index", "helpClose(HELPCUR); helpToggle('hub'); if(!document.querySelector('.helpBar.open .helpBody')) throw new Error('info bar did not open'); helpToggle('hub'); helpIndex(); helpShow('draft'); helpClose('draft'); HELPST.off=true; helpSave()")
        if not TAKEOVER: await step("own city", "if(me().city!=='Laramie, WY') throw new Error('own program city: '+me().city)", shot=False)
        for tab in ["schedule", "roster", "rotation", "recruiting", "program", "standings", "rankings", "postseason", "leaders", "league", "history"]:
            await step(tab, f"go('{tab}')", shot=tab in ("roster", "rotation", "recruiting", "program"))
        # a recruit: scout him, offer, points
        rid = await pg.evaluate("LG.recruiting.pool.find(r=>r.status==='open'&&r.rank>40).id")
        await step("recruit card", f"go('recruiting'); openRecruit('{rid}')")
        await step("recruits near you", "REC.near='close'; render(); if(!document.querySelector('#view table')) throw new Error('board'); REC.near='pipe'; render(); REC.near=''; render()", shot=False)
        await step("pipelines", "go('program'); if(!document.body.innerText.toLowerCase().includes('slots')) throw new Error('no pipelines card')")
        await step("draft tab", "go('draft'); if(!document.body.innerText.toLowerCase().includes('mock draft')) throw new Error('no mock draft'); DRAFTV.all=true; render(); DRAFTV.all=false; render()")
        await step("map", "go('map'); if(!document.querySelector('svg.usmap .st')) throw new Error('no map'); mapLayer('cls',true); mapLayer('roster',true); mapZoom('near')")
        await step("map other school", "mapZoom('all'); mapFocus(LG.teams.find(t=>!t.isUser).id); mapFocus(me().id); mapLayer('cls',false); mapLayer('roster',false)", shot=False)
        await step("scout + offer", f"LG.recruiting.scoutPts[me().id]=200; recScout(60); recPts(10); $('recAmt').value=Math.round(LG.recruiting.pool.find(r=>r.id==='{rid}').asking); recOffer()")
        await step("close card", "closeCard()", shot=False)
        await step("staff tab", "go('staff'); if(!document.body.innerText.toLowerCase().includes('job security')) throw new Error('no staff tab'); stfFire(0); if(me().staff[0]) throw new Error('fire'); stfHire(LG.coachPool.slice().sort((a,b)=>Coaches.ask(a)-Coaches.ask(b))[0].id); if(!me().staff[0]) throw new Error('hire: '+STF.msg); me().staff[1].contract=3; stfExtend(1); if(me().staff[1].ext) throw new Error('extended a locked contract'); me().staff[1].contract=1; stfExtend(1); if(!me().staff[1].ext) throw new Error('final-season extension: '+STF.msg); stfSort('ask'); openCoach(me().staff[0].id)")
        await step("staff close", "closeCard()", shot=False)
        # rotation manual mode and back
        await step("rotation manual", "go('rotation'); rotMode('manual'); rotDepth(9)")
        await step("rotation auto", "rotMode('auto')", shot=False)
        # play a live game to the end, then sim the season
        await pg.evaluate("startLive()")
        await pg.wait_for_function("typeof LIVE !== 'undefined' && LIVE && !SIMMING", timeout=120000)
        await step("live game")
        await step("court", "tipOff(); if(document.querySelectorAll('#gCourt .cp').length!==10) throw new Error('court players: '+document.querySelectorAll('#gCourt .cp').length)")
        # play at top speed for a few seconds: the court follows every revealed event without errors, and always shows 10 players
        await pg.evaluate("gSpeed(8); gPlay()")
        await pg.wait_for_timeout(4000)
        await pg.evaluate("gPause(); gToggleDead(); gSpeed(8); gPlay()")
        await pg.wait_for_timeout(3000)
        await step("stop at dead balls", "if(gPlaying) throw new Error('Play did not stop at a dead ball'); if($('gBanner').textContent.startsWith('Dead ball') && !G.deadBall) throw new Error('stopped on a live ball'); const n=G.events.length, top=$('gPbp').firstElementChild; if(!top) throw new Error('no play-by-play'); gToggleDead(); if(gStopDead) throw new Error('toggle off')")
        await pg.evaluate("gSpeed(8); gPlay()")
        await pg.wait_for_timeout(1500)
        await step("court while playing", "gPause(); const n=document.querySelectorAll('#gCourt .cp').length; if(n!==10) throw new Error('court players while playing: '+n); if(!$('gCourtCap').textContent.includes('ball')) throw new Error('court caption'); courtToggle(); if($('gCourtWrap').style.display!=='none') throw new Error('court toggle'); courtToggle()")
        await step("rolls tab", "gStep(); gStep(); gTab('rolls'); if(!$('gRolls').children.length) throw new Error('no roll trace in the live game')")
        await step("tip off", "gTab('pbp'); gSimEnd()")
        await step("continue", "endLive()", shot=False)
        # the "Sim to…" menu: stop before your next game, at the conference tournaments, at Selection Sunday
        await pg.evaluate("simTo('game')"); await pg.wait_for_function("!SIMMING", timeout=120000)
        await step("sim to my next game", "if(!userGameToday()) throw new Error('did not stop before my next game')", shot=False)
        await pg.evaluate("simTo('conf')"); await pg.wait_for_function("!SIMMING", timeout=240000)
        await step("sim to conference tournaments", "if(!SE.post||SE.post.phase!=='confTourney') throw new Error('not at the conference tournaments: '+(SE.post&&SE.post.phase))", shot=False)
        await pg.evaluate("simTo('ncaa')"); await pg.wait_for_function("!SIMMING", timeout=240000)
        await step("sim to the national tournament", "if(!SE.post||SE.post.phase!=='national') throw new Error('not at Selection Sunday: '+(SE.post&&SE.post.phase))", shot=False)
        await step("season", "while(!Season.seasonComplete(SE)) logResults(Season.simDay(LG,SE)); render()")
        await step("saves (compressed)", "(async()=>{ const r=await Save.saveSlot(5,LG,SE,extraState()); if(!(r.size<r.raw/3)) throw new Error('slot not compressed: '+r.size+' of '+r.raw); const d=await Save.loadSlot(5); if(d.lg.teams.length!==LG.teams.length||d.lg.season!==LG.season) throw new Error('slot load'); const sl=(await Save.listSlots())[4]; if(!sl.size||sl.empty) throw new Error('slot list'); const z=await Save.gzip(Save.pack(LG,SE)); const d2=await Save.readFile(new File([z],'t.hoops')); if(d2.lg.season!==LG.season) throw new Error('compressed file'); const d3=await Save.readFile(new File([Save.pack(LG,SE)],'old.hoops.json')); if(d3.lg.teams.length!==LG.teams.length) throw new Error('plain JSON file'); await Save.deleteSlot(5); })()", shot=False)
        await step("awards", "go('leaders'); if(!SE.awards||!SE.awards.national.POY||!SE.awards.national.MOP) throw new Error('no awards'); if(!document.body.innerText.toLowerCase().includes('all-americans')) throw new Error('no awards view'); AWV.conf=LG.conferences[1].id; render(); AWV.conf=null; go('schedule')")
        # offseason: decisions, portal, report
        # the carousel: you get fired (security forced to 0), take a new job, schools hire
        await step("carousel fired", "me().coach.security=-50; me().coach.tenure=5; goOffseason(); if(LG.offseason.stage!=='carousel') throw new Error('no carousel stage'); if(!LG.offseason.carousel.userFired) throw new Error('should be fired'); if(!document.body.innerText.toLowerCase().includes('been fired')) throw new Error('no fired card')")
        await step("take new job", "const old=me().id; carTake(LG.offseason.carousel.offers[0]); if(me().id===old) throw new Error('did not move'); carHire(); if(LG.offseason.stage!=='hiring') throw new Error('no hiring stage'); if(LG.teams.some(t=>t.coach.vacant)) throw new Error('vacant job left')")
        await step("roster decisions", "carDone()")
        pid = await pg.evaluate("me().players.filter(p=>p.class!=='SR').sort((a,b)=>League.ovrOf(b)-League.ovrOf(a))[0].id")
        await step("decision card", f"openDecision('{pid}')")
        await step("make offer", f"$('decAmt').value=Roster.askFor(me().players.find(x=>x.id==='{pid}'),1); decDeal()")
        await step("close", "closeCard()", shot=False)
        await step("transfer portal", "finishDecisions()")
        prid = await pg.evaluate("(LG.portal.pool.find(r=>r.status==='open'&&r.from!==me().id)||{}).id||null")
        if prid:
            await step("portal card", f"openPortal('{prid}')")
            await step("portal close", "closeCard()", shot=False)
        await step("portal round", "portalNext()")
        await step("offseason report", "finishPortal(); if(!document.body.innerText.toLowerCase().includes('your honors')) throw new Error('no awards on the report')")
        await step("dynasty over", "LG.startYear-=League.MAX_SEASONS; render(); if(!document.body.innerText.toLowerCase().includes('dynasty is complete')) throw new Error('no end-of-dynasty card'); window.scrollTo(0,0)")
        await step("dynasty back", "LG.startYear+=League.MAX_SEASONS; render(); window.scrollTo(0,0)", shot=False)
        await step("draft results", "go('draft'); if(!(LG.draftHistory||[]).length) throw new Error('no draft happened')")
        await step("history", "go('history'); for(const v of ['league','records','hof','program']){ HISTV.view=v; render(); } HISTV.team=LG.teams[5].id; render(); if(!document.body.innerText.toLowerCase().includes('year by year')) throw new Error('no program history'); HISTV.team=null; HISTV.view='records'; render(); if(!document.body.innerText.toLowerCase().includes('single game')) throw new Error('no record book')")
        await step("next season", "startNextSeason()")
        await step("roster next year", "go('roster')")
        # a second offseason: with a great record you can move on by choice (open jobs that want you)
        await step("open jobs", "while(!Season.seasonComplete(SE)) logResults(Season.simDay(LG,SE)); me().coach.security=90; me().coach.repLog=[1,2,3].map(i=>({y:2000+i,pct:0.9,post:5,coy:true})); goOffseason(); if(!document.body.innerText.toLowerCase().includes('open jobs')) throw new Error('no open jobs list')")
        await step("move by choice", "const car=LG.offseason.carousel, j=(car.jobs||[]).find(x=>x.interested); if(j){ const old=me().id; carTake(j.teamId); if(me().id===old) throw new Error('did not move'); } carHire(); if(LG.teams.some(t=>t.coach.vacant)) throw new Error('vacant job left'); carDone(); go('staff'); if(!document.body.innerText.toLowerCase().includes('reputation')) throw new Error('no reputation on staff tab')")
        await step("debug tab", "setDebug(true); go('debug')")
        await step("debug off", "setDebug(false)", shot=False)

        # the exhibition viewer (game.html): build, play a few seconds at 8x, finish, box score
        await pg.goto(URL.replace("dynasty.html", "game.html"))
        await step("exhibition setup", "buildTeams()")
        await step("exhibition play", "startGame(); setSpeed(8); stepOnce(); togglePlay()", shot=False)
        await pg.wait_for_timeout(2000)
        await step("exhibition final", "pause(); simToEnd(); showTab('rolls'); if(!$('rolls').children.length) throw new Error('no roll trace'); showTab('box'); if(!G.over) throw new Error('exhibition game did not finish')")

        # the league editor: start from a preset, edit a player, check, save
        await pg.goto(URL.replace("dynasty.html", "league-editor.html"))
        await step("editor start", "startFrom()")
        await step("editor school", "go('school',0,0); setOvr(0, 88); setRating(1,'three',95); setSchool(0,0,'name','Smoke Test U'); if(Engine.overall(TUNING,cur().school.players[0].pos,cur().school.players[0].ratings)!==88) throw new Error('typed overall did not land')")
        await step("editor problems", "runCheck(); if(PROBLEMS.length) throw new Error('editor: '+PROBLEMS[0]); addConference(); go('league')")
        await step("editor undo + search", "undo(); SEARCH='Smoke'; VIEW={kind:'search'}; render(); if(!document.body.innerText.includes('Smoke Test U')) throw new Error('search found nothing')")

        await b.close()
        if errs:
            print("\nJavaScript errors:"); [print("  " + e) for e in errs]
            sys.exit(1)
        print(f"\nAll {len(steps)} steps clean. Screenshots in {SHOTS}")

asyncio.run(main())
