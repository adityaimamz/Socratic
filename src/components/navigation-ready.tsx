"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";
import {navigationRendered} from "@/lib/navigation-metrics";

export function NavigationReady(){
 const pathname=usePathname();
 useEffect(()=>{navigationRendered("visual",pathname);navigationRendered("data",pathname);},[pathname]);
 return null;
}
