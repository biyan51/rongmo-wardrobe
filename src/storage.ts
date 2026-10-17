import type { Snapshot, Wear } from "../lib/types";
const HISTORY_KEY="rongmo-wardrobe-wear-v1";
type Journal = {history: Wear[]; revision: number};
function readJournal(): Journal {
  const raw=localStorage.getItem(HISTORY_KEY);
  if(!raw)return {history:[],revision:0};
  try {const parsed=JSON.parse(raw);if(!Array.isArray(parsed.history)||!Number.isInteger(parsed.revision))throw new Error();return parsed;}
  catch {throw new Error("此浏览器中的穿搭记录格式异常。为保护资料，未覆盖它；请先备份浏览器数据。");}
}
export async function api<T=Snapshot|null>(path:string,options?:RequestInit):Promise<T>{
  if(path==="/api/state"&&(!options?.method||options.method==="GET")){
    const response=await fetch(new URL(`data/wardrobe.json?v=${Date.now()}`,document.baseURI),{cache:"no-store"});
    if(!response.ok)throw new Error("衣柜资料暂时无法加载，请刷新或稍后重试。");
    const data=await response.json() as Snapshot;
    if(!Array.isArray(data.items)||!Array.isArray(data.outfits))throw new Error("衣柜资料格式有误。");
    const journal=readJournal();
    return {...data,history:journal.history,journalRevision:journal.revision} as T;
  }
  if(path==="/api/journal"&&options?.method==="PUT"){
    const {history,revision}=JSON.parse(String(options.body));
    const current=readJournal();
    if(revision!==current.revision)throw new Error("另一个页面刚刚更新了穿搭记录，请刷新后重新提交。");
    if(!Array.isArray(history)||history.length>2000)throw new Error("穿搭记录格式或数量有误。");
    const next={history,revision:revision+1};
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(next));}catch{throw new Error("当前浏览器无法保存记录，可能处于受限模式或存储空间不足。这次记录未保存。");}
    return next as T;
  }
  throw new Error("这是免登录浏览版。衣柜资料需在连接的仓库中更新。");
}
