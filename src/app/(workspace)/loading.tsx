"use client";

import { usePathname } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton pathname={usePathname()}/>;
}
