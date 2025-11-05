from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# Database configuration - MUST use Supabase (no localhost fallback)
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL environment variable is required. "
        "Please set it to your Supabase PostgreSQL connection string. "
        "Example: postgresql://postgres.xgjferkrcsecctzlloqh:password@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
    )

# Ensure we're using Supabase (not localhost)
if "localhost" in DATABASE_URL or "127.0.0.1" in DATABASE_URL:
    raise ValueError(
        "Localhost database connections are not allowed. "
        "Please use your Supabase PostgreSQL connection string in DATABASE_URL."
    )

# OLD LOCALHOST FALLBACK (COMMENTED OUT - USE SUPABASE ONLY):
# DATABASE_URL = os.getenv(
#     "DATABASE_URL",
#     "postgresql://traffic_user:traffic_password@localhost:5432/traffic_management"  # Default PostgreSQL for production
# )

# If using Supabase or Leapcell pooled Postgres, enforce SSL and add sslmode=require if missing
if ("supabase.co" in DATABASE_URL or "supabase.com" in DATABASE_URL or "leapcellpool.com" in DATABASE_URL) and "sslmode=" not in DATABASE_URL:
    sep = "&" if "?" in DATABASE_URL else "?"
    DATABASE_URL = f"{DATABASE_URL}{sep}sslmode=require"

# Handle different database types - ONLY PostgreSQL (Supabase) is allowed
if not DATABASE_URL.startswith("postgresql"):
    raise ValueError(
        f"Only PostgreSQL (Supabase) databases are supported. "
        f"SQLite and other database types are disabled. "
        f"Current DATABASE_URL starts with: {DATABASE_URL[:20]}..."
    )

# Fast fail and keepalive for serverless / remote Postgres (Supabase)
connect_args = {
    "connect_timeout": 5,
    "keepalives": 1,
    "keepalives_idle": 30,
    "keepalives_interval": 10,
    "keepalives_count": 3,
}
if "sslmode=require" in DATABASE_URL:
    connect_args["sslmode"] = "require"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=5,
    max_overflow=10,
    echo=False,
    connect_args=connect_args,
)

# OLD SQLITE CONFIGURATION (COMMENTED OUT - USE SUPABASE ONLY):
# else:
#     # SQLite configuration
#     engine = create_engine(
#         DATABASE_URL,
#         connect_args={"check_same_thread": False},
#         pool_pre_ping=True
#     )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency for database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
