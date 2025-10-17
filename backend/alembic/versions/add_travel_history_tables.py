"""add_travel_history_tables

Revision ID: add_travel_history_tables
Revises: add_emergency_photo_moderation
Create Date: 2024-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_travel_history_tables'
down_revision = '548ef5b8d574'
branch_labels = None
depends_on = None

def upgrade():
    # Create travel_sessions table
    op.create_table('travel_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('origin_name', sa.String(length=255), nullable=True),
        sa.Column('origin_lat', sa.Float(), nullable=True),
        sa.Column('origin_lng', sa.Float(), nullable=True),
        sa.Column('destination_name', sa.String(length=255), nullable=True),
        sa.Column('destination_lat', sa.Float(), nullable=True),
        sa.Column('destination_lng', sa.Float(), nullable=True),
        sa.Column('route_data', sa.JSON(), nullable=True),
        sa.Column('duration_minutes', sa.Float(), nullable=True),
        sa.Column('distance_km', sa.Float(), nullable=True),
        sa.Column('start_time', sa.DateTime(), nullable=True),
        sa.Column('end_time', sa.DateTime(), nullable=True),
        sa.Column('travel_mode', sa.String(length=50), nullable=True),
        sa.Column('traffic_conditions', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_travel_sessions_id'), 'travel_sessions', ['id'], unique=False)

    # Create favorite_routes table
    op.create_table('favorite_routes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('origin_name', sa.String(length=255), nullable=True),
        sa.Column('origin_lat', sa.Float(), nullable=True),
        sa.Column('origin_lng', sa.Float(), nullable=True),
        sa.Column('destination_name', sa.String(length=255), nullable=True),
        sa.Column('destination_lat', sa.Float(), nullable=True),
        sa.Column('destination_lng', sa.Float(), nullable=True),
        sa.Column('route_summary', sa.JSON(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_favorite_routes_id'), 'favorite_routes', ['id'], unique=False)

def downgrade():
    op.drop_index(op.f('ix_favorite_routes_id'), table_name='favorite_routes')
    op.drop_table('favorite_routes')
    op.drop_index(op.f('ix_travel_sessions_id'), table_name='travel_sessions')
    op.drop_table('travel_sessions')
