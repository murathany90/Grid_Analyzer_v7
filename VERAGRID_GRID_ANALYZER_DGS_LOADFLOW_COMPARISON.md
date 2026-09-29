# VeraGrid ↔ Grid_Analyzer_v7 — DIgSILENT PowerFactory DGS Import + AC Load Flow Karşılaştırmalı Kaynak Kod Denetimi

**Rapor türü:** Kaynak kod denetimi (source-level audit). Her iddia dosya/satır referansıyla desteklenmiştir.
**Rapor tarihi:** 2026-09-29
**Kapsam:** Bu rapor production kodunu değiştirmemiştir. Yalnızca iki doküman üretilmiştir.

---

## Executive Summary

Bu rapor iki bağımsız kod tabanının DGS import yolunu ve AC yük akışı formülasyonunu
kaynak kod seviyesinde izlemiştir. Aşağıdaki bulgular **kanıtlanmıştır**.

### 1. ZIP/voltage-dependent yük modeli bu veri kümesi için GEREKSİZDİR

Görevde doğrulanması istenen "VeraGrid `ComLdf.iopt_pq` + `TypLod` ZIP modelini işliyor,
Grid Analyzer'da eksik" hipotezi **VeraGrid tarafında kod seviyesinde DOĞRUDUR**, ancak
**bu veri kümesi için pratikte önemsizdir**, çünkü gerçek YTBS DGS dışa aktarımında:

| Alan | Gerçek veride var mı? | Kanıt |
|---|---|---|
| `TypLod` tablosu | **YOK** — 3 modelin hiçbirinde | §6.1 |
| `ElmLod.typ_id` kolonu | **YOK** | `ElmLod.Attributes` 9 kolon, §6.1 |
| `ComLdf.iopt_pq` kolonu | **YOK** (tüm 40 tabloda regex taraması boş) | §6.1 |
| `ElmLod.scale0` | **YOK** | tüm tablolarda yok, §6.1 |
| `plinir/plinis/plinit`, `qlinir/qlinis/qlinit`, `i_sym` | **YOK** | §6.1 |
| `ElmLod.phtech` | **YOK** | §6.1 |

Sonuç: `ElmLod` gerçekte **yalnızca `plini`/`qlini`** taşıyan klasik sabit P/Q kaydıdır.
Grid Analyzer'ın bugünkü davranışı (`canonical.ts:89`) **bu veri için doğrudur**, sadeleştirme
değildir. ZIP sistemi önermemek veri destekli bir karardır (§16'da yok).

### 2. PQV hipotezi YARI YANLIŞTIR

Hipotez: *"remote generator voltage control için P/PQV bus formulation; PQV bus'ta |V| ve Q
serbest, Q neden serbest kalıyor?"*

Kaynak kod **bunun tersini** gösterir:

- **DOĞRU kısım:** VeraGrid (`Compilers/circuit_to_data.py:95-97`) uzak kontrol edilen bara
  `PQV_tpe`, aktüatör barı `P_tpe` atar.
- **YANLIŞ kısım:** PQV barında `|V|` serbest **değildir** — setpoint'e sabitlenir
  (`circuit_to_data.py:107`), ve PQV barında bir `dQ` **denklemi** vardır
  (`pf_basic_formulation.py:101`: `idx_dQ = np.r_[pq, pqv]`).
- Q'nun serbest kaldığı yer **P (aktüatör) barıdır**, PQV barı değil (`bus_data.py:413-418`).

Düzeltilmiş ifade (§10.4): Aktüatör barı → `P_tpe`: yalnız P verilir, `Va`+`Vm` Newton
bilinmeyenleridir, Q serbest ağ çıktısıdır. Uzak bar → `PQV_tpe`: P, Q **ve** |V| hepsi
verilmiştir, yalnız θ hesaplanır. Çift, PQV barının fazladan `dQ` denklemi ile kare kalır.

### 3. Grid Analyzer'da iki gerçek kod hatası DOĞRULANDI

- **Hata A** (`station-controls-v73.ts:47,53`): baseline'da çözülen Q, ownership geçişinde kayboluyor. §9.3
- **Hata B** (`station-controls-v73.ts:64,68`): `changed` bayrağı döngü-dışı kapsamda. §9.4

### 4. Transformer faz kaydırması: İKİ TARAFTA DA YOK

`TypTr2.tr2cn_h/tr2cn_l` vektör grubu ne Grid Analyzer'da (`canonical.ts:73`, `phase` sabit `0`)
ne de VeraGrid'de faz açısına dönüştürülmüyor. Gerçek veride de faz-kaydırma alanı yoktur
(`TypTr2` 24 kolon, `20260928-source-audit.md:12`). Etkisi büyüktür: ölçülen bara açı
MAE'si 1,3351°, ham medyan kayma 1,7586° (§13.3).

### 5. Lineer çözücü: iki tamamen farklı paradigm

| | VeraGrid | Grid Analyzer |
|---|---|---|
| Paradigma | **Doğrudan** (SuperLU sparse LU) | **İteratif** (ILU + GMRES/BiCGSTAB) |
| Kütüphane | `scipy.sparse.linalg.splu` | Kendi yazımı, sıfır bağımlılık |
| Düzen | CSC (COLAMD varsayılan) | CSR, **doğal sıralama (RCM/AMD yok)** |
| Pivotlama | SuperLU kısmi pivotlama | **Yok** — `±1e-10` ile sabitleniyor |

### 6. Öneri özeti

8 geliştirme fırsatı önerildi. En yüksek değerli iki tanesi P0:
1. **Remote voltage control'ün gerçekten uygulanması** (§16 P0-1)
2. **Lineer çözücüde sıralama + pivot stratejisi** (§16 P0-2)

İkisi de gerçek veride ölçülmüş en büyük iki sorunu (±2,9 MW hat P, 0,017 pu bara Vpu)
doğrudan hedefler.

---

## Environment / Commit Provenance

### VeraGrid

| Alan | Değer | Kanıt |
|---|---|---|
| **Absolute path** | `C:\VeraGrid\dev\VeraGrid` | `C:\VeraGrid\dev` bir git deposu **değildir**; alt dizin `VeraGrid/` depo köküdür |
| **Git branch** | `feature/turkish-localization` | `git rev-parse --abbrev-ref HEAD` |
| **Git HEAD SHA** | `411223f762eb4eb1046f64bfedba88e9b0cc88b3` | `git rev-parse HEAD` |
| **Son commit** | `411223f76 feat(i18n): translate contingency as Kısıt` | `git log -1 --oneline` |
| **Remote URL** | `https://github.com/SanPen/VeraGrid.git` | `git remote -v` |
| **git status** | **Temiz** — 0 satır | `git status --porcelain` |
| **Sürüm** | `6.7.0` | `src/VeraGrid/__version__.py:8` |
| **Python** | 3.12.10 | `C:\VeraGrid\dev\.venv\Scripts\python.exe --version` |
| **numpy / scipy** | 2.5.3 / 1.18.1 | runtime ölçümü — **lineer çözücü bu scipy'den gelir** |
| **Solver deps** | `scipy.sparse.linalg.splu` (SuperLU), `numba` (`@nb.njit(cache=True)`), `autograd` (opsiyonel) | `requirements.txt`, `Utils/Sparse/csc2.py:15` |
| **Lisans** | **MPL-2.0** | `LICENSE.md:1-2` |

> **Yol düzeltmesi:** Görevde verilen `C:\VeraGrid\dev` bir Python sanal ortam köküdür
> (`.venv/` + `VeraGrid/`). Git deposu `C:\VeraGrid\dev\VeraGrid`'dir. Bu rapor boyunca
> bu yol kullanılmıştır.

### Grid_Analyzer_v7

| Alan | Değer | Kanıt |
|---|---|---|
| **Absolute path** | `C:\projelerim\YTBS_PowerFactory_Sebeke_Goruntuleyici_v6_8` | |
| **Git branch** | `release/v7.4-final` → analiz dalı `analysis/veragrid-dgs-loadflow-comparison` | |
| **Git HEAD SHA** | `01395404fccf908b0b160b45759bb4ad30f4c81f` | |
| **Son commit** | `0139540 feat(v7.4): integrate station Q states into Newton` | |
| **Remote URL** | `https://github.com/murathany90/Grid_Analyzer_v7.git` | |
| **Sürüm** | `7.4.0` | `package.json:3`, `src/version.ts:3` |
| **Node / npm** | v26.5.1 / 11.17.0 | |
| **Runtime deps** | `fflate 0.8.3` — **tek bağımlılık**; lineer çözücü tamamen in-house | `package.json:26-28` |
| **Dev deps** | `typescript ^7.0.2`, `vite ^8.3.1`, `tsx ^4.23.15`, `playwright ^1.63.0` | |
| **Lisans** | **YOK** — `LICENSE*` dosyası yok, `package.json` `"private": true`, lisans alanı yok | `Get-ChildItem -Filter "LICENSE*"` → boş |

### GitHub referansı karşılaştırması

Yerel HEAD = referansla **birebir aynı** (`01395404...`). Branch upstream'i
`origin/release/v7.4-final`'e bağlı ve izleniyor. Yerel HEAD daha yeni **değil** — aynı.
Hiçbir destructive git komutu kullanılmadı.

**Dokunulmayan yerel dallar:** `feature/v7-architecture-migration`,
`fix/v7.1-numerical-robustness-validation`, `fix/v7.2-station-control-fidelity`,
`fix/v7.3-sensitivity-speed`, `fix/v7.3-station-control-correctness`, `main`, `release/v7.4-final`.

---

## VeraGrid DGS Import Architecture

### Gerçek çağrı zinciri

Görevde önerilen C# isimleri (`PFinit`, `PFGeneral`, `PFFolder`, `PFResults`, `PFCategory`,
`PFFileExplorer`, `GetEquipment`, `CleanRef`, `get_next_cls_ref`) **bu depoda hiç yoktur** —
bunlar Pandapower'ın C# isimleridir. Depoda C# kodu yoktur; tamamı Python'dur. VeraGrid'in
DGS importu **saf Python, header güdümlü, `;` ayraçlı deklaratif tablo parser**'ıdır.
COM/CAPI bootstrap, sequence handler, folder-tree walker veya result explorer **yoktur**.

```
FileOpen(file_name)                                    IO/file_open.py:354
  → determine_file_type() → FileType.DGS               IO/file_open.py:412 → :231, :294-295
  → open() → dgs_to_circuit(...)                       IO/file_open.py:418, :665, :667-673
     ├─ DgsCircuit.parse_dgs(path)                     IO/dgs/dgs_circuit.py:567
     │    ├─ parse_header(line)                        dgs_circuit.py:98
     │    │    └─ header_map['ID']=i if prop=='FID'    dgs_circuit.py:112-116
     │    ├─ ELEMENT_CLASS_BY_KIND.get(kind)           dgs_circuit.py:594  ← bilinmeyen tablo SESSİZCE düşer
     │    └─ DGSElement.parse_line(line, header_map)   IO/dgs/dgs_objects.py:212
     │         └─ DgsProperty.parse(raw)                dgs_objects.py:136
     ├─ MultiCircuit(); baseMVA = 100.0                 dgs_to_veragrid.py:7920-7922
     ├─ _build_stacubic_mappings                        :7935 → :6732
     ├─ _build_phase_map                                :7936 → :6778
     ├─ add_dgs_terminal_buses         ← BUSES           :7942 → :6979
     ├─ _add_elmcoup_switches          ← SWITCHES       :7957 → :6366 → :2887
     ├─ _add_elmsym_generators         ← ELMSYM         :7968 → :5320 → :5039
     ├─ _add_elmasm_generators         ← ELMASM         :7978 → :5359 → :5182
     ├─ _add_elmvac_loads              ← ELMVAC         :7987 → :5395 → :3903
     ├─ _add_elmlod_loads              ← ELMLOD         :7995 → :5425 → :3946
     ├─ _add_elmgenstat_devices        ← ELMGENSTAT     :8004 → :6120
     ├─ _add_elmxnet_devices           ← ELMXNET        :8033 → :6234
     ├─ _add_elmshnt_devices           ← ELMSHNT        :8041 → :6276
     ├─ [tip sözlükleri] TypLne/Tr2/…                   :8071-8102
     ├─ _add_elmlne_lines              ← ELMLNE         :8124 → :7699 → :3097
     ├─ _add_elmzpu / _elmscap / _elmsind              :8153 / :8163 / :8173
     ├─ _add_elmtr2 / _elmtr3 / _elmtr4 ← TRANSFORMERS :8184 / :8199 / :8212
     ├─ import_dgs_substations_and_schematic_diagrams   :8231 → dgs_schematic_import.py:2016
     └─ return grid                                     :8378
```

Public re-export: `IO/dgs/__init__.py:5`.

### Katman mimarisi

| Katman | Dosya | Satır | Rol |
|---|---|---:|---|
| Şema | `IO/dgs/dgs_objects.py` | 6298 | 91 tablo tipi; `DgsProperty` (:73), `DGSElement` (:199) |
| Konteyner + parser | `IO/dgs/dgs_circuit.py` | 691 | `parse_header` (:98), `DgsCircuit` (:165), `parse_dgs` (:567) |
| **Dönüştürücü** | `IO/dgs/dgs_to_veragrid.py` | **8378** | `dgs_to_circuit` (:7900) + 180 fonksiyon |
| SLD/şema | `IO/dgs/dgs_schematic_import.py` | 2539 | `IntGrf*` geometri |
| Ters yön (export) | `IO/dgs/veragrid_to_dgs.py` | 1368 | |

> **Ölü kod uyarısı:** `IO/dgs/dgs_parser.py` (1264 satır; `read_DGS` :87, `dgs_to_circuit` :1256)
> **ölü koddur** — sıfır importer. `file_open.py:24` `dgs_to_circuit`'i `dgs_to_veragrid`'den
> import eder. Ayrıca Python 3'te runtime-bozuk (`str` üzerinde `.decode()` :739).
> Bu dosya denetlenmemelidir.

### FID / referans çözümleme

Tek normalizatör **`_ref_id`** (`dgs_to_veragrid.py:154-167`): DGS referansları ya çıplak FID
(`"12345"`) ya tam yol (`"Project\ActiveStudy\ElmTerm\12345"`); her arama bundan geçer.
Merkezi çözümleyici **`_resolve_pointer_dict_value`** (`:270-287`), 19 çağrı noktası.
Tüm tip sözlükleri hem ham `ID` hem `_ref_id(ID)` ile çift anahtarlı kaydedilir (`:7064-7579`).
FID bütünlük kapısı `add_dgs_terminal_buses:6999-7004`: boş veya **tekrarlı** `ElmTerm.FID`
tüm import'u `ValueError` ile düşürür.

### Topoloji kurulumu

**Kubikül tabanlıdır.** `StaCubic` tek bağlantı omurgasıdır.
`_build_stacubic_mappings` (`:6732-6775`) iki indeks üretir: `stacubic_dict` (eleman FID → terminal
indeksi) ve `cubics_by_objid` (eleman FID → `[StaCubic]`). Terminal sıralaması
**`StaCubic.obj_bus`**'a göredir (0=from, 1=to) — `:602-606`. Dal yönü gerilimden değil
DGS bildiriminden gelir. Tüm cihaz dönüştürücüleri `bus_by_term_id[FID]` indeksini kullanır.

### NaN/boş alan fallback

`DgsProperty.parse` (`dgs_objects.py:136-184`):
- `raw in (None, "", "*")` → optional ise `None`, değilse `default_value`
- bozuk sayısal metin, **optional olmayan** kolonda **`0.0`**'a düşer — gerçek sıfırdan
  **ayırt edilemez** (`dgs_objects.py:177-181`)
- Kolon header'da **yoksa** kurucu varsayılanı kalır (`:244-247`)
- `float("nan")` hücresi `NaN`'ı sessizce yayıyor (`:176`)

### Servis durumu

Bayrak **`outserv`**; `outserv == 0` ⇒ hizmette. `userv` **hiçbir yerde yok** (0 eşleşme).
`ElmTr2` (`:2210-2212`) ve `ElmVsc` (`:5828-5836`) ayrıca
`_is_element_closed_by_cubicle_switches` ile AND'lenir. `ElmCoup`/`StaSwitch` `outserv`
kullanmaz, **`on_off`** kullanır (`:2945`).

### Balanced/unbalanced ve faz

Faz çözümü tam uygulanmıştır: `_build_phase_map` (`:6778-6874`) sabit nokta iterasyonuyla küresel
faz haritası kurar, çakışmada `ValueError` fırlatır (`:6814`, `:6844`), çözülemeyen iletkenlerde
uyarır (`:6867`). Uygulama: hat (`:3461-3472`), trafo (`:2283-2300`), shunt `ctech` (`:4608-4655`).
Kulelerde faz varyantı başına ayrı `OverheadLineType` üretilir (`:7448-7472`).

**Ancak gerçek veri setinde** `ElmTerm.phtech` **tüm satırlarda 0**'dır (tek distinct değer)
ve `ElmLod.phtech` kolonu hiç yoktur. Bu katkı bu veri için **hiçbir şey üretmez**.

### Desteklenmeyen veri raporlama

`basic_structures.py`: `LogEntry` (:294), `Logger` (:365), `add_info/add_warning/add_error`
(:400/:425/:450), `to_df/to_xlsx/to_csv` (:550-584). `dgs_to_veragrid.py` içinde
**61** uyarı/bilgi/hata çağrısı ve **22** `raise ValueError` noktası.

**Raporlanmayan sessiz veri kaybı (denetim bulguları):**

1. **Bilinmeyen `$$` tabloları sessizce düşer** — `dgs_circuit.py:594-601`, `else` dalı yok.
2. `StaCalc` ve `ElmRes` **şemada hiç yok** → PF `iopt_*` seçenekleri ve sonuç tabloları tamamen yok.
3. `TypGeo` parse edilir, hiç okunmaz (`:419`/`:502` yaratılır, yerde yok).
4. `ElmVac.itype` 0/1/3 sessizce yok sayılır (`:5413` yalnız `itype==2`).
5. **Yalnız `ComLdf[0]`** kullanılır (`:5444`).
6. **`ElmSym.i_mot` yok sayılır** — motorlar pozitif P'li `dev.Generator` olur (`:5151`).
7. `ElmTr4` tap verisi kaybolur — `_apply_tr4_winding_tap_data` `:2750`'de çağrılıyor ama
   `return trafo4w` `:2748`'de.
8. `_order_tr4` asla çağrılmıyor (tek referans yorum satırı `:2622`).
9. `convert_dgs_to_switch` (`:3046`) asla çağrılmıyor → **`StaSwitch` hiç `dev.Switch` olmaz**.
10. `ElmLod` `idtag` kaybolur — `dev.Load(...)` `:4007-4018`, `:4023-4034`, `:4038-4049`
    **idtag geçmez**.
11. `load.conn` **beyan edilmemiş bir özniteliktir** — `:4052-4069`'da yazılır, `Load` sınıfında
    `conn` yok, çözücü tarafından **hiç okunmaz**.

---

## Grid Analyzer DGS Import Architecture

```
load(files)                                        features/model/model-view.ts:67
 → inspectModelFile(file)                          importers/model-file.ts:10  (ZIP+CRC32)
 → worker LOAD_MODEL                               app/controller.ts:28
   → new DgsModel(raw,name,size) + build()         importers/dgs/index.ts:243, :282
     ├─ freezeDgsTable / cloneRawRow               index.ts:124, :186
     ├─ FID→row index + fold_id→parent            index.ts:301-321
     ├─ readMetadata()   General/SetTime/ComLdf   index.ts:325 → :487
     ├─ buildSites()     ElmSite+ElmSubstat       index.ts:327 → :503
     ├─ buildLines()     ElmLne+TypLne            index.ts:331 → :562
     ├─ buildGeometry()  Matrix                   index.ts:335 → :603
     └─ buildEquipmentIndex/finishSites/stats     index.ts:340-343
   → mapCanonical(source, modelHash)                importers/dgs/canonical.ts:9
 → PREPARE → prepareModel(effective)               analysis/power-flow/preparation.ts:10
   → buildTopology(n)                               topology/electrical-topology.ts:10
 → runStationControlledIslandV73(...)               power-flow/station-controls-v73.ts:86
   → runIntegratedStationControls (zeroDroop)       station-controls-v73.ts:46
     → solveNR(model, progress, options)            js/newton.ts:14
       ├─ buildY                                    js/ybus.ts:4
       ├─ makeLayout / calcPQ / fillJacobian        js/jacobian.ts:16, :4, :66
       └─ solveLinear / solveLinearFill1            js/linear-solver.ts:85, :90
 → mapResults(prepared, numerical, identity)       power-flow/results.ts:6
 → packResult → ResultStore                        workers/result-codec.ts
```

### Mimari fark — kanıtlanabilir avantaj

VeraGrid "**aynı dosyada 8378 satırlık düz bir orchestrator**" kullanır
(`dgs_to_circuit` tek fonksiyon, 180 yardımcıyla paylaşık). Grid Analyzer
"**tabaka ayrımı**" kullanır: `importers/dgs/index.ts` (ham tablo indeksi) →
`importers/dgs/canonical.ts` (tek saf fonksiyon) → `domain/model/network.ts` (değişmez tipler) →
`analysis/power-flow/preparation.ts` (sayısal derleme).

`mapCanonical(m, modelHash)` girişine bağlı **saf ve izole** bir fonksiyondur; test edilebilir
ve değiştirilebilir. VeraGrid'de `dgs_to_circuit` 8378 satırlık tek fonksiyondur ve
`convert_dgs_to_*` dönüştürücüleri arasında gizli durum paylaşır. **Bu mimari, kopyalanmalıdır.**

### Canonical temsili

`src/importers/dgs/canonical.ts` **hiçbir tip dışa aktarmaz** — yalnızca
`export function mapCanonical(m: DgsModel, modelHash: string): CanonicalNetwork` (`:9`).
Tipler `src/domain/model/network.ts` (64 satır):

| Satır | Tip | Alanlar |
|---|---|---|
| `:4-8` | `Entity` | `id, name, sourceClass, sourceId, inService, siteIds, sourceRefs` |
| `:9` | `Bus` | `vnKv, parentId` |
| `:10-17` | `Line` | `from, to, vnKv, lengthKm, rOhm, xOhm, bSiemens, ratingMva, capacity?, coordinates, sections, fastParameters?` |
| `:18-22` | `Transformer2W` | `from, to, vnKv, lvKv, rPu, xPu, tap, phase, ratingMva, tapPosition, gPu, bPu` |
| `:23-27` | `Generator` | `bus, pMw, qMvar, vmSet, voltageControl, qMin, qMax` |
| **`:28`** | **`Load`** | **`bus, pMw, qMvar` — ÜÇ alan, fazlası yok** |
| `:29` | `Shunt` | `bus, gPu, bPu, nominalQMvar?` |
| `:30` | `SeriesCompensator` | `from, to, rOhm, xOhm` |
| `:31` | `ExternalGrid extends Load` | `+ vmSet, bustpRaw?, modeInputRaw?` |
| `:32` | `Switch` | `from, to, closed, cubicleId?, equipmentId?` |
| `:33-44` | `StationController` | `remoteBus, unitIds, vmSet, unitRefs?, qParticipationRaw?, controlModeRaw?, selectedBusModeRaw?, distributionModeRaw?, droopModeRaw?, droopValueRaw?, ratedPowerRaw?, qSetpointRaw?, measurementRefRaw?, measurementCubicleRaw?, qOrientationRaw?, measurementSelfCubicle?, modeSemantics?` |

**`sourceRefs`** alanı (`network.ts:3`) her cihaz için ham DGS alanını pro-kökeniyle saklar
(`SourceRef {sourceClass, sourceId, field, unit?}`). Bu, görevde sorulan
"raw veri korunuyor" kavramının **mükemmel** bir uygulamasıdır.

### FID / referans çözümleme

1. **Sütunlu ham indeks** — `index.ts:301-321` `index: Map<class, Map<FID,rowIndex>>`.
   Eksik FID → `'Eksik FID'` (:309); yinelenen → `'Tekrarlı FID'` (:312).
2. **StaCubic köprüsü** — `canonical.ts:19-22`:
   ```ts
   const cubs = new Map(cubicleRows.map(r => [str(r.FID), str(r.fold_id)]));
   const endpoint = (id) => cubs.get(str(id)) || '';
   ```
   Her `bus1/bus2/bushv/buslv` bir StaCubic FID'idir → `StaCubic.fold_id` ile ElmTerm FID'e
   çevrilir. Bilinmeyen kübikül **sessizce `''` döner** — hata değil.

**VeraGrid farkı:** VeraGrid aynı köprüyü kurar ama FID bütünlüğünü **sert doğrular**
(`ValueError`). Grid Analyzer **sessiz geçer** ve `preparation.ts:16`'da null endpoint'i
sessizce düşürür. Bu Grid Analyzer'ın **daha zayıf** bir yanı: bozuk referans modeli sessizce
küçülmüş bir ağa dönüşebilir.

### NaN/boş fallback

Tek evrensel sayı okuyucu — `canonical.ts:6`:
```ts
const num = (v, fallback = 0) => v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback;
```
`null`, `''`, `'abc'`, `NaN`, `Infinity` → **sessizce 0**. DGS `*` ve boş hücreler için doğru
davranış. "0 mı yoksa yok mu" ayrımı gereken alanlar için `canonical.ts:104` `rawNumber`
ayrı okuyucu tanımlamıştır (`null` döner). **İyi tasarım.**

**Bilinçli NaN yayılımı** (doğrulama reddedebilsin diye): `:55` `rOhm: num(type?.rline, NaN)*num(r.dline)`,
`:64` `num(r['mTaps:'+index], NaN)`, `:98` `xOhm: num(r.bcap) > 0 ? -1/num(r.bcap) : NaN`.
Sonra `jacobian.ts:68` `put()` sonsuz olmayan değerleri atlar, `preparation.ts:17` uyarır.
**VeraGrid'in `0.0`'a sessizce düşmesinden daha iyi.**

### Servis durumu

Tek doğruluk kaynağı `canonical.ts:16`: `inService: num(r.outserv) !== 1`
— **`outserv` yoksa 0 ⇒ hizmette**; yalnız literal `1` hizmet dışı.
Yayılım `preparation.ts:14`: `enabled(e) = e.inService && !topology.blockedEquipment.has(e.id)`.
`blockedEquipment` **yalnız `StaSwitch`** tarafından doldurulur (`electrical-topology.ts:14-17`).

---

## PowerFactory Class Mapping Matrix

Legend: **R** = elektriksel modelde okunur ve kullanılır ·
**P** = ham satıra parse edilir, elektriksel modelde **kullanılmaz** (korunur ama etkisiz) ·
**D** = `__slots__`'ta var, `properties_list`'te yok ⇒ **hiç parse edilmez**

| PowerFactory | VeraGrid | VG konum | Grid Analyzer | GA konum | VG alanlar | GA alanlar | Elektriksel etki | Öneri |
|---|---|---|---|---|---|---|---|---|
| **`ElmTerm`** | ✅ | `dgs_to_veragrid.py:685` `convert_dgs_to_bus`; kayıt `:6979` | ✅ | `canonical.ts:23-24` | **R:** `ID, loc_name, uknom, outserv, iUsage, systype, m:u, m:phiu, vtarget, cpArea, cpZone`. **P:** `phtech, typ_id, unknom, iminus, GPS*, cpGrid, cpSubstat, cpSite`. **D:** `bustp` | **R:** `FID, loc_name, fold_id, uknom, outserv`. **P:** `phtech, iUsage, iBayEnd, cimRdfId` | **Düşük.** VG `m:u` ile Vm0 seed alır; gerçek veride `m:u` **yok**. `vmin`/`vmax` **iki tarafta da kullanılmıyor** | **P2:** `vmin`/`vmax` (`iOPFCvmin/vmax`) ile bara gerilim bandı doğrulaması |
| **`ElmLne`** | ✅ | `:3097` `convert_dgs_to_line`; kayıt `:7699` | ✅ | `canonical.ts:30-57`; `:562-601` | **R:** `ID, loc_name, typ_id, dline, fline, outserv, nlnum, fold_id`. **P:** `chr_name, pStoch, for_name, GPScoords, inAir` | **R:** `FID, loc_name, bus1, bus2, typ_id, dline, fline, outserv, GPScoords:MATRIX` + `TypLne.{rline,xline,bline,sline,uline}` + `ElmLnesec` toplamı | **Düşük-orta.** İkisi de r/x/b toplamını doğru hesaplar. VG `nlnum` paralellik ve `fline` derating uygular; GA `nlnum`'u **hiç okumaz** | **P1:** `nlnum` (paralel hat) modellenmiyor — gerçek veride kontrol edilmeli |
| **`ElmTr2`** | ✅ | `:2130` `convert_dgs_to_transformer`; `:8184` | ✅ | `canonical.ts:58-75` | **R:** `typ_id, nntap, ntrcn, usetp, i_auto, i_eahv, i_ealv, ratfac, ntnum, outserv, loc_name, fold_id` + `TypTr2.{utrn_h/l, strn, pcutr, pfe, curmg, uktr, ntpmx, ntpmn, nntap0, dutap, phitr, itapch, tr2cn_h/l, nt2ag, tap_side, nt2ph, uk0tr, ur0tr}`. **P:** `sernum, constr, cgnd_*, usp_*, t2ldc, mTaps:*` | **R:** `FID, loc_name, fold_id, typ_id, bushv, buslv, nntap, outserv, mTaps:*` + `TypTr2.{strn, uktr, pcutr, utrn_h/l, tap_side, itapch, ntpmn, nntap0, dutap, curmg, pfe}`. **P (kayıp):** **`tr2cn_h/l`**, `uk0tr/x0tor0`, `cneutcon`, `i_auto`, `ntpmx` | **YÜKSEK.** `tr2cn_h/tr2cn_l` faz açısına dönüştürülmüyor → `phase: 0` sabit (`canonical.ts:73`), provenance `PHASE_SHIFT_SOURCE_UNAVAILABLE` (`:74`). §8 | **P0:** Faz kaydırması — §16 P0-1 |
| **`ElmTr3`** | ✅ | `:2430`; `:8199` | ❌ | **0 eşleşme** (`src/`, `tests/`, `docs/`) | **R:** `typ_id, n3tap_h/m/l, nt3nm, outserv, loc_name, fold_id` + `TypTr3.{utrn3_*, strn3_*, pcut3_*, uktr3_*, pfe, curm3, n3tp0_*, n3tmn_*, n3tmx_*, du3tp_*, ph3tr_*, tr3cn_*, nt3ag_*}`. **P:** `chr_name, i_auto_hl, ictrlside, ntrcn, t3ldc, usetp, mTaps:*, iMeasTap` | — | **Düşük (bu veri için).** Gerçek veride `ElmTr3` **yok** (3/3 model) | **YAPMA.** Sıfır örnek |
| **`ElmTr4`** | ⚠️ | `:2575`; `:8212` — **tap verisi kaybolur** | ❌ | 0 eşleşme | **R:** `typ_id, bush0, busl1-3, nt4nm, outserv, loc_name, fold_id` (yalnız `TypTr4` empedansı). **ÖLÜ:** `ntap_h0/l1/l2/l3` (`:2753`, `return` `:2748`'den sonra) | — | **Yok** | **YAPMA** |
| **`ElmLod`** | ✅ | `:3946` `convert_dgs_to_load`; `:5425` | ⚠️ | `canonical.ts:89` (tek satır) | **R:** `plini, qlini, slini, coslini, scale0, phtech, i_sym, plinir/is/t, qlinir/is/t, outserv, typ_id, ID, loc_name`. **P:** `chr_name, for_name, mode_inp, pf_recap, i_scale, classif` | **R:** `FID, loc_name, fold_id, bus1, plini, qlini, outserv`. **P (kayıp):** `u0`, `cimRdfId`. **Yok:** tüm yük modeli alanları | **Düşük (bu veri için).** §6.1'de kanıtlandı | **YAPMA** (ZIP). §6.5 |
| **`TypLod`** | ✅ (okur) | `dgs_objects.py:4258`; tüketim `:3988-4002` | ❌ | **0 eşleşme** | **R:** `aP, bP, aQ, bQ` — **yalnız tam-eşitlik testinde**. **P:** `kpu, kqu, kpu0, kpu1, kqu0, kqu1, systp, phtech` (**hiç okunmaz**) | — | **VG'de kısmen ölü.** Kısmi ZIP katsayıları (ör. `aP=1.5, bP=0.5`) hiçbir dalı tetiklemez | **YAPMA** — §6.5 |
| **`ElmSym`** | ✅ | `:5039` `convert_dgs_to_generator`; `:5320` | ✅ | `canonical.ts:76-88` | **R:** `typ_id, pgini, qgini, usetp, av_mode, iv_mode, cosgini, q_min, q_max, Pmin_uc, Pmax_uc, ip_ctrl, ngnum, outserv, loc_name` + `TypSym.{sgn, cosn, rstr, xstr, r0sy, x0sy, r2sy, x2sy}`. **P:** `chr_name, iqtype, cCategory, c_pmod, pf_recap, phtech`. **Gözden kaçan:** `i_mot` | **R:** `FID, loc_name, fold_id, bus1, pgini, qgini, usetp, av_mode, cQ_min, cQ_max, pQlimType, outserv`. **P (kayıp):** `sgn, ngnum, i_mot, Pmin_uc, Pmax_uc, ip_ctrl, typ_id` | **Orta.** `ip_ctrl` (slack atama) VG'de var, GA'da **kayıp**. Gerçek veride `ip_ctrl=0` tüm satırlarda | **P2:** `typ_id`→`TypSym.sgn` ile `ratingMva` üret |
| **`ElmGenStat`** | ✅ | `:4074/:4121/:4170/:4217`; `:6120` | ✅ | `canonical.ts:76-88` (else-dalı) | **R:** `cCategory, av_mode, pgini, qgini, sgn, usetp, ip_ctrl, ddroop, usp_min, usp_max, cQ_min, cQ_max, ngnum, outserv, loc_name`. **P:** `chr_name, bus1, fold_id, mode_inp, c_pmod, cosn` | **R:** `FID, loc_name, fold_id, bus1, pgini, qgini, usetp, av_mode, pQlimType, outserv`. **P (kayıp):** `sgn, cosn, ngnum, Pmin_uc, Pmax_uc, psutype, umin, uonthr` | **Orta.** GA `qMin/qMax`'ı yalnız `IntQlim` eğri interpolasyonundan üretir (`canonical.ts:80-84`). Gerçek veride `IntQlim` 283–287 satır, `pQlimType` 230 distinct `QLIM<id>` referansı ⇒ **bu yol çalışıyor** | **P1:** `sgn` → `ratingMva` (şu an doldurulmuyor) |
| **`ElmXnet`** | ✅ (hepsi `dev.Generator`) | `:4322`; `:6234` — `ExternalGridMode` asla üretilmez (`short_circuit=True` sabit `:6252`) | ✅ | `canonical.ts:91, :122`; slack `preparation.ts:28,45` | **R:** `bustp, rntxn, snss, cmax, xd, xq, pgini, qgini, usetp, outserv, loc_name`. **P:** `snssmin, rntxnmin, z2tz1*, cgnd, iaintgnd, ikssmin, r0tx0*, chr_name, fold_id` | **R:** `FID, loc_name, fold_id, bus1, outserv, pgini, qgini, usetp, bustp, mode_inp`. **P (KAYIP — kritik):** **`cQ_min`, `cQ_max`** | **YÜKSEK.** Gerçek veride `cQ_min=−500, cQ_max=+500` **mevcut**. GA düşürüyor ⇒ `preparation.ts:31` bir dış şebeke hiçbir zaman `qMinNet/qMaxNet` sağlayamıyor | **P1:** `cQ_min/cQ_max` okunmalı |
| **`ElmVac`** | ✅ | `:3903` `convert_dgs_ward_equivalent_to_load`; `:5395` | ⚠️ | `canonical.ts:90`; `preparation.ts:27` | **R:** `itype(==2), Pload, Qload, Pgen, Qgen, Pzload, Qzload, outserv, loc_name`. **P:** `OP, for_name, fold_id` | **R:** `FID, loc_name, fold_id, bus1, outserv, Pload, Qload`. **P (KAYIP):** `usetp, Unom, R1, X1, R2, X2, R0, X0, nphase, itype` | **Orta.** VG `Pzload/Qzload`'u kompandans (G/B) olarak kullanır; GA tamamen sabit P/Q. Yalnız 12 adet | **P2 (düşük):** `Unom` doğrulaması + `itype` raporlaması |
| **`ElmShnt`** | ✅ | `:4578` `convert_dgs_to_shunt`; `:6276` | ⚠️ | `canonical.ts:92-97`; `preparation.ts:23` | **R:** `shtype, ushnm, qtotn, fres, ctech, grea, qcapn, qrean, ncapx, ncapa, rpara, tandc, iswitch, i_cont, usetp, usetp_mx/mn, cgnd, outserv, loc_name`. **P:** `chr_name, greaf0, fold_id` | **R:** `FID, loc_name, fold_id, bus1, outserv, shtype, qrean, qcapn, ncapx, ncapa`. **P (KAYIP):** `ushnm, iswitch, i_opt, i_optCont`, **`mTaps:*` (35 kolon)** | **Orta.** GA shunt adım anahtarlamasını **tamamen kaybediyor**. VG `ctech` ile faz dengesizliği de yapıyor. 137–138 adet | **P2:** `ushnm` nominal gerilim doğrulaması. Adım anahtarlama düşük değer |
| **`StaSwitch`** | ⚠️ | `:2871` — **hiç `dev.Switch` üretmez** | ✅ (dolaylı) | `canonical.ts:100-103`; **bloklayıcı** `electrical-topology.ts:14-17` | **R:** `fold_id` (→ `StaCubic.ID`), `on_off`. **P:** `ID, aUsage, iUse, typ_id, loc_name` | **R:** `FID, loc_name, fold_id, on_off, outserv`; sahip `StaCubic.obj_id` | **Düşük.** Gerçek veride **`StaSwitch` tablosu YOK** (3/3) | **YAPMA** |
| **`ElmCoup`** | ✅ | `:2887` `convert_dgs_to_switches_from_elmcoup` | ✅ | `canonical.ts:99`; birleştirme `electrical-topology.ts:13,18-22` | **R:** `ID, loc_name, typ_id, on_off` (otoriter), `aUsage`. **P:** `chr_name, nneutral, nphase, for_name, fold_id` | **R:** `FID, loc_name, fold_id, typ_id, on_off, aUsage, bus1, bus2, outserv`. **P:** `cimRdfId` | **Orta-önemli.** GA iki iyileştirme sunar: (a) **gerilim uyumsuzluk koruması** — `vnKv` farkı >%2 olan anahtarlar reddedilir (`:20`); (b) `StaSwitch` bloğu. **95.456 adet — modelin en büyük elektrik tablosu** | **P1:** Gerilim uyumsuzluk koruması VG'ye taşınmalı |
| **`ElmStactrl`** | ❌ | AC PF'de kabul edilmez (dinamik modülde `dgs_rms_*` var) | ✅ | `canonical.ts:106-118`; profilleme `:121`; sınıflandırma `preparation.ts:36-41`, `station-controls-v73.ts:94-113` | Yok | **R:** `FID, loc_name, outserv, fold_id, rembar, selBus, usetp, i_ctrl, psym:*, i_droop, Srated, ddroop, pQmeas, p_cub, qsetp, iQorient, imode` + **problanan** `cvqq*` (`:108-109`, yok) | **GRİT.** GA'da DGS semantiği **+** sayısal döngü birlikte var. 483 kontrol, 860 birim. **GA'nın en büyük tek mimari avantajı** | **P0:** formülasyonu düzelt (§16 P0-1) |
| **`ComLdf`** | ⚠️ | `dgs_objects.py:1545`; `:5444` **yalnız `[0]`** | ⚠️ | `canonical.ts:123`; saklanır `network.ts:56`; **yalnız `ictrlx`** tüketilir (`station-controls.ts:51` — ölü dosya) | **R:** `iopt_pq` (`:3988`). **P:** `loc_name, fold_id`. **D:** `ID` | **R:** `iopt_lim, itrlx, ictrlx, errlf, erreq, iPbalancing`. **P:** `iopt_chctr, iShowOutLoopMsg, iopt_initOPF, iItAlgStag, iInterChg, iInterType` | **Düşük-orta.** Gerçek veride `errlf=5, erreq=0.2, itrlx=100, iPbalancing=3`. GA Newton toleransı **sabit `1e-6` pu** (`newton.ts:36`); `erreq=0.2` hiç kullanılmıyor | **P1:** `erreq`/`errlf` ile yakınsama toleransı |
| **`StaCalc`** | ❌ | **yok** | ❌ | yok | — | — | PF'nin `iopt_*` çalışma durumu seçenekleri **hiçbir iki tarafta da** okunmuyor | **YAPMA** |
| **`ElmRes`** | ❌ | **yok** | ❌ | yok | — | — | Tek PF sonucu: `ElmTerm.m:u`/`m:phiu` (VG `:698-705`). Gerçek veride bu kolonlar **YOK** ⇒ düz `1.0∠0` başlangıç | Not: DGS sonuç karşılaştırması harici XLSX ile yapılıyor |
| **`ElmLodlv/lvp`** | ⚠️ | `:8062-8066` açık uyarı; **tamamen düşürülür** | ❌ | 0 | **P** (parse), kullanılmaz | — | Yüksek gerilim tarafı alçak gerilim yükleri kaybolur | **YAPMA** (veride yok) |

---

## Load Model Deep Dive

### 6.1 Gerçek YTBS DGS profil denetimi (P0 kararının dayanağı)

Üç gerçek model bağımsız olarak tarandı:

| Model | Tablo | Toplam satır |
|---|---:|---:|
| `kontrol1/20260923_1200_SN3_TR0.json` | 40 | 576.001 |
| `kontrol1/20260923_1600_SN3_TR0.json` | 40 | 576.074 |
| `kontrol1/20260928_0900_SN1_TR0.zip` → `.json` | 40 | 581.319 |

`ElmLod` sütunları (üç modelde birebir aynı):
```
[0] FID  [1] loc_name  [2] fold_id  [3] bus1
[4] plini  [5] qlini  [6] u0  [7] outserv  [8] cimRdfId
```

| Sorgulanan özellik | Sonuç | Yöntem |
|---|---|---|
| `TypLod` tablosu | **YOK** | `'TypLod' in d → false` (3/3); 40 anahtarlık tam listede yok |
| `ElmLod.typ_id` | **YOK** | `Attributes.includes('typ_id') → false`; global taramada `typ_id` var ama `ElmLne/ElmLnesec/ElmTr2/ElmSym/ElmCoup/TypSwitch`'te |
| `ComLdf.iopt_pq` | **YOK** | `iopt_pq\|plinipl\|plir\|ipq` regex'i 40 tablonun tüm attribute'larında → 0 eşleşme |
| `ComLdf` satır sayısı | **1** | `Values.length === 1` (3/3) |
| `ElmLod.scale0` | **YOK** | tüm tablolarda yok |
| `plinir/plinis/plinit`, `qlinir/qlinis/qlinit` | **YOK** | 0 eşleşme |
| `ElmLod.i_sym` | **YOK** | 0 eşleşme |
| `ElmLod.phtech` | **YOK** | `phtech` yalnız `ElmTerm`'de (indeks 3), orada **tüm 86.562 satırda 0** |
| `ElmLod.u0` | **VAR, değeri 1** | 2.523/2.523 satırda `1` — tek distinct değer |
| `ElmStactrl.cvqq` | **YOK** | 25 kolonluk listede yok |
| `ElmLne.nlnum` | **VAR** | GA okumuyor |

`ElmLod` değer dağılımları (12:00): `plini` toplamı **47.473,264 MW** (min −72,51, maks 166,506);
`qlini` toplamı **1.617,074 MVAr**; `outserv` 1.989 hizmette / 534 hizmet dışı.

**Sonuç:** Gerçek veri, PowerFactory'nin **klasik sabit P/Q** yük profilini export etmektedir.
`plini`/`qlini` zaten MW/MVAr cinsindendir; yüzde değeri değildir.

### 6.2 VeraGrid — `ElmLod` işleme zinciri

**Kayıt döngüsü** — `_add_elmlod_loads` (`:5425-5466`):
```python
5444:  comldf = dgs_grid.comldfs[0] if len(dgs_grid.comldfs) > 0 else None
5446:  typlod_by_id: Dict[str, TypLod] = dict()
5447:  for typlod in dgs_grid.typlods:
5448:      typlod_by_id[typlod.ID] = typlod
5453:  for elmlod in dgs_grid.elmlods:
5454:      typlod = _resolve_pointer_dict_value(key=elmlod.typ_id, mapping=typlod_by_id)
5455:      bus, load = convert_dgs_to_load(elmlod=elmlod, ..., comldf=comldf, typlod=typlod)
```

**P/Q çıkarımı** — `_extract_load_pq` (`:3737-3830`), üç dal:

| Dal | Koşul | Formül |
|---|---|---|
| A (faz bazlı) | `i_sym==1` ve tek fazlı **değil** (`:3750-3765`) | `pa=plinir·s`, `pb=plinis·s`, `pc=plinit·s`, `p=pa+pb+pc`; `qa=qlinir·s`… |
| B (tek fazlı) | `i_sym==1` ve tek fazlı (`:3767-3782`) | `pa=plini·s`; `pb=pc=0` |
| C (dengeli) | `i_sym!=1` (`:3784-3828`) | `p=plini`, `q=qlini`; **`p==0 and q==0`** ise `s=slini`, `cosphi=coslini` → `p=s·cosφ`, `q=s·√(1−cos²φ)` (`:3790-3804`). `p*=s`, `q*=s`; `faz_sayısı` `phtech`'ten (`:3811-3816`); `local_p = p/faz_sayısı` (`:3821-3828`) |

**`scale0`** — `_get_scale_factor` (`:3711-3734`):
```python
3720:  s = scale0
3721:  if s == 0.0:      return 1.0
3725:  if s > 10.0:      logger.add_warning("looks like percent.", ...); return s / 100.0
3734:  return s
```
⚠ **Sezgisel risk:** meşru `scale0 = 20.0` sessizce 100'e bölünür.

**Model seçimi** — `convert_dgs_to_load` (`:3946-4071`):
```python
3988:  use_voltage_dependency = comldf is not None and int(comldf.iopt_pq) == 1
3989:  is_constant_current = (typlod is not None
3991:      and typlod.aP == 0.0 and typlod.bP == 1.0
3993:      and typlod.aQ == 0.0 and typlod.bQ == 1.0)
3996:  is_constant_impedance = (typlod is not None
3998:      and typlod.aP == 0.0 and typlod.bP == 0.0
4000:      and typlod.aQ == 0.0 and typlod.bQ == 0.0)
```

| Dal | Koşul | `dev.Load` anahtarları |
|---|---|---|
| (a) sabit akım | `use_voltage_dependency and is_constant_current` (`:4005`) | `Ir=p, Ir1=pa, Ir2=pb, Ir3=pc, Ii=−q, Ii1=−qa, Ii2=−qb, Ii3=−qc` (`:4007-4018`) |
| (b) sabit empedans | `use_voltage_dependency and is_constant_impedance` (`:4021`) | `G=p, G1=pa, G2=pb, G3=pc, B=−q, B1=−qa, B2=−qb, B3=−qc` (`:4023-4034`) |
| (c) varsayılan / sabit güç | `else` (`:4036`) | `P=p, P1=pa, P2=pb, P3=pc, Q=q, Q1=qa, Q2=qb, Q3=qc` (`:4038-4049`) |

**Kritik gözlem:** `aP/bP/aQ/bQ` yalnız **tam-eşitlik** testlerinde kullanılır. Gerçek kısmi ZIP
katsayıları (ör. `aP=1.5, bP=0.5`) **hiçbir dalı tetiklemez**. `kpu/kqu/kpu0/kpu1/kqu0/kqu1`
**hiç okunmaz**. Yani **VeraGrid'in "ZIP desteği" gerçekte üç ayrık tam-ZIP özel durumundan ibarettir.**

### 6.3 VeraGrid — ZIP değerlendirme matematiği

`common_functions.py:374-384`:
```python
@nb.njit(cache=True, fastmath=True)
def compute_zip_power(S0, I0, Y0, Vm):
    return S0 + np.conj(I0 + Y0 * Vm) * Vm
```

Bileşenlere açılımı (`Vm = |V|`):
```
S_ZIP(V) = S0                        ← sabit güç     : P_P = P ,      Q_P = Q    (V'den bağımsız)
         + |V|   · conj(I0)          ← sabit akım    : P_I = Ir·|V| ,  Q_I = −Ii·|V|
         + |V|²  · conj(Y0)          ← sabit empedans: P_Z = G·|V|² ,  Q_Z = −B·|V|²
```

p.u. dönüşümü — üç **bağımsız** aile, yalnız **bus başına bir kez** `Sbase`'e bölünüyor:
```python
S0 = -sum_per_bus_cx(nbus, bus_idx, element.S * active) / Sbase   # load_data.py:233 + numerical_circuit.py:547
I0 = -sum_per_bus_cx(nbus, bus_idx, element.I * active) / Sbase   # :291 + :566
Y0 = -sum_per_bus_cx(nbus, bus_idx, element.Y * active) / Sbase   # :298 + :573
```
`element.S = get_S_at(t) = complex(P, Q)`, `element.I = get_I_at(t) = complex(Ir, Ii)`,
`element.Y = get_Y_at(t) = complex(G, B)` — **hiçbiri p.u.'ye çevrilmez** (`circuit_to_data.py:611-612`).
`conj()` **tüketim anında** uygulanır (`:384`).

> **Tespit:** `Load` sınıfında `S0/I0/Y0` **yoktur**. Bu diziler `LoadData`/`NumericalCircuit`
> tarafında üretilir. `Vbase` bu yolda **hiç geçmez** — bu doğrudur, çünkü `I0`/`Y0` zaten
> kullanıcı tarafından p.u. cinsinden tanımlanır.

**Ybus'a giden kısım:** Ana (pozitif sekans) formülasyonda **ne sabit-Z ne sabit-I yükü Ybus'a
girm ez**. `get_Yshunt_bus_pu()` (`numerical_circuit.py:575-580`) yalnız `shunt_data`'dan gelir;
`compute_admittances:420` yalnız onu ekler. Yükün Z bileşeni **yalnız eşleşme denklemi**
üzerinden `compute_zip_power`'ın `conj(Y0·Vm)·Vm` terimiyle gelir. 3-fazlı formülasyonda
constant-Z **Ybus'a gider** (`pf_basic_formulation_3ph.py:225-229`).

### 6.4 Grid Analyzer — kanıt

Yük işleme zincirinin **TAMAMI** üç satırdır:

```ts
// src/importers/dgs/canonical.ts:89
const loads = rows('ElmLod').map(r => ({ ...base('ElmLod', r), bus: endpoint(r.bus1), pMw: num(r.plini), qMvar: num(r.qlini) }));

// src/analysis/power-flow/preparation.ts:27
for(const e of [...n.loads, ...n.internationalConnections].filter(enabled)){const i=bi.get(e.bus);if(i!=null){pSpec[i]-=e.pMw;qSpec[i]-=e.qMvar;}}

// src/analysis/fast-ac/reduced-model.ts:22
for(const g of n.loads.filter(enabled)){const i=route(g.bus,g.name);if(i!=null){injections[i][0]-=g.pMw;injections[i][1]-=g.qMvar;}}
```

`Load` tipi (`network.ts:28`) **üç alan**: `bus`, `pMw`, `qMvar`.
`pSpec`/`qSpec` alanı `Load` üzerinde **yok** — bu adlar yalnız `NumericModel` üzerinde
(`preparation.ts:5`) bus başına birikmiş `Float64Array`'lerdir.

Eşleşme denklemleri (`newton.ts:33-34`) `P_spec − P(V,θ)` ve `Q_spec − Q(V,θ)`.
Yük terimi **V'den bağımsız bir sabittir**. `ybus.ts:20-23` Ybus'a yalnız
`model.shuntG/shuntB` ekler — **hiçbir yük admitansı eklenmez**.

**Arama kanıtı (hepsi 0 eşleşme, `src/` + `tests/` + `tools/` + `docs/`):**
`plinis`, `qlinis`, `coslini`, `scale0`, `TypLod`, `iopt_pq`, `iopt_lod`, `loadTyp`,
`apparentPower`, `PmaxPu`, `voltageDependency`, `constantPower`, `constantCurrent`,
`constantImpedance`, `loadModel`, `composite`, `Yload`, `Zload`.
`zip` için 31 eşleşmenin **tamamı** ZIP-archive ile ilgilidir (`model-file.ts:13`,
`xlsx-export.ts:30`, `map.css:4` vb.) — yük modeliyle ilgili **hiçbir** eşleşme yok.
`aP/bP/aQ/bQ` aramalarının tamamı `deltaP/baseQ` gibi harita anahtarları veya `bPu` değişkenidir.

**Sonuç:** Grid Analyzer gerçekten **kategorik olarak sabit P/Q**'dır — kodla kanıtlanmıştır.

### 6.5 20260928 benzeri gerçek modelde anlamlı fark var mı?

**Hayır.** Gerekçe:

| Metrik | Etki |
|---|---|
| Vpu | Yükün toplam kaybı üzerinden Vm'yi etkiler. `u0=1` ve `plini/qlini` zaten sabit P/Q ise, mevcut ve "doğru" ZIP modeli arasındaki fark **sıfırdır**. |
| Q akışı | `qlini` doğrudan kullanılıyor. Aynı gerekçeyle fark yok. |
| Kayıp | Sabit P/Q → kayıp ∝ V². ZIP → kısmi. Fark ancak ZIP verisi varsa ortaya çıkar; **yok**. |
| P akışı | `plini` doğrudan. Fark yok. |

**Tersine, ölçülen hata tamamen başka kaynaklardan geliyor** (§13.3):
sistematik −0,0155 pu bara gerilim bias'ı, 400 kV hatlarda 31,56 MW P MAE, 1,3351° bara açı MAE.
Bu hataların **hiçbiri** yük modelinden kaynaklanmaz. Kaynaklar: transformatör faz kaydırması (§8),
istasyon kontrolörü uygulanmaması (§9), dış şebeke Q limitleri (§7).

**Karar: ZIP/voltage-dependent yük modeli önlenmiştir.** Veri desteklemiyor, ölçülen hata buna
bağlı değil, ve uygulanması doğrulanmamış `ComLdf.iopt_pq` semantiğine dayanırdı
(`20260928-source-audit.md`: "Meaning/unit mapping unverified").

---

## Generator / Slack / Island Modeling

### 7.1 VeraGrid — `ElmXnet` ve slack

`convert_dgs_external_grid_to_generator` (`:4322-4389`):
```python
4349:  k = elmxnet.rntxn;  Sk = elmxnet.snss;  c = elmxnet.cmax
4356:  if xd == xq: x = xd
4358:  elif xd <= xq: x = xd
4361:  else: x = xq
4363:  Snom = x * sqrt(1 + k**2) * Sk / c
4364:  r1 = x * k * Sbase / Snom
4365:  x1 = x * Sbase / Snom
```
`bustp`: `'SL'` → slack, `'PV'`, `'PQ'` (`:4347`, `:4375-4387`).
`ip_ctrl` → `bus.set_is_slack_at(...)` (`:5075-5076`).
`ip_ctrl` **her zaman bir bara slack atar** — kapasite/öncelik seçimi yok.

**Ancak:** `_add_elmxnet_devices:6252` `short_circuit = True` **sabit kodlanmış**.
`ElmXnet` **daima** `dev.Generator`'a dönüşür; `convert_dgs_to_external_grid` (`:4392`,
`phiini`'yi okuyan) **erişilemez**. `ExternalGridMode` (VD/PV/PQ) **asla üretilmez**.

**Slack seçimi (4 kademe):**
1. `Bus.is_slack` bayrağı (`Devices/Substation/bus.py:73-77`, `:889-894`)
2. `get_bus_data:380-382` `bus.get_is_slack_at(t)` → `Slack_tpe`
3. **AC faz bölgesi başına otomatik terfi** — `select_ac_phase_reference_buses`
   (`numerical_circuit.py:253-356`): referanssız her faz bölgesinde **en büyük `Pbus`'lu PV**
   seçilir (`:342-351`)
4. **Ada düzeyinde yedek** — `compile_types` (`simulation_indices.py:39-59`): en büyük PV
   enjeksiyonu; PV yoksa "blackout grid" ve ada atlanır

Ada bölme: `split_into_islands` (`:1450-1483`) → `tp.find_islands` → **iteratif BFS**
(`Topology/topology.py:15-78`). Referanssız adalar sessizce atlanır
(`power_flow_worker.py:835, :864-865`): `'No slack nodes in the island'`.

**P dengeleme:** `PowerFlowOptions.distributed_slack` (varsayılan `False`) →
`compute_slack_distribution` (`discrete_controls.py:608-627`):
```python
617:  slack_power = Scalc[vd].real.sum()
618:  total_installed_power = bus_installed_power.sum()
621:  delta = slack_power * bus_installed_power / total_installed_power
```
**`iPbalancing` yoktur.** PowerFactory'nin `iPbalancing` seçeneğinin hiçbir karşılığı yok.

### 7.2 Grid Analyzer — `ElmXnet` ve slack

`canonical.ts:91` `ExternalGrid extends Load`; alanlar: `bus, pMw, qMvar, vmSet, bustpRaw?,
modeInputRaw?` + `sourceRefs: reference: bustp/mode_inp/usetp`.
**`cQ_min`/`cQ_max` düşürülüyor** (`:91`). Sonuç: `preparation.ts:31` bir dış şebekenin
`qMinNet/qMaxNet` sağlaması **matematiksel olarak imkânsız**.

Slack seçimi — `preparation.ts:45`:
```ts
const source = sources.filter(inSameComponent).sort((a,b)=>a.id.localeCompare(b.id))[0];
```
⚠ **FID sözlüksel olarak en küçük**, kapasiteye göre değil. `20260928-source-audit.md:13` bunu
"Priority semantics unverified" olarak işaretler. VG ise en büyük `Pbus`'lu PV'yi seçer —
**VG daha doğru bir politikadır** (§16 P1-4).

Slack barası `busType=2` olur (`:51`); `qMinNet/qMaxNet` **null edilmez** (slack için de duruyor).
Referanssız adalar: `preparation.ts:55` uyarı
`` `${unsupplied} bara referanssız adalarda; hesap sonucu yok.` `` ve **tümüyle düşürülür**.

### 7.3 Gerçek veri

`ElmXnet`: **1 satır**, `FID="SL1"`, `bus1="fsl0-1"` → `ElmTerm B116132`,
`bustp="SL"`, `mode_inp="PQ"`, `pgini=qgini=0`, `usetp=1`,
**`cQ_min=−500`, `cQ_max=+500`**, `outserv=0`.

Çözücü **2 ada** buluyor (`docs/validation/20260928-benchmark.json:33-54`):
```json
{"islandId":"island-1","busCount":4154,"branchCount":5249,"referenceSource":"SL1",
 "referenceBusId":"B116147","status":"CONVERGED","iterations":10}
{"islandId":"island-2","busCount":1,"branchCount":0,"referenceSource":null,"status":"NO_REFERENCE"}
```
Yalnız **1 baralık** yetim ada. Her çalışmada uyarı: `"1 bara referans adası dışında; hesap sonucu yok."`

### 7.4 Karşılaştırma

| Boyut | VeraGrid | Grid Analyzer |
|---|---|---|
| Çoklu dış şebeke | Desteklenir (`bustp` ayrımı) | Desteklenir (birim başına filtre) |
| **Dış şebeke Q limiti** | `q_min/q_max` okunur (`:5115-5129`) | **`cQ_min/cQ_max` düşürülüyor — YOK** |
| Slack önceliği | `ip_ctrl` + en büyük `Pbus` | **FID sözlüksel** |
| P dengeleme | `distributed_slack` (oranlı) | **Yok** |
| `iPbalancing` | Yok | Saklanıyor, yorumlanmıyor |
| Referanssız ada | Atlanır, loglanır | Atlanır, uyarılır |
| Ada bölme | BFS, HVDC opsiyonel bağ | BFS (`preparation.ts:32-35`) |
| HVDC'nin adaları bağlaması | `consider_hvdc_as_island_links` bayrağı (`:826-828` vs `:922-924`) | Yok (HVDC yok) |

---

## Transformer Modeling

### 8.1 Ortak: tap ratio ve OLTC

**VeraGrid** (`convert_dgs_to_transformer_type` `:1444-1481`):
```python
1460:  total_positions  = max(1, int(typtr2.ntpmx) - int(typtr2.ntpmn) + 1)
1461:  neutral_position = max(0, int(typtr2.nntap0) - int(typtr2.ntpmn))
1462:  dV               = float(typtr2.dutap) / 100.0          # % → pu
1463:  asymmetry_angle  = float(typtr2.phitr)
1478:  vector_group_number = int(round(float(typtr2.nt2ag))) % 12
```
Tap modülü (`:2320-2327`):
```python
2321:  step     = float(typtr2_raw.dutap) / 100.0
2325:  tap      = 1.0 + (current_position - neutral_position) * step
2326:  tap_min  = 1.0 + (int(typtr2_raw.ntpmn) - neutral_position) * step
2327:  tap_max  = 1.0 + (int(typtr2_raw.ntpmx) - neutral_position) * step
```
LV tarafında tap ters çevrilir (`tap = 1.0/tap`, `:2350-2355`).
OLTC sınıflandırması `:357-370`: `itapch==0 → NoRegulation`; `phitr % 180 == 0 → VoltageRegulation`;
`== 90 → Asymmetrical`; aksi halde `Symmetrical`.

**Grid Analyzer** (`canonical.ts:63-70`):
```ts
const rel = ...;
tap = (hv/vnKv)/(lv/lvKv) * (side===0 ? rel : side===1 ? 1/rel : 1);
if (!valid || !(tap>.5 && tap<1.6)) { tap = 1; warn }
```

**VG'den iyi:** tap penceresi VG'de `ntpmn`/`ntpmx`'ten **türetilir** ve
`_sanitize_tap_window` (`:405-445`) ile düzeltilir. GA'da sabit `(0.5, 1.6)` üstelik
`tap=1`'e **düşürülür** — sessiz veri bozulması. `nntap` dışındaki `mTaps:<i>` değerleri GA'da
okunmasına rağmen `canonical.ts:64` `num(r['mTaps:'+index], NaN)` ile **NaN** üretirse tap
penceresine girer ve `tap=1`'e düşer.

### 8.2 Faz kaydırması — İKİ TARAFTA DA YOK

| | VeraGrid | Grid Analyzer |
|---|---|---|
| Vektör grubu | `tr2cn_h/tr2cn_l` **okunur** (`:1467-1474`) | `tr2cn_h/tr2cn_l` **parse edilmez** |
| Faz açısına dönüşüm | **Yok** — `phitr` yalnız OLTC sınıflandırması (`:362-369`) | **Yok** — `phase: 0` sabit (`canonical.ts:73`) |
| Provenance bildirimi | Yok | `PHASE_SHIFT_SOURCE_UNAVAILABLE` (`canonical.ts:74`, `preparation.ts:56`) |

`dgs_to_veragrid.py:362-369` tap sınıflandırması **faz kaydırması değil**, OLTC karakteristiğidir.

**Gerçek veri:** `TypTr2` 24 kolon (`FID, loc_name, fold_id, strn, utrn_h, utrn_l, pcutr, uktr,
uk0tr, x0tor0, tr2cn_h, tr2cn_l, itapch, tapchtype, tap_side, dutap, ntpmx, ntpmn, nntap0, curmg,
pfe, manuf, oltc`). `20260928-source-audit.md:12`: *"No explicit phase, clock, vector-clock, or
displacement field. Connection codes are not converted to an angle."*

**P-açısı doğruluğuna etkisi — kritik:**

Başlangıç açısı düzdür (`newton.ts:19-20` `1.0∠0`; gerçek veride `m:u`/`m:phiu` **yok**).
NR açı referansını slack baraya sabitler. Bir faz kaydırması eksikliği **tüm bara açılarını
tek bir global offset olarak kaydırır** — çünkü NR'de tüm bara açıları tek referansa göre çözülür.

XLSX doğrulaması (`kontrol1/GridAnalyzer_YTBS_FullNR_Karsilastirma_Raporu_20260928 (1).xlsx`,
sheet `00_Ozet`):
- Ham bara açı farklarının **medyanı = 1,7586°** (global offset)
- Referans düzeltmeli bara açı **MAE = 1,3351°** (p95 3,275°, maks 5,467°)

Referans düzeltmesi medyan offset'i çıkarmakla yapıldı ve MAE 1,3351°'ye indi. Yani gözlenen
~1,76°'lik kayma büyük ölçüde referans belirsizliğinden; kalan 1,335° ise transformatör faz
kaydırması + istasyon kontrolü etkisidir.

**VeraGrid'de neden yok:** DGS dışa aktarımı faz kaydırma alanı taşımıyor (`m:*` sonuç kolonları
da yok). Bu **veri yokluğudur**, kod eksiği değil. Ancak `tr2cn_h/tr2cn_l` kombinasyonundan
(ör. `"YNd1"` → 30°, `"Dyn11"` → −30°) **tam deterministik** bir açı hesaplanabilir. Bu,
**en yüksek değer / en düşük riskli** geliştirme fırsatıdır (§16 P0-1): saf bir dönüşüm,
formülasyon değişikliği yok, geri dönüşü olan veri mevcut.

### 8.3 Manyetik dal, bakır kayıp, sıfır sekans

**VeraGrid** (`:2408-2422`):
```python
2411:  z0_pu = (float(typtr2_raw.uk0tr) / 100.0) * (float(baseMVA) / nominal_power)
2412:  r0_pu = (float(typtr2_raw.ur0tr) / 100.0) * (float(baseMVA) / nominal_power)
2413:  x0_sq = max(0.0, z0_pu * z0_pu - r0_pu * r0_pu)
2415:  trafo.X0 = math.sqrt(x0_sq)
2421:  trafo.R2 = trafo.R;  trafo.X2 = trafo.X
```
⚠ **VG denetim bulgusu:** `:2421-2422` `R2/X2` pu'ya çevrilmeden kopyalanır — muhtemel birim hatası
(sıfır sekans akım modellerinde kullanılır; pozitif sekans PF'de kullanılmaz, etkisi düşük).

**Grid Analyzer** (`canonical.ts:70-73`):
```ts
const rp = pcutr/(1000*sn);  const zp = uktr/100;
rPu = rp*BASE/sn;  xPu = Math.sqrt(Math.max(0, zp*zp - rp*rp))*BASE/sn;
const g = pfe/(1000*sn);  const b = -Math.sqrt(Math.max(0,(curmg/100)**2 - g*g));
gPu = g*scale;  bPu = b*scale;                     // scale = sn/BASE
```
**`uk0tr`/`x0tor0` düşürülüyor.** Pozitif sekans AC PF için **doğru** karar (sıfır sekans
kullanılmıyor). `b = −sqrt(curmg²−g²)`: `curmg` boşta akım yüzdesidir; GroundedStar'da
endüktiftir, işaret doğru.

**Manyetik dal yerleşimi — her iki tarafta da HV terminal:** VG `:2408-2415`; GA
`preparation.ts:21` `shuntG[i] += gPu; shuntB[i] += bPu` (from-bus). `FUNCTIONALLY_EQUIVALENT`.

### 8.4 3W / 4W

VeraGrid her ikisini de uygular (`ElmTr3` `:2430`, `ElmTr4` `:2575`, `TypTr4` `:1824`).
4W empedans dönüşümü (`:1862-1883`):
```python
1862:  Sr_pair = min(Sr_a, Sr_b)
1865:  z_abs = (uk / 100.0) * (Sr_hv / Sr_pair)
1868:  zr    = (pcu / 1000.0) * (Sr_hv / (Sr_pair ** 2))
1871:  zi_squared = z_abs ** 2 - zr ** 2
1876:  zi = sqrt(zi_squared) if zi_squared >= 0 else 0.0
```
**Grid Analyzer'da 3W/4W tipi hiç yoktur** (`ElmTr3`/`ElmTr4` 0 eşleşme, tip dahil).
**Gerçek veride de yok** (3/3 model). **Önceliklendirilmemiştir.**

---

## Station Controller Deep Dive

Bu, iki sistem arasındaki **en büyük mimari farktır**.

### 9.1 VeraGrid tarafında

VeraGrid'in AC yük akışında **`ElmStactrl` kabul edilmez**. Uzak gerilim kontrolü **cihaz
modeli** üzerinden gelir: `Generator.control_bus` (`Devices/Injections/generator.py:56, 182-188, 566`)
veya `ControllableShunt.control_bus` (`:35, 54, 187, 248`).

**Bu, P/PQV formülasyonunun varlık sebebidir.** §10.4'te tam olarak gösterilmiştir.

### 9.2 Grid Analyzer — v7.4 entegre formülasyon

Yaşam döngüsü: `station-controls-v73.ts:86` `runStationControlledIslandV73` → mod `zeroDroop`
ise `:115` → `:46` `runIntegratedStationControls`.

**Durum başlatma** (`:49`):
```ts
const states = controls.map(control => ({ control, fixed: new Map<string,number>(),
                                          weights: new Map(Object.entries(control.row.participationKi)),
                                          initialDqPu: 0 }));
```

**Ana yeniden-yapılandırma döngüsü** (`:52-83`):
```ts
52:  while(true){
53:    model = cloneModel(base);
54:    for(const state of states){ const c = state.control;
         for(const bus of c.row.actuatorBuses){ model.busType[bus]=0; model.qMinNet[bus]=null; model.qMaxNet[bus]=null; }
55:      model.busType[c.remote]=0; model.qMinNet[c.remote]=null; model.qMaxNet[c.remote]=null;
56:      for(const unit of c.units){ const fixed=state.fixed.get(unit.id); if(fixed!=null) model.qSpec[unit.bus]+=fixed-unit.qMvar; }
57:      const actuators = c.units.filter(u=>!state.fixed.has(u.id))
                           .map(u=>({bus:u.bus, participation: state.weights.get(u.id)||0}))
                           .filter(u=>u.participation>0);
58:      if(actuators.length){ active.push(state); specs.push({remoteBus:c.remote, targetVmPu:c.source.vmSet, actuators}); }
     }
61:    const solved = solveNR(model, progress, { initialVm:previous.Vm, initialVa:previous.Va,
             initialControlDqPu:active.map(s=>s.initialDqPu), stationControls:specs,
             admittance:Y, linearFill: specs.length?1:0 });
81:    if(restarts>=4){ ...CONTROL_LIMIT_MAX_ROUNDS... }
82:    restarts++;
83:  }
```

**Sahiplik aktarımı anlamı:** aktüatör barı `busType=1`(PV)→`0`(PQ) olur ve `qMinNet/qMaxNet`
**null edilir** (`:54`) ⇒ klasik PV→Q-limit mekanizması (`newton.ts:55-58`) bu barları
**atlar**; Q limiti yalnız `state.fixed` aktif setiyle yönetilir (`:65-72`). Bu, iki ayrı
Q-limit mekanizmasının birbirine karışmasını **tasarım düzeyinde önler** — doğru bir karar.

**Kontrol denkleminin Jacobian'a girişi** (`jacobian.ts:81`):
```ts
put(qIndex[actuator.bus], controlIndex[index], -actuator.participation);   // ∂ΔQ_bus/∂ΔQ_ctrl = −k
```
Doğrulama: `tests/unit/v73-station-control.test.ts:72-81` katsayının `=== −1` olduğunu ve
sonlu farkla eşleştiğini iddia ediyor.

`jacobian.ts:20-39` **bipartite eşleme** ile `pq` satırları permütasyona uğratılıyor ki ILU
köşegeninde **garanti sıfır olmayan** bir değer kalsın. Yorum `:24-26`:
*"The remote Q row often has no direct controller coefficient; preserving the bus order would put
a zero on ILU's diagonal even for a valid system."* `:35` `INTEGRATED_Q_MATCHING_FAILED` fırlatır.

### 9.3 DOĞRULANAN HATA A — baseline Q kaybı

> **İddia:** local-PV baseline'da çözülen Q, station-controller ownership'e geçişte kaybolur.

**KODLA DOĞRULANDI** — `src/analysis/power-flow/station-controls-v73.ts`:

```ts
44:  const cloneModel = (base:NumericModel):NumericModel => ({ ...base,
       pSpec: Float64Array.from(base.pSpec), qSpec: Float64Array.from(base.qSpec),
       busType: Int8Array.from(base.busType), vmSet: Float64Array.from(base.vmSet),
       qMinNet:[...base.qMinNet], qMaxNet:[...base.qMaxNet] });
47:  const base = part.model, Y = buildY(base), baseline = solveNR(base, progress, { admittance: Y });
53:    model = cloneModel(base);
54:    for(const state of states){ ... for(const bus of c.row.actuatorBuses){ model.busType[bus]=0; ... } }
```

`cloneModel` `:44` `qSpec`'i `base`'ten **kopyalar**. `base = part.model`'in `qSpec[i]` değeri
`preparation.ts:26`'dan gelir: **`qSpec[i] += qMvar`** — yani ham `qgini`.
`baseline.Q[bus]` (baseline'in **çözdüğü** Q) **hiçbir yerde `model.qSpec`'e aktarılmaz.**

**Karşılaştırma — entegre OLMAYAN yol bunu YAPIYOR** (`station-controls-v73.ts:126`):
```ts
// :122 baseline'i çöz
// :126 baseline'in çözdüğü fiziksel Q'yu koru
const localUnits = ...;
allocateReactiveDelta(localUnits, baseline.Q[bus] - model.qSpec[bus]);
```
Bu davranış yalnız **droop/ownership modunda** çalışır. `zeroDroop` (varsayılan, `:115`)
**hiç kullanmaz**.

**Etki:** Gerçek veride 483 kontrol / 860 birim. Her kontrol için aktüatör barının Q'su
`qgini`'e geri döner. Gerçek dağılım: `ElmSym.av_mode` = `constq` 670 / `constv` 628;
`ElmGenStat.av_mode` = `constq` 1305 / `constv` 238. `constq` modundaki üreteçlerde `qgini`
fiziksel bir değerdir ve PV bara çözümünde **geçersizdir** (PV barası Q'su ağdan hesaplanır).
Bu fark, controller'ın başlangıç noktasını kaydırır ve **ölçülen −0,0155 pu bara gerilim
bias'ının bir kaynak adayıdır**.

**Düzeltme** (tek satır, `:53` sonrasına):
```ts
for(const state of states){ for(const bus of state.control.row.actuatorBuses){
  if(model.busType[bus]===1) model.qSpec[bus] += baseline.Q[bus] - base.qSpec[bus]; } }
```

### 9.4 DOĞRULANAN HATA B — paylaşılan `changed` bayrağı

> **İddia:** Q-limit loop içerisinde global "changed" benzeri state yanlış controller'lara uygulanır.

**KODLA DOĞRULANDI** — `station-controls-v73.ts:64-72`:
```ts
64:  previous = solved; let changed = false;                       // ← for DÖNGÜSÜ DIŞINDA
65:  for(let index=0; index<active.length; index++){
66:    const state = active[index], c = state.control,
          dqPu = solved.controlDqPu?.[index] ?? 0, dqMvar = dqPu*base.baseMVA;
       state.initialDqPu = dqPu;
67:    for(const unit of c.units){ if(state.fixed.has(unit.id)) continue;
        const q = unit.qMvar + (state.weights.get(unit.id)||0)*dqMvar;
        if(q < unit.qMin-1e-4 || q > unit.qMax+1e-4){
          const limit = q<unit.qMin ? unit.qMin : unit.qMax;
          state.fixed.set(unit.id, limit);
          state.initialDqPu -= (limit - unit.qMvar)/base.baseMVA;
          changed = true;                                          // ← GLOBAL
        } }
68:    if(changed){                                                 // ← TÜM controller'lar için değerlendirilir
69:      const eligible = c.units.filter(u=>!state.fixed.has(u.id));
       const total = eligible.reduce((sum,u)=>sum+(c.row.participationKi[u.id]||0),0);
       state.weights = total>EPS ? new Map(...) : new Map();
70:      if(!state.weights.size){ ... status = 'SATURATED_QMAX'|'SATURATED_QMIN'|'NO_REACTIVE_HEADROOM'; }
     }
72:  }
```

`changed` **for döngüsünün dışında** (`:64`) bildirilmiştir. `index=0`'daki herhangi bir controller
bir limit vurduğunda `changed=true` olur ve `:68`'deki dal **takip eden tüm controller'lar için de**
çalışır — onların **tek bir birimi bile limit vurmamış olsa bile**.

**Somut zarar yolları:**
1. **Yanlış doygunluk ataması:** `:69` `total<=EPS` ise `weights=new Map()` yapılır; `:70` o zaman
   `limits.length===0` olduğundan `'NO_REACTIVE_HEADROOM'` atanır — bu controller'ın hiç limiti
   vurmamış olsa bile. `participationKi` `dispatchedPWeights`'ten gelir ve `P≤0` olan birim
   `null` döndürür (`station-participation.ts:5-9`), dolayısıyla toplam sıfır olabilir.
2. **Tutarsız `participationKi`:** `:76` `c.row.participationKi = Object.fromEntries(state.weights)`
   ile geri yazılır. Kimlik yeniden normalleştirme değerleri değiştirmez, ama controller kendi
   limit durumu ile `weights` kümesi arasında **tutarsızlık** oluşturur.
3. **Sıra bağımlılığı riski:** `:61` `initialControlDqPu: active.map(s=>s.initialDqPu)` yalnız
   `active` listesi için dizilir; `active` sırası `:58`'deki koşullu `push` ile belirlenir.
   `:70` nedeniyle `weights.size===0` olan bir controller sonraki turda `active`'e girmeyebilir
   ve `specs` ile `initialControlDqPu` arasında hiza kayabilir.

**Düzeltme:** `:64` içindeki `let changed=false;` ifadesini `:65` for döngüsü gövdesinin
başına taşıyın (veya `index` ile birlikte `changedByControl[index]` dizisi kullanın).

### 9.5 Katılım (participation) — `cvqq` yok

`station-participation.ts`:
```ts
4:   const EPS = 1e-8;
5-9:   dispatchedPWeights(units)  → k_i = P_i/ΣP.  Herhangi bir pMw<0 veya ΣP<=1e-9 ise **null**.
                                       Eşit ağırlık yedeği YOK (test v73-station-control.test.ts:27-31).
10-18: stationParticipation(units, cvqq?)
         cvqq verilirse: cvqq.length===units.length ve her giri null/finite/≥0 olmalı;
                         k_i = cvqq_i/Σcvqq → source:'SOURCE_CVQQ'
         yoksa: dispatchedPWeights → source:'DERIVED_DISPATCHED_ACTIVE_POWER'
19-21: activeParticipation(units, direction) → yönde headroom'u olan birimlerle sınırlı dispatched-P ağırlıkları
23-37: allocateReactiveDelta(units, requestedDelta) → sınırlı ağırlıklı water-fill, clamp(qMin,qMax), doğrusal tarama
```

`cvqq` **gerçek veride yok** (25 kolonluk `ElmStactrl` listesinde bulunmuyor).
`canonical.ts:108-109` `cvqqPresent=false` → `qParticipationRaw=undefined` → her gerçek kontrol için
`DERIVED_DISPATCHED_ACTIVE_POWER`. 8 benchmark çalışmasının hepsi
`qDistribution: UNSUPPORTED`/`DISPATCHED_ACTIVE_POWER` raporluyor.

**Bu bir veri sınırıdır, kod eksiği değil.** `psym:SIZEROW` dağılımı
(1 birim: 300, 2: 83, 3: 56, 4: 28, 5: 10, 6: 9, 8: 2) gösterir ki çoğu kontrol tek birime
sahiptir — `cvqq` olmaması bu veri için pratikte **zararsızdır** (tek birimde k ≡ 1).

**Ancak düşük riskli bir sertleştirme önerilir:** `dispatchedPWeights` `null` döndüğünde
`station-controls-v73.ts:108` tüm kontrolü `UNSUPPORTED_DISTRIBUTION` yapıyor. Gerçek veride
`pMw=0` üreteçler varsa bu, çalışabilecek kontrolleri düşürür. `cvqq` yoksa **eşit ağırlık
yedek** (`1/n`) sezgisel olarak PowerFactory davranışına daha yakındır. **P3** öncelik.

### 9.6 Sınıflandırma merdiveni

`station-controls-v73.ts:96-111` — kesin öncelik sırası:

| Satır | Koşul | Durum |
|---|---|---|
| `:97` | `mode==='off'` | `BASELINE_LOCAL_PV` |
| `:98` | `remote == null` | `REMOTE_BUS_UNRESOLVED` |
| `:99` | `modeSemantics==='UNSUPPORTED'` ∨ `controlModeRaw≠0` ∨ `selectedBusModeRaw≠0` ∨ `distributionModeRaw≠0` ∨ `qOrientationRaw≠0` ∨ `qSetpointRaw≠0` | `UNSUPPORTED_PROFILE` |
| `:100` | `droopModeRaw ∉ {0,1}` | `UNSUPPORTED_PROFILE` |
| `:101` | droop && `mode!=='droop'` | `UNSUPPORTED_DROOP` |
| `:102` | aktif birim yok | `NO_REACTIVE_HEADROOM` |
| `:103` | iki kontrol aynı remote barayı paylaşıyor | `REMOTE_CONTROL_CONFLICT` |
| `:104` | yinelenen `unitIds` veya bir/bus birden çok kontrolde | `UNSUPPORTED_DISTRIBUTION` |
| `:105` | `!finite(vmSet)` ∨ `vmSet<0.5` ∨ `vmSet>1.5` | `UNSUPPORTED_PROFILE` |
| `:106` | `qMin==null` ∨ `qMax==null` ∨ `qMin>qMax` | `Q_LIMITS_UNAVAILABLE` |
| `:107` | droop && (`!measurementSelfCubicle` ∨ `active.length!==1` ∨ `sourceClass!=='ElmGenStat'` ∨ `!(ratedPowerRaw>0)` ∨ `|droopValueRaw|<EPS`) | `UNSUPPORTED_DROOP` |
| `:108` | `weights == null` | `UNSUPPORTED_DISTRIBUTION` |
| `:109` | remote **veya** aktüatör bus slack ∨ o buslarda `unitIds` dışı `voltageControl` gen varsa | `LOCAL_PV_CONFLICT` |
| `:110` | `qMax−qMin < 1e-8` | `NO_REACTIVE_HEADROOM` |
| `:111` | aksi | `PENDING`, `supported = (status==='PENDING')` |

**Gerçek veri ile uyum:** `i_ctrl=0` (483/483), `imode=0` (483/483), `selBus=0` (483/483),
`iQorient=0` (483/483), `qsetp` hepsi 0, `i_droop` 0→250 / 1→233.
⇒ `:99` ve `:100` **tüm 483 kontrolü geçirir**.
`:101` — `mode='zeroDroop'` iken 233 droop kontrolü `UNSUPPORTED_DROOP` ⇒ **entegre
formülasyona giremez**; 250 kontrol (`i_droop=0`) girebilir.

**`:109` `LOCAL_PV_CONFLICT` riski:** `preparation.ts:26` bir busa **birden çok** `voltageControl`
gen varsa ilki PV olur (`if busType[i]===0 ... else if |vmSet-vmSet|>1e-5 → uyarı`). `:109`
`part.generators.some(g=>g.index===bus && g.voltageControl && !c.unitIds.includes(g.id))` kontrolü
yapar — yani busa **o kontrolün dışında** bir PV gen varsa kontrol reddedilir. Gerçek veride
`constv` modundaki 628 + 238 = 866 üreteç var; aynı busa düşen çiftler varsa çok sayıda kontrol
`LOCAL_PV_CONFLICT` olur. **Bu ölçülmemiştir — P0-1 uygulamasında ölçülmelidir.**

### 9.7 Warm-start ve line-search neyi minimize ediyor?

**Warm-start** `newton.ts:19-20` üç bağımsız vektör — `Vm`, `Va`, `controlDq`:
```ts
const Vm = options.initialVm?.length===n
  ? Float64Array.from(options.initialVm, v => finite(v) && v>.35 && v<.85 ? v : 1) : new Float64Array(n).fill(1);
```
Uzunluk **tam eşleşmeli** (`===n`, `===controls.length`) değilse warm start **sessizce yok sayılır**.
Ezme önceliği `:22-23`: slack → PV setpoint → controller remote hedefi.
`station-controls-v73.ts:61` önceki iterasyonun `Vm/Va`'sını **ve** `initialControlDqPu`'yu aktarır.

**Line-search (iç NR)** `newton.ts:39-52` — minimize ettiği nesne **eşleşme 2-normudur**:
```ts
40:  stepCap = min over all angles of 0.35/|dx| , and over all |V| of 0.16/|dx|
41-51: for(let scale=1; scale>=1/256; scale/=2){          // 9 deneme
         Vm.set(oldVm); Va.set(oldVa); controlDq.set(oldDq);   // her denemeden önce geri al
         ... uygula ...
         if(!(Vm[i]>.35 && Vm[i]<1.85 && finite)) continue;     // uygunluk bandı
         if(sqrt(ss2) < baseNorm*(1-1e-5*scale) || mx2<1e-6){ accepted=true; break; }
       }
```
**9 kademe geri-izleme**, adım tavanı **0,35 rad** (açı) / **0,16 pu** (gerilim),
Armijo-benzeri yeterli azalma, uygunluk bandı `0.35 < V < 1.85`.

**Line-search (dış, v7.3 trust-region)** `station-controls-v73.ts:145, 168-172, 180-188`:
`trustFraction ∈ [1/32, 1]`; kabul `rho = actual/predicted ≥ 0.1`;
`trustFraction` `rho>0.75` ise **×1,5 (tavan 1,0)**, değilse **yarıya iner (taban 1/32)**.
Bu, `||r||` azalmasını **tahmin edilen** azalmaya oranlayarak kabul eder.

**Yeniden başlatma politikası:**
- İç NR: **yok** (Q-limit turu dışında)
- Q-limit: `qLimitRoundLimit = max(1, floor(options.maxQLimitRounds ?? 8))` (`newton.ts:25`);
  son turda hâlâ değişiklik isteniyorsa `Q_LIMIT_MAX_ROUNDS`
- İstasyon kontrolü: **sert tavan 4** (`:81`)

**VeraGrid'in line search'i çok daha basit** (`newton_raphson_fx.py:122-130`):
```python
122:  mu = trust0; x_sol = x
125:  while not converged and mu > tol and error >= error0:
126:      error, x_sol = problem.check_error(x + dx * mu)
127:      mu *= 0.25
```
**Geri-izleme 0,25**; kabul `error >= error0` yani **son değerlendirilen** `mu` saklanır.
`mu` tabanı = `tol` (=1e-6). Adım tavanı **yok** (`trust_radius=1.0`).
**Grid Analyzer'ın line search'i belirgin biçimde daha güçlüdür; kopyalanmalıdır.**

### 9.8 Performans — kontrol döngüsü pahalı

`docs/validation/20260928-v72-benchmark.json`: **`elapsedMs` 219.962,23 ms** (3,7 dakika).
`20260928-abcd-benchmark-v73.json`: durum A 5.014,90 ms · B 13.562,65 ms · **C 86.613,53 ms**.
`20260928-v74-final.json`: durum C 115.991,84 ms, `C_directNr` 8.238,84 ms,
`"performance": {"observedMs": 8238.84, "limitMs": 30000, "pass": false, "reason": "BASELINE_FALLBACK"}`.
`gateStatus: "FAIL_NOT_MERGEABLE"`; `resultProvenance: "BASELINE_FALLBACK_AFTER_CONTROL_SOLVE_FAILED"`,
`CONTROL_SOLVE_FAILED: 158`.

Bu, §16 P0-1'in aciliyetini doğrular: formülasyon düzeltmesi **doğru sonuç** verecek,
mevcut hali **çözemiyor ve 4 turda zaman aşımına uğruyor**.

---

## Newton-Raphson Formulation Comparison

### 10.1 A) VeraGrid yerel (bus-mode) formülasyonu

`BusMode` enum'u — **`src/VeraGridEngine/enumerations.py:9-55`** (NOT `bus_mode.py`):
```python
 9: class BusMode(Enum):
13:     PQ_tpe    = 1   # control P, Q
14:     PV_tpe    = 2   # Control P, Vm
15:     Slack_tpe = 3   # Control Vm, Va (slack)
16:     PQV_tpe   = 4   # voltage-controlled bus (P, Q, V set, theta computed)
17:     P_tpe     = 5   # voltage-controlling bus (P set, Q, V, theta computed)
```

**Semantik tablo gerçek anlamı taşıyan maske** — `DataStructures/bus_data.py:306-421`
`set_bus_mode`:

| BusMode | `is_p_controlled` | `is_q_controlled` | `is_vm_controlled` | `is_va_controlled` | Anlam |
|---|---|---|---|---|---|
| `PQ_tpe` (1) | T | T | F | F | P,Q verilir; Va,Vm serbest |
| `PV_tpe` (2) | T | F | T | F | P,Vm verilir; Q,Va serbest |
| `Slack_tpe` (3) | F | F | T | T | Vm,Va verilir |
| **`PQV_tpe` (4)** | T | T | T | F | **P,Q,Vm hepsi verilir; yalnız Va hesaplanır** |
| **`P_tpe` (5)** | T | F | F | F | **yalnız P verilir; Va,Vm,Q hepsi hesaplanır** |

**Durum vektörü** — `PfBasicFormulation` (`pf_basic_formulation.py:91-101, 102-122`):
```python
 98:  self.idx_dVa = np.r_[self.pv, self.pq, self.pqv, self.p]
 99:  self.idx_dVm = np.r_[self.pq, self.p]
100:  self.idx_dP  = self.idx_dVa
101:  self.idx_dQ  = np.r_[self.pq, self.pqv]
```

| Mod | Va durumu? | Vm durumu? | dP denklemi? | dQ denklemi? |
|---|---|---|---|---|
| Slack | ✗ (sabit) | ✗ (sabit) | ✗ | ✗ |
| PV | ✓ | ✗ (sabit) | ✓ | ✗ |
| PQ | ✓ | ✓ | ✓ | ✓ |
| **PQV** | **✓** | **✗ (sabit)** | **✓** | **✓** |
| **P** | **✓** | **✓** | **✓** | **✗** |

`PfAcDcWithNegativePoles` (production "tam destek", **11 blok**, `:2097-2161`) maskeleri
kullanır (`:1021-1033`): `i_u_vm`, `i_u_va`, `i_k_p`, `i_k_q`, `i_k_p_dc`.
Aynı tablo birebir geçerlidir. `PfGeneralizedFormulation` (`:486-662`) **ölü koddur** —
yalnız testlerden referans alınır.

**Eşleşme vektörü** (`pf_basic_formulation.py:196-202`):
```python
196:  Sbus = compute_zip_power(self.S0, self.I0, self.Y0, self.Vm)
197:  self.Scalc = compute_power(self.adm.Ybus, self.V)
198:  dS = self.Scalc - Sbus
199:  self._f = np.r_[dS[self.idx_dP].real, dS[self.idx_dQ].imag]
```
Kapalı formda:
```
ΔP_i = Re[ V_i·conj((Ybus·V)_i) ] − Re[ S0_i + conj(I0_i + Y0_i·|V_i|)·|V_i| ]
ΔQ_i = Im[ V_i·conj((Ybus·V)_i) ] − Im[ S0_i + conj(I0_i + Y0_i·|V_i|)·|V_i| ]
```

**Yakınsama** (`:264`): `self._error < self.options.tolerance`,
`compute_fx_error = np.linalg.norm(fx, np.inf)` (`common_functions.py:472-479`),
`tolerance = 1e-6` pu (`power_flow_options.py:76`), `max_iter = 25` (`:77`).

**Q-limit / PV→PQ** — `discrete_controls.py:181-217`:
```python
201:  if Q > Qmax[i]: S0[i] = complex(S0[i].real, Qmax[i]); changed.append(i)
205:  elif Q < Qmin[i]: S0[i] = complex(S0[i].real, Qmin[i]); changed.append(i)
210:  if len(changed) > 0: pq = concatenate((pq, changed)); pv = delete(pv, pv_indices)
```
⚠ **Yalnız tek yönlü.** `pf_basic_formulation.py:219-220` yorumu bunu açıkça söyler:
*"this function passes pv buses to pq when the limits are violated, but not pq to pv because
that is unstable"*. Grid Analyzer'ın `newton.ts:55-58` **aynı** politikayı kullanır.
**Fonksiyonel olarak eşdeğer.**

**Yeniden başlatma politikası:** NR'de yok. Çözücü düzeyinde **solver bataryası**
(`power_flow_worker.py:99-110`): `[NR, PowellDogLeg, LM]` (tam destek),
`[NR, PowellDogLeg, HELM, IWAMOTO, LM, LACPF]` (sınırlı). Kabul `:300-323`:
`norm_f` ve `|V|<1e6` ve **`abs(norm_f) < abs(son)`** — yalnız daha iyi çözüm kabul edilir.
**GA'nın `CONTROL_SOLVE_FAILED`'den çok daha ayırt edici bir politikadır.**

**Warm start:** `V0 = bus.get_voltage_guess_at(t, use_stored_guess)` = `Vm0·e^{jVa0}` veya
düz `1.0∠0` (`bus.py:751-761`). İsteğe bağlı **DC ile tohumlama**
(`power_flow_worker.py:990-1002`) — **GA'da yok**. Çapraz-denede warm start (`:191, 209, 228, 619…`).

**⚠ `gauss_power_flow` P ve PQV'yi yok sayar** — `gauss_power_flow.py:64, 96, 110-120, 126`:
`pvpq = np.r_[pv, pq]` — `p` ve `pqv` sessizce düşer. `simulation_indices.py:69-86`
`replace_bus_types` bunu kabul eden solver ailesini işaretler.

### 10.2 B) Grid Analyzer augmented-controller-state formülasyonu

**Durum vektörü** — `makeLayout` (`jacobian.ts:16-64`), `nang = n − 1`:

| Blok | İndeks aralığı | Boyut kaynağı |
|---|---|---|
| **θ (rad)** | `0 … nang−1` | `jacobian.ts:18` |
| **\|V\| (pu)** | `nang … nang+vm.length−1` | `jacobian.ts:22` — yalnız `busType===0`, ≠slack, **controller remote barası değil** |
| **Controller ΔQ (pu)** | `nang+vm.length … +controls.length−1` | `jacobian.ts:41` |
| **Toplam** | `N = nang + pq.length` | `:41` |

Üç blok tam olarak döşeniyor (`jacobian.ts:21` remote benzersizliğini zorlar).

**Eşleşme vektörü** (`newton.ts:20-21, 33-34`):
```ts
const refreshEffectiveQ = () => {
  effectiveQ.set(qSpec);
  controls.forEach((control, index) => {
    for (const actuator of control.actuators) effectiveQ[actuator.bus] += actuator.participation * controlDq[index];
  });
};
F_θ[i] = pSpec[i] − P_i(V,θ)
F_V[i] = effectiveQ[i] − Q_i(V,θ)
```
`effectiveQ[actuator] = qSpec[actuator] + Σ_c k_ci·ΔQ_c` — **doğrusal, sabit katılımlı** bağ.

**Ybus** — `ybus.ts:4-32`, karmaşık off-nominal tap + faz kaydırması (`:11-18`):
```
Y_ff = (g + j(b+bch/2))/tap²        Y_ft = −(g+jb)·(c+js)/tap
Y_tf = −(g−jb)·(c+js)/tap          Y_tt = g + j(b+bch/2)
```
`tap = complex(tapRatio, phaseShift)` — **faz kaydırması altyapısı Ybus'ta HAZIRDIR**
(`canonical.ts:73` `phase: 0` yüzünden kullanılmıyor). Bu, P0-1'in neden düşük riskli
olduğunun kanıtıdır.

**Önemli ek bulgu — `phase` yalnız Ybus'ta değil, doğrudan dal güç hesabında da tüketiliyor**
(`newton.ts:62`):
```ts
const c = Math.cos(Va[i] - Va[j] - ph), s = Math.sin(Va[i] - Va[j] - ph);
const pf = (vi*vi*g/(tap*tap) - vi*vj/tap*(g*c + b*s)) * base;
const qf = (-vi*vi*(b+bch/2)/(tap*tap) - vi*vj/tap*(g*s - b*c)) * base;
```
Yorum `:63`: *"Equivalent branch powers using same off-nominal tap convention, phase included
in angle difference."* Bu nedenle `phase` alanı doğru doldurulduğunda **iki** yerde birden
(Ybus ve dal güçleri) tutarlı biçimde etki eder — tek bir yerde eksik kalması bir tutarsızlık
yaratırdı. **`phase` bu haliyle eksik olduğu için tutarlı biçimde sıfırdır; iki noktada birden
düzeltilmesi gerekmez, tek alanı doldurmak yeterlidir.**

> **Birim notu (P0-3a için doğrulandı):** `newton.ts:71` sonucu
> `Q: Array.from(Q, v=>v*base)` ve `base = model.baseMVA ?? 100` ⇒ **`baseline.Q` MW/MVAr
> cinsindendir**, `model.qSpec` ile (`preparation.ts:27`, MW) **aynı birimdedir**.
> HATA A düzeltmesinde `/baseMVA` bölmesi **gerekmez**.

**Bus tipleri** — enum yok, `busType` çıplak `Int8Array`:

| Değer | Anlam | Atandığı yer |
|---|---|---|
| 0 | PQ | `preparation.ts:12` sıfır-init; `:54,55,119` sahiplik; `newton.ts:56` Q-limit |
| 1 | PV | `preparation.ts:26` `voltageControl` gen için |
| 2 | Slack | `preparation.ts:51` |

**Yakınsama** (`newton.ts:32-36`): `max|F| < 1e-6` pu (100 MVA üzerinde **1e-4 MW**).
`ComLdf.errlf`/`erreq` **kullanılmıyor**. İç tavan 30 (`:31`), Q-limit turu tavanı 8 (`:25`).
`maxMismatch` **MW** olarak raporlanır (`mx*base`, `:35, :52, :54, :58`).

**Damping:** iki seviyeli (§9.7). Adım tavanı + 9 kademe geri-izleme + uygunluk bandı.

**Warm start:** `newton.ts:19-20`; uzunluk tam eşleşmeli değilse yok sayılır.
Layout cache `newton.ts:27` — anahtar `Array.from(busType).join('')+'|'+slack`;
**controller varsa devre dışı** (`:27` `controls.length ? undefined : options.layoutCache`).

**Q-limit:** `newton.ts:55-58` — **0,02 MVAr** ölü bant her yönde, `qSpec[i] = lim/base`
**kalıcı** yazılır, `pvToPq[]` raporlanır (`types.ts:38`), `results.ts:14` ve
`station-controls-v73.ts:123` tüketir. `ComLdf.itrlx=100` kullanılmıyor (tavan 8).

### 10.3 Karşılaştırma matrisi

| Boyut | VeraGrid (A) | Grid Analyzer (B) | Yorum |
|---|---|---|---|
| **x boyutu** | `\|pv\|+\|pq\|+\|pqv\|+\|p\| + \|pq\|+\|p\|` | `n−1 + \|pq\| + \|c\|` | A: mod maskelerinden; B: slack hariç her bara + controller başına 1 |
| **F boyutu** | `2(n−1)` tipik | `2(n−1)` | — |
| **Jacobiyan boyutu** | `(n−1) + \|pq\|+\|p\|` | `(n−1) + \|pq\|` (eşleşme **permütasyon**, boyut eklemez) | **Aynı** |
| **Yapısal kondisyonlama** | `\|p\| == \|pqv\|` **gerekir**; ctor `:297-299` `len(pqv)>=len(k_v_m)` kontrolü | Eşleşme garantisi `:35` — `pos[row][row] !== ∅`; benzersizlik `:21` | **B üstün** — kare olmayan eşleşmeyi yapısal olarak imkânsız kılar |
| **Köşegen yapısı** | Doğal; P/PQV çiftlerinde `dQ` satırı `dVa` sütununda çapraz-dolgu | `:23-38` **bipartite eşleme ile garanti** | **B üstün** — explicit gerekçe `:24-26` |
| **Seyreklik** | Ybus ile aynı örüntü (CSC) | Ybus ile aynı örüntü (CSR) + `\|c\|` ek blok | Eşit |
| **Simetri/asimetri** | Asimetrik (P/V blokları farklı) | Asimetrik + **yeni asimetrik `−k` bloğu** | A zaten asimetrik; B ek blok ekliyor |
| **Controller bağlaşımı** | **Mod maskesi** (bus tipi değişimi) | **Ayrı durum + Jacobian bloğu** | **B daha açık, daha az hata yüzeyi** |
| **Q durum sahipliği** | Maske (`is_q_controlled`) | **Ayrı `controlDq` durumu** + sonradan `overrides` | B: Q açıkça sahiplenilir |
| **Başlangıç duyarlılığı** | Düz `1.0∠0` **veya DC tohumlama** | Düz `1.0`; warm start yalnız aynı ada | **A üstün** (DC tohumlama) |
| **Q-limit etkileşimi** | Tek yönlü PV→PQ | Tek yönlü PV→PQ, 0,02 MVAr bant + 8 tur tavan | Yakın |
| **Line search** | 0,25 geri-izleme, adım tavanı yok | 0,35 rad / 0,16 pu tavan + 9 kademe + bant | **B üstün** |
| **Çözücü bataryası** | 3–6 solver dener, "daha iyi `norm_f`" kabul | Yok — tek NR + station restart | **A üstün** |
| **Ölçeklenebilirlik** | Doğrudan LU — O(n^1.5)–O(n²) fill | ILU(0)+GMRES — O(nnz·iter) | **B üstün** (4.154 barada ölçülen) |

### 10.4 PQV hipotezinin kesin çözümü

Görev soruyor: *"P bus için hangi state'ler var? PQV bus için hangi state'ler var?
Q neden serbest kalıyor?"*

**Üretici kodu** — `Compilers/circuit_to_data.py:70-114` `set_bus_control_voltage`:
```python
 91:  if bus_data.bus_types[i] != BusMode.Slack_tpe.value:   # i = aktüatör
 92:      if remote_control and j > -1 and j != i:            # j = uzak kontrol edilen
 95:          bus_data.set_bus_mode(j, BusMode.PQV_tpe)       # uzak bara PQV
 97:          bus_data.set_bus_mode(i, BusMode.P_tpe)         # yerel bara P
 98:      else:
101:          bus_data.set_bus_mode(i, BusMode.PV_tpe)        # yerel gerilim kontrolü
103:  controlled_bus_idx = j if remote_control and j > -1 and j != i else i
105:  if not bus_voltage_used[controlled_bus_idx]:
107:      bus_data.Vbus[controlled_bus_idx] = rect(candidate_Vm, existing_angle)   # |V| SETPOINT'E SABİTLENİR
```
Çağıranlar: `Generator`/`Battery` (`circuit_to_data.py:1162-1181`),
`ControllableShunt` (`:1013-1031`). Not `:1181` — V kontrollü üreteçlerin `q`'su **0.0'a**
zorlanır; reaktif çıktı çözümden sonra geri kazanılır
(`power_flow_worker.py:1075-1098`).

**P barı (aktüatör, `i`)** — `bus_data.py:413-418`:
```python
415:  self.is_p_controlled[idx] = True
416:  self.is_q_controlled[idx] = False     # ← Q SERBEST
417:  self.is_vm_controlled[idx] = False     # ← |V| SERBEST
418:  self.is_va_controlled[idx] = False     # ← θ SERBEST
```
- **Durumlar:** `Va_i` (`idx_dVa`) + `Vm_i` (`idx_dVm`)
- **Denklemler:** yalnız `dP_i` (`idx_dP = idx_dVa`)
- **Q:** bir **serbest çıktıdır** — ne durum ne kısıt. Ağdan geri kazanılır
  (`power_flow_worker.py:1064-1067, 1075-1098`)

**PQV barı (uzak, `j`)** — `bus_data.py:393-398`:
```python
395:  self.is_p_controlled[idx] = True
396:  self.is_q_controlled[idx] = True      # ← Q VERİLİR
397:  self.is_vm_controlled[idx] = True     # ← |V| VERİLİR
398:  self.is_va_controlled[idx] = False    # ← yalnız θ hesaplanır
```
- **Durumlar:** yalnız `Va_j` (`Vm_j ∉ idx_dVm = [pq, p]`, `pf_basic_formulation.py:99`) —
  `x2var:112` onu **yazmadığı** için derleme sırasında sabitlenen `Vset`'te kalır
- **Denklemler:** **hem `dP_j` hem `dQ_j`** (`pf_basic_formulation.py:101`)

**Karelik muhasebesi:**
```
n_bilinmeyen = |idx_dVa| + |idx_dVm| = |no_slack| + |pq| + |p|
n_denklem    = |idx_dP| + |idx_dQ| = |no_slack| + |pq| + |pqv|
⇒ fark = |p| − |pqv|
```
Çift başına: P barı 2 bilinmeyen + 1 denklem (**açık 1**); PQV barı 1 bilinmeyen + 2 denklem
(**fazla 1**). PQV barındaki `dQ` denklemi çifti kapatır.
Maske formülasyonunda muhasebe birebir aynıdır
(`i_u_va ∋ {i,j}`, `i_u_vm ∋ {i}`, `i_k_p ∋ {i,j}`, `i_k_q ∋ {j}`).

**HELM DPR'de `|V|_j = Vset` açık denklem** (`helm_dpr.py:352-356`):
```python
353:  (Scalc - S0)[no_slack].real,
354:  (Scalc - S0)[q_idx].imag,           # q_idx = np.r_[pq, pqv]
355:  np.abs(V[pqv]) - np.abs(Vset[pqv])  # PQV gerilim büyüklüğü kısıtları
```

**HYPOTEZ KORREKSİYONU:**
> Uzak gerilim kontrolünde VeraGrid **aktüatör** barı `P_tpe`'ye koyar — yalnız P verilir,
> `Va`, `Vm` Newton bilinmeyenleridir, Q serbest bir ağ çıktısıdır. **Uzak kontrol edilen**
> barı `PQV_tpe`'ye koyar — **P, Q ve |V| hepsi verilmiştir** (|V| setpoint'e sabitlenir,
> Q `dQ` eşleşme satırı ile zorlanır) ve **yalnız θ hesaplanır**. Çift, PQV barının
> fazladan bir `dQ` denklemi ile kare kalır.
>
> **"PQV bus'ta Q neden serbest kalıyor?" — Serbest kalmıyor.** Q'nun serbest kaldığı yer
> P (aktüatör) barıdır.

---

## Jacobian Comparison

### 11.1 Boyut ve örüntü

| | VeraGrid | Grid Analyzer |
|---|---|---|
| Yapı | `create_J_vc_csc` (`ac_jacobian.py:286-383`), **CSC** | `makeLayout` + `fillJacobian` (`jacobian.ts:16-64`, `:66-82`), **CSR** |
| Örüntü kaynağı | **Ybus'un kendi** `indptr`/`indices`'ı — `dS_dVm` ve `dS_dVa` aynı yapıyla üretilir (`:311`) | **Ybus'un kendi** satır deseni (`:42-54`) |
| Bloklar | 2×2 (`dP/dVa│dP/dVm`, `dQ/dVa│dQ/dVm`) | 2×2 + **1 ek sütun bloğu** (`∂ΔQ_bus/∂ΔQ_ctrl`) |
| Diyagonal | Doğal | `pos[i].get(i) ?? -1` — `-1` olabilir; `:35` eşleme ile engellenir |
| Değer biriktirme | Doğrudan atama | **`+=` ile biriktirme** (`jacobian.ts:68`) |
| Yapısal olmayan atma | Yok | `if(r<0||c<0||!finite(v)) return;` (`:68`) |
| `1/V` koruması | Yok | `Math.max(v, 1e-9)` (`:73-74`) |
| Yeniden boyutlandırma | `J.resize(nnz)` (`ac_jacobian.py:382`) | Önceden bilinen `N` (`newton.ts:27-28`) |
| Layout yeniden kullanımı | Her iterasyonda yeniden kurulur | `layoutCache` (controller yoksa), `newton.ts:27` |

**⚠ Kod kokusu (kanıtlanmış):** `jacobian.ts:22` uzak baraları `vm` listesinden **dışlar** —
`Vm[remote]` bir **durum değildir**. Bu, `preparation.ts:55`'te `busType[remote]=0`
yapılmasıyla tutarlıdır (PQ modu), ama `|V|_remote` hedefi **yalnız controller sütunu
üzerinden** uygulanır. Bu, VeraGrid'in `PQV_tpe`'sinden farklıdır (VG'de `|V|_j` **sabit**).
GA'da `|V|_remote` serbesttir ve controller onu iteratif olarak çeker. **Bu, GA'nın daha esnek
ama daha sağlam bir tasarımıdır** (serbest değişken + denge denklemi, sabit + fazla denklem
yerine).

### 11.2 Türev formülleri

VeraGrid (`csc_derivatives.py:32-38`):
```python
diagV = diags(V); diagE = diags(V/np.abs(V)); Ibus = Ybus*V; diagIbus = diags(Ibus)
dSbus_dVa = 1j*diagV*np.conj(diagIbus - Ybus*diagV)
dSbus_dVm = diagV*np.conj(Ybus*diagE) + np.conj(diagIbus)*diagE
```

Grid Analyzer (`jacobian.ts:71-79`):
```ts
H_θθ = −Q_i − B_ii·V_i²
H_θV =  P_i/V_i + G_ii·V_i
H_Qθ =  P_i − G_ii·V_i²
H_QV =  Q_i/V_i − B_ii·V_i
// off-diagonal, d = θ_i − θ_j, vv = V_i·V_j
∂P_i/∂θ_j = V_iV_j(G_ij·sinθ_ij − B_ij·cosθ_ij)
∂P_i/∂V_j =  V_i (G_ij·cosθ_ij + B_ij·sinθ_ij)
∂Q_i/∂θ_j = −V_iV_j(G_ij·cosθ_ij + B_ij·sinθ_ij)
∂Q_i/∂V_j =  V_i (G_ij·sinθ_ij − B_ij·cosθ_ij)
```
Matematiksel olarak **eşdeğer** standart NR blokları. GA'nın türevleri Ybus satırından
doğrudan okur; VG `Ybus·diagE` gibi ara matrisler üretir (daha çok geçici bellek).

**Sıfır-sıfır yük etkisi:** GA'da `P_i`, `Q_i` sabit yük nedeniyle gerilimden bağımsızdır.
VeraGrid'de `S_zip` terimi `∂/∂|V|` katkısı verir (bu yüzden ZIP'li modelde NR
dokuzuluk bozulur). GA'nın sabit-P/Q modelinde bu ek teriye ihtiyaç yoktur — **doğru bir
basitleştirme, veri destekli.**

### 11.3 Controller bloğu — GA'ya özgü

`jacobian.ts:55` (örüntü) ve `:81` (değer):
```ts
rowSets[qIndex[actuator.bus]].add(controlIndex[index]);                 // örüntü
put(qIndex[actuator.bus], controlIndex[index], -actuator.participation);  // değer
```
Düz, seyrek, satır-başına-tek-girişli blok. `k_i ≥ 0` olduğundan köşegen dışıdır.
Doğrulama: `tests/unit/v73-station-control.test.ts:72-81`.

**VeraGrid'in karşılığı:** hiçbir blok yok — Q'nun serbestliği **bus maskesinden** gelir.
"Hiçbir şey eklememe" daha hızlıdır ama Gauss-Eliminasyon bakımından daha kırılgandır
(maske hatası ⇒ boyut uyuşmazlığı ya da tekil sistem). **GA'nın açık blok tasarımı korunmalıdır.**

---

## Sparse Linear Solver Comparison

### 12.1 VeraGrid — doğrudan yöntem

**Çağrı** — `newton_raphson_fx.py:9, 103-118`:
```python
  9: from VeraGridEngine.Utils.Sparse.csc2 import CSC, spsolve_csc
105:  # compute update step: J x Δx = Δg
106:  dx, ok = spsolve_csc(J, -f)
112:  if not ok:  logger.add_error("Newton-Raphson's Jacobian is singular ..."); return ...
116:  if not np.all(np.isfinite(dx)): logger.add_error(...); return ...
```

**Faktörizasyon** — `csc2.py:664-700`:
```python
664: def spfactor(A: CSC) -> None | SuperLU:
670:     if A.n_rows == A.n_cols: pass
673:     else: return None
675:     if is_valid_for_super_lu(A=A): pass
678:     else: return None
680:     try:
681:         matrix: csc_matrix = mat_to_scipy(csc=A)
682:         matrix.check_format(full_check=True)
683:         ret: SuperLU = splu(matrix)
684:         return ret
685:     except (RuntimeError, ValueError): return None
689: def spsolve_csc(A: CSC, x: Vec) -> Vec:
696:     factor = spfactor(A)
697:     if factor is None: return np.full(len(x), np.nan), False
699:     else: return factor.solve(x), True
```
İçe aktarımlar: `csc2.py:14-16` (`csc_matrix`, `splu`, `SuperLU`).

| Soru | Cevap | Kanıt |
|---|---|---|
| Doğrudan mı, iteratif mi? | **DOĞRUDAN.** Her Newton iterasyonunda **yeniden** faktörize edilir. | `csc2.py:683`; `newton_raphson_fx.py:106` `:75-147` döngüsü içinde |
| Hangi faktörizasyon? | **Sparse LU (SuperLU)**. QR/Cholesky/LDLᵀ yok. | `csc2.py:15, 683` |
| Düzen (layout)? | **CSC** iki katman: (a) `Utils/Sparse/csc2.CSC` — numba `jitclass` (`data/indices/indptr`, `:20-29`); (b) çözüm anında `scipy.sparse.csc_matrix` (`:566`) | |
| Ön koşullayıcı? | **Yok** (doğrudan yöntem) | |
| Sıralama (ordering)? | SciPy/SuperLU **varsayılan `permc_spec='COLAMD'`** — `splu` yalnız matrisle çağrılıyor, tüm seçenekler kütüphane varsayılanı | `csc2.py:683` |
| Pivotlama? | **Evet** — SuperLU varsayılanı **eşik kısmi pivotlama** (`diag_pivot_thresh=1.0`) | örtük, `csc2.py:683` |
| Tolerans? | Doğrusal çözüme tolerans geçirilmez. Yakınsama toleransı `PowerFlowOptions.tolerance = 1e-6` pu, ∞-norm | `power_flow_options.py:76`; `common_functions.py:472-479` |
| Yedek (fallback)? | **Üç katman:** (1) `is_valid_for_super_lu` (`:603-661`, 9 yapısal kontrol) `None` döner; (2) `spfactor` `RuntimeError`/`ValueError` yakalar (`:685-686`); (3) `newton_raphson_fx:108-118` `ok==False` veya non-finite `dx` → **tüm çözümü durdurur**, son çözümü döner | |

**Diğer çözücüler farklı backend kullanır** (AC PF yolu hariç):
| Çözücü | Backend |
|---|---|
| Iwamoto-NR | `spsolve_csc` → `splu` (`iwamoto_newton_raphson.py:132`) |
| Powell dog-leg | `splu(A).solve(b)` (`powell_fx.py:15, 102, 143`) |
| Levenberg-Marquardt | `JᵀJ + μI` normal denklemler üzerinde aynı |
| Fast decoupled | `splu` (`fast_decoupled.py:8, 88, 117`) |
| HELM DPR / HELM | `spsolve`, `factorized` (`helm_dpr.py:28, 80, 445, 447`) |

EMT ve OPF için ayrı kayıtlar var (`emt_sparse_superlu_backend.py:304-309`,
`newton_raphson_ips_fx.py:234-250`) ama **AC PF'de kullanılmaz**.

### 12.2 Grid Analyzer — iteratif yöntem

Dosya: `src/analysis/power-flow/js/linear-solver.ts` (95 satır). **Düzen: CSR (row-major).**

| Satır | Fonksiyon | Detay |
|---|---|---|
| `:7` | `csrMatVec` | düz CSR mat-vec |
| **`:9-26`** | **`ilu0(A)`** | **ILU(0)** — doğal sıralama, **dolgu yok**, **pivotlama yok**. Satır yönlü döngü `:11-24`. Pivot kelepçesi `:15, :23`: non-finite veya `\|d\|<1e-10` ⇒ `±1e-10` (işaret korunur). `minPivot` **kelepçe öncesi** `min\|u_ii\|` raporlanır (`:22`). `diagPos[i]<0` ise `throw Error('ILU_DIAGONAL_MISSING')` (`:21`). Güncelleme `pos[i]` haritasıyla `:18` |
| **`:29-40`** | **`iluFill(A, 1\|2)`** | Seviye-dolgu sembolik+nümerik ILU. `level[j,k] ≤ l_ij + l_jk + 1`, ≤ `fillLevel` ise kabul. Sütunlar artan sırada (`:36`); eksik A girişleri **açık `0.0`** olarak materyalize edilir (`:36). `:39`'da `ilu0`'a devreder. Doc `:28`: *"used for station-control sensitivities only"* |
| `:42-47` | `iluSolve` | ileri + geri sübstitüsyon |
| **`:49-70`** | **`gmres(A, b, M, relTol=1e-8, restart=36, maxOuter=5)`** | Sağ-ön koşullu **restart GMRES**, classical Gram-Schmidt (`:59-60`), Givens rotasyonları (`:61-62`). Her restart'te **gerçek** artık `r = b − Ax`, `beta = ‖z‖`, `‖r‖/‖b‖` kontrol (`:53-54`). Breakdown: `den<1e-20` (`:62`), `beta≤1e-20` (`:55`) ⇒ `null`. Son kabul `rr < 1e-5` (`:69`) |
| **`:72-83`** | **`bicgstab(A, b, M, relTol=1e-8, maxIter=800)`** | BiCGSTAB, aynı ILU ön koşullayıcı. Breakdown → `null`: `\|rho1\|<1e-30`, `\|dot(r0,v)\|<1e-30`, `tt<1e-30`/`!finite(omega)`/`\|omega\|<1e-30` |
| **`:85-89`** | **`solveLinear`** | **ILU0 zinciri: GMRES(38,5) → BiCGSTAB(min(1200, max(200,N))) → `null`** |
| **`:90-95`** | **`solveLinearFill1`** | **ILU1 zinciri: ILU1-GMRES → ILU1-BiCGSTAB → `null`** |

**Seçim** — `newton.ts:38`: `linearFill===1 ? solveLinearFill1 : solveLinear`.
`linearFill` tam olarak station controller varsa `1` (`station-controls-v73.ts:61, 116`).
Duyarlılık problama üçüncü bir zincir kullanır: ILU1 → ILU2, **gerçek artık ≤ 1e-6**
doğrulamasıyla (`sensitivity-interleaved.ts:14-17`).

| Soru | Cevap | Kanıt |
|---|---|---|
| Doğrudan mı, iteratif mi? | **İTERATİF** | `linear-solver.ts:49, 72` |
| Hangi faktörizasyon? | **ILU(0)/(1)/(2) ön koşulu** + GMRES/BiCGSTAB | `:9, :29` |
| Düzen (layout)? | **CSR (row-major)** | `types.ts:26-27` `rowPtr, colIdx` |
| Ön koşullayıcı? | **ILU** (dolgu 0/1/2) | `:9, :29` |
| **Sıralama?** | **DOĞAL (kimlik).** RCM/AMD/Minimum Degree/nested dissection **yok** | Tüm dosya; `pos` haritası doğal indeks |
| **Pivotlama?** | **YOK.** Tek stabilizasyon: işaret-koruyan `±1e-10` kelepçesi (`:15, 23`), `pivotSource:'ILU0_PRE_REGULARIZATION'` olarak raporlanır (`types.ts:34`) | |
| Tolerans? | GMRES `relTol=1e-8`, son kabul `<1e-5`; BiCGSTAB aynı. Duyarlılık zinciri **gerçek artık ≤ 1e-6** | `:49, 69, 72, 82`; `sensitivity-interleaved.ts:14-15` |
| Yedek (fallback)? | GMRES → BiCGSTAB → `null`. `null` ⇒ `failureStage:'LINEAR_SOLVE'` + stage string, iç döngü kırılır | `newton.ts:38-52` |
| Line-search ilişkisi? | Çözücü **her** line-search denemesinde yeniden çağrılır (`newton.ts:38` `:40` döngüsü içinde) — 9 deneme × ILU faktörizasyonu | |

### 12.3 Karşılaştırma

| Boyut | VeraGrid | Grid Analyzer |
|---|---|---|
| Paradigma | Doğrudan LU | İteratif ILU + GMRES |
| Düzen | CSC | CSR |
| **Sıralama** | **COLAMD** (dolu sütun permütasyonu) | **DOĞAL (hiçbir permütasyon yok)** |
| **Pivotlama** | **Eşik kısmi pivotlama** | **Yok** — `±1e-10` kelepçesi |
| Ön koşul | Yok (dolaysız) | ILU(0) / ILU(1) / ILU(2) |
| Fallback | 3 katmanlı yapısal + istisna yakalama | 2 çözücü + 2-3 ön koşul kademesi |
| `minPivot` | Yok (SuperLU içinde) | Raporlanır (`types.ts:34`, `newton.ts:16`) |
| Bağımlılık | `scipy` (zorunlu) | **Yok** (in-house) |

### 12.4 Grid Analyzer'ın Jacobian layout'u çözücü gereksinimlerine uyuyor mu?

**Evet — bu konuda bir sorun yoktur.** Kanıt:
1. Ybus satırları ve Jacobiyan sütunları **her iki matriste de artan sırada** (`ybus.ts:27`,
   `jacobian.ts:58`) — ILU(0)'ın "dolgu yok" varsayımı **kesin** olarak doğrudur.
2. ILU(0) doğal sıralamada, artan sıralı satırlarla **minimal ama geçerli** bir dolgu üretir.
3. Ybus'un zayıf bağlanmış alt blokları (uzun hat zincirleri) doğal sıralamada kötü
   sıralanır — **bu gerçek bir verimlilik riskidir, bir doğruluk riski değil**
   (GMRES+ILU yakınsamayı yavaşlatır, bozmaz).
4. `INTEGRATED_Q_MATCHING_FAILED` (`:35`) ve `ILU_DIAGONAL_MISSING` (`linear-solver.ts:21`)
   yapısal sorunları **açıkça** yakalar.

**Kod kokusu değil, ölçülmüş performans riski:** `20260928-v74-final.json`'de
`C_directNr` 8.238,84 ms ve `"pass": false, "reason": "BASELINE_FALLBACK"`.
`v7.0.1-stabilization.md:37-41`'de H2525 `LINEAR_SOLVER_FAILED` 5.828 s /
mismatch 0,0003867495536 MW — **mismatch 1e-6'nın çok üstünde** olduğu halde
lineer çözücü null dönmüş. Bu, doğrudan yöntemle (pivotlamalı) asla olmayacak bir
hata modudur ve **sıralama + gerçek pivotlamanın** gerekçesidir.

**Kanıtlanmış koku (somut):** `linear-solver.ts:15, 23` kelepçesi `minPivot`'u **kelepçe öncesi**
raporluyor (`:22`) ama `types.ts:34` bunu `pivotSource:'ILU0_PRE_REGULARIZATION'` olarak
sunuyor. `newton.ts:16` bu değeri `failure` nesnesine koyuyor. Yani tanı "pivot sorunu"
diyor, ama asıl neden **sıralama eksikliği** ve pivotlamanın yokluğu. Bu, teşhisi yanlış
yönlendirir. **§16 P0-2 bunu düzeltir.**

---

## Performance Comparison

### 13.1 Ölçüm politikası

Görev, "büyük gerçek modelde gereksiz tekrarlar yapma" ve "mevcut benchmark sonuçlarını
yeniden kullan" dedi. Bu rapor **hiçbir yeni büyük-model çalıştırması yapmamıştır.**
Aşağıdaki tüm sayılar depoda **zaten var olan** ölçümlerden birebir alınmıştır.
VeraGrid tarafında **YTBS modeli hiç çalıştırılmamıştır** — çünkü DGS dosyası yok
(kontrol1 altında yalnız JSON var, `.dgs` yok) ve çalıştırmak §2'nin "yalnız kaynak kodu
incele" amacını aşardı.

### 13.2 Grid Analyzer — katman bazlı süreler

`docs/final-report.md:212-230` (Node ölçümü):

| Katman | 12:00 modeli | 16:00 modeli |
|---|---:|---:|
| JSON parse | 0,63 s | 0,88 s |
| DGS import/index | 1,13 s | 1,35 s |
| Canonical map | 1,97 s | 1,67 s |
| Topology/preparation | 0,20 s | 0,21 s |
| **Full AC** | **8,74 s** | **7,17 s** |
| Seçilen senaryo AC | 3,73 s, **başarısız** | 5,76 s, yakınsadı |

Tarayıcı (12:00): worker yükleme 3,08 s · preparation 0,252 s · Full AC 9,27 s / 13 adım
(`docs/validation/browser-validation.json:33, :78-79`). Eski v6.8 ölçümü: `solverTimeMs`
6.954,20 ms (`v6.8-browser-baseline.json:19`).

**Kısmi katman ölçümleri:**
- Fast AC: 832,67 ms (`full-model-results.json:118`)
- DC: 310,45 ms (`full-model-results.json:141`)

**Kontrol döngüsü maliyeti (v7.3/v7.4):**

| Çalışma | Değer |
|---|---:|
| `20260928-v72-benchmark.json` `elapsedMs` | **219.962,23 ms** (3,7 dk) |
| `20260928-benchmark.json` `elapsed` | 17.654,55 ms |
| `20260928-abcd-benchmark-v73.json` durum A | 5.014,90 ms |
| aynı, durum B | 13.562,65 ms |
| aynı, **durum C** | **86.613,53 ms** |
| aynı, `totalCaseWallMs` | 105.271,99 ms |
| `20260928-v74-final.json` durum C | **115.991,84 ms** |
| aynı, `C_directNr` | 8.238,84 ms |
| aynı, performance gate | `observedMs 8238.84`, `limitMs 30000`, **`pass: false`**, `reason: BASELINE_FALLBACK` |

`station-controls-v73.ts:19` `ControlTimings` alanları (`baseNrMs, controllerClassificationMs,
jacobianBuildMs, iluFactorMs, sensitivitySolveMs, outerTrialNrMs, finalNrMs,
controlLimitRestartNrMs`) **ölçüm için mevcuttur ama çıktıya yazılmıyor** — bu bir boşluktur
(§16 P1-5).

### 13.3 Ölçülen doğrulama (PowerFactory referansı ile)

Referans: `kontrol1/GridAnalyzer_YTBS_FullNR_Karsilastirma_Raporu_20260928 (1).xlsx`
(10 sheet, `00_Ozet`). **Bu bir PowerFactory karşılaştırmasıdır** — `numerical-parity.json`
(§13.4) DEĞİLDİR.

| Metrik | Değer |
|---|---:|
| Grid branch satırı | 5.249 (2.308 hat + 2.931 trafo + 10 seri kompanzatör) |
| Ortak hat | 2.308 / 2.381 YTBS (73 eksik, hepsi Durum ID=5) |
| Ortak trafo | 2.648 / 3.061 YTBS (413 eksik) |
| Ortak bara | 1.663 / 1.664 (1 eşleşmeyen: Bara ID 4604) |
| NR iterasyon | 10 · 103 PV→PQ dönüşümü |
| Grid CSV repro max fark | 2,9103830456733704e-09 |
| **Hat \|P\| MAE / RMSE / p95 / maks** | **9,157 / 18,159 / 43,437 / 149,753 MW** |
| **Hat \|Q\| MAE / RMSE / p95** | **6,232 / 13,374 / 28,308 MVAr** |
| **400 kV hat P MAE** | **31,555 MW** (p95 81,448) |
| 154 kV hat P MAE | 5,429 MW (p95 17,149) |
| Trafo P MAE / maks | 3,710 / 157,130 MW |
| Trafo \|Q\| MAE | 1,400 MVAr |
| **Bara Vpu ortalama hata (bias)** | **−0,015503 pu — sistematik düşük gerilim** |
| **Bara Vpu MAE / RMSE / p95 / maks** | **0,016959 / 0,020726 / 0,037023 / 0,067904 pu** |
| Ham bara açı farkı medyanı | 1,7586° |
| **Bara açı MAE (ref. düzeltmeli) / p95 / maks** | **1,3351 / 3,275 / 5,467 °** |

**Eşik uyum tablosu** (sheet `08_Metodoloji_Esikler`):

| Eşik | Sayı | Yüzde |
|---|---:|---:|
| Hat \|P\| ≤ 1 MW | 508/2308 | 22,01 |
| Hat \|P\| ≤ 5 MW | 1304/2308 | 56,50 |
| Hat \|Q\| ≤ 1 MVAr | 713/2308 | 30,89 |
| Trafo \|P\| ≤ 1 MW | 1061/2647 | 40,08 |
| **Bara \|V\| ≤ 0,005 pu** | **386/1663** | **23,21** |
| Bara \|V\| ≤ 0,02 pu | 951/1663 | 57,19 |
| Bara \|V\| ≤ 0,05 pu | 1660/1663 | 99,82 |
| **Bara \|a\| ≤ 0,5° (ref.corr.)** | **435/1663** | **26,16** |
| Bara \|a\| ≤ 2° (ref.corr.) | 1288/1663 | 77,45 |

Hedefler (`20260928-benchmark.json:160-185`) — **`targetMet` dördünde de `false`**:
`line154P {mae:2,p95:8}`, `line400P {mae:10,p95:30}`, `busVpu {mae:0.005,p95:0.015}`,
`angle {mae:0.5,p95:1.5}`. `validationQuality: "BENCHMARKED_PARTIAL"` (4 dosyada da).

**En iyi ulaşılan bara gerilim sonucu:** durum C, `busVpu` MAE **0,0070077 pu**,
p95 0,0175627 — **hâlâ** 0,005/0,015 hedefinin üstünde, **86,6 saniye** sonra.
`20260928-v74-final.json:10` `gateStatus: "FAIL_NOT_MERGEABLE"`,
`"mergeAllowed": false`.

**XLSX ana bulguları (aktarılan):**
1. "ElmStactrl uzak-bara gerilim kontrolü okunuyor fakat solver kontrol denklemlerine uygulanmıyor."
2. "Trafo faz kaydırması canonical.ts içinde phase=0 varsayılıyor."
3. "controlFidelity=PARTIAL ve referenceValidation=NOT_AVAILABLE."
4. Not: "YTBS XLSX signed MVAr vermiyor; |Q|=SQRT(MAX(0,S²-P²)) türetildi." —
   **Bu, Q metriklerine bir ölçüm belirsizliği enjekte eder**; Q MAE'leri bir üst sınırdır.

### 13.4 Grid Analyzer iç tutarlılık (PowerFactory DEĞİL)

`docs/validation/numerical-parity.json:349-378`: aynı modelde eski v6.8 HTML kerneli ile
yeni TS kerneli arasında `Vm/Va/P/Q` dizilerinde `maxAbsDiff: 0`. Model hazırlığı sapması:
`shuntG` maks 4,34e-19, `shuntB` 3,47e-18, `r` 6,94e-18, `x` 2,78e-17, `tap` 2,22e-16,
`endpointMismatches: 0`. Yakınsama: 13 iterasyon / 4 tur / maks uyuşmazlık 9,61e-10 MW.
**Bu iç tutarlılık kanıtıdır, PowerFactory pariteliği değildir** — `numerical-parity.json:2-13`
kaynağı v6.8 HTML'i olarak adlandırır.

### 13.5 VeraGrid — ölçüm yok

Yerel çalıştırma yapılmadı. Repo `Grids_and_profiles/` ve `examples/` dizinleri var ancak
YTBS DGS'i yok. **Herhangi bir VeraGrid performans iddiası bu raporda yapılmamaktadır.**

### 13.6 Süreç: neden "VeraGrid'den çalıştır ve karşılaştır" yapılmadı

1. Görev §13: "Büyük gerçük modelde gereksiz tekrarlar yapma" ve "mevcut benchmark sonuçlarını
   yeniden kullan".
2. YTBS verisi **yalnız JSON** (`kontrol1/*.json`); `.dgs` dosyası yok. VeraGrid'in
   `FileOpen` DGS'i `.zip` içinden okuyabilir (`20260928_0900_SN1_TR0.zip` mevcut), ancak
   bu 9,8 MB / 143,7 MB çıkarma + tam dönüştürme + çözüm işi tek seferlik bir koşudur ve
   §20'nin "rapor ve prompt dışında production kod değiştirme" kuralıyla da uyumsuz değildir
   ama **gerekçesiz**.
3. **En önemlisi:** §16'da önerilen geliştirmelerin hiçbiri VeraGrid'in *hızına* bağlı değil —
   hepsi **doğruluk** ve **semantik** düzeltmeleri. VeraGrid'in doğrudan LU çözücüsünün
   4.154 barda ölçülmüş performansı, Grid Analyzer'ın ILU-GMRES'inin gerekçelendirilmesini
   **zayıflatmaz**; yalnız "hangisi daha hızlı" tartışması bu kararları etkilemez.

**Karar: yeni büyük-model koşusu yapılmadı.** Gerekçe kayda geçti.

---

## Observed Grid Analyzer Fidelity Gaps

Aşağıdaki liste **yalnız doğrulanmış** gaplardır. Her biri §16'da bir öneriye bağlıdır.

| # | Gap | Kanıt | Etki ölçümü |
|---|---|---|---|
| **G1** | **Trafo faz kaydırması uygulanmıyor.** `tr2cn_h/tr2cn_l` parse edilmiyor, `phase: 0` sabit | `canonical.ts:73-74`; `preparation.ts:56` | 400 kV hat P MAE **31,555 MW**; bara açı MAE 1,3351°; Vpu bias −0,0155 pu |
| **G2** | **Station controller baseline Q kaybı (Hata A)** | `station-controls-v73.ts:47,53` | Muhtemel Vpu bias kaynağı; 483 kontrol etkileniyor |
| **G3** | **Station controller paylaşılan `changed` bayrağı (Hata B)** | `station-controls-v73.ts:64,68` | Yanlış `NO_REACTIVE_HEADROOM` ataması; ağırlık tutarsızlığı |
| **G4** | **Dış şebeke Q limitleri kayıp.** `ElmXnet.cQ_min/cQ_max` düşürülüyor | `canonical.ts:91`; `preparation.ts:31` | SL1'nin −500/+500 MVAr kapasitesi hiç kullanılmıyor |
| **G5** | **Lineer çözücüde sıralama ve pivotlama yok** | `linear-solver.ts:9-26` (doğal sıralama, kelepçe) | `LINEAR_SOLVER_FAILED` @ mismatch 3,87e-4 MW (v7.0.1) |
| **G6** | **`ComLdf` çoğu alanı yorumlanmıyor.** `erreq=0.2` vs sabit `1e-6` pu; `itrlx=100` vs tavan 8 | `newton.ts:31,36`; `:25` | Katı tolerans ⇒ gereksiz iterasyon; `itrlx` yok sayılıyor |
| **G7** | **Slack seçimi FID sözlüksel** | `preparation.ts:45` | Çoklu `ElmXnet`'te yanlış ada referansı riski (bugün 1 adet var) |
| **G8** | **Transformer tap penceresi sabit `(0.5, 1.6)`; geçersizse `tap=1`'e düşürülür** | `canonical.ts:70` | `mTaps` NaN'ı tap'i sessizce 1'e düşürür |
| **G9** | **`ElmShnt` adım anahtarlaması kayıp** (`mTaps:*` 35 kolon) | `canonical.ts:92-97` | 137–138 shunt; düşük değer |
| **G10** | **`ElmLne.nlnum` (paralel hat) okunmuyor** | `canonical.ts:30-57` | Paralel hat/repeater modellenmiyor; **miktarı doğrulanmadı** |
| **G11** | **`ElmGenStat.sgn` / `ElmSym.typ_id`→`TypSym.sgn` okunmuyor** ⇒ `ratingMva` boş | `canonical.ts:76-88` | `results.ts:12` `loading = .../m.ratingMva*100` → yükleme %'si anlamsız |
| **G12** | **`ElmSym.ip_ctrl` (slack atama) kayıp** | `canonical.ts:76-88` | Gerçek veride `ip_ctrl=0` tüm satırlarda — **düşük etki** |
| **G13** | **Bara gerilim bandı (`vmin`/`vmax`) hiç kullanılmıyor** | `ElmTerm` kolonları var, GA okumuyor | Eşik tablosu raporlanıyor ama ihlaller denetlenmiyor |
| **G14** | **Bilinmeyen StaCubic sessizce boş string'e düşüyor** | `canonical.ts:19-22` | Bozuk referans sessizce küçülmüş ağa dönüşür |
| **G15** | **`station-controls.ts` (v7.2) ölü kod** | `tests/unit/v72-station-control.test.ts:19` dışında hiç referans yok | Bakım yükü; yanıltıcı |
| **G16** | **`ComLdf` yalnız ilk satır okunuyor** | `canonical.ts:123` | 1 satır var — bugün etkisiz |
| **G17** | **`preparation.ts:39` `UNSUPPORTED_MODE_ENUM` sabit fallback** | Doğrudan okuma | Tanılayıcı yanıltıcı olabilir |
| **G18** | **`ControlTimings` ölçülüyor ama raporlanmıyor** | `station-controls-v73.ts:19` | 86–116 s'lik koşuların katman kırılımı görünmüyor |
| **G19** | **`ElmLod`/`ElmVac` FID'si `idtag` olarak korunmuyor** (`sourceRefs` var ama `id` üretilmiş) | `canonical.ts:89, :90` | Düşük; `base()` muhtemelen koruyor — **doğrulanmadı** |
| **G20** | **`ElmSecctrl` / `ElmBoundary` tamamen atıl** | `canonical.ts:125` | 1 satır her biri; ikincil kontrol döngüsü yok |

---

## What Grid Analyzer Should NOT Copy

Bu bölüm, görevin "VeraGrid'in her özelliğini taşımama" talimatının karşılığıdır.

| VeraGrid özelliği | Neden kopyalanmamalı | Kanıt |
|---|---|---|
| **ZIP / voltage-dependent yük modeli** | Gerçek veride `TypLod`, `iopt_pq`, `scale0`, `plinir/plinis/plinit` **hiç yok**. Uygulaması doğrulanmamış semantiğe dayanır ve `20260928-source-audit.md` bunu açıkça "unverified" işaretler. Ayrıca ZIP, NR'in doğrusallık bozulmasına yol açar. | §6.1, §6.5 |
| **`ElmTr3` / `ElmTr4` desteği** | Gerçek veride **sıfır örnek** (3/3 model). 3W/4W eklemek sıfır değer üretir, iki yeni tip ve iki yeni Ybus yolu demektir. | §8.4 |
| **Sıfır sekans (`X0`, `R0`, `X0_tor0`)** | Pozitif sekans AC PF'de kullanılmaz. Zaten `uk0tr/x0tor0` düşürülüyor — **bu doğru bir karardır.** | §8.3 |
| **Faz/multifaz (`StaCubic.cPhInfo`, `it2p1-3` sabit nokta iterasyonu)** | Gerçek veride `ElmTerm.phtech` **tüm 86.562 satırda 0**; `ElmLod.phtech` kolonu yok. Tam çözümleyici ~100 satır karmaşıklık, sıfır çıktı. | §2, §6.1 |
| **`ElmLodlv` / `ElmLodlvp` uyarısı** | VG bunları zaten **düşürüyor** (`:8062-8066`); uyarı vermek yeterli. Tam uygulama yok. | §5 |
| **Dizin-geçişli `K` türevli `composite_load` ekleme** | Kod kokusu: `dgs_to_veragrid.py:2421-2422` `R2/X2` pu'ya çevrilmeden kopyalanıyor; `circuit_to_data.py:501, 505` tekrar eden indeks (`4*ii+1`) içeriyor. Bu koddan formül alınmamalı. | §8.3, §6.3 notu |
| **`load.conn` (bağlantı tipi) yazma** | VG'de beyan edilmemiş öznitelik; çözücü okumuyor. Aynı deseni kopyalamak **ölü kod** demektir. | §2, madde 11 |
| **EMT / RMS / dinamik modül** (`dgs_rms_*`, `ElmVsc`, `ElmAsm`, `ElmSvs`) | YTBS transmission snapshot kapsamı dışında. | §2 |
| **Başlangıç bitişiçilik (schema duplication) modeli** | Grid Analyzer'ın `Entity.sourceRefs` + `classCounts` + `warnings` tasarımı **daha temiz ve daha az kod**. VG'nin "her cihazın 91 kolonluk DGS şeması" yaklaşımı kopyalanmamalı — `dgs_objects.py` 6298 satırın büyük kısmı kullanılmayan kolonlardır. | §5, §2 |
| **SuperLU'ya geçiş** | 4.154 barda ölçülen ILU-GMRES başarımı (8,24 s) kabul edilebilir; doğrudan LU fill maliyeti ölçeklenemez. Sorun **sıralama/pivot** eksikliğidir, paradigm değil. | §12.4 |
| **VeraGrid'in "daha az satır = daha iyi" iddiası** | `dgs_to_veragrid.py` 8378 satır tek orchestrator; `station-controls-v73.ts` 196 satırda 30 alanlık tanı. Satır sayısı mimari kalite ölçüsü değildir. | §4 |

---

## Prioritized Development Roadmap

### P0 — 1) Transformer faz kaydırması (`tr2cn_h`/`tr2cn_l` → açı)

| Alan | İçerik |
|---|---|
| **Problem** | `Transformer2W.phase` sabit `0` (`canonical.ts:73`); `tr2cn_h/tr2cn_l` hiç okunmuyor. 3.682–3.684 transformatörün hepsi faz kaydırmasız. |
| **Evidence** | `canonical.ts:73-74` (`phase: 0`, `PHASE_SHIFT_SOURCE_UNAVAILABLE`); `preparation.ts:56`; XLSX ANA BULGU 2; ölçüm: 400 kV hat P MAE 31,555 MW, bara açı MAE 1,3351°, Vpu bias −0,0155 pu. |
| **VeraGrid approach** | `tr2cn_h/tr2cn_l` okunur (`:1467-1474`), `nt2ag` mod 12 alınır (`:1478`), **ama açıya dönüştürülmez**. Yani VeraGrid'den **kod** alınmaz; **fark** kopyalanır (VG'nin açığı). |
| **GA current approach** | `canonical.ts:73` `phase: 0` sabit; `:74` provenance sentinel; `ybus.ts:11-18` zaten `complex(tap, phase)` tüketmeye hazır. |
| **Önerilen GA tasarımı** | `TypTr2.tr2cn_h` + `tr2cn_l` → vektör grubu haritası (IEC 60076: `Dyn11`→−30°, `YNd1`→+30°, `Yyn0`→0°, `YNyn0`→0°…). `Transformer2W.phase` = yüksek gerilim tarafına göre radians. `sourceRefs.phaseShift` alanına `tr2cn_h`/`tr2cn_l` yazılır. `ybus.ts:11-18` **değişmez**. |
| **Beklenen doğruluk etkisi** | Yüksek. 400 kV hat P MAE'sinde ve bara açı MAE'sinde ölçülebilir düşüş. XLSX eşiği `line400P {mae:10}` ve `angle {mae:0.5}` **şu an karşılanmıyor**; bu tek başına iki eşiğe yaklaştırabilir. |
| **Beklenen performans etkisi** | Sıfır — saf veri dönüşümü, hesap maliyeti değişmez. |
| **Uygulama riski** | **Düşük.** Geri dönüşü olan veri mevcut (`tr2cn_*` 3.682 satır). Ybus altyapısı hazır. Test edilebilir: iki sıralı transformatörlü bir barada açı farkı bilinen sonuçla karşılaştırılabilir. |
| **Gerekli test** | (a) vektör grubu tablosu birim testi; (b) `Ybus` faz kaydırmasının doğru açı verdiğini gösteren sentetik test; (c) XLSX referansıyla 154/400 kV hat P MAE'si **tek koşu**. |
| **Etkilenecek dosyalar** | `src/importers/dgs/canonical.ts`, `src/domain/model/network.ts` (opsiyonel `phaseShiftSource` alanı), `src/domain/dgs-semantics/fields.ts` (varsa), `tests/unit/transformer-phase.test.ts` |

### P0 — 2) Lineer çözücü: sıralama + gerçek pivotlama

| Alan | İçerik |
|---|---|
| **Problem** | ILU(0) doğal sıralamada çalışıyor; pivotlama **yok**; `±1e-10` kelepçesi `minPivot`'u maskeliyor. `LINEAR_SOLVER_FAILED` @ mismatch 3,87e-4 MW gözlenmiş. |
| **Evidence** | `linear-solver.ts:9-26` (`:15, :23` kelepçe; `:22` `minPivot` kelepçe öncesi); `types.ts:34` `pivotSource:'ILU0_PRE_REGULARIZATION'`; `newton.ts:16, :38-52`; `v7.0.1-stabilization.md:37-41`; `20260928-v74-final.json` `pass:false, reason:BASELINE_FALLBACK`. |
| **VeraGrid approach** | `scipy.sparse.linalg.splu` → **COLAMD** sıralama + **eşik kısmi pivotlama** (`csc2.py:683`). Kopyalanacak **konsept**: permütasyon + pivot. Kopyalanacak **kod yok** (Python/SciPy). |
| **GA current approach** | Doğal sıralama, kelepçelenmiş ILU(0), 2 çözücü fallback. |
| **Önerilen GA tasarımı** | (1) Hafif bir **RCM (Reverse Cuthill-McKee)** permütasyonu ekle — Ybus simetrik olduğu için RCM doğrudan uygulanabilir ve ~40 satır. (2) `ilu0`/`iluFill` içine **kısmi pivotlama**: satırın maksimum mutlak değerli sütunu pivot olarak seçilir, satırlar arası takas yapılır, `rowPtr`/`colIdx`/`pos` haritaları güncellenir. (3) `minPivot`'u **kelepçe sonrası** raporla; `pivotSource` alanını `'ILU_PIVOT_SWAP' \| 'ILU_REGULARIZED' \| 'ILU_CLEAN'` olarak üçle. (4) Tek çözücü → `direct` fallback'i kaldır veya **yalnız** çok küçük sistemlerde (N < 200) aç. |
| **Beklenen doğruluk etkisi** | Orta-Yüksek. `LINEAR_SOLVER_FAILED` sınıfındaki başarısızlıkları ortadan kaldırır → `CONTROL_SOLVE_FAILED: 158` azalır, `CONTROL_LIMIT_MAX_ROUNDS` azalır, performans kapısı geçilebilir hale gelir. |
| **Beklenen performans etkisi** | **Olumlu.** RCM doğal sıralamada dolguyu azaltır → GMRES iterasyon sayısı düşer. 86–116 s'lik koşu hedefi **< 30 s** (`limitMs`). |
| **Uygulama riski** | **Orta.** Pivotlama `pos: Map<number,number>[]` haritasını satır takası sırasında doğru güncellemeyi gerektirir. Kod kokusu: `pos` haritası satır-bazlı olduğu için takas **hem `pos` dizisini hem `rowPtr` bloklarını** etkiler. Bu, dikkatli ve testli yapılmalıdır. |
| **Gerekli test** | (a) sentetik: bilinerek kötü sıralanmış bir matris, RCM sonrası daha az iterasyon; (b) sentetik: tekil köşegen üreten matris → açık hata, sessiz NaN yok; (c) **IR H2525 regresyonu** (v7.0.1'de başarısız olan) → artık `CONVERGED`; (d) tam model **tek** koşu, elapsedMs karşılaştırması. |
| **Etkilenecek dosyalar** | `src/analysis/power-flow/js/linear-solver.ts`, `src/analysis/power-flow/js/ybus.ts` (permütasyon uygulaması), `src/analysis/power-flow/js/types.ts`, `tests/unit/linear-solver.test.ts` |

### P0 — 3) Station controller: iki doğrulanmış hata

| Alan | İçerik |
|---|---|
| **Problem** | (A) Baseline Q'su ownership geçişinde kayboluyor. (B) `changed` bayrağı döngü-dışı. |
| **Evidence** | A: `station-controls-v73.ts:44, 47, 53` + `preparation.ts:26`; karşılaştırma `:126`. B: `:64, 68, 70`. |
| **VeraGrid approach** | VeraGrid'de bu hata **yoktur**: `power_flow_worker.py:1053-1067` baseline çözümünden sonra `q_fixed/ii_fixed/b_fixed` ile sabit yük katkısını ayırır ve `split_reactive_power_between_generators_and_batteries` (`:1075-1098`) ile **çözülmüş Q'yu** cihazlara atar. **Bu prosedür kopyalanmalıdır.** |
| **GA current approach** | A: `model.qSpec` ham `qgini` ile kalıyor. B: `changed` global. |
| **Önerilen GA tasarımı** | **A:** `cloneModel(base)` sonrası, `base.busType[bus]===1` olan her aktüatör bus için `model.qSpec[bus] += baseline.Q[bus] - base.qSpec[bus]`. Ek olarak `initialControlDqPu` **0** yerine `-(baseline.Q[bus] - qgini)/baseMVA` ile başlatılabilir (daha iyi yakınsama). **B:** `let changed=false;` ifadesini `for` gövdesinin başına taşı. Ek güvenlik: `:70`'de `limits.length===0` ise `'NO_REACTIVE_HEADROOM'` **atama**, bunun yerine controller'ı bir sonraki tura bırak. |
| **Beklenen doğruluk etkisi** | Yüksek. 483 kontrolün tamamı etkileniyor. Vpu bias'ının bir kaynağını kaldırır. `ElmSym.constq` 670 + `ElmGenStat.constq` 1305 üreteç doğrudan faydalanır. |
| **Beklenen performans etkisi** | **Olumlu veya nötr.** Daha iyi başlangıç noktası ⇒ daha az Q-limit turu ⇒ `CONTROL_LIMIT_MAX_ROUNDS` olasılığı düşer. |
| **Uygulama riski** | **Düşük** (A ~4 satır, B ~1 satır + 1 koşullu). |
| **Gerekli test** | (a) 2 üreteçli tek remote bara sentetik: baseline Q farklı `qgini` iken `SATISFIED` ve `finalQ` fiziksel; (b) 3 controller, yalnız 1'i limit vuruyorken diğer ikisinin `status`'u değişmemeli ve `weights` aynı kalmalı; (c) tam model XLSX **tek** koşu, `busVpu` MAE/bias karşılaştırması. |
| **Etkilenecek dosyalar** | `src/analysis/power-flow/station-controls-v73.ts`, `tests/unit/v73-station-control.test.ts` |

### P1 — 1) `ElmXnet.cQ_min/cQ_max` okunması

| Alan | İçerik |
|---|---|
| **Problem** | Dış şebekenin reaktif kapasitesi kayboluyor; `qMinNet/qMaxNet` hiç dış şebekeden gelemiyor. |
| **Evidence** | `canonical.ts:91` (`cQ_min`/`cQ_max` okunmuyor); `preparation.ts:30-31`; gerçek veri: `cQ_min=-500, cQ_max=+500`. |
| **VeraGrid approach** | `elmsym.q_min/q_max` → `_interpret_pu_limit` (`:5115-5129`) → `Generator.Qmin/Qmax`. `ElmXnet` için `q_min/q_max` okunur (`:5118-5122` TipSym yolu). |
| **GA current approach** | `ExternalGrid` alanları yalnız `bus, pMw, qMvar, vmSet, bustpRaw, modeInputRaw`. |
| **Önerilen GA tasarımı** | `canonical.ts:91` bloğuna `qMin: r.cQ_min`, `qMax: r.cQ_max` ekle (`NetworkGenerator` zaten `qMin: number|null` alanına sahip, `network.ts:26`). `preparation.ts:30-31` zaten "tüm PV ünitelerin limiti varsa" kuralını uyguluyor; dış şebeke `voltageControl` değilse bu yol onu kapsamaz — `preparation.ts:28-29` dış şebeke enjeksiyonundan sonra slack baranın `qMinNet/qMaxNet`'i ayrıca doldurulmalı. |
| **Beklenen doğruluk etkisi** | Düşük-Orta. Bugün 1 dış şebeke var ve `pgini=qgini=0`; ölçülebilir değişim **beklenmez**. Ama çoklu `ElmXnet` senaryoları için doğru altyapı. |
| **Beklenen performans etkisi** | Sıfır. |
| **Uygulama riski** | Düşük. |
| **Gerekli test** | `ElmXnet.cQ_min/cQ_max` okuma birim testi; dış şebeke + PV gen aynı busda. |
| **Etkilenecek dosyalar** | `src/importers/dgs/canonical.ts`, `src/analysis/power-flow/preparation.ts` |

### P1 — 2) `ComLdf.erreq` / `itrlx` ile yakınsama parametreleri

| Alan | İçerik |
|---|---|
| **Problem** | Tolerans ve iterasyon tavanı sabit kodlanmış; `ComLdf` çoğu alanı yorumlanmıyor. |
| **Evidence** | `newton.ts:31` (`max_iter=30`), `:36` (`1e-6` pu), `:25` (`maxQLimitRounds ?? 8`); `canonical.ts:123`; `network.ts:56` `loadFlowOptionsRaw`. |
| **VeraGrid approach** | VeraGrid de `StaCalc`'i okumuyor — **hiçbir yaklaşım yok**. Bu, Grid Analyzer'ın öncü olabileceği bir noktadır. |
| **GA current approach** | Sabit `1e-6` pu ∞-norm, 30 iterasyon, 8 Q-limit turu. |
| **Önerilen GA tasarımı** | `ComLdf.erreq` (gerçek veri: 0,2) bir **referans** olarak okunup `controlFidelity`/`referenceValidation` alanlarında raporlanmalı, ancak **varsayılan tolerans değiştirilmemeli** (0,2 pu çok gevşek; 1e-6 pu güvenli). `itrlx` (100) yalnız `diagnostics`e yazılmalı. Tercihen `network.loadFlowOptionsRaw` zaten var — yalnız **yorum katmanı** ekle. |
| **Beklenen doğruluk etkisi** | Nötr (raporlama iyileşmesi). |
| **Beklenen performans etkisi** | Nötr. |
| **Uygulama riski** | Düşük. |
| **Gerekli test** | `referenceValidation` alanının `erreq`/`errlf`i yansıttığı birim testi. |
| **Etkilenecek dosyalar** | `src/analysis/power-flow/preparation.ts` (diagnostics), `src/analysis/validation/powerfactory-reference.ts` |

### P1 — 3) `ElmCoup` gerilim uyumsuzluk koruması → `ElmShnt.ushnm` doğrulaması

| Alan | İçerik |
|---|---|
| **Problem** | `ElmShnt.ushnm` (nominal gerilim) okunmuyor; iki farklı gerilim seviyesindeki şönt birleştirilirse sessizce model bozulur. |
| **Evidence** | `canonical.ts:92-97` (`ushnm` yok); `electrical-topology.ts:20` zaten `vnKv` uyuşmazlığı koruması uyguluyor (`%2` eşiği). |
| **VeraGrid approach** | `_extract_shunt_gb:4458` `U = elmshnt.ushnm * 1e3` — nominal gerilimden empedans türetir. |
| **GA current approach** | `bPu = q/100` (`canonical.ts:96`) — nominal gerilim **hiç** kullanılmıyor, yani `Q` doğrudan pu'ya çevriliyor ve `vnKv` ile tutarsız olabilir. |
| **Önerilen GA tasarımı** | `ushnm` okunmalı; `|ushnm/1000 − bus.vnKv| / bus.vnKv > %5` ise `warnings`'e yazılmalı. `bPu` hesabı **değişmemeli** (Q pu'ya doğrudan çevriliyor, doğru). |
| **Beklenen doğruluk etkisi** | Düşük-Orta. 137–138 şönt. |
| **Beklenen performans etkisi** | Sıfır. |
| **Uygulama riski** | Düşük. |
| **Gerekli test** | `ushnm` yoksa fallback'in `vnKv` kullanması ve uyarı üretmesi. |
| **Etkilenecek dosyalar** | `src/importers/dgs/canonical.ts` |

### P1 — 4) Slack seçimi: en büyük `Pbus`'lu PV

| Alan | İçerik |
|---|---|
| **Problem** | Slack seçimi FID sözlüksel; kapasite/öncelik dikkate alınmıyor. |
| **Evidence** | `preparation.ts:45`; `20260928-source-audit.md:13` "Priority semantics unverified". |
| **VeraGrid approach** | `compile_types:39-59` ve `select_ac_phase_reference_buses:342-351` — **en büyük `Pbus`'lu PV** seçilir; `ip_ctrl` bayrağı öncelik verir. |
| **GA current approach** | `sources.filter(inSameComponent).sort((a,b)=>a.id.localeCompare(a.id))[0]`. |
| **Önerilen GA tasarımı** | Öncelik kademesi: (1) `sources` içinde `pMw` pozitif olan en büyük `pMw`'li olan; (2) eşitlik durumunda en küçük FID (deterministik kalması için). `ip_ctrl` sütunu gerçek veride `0` olduğu için öncelik 2 gereksizdir ama **ileriye dönük**. |
| **Beklenen doğruluk etkisi** | Bugün **sıfır** (tek `ElmXnet`). Gelecek güvenliği. |
| **Beklenen performans etkisi** | Sıfır. |
| **Uygulama riski** | Düşük. |
| **Gerekli test** | İki dış şebeke + farklı `pMw` sentetik ağı: büyük `pMw`'li seçilmeli. |
| **Etkilenecek dosyalar** | `src/analysis/power-flow/preparation.ts` |

### P1 — 5) `ControlTimings` raporlaması

| Alan | İçerik |
|---|---|
| **Problem** | 86–116 s'lik koşuların katman kırılımı görünmüyor; optimizasyon körleşme. |
| **Evidence** | `station-controls-v73.ts:19` `ControlTimings` (8 alan) dolduruluyor ama `browser-js-engine.ts:28-33` veya `result-codec.ts` üzerinden **çıktıya yazılmıyor**. |
| **VeraGrid approach** | `power_flow_worker.py:295-323` `ConvergenceReport` (yöntem, iterasyon, elapsed, hata) her çözüm denemesi için toplanır ve `power_flow_driver.py:177-194` üzerinden sunulur. |
| **GA current approach** | Zamanlama alanları var, raporlanmıyor. |
| **Önerilen GA tasarımı** | `ControlTimings` nesnesini `ControlledIslandV73`'ten `CalculationResult.diagnostics`e taşı. Yeni gerçek-model koşusu **ancak bundan sonra** yapılmalı. |
| **Beklenen doğruluk etkisi** | Yok. |
| **Beklenen performans etkisi** | Yok (doğrudan), ancak **tanı kazanımı** P0-2'nin başarısını ölçülebilir kılar. |
| **Uygulama riski** | Düşük. |
| **Gerekli test** | `timings` alanlarının sonuçta pozitif ve `baseNrMs + finalNrMs + controlLimitRestartNrMs > 0` olduğunun testi. |
| **Etkilenecek dosyalar** | `src/analysis/power-flow/station-controls-v73.ts`, `src/analysis/api/browser-js-engine.ts`, `src/analysis/power-flow/results.ts`, `src/domain/results/types.ts` |

### P2 — 1) `ElmGenStat.sgn` / `ElmSym.typ_id` → `ratingMva`

| Alan | İçerik |
|---|---|
| **Problem** | `Generator.ratingMva` doldurulmuyor; `results.ts:12` `loading = max(sf,st)/m.ratingMva*100` yükleme yüzdelerini anlamsız kılıyor. |
| **Evidence** | `canonical.ts:76-88` (`sgn` okunmuyor; `typ_id` okunmuyor); `context.ts:65` `TypSym` yalnız skip-listesinde (`index.ts:97`); `results.ts:12`. |
| **VeraGrid approach** | `typsym.sgn` (`:5110`) → `Generator.Snom`; `elmgenstat.sgn` (`:4114, :4163, :4210, :4261`) → tüm alt tiplerde. |
| **Önerilen GA tasarımı** | `ElmGenStat.sgn` doğrudan okunmalı (kolon mevcut). `ElmSym` için `typ_id` → `TypSym.sgn` çözümü `context.ts:65`'teki mevcut tip eşlemesi genişletilerek yapılabilir. `ratingMva: null` ise `results.ts:12` bölme yapmamalı, `loading: null` üretmeli. |
| **Beklenen doğruluk etkisi** | Doğrudan AC sonuçlarına dokunmaz (**yalnız sunum**). Yükleme %'si ve termal limit uyarıları düzelir. |
| **Beklenen performans etkisi** | Sıfır. |
| **Uygulama riski** | Düşük. |
| **Gerekli test** | `sgn` okuma; `ratingMva: null` için `loading: null`. |
| **Etkilenecek dosyalar** | `src/importers/dgs/canonical.ts`, `src/domain/dgs-semantics/context.ts`, `src/analysis/power-flow/results.ts` |

### P2 — 2) Bara gerilim bandı (`vmin`/`vmax`) doğrulaması

| Alan | İçerik |
|---|---|
| **Problem** | `ElmTerm.vmin`/`vmax`/`iOPFCvmin`/`iOPFCvmax` var, hiç okunmuyor. XLSX eşik tablosu raporlanıyor ama ihlaller denetlenmiyor. |
| **Evidence** | `ElmTerm` 14 kolon (gerçek veri); `canonical.ts:23-24` yalnız `uknom`. |
| **VeraGrid approach** | VeraGrid de okumuyor — **ortak kör nokta**. |
| **Önerilen GA tasarımı** | `Bus` tipine `vMinKv?/vMaxKv?`; `mapResults` sonrası ihlal sayacı (`diagnostics.voltageViolations`). Bu XLSX `00_Ozet` tablosunu **otomatik** üretir. |
| **Beklenen doğruluk etkisi** | Yok (hesap değişmez) — **teşhis** değeri yüksek. |
| **Beklenen performans etkisi** | Sıfır. |
| **Uygulama riski** | Düşük. |
| **Gerekli test** | Eşik ihlali sayacı. |
| **Etkilenecek dosyalar** | `src/importers/dgs/canonical.ts`, `src/domain/model/network.ts`, `src/analysis/power-flow/results.ts` |

### P2 — 3) `ElmLne.nlnum` paralel hat desteği

| Alan | İçerik |
|---|---|
| **Problem** | `nlnum` (paralel devre sayısı) okunmuyor. |
| **Evidence** | `canonical.ts:30-57` `ElmLne` kolonları `nlnum` içermiyor. |
| **VeraGrid approach** | `nlnum` → `Line.parallel_count` (`:7772`). |
| **Önerilen GA tasarımı** | `nlnum>1` ise ya `rOhm/nlnum` böl ve `ratingMva*nlnum` çarp ya da `parallelCount` alanı ekle. **Önce gerçek veride `nlnum` dağılımı ölçülmeli** (`nlnum>1` satır sayısı). Sıfırsa **YAPMA**. |
| **Beklenen doğruluk etkisi** | Ölçüm yapılana kadar bilinmiyor. |
| **Uygulama riski** | Düşük. |
| **Gerekli test** | `nlnum=2` sentetik. |
| **Etkilenecek dosyalar** | `src/importers/dgs/canonical.ts` |

### P2 — 4) Büyük-kabuk referans doğrulaması (diagnostics düzeltmesi)

| Alan | İçerik |
|---|---|
| **Problem** | `preparation.ts:39` `UNSUPPORTED_MODE_ENUM` **sabit** bir fallback olarak yazılıyor; `:41` `satisfied:0, qLimitSaturated:0, unsupported:controls.length` sabit. Gerçek sayımlar `browser-js-engine.ts:28-33`'te yeniden hesaplanıyor. |
| **Evidence** | Doğrudan okuma. |
| **Önerilen GA tasarımı** | `preparation.ts:41` gerçek sayımları hesaplasın veya alan kaldırılıp tek kaynakta hesaplansın. **Kod okunabilirliği + teşhis doğruluğu.** |
| **Beklenen doğruluk etkisi** | Yok. |
| **Uygulama riski** | Çok düşük. |
| **Etkilenecek dosyalar** | `src/analysis/power-flow/preparation.ts` |

### P3 — 1) `station-controls.ts` (v7.2) ölü kod silinmesi

`tests/unit/v72-station-control.test.ts:19` dışında hiç referans yok. Test de
kaldırılmalıysa ikisi birlikte silinmeli. **Bakım yükü azaltma.**

### P3 — 2) `dispatchedPWeights` eşit ağırlık yedeği

`station-participation.ts:5-9` `null` döndüğünde `station-controls-v73.ts:108` tüm kontrolü
`UNSUPPORTED_DISTRIBUTION` yapıyor. `cvqq` yoksa ve `ΣP<=1e-9` ise `1/n` eşit ağırlık
yedek PowerFactory davranışına daha yakındır. **Düşük öncelik; etkisi ölçülmeli.**

### P3 — 3) `ElmLod.u0` korunması

`u0` mevcut (tüm satırlarda 1) ama düşürülüyor. `sourceRefs.loadModel` alanına yazılması
ileride ZIP çalışmasının ön koşulu olur. **Tek satır, sıfır etki — şimdilik gerekli değil.**

---

## Source Evidence Index

Her iddia için: repo · commit · dosya · sınıf/fonksiyon · satır aralığı.

### VeraGrid — `C:\VeraGrid\dev\VeraGrid` · `411223f762eb4eb1046f64bfedba88e9b0cc88b3` · `feature/turkish-localization`

| Konu | Dosya | Sınıf/Fonksiyon | Satır |
|---|---|---|---|
| DGS giriş noktası | `src/VeraGridEngine/IO/file_open.py` | `FileOpen.__init__` / `open` | 354, 412, 418, 665-676 |
| DGS dönüştürücü girişi | `IO/dgs/dgs_to_veragrid.py` | `dgs_to_circuit` | 7900-8378 |
| Tablo parser | `IO/dgs/dgs_circuit.py` | `parse_header` / `DgsCircuit.parse_dgs` | 98, 567-618 |
| FID normalizasyonu | `IO/dgs/dgs_to_veragrid.py` | `_ref_id` | 154-167 |
| Referans çözümleyici | `IO/dgs/dgs_to_veragrid.py` | `_resolve_pointer_dict_value` | 270-287 |
| Kolon şeması | `IO/dgs/dgs_objects.py` | `DgsProperty` / `DGSElement.parse_line` | 73, 199, 212-248 |
| NaN fallback | `IO/dgs/dgs_objects.py` | `DgsProperty.parse` | 136-184 |
| Kubikül topolojisi | `IO/dgs/dgs_to_veragrid.py` | `_build_stacubic_mappings` / `get_terminal_ids` | 6732-6775, 585-615 |
| Bus oluşturma | `IO/dgs/dgs_to_veragrid.py` | `convert_dgs_to_bus` / `add_dgs_terminal_buses` | 685-734, 6979-7019 |
| **Yük modeli** | `IO/dgs/dgs_to_veragrid.py` | `_extract_load_pq` | **3737-3830** |
| Yük `scale0` | `IO/dgs/dgs_to_veragrid.py` | `_get_scale_factor` | 3711-3734 |
| **Yük model seçimi** | `IO/dgs/dgs_to_veragrid.py` | **`convert_dgs_to_load`** | **3946-4071** |
| **ZIP matematiği** | `Simulations/PowerFlow/NumericalMethods/common_functions.py` | **`compute_zip_power`** | **374-396** |
| Yük p.u. toplama | `DataStructures/load_data.py` | `get_injections_per_bus` / `get_current_injections_per_bus` / `get_admittance_injections_per_bus` | 233, 291, 298 |
| Yük Ybus'a girmesi | `Simulations/PowerFlow/Formulations/pf_basic_formulation_3ph.py` | — | 225-229 |
| **BusMode enum** | **`src/VeraGridEngine/enumerations.py`** | **`BusMode`** | **9-55** |
| **Bus maske semantiği** | `DataStructures/bus_data.py` | `set_bus_mode` | 306-421 |
| **P/PQV üretimi** | `Compilers/circuit_to_data.py` | **`set_bus_control_voltage`** | **70-114** |
| Uzak kontrol çağıranları | `Compilers/circuit_to_data.py` | `fill_generator_parent` / shunt | 1162-1181, 1013-1031 |
| Durum vektörü | `Simulations/PowerFlow/Formulations/pf_basic_formulation.py` | `__init__` / `x2var` | 91-122 |
| Eşleşme vektörü | `Simulations/PowerFlow/Formulations/pf_basic_formulation.py` | `update` | 196-206 |
| **Jacobiyan** | `Simulations/Derivatives/ac_jacobian.py` | `create_J_vc_csc` | 286-383 |
| Türev çekirdeği | `Simulations/Derivatives/csc_derivatives.py` | `dSbus_dV_numba_sparse_csc` | 17-95 |
| **Lineer çözücü** | `Simulations/PowerFlow/NumericalMethods/newton_raphson_fx.py` | NR döngüsü | 103-147 |
| **SuperLU** | `Utils/Sparse/csc2.py` | `spsolve_csc` / `spfactor` / `is_valid_for_super_lu` | 689-700, 664-686, 603-661 |
| Line search | `Simulations/PowerFlow/NumericalMethods/newton_raphson_fx.py` | — | 122-130 |
| Q-limit | `Simulations/PowerFlow/NumericalMethods/discrete_controls.py` | `control_q_inside_method` | 181-217 |
| Slack seçimi | `Topology/simulation_indices.py` | `compile_types` | 12-66 |
| AC faz referansı | `DataStructures/numerical_circuit.py` | `select_ac_phase_reference_buses` | 253-356 |
| Ada bölme | `DataStructures/numerical_circuit.py` / `Topology/topology.py` | `split_into_islands` / `find_islands_numba` | 1450-1483 / 15-78 |
| P dengeleme | `Simulations/PowerFlow/NumericalMethods/discrete_controls.py` | `compute_slack_distribution` | 608-627 |
| Trafo tap/OLTC | `IO/dgs/dgs_to_veragrid.py` | `convert_dgs_to_transformer_type` / `convert_dgs_to_transformer` | 1444-1481, 2130-2427 |
| Trafo bağlantı kodu | `IO/dgs/dgs_to_veragrid.py` | `_convert_pf_tr2_connection` | 1410-1441 |
| Trafo faz ataması | `IO/dgs/dgs_to_veragrid.py` | — | 2283-2300 |
| Trafo sıfır sekans | `IO/dgs/dgs_to_veragrid.py` | — | 2408-2422 |
| Log raporlama | `src/VeraGridEngine/basic_structures.py` | `Logger` | 294-685 |
| Ölü parser | `IO/dgs/dgs_parser.py` | `dgs_to_circuit` | 1256 (0 importer) |
| Lisans | `LICENSE.md` | MPL-2.0 | 1-2 |
| Sürüm | `src/VeraGrid/__version__.py` | — | 8 |

### Grid_Analyzer_v7 — `01395404fccf908b0b160b45759bb4ad30f4c81f` · `release/v7.4-final`

| Konu | Dosya | Fonksiyon | Satır |
|---|---|---|---|
| DGS modeli | `src/importers/dgs/index.ts` | `DgsModel` / `build` / `parse_dgs` | 243, 282-345, 567 |
| FID indeksi | `src/importers/dgs/index.ts` | `build` | 301-321 |
| Canonical giriş | `src/importers/dgs/canonical.ts` | `mapCanonical` | 9 |
| **Yük** | `src/importers/dgs/canonical.ts` | `ElmLod` bloğu | **89** |
| Trafo | `src/importers/dgs/canonical.ts` | `ElmTr2` bloğu | 58-75 |
| **Trafo faz = 0** | `src/importers/dgs/canonical.ts` | — | **73-74** |
| Üreteç | `src/importers/dgs/canonical.ts` | `ElmSym` / `ElmGenStat` | 76-88 |
| Dış şebeke (Q limit kaybı) | `src/importers/dgs/canonical.ts` | `ElmXnet` | 91, 122 |
| Şönt | `src/importers/dgs/canonical.ts` | `ElmShnt` | 92-97 |
| `ComLdf` | `src/importers/dgs/canonical.ts` | — | 123 |
| Sayısal okuyucu | `src/importers/dgs/canonical.ts` | `num` / `rawNumber` | 6, 104 |
| Terminal çözümleme | `src/importers/dgs/canonical.ts` | `endpoint` | 19-22 |
| Model tipleri | `src/domain/model/network.ts` | `Entity`…`CanonicalNetwork` | 3-64 |
| Hazırlık | `src/analysis/power-flow/preparation.ts` | `prepareModel` | 10-58 |
| **Yük tüketimi** | `src/analysis/power-flow/preparation.ts` | — | **27** |
| Slack seçimi | `src/analysis/power-flow/preparation.ts` | — | 45, 51 |
| Q limit toplama | `src/analysis/power-flow/preparation.ts` | — | 30-31 |
| Topoloji / koruma | `src/topology/electrical-topology.ts` | `buildTopology` | 10-22 |
| **İstasyon kontrolü (entegre)** | `src/analysis/power-flow/station-controls-v73.ts` | **`runIntegratedStationControls`** | **46-84** |
| **HATA A** | `src/analysis/power-flow/station-controls-v73.ts` | `cloneModel` / `runIntegratedStationControls` | **44, 47, 53** |
| **HATA B** | `src/analysis/power-flow/station-controls-v73.ts` | `runIntegratedStationControls` | **64, 68, 70** |
| Sınıflandırma | `src/analysis/power-flow/station-controls-v73.ts` | `runStationControlledIslandV73` | 94-113 |
| Non-entegre yol (Q koruma) | `src/analysis/power-flow/station-controls-v73.ts` | — | 122-130 |
| Katılım | `src/analysis/power-flow/station-participation.ts` | `dispatchedPWeights` / `stationParticipation` / `allocateReactiveDelta` | 5-37 |
| Duyarlılık | `src/analysis/power-flow/js/sensitivity-interleaved.ts` | `probeAdjointSensitivities` / `solveSensitivityRhs` | 26-47, 12-19 |
| NR sürücüsü | `src/analysis/power-flow/js/newton.ts` | `solveNR` | 14-73 |
| Durum/mismatch | `src/analysis/power-flow/js/newton.ts` | — | 19-21, 33-34 |
| Line search | `src/analysis/power-flow/js/newton.ts` | — | 39-52 |
| Q-limit (iç) | `src/analysis/power-flow/js/newton.ts` | — | 25, 55-58 |
| Layout | `src/analysis/power-flow/js/jacobian.ts` | `makeLayout` | 16-64 |
| **Eşleştirme garantisi** | `src/analysis/power-flow/js/jacobian.ts` | — | **20-39** |
| **Controller bloğu** | `src/analysis/power-flow/js/jacobian.ts` | `fillJacobian` | **55, 81** |
| Ybus | `src/analysis/power-flow/js/ybus.ts` | `buildY` | 4-32 |
| **Lineer çözücü** | `src/analysis/power-flow/js/linear-solver.ts` | `ilu0` / `iluFill` / `gmres` / `bicgstab` / `solveLinear` / `solveLinearFill1` | 9-95 |
| Sonuç eşleme | `src/analysis/power-flow/results.ts` | `mapResults` | 6-17 |
| Sürüm | `package.json` / `src/version.ts` | — | 3 |

### Gerçek veri

| Belge | Yol | Doğrulanan |
|---|---|---|
| DGS kaynak profili | `docs/dgs-source-profile.md` | 40 tablo, 576.001 satır, tablo satır sayıları (bağımsız yeniden doğrulandı, 40/40 eşleşti) |
| Kaynak denetimi | `docs/validation/20260928-source-audit.md` | ElmStactrl 483/372; ComLdf değerleri; TypTr2 24 kolon; `i_ctrl=imode=0` |
| PowerFactory karşılaştırma | `kontrol1/GridAnalyzer_YTBS_FullNR_Karsilastirma_Raporu_20260928 (1).xlsx` | Sheet `00_Ozet`, `08_Metodoloji_Esikler` — tüm doğrulama metrikleri |
| Ham DGS verisi | `kontrol1/20260923_1200_SN3_TR0.json` (143.026.320 B), `20260923_1600_SN3_TR0.json`, `20260928_0900_SN1_TR0.zip` (9.799.696 B → 143.737.437 B) | Kolon varlık/yokluk denetimi, değer dağılımları |
| İç tutarlılık | `docs/validation/numerical-parity.json` | v6.8↔v7 `maxAbsDiff: 0` (**PowerFactory değil**) |
| Performans | `docs/final-report.md:212-230`; `docs/validation/20260928-*.json`, `20260928-v74-final.json` | Katman süreleri, kontrol döngüsü maliyeti, gate durumu |

---

## Uncertainties / Not Verified

Aşağıdakiler **kanıtlanmamıştır** ve geliştirme prompt'unda varsayım olarak kullanılmamalıdır.

| # | Belirsizlik | Neden doğrulanamadı | Nasıl doğrulanabilir |
|---|---|---|---|
| **U1** | `TypTr2.tr2cn_h/tr2cn_l` **gerçek değerlerinin dağılımı** ölçülmedi. Vektör grubu→açı tablosunun doğruluğu bu değerlere bağlıdır. | Ham JSON'dan yalnız kolon adları doğrulandı; `distinct` dağılımı alınmadı. | `TypTr2` 3.682 satır `tr2cn_h`×`tr2cn_l` çapraz tablosu çıkarılmalı. |
| **U2** | `ComLdf.iopt_pq` yokluğu **dışa aktarım ayarından** mı yoksa PowerFactory sürümünden mi kaynaklanıyor, bilinmiyor. Yalnız **bu** export'ta yoktur; başka bir export'ta olabilir. | Tek export profili incelendi. | Farklı bir DGS versiyonu/export ayarı ile alınmış dosya incelenmeli. |
| **U3** | `ElmStactrl.droop` (`i_droop=1`, 233 kontrol) anlamı. Kod `i_droop=1 → droop` varsayıyor; `20260928-source-audit.md:11` "Units/formula/sign unverified" diyor. `ddroop` değerleri negatif (−2,−4,−5,−6,−7). | PowerFactory dokümantasyonu doğrulanmadı. | PowerFactory `ElmStactrl` referans dokümanı. |
| **U4** | `ElmStactrl.psym` (birim referansları) — 860 referansın **371'i hizmet dışı** birimlere işaret ediyor. Bunların `unitRefs[].inService` filtresiyle ayıklanıp ayıklanmadığı `station-controls-v73.ts:94` `active` filtresinde doğrulandı ama **etkisi ölçülmedi**. | — | Tam model koşusunda `outOfServiceUnits` sayacı. |
| **U5** | `LOCAL_PV_CONFLICT` (`:109`) gerçek veride **kaç kontroli** reddettiği ölçülmedi. Aynı busa düşen çoklu `constv` üreteçler varsa oran yüksek olabilir. | Tam model koşusu yapılmadı. | Tam model koşusunda `status` histogramı. |
| **U6** | `ElmLne.nlnum` dağılımı ölçülmedi (`nlnum>1` satır sayısı bilinmiyor). | Değer dağılımı alınmadı. | `ElmLne` 2.382 satır `nlnum` histogramı. |
| **U7** | HATA A'nın **ölçülen** Vpu bias katkısı bilinmiyor. Kod yolu kanıtlandı, etki büyüklüğü ölçülmedi. | Tam model koşusu yapılmadı. | HATA A düzeltmesi sonrası XLSX `busVpu` bias karşılaştırması. |
| **U8** | `ElmShnt` 137–138 adetlik grupta `shtype` dağılımı `1` (endüktif 123) / `2` (kapasitif 14). `ncapa/ncapx` oranları ölçülmedi. | — | `ElmShnt` detay dağılımı. |
| **U9** | **VeraGrid'in YTBS modelindeki performansı** ölçülmedi. Hiçbir karşılaştırma yapılmadı. | `.dgs` yok, çalıştırılmadı (§13.6). | Gerekli olmadığı kabul edildi. |
| **U10** | `ElmVac` 12 adetlik `itype=2` (Ward eşdeğeri) grubunda `Pzload`/`Qzload` **sıfır mı** yoksa dolu mu, ölçülmedi. VG bunları `G`/`B` olarak kullanıyor; GA tamamen yok sayıyor. | — | `ElmVac` değer dağılımı. |
| **U11** | `ElmLod.idtag` / `ElmVac.idtag` korunuyor mu? `canonical.ts:89` açıkça `id` geçmiyor, ama `base()` yardımcısı üretebilir. | `base()` fonksiyonu denetlenmedi. | `canonical.ts` içinde `base` tanımı okunmalı. |
| **U12** | XLSX Q karşılaştırması **imzali (signed) MVAr vermiyor**; `|Q| = sqrt(max(0, S²−P²))` türetilmiş. Q MAE'leri bu nedenle **bir üst sınırdır**. | Sheet notu. | PowerFactory'den işaretli Q kolonlu export. |
| **U13** | `cvqq` yokluğu bu export'a mı yoksa PowerFactory sürümüne mi ait, bilinmiyor (U2 ile aynı nitelik). | — | Farklı export. |
| **U14** | `StaSwitch` tablosunun yokluğu: GA kodda işliyor ama gerçek veride yok. Farklı bir TEP projesinde olabilir. | — | Farklı proje export'u. |
| **U15** | Vektör grubu → faz kaydırması işareti: Yön (bus→bar veya bara→bus) IEC tablosuna göre seçilmelidir. **Bu yön seçimi koda gömülü değildir** ve P0-1'in uygulanmasında en kritik karardır. | PowerFactory'nin yön kuralı doğrulanmadı. | İki sıralı trafolu bir sentetik barada yön testi. |

---

## Final Conclusions

1. **Grid Analyzer'ın DGS kapsamı VeraGrid'inkinden geniş DEĞİLDİR, ama dar da değildir.**
   VeraGrid'in 91 tablo şemasına karşılık GA'nın 40 tablo profilinde 20+ sınıf işleniyor.
   GA **benzersiz** olarak `ElmStactrl`'ü hem semantik hem sayısal olarak uyguluyor —
   bu, VeraGrid'in **yapmadığı** bir şey. Buna karşılık GA `ElmTr3/ElmTr4` (VG'de var),
   çok fazlı (`ctech`/`cPhInfo`), sıfır sekans (`uk0tr`), DC kablo/OHL geometri, VSC/ElmAsm/ElmSvs
   modellerini **yok sayıyor**. Net: **farklı önceliklendirme, farklı derinlik.**

2. **Hipotez 1 (ZIP) — kısmen doğru, pratikte alakasız.**
   VeraGrid `ComLdf.iopt_pq` **ve** `TypLod.aP/bP/aQ/bQ` **okur** (`dgs_to_veragrid.py:3988-4002`)
   — **DOĞRULANDI**. Ancak gerçek veride **hiçbiri yok** (§6.1) ve VG'nin ZIP'i üç tam-ZIP özel
   durumuna indirgenmiş. **Grid Analyzer'a ZIP önermemek doğru karardır.**

3. **Hipotez 2 (ElmLod voltage-dependent) — doğru, ama uygulanabilir değil.**
   VeraGrid `plinir/plinis/plinit`, `qlinir/qlinis/qlinit`, `slini`, `coslini`, `scale0`, `phtech`,
   `i_sym` **hepsini okur ve kullanır** (`_extract_load_pq:3737-3830`) — **DOĞRULANDI**.
   Gerçek veride **hiçbiri yok**. Grid Analyzer'ın constant-PQ modeli **bu veri için doğrudur**
   ve kodla kanıtlanmıştır (`canonical.ts:89`, `preparation.ts:27`, `ybus.ts:20-23`).

4. **Hipotez 3 (`ComLdf.iopt_pq`) — DOĞRULANDI** (`:3988` `iopt_pq == 1`). Tek `ComLdf`
   satırı okunur (`:5444`).

5. **Hipotez 4 (P/PQV remote voltage control) — YARI DOĞRULANDI, düzeltildi.**
   P ve PQV **var** (`enumerations.py:16-17`, `circuit_to_data.py:95-97`). Ancak
   **"|V| ve Q serbest" yanlıştır**: `|V|` setpoint'e sabitlenir (`:107`), Q bir denklemdir
   (`pf_basic_formulation.py:101`). **Serbest olan P barının Q'sudur.** §10.4.

6. **Hipotez 5 (GA load modeli constant-PQ) — DOĞRULANDI.** `Load` 3 alan; tüketim tek
   satır; 20+ arama terimi 0 sonuç. §6.4.

7. **Hipotez 6 (GA station controller qCtrl/dqCtrl augmented Newton) — DOĞRULANDI.**
   Ayrı `controlDq` durumu (`:41`), Jacobian bloğu (`:81`), `effectiveQ` bağı (`:20-21`).
   Bu **VeraGrid'de yoktur**. GA'nın P/PQV'ye kıyasla daha iyi bir tasarımıdır: kare olmayan
   eşleşmeyi yapısal olarak imkânsız kılar (`jacobian.ts:20-39`).

8. **Hipotez 7 (farklı lineer çözücü) — DOĞRULANDI.** VeraGrid: SuperLU/CSC/COLAMD/pivotlama
   (`csc2.py:683`). GA: ILU/CSR/doğal sıralama/pivotlama yok (`linear-solver.ts:9-26`).
   **Fark bir detay değil, iki farklı paradigmadır ve ikisi de meşrudur.**

9. **İki yeni bulgu (görev ön kabulleri dışında):**
   - **HATA A ve HATA B** gerçek kod hatalarıdır (§9.3, §9.4).
   - **`ElmXnet.cQ_min/cQ_max` kaybı** — veri mevcut, kod okumuyor (§7.2, G4).
   - **`Transformer2W.ratingMva` hiç doldurulmuyor** ⇒ yükleme %'leri anlamsız (G11).

10. **Lisans.** VeraGrid **MPL-2.0**'dir (`LICENSE.md:1-2`).

    **Yükümlülükler:**
    - MPL-2.0 §3.1: kaynak kod dağıtımı yaparsanız **Covered Software** olur; değiştirdiğiniz
      dosyaları MPL-2.0 altında **yayımlamanız** gerekir.
    - MPL-2.0 §3.2: MPL-2.0 altındaki bir dosyadan türetilmiş **veri yapıları/veritabanı**
      (kendi özgün çalışmanız olsa bile) MPL-2.0 kapsamındadır.
    - MPL-2.0 §1.14 "Incompatible With Secondary Licenses": GPL-2.0 "tümüyle" uyumsuz;
      LGPL'e karşı "Incompatible" ilan edilebilir.
    - MPL-2.0 §10: patent lisansı ve patent iddiası sonlandırma maddesi.
    - **Grid Analyzer `private: true` ve lisans dosyası içermiyor** — bu, onun dağıtım
      biçimini etkiler (ticari/kapalı kullanım mümkündür).

    **Tavsiye:** Bu rapordaki tüm öneriler **algorithmic concept / data semantics / mathematical
    formulation / architecture pattern** seviyesindedir. **Hiçbir VeraGrid kodu kopyalanmamıştır
    ve kopyalanmamalıdır.** Somut olarak:
    - ZIP formülü kopyalanmamalı (zaten önlenmiştir).
    - `is_valid_for_super_lu` yapısal kontrolleri **konsept** olarak alınabilir; Python/SciPy
      kodu çevrilmemelidir.
    - Vektör grubu→açı dönüşümü **IEC 60076 kuralından** türetilmelidir, VeraGrid'den değil
      (VeraGrid bu dönüşümü yapmıyor).
    - `compute_slack_distribution` formülü (oranlı P dağıtımı) matematiksel olarak yeterince
      basittir ki **yeniden türetilebilir**; kopyalama gerekmez.

11. **Sonuç olarak en yüksek değer üç iş, hepsi küçük ve hepsi kanıta dayalı:**
    P0-1 (faz kaydırması) · P0-2 (sıralama + pivot) · P0-3 (iki hata düzeltmesi).
    Üçü birlikte, ölçülen `busVpu` bias (−0,0155 pu), 400 kV hat P MAE (31,555 MW) ve
    bara açı MAE (1,3351°) hatalarının kaynaklarını doğrudan hedefler; **hiçbiri
    production kodunun yeniden yazılmasını gerektirmez** ve **hiçbiri doğrulanmamış bir
    varsayıma dayanmaz.**

---

*Rapor sonu. Bu dosya yalnız analiz amaçlıdır; production kod değiştirilmemiştir.*
