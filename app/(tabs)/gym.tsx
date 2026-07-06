import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { insertWalkSession, insertGymSession } from "@/lib/queries";

const COLORS = {
  teal: "#1D9E75",
  tealSoft: "#E1F5EE",
  background: "#f8f7f4",
  cardBorder: "#e8e7e1",
  textPrimary: "#2C2C2A",
  textSecondary: "#888780",
  white: "#ffffff",
};

type Ejercicio = {
  nombre: string;
  equipo: string;
  seriesReps: string;
};

const DIA_A: Ejercicio[] = [
  { nombre: "Press de pecho (mariposa)", equipo: "Máquina", seriesReps: "3 × 10-12" },
  { nombre: "Press militar sentado", equipo: "Mancuernas", seriesReps: "3 × 10-12" },
  { nombre: "Sentadilla goblet", equipo: "Mancuerna", seriesReps: "3 × 12-15" },
  { nombre: "Extensión de cuádriceps", equipo: "Máquina", seriesReps: "3 × 12-15" },
  { nombre: "Extensión de tríceps en polea", equipo: "Máquina (polea alta)", seriesReps: "3 × 12-15" },
  { nombre: "Plancha", equipo: "Peso corporal", seriesReps: "3 × 30-45 seg" },
];

const DIA_B: Ejercicio[] = [
  { nombre: "Jalón al pecho", equipo: "Máquina (polea alta)", seriesReps: "3 × 10-12" },
  { nombre: "Remo sentado en polea baja", equipo: "Máquina (polea baja)", seriesReps: "3 × 10-12" },
  { nombre: "Peso muerto rumano", equipo: "Mancuernas", seriesReps: "3 × 10-12" },
  { nombre: "Curl femoral", equipo: "Máquina", seriesReps: "3 × 12-15" },
  { nombre: "Curl de bíceps en polea baja", equipo: "Máquina (polea baja)", seriesReps: "3 × 12-15" },
  { nombre: "Abdominales en suelo", equipo: "Peso corporal", seriesReps: "3 × 15-20" },
];

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function GymScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [dia, setDia] = useState<"A" | "B">("A");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [walkModalVisible, setWalkModalVisible] = useState(false);
  const [walkMinutesInput, setWalkMinutesInput] = useState("");
  const [savingWalk, setSavingWalk] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const ejercicios = dia === "A" ? DIA_A : DIA_B;

  function toggleCheck(nombre: string) {
    setChecked((prev) => ({ ...prev, [nombre]: !prev[nombre] }));
  }

  function switchDia(nuevoDia: "A" | "B") {
    setDia(nuevoDia);
    setChecked({});
  }

  async function handleGuardarSesion() {
    if (!user?.id) return;

    const ejerciciosCompletados = ejercicios
      .filter((e) => checked[e.nombre])
      .map((e) => e.nombre);

    setSaving(true);
    try {
      await insertGymSession(user.id, dia, ejerciciosCompletados);
      setChecked({});
      Alert.alert("Sesión guardada", `Día ${dia} registrado correctamente.`);
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar la sesión. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmarCaminata() {
    if (!user?.id) return;

    const minutos = parseInt(walkMinutesInput, 10);
    if (!minutos || minutos <= 0) {
      Alert.alert("Duración inválida", "Ingresá una cantidad de minutos válida.");
      return;
    }

    setSavingWalk(true);
    try {
      await insertWalkSession(user.id, minutos);
      setWalkModalVisible(false);
      setWalkMinutesInput("");
      Alert.alert("Caminata registrada", `${minutos} minutos guardados.`);
    } catch (error) {
      Alert.alert("Error", "No se pudo registrar la caminata. Intentá de nuevo.");
    } finally {
      setSavingWalk(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gym</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Card caminata */}
        <View style={styles.walkCard}>
          <Text style={styles.walkTitle}>Caminata</Text>
          <Text style={styles.walkSubtitle}>Registrá tu caminata del día</Text>
          <Pressable
            style={styles.walkButton}
            onPress={() => setWalkModalVisible(true)}
          >
            <Text style={styles.walkButtonText}>Iniciar caminata</Text>
          </Pressable>
        </View>

        {/* Selector Día A / Día B */}
        <View style={styles.tabsRow}>
          <Pressable
            style={[styles.tab, dia === "A" && styles.tabActive]}
            onPress={() => switchDia("A")}
          >
            <Text style={[styles.tabText, dia === "A" && styles.tabTextActive]}>
              Día A
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, dia === "B" && styles.tabActive]}
            onPress={() => switchDia("B")}
          >
            <Text style={[styles.tabText, dia === "B" && styles.tabTextActive]}>
              Día B
            </Text>
          </Pressable>
        </View>

        {/* Lista de ejercicios */}
        <View style={styles.card}>
          <SectionTitle>Ejercicios</SectionTitle>
          {ejercicios.map((ejercicio, i) => {
            const isChecked = !!checked[ejercicio.nombre];
            return (
              <Pressable
                key={ejercicio.nombre}
                style={[
                  styles.exerciseRow,
                  i < ejercicios.length - 1 && styles.exerciseRowSpacing,
                ]}
                onPress={() => toggleCheck(ejercicio.nombre)}
              >
                <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                  {isChecked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{ejercicio.nombre}</Text>
                  <View style={styles.exerciseMetaRow}>
                    <Text style={styles.exerciseSeriesReps}>{ejercicio.seriesReps}</Text>
                    <View style={styles.equipoBadge}>
                      <Text style={styles.equipoBadgeText}>{ejercicio.equipo}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleGuardarSesion}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Guardando..." : "Guardar sesión"}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={walkModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWalkModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Duración de la caminata</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Minutos"
              keyboardType="number-pad"
              value={walkMinutesInput}
              onChangeText={setWalkMinutesInput}
              autoFocus
            />
            <View style={styles.modalActionsRow}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => {
                  setWalkModalVisible(false);
                  setWalkMinutesInput("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalConfirmButton,
                  savingWalk && styles.saveButtonDisabled,
                ]}
                onPress={handleConfirmarCaminata}
                disabled={savingWalk}
              >
                <Text style={styles.modalConfirmText}>
                  {savingWalk ? "Guardando..." : "Confirmar"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
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
  walkCard: {
    backgroundColor: COLORS.teal,
    borderRadius: 16,
    padding: 16,
  },
  walkTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.white,
  },
  walkSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.white,
    opacity: 0.9,
  },
  walkButton: {
    marginTop: 14,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  walkButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.teal,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tabActive: {
    backgroundColor: COLORS.teal,
    borderColor: COLORS.teal,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.white,
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
  exerciseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  exerciseRowSpacing: {
    marginBottom: 14,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLORS.teal,
    borderColor: COLORS.teal,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
  exerciseInfo: {
    marginLeft: 12,
    flex: 1,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  exerciseMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  exerciseSeriesReps: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  equipoBadge: {
    backgroundColor: COLORS.tealSoft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  equipoBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0F6E56",
  },
  saveButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 16,
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
  },
  modalActionsRow: {
    marginTop: 16,
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
