import os
from logging.config import fileConfig
from sqlalchemy import create_engine, pool
from alembic import context

# Alembic Config
config = context.config

# Set up logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import metadata from your models
from backend.models import Base
target_metadata = Base.metadata

# ---------------------------------------------------------------------
# 🧩 DATABASE URL RESOLUTION
# ---------------------------------------------------------------------
def get_database_url():
    """
    Return the SQLAlchemy database URL.
    Priority:
      1. DATABASE_URL from environment (Secret Manager or local dev)
    """
    database_url = os.environ["DATABASE_URL"] 
    if not database_url:
        raise RuntimeError(
            "❌ DATABASE_URL is not set. "
            "Ensure the secret is correctly configured in Secret Manager or .env file."
        )
    return database_url

# Get final URL
url = get_database_url()
 
# ---------------------------------------------------------------------
# 🏃 Migration Runners
# ---------------------------------------------------------------------
def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    """Run migrations in 'online' mode.""" 
    connectable = create_engine(url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

# ---------------------------------------------------------------------
# 🚀 Entrypoint
# ---------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
