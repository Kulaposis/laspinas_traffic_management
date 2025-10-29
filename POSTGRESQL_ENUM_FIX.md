# PostgreSQL Enum Fix for Firebase Sync

## Problem
When migrating from SQLite to PostgreSQL, Firebase sync was failing with a 500 error:

```
sqlalchemy.exc.DataError: (psycopg2.errors.InvalidTextRepresentation) 
invalid input value for enum userrole: "CITIZEN"
```

## Root Cause
SQLAlchemy's default behavior with Python Enum columns is to use the **enum member NAME** (uppercase, e.g., `CITIZEN`) instead of the **enum VALUE** (lowercase, e.g., `citizen`).

PostgreSQL enum types are case-sensitive and were created with lowercase values:
- Database: `'citizen'`, `'lgu_staff'`, `'traffic_enforcer'`, `'admin'`
- SQLAlchemy was sending: `'CITIZEN'`, `'LGU_STAFF'`, etc.

## Solution
Modified the `User` model to explicitly tell SQLAlchemy to use enum **values** instead of names:

```python
# Before:
role = Column(Enum(UserRole, name='userrole', create_type=False), 
              default=UserRole.CITIZEN, nullable=False)

# After:
role = Column(Enum(UserRole, name='userrole', create_type=False, 
              values_callable=lambda obj: [e.value for e in obj]), 
              default=UserRole.CITIZEN, nullable=False)
```

## Files Changed
- `backend/app/models/user.py` - Added `values_callable` parameter to role Column

## Testing
Verified the fix works by:
1. Running `test_firebase_sync.py` - Successfully created user with Firebase UID
2. Backend server restarted and running without errors

## Next Steps
Test Firebase login from the frontend to confirm the 500 error is resolved.
