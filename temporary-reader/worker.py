"""Stand-in receipt reader worker.

Every 2 seconds it takes receipts with status "uploaded", marks them "reading",
reads the stored file, saves what it found and marks them "read" (or "failed").
It writes through the backend's own models, so it uses the same rules.

Settings:
  RECEIPT_READER_API_KEY    the API key (required, never printed)
  RECEIPT_READER_MODEL      optional model name (default: claude-haiku-5-5)
  RECEIPT_READER_EFFORT     optional effort (default: medium)
  RECEIPT_READER_THINKING   optional; default disabled so the call does not think
  RECEIPT_READER_MAX_CALLS  optional cap on live calls, counted across restarts
  RECEIPT_READER_RUN_DIR    optional folder for the usage and results files (default: runs)
  BACKEND_DIR               the backend folder to use (default: the backend folder next to this one)

These settings can also go in a .env file in this folder (it is git-ignored).
"""

import json
import logging
import os
import sys
import time
from datetime import date, datetime
from pathlib import Path

sys.dont_write_bytecode = True  # no cache files inside the backend folder

from dotenv import dotenv_values, load_dotenv

from reader import ReaderError, make_client, read_receipt, to_backend

POLL_SECONDS = 2
HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")  # the API key can live here; real environment settings win
RUNS = Path(os.environ.get("RECEIPT_READER_RUN_DIR", str(HERE / "runs"))).resolve()  # one folder per test run
USAGE_FILE = RUNS / "usage.jsonl"      # one line per live call: ids, tokens, stop reason
RESULTS_FILE = RUNS / "results.jsonl"  # what the reader found, for scoring
BACKEND_DIR = Path(os.environ.get("BACKEND_DIR", str(HERE.parent / "backend"))).resolve()
SAME_ERROR_LIMIT = 3

log = logging.getLogger("reader")


class BudgetSpent(ReaderError):
    """The live call cap was reached."""


class StopWorker(Exception):
    """The same API error happened too many times in a row."""


class CountingClient:
    """Wraps the API client: counts calls, refuses calls past the cap, writes token usage."""

    def __init__(self, client, max_calls):
        self.client = client.with_options(max_retries=0)  # every request counts once
        self.max_calls = max_calls
        self.receipt_id = None
        self.attempt = 0
        self.last_error = None
        self.same_error = 0
        self.messages = self
        self.calls = 0
        if USAGE_FILE.exists():
            self.calls = sum(1 for _ in USAGE_FILE.open(encoding="utf-8"))

    def create(self, **request):
        return self._counted(lambda: self.client.messages.create(**request))

    def stream(self, **request):
        """Same counting for the streaming call the reader uses; get_final_message() makes the live call."""
        return CountedStream(self, request)

    def _counted(self, make_call):
        if self.max_calls is not None and self.calls >= self.max_calls:
            raise BudgetSpent("live call cap reached")
        self.calls += 1
        self.attempt += 1
        row = {"receipt_id": self.receipt_id, "attempt": self.attempt, "call": self.calls, "at": datetime.now().isoformat(timespec="seconds")}
        started = time.monotonic()
        try:
            response = make_call()
        except Exception as error:
            row["seconds"] = round(time.monotonic() - started, 2)
            row["error"] = type(error).__name__
            self._write(row)
            name = type(error).__name__
            self.same_error = self.same_error + 1 if name == self.last_error else 1
            self.last_error = name
            if self.same_error >= SAME_ERROR_LIMIT:
                raise StopWorker(name) from error
            raise
        self.last_error = None
        self.same_error = 0
        usage = response.usage
        row.update({
            "seconds": round(time.monotonic() - started, 2),
            "model": response.model,
            "stop_reason": response.stop_reason,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", 0) or 0,
            "cache_creation_input_tokens": getattr(usage, "cache_creation_input_tokens", 0) or 0,
        })
        self._write(row)
        return response

    @staticmethod
    def _write(row):
        RUNS.mkdir(exist_ok=True)
        with USAGE_FILE.open("a", encoding="utf-8") as out:
            out.write(json.dumps(row) + "\n")


class CountedStream:
    """Looks like the SDK's stream helper: use it in a with block and call get_final_message()."""

    def __init__(self, owner, request):
        self.owner = owner
        self.request = request

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def get_final_message(self):
        def call():
            with self.owner.client.messages.stream(**self.request) as stream:
                return stream.get_final_message()

        return self.owner._counted(call)


def upload_dir():
    # same rule as the backend's receipts.py
    return Path(os.environ.get("RECEIPT_UPLOAD_DIR", str(BACKEND_DIR / "uploads" / "receipts"))).resolve()


def load_backend():
    """Imports the backend models and opens the same database, without printing the address."""
    url = dotenv_values(BACKEND_DIR / ".env").get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is missing from the backend .env file")
    sys.path.insert(0, str(BACKEND_DIR))
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    import models  # type: ignore  (it lives in the backend folder, which is added to the path just above)

    return models, sessionmaker(bind=create_engine(url, pool_pre_ping=True))  # replaces dead connections


def stored_file(file_path):
    """The receipt's file, only if it is inside the upload folder."""
    if not file_path:
        raise ReaderError("no stored file")
    path = Path(file_path).resolve()
    if path.parent != upload_dir() or not path.is_file():
        raise ReaderError("stored file is missing or outside the upload folder")
    return path.read_bytes()


def claim_next(models, Session):
    """Moves one uploaded receipt to reading. Returns its id or None."""
    with Session() as db:
        receipt = (
            db.query(models.Receipt)
            .filter(models.Receipt.status == "uploaded")
            .order_by(models.Receipt.id)
            .with_for_update(skip_locked=True)
            .first()
        )
        if receipt is None:
            return None
        receipt.status = "reading"
        db.commit()
        log.info("receipt %s: uploaded -> reading", receipt.id)
        return receipt.id


def save_result(models, Session, receipt_id, found):
    """Writes store, date and items, then marks the receipt read.

    Skips the write if the row is no longer "reading", so a second worker cannot
    save over a receipt someone else already finished.
    """
    stored = to_backend(found)
    with Session() as db:
        receipt = db.get(models.Receipt, receipt_id, with_for_update=True)
        if receipt is None or receipt.status != "reading":
            log.info("receipt %s: changed while reading, skipped", receipt_id)
            return
        receipt.store = stored["store"]
        receipt.store_location = stored["store_location"]
        receipt.receipt_date = date.fromisoformat(stored["receipt_date"]) if stored["receipt_date"] else None
        for position, line in enumerate(stored["items"]):
            item = models.Item(position=position, **line)
            db.add(item)
            db.flush()
            db.add(models.Receipt_Item(receipt_id=receipt_id, item_id=item.id))
        receipt.status = "read"
        db.commit()
        log.info("receipt %s: reading -> read (%s items)", receipt_id, len(stored["items"]))


def mark_failed(models, Session, receipt_id, error):
    """Marks a still-reading receipt failed. A row that already moved on is left alone."""
    with Session() as db:
        receipt = db.get(models.Receipt, receipt_id, with_for_update=True)
        if receipt is not None and receipt.status == "reading":
            receipt.status = "failed"
            db.commit()
    log.info("receipt %s: reading -> failed (%s)", receipt_id, type(error).__name__)


def record(receipt_id, seconds, found=None, error=None):
    """Appends one local result line so a run can be scored later. The API key is never written."""
    RUNS.mkdir(exist_ok=True)
    with RESULTS_FILE.open("a", encoding="utf-8") as out:
        out.write(json.dumps({"receipt_id": receipt_id, "seconds": seconds, "found": found, "error": error}) + "\n")


def handle(models, Session, client, receipt_id):
    """Reads one claimed receipt. Any failure becomes status failed, and the same API error three times stops the worker."""
    with Session() as db:
        receipt = db.get(models.Receipt, receipt_id)
        file_type = receipt.file_type
        file_path = receipt.file_path
    client.receipt_id = receipt_id
    client.attempt = 0
    started = time.monotonic()
    spent = lambda: round(time.monotonic() - started, 2)  # noqa: E731
    try:
        data = stored_file(file_path)
        found = read_receipt(data, file_type, client=client)
        save_result(models, Session, receipt_id, found)
        record(receipt_id, spent(), found=found)
        log.info("receipt %s: read in %s seconds", receipt_id, spent())
    except StopWorker:
        mark_failed(models, Session, receipt_id, StopWorker())
        record(receipt_id, spent(), error="StopWorker")
        raise
    except Exception as error:  # any problem ends as failed, only the error type is logged
        mark_failed(models, Session, receipt_id, error)
        record(receipt_id, spent(), error=type(error).__name__)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    cap = os.environ.get("RECEIPT_READER_MAX_CALLS")
    client = CountingClient(make_client(), int(cap) if cap else None)  # exits when the key is not set
    from sqlalchemy.exc import OperationalError

    models, Session = load_backend()
    log.info("watching for uploaded receipts every %s seconds (%s live calls so far)", POLL_SECONDS, client.calls)
    while True:
        try:
            receipt_id = claim_next(models, Session)
        except OperationalError:  # the database dropped the connection, try again
            log.info("database connection lost, trying again")
            time.sleep(POLL_SECONDS)
            continue
        if receipt_id is None:
            time.sleep(POLL_SECONDS)
            continue
        try:
            handle(models, Session, client, receipt_id)
        except StopWorker as stop:
            log.info("stopping: the same API error (%s) happened %s times in a row", stop, SAME_ERROR_LIMIT)
            return


if __name__ == "__main__":
    main()
