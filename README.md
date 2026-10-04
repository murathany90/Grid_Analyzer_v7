# Grid Analyzer

Grid Analyzer, DIgSILENT PowerFactory DGS JSON/ZIP modellerini tarayıcı içinde içe aktaran, kanonik bir elektrik şebekesi modeli oluşturan ve envanter, senaryo, harita, tek-hat şeması, Full AC / Fast AC / DC analizleri, N-1 taraması ve PowerFactory karşılaştırması sağlayan istemci-taraflı bir şebeke analiz uygulamasıdır.

> **Önemli:** Grid Analyzer sonuçları ölçüm değildir; verilen model, kaynak parametreleri, çalışma durumu ve seçilen hesaplama ayarlarından türetilen sayısal model sonuçlarıdır.

- Uygulama sürümü: **8.2.5**
- Hesap motoru: **`BrowserJsEngine`**
- Full AC çözüm: klasik Newton–Raphson güç akışı
- Büyük lineer sistem çözümü: **KLU/WASM sparse direct**
- Çalışma biçimi: tarayıcı içi / offline-capable
- Ana referans: **DIgSILENT PowerFactory 24.0.7.1**
- Kanonik doğrulama modeli: **`20261001_1500_SN4_TR0`**
- Q/V parity recovery branch: **`codex/pf-qv-parity-recovery`**
- Q/V recovery Phase 1 reference commit: **`6c0dea78ef7ccd6a16588f79274be0cdb7d4b483`**
- Historical release manifest: `docs/validation/v8.2.5-release.json`

Bu README yalnız kullanım kılavuzu değildir. Aynı zamanda uygulamanın **model hafızası / teknik doğruluk kaydıdır**. Aşağıdaki “CONFIRMED / PARTIAL / UNSUPPORTED” ayrımı korunmalıdır; doğrulanmış PowerFactory semantiği daha sonra yeniden tahmin edilmemelidir.

---

# 1. Durum özeti

## 1.1 Historical 8.2.5 release baseline

8.2.5 release manifestindeki historical Full AC PowerFactory KPI’ları:

| KPI | Normalize hata |
| --- | ---: |
| Hat P | 0.879454489 % |
| Hat Q | 45.961722931 % |
| Trafo P | 0.721830436 % |
| Trafo Q | 47.615779757 % |
| Bara gerilimi | 0.768447838 % |
| Referans-hizalı açı | 0.825548679 % |

Historical station-controller durumu:

```text
Toplam aktif controller                     366
SATISFIED                                    27
SATURATED_QMAX                                5
SATURATED_QMIN                               10
CONTROL_RESIDUAL_AFTER_FINAL_BALANCE        101
UNSUPPORTED_DROOP                           223
```

Historical profile yalnız zero-droop Station Controller çözüyordu.

## 1.2 Q/V parity recovery Phase 1 — reference state

Commit:

```text
6c0dea78ef7ccd6a16588f79274be0cdb7d4b483
```

ile default parity profile artık doğrulanmış canonical droop controller profilini de çözer.

### Canonical SN4 KPI

| KPI | 941c9867 başlangıç | 6c0dea78 Phase 1 |
| --- | ---: | ---: |
| Hat P | 0.8894 % | **0.8232 %** |
| Hat Q | 45.8163 % | **36.9333 %** |
| Trafo P | 0.7228 % | **0.7192 %** |
| Trafo Q | 47.1932 % | **37.4250 %** |
| Bara V | 0.7583 % | **0.5856 %** |
| Açı | 0.8181 % | **0.8164 %** |

### Controller sonucu

**Zero-droop test modu**

```text
Residual                 105 -> 50
SATISFIED                      54
Q-limitte                      39
Droop unsupported             223
Süre                      ~3.08 s
Full NR / Newton           17 / 47
```

**Default droop parity modu**

```text
Initial residual              313
Final movable residual         89
SATISFIED                     234
Q-limitte                      27
NO_REACTIVE_HEADROOM            9
Q_LIMITS_UNAVAILABLE            7
REMOTE_CONTROL_CONFLICT         0
Süre                      ~4.11 s
Full NR / Newton           31 / 71
```

Residual azalışı:

```text
313 -> 89  = %71.6 improvement
```

### Generator Q MAE

| Grup | Önce | Current |
| --- | ---: | ---: |
| Station-controller dışı | ~4e-9 MVAr | **~4e-9 MVAr** |
| Zero-droop üyeleri | 23.795 MVAr | **23.075 MVAr** |
| Droop üyeleri | 6.343 MVAr | **1.996 MVAr** |

Bu tablo mevcut ana doğruluk problemini açıkça gösterir:

- aktif güç tarafı zaten güçlüdür;
- station-controller dışı Q zaten PowerFactory ile sayısal hassasiyet seviyesindedir;
- kalan büyük Q farkı esas olarak **zero-droop çok üyeli controller dağılımı, residual çözümü ve Q-limit state machine** tarafındadır.

## 1.3 Q/V parity recovery Phase 2 — current branch candidate

Canonical SN4 ve `modelEquationTolerancePercent=0.20` ile ölçülen Phase 2 sonucu:

| KPI | Phase 1 | Phase 2 |
| --- | ---: | ---: |
| Hat P | 0.8232 % | **0.7978 %** |
| Hat Q | 36.9333 % | **31.8434 %** |
| Trafo P | 0.7192 % | 0.7200 % |
| Trafo Q | 37.4250 % | **30.1962 %** |
| Bara V | 0.5856 % | **0.5484 %** |
| Açı | 0.8164 % | 0.9098 % |

Movable residual **89 → 58** (53 zero-droop, 5 droop). Droop generator Q MAE
**1.996 → 1.666 MVAr**; zero-droop Q MAE **23.075 → 16.458 MVAr**.
Motor süresi yaklaşık **4.62 s**, 32 Full NR solve ve 73 Newton iterasyonudur.
Bounded objective 18 çağrının tamamında 80-sweep safety cap'e ulaştı;
projected KKT yakınsaması **0/18**. Bu nedenle Phase 2, hedeflenen <30 residual,
<30% hat/trafo Q ve <0.45% bara V düzeyine henüz ulaşmadı. Tolerans taramasında
0.10, 0.05 ve 0.02 daha kötü Q/V sonuçları verdi; varsayılan 0.20 korundu.

---

# 2. Kaynak veriler ve provenance

## 2.1 Desteklenen girişler

| Girdi | Amaç |
| --- | --- |
| DGS `.json` / `.zip` | Şebeke modeli |
| PF numeric `.csv` | PowerFactory sonuç karşılaştırması |
| PF ControlContext `.csv` | Load `i_scale`, controller membership, `cvqq` ve doğrulama alanları |
| Offline map assets | Türkiye haritası / coğrafi gösterim |

DGS’den içe alınan ana sınıflar:

```text
ElmTerm
ElmLne
ElmLnesec
TypLne
ElmTr2
TypTr2
ElmSym
ElmGenStat
ElmLod
ElmShnt
ElmScap
ElmVac
ElmXnet
ElmCoup
StaSwitch
StaCubic
ElmStactrl
IntQlim
ElmSite
```

## 2.2 Kimlik

Hesaplama ve doğrulamada:

```text
FID
electricalBusKey
```

otoritatif kimliktir.

`loc_name` yalnız sunum içindir; matching anahtarı değildir.

## 2.3 Kaynak referansları

Kanonik elemanlar `sourceRefs` ile DGS kaynağını korur.

Örnek:

```text
Generator.pDispatchMw  <- ElmSym/ElmGenStat.pgini
Generator.qDispatchMvar<- ElmSym/ElmGenStat.qgini
Line.rOhm/xOhm/bSiemens<- TypLne + dline / sections
Transformer r/x        <- TypTr2 strn/uktr/pcutr
Transformer g/b        <- TypTr2 pfe/curmg
Station participation  <- ElmStactrl.cvqq
```

Fiziksel modele giren bir değerin mümkün olduğunca DGS/ControlContext provenance’ı bulunmalıdır.

---

# 3. Kanonik şebeke modeli

`CanonicalNetwork` şu ana elemanları taşır:

```text
baseMva
buses
lines
transformers
generators
loads
shunts
seriesCompensators
externalGrids
internationalConnections
switches
stationControllers
sites
boundaries
capabilities
diagnostics
loadFlowOptionsRaw
```

## 3.1 Bara

Temel alanlar:

```text
id / FID
name
vnKv
parentId
inService
siteIds
```

Elektriksel topoloji fiziksel `ElmTerm` satırlarının, kapalı switch/cubicle bağlantılarının ve equipment uçlarının çözülmesi ile oluşturulur.

## 3.2 Hat

Kanonik alanlar:

```text
from
to
vnKv
lengthKm
rOhm
xOhm
bSiemens
ratingMva
sections
coordinates
capacity metadata
```

### DGS -> fiziksel hat

Her bölüm için:

```text
R = rline * length
X = xline * length
B = bline * 1e-6 * length
```

Bütün `ElmLnesec` parçaları seri olarak toplanır:

```text
Rtotal = sum(Rsection)
Xtotal = sum(Xsection)
Btotal = sum(Bsection)
```

Nominal apparent-power rating:

```text
S ≈ sqrt(3) * Vn_kV * I_kA
```

section’lar varsa en kısıtlayıcı rating kullanılır.

### Sistem p.u. dönüşümü

```text
Zbase = Vbase_kV^2 / Sbase_MVA

rpu = R_ohm / Zbase
xpu = X_ohm / Zbase
bpu = B_siemens * Zbase
```

### Hat π modeli

```text
z = r + jx
y = 1/z
yc = j*bch/2

If = (y + yc) Vf - y Vt
It = (y + yc) Vt - y Vf

Sf = Sbase * Vf * conj(If)
St = Sbase * Vt * conj(It)
```

Sonuçlar:

```text
Pfrom = Re(Sf)
Qfrom = Im(Sf)
Pto   = Re(St)
Qto   = Im(St)

Ploss = Pfrom + Pto
Qloss = Qfrom + Qto
```

Akım:

```text
I_A = |S_MVA| * 1000 / (sqrt(3) * V_kV)
```

Loading:

```text
loading_% = max(|Sf|,|St|) / ratingMva * 100
```

---

# 4. İki sargılı transformatör

Kanonik alanlar:

```text
from / HV
to / LV
vnKv
lvKv
rPu
xPu
tap
phase
ratingMva
tapPosition
gPu
bPu
```

## 4.1 Seri eşdeğer

Tip gücü:

```text
Sn = strn [MVA]
```

Copper loss:

```text
r_own_pu = pcutr_kW / (1000 * Sn_MVA)
```

Short-circuit voltage:

```text
|z_own| = uktr_percent / 100
```

Reactance:

```text
x_own = sqrt(max(0, |z_own|^2 - r_own^2))
```

System base dönüşümü:

```text
r_system = r_own * Sbase / Sn
x_system = x_own * Sbase / Sn
```

Current implementation `Sbase = 100 MVA`.

## 4.2 Magnetizing branch

No-load loss:

```text
g_own = pfe_kW / (1000 * Sn_MVA)
```

No-load current:

```text
|y0| = curmg_percent / 100
```

Magnetizing susceptance:

```text
b_own = -sqrt(max(0, |y0|^2 - g_own^2))
```

System-base scale:

```text
gPu = g_own * Sn/Sbase
bPu = b_own * Sn/Sbase
```

Magnetizing admittance HV/from tarafına eklenir ve branch from-terminal P/Q raporunda aynı shunt dikkate alınır.

## 4.3 Tap

Kaynak önceliği:

```text
ElmTr2.nntap
mTaps
TypTr2.ntpmn
TypTr2.nntap0
TypTr2.dutap
TypTr2.tap_side
TypTr2.utrn_h
TypTr2.utrn_l
```

`mTaps` mevcutsa gerçek tap-kV tercih edilir; yoksa `dutap` yüzdesi kullanılır.

Current canonical SN4 matched transformer setinde phase shift yoktur:

```text
phase = 0
```

Bu nedenle phase-shift eksikliği mevcut fixture Q/V farkının ana açıklaması değildir.

## 4.4 Genel off-nominal branch formu

Referans genel form:

```text
a  = tau * exp(j*phi)
y  = 1/(r+jx)
yc = j*bch/2
ym = gmag+j*bmag

Yff=(y+yc)/|a|^2 + ym
Yft=-y/conj(a)
Ytf=-y/a
Ytt=y+yc
```

---

# 5. Generator modeli

Desteklenen ana sınıflar:

```text
ElmSym
ElmGenStat
```

Kanonik alanlar:

```text
bus
pMw
qMvar
pDispatchMw
qDispatchMvar
vmSet
voltageControl
qMin
qMax
```

## 5.1 Dispatch

Canonical source dispatch:

```text
pDispatchMw = pgini
qDispatchMvar = qgini
```

Bu değerler immutable source dispatch olarak korunmalıdır.

Çözülmüş/final P veya Q bu alanların üzerine yazılmamalıdır.

## 5.2 Canonical SN4 aktif güç bulgusu — CONFIRMED

2084 eşleşen generator için PowerFactory:

```text
P_PF ≈ pgini
```

çok yüksek hassasiyetle sağlanır.

Dolayısıyla generator P’nin Station Controller parity çalışmasında yeniden ayarlanması gerekmez.

## 5.3 Station dışı Q — CONFIRMED

Station Controller sahibi olmayan generatorlarda:

```text
Q_PF ≈ qgini
```

sayısal hassasiyet seviyesindedir.

Bu grup regression guard olarak kullanılmalıdır.

---

# 6. Reactive capability / Q limits

Kaynak önceliği:

1. doğrudan:

```text
cQ_min
cQ_max
```

2. yoksa:

```text
pQlimType -> IntQlim
```

Current `IntQlim` yaklaşımı:

```text
cap_P
cap_Qmn
cap_Qmx
```

noktalarını source `pgini` üzerinde doğrusal interpolate eder.

Bu generic PowerFactory capability-curve parity’sinin tamamı değildir.

### CONFIRMED canonical kullanım

Canonical droop saturation örneklerinde current interpolation:

```text
Qmin(pgini) = Qmax(pgini) = 0
```

üretmiş ve PF Q sonucu da `0 MVAr` olmuştur.

Dolayısıyla bu subset için mevcut yaklaşım doğrudur.

### PARTIAL / TODO

Aşağıdakiler generic olarak tam doğrulanmış değildir:

```text
IntQlim inputmod
voltage-dependent capability curves
parallel-unit scale variants
runtime effective-limit attribute semantics
```

Bu alanlar kanıt olmadan fixture’a göre fit edilmemelidir.

---

# 7. Yük modeli

Kanonik:

```text
Pload = plini
Qload = qlini
```

Current Full AC load modeli:

```text
constant P
constant Q
```

Load voltage dependency şu anda uygulanmaz.

## 7.1 Distributed active balancing

ControlContext:

```text
ElmLod.i_scale
```

üzerinden adjustable-load eligibility sağlar.

PowerFactory canonical fixture’da aktif balancing sırasında:

```text
final Qload ≈ initial Qload
```

gözlenmiştir.

Bu nedenle current canonical P balancing:

```text
P değiştir
Q sabit bırak
```

davranışı evidence-backed’dir.

Generator P ile slack dağıtımı yapılmaz.

---

# 8. Şönt

`ElmShnt`:

```text
shtype=1 -> reactor
shtype=2 -> capacitor
```

Nominal Q:

```text
reactor   -> -abs(qrean)
capacitor -> +abs(qcapn)
```

Active steps:

```text
Qactive = Qnominal * ncapa/ncapx
```

System p.u.:

```text
bPu = Qactive / Sbase
gPu = 0
```

Automatic shunt control current canonical fixture’da PowerFactory tarafında kapalıdır.

---

# 9. Series compensator

`ElmScap` current canonical mapping:

```text
R = 0
X = -1/bcap
```

Bağlantı topolojide normal series branch olarak çözülür.

---

# 10. External grid / slack

`ElmXnet`:

```text
pgini
qgini
usetp
Pmin/Pmax
cQ_min/cQ_max
bustp
mode_inp
```

Canonical SN4 reference:

```text
SL1
P ≈ 0 MW
Q ≈ -500 MVAr
state = QMIN_LIMITED
V ≈ 1.01405448 pu
```

Current solver reference Q limitini uygular.

Bu davranış PowerFactory referansıyla uyumludur ve Station Controller çalışmasında değiştirilmemelidir.

---

# 11. Full AC güç akışı

## 11.1 Kompleks form

Her bara:

```text
Vi = |Vi| * exp(j*theta_i)

Ii = sum_j(Yij * Vj)

Si = Vi * conj(Ii)
   = Pi + jQi
```

## 11.2 P/Q denklemleri

```text
Pi = |Vi| sum_j |Vj| [
       Gij*cos(theta_i-theta_j)
     + Bij*sin(theta_i-theta_j)
     ]

Qi = |Vi| sum_j |Vj| [
       Gij*sin(theta_i-theta_j)
     - Bij*cos(theta_i-theta_j)
     ]
```

## 11.3 Mismatch

```text
dPi = Pspec_i - Pcalc_i
dQi = Qspec_i - Qcalc_i
```

Newton sistemi:

```text
J * dx = mismatch
```

Büyük sistemlerde KLU/WASM sparse direct factorization kullanılabilir.

## 11.4 Bara tipleri

### Slack / reference

```text
|V| specified
theta specified/reference
P,Q solved
```

### PV

```text
P specified
|V| specified
theta,Q solved
```

### PQ

```text
P specified
Q specified
|V|,theta solved
```

## 11.5 Q-limit transition

Current generic NR:

```text
PV -> PQ at Qmin/Qmax
```

Monotonic active set kullanır.

Current limitation:

```text
generic limited bus -> PV release UNSUPPORTED
repeated reactive-limit detection UNSUPPORTED
```

Bu açıkça raporlanmalıdır.

---

# 12. Gerilim

Sonuç:

```text
Vpu = |Vi|
VkV = Vpu * Vnom_kV
```

Station Controller remote voltage hedefleri p.u. kullanır.

Current controller equation tolerance parity profile’da:

```text
modelEquationTolerancePercent = 0.2
```

yani yaklaşık:

```text
|Vtarget - Vremote| <= 0.002 pu
```

SATISFIED kabul edilebilir.

Bu production toleransı unit fixture testlerinden daha gevşektir ve Q parity tuninginde dikkatle benchmark edilmelidir.

---

# 13. Açı

NR state:

```text
theta_i [radian]
```

UI/benchmark gerekirse dereceye:

```text
theta_deg = theta_rad * 180/pi
```

PowerFactory angle KPI doğrudan ham açı ile karşılaştırılmaz.

Her elektriksel ada için PF reference alignment uygulanır.

Primary KPI:

```text
abs(abs(GA_aligned) - abs(PF))
```

PF reference bus bulunmayan adalarda median offset fallback kullanılır ve bu durum diagnostic olarak raporlanır.

---

# 14. Station Controller model hafızası — CONFIRMED

Bu bölüm coding agentlar tarafından tekrar reverse-engineer edilmemelidir.

## 14.1 `i_ctrl`

```text
0 = Voltage Control
1 = Reactive Power Control
2 = Power Factor Control
3 = tan(phi) Control
```

## 14.2 `i_phase`

```text
0 = Positive Sequence
1 = Average
2 = a
3 = b
4 = c
5 = a-b
6 = b-c
7 = c-a
```

## 14.3 `selBus`

```text
0 = User Selection
1 = Automatic Selection
```

## 14.4 `uset_mode`

```text
0 = Station Controller setpoint
1 = bus target voltage
```

## 14.5 `imode`

```text
0 = Dispatched Active Power
1 = Rated Power
2 = Individual Reactive Power
3 = Maximise Reactive Reserve
4 = Voltage Setpoint Adaptation
```

## 14.6 `i_droop`

```text
0 = disabled
1 = enabled
```

## 14.7 `iopt_drp`

```text
0 = Droop %
1 = Droop MVAr/p.u.
2 = delta(V)-defined
```

## 14.8 `iQorient`

```text
0 = +Q
1 = -Q
```

## 14.9 `qu_char`

```text
0 = Fixed Q
1 = Q(V)
2 = Q(P)
```

## 14.10 `cosphi_char`

```text
0 = Fixed cosphi
1 = cosphi(P)
2 = cosphi(V)
```

## 14.11 `pf_recap`

```text
0 = inductive
1 = capacitive
```

## 14.12 `consQdisp`

Anlamı:

```text
Consider reactive power dispatch
```

SN5 semantic audit:

```text
359 / 359 active ElmStactrl
consQdisp = 1
```

---

# 15. Canonical Station Controller profili

SN5 semantic-test snapshot:

```text
active calculation-relevant ElmStactrl = 359
```

359/359:

```text
i_ctrl      = 0
i_phase     = 0
selBus      = 0
uset_mode   = 0
imode       = 0
consQdisp   = 1
iQorient    = 0
qu_char     = 0
cosphi_char = 0
pf_recap    = 0
iTrfCtrl    = 0
```

Droop:

```text
i_droop=0 -> 139
i_droop=1 -> 220
```

220/220:

```text
pQmeasClass = StaCubic
```

SN4 ayrı snapshot’tır:

```text
active controller = 366
zero-droop = 143
droop = 223
```

SN4 ve SN5 sayıları karıştırılmamalıdır.

---

# 16. Reactive dispatch / participation — CONFIRMED

PowerFactory canonical controller denklemi:

```text
Qi = Qdispatch_i + Ki * dQ_sco
```

Canonical profile:

```text
Qdispatch_i = qgini_i
```

`imode=0`:

```text
Ki = cvqq_i / 100
```

Observed canonical relation:

```text
cvqq_i/100 == pgini_i / sum(pgini)
```

floating-point hassasiyetindedir.

### Kural

Participation hiçbir zaman active balancing sonrasında değişmiş final generator P’den türetilmemelidir.

Öncelik:

```text
source cvqq varsa -> cvqq
yoksa imode=0 -> immutable source pDispatchMw
```

---

# 17. Q-limit + Station Controller — CONFIRMED observed behavior

Controlled PowerFactory sweep:

```text
free member
-> Qmin/Qmax
-> clamp
-> remaining controller delta diğer movable üyelere yeniden dağıtılır
-> yön tersine döndüğünde limited member tekrar movable olabilir
```

Ölçülen profile:

```text
ALPASLAN1 HES KONTROL
GR-2 / GR-3 / GR-4
```

Bir üye Qmin’e tam oturmuş; residual diğer üyelere dağıtılmış; setpoint geri çevrilince üye tekrar interior duruma dönmüştür.

### Important distinction

Station Controller allocation tarafında directional re-entry desteklenmektedir.

Ancak generic NR bus-level PV→PQ active set hâlâ monotonic’tir.

Bu iki mekanizma aynı şey değildir.

---

# 18. Droop — CONFIRMED

## 18.1 Denklem

```text
Qdroop = Srated * 100 / ddroop

Vtarget = usetp + Qmeas / Qdroop
```

`ddroop` signed’dır.

Canonical gözlenen aileler:

```text
-2 %
-4 %
-5 %
-6 %
-7 %
```

`abs(ddroop)` kullanılmamalıdır.

## 18.2 Canonical pQmeas topolojisi

SN4:

```text
223/223 droop controller:
- 1 active ElmGenStat
- pQmeas = StaCubic
- StaCubic.obj_id = aynı ElmGenStat
- pQmeas = generator bus1 cubicle
- finite Srated
- finite nonzero ddroop
```

Dolayısıyla canonical profile:

```text
Qmeas = generator bus1 Q
```

## 18.3 Population validation

Remote PF voltage bulunabilen 219 controller üzerinde:

```text
Vcalc = usetp + Q_PF/(Srated*100/ddroop)
```

kontrolünde:

```text
210 -> <= 1e-6 pu match
9   -> Q=0 capability-limit saturation
```

Bu sonuç canonical droop denklemini population seviyesinde doğrular.

## 18.4 Shared remote

SN4:

```text
223 droop controller
180 unique remote bus
39 shared-remote groups
82 controller shared remote kullanıyor
```

PowerFactory shared-remote controllerları geçerli biçimde çözer.

Sadece aynı remote bus’ı paylaşmak conflict nedeni değildir.

---

# 19. `iQorient` voltage-droop davranışı

Controlled testte:

```text
iQorient 0 -> 1
```

değişiminde:

```text
Qmeas değişmedi
generator Q değişmedi
remote controlled V değişmedi
```

Dolayısıyla canonical voltage-droop hedefinde:

```text
Qmeas *= orientation sign
```

uygulanmamalıdır.

Bu sonuç Q-control / PF-control / tanphi-control modlarına genellenmemelidir.

---

# 20. Current Station Controller numerical method

Current recovery candidate:

- source `pgini/qgini` dispatch’ı korur;
- `cvqq` contribution’ı korur;
- controller-wide common Q increment uygular;
- zero-droop ve self-cubicle single-unit droop destekler;
- shared-remote droop controllerları coupled system içinde çözer;
- bounded coupled Q objective kullanır;
- droop residual derivative içine direct slope ekler;
- final P correction sonrasında warm Q/V coordination uygular.

## 20.1 Droop residual

```text
r_i = uset_i + Q_i/Qdroop_i - Vremote_i
```

Self-measured single unit için:

```text
dr_i/dQ_j
= delta_ij/Qdroop_i
- dVremote_i/dQ_j
```

Proposal convention:

```text
r_new ≈ r_old - M*dQ
```

ise:

```text
M_ij
= dVremote_i/dQ_j
- delta_ij/Qdroop_i
```

## 20.2 Current known numerical limitation

Bounded controller optimizer büyük sistemde halen sınırlı sweep sayısı kullanabilir.

Ayrıca participation column bir yöndeki active set ile kurulup çözüm ters yönlü `dQ` üretebilir.

Özellikle multi-unit zero-droop controllerlar için:

```text
+Q active set != -Q active set
```

olabilir.

Phase 2 şu üç mekanizmayı uyguladı:

```text
convergence/KKT driven bounded solve
direction-consistent participation rebuild
stagnated subset continuation
```

Kalan öncelik bounded objective'in canonical çoklu kontrol sisteminde KKT
yakınsamasını sağlamaktır.

---

# 21. Current residual interpretation

Default droop mode current:

```text
58 movable controller residual (53 zero-droop, 5 droop)
```

Phase 1'deki 89 residual'ın tamamı station solve tamamlanmadan oluşuyordu;
final P correction ana üretici değildi. Phase 2'de kalan 58 için bounded solve
KKT yakınsaması hâlâ doğrulanmadı.

Dolayısıyla current next focus:

```text
controller numerical convergence
```

olmalı; load-P balance veya branch physics değil.

---

# 22. PowerFactory parity KPI

Primary scorer:

```text
src/analysis/validation/pf-kpi.ts
```

Yalnız ≥66 kV population.

Her observation için:

```text
error_i = abs(abs(GA_i) - abs(PF_i))

absoluteAverage =
sum(error_i)/N

normalizedPercent =
100 * sum(error_i) / sum(abs(PF_i))
```

Primary KPI:

```text
Line P
Line Q
Transformer P
Transformer Q
Bus V
Reference-aligned angle
```

Secondary diagnostics:

```text
signed P error
signed Q error
signed aligned-angle error
sign disagreement
p95
max
```

MAPE primary KPI değildir.

---

# 23. Q parity teşhis metrikleri

Station-control düzeltmesinden sonra kalan Q farkını ayırmak için şu metrikler kullanılmalıdır.

## 23.1 Controller total Q error

```text
E_total_Q =
abs(
  sum(Q_GA_members)
  -
  sum(Q_PF_members)
)
```

## 23.2 Member distribution error

```text
E_member =
sum(abs(Q_GA_i-Q_PF_i))
```

Total-Q doğru fakat member distribution yanlışsa, farklı generator bus’larına yanlış Q verilmiş olabilir ve line/trafo Q akışları yine bozulur.

## 23.3 Branch reactive loss attribution

```text
dQf = Qf_GA - Qf_PF
dQt = Qt_GA - Qt_PF

dQloss =
(Qf_GA + Qt_GA)
-
(Qf_PF + Qt_PF)
```

Yorum:

```text
Qloss yakın, terminal Q uzak
-> injection/control distribution problem

line Qloss sistematik yanlış
-> line B / length / pi convention

trafo Qloss sistematik yanlış
-> magnetizing / tap / base conversion
```

Branch modeli ancak bu attribution sonrasında değiştirilmelidir.

---

# 24. Full AC convergence / diagnostics

Tek “converged” bayrağı yeterli değildir.

Ayrı durumlar:

```text
NR_CONVERGED / NR_NOT_CONVERGED

ACTIVE_BALANCE_CONVERGED
ACTIVE_BALANCE_PARTIAL

STATION_CONTROL_CONVERGED
STATION_CONTROL_PARTIAL

COMPARABLE
NOT_FULLY_COMPARABLE
```

Work counters:

```text
Newton iterations
full NR solves
Q-limit rounds
active-balance corrections
station-control rounds
KLU factorizations
final balance corrections
```

---

# 25. Full AC settings

Parity profile default / effective settings:

| Setting | Değer | Anlam |
| --- | ---: | --- |
| `maxInnerIterations` | 100 | NR solve başına maksimum iterasyon |
| `maxQLimitRounds` | 8 | Q active-set round |
| `maxActiveBalanceCorrections` | 8 | P balance correction |
| `maxFinalActiveBalanceCorrections` | profile setting | final P correction |
| `maxStationControlCorrections` | 16 | Station-controller outer correction |
| `maxOuterIterations` | 50 | genel outer budget |
| `nodalToleranceKva` | 5 | P/Q mismatch toleransı |
| `modelEquationTolerancePercent` | 0.2 | Station controller V residual toleransı |
| `maxNoImprovementIterations` | 20 | NR stagnation guard |
| `qLimitToleranceMvar` | 0.02 | PV->limited band |

Hidden cap kullanılmamalıdır; actual effective settings diagnostic/provenance’da gösterilmelidir.

---

# 26. Fast AC

Fast AC:

```text
>= configured minVoltageKv
default 66 kV
```

Reduced network kullanır.

Amaç:

- daha hızlı approximate P/Q/V;
- büyük modeli hızlı inceleme;
- Full AC öncesi screening.

State:

```text
PARTIAL
```

Q ve control fidelity Full AC kadar iddialı değildir.

Fast AC sonucu PowerFactory parity sonucu gibi sunulmamalıdır.

---

# 27. DC power flow

DC çözüm:

```text
P ve angle
```

odaklıdır.

Temel varsayımlar:

```text
|V| ≈ 1 pu
small angle differences
R << X
Q ignored
voltage magnitude not solved
```

Yaklaşık branch aktif güç:

```text
Pij ≈ (theta_i-theta_j) / x_ij
```

network form:

```text
B' * theta = P
```

DC sonuçlarında:

```text
Q = unavailable
V magnitude = unavailable
```

olmalıdır.

---

# 28. N-1

Current N-1:

```text
REDUCED_GE66_DC_P_ONLY
```

State:

```text
PARTIAL
```

## 28.1 Scope

Contingency candidates:

```text
in-service line
in-service 2-winding transformer
reduced >=66 kV network
```

Her outage:

1. ilgili branch devre dışı bırakılır;
2. reduced DC topology çözülür;
3. islanding kontrol edilir;
4. aktif güç flow etkisi tahmin edilir;
5. loading / severity sıralaması oluşturulur.

## 28.2 Current limitation

Current N-1:

```text
reactive power çözmez
voltage magnitude çözmez
station controller çözmez
Q-limit çözmez
Full AC security doğrulamaz
```

Bu nedenle:

```text
SCREENED_NO_VIOLATION
```

ifadesi:

```text
AC secure
```

anlamına gelmez.

## 28.3 Önerilen gelecekteki Full AC N-1

İkinci aşama:

```text
DC screening
-> top K / risky contingencies
-> warm-start Full AC verification
```

Her Full AC contingency için raporlanması gerekenler:

```text
NR convergence
islanding
bus V min/max
line/trafo loading
generator Q limits
SL1 state
station-controller residual
reactive reserve
P/Q losses
severity score
```

Önerilen hybrid yaklaşım bütün N-1’leri Full AC çözmek yerine performansı korur.

---

# 29. Senaryo / topology

Scenario overlay elemanları:

```text
equipment in/out of service
switch state
load/generation changes
```

üzerinden effective network üretir.

Her hesap:

```text
modelHash
scenarioHash
analysisSettingsHash
engine version
```

provenance’ına sahip olmalıdır.

---

# 30. Harita ve tek-hat şeması

Uygulama:

- coğrafi site/hat gösterimi;
- voltage filtering;
- site grouping;
- network inventory;
- electrical single-line diagram;
- analysis result overlay

sağlar.

Harita/SLD fiziksel solver kimliği yerine presentation katmanıdır.

Elektriksel eşlemede FID/electricalBusKey kullanılmalıdır.

---

# 31. Canonical fixture facts — application memory

```text
Model:
20261001_1500_SN4_TR0

Study:
2026-10-01 15:00

PowerFactory:
24.0.7.1
```

Kanonik önemli sayılar:

```text
relevant loads                 1986
active station controllers      366
controller memberships          604
droop controllers               223
zero-droop controllers          143
PF reference grid               SL1
phase-shifting trafos           yok
automatic transformer tap       OFF
automatic shunt                 OFF
load voltage dependency         OFF
line temperature correction     OFF
```

Generator population Q teşhisi:

```text
non-station generator        1614
zero-droop station members    247
droop station members         223
```

Bu bilgiler fixture’a özel hardcoded coefficient üretmek için değil, regression/parity teşhisi için kullanılmalıdır.

---

# 32. Source-truth / anti-fitting ilkesi

Aşağıdakiler yasaktır:

- PF sonuç CSV’sine göre gizli coefficient fit etmek;
- belirli FID için hardcoded düzeltme;
- KPI düşsün diye R/X/B değiştirmek;
- canonical fixture’a özel Q offset eklemek;
- unsupported profile’ı sessizce approximate etmek.

Her numerik iyileştirme şu üç kaynaktan en az birine dayanmalıdır:

1. DGS/ControlContext source field;
2. PowerFactory resmi denklem/semantik;
3. controlled PF experiment / population-level validation.

---

# 33. Known supported / partial / unsupported

| Özellik | Durum | Not |
| --- | --- | --- |
| DGS JSON/ZIP | VERIFIED | local import |
| Full AC NR | VERIFIED | multi-island |
| KLU/WASM | VERIFIED | large sparse systems |
| PV/PQ | VERIFIED | |
| Q-limit clamp | VERIFIED | |
| Generic Q-limit release | UNSUPPORTED | bus-level monotonic active set |
| Distributed P balancing | PARTIAL/verified canonical profile | adjustable loads via `i_scale` |
| Station zero-droop | PARTIAL | bounded coupled solve |
| Station droop | PARTIAL, canonical-supported | self-cubicle single-unit canonical profile |
| Shared-remote droop | SUPPORTED canonical | conflict değildir |
| Generic non-self pQmeas | UNSUPPORTED/PARTIAL | |
| Generic `i_ctrl=1..3` | UNSUPPORTED | |
| Generic `imode=1..4` | UNSUPPORTED | |
| Automatic tap | UNSUPPORTED | PF reference fixture’da OFF |
| Automatic shunt | UNSUPPORTED | fixture’da OFF |
| Load voltage dependency | UNSUPPORTED | fixture’da OFF |
| Active power limits | UNSUPPORTED | |
| Feeder scaling | UNSUPPORTED | |
| Interchange schedule | UNSUPPORTED | |
| Line temperature correction | UNSUPPORTED | fixture’da OFF |
| Fast AC | PARTIAL | approximate |
| DC | VERIFIED for P/angle | Q/V yok |
| Reduced DC N-1 | PARTIAL | P-only |
| Full AC N-1 verification | UNSUPPORTED | recommended roadmap |
| Short circuit | out of current scope | |
| OPF | out of current scope | |

---

# 34. Current highest-priority technical debt

## P0 — controller optimizer convergence

Current remaining:

```text
58 movable residual
```

İlk hedef:

```text
<30
```

Sonraki adım:

- 80-sweep cap'e ulaşan canonical objective'lerde KKT violation nedenini teşhis et;
- matrix conditioning, active bounds ve direction-dependent kolonları ayrıştır;
- yakınsama doğrulanmadan safety cap sonucunu optimal kabul etme.

## P0 — direction-consistent active participation

Multi-unit controller:

```text
+Q active set
!=
-Q active set
```

olabilir.

Coupled solution `dQ` işareti initial column direction’ından farklıysa participation
column Phase 2'de en çok üç kez yeniden kuruluyor. Canonical 0.20 koşusunda 18
direction rebuild görüldü; tutarsız son kolon raporlanmadı.

## P0 — stagnation

Tek bir global proposal başarısız olduğunda tüm pending controllerları bırakma
davranışı Phase 2'de kaldırıldı. Yeniden duyarlılık hesabı ve alt küme devamı
uygulandı; canonical 0.20 koşusunda stagnated subset sayısı sıfırdı.

Uygulanan retry sırası:

```text
trust shrink
-> refresh sensitivity
-> rebuild direction
-> retry
-> isolate stationary subset
-> continue movable subset
```

## P1 — zero-droop Q allocation parity

Current:

```text
zero-droop Q MAE = 16.458 MVAr
```

Hedef teşhis:

```text
controller total Q error
vs
member distribution error
```

## P1 — Q-limit parity

Current default droop:

```text
33 saturated
9 zero headroom
7 Q limits unavailable
```

27 saturated controller PF final state ile karşılaştırılmalıdır.

7 unavailable limit için:

- DGS gerçekten eksik mi?
- `IntQlim` importer path kaçırıyor mu?
- source class farklı mı?

tespit edilmelidir.

## P2 — branch reactive attribution

Controller numerics düzeldikten sonra:

```text
dQf
dQt
dQloss
```

ile line/trafo physics ayrıştırılmalıdır.

---

# 35. Expected Q/V improvement bands — engineering estimate

Bunlar garanti değildir; current ölçülen response’dan çıkarılan mühendislik hedef bantlarıdır.

Current:

```text
Line Q   31.84 %
Trafo Q  30.20 %
Bus V     0.548 %
```

Yalnız movable residual solver tamamlanırsa olası band:

```text
Line Q   ~28–31 %
Trafo Q  ~27–30 %
Bus V    ~0.43–0.52 %
```

Zero-droop allocation + correct Q active set ile:

```text
Line Q   ~20–28 %
Trafo Q  ~20–28 %
Bus V    ~0.30–0.45 %
```

Q-limit parity / missing limits sonrası:

```text
Line/Trafo Q ~15–25 %
```

Branch-Q attribution yeni gerçek model eksiği gösterirse daha ileri kazanım mümkündür.

`<10%` şu aşamada vaat edilmemelidir.

---

# 36. Recommended next acceptance targets

Bir sonraki solver milestone için:

```text
control residual        58 -> <30
droop generator Q MAE 1.666 -> <1.0 MVAr
zero-droop Q MAE      16.458 -> <15 MVAr
line Q                31.84% -> <30%
transformer Q         30.20% -> <30%
bus V                  0.548% -> <0.45%
runtime                        <10 s preferred
runtime hard gate              <15 s
```

P regression guard:

```text
Line P     ~0.80%
Trafo P    ~0.72%
```

anlamlı biçimde bozulmamalıdır.

Station dışı generator Q:

```text
~numerical precision
```

kalmalıdır.

---

# 37. Performance

Hard portable gate:

```text
<= 15,000 ms
```

Current recovery candidate:

```text
~4.62 s engine time (0.20 tolerance phase gate)
32 Full NR
73 Newton iterations
```

Optimizasyon ilkeleri:

- Ybus reuse;
- warm start;
- layout cache;
- sensitivity reuse;
- sparse factorization reuse mümkünse;
- gereksiz full NR tekrarından kaçın;
- accuracy bozan controller-count threshold kullanma.

---

# 38. Build / test

```powershell
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run build:portable
```

Numerik geliştirme sırasında ekonomik test döngüsü:

1. ilgili unit tests;
2. anlamlı phase sonunda bir canonical benchmark;
3. final candidate’da full suite;
4. committed portable üzerinde final benchmark.

Her küçük editte bütün benchmark matrix’i çalıştırılmamalıdır.

---

# 39. Code map

Ana model:

```text
src/domain/model/network.ts
```

DGS import:

```text
src/importers/dgs/canonical.ts
```

ControlContext:

```text
src/analysis/validation/powerfactory-control-context.ts
```

Full AC preparation:

```text
src/analysis/power-flow/preparation.ts
```

Ybus:

```text
src/analysis/power-flow/js/ybus.ts
```

Jacobian:

```text
src/analysis/power-flow/js/jacobian.ts
```

Newton:

```text
src/analysis/power-flow/js/newton.ts
```

Station participation:

```text
src/analysis/power-flow/station-participation.ts
```

Station control:

```text
src/analysis/power-flow/station-controls-v73.ts
```

Result mapping:

```text
src/analysis/power-flow/results.ts
```

Browser engine:

```text
src/analysis/api/browser-js-engine.ts
```

PF KPI:

```text
src/analysis/validation/pf-kpi.ts
```

Canonical parity tooling:

```text
tools/sn4-parity.ts
tools/pf-kpi.ts
```

Reduced / Fast AC:

```text
src/analysis/fast-ac/
```

DC:

```text
src/analysis/dc/
```

---

# 40. Uygulama hafızası — tekrar araştırılmaması gerekenler

Aşağıdakiler artık closed knowledge’dır:

```text
i_ctrl enum
i_phase enum
selBus enum
uset_mode enum
imode enum
i_droop enum
iopt_drp enum
iQorient enum
qu_char enum
cosphi_char enum
pf_recap enum
consQdisp meaning

canonical Qdispatch = qgini
canonical imode=0 participation = cvqq / dispatched pgini
signed ddroop
Qdroop = Srated*100/ddroop
Vtarget = usetp + Qmeas/Qdroop
canonical self-cubicle pQmeas = generator bus1 Q
shared-remote droop is valid
station clamp + redistribution + reverse-direction re-entry
non-station Q = qgini
generator P = pgini
```

Yeni agent bu maddeleri yeniden DPL/GUI ile araştırmamalıdır.

---

# 41. Açık kalan gerçek bilinmeyenler

Aşağıdakiler generic PowerFactory davranışı için hâlâ tamamlanmamıştır:

```text
generic i_ctrl=1 reactive-power control
generic i_ctrl=2 power-factor control
generic i_ctrl=3 tanphi control

generic imode=1 rated-power distribution
generic imode=2 individual Q
generic imode=3 maximise reactive reserve
generic imode=4 voltage-setpoint adaptation

uset_mode=1 generic runtime behavior

generic non-self-cubicle pQmeas branch/side semantics
other iopt_drp modes in current canonical population
generic IntQlim voltage-dependent/inputmod behavior

generic bus-level Q-limit release / hysteresis
automatic taps
automatic shunts
load voltage dependency
phase-shifting transformer support
Full AC N-1
```

Bunlar canonical Q/V branchini gereksiz yere bloke etmemelidir.

---

# 42. Tasarım ilkesi

Grid Analyzer’ın amacı:

```text
PowerFactory sonuç CSV’sini taklit etmek
```

değil,

```text
aynı kaynak model + aynı doğrulanmış kontrol semantiği
üzerinden bağımsız olarak benzer fiziksel çözümü üretmek
```

olmalıdır.

Bu nedenle doğru geliştirme sırası:

```text
source fidelity
-> equation fidelity
-> controller state-machine fidelity
-> numerical convergence
-> KPI attribution
-> yalnız kanıt varsa yeni physics
```

olmalıdır.

---

# 43. Current roadmap

## Phase A — remaining 58 residual

- residualları zero/droop olarak ayır;
- termination reason;
- bounded optimizer KKT convergence (canonical 0/18);
- direction rebuild sonuçlarını doğrula;
- stagnated subset continuation için daha güçlü integral test.

## Phase B — zero-droop Q fidelity

- controller total Q vs PF;
- member Q distribution vs PF;
- limit-state comparison.

## Phase C — reactive limit parity

- 33 saturated controller PF ile karşılaştır;
- 9 zero-headroom doğrula;
- 7 missing-limit importer/source analysis;
- gerekiyorsa generic release.

## Phase D — branch reactive attribution

- line Qloss;
- transformer Qloss;
- shunt contribution;
- only then branch physics.

## Phase E — Full AC N-1

- reduced DC pre-screen;
- selected contingency Full AC verification;
- voltage/Q/security severity.

---

# 44. Release / candidate ayrımı

Historical `8.2.5` release manifest mevcut validated release kaydıdır.

Phase 2 Q/V parity recovery candidate daha iyi Q/V sonucu üretmektedir fakat:

```text
58 movable residual
33 Q-limit state
9 zero-headroom
7 missing Q limits
```

nedeniyle hâlâ:

```text
PARTIAL
```

olarak değerlendirilmelidir.

Release manifest, branch benchmark ve portable provenance birbirine karıştırılmamalıdır.

---

# 45. Son söz

Mevcut teknik kanıt şu resmi desteklemektedir:

- temel AC ağ denklemleri güçlüdür;
- aktif güç ve açı iyi parity’dedir;
- uncontrolled Q doğru çalışmaktadır;
- canonical droop denklemi artık population seviyesinde doğrulanmıştır;
- Q/V parity’de ana remaining gap station-controller numerical convergence, zero-droop member distribution ve reactive-limit state parity’dir;
- branch physics ancak bu katmanlar düzeldikten sonra yeniden değerlendirilmelidir;
- uygulamanın tüm unsupported/partial durumları görünür kalmalıdır.

Bu README sonraki geliştirme agentları için teknik hafıza ve regression sözleşmesi olarak korunmalıdır.
