import "../global.css";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { fetchProfile } from "@/lib/queries";

export function profileQueryKey(userId: string) {
  return ["profile", userId] as const;
}

const queryClient = new QueryClient();

function useProtectedRoute(
  session: Session | null,
  initialized: boolean,
  needsOnboarding: boolean | null
) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "(auth)";
    const onOnboarding = segments[0] === "onboarding";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace(needsOnboarding ? "/onboarding" : "/(tabs)");
    } else if (session && needsOnboarding && !onOnboarding) {
      router.replace("/onboarding");
    } else if (session && needsOnboarding === false && onOnboarding) {
      router.replace("/(tabs)");
    }
  }, [session, initialized, needsOnboarding, segments, router]);
}

function RootLayoutNav() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitialized(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: session ? profileQueryKey(session.user.id) : ["profile", "none"],
    queryFn: () => fetchProfile(session!.user.id),
    enabled: !!session,
  });

  const needsOnboarding =
    session && !profileLoading ? profile?.altura_cm == null : null;

  useEffect(() => {
    console.log('=== LAYOUT DEBUG ===')
    console.log('session:', session?.user?.id ?? 'NO SESSION')
    console.log('profileLoading:', profileLoading)
    console.log('profile:', JSON.stringify(profile))
    console.log('needsOnboarding:', needsOnboarding)
    console.log('====================')
  }, [session, profileLoading, profile, needsOnboarding])

  useEffect(() => {
    if (!session) return;

    supabase
      .from('profiles')
      .select('altura_cm')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        console.log('Profile query - userId:', session.user.id)
        console.log('Profile query - data:', data)
        console.log('Profile query - error:', error)
      });
  }, [session])

  useProtectedRoute(session, initialized, needsOnboarding);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <RootLayoutNav />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
