from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_alembic_has_a_single_head():
    # Sprint 4 and sprint 5 both used to revise the same parent.
    # Two heads make alembic upgrade head fail.
    backend_root = Path(__file__).resolve().parents[1]
    config = Config(str(backend_root / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "alembic"))

    heads = ScriptDirectory.from_config(config).get_heads()

    assert heads == ["04994c4898a2"]
