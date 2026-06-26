"use client";

import { useEffect, useState } from "react";
import { getDb$ } from "@/lib/firebase-client";
import { collection, getDocs, query, orderBy, limit, startAfter, where, Timestamp } from "firebase/firestore";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useRole } from "@/hooks/useRole";

const PAGE_SIZE = 50;

export default function AuditLogsPage() {
  useAuthGuard();
  const { roleInfo } = useRole();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("");
  const [lastDoc, setLastDoc] = useState<any>(null);

  const fetchLogs = async (loadMore = false) => {
    const db = getDb$()!;
    let q: any;
    if (filterAction) {
      q = loadMore && lastDoc
        ? query(collection(db, "audit_logs"), where("action", "==", filterAction), orderBy("timestamp", "desc"), startAfter(lastDoc), limit(PAGE_SIZE))
        : query(collection(db, "audit_logs"), where("action", "==", filterAction), orderBy("timestamp", "desc"), limit(PAGE_SIZE));
    } else {
      q = loadMore && lastDoc
        ? query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), startAfter(lastDoc), limit(PAGE_SIZE))
        : query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(PAGE_SIZE));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() as Record<string, any> }));
    if (loadMore) {
      setLogs((prev) => [...prev, ...items]);
    } else {
      setLogs(items);
    }
    setLastDoc(snap.docs[snap.docs.length - 1] || null);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    setLastDoc(null);
    fetchLogs();
  }, [filterAction]);

  const actions = [
    { value: "", label: "All" },
    { value: "update_role", label: "Role Updates" },
    { value: "create_project", label: "Project Created" },
    { value: "delete_project", label: "Project Deleted" },
    { value: "create_faq", label: "FAQ Created" },
    { value: "delete_faq", label: "FAQ Deleted" },
    { value: "create_lead", label: "Lead Created" },
    { value: "update_lead", label: "Lead Updated" },
    { value: "delete_lead", label: "Lead Deleted" },
    { value: "create_flow", label: "Flow Created" },
    { value: "update_flow", label: "Flow Updated" },
    { value: "delete_flow", label: "Flow Deleted" },
    { value: "upload_document", label: "Document Uploaded" },
    { value: "delete_document", label: "Document Deleted" },
    { value: "convert_failed_query", label: "Failed Query Converted" },
    { value: "synonym_updated", label: "Synonym Updated" },
  ];

  if (loading) return <p className="text-neutral-400">Loading audit logs...</p>;
  if (roleInfo?.role !== "super_admin") return <p className="text-neutral-400">Access denied. Only Super Admins can view audit logs.</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white"
        >
          {actions.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
        <span className="text-sm text-neutral-500">{logs.length} entries</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Resource</th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="px-4 py-3 font-medium">User Email</th>
              <th className="px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {logs.map((log: any) => (
              <tr key={log.id} className="hover:bg-neutral-900/50">
                <td className="px-4 py-3 text-neutral-300 whitespace-nowrap">
                  {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-300">
                  {log.resource}
                  {log.resourceId ? <span className="ml-1 text-neutral-500">#{log.resourceId.slice(0, 8)}</span> : null}
                </td>
                <td className="px-4 py-3 text-neutral-300 max-w-[300px] truncate">{log.details || "—"}</td>
                <td className="px-4 py-3 text-neutral-300">{log.userEmail || "—"}</td>
                <td className="px-4 py-3 text-neutral-500">{log.ip || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lastDoc && (
        <button
          onClick={() => fetchLogs(true)}
          className="mt-4 rounded-lg bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
        >
          Load More
        </button>
      )}
    </div>
  );
}
