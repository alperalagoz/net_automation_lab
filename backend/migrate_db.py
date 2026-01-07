import sqlite3
import datetime


conn = sqlite3.connect('/home/alper/auto_project/backend/app.db')
cursor = conn.cursor()


try:
    cursor.execute("ALTER TABLE task_results ADD COLUMN created_at DATETIME")
    print("Column 'created_at' added successfully.")
    
    
    now = datetime.datetime.utcnow()
    cursor.execute("UPDATE task_results SET created_at = ?", (now,))
    print(f"Updated existing rows with timestamp: {now}")
    
    conn.commit()
except sqlite3.OperationalError as e:
    print(f"Operation failed (maybe column exists?): {e}")

conn.close()
