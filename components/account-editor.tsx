"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import type { Account } from "@/lib/types";
import { api, errorMessage } from "./client-api";
export function AccountEditor({
  account,
  demo,
}: {
  account: Account;
  demo: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <section className="account-editor">
      <div className="section-heading">
        <h2>Account details</h2>
      </div>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await api(
              "/api/accounts",
              {
                id: account.id,
                arr: Number(values.get("arr")),
                owner: values.get("owner"),
                renewal: values.get("renewal"),
              },
              "PATCH",
            );
            setMessage("Account updated.");
            router.refresh();
          } catch (error) {
            setMessage(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-three">
          <label>
            Annual revenue (USD)
            <input
              name="arr"
              type="number"
              min={0}
              max={1_000_000_000}
              defaultValue={account.arr}
              required
              disabled={demo || busy}
            />
          </label>
          <label>
            Account owner
            <input
              name="owner"
              defaultValue={account.owner}
              maxLength={120}
              disabled={demo || busy}
            />
          </label>
          <label>
            Renewal date
            <input
              name="renewal"
              type="date"
              defaultValue={account.renewal}
              disabled={demo || busy}
            />
          </label>
        </div>
        <button className="button" disabled={demo || busy}>
          <Save size={16} />
          Save account
        </button>
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
