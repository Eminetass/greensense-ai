import { useEffect, useMemo, useState } from "react";

const YEARS = 10; // yıllık ortalama = trees_needed / YEARS

function normalizeTR(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ş", "s")
    .replaceAll("ç", "c")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replace(/\s+/g, " "); // çoklu boşlukları tek yap
}

const fmtInt = (n) => new Intl.NumberFormat("tr-TR").format(Math.round(n));
const fmtPct = (n) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(n ?? 0)
  );

export default function DistrictTreeNeed() {
  const [lookup, setLookup] = useState(null);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");

  useEffect(() => {
    fetch("/districts_trees_needed_lookup.json")
      .then((r) => r.json())
      .then((data) => {
        setLookup(data);

        // values üzerinden il/ilçe listesi çıkar
        const values = Object.values(data);
        values.sort((a, b) =>
          (a.province_name + a.district_name).localeCompare(b.province_name + b.district_name, "tr")
        );

        const first = values[0];
        setProvince(first?.province_name ?? "");
        setDistrict(first?.district_name ?? "");
      })
      .catch((e) => {
        console.error("JSON yüklenemedi:", e);
      });
  }, []);

  const provinceToDistricts = useMemo(() => {
    if (!lookup) return new Map();

    const map = new Map();
    for (const item of Object.values(lookup)) {
      const p = item.province_name;
      const d = item.district_name;
      if (!map.has(p)) map.set(p, new Set());
      map.get(p).add(d);
    }

    // Set -> sorted array
    const out = new Map();
    for (const [p, set] of map.entries()) {
      out.set(p, Array.from(set).sort((a, b) => a.localeCompare(b, "tr")));
    }
    return out;
  }, [lookup]);

  const provinces = useMemo(() => {
    return Array.from(provinceToDistricts.keys()).sort((a, b) => a.localeCompare(b, "tr"));
  }, [provinceToDistricts]);

  const districts = useMemo(() => {
    return provinceToDistricts.get(province) ?? [];
  }, [provinceToDistricts, province]);

  // il değişince ilçeyi ilk elemana çek
  useEffect(() => {
    if (!districts.length) return;
    if (!districts.includes(district)) {
      setDistrict(districts[0]);
    }
  }, [districts, district]);

  const selected = useMemo(() => {
    if (!lookup || !province || !district) return null;

    const key = `${normalizeTR(province)}|${normalizeTR(district)}`;
    return lookup[key] ?? null;
  }, [lookup, province, district]);

  if (!lookup) {
    return <div style={{ padding: 24 }}>Veri yükleniyor...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ marginBottom: 6 }}>İlçe Ağaç İhtiyacı</h1>
      <div style={{ opacity: 0.75, marginBottom: 18 }}>
        İl/ilçe seçince <b>{YEARS} yıllık hedefe göre</b> yıllık ortalama dikilmesi gereken fidan sayısını gösterir.
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", marginBottom: 6 }}>İl</label>
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10 }}
          >
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label style={{ display: "block", marginBottom: 6 }}>İlçe</label>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10 }}
          >
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>
          {province} / {district}
        </h2>

        {!selected ? (
          <div style={{ color: "crimson" }}>
            Bu il/ilçe için veri bulunamadı. (Normalize anahtarı uyuşmuyor olabilir)
          </div>
        ) : (
          <>
            {/* YILLIK ANA DEĞER */}
            <div style={{ display: "flex", gap: 24, alignItems: "baseline" }}>
              <div style={{ flex: 1 }}>
                <div style={{ opacity: 0.7, marginBottom: 6 }}>Yıllık dikim önerisi</div>
                <div style={{ fontSize: 44, fontWeight: 800 }}>
                  {fmtInt((selected.trees_needed ?? 0) / YEARS)}
                </div>
                <div style={{ opacity: 0.7 }}>
                  ({YEARS} yıllık hedefe göre ortalama)
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ opacity: 0.7, marginBottom: 6 }}>Toplam hedef (yaklaşık)</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtInt(selected.trees_needed ?? 0)}</div>
                <div style={{ opacity: 0.7 }}>({YEARS} yılın toplamı)</div>
              </div>
            </div>

            <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #eee" }} />

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <div style={{ opacity: 0.7 }}>Mevcut ağaç örtüsü (%)</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtPct(selected.treecover_pct)}</div>
              </div>
              <div>
                <div style={{ opacity: 0.7 }}>Model potansiyeli (%)</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtPct(selected.potential_treecover_pct)}</div>
              </div>
              <div>
                <div style={{ opacity: 0.7 }}>Açık (boşluk, %)</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtPct(selected.gap_pct)}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
