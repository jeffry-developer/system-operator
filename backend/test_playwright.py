from playwright.sync_api import sync_playwright

try:
    with sync_playwright() as p:
        print("Launching chromium...")
        browser = p.chromium.launch(headless=True)
        print("Closing chromium...")
        browser.close()
        print("SUCCESS")
except Exception as e:
    import traceback
    traceback.print_exc()
