# Grid_Analyzer_v7 — VeraGrid Kaynak Kodundan Türetilmiş Geliştirme Promptu

> **Bu dosya, bir sonraki kodlama ajanına doğrudan verilebilir.**
> Dayanak: `VERAGRID_GRID_ANALYZER_DGS_LOADFLOW_COMPARISON.md` (aynı dal, aynı base commit).
> **Her iddia aşağıda kanıt referansı taşır. Kanıt referansı olmayan hiçbir madde yoktur.**

---

## 0. Hedef depo ve dallar — DEĞİŞTİRME

```
Repo            : C:\projelerim\YTBS_PowerFactory_Sebeke_Goruntuleyici_v6_8
Base commit     : 01395404fccf908b0b160b45759bb4ad30f4c81f
                  "feat(v7.4): integrate station Q states into Newton"
Analiz dalı     : analysis/veragrid-dgs-loadflow-comparison  (yalnız bu iki dokümanı içerir)
Yeni çalışma dalı: feat/v7.5-transformer-phase-and-pivot
Remote          : https://github.com/murathany90/Grid_Analyzer_v7.git
```

**Kurallar:**
- `main`, `release/v7.4-final`, `fix/v7.1-*`, `fix/v7.2-*`, `fix/v7.3-*`,
  `feature/v7-architecture-migration` **dokunulmaz**.
- `analysis/veragrid-dgs-loadflow-comparison` dalı **main'e merge edilmez**.
- Bu prompt'un ürettiği dal **`main`'e veya `release/v7.4-final`'a merge edilmez.**
- Push yalnız `feat/v7.5-transformer-phase-and-pivot` dalına yapılır.

### DO NOT MERGE

```
DO NOT MERGE
Bu dal main'e, release/v7.4-final'a veya herhangi bir release dala merge EDİLMEZ.
Açık PR'lar merge EDİLMEZ. release/v7.4-final DEĞİŞTİRİLMEZ.
Ayrıca: Bölüm 9 kabul kriterleri sağlanmadan ve Bölüm 10 gerçek-model
benchmark politikası uygulanmadan PR "ready" işaretlenmez.
```

---

## 1. Geliştirme hedefi

Üç kanıtlanmış kusuru düzelt:

1. **Transformatör faz kaydırması hiç uygulanmıyor.** `Transformer2W.phase` sabit `0`;
   `TypTr2.tr2cn_h` / `tr2cn_l` okunmuyor. 3.682–3.684 transformatörün tamamı etkileniyor.
   Ölçülen etki: 400 kV hat P MAE **31,555 MW**, bara açı MAE **1,3351°**,
   bara Vpu sistematik bias **−0,015503 pu**.
2. **Lineer çözücüde sıralama ve pivotlama yok.** ILU(0) doğal sıralamada çalışıyor,
   pivotlama hiç yok, `±1e-10` kelepçesi `minPivot` teşhisini maskeliyor.
   Gözlenen: `LINEAR_SOLVER_FAILED` @ mismatch 3,867495536e-4 MW (eşik 1e-6);
   `20260928-v74-final.json` performans kapısı `pass: false`, `reason: BASELINE_FALLBACK`.
3. **Station controller'da iki doğrulanmış hata.**
   (A) Baseline'da çözülen Q, ownership geçişinde kayboluyor.
   (B) Q-limit döngüsünde `changed` bayrağı döngü-dışı kapsamda; bir controller'ın limit
   vuruşu diğerlerinin yeniden ağırlıklandırma/doygunluk dalına sızıyor.

**Kapsam dışı (bilinçli):** ZIP/voltage-dependent yük modeli, 3W/4W trafo, çok fazlı /
faz çözümleme, sıfır sekans trafo parametreleri, EMT/RMS/VSC/ElmAsm/ElmSvs. Gerekçeleri
raporun "What Grid Analyzer Should NOT Copy" bölümünde kanıtlandı.

---

## 2. Kanıt dayanağı (rapordan)

| # | Kanıt | Konum |
|---|---|---|
| E1 | `phase: 0` sabit; `PHASE_SHIFT_SOURCE_UNAVAILABLE` sentinel | `src/importers/dgs/canonical.ts:73-74` |
| E2 | Faz kaydırmasının `preparation` tarafında raporlanması | `src/analysis/power-flow/preparation.ts:56` |
| E3 | `ybus.ts` karmaşık off-nominal tap **+ faz kaydırması** zaten tüketiyor | `src/analysis/power-flow/js/ybus.ts:11-18` |
| E4 | `tr2cn_h` / `tr2cn_l` gerçek veride mevcut (3.682 satır) | `docs/validation/20260928-source-audit.md:12`; `TypTr2` 24 kolon |
| E5 | ILU(0): doğal sıralama, dolgu yok, **pivotlama yok**, `±1e-10` kelepçe | `src/analysis/power-flow/js/linear-solver.ts:9-26` (özellikle `:15, :22, :23`) |
| E6 | `minPivot` kelepçe **öncesi** raporlanıyor, `pivotSource` yanıltıcı | `linear-solver.ts:22`; `types.ts:34`; `newton.ts:16` |
| E7 | `LINEAR_SOLVER_FAILED` @ mismatch 3,867495536e-4 MW | `docs/validation/v7.0.1-stabilization.md:37-41` |
| E8 | Performans kapısı `pass: false`, `reason: BASELINE_FALLBACK`, `CONTROL_SOLVE_FAILED: 158` | `docs/validation/20260928-v74-final.json` |
| E9 | HATA A: `cloneModel` `qSpec`'i `base`'ten kopyalıyor; `baseline.Q` hiçbir yere aktarılmıyor | `src/analysis/power-flow/station-controls-v73.ts:44, 47, 53` + `preparation.ts:26` |
| E10 | HATA A karşılaştırması: non-entegre yol `baseline.Q[bus]` **kullanıyor** | `station-controls-v73.ts:122-130` (özellikle `:126`) |
| E11 | HATA B: `let changed=false` **for döngüsü dışında**; `:68` `if(changed)` tüm controller'lar için | `station-controls-v73.ts:64, 68, 70` |
| E12 | HATA B yan etkisi: `limits.length===0` iken `'NO_REACTIVE_HEADROOM'` atanıyor | `station-controls-v73.ts:70` |
| E13 | `dispatchedPWeights` `ΣP<=1e-9` iken `null` döner | `src/analysis/power-flow/station-participation.ts:5-9` |
| E14 | Ölçülen doğrulama metrikleri (PowerFactory referansı) | `kontrol1/GridAnalyzer_YTBS_FullNR_Karsilastirma_Raporu_20260928 (1).xlsx`, sheet `00_Ozet` |
| E15 | XLSX Q karşılaştırması imzalı MVAr vermiyor; `|Q|=sqrt(max(0,S²−P²))` türetildi | aynı dosya, `Q NOTU` |
| E16 | Mevcut regresyon testi | `tests/unit/v73-station-control.test.ts:19, 27-31, 38-40, 51-55, 72-81`; `tests/unit/numerical.test.ts:23-57` |
| E17 | Lineer çözücü birim testi yok | `tests/unit/` altında `linear-solver.test.ts` **yok** |
| E18 | Kontrol döngüsü maliyeti: v7.2 219.962,23 ms; durum C 86.613,53 / 115.991,84 ms | `docs/validation/20260928-v72-benchmark.json`; `20260928-abcd-benchmark-v73.json`; `20260928-v74-final.json` |

---

## 3. P0 görevleri

### P0-1 — Transformatör faz kaydırması

**Problem.** `Transformer2W.phase` sabit `0` (E1). `tr2cn_h`/`tr2cn_l` parse edilmiyor.
Ybus faz kaydırmayı destekliyor (E3) ama hiç kullanılmıyor.

**Dosyalar.**
- `src/importers/dgs/canonical.ts` — `ElmTr2` bloğu, satır 58-75
- `src/domain/model/network.ts` — `Transformer2W` (18-22), `SourceRef` (3)
- yeni: `src/importers/dgs/vector-group.ts` (tablo + ayrıştırıcı)
- yeni: `tests/unit/transformer-phase.test.ts`

**Matematiksel formülasyon.**

Vektör grubu kodları PowerFactory'de `<HV bağlantı><LV bağlantı><Saat sayısı>` biçimindedir.
Saat (`clock`) sayısı **1** veya **11** olabilir; saat 11 ⇒ **−30°** (Saat 1 ⇒ 0°).
Saat sayısı **11** ise işaret **negatif**, 1 ise **0** referans alınır.

```
θ_hv_lv = −30° · (clock − 1)        // clock ∈ {1, 11}
          → clock=1: 0°, clock=11: −30°

Baz faz kayması (VeraGrid değil — IEC 60076'tan türetilmiştir, U15 uyarısı):
  Y  → 0°        (nötr nokta Y ile hizalı)
  Δ  → 30°       (yıldız noktası üçgenin merkezine, saat yönünde 30° döner)
  Z  → 0°        (zigzag ≈ yıldız)
  N  → 0°        (nötr, referans)

φ_sistem =  clockPhase − (φ_hv − φ_lv)

Transformer2W.phase (rad) = φ_sistem · π/180
```

> **ÖNEMLİ:** `phase` **iki** yerde tüketiliyor, ikisinde de `e.phase` okunuyor:
> (a) `Ybus` — `ybus.ts:11-18`, `complex(tap, phase)`
> (b) doğrudan dal güç hesabı — `newton.ts:62`:
>     `const c = Math.cos(Va[i]-Va[j]-ph), s = Math.sin(Va[i]-Va[j]-ph);`
>     `pf = (vi*vi*g/(tap*tap) - vi*vj/tap*(g*c + b*s)) * base`
> Yorum satırı `:63`: *"Equivalent branch powers using same off-nominal tap convention,
> phase included in angle difference."*
> Bu nedenle **`Transformer2W.phase` alanını doldurmak tek başına yeterlidir**; iki noktada
> ayrı ayrı düzeltme gerekmez. Alan bugün `0` olduğu için iki noktada da **tutarlı biçimde**
> sıfırdır — tutarsızlık riski ancak biri düzeltilip diğeri unutulursa doğar.

**Uygulama adımları.**
1. `src/importers/dgs/vector-group.ts` yaz: saf fonksiyon
   `parseVectorGroup(hv: string, lv: string): { phaseDeg: number; clock: number; recognized: boolean }`.
   - Küçük/kapital harf normalize (`'YN'`, `'yn'`, `'Yn'` → aynı)
   - Ayrıştır: `^([YyndZNz]+)([ynN]?)([1-9]?)$` — bağlantı, nötr, saat
   - Saat alanı boşsa **tanınma başarısız** sayılır ve `recognized: false` döner
     (tahmin **yapılmaz**)
2. `canonical.ts` `ElmTr2` bloğunda: `TypTr2` zaten okunuyor; `tr2cn_h` ve `tr2cn_l`
   sütunlarını da oku, `parseVectorGroup` çağır, `phase` alanına yaz.
3. `network.ts` `Transformer2W`'e `phaseShiftSource?: { hv: string; lv: string; recognized: boolean }`
   alanı ekle. `recognized: false` ise `phase = 0` **ve** `sourceRefs` uyarısı.
4. Tanınmayan kodlarda `preparation.ts` diagnostics'e bir sayaç ekle
   (`transformerPhaseUnrecognized`).

**Geriye dönük uyumluluk.**
- `CanonicalNetwork.schemaVersion` **1'de kalır** (yeni alan opsiyonel).
- Yeni bir export/import yolu **yok** (yalnız IndexedDB'da `CanonicalNetwork` saklanıyor;
  eski kayıtlarda `phaseShiftSource` `undefined` olur → `?? 'ABSENT'` fallback).
- `Transformer2W.phase` tipi değişmez (`number`), yalnız **değeri** artık `0` değil.
- **ÖNEMLİ:** `transformerPhase:'PHASE_SHIFT_SOURCE_UNAVAILABLE'` sentinel'ı
  `preparation.ts:56`'da **kaldırılmalıdır** — artık yanlıştır. Geriye dönük okuyucular için
  `transformerPhase` alanına `'VECTOR_GROUP_DERIVED' | 'PARTIAL_VECTOR_GROUP' | 'ABSENT'`
   yazılır.

**Kabul kriterleri.**
- [ ] `parseVectorGroup` için ≥ 12 tablo testi: `Dyn11`→−30, `YNd1`→+30, `Yyn0`→0,
      `YNyn0`→0, `Dd0`→0, `YNyn6`→tanınmadı, `YNyn1yn11`→tanınmadı, boş→tanınmadı,
      küçük harf varyantları, `Zyn11`→−30, `YNd1` saat 1 vs `YNd11` saat 11 farkı.
- [ ] `ybus.ts` ile entegrasyon testi: `phase` verildiğinde `Yft`/`Ytf` fazının
      doğru açı taşıdığı (`Ybus[from][to]` complex fazı ölçülür).
- [ ] **Çift yönlü (transformer orientation) testi:** HV/LV sırası ters çevrildiğinde
      `phase` işareti değişir. *(U15 — en kritik karar noktası)*
- [ ] Tam model **tek** koşu: XLSX sheet `00_Ozet` karşılaştırması (Bölüm 10).

**Risk.** Düşük. Geri dönüşü olan veri mevcut, Ybus altyapısı hazır, hiçbir formülasyon
değişikliği gerekmez.

---

### P0-2 — Lineer çözücü: sıralama + gerçek pivotlama

**Problem.** Doğal sıralama + kelepçelenmiş ILU(0) (E5). Teşhis yanlış yönlendiriliyor (E6).
Gözlenen başarısızlık (E7) ve geçilemeyen performans kapısı (E8).

**Dosyalar.**
- `src/analysis/power-flow/js/linear-solver.ts` — `ilu0`, `iluFill`, `iluSolve`
- `src/analysis/power-flow/js/ybus.ts` — `buildY` (permütasyon noktası)
- `src/analysis/power-flow/js/jacobian.ts` — `makeLayout`, `fillJacobian` (permütasyon noktası)
- `src/analysis/power-flow/js/types.ts` — `SparseMatrix`, `NumericalFailureDiagnostic`
- yeni: `src/analysis/power-flow/js/ordering.ts` — RCM
- yeni: `tests/unit/linear-solver.test.ts` (E17 — **yok**)

**Görev A — RCM (Reverse Cuthill-McKee) sıralaması.**

Ybus **simetrik** olduğundan RCM doğrudan uygulanabilir.

```
Girdi  : A (n×n, simetrik, sıfır deseni)
Çıktı  : perm (n elemanlı, perm[i] = eski indeks → yeni indeks)
        + inv (yeni indeks → eski indeks)

Algoritma:
  1. Başlangıç düğümü: en küçük dereceye sahip düğüm (ties → en küçük indeks)
  2. RCM: kuyruk tabanlı BFS; komşular küçük dereceden büyüğe sırayla ziyaret edilir
  3. Sıra ters çevrilir
  4. Kesişen bileşenler (bileşenler ayrı ayrı işlenir, ardından birleştirilir)
  5. permute(perm) hâlinde en az bir bağlantı kalmıyorsa **permute değilme** (nötr)
```

**Uygulama noktası.** `ybus.ts:27`'de sütunlar artan sırada yayımlanıyor; `jacobian.ts:58`
aynısını yapıyor. Permütasyon **her iki matriste de aynı** uygulanmalıdır, aksi halde
indeks uyuşmazlığı oluşur. En temiz yaklaşım: **Ybus'a hiç dokunma**; permütasyonu
**`SparseMatrix` seviyesinde** `SparseMatrix.permute(perm, inv)` olarak uygula ve
`linearFill`/sensitivity zincirlerinde kullan.

> **Karar notu:** Permütasyonu yalnız ILU ön koşulunda uygulamak, mat-vec işlemlerini
> etkilemez çünkü `csrMatVec` (`:7`) permütasyon kovayla çalışır (`A·M·b = A·(M⁻¹b)`).
> Bu, **en düşük riskli** seçenektir ve `Ybus`/mismatch hesaplarına hiç dokunmaz.

**Görev B — kısmi pivotlama.**

```
ilu0(A) değişiklikleri:
  for i = 0 .. N-1:
     k* = argmax_{k >= i, k in row i's remaining pattern} |u[k][i]|
     if i != k*: satır i ve satır k* takası
                  · values/indices bloklarını takas et (rowPtr'a göre bloklar)
                  · pos[] harita dizisini de güncelle
                  · pivotSource = 'ILU_PIVOT_SWAP' olarak işaretle
  ...
  pivot değeri = u[i][i]
  if !finite(|u[i][i]|) veya |u[i][i]| < 1e-12:
        u[i][i] = sign(u[i][i] ?? 1) * 1e-12
        pivotSource = 'ILU_REGULARIZED'
  if hiçbiri olmadıysa: pivotSource = 'ILU_CLEAN'

  minPivot = min |u[i][i]|  ← KELEPÇE SONRASI (mevcut davranıştan FARKLI, düzeltme)
```

> **Kod kokusu uyarısı (kanıtlanmış):** `pos: Map<number,number>[]` **satır-bazlıdır**.
> Satır takası yalnız `values`/`indices`/`pos[i]` bloğunu değil, `rowPtr` içindeki
> **blok sırasını** da etkiler. Bu, dikkatli ve testli uygulanmalıdır.
> `iluFill` (`:29-40`) `ilu0`'a devrettiği için (`levelOfFill` sonrası satır takası
> sembolik örüntüyle tutarsız olabilir) — **`iluFill` için pivota izin verilmemeli**,
> yalnız `ilu0` yolunda uygulanmalıdır.

**Görev C — teşhis düzeltmesi.**

```ts
// types.ts — NumericalFailureDiagnostic
pivotSource: 'ILU_CLEAN' | 'ILU_PIVOT_SWAP' | 'ILU_REGULARIZED';
pivotSwapCount: number;        // yeni
minPivot: number;              // artık kelepçe SONRASI değer
preconditioner: 'ILU0' | 'ILU1' | 'ILU2';
ordering: 'NATURAL' | 'RCM';
```

`minPivot`'un kelepçe öncesi raporlanması (E6) **kaldırılmalıdır** — bu, teşhisi
"BASELINE_FALLBACK" yerine gerçek nedeni gösterecek biçimde düzeltir.

**Kabul kriterleri.**
- [ ] `ordering.ts` birim testleri: 3×3 bilinen matris için elde edilen `perm` el ile
      doğrulanır; permütasyon simetriyi korur (`A'[i][j] = A[perm[i]][perm[j]]`).
- [ ] Bileşenler ayrı ayrı sıralanır; tek bileşenli ağda `perm` geçerli bir permütasyondur.
- [ ] **Kötü sıralanmış sentetik matris:** uzun bir zincir + geniş bir blok; RCM sonrası
      GMRES iterasyon sayısı **azalır** (sayısal olarak doğrulanır).
- [ ] **Tekil köşegen testi:** bilerek tekil matris → kontrollü hata fırlatır,
      **`NaN`/`Infinity` çıktı üretilmez**, `failureStage:'LINEAR_SOLVE'` raporlanır.
- [ ] **IR H2525 regresyonu:** `v7.0.1-stabilization.md:37-41`'de `LINEAR_SOLVER_FAILED`
      veren durum artık `CONVERGED` olur (E7). Eğer olmuyorsa **dur ve rapor et** —
      bu, permütasyonun tek başına yeterli olmadığını gösterir.
- [ ] Mevcut tüm birim + regresyon testleri yeşil (`npm test`).
- [ ] Tam model **tek** koşu (Bölüm 10).

**Risk.** Orta. `pos` haritasının satır takasında güncellenmesi en kritik noktadır.
**RCM tek başına düşük risklidir; pivotlama yüksek risklidir. İkisini ayrı commit'te uygula.**

---

### P0-3 — Station controller iki hata düzeltmesi

**Dosyalar.**
- `src/analysis/power-flow/station-controls-v73.ts` — `runIntegratedStationControls` (46-84)
- `tests/unit/v73-station-control.test.ts`

#### P0-3a — HATA A: baseline Q korunması

**Problem.** `cloneModel` (`:44`) `qSpec`'i `base`'ten kopyalar; `base.qSpec[bus]` ham
`qgini` içerir (`preparation.ts:26`). `baseline.Q[bus]` (çözülmüş Q) hiçbir yere aktarılmaz (E9).
Non-entegre yol bunu **yapıyor** (E10, `:126`).

**Düzeltme.** `station-controls-v73.ts:53`'ten hemen sonra, `:54` bloğunun **içinde**,
`base.busType[bus] === 1` (PV) olan her aktüatör bus için:

```ts
for(const bus of c.row.actuatorBuses){
  model.busType[bus] = 0;
  model.qMinNet[bus] = null;
  model.qMaxNet[bus] = null;
  // HATA A düzeltmesi: PV barında çözülen Q'yu koru (non-entegre yol ile tutarlı, :126)
  if(base.busType[bus] === 1) model.qSpec[bus] += baseline.Q[bus] - base.qSpec[bus];
}
```

**Ek iyileştirme (opsiyonel, ayrı ölçüm):** `state.initialDqPu` sıfır yerine
`-(baseline.Q[bus] - base.qSpec[bus]) / base.baseMVA` ile başlatılabilir. Bu, yakınsamayı
hızlandırır. **Önce yalnız zorunlu düzeltmeyi ölç; iyileştirmeyi ayrı commit'te dene.**

> **Önemli kısıt:** `baseline.Q` pu'da mı, MW'de mi? `newton.ts:71`'e göre sonuç
> `Q: Array.from(Q, v => v*base)` ⇒ **MW**. `model.qSpec` da MW cinsinden
> (`preparation.ts:27` `pMw`). Bu yüzden **birim tutarlıdır**; `/baseMVA` bölmesi
> **Gerekmez**. Uygulamadan önce bu satırı doğrula.

#### P0-3b — HATA B: `changed` kapsamı

**Problem.** `let changed=false` `:64`'te, for döngüsü **dışında** (E11). `:68` `if(changed)`
**tüm** controller'lar için değerlendirilir. `:70` `limits.length===0` iken
`'NO_REACTIVE_HEADROOM'` atar (E12).

**Düzeltme.**
1. `:64`'teki `let changed=false;` **kaldır**.
2. `:65` for döngüsü gövdesinin başına `let controlChanged=false;` taşı.
3. `:67` `changed = true` ⇒ `controlChanged = true` yap.
4. `:68` `if(changed)` ⇒ `if(controlChanged)`.
5. `:70` — ek güvenlik: `limits.length === 0` ise `'NO_REACTIVE_HEADROOM'` **atama**;
   `controlChanged`'ı false bırak ve controller'ı bir sonraki tura bırak:
   ```ts
   if(state.weights.size === 0 && state.fixed.size > 0){
     const limits = [...state.fixed].map(([id,q]) => ({unit: c.units.find(u=>u.id===id)!, q}));
     c.row.status = limits.every(({q}) => q === limits[0].q && q === c.units.find(u=>u.id===limits[0].unit.id)!.qMax) ? 'SATURATED_QMAX'
                    : limits.every(({q}) => q === c.units.find(u=>u.id===limits[0].unit.id)!.qMin) ? 'SATURATED_QMIN'
                    : null;
     if(c.row.status === null){ state.weights = new Map(c.units.map(u=>[u.id, c.row.participationKi[u.id]||0])); controlChanged = false; }
   }
   ```
   *(Basitleştirilmiş hâli yeterlidir; asıl gereken `changed` kapsamının daraltılmasıdır.)*

**Kabul kriterleri.**
- [ ] **HATA A testi:** 2 üreteçli tek remote bara sentetik ağ. `qgini` ile baseline Q
      **farklı** değerlerdeyken sonuç `SATISFIED` olur ve `finalQ` **fiziksel** değerdir
      (`|finalQ − baseline.Q| < 1e-3` veya fiziksel olarak tutarlı).
- [ ] **HATA B testi:** 3 controller, **yalnız 1'i** limit vuruyorken:
      (a) diğer ikisinin `status`'u `'PENDING'` **kalır**,
      (b) diğer ikisinin `participationKi`'si **değişmez**,
      (c) hiçbiri `'NO_REACTIVE_HEADROOM'` olmaz.
- [ ] Mevcut `tests/unit/v73-station-control.test.ts` **yeşil kalır** (E16) — özellikle
      `:27-31` (`dispatchedPWeights` null) ve `:72-81` (controller katsayısı `=== -1`).
- [ ] Tam model **tek** koşu (Bölüm 10).

**Risk.** Düşük. A ≈ 1 satır, B ≈ 2 satır + koşullu.

---

## 4. P1 görevleri (P0 tamamlandıktan sonra, ayrı commit)

| # | Görev | Dosyalar | Kanıt |
|---|---|---|---|
| **P1-1** | `ElmXnet.cQ_min` / `cQ_max` okunması. `ExternalGrid` alanları `network.ts:31`'e `qMin`/`qMax` ekler. `preparation.ts:30-31` "tüm PV ünite limitliyse" kuralını genişletip slack baranın limitlerini dış şebekeden doldur. | `canonical.ts:91`, `preparation.ts:28-31` | E9 tablosu, rapor G4; gerçek veri `cQ_min=-500, cQ_max=+500` |
| **P1-2** | `ComLdf.erreq` (0,2) / `itrlx` (100) **yorumlanır**, **varsayılan tolerans değiştirilmez**. `diagnostics.referenceValidation` alanına yansıt. | `preparation.ts:41-58`, `validation/powerfactory-reference.ts` | E8; `network.ts:56` `loadFlowOptionsRaw` |
| **P1-3** | `ElmShnt.ushnm` okunur; `|ushnm/1000 − bus.vnKv|/bus.vnKv > %5` ise `warnings`. `bPu` hesabı **değişmez**. | `canonical.ts:92-97` | Rapor P1-3; `canonical.ts:96` |
| **P1-4** | Slack seçimi: (1) pozitif `pMw`'li en büyük `pMw`, (2) eşitlikte en küçük FID. **Bugün tek `ElmXnet` var → etik sıfır; determinizm korunur.** | `preparation.ts:45` | `20260928-source-audit.md:13` |
| **P1-5** | `ControlTimings` (8 alan) `ControlledIslandV73`ten `CalculationResult.diagnostics`'e taşınır. **P0-2'nin başarısını ölçülebilir kılmak için zorunludur.** | `station-controls-v73.ts:19`, `browser-js-engine.ts:28-33`, `results.ts`, `domain/results/types.ts` | E18 |
| **P1-6** | `dispatchedPWeights` `null` döndüğünde **eşit ağırlık yedeği** (`1/n`). Bu, `station-controls-v73.ts:108`'deki `UNSUPPORTED_DISTRIBUTION`'ı azaltır. **Önce gerçek veride kaç kontrolin bu duruma düştüğünü ölç** — sıfırsa **yapma**. | `station-participation.ts:5-9` | E13 |
| **P1-7** | Ölü kod temizliği: `src/analysis/power-flow/station-controls.ts` (v7.2) ve `tests/unit/v72-station-control.test.ts` birlikte silinir. | `station-controls.ts` | Rapor P3-1; E16 |
| **P1-8** | `preparation.ts:39, :41` sabit fallback'leri (`UNSUPPORTED_MODE_ENUM`, `satisfied:0`) gerçek sayımlarla değiştirilir veya alan kaldırılıp tek kaynakta hesaplanır. | `preparation.ts:39-41` | Rapor P2-4 |

---

## 5. P2 / P3 görevleri (opsiyonel, P1 sonrası)

- **P2-1** `ElmGenStat.sgn` (doğrudan) ve `ElmSym.typ_id`→`TypSym.sgn` okunur ⇒ `ratingMva`.
  `ratingMva: null` ise `results.ts:12` **bölme yapmaz**, `loading: null` üretir.
  *Dosyalar:* `canonical.ts:76-88`, `domain/dgs-semantics/context.ts:65`, `results.ts:12`.
- **P2-2** `ElmTerm.vmin`/`vmax`/`iOPFCvmin`/`iOPFCvmax` okunur ⇒ `Bus.vMinKv?/vMaxKv?` ve
  `diagnostics.voltageViolations` sayacı. XLSX `00_Ozet` eşik tablosunu otomatik üretir.
- **P2-3** `ElmLne.nlnum`. **ÖNCE gerçek veride `nlnum>1` satır sayısını ölç. Sıfırsa YAPMA.**
- **P2-4** `ElmLod.u0` `sourceRefs.loadModel`'a yazılır (ileride ZIP çalışmasının ön koşulu —
  **şimdilik gerekli değil**).
- **P3-1** `ElmSecctrl` (1 satır) ve `ElmBoundary` (1 satır) inert; `classCounts`'a düşmeleri yeterli.

---

## 6. Matematiksel formülasyon özeti (referans)

Değişiklik yapılacak formülasyon parçaları:

**Ybus faz kaydırması** (`ybus.ts:11-18` — **değişiklik yok**, yalnız `phase` artık beslenir):
```
Y_ff = (g + j(b+bch/2)) / tap²
Y_ft = −(g + jb)·(c + js) / tap          c = cos(phase), s = sin(phase)
Y_tf = −(g − jb)·(c + js) / tap
Y_tt =  g + j(b+bch/2)
```

**Station controller eşleşmesi** (`newton.ts:20-21` — **değişiklik yok**):
```
F_θ[i] = pSpec[i] − P_i(V,θ)
F_V[i] = (qSpec[i] + Σ_c k_ci·ΔQ_c) − Q_i(V,θ)
∂ΔQ_bus/∂ΔQ_ctrl = −k_ci
```

**Lineer çözücü** (`linear-solver.ts` — **değişiklik var**):
```
A·M·b = A·(M⁻¹b)     → permütasyon yalnız M⁻¹ uygulamasında, çözüm yönü değişmez
ILU: satır i ← satır argmax_{k≥i}|u[k][i]| ile takas edilir
pivot = u[i][i]; |pivot| < 1e-12 ise sign korunarak 1e-12 ile değiştirilir
minPivot = min_i |u[i][i]|   (kelepçe SONRASI)
```

---

## 7. Geriye dönük uyumluluk kuralları

1. `CanonicalNetwork.schemaVersion` **1'de kalır**. Yeni alanlar **opsiyoneldir**
   (`phaseShiftSource?`, `vMinKv?`, `vMaxKv?`).
2. IndexedDB'de saklanmış eski `CanonicalNetwork` kayıtları yeni alanlara sahip olmaz.
   Tüm okuma noktalarında `?? 'ABSENT'` / `?? null` fallback **zorunludur**.
3. `pivotSource` birleşim tipi **genişletilir**; `numericalFailure` okuyan kod
   (`results.ts:7-8`) yeni değerleri tanımalıdır.
4. `ControlStatus` birleşim tipi (`station-controls-v73.ts:12`) **genişletilebilir** ama
   **hiçbir mevcut değer kaldırılamaz** — `tests/unit/v73-station-control.test.ts` bunları
   iddia ediyor.
5. `preparation.ts:56`'daki `transformerPhase:'PHASE_SHIFT_SOURCE_UNAVAILABLE'` sentinel'ı
   **kaldırılmalıdır** (artık yanlış). Yerine
   `'VECTOR_GROUP_DERIVED' | 'PARTIAL_VECTOR_GROUP' | 'ABSENT'`.
   Bu, bir davranış değişikliğidir ve `docs/` altında belgelenmelidir.
6. `transformerPhaseUnrecognized` gibi yeni diagnostics alanları **opsiyonel** olmalıdır.

---

## 8. Test politikası

**Yeni test üretme amacıyla test üretme.** Her test belirli bir araştırma/kanıt sorusunu
cevaplamalıdır.

**Yeni test dosyaları (yalnız bu ikisi):**
- `tests/unit/transformer-phase.test.ts` — P0-1
- `tests/unit/linear-solver.test.ts` — P0-2 (E17: mevcut değil)

**Geriye dönük regresyon (hepsi yeşil kalmalı):**
- `tests/unit/v73-station-control.test.ts` (E16) — özellikle `:27-31`, `:38-40`, `:51-55`, `:72-81`
- `tests/unit/numerical.test.ts:23-57` — PV→Q-limit ve `numericalFailure`
- `tests/regression/*.test.ts` — v7.0.2 ZIP yükleme testleri dahil

**Zorunlu kapı komutları:**
```
npm run typecheck      # tsc --noEmit
npm run lint           # node tools/lint.mjs
npm test               # node --import tsx --test tests/unit/*.test.ts tests/regression/*.test.ts
npm run build          # vite build
npm run test:e2e       # node tools/browser-smoke.mjs  (Playwright)
```

**Doğrulama sırası (P0-2 için):** RCM commit'i → test et → **IR H2525 koşu** → ölç →
*pivota ancak RCM yetmediyse* ekle. Iki büyük-model koşusu **asla** yapılmamalıdır.

---

## 9. Sayısal doğruluk kapıları ve kabul kriterleri

Tam model çalıştırması **bitişik** hâlde Bölüm 10 politikasına uyar. Kapılar:

| # | Kapı | Eşik |
|---|---|---|
| G1 | `npm test` | 100% geçer |
| G2 | `npm run typecheck` | 0 hata |
| G3 | `npm run lint` | 0 hata |
| G4 | Grid CSV repro max fark (v7.4 baseline: **2,9103830456733704e-09**) | ≤ 1e-8 |
| G5 | NR max mismatch | ≤ 1e-4 MW (mevcut: 9,61e-10 MW) |
| G6 | **Bara Vpu bias** (mevcut: **−0,015503 pu**) | mutlak değeri **azalmalı** (mutlak iyileşme ≥ 0,002 pu) |
| G7 | **Bara Vpu MAE** (mevcut: **0,016959 pu**) | **≤ 0,014 pu** |
| G8 | **400 kV hat P MAE** (mevcut: **31,555 MW**) | **≤ 20 MW** |
| G9 | **154 kV hat P MAE** (mevcut: **5,429 MW**) | **≤ 5 MW** (regresyon yok) |
| G10 | **Bara açı MAE (ref. düzeltmeli)** (mevcut: **1,3351°**) | **≤ 1,00°** |
| G11 | Trafo P MAE (mevcut: 3,710 MW) | ≤ 3,710 MW (regresyon yok) |
| G12 | Hat \|Q\| MAE (mevcut: 6,232 MVAr) | ≤ 6,232 MVAr — **NOT: XLSX imzalı Q vermiyor (E15), bu bir üst sınırdır** |
| G13 | PV→PQ dönüşüm sayısı (mevcut: 103) | ≤ 103 |
| G14 | NR iterasyon (mevcut: 10) | ≤ 10 |
| G15 | Eşik uyum: `Bara \|V\| ≤ 0,005 pu` (mevcut: 386/1663 = %23,21) | **≥ %30** |
| G16 | Eşik uyum: `Bara \|a\| ≤ 0,5°` (mevcut: 435/1663 = %26,16) | **≥ %32** |
| G17 | **Performans** (v7.4 `C_directNr`: 8.238,84 ms; kapı 30.000 ms) | **30.000 ms altı** ve `pass: true` |
| G18 | Kontrol döngüsü toplamı (durum C: 115.991,84 ms) | **< 60.000 ms** |
| G19 | `targetMet` (4 hedefin **tamamı** şu an `false`) | **en az 2 hedef `true`** |
| G20 | `CONTROL_SOLVE_FAILED` sayısı (v7.4: 158) | **0** |
| G21 | `CONTROL_LIMIT_MAX_ROUNDS` | 0 |
| G22 | Sonuç sağlığı: 2 ada (4154 + 1 bara) korunur; 1-baralık ada `NO_REFERENCE` kalır | aynı |
| G23 | `resultProvenance` (v7.4: `BASELINE_FALLBACK_AFTER_CONTROL_SOLVE_FAILED`) | `INTEGRATED_STATION_CONTROL` (baseline fallback **yok**) |

> **G6–G19 başarısız olursa: PR'yi "ready" işaretleme, dur ve yazılı rapor üret.**
> Geri dönüş (rollback) kabul edilebilir bir sonuçtur; **uydurma iyileştirme kabul edilemez.**

**Tarayıcı doğrulaması:** `npm run test:e2e` yeşil olmalı. Worker → app → `ResultStore`
aktarımı P0-1 sonrası `phase` değerlerini taşımalı; sonuç tablosunda `phase` **görünür
olmalıdır** (yeni alan, opsiyonel).

---

## 10. Gerçek-model benchmark politikası

**Modeller** (`kontrol1/`, `.gitignore`'da — **commitlenmez**):
- `20260928_0900_SN1_TR0.zip` (9.799.696 B → 143.737.437 B) — **birincil referans**
- `20260923_1200_SN3_TR0.json`, `20260923_1600_SN3_TR0.json` — ikincil

**Komut:** `npm run test:full`

**Politika:**
1. **Bölüm 9'un tüm birim kapıları yeşil olmadan** tam model çalıştırma.
2. Tam model koşusu **P0-1, P0-2 ve P0-3 için en fazla birer kez** çalıştırılır.
3. Başarısız olursa: **logu kaydet**, **kaynak kod analizi yap**, **parametre denemek için
   tekrar çalıştırma**. Üç başarısız denemeden sonra dur ve rapor et.
4. `docs/validation/` altına **her koşunun** `2026MMdd-HHMM-<kısa-ad>-benchmark-v75.json`
   adıyla çıktısı yazılır. Ham DGS/JSON/ZIP **commitlenmez.**
5. `docs/final-report.md:212-230` katman süreleri tablosu **güncellenir** (JSON parse,
   DGS import, canonical map, topology/prep, Full AC).
6. `checkpoints.md:17` ilkesi korunur: *"No historical performance values were inferred from
   current runs."*

**Kaçınılacak tuzaklar:**
- Parametre taraması için modeli tekrar tekrar çalıştırma.
- Büyük modeli yalnız "bakmak" için çalıştırma.
- `kontrol1/` altındaki gerçek modelleri **git'e ekleme**, `index`'leme veya yüklememe.

---

## 11. Dokümantasyon değişiklikleri

| Dosya | Değişiklik |
|---|---|
| `docs/dgs-source-profile.md` | `tr2cn_h`/`tr2cn_l` **distinct dağılımı** ekle (U1 kapatılır) |
| `docs/validation/` | Her P0 için yeni benchmark JSON'u (§10.4) |
| `docs/final-report.md` | Katman süreleri tablosunu güncelle; transformerPhase semantiğini belgele |
| `docs/checkpoints.md` | Yeni kontrol noktaları: P0-1, P0-2, P0-3 |
| `VERAGRID_GRID_ANALYZER_DGS_LOADFLOW_COMPARISON.md` | **Değiştirme** — kaynak denetim kaydıdır |
| `GRID_ANALYZER_V7_VERAGRID_DERIVED_DEVELOPMENT_PROMPT.md` | **Değiştirme** |

**Yeni doküman:** `docs/transformer-vector-group.md` — vektör grubu tablosu, saat işareti
kuralı, HV/LV yön kuralı ve U15 kararının gerekçesi.

---

## 12. Commit ve push kuralları

**Önerilen commit sırası (her biri bağımsız, kapıları geçer):**
```
1.  docs: record VeraGrid comparison and derived roadmap
2.  feat(v7.5): derive transformer phase shift from vector group
3.  test(v7.5): add RCM ordering for ILU preconditioner
4.  perf(v7.5): add partial pivoting to ILU0  ← yalnız RCM yetmezse
5.  fix(v7.5): preserve baseline solved Q on station control ownership
6.  fix(v7.5): scope station control Q-limit changed flag per controller
7.  feat(v7.5): read ElmXnet reactive limits
8.  feat(v7.5): report control timings in diagnostics
```

**Kurallar:**
- `feat/fix` dalı **`main`'e merge edilmez.**
- `release/v7.4-final` **değiştirilmez.**
- Commit mesajları **İngilizce**, proje mevcut konvansiyonuna uygun
  (`feat(v7.x):`, `fix(v7.x):`, `docs:`, `test(v7.x):` — git log'una bak).
- **Sırlar, anahtarlar veya kişisel veri commitlenmez.**
- Push yalnız `feat/v7.5-transformer-phase-and-pivot` dalına.
- `git config`, hook'lar, force-push değiştirilmez.
- **Commitlenmeyecek dosyalar:** `*.dgs`, `*.zip`, `*.json` (veri seti), `node_modules/`,
  `dist/`, `test-results/`, `playwright-report/`, `.tmp/`, `kontrol1/**`.
  Yalnız `docs/validation/*.json` **benchmark özeti** olarak commitlenebilir (ham veri değilse).

**Merge öncesi zorunlu:**
```
git status              # temiz olmalı
git diff --stat main    # yalnız kaynak + doküman + test
git log --oneline -12
```

---

## 13. Uygulama sırası özeti

```
A. Hazırlık
   git checkout -b feat/v7.5-transformer-phase-and-pivot 01395404fccf908b0b160b45759bb4ad30f4c81f
   npm install && npm run typecheck && npm run lint && npm test   ← yeşil olduğunu doğrula

B. P0-3 (en küçük, en düşük risk) — iki hata düzeltmesi
   → testler → tam model koşusu #1 → g7/g8/g10 gözle

C. P0-1 — transformer faz kaydırması
   → vector-group.ts + testler → tam model koşusu #2 → g6/g7/g8/g10 gözle

D. P0-2 — lineer çözücü
   D1. ordering.ts (RCM) + ilu0 pivotlaması → birim testler
   D2. IR H2525 regresyonu → tek koşu
   D3. gerekirse ek (pivot) → testler
   → tam model koşusu #3 → g17/g18/g23 gözle

E. P1 görevleri (her biri ayrı commit, her biri testli)
F. Son doğrulama: npm run build && npm run test:e2e
G. Dokümantasyon + push (main'e merge YOK)
```

> **Sıra gerekçesi:** P0-3 en küçük değişikliktir ve doğrudan ölçülen bara Vpu bias'ını
> hedefler; P0-1 en yüksek doğruluk kazancı / en düşük risk oranı sunar; P0-2 en yüksek
> risktir ama performans kapısı onsuz geçilemez. Bu sıra, **her adımda ölçülebilir ilerleme**
> sağlar.

---

## 14. Yasaklar

```
YAPMA:
- main'e, release/v7.4-final'a veya başka bir release dala merge
- Açık PR'ları merge
- ZIP / voltage-dependent yük modeli (TypLod, iopt_pq, scale0, plinir/plinis/plinit veride YOK)
- ElmTr3 / ElmTr4 desteği (veride sıfır örnek)
- Sıfır sekans trafo parametreleri (uk0tr/x0tor0) — pozitif sekans AC PF'de kullanılmaz
- Çok fazlı / StaCubic.cPhInfo faz çözümlemesi (phtech tüm 86.562 satırda 0)
- VT/EMT/RMS, VSC, ElmAsm, ElmSvs modelleri
- VeraGrid kaynak kodunun kopyalanması (MPL-2.0)
- Doğrulanmamış varsayımlara dayanan davranış (bkz. U1-U15)
- Güçlendirilmiş kabul kriteri (G6-G23 başarısızsa rollback kabul, uydurma iyileştirme değil)
- Gerçek DGS/JSON/ZIP verisinin commitlenmesi
- destructive git komutları (reset --hard, clean -fd, push --force)
```

**Lisans notu:** VeraGrid **MPL-2.0**'dir. Bu prompt'taki tüm öneriler
algorithmic concept / data semantics / mathematical formulation / architecture pattern
seviyesindedir. **Hiçbir VeraGrid kodu kopyalanmamıştır.** Özellikle P0-1'deki vektör
grubu→açı tablosu **IEC 60076'dan türetilmelidir**, VeraGrid'den değil (VeraGrid bu
dönüşümü yapmaz). P0-2'deki permütasyon/pivot **standart sayısal lineer cebirdir**, VeraGrid
kodu değil.

---

## 15. Tamamlanma tanımı

Bu iş **şunlar sağlandığında tamamlanmıştır:**

1. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`
   tamamı yeşil.
2. P0-1, P0-2, P0-3 uygulanmış ve **her biri kendi testleriyle** kanıtlanmış.
3. Tam model **en fazla üç** koşu ile değerlendirilmiş; her koşunun JSON çıktısı
   `docs/validation/` altında.
4. G7, G8, G10 (doğruluk) ve G17, G18, G23 (performans) kapıları **gerçek sayılarla**
   raporlanmış. Başarısızsa **açıkça yazılmış** — saklanmamış, iyileştirilmemiş.
5. `docs/` güncellenmiş, `transformer-vector-group.md` yazılmış.
6. Branch push edilmiş, **`main` ve `release/v7.4-final` değişmemiştir**.
7. `VERAGRID_GRID_ANALYZER_DGS_LOADFLOW_COMPARISON.md` **değiştirilmemiştir**.

**Başarı kriteri:** "VeraGrid'i inceledim" demek değildir. Başarı, **üç sayısal kapının
gerçek model üzerinde ölçülmesidir** — kökten gelen varsayımla değil, XLSX'teki
PowerFactory referansıyla karşılaştırılarak.
