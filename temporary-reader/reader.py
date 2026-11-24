"""Reads one receipt file into store, date, items, tax and total.

read_receipt is the only part that talks to the model, so a local model can
replace it later by changing this one function.
"""

import base64
import json
import logging
import os
import re
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

# Defaults for the stand-in reader. Effort is always sent on purpose, never left to the model's default.
DEFAULT_MODEL = "claude-haiku-5-5"
DEFAULT_EFFORT = "medium"
MAX_TOKENS = 64000  # long receipts need room; the SDK needs streaming for a limit this large

log = logging.getLogger("reader")

MONEY = re.compile(r"^\d{1,8}\.\d{2}$")
UNIT_PRICE = re.compile(r"^\d{1,8}\.\d{2,3}$")  # gas and weighed items can show 3 decimals
QUANTITY = re.compile(r"^\d{1,4}(\.\d{1,3})?$")
CENT = Decimal("0.01")

PROMPT = """Read this store receipt. Reply with JSON only, no other text, in exactly this shape:
{"store": string or null,
 "store_location": string or null,
 "receipt_date": "YYYY-MM-DD" or null,
 "items": [{"name": string, "quantity": "1", "unit_price": "0.00", "line_total": "0.00"}],
 "discounts": [{"name": string, "amount": "0.00"}],
 "fees": [{"name": string, "amount": "0.00"}],
 "tax": "0.00" or null,
 "tip": "0.00" or null,
 "total": "0.00" or null}
Rules:
- items: only the things bought, in the same order as on the receipt, every page.
- quantity is a string: a whole number like "2", or a decimal like "1.37" for weighed or pumped amounts. Use "1" when no quantity is shown.
- unit_price is the price of one unit as printed (it may have 3 decimals, like "3.459"). line_total is the printed amount for that line.
- discounts: discount, coupon, savings and markdown lines, as positive amounts.
- fees: shipping, delivery, service, bag or deposit charges that are not items.
- tax is the total tax. tip is a tip or gratuity. total is the final amount paid.
- Money is a string with two decimals, like "4.79". No currency signs, no minus signs.
- store_location is the street address or city line printed under the store name.
- Write receipt_date as YYYY-MM-DD whatever format the receipt uses.
- Use null for anything you cannot read. If this is not a receipt, reply {"not_a_receipt": true}."""


class ReaderError(Exception):
    """The reply could not be used."""


def cents(text):
    return Decimal(text).quantize(CENT, rounding=ROUND_HALF_UP)


class Line(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    name: str = Field(min_length=1, max_length=255)
    quantity: str
    unit_price: str
    line_total: str

    @field_validator("quantity")
    @classmethod
    def quantity_ok(cls, value):
        if not QUANTITY.match(value) or Decimal(value) <= 0:
            raise ValueError("quantity must be a positive number string")
        return value

    @field_validator("unit_price")
    @classmethod
    def unit_ok(cls, value):
        if not UNIT_PRICE.match(value):
            raise ValueError("unit_price must be a decimal string like 4.79")
        return value

    @field_validator("line_total")
    @classmethod
    def total_ok(cls, value):
        if not MONEY.match(value):
            raise ValueError("line_total must be a decimal string like 4.79")
        return value

    @model_validator(mode="after")
    def line_matches(self):
        if cents(Decimal(self.unit_price) * Decimal(self.quantity)) != Decimal(self.line_total):
            raise ValueError("line_total is not quantity times unit_price")
        return self


class Charge(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    name: str = Field(min_length=1, max_length=255)
    amount: str

    @field_validator("amount")
    @classmethod
    def amount_ok(cls, value):
        if not MONEY.match(value):
            raise ValueError("amount must be a decimal string like 1.00")
        return value


class ReceiptData(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    store: str | None = Field(default=None, max_length=255)
    store_location: str | None = Field(default=None, max_length=255)
    receipt_date: str | None = None
    items: list[Line] = Field(min_length=1, max_length=300)
    discounts: list[Charge] = Field(default_factory=list)
    fees: list[Charge] = Field(default_factory=list)
    tax: str | None = None
    tip: str | None = None
    total: str | None = None

    @field_validator("receipt_date")
    @classmethod
    def real_date(cls, value):
        if value is None:
            return value
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
            raise ValueError("receipt_date must be YYYY-MM-DD")
        date.fromisoformat(value)
        return value

    @field_validator("tax", "tip", "total")
    @classmethod
    def money_or_null(cls, value):
        if value is not None and not MONEY.match(value):
            raise ValueError("money must be a decimal string like 4.79")
        return value

    @model_validator(mode="after")
    def adds_up(self):
        # items minus discounts plus fees, tax and tip must equal the total
        if self.total is None:
            return self
        add = lambda values: sum((Decimal(v) for v in values), Decimal("0.00"))  # noqa: E731
        worked = (
            add(i.line_total for i in self.items)
            - add(d.amount for d in self.discounts)
            + add(f.amount for f in self.fees)
            + Decimal(self.tax or "0")
            + Decimal(self.tip or "0")
        )
        if worked != Decimal(self.total):
            raise ValueError("the lines do not add up to the total")
        return self


def check_reply(text):
    """Parses and checks one reply. Returns a plain dict or raises ReaderError."""
    cleaned = text.strip()
    # allow the JSON to come wrapped in a code fence
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ReaderError("reply was not JSON") from exc
    if isinstance(data, dict) and data.get("not_a_receipt") is True:
        raise ReaderError("not a receipt")
    try:
        receipt = ReceiptData.model_validate(data)
    except (ValidationError, ArithmeticError, ValueError) as exc:
        raise ReaderError("reply did not match the receipt shape or does not add up") from exc
    return receipt.model_dump()


def to_backend(found):
    """Only what the backend can store: store fields and items it accepts.

    The backend needs a whole quantity of at least 1, a 2 decimal unit price and an exact
    line total. A weighed or rounded line is stored as quantity 1 at its printed line total,
    with the amount kept in the name. Tax, tip, fees and discounts are not stored.
    """
    items = []
    for line in found["items"]:
        qty = Decimal(line["quantity"])
        unit = Decimal(line["unit_price"])
        total = Decimal(line["line_total"])
        exact = qty == qty.to_integral_value() and unit == unit.quantize(CENT) and qty * unit == total
        if exact:
            items.append({"name": line["name"], "quantity": int(qty), "unit_price": unit.quantize(CENT), "line_total": total})
        else:
            name = f"{line['name']} ({line['quantity']} @ {line['unit_price']})"[:255]
            items.append({"name": name, "quantity": 1, "unit_price": total, "line_total": total})
    return {
        "store": found["store"],
        "store_location": found["store_location"],
        "receipt_date": found["receipt_date"],
        "items": items,
    }


def file_block(file_bytes, file_type):
    """The image or document block that goes before the text."""
    data = base64.standard_b64encode(file_bytes).decode("utf-8")
    if file_type == "pdf":
        return {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": data}}
    if file_type in ("jpg", "jpeg"):
        return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}}
    raise ReaderError("unsupported file type")


def request_for(model, file_bytes, file_type):
    # Effort is always sent. The stand-in key is for Haiku 5.5 at medium effort with thinking off,
    # because a thinking reply is slower and is not part of this temporary reader.
    # RECEIPT_READER_EFFORT exists so one test run can use another level.
    # RECEIPT_READER_THINKING defaults to disabled. Any other value omits the field.
    effort = os.environ.get("RECEIPT_READER_EFFORT") or DEFAULT_EFFORT
    thinking = os.environ.get("RECEIPT_READER_THINKING", "disabled")
    request = {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "output_config": {"effort": effort},
        "messages": [{
            "role": "user",
            "content": [file_block(file_bytes, file_type), {"type": "text", "text": PROMPT}],
        }],
    }
    if thinking == "disabled":
        request["thinking"] = {"type": "disabled"}
    return request


def ask_once(client, model, file_bytes, file_type):
    # streaming gives the whole answer at the end and avoids the SDK's limit on big non-streaming requests
    with client.messages.stream(**request_for(model, file_bytes, file_type)) as stream:
        response = stream.get_final_message()
    if response.stop_reason != "end_turn":
        raise ReaderError(f"reply stopped early ({response.stop_reason})")
    text = "".join(block.text for block in response.content if block.type == "text")
    return check_reply(text)


def read_receipt(file_bytes, file_type, client=None, model=None):
    """Returns {store, store_location, receipt_date, items, discounts, fees, tax, tip, total}.

    items are [{name, quantity, unit_price, line_total}] as printed. A bad reply is tried
    exactly once more. Raises ReaderError after that.
    """
    if client is None:
        client = make_client()
    model = model or os.environ.get("RECEIPT_READER_MODEL") or DEFAULT_MODEL
    try:
        return ask_once(client, model, file_bytes, file_type)
    except ReaderError as error:
        log.info("bad reply (%s), trying once more", error)
        return ask_once(client, model, file_bytes, file_type)


def make_client():
    """Builds the API client with the key passed in directly."""
    key = os.environ.get("RECEIPT_READER_API_KEY")
    if not key:
        raise SystemExit("RECEIPT_READER_API_KEY is not set")
    import anthropic

    return anthropic.Anthropic(api_key=key)
