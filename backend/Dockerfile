FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose port for FastAPI
EXPOSE 8000

# We need a start script or just separate commands for API and Worker.
# Default command for API:
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
