export function motionPolicy({requested=true,reduced=false,permission='system',layer='calculated',available=false,mode='p',zoom=1}){
  const reason=!requested?'Akış kapalı':reduced&&permission!=='allow'?'Sistem hareket azaltma açık · Ölçüm: animasyon izni':layer!=='calculated'?'Bu kaynak/görünümde güvenilir P/Q yok':!available?'Bu kapsamda geçerli akış yok':mode==='q'&&zoom<1.7?'Q okları için yakınlaştırın':'';
  return {enabled:!reason,reason};
}
