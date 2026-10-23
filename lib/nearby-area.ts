import { coarseCoordinates, weatherJson, type Coordinates, type WeatherTransport } from "./weather";

export type NearbyArea = { label: string | null; district: string | null };
const text = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 100) : "";
const countyName = (name: string) => /[区县]$/.test(name) && !/(自治区|特别行政区|社区|地区)$/.test(name);
export function nearbyAreaUrl(location: Coordinates) {
  const point = coarseCoordinates(location);
  const params = new URLSearchParams({ lat: String(point.latitude), lon: String(point.longitude), limit: "5", radius: "3" });
  for (const layer of ["city", "district", "county"]) params.append("layer", layer);
  return `https://photon.komoot.io/reverse?${params}`;
}
// A nearby administrative feature is an approximation, not a point-in-polygon boundary check.
// Do not expose street names, buildings or provider-returned coordinates to the UI.
export function parseNearbyArea(raw: unknown, location: Coordinates): NearbyArea {
  const features = (raw as { features?: { properties?: Record<string, unknown> }[] })?.features;
  if (!Array.isArray(features)) return { label: null, district: null };
  const point = coarseCoordinates(location);
  let cityFallback = "";
  for (const feature of features) {
    const p = feature?.properties;
    if (!p) continue;
    const extent = p.extent;
    if (Array.isArray(extent) && extent.length === 4 && extent.every(v => typeof v === "number" && Number.isFinite(v))) {
      const [west, north, east, south] = extent as number[];
      if (point.longitude < west || point.longitude > east || point.latitude < south || point.latitude > north) continue;
    }
    const city = text(p.city), state = text(p.state), name = text(p.name), type = text(p.type);
    const china = text(p.countrycode).toUpperCase() === "CN";
    const adminLevel = text((p.extra as Record<string, unknown> | undefined)?.admin_level);
    const namedDistrict = ["city", "district", "county"].includes(type) && (countyName(name) || (adminLevel === "6" && /市$/.test(name))) ? name : "";
    const district = [text(p.county), city, text(p.district), namedDistrict].find(countyName) || namedDistrict || (!china && type === "district" ? name : "");
    const parent = city && city !== district && !countyName(city) ? city : state;
    if (!cityFallback && parent) cityFallback = parent;
    if (!district) continue;
    const label = [...new Set([parent, district].filter(Boolean))].join(" · ");
    return { label: `${label}附近`, district };
  }
  return { label: cityFallback ? `${cityFallback}附近` : null, district: null };
}
export async function lookupNearbyArea(location: Coordinates, signal?: AbortSignal): Promise<NearbyArea> {
  const raw = await weatherJson(nearbyAreaUrl(location), {}, signal);
  return parseNearbyArea(raw, location);
}
export async function getNearbyArea(location: Coordinates, transport: WeatherTransport, signal?: AbortSignal): Promise<NearbyArea> {
  if (transport === "direct") return lookupNearbyArea(location, signal);
  const raw = await weatherJson("/api/nearby-area", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(coarseCoordinates(location)) }, signal) as NearbyArea;
  return { label: typeof raw?.label === "string" ? text(raw.label) : null, district: typeof raw?.district === "string" ? text(raw.district) : null };
}
