"use client";

import Link from "next/link";
import { Show, SignInButton, UserButton, useUser } from "@clerk/nextjs";

export default function Navbar() {
  const { user } = useUser();

  return (
    <nav className="sticky top-0 z-40 bg-[#1E2B24]/95 backdrop-blur-sm border-b border-[#F3EFE4]/10 px-6 md:px-16 py-3 flex items-center justify-between">
      <Link href="/" className="font-hand text-lg text-[#E8B94D] hover:text-[#F3EFE4] transition-colors">
        notebook-rag
      </Link>

      <div className="flex items-center gap-3">
        <Show when="signed-in">
          <span className="text-sm text-[#A9AF9F] hidden sm:inline">
            {user?.firstName ?? user?.username ?? "Account"}
          </span>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8 border border-[#E8B94D]/40",
              },
            }}
          />
        </Show>

        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="text-sm bg-[#E8B94D] text-[#1E2B24] font-semibold px-4 py-1.5 rounded-lg hover:bg-[#F3EFE4] transition-colors">
              Sign in
            </button>
          </SignInButton>
        </Show>
      </div>
    </nav>
  );
}