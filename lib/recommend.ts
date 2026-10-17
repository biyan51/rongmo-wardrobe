import type { Filters, Item, Outfit, WardrobeData } from "./types";
export function recommend(data: WardrobeData, filters: Filters): Outfit[] {
  const usable = data.items.filter(x => filters.includeUnavailable || x.status === "可穿");
  const map = new Map(usable.map(x => [x.id, x]));
  const selected = filters.selected.map(id => map.get(id));
  if (selected.some(x => !x)) return [];
  const selectedItems = selected as Item[];
  if (new Set(selectedItems.map(x => x.category)).size !== selectedItems.length) return [];
  const eligible = (o: Outfit) => o.items.every(id => map.has(id)) && filters.selected.every(id => o.items.includes(id)) && (!filters.style || o.style === filters.style) && (!filters.scene || o.scene === filters.scene) && (!filters.season || o.seasons.includes(filters.season));
  const results: Outfit[] = data.outfits.filter(eligible);
  const seen = new Set(results.map(o => [...o.items].sort().join("|")));
  const pool = (category: Item["category"], style: string) => {
    const chosen = selectedItems.find(x => x.category === category);
    return usable.filter(x => x.category === category && (!chosen || x.id === chosen.id) && x.styles.includes(style) && (!filters.season || x.seasons.includes(filters.season)));
  };
  for (const style of filters.style ? [filters.style] : data.rules.stylePriority) {
    const scene = filters.scene || (style === "微正式" ? "组会/汇报" : "上课图书馆");
    if (scene === "正式场合" && style !== "微正式") continue;
    const outerSelected = selectedItems.some(x => x.category === "外套");
    const needOuter = outerSelected || filters.season === "冬季" || style === "秋冬层次";
    const outers: (Item | null)[] = needOuter ? pool("外套", style).filter(x => filters.season !== "冬季" || /大衣|冲锋|夹克/.test(x.name)) : [null];
    const groups: Item[][] = [];
    if (!selectedItems.some(x => x.category === "套装")) {
      for (const top of pool("上衣", style)) for (const bottom of pool("裤子", style)) for (const shoe of pool("鞋子", style)) for (const outer of outers) {
        if (filters.season === "冬季" && /短袖|棉麻/.test(top.name)) continue;
        if (scene === "正式场合") continue;
        groups.push([...(outer ? [outer] : []), top, bottom, shoe]);
      }
    }
    if (!selectedItems.some(x => x.category === "裤子" || x.category === "外套")) {
      for (const suit of pool("套装", style)) for (const top of pool("上衣", style).filter(x => /衬衫|高领/.test(x.name))) for (const shoe of pool("鞋子", style).filter(x => scene !== "正式场合" || /牛津/.test(x.name))) groups.push([suit, top, shoe]);
    }
    for (const items of groups) {
      const ids = items.map(x => x.id);
      if (!filters.selected.every(id => ids.includes(id))) continue;
      const key = [...ids].sort().join("|");
      if (seen.has(key)) continue;
      const commonSeasons = items.reduce((acc, x) => acc.filter(s => x.seasons.includes(s)), ["春季", "夏季", "秋季", "冬季"]);
      if (!commonSeasons.length) continue;
      seen.add(key);
      results.push({ id: `rule-${key}`, name: `${items.find(x => x.category === "外套" || x.category === "套装")?.name || items[0].name} · ${style}`, items: ids, style, scene, seasons: commonSeasons, note: "按单品标签组合，供试穿参考；廓形、面料与实际温度仍需你判断。", source: "rule", favorite: false });
    }
  }
  const recent = new Set(data.rules.avoidRecent ? data.history.filter(h => Date.now() - new Date(h.date + "T00:00:00").getTime() >= 0 && Date.now() - new Date(h.date + "T00:00:00").getTime() < 7 * 86400000).map(h => h.items.map(x => x.id).sort().join("|")) : []);
  const score = (o: Outfit) => (o.favorite ? 30 : 0) + (o.source !== "rule" ? 15 : 0) + (4 - Math.max(0, data.rules.stylePriority.indexOf(o.style))) * 2 - (recent.has([...o.items].sort().join("|")) ? 40 : 0) - o.items.filter(id => map.get(id)?.status !== "可穿").length * 10;
  return results.sort((a, b) => score(b) - score(a));
}


