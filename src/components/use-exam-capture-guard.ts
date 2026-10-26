"use client";
import {useEffect,useRef,useState} from "react";

// These are deterrents for events delivered to the page, not OS capture detection.
export function useExamCaptureGuard(enabled:boolean){
 const rootRef=useRef<HTMLElement>(null);
 const [covered,setCovered]=useState(false);
 useEffect(()=>{
  if(!enabled)return;
  const cover=()=>{
   // Hide synchronously before React renders the explanation dialog.
   rootRef.current?.setAttribute("data-capture-covered","true");
   setCovered(true);
  };
  const keyboard=(event:KeyboardEvent)=>{
   const key=event.key.toLowerCase(),code=event.code;
   const printScreen=key==="printscreen"||code==="PrintScreen";
   const screenshot=event.shiftKey&&(
    ((event.metaKey||event.ctrlKey)&&(key==="s"||code==="KeyS"))||
    (event.metaKey&&(["3","4","5"].includes(key)||["Digit3","Digit4","Digit5"].includes(code)))
   );
   const print=(event.ctrlKey||event.metaKey)&&(key==="p"||code==="KeyP");
   if(!printScreen&&!screenshot&&!print)return;
   event.preventDefault();
   cover();
  };
  window.addEventListener("keydown",keyboard,true);
  window.addEventListener("keyup",keyboard,true);
  window.addEventListener("blur",cover);
  window.addEventListener("beforeprint",cover);
  return()=>{
   window.removeEventListener("keydown",keyboard,true);
   window.removeEventListener("keyup",keyboard,true);
   window.removeEventListener("blur",cover);
   window.removeEventListener("beforeprint",cover);
   rootRef.current?.removeAttribute("data-capture-covered");
  };
 },[enabled]);
 function resume(){
  if(document.hidden||!document.hasFocus())return;
  rootRef.current?.removeAttribute("data-capture-covered");
  setCovered(false);
 }
 return {rootRef,covered:enabled&&covered,resume};
}
