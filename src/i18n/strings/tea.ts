// tea: passing tea at the table (src/ui/tea.ts). English key, then 简体中文, 繁體中文, 日本語, العربية, हिन्दी.
import type { Row } from './types';

export const TEA: Row[] = [
  ['Pass tea', '敬茶', '敬茶', 'お茶を勧める', 'قدّم الشاي', 'चाय पेश करें'],
  ['Pass a cup of tea to {name}', '给{name}敬一杯茶', '給{name}敬一杯茶', '{name}さんにお茶を一杯', 'قدّم فنجان شاي إلى {name}', '{name} को एक कप चाय दें'],
  ['{name} passes you tea', '{name}给你敬了一杯茶', '{name}給你敬了一杯茶', '{name}さんからお茶をどうぞ', '{name} يقدّم لك الشاي', '{name} ने आपको चाय दी'],
  ['Tea from {name}', '{name}敬的茶', '{name}敬的茶', '{name}さんからのお茶', 'شاي من {name}', '{name} की ओर से चाय'],
  ['Tea from you', '你敬的茶', '你敬的茶', 'あなたからのお茶', 'شاي منك', 'आपकी ओर से चाय'],
  ['You have passed your tea this hand', '这一局你已经敬过茶了', '這一局你已經敬過茶了', 'この局はもうお茶を勧めました', 'لقد قدّمت شايك في هذه اليد', 'इस हाथ में आप चाय दे चुके हैं'],
];
