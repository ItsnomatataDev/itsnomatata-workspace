import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase/client";

type AuthContextType = {
  user: any;
  profile: any;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

const fetchProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        *,
        organization:organizations(*)
      `,
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("PROFILE FETCH ERROR:", error);
      setProfile(null);
      return;
    }

    console.log("PROFILE DATA:", data);
    setProfile(data ?? null);
  } catch (err) {
    console.error("PROFILE FETCH CRASH:", err);
    setProfile(null);
  }
};
  const refreshProfile = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await fetchProfile(session.user.id);
      }
    } catch (err) {
      console.error("REFRESH PROFILE ERROR:", err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        setLoading(true);

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("GET SESSION ERROR:", error);
        }

        const sessionUser = session?.user ?? null;

        if (!mounted) return;

        setUser(sessionUser);

        if (sessionUser) {
          await fetchProfile(sessionUser.id);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("AUTH INITIALIZE ERROR:", err);
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      const sessionUser = session?.user ?? null;

      void (async () => {
        try {
          setLoading(true);
          setUser(sessionUser);

          if (sessionUser) {
            await fetchProfile(sessionUser.id);
          } else {
            setProfile(null);
          }
        } catch (err) {
          console.error("AUTH STATE CHANGE ERROR:", err);
          setProfile(null);
        } finally {
          setLoading(false);
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
