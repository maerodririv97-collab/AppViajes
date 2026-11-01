import { ArrowRight, HandCoins, PiggyBank, Receipt, UserRound, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Money } from "../../../components/ui/Money";
import { ProgressBar } from "../../../components/ui/ProgressBar";
import { categoryMeta } from "../../../lib/categories";
import { roundMoney } from "../../../lib/format";
import type { Debt } from "../../../types";
import type { TripData } from "../tripData";

function StatTile({
  icon: Icon,
  label,
  value,
  currency,
  signed,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  currency: string;
  signed?: boolean;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon size={15} className="text-teal-600" /> {label}
      </div>
      <Money value={value} currency={currency} signed={signed} className="text-xl font-semibold" />
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function DebtList({
  title,
  debts,
  currency,
  empty,
}: {
  title: string;
  debts: Debt[];
  currency: string;
  empty: string;
}) {
  return (
    <div className="card p-4">
      <div className="mb-3 font-medium">{title}</div>
      {debts.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {debts.map((d) => (
            <li key={`${d.debtor_id}-${d.creditor_id}`} className="flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="font-medium">{d.debtor_name}</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="font-medium">{d.creditor_name}</span>
              </span>
              <Money value={d.amount} currency={currency} className="font-semibold text-amber-700" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lo de la cuenta actual: su disponible, su billetera y las deudas donde participa. */
function MySummary({ data, personId }: { data: TripData; personId: number }) {
  const cur = data.trip.currency;
  const b = data.balances.find((x) => x.person_id === personId);
  if (!b) return null;
  const wallet = data.walletBalances.find((w) => w.person_id === personId);
  const debts = [...data.debts, ...data.walletDebts];
  const iOwe = debts.filter((d) => d.debtor_id === personId);
  const owedToMe = debts.filter((d) => d.creditor_id === personId);

  return (
    <div className="card border-teal-200 p-4">
      <div className="mb-3 flex items-center gap-2 font-medium">
        <UserRound size={16} className="text-teal-600" /> Tu resumen · {b.name}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div>
          <div className="text-xs text-slate-500">Pusiste</div>
          <Money value={b.budget} currency={cur} className="text-lg font-semibold" />
        </div>
        <div>
          <div className="text-xs text-slate-500">Te queda de lo tuyo</div>
          <Money value={b.budget - b.spent} currency={cur} signed className="text-lg font-semibold" />
        </div>
        <div>
          <div className="text-xs text-slate-500">Disponible en presupuesto</div>
          <Money value={b.available} currency={cur} signed className="text-lg font-semibold" />
        </div>
        <div>
          <div className="text-xs text-slate-500">Billetera</div>
          <Money value={wallet?.balance ?? 0} currency={cur} signed className="text-lg font-semibold" />
        </div>
      </div>
      {(iOwe.length > 0 || owedToMe.length > 0) && (
        <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm">
          {iOwe.map((d, i) => (
            <li key={`owe-${i}`} className="flex justify-between">
              <span>
                Le debes a <strong>{d.creditor_name}</strong>
              </span>
              <Money value={d.amount} currency={cur} className="font-semibold text-amber-700" />
            </li>
          ))}
          {owedToMe.map((d, i) => (
            <li key={`owed-${i}`} className="flex justify-between">
              <span>
                <strong>{d.debtor_name}</strong> te debe
              </span>
              <Money value={d.amount} currency={cur} className="font-semibold text-sky-700" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SummaryTab({ data }: { data: TripData }) {
  const { trip, balances, expenses, debts, walletBalances, walletDebts } = data;
  const cur = trip.currency;
  const totalBudget = balances.reduce((s, b) => s + b.budget, 0);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const pendingDebt = [...debts, ...walletDebts].reduce((s, d) => s + d.amount, 0);
  const debtCount = debts.length + walletDebts.length;

  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  if (balances.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Este viaje aún no tiene integrantes. Agrégalos en la pestaña Integrantes.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {data.myPersonId != null && <MySummary data={data} personId={data.myPersonId} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={PiggyBank} label="Presupuesto" value={totalBudget} currency={cur} />
        <StatTile
          icon={Receipt}
          label="Gastado"
          value={totalSpent}
          currency={cur}
          hint={totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)} % del presupuesto` : undefined}
        />
        <StatTile icon={Wallet} label="Queda (puesto − gastado)" value={totalBudget - totalSpent} currency={cur} signed />
        <StatTile
          icon={HandCoins}
          label="Deudas pendientes"
          value={pendingDebt}
          currency={cur}
          hint={debtCount ? `${debtCount} deuda(s) abiertas` : "Sin deudas"}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 font-medium">Estado por persona</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Persona</th>
                <th className="th text-right">Puso</th>
                <th className="th text-right" title="Su parte de todos los gastos, sin importar quién los pagó">
                  Gastó
                </th>
                <th className="th text-right" title="Lo que puso menos lo que ha gastado">
                  Le queda de lo suyo
                </th>
                <th className="th text-right" title="Gastos que pagó otro o partes cubiertas con préstamo">
                  Deuda por gastos
                </th>
                <th className="th text-right" title="Le queda de lo suyo + lo que debe por gastos − lo que le deben">
                  Disponible en presupuesto
                </th>
                <th className="th text-right" title="Plata fuera del presupuesto (pestaña Billetera)">
                  Billetera
                </th>
                <th className="th w-36">Consumo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {balances.map((b) => {
                const own = b.budget - b.spent;
                const debt = roundMoney(b.net_debt, cur);
                const wallet = walletBalances.find((w) => w.person_id === b.person_id);
                return (
                  <tr key={b.person_id} className={b.person_id === data.myPersonId ? "bg-teal-50/50" : undefined}>
                    <td className="td font-medium">
                      {b.name}
                      {b.person_id === data.myPersonId && <span className="ml-1 text-xs text-teal-700">(tú)</span>}
                    </td>
                    <td className="td text-right">
                      <Money value={b.budget} currency={cur} />
                    </td>
                    <td className="td text-right">
                      <Money value={b.spent} currency={cur} />
                    </td>
                    <td className="td text-right font-semibold">
                      <Money value={own} currency={cur} signed />
                    </td>
                    <td className="td text-right text-xs">
                      {debt > 0 && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                          debe <Money value={debt} currency={cur} />
                        </span>
                      )}
                      {debt < 0 && (
                        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-700">
                          le deben <Money value={-debt} currency={cur} />
                        </span>
                      )}
                      {debt === 0 && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="td text-right">
                      <Money value={b.available} currency={cur} signed />
                    </td>
                    <td className="td text-right text-slate-500">
                      <Money value={wallet?.balance ?? 0} currency={cur} signed />
                    </td>
                    <td className="td">
                      <ProgressBar used={b.spent} total={b.budget} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          <strong>Le queda de lo suyo</strong> = lo que puso − lo que ha gastado (su parte real de los gastos).{" "}
          <strong>Disponible en presupuesto</strong> incluye los gastos cubiertos por otros: quien debe tiene más
          disponible de lo que realmente le queda. Los préstamos de plata suelta van en la <strong>Billetera</strong> y
          no tocan el presupuesto.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <div className="mb-3 font-medium">Gasto por categoría</div>
          {categories.length === 0 ? (
            <p className="text-sm text-slate-500">Todavía no hay gastos registrados.</p>
          ) : (
            <div className="space-y-3">
              {categories.map(([name, amount]) => {
                const meta = categoryMeta(name);
                const Icon = meta.icon;
                return (
                  <div key={name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className={`rounded p-1 ${meta.color}`}>
                          <Icon size={13} />
                        </span>
                        {name}
                      </span>
                      <Money value={amount} currency={cur} className="font-medium" />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{ width: `${(amount / totalSpent) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <DebtList title="Deudas por gastos" debts={debts} currency={cur} empty="Nadie le debe gastos a nadie." />
          <DebtList
            title="Deudas de billetera (préstamos de plata)"
            debts={walletDebts}
            currency={cur}
            empty="No hay préstamos de plata pendientes."
          />
        </div>
      </div>
    </div>
  );
}
