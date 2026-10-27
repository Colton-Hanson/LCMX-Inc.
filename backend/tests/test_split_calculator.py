
from decimal import Decimal

import pytest

from app.services.split_calculator import (
    SplitCalculationError,
    calculate_splits,
)


def test_even_split_with_remainder():
    result = calculate_splits("10.00", [1, 2, 3])

    assert result["shares"] == {
        1: Decimal("3.34"),
        2: Decimal("3.33"),
        3: Decimal("3.33"),
    }
    assert result["rounding_adjusted_member_ids"] == [1]


def test_even_split_without_remainder():
    result = calculate_splits("12.00", [1, 2, 3])

    assert list(result["shares"].values()) == [
        Decimal("4.00"),
        Decimal("4.00"),
        Decimal("4.00"),
    ]
    assert result["rounding_adjusted_member_ids"] == []


def test_custom_split():
    result = calculate_splits(
        "100.00",
        [1, 2, 3],
        method="custom",
        values={1: "50.00", 2: "30.00", 3: "20.00"},
    )

    assert result["shares"][1] == Decimal("50.00")
    assert sum(result["shares"].values()) == Decimal("100.00")


def test_percentage_split():
    result = calculate_splits(
        "100.00",
        [1, 2, 3],
        method="percentage",
        values={1: "50", 2: "30", 3: "20"},
    )

    assert result["shares"] == {
        1: Decimal("50.00"),
        2: Decimal("30.00"),
        3: Decimal("20.00"),
    }


def test_percentage_rounding():
    result = calculate_splits(
        "10.00",
        [1, 2, 3],
        method="percentage",
        values={1: "33.33", 2: "33.33", 3: "33.34"},
    )

    assert sum(result["shares"].values()) == Decimal("10.00")
    assert result["rounding_adjusted_member_ids"]


@pytest.mark.parametrize(
    "total,member_ids,method,values",
    [
        ("0.00", [1, 2], "even", None),
        ("-10.00", [1, 2], "even", None),
        ("10.001", [1, 2], "even", None),
        ("10.00", [], "even", None),
        ("10.00", [1, 1], "even", None),
        ("10.00", [1, 2], "unknown", None),
        ("10.00", [1, 2], "custom", {1: "3.00", 2: "3.00"}),
        ("10.00", [1, 2], "percentage", {1: "40", 2: "50"}),
        ("10.00", [1, 2], "percentage", {1: "-10", 2: "110"}),
        ("10.00", [1, 2], "custom", {1: "10.00"}),
    ],
)
def test_invalid_splits(total, member_ids, method, values):
    with pytest.raises(SplitCalculationError):
        calculate_splits(total, member_ids, method, values)


def test_one_cent_split_between_three_members():
    result = calculate_splits("0.01", [1, 2, 3])

    assert result["shares"] == {
        1: Decimal("0.01"),
        2: Decimal("0.00"),
        3: Decimal("0.00"),
    }
