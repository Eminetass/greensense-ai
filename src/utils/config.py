import os
from dotenv import load_dotenv

# ---------------------------------------------------------
# Load environment variables from .env
# ---------------------------------------------------------
load_dotenv()

# ---------------------------------------------------------
# BASE DIRECTORIES
# ---------------------------------------------------------
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))

DATA_DIR = os.path.join(BASE_DIR, "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")
FEATURE_DIR = os.path.join(DATA_DIR, "features")

MODEL_DIR = os.path.join(BASE_DIR, "models")
LOG_DIR = os.path.join(BASE_DIR, "logs")

# ---------------------------------------------------------
# Create directories if they don't exist
# ---------------------------------------------------------
for path in [DATA_DIR, RAW_DIR, PROCESSED_DIR, FEATURE_DIR, MODEL_DIR, LOG_DIR]:
    os.makedirs(path, exist_ok=True)

# ---------------------------------------------------------
# GRID SETTINGS
# 0.01 degree ≈ 1 km resolution (projede kullanılacak grid boyutu)
# ---------------------------------------------------------
GRID_SIZE = float(os.getenv("GRID_SIZE", 0.01))

# ---------------------------------------------------------
# API KEYS FROM .env
# ---------------------------------------------------------
NASA_API_KEY = os.getenv("NASA_API_KEY")
NOAA_TOKEN = os.getenv("NOAA_TOKEN")

# ---------------------------------------------------------
# OTHER GLOBAL SETTINGS
# ---------------------------------------------------------
DEFAULT_REGION = os.getenv("DEFAULT_REGION", "Sason")
