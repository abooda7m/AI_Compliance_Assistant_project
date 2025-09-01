import { useNavigate } from "react-router-dom";
import { supabase } from "src/supabaseClient";

export default function LogoutButton({ className }: { className?: string }) {
  const nav = useNavigate();

  const onLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("pendingOnboarding");
      nav("/login", { replace: true });
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <button type="button" className={className ?? "btn btn-ghost w-full text-left"} onClick={onLogout}>
      Logout
    </button>
  );
}
