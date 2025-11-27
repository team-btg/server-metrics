"""Merge divergent branches

Revision ID: 426678c46c3d
Revises: 11d25f8075f9, f6b02e0d748d
Create Date: 2025-11-23 13:16:32.077205

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '426678c46c3d'
down_revision: Union[str, Sequence[str], None] = ('11d25f8075f9', 'f6b02e0d748d')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
