import os
import time
import requests
from requests.exceptions import RequestException
import pandas as pd
from tqdm import tqdm

# 1) Giriş dosyamız: districts_base.csv
DISTRICTS_PATH = "data/interim/districts_base.csv"

# 2) Çıktı klasörü
OUTPUT_DIR = "data/raw/climate_nasa_power"
os.makedirs(OUTPUT_DIR, exist_ok=True)

OUTPUT_CSV = os.path.join(OUTPUT_DIR, "districts_monthly_2014_2023.csv")

# 3) Parametreler
START_YEAR = 2014
END_YEAR = 2023  # 10 yıl

PARAMETERS = "T2M,PRECTOT"   # Sıcaklık + yağış
COMMUNITY = "AG"             # Agriculture community (tarım)
FORMAT = "JSON"

BASE_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"

def load_districts():
    df = pd.read_csv(DISTRICTS_PATH)
    # Emin olalım bu kolonlar var:
    required_cols = {"province_name", "district_name", "lat", "lon"}
    if not required_cols.issubset(df.columns):
        raise ValueError(f"districts_base.csv şu kolonlara sahip olmalı: {required_cols}")
    return df

districts_df = load_districts()
print("İlçe sayısı:", len(districts_df))

def fetch_nasa_power_monthly(lat, lon, start_year=START_YEAR, end_year=END_YEAR):
    """
    Verilen lat/lon için NASA POWER'dan 2014-2023 arası aylık T2M ve PRECTOT verisini çeker.
    3 kez deneme yapar. Başarısız olursa None döner.
    """
    params = {
        "parameters": PARAMETERS,
        "community": COMMUNITY,
        "latitude": lat,
        "longitude": lon,
        "start": start_year,
        "end": end_year,
        "format": FORMAT,
    }

    for attempt in range(3):  # en fazla 3 deneme
        try:
            response = requests.get(BASE_URL, params=params, timeout=60)
            response.raise_for_status()  # HTTP 4xx/5xx hata ise exception atar

            data = response.json()
            return data

        except RequestException as e:
            print(f"[HATA] NASA isteği başarısız (lat={lat}, lon={lon}), deneme {attempt+1}/3: {e}")
            # Biraz bekle, sonra tekrar dene
            time.sleep(5)

    # 3 denemenin hepsi başarısızsa:
    print(f"[UYARI] NASA verisi alınamadı, bu nokta atlanacak (lat={lat}, lon={lon})")
    return None

def nasa_json_to_rows(json_data, province_name, district_name, lat, lon):
    """
    NASA POWER JSON çıktısını satırlara çevirir.
    Her satır: province, district, lat, lon, year, month, t2m, prectot
    """
    parameters = json_data.get("properties", {}).get("parameter", {})
    t2m_dict = parameters.get("T2M", {})
    precip_dict = parameters.get("PRECTOT", {})

    rows = []

    # Anahtarlar genelde '201401', '201402' ... formatında
    for ym, t2m_val in t2m_dict.items():
        year = int(str(ym)[:4])
        month = int(str(ym)[4:6])
        precip_val = precip_dict.get(ym, None)

        rows.append({
            "province_name": province_name,
            "district_name": district_name,
            "lat": lat,
            "lon": lon,
            "year": year,
            "month": month,
            "t2m": t2m_val,
            "prectot": precip_val,
        })

    return rows


def main():
    all_rows = []

    # tqdm ile ilerleme çubuğu
    for _, row in tqdm(districts_df.iterrows(), total=len(districts_df), desc="İlçeler"):
        province = row["province_name"]
        district = row["district_name"]
        lat = row["lat"]
        lon = row["lon"]
        # Her istekten önce biraz bekle (rate limit'e takılmamak için)
        time.sleep(1)

        data = fetch_nasa_power_monthly(lat, lon)

        if data is None:
            # hata olduysa bu ilçeyi atla, log at
            print(f"[UYARI] {province} - {district} için veri alınamadı, atlanıyor.")
            continue

        rows = nasa_json_to_rows(data, province, district, lat, lon)
        all_rows.extend(rows)


    # Hepsini tek bir DataFrame'e çevir
    if not all_rows:
        print("Hiç veri alınamadı, bir şeyler yanlış.")
        return

    result_df = pd.DataFrame(all_rows)

    # CSV olarak kaydet
    result_df.to_csv(OUTPUT_CSV, index=False)
    print("Kaydedildi:", OUTPUT_CSV)
    print("Toplam satır:", len(result_df))

if __name__ == "__main__":
    main()
