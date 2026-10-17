export const categories = ["上衣", "外套", "裤子", "鞋子", "套装"] as const;
export const seasons = ["春季", "夏季", "秋季", "冬季"] as const;
export const styles = ["清爽学院", "休闲校园", "秋冬层次", "微正式"] as const;
export const scenes = ["上课图书馆", "上智院/组会", "组会/汇报", "休闲出门", "正式场合"] as const;
export const statuses = ["可穿", "在途", "在家", "暂停"] as const;
export type Category = typeof categories[number];
export type Item = { id: string; name: string; category: Category; color: string; seasons: string[]; styles: string[]; status: typeof statuses[number]; photo: string; note: string };
export type Outfit = { id: string; name: string; items: string[]; style: string; scene: string; seasons: string[]; note: string; source: "original" | "manual" | "rule"; favorite: boolean };
export type Wear = { id: string; date: string; name: string; items: { id: string; name: string }[]; note: string; rating: string };
export type Rules = { stylePriority: string[]; avoidRecent: boolean; note: string };
export type WardrobeData = { items: Item[]; outfits: Outfit[]; history: Wear[]; rules: Rules };
export type Snapshot = WardrobeData & { revision: number; updatedAt: string; journalRevision?: number };
export type Filters = { selected: string[]; style: string; scene: string; season: string; includeUnavailable: boolean };

