import type { Filters, Item, Outfit, WardrobeData } from "./types";
import { validTemperature, temperatureFit, warmthOf } from "./temperature";

const isTee = (item: Item) => /短袖|T恤|T-shirt/i.test(item.name);
const isShirt = (item: Item) => /衬衫/.test(item.name);
const garmentKey = (items: string[]) => [...items].sort().join("|");
export type OuterSuggestion = { item: Item; note: string };

export function optionalOuterLayers(data: WardrobeData, outfit: Outfit, filters?: Filters): OuterSuggestion[] {
  const worn = outfit.items.map(id => data.items.find(x => x.id === id)).filter(Boolean) as Item[];
  if (worn.some(x => x.category === "外套" || x.category === "套装") || worn.filter(x => x.category === "上衣").length > 1) return [];
  const tee = worn.find(x => x.category === "上衣" && isTee(x));
  const temperature = validTemperature(filters?.temperature) ? filters.temperature : null;
  const season = temperature === null ? filters?.season || "" : "";
  const candidates = data.items.filter(x => !outfit.items.includes(x.id)
    && (filters?.includeUnavailable || x.status === "可穿")
    && (x.category === "外套" || (!!tee && x.category === "上衣" && isShirt(x)))
    && x.styles.includes(outfit.style)
    && (temperature !== null ? temperatureFit([...worn,x],temperature).compatible : season ? x.seasons.includes(season) : x.seasons.some(s => outfit.seasons.includes(s))));
  const score = (x: Item) => {
    let value = x.category === "外套" ? 5 : 3;
    if (temperature !== null) value -= temperatureFit([...worn,x],temperature).distance * 10;
    if (/夹克/.test(x.name)) value += 7;
    if (outfit.style === "清爽学院" && /灯芯绒|衬衫/.test(x.name)) value += 4;
    if (outfit.style === "休闲校园" && /夹克|冲锋衣/.test(x.name)) value += 3;
    if (outfit.style === "微正式" && /薄黑色长大衣/.test(x.name)) value += 7;
    if (/厚|羊绒/.test(x.name)) value += season === "冬季" ? 18 : -8;
    if (season === "夏季" && isShirt(x)) value += 20;
    if (season === "冬季" && isShirt(x)) value -= 12;
    return value;
  };
  return candidates.sort((a,b) => score(b)-score(a)).slice(0,3).map(item => ({ item,
    note: item.category === "上衣" ? "衬衫敞开穿，作为轻外搭。" : /厚|羊绒/.test(item.name) ? "适合降温时加穿，按实际气温取舍。" : "出门或室内偏凉时加穿，暖和时可脱下。" }));
}

export function addOuterLayer(outfit: Outfit, item: Item): Outfit {
  if (outfit.items.includes(item.id)) return outfit;
  return { ...outfit, id: `${outfit.id}:layer:${item.id}`, name: `${outfit.name}＋${item.name}`.slice(0,150),
    items: [...outfit.items,item.id], seasons: outfit.seasons.filter(s => item.seasons.includes(s)),
    note: `${outfit.note} 加穿${item.name}。`.slice(0,3000), source: "rule", favorite: false };
}

function shape(items: Item[]) {
  return items.map(x => x.category === "上衣" ? isTee(x) ? "T恤" : /卫衣/.test(x.name) ? "卫衣" : isShirt(x) ? "衬衫" : "针织"
    : x.category === "裤子" ? /牛仔/.test(x.name) ? "牛仔" : /卫裤/.test(x.name) ? "运动裤" : "休闲裤"
    : x.category === "鞋子" ? /Killshot/.test(x.name) ? "板鞋" : /牛津/.test(x.name) ? "皮鞋" : /靴/.test(x.name) ? "靴子" : "运动鞋"
    : x.category === "外套" ? /大衣/.test(x.name) ? "大衣" : /冲锋/.test(x.name) ? "功能外套" : "夹克" : "套装").sort().join("|");
}

export function recommend(data: WardrobeData, filters: Filters): Outfit[] {
  const temperature = validTemperature(filters.temperature) ? filters.temperature : null;
  if (temperature !== null) filters = {...filters,season:""};
  const usable = data.items.filter(x => filters.includeUnavailable || x.status === "可穿");
  const map = new Map(usable.map(x => [x.id,x]));
  const selected = filters.selected.map(id => map.get(id));
  if (selected.some(x => !x)) return [];
  const selectedItems = selected as Item[];
  if (new Set(selectedItems.map(x => x.category)).size !== selectedItems.length) return [];
  const eligible = (o: Outfit) => o.items.every(id => map.has(id)) && filters.selected.every(id => o.items.includes(id))
    && (!filters.style || o.style === filters.style) && (!filters.scene || o.scene === filters.scene)
    && (!filters.season || o.seasons.includes(filters.season));
  const results: Outfit[] = data.outfits.filter(eligible);
  const seen = new Set(results.map(o => garmentKey(o.items)));
  const pool = (category: Item["category"], style: string) => {
    const chosen = selectedItems.find(x => x.category === category);
    return usable.filter(x => x.category === category && (!chosen || x.id === chosen.id) && x.styles.includes(style)
      && (!filters.season || x.seasons.includes(filters.season)));
  };
  for (const style of filters.style ? [filters.style] : data.rules.stylePriority) {
    const scene = filters.scene || (style === "微正式" ? "组会/汇报" : "上课图书馆");
    if (scene === "正式场合" && style !== "微正式") continue;
    const needOuter = selectedItems.some(x => x.category === "外套") || (temperature !== null && temperature < 16) || filters.season === "冬季" || style === "秋冬层次";
    const jackets = pool("外套",style);
    const outers: (Item|null)[] = needOuter ? jackets : [null,...jackets];
    const append = (items: Item[]) => {
      const ids = items.map(x => x.id), key = garmentKey(ids);
      if (seen.has(key) || !filters.selected.every(id => ids.includes(id))) return;
      let commonSeasons = items.reduce((acc,x) => acc.filter(s => x.seasons.includes(s)),["春季","夏季","秋季","冬季"]);
      if (temperature !== null && !commonSeasons.length) commonSeasons = [...new Set(items.flatMap(x=>x.seasons))];
      if (!commonSeasons.length || (filters.season && !commonSeasons.includes(filters.season))) return;
      if (temperature !== null && !temperatureFit(items,temperature).compatible) return;
      seen.add(key);
      const lead = items.find(x => x.category === "外套" || x.category === "套装") || items[0];
      results.push({id:`rule-${key}`,name:`${lead.name} · ${style}`,items:ids,style,scene,seasons:commonSeasons,
        note:temperature!==null?"按参考温度与已有单品类型组合，保暖层已列入本套；面料厚薄仍需试穿确认。":"按已有单品标签组合，供试穿参考；面料、廓形与实际温度仍需你判断。",source:"rule",favorite:false});
    };
    if (!selectedItems.some(x => x.category === "套装") && scene !== "正式场合") {
      for (const top of pool("上衣",style)) for (const bottom of pool("裤子",style)) for (const shoe of pool("鞋子",style)) for (const outer of outers) {
        if (filters.season === "冬季" && (isTee(top) || /棉麻/.test(top.name))) continue;
        append([...(outer ? [outer] : []),top,bottom,shoe]);
        if (temperature !== null && temperature < 16 && outer && isTee(top)) {
          for (const middle of usable.filter(x=>x.category==="上衣" && x.id!==top.id && x.styles.includes(style) && warmthOf(x)>=3)) append([outer,top,middle,bottom,shoe]);
        }
      }
    }
    if (!selectedItems.some(x => x.category === "裤子" || x.category === "外套")) {
      for (const suit of pool("套装",style)) for (const top of pool("上衣",style).filter(x => isShirt(x) || /高领/.test(x.name)))
        for (const shoe of pool("鞋子",style).filter(x => scene !== "正式场合" || /牛津/.test(x.name))) append([suit,top,shoe]);
    }
  }
  const recent = new Set(data.rules.avoidRecent ? data.history.filter(h => {
    const elapsed = Date.now()-new Date(h.date+"T00:00:00").getTime();return elapsed>=0 && elapsed<7*86400000;
  }).map(h => garmentKey(h.items.map(x => x.id))) : []);
  const ranked = results.filter(outfit=>temperature === null || temperatureFit(outfit.items.map(id=>map.get(id)!),temperature).compatible).map((outfit,index) => {
    const items = outfit.items.map(id => map.get(id)!);
    const heavy = items.some(x => /厚|羊绒/.test(x.name));
    const score = (outfit.favorite?30:0)+(outfit.source!=="rule"?9:0)+(4-Math.max(0,data.rules.stylePriority.indexOf(outfit.style)))*2
      -(recent.has(garmentKey(outfit.items))?40:0)-items.filter(x => x.status!=="可穿").length*10
      -(!filters.season && heavy?3:0);
    const free=outfit.items.filter(id => !filters.selected.includes(id));
    const fit = temperature === null ? null : temperatureFit(items,temperature);
    return {outfit,score:score-(fit?.distance||0)*6,tier:fit?.tier||0,index,shape:shape(items),free,freeSet:new Set(free)};
  }).sort((a,b) => a.tier-b.tier || b.score-a.score || a.index-b.index);
  // Diversify only the visible first pages. Fixed selections never count as repetition.
  const candidates = ranked.slice(0,1800), picked: typeof ranked = [], pickedIds = new Set<string>(), usedShapes = new Set<string>();
  const itemUse = new Map<string,number>();
  while (picked.length<24 && picked.length<candidates.length) {
    const bestTier = candidates.find(x=>!pickedIds.has(x.outfit.id))?.tier;
    let best: typeof ranked[number]|undefined, bestScore=-Infinity;
    for (const candidate of candidates) {
      if (pickedIds.has(candidate.outfit.id)) continue;
      if (candidate.tier !== bestTier) continue;
      const repeated = candidate.free.reduce((n,id) => n+(itemUse.get(id)||0),0);
      let similarity=0;
      for(const previous of picked){
        let intersection=0;
        for(const id of candidate.free)if(previous.freeSet.has(id))intersection++;
        const union=previous.free.length+candidate.free.length-intersection;
        similarity=Math.max(similarity,union?intersection/union:1);
      }
      const adjusted = candidate.score-repeated*1.4-similarity*8+(usedShapes.has(candidate.shape)?0:4);
      if (adjusted>bestScore) {best=candidate;bestScore=adjusted;}
    }
    if (!best) break;
    picked.push(best);pickedIds.add(best.outfit.id);usedShapes.add(best.shape);
    for (const id of best.free) itemUse.set(id,(itemUse.get(id)||0)+1);
  }
  return [...picked.map(x => x.outfit),...ranked.filter(x => !pickedIds.has(x.outfit.id)).map(x => x.outfit)];
}

