# --- Builder Stage ---
# Use a slim Python image to build dependencies
FROM python:3.11-slim as builder

WORKDIR /app

# Install build-time dependencies if any
# For example, if you need gcc for some packages
# RUN apt-get update && apt-get install -y build-essential

# Copy only the requirements file to leverage Docker's cache
COPY requirements.txt .

# Install dependencies into a temporary location
RUN pip wheel --no-cache-dir --wheel-dir /app/wheels -r requirements.txt


# --- Final Stage ---
# Use a fresh slim image for the final container to keep it small
FROM python:3.11-slim

WORKDIR /app

# Copy the pre-built wheels from the builder stage
COPY --from=builder /app/wheels /wheels

# Install the dependencies from the local wheels
RUN pip install --no-cache /wheels/*

# Copy your application code
COPY ./alembic ./alembic
COPY ./backend ./backend
COPY alembic.ini .
 
# This is required by Cloud Run, which provides the $PORT environment variable. 
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8080", "backend.main:app"]
