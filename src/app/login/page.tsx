import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign In · RiderHub 360",
  description: "Sign in to your RiderHub 360 association workspace",
};

export default function LoginPage() {
  return <LoginForm />;
}
