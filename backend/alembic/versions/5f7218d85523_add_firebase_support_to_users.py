"""add_firebase_support_to_users

Revision ID: 5f7218d85523
Revises: adc96f8b8a52
Create Date: 2025-10-27 19:41:26.588140

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5f7218d85523'
down_revision = 'adc96f8b8a52'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add Firebase support columns
    op.add_column('users', sa.Column('firebase_uid', sa.String(length=128), nullable=True))
    op.add_column('users', sa.Column('photo_url', sa.String(length=512), nullable=True))
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='0'))
    
    # Make hashed_password nullable for Firebase users
    op.alter_column('users', 'hashed_password', nullable=True)
    
    # Create indexes
    op.create_index('ix_users_firebase_uid', 'users', ['firebase_uid'], unique=True)


def downgrade() -> None:
    # Remove indexes
    op.drop_index('ix_users_firebase_uid', table_name='users')
    
    # Remove columns
    op.drop_column('users', 'email_verified')
    op.drop_column('users', 'photo_url')
    op.drop_column('users', 'firebase_uid')
    
    # Restore hashed_password as not nullable
    op.alter_column('users', 'hashed_password', nullable=False)
