import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EditUserDialog } from "@/components/admin/edit-user-dialog";
import { SubscriptionToggle } from "@/components/admin/subscription-toggle";
import { unitLabel } from "@/lib/data";
import { isActiveStatus } from "@/lib/utils";
import type { CurrentUser } from "@/lib/types";

/** Whole-subtree active/expired counts (every descendant, not just direct reports) for every uid that has one. */
function buildSubtreeCounts(users: CurrentUser[]): Map<string, { active: number; expired: number }> {
  const childrenByParent = new Map<string | null, CurrentUser[]>();
  for (const user of users) {
    const key = user.uplineId;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(user);
  }

  const memo = new Map<string, { active: number; expired: number }>();
  function countBelow(uid: string): { active: number; expired: number } {
    const cached = memo.get(uid);
    if (cached) return cached;
    let active = 0;
    let expired = 0;
    for (const child of childrenByParent.get(uid) ?? []) {
      if (isActiveStatus(child)) active++;
      else expired++;
      const below = countBelow(child.uid);
      active += below.active;
      expired += below.expired;
    }
    const result = { active, expired };
    memo.set(uid, result);
    return result;
  }
  for (const user of users) countBelow(user.uid);
  return memo;
}

export function UserTable({ users, units }: { users: CurrentUser[]; units: Record<string, string> }) {
  const subtreeCounts = buildSubtreeCounts(users);
  const nameByUid = new Map(users.map((u) => [u.uid, u.name]));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Daie ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Rank</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Structure</TableHead>
          <TableHead>Upline</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const counts = subtreeCounts.get(user.uid);
          const hasChildren = !!counts && counts.active + counts.expired > 0;
          const active = isActiveStatus(user);
          return (
            <TableRow key={user.uid}>
              <TableCell className="font-mono text-xs">{user.daieId}</TableCell>
              <TableCell className="font-medium">
                {user.name}
                {user.isGroupAdmin && (
                  <Badge variant="accent" className="ml-2">Group Admin</Badge>
                )}
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </TableCell>
              <TableCell><Badge variant="outline">{user.rank}</Badge></TableCell>
              <TableCell>{unitLabel(user.unitId, units)}</TableCell>
              <TableCell>{user.structureType}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {user.uplineId ? (nameByUid.get(user.uplineId) ?? "—") : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={active ? "success" : "destructive"}>{active ? "Active" : "Non-Active (Expired)"}</Badge>
                {hasChildren && (
                  <div className="mt-1 text-[11px] leading-tight text-muted-foreground">
                    <span className="font-semibold text-success">{counts.active} active</span>
                    {" · "}
                    <span className="font-semibold text-red-700">{counts.expired} expired</span>
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <EditUserDialog user={user} units={units} users={users} />
                  <SubscriptionToggle uid={user.uid} status={user.subscriptionStatus} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
