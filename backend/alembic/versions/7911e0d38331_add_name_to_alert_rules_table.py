"""Add name to alert_rules table

Revision ID: 7911e0d38331
Revises: 744c9a12f001
Create Date: 2025-11-09 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7911e0d38331'
down_revision = '744c9a12f001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Add the column, but allow it to be NULL temporarily.
    op.add_column('alert_rules', sa.Column('name', sa.String(), nullable=True))

    # Step 2: Update all existing rows to have a default name.
    # We'll generate a unique name like "Rule 1", "Rule 2", etc.
    op.execute("UPDATE alert_rules SET name = 'Rule ' || id::text")

    # Step 3: Now that all rows have a value, alter the column to be NOT NULL.
    op.alter_column('alert_rules', 'name', nullable=False)


def downgrade() -> None:
    # To reverse, we just drop the column.
    op.drop_column('alert_rules', 'name')
