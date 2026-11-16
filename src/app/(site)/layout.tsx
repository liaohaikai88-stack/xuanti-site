import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/current-user";
import { BottomNavSlot, Footer, Header } from "@/components/site-frame";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <Header user={user} />
      <main className="page">{children}</main>
      <Footer />
      <BottomNavSlot />
    </>
  );
}
