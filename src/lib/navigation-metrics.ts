export function navigationStarted(href:string){
 if(typeof performance==="undefined")return;
 performance.clearMarks("socratic:navigation-start");
 performance.mark("socratic:navigation-start",{detail:{path:href.split("?")[0]}});
}
export function navigationRendered(stage:"visual"|"data",pathname:string){
 if(typeof performance==="undefined")return;
 const mark=performance.getEntriesByName("socratic:navigation-start").at(-1) as PerformanceMark|undefined;
 if(!mark||mark.detail?.path!==pathname.split("?")[0])return;
 const name=`socratic:navigation-${stage}`;
 // Multiple independently loading panels must not overwrite the first completed view.
 if(performance.getEntriesByName(name).some(entry=>entry.startTime===mark.startTime))return;
 performance.measure(name,{start:mark.startTime,end:performance.now(),detail:{path:pathname.split("?")[0]}});
 const entries=performance.getEntriesByName(name);if(entries.length>500)performance.clearMeasures(name);
}
