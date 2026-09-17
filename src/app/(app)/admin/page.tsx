import { requireGroupAdmin } from "@/lib/auth/session";
import { getAllUsers, getUnits } from "@/lib/data";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { DaieDirectoryCard } from "@/components/admin/daie-directory-card";

export default async function AdminPage() {
  await requireGroupAdmin();
  const [users, units] = await Promise.all([getAllUsers(), getUnits()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">Admin</h1>
        <p className="text-sm text-muted-foreground">Group-admin only — manage every daie across all 5 units.</p>
      </div>

      <CreateUserForm units={units} users={users} />

      <DaieDirectoryCard users={users} units={units} />
    </div>
  );
}
