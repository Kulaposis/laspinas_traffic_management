"""Add emergency photo attachments and moderation features

Revision ID: add_emergency_photo_moderation
Revises: cd8bcd54b75d
Create Date: 2025-09-12 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_emergency_photo_moderation'
down_revision = 'cd8bcd54b75d'
branch_labels = None
depends_on = None


def upgrade():
    # Add photo attachment fields to emergencies table
    op.add_column('emergencies', sa.Column('photo_urls', sa.Text(), nullable=True, comment='JSON array of uploaded photo URLs'))
    op.add_column('emergencies', sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='Whether the report has been verified by admin'))
    op.add_column('emergencies', sa.Column('verification_status', sa.String(20), nullable=False, server_default=sa.text("'pending'"), comment='pending, verified, rejected, flagged'))
    op.add_column('emergencies', sa.Column('verified_by', sa.Integer(), nullable=True, comment='Admin who verified the report'))
    op.add_column('emergencies', sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('emergencies', sa.Column('verification_notes', sa.Text(), nullable=True))
    op.add_column('emergencies', sa.Column('moderation_priority', sa.String(20), nullable=False, server_default=sa.text("'normal'"), comment='low, normal, high, urgent'))
    
    # Add foreign key constraint for verified_by
    op.create_foreign_key('fk_emergencies_verified_by', 'emergencies', 'users', ['verified_by'], ['id'])
    
    # Create indexes for better query performance
    op.create_index('ix_emergencies_verification_status', 'emergencies', ['verification_status'])
    op.create_index('ix_emergencies_is_verified', 'emergencies', ['is_verified'])
    op.create_index('ix_emergencies_moderation_priority', 'emergencies', ['moderation_priority'])


def downgrade():
    # Drop indexes
    op.drop_index('ix_emergencies_moderation_priority', table_name='emergencies')
    op.drop_index('ix_emergencies_is_verified', table_name='emergencies')
    op.drop_index('ix_emergencies_verification_status', table_name='emergencies')
    
    # Drop foreign key constraint
    op.drop_constraint('fk_emergencies_verified_by', 'emergencies', type_='foreignkey')
    
    # Drop columns
    op.drop_column('emergencies', 'moderation_priority')
    op.drop_column('emergencies', 'verification_notes')
    op.drop_column('emergencies', 'verified_at')
    op.drop_column('emergencies', 'verified_by')
    op.drop_column('emergencies', 'verification_status')
    op.drop_column('emergencies', 'is_verified')
    op.drop_column('emergencies', 'photo_urls')
