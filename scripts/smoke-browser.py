"""Optional browser smoke test: requires pip install playwright and system chromium."""
import os
from urllib.parse import urlparse, unquote
import mimetypes
from playwright.sync_api import sync_playwright
from pathlib import Path

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=os.getenv('CHROMIUM_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
        errors=[]
        page=browser.new_page(viewport={'width':1440,'height':900}, device_scale_factor=1)
        page.on('pageerror',lambda e: errors.append(str(e)))
        # Browser sandbox blocks all HTTP navigation, so compose the *unmodified* local assets
        # with data: ESM import URLs for an equivalent zero-network smoke test.
        import base64
        def data_uri(src):
            return 'data:text/javascript;base64,'+base64.b64encode(src.encode()).decode()
        life=(root/'sim/life.mjs').read_text()
        training=(root/'sim/life-train.mjs').read_text().replace("from './life.mjs'", "from '"+data_uri(life)+"'")
        ui=(root/'life-ui.mjs').read_text().replace("from './sim/life.mjs'", "from '"+data_uri(life)+"'").replace("from './sim/life-train.mjs'", "from '"+data_uri(training)+"'")
        html=(root/'life.html').read_text().replace('<link rel="stylesheet" href="life.css">','<style>'+(root/'life.css').read_text()+'</style>').replace('<script type="module" src="life-ui.mjs"></script>','')
        page.set_content(html,wait_until='load')
        page.add_script_tag(content=ui,type='module')
        page.wait_for_function("document.getElementById('citySelect').children.length===6")
        assert 'Life Simulation Lab' in page.title()
        assert page.locator('#statAgents').inner_text()=='36'
        page.screenshot(path='/mnt/data/worldguard-life-desktop.png',full_page=True)
        page.get_by_role('button',name='Novara').click()
        assert page.locator('#viewChip').inner_text()=='2.5D CITY'
        page.locator('#agentSelect').select_option('AG-0001')
        assert page.locator('#viewChip').inner_text()=='AGENT LIFE INSPECTOR'
        page.get_by_role('button',name='Back a level').click()
        assert page.locator('#viewChip').inner_text()=='APARTMENT CUTAWAY'
        page.locator('#worldCanvas').scroll_into_view_if_needed()
        canvas_box=page.locator('#worldCanvas').bounding_box()
        page.mouse.click(canvas_box['x']+860/1200*canvas_box['width'],canvas_box['y']+198/660*canvas_box['height'])
        assert page.locator('#viewChip').inner_text()=='AGENT LIFE INSPECTOR'
        page.get_by_role('button',name='Train 12,000 decisions').click()
        page.wait_for_function("document.getElementById('statPolicy').textContent==='ON'",timeout=20000)
        assert 'HELD-OUT' in page.locator('#benchmark').inner_text()
        page.get_by_role('button',name='Next decision').click()
        assert page.locator('#statTurns').inner_text()=='1'
        page.get_by_role('button',name='Run live').click()
        page.wait_for_function("Number(document.getElementById('statTurns').textContent)>=4",timeout=12000)
        page.get_by_role('button',name='Pause',exact=True).click()
        assert int(page.locator('#statTurns').inner_text())>=4
        page.locator('#frame').fill('0')
        assert 'REPLAY MODE' in page.locator('#replayNotice').inner_text()
        page.get_by_role('button',name='Latest').click()
        page.get_by_role('button',name='Export local simulation checkpoint').click()
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path='/mnt/data/worldguard-life-mobile.png',full_page=True)
        assert page.locator('#train').is_visible()
        assert not errors,errors
        print('PASS browser smoke: load, world city, agent building, train, held-out eval, real step, replay, export, mobile; page errors:',errors)
        browser.close()
