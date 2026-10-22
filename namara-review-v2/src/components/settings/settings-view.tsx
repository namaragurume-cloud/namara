"use client";

import { Bell, CreditCard, Link2, Sparkles, Store as StoreIcon, Users } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Card } from "@/components/ui/card";
import { AddStoreButton } from "./add-store-dialog";

import { PageHeader } from "@/components/common/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentMember } from "@/lib/demo/store";
import { can } from "@/lib/permissions";
import { IntegrationsPanel } from "./integrations-panel";
import { MembersPanel } from "./members-panel";
import { NotificationsForm } from "./notifications-form";
import { PlanPanel } from "./plan-panel";
import { PolicyForm } from "./policy-form";
import { StoreInfoForm } from "./store-info-form";
import { StoreScopeSelect } from "./store-scope-select";
import { useStoreScope } from "./use-store-scope";

export function SettingsView() {
  const me = useCurrentMember();
  const { stores, store, showPicker, setPicked } = useStoreScope();
  if (!store) {
    return (
      <div className="space-y-5">
        <PageHeader title="店舗設定" />
        <Card>
          <EmptyState
            icon={StoreIcon}
            title="まだ店舗が登録されていません"
            description={me.role === "owner" ? "最初の店舗を追加すると、口コミ管理を始められます。" : "オーナーに担当店舗の設定を依頼してください。"}
            action={<AddStoreButton variant="default" />}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="店舗設定"
        description={showPicker ? "設定する店舗を選んでください" : store.name}
        actions={
          <>
            {showPicker ? <StoreScopeSelect stores={stores} value={store.id} onChange={setPicked} /> : null}
            <AddStoreButton />
          </>
        }
      />
      <Tabs defaultValue="store">
        <TabsList>
          <TabsTrigger value="store">
            <StoreIcon aria-hidden />
            店舗情報
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Link2 aria-hidden />
            連携
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell aria-hidden />
            通知
          </TabsTrigger>
          <TabsTrigger value="policy">
            <Sparkles aria-hidden />
            AI返信方針
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users aria-hidden />
            担当者・権限
          </TabsTrigger>
          {can(me.role, "billing.view") ? (
            <TabsTrigger value="plan">
              <CreditCard aria-hidden />
              契約プラン
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="store">
          <StoreInfoForm key={store.id} store={store} />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsPanel store={store} />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsForm key={store.id} store={store} />
        </TabsContent>
        <TabsContent value="policy">
          <PolicyForm key={store.id} store={store} />
        </TabsContent>
        <TabsContent value="members">
          <MembersPanel />
        </TabsContent>
        {can(me.role, "billing.view") ? (
          <TabsContent value="plan">
            <PlanPanel />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
