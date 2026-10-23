export type Coordinates = { latitude: number; longitude: number };
export type WeatherLocation = Coordinates & { id: number; label: string };
export type Weather = { temperature: number; feelsLike: number; low: number; high: number; code: number; rainChance: number | null; wind: number; time: number; timezone: string };
export type WeatherTransport = "server" | "direct";
const WEATHER_ERROR = "暂时取不到天气，请稍后重试，衣柜仍可照常使用。";
const number = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function coarseCoordinates(value: Coordinates): Coordinates {
  if (!number(value?.latitude) || !number(value?.longitude) || Math.abs(value.latitude) > 90 || Math.abs(value.longitude) > 180) throw new Error("位置无效，请重新定位或选择城市。");
  return { latitude: Math.round(value.latitude * 100) / 100, longitude: Math.round(value.longitude * 100) / 100 };
}
export function forecastUrl(location: Coordinates) {
  const point = coarseCoordinates(location);
  const params = new URLSearchParams({ latitude: String(point.latitude), longitude: String(point.longitude), current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m", daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max", timezone: "auto", timeformat: "unixtime", temperature_unit: "celsius", wind_speed_unit: "kmh", forecast_days: "1" });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}
export function searchUrl(query: string) {
  const name = query.trim();
  if (name.length < 2 || name.length > 80) throw new Error("请输入 2–80 个字的城市名。");
  return `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name, count: "6", language: "zh", format: "json" })}`;
}
export function districtSearchUrl(query: string) {
  searchUrl(query);
  const params = new URLSearchParams({ q: query.trim(), limit: "6" });
  for (const layer of ["city", "district", "county"]) params.append("layer", layer);
  return `https://photon.komoot.io/api/?${params}`;
}
export function parseDistrictLocations(raw: unknown): WeatherLocation[] {
  const features = (raw as { features?: { properties?: Record<string, unknown>; geometry?: { coordinates?: unknown[] } }[] })?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap(feature => {
    const p = feature?.properties, coordinates = feature?.geometry?.coordinates;
    if (!p || typeof p.name !== "string" || !number(p.osm_id) || !coordinates || !number(coordinates[0]) || !number(coordinates[1]) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) return [];
    const label = [...new Set([p.name, p.city, p.state, p.country].filter(v => typeof v === "string" && v))].join(" · ");
    const kind = p.osm_type === "N" ? 1 : p.osm_type === "W" ? 2 : 3;
    return [{ id: -(p.osm_id * 10 + kind), label, ...coarseCoordinates({ latitude: coordinates[1], longitude: coordinates[0] }) }];
  }).slice(0, 6);
}
export function parseWeather(raw: unknown): Weather {
  const x = raw as { current?: Record<string, unknown>; daily?: Record<string, unknown[]>; timezone?: unknown; current_units?: Record<string, unknown>; daily_units?: Record<string, unknown> };
  const c = x?.current, d = x?.daily;
  const values = [c?.temperature_2m, c?.apparent_temperature, c?.weather_code, c?.wind_speed_10m, c?.time, d?.temperature_2m_min?.[0], d?.temperature_2m_max?.[0]];
  if (!values.every(number) || typeof x?.timezone !== "string" || x.current_units?.temperature_2m !== "°C" || x.daily_units?.temperature_2m_max !== "°C") throw new Error(WEATHER_ERROR);
  try { new Intl.DateTimeFormat("zh-CN", { timeZone: x.timezone }); } catch { throw new Error(WEATHER_ERROR); }
  const [temperature, feelsLike, code, wind, time, low, high] = values as number[];
  if (low > high || temperature < -100 || temperature > 70 || wind < 0 || time < 1_000_000_000) throw new Error(WEATHER_ERROR);
  const rain = d?.precipitation_probability_max?.[0];
  return { temperature, feelsLike, code, wind, time, low, high, rainChance: number(rain) && rain >= 0 && rain <= 100 ? rain : null, timezone: x.timezone };
}
export function parseLocations(raw: unknown): WeatherLocation[] {
  const results = (raw as { results?: unknown[] })?.results;
  if (!results) return [];
  if (!Array.isArray(results)) throw new Error("城市搜索暂时不可用，请稍后再试。");
  return results.flatMap(value => {
    const x = value as Record<string, unknown>;
    if (!x || !number(x.id) || typeof x.name !== "string" || !number(x.latitude) || !number(x.longitude) || Math.abs(x.latitude) > 90 || Math.abs(x.longitude) > 180) return [];
    return [{ id: x.id, label: [...new Set([x.name, x.admin2, x.admin1, x.country].filter(v => typeof v === "string" && v))].join(" · "), ...coarseCoordinates({ latitude: x.latitude, longitude: x.longitude }) }];
  }).slice(0, 6);
}
export async function weatherJson(url: string, options: RequestInit = {}, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, 12_000);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(url, { ...options, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: controller.signal });
    if (!response.ok) throw new Error(WEATHER_ERROR);
    return await response.json();
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
export async function getWeather(location: Coordinates, transport: WeatherTransport, signal?: AbortSignal): Promise<Weather> {
  const point = coarseCoordinates(location);
  const raw = transport === "direct" ? await weatherJson(forecastUrl(point), {}, signal) : await weatherJson("/api/weather", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(point) }, signal);
  return parseWeather(raw);
}
export async function findLocations(query: string, transport: WeatherTransport, signal?: AbortSignal): Promise<WeatherLocation[]> {
  const url = searchUrl(query);
  if (transport !== "direct") return parseLocations(await weatherJson(`/api/locations?name=${encodeURIComponent(query.trim())}`, {}, signal));
  let raw;
  try { raw = await weatherJson(url, {}, signal); } catch (error) { if (signal?.aborted) throw error; }
  const found = parseLocations(raw);
  return found.length ? found : parseDistrictLocations(await weatherJson(districtSearchUrl(query), {}, signal));
}
export function geolocationError(error: { code?: number }) {
  return error.code === 1 ? "定位未获授权。可以直接输入城市，不影响使用衣柜。" : error.code === 3 ? "定位超时了，可以再试一次，或手动选择城市。" : "暂时无法确定位置，请手动选择城市。";
}
export function locate(geolocation: Pick<Geolocation, "getCurrentPosition">, district = false): Promise<Coordinates> {
  return new Promise((resolve, reject) => geolocation.getCurrentPosition(position => {
    try { resolve(coarseCoordinates(position.coords)); } catch (error) { reject(error); }
  }, error => reject(new Error(geolocationError(error))), { enableHighAccuracy: district, timeout: 12_000, maximumAge: district ? 60_000 : 300_000 }));
}
export function weatherLabel(code: number) {
  if (code === 0) return "晴";
  if (code === 1 || code === 2) return "多云";
  if (code === 3) return "阴";
  if (code === 45 || code === 48) return "雾";
  if ([51, 53, 55, 56, 57].includes(code)) return "毛毛雨";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "雨";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "雪";
  if ([95, 96, 99].includes(code)) return "雷雨";
  return "天气变化中";
}
export function clothingAdvice(weather: Weather): string {
  const t = weather.feelsLike;
  const base = t >= 28 ? "体感偏热，短袖、棉麻和轻薄裤装更舒服。" : t >= 23 ? "短袖或薄衬衫即可；常待空调房可备一件薄外搭。" : t >= 18 ? "适合长袖或短袖加薄外搭，热了方便脱。" : t >= 12 ? "建议针织或卫衣叠穿夹克，早晚把外搭带上。" : t >= 5 ? "偏冷，建议厚外套搭配针织内层。" : "较冷，优先保暖外套和足够的内搭。";
  return base + (weather.high - weather.low >= 8 ? "今天温差较大，适合可增减的叠穿。" : "") + ((weather.rainChance ?? 0) >= 50 || /雨|雪/.test(weatherLabel(weather.code)) ? "有雨雪可能，带伞并留意鞋面防水。" : "") + (weather.wind >= 25 ? "风较大，外搭可选更挡风的款式。" : "");
}
