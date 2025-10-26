FROM python:3.11-slim

WORKDIR /app

# Create a non-root user
RUN useradd -m appuser
USER appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY agent.py .

CMD ["python", "agent.py"]
