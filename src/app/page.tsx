import { cookies } from "next/headers";
import { authenticated, cookieName } from "@/lib/auth";
import { Login } from "./login";
import { Workspace } from "./workspace";

export const dynamic = "force-dynamic";

export default async function Page() {
  return await authenticated(cookies().get(cookieName)?.value) ? <Workspace /> : <Login />;
}
