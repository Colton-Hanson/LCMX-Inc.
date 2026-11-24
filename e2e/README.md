# Browser walkthrough

Selenium follows the user guide against the running app and saves the screenshots the guide already names. It does not replace the Vitest or pytest unit tests.

The database, backend (`http://127.0.0.1:8000`), and frontend (`http://127.0.0.1:5173`) have to be running first. Chrome or Edge must be installed. Selenium downloads the matching driver.

```powershell
cd e2e
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m pytest -q
```

Pictures land in `userguide-images/`. `userguide-images/checklist.md` records pass, fail, or not run for each step. Receipt review is not run: a live read spends the temporary key, and there is no sample receipt in the repo.
