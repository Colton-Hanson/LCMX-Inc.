
from decimal import Decimal, InvalidOperation, ROUND_DOWN


class SplitCalculationError(ValueError):
    """Raised when an expense cannot be split as requested."""


def _money(value):
    """Convert a value to cents without floating-point arithmetic."""
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise SplitCalculationError("Invalid monetary amount.")

    if not amount.is_finite() or amount < 0:
        raise SplitCalculationError("Amount must be non-negative.")

    if amount != amount.quantize(Decimal("0.01")):
        raise SplitCalculationError("Amounts cannot have more than two decimal places.")

    return amount


def calculate_splits(total, member_ids, method="even", values=None):
    """
    Calculate each member's share of an expense.

    Methods:
      even:       Distribute cents equally.
      custom:     Provide dollar amounts for each member.
      percentage: Provide percentages for each member.

    Returns:
        {
            "shares": {user_id: Decimal("amount")},
            "rounding_adjusted_member_ids": [...]
        }
    """
    total = _money(total)

    if total <= 0:
        raise SplitCalculationError("Expense total must be greater than zero.")

    if not member_ids or len(member_ids) != len(set(member_ids)):
        raise SplitCalculationError("Provide unique member IDs.")

    if method not in ("even", "custom", "percentage"):
        raise SplitCalculationError("Unsupported split method.")

    shares = {}
    adjusted = []

    if method == "even":
        total_cents = int(total * 100)
        base_cents, remainder = divmod(total_cents, len(member_ids))

        for index, member_id in enumerate(member_ids):
            extra_cent = 1 if index < remainder else 0
            shares[member_id] = Decimal(base_cents + extra_cent) / 100

            if extra_cent:
                adjusted.append(member_id)

    elif method == "custom":
        if not isinstance(values, dict) or set(values) != set(member_ids):
            raise SplitCalculationError("Provide one custom amount per member.")

        shares = {member_id: _money(values[member_id]) for member_id in member_ids}

        if sum(shares.values()) != total:
            raise SplitCalculationError("Custom amounts must equal the expense total.")

    elif method == "percentage":
        if not isinstance(values, dict) or set(values) != set(member_ids):
            raise SplitCalculationError("Provide one percentage per member.")

        try:
            percentages = {
                member_id: Decimal(str(values[member_id]))
                for member_id in member_ids
            }
        except (InvalidOperation, ValueError, TypeError):
            raise SplitCalculationError("Invalid percentage.")

        if any(not p.is_finite() or p < 0 for p in percentages.values()):
            raise SplitCalculationError("Percentages must be non-negative.")

        if sum(percentages.values()) != Decimal("100"):
            raise SplitCalculationError("Percentages must total 100.")

        allocated = Decimal("0.00")

        for member_id in member_ids:
            raw_share = total * percentages[member_id] / Decimal("100")
            shares[member_id] = raw_share.quantize(
                Decimal("0.01"), rounding=ROUND_DOWN
            )
            allocated += shares[member_id]

        remaining_cents = int((total - allocated) * 100)

        for member_id in member_ids[:remaining_cents]:
            shares[member_id] += Decimal("0.01")
            adjusted.append(member_id)

    if sum(shares.values()) != total:
        raise SplitCalculationError("Calculated shares do not match the total.")

    return {
        "shares": shares,
        "rounding_adjusted_member_ids": adjusted,
    }

