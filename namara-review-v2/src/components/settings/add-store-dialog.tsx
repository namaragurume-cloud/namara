"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
import { PLANS } from "@/lib/constants";
import { demoNow, dispatch, useCurrentMember, useCurrentOrganization, useDemoState } from "@/lib/demo/store";
import type { Store } from "@/lib/types";

/** 店舗の追加（オーナーのみ・プランの店舗数まで）。Phase 3 では Google のロケーションを選んで追加する */
export function AddStoreButton({ variant = "outline" }: { variant?: "outline" | "default" }) {
  const me = useCurrentMember();
  const organization = useCurrentOrganization();
  const stores = useDemoState((s) => s.stores);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (me.role !== "owner") return null;
  const count = stores.filter((s) => s.organizationId === organization.id).length;
  const limit = PLANS[organization.plan].stores;
  const full = count >= limit;

  function submit() {
    if (!name.trim()) return setError("店舗名を入力してください");
    const store: Store = {
      id: `store_${organization.slug}_${Date.now()}`,
      organizationId: organization.id,
      name: name.trim(),
      shortName: name.trim().slice(0, 16),
      genre: genre.trim(),
      area: area.trim(),
      address: "",
      phone: "",
      hours: "",
      googleStatus: "not_connected",
      googleLocationName: null,
      googleLastSyncedAt: null,
      lineStatus: "not_connected",
      policy: { tone: "friendly", signature: name.trim(), rules: [], ngWords: [], lowRatingGuidance: "", maxLength: 300 },
      notifications: {
        lineNewReview: true,
        lineLowRatingOnly: false,
        lowRatingThreshold: 2,
        lineDraftReady: true,
        linePublishResult: true,
        emailWeeklyReport: false,
      },
    };
    if (dispatch({ type: "addStore", store, at: demoNow() })) {
      toast.success(`${store.name} を追加しました`, { description: "Google連携（Phase 3）後に口コミが取り込まれます" });
      setOpen(false);
      setName("");
      setGenre("");
      setArea("");
    } else {
      setError("追加できませんでした");
    }
  }

  return (
    <>
      <Button
        variant={variant}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={full}
        title={full ? `${PLANS[organization.plan].name}プランの上限（${limit}店舗）に達しています` : undefined}
      >
        <Plus aria-hidden />
        店舗を追加（{count}/{limit}）
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>店舗を追加</DialogTitle>
            <DialogDescription>
              {PLANS[organization.plan].name}プランでは{limit}店舗まで登録できます（現在{count}店舗）。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-store-name">店舗名</Label>
              <Input id="new-store-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-store-genre">ジャンル</Label>
                <Input id="new-store-genre" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="例：スープカレー" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-store-area">エリア</Label>
                <Input id="new-store-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="例：札幌市北区" />
              </div>
            </div>
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
            <Button onClick={submit}>追加する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
