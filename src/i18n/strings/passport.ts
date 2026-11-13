// passport: the after-hand passport review, the passport drills and the practice table
// (India Rules East round). English key, then 简体中文, 繁體中文, 日本語, العربية, हिन्दी.
import type { Row } from './types';

export const PASSPORT: Row[] = [
  // --- after-hand review (ui/passportReview.ts)
  ['Passport review', '护照回顾', '護照回顧', 'パスポート振り返り', 'مراجعة الجواز', 'पासपोर्ट समीक्षा'],
  ['JongBot is looking back over your passports…', 'JongBot 正在回顾你的护照……', 'JongBot 正在回顧你的護照……', 'JongBotがパスポートを振り返っています…', 'يراجع JongBot جوازاتك…', 'JongBot आपके पासपोर्ट देख रहा है…'],
  ['{name} twice', '{name}两次', '{name}兩次', '{name}を2組', '{name} مرتين', '{name} दो बार'],
  ['shut out', '已无望', '已無望', '不可能', 'مُغلق', 'बंद'],
  ['1 from ready', '差 1 张听牌', '差 1 張聽牌', 'テンパイまで1枚', 'بلاطة واحدة عن الاستعداد', 'तैयार से 1 दूर'],
  ['{n} from ready', '差 {n} 张听牌', '差 {n} 張聽牌', 'テンパイまで{n}枚', '{n} بلاطات عن الاستعداد', 'तैयार से {n} दूर'],
  ['{n} sets and a pair', '{n} 组加一对', '{n} 組加一對', '{n}面子と雀頭', '{n} مجموعات وزوج', '{n} सेट और एक जोड़ा'],
  ['{n} sets', '{n} 组', '{n} 組', '{n}面子', '{n} مجموعات', '{n} सेट'],
  ['with {sets}', '另加{sets}', '另加{sets}', '{sets}つき', 'مع {sets}', '{sets} के साथ'],
  ['You went for {passport} and completed it.', '你选择了{passport}，并且完成了它。', '你選擇了{passport}，並且完成了它。', '{passport}を狙い、完成させました。', 'سعيت إلى {passport} وأكملته.', 'आपने {passport} चुना और उसे पूरा किया।'],
  ['You came closest to {passport}{with}: {state} after discard {n}.', '你最接近的是{passport}{with}：第 {n} 次打牌后{state}。', '你最接近的是{passport}{with}：第 {n} 次打牌後{state}。', '最も近づいたのは{passport}{with}：{n}回目の捨て牌のあと{state}。', 'كنت الأقرب إلى {passport}{with}: {state} بعد الرمية {n}.', 'आप {passport}{with} के सबसे पास थे: {n}वीं फेंक के बाद {state}।'],
  ['Tiles from ready after each discard', '每次打牌后距离听牌的张数', '每次打牌後距離聽牌的張數', '各捨て牌のあとのテンパイまでの枚数', 'البلاطات المتبقية عن الاستعداد بعد كل رمية', 'हर फेंक के बाद तैयार होने से दूरी'],
  ['Discard {n}', '第 {n} 次打牌', '第 {n} 次打牌', '捨て牌 {n}', 'الرمية {n}', 'फेंक {n}'],
  ['Left behind', '错失', '錯失', '取り逃がし', 'فات', 'छूट गया'],
  ['Discard {n}: throwing the {tile} took that passport from {before} to {after}. The {better} would have kept it {kept}.', '第 {n} 次打牌：打出{tile}让这张护照从{before}变成{after}。打{better}可以保持{kept}。', '第 {n} 次打牌：打出{tile}讓這張護照從{before}變成{after}。打{better}可以保持{kept}。', '捨て牌{n}：{tile}を切ったことでそのパスポートは{before}から{after}になりました。{better}なら{kept}のままでした。', 'الرمية {n}: رمي {tile} نقل ذلك الجواز من {before} إلى {after}. لو رميت {better} لبقي {kept}.', 'फेंक {n}: {tile} फेंकने से वह पासपोर्ट {before} से {after} हो गया। {better} फेंकते तो वह {kept} रहता।'],
  ['Faster route', '更快的路', '更快的路', '近道', 'طريق أسرع', 'तेज़ रास्ता'],
  ['Discard {n}: the {better} instead of the {tile} would have left you {state} towards {passport}, not {was}.', '第 {n} 次打牌：打{better}而不是{tile}，你会朝着{passport}{state}，而不是{was}。', '第 {n} 次打牌：打{better}而不是{tile}，你會朝著{passport}{state}，而不是{was}。', '捨て牌{n}：{tile}ではなく{better}を切っていれば、{passport}に向けて{state}でした（{was}ではなく）。', 'الرمية {n}: رمي {better} بدل {tile} كان سيتركك {state} نحو {passport}، لا {was}.', 'फेंक {n}: {tile} की जगह {better} फेंकते तो आप {passport} की ओर {state} होते, {was} नहीं।'],
  ['Every discard kept you as close to a passport as any tile could. The wall didn’t bring the tiles.', '你每次打牌都让自己尽可能接近护照，只是牌墙没有送来需要的牌。', '你每次打牌都讓自己盡可能接近護照，只是牌牆沒有送來需要的牌。', 'どの捨て牌もパスポートに最も近い選択でした。山から牌が来なかっただけです。', 'كل رمية أبقتك أقرب ما يمكن إلى جواز. الجدار لم يأتِ بالبلاطات.', 'हर फेंक ने आपको पासपोर्ट के जितना पास रखा जितना संभव था। दीवार से ज़रूरी पत्ते नहीं आए।'],
  // --- passport drills (learn/passportDrills.ts, ui/drills.ts)
  ['Spot the passport', '认出护照', '認出護照', 'パスポートを見抜く', 'تعرّف على الجواز', 'पासपोर्ट पहचानो'],
  ['Keep passports open', '保留多条护照', '保留多條護照', 'パスポートを残す', 'أبقِ الجوازات مفتوحة', 'पासपोर्ट खुले रखो'],
  ['This hand is complete. Which passport is it built around?', '这手牌已经完成。它围绕哪张护照组成？', '這手牌已經完成。它圍繞哪張護照組成？', 'この手は完成しています。どのパスポートで組まれていますか？', 'هذه اليد مكتملة. حول أي جواز بُنيت؟', 'यह हाथ पूरा है। यह किस पासपोर्ट पर बना है?'],
  ['India Rules · East round', '印度规则 · 东风圈', '印度規則 · 東風圈', 'インドルール · 東場', 'قواعد الهند · جولة الشرق', 'भारत नियम · पूर्व दौर'],
  ['The passport is {passport}: {pieces}.', '护照是{passport}：{pieces}。', '護照是{passport}：{pieces}。', 'パスポートは{passport}：{pieces}。', 'الجواز هو {passport}: {pieces}.', 'पासपोर्ट है {passport}: {pieces}।'],
  ['With it: {sets}.', '另加：{sets}。', '另加：{sets}。', 'そのほかに：{sets}。', 'معه: {sets}.', 'साथ में: {sets}।'],
  ['The same tiles also read as {other}.', '同样的牌也可以读作{other}。', '同樣的牌也可以讀作{other}。', '同じ牌は{other}とも読めます。', 'البلاطات نفسها تُقرأ أيضًا على أنها {other}.', 'यही पत्ते {other} के रूप में भी पढ़े जा सकते हैं।'],
  ['Which discard keeps you nearest a passport, with the most passports still open?', '打哪张牌能让你最接近护照，同时保留最多条护照？', '打哪張牌能讓你最接近護照，同時保留最多條護照？', 'どの牌を切れば、最も多くのパスポートを残したままパスポートに最も近づけますか？', 'أي رمية تبقيك الأقرب إلى جواز، مع أكبر عدد من الجوازات المفتوحة؟', 'कौन-सी फेंक आपको पासपोर्ट के सबसे पास रखती है, और सबसे ज़्यादा पासपोर्ट खुले रखती है?'],
  ['Discard the {tile}: you stay {state} with {open} all open.', '打出{tile}：你保持{state}，{open}都还有机会。', '打出{tile}：你保持{state}，{open}都還有機會。', '{tile}を切る：{state}のまま、{open}がすべて残ります。', 'ارمِ {tile}: تبقى {state} و{open} كلها مفتوحة.', '{tile} फेंकें: आप {state} रहते हैं और {open} सब खुले रहते हैं।'],
  ['The {tile} would leave you as close but keep only {open}.', '打{tile}同样接近，但只剩{open}。', '打{tile}同樣接近，但只剩{open}。', '{tile}でも同じ距離ですが、{open}しか残りません。', 'رمي {tile} يبقيك على القرب نفسه لكن يُبقي {open} فقط.', '{tile} फेंकने पर दूरी उतनी ही रहती, पर सिर्फ़ {open} बचता।'],
  ['The {tile} would leave you {state}.', '打{tile}会让你{state}。', '打{tile}會讓你{state}。', '{tile}を切ると{state}になります。', 'رمي {tile} يتركك {state}.', '{tile} फेंकने पर आप {state} होते।'],
  ['a set and a pair', '一组加一对', '一組加一對', '1面子と雀頭', 'مجموعة وزوج', 'एक सेट और एक जोड़ा'],
  ['a set', '一组', '一組', '1面子', 'مجموعة', 'एक सेट'],
  ['Passport drills', '护照练习', '護照練習', 'パスポート練習', 'تمارين الجواز', 'पासपोर्ट अभ्यास'],
  ['Spot the passport, keep two open', '认出护照，保留两条', '認出護照，保留兩條', 'パスポートを見抜き、2つ残す', 'تعرّف على الجواز وأبقِ اثنين مفتوحين', 'पासपोर्ट पहचानो, दो खुले रखो'],
  ['Six quick questions', '六道快问', '六道快問', '6問の短い問題', 'ستة أسئلة سريعة', 'छह छोटे सवाल'],
  // --- practice table (ui/screens/learn.ts, match.ts, results.ts)
  ['Passport practice table', '护照练习桌', '護照練習桌', 'パスポート練習卓', 'طاولة تدريب الجواز', 'पासपोर्ट अभ्यास मेज़'],
  ['An East round with every hand face up, so you can watch passports form', '东风圈，所有人的牌都亮出，看护照如何组成', '東風圈，所有人的牌都亮出，看護照如何組成', '全員の手を表にした東場で、パスポートができていく様子を見られます', 'جولة شرق بكل الأيدي مكشوفة لتشاهد كيف تتكوّن الجوازات', 'पूर्व दौर जिसमें सबके पत्ते खुले हों, ताकि आप देख सकें पासपोर्ट कैसे बनते हैं'],
  ['Passport Practice', '护照练习', '護照練習', 'パスポート練習', 'تدريب الجواز', 'पासपोर्ट अभ्यास'],
  ['Aiming for', '目标', '目標', '狙い', 'يسعى إلى', 'लक्ष्य'],
  ['{name} is {state}: {passport}', '{name}{state}：{passport}', '{name}{state}：{passport}', '{name}は{state}：{passport}', '{name} {state}: {passport}', '{name} {state} है: {passport}'],
  ['Practice table: hands were open, so no Jong Points, Club Level or rating change.', '练习桌：牌都是亮出的，所以没有 Jong 点数、俱乐部等级或评分变化。', '練習桌：牌都是亮出的，所以沒有 Jong 點數、俱樂部等級或評分變化。', '練習卓：手が公開されていたため、Jongポイント、クラブレベル、レーティングは変わりません。', 'طاولة تدريب: كانت الأيدي مكشوفة، فلا نقاط Jong ولا مستوى النادي ولا تغيير في التصنيف.', 'अभ्यास मेज़: पत्ते खुले थे, इसलिए Jong अंक, क्लब स्तर या रेटिंग में बदलाव नहीं।'],
];
