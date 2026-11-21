"""The call counter around the streaming call. Fake SDK client, no network."""

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import worker  # noqa: E402


class FakeSdk:
    """Stands in for the SDK client: with_options() gives itself, messages.stream() is a with block."""

    def __init__(self, fail=None):
        self.fail = fail
        self.messages = self

    def with_options(self, **_):
        return self

    def stream(self, **request):
        sdk = self

        class Stream:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

            def get_final_message(self):
                if sdk.fail:
                    raise sdk.fail
                usage = SimpleNamespace(input_tokens=1000, output_tokens=250)
                return SimpleNamespace(model="m", stop_reason="end_turn", usage=usage, content=[])

        return Stream()


@pytest.fixture
def runs(tmp_path, monkeypatch):
    monkeypatch.setattr(worker, "RUNS", tmp_path)
    monkeypatch.setattr(worker, "USAGE_FILE", tmp_path / "usage.jsonl")
    return tmp_path


def rows(runs):
    return [json.loads(line) for line in (runs / "usage.jsonl").read_text().splitlines()]


def test_streaming_call_is_counted_and_logs_tokens_and_seconds(runs):
    client = worker.CountingClient(FakeSdk(), max_calls=5)
    client.receipt_id = 7
    with client.messages.stream(max_tokens=64000) as stream:
        stream.get_final_message()
    (row,) = rows(runs)
    assert row["receipt_id"] == 7 and row["input_tokens"] == 1000 and row["output_tokens"] == 250
    assert row["stop_reason"] == "end_turn" and isinstance(row["seconds"], float)


def test_cap_refuses_the_next_call(runs):
    client = worker.CountingClient(FakeSdk(), max_calls=1)
    with client.messages.stream() as stream:
        stream.get_final_message()
    with pytest.raises(worker.BudgetSpent):
        with client.messages.stream() as stream:
            stream.get_final_message()
    assert len(rows(runs)) == 1


def test_same_error_three_times_stops_the_worker(runs):
    client = worker.CountingClient(FakeSdk(fail=RuntimeError("x")), max_calls=10)
    for _ in range(2):
        with pytest.raises(RuntimeError):
            with client.messages.stream() as stream:
                stream.get_final_message()
    with pytest.raises(worker.StopWorker):
        with client.messages.stream() as stream:
            stream.get_final_message()
    assert [r["error"] for r in rows(runs)] == ["RuntimeError"] * 3
