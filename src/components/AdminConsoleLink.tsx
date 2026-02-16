"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export const AdminConsoleLink = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let ignore = false;
    const checkAdmin = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id ?? null;
      if (!userId) {
        if (!ignore) setIsAdmin(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .maybeSingle();
      if (!ignore) {
        setIsAdmin(Boolean(profile?.is_admin));
      }
    };
    checkAdmin();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });
    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  if (!isAdmin) return null;

  return (
    <Link
      className="mt-8 text-xs uppercase tracking-[0.3em] text-zinc-500 transition hover:text-amber-300"
      href="/admin"
    >
      Admin console
    </Link>
  );
};
