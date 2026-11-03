# Mobile test: iPhone-class landscape viewport with touch; drives the on-screen controls with real touch events.
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':844,'height':390}, device_scale_factor=3, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/steelblood/dist/index.html'); await pg.wait_for_timeout(700)
        await pg.screenshot(path='/tmp/m_splash.png')
        await pg.touchscreen.tap(420,200); await pg.wait_for_timeout(500); await pg.screenshot(path='/tmp/m_menu.png')
        await pg.evaluate("SB.IF.game.newRun('endless')"); await pg.wait_for_timeout(800)
        print('touch overlay visible:', await pg.evaluate("getComputedStyle(document.getElementById('touch')).display"))
        cdp = await ctx.new_cdp_session(pg)
        async def touch(kind, pts): await cdp.send('Input.dispatchTouchEvent', {'type':kind, 'touchPoints':[{'x':x,'y':y,'id':i} for i,(x,y) in enumerate(pts)]})
        x0 = await pg.evaluate("SB.IF.game.run.player.x")
        # stick: press left side and drag right, while tapping attack button
        btn = await pg.evaluate("(()=>{const r=document.querySelector('.tbtn[data-a=attack]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        await touch('touchStart', [(130,300)]); await touch('touchMove', [(185,300)])
        await pg.wait_for_timeout(600)
        await touch('touchMove', [(185,300),(btn[0],btn[1])]); await pg.wait_for_timeout(120)
        st = await pg.evaluate("SB.IF.game.run.player.state")
        await pg.screenshot(path='/tmp/m_game.png')
        await touch('touchEnd', [])
        x1 = await pg.evaluate("SB.IF.game.run.player.x")
        print('touch: moved %.0fpx, attack state=%s' % (x1-x0, st))
        print('errors:', errs)
        await b.close()
asyncio.run(main())
