"""Reader tests with a fake client. No network."""

import json
import sys
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import reader  # noqa: E402
from reader import ReaderError, check_reply, read_receipt, to_backend  # noqa: E402

GOOD = {
    "store": "TEST MARKET",
    "store_location": "1 Main St",
    "receipt_date": "2026-11-18",
    "items": [
        {"name": "Apples", "quantity": "2", "unit_price": "1.25", "line_total": "2.50"},
        {"name": "Bread", "quantity": "1", "unit_price": "3.99", "line_total": "3.99"},
    ],
    "discounts": [],
    "fees": [],
    "tax": "0.52",
    "tip": None,
    "total": "7.01",
}


class FakeClient:
    """Answers with the given replies in order and remembers each request."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []
        self.messages = self

    def create(self, **request):
        self.calls.append(request)
        text = self.replies.pop(0)
        return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=text)])

    def stream(self, **request):
        """Like the SDK's streaming helper: a with block that gives back the final message."""
        outer = self

        class Stream:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

            def get_final_message(self):
                return outer.create(**request)

        return Stream()


def test_good_reply():
    client = FakeClient(json.dumps(GOOD))
    found = read_receipt(b"jpeg-bytes", "jpg", client=client, model="test-model")
    assert found == GOOD
    assert len(client.calls) == 1
    assert client.calls[0]["model"] == "test-model"


def test_max_tokens_is_64000_and_the_streaming_call_is_used():
    client = FakeClient(json.dumps(GOOD))
    streamed = []
    original = client.stream
    client.stream = lambda **request: (streamed.append(request), original(**request))[1]
    read_receipt(b"x", "jpg", client=client, model="m")
    assert client.calls[0]["max_tokens"] == 64000
    assert len(streamed) == 1  # the reader called the streaming helper, not a plain request


def test_thinking_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv("RECEIPT_READER_THINKING", raising=False)
    client = FakeClient(json.dumps(GOOD))
    read_receipt(b"x", "jpg", client=client, model="m")
    assert client.calls[0]["thinking"] == {"type": "disabled"}


def test_thinking_disabled_is_sent_together_with_the_effort(monkeypatch):
    monkeypatch.setenv("RECEIPT_READER_THINKING", "disabled")
    monkeypatch.setenv("RECEIPT_READER_EFFORT", "low")
    client = FakeClient("bad", json.dumps(GOOD))
    read_receipt(b"x", "jpg", client=client, model="m")
    for call in client.calls:  # the retry sends the same settings
        assert call["thinking"] == {"type": "disabled"}
        assert call["output_config"] == {"effort": "low"}
        assert call["max_tokens"] == 64000


def test_any_other_thinking_value_sends_nothing(monkeypatch):
    monkeypatch.setenv("RECEIPT_READER_THINKING", "on")
    client = FakeClient(json.dumps(GOOD))
    read_receipt(b"x", "jpg", client=client, model="m")
    assert "thinking" not in client.calls[0]


def test_effort_can_be_switched_for_one_run_but_defaults_to_medium(monkeypatch):
    monkeypatch.setenv("RECEIPT_READER_EFFORT", "low")
    client = FakeClient(json.dumps(GOOD))
    read_receipt(b"x", "jpg", client=client, model="m")
    assert client.calls[0]["output_config"] == {"effort": "low"}


def test_defaults_are_the_small_model_with_medium_effort(monkeypatch):
    monkeypatch.delenv("RECEIPT_READER_EFFORT", raising=False)
    monkeypatch.delenv("RECEIPT_READER_MODEL", raising=False)
    client = FakeClient(json.dumps(GOOD))
    read_receipt(b"x", "jpg", client=client)
    assert client.calls[0]["model"] == "claude-haiku-5-5"
    assert client.calls[0]["output_config"] == {"effort": "medium"}
    assert client.calls[0]["thinking"] == {"type": "disabled"}


def test_bad_json_then_good_on_retry():
    client = FakeClient("not json at all", json.dumps(GOOD))
    assert read_receipt(b"x", "jpg", client=client, model="m") == GOOD
    assert len(client.calls) == 2
    assert all(call["output_config"]["effort"] == "medium" for call in client.calls)  # the retry too


def test_two_bad_replies_raise():
    client = FakeClient("{broken", json.dumps({**GOOD, "items": []}))
    with pytest.raises(ReaderError):
        read_receipt(b"x", "jpg", client=client, model="m")
    assert len(client.calls) == 2  # exactly one retry


def test_missing_key_stops(monkeypatch):
    monkeypatch.delenv("RECEIPT_READER_API_KEY", raising=False)
    with pytest.raises(SystemExit) as stop:
        reader.make_client()
    assert str(stop.value) == "RECEIPT_READER_API_KEY is not set"


def test_image_block_comes_before_the_text():
    client = FakeClient(json.dumps(GOOD))
    read_receipt(b"\xff\xd8jpeg", "jpg", client=client, model="m")
    content = client.calls[0]["messages"][0]["content"]
    assert content[0]["type"] == "image"
    assert content[0]["source"]["type"] == "base64"
    assert content[0]["source"]["media_type"] == "image/jpeg"
    assert content[1]["type"] == "text"


def test_pdf_uses_a_document_block():
    client = FakeClient(json.dumps(GOOD))
    read_receipt(b"%PDF-1.4", "pdf", client=client, model="m")
    content = client.calls[0]["messages"][0]["content"]
    assert content[0]["type"] == "document"
    assert content[0]["source"]["media_type"] == "application/pdf"
    assert content[1]["type"] == "text"


def test_code_fence_is_allowed():
    assert check_reply("```json\n" + json.dumps(GOOD) + "\n```") == GOOD


@pytest.mark.parametrize("change", [
    {"unit_price": 1.25},            # a number, not a decimal string
    {"unit_price": "-1.25", "line_total": "-2.50"},
    {"unit_price": "1.2"},           # not two decimals
    {"line_total": "2.49"},          # does not match quantity times price
    {"quantity": "0"},
    {"quantity": 2},                 # a number, not a string
])
def test_bad_items_are_refused(change):
    bad = {**GOOD, "items": [{**GOOD["items"][0], **change}, GOOD["items"][1]]}
    with pytest.raises(ReaderError):
        check_reply(json.dumps(bad))


def test_total_must_add_up_with_tax_tip_fees_and_discounts():
    with pytest.raises(ReaderError):
        check_reply(json.dumps({**GOOD, "total": "7.02"}))
    ok = {**GOOD, "discounts": [{"name": "Coupon", "amount": "1.00"}], "fees": [{"name": "Bag", "amount": "0.10"}],
          "tip": "2.00", "total": "8.11"}
    assert check_reply(json.dumps(ok))["total"] == "8.11"


def test_missing_total_skips_the_total_check():
    assert check_reply(json.dumps({**GOOD, "total": None, "tax": None}))["total"] is None


def test_weighed_line_rounds_to_the_cent():
    weighed = {"name": "Bananas", "quantity": "1.37", "unit_price": "0.59", "line_total": "0.81"}
    data = {**GOOD, "items": [weighed], "tax": None, "total": "0.81"}
    assert check_reply(json.dumps(data))["items"][0]["quantity"] == "1.37"


def test_gas_line_with_three_decimal_price():
    gas = {"name": "Regular", "quantity": "10.512", "unit_price": "3.459", "line_total": "36.36"}
    assert check_reply(json.dumps({**GOOD, "items": [gas], "tax": None, "total": "36.36"}))["items"][0]["line_total"] == "36.36"


def test_not_a_receipt_is_a_bad_reply():
    with pytest.raises(ReaderError):
        check_reply('{"not_a_receipt": true}')


def test_bad_date_is_refused():
    with pytest.raises(ReaderError):
        check_reply(json.dumps({**GOOD, "receipt_date": "11/18/2026"}))


def test_null_fields_are_fine():
    data = {**GOOD, "store": None, "store_location": None, "receipt_date": None}
    assert check_reply(json.dumps(data))["receipt_date"] is None


def test_to_backend_keeps_only_what_the_backend_stores():
    found = check_reply(json.dumps({
        **GOOD,
        "items": GOOD["items"] + [{"name": "Bananas", "quantity": "1.37", "unit_price": "0.59", "line_total": "0.81"}],
        "discounts": [{"name": "Coupon", "amount": "0.50"}],
        "total": "7.32",
    }))
    stored = to_backend(found)
    assert set(stored) == {"store", "store_location", "receipt_date", "items"}
    assert stored["items"][0] == {"name": "Apples", "quantity": 2, "unit_price": Decimal("1.25"), "line_total": Decimal("2.50")}
    banana = stored["items"][2]
    assert banana["quantity"] == 1 and banana["unit_price"] == banana["line_total"] == Decimal("0.81")
    assert banana["name"] == "Bananas (1.37 @ 0.59)"
    for item in stored["items"]:  # every stored line passes the backend rules
        assert item["quantity"] >= 1 and item["unit_price"] >= 0
        assert item["quantity"] * item["unit_price"] == item["line_total"]


def test_early_stop_counts_as_bad_reply():
    class Refuses(FakeClient):
        def create(self, **request):
            self.calls.append(request)
            return SimpleNamespace(stop_reason="refusal", content=[])

    client = Refuses()
    with pytest.raises(ReaderError):
        read_receipt(b"x", "jpg", client=client, model="m")
    assert len(client.calls) == 2


def test_no_key_value_in_reader_source():
    # the key must only come from the environment
    source = Path(reader.__file__).read_text()
    assert "sk-ant" not in source
    assert "ANTHROPIC_API_KEY" not in source
