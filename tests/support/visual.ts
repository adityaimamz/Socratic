import {expect,type Page} from "@playwright/test";
import {writeFileSync,readFileSync,existsSync,unlinkSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {createRequire} from "node:module";
import ts from "typescript";
import {createElement,type ComponentType} from "react";
import {renderToStaticMarkup} from "react-dom/server";

// Next's extensionless component imports require its bundler in the app. This isolated
// preview uses CommonJS resolution to render the actual error component without a test route.
export function renderErrorPreview(){
 const require=createRequire(import.meta.url);
 function load(file:string):Record<string,unknown>{
  const module={exports:{}};
  const code=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  new Function("require","module","exports",code)((name:string)=>name.startsWith("@/")?load(resolve("src",`${name.slice(2)}.tsx`)):require(name),module,module.exports);
  return module.exports;
 }
 const Component=load(resolve("src/app/error.tsx")).default as ComponentType<{reset:()=>void}>;
 return renderToStaticMarkup(createElement(Component,{reset:()=>{}}));
}
export async function inspectScreen(page:Page,name:string){
 await page.evaluate(()=>document.fonts.ready);
 let html=(await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace("<head>",'<head><base href="http://127.0.0.1:3100/">');
 // Embed fonts in this static test snapshot so its temporary origin has no CORS dependency.
 const fontCss=await page.evaluate(async()=>{const faces=[];for(const sheet of Array.from(document.styleSheets)){for(const rule of Array.from(sheet.cssRules)){if(rule instanceof CSSFontFaceRule)faces.push({css:rule.cssText,base:sheet.href||document.baseURI});}}return faces;});
 for(const entry of fontCss){let face=entry.css;for(const match of [...face.matchAll(/url\(["']?([^"')]+)["']?\)/g)]){const response=await page.request.get(new URL(match[1],entry.base).href);expect(response.ok()).toBe(true);face=face.replace(match[0],`url(data:font/woff2;base64,${(await response.body()).toString("base64")})`);}html=html.replace("</head>",`<style>${face}</style></head>`);}
 const path=resolve(`test-results/ui-${name}.html`);writeFileSync(path,html);
 const out=`.taste-skill/inspect-${name}`,reportPath=`${out}/report.json`;mkdirSync(out,{recursive:true});
 // Only a transient failure to produce a report is retried. Design FAIL findings always fail the test.
 for(let attempt=0;attempt<2;attempt++){
  if(existsSync(reportPath))unlinkSync(reportPath);
  try{await promisify(execFile)(process.execPath,[".agents/skills/design-taste-frontend/scripts/inspect.mjs",path,"--app","--out",out,"--json"],{timeout:180000,maxBuffer:2*1024*1024});}
  catch(error){const failure=error as Error&{stdout?:string;stderr?:string};writeFileSync(`${out}/error.log`,`${failure.message}\n${failure.stderr??""}\n${failure.stdout??""}`);if(!existsSync(reportPath)){if(attempt===0)continue;throw error;}}
  const report=JSON.parse(readFileSync(reportPath,"utf8"));expect(report.findings.filter((f:{level:string})=>f.level==="FAIL")).toEqual([]);return;
 }
}
