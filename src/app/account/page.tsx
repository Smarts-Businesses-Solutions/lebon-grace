import type { Metadata } from "next";
import AccountClient from "./AccountClient";

export const metadata: Metadata = {
  title: "My Account — Lebon Grace",
  description: "View your order history and account details at Lebon Grace.",
};

export default function AccountPage() {
  return <AccountClient />;
}
