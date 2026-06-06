import AdminHealthDashboard from "@/components/admin/AdminHealthDashboard";

export const metadata = {
  title: "Admin Health | BTC Desk",
  description: "Platform health scores and observability.",
};

export default function AdminHealthPage() {
  return <AdminHealthDashboard />;
}
