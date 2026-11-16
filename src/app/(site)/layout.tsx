import type { ReactNode } from "react";
import { casesEnabled } from "@/lib/config";
import { getCurrentUser } from "@/lib/current-user";
import { canUseAi } from "@/lib/membership";
import { BottomNavSlot, Footer, Header } from "@/components/site-frame";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const showCases = casesEnabled();
  const showAi = canUseAi(user);
  return (
    <>
      <Header user={user} showCases={showCases} showAi={showAi} />
      <main className="page">{children}</main>
      <Footer />
      <BottomNavSlot showCases={showCases} />
    </>
  );
}
