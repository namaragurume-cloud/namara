import type { Metadata } from "next";
import { ChatDemo } from "@/components/ai/ChatDemo";

export const metadata: Metadata = { title: "なまらAI（Web版デモ）" };

export default function AiPage() {
  return (
    <>
      <p className="mb-4 rounded-lg border border-amber-200 bg-ad-soft px-3 py-2 text-xs text-amber-900">
        デモ版：表示される店舗はすべて<strong>架空</strong>です。価格・営業時間は架空データで、空席状況は確認していません。
      </p>
      <ChatDemo />
    </>
  );
}
