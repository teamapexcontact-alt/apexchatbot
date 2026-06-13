"use client";

import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState, useCallback } from "react";
import type { Order } from "@apex/shared";
import { use } from "react";

const statuses: Order["status"][] = ["pending", "processing", "shipped", "delivered", "cancelled"];

export default function ClientOrdersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState({ orderId: "", customerName: "", email: "", item: "", amount: "", status: "pending" as Order["status"] });

  useEffect(() => {
    const unsub = onSnapshot(collection(getDb$()!, "orders"), (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)).filter((o) => o.projectId === projectId));
    });
    return unsub;
  }, [projectId]);

  const create = useCallback(async () => {
    if (!form.orderId.trim() || !form.customerName.trim()) return;
    await addDoc(collection(getDb$()!, "orders"), { projectId, orderId: form.orderId, customerName: form.customerName, email: form.email, item: form.item, amount: form.amount, status: form.status, date: new Date().toISOString().split("T")[0], createdAt: serverTimestamp() });
    setForm({ orderId: "", customerName: "", email: "", item: "", amount: "", status: "pending" });
  }, [form, projectId]);

  const updateStatus = useCallback(async (id: string, status: Order["status"]) => {
    await updateDoc(doc(getDb$()!, "orders", id), { status });
  }, []);

  const remove = useCallback(async (id: string) => {
    if (!confirm("Delete this order?")) return;
    await deleteDoc(doc(getDb$()!, "orders", id));
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Orders</h1>
      <details className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-300 hover:text-white select-none">+ Add Order</summary>
        <div className="grid gap-3 border-t border-neutral-800 p-4 sm:grid-cols-2">
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Order ID" value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })} />
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Customer" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Item" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <select className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Order["status"] })}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <button onClick={create} className="sm:col-span-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 transition">Add Order</button>
        </div>
      </details>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-neutral-800 text-left text-neutral-400"><th className="pb-2 pr-3">Order ID</th><th className="pb-2 pr-3">Customer</th><th className="pb-2 pr-3">Item</th><th className="pb-2 pr-3">Amount</th><th className="pb-2 pr-3">Status</th><th className="pb-2">Actions</th></tr></thead>
          <tbody>{orders.map((o) => (<tr key={o.id} className="border-b border-neutral-800/50"><td className="py-2 pr-3 font-mono text-xs text-indigo-300">#{o.orderId}</td><td className="py-2 pr-3">{o.customerName}<br /><span className="text-xs text-neutral-500">{o.email}</span></td><td className="py-2 pr-3">{o.item}</td><td className="py-2 pr-3">{o.amount}</td><td className="py-2 pr-3"><select className="rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs outline-none" value={o.status} onChange={(e) => updateStatus(o.id!, e.target.value as Order["status"])}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></td><td className="py-2"><button onClick={() => remove(o.id!)} className="text-xs text-red-400 hover:underline">Delete</button></td></tr>))}</tbody>
        </table>
        {orders.length === 0 && <p className="mt-4 text-sm text-neutral-500">No orders yet.</p>}
      </div>
    </div>
  );
}
