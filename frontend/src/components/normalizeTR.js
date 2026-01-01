export function normalizeTR(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase("tr-TR")
    .normalize("NFD")                 // harf + işaret ayrıştır
    .replace(/[\u0300-\u036f]/g, "")  // işaretleri sil (ş->s, ö->o vs)
    .replace(/ı/g, "i")               // TR özel: ı -> i
    .replace(/[^a-z0-9]+/g, " ")      // sembolleri boşluk yap
    .trim()
    .replace(/\s+/g, " ");            // çoklu boşlukları teke indir
}

export function makeKey(province, district) {
  return `${normalizeTR(province)}|${normalizeTR(district)}`;
}
const key = makeKey(selectedProvince, selectedDistrict);
const item = lookup[key];
