import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  redirect((await getSession()) ? "/app" : "/login");
}
