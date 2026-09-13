import { requireGroupAdmin } from "@/lib/auth/session";
import { getAllUsers, getUnits } from "@/lib/data";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { UserTable } from "@/components/admin/user-table";
import { ExportUsersCsvButton } from "@/components/admin/export-users-csv-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>All daie ({users.length})</CardTitle>
          <ExportUsersCsvButton users={users} units={units} />
        </CardHeader>
        <CardContent className="p-0">
          <UserTable users={users} units={units} />
        </CardContent>
      </Card>
    </div>
  );
}
