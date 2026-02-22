from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    print("Navigating to app...")
    try:
        page.goto("http://localhost:5173", timeout=10000)
    except Exception as e:
        print(f"Navigation failed: {e}")
        return

    # Check if Auth Modal is present
    if page.is_visible("input[type='password']"):
        print("Auth modal found. Logging in...")
        page.fill("input[type='password']", "dev-token-12345")
        page.click("button[type='submit']")

    # Wait for inbox
    print("Waiting for inbox...")
    page.wait_for_selector(".message-list", timeout=5000)

    # 1. Verify Message Item Accessibility
    print("Verifying message item accessibility...")
    try:
        page.wait_for_selector(".message-item", timeout=5000)
    except:
        print("No messages found initially.")

    message_items = page.locator(".message-item")
    if message_items.count() > 0:
        first_item = message_items.first
        role = first_item.get_attribute("role")
        tabindex = first_item.get_attribute("tabindex")

        if role == "button" and tabindex == "0":
            print("SUCCESS: Message item has role='button' and tabindex='0'")
        else:
            print(f"FAILURE: Message item role={role}, tabindex={tabindex}")

    # 2. Verify Empty State (Contextual)
    # The mock server ignores search params, so we can't test empty search.
    # But it has tags with no messages. 'Projects/Alpha' is one such tag.
    print("Verifying contextual empty state for empty tag...")

    # Click on 'Projects/Alpha' tag in sidebar
    # We look for text 'Alpha' because logic splits name by /
    # tag.label is 'Alpha'
    print("Clicking 'Alpha' tag...")

    try:
        # Find the tag item. It might be 'Alpha'
        page.click("text=Alpha")

        # Wait for empty state
        page.wait_for_selector(".empty", timeout=5000)

        actual_text = page.inner_text(".empty")
        print(f"Empty State Text: '{actual_text}'")

        # Expect "No messages in Projects/Alpha"
        # Note: The logic in MessageList uses `this.selectedTag`.
        # When clicking 'Alpha', `selectedTag` becomes 'Projects/Alpha'.

        expect_text = "No messages in Projects/Alpha"
        if expect_text in actual_text:
            print("SUCCESS: Empty state text is correct.")
        else:
            print(f"FAILURE: Expected '{expect_text}', got '{actual_text}'")

    except Exception as e:
        print(f"FAILURE: Could not verify empty tag state. Error: {e}")
        # Debug screenshot
        page.screenshot(path="verification/debug_empty_fail.png")

    # 3. Screenshot
    print("Taking final screenshot...")
    page.screenshot(path="verification/ux_verification.png")

    browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
