"use client";
import {useEffect,useRef} from "react";
export function Modal({children,titleId,alert=false,onCancel,className=""}:{children:React.ReactNode;titleId:string;alert?:boolean;onCancel?:()=>void;className?:string}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=ref.current;const previous=document.activeElement;if(d&&!d.open)d.showModal();return()=>{if(d?.open)d.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};},[]);
 return <dialog ref={ref} tabIndex={-1} className={`modal ${className}`} role={alert?"alertdialog":"dialog"} aria-labelledby={titleId} onKeyDown={e=>{
  if(e.key!=="Tab")return;
  const controls=[...e.currentTarget.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.matches(":disabled")&&el.getClientRects().length>0);
  const first=controls[0],last=controls.at(-1),active=document.activeElement;
  if(!first){e.preventDefault();e.currentTarget.focus();}
  else if(e.shiftKey&&(active===first||active===e.currentTarget)){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&(active===last||!e.currentTarget.contains(active))){e.preventDefault();first.focus();}
 }} onCancel={e=>{e.preventDefault();onCancel?.();}}>{children}</dialog>;
}
