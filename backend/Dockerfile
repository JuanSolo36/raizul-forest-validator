# ==============================================================================
# Dockerfile para Backend FastAPI - Raizul Forest Validator
# Diseñado y optimizado para despliegue serverless en Google Cloud Run
# ==============================================================================

FROM python:3.11-slim

LABEL maintainer="Juan Bahos <juan.bahos@raizul.com>"
LABEL description="Backend FastAPI para validación forestal y monitoreo de fincas cacaoteras con GFW"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

# Dependencias del sistema requeridas por librerías geoespaciales (GEOS/Shapely) y probes
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgeos-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario sin privilegios por seguridad
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser

WORKDIR /app

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente
COPY . .

# Asignar permisos al usuario no root
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Comando de ejecución con soporte dinámico para la variable $PORT de Google Cloud Run
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT}"]