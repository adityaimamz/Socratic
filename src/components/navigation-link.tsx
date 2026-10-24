"use client";

import { createContext, useContext, type ComponentProps } from "react";
import Link from "next/link";

type Navigate = (href: string, options: { replace?: boolean; scroll?: boolean }) => void;
export const NavigationContext = createContext<Navigate | null>(null);
export const PrefetchContext = createContext<((href:string)=>void)|null>(null);

export default function NavigationLink({ onNavigate,onMouseEnter,onFocus, ...props }: ComponentProps<typeof Link>) {
  const navigate = useContext(NavigationContext);
  const prefetch=useContext(PrefetchContext);
  const prepare=()=>{if(typeof props.href==="string"&&props.href.startsWith("/"))prefetch?.(props.href);};
  return <Link {...props} prefetch={props.prefetch??(prefetch?false:undefined)} onMouseEnter={event=>{onMouseEnter?.(event);if(!event.defaultPrevented)prepare();}} onFocus={event=>{onFocus?.(event);if(!event.defaultPrevented)prepare();}} onNavigate={event => {
    let cancelled = false;
    onNavigate?.({ preventDefault() { cancelled = true; event.preventDefault(); } });
    if (cancelled || !navigate || typeof props.href !== "string" || !props.href.startsWith("/") || props.href.includes("#")) return;
    event.preventDefault();
    navigate(props.href, { replace: props.replace, scroll: props.scroll });
  }}/>;
}
