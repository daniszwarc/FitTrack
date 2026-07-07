import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { fetchDashboardData, fetchProfile } from "@/lib/queries";

const TARGETS = {
  calories: 2200,
  protein: 155,
  walkMinutes: 60,
};

function calcularEtapas(pesoActual: number, pesoObjetivo: number) {
  const diferencia = pesoActual - pesoObjetivo;
  const paso = diferencia / 4;
  return [
    Math.round((pesoActual - paso) * 2) / 2,
    Math.round((pesoActual - paso * 2) * 2) / 2,
    Math.round((pesoActual - paso * 3) * 2) / 2,
    pesoObjetivo,
  ];
}

function getWaistRisk(waistCm: number, alturaCm: number) {
  const ratio = waistCm / alturaCm;
  if (ratio >= 0.6) {
    return { label: "Riesgo alto", color: "#993C1D", background: "#FAECE7" };
  }
  if (ratio >= 0.5) {
    return { label: "Riesgo moderado", color: "#BA7517", background: "#FAEEDA" };
  }
  return { label: "Óptimo", color: "#0F6E56", background: "#E1F5EE" };
}

const COLORS = {
  teal: "#1D9E75",
  tealSoft: "#E1F5EE",
  background: "#f8f7f4",
  cardBorder: "#e8e7e1",
  textPrimary: "#2C2C2A",
  textSecondary: "#888780",
  blue: "#378ADD",
  orange: "#BA7517",
  white: "#ffffff",
  trackBg: "#f0efe9",
  circleBg: "#f8f7f4",
};

function formatToday() {
  const label = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function ProgressBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = Math.max(2, Math.min(100, Math.round((value / target) * 100)));
  return (
    <View style={styles.trackBg}>
      <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function InicioScreen() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => fetchDashboardData(user!.id),
    enabled: !!user?.id,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user?.id,
  });

  const name =
    user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "";

  const hasWeight = data?.weightKg != null;
  const hasWaist = data?.waistCm != null && profile?.altura_cm != null;
  const hasObjetivo = profile?.objetivo_kg != null;

  const stages =
    hasWeight && hasObjetivo
      ? calcularEtapas(data!.weightKg!, profile!.objetivo_kg!)
      : null;

  if (!user || isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.teal} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hola{name ? `, ${name}` : ""}</Text>
        <Text style={styles.headerDate}>{formatToday()}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={COLORS.teal}
          />
        }
      >
        {/* Métricas */}
        <View style={styles.metricsRow}>
          <View style={[styles.card, styles.metricCard]}>
            <SectionTitle>Peso actual</SectionTitle>
            <Text style={styles.metricValue}>
              {hasWeight ? `${data!.weightKg} kg` : "--"}
            </Text>
            <Text style={styles.metricTarget}>
              Objetivo: {hasObjetivo ? `${profile!.objetivo_kg} kg` : "--"}
            </Text>
          </View>
          <View style={[styles.card, styles.metricCard]}>
            <SectionTitle>Cintura</SectionTitle>
            <Text style={styles.metricValue}>
              {hasWaist ? `${data!.waistCm} cm` : "--"}
            </Text>
            {hasWaist ? (
              <View
                style={[
                  styles.riskBadge,
                  {
                    backgroundColor: getWaistRisk(data!.waistCm!, profile!.altura_cm!)
                      .background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.riskBadgeText,
                    { color: getWaistRisk(data!.waistCm!, profile!.altura_cm!).color },
                  ]}
                >
                  {getWaistRisk(data!.waistCm!, profile!.altura_cm!).label}
                </Text>
              </View>
            ) : (
              <Text style={styles.metricTarget}>--</Text>
            )}
          </View>
        </View>

        {/* Progreso por etapas */}
        {stages ? (
          <View style={styles.card}>
            <SectionTitle>Progreso por etapas</SectionTitle>
            <View style={styles.stagesList}>
              {stages.map((stage, i) => (
                <View
                  key={i}
                  style={[
                    styles.stageRow,
                    i < stages.length - 1 && styles.stageRowSpacing,
                  ]}
                >
                  <View
                    style={[
                      styles.stageCircle,
                      {
                        backgroundColor: i === 0 ? COLORS.tealSoft : COLORS.circleBg,
                        borderColor: i === 0 ? COLORS.teal : COLORS.cardBorder,
                        borderWidth: i === 0 ? 1.5 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stageNumber,
                        { color: i === 0 ? COLORS.teal : COLORS.textSecondary },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  </View>
                  <View style={styles.stageTextWrap}>
                    <Text style={styles.stageWeight}>{stage} kg</Text>
                    <Text style={styles.stageLabel}>Etapa {i + 1}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Hoy */}
        <View style={styles.card}>
          <SectionTitle>Hoy</SectionTitle>

          <View style={styles.todayRow}>
            <View style={styles.todayLabelRow}>
              <Text style={styles.todayLabel}>Calorías</Text>
              <Text style={styles.todayValue}>
                {data?.caloriesToday ?? 0} / {TARGETS.calories} kcal
              </Text>
            </View>
            <ProgressBar
              value={data?.caloriesToday ?? 0}
              target={TARGETS.calories}
              color={COLORS.teal}
            />
          </View>

          <View style={styles.todayRow}>
            <View style={styles.todayLabelRow}>
              <Text style={styles.todayLabel}>Proteína</Text>
              <Text style={styles.todayValue}>
                {data?.proteinToday ?? 0} / {TARGETS.protein} g
              </Text>
            </View>
            <ProgressBar
              value={data?.proteinToday ?? 0}
              target={TARGETS.protein}
              color={COLORS.blue}
            />
          </View>

          <View style={styles.todayRowLast}>
            <View style={styles.todayLabelRow}>
              <Text style={styles.todayLabel}>Caminata</Text>
              <Text style={styles.todayValue}>
                {data?.walkMinutesToday ?? 0} / {TARGETS.walkMinutes} min
              </Text>
            </View>
            <ProgressBar
              value={data?.walkMinutesToday ?? 0}
              target={TARGETS.walkMinutes}
              color={COLORS.orange}
            />
          </View>
        </View>

        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={styles.logoutButton}
        >
          <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  headerDate: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 96,
    gap: 12,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: COLORS.cardBorder,
    padding: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: COLORS.textSecondary,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  metricTarget: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.teal,
  },
  riskBadge: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  stagesList: {},
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stageRowSpacing: {
    marginBottom: 12,
  },
  stageCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stageNumber: {
    fontSize: 12,
    fontWeight: "600",
  },
  stageTextWrap: {
    marginLeft: 12,
  },
  stageWeight: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  stageLabel: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  todayRow: {
    marginBottom: 12,
  },
  todayRowLast: {},
  todayLabelRow: {
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  todayLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  todayValue: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  trackBg: {
    height: 7,
    width: "100%",
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: COLORS.trackBg,
  },
  trackFill: {
    height: "100%",
    borderRadius: 4,
  },
  logoutButton: {
    marginTop: 4,
    alignItems: "center",
    paddingVertical: 12,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#993C1D",
  },
});
