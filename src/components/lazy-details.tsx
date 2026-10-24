"use client";
import {useState,type ReactNode} from "react";

// Mount an editor when opened, then retain it so closing does not discard edits.
export function LazyDetails({summary,children}:{summary:ReactNode;children:ReactNode}){
 const [opened,setOpened]=useState(false);
 return <details className="class-editor" onToggle={event=>{if(event.currentTarget.open)setOpened(true);}}><summary>{summary}</summary>{opened&&children}</details>;
}
