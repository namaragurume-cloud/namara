import { switchDemoAccount } from "@/app/actions/demo";
import { DEMO_ACCOUNTS } from "@/lib/server/demo-session";

export function DemoAccountSwitcher({ currentKey }: { currentKey?: string }) {
  return (
    <form action={switchDemoAccount} className="grid gap-2 sm:grid-cols-2">
      {DEMO_ACCOUNTS.map((a) => (
        <button
          key={a.key}
          type="submit"
          name="account"
          value={a.key}
          className={`rounded-lg border px-4 py-3 text-left transition-colors hover:border-blue hover:bg-blue-soft ${currentKey === a.key ? "border-blue bg-blue-soft" : "border-line bg-paper"}`}
        >
          <span className="block text-sm font-bold text-ink">{a.label}</span>
          <span className="block text-xs text-muted">{a.description}</span>
        </button>
      ))}
    </form>
  );
}
