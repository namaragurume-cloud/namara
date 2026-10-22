"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { PLANS } from "@/lib/constants";
import { demoNow, dispatch, useDemoState } from "@/lib/demo/store";
import { organizationPath, validateSlug } from "@/lib/organizations";
import type { PlanId } from "@/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateOrganizationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const organizations = useDemoState((s) => s.organizations);
  const members = useDemoState((s) => s.members);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState<PlanId>("standard");
  const [trial, setTrial] = useState("trial");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const normalizedSlug = slug.trim().toLowerCase();
    const email = ownerEmail.trim().toLowerCase();
    if (!name.trim()) return setError("法人名を入力してください");
    const slugError = validateSlug(normalizedSlug, organizations.map((o) => o.slug));
    if (slugError) return setError(`法人ID：${slugError}`);
    if (!ownerName.trim()) return setError("オーナーの氏名を入力してください");
    if (!EMAIL_PATTERN.test(email)) return setError("オーナーのメールアドレスの形式が正しくありません");
    if (members.some((m) => m.email.toLowerCase() === email)) return setError("このメールアドレスは既に登録されています");

    const id = `org_${normalizedSlug}`;
    const at = demoNow();
    const ok = dispatch({
      type: "createOrganization",
      organization: { id, slug: normalizedSlug, name: name.trim(), plan, contractStatus: trial === "trial" ? "trial" : "active" },
      owner: {
        id: `user_${normalizedSlug}_owner`,
        organizationId: id,
        name: ownerName.trim(),
        email,
        role: "owner",
        storeIds: [],
        lineLinked: false,
        lastActiveAt: at,
      },
      at,
    });
    if (!ok) return setError("発行できませんでした。入力内容を確認してください");
    toast.success(`${name.trim()} の専用ページを発行しました`, {
      description: `URL：${organizationPath(normalizedSlug)}（デモではログイン画面から ${email} で入れます）`,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-brand" aria-hidden />
            新しい法人の専用ページを発行
          </DialogTitle>
          <DialogDescription>
            契約した法人ごとに専用のURLとデータ領域を作ります。オーナーはログイン後、自社の専用ページだけを利用できます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">法人名・屋号</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：株式会社スープカレー工房" maxLength={60} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">法人ID（URLに使われます）</Label>
            <div className="flex items-center rounded-md border border-input bg-card pl-3 text-sm shadow-xs focus-within:border-ring">
              <span className="shrink-0 text-muted-foreground">/o/</span>
              <input
                id="org-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="soupcurry-kobo"
                className="h-10 min-w-0 flex-1 bg-transparent px-1 outline-none"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
            <p className="text-xs text-muted-foreground">半角英小文字・数字・ハイフン。後から変更しない前提で決めてください。</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-plan">プラン</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as PlanId)}>
                <SelectTrigger id="org-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PLANS) as PlanId[]).map((id) => (
                    <SelectItem key={id} value={id}>
                      {PLANS[id].name}（{PLANS[id].stores}店舗まで）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-status">契約状況</Label>
              <Select value={trial} onValueChange={setTrial}>
                <SelectTrigger id="org-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">無料トライアル</SelectItem>
                  <SelectItem value="active">契約中</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="owner-name">オーナー氏名</Label>
              <Input id="owner-name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={40} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-email">オーナーのメールアドレス</Label>
              <Input id="owner-email" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Phase 2 では、発行と同時にオーナーへ招待メールを送り、本人がパスワードを設定してログインします（デモでは送信しません）。
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">キャンセル</Button>
          </DialogClose>
          <Button onClick={submit}>発行する</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
