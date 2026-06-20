import { redirect } from "next/navigation";
import { currentUser } from "@/lib/authz";
import { Sidebar } from "@/components/sidebar";
import { AppMain } from "@/components/app-main";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="h-screen flex-1 overflow-y-auto scrollbar-thin">
        <AppMain>{children}</AppMain>
      </main>
    </div>
  );
}
