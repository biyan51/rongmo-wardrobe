"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, CloudSun, RefreshCw, Search } from "lucide-react";
import { clothingAdvice, findLocations, getWeather, locate, weatherLabel, type Coordinates, type Weather, type WeatherLocation, type WeatherTransport } from "../lib/weather";

export default function WeatherPanel({ transport = "server" }: { transport?: WeatherTransport }) {
  const [query, setQuery] = useState(""), [locations, setLocations] = useState<WeatherLocation[]>([]);
  const [place, setPlace] = useState<(Coordinates & { label: string }) | null>(null), [weather, setWeather] = useState<Weather | null>(null);
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
    setPlace(point); setWeather(result); setLocations([]);
  }
  async function locateMe() {
    const { id, signal } = begin("正在定位…");
    // Never request location on page load, and never save coordinates to wardrobe/journal storage.
    setWeather(null); setPlace(null); setLocations([]);
    try {
      if (!window.isSecureContext || !navigator.geolocation) throw new Error("这个浏览器暂不支持定位，请手动输入城市。");
      const point = await locate(navigator.geolocation);
      if (id !== request.current) return;
      setBusy("正在获取天气…");
      await load({ ...point, label: "当前位置附近" }, id, signal);
    } catch (e) { failed(e, id); } finally { if (id === request.current) setBusy(""); }
  }
  async function search() {
    const { id, signal } = begin("正在查找城市…");
    setLocations([]);
    try { const found = await findLocations(query, transport, signal); if (id === request.current) { setLocations(found); if (!found.length) setError("没找到这个城市，可以去掉“市”字，或试试拼音／英文名称。"); } }
    catch (e) { failed(e, id); } finally { if (id === request.current) setBusy(""); }
  }
  async function choose(point: Coordinates & { label: string }) {
    const { id, signal } = begin("正在获取天气…");
    // Clear old weather so a failed city switch never appears to show the new city's forecast.
    setWeather(null); setPlace(point); setLocations([]);
    try { await load(point, id, signal); } catch (e) { failed(e, id); } finally { if (id === request.current) setBusy(""); }
  }
  const stale = weather && Math.abs(Date.now() / 1000 - weather.time) > 7200;
  return <section className="weather-panel" aria-labelledby="weather-heading">
    <div className="weather-top"><div><h2 id="weather-heading"><CloudSun size={20}/>出门前，看一眼天气</h2><p>按体感温度，给今天的穿搭一点参考。</p></div><button type="button" className="secondary" disabled={!!busy} onClick={locateMe}><MapPin size={15}/>获取当前位置</button></div>
    <form className="weather-search" onSubmit={e => { e.preventDefault(); void search(); }}><label htmlFor="weather-city">或者手动选城市</label><div><input id="weather-city" value={query} maxLength={80} placeholder="例如：上海、南京、Tokyo" onChange={e => setQuery(e.target.value)}/><button type="submit" className="secondary" disabled={!!busy || query.trim().length < 2}><Search size={15}/>查找</button></div></form>
    <p className="weather-privacy">点击定位才会申请授权。仅向 Open-Meteo 发送粗略位置；本应用不保存位置、不持续跟踪。</p>
    <div aria-live="polite" aria-atomic="true">{busy && <p className="weather-status">{busy}</p>}{error && <p className="weather-error" role="alert">{error}</p>}</div>
    {locations.length > 0 && <ul className="weather-locations" aria-label="请选择城市">{locations.map(point => <li key={point.id}><button type="button" onClick={() => void choose(point)} disabled={!!busy}><MapPin size={14}/>{point.label}</button></li>)}</ul>}
    {weather && place && <div className="weather-result"><div className="weather-readings"><div className="weather-place"><strong>{place.label}</strong><span>{weatherLabel(weather.code)}</span></div><div className="weather-temperature">{Math.round(weather.temperature)}<span>°C</span><small>体感 {Math.round(weather.feelsLike)}°C</small></div><div className="weather-range"><span>今天 {Math.round(weather.low)}–{Math.round(weather.high)}°C</span>{weather.rainChance !== null && <span>今日最高降水概率 {Math.round(weather.rainChance)}%</span>}</div></div><div className="weather-advice"><span>穿衣参考</span><p>{clothingAdvice(weather)}</p><small>按个人怕冷程度和室内外活动调整；此处不会改动已选单品。</small></div><div className="weather-source"><span>{stale ? "数据已超过 2 小时，请刷新 · " : ""}当地时间 {new Intl.DateTimeFormat("zh-CN", { timeZone: weather.timezone, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(weather.time * 1000))} · {weather.timezone}</span><button type="button" className="text-button" disabled={!!busy} onClick={() => void choose(place)}><RefreshCw size={13}/>刷新天气</button></div></div>}
    {!weather && place && !busy && <button type="button" className="text-button" onClick={() => void choose(place)}>重新获取 {place.label} 的天气</button>}
    <p className="weather-credit">天气模型数据：<a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>（<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>）；城市检索：<a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>。天气不可用时，仍可选衣服、搭配和记日记。</p>
  </section>;
}
