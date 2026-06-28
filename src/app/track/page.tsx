import type { Metadata } from "next";
import TrackClient from "./TrackClient";

export const metadata: Metadata = {
  title: "Track Your Order — Lebon Grace",
  description: "Check the status of your Lebon Grace order. Enter your order ID and phone number.",
};

export default function TrackPage() {
  return <TrackClient />;
}
