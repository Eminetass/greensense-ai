import React, { useEffect, useMemo, useState } from "react";

function normTR(s) {
  if (s === null || s === undefined) return "";
  return s
    .toString()
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");
}

function fmtIntTR(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Math.round(Number(n)).toLocaleString("tr-TR");
}

function fmtPctTR(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

export default function DistrictTreeNeed() {
  const [rawLookup, setRawLookup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedProvinceKey, setSelectedProvinceKey] = useState("");
  const [selectedDistrictKey, setSelectedDistrictKey] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await fetch("/districts_trees_needed_lookup.json", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`JSON yüklenemedi: ${res.status}`);
        const data = await res.json();

        if (!alive) return;
        if (!data || typeof data !== "object") throw new Error("JSON formatı hatalı.");
        setRawLookup(data);
      } catch (e) {
        if (!alive) return;
        setLoadError(e?.message || "Bilinmeyen hata");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);


  const prepared = useMemo(() => {
    const empty = {
      canonicalLookup: null,
      provinces: [],
      provinceLabelByKey: new Map(),
      districtsByProvinceKey: new Map(),
      districtLabelByProvDistKey: new Map(),
    };

    if (!rawLookup) return empty;

    const canonicalLookup = {}; // "aydın|merkez" -> item
    const provinceLabelByKey = new Map(); // provKey -> "Aydın"
    const districtsByProvinceKey = new Map(); // provKey -> [{key,label}]
    const districtLabelByProvDistKey = new Map(); // "provKey|distKey" -> "Merkez"
    const districtSetByProv = new Map(); // provKey -> Map(distKey -> label)

    for (const originalKey of Object.keys(rawLookup)) {
      const item = rawLookup[originalKey];
      const provLabel = item?.province_name;
      const distLabel = item?.district_name;
      if (!provLabel || !distLabel) continue;

      const provKey = normTR(provLabel);
      const distKey = normTR(distLabel);
      if (!provKey || !distKey) continue;

      const canonKey = `${provKey}|${distKey}`;
      canonicalLookup[canonKey] = item;

      if (!provinceLabelByKey.has(provKey)) {
        provinceLabelByKey.set(provKey, provLabel);
      }

      if (!districtSetByProv.has(provKey)) districtSetByProv.set(provKey, new Map());
      districtSetByProv.get(provKey).set(distKey, distLabel);

      districtLabelByProvDistKey.set(canonKey, distLabel);
    }

    const provinces = Array.from(provinceLabelByKey.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "tr"));

    for (const [provKey, distMap] of districtSetByProv.entries()) {
      const arr = Array.from(distMap.entries())
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "tr"));
      districtsByProvinceKey.set(provKey, arr);
    }

    return {
      canonicalLookup,
      provinces,
      provinceLabelByKey,
      districtsByProvinceKey,
      districtLabelByProvDistKey,
    };
  }, [rawLookup]);

  useEffect(() => {
    if (!prepared.provinces.length) return;

    if (!selectedProvinceKey) {
      const firstProv = prepared.provinces[0].key;
      setSelectedProvinceKey(firstProv);
      const firstDist = prepared.districtsByProvinceKey.get(firstProv)?.[0]?.key || "";
      setSelectedDistrictKey(firstDist);
      return;
    }

    const provExists = prepared.provinces.some((p) => p.key === selectedProvinceKey);
    if (!provExists) {
      const firstProv = prepared.provinces[0].key;
      setSelectedProvinceKey(firstProv);
      const firstDist = prepared.districtsByProvinceKey.get(firstProv)?.[0]?.key || "";
      setSelectedDistrictKey(firstDist);
      return;
    }

    const dists = prepared.districtsByProvinceKey.get(selectedProvinceKey) || [];
    if (!dists.length) {
      setSelectedDistrictKey("");
      return;
    }
    const distExists = dists.some((d) => d.key === selectedDistrictKey);
    if (!selectedDistrictKey || !distExists) {
      setSelectedDistrictKey(dists[0].key);
    }
  }, [prepared, selectedProvinceKey, selectedDistrictKey]);

  const selectedKey = useMemo(() => {
    if (!selectedProvinceKey || !selectedDistrictKey) return "";
    return `${selectedProvinceKey}|${selectedDistrictKey}`;
  }, [selectedProvinceKey, selectedDistrictKey]);

  const item = useMemo(() => {
    if (!prepared.canonicalLookup || !selectedKey) return null;
    return prepared.canonicalLookup[selectedKey] || null;
  }, [prepared.canonicalLookup, selectedKey]);

  const selectedProvinceLabel =
    prepared.provinceLabelByKey.get(selectedProvinceKey) || "—";

  const selectedDistrictLabel =
    prepared.districtLabelByProvDistKey.get(selectedKey) ||
    prepared.districtsByProvinceKey
      .get(selectedProvinceKey)
      ?.find((d) => d.key === selectedDistrictKey)?.label ||
    "—";

  const yearsTarget = item?.years_target ?? 10;
  const annualTrees = item?.annual_trees_needed_capped ?? item?.annual_trees_needed ?? null;
  const totalTarget = item?.trees_needed_feasible ?? item?.trees_needed_theoretical ?? null;


  const status = useMemo(() => {
    if (loading) return { type: "loading", message: "Veriler yükleniyor..." };
    if (loadError) return { type: "error", message: loadError };
    if (!prepared.canonicalLookup) return { type: "error", message: "Lookup verisi yok." };
    if (!selectedProvinceKey || !selectedDistrictKey)
      return { type: "idle", message: "İl/ilçe seçiniz." };
    if (!item)
      return { type: "error", message: "Bu il/ilçe için kayıt bulunamadı." };


    const hasTreecover = item.has_treecover_data === true && item.treecover_pct !== null;
    if (!hasTreecover) return { type: "nodata", message: "Bu ilçe için ağaç örtüsü verisi yok." };

    const ann = item.annual_trees_needed_capped ?? item.annual_trees_needed ?? null;
    if (ann === null || ann === undefined || Number.isNaN(Number(ann)))
      return { type: "error", message: "Yıllık dikim değeri üretilemedi (annual alanı yok/hatalı)." };

    if (Number(ann) === 0)
      return { type: "ok0", message: "Bu ilçe için ek ağaçlandırma ihtiyacı görünmüyor." };

    return { type: "ok", message: "" };
  }, [loading, loadError, prepared.canonicalLookup, selectedProvinceKey, selectedDistrictKey, item]);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 56, margin: 0, letterSpacing: -1 }}>İlçe Ağaç İhtiyacı</h1>
      <p style={{ marginTop: 10, color: "#5b6774", fontSize: 16 }}>
        İl/ilçe seçince <b>{yearsTarget} yıllık hedefe göre</b> yıllık ortalama dikilmesi gereken fidan miktarını gösterir.
      </p>

      {/* Seçimler */}
      <div style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
        <div style={{ minWidth: 340 }}>
          <label style={{ display: "block", marginBottom: 6, color: "#334" }}>İl</label>
          <select
            value={selectedProvinceKey}
            onChange={(e) => {
              const newProvKey = e.target.value;
              setSelectedProvinceKey(newProvKey);
              const firstDist = prepared.districtsByProvinceKey.get(newProvKey)?.[0]?.key || "";
              setSelectedDistrictKey(firstDist);
            }}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #cfd7df",
              fontSize: 16,
            }}
            disabled={loading || !!loadError}
          >
            {prepared.provinces.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: 340 }}>
          <label style={{ display: "block", marginBottom: 6, color: "#334" }}>İlçe</label>
          <select
            value={selectedDistrictKey}
            onChange={(e) => setSelectedDistrictKey(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #cfd7df",
              fontSize: 16,
            }}
            disabled={loading || !!loadError || !selectedProvinceKey}
          >
            {(prepared.districtsByProvinceKey.get(selectedProvinceKey) || []).map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
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
        {/* Başlık: doğru label’ı göster (takılı kalmaz) */}
        {/*<h2 style={{ margin: 0, fontSize: 28 }}>
          {selectedProvinceLabel} / {selectedDistrictLabel}
        </h2>*/}

        {status.type === "loading" && (
          <p style={{ marginTop: 14, color: "#5b6774" }}>{status.message}</p>
        )}

        {status.type === "error" && (
          <p style={{ marginTop: 14, color: "#d12c2c" }}>{status.message}</p>
        )}

        {status.type === "nodata" && (
          <p style={{ marginTop: 14, color: "#d12c2c" }}>{status.message}</p>
        )}

        {(status.type === "ok" || status.type === "ok0") && (
          <>
            {status.type === "ok0" && (
              <p style={{ marginTop: 14, color: "#1f7a1f", fontWeight: 600 }}>
                {status.message}
              </p>
            )}

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
                  ({yearsTarget} yıl)
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
                <div style={{ color: "#5b6774", fontSize: 13 }}>Mevcut ağaç örtüsü (%)</div>
                <div style={{ fontSize: 18, fontWeight: 650, marginTop: 6 }}>
                  {fmtPctTR(item.treecover_pct)}
                </div>
              </div>

              <div>
                <div style={{ color: "#5b6774", fontSize: 13 }}>Model potansiyeli (%)</div>
                <div style={{ fontSize: 18, fontWeight: 650, marginTop: 6 }}>
                  {fmtPctTR(item.potential_treecover_pct)}
                </div>
              </div>

              <div>
                <div style={{ color: "#5b6774", fontSize: 13 }}>Açık (boşluk, %)</div>
                <div style={{ fontSize: 18, fontWeight: 650, marginTop: 6 }}>
                  {fmtPctTR(item.gap_pct)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
