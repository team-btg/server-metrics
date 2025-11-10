# 1️⃣ Use official Python base image
FROM python:3.11-slim

# 2️⃣ Set working directory
WORKDIR /app

# 3️⃣ Install system dependencies needed for Postgres / Cloud SQL
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 4️⃣ Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5️⃣ Copy the application code
COPY . .

# 6️⃣ Expose port for Cloud Run
EXPOSE 8080

# 7️⃣ Default entrypoint (your web server)
# Use the "shell form" of CMD so that the $PORT environment variable is processed.
CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT --workers 1 --proxy-headers
