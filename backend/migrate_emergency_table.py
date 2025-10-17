import sqlite3
import os

def migrate_emergency_table():
    """Add missing columns to the emergencies table for photo attachments and moderation"""
    
    db_path = 'traffic_management.db'
    if not os.path.exists(db_path):
        print(f"Database file {db_path} does not exist")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # List of columns to add
    columns_to_add = [
        ("photo_urls", "TEXT"),
        ("is_verified", "BOOLEAN DEFAULT 0"),
        ("verification_status", "VARCHAR(20) DEFAULT 'pending'"),
        ("verified_by", "INTEGER"),
        ("verified_at", "DATETIME"),
        ("verification_notes", "TEXT"),
        ("moderation_priority", "VARCHAR(20) DEFAULT 'normal'")
    ]
    
    # Check existing columns
    cursor.execute("PRAGMA table_info(emergencies)")
    existing_columns = [row[1] for row in cursor.fetchall()]
    print(f"Existing columns: {existing_columns}")
    
    # Add missing columns
    for column_name, column_type in columns_to_add:
        if column_name not in existing_columns:
            try:
                alter_sql = f"ALTER TABLE emergencies ADD COLUMN {column_name} {column_type}"
                print(f"Adding column: {alter_sql}")
                cursor.execute(alter_sql)
                print(f"✓ Added column {column_name}")
            except Exception as e:
                print(f"✗ Failed to add column {column_name}: {e}")
        else:
            print(f"- Column {column_name} already exists")
    
    conn.commit()
    
    # Verify the changes
    print("\nUpdated table structure:")
    cursor.execute("PRAGMA table_info(emergencies)")
    for row in cursor.fetchall():
        print(f"  {row[1]} {row[2]}")
    
    conn.close()
    print("\nDatabase migration completed!")

if __name__ == "__main__":
    migrate_emergency_table()
