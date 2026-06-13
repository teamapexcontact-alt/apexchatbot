export interface Order {
  id: string;
  projectId: string;
  orderId: string;
  customerName: string;
  email: string;
  item: string;
  amount: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  date: string;
  createdAt: Date;
}
