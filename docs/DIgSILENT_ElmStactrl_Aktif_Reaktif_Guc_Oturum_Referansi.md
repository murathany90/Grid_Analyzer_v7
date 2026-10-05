# DIgSILENT PowerFactory — ElmStactrl Aktif/Reaktif Güç ve Gerilim Kontrolü
## Oturum Görselleri + PowerFactory 2024 User Manual + Station Controller Technical Reference Birleşik Kaynak Notu

**Hazırlanma tarihi:** 4 Ekim 2026<br>
**Ana nesne:** `ElmStactrl` — Station Controller / Merkez Kontrolcüsü<br>
**Ana analiz:** AC Load Flow / Yük Akışı<br>
**İncelenen örnekler:** Akıncı HES Ardahan, Aybastı RES<br>
**Kaynak sürümü:** DIgSILENT PowerFactory 2024

---

## 1. Amaç ve kanıt düzeyi

Bu doküman, bu oturumdaki PowerFactory ekran görüntülerinden doğrudan okunabilen `ElmStactrl` ayarlarını; PowerFactory 2024 **User Manual** ve DIgSILENT **Technical Reference — Station Controller (ElmStactrl)** dokümanlarında açıklanan davranışla bir araya getirir.

Bilgiler üç sınıftadır:

1. **Görselden tespit edilen:** Ekranda görülen ayar, değer ve attribute tooltip'leri.
2. **DIgSILENT dokümanından doğrulanan:** User Manual veya Station Controller Technical Reference'ın açıkça desteklediği bilgiler.
3. **Hesaplanan/yorumlanan:** Görseldeki sayısal değerlerden, DIgSILENT formülleriyle yapılan hesap veya model denetimi.

Bu belge gerçek santral SCADA/AVR/PPC mantığının kendisini değil, PowerFactory yük akışındaki `ElmStactrl` modelini açıklar.

---

# 2. ElmStactrl nedir?

`ElmStactrl`, yük akışında bir veya birden fazla reaktif güç kaynağını istasyon düzeyinde koordine eden **Station Controller** nesnesidir.

DIgSILENT Technical Reference'a göre Station Controller:

- otomatik kontrol cihazlarını ve/veya operatör aksiyonunu yük akışında temsil eder,
- reaktif güç kaynaklarına etki eder,
- isteğe bağlı olarak kademe değiştiricili step-up transformatörlere de etki edebilir,
- belirli bir baradaki gerilim hedefini,
- bir cubicle/boundary üzerindeki reaktif güç akış hedefini,
- veya bir cubicle/boundary üzerindeki güç faktörü hedefini sağlamaya çalışır.

Geçerli reaktif güç kaynakları arasında synchronous machine, asynchronous machine, static generator, static var system (SVS) ve belirli kısıtlarla PWM converter bulunur.

---

# 3. Aktif güç P ve reaktif güç Q açısından temel mantık

## 3.1 Gerilim kontrolünde ana kontrol değişkeni Q'dur

Temel zincir:

\[
Q_i \rightarrow U_{\text{controlled bus}}
\]

Station Controller normal gerilim kontrolünde aktif gücü değiştirerek gerilim düzenlemez; bağlı kaynakların reaktif güçlerini koordine eder.

## 3.2 Aktif güç P'nin kullanıldığı yerler

Aktif güç şu durumlarda kritik girdidir:

- **Atanan Aktif Güce göre Q dağıtımı:** katkı \(P_{\text{dispatch}}\) ile orantılıdır.
- **Q(P):** \(Q_{set}=f(P)\).
- **cosφ(P):** \(\cos\varphi_{set}=f(P)\).
- **tanφ:** \(Q_{set}=\tan\varphi_{set}P\).
- **Sabit cosφ:** Q ihtiyacı P ve PF birlikte değerlendirilerek oluşur.

---

# 4. Ana kontrol modları — `i_ctrl`

| `i_ctrl` | GUI | Kontrol edilen büyüklük | Temel hedef |
|---:|---|---|---|
| 0 | Gerilim Kontrolü | Bara/terminal gerilimi \(U\) | \(U \rightarrow U_{set}\) |
| 1 | Reaktif Güç Kontrolü | Q akışı | \(Q \rightarrow Q_{set}\) veya Q karakteristiği |
| 2 | Güç Faktörü Kontrolü | \(\cos\varphi\) | \(\cos\varphi \rightarrow \cos\varphi_{set}\) |
| 3 | tan(φ) Kontrolü | \(Q/P\) oranı | \(Q_{set}=\tan\varphi_{set}P\) |

Bunlar eşzamanlı dört kontrol değildir; seçili `i_ctrl` Station Controller'ın ana load-flow kontrol modudur.

---

# 5. Gerilim Kontrolü

## 5.1 Faz seçimi — `i_phase`

Görsel tooltip'inde:

| `i_phase` | Seçim |
|---:|---|
| 0 | Poz.Bil. — pozitif bileşen |
| 1 | Ortalama |
| 2 | a |
| 3 | b |
| 4 | c |
| 5 | a-b |
| 6 | b-c |
| 7 | c-a |

Technical Reference'a göre faz seçimi özellikle **unbalanced load flow** için önemlidir.

## 5.2 Kontrollü bara seçimi — `selBus`

Görsel tooltip'i:

| `selBus` | Seçim |
|---:|---|
| 0 | Kullanıcı Seçimi |
| 1 | Otomatik Seçim |

### Kullanıcı Seçimi
Gerilimi kontrol edilecek terminal/barayı kullanıcı doğrudan seçer.

### Otomatik Seçim
PowerFactory makineler/static generator/SVS tarafından topolojiyi tarar, nominal gerilim seviyesini, açık şalter/kesicileri ve upstream busbar yapısını dikkate alır; gerekirse bir veya birden fazla kontrol grubu oluşturur. Uygun HV bara bulunamazsa yerel terminal ve yerel voltage setpoint kullanılabilir.

## 5.3 Kontrollü düğüm — `rembar`

Technical Reference:
- `rembar` = Controlled Busbar / `ElmTerm`

## 5.4 Ayar noktası kaynağı — `uset_mode`

Görsellerde:

| `uset_mode` | GUI |
|---:|---|
| 0 | Merkez Kontrolcüsü |
| 1 | bara hedef gerilimi |

**Merkez Kontrolcüsü:** referans Station Controller içindeki `usetp` değeridir.<br>
**bara hedef gerilimi:** target-node/bus target voltage bilgisi kullanılır.

## 5.5 Hedef düğüm — `cpCtrlNode`

Technical Reference:
- `cpCtrlNode` = Target Node

Akıncı ekranında:
- Kontrollü Düğüm: `ARDAHAN 154kV Standart\154 B-2`
- Hedef Düğüm: `HES ARDAHAN 154kV Standart\154 B-2`

İki terminalin gerçekten aynı elektriksel/eşpotansiyel bölgede olup olmadığı şebeke topolojisinden ayrıca doğrulanmalıdır.

---

# 6. Gerilim droop kontrolü

## 6.1 Droop etkinleştirme — `i_droop`

Görsellerde:
- Aybastı RES: etkin
- Akıncı HES ilk görüntü: kapalı
- Akıncı HES sonraki görüntü: etkin

## 6.2 Temel DIgSILENT denklemi

\[
u'_{setp}=u_{setp}+\frac{Q_{meas}}{Q_{droop}}
\]

Burada:
- \(u_{setp}\): temel voltage setpoint [p.u.]
- \(u'_{setp}\): droop dahil etkin setpoint [p.u.]
- \(Q_{meas}\): seçilen Q measurement point'teki Q [Mvar]
- \(Q_{droop}\): [Mvar/p.u.]

## 6.3 Droop tanım biçimi — `iopt_drp`

Görsel tooltip'i:

| `iopt_drp` | Tanım |
|---:|---|
| 0 | Düşüş (Droop) % |
| 1 | Düşüş (Droop) [Mvar/p.u.] |
| 2 | delta(V) tarafından tanımlı |

## 6.4 Yüzde droop dönüşümü

\[
Q_{droop}=S_{rated}\frac{100}{d_{droop}}
\]

- `Srated`: Anma Reaktif Gücü [Mvar]
- `ddroop`: Droop [%]

## 6.5 ΔV ile dönüşüm

\[
Q_{droop}=\frac{S_{rated}}{\Delta V}
\]

## 6.6 Q ölçüm noktası — `pQmeas`

`pQmeas`, droop için Q'nun ölçüldüğü `StaCubic` veya `ElmBoundary` noktasıdır.

Technical Reference:
- Q measurement point seçilmemişse \(Q_{meas}=0\) kabul edilir.
- Q-flow yönü ilgili kaynak/SVS yönüyle tutarlı olmalıdır.

---

# 7. Aybastı RES — görselden tespit edilen model

| Parametre | Değer |
|---|---|
| Nesne | `AYBASTI RES IBR TR-A KONTROL.ElmStactrl` |
| Kontrol Modu | Gerilim Kontrolü |
| Faz | Poz.Bil. |
| Bara seçimi | Kullanıcı Seçimi |
| Ayar Noktası | Merkez Kontrolcüsü |
| Kontrollü Düğüm | `AYBASTI RES 154kV Standart\154 B-1` |
| Gerilim Ayar Noktası | `1,057468 p.u.` |
| Droop | Etkin |
| Anma Reaktif Gücü | `11,5 Mvar` |
| Droop | `-4 %` |
| Q ölçüm yeri | `...AYBASTI RES OG-A Standart\TR-A\Unite 14026 Hucre` |

154 kV baza göre temel voltage setpoint:

\[
1.057468\times154\approx162.85\ \text{kV}
\]

Aybastı için:

\[
Q_{droop}=11.5\frac{100}{-4}=-287.5\ \text{Mvar/p.u.}
\]

Dolayısıyla:

\[
u'_{setp}=1.057468+\frac{Q_{meas}}{-287.5}
\]

Örnek — yalnızca seçilen cubicle'daki PowerFactory Q işaretinin pozitif yönü varsayımıyla:

| \(Q_{meas}\) | \(u'_{setp}\) | 154 kV karşılığı |
|---:|---:|---:|
| -11.5 Mvar | 1.097468 p.u. | ≈169.01 kV |
| 0 Mvar | 1.057468 p.u. | ≈162.85 kV |
| +11.5 Mvar | 1.017468 p.u. | ≈156.69 kV |

Bunlar **etkin referans değerleridir**; gerçek load-flow voltage result değildir.

Aybastı'da U kontrolü 154 kV `154 B-1` üzerinde, Q ölçümü ise OG-A/TR-A/ünite hücresindedir. Bu yapı `IBR TR-A KONTROL` nesne adıyla uyumludur; ancak tüm RES POI/PCC kontrolü amaçlanıyorsa Q measurement point'in tek trafo/ünite kolu mu yoksa toplam POI mi olması gerektiği model amacıyla doğrulanmalıdır.



---

# 8. Akıncı HES — ilk görülen gerilim kontrolü

Oturumun ilk Akıncı görüntüsünde:

| Parametre | Değer |
|---|---|
| Kontrol Modu | Gerilim Kontrolü |
| Faz | Poz.Bil. |
| Bara seçimi | Kullanıcı Seçimi |
| Kontrollü Düğüm | `ARDAHAN 154kV Standart\154 B-2` |
| Ayar Noktası | Merkez Kontrolcüsü |
| Gerilim Ayar Noktası | `1,043896 p.u.` |
| Droop | Kapalı |

154 kV baza göre:

\[
1.043896\times154\approx160.76\ \text{kV}
\]

Bu durumda temel hedef:

\[
U_{154B-2}\rightarrow1.043896\ \text{p.u.}
\]

olacak şekilde bağlı kaynakların Q değerlerini ayarlamaktır.

---

# 9. Akıncı HES — sonraki target-node + droop görünümü

Daha sonraki ekranda:

| Parametre | Görülen değer |
|---|---|
| Kontrol Modu | Gerilim Kontrolü |
| Bara seçimi | Kullanıcı Seçimi |
| Ayar Noktası | **bara hedef gerilimi** |
| Kontrollü Düğüm | `ARDAHAN 154kV Standart\154 B-2` |
| Hedef Düğüm | `HES ARDAHAN 154kV Standart\154 B-2` |
| Droop | Etkin |
| Anma Reaktif Gücü | `0 Mvar` |
| Droop | `0 %` |
| Q ölçüm yeri | boş |

Bu yapı ilk Akıncı konfigürasyonuyla aynı değildir.

## 9.1 Setpoint kaynağı değişmiştir

`Merkez Kontrolcüsü` yerine `bara hedef gerilimi` seçildiğinden, önceki `1.043896 p.u.` değerinin yeni durumda doğrudan aktif referans olduğu varsayılamaz.

## 9.2 Boş Q measurement point

Technical Reference'a göre `pQmeas` boşsa:

\[
Q_{meas}=0
\]

kabul edilir.

## 9.3 `Srated = 0` ve `ddroop = 0%`

Resmî yüzde-droop denklemi:

\[
Q_{droop}=S_{rated}\frac{100}{d_{droop}}
\]

olduğundan `0 Mvar / 0%` fiziksel olarak anlamlı bir droop eğimi tanımlamaz.

Güvenli teknik sonuç:

- droop checkbox etkin görünmektedir,
- Q measurement point boş olduğu için dokümana göre \(Q_{meas}=0\),
- fakat yüzde droop parametreleri anlamlı bir \(Q_{droop}\) üretmez,
- PowerFactory'ın bu sıfır-parametre kombinasyonunda kullandığı fallback/uyarı davranışı Output Window veya hesap protokolünden doğrulanmalıdır.

---

# 10. Reaktif Güç Kontrolü

Görselde:

| Parametre | Değer |
|---|---|
| Kontrol Modu | Reaktif Güç Kontrolü |
| Q-Kontrol | Sabit Q |
| Q Ayar noktası | `0 Mvar` |
| Oryantasyon | `+Q` |

Bu modda hedef:

\[
Q_{\text{control point}}\rightarrow Q_{set}
\]

şeklindedir.

`Qset = 0 Mvar` için seçilen control point'teki net Q akışı yaklaşık sıfırda tutulmaya çalışılır.

---

# 11. Q-control karakteristiği — `qu_char`

Görsel tooltip'i:

| `qu_char` | Q kontrolü |
|---:|---|
| 0 | Sabit Q |
| 1 | Q(V) Karakteristiği |
| 2 | Q(P) Karakteristiği |

## 11.1 Sabit Q

\[
Q=Q_{set}
\]

Kontrol yeri `StaCubic` veya `ElmBoundary` olabilir.

## 11.2 Q(V)

\[
Q_{set}=f(U)
\]

Technical Reference iki yapı tarif eder:

1. ayrı bir `IntQvcurve` ile,
2. ayrı Q(V)-Curve seçmeden Station Controller içindeki deadband/droop parametreleriyle.

İlgili parametreler:
- Control Q at
- Orientation
- Reference Node
- Rated Reactive Power
- Reference Voltage
- Q Setpoint
- Qmin / Qmax
- voltage deadband
- droop
- overexcited ve underexcited taraf için ayrı droop seçeneği

Deadband içinde Q setpoint korunabilir; voltage deadband dışına çıktığında Q setpoint voltage deviation ve droop'a göre değiştirilir.

## 11.3 Q(P)

\[
Q_{set}=f(P)
\]

Technical Reference'a göre:
- Q(P)-Curve üzerinden tanımlanır,
- pozitif ve negatif aktif güç için Q değerleri girilebilir,
- pump-storage gibi çift yönlü P uygulamalarında kullanılabilir,
- tanımlı P aralığı dışında lineer yaklaşım uygulanır,
- Qmin ve Qmax kontrol edilebilir Q aralığını sınırlar.

---

# 12. Q-control noktası — `p_cub`

Technical Reference:

- `p_cub` = Control Q at
- tip: `StaCubic`, `ElmBoundary`

Q, PF ve tanφ kontrolünde measurement/control point cubicle veya boundary'dir.

Bu nokta üretici terminaliyle aynı olmak zorunda değildir. Santral iç transformatör/kablo/şönt/kayıp etkileri nedeniyle POI/PCC Q değeri generator Q toplamından farklı olabilir.

---

# 13. Q orientation — `iQorient`

Görsel tooltip'i:

| `iQorient` | Yön |
|---:|---|
| 0 | +Q |
| 1 | -Q |

Technical Reference'a göre:

- **+Q:** controlled point'teki pozitif Q yönü generator in-feed Q yönüyle aynıysa
- **-Q:** ters yöndeyse

kullanılır.

Bu, “üretici reaktif üretiyor/tüketiyor” seçiminden çok işaret/orientasyon eşlemesidir.

---

# 14. Güç Faktörü Kontrolü

Oturum görselinde:

| Parametre | Değer |
|---|---|
| Kontrol Modu | Güç Faktörü Kontrolü |
| PF-Kontrol | Sabit cosphi |
| Güç Faktörü | `1,0` |
| end./kap. | `end.` |
| Oryantasyon | `+Q` |

Genel ilişki:

\[
Q=P\tan(\arccos(\cos\varphi))
\]

### cosφ = 1

\[
Q=0
\]

Dolayısıyla aynı control point ve tutarlı yön tanımında **Sabit cosφ = 1** ile **Sabit Q = 0 Mvar** ideal olarak çok benzer hedeflerdir.

---

# 15. PF karakteristiği — `cosphi_char`

Görsel tooltip'i:

| `cosphi_char` | Mod |
|---:|---|
| 0 | Sabit cosphi |
| 1 | cosphi(P)-Karakteristiği |
| 2 | cosphi(V)-Karakteristiği |

## 15.1 Sabit cosφ

\[
\cos\varphi=\cos\varphi_{set}
\]

P değiştikçe aynı PF'yi korumak için gerekli Q da değişir.

## 15.2 cosφ(P)

\[
\cos\varphi_{set}=f(P)
\]

Technical Reference:
- overexcited taraf: `p over`, `pf over`
- underexcited taraf: `p under`, `pf under`
- karakteristik pozitif aktif güç için tanımlanır
- negatif aktif güç için mirror edilir

## 15.3 cosφ(V)

\[
\cos\varphi_{set}=f(U)
\]

Technical Reference:
- `u over`, `pf over`
- `u under`, `pf under`
ile tanımlanır.

---

# 16. `pf_recap` — endüktif/kapasitif

Görsel tooltip'i:

| Değer | Anlam |
|---:|---|
| 0 | end. |
| 1 | kap. |

`cosφ=1` için Q sıfır olduğundan etkisi kaybolur; cosφ 1'in altına indiğinde önem kazanır.

---

# 17. tan(φ) kontrolü

Technical Reference:

\[
\boxed{q_{set}=\tan\varphi_{set}\cdot p_{ctrl}}
\]

Yani:

\[
\tan\varphi=\frac{Q}{P}
\]

- tanφ = 0 → Q = 0
- P arttıkça sabit tanφ için |Q| de artar

Kontrol noktası yine cubicle veya boundary'dir.

---

# 18. Reaktif Güç Dağıtımı — `imode`

Görsel tooltip'i:

| `imode` | GUI |
|---:|---|
| 0 | Atanan Aktif Güce göre |
| 1 | Anma Gücüne Göre |
| 2 | Bireysel Reaktif Güç |
| 3 | Reaktif Rezervi Maksimize Et |
| 4 | Gerilim Ayar Noktası Uyumu |

Bu bölüm Station Controller'ın talep ettiği Q değişiminin birden fazla kaynak arasında nasıl paylaştırılacağını belirler.

---

# 19. Atanan Aktif Güce göre Q dağıtımı

Technical Reference:

\[
K_{Qi}\propto P_{\text{dispatch},i}
\]

Hesapta kullanılan aktif güç `pgini` tabanlı dispatched active power'dır; doküman bunun:
- characteristics,
- wind-zone scaling,
- static generator için `scale0`
etkilerini içerdiğini belirtir.

Dokümana göre aşağıdakiler participation factor hesabına dahil edilmez:
- Load Flow generation scaling factor,
- secondary controller kaynaklı P adaptasyonu,
- primary-controlled load flow / inertia ile P değişimi,
- Load Flow balancing seçeneklerinin yaptığı P uyarlaması.

Örnek:

\[
P=[100,100,50,0]\ \text{MW}
\]

ise yaklaşık:

\[
K_Q=[40,40,20,0]\%
\]

Burada P kontrol edilen büyüklük değil, Q paylaşım ağırlığıdır.

---

# 20. Anma Gücüne göre

\[
K_{Qi}\propto S_{rated,i}
\]

Aynı MVA rating'e sahip dört kaynak yaklaşık eşit Q payı alır.

---

# 21. Bireysel Reaktif Güç

Kullanıcı katkı yüzdelerini doğrudan tanımlar.

Technical Reference bu oranların normalize edilerek toplamının %100 yapılacağını belirtir.

---

# 22. Reaktif Rezervi Maksimize Et

Technical Reference:

\[
Q_i=Q_{stat,i}
\]

şeklinde actual source Q'nun Station Controller tarafından hesaplandığını belirtir.

`Consider Reactive Power Limits` etkin olduğunda Q sınırına ulaşan kaynağın participation hesabından çıkarılabildiği açıklanır.

---

# 23. Gerilim Ayar Noktası Uyumu

Q doğrudan sabit yüzdelerle paylaşılmak yerine generator local voltage setpoint'leri değiştirilerek dağıtılır.

Technical Reference:
- local terminal voltage, `usetp + du` ile kontrol edilir,
- aynı local terminalde birden fazla generator için kısıt vardır,
- SVS için desteklenmez,
- `uspmin/uspmax` ve `Qmin/Qmax` sınırları kontrol edilir.

---

# 24. Reaktif dispatch'i dikkate alma — `consQdisp`

Oturum görüntüsünde checkbox işaretliydi:

**“Reaktif güç değerlerini dikkate al”**

Technical Reference'a göre açıkken:

\[
Q_i=Q_{\text{dispatch},i}+dQ_i
\]

\[
dQ_i=K_{Qi}\cdot dQ_{SCO}
\]

Kapalıyken:

\[
Q_i=dQ_i
\]

Burada \(dQ_{SCO}\), Station Controller'ın hedefi sağlamak için istediği ilave Q bileşenidir.



---

# 25. Oturumdaki 100/0/0/0 dağılımı

Görselde dört kaynak için:

| Kaynak | Reaktif Güç Oranı |
|---|---:|
| 1 | 100 % |
| 2 | 0 % |
| 3 | 0 % |
| 4 | 0 % |

Seçili yöntem **Atanan Aktif Güce göre** idi.

Bu contribution factor'lar load-flow'da kullanılıyorsa Station Controller'ın ek Q ihtiyacının tamamı birinci kaynağa, diğerlerine sıfır oranla gider.

Bu şu durumlarda normal olabilir:
- yalnızca ilk ünite dispatched active power taşıyorsa,
- diğerleri 0 MW dispatch'teyse,
- diğerleri out-of-service veya kontrol açısından kullanılamazsa.

Dört kaynak da aktif üretimdeyse kontrol edilmesi gerekenler:
- `pgini` / dispatched P
- in-service/out-of-service
- Station Controller üyeliği
- source scaling
- generator/static-generator control state
- varsa PWM converter restriction
- Load Flow Output Window mesajları

---

# 26. Q paylaşım denklemleri

Technical Reference, User Selection durumunda klasik katılım modları için:

### `Consider reactive power dispatch` açık

\[
Q_i=Q_{\text{dispatch},i}+dQ_i
\]

\[
dQ_i=K_{Qi}\cdot dQ_{SCO}
\]

### Kapalı

\[
Q_i=dQ_i
\]

Automatic Selection durumunda:

\[
Q_{ij}=Q_{\text{dispatch},ij}+dQ_{ij}
\]

\[
dQ_{ij}=K_{Qij}\cdot dQ_{SCO,i}
\]

`KQij`, ilgili controlling group içinde normalize edilir.

---

# 27. Q limitleri ve Station Controller

DIgSILENT Technical Reference'ta iki önemli ifade vardır:

1. **Maximise Reactive Reserve** bölümünde, `Consider Reactive Power Limits` etkinse Q sınırına ulaşan kaynağın reactive-power participation hesabından çıkarılabildiği belirtilir.
2. **Usage Hints / Individual Machines' Reactive Power Limits** bölümünde, controlled machines kendi reactive limits'lerine ulaştığında Station Controller'ın devre dışı kalabileceği belirtilir.

Bu nedenle Q-limit davranışı incelenirken:
- aktif distribution mode,
- hangi kaynakların limite ulaştığı,
- `Consider Reactive Power Limits`,
- Output Window protokol/uyarıları

birlikte kontrol edilmelidir.

---

# 28. Step-up transformer kontrolü

Station Controller isteğe bağlı olarak step-up transformer tap changer'larını kontrol mantığına dahil edebilir.

Technical Reference özet mantığı:
- HV busbar voltage generator Q ile,
- LV busbar voltage transformer tap ile
koordine edilebilir.

Flat-start / non-flat-start davranışı, Load Flow'daki **Automatic Tap Adjustment** ve transformatördeki **Automatic Tap Changing** ayarlarına bağlıdır.

Böyle bir durumda voltage control yalnızca generator Q dağıtımı değil, **generator Q + transformer tap koordinasyonu** olur.

---

# 29. PWM converter kısıtları

Technical Reference'a göre `ElmVsc` / `ElmVscmono` Station Controller'a dahil edilebilir; ancak:

- control mode `PWM-Phi` veya `Vdc-Phi` olmamalıdır,
- modulation `No Modulation` olmamalıdır,
- Station Controller dispatchable active power'a sahip olmayan PWM converter içeriyorsa **Acc. to Dispatched Active Power** reactive-power contribution modu kullanılamaz.

Bu, RES/IBR modellerinde P bazlı Q dağıtımını denetlerken önemlidir.

---

# 30. Akıncı HES — Q ve PF kontrol görsellerinin özeti

## 30.1 Reaktif Güç Kontrolü

Görsel:
- `i_ctrl = Reactive Power Control`
- `qu_char = 0 / Sabit Q`
- `qsetp = 0 Mvar`
- `iQorient = +Q`

Hedef:

\[
Q_{\text{selected cubicle/boundary}}\rightarrow0\ \text{Mvar}
\]

Bara gerilimi burada doğrudan setpoint değil, load-flow sonucudur.

## 30.2 Güç Faktörü Kontrolü

Görsel:
- `i_ctrl = Power Factor Control`
- `cosphi_char = 0 / Sabit cosphi`
- `pfsetp = 1.0`
- `pf_recap = end.`
- `iQorient = +Q`

İdeal matematik:

\[
\cos\varphi=1\Rightarrow Q=0
\]

Bu nedenle aynı measurement/control point için `Qset=0 Mvar` ile büyük ölçüde aynı hedefe karşılık gelir.

---

# 31. Kontrol türlerinin P-Q-U ilişkisi

| Mod | Denklem / fikir | P'nin rolü | U'nun rolü |
|---|---|---|---|
| Sabit Q | \(Q=Q_{set}\) | bağımsız | sonuç |
| Q(V) | \(Q=f(U)\) | dolaylı | doğrudan giriş |
| Q(P) | \(Q=f(P)\) | doğrudan giriş | sonuç |
| Sabit cosφ | \(Q=P\tan(\arccos pf)\) | doğrudan | sonuç |
| cosφ(P) | \(pf=f(P)\) | doğrudan giriş | sonuç |
| cosφ(V) | \(pf=f(U)\) | Q hesabında P gerekir | doğrudan giriş |
| tanφ | \(Q=\tanφ\cdot P\) | doğrudan giriş | sonuç |
| Voltage Control | \(Q\rightarrow U_{set}\) | Q paylaşımında kullanılabilir | ana kontrol edilen büyüklük |

---

# 32. Görsellerden ve Technical Reference'tan tespit edilen attribute sözlüğü

| GUI / işlev | Attribute | Kaynak |
|---|---|---|
| Control Mode | `i_ctrl` | görsel tooltip + TechRef |
| Controlled Phases | `i_phase` | görsel tooltip + TechRef |
| Controlled bus selection | `selBus` | görsel tooltip + TechRef |
| Setpoint source | `uset_mode` | görsel + TechRef |
| Controlled Busbar | `rembar` | TechRef |
| Target Node | `cpCtrlNode` | görsel + TechRef |
| Voltage Setpoint | `usetp` | görsel + TechRef |
| Busbar search criterion | `selAutoUn` | TechRef |
| Q control location | `p_cub` | TechRef |
| Q Setpoint | `qsetp` | görsel + TechRef |
| Q orientation | `iQorient` | görsel tooltip + TechRef |
| Q-control characteristic | `qu_char` | görsel tooltip |
| Q(P) curve | `pQPcurve` | TechRef |
| Minimum reactive power | `Qmin` | TechRef |
| Maximum reactive power | `Qmax` | TechRef |
| Reference node | `refbar` | TechRef |
| Upper voltage/deadband limit | `udeadbup` | TechRef |
| Lower voltage/deadband limit | `udeadblow` | TechRef |
| Power Factor | `pfsetp` | görsel + TechRef |
| cap./ind. | `pf_recap` | görsel tooltip + TechRef |
| PF characteristic | `cosphi_char` | görsel tooltip + TechRef |
| PF overexcited limit | `pf_over` | TechRef |
| PF underexcited limit | `pf_under` | TechRef |
| P overexcited point | `p_over` | TechRef |
| P underexcited point | `p_under` | TechRef |
| Enable Droop | `i_droop` | görsel tooltip + TechRef |
| Droop definition option | `iopt_drp` | görsel tooltip |
| Rated Reactive Power | `Srated` | görsel + TechRef |
| Droop % | `ddroop` | görsel + TechRef |
| Droop Mvar/p.u. | `Qdroop` | TechRef |
| delta(V) | `deltaV` | görsel + TechRef |
| Q measurement point | `pQmeas` | görsel tooltip + TechRef |
| Reactive Power Distribution | `imode` | görsel tooltip + TechRef |
| Step-up Transformer Control | `iTrfCtrl` | TechRef |
| Controller Time Constant | `Tctrl` | TechRef |
| Controlled sources | `Psym` | TechRef |
| Reactive Power Percentage | `cvqq` | görsel tablo + TechRef |
| Consider Q dispatch | `consQdisp` | görsel tooltip / checkbox |

> `qu_char`, `iopt_drp` ve `consQdisp` adları bu oturumdaki GUI tooltip'lerinden doğrudan tespit edilmiştir.

---

# 33. Technical Reference Table 3.1 — ana ElmStactrl parametreleri

DIgSILENT `TechRef_StationController.pdf` içindeki parametre tanımlarından:

- `loc_name` — Name
- `outserv` — Out of service
- `i_ctrl` — Control Mode
- `i_phase` — Controlled Phases
- `selBus` — Selection of controlled busbar
- `uset_mode` — Selection of controlled busbar: Setpoint
- `rembar` — Controlled Busbar / `ElmTerm`
- `cpCtrlNode` — Target Node
- `usetp` — Voltage Setpoint [p.u.]
- `selAutoUn` — Busbar Search Criteria >= [kV]
- `p_cub` — Control Q at (`StaCubic`, `ElmBoundary`)
- `qsetp` — Q Setpoint [Mvar]
- `iQorient` — Orientation
- `pQPcurve` — Q(P) curve
- `Qmin` — Minimum reactive power [Mvar]
- `Qmax` — Maximum reactive power [Mvar]
- `refbar` — Reference node
- `udeadbup` — Upper voltage limit [p.u.]
- `udeadblow` — Lower voltage limit [p.u.]
- `pfsetp` — Power Factor
- `pf_recap` — cap./ind.
- `cosphi_char` — cosphi characteristic
- `pf_over` — Minimum PF / Overexcited
- `pf_under` — Minimum PF / Underexcited
- `p_over` — Active Power / Overexcited
- `p_under` — Active Power / Underexcited
- `i_droop` — Enable Droop
- `Srated` — Rated Reactive Power [Mvar]
- `ddroop` — Droop [%]
- `Qdroop` — Droop [Mvar/p.u.]
- `deltaV` — delta(V) [p.u.]
- `pQmeas` — Q measured at (`StaCubic`, `ElmBoundary`)
- `imode` — Reactive Power Distribution
- `iTrfCtrl` — Step-up Transformer Control
- `Tctrl` — Controller Time Constant [s]
- `Psym` — Machines / controlled sources
- `cvqq` — Reactive Power Percentage [%]

---

# 34. Model doğrulama kontrol listesi

1. **`i_ctrl` doğru mu?**
   - U, Q, PF veya tanφ'den hangisi gerçekten kontrol edilmek isteniyor?

2. **Kontrol noktası doğru mu?**
   - Voltage control → doğru `ElmTerm`
   - Q/PF/tanφ → doğru `StaCubic` / `ElmBoundary`

3. **Q yönü doğru mu?**
   - result arrow
   - cubicle sign convention
   - `iQorient`

4. **Setpoint kaynağı doğru mu?**
   - Station Controller `usetp`
   - bus target voltage

5. **Controlled Node ile Target Node aynı model amacını temsil ediyor mu?**

6. **Droop tamamlanmış mı?**
   - `i_droop`
   - `Srated`
   - `% / Mvar/p.u. / deltaV`
   - `pQmeas`

7. **Droop Q measurement point doğru yerde mi?**
   - tek ünite hücresi
   - trafo kolu
   - santral toplam POI/PCC

8. **Reactive Power Distribution modu doğru mu?**
   - dispatched P
   - rated MVA
   - individual Q
   - reserve optimisation
   - voltage setpoint adaptation

9. **P-dispatch contribution sonuçları mantıklı mı?**
   - özellikle `100/0/0/0`

10. **`consQdisp` işletme amacına uygun mu?**

11. **Qmin/Qmax veya capability curve doğru mu?**

12. **Transformer tap control ile başka voltage controller çakışıyor mu?**

13. **Aynı barayı kontrol eden birden fazla Station Controller var mı?**
   - Technical Reference bunun conflict oluşturabileceğini belirtir.

14. **Output Window incelendi mi?**
   - Q-limit warnings
   - tap-limit protocol messages
   - control conflicts
   - convergence bilgileri

---

# 35. Bu oturumdan çıkan somut teknik bulgular

## 35.1 Akıncı HES

- İlk yapı: **Voltage Control + Station Controller setpoint**
- `1.043896 p.u.` → 154 kV bazında ≈ `160.76 kV`
- Q-control ekranında:
  - `Sabit Q`
  - `Qset = 0 Mvar`
  - `Orientation = +Q`
- PF-control ekranında:
  - `Sabit cosphi`
  - `PF = 1.0`
  - `end.`
  - `Orientation = +Q`
- Dağıtım ekranında:
  - `Atanan Aktif Güce göre`
  - dört kaynak katkısı `100/0/0/0`
  - `consQdisp` işaretli
- Sonraki gerilim ekranında:
  - `uset_mode = bara hedef gerilimi`
  - ayrı Target Node
  - droop checkbox açık
  - `Srated=0`
  - `ddroop=0`
  - `pQmeas` boş
- Technical Reference'a göre boş `pQmeas` → \(Q_{meas}=0\)
- `0 Mvar / 0%` anlamlı bir yüzde-droop eğimi tanımlamadığından Output Window/model davranışı ayrıca doğrulanmalıdır.

## 35.2 Aybastı RES

- `Voltage Control`
- `Positive Sequence`
- `User Selection`
- controlled bus: `154 B-1`
- `usetp = 1.057468 p.u.` → ≈ `162.85 kV`
- droop aktif
- `Srated = 11.5 Mvar`
- `ddroop = -4%`
- Q measurement point = `TR-A\Unite 14026 Hucre`
- hesaplanan:

\[
Q_{droop}=-287.5\ \text{Mvar/p.u.}
\]

- gerçek işaret davranışı seçilen cubicle'daki Q direction ile birlikte doğrulanmalıdır.

---

# 36. Kaynaklar

## 36.1 DIgSILENT PowerFactory 2024 User Manual

**Dosya:** `UserManual_en.pdf`<br>
**Sürüm:** PowerFactory 2024<br>
**İlgili ana bölüm:** Load Flow Analysis<br>
**Özellikle:** Section 24.4.1.3 — `Reactive Power Control`

Bu bölüm:
- synchronous generator reactive reserves'in voltage control ve reactive exchange için kullanımını,
- generator voltage setpoint'in manual veya Automatic Station Controller (`ElmStactrl`) tarafından belirlenebilmesini,
- Station Controller'ın birden fazla reactive source'u birleştirmesini,
- relative contribution'ların Station Controller dialogunda tanımlanmasını
açıklar.

## 36.2 DIgSILENT PowerFactory 2024 Technical Reference — Station Controller

**Dosya:** `TechRef_StationController.pdf`<br>
**Nesne:** `ElmStactrl`<br>
**Belge tarihi:** 28 March 2024<br>
**Revision:** 2

İlgili bölümler:

- 1 General Description
- 1.1 Definition
- 2 Load Flow Analysis
- 2.1 Control Mode Options
- 2.1.1 Voltage Control Mode Options
- 2.1.2 Reactive Power Control Mode Options
- 2.1.2.1 Const. Q
- 2.1.2.2 Q(V)-Characteristic with Q(V)-Curve selection
- 2.1.2.3 Q(V)-Characteristic without Q(V)-Curve selection
- 2.1.2.4 Q(P)-Characteristic
- 2.1.3 Power Factor Control Mode Options
- 2.1.3.1 Const. PF
- 2.1.3.2 cosphi(P)-Characteristic
- 2.1.3.3 cosphi(V)-Characteristic
- 2.1.4 tan(phi) Control Mode Options
- 2.2 Reactive Power Distribution
- 2.2.1 Calculation of Contributions
- 2.2.2 Maximise Reactive Reserves
- 2.2.3 Voltage Setpoint Adaptation
- 2.3 Topology Methods
- 2.4 Step-up Transformer Control
- 2.5 Usage Hints
- 3 Input Parameter Definitions

## 36.3 Proje kaynak referansı

**Dosya:** `DIgSILENT_PowerFactory_Kaynak_Referansi.md`

Bu indeks `TechRef_StationController.pdf` dosyasını:
- `ElmStactrl`
- istasyon seviyeli P/Q/V kontrolü
- Load Flow

için konu-özel teknik referans olarak sınıflandırır.

---

# 37. Son teknik özet

Station Controller modelindeki temel bilgi akışı aşağıdaki gibi özetlenebilir:

\[
P_{\text{dispatch}}\rightarrow K_Q
\]

\[
Q_{\text{dispatch}}+K_Q\Delta Q\rightarrow Q_i
\]

\[
Q_i\rightarrow U_{\text{controlled bus}}
\]

Droop kullanılırsa:

\[
Q_{meas}\rightarrow
u'_{setp}
=
u_{setp}
+
\frac{Q_{meas}}{Q_{droop}}
\]

Q-control kullanılırsa:

\[
Q_{\text{POI}}\rightarrow Q_{set}
\]

PF-control kullanılırsa:

\[
P,Q\rightarrow\cos\varphi_{set}
\]

tanφ-control kullanılırsa:

\[
Q_{set}=\tan\varphi_{set}P
\]

Sonuç olarak `ElmStactrl` içinde **aktif güç, reaktif güç, voltage setpoint, measurement location, sign/orientation, Q limits, distribution mode ve varsa transformer tap kontrolü birlikte değerlendirilmeden tek bir Q veya U ayarı doğru yorumlanamaz.**
