import sqlite3
import os

db_path = 'traffic_management.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    print('Tables in database:')
    for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'"):
        print(f'  {row[0]}')
    
    # Check emergencies table structure if it exists
    try:
        cursor = conn.execute("PRAGMA table_info(emergencies)")
        columns = cursor.fetchall()
        if columns:
            print('\nEmergencies table structure:')
            for col in columns:
                print(f'  {col[1]} {col[2]}')
    except:
        print('  emergencies table not found')
    
    conn.close()
else:
    print(f'Database file {db_path} does not exist')
