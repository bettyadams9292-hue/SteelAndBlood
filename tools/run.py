# Playwright harness: load the built game, drive it via the SB debug API and real input, capture screenshots.
import sys, asyncio, json
from playwright.async_api import async_playwright
URL = 'file:///home/claude/steelblood/dist/index.html'
async def main(script):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720}, device_scale_factor=1)
        errs=[]; pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e))); pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        await pg.goto(URL); await pg.wait_for_timeout(150)
        g = {'pg':pg,'errs':errs}
        exec(compile(open(script).read(), script, 'exec'), g)
        await g['run'](pg)
        for e in errs: print(e)
        await b.close()
asyncio.run(main(sys.argv[1]))
