"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, CloudSun, RefreshCw, Search } from "lucide-react";
import { clothingAdvice, findLocations, getWeather, locate, weatherLabel, type Coordinates, type Weather, type WeatherLocation, type WeatherTransport } from "../lib/weather";
import { getNearbyArea } from "../lib/nearby-area";

export default function WeatherPanel({ transport = "server" }: { transport?: WeatherTransport }) {
  const [query, setQuery] = useState(""), [locations, setLocations] = useState<WeatherLocation[]>([]);
  const [place, setPlace] = useState<(Coordinates & { label: string; areaNote?: string }) | null>(null), [weather, setWeather] = useState<Weather | null>(null);
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const active = useRef<AbortController | null>(null), request = useRef(0);
  useEffect(() => () => { request.current++; active.current?.abort(); }, []);
  function begin(message: string) {
    active.current?.abort();
    active.current = new AbortController();
    const id = ++request.current;
    setBusy(message); setError("");
    return { id, signal: active.current.signal };
  }
  function failed(error: unknown, id: number) {
    if (id !== request.current) return;
    setError(error instanceof Error && !["AbortError", "TimeoutError", "TypeError"].includes(error.name) ? error.message : "天气服务连接超时或网络不可用，请稍后重试。");
  }
  async function load(point: Coordinates & { label: string }, id: number, signal: AbortSignal) {
    const result = await getWeather(point, transport, signal);
    if (id !== request.current) return;
    setWeather(result); setLocations([]);
  }
  async function locateMe() {
    const { id, signal } = begin("正在定位…");
    // Never request location on page load, and never save coordinates to wardrobe/journal storage.
    setWeather(null); setPlace(null); setLocations([]);
    try {
      if (!window.isSecureContext || !navigator.geolocation) throw new Error("这个浏览器暂不支持定位，请手动输入城市。");
      const point = await locate(navigator.geolocation, true);
      if (id !== request.current) return;
      setBusy("正在获取天气…");
      const initial = { ...point, label: "当前位置附近", areaNote: "正在识别区县…" };
      setPlace(initial);
      const area = getNearbyArea(point, transport, signal).then(result => {
        if (id !== request.current) return;
        setPlace({ ...point, label: result.label || initial.label, areaNote: result.district ? "附近区县参考；区界附近或设备位置不准时可能有偏差。" : "区县名暂未识别，天气仍按附近坐标查询。" });
      }).catch(() => {
        if (id === request.current) setPlace({ ...initial, areaNote: "区县名暂时取不到，天气仍按附近坐标查询；可手动搜索区县。" });
      });
      await Promise.all([load(initial, id, signal), area]);
    } catch (e) { failed(e, id); } finally { if (id === request.current) setBusy(""); }
  }
  async function search() {
    const { id, signal } = begin("正在查找城市…");
    setLocations([]);
    try { const found = await findLocations(query, transport, signal); if (id === request.current) { setLocations(found); if (!found.length) setError("没找到这个地区，可以只输入区县名，去掉“区／县／市”字，或试试拼音／英文名称。"); } }
    catch (e) { failed(e, id); } finally { if (id === request.current) setBusy(""); }
  }
  async function choose(point: Coordinates & { label: string; areaNote?: string }) {
    const { id, signal } = begin("正在获取天气…");
    // Clear old weather so a failed city switch never appears to show the new city's forecast.
    setWeather(null); setPlace(point); setLocations([]);
    try { await load(point, id, signal); } catch (e) { failed(e, id); } finally { if (id === request.current) setBusy(""); }
  }
  const stale = weather && Math.abs(Date.now() / 1000 - weather.time) > 7200;
  return <section className="weather-panel" aria-labelledby="weather-heading">
    <div className="weather-top"><div><h2 id="weather-heading"><CloudSun size={20}/>出门前，看一眼天气</h2><p>按体感温度，给今天的穿搭一点参考。</p></div><button type="button" className="secondary" disabled={!!busy} onClick={locateMe}><MapPin size={15}/>获取当前位置</button></div>
    <form className="weather-search" onSubmit={e => { e.preventDefault(); void search(); }}><label htmlFor="weather-city">或者手动选城市／区县</label><div><input id="weather-city" value={query} maxLength={80} placeholder="例如：上海、杨浦、玄武" onChange={e => setQuery(e.target.value)}/><button type="submit" className="secondary" disabled={!!busy || query.trim().length < 2}><Search size={15}/>查找</button></div></form>
    <p className="weather-privacy">点击定位才会申请授权。粗略位置发给 Open-Meteo 查天气、Photon 识别附近区县；本应用不保存定位历史、不持续跟踪。</p>
    <div aria-live="polite" aria-atomic="true">{busy && <p className="weather-status">{busy}</p>}{error && <p className="weather-error" role="alert">{error}</p>}</div>
    {locations.length > 0 && <ul className="weather-locations" aria-label="请选择城市">{locations.map(point => <li key={point.id}><button type="button" onClick={() => void choose(point)} disabled={!!busy}><MapPin size={14}/>{point.label}</button></li>)}</ul>}
    {!weather && place && <div className="weather-area-note" aria-live="polite"><strong>{place.label}</strong>{place.areaNote && <p>{place.areaNote}</p>}</div>}
    {weather && place && <div className="weather-result"><div className="weather-readings"><div className="weather-place"><strong>{place.label}</strong><span>{weatherLabel(weather.code)}</span></div>{place.areaNote && <p className="weather-area-note">{place.areaNote}</p>}<div className="weather-temperature">{Math.round(weather.temperature)}<span>°C</span><small>体感 {Math.round(weather.feelsLike)}°C</small></div><div className="weather-range"><span>今天 {Math.round(weather.low)}–{Math.round(weather.high)}°C</span>{weather.rainChance !== null && <span>今日最高降水概率 {Math.round(weather.rainChance)}%</span>}</div></div><div className="weather-advice"><span>穿衣参考</span><p>{clothingAdvice(weather)}</p><small>按个人怕冷程度和室内外活动调整；此处不会改动已选单品。</small></div><div className="weather-source"><span>{stale ? "数据已超过 2 小时，请刷新 · " : ""}当地时间 {new Intl.DateTimeFormat("zh-CN", { timeZone: weather.timezone, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(weather.time * 1000))} · {weather.timezone}</span><button type="button" className="text-button" disabled={!!busy} onClick={() => void choose(place)}><RefreshCw size={13}/>刷新天气</button></div></div>}
    {!weather && place && !busy && <button type="button" className="text-button" onClick={() => void choose(place)}>重新获取 {place.label} 的天气</button>}
    <p className="weather-credit">天气模型数据：<a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>（<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>）；地区检索：<a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>；区县识别：<a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">Photon</a> / © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>。天气不可用时，仍可选衣服、搭配和记日记。</p>
  </section>;
}
