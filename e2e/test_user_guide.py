"""User-guide walkthrough in a real browser.

Needs the app on port 5173 (the frontend proxies the API). Two sessions so one
person can invite the other. Screenshots use the names already in userguide.md.
A failed step is recorded, later steps are marked not run, and the checklist
is still written.
"""

import tempfile
from datetime import datetime
from pathlib import Path

import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "userguide-images"
BASE = "http://127.0.0.1:5173"
PASSWORD = "GuidePass123!"
WAIT = 20

# Filled as the walkthrough runs. Written even when a step fails.
STEPS = []


def _note(name, result, image, detail=""):
    STEPS.append({
        "name": name,
        "result": result,
        "image": image,
        "detail": detail,
        "at": datetime.now().isoformat(timespec="seconds"),
    })


def write_checklist():
    """One line per step so the user guide can show what the browser check did."""
    IMAGES.mkdir(parents=True, exist_ok=True)
    lines = [
        "# User guide browser check",
        "",
        "Selenium walked the running app. Unit tests are separate.",
        "",
    ]
    for step in STEPS:
        image = step["image"] or "-"
        extra = f" {step['detail']}" if step["detail"] else ""
        lines.append(f"- {step['result']} | {image} | {step['name']} | {step['at']}{extra}")
    if not any(step["name"] == "Receipt review" for step in STEPS):
        lines.append(
            "- not run | - | Receipt review | "
            "A live read spends the temporary key, and there is no sample receipt in the repo."
        )
    (IMAGES / "checklist.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def start_browser(width, height, profile):
    """Chrome first, then Edge. Each session gets its own profile so cookies stay apart."""
    last_error = None
    for kind in ("chrome", "edge"):
        if kind == "chrome":
            options = webdriver.ChromeOptions()
        else:
            options = webdriver.EdgeOptions()
        options.add_argument("--headless=new")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=%s,%s" % (width, height))
        options.add_argument("--user-data-dir=%s" % profile)
        try:
            driver = webdriver.Chrome(options=options) if kind == "chrome" else webdriver.Edge(options=options)
            driver.set_window_size(width, height)
            return driver
        except Exception as error:
            last_error = error
    raise last_error


def wait_for(driver, by, value, timeout=WAIT):
    return WebDriverWait(driver, timeout).until(EC.visibility_of_element_located((by, value)))


def click_text(driver, text, root=""):
    """Click a link or button by its visible words. root keeps the top bar's Add expense out of the way."""
    locator = (
        By.XPATH,
        "%s//a[normalize-space()='%s'] | %s//button[normalize-space()='%s']" % (root, text, root, text),
    )
    element = WebDriverWait(driver, WAIT).until(EC.element_to_be_clickable(locator))
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
    element.click()
    return element


def fill_labeled(driver, label, value):
    """Type into the input that follows a label. The label can be visually hidden (the Title field is)."""
    field = WebDriverWait(driver, WAIT).until(
        EC.presence_of_element_located((By.XPATH, "//label[normalize-space()='%s']/following::input[1]" % label))
    )
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", field)
    field.click()
    field.send_keys(Keys.CONTROL + "a")
    field.send_keys(value)
    return field


def save_shot(driver, filename):
    """Save the viewport. Tall pages are opened up so the form is not cut off at the fold."""
    IMAGES.mkdir(parents=True, exist_ok=True)
    width = driver.get_window_size()["width"]
    height = driver.execute_script(
        "return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 700);"
    )
    driver.set_window_size(width, min(int(height) + 80, 2200))
    path = IMAGES / filename
    driver.save_screenshot(str(path))
    return filename


def register(driver, email):
    driver.get(BASE + "/register")
    wait_for(driver, By.XPATH, "//h1[normalize-space()='Create your account']")
    fill_labeled(driver, "Email", email)
    fill_labeled(driver, "Password", PASSWORD)
    fill_labeled(driver, "Confirm password", PASSWORD)
    click_text(driver, "Create account")
    wait_for(driver, By.XPATH, "//h2[@id='groups-title']")


def test_user_guide_walkthrough():
    stamp = datetime.now().strftime("%H%M%S")
    email_a = "guide-a-%s@example.com" % stamp
    email_b = "guide-b-%s@example.com" % stamp
    group_name = "Guide Weekend %s" % stamp
    profiles = tempfile.mkdtemp(prefix="lcmx-selenium-")
    driver_a = None
    driver_b = None
    group_url = None
    failed = None

    def step(name, image, action):
        nonlocal failed
        if failed:
            _note(name, "not run", image, "skipped after an earlier failure")
            return
        try:
            action()
            _note(name, "pass", image)
        except Exception as error:
            failed = error
            _note(name, "fail", image, type(error).__name__ + ": " + str(error).splitlines()[0][:180])

    try:
        driver_a = start_browser(1280, 900, str(Path(profiles) / "a"))
        driver_b = start_browser(1280, 900, str(Path(profiles) / "b"))

        def login_page():
            driver_a.get(BASE + "/login")
            wait_for(driver_a, By.XPATH, "//h1[normalize-space()='Log in']")
            save_shot(driver_a, "01-login.png")

        def home_after_register():
            # The invited person has to exist before the invite, or the app sends nothing.
            register(driver_b, email_b)
            register(driver_a, email_a)
            wait_for(driver_a, By.XPATH, "//h2[normalize-space()='Your groups']")
            wait_for(driver_a, By.XPATH, "//a[normalize-space()='Create group']")
            save_shot(driver_a, "02-home.png")

        def create_group():
            click_text(driver_a, "Create group")
            wait_for(driver_a, By.XPATH, "//h1[normalize-space()='Create group']")
            fill_labeled(driver_a, "Group name", group_name)
            roommate = wait_for(driver_a, By.XPATH, "//label[contains(@class,'rad') and contains(., 'Roommate')]")
            roommate.click()
            fill_labeled(driver_a, "Invite members by email", email_b)
            click_text(driver_a, "Add")
            wait_for(driver_a, By.XPATH, "//ul[@aria-label='People you are inviting'][contains(., '%s')]" % email_b)
            save_shot(driver_a, "03-create-group.png")
            click_text(driver_a, "Create group")
            wait_for(driver_a, By.XPATH, "//h1[normalize-space()='%s']" % group_name)

        def accept_invite():
            driver_b.get(BASE + "/home")
            wait_for(driver_b, By.XPATH, "//button[contains(@aria-label, 'Accept invitation to %s')]" % group_name)
            save_shot(driver_b, "04-home-invite.png")
            click_text(driver_b, "Accept")
            wait_for(driver_b, By.XPATH, "//*[contains(., 'You joined %s')]" % group_name)

        def group_page():
            nonlocal group_url
            driver_a.get(BASE + "/home")
            link = wait_for(
                driver_a,
                By.XPATH,
                "//a[.//span[contains(@class,'row-title') and normalize-space()='%s']]" % group_name,
            )
            link.click()
            wait_for(driver_a, By.XPATH, "//h1[normalize-space()='%s']" % group_name)
            wait_for(driver_a, By.XPATH, "//*[contains(., '2 members')]")
            group_url = driver_a.current_url
            save_shot(driver_a, "08-group-page.png")

        def create_event():
            click_text(driver_a, "New event")
            wait_for(driver_a, By.XPATH, "//h1[normalize-space()='New event']")
            fill_labeled(driver_a, "Event name", "Dinner")
            WebDriverWait(driver_a, WAIT).until(
                EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Create event']"))
            )
            save_shot(driver_a, "06-create-event.png")
            click_text(driver_a, "Create event")
            wait_for(driver_a, By.XPATH, "//h1[normalize-space()='%s']" % group_name)

        def add_expense():
            # The top bar also says Add expense, and that link has no group. Use the one on the group page.
            click_text(driver_a, "Add expense", root="//main")
            wait_for(driver_a, By.XPATH, "//h1[normalize-space()='Add expense']")
            wait_for(driver_a, By.XPATH, "//label[normalize-space()='Paid by']")
            wait_for(driver_a, By.XPATH, "//h2[normalize-space()='How to split it']")
            fill_labeled(driver_a, "Title", "Groceries")
            fill_labeled(driver_a, "Total ($)", "20.00")
            save_shot(driver_a, "07-add-expense.png")
            click_text(driver_a, "Save expense")
            wait_for(driver_a, By.XPATH, "//h1[normalize-space()='%s']" % group_name)
            wait_for(driver_a, By.XPATH, "//*[contains(., 'Groceries')]")

        def balances_and_pay():
            driver_b.get(BASE + "/balances")
            wait_for(driver_b, By.XPATH, "//button[normalize-space()='Pay']")
            save_shot(driver_b, "09-balances.png")
            click_text(driver_b, "Pay")
            wait_for(driver_b, By.XPATH, "//button[normalize-space()='Part of it']")
            click_text(driver_b, "Part of it")
            fill_labeled(driver_b, "Amount paid", "4.00")
            save_shot(driver_b, "14-settle.png")
            click_text(driver_b, "Mark as paid")
            click_text(driver_b, "Yes, mark as paid")
            wait_for(driver_b, By.XPATH, "//*[contains(., 'marked as paid')]")

        def settings_pages():
            driver_a.get(group_url)
            click_text(driver_a, "Group settings")
            wait_for(driver_a, By.XPATH, "//h1[normalize-space()='Group settings']")
            wait_for(driver_a, By.XPATH, "//h2[normalize-space()='Members']")
            save_shot(driver_a, "10-group-settings.png")
            account = wait_for(driver_a, By.XPATH, "//button[contains(., 'Account menu')]")
            account.click()
            click_text(driver_a, "Settings")
            wait_for(driver_a, By.XPATH, "//h1[normalize-space()='Settings']")
            save_shot(driver_a, "11-settings.png")

        def phone_pages():
            driver_a.set_window_size(390, 844)
            driver_a.get(group_url)
            wait_for(driver_a, By.XPATH, "//h1[normalize-space()='%s']" % group_name)
            save_shot(driver_a, "12-phone-group.png")
            driver_a.get(BASE + "/balances")
            wait_for(driver_a, By.XPATH, "//h1[normalize-space()='Balances']")
            wait_for(driver_a, By.XPATH, "//h2[normalize-space()='Who owes you']")
            save_shot(driver_a, "13-phone-balances.png")

        step("Log in page", "01-login.png", login_page)
        step("Home after register", "02-home.png", home_after_register)
        step("Create a group", "03-create-group.png", create_group)
        step("Accept an invitation", "04-home-invite.png", accept_invite)
        step("Group page", "08-group-page.png", group_page)
        step("Create an event", "06-create-event.png", create_event)
        step("Add an expense", "07-add-expense.png", add_expense)
        step("Balances and partial Pay", "09-balances.png, 14-settle.png", balances_and_pay)
        step("Group settings and account settings", "10-group-settings.png, 11-settings.png", settings_pages)
        step("Phone width", "12-phone-group.png, 13-phone-balances.png", phone_pages)
        _note(
            "Receipt review",
            "not run",
            "-",
            "A live read spends the temporary key, and there is no sample receipt in the repo.",
        )
        if failed:
            pytest.fail(str(failed))
    finally:
        write_checklist()
        for driver in (driver_a, driver_b):
            if driver is not None:
                driver.quit()
