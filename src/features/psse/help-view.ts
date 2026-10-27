import type {AppContext,Feature} from '../../app/contracts';
import {button,element} from '../../ui/components/dom';

/** Concise scope notes for the independent PSS/E bus/branch engine. */
export function createPsseHelpView(ctx:AppContext):Feature{
 const root=element('section','ga-panel ga-psse-help'),cards=element('div','ga-card-grid'),actions=element('div','ga-psse-controls');
 root.append(element('h2','','PSS/E Yardım'),element('p','ga-muted','PSS/E girdileri kaynak değerleri olarak incelenir. Yalnız Analizler ekranında üretilen GA_PSSE_CALCULATED sonuçları çözücü çıktısıdır; SOURCE_SAVED ve PSSE_REFERENCE ayrı kaynaklardır.'));
 const topics:[string,string,string][]=[
  ['Tam AC · NR_POLAR','Dengeli bus/branch admitans matrisi, tam polar Newton çözümü, ZIP yük karakteristiği ve kaynak/çalışma reaktif güç sınır profilleri.','Kaynakta kalan droop ve uzak gerilim kontrolleri gibi desteklenmeyen kontroller varsa hesap BLOCKED olur.'],
  ['FDNS_XB','Bağımsız fast-decoupled XB çözümü; kendi B′/B″ faktörlemesini ve iterasyonlarını kullanır.','Yöntem AC NR’ye geri düşmez. Reaktif sınırları etkin profilde referans davranışı ayrıca yöntem bazında doğrulanmalıdır.'],
  ['Kayıpsız doğrusal DC','Ayrı doğrusal aktif güç denklemi; açıkça seçilen referans açı, yük gerilimi, şönt gerilimi ve kademe politikaları kullanılır. Doğrulanmış ideal bağlantı grupları DC’de eş-açılı bara eşdeğerlemesiyle çözülür.','R/X kayıpları ve Q/V davranışı çözülmez. PSS/E 36.5 ideal bağlantı çevrimleri ağırlıklı akış geri kazanımı kullanır; genel AC eşdeğerliği anlamına gelmez.'],
  ['Sonuç ve kapsam','Hesap kimliği model, topoloji, senaryo, çözücü, seçenekler ve motor sürümünü ayırır. Kaynak sınırları ile çalışma eşiği açıkça etiketlenir.','BLOCKED, PARTIAL, CONVERGED ve referans karşılaştırma durumları farklı anlam taşır. PARITY/uyum iddiaları yalnız tam eşleşen sonuç satırları ve seçeneklerle yapılır.'],
 ];
 for(const [title,summary,caveat]of topics){const card=element('details','ga-help-entry');card.append(element('summary','',title),element('p','',summary),element('p','ga-notice',caveat));cards.append(card);}root.append(cards);
 actions.append(button('PSS/E Analizler',()=>ctx.setView('analysis')),button('PSS/E model özeti',()=>ctx.setView('model')),button('PSS/E haritası',()=>ctx.setView('map')),button('Tek hat şeması',()=>ctx.setView('sld')));root.append(actions);
 return{element:root,render(){}};
}
