"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { setTokenGetter } from "@/lib/api";

export default function ApiAuthBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);

  return null;
}