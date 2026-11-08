# DEPLOY.md — Raizul Forest Validator
**Documento técnico de despliegue**  
**Versión:** 1.0.0  
**Proyecto:** Raizul Forest Validator  
**Tecnologías:** Python 3.11 · FastAPI · Docker · Google Cloud Run  
**Integración externa:** Global Forest Watch Data API  
**Registro de imágenes:** Google Artifact Registry  
**Gestión de credenciales:** Google Secret Manager  
**Responsable:** Juan Bahos  
**Estado:** Documentación para revisión técnica.  

El presente documento describe el procedimiento para construir, configurar y desplegar el backend de Raizul Forest Validator en Google Cloud Run, utilizando contenedores Docker y servicios administrados de Google Cloud Platform.

Su propósito es proporcionar una guía reproducible para que cualquier desarrollador del equipo pueda preparar el entorno, publicar la imagen del backend, desplegar el servicio y verificar su funcionamiento.

---

## 1. Arquitectura y decisiones técnicas

El proyecto utiliza una arquitectura de separación entre frontend y backend. El backend se desarrolla con Python y FastAPI, mientras que la interfaz de usuario se implementa con React.

El backend es responsable de recibir las geometrías GeoJSON, validar la información geoespacial, consultar las fuentes de datos de Global Forest Watch y procesar los indicadores ambientales.

### 1.1. Componentes de infraestructura

| Componente | Tecnología | Responsabilidad |
| :--- | :--- | :--- |
| **Backend** | Python 3.11 + FastAPI | Procesamiento y API REST. |
| **Procesamiento geoespacial** | Shapely | Validación y operaciones sobre geometrías. |
| **Transformación geográfica** | PyProj | Reproyección cuando se conoce el CRS de origen. |
| **Cliente HTTP** | HTTPX | Comunicación con Global Forest Watch. |
| **Contenedorización** | Docker | Empaquetar el backend y sus dependencias. |
| **Registro de imágenes** | Artifact Registry | Almacenar las imágenes Docker. |
| **Despliegue** | Cloud Run | Ejecutar el contenedor de manera administrada. |
| **Gestión de secretos** | Secret Manager | Proteger las credenciales de acceso a GFW. |

### 1.2. Flujo de infraestructura

```
Código fuente del backend
       │
       ▼
  Dockerfile
       │
       ▼
 Docker Build
       │
       ▼
Imagen del backend
       │
       ▼
Artifact Registry
       │
       ▼
   Cloud Run
       │
       ▼
  URL pública API
```

Durante la ejecución, el backend se comunica con Global Forest Watch mediante solicitudes HTTP autenticadas.
Las credenciales necesarias se obtienen desde Secret Manager, evitando almacenarlas dentro del código fuente o de la imagen Docker.

### 1.3. Modelo de facturación

Google Cloud Run ofrece un modelo de ejecución bajo demanda, con escalado automático y posibilidad de reducir las instancias a cero cuando no existe tráfico, siempre que se configure `min-instances=0`.

El costo depende de la modalidad de facturación, las solicitudes y los recursos utilizados, como CPU y memoria.

Para este MVP se propone la siguiente configuración inicial:
* Una CPU.
* 1 GiB de memoria.
* Cero instancias mínimas.
* Diez instancias máximas.
* Timeout de 300 segundos.

Estos valores son configuraciones iniciales y podrán ajustarse según los resultados de las pruebas de carga.

---

## 2. Prerrequisitos

Antes de iniciar el despliegue, el desarrollador debe contar con los siguientes elementos:
1. Una cuenta activa en Google Cloud Platform.
2. Un proyecto de Google Cloud con facturación habilitada.
3. Google Cloud CLI (`gcloud`) instalada y actualizada.
4. Docker instalado y funcionando localmente, si se utilizará la compilación local.
5. Acceso al repositorio del proyecto.
6. Una API key válida de Global Forest Watch.
7. Permisos IAM para crear recursos y realizar el despliegue.

### 2.1. Permisos IAM

Los permisos se distribuyen según la responsabilidad de cada identidad:

| Rol IAM | Responsable | Propósito |
| :--- | :--- | :--- |
| `roles/run.admin` | Desarrollador | Administrar servicios de Cloud Run. |
| `roles/iam.serviceAccountUser` | Desarrollador | Asociar la cuenta de servicio al despliegue. |
| `roles/serviceusage.serviceUsageAdmin` | Administrador | Habilitar APIs de Google Cloud. |
| `roles/artifactregistry.admin` | Administrador del repositorio | Crear y administrar repositorios. |
| `roles/artifactregistry.writer` | Desarrollador o Cloud Build | Publicar imágenes Docker. |
| `roles/artifactregistry.reader` | Desplegador | Acceder a la imagen durante el despliegue. |
| `roles/secretmanager.admin` | Administrador | Crear y administrar secretos. |
| `roles/secretmanager.secretAccessor` | Cuenta de ejecución | Leer la API key durante la ejecución. |

No es necesario conceder todos estos permisos a una misma identidad. Se recomienda asignarlos según la tarea que desempeñe cada usuario o cuenta de servicio.

Google documenta estos requisitos en sus guías de [despliegue de Cloud Run](https://docs.cloud.google.com/run/docs/deploying) y [gestión de secretos](https://docs.cloud.google.com/run/docs/configuring/services/secrets).

---

## 3. Variables de configuración

Para facilitar la ejecución de los comandos, se definirán variables que identifican el proyecto, la región, el repositorio y el servicio.
Los siguientes valores son ejemplos y deben reemplazarse por los correspondientes al entorno de Raizul.

### 3.1. Configuración en Bash o Google Cloud Shell
```bash
export PROJECT_ID="tu-proyecto-gcp"
export REGION="us-central1"
export REPO_NAME="raizul-repo"
export IMAGE_NAME="forest-validator-backend"
export TAG="v1.0.0"
export SERVICE_NAME="raizul-forest-validator"
export RUNTIME_SA="raizul-run-sa@${PROJECT_ID}.iam.gserviceaccount.com"
export FRONTEND_ORIGIN="https://tu-dominio-frontend.com"
```

### 3.2. Configuración en PowerShell
```powershell
$env:PROJECT_ID="tu-proyecto-gcp"
$env:REGION="us-central1"
$env:REPO_NAME="raizul-repo"
$env:IMAGE_NAME="forest-validator-backend"
$env:TAG="v1.0.0"
$env:SERVICE_NAME="raizul-forest-validator"
$env:RUNTIME_SA="raizul-run-sa@$($env:PROJECT_ID).iam.gserviceaccount.com"
$env:FRONTEND_ORIGIN="https://tu-dominio-frontend.com"
```

**Nota:** la región `us-central1` es una selección de ejemplo. El equipo puede elegir otra región disponible, considerando latencia, costos y requisitos de infraestructura. Artifact Registry y Cloud Run deberán utilizar una región compatible y coherente.

La etiqueta `v1.0.0` permite identificar la versión de la imagen que se está desplegando. Para nuevas entregas se recomienda incrementar la versión.

---

## 4. Preparación del entorno de Google Cloud

### Paso 1. Autenticación y selección del proyecto
Primero se autentica la cuenta que realizará el despliegue.

**Bash:**
```bash
gcloud auth login
gcloud config set project "$PROJECT_ID"
```

**PowerShell:**
```powershell
gcloud auth login
gcloud config set project $env:PROJECT_ID
```

Para comprobar el proyecto activo:
```bash
gcloud config get-value project
```

---

### Paso 2. Habilitar las APIs necesarias
Es necesario habilitar los servicios que utilizaremos durante el proceso.

**Bash:**
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com
```

**PowerShell:**
```powershell
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com
```

Estas APIs permiten administrar Cloud Run, publicar imágenes, gestionar secretos y utilizar Cloud Build.

---

### Paso 3. Crear la cuenta de servicio de ejecución
Se utilizará una cuenta dedicada para ejecutar el contenedor.
Esta identidad permitirá que el backend acceda exclusivamente a los recursos autorizados.

**Bash:**
```bash
gcloud iam service-accounts create raizul-run-sa \
  --display-name="Raizul Cloud Run Runtime SA"
```

**PowerShell:**
```powershell
gcloud iam service-accounts create raizul-run-sa --display-name="Raizul Cloud Run Runtime SA"
```

La cuenta creada tendrá el siguiente formato:
`raizul-run-sa@PROJECT_ID.iam.gserviceaccount.com`

El desarrollador encargado del despliegue debe contar con el permiso `roles/iam.serviceAccountUser` sobre esta identidad.

Ejemplo en Bash, reemplazando el correo del desarrollador:
```bash
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="user:CORREO_DEL_DESARROLLADOR" \
  --role="roles/iam.serviceAccountUser"
```

---

## 5. Configuración de Google Secret Manager

La API key de Global Forest Watch es una credencial privada.
Por seguridad, no debe almacenarse directamente en el código Python, en el repositorio público ni en las instrucciones de despliegue.
Para protegerla se utilizará Google Secret Manager.

### Paso 1. Crear el secreto
Este comando se ejecuta una sola vez:

**Bash:**
```bash
gcloud secrets create gfw-api-key \
  --replication-policy="automatic"
```

**PowerShell:**
```powershell
gcloud secrets create gfw-api-key --replication-policy="automatic"
```

Si el secreto ya existe, no es necesario volver a crearlo.

---

### Paso 2. Agregar la API key
Se incorporará una versión del secreto utilizando la credencial válida de Global Forest Watch.

**Bash:**
```bash
read -rsp "Introduce la API key de GFW: " GFW_API_KEY
printf '\n'
printf '%s' "$GFW_API_KEY" | gcloud secrets versions add gfw-api-key --data-file=-
unset GFW_API_KEY
```

**PowerShell:**
```powershell
$secret = Read-Host "Introduce la API key de GFW" -AsSecureString
$pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
$tempFile = Join-Path $env:TEMP "gfw-api-key.txt"
try {
    $plainKey = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    [System.IO.File]::WriteAllText($tempFile, $plainKey)
    gcloud secrets versions add gfw-api-key --data-file="$tempFile"
    if ($LASTEXITCODE -ne 0) { throw "No fue posible agregar la versión del secreto." }
} finally {
    if ($pointer -ne [IntPtr]::Zero) {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    Remove-Variable plainKey -ErrorAction SilentlyContinue
}
```

El archivo temporal se crea fuera del repositorio y se elimina después de agregar el secreto.

---

### Paso 3. Conceder acceso al secreto
La cuenta de servicio de Cloud Run necesita autorización para recuperar la API key.

**Bash:**
```bash
gcloud secrets add-iam-policy-binding gfw-api-key \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/secretmanager.secretAccessor"
```

**PowerShell:**
```powershell
gcloud secrets add-iam-policy-binding gfw-api-key `
  --member="serviceAccount:$env:RUNTIME_SA" `
  --role="roles/secretmanager.secretAccessor"
```

Se utilizará la versión 1 del secreto en el despliegue.
La fijación de una versión específica permite mantener un comportamiento reproducible entre revisiones. Google Cloud recomienda utilizar versiones explícitas cuando los secretos se inyectan como variables de entorno.

---

## 6. Crear el repositorio en Artifact Registry

Artifact Registry almacenará la imagen Docker que posteriormente ejecutará Cloud Run.

### Paso 1. Crear el repositorio

**Bash:**
```bash
gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Repositorio Docker para Raizul Forest Validator"
```

**PowerShell:**
```powershell
gcloud artifacts repositories create $env:REPO_NAME --repository-format=docker --location=$env:REGION --description="Repositorio Docker para Raizul Forest Validator"
```

Este comando se ejecuta al crear el repositorio por primera vez. Si ya existe, se debe reutilizar y no intentar crearlo nuevamente.

---

### Paso 2. Configurar la autenticación de Docker
Docker necesita autenticarse para publicar imágenes en Artifact Registry.

**Bash:**
```bash
gcloud auth configure-docker "${REGION}-docker.pkg.dev"
```

**PowerShell:**
```powershell
gcloud auth configure-docker "$($env:REGION)-docker.pkg.dev"
```

La autenticación utiliza el mecanismo de credenciales de Google Cloud CLI. No es necesario crear una clave permanente de cuenta de servicio para realizar el `docker push` desde el equipo local.

---

## 7. Construcción de la imagen Docker

Antes de subir la imagen, debe existir un Dockerfile dentro del directorio backend.

### 7.1. Estructura esperada

```text
validador-forestal/
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .dockerignore
│   ├── main.py
│   ├── config.py
│   ├── geospatial.py
│   ├── schemas/
│   │   └── geojson_models.py
│   └── services/
│       └── gfw_service.py
│
├── frontend/
├── examples/
│   └── finca-prueba.geojson
├── docker-compose.yml
└── DEPLOY.md
```

### 7.2. Dockerfile

Contenido del archivo `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

# Dependencias mínimas requeridas por librerías geoespaciales (Shapely/GEOS) y probes
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgeos-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Crear usuario sin privilegios administrativos
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser

# Copiar e instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copiar código del backend
COPY . .

# Asignar permisos al usuario no root
RUN chown -R appuser:appgroup /app

# Ejecutar el contenedor con usuario no privilegiado
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Iniciar FastAPI utilizando el puerto de Cloud Run
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
```

El contenedor inicia Uvicorn y ejecuta la aplicación FastAPI.
La variable `PORT` permite que Cloud Run determine el puerto de comunicación del contenedor.
El uso de un usuario sin privilegios administrativos mejora el aislamiento del proceso.

### 7.3. Archivo requirements.txt

Las dependencias deben corresponder con las versiones probadas localmente:
```text
fastapi>=0.110.0,<1.0.0
uvicorn[standard]>=0.28.0,<1.0.0
pydantic>=2.6.0,<3.0.0
httpx>=0.27.0,<1.0.0
shapely>=2.0.0,<3.0.0
python-dotenv>=1.0.0,<2.0.0
pytest>=8.0.0,<9.0.0
pytest-asyncio>=0.23.0,<1.0.0
```

### 7.4. Archivo .dockerignore

Para evitar incluir archivos innecesarios o sensibles en la imagen, el archivo `backend/.dockerignore` contiene:
```text
.venv/
venv/
__pycache__/
*.pyc
*.pyo
*.pyd
.env
.env.*
!.env.example
.git/
.gitignore
.pytest_cache/
.mypy_cache/
*.log
gfw-api-key.txt
```

La API key no debe copiarse dentro del contenedor.

---

## 8. Construcción, etiquetado y publicación de la imagen

Una vez preparado el Dockerfile, se construirá la imagen y se publicará en Artifact Registry.
La dirección de la imagen seguirá esta estructura:
`REGION-docker.pkg.dev/PROJECT_ID/REPO_NAME/IMAGE_NAME:TAG`

### Opción A. Construcción mediante Docker local
Es la opción recomendada cuando Docker está instalado y funcionando correctamente.

**Bash:**
```bash
# Construir la imagen
docker build \
  -t "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:$TAG" \
  ./backend

# Publicar la imagen
docker push \
  "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:$TAG"
```

**PowerShell:**
```powershell
$image = "$($env:REGION)-docker.pkg.dev/$($env:PROJECT_ID)/$($env:REPO_NAME)/$($env:IMAGE_NAME):$($env:TAG)"
docker build -t $image ./backend
if ($LASTEXITCODE -ne 0) { throw "Falló la construcción de Docker." }
docker push $image
if ($LASTEXITCODE -ne 0) { throw "Falló la publicación en Artifact Registry." }
```

### Opción B. Construcción mediante Google Cloud Build
Si el equipo no dispone de Docker local o prefiere construir las imágenes en la infraestructura de Google Cloud, puede utilizar Cloud Build.

**Bash:**
```bash
gcloud builds submit ./backend \
  --tag "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:$TAG"
```

**PowerShell:**
```powershell
gcloud builds submit ./backend --tag "$($env:REGION)-docker.pkg.dev/$($env:PROJECT_ID)/$($env:REPO_NAME)/$($env:IMAGE_NAME):$($env:TAG)"
```

Para esta alternativa, la identidad que ejecuta Cloud Build debe tener permisos de escritura en el repositorio de Artifact Registry.
La publicación mediante Cloud Build permite realizar la construcción sin depender del motor Docker local.

---

## 9. Despliegue del backend en Google Cloud Run

Una vez publicada la imagen, se procederá a crear el servicio en Cloud Run.

### 9.1. Configuración del despliegue

| Parámetro | Valor |
| :--- | :--- |
| **Servicio** | `raizul-forest-validator` |
| **Región** | `us-central1` |
| **Puerto** | `8080` |
| **CPU** | `1` |
| **Memoria** | `1Gi` |
| **Instancias mínimas** | `0` |
| **Instancias máximas** | `10` |
| **Timeout** | `300s` |
| **Autenticación** | Acceso público para el MVP |

### 9.2. Comando de despliegue en Bash
```bash
gcloud run deploy "$SERVICE_NAME" \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:$TAG" \
  --region="$REGION" \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=300s \
  --service-account="$RUNTIME_SA" \
  --set-secrets="GFW_API_KEY=gfw-api-key:1" \
  --set-env-vars="GFW_DATA_API_BASE=https://data-api.globalforestwatch.org,GFW_ORIGIN_HEADER=$FRONTEND_ORIGIN,GFW_DATASET=umd_tree_cover_loss,GFW_DATASET_VERSION=latest,ALLOWED_ORIGINS=$FRONTEND_ORIGIN"
```

### 9.3. Comando de despliegue en PowerShell
```powershell
$image = "$($env:REGION)-docker.pkg.dev/$($env:PROJECT_ID)/$($env:REPO_NAME)/$($env:IMAGE_NAME):$($env:TAG)"
gcloud run deploy $env:SERVICE_NAME `
  --image=$image `
  --region=$env:REGION `
  --allow-unauthenticated `
  --port=8080 `
  --memory=1Gi `
  --cpu=1 `
  --min-instances=0 `
  --max-instances=10 `
  --timeout=300s `
  --service-account=$env:RUNTIME_SA `
  --set-secrets="GFW_API_KEY=gfw-api-key:1" `
  --set-env-vars="GFW_DATA_API_BASE=https://data-api.globalforestwatch.org,GFW_ORIGIN_HEADER=$($env:FRONTEND_ORIGIN),GFW_DATASET=umd_tree_cover_loss,GFW_DATASET_VERSION=latest,ALLOWED_ORIGINS=$($env:FRONTEND_ORIGIN)"
```

**Nota de configuración:** los nombres de variables de entorno deben coincidir exactamente con los que lee `config.py`. Las variables `GFW_DATASET`, `GFW_DATASET_VERSION` y `ALLOWED_ORIGINS` deben estar implementadas en la configuración del backend. Si el servicio de alertas utiliza variables adicionales, también deben añadirse al despliegue.

### 9.4. Descripción de los parámetros

| Parámetro | Descripción |
| :--- | :--- |
| `--image` | Imagen Docker almacenada en Artifact Registry. |
| `--region` | Región de ejecución del servicio. |
| `--allow-unauthenticated` | Permite solicitudes públicas para el MVP. |
| `--port` | Puerto de escucha del contenedor. |
| `--memory` | Memoria RAM disponible por instancia. |
| `--cpu` | Recursos de procesamiento asignados. |
| `--min-instances` | Número mínimo de instancias. |
| `--max-instances` | Límite máximo de instancias. |
| `--timeout` | Tiempo máximo permitido para una solicitud. |
| `--service-account` | Identidad de ejecución del contenedor. |
| `--set-secrets` | Inyecta la API key desde Secret Manager. |
| `--set-env-vars` | Configura las variables de entorno del backend. |

Cloud Run creará una nueva revisión del servicio y mostrará su URL cuando el despliegue finalice correctamente.

---

## 10. Verificación del despliegue

Una vez completado el despliegue, se debe comprobar que Cloud Run esté ejecutando correctamente el backend.

### 10.1. Obtener la URL del servicio

**Bash:**
```bash
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --format="value(status.url)")
echo "Servicio disponible en: $SERVICE_URL"
```

**PowerShell:**
```powershell
$env:SERVICE_URL = gcloud run services describe $env:SERVICE_NAME --region=$env:REGION --format="value(status.url)"
Write-Host "Servicio disponible en: $env:SERVICE_URL"
```

### 10.2. Comprobar el Health Check

El backend debe implementar una ruta de comprobación de estado:
```python
@app.get("/health")
async def health():
    return {"status": "healthy"}
```

Ejecutar:
```bash
curl -i "$SERVICE_URL/health"
```

Respuesta esperada:
```json
{ "status": "healthy" }
```
El código HTTP debe ser **200 OK**.
Esta comprobación permite verificar que el contenedor está activo, aunque no demuestra por sí sola que la conexión con GFW funcione.

### 10.3. Probar el endpoint principal

El endpoint que se debe verificar es:
`POST /analisis-forestal`

La solicitud utilizará el formato GeoJSON definido para Raizul.
Ejemplo de archivo `examples/finca-prueba.geojson`:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [-76.5300, 3.4500],
        [-76.5200, 3.4600],
        [-76.5100, 3.4400],
        [-76.5300, 3.4500]
      ]
    ]
  },
  "properties": {
    "farm_id": "finca_el_paraiso_01"
  }
}
```

**Bash:**
```bash
curl -i -X POST "$SERVICE_URL/analisis-forestal" \
  -H "Content-Type: application/json" \
  --data-binary "@examples/finca-prueba.geojson"
```

**PowerShell:**
```powershell
curl.exe -i -X POST "$env:SERVICE_URL/analisis-forestal" `
  -H "Content-Type: application/json" `
  --data-binary "@examples/finca-prueba.geojson"
```

### 10.4. Validaciones de la respuesta

La respuesta debe respetar el contrato de salida acordado con Raizul:

| Campo | Validación |
| :--- | :--- |
| `farm_id` | Debe coincidir con el identificador recibido. |
| `polygon_valid` | Debe ser verdadero cuando la geometría haya sido validada. |
| `area_hectares` | Debe contener el área calculada o proporcionada por una fuente verificada. |
| `current_tree_cover_pct` | Debe proceder de una fuente de cobertura arbórea y metodología documentadas. |
| `deforestation_risk_level` | Debe ser calculado mediante criterios definidos por el proyecto. |
| `critical_alert` | Debe derivarse de reglas aplicadas a alertas reales. |
| `tree_cover_loss_history` | Debe contener los resultados históricos consultados en GFW. |
| `analysis_timestamp` | Debe registrar la fecha y hora UTC del análisis. |

Los resultados numéricos dependerán del polígono y de los datasets consultados. No deben utilizarse datos estáticos o simulados para presentar la integración como exitosa.
Para considerar la integración funcional, debe verificarse la consulta real de las capas necesarias y la procedencia de cada indicador.

### 10.5. Documentación interactiva

FastAPI proporciona automáticamente documentación interactiva.
Una vez desplegado el servicio, se podrá acceder a:

| Recurso | URL |
| :--- | :--- |
| Swagger UI | `https://URL-DEL-SERVICIO/docs` |
| ReDoc | `https://URL-DEL-SERVICIO/redoc` |
| OpenAPI JSON | `https://URL-DEL-SERVICIO/openapi.json` |

Desde Swagger UI se pueden probar los endpoints directamente.

---

## 11. Monitoreo y consulta de logs

Cloud Run permite consultar los registros generados por el backend para identificar problemas de ejecución, errores HTTP y fallos de comunicación con servicios externos.

### 11.1. Monitoreo en tiempo real

Para visualizar los registros en tiempo real:
```bash
gcloud beta run services logs tail "$SERVICE_NAME" --region="$REGION"
```

En PowerShell:
```powershell
gcloud beta run services logs tail $env:SERVICE_NAME --region=$env:REGION
```

### 11.2. Consultar registros recientes
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"
```

### 11.3. Consultar errores
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND severity>=ERROR" \
  --limit=20
```

Los registros deben permitir identificar:
* Solicitudes recibidas.
* Errores de validación GeoJSON.
* Fallos de autenticación con GFW.
* Errores HTTP de servicios externos.
* Problemas durante el procesamiento de geometrías.
* Errores internos del backend.

**Consideración de seguridad:** nunca deben registrarse API keys, encabezados de autenticación ni credenciales en los logs.

---

## 12. Solución de problemas comunes

| Error | Posible causa | Solución |
| :--- | :--- | :--- |
| **Permission denied on Artifact Registry** | La identidad no tiene permisos sobre el repositorio. | Revisar roles IAM y ejecutar `gcloud auth configure-docker` para publicación local. |
| **Permission denied on secret** | La cuenta de ejecución no puede leer el secreto. | Comprobar `roles/secretmanager.secretAccessor`. |
| **Container failed to start** | Error en el Dockerfile, imports o comando de inicio. | Revisar logs, ruta de Uvicorn y variable `PORT`. |
| **Health Check failed** | La aplicación no está escuchando en `0.0.0.0` o no inicia correctamente. | Revisar comando de inicio y puerto. |
| **422 Unprocessable Entity** | GeoJSON inválido o estructura no compatible con el contrato. | Comprobar el tipo de geometría, coordenadas y cierre de anillos. |
| **401 Unauthorized** | API key ausente, inválida o revocada. | Verificar Secret Manager y la credencial de GFW. |
| **403 Forbidden** | Restricciones de acceso, origen o permisos insuficientes. | Revisar la configuración de GFW y las autorizaciones. |
| **502 Bad Gateway** | El backend recibió una respuesta no válida de un servicio externo. | Revisar los logs y la respuesta de GFW. |
| **504 Gateway Timeout** | La consulta externa tardó más de lo permitido. | Revisar los timeouts de HTTPX y Cloud Run. |
| **CORS error** | El frontend no está autorizado para consumir el backend. | Revisar `ALLOWED_ORIGINS` y la configuración de `CORSMiddleware`. |
| **Repository already exists** | El repositorio ya fue creado previamente. | Reutilizar el repositorio existente. |
| **Secret already exists** | El secreto ya está registrado. | Agregar una nueva versión en lugar de crearlo nuevamente. |

---

## 13. Consideraciones de seguridad y operación

Para mantener un entorno seguro y reproducible se establecen las siguientes prácticas:

1. **Gestión de credenciales:**  
   La API key de Global Forest Watch debe almacenarse en Secret Manager. No debe incluirse en el repositorio, Dockerfile, imagen Docker o archivos públicos de configuración.
2. **Control de acceso:**  
   La cuenta de servicio de Cloud Run debe tener únicamente los permisos necesarios para ejecutar el backend y consultar los secretos.
3. **Configuración de producción:**  
   Los valores sensibles y los parámetros de configuración deben administrarse mediante variables de entorno y servicios de Google Cloud.
4. **Registro de eventos:**  
   Los logs deben permitir diagnosticar problemas sin almacenar información confidencial.
5. **Versionado de imágenes:**  
   Cada entrega debe utilizar una etiqueta identificable, como `v1.0.0`, `v1.0.1` o `v1.1.0`.
6. **Protección del endpoint público:**  
   Durante el MVP se permite acceso público para facilitar las pruebas. Para una futura operación productiva se recomienda implementar autenticación, autorización y controles de frecuencia de solicitudes.
7. **Consistencia de datos:**  
   Los indicadores forestales deben proceder de consultas reales a Global Forest Watch o de cálculos propios claramente documentados. Cuando una consulta falle, el backend debe distinguir entre información no disponible y ausencia real de registros.

---

## 14. Referencias oficiales

La siguiente documentación se utiliza como referencia para reproducir el procedimiento:

| Documentación | Enlace |
| Google Cloud Run — Despliegue de contenedores | [Consultar documentación](https://docs.cloud.google.com/run/docs/deploying) |
| Cloud Run — Configuración de secretos | [Consultar documentación](https://docs.cloud.google.com/run/docs/configuring/services/secrets) |
| Google Secret Manager | [Consultar documentación](https://docs.cloud.google.com/secret-manager/docs) |
| Artifact Registry — Autenticación Docker | [Consultar documentación](https://docs.cloud.google.com/artifact-registry/docs/docker/authentication) |
| Google Cloud Build | [Consultar documentación](https://docs.cloud.google.com/build/docs) |
| Global Forest Watch — Data API | [Consultar documentación](https://data-api.globalforestwatch.org/docs) |
| GeoJSON RFC 7946 | [Consultar estándar](https://www.rfc-editor.org/rfc/rfc7946) |

---

**Fin del documento.**
