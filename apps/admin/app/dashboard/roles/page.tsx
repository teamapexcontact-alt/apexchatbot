"use client";

import { useEffect, useState } from "react";
import { getDb$ } from "@/lib/firebase-client";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useRole } from "@/hooks/useRole";

export default function RolesPage() {
  useAuthGuard();
  const { roleInfo } = useRole();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/roles");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setMessage("Error loading users: " + err.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateRole = async (uid: string, role: string, projectIds: string[]) => {
    setMessage("");
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, role, projectIds }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`Role updated successfully`);
        fetchUsers();
      } else {
        setMessage("Error: " + data.error);
      }
    } catch (err: any) {
      setMessage("Error: " + err.message);
    }
  };

  if (loading) return <p className="text-neutral-400">Loading users...</p>;
  if (roleInfo?.role !== "super_admin") return <p className="text-neutral-400">Access denied. Only Super Admins can manage roles.</p>;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">User Roles</h1>

      {message && (
        <div className="mb-4 rounded-lg bg-neutral-800 px-4 py-2 text-sm text-neutral-300">{message}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {users.map((u: any) => (
              <tr key={u.uid} className="hover:bg-neutral-900/50">
                <td className="px-4 py-3 text-neutral-300">{u.email}</td>
                <td className="px-4 py-3 text-neutral-300">{u.displayName || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    u.role === "super_admin"
                      ? "bg-purple-900 text-purple-300"
                      : u.role === "client_admin"
                      ? "bg-blue-900 text-blue-300"
                      : "bg-neutral-800 text-neutral-300"
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select
                    defaultValue={u.role}
                    onChange={(e) => {
                      const role = e.target.value;
                      if (role !== u.role) {
                        if (confirm(`Set ${u.email} to ${role}?`)) {
                          updateRole(u.uid, role, u.projectIds);
                        }
                      }
                    }}
                    className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="client_admin">Client Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && !loading && (
        <p className="mt-4 text-neutral-500">No users found. Make sure Firebase Auth has users.</p>
      )}
    </div>
  );
}
