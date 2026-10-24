from pathlib import Path
import os,shutil,tempfile
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.getenv('CHROMIUM_BIN') or shutil.which('chromium'),args=['--no-sandbox'])
    for vp in [{'width':1440,'height':900},{'width':390,'height':844}]:
        page=browser.new_page(viewport=vp)
        errors=[]
        page.on('pageerror',lambda ex:errors.append(str(ex)))
        html=(root/'life.html').read_text()
        html=html.replace('<link rel="stylesheet" href="life.css">','<style>'+(root/'life.css').read_text()+'</style>')
        for tag in ['<script defer src="life.bundle.js"></script>','<script defer src="checklist.data.js"></script>','<script defer src="checklist-ui.js"></script>']:
            html=html.replace(tag,'')
        page.set_content(html,wait_until='load')
        for name in ['life.bundle.js','checklist.data.js','checklist-ui.js']:
            page.add_script_tag(content=(root/name).read_text())
        page.wait_for_function('window.WorldGuardFeatureFocus && window.WorldGuardChecklistTest',timeout=12000)
        assert page.locator('#viewerLoading').is_hidden()
        page.locator('#settingsChecklist').click()
        assert page.locator('#requirementsDialog').is_visible()
        page.screenshot(path=str(Path(tempfile.gettempdir()) / f'worldguard-checklist-settings-{vp["width"]}.png'),full_page=True)
        r=page.evaluate('window.WorldGuardChecklistTest.getCounts()')
        assert r=={'verified':15,'partial':30,'missing':10},r
        assert page.locator('.requirement-entry input:checked').count()==15
        assert page.locator('.requirement-entry.missing input:checked').count()==0
        page.locator('#requirementSearch').fill('Laya')
        assert page.locator('.requirement-entry').count()>=2
        assert page.locator('.requirement-entry input:checked').count()==0
        page.locator('#requirementSearch').fill('WG-006')
        assert page.locator('.requirement-entry').count()==1
        page.locator('.requirement-entry .requirement-actions button').click()
        assert page.locator('#requirementsDialog').is_hidden()
        assert page.locator('#viewChip').inner_text()=='2.5D CITY'
        for fid in ['WG-007','WG-008','WG-009','WG-012','WG-037','WG-041','WG-043','WG-047','WG-048','WG-053']:
            page.locator('#settingsChecklist').click()
            page.locator('#requirementSearch').fill(fid)
            page.locator('.requirement-entry .requirement-actions button').click()
            assert page.locator('#requirementsDialog').is_hidden(),fid
        page.locator('#settingsChecklist').click()
        page.locator('#requirementFilter').select_option('missing')
        assert page.locator('.requirement-entry').count()==10
        assert page.locator('.requirement-entry .requirement-actions button').count()==0
        page.locator('#closeRequirements').click()
        assert page.locator('#requirementsDialog').is_hidden()
        assert page.evaluate('document.activeElement.id')=='settingsChecklist'
        assert not errors,errors
        page.screenshot(path=str(Path(tempfile.gettempdir()) / f'worldguard-checklist-{vp["width"]}.png'),full_page=True)
        print('PASS viewport',vp,'checks',r,'consoleErrors',errors)
        page.close()
    browser.close()
