"use client";

import { useState } from "react";
import { Check, Minus, Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/constants";
import { demoNow, dispatch, useCurrentMember, useDemoState } from "@/lib/demo/store";
import { formatRelative } from "@/lib/format";
import { ALL_PERMISSIONS, can, PERMISSION_LABELS } from "@/lib/permissions";
import type { Member, Role } from "@/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function MemberDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
}) {
  const me = useCurrentMember();
  const allStores = useDemoState((s) => s.stores);
  const stores = allStores.filter((s) => s.organizationId === me.organizationId);
  const members = useDemoState((s) => s.members);
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [role, setRole] = useState<Exclude<Role, "owner">>(member?.role === "staff" ? "staff" : member ? "manager" : "staff");
  const [storeIds, setStoreIds] = useState<string[]>(member?.storeIds ?? []);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!member) {
      if (!name.trim()) return setError("氏名を入力してください");
      if (!EMAIL_PATTERN.test(email.trim())) return setError("メールアドレスの形式が正しくありません");
      if (members.some((m) => m.email.toLowerCase() === email.trim().toLowerCase()))
        return setError("このメールアドレスは既に登録されています");
    }
    if (storeIds.length === 0) return setError("担当店舗を1つ以上選んでください");
    const at = demoNow();
    if (member) {
      dispatch({ type: "updateMember", memberId: member.id, role, storeIds, at });
      toast.success(`${member.name}さんの権限を変更しました`);
    } else {
      dispatch({
        type: "inviteMember",
        member: {
          id: `user_${Date.now()}`,
          organizationId: me.organizationId,
          name: name.trim(),
          email: email.trim(),
          role,
          storeIds,
          lineLinked: false,
          lastActiveAt: at,
          invited: true,
        },
        at,
      });
      toast.success("招待を作成しました", { description: "Phase 2 で招待メールの送信を実装します" });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? `${member.name}さんの権限を変更` : "担当者を招待"}</DialogTitle>
          <DialogDescription>オーナー権限は招待では付与できません（変更はなまらグルメのサポート経由）。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!member ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="invite-name">氏名</Label>
                <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">メールアドレス</Label>
                <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="invite-role">権限</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Exclude<Role, "owner">)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">店長（承認・設定まで可能）</SelectItem>
                <SelectItem value="staff">スタッフ（返信案の作成・承認依頼まで）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">担当店舗</legend>
            {stores.map((s) => {
              const checked = storeIds.includes(s.id);
              return (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--brand)]"
                    checked={checked}
                    onChange={() => setStoreIds((ids) => (checked ? ids.filter((id) => id !== s.id) : [...ids, s.id]))}
                  />
                  {s.name}
                </label>
              );
            })}
          </fieldset>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">キャンセル</Button>
          </DialogClose>
          <Button onClick={submit}>{member ? "変更を保存" : "招待する"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MembersPanel() {
  const me = useCurrentMember();
  const allMembers = useDemoState((s) => s.members);
  const stores = useDemoState((s) => s.stores);
  // 自分の法人のメンバーだけを扱う
  const members = allMembers.filter((m) => m.organizationId === me.organizationId);
  const isOwner = me.role === "owner";
  const [dialog, setDialog] = useState<{ open: boolean; member: Member | null; key: number }>({ open: false, member: null, key: 0 });
  const [removing, setRemoving] = useState<Member | null>(null);

  // オーナー以外は、自分と担当店舗が重なる人だけを表示する
  const visibleMembers = isOwner
    ? members
    : members.filter((m) => m.role === "owner" || m.storeIds.some((id) => me.storeIds.includes(id)));
  const storeName = (id: string) => stores.find((s) => s.id === id)?.shortName ?? id;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>担当者</CardTitle>
            <CardDescription>担当店舗以外の口コミ・設定は表示されません。</CardDescription>
          </div>
          {isOwner ? (
            <Button size="sm" onClick={() => setDialog((d) => ({ open: true, member: null, key: d.key + 1 }))}>
              <UserPlus aria-hidden />
              招待
            </Button>
          ) : null}
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>権限</TableHead>
              <TableHead>担当店舗</TableHead>
              <TableHead>LINE</TableHead>
              <TableHead>最終利用</TableHead>
              {isOwner ? <TableHead className="text-right">操作</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleMembers.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <span className="block font-medium">
                    {m.name}
                    {m.id === me.id ? <span className="ml-1 text-xs text-muted-foreground">（あなた）</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{m.email}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={m.role === "owner" ? "default" : m.role === "manager" ? "brand" : "secondary"}>
                    {ROLE_LABELS[m.role]}
                  </Badge>
                  {m.invited ? <Badge variant="warning" className="ml-1">招待中</Badge> : null}
                </TableCell>
                <TableCell className="max-w-56 whitespace-normal text-xs">
                  {m.role === "owner" ? "全店舗" : m.storeIds.map(storeName).join("、")}
                </TableCell>
                <TableCell className="text-xs">{m.lineLinked ? "連携済み" : "未連携"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{m.invited ? "—" : formatRelative(m.lastActiveAt)}</TableCell>
                {isOwner ? (
                  <TableCell className="text-right">
                    {m.role !== "owner" ? (
                      <span className="inline-flex gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`${m.name}さんの権限を変更`}
                          onClick={() => setDialog((d) => ({ open: true, member: m, key: d.key + 1 }))}
                        >
                          <Pencil />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`${m.name}さんを削除`} onClick={() => setRemoving(m)}>
                          <Trash2 className="text-destructive" />
                        </Button>
                      </span>
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isOwner ? (
          <CardContent className="pt-4 text-xs text-muted-foreground">担当者の招待・権限変更はオーナーのみ可能です。</CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>権限ごとにできること</CardTitle>
          <CardDescription>Phase 2 では同じルールをデータベース（RLS）とサーバー側でも強制します。</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>操作</TableHead>
              {(["owner", "manager", "staff"] as const).map((r) => (
                <TableHead key={r} className="text-center">
                  {ROLE_LABELS[r]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ALL_PERMISSIONS.map((p) => (
              <TableRow key={p}>
                <TableCell className="text-sm">{PERMISSION_LABELS[p]}</TableCell>
                {(["owner", "manager", "staff"] as const).map((r) => (
                  <TableCell key={r} className="text-center">
                    {can(r, p) ? (
                      <Check className="mx-auto size-4 text-success" aria-label="可能" />
                    ) : (
                      <Minus className="mx-auto size-4 text-muted-foreground" aria-label="不可" />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <MemberDialog
        key={dialog.key}
        open={dialog.open}
        member={dialog.member}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{removing?.name}さんを削除しますか？</DialogTitle>
            <DialogDescription>削除すると、この担当者はNAMARA REVIEWにログインできなくなります。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">キャンセル</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (removing) {
                  dispatch({ type: "removeMember", memberId: removing.id, at: demoNow() });
                  toast.success(`${removing.name}さんを削除しました`);
                }
                setRemoving(null);
              }}
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
