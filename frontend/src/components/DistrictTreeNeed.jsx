import React, { useEffect, useMemo, useState } from "react";

/**
 * Normalizasyon:
 * - tr-TR locale ile lowercase
 * - baş/son boşlukları sil
 * - çoklu boşluğu tek boşluk yap
 * Bu sayede "Kaş", "Kas", "  Kaş " gibi girişler stabil eşleşir.
 */
function normTR(s) {
  if (!s) return "";
  return s
    .toString()
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");
}

/** Sayı formatı */
function fmtIntTR(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  try {
    return Math.round(Number(n)).toLocaleString("tr-TR");
  } catch {
    return String(n);
  }
}

function fmtPctTR(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  try {
    return Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  } catch {
    return String(n);
  }
}

/**
 * Lookup JSON yapısı (bizim ürettiğimiz):
 * {
 *  "adana|aladağ": {
 *     province_name, district_name,
 *     has_treecover_data, treecover_pct (null olabilir),
 *     potential_treecover_pct, gap_pct,
 *     annual_trees_needed, annual_trees_needed_capped, ...
 *  },
 *  ...
 * }
 */

export default function DistrictTreeNeed() {
  const [lookup, setLookup] = useState(null); // object
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");

  // 1) JSON yükle
  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const res = await fetch("/districts_trees_needed_lookup.json", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`JSON yüklenemedi: ${res.status}`);
        const data = await res.json();
        if (!data || typeof data !== "object") {
          throw new Error("JSON formatı beklenenden farklı.");
        }

        if (!isMounted) return;
        setLookup(data);
      } catch (e) {
        if (!isMounted) return;
        setLoadError(e?.message || "Bilinmeyen hata");
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2) İl listesi + il->ilçe map çıkar
  const { provinces, districtsByProvince } = useMemo(() => {
    const map = new Map(); // provDisplay -> Set(districtDisplay)
    if (!lookup) return { provinces: [], districtsByProvince: new Map() };

    for (const k of Object.keys(lookup)) {
      const item = lookup[k];
      const prov = item?.province_name;
      const dist = item?.district_name;
      if (!prov || !dist) continue;

      if (!map.has(prov)) map.set(prov, new Set());
      map.get(prov).add(dist);
    }

    // alfabetik sırala
    const provArr = Array.from(map.keys()).sort((a, b) =>
      a.localeCompare(b, "tr")
    );

    // ilçeleri de sırala
    const districtsMap = new Map();
    for (const prov of provArr) {
      const arr = Array.from(map.get(prov)).sort((a, b) =>
        a.localeCompare(b, "tr")
      );
      districtsMap.set(prov, arr);
    }

    return { provinces: provArr, districtsByProvince: districtsMap };
  }, [lookup]);

  // 3) İlk değerleri otomatik seç
  useEffect(() => {
    if (!provinces.length) return;

    // İl seçili değilse ilk ili seç
    if (!selectedProvince) {
      setSelectedProvince(provinces[0]);
      return;
    }

    // Seçili il yoksa veya listede değilse ilk ili seç
    if (!provinces.includes(selectedProvince)) {
      setSelectedProvince(provinces[0]);
      return;
    }

    // Seçili ilçe yoksa o ilin ilk ilçesini seç
    const dists = districtsByProvince.get(selectedProvince) || [];
    if (!selectedDistrict && dists.length) {
      setSelectedDistrict(dists[0]);
      return;
    }

    // Seçili ilçe, o ilde yoksa ilk ilçeye çek
    if (selectedDistrict && dists.length && !dists.includes(selectedDistrict)) {
      setSelectedDistrict(dists[0]);
    }
  }, [provinces, districtsByProvince, selectedProvince, selectedDistrict]);

  // 4) İl değişince ilçe listesini resetle (ilk ilçeyi seç)
  useEffect(() => {
    if (!selectedProvince) return;
    const dists = districtsByProvince.get(selectedProvince) || [];
    if (dists.length) setSelectedDistrict(dists[0]);
    else setSelectedDistrict("");
  }, [selectedProvince, districtsByProvince]);

  // 5) Seçili item
  const selectedKey = useMemo(() => {
    const prov = normTR(selectedProvince);
    const dist = normTR(selectedDistrict);
    if (!prov || !dist) return "";
    return `${prov}|${dist}`;
  }, [selectedProvince, selectedDistrict]);

  const item = useMemo(() => {
    if (!lookup || !selectedKey) return null;
    return lookup[selectedKey] || null;
  }, [lookup, selectedKey]);

  // 6) UI durumları
  const status = useMemo(() => {
    if (loading) return { type: "loading", message: "Veriler yükleniyor..." };
    if (loadError) return { type: "error", message: loadError };
    if (!lookup) return { type: "error", message: "Lookup verisi bulunamadı." };
    if (!selectedProvince || !selectedDistrict)
      return { type: "idle", message: "İl/ilçe seçiniz." };
    if (!item)
      return {
        type: "error",
        message:
          "Bu il/ilçe için kayıt bulunamadı. (Normalizasyon veya anahtar uyumsuz olabilir)",
      };

    // Veri yok kriteri: has_treecover_data false veya treecover_pct null
    const hasData =
      item.has_treecover_data === true && item.treecover_pct !== null;

    if (!hasData) {
      return {
        type: "nodata",
        message:
          "Bu ilçe için treecover verisi yok. (treecover_pct null / has_treecover_data=false)",
      };
    }

    // annual değer var mı?
    const annual =
      item.annual_trees_needed_capped ?? item.annual_trees_needed ?? null;

    if (annual === null || annual === undefined || Number.isNaN(Number(annual))) {
      return {
        type: "error",
        message:
          "Bu ilçe için yıllık dikim değeri üretilemedi. JSON alanlarını kontrol et.",
      };
    }

    return { type: "ok", message: "" };
  }, [loading, loadError, lookup, selectedProvince, selectedDistrict, item]);

  // 7) Hesap/Değerler
  const annualTrees =
    item?.annual_trees_needed_capped ?? item?.annual_trees_needed ?? null;

  const totalTarget =
    item?.trees_needed_feasible ?? item?.trees_needed_theoretical ?? null;

  const yearsTarget = item?.years_target ?? 10;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 56, margin: 0, letterSpacing: -1 }}>
        İlçe Ağaç İhtiyacı
      </h1>
      <p style={{ marginTop: 10, color: "#5b6774", fontSize: 16 }}>
        İl/ilçe seçice <b>{yearsTarget} yıllık hedefe göre</b> yıllık ortalamanın
        dikilmesi gereken fidan miktarını gösterir.
      </p>

      {/* Seçimler */}
      <div style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
        <div style={{ minWidth: 340 }}>
          <label style={{ display: "block", marginBottom: 6, color: "#334" }}>
            İl
          </label>
          <select
            value={selectedProvince}
            onChange={(e) => setSelectedProvince(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #cfd7df",
              fontSize: 16,
            }}
            disabled={loading || !!loadError}
          >
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: 340 }}>
          <label style={{ display: "block", marginBottom: 6, color: "#334" }}>
            İlçe
          </label>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #cfd7df",
              fontSize: 16,
            }}
            disabled={loading || !!loadError || !selectedProvince}
          >
            {(districtsByProvince.get(selectedProvince) || []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sonuç kartı */}
      <div
        style={{
          marginTop: 22,
          border: "1px solid #e6edf3",
          borderRadius: 16,
          padding: 22,
          background: "white",
          boxShadow: "0 10px 30px rgba(16, 24, 40, 0.06)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 28 }}>
          {selectedProvince || "—"} / {selectedDistrict || "—"}
        </h2>

        {status.type === "loading" && (
          <p style={{ marginTop: 14, color: "#5b6774" }}>{status.message}</p>
        )}

        {status.type === "error" && (
          <p style={{ marginTop: 14, color: "#d12c2c" }}>{status.message}</p>
        )}

        {status.type === "nodata" && (
          <p style={{ marginTop: 14, color: "#d12c2c" }}>{status.message}</p>
        )}

        {status.type === "ok" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 18,
                marginTop: 18,
              }}
            >
              <div>
                <div style={{ color: "#5b6774", fontSize: 14 }}>Yıllık dikim</div>
                <div style={{ fontSize: 52, fontWeight: 700, marginTop: 6 }}>
                  {fmtIntTR(annualTrees)}
                </div>
                <div style={{ color: "#5b6774", marginTop: 4 }}>
                  ({yearsTarget} yıllık hedefe göre ortalama)
                </div>
              </div>

              <div>
                <div style={{ color: "#5b6774", fontSize: 14 }}>Toplam hedef</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
                  {fmtIntTR(totalTarget)}
                </div>
                <div style={{ color: "#5b6774", marginTop: 4 }}>
                  ({yearsTarget} yıl kaldı)
                </div>
              </div>
            </div>

            <hr style={{ margin: "18px 0", borderColor: "#eef3f8" }} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16,
              }}
            >
              <div>
                <div style={{ color: "#5b6774", fontSize: 13 }}>
                  Mevcut ağaç örtüsü (%)
                </div>
                <div style={{ fontSize: 18, fontWeight: 650, marginTop: 6 }}>
                  {fmtPctTR(item.treecover_pct)}
                </div>
              </div>

              <div>
                <div style={{ color: "#5b6774", fontSize: 13 }}>
                  Model potansiyeli (%)
                </div>
                <div style={{ fontSize: 18, fontWeight: 650, marginTop: 6 }}>
                  {fmtPctTR(item.potential_treecover_pct)}
                </div>
              </div>

              <div>
                <div style={{ color: "#5b6774", fontSize: 13 }}>
                  Açık (boşluk, %)
                </div>
                <div style={{ fontSize: 18, fontWeight: 650, marginTop: 6 }}>
                  {fmtPctTR(item.gap_pct)}
                </div>
              </div>
            </div>

            {/* Debug istersen aç */}
            {/* <pre style={{ marginTop: 16, background: "#f7fafc", padding: 12, borderRadius: 10, overflow: "auto" }}>
              key: {selectedKey}{"\n"}
              {JSON.stringify(item, null, 2)}
            </pre> */}
          </>
        )}
      </div>
    </div>
  );
}
