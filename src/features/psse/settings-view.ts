import type {AppContext,Feature} from '../../app/contracts';
import {button,element} from '../../ui/components/dom';

/** PSS/E keeps only the display settings shared by both model modes. */
export function createPsseSettingsView(ctx:AppContext):Feature{
 const root=element('section','ga-panel ga-psse-settings'),theme=element('select'),precision=element('input'),message=element('p','ga-muted');
 theme.setAttribute('aria-label','Tema');theme.append(new Option('Koyu','dark'),new Option('Açık','light'));
 precision.type='number';precision.min='0';precision.max='8';precision.step='1';precision.setAttribute('aria-label','Ondalık basamak');
 const form=element('div','ga-settings-grid'),display=element('fieldset'),legend=element('legend','','Görünüm');
 const themeLabel=element('label','','Tema'),precisionLabel=element('label','','Ondalık basamak');themeLabel.append(theme);precisionLabel.append(precision);display.append(legend,themeLabel,precisionLabel);form.append(display);
 const analysis=button('PSS/E hesap ayarlarına git',()=>ctx.setView('analysis'));
 root.append(element('h2','','PSS/E Ayarları'),element('p','ga-muted','Bu görünüm yalnız paylaşılan tema ve sayı gösterim hassasiyetini değiştirir. Çözücü toleransı, iterasyon sayısı ve fizik profilleri PSS/E Analizler ekranındadır.'),form,analysis,button('Uygula',apply),message);
 function fill(){theme.value=ctx.settings.value.theme;precision.value=String(ctx.settings.value.precision);}
 function apply(){const p=Number(precision.value);if(!Number.isInteger(p)||p<0||p>8){message.textContent='Ondalık basamak 0–8 arasında tam sayı olmalıdır.';return;}ctx.settings.update({theme:theme.value as 'dark'|'light',precision:p});message.textContent='Görünüm ayarları kaydedildi.';ctx.notify();}
 let snapshot='';fill();return{element:root,render(){const current=JSON.stringify([ctx.settings.value.theme,ctx.settings.value.precision]);if(current!==snapshot){snapshot=current;fill();}document.body.classList.toggle('ga-light',ctx.settings.value.theme==='light');}};
}
