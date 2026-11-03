import sys, asyncio
from playwright.async_api import async_playwright
async def main(url,out,w,h,wait):
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':w,'height':h})
        msgs=[]; pg.on('console',lambda m: msgs.append(m.text)); pg.on('pageerror',lambda e: msgs.append('ERR '+str(e)))
        await pg.goto(url); await pg.wait_for_timeout(wait); await pg.screenshot(path=out)
        for m in msgs: print(m)
        await b.close()
asyncio.run(main(sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4]),int(sys.argv[5]) if len(sys.argv)>5 else 300))
