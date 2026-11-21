# Temporary receipt reader

This is a stand-in. It reads receipts that are stuck at "uploaded" until the real reader is built into the backend. Delete this whole folder when that happens. Nothing else depends on it.

How it works: it checks the database every 2 seconds, reads the saved picture or PDF with a hosted model, and saves the store, date and items. The app then shows the review screen.

## Run it (Windows)

1. Start the database and the backend first, like the main README says.
2. Make sure Python 3.12 is installed (the same one the backend uses).
3. Double-click `Start_Receipt_Reader.bat`.
4. The first time, paste the API key you were given when it asks. It is saved in a `.env` file in this folder, which git ignores. Never commit it.
5. Leave the window open while you test. Close it to stop.

The first run sets up its own Python environment and installs what it needs, so it takes a minute. After that it starts right away.

## Notes

- It uses the `backend` folder next to this one, and it never changes it. It only reads the backend `.env` for the database address.
- The API key costs a little per receipt (under a tenth of a cent) and stops working on Nov 23.
- To use another backend folder, set `BACKEND_DIR` in this folder's `.env`.
- Tests (no network): `.venv\Scripts\python.exe -m pytest`
