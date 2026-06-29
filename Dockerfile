# DataMart SIS — FastAPI Backend
FROM python:3.12-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update -qq && apt-get install -y -qq gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY web/        ./web/
COPY sql/        ./sql/
COPY airflow/dags/ ./airflow/dags/

# Crear directorios necesarios
RUN mkdir -p /app/cache /app/web/frontend/dist

ENV DATABASE_URL=""
ENV PYTHONUNBUFFERED=1

EXPOSE 8080
CMD ["uvicorn", "web.app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
