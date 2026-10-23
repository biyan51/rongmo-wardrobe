import type { Item } from "./types";

export const validTemperature = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= -50 && value <= 60;
export function warmthOf(item: Item) {
  if (item.category === "外套") return /厚|羊绒|羽绒|棉服/.test(item.name) ? 5 : /薄|冲锋/.test(item.name) ? 2.5 : 3;
  if (item.category === "套装") return 2.5;
  if (item.category !== "上衣") return 0;
  if (/短袖|T恤|T-shirt/i.test(item.name)) return 1;
  if (/毛衣|针织|高领/.test(item.name)) return 3.5;
  if (/卫衣/.test(item.name)) return 3;
  if (/衬衫|棉麻/.test(item.name)) return 1.5;
  return 2;
}
// These are editable clothing-type heuristics, not measured insulation or personal comfort limits.
export function temperatureFit(items: Item[], temperature: number) {
  const tops = items.filter(x => x.category === "上衣");
  const outer = items.some(x => x.category === "外套" || x.category === "套装");
  const warmth = items.reduce((sum,x) => sum + warmthOf(x), 0);
  const [min,max,ideal] = temperature >= 28 ? [0.5,2,1] : temperature >= 23 ? [1,4,1.5]
    : temperature >= 20 ? [1.5,5,3] : temperature >= 16 ? [3,6,4.5]
    : temperature >= 12 ? [5,8,6] : temperature >= 8 ? [6,9.5,7] : [8,12,8.5];
  const heavy = items.some(x => x.category === "外套" && warmthOf(x) >= 5);
  const compatible = tops.length > 0 && warmth >= min && warmth <= max
    && !(temperature < 16 && !outer) && !(temperature <= 10 && !tops.some(x => warmthOf(x) >= 3))
    && !(temperature >= 28 && outer) && !(temperature >= 23 && heavy);
  const distance = Math.abs(warmth - ideal) + (temperature >= 16 && heavy ? 2 : 0);
  return { compatible, tier: Math.floor(distance / 1.5), distance,
    note: temperature < 12 ? "保暖内层＋外搭，已计入整套搭配。" : temperature < 16 ? "以内层叠穿外搭，避免只穿单薄上衣。"
      : temperature < 20 ? "优先长袖或可增减的叠穿。" : temperature < 23 ? "优先长袖、卫衣或轻外搭。" : temperature < 28 ? "优先轻薄上衣，减少厚重叠穿。" : "优先轻薄单层，已避开厚外套与毛衣。" };
}
