import {build} from "esbuild";
await build({entryPoints:["src/main.tsx"],bundle:true,platform:"browser",format:"iife",jsx:"automatic",minify:true,outfile:"app.js",define:{"process.env.NODE_ENV":JSON.stringify("production")}});
console.log("Built app.js. JSON-only changes do not require rebuilding.");
