import sqlite3
import os

def check_and_fix_complaints_table():
    """Check and fix the complaints_suggestions table structure"""
    
    db_path = 'traffic_management.db'
    if not os.path.exists(db_path):
        print(f"Database file {db_path} does not exist")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check existing columns
    cursor.execute("PRAGMA table_info(complaints_suggestions)")
    existing_columns = [row[1] for row in cursor.fetchall()]
    print(f"Existing complaints_suggestions columns: {existing_columns}")
    
    # Expected columns from the model
    expected_columns = [
        ("evidence_urls", "TEXT"),  # For photo/video attachments
        ("is_anonymous", "BOOLEAN DEFAULT 0")
    ]
    
    # Add missing columns
    for column_name, column_type in expected_columns:
        if column_name not in existing_columns:
            try:
                alter_sql = f"ALTER TABLE complaints_suggestions ADD COLUMN {column_name} {column_type}"
                print(f"Adding column: {alter_sql}")
                cursor.execute(alter_sql)
                print(f"✓ Added column {column_name}")
            except Exception as e:
                print(f"✗ Failed to add column {column_name}: {e}")
        else:
            print(f"- Column {column_name} already exists")
    
    conn.commit()
    
    # Verify the changes
    print("\nUpdated complaints_suggestions table structure:")
    cursor.execute("PRAGMA table_info(complaints_suggestions)")
    for row in cursor.fetchall():
        print(f"  {row[1]} {row[2]}")
    
    conn.close()
    print("\nComplaints table check completed!")

if __name__ == "__main__":
    check_and_fix_complaints_table()
