"""Regression checks for the Sprint 7 schema correction (no database required)."""
from pathlib import Path
import importlib.util

from sqlalchemy import CheckConstraint, UniqueConstraint

from models import ItemAssignment, Receipt


def test_item_assignment_allows_many_to_many():
    table = ItemAssignment.__table__
    uniques = {
        tuple(column.name for column in constraint.columns)
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    assert ("receipt_item_id", "user_id") in uniques
    assert ("user_id",) not in uniques
    assert ("receipt_item_id",) not in uniques


def test_receipt_can_retain_items_without_picture_and_support_confirmation():
    table = Receipt.__table__
    assert table.c.file_path.nullable
    status_checks = [
        str(constraint.sqltext)
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint) and constraint.name == "ck_receipts_status"
    ]
    assert len(status_checks) == 1
    assert "'abandoned'" in status_checks[0]
    assert "'confirmed'" in status_checks[0]


def test_correction_migration_operations(monkeypatch):
    # Verify the revision actually alters the DB, unlike the earlier empty migration.
    path = Path(__file__).resolve().parents[1] / "alembic/versions/7f31b2e4c9a0_fix_it7_receipt_constraints.py"
    spec = importlib.util.spec_from_file_location("it7_schema_fix", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    operations = []
    for name in ("drop_constraint", "create_unique_constraint", "create_check_constraint", "alter_column"):
        monkeypatch.setattr(module.op, name, lambda *args, _name=name, **kwargs: operations.append((_name, args, kwargs)))
    module.upgrade()
    assert any(name == "create_unique_constraint" and args[2] == ["receipt_item_id", "user_id"] for name, args, _ in operations)
    assert any(name == "create_check_constraint" and "'confirmed'" in args[2] for name, args, _ in operations)
    assert any(name == "alter_column" and kwargs.get("nullable") is True for name, _, kwargs in operations)
