import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  fetchWeightLogs,
  fetchLatestMeasurements,
  fetchWorkoutStreak,
  insertWeight,
  insertMeasurements,
  type WeightLog,
  type Measurement,
} from "@/lib/queries";

const COLORS = {
  teal: "#1D9E75",
  tealSoft: "#E1F5EE",
  background: "#f8f7f4",
  cardBorder: "#e8e7e1",
  textPrimary: "#2C2C2A",
  textSecondary: "#888780",
  white: "#ffffff",
  barSoft: "#9FE1CB",
  barActive: "#1D9E75",
  deltaDown: "#1D9E75",
  deltaUp: "#993C1D",
};

function formatFecha(fecha: string) {
  const [, month, day] = fecha.split("-");
  return `${day}/${month}`;
}

function WeightChart({ logs }: { logs: WeightLog[] }) {
  if (logs.length === 0) {
    return (
      <Text style={styles.emptyText}>
        Todavía no registraste tu peso. Empezá hoy.
      </Text>
    );
  }

  const values = logs.map((l) => l.peso_kg);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return (
    <View style={styles.chartRow}>
      {logs.map((log, i) => {
        const isLast = i === logs.length - 1;
        const heightPct = 20 + ((log.peso_kg - min) / range) * 80;
        return (
          <View key={log.id} style={styles.chartBarWrap}>
            <Text style={styles.chartValue}>{log.peso_kg}</Text>
            <View style={styles.chartBarTrack}>
              <View
                style={[
                  styles.chartBar,
                  {
                    height: `${heightPct}%`,
                    backgroundColor: isLast ? COLORS.barActive : COLORS.barSoft,
                  },
                ]}
              />
            </View>
            <Text style={styles.chartLabel}>{formatFecha(log.fecha)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function DeltaText({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (delta === 0) return <Text style={styles.deltaNeutral}> (sin cambios)</Text>;
  const isDown = delta < 0;
  return (
    <Text style={[styles.deltaText, isDown ? styles.deltaDown : styles.deltaUp]}>
      {" "}
      ({isDown ? "" : "+"}
      {delta.toFixed(1)})
    </Text>
  );
}

export default function StatsScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [streak, setStreak] = useState({
    streakDays: 0,
    gymSessionsThisWeek: 0,
    walkMinutesThisWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);

  const [measurementsModalVisible, setMeasurementsModalVisible] = useState(false);
  const [cinturaInput, setCinturaInput] = useState("");
  const [caderaInput, setCaderaInput] = useState("");
  const [cuelloInput, setCuelloInput] = useState("");
  const [munecaInput, setMunecaInput] = useState("");
  const [savingMeasurements, setSavingMeasurements] = useState(false);

  const loadData = useCallback(async (userId: string) => {
    const [weights, meas, streakData] = await Promise.all([
      fetchWeightLogs(userId, 7),
      fetchLatestMeasurements(userId, 2),
      fetchWorkoutStreak(userId),
    ]);
    setWeightLogs(weights);
    setMeasurements(meas);
    setStreak(streakData);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        await loadData(data.user.id);
      }
      setLoading(false);
    });
  }, [loadData]);

  async function handleRefresh() {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      await loadData(user.id);
    } finally {
      setRefreshing(false);
    }
  }

  function openWeightModal() {
    setWeightInput("");
    setWeightModalVisible(true);
  }

  function closeWeightModal() {
    setWeightModalVisible(false);
  }

  async function handleGuardarPeso() {
    if (!user?.id) return;
    const peso = parseFloat(weightInput);
    if (!peso || peso <= 0) {
      Alert.alert("Peso inválido", "Ingresá un peso válido.");
      return;
    }

    setSavingWeight(true);
    try {
      await insertWeight(user.id, peso);
      await loadData(user.id);
      closeWeightModal();
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar el peso. Intentá de nuevo.");
    } finally {
      setSavingWeight(false);
    }
  }

  function openMeasurementsModal() {
    setCinturaInput("");
    setCaderaInput("");
    setCuelloInput("");
    setMunecaInput("");
    setMeasurementsModalVisible(true);
  }

  function closeMeasurementsModal() {
    setMeasurementsModalVisible(false);
  }

  async function handleGuardarMedidas() {
    if (!user?.id) return;
    if (!cinturaInput && !caderaInput && !cuelloInput && !munecaInput) {
      Alert.alert("Datos incompletos", "Ingresá al menos una medida.");
      return;
    }

    setSavingMeasurements(true);
    try {
      await insertMeasurements(user.id, {
        cintura_cm: cinturaInput ? parseFloat(cinturaInput) : null,
        cadera_cm: caderaInput ? parseFloat(caderaInput) : null,
        cuello_cm: cuelloInput ? parseFloat(cuelloInput) : null,
        muneca_cm: munecaInput ? parseFloat(munecaInput) : null,
      });
      await loadData(user.id);
      closeMeasurementsModal();
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar las medidas. Intentá de nuevo.");
    } finally {
      setSavingMeasurements(false);
    }
  }

  const latestMeasurement = measurements[0] ?? null;
  const previousMeasurement = measurements[1] ?? null;
  const latestWeight = weightLogs[weightLogs.length - 1]?.peso_kg ?? null;
  const previousWeight = weightLogs[weightLogs.length - 2]?.peso_kg ?? null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Estadísticas</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Estadísticas</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Tendencia de peso */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tendencia de peso</Text>
          <WeightChart logs={weightLogs} />
        </View>

        {/* Medidas corporales */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Medidas corporales</Text>
          {latestMeasurement == null ? (
            <Text style={styles.emptyText}>
              Todavía no registraste tus medidas.
            </Text>
          ) : (
            <>
              <View style={styles.measureRow}>
                <Text style={styles.measureLabel}>Peso</Text>
                <Text style={styles.measureValue}>
                  {latestWeight != null ? `${latestWeight} kg` : "--"}
                  <DeltaText current={latestWeight} previous={previousWeight} />
                </Text>
              </View>
              <View style={styles.measureRow}>
                <Text style={styles.measureLabel}>Cintura</Text>
                <Text style={styles.measureValue}>
                  {latestMeasurement.cintura_cm != null
                    ? `${latestMeasurement.cintura_cm} cm`
                    : "--"}
                  <DeltaText
                    current={latestMeasurement.cintura_cm}
                    previous={previousMeasurement?.cintura_cm ?? null}
                  />
                </Text>
              </View>
              <View style={[styles.measureRow, styles.measureRowLast]}>
                <Text style={styles.measureLabel}>Cadera</Text>
                <Text style={styles.measureValue}>
                  {latestMeasurement.cadera_cm != null
                    ? `${latestMeasurement.cadera_cm} cm`
                    : "--"}
                  <DeltaText
                    current={latestMeasurement.cadera_cm}
                    previous={previousMeasurement?.cadera_cm ?? null}
                  />
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Racha */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Racha</Text>
          <View style={styles.streakRow}>
            <View style={styles.streakItem}>
              <Text style={styles.streakValue}>{streak.streakDays}</Text>
              <Text style={styles.streakLabel}>
                {streak.streakDays === 1 ? "día seguido" : "días seguidos"}
              </Text>
            </View>
            <View style={styles.streakItem}>
              <Text style={styles.streakValue}>{streak.gymSessionsThisWeek}</Text>
              <Text style={styles.streakLabel}>sesiones de gym</Text>
            </View>
            <View style={styles.streakItem}>
              <Text style={styles.streakValue}>{streak.walkMinutesThisWeek}</Text>
              <Text style={styles.streakLabel}>min de caminata</Text>
            </View>
          </View>
        </View>

        {/* Botones de registro */}
        <Pressable style={styles.outlineButton} onPress={openWeightModal}>
          <Text style={styles.outlineButtonText}>Registrar peso hoy</Text>
        </Pressable>
        <Pressable style={styles.outlineButton} onPress={openMeasurementsModal}>
          <Text style={styles.outlineButtonText}>Registrar medidas</Text>
        </Pressable>
      </ScrollView>

      {/* Modal peso */}
      <Modal
        visible={weightModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeWeightModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Registrar peso</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Peso (kg)"
                keyboardType="decimal-pad"
                value={weightInput}
                onChangeText={setWeightInput}
                autoFocus
              />

              <View style={styles.modalActionsRow}>
                <Pressable style={styles.modalCancelButton} onPress={closeWeightModal}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalConfirmButton,
                    savingWeight && styles.saveButtonDisabled,
                  ]}
                  onPress={handleGuardarPeso}
                  disabled={savingWeight}
                >
                  <Text style={styles.modalConfirmText}>
                    {savingWeight ? "Guardando..." : "Guardar"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal medidas */}
      <Modal
        visible={measurementsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeMeasurementsModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Registrar medidas</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Cintura (cm)"
                keyboardType="decimal-pad"
                value={cinturaInput}
                onChangeText={setCinturaInput}
                autoFocus
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Cadera (cm)"
                keyboardType="decimal-pad"
                value={caderaInput}
                onChangeText={setCaderaInput}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Cuello (cm)"
                keyboardType="decimal-pad"
                value={cuelloInput}
                onChangeText={setCuelloInput}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Muñeca (cm)"
                keyboardType="decimal-pad"
                value={munecaInput}
                onChangeText={setMunecaInput}
              />

              <View style={styles.modalActionsRow}>
                <Pressable
                  style={styles.modalCancelButton}
                  onPress={closeMeasurementsModal}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalConfirmButton,
                    savingMeasurements && styles.saveButtonDisabled,
                  ]}
                  onPress={handleGuardarMedidas}
                  disabled={savingMeasurements}
                >
                  <Text style={styles.modalConfirmText}>
                    {savingMeasurements ? "Guardando..." : "Guardar"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    paddingVertical: 6,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 140,
  },
  chartBarWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  chartValue: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  chartBarTrack: {
    width: 18,
    flex: 1,
    justifyContent: "flex-end",
  },
  chartBar: {
    width: "100%",
    borderRadius: 6,
  },
  chartLabel: {
    marginTop: 6,
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  measureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.cardBorder,
  },
  measureRowLast: {
    borderBottomWidth: 0,
  },
  measureLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  measureValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  deltaText: {
    fontSize: 13,
    fontWeight: "700",
  },
  deltaDown: {
    color: COLORS.deltaDown,
  },
  deltaUp: {
    color: COLORS.deltaUp,
  },
  deltaNeutral: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  streakRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  streakItem: {
    flex: 1,
    alignItems: "center",
  },
  streakValue: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.teal,
  },
  streakLabel: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: COLORS.teal,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.teal,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  modalCard: {
    width: "100%",
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  modalActionsRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: COLORS.teal,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
  },
});
