import os

class Settings:
    PROJECT_NAME: str = "Raizul Forest Validator"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Validador forestal y análisis de deforestación para fincas cacaoteras con GFW."

    # URL base oficial de GFW Data API
    GFW_DATA_API_BASE: str = os.getenv(
        "GFW_DATA_API_BASE", "https://data-api.globalforestwatch.org"
    )
    
    # Llave pública de acceso a datasets de GFW
    GFW_API_KEY: str = os.getenv(
        "GFW_API_KEY", "092d42cf-281d-4da1-a7c6-96a9ecff6cb4"
    )

    # Cabecera de origen requerida por el cortafuegos de GFW
    GFW_ORIGIN_HEADER: str = os.getenv(
        "GFW_ORIGIN_HEADER", "https://www.globalforestwatch.org"
    )

    # Timeout en segundos para peticiones satelitales asíncronas
    GFW_TIMEOUT_SECONDS: float = float(os.getenv("GFW_TIMEOUT_SECONDS", "35.0"))

    # Configuración de red del servidor
    PORT: int = int(os.getenv("PORT", "8080"))
    HOST: str = os.getenv("HOST", "0.0.0.0")

settings = Settings()