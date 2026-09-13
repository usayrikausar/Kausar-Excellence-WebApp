import { requireGroupAdmin } from "@/lib/auth/session";
import { BulletinForm } from "@/components/daie/bulletin-form";

export default async function NewBulletinPage() {
  const user = await requireGroupAdmin();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">New bulletin post</h1>
      <BulletinForm createdBy={user.uid} />
    </div>
  );
}
