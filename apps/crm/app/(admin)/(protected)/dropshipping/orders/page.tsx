import { requireRole } from "@/lib/auth/require-role";
import { getDropshippingOrders } from "@/lib/ecommerce/dropshipping/workflow";

export default async function DropshippingOrdersPage() {
  // Derive tenant from server-side CRM session
  const { org } = await requireRole(["admin", "manager"]);

  let orders = [];
  let errorMsg = null;

  try {
    orders = await getDropshippingOrders(org.orgId, 50);
  } catch (error: any) {
    errorMsg = error.message;
  }

  if (errorMsg) {
    return <div className="p-8 text-red-500">Error loading orders: {errorMsg}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Dropshipping Orders (Read-Only)</h1>
      <p className="mb-8 text-gray-600">
        This view displays orders synced from connected dropshipping providers for this tenant.
        Approvals and submissions are currently blocked pending schema updates.
      </p>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders && orders.length > 0 ? (
              orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.externalId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.provider}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.status}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(order.totalCents / 100).toFixed(2)} {order.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.orderedAt).toLocaleString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
