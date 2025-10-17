"""merge_heads

Revision ID: 548ef5b8d574
Revises: add_admin_tables, add_emergency_photo_moderation
Create Date: 2025-09-18 21:15:37.013093

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '548ef5b8d574'
down_revision = ('add_admin_tables', 'add_emergency_photo_moderation')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
