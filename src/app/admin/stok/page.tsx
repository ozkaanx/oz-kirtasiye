import type { Metadata } from "next";
import { InventoryDemo } from "@/components/admin/inventory-demo";
export const metadata:Metadata={title:"Manuel Stok Yönetimi - Demo",robots:{index:false,follow:false}};
export default function Page(){return <InventoryDemo/>}
