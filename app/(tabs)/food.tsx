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
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  deleteFoodLog,
  fetchTodayFoodLogs,
  insertFoodLog,
  type FoodLog,
  type TipoComida,
} from "@/lib/queries";

const COLORS = {
  teal: "#1D9E75",
  tealSoft: "#E1F5EE",
  background: "#f8f7f4",
  cardBorder: "#e8e7e1",
  textPrimary: "#2C2C2A",
  textSecondary: "#888780",
  white: "#ffffff",
  danger: "#D0392B",
  proteina: "#378ADD",
  carbos: "#BA7517",
  grasas: "#993C1D",
};

const OBJETIVOS = {
  calorias: 2200,
  proteina: 155,
  carbos: 200,
  grasas: 70,
};

const TIPOS: { key: TipoComida; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: "desayuno", label: "Desayuno", icon: "sunny-outline", color: "#BA7517" },
  { key: "almuerzo", label: "Almuerzo", icon: "restaurant-outline", color: "#1D9E75" },
  { key: "merienda", label: "Merienda", icon: "nutrition-outline", color: "#639922" },
  { key: "cena", label: "Cena", icon: "moon-outline", color: "#534AB7" },
];

const EMPTY_MESSAGES: Record<TipoComida, string> = {
  desayuno: "Agregá tu desayuno",
  almuerzo: "Agregá tu almuerzo",
  merienda: "Agregá tu merienda",
  cena: "Agregá tu cena",
};

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function FoodScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalTipo, setModalTipo] = useState<TipoComida | null>(null);
  const [nombreInput, setNombreInput] = useState("");
  const [kcalInput, setKcalInput] = useState("");
  const [proteinaInput, setProteinaInput] = useState("");
  const [carbosInput, setCarbosInput] = useState("");
  const [grasasInput, setGrasasInput] = useState("");
  const [saving, setSaving] = useState(false);

  const loadLogs = useCallback(async (userId: string) => {
    const data = await fetchTodayFoodLogs(userId);
    setLogs(data);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        await loadLogs(data.user.id);
      }
      setLoading(false);
    });
  }, [loadLogs]);

  async function handleRefresh() {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      await loadLogs(user.id);
    } finally {
      setRefreshing(false);
    }
  }

  function openModal(tipo: TipoComida) {
    setModalTipo(tipo);
    setNombreInput("");
    setKcalInput("");
    setProteinaInput("");
    setCarbosInput("");
    setGrasasInput("");
  }

  function closeModal() {
    setModalTipo(null);
  }

  async function handleGuardarComida() {
    if (!user?.id || !modalTipo) return;

    const kcal = parseInt(kcalInput, 10);
    if (!nombreInput.trim() || !kcal || kcal <= 0) {
      Alert.alert("Datos incompletos", "Ingresá al menos el nombre y las kcal.");
      return;
    }

    setSaving(true);
    try {
      await insertFoodLog(user.id, modalTipo, {
        nombre: nombreInput.trim(),
        kcal,
        proteina_g: proteinaInput ? parseFloat(proteinaInput) : null,
        carbos_g: carbosInput ? parseFloat(carbosInput) : null,
        grasas_g: grasasInput ? parseFloat(grasasInput) : null,
      });
      await loadLogs(user.id);
      closeModal();
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar la comida. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminarComida(id: string) {
    if (!user?.id) return;
    const previous = logs;
    setLogs((current) => current.filter((log) => log.id !== id));
    try {
      await deleteFoodLog(id);
    } catch (error) {
      setLogs(previous);
      Alert.alert("Error", "No se pudo eliminar la comida. Intentá de nuevo.");
    }
  }

  const totales = logs.reduce(
    (acc, log) => ({
      calorias: acc.calorias + (log.kcal ?? 0),
      proteina: acc.proteina + (log.proteina_g ?? 0),
      carbos: acc.carbos + (log.carbos_g ?? 0),
      grasas: acc.grasas + (log.grasas_g ?? 0),
    }),
    { calorias: 0, proteina: 0, carbos: 0, grasas: 0 }
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comida</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Comida</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Resumen calorías */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Resumen del día</Text>
          <View style={styles.caloriesRow}>
            <Text style={styles.caloriesValue}>{totales.calorias}</Text>
            <Text style={styles.caloriesTarget}> / {OBJETIVOS.calorias} kcal</Text>
          </View>
          <ProgressBar value={totales.calorias} total={OBJETIVOS.calorias} color={COLORS.teal} />
        </View>

        {/* Macros */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Macros del día</Text>

          <View style={styles.macroRow}>
            <View style={styles.macroLabelRow}>
              <Text style={styles.macroLabel}>Proteína</Text>
              <Text style={styles.macroValue}>
                {Math.round(totales.proteina)} / {OBJETIVOS.proteina} g
              </Text>
            </View>
            <ProgressBar value={totales.proteina} total={OBJETIVOS.proteina} color={COLORS.proteina} />
          </View>

          <View style={styles.macroRow}>
            <View style={styles.macroLabelRow}>
              <Text style={styles.macroLabel}>Carbohidratos</Text>
              <Text style={styles.macroValue}>
                {Math.round(totales.carbos)} / {OBJETIVOS.carbos} g
              </Text>
            </View>
            <ProgressBar value={totales.carbos} total={OBJETIVOS.carbos} color={COLORS.carbos} />
          </View>

          <View style={[styles.macroRow, styles.macroRowLast]}>
            <View style={styles.macroLabelRow}>
              <Text style={styles.macroLabel}>Grasas</Text>
              <Text style={styles.macroValue}>
                {Math.round(totales.grasas)} / {OBJETIVOS.grasas} g
              </Text>
            </View>
            <ProgressBar value={totales.grasas} total={OBJETIVOS.grasas} color={COLORS.grasas} />
          </View>
        </View>

        {/* Comidas por tipo */}
        {TIPOS.map((tipo) => {
          const comidas = logs.filter((log) => log.tipo_comida === tipo.key);
          return (
            <View key={tipo.key} style={styles.card}>
              <View style={styles.mealHeaderRow}>
                <View style={styles.mealHeaderLeft}>
                  <Ionicons name={tipo.icon} size={18} color={tipo.color} />
                  <Text style={styles.mealHeaderTitle}>{tipo.label}</Text>
                </View>
                <Pressable
                  style={[styles.addButton, { backgroundColor: tipo.color }]}
                  onPress={() => openModal(tipo.key)}
                >
                  <Ionicons name="add" size={18} color={COLORS.white} />
                </Pressable>
              </View>

              {comidas.length === 0 ? (
                <Text style={styles.emptyText}>{EMPTY_MESSAGES[tipo.key]}</Text>
              ) : (
                comidas.map((comida, i) => (
                  <Swipeable
                    key={comida.id}
                    renderRightActions={() => (
                      <Pressable
                        style={styles.deleteAction}
                        onPress={() => handleEliminarComida(comida.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color={COLORS.white} />
                      </Pressable>
                    )}
                  >
                    <View
                      style={[
                        styles.mealItemRow,
                        i < comidas.length - 1 && styles.mealItemRowSpacing,
                      ]}
                    >
                      <Text style={styles.mealItemName}>{comida.nombre}</Text>
                      <Text style={styles.mealItemKcal}>{comida.kcal} kcal</Text>
                    </View>
                  </Swipeable>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={modalTipo !== null}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
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
              <Text style={styles.modalTitle}>
                Agregar {modalTipo ? TIPOS.find((t) => t.key === modalTipo)?.label : ""}
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Nombre"
                value={nombreInput}
                onChangeText={setNombreInput}
                autoFocus
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Kcal"
                keyboardType="number-pad"
                value={kcalInput}
                onChangeText={setKcalInput}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Proteína (g)"
                keyboardType="decimal-pad"
                value={proteinaInput}
                onChangeText={setProteinaInput}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Carbohidratos (g)"
                keyboardType="decimal-pad"
                value={carbosInput}
                onChangeText={setCarbosInput}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Grasas (g)"
                keyboardType="decimal-pad"
                value={grasasInput}
                onChangeText={setGrasasInput}
              />

              <View style={styles.modalActionsRow}>
                <Pressable style={styles.modalCancelButton} onPress={closeModal}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalConfirmButton, saving && styles.saveButtonDisabled]}
                  onPress={handleGuardarComida}
                  disabled={saving}
                >
                  <Text style={styles.modalConfirmText}>
                    {saving ? "Guardando..." : "Guardar"}
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
  caloriesRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 10,
  },
  caloriesValue: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  caloriesTarget: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.background,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  macroRow: {
    marginBottom: 14,
  },
  macroRowLast: {
    marginBottom: 0,
  },
  macroLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  macroValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  mealHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  mealHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mealHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    paddingVertical: 6,
  },
  mealItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingVertical: 8,
  },
  mealItemRowSpacing: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.cardBorder,
  },
  mealItemName: {
    fontSize: 14,
    color: COLORS.textPrimary,
    flexShrink: 1,
    paddingRight: 8,
  },
  mealItemKcal: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  deleteAction: {
    width: 64,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginVertical: 2,
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
  saveButtonDisabled: {
    opacity: 0.6,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
  },
});
