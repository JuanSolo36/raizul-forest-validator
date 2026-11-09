import os
from dotenv import load_dotenv

# Cargar variables de entorno desde archivo .env local si existe
load_dotenv()


class Settings:
    PROJECT_NAME: str = "Raizul Forest Validator"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Validador forestal y análisis de deforestación para fincas cacaoteras con GFW."

    # URL base oficial de GFW Data API
    GFW_DATA_API_BASE: str = os.getenv(
        "GFW_DATA_API_BASE", "https://data-api.globalforestwatch.org"
    )

    # Llave de acceso a datasets de GFW (se inyecta por Secret Manager o .env; nunca hardcodeada)
    GFW_API_KEY: str = os.getenv("GFW_API_KEY", "")

    # Cabecera de origen requerida por el cortafuegos de GFW
    GFW_ORIGIN_HEADER: str = os.getenv(
        "GFW_ORIGIN_HEADER", "https://www.globalforestwatch.org"
    )

    # Datasets satelitales configurables
    GFW_DATASET: str = os.getenv("GFW_DATASET", "umd_tree_cover_loss")
    GFW_DATASET_VERSION: str = os.getenv("GFW_DATASET_VERSION", "latest")

    # Timeout en segundos para peticiones satelitales asíncronas
    GFW_TIMEOUT_SECONDS: float = float(os.getenv("GFW_TIMEOUT_SECONDS", "35.0"))

    # Orígenes permitidos para CORS (alineado con DEPLOY.md)
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "*")

    # Configuración de red del servidor (enlace dinámico a $PORT en Cloud Run)
    PORT: int = int(os.getenv("PORT", "8080"))
    HOST: str = os.getenv("HOST", "0.0.0.0")


settings = Settings()
