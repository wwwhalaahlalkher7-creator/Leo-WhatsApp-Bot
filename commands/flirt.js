const MESSAGES=['💌 لو كان حضورك أغنية، كنت حأخليها في المفضلة طول اليوم.','😏 واضح إن الجاذبية عندك ما محتاجة شرح.','🌹 ابتسامتك عندها قدرة تخلي اليوم أحلى.','✨ في ناس بتدخل المكان… وفي ناس بتنور المكان. إنت من النوع الثاني.'];
async function flirtCommand(sock,chatId,message){await sock.sendMessage(chatId,{text:MESSAGES[Math.floor(Math.random()*MESSAGES.length)]},{quoted:message});}
module.exports={flirtCommand};
