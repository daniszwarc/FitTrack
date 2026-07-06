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
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
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
  scanBackground: "#E1F5EE",
  scanText: "#0F6E56",
  recognizeBackground: "#EEF4FA",
  recognizeText: "#1A5FA8",
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

type EtiquetaExtraida = {
  nombre: string | null;
  kcal: number | null;
  proteina_g: number | null;
  carbos_g: number | null;
  grasas_g: number | null;
  porcion_g: number | null;
};

type Ingrediente = {
  id: string;
  nombre: string;
  cantidad_g: number;
  kcal: number;
  proteina_g: number;
  carbos_g: number;
  grasas_g: number;
};

const ETIQUETA_PROMPT =
  "Analizá esta etiqueta nutricional y devolvé SOLO un JSON con este formato exacto, sin texto adicional:\n" +
  '{"nombre": "nombre del producto", "kcal": número, "proteina_g": número, "carbos_g": número, "grasas_g": número, "porcion_g": número}\n' +
  "Si no podés leer algún valor, usá null.\n" +
  "Usá los valores POR PORCIÓN, no por 100g.\n" +
  "Para carbos_g devolvé los carbohidratos NETOS: carbohidratos totales - fibra - alcoholes de azúcar. " +
  "Si no hay alcoholes de azúcar, restá solo la fibra.";

const RECONOCIMIENTO_PROMPT =
  "Identificá el alimento principal en esta foto y devolvé SOLO un JSON con sus valores nutricionales estándar por 100g, sin texto adicional:\n" +
  '{"nombre": "nombre del alimento en español", "kcal": número, "proteina_g": número, "carbos_g": número, "grasas_g": número, "porcion_g": 100}\n' +
  "carbos_g son carbohidratos netos: totales - fibra.\n" +
  "Usá valores de tablas nutricionales estándar (USDA o equivalente).\n" +
  "Si no podés identificar el alimento con certeza, devolvé null en todos los campos.";

async function analizarImagenAlimento(base64Image: string, prompt: string): Promise<EtiquetaExtraida> {
  const apiKey = process.env.EXPO_PUBLIC_NAN_BUILDERS_KEY;
  if (!apiKey) {
    throw new Error("Falta configurar EXPO_PUBLIC_NAN_BUILDERS_KEY");
  }

  const response = await fetch("https://api.nan.builders/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "mimo-v2.5",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Error del servicio de análisis: ${response.status}`);
  }

  const json = await response.json();
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("El AI no devolvió resultados");
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No se pudo interpretar la respuesta del AI");
  }

  return JSON.parse(jsonMatch[0]);
}

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
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [showIngredienteForm, setShowIngredienteForm] = useState(false);
  const [nombreInput, setNombreInput] = useState("");
  const [kcalInput, setKcalInput] = useState("");
  const [proteinaInput, setProteinaInput] = useState("");
  const [carbosInput, setCarbosInput] = useState("");
  const [grasasInput, setGrasasInput] = useState("");
  const [porcionGInput, setPorcionGInput] = useState("100");
  const [cantidadGInput, setCantidadGInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

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
    setIngredientes([]);
    setShowIngredienteForm(false);
  }

  function closeModal() {
    setModalTipo(null);
    setScanError(null);
    setShowIngredienteForm(false);
  }

  function openIngredienteForm() {
    setNombreInput("");
    setKcalInput("");
    setProteinaInput("");
    setCarbosInput("");
    setGrasasInput("");
    setPorcionGInput("100");
    setCantidadGInput("");
    setScanError(null);
    setShowIngredienteForm(true);
  }

  function closeIngredienteForm() {
    setShowIngredienteForm(false);
    setScanError(null);
  }

  function handleAgregarIngrediente() {
    const kcalPorcion = parseFloat(kcalInput);
    const porcionG = parseFloat(porcionGInput) || 100;
    const cantidadG = parseFloat(cantidadGInput);

    if (!nombreInput.trim() || !kcalPorcion || kcalPorcion <= 0 || !cantidadG || cantidadG <= 0) {
      Alert.alert("Datos incompletos", "Ingresá al menos el nombre, las kcal por porción y la cantidad consumida.");
      return;
    }

    const proteinaPorcion = proteinaInput ? parseFloat(proteinaInput) : 0;
    const carbosPorcion = carbosInput ? parseFloat(carbosInput) : 0;
    const grasasPorcion = grasasInput ? parseFloat(grasasInput) : 0;

    const factor = cantidadG / porcionG;

    setIngredientes((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        nombre: nombreInput.trim(),
        cantidad_g: cantidadG,
        kcal: Math.round(kcalPorcion * factor),
        proteina_g: proteinaPorcion * factor,
        carbos_g: carbosPorcion * factor,
        grasas_g: grasasPorcion * factor,
      },
    ]);
    setShowIngredienteForm(false);
  }

  function handleEliminarIngrediente(id: string) {
    setIngredientes((current) => current.filter((ing) => ing.id !== id));
  }

  async function capturarYAnalizar(prompt: string, permisoMensaje: string, errorMensaje: string) {
    setScanError(null);

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permiso necesario", permisoMensaje);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    setScanning(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!manipulated.base64) {
        throw new Error("No se pudo procesar la imagen");
      }

      const datos = await analizarImagenAlimento(manipulated.base64, prompt);

      setNombreInput(datos.nombre ?? "");
      setKcalInput(datos.kcal != null ? String(datos.kcal) : "");
      setProteinaInput(datos.proteina_g != null ? String(datos.proteina_g) : "");
      setCarbosInput(datos.carbos_g != null ? String(datos.carbos_g) : "");
      setGrasasInput(datos.grasas_g != null ? String(datos.grasas_g) : "");
      setPorcionGInput(datos.porcion_g != null ? String(datos.porcion_g) : "100");
    } catch (error) {
      setScanError(errorMensaje);
    } finally {
      setScanning(false);
    }
  }

  async function handleEscanearEtiqueta() {
    await capturarYAnalizar(
      ETIQUETA_PROMPT,
      "Habilitá el acceso a la cámara para escanear etiquetas.",
      "No se pudo leer la etiqueta. Completá los datos manualmente."
    );
  }

  async function handleReconocerAlimento() {
    await capturarYAnalizar(
      RECONOCIMIENTO_PROMPT,
      "Habilitá el acceso a la cámara para reconocer el alimento.",
      "No se pudo reconocer el alimento. Completá los datos manualmente."
    );
  }

  const totalesIngredientes = ingredientes.reduce(
    (acc, ing) => ({
      kcal: acc.kcal + ing.kcal,
      proteina_g: acc.proteina_g + ing.proteina_g,
      carbos_g: acc.carbos_g + ing.carbos_g,
      grasas_g: acc.grasas_g + ing.grasas_g,
    }),
    { kcal: 0, proteina_g: 0, carbos_g: 0, grasas_g: 0 }
  );

  async function handleGuardarComida() {
    if (!user?.id || !modalTipo || ingredientes.length === 0) return;

    setSaving(true);
    try {
      await insertFoodLog(user.id, modalTipo, {
        nombre: ingredientes.map((ing) => ing.nombre).join(", "),
        kcal: Math.round(totalesIngredientes.kcal),
        proteina_g: totalesIngredientes.proteina_g,
        carbos_g: totalesIngredientes.carbos_g,
        grasas_g: totalesIngredientes.grasas_g,
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
              <Text style={styles.macroLabel}>Carbs netos</Text>
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
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  Agregar {modalTipo ? TIPOS.find((t) => t.key === modalTipo)?.label : ""}
                </Text>
                <Pressable onPress={closeModal} hitSlop={8}>
                  <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                </Pressable>
              </View>

              {!showIngredienteForm ? (
                <>
                  {ingredientes.length === 0 ? (
                    <Text style={styles.emptyText}>Todavía no agregaste ingredientes</Text>
                  ) : (
                    ingredientes.map((ing) => (
                      <View key={ing.id} style={styles.ingredienteCard}>
                        <View style={styles.ingredienteInfo}>
                          <Text style={styles.ingredienteNombre}>{ing.nombre}</Text>
                          <Text style={styles.ingredienteDetalle}>
                            {ing.cantidad_g}g · {Math.round(ing.kcal)} kcal
                          </Text>
                        </View>
                        <Pressable onPress={() => handleEliminarIngrediente(ing.id)} hitSlop={8}>
                          <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                        </Pressable>
                      </View>
                    ))
                  )}

                  <Pressable style={styles.addIngredienteButton} onPress={openIngredienteForm}>
                    <Ionicons name="add" size={18} color={COLORS.teal} />
                    <Text style={styles.addIngredienteText}>Agregar ingrediente</Text>
                  </Pressable>

                  <View style={styles.modalSeparator} />

                  <View style={styles.totalesRow}>
                    <Text style={styles.totalesLabel}>Total</Text>
                    <Text style={styles.totalesValue}>
                      {Math.round(totalesIngredientes.kcal)} kcal · {Math.round(totalesIngredientes.proteina_g)}g prot ·{" "}
                      {Math.round(totalesIngredientes.carbos_g)}g carbs netos · {Math.round(totalesIngredientes.grasas_g)}g grasas
                    </Text>
                  </View>

                  <View style={styles.modalActionsRow}>
                    <Pressable style={styles.modalCancelButton} onPress={closeModal}>
                      <Text style={styles.modalCancelText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.modalConfirmButton,
                        (saving || ingredientes.length === 0) && styles.saveButtonDisabled,
                      ]}
                      onPress={handleGuardarComida}
                      disabled={saving || ingredientes.length === 0}
                    >
                      <Text style={styles.modalConfirmText}>
                        {saving ? "Guardando..." : "Guardar comida"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.scanButtonsRow}>
                    <Pressable
                      style={[styles.scanButton, scanning && styles.saveButtonDisabled]}
                      onPress={handleEscanearEtiqueta}
                      disabled={scanning}
                    >
                      <Ionicons name="barcode-outline" size={18} color={COLORS.scanText} />
                      <Text style={styles.scanButtonText}>
                        {scanning ? "Analizando..." : "Escanear etiqueta"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.recognizeButton, scanning && styles.saveButtonDisabled]}
                      onPress={handleReconocerAlimento}
                      disabled={scanning}
                    >
                      <Ionicons name="camera-outline" size={18} color={COLORS.recognizeText} />
                      <Text style={styles.recognizeButtonText}>
                        {scanning ? "Analizando..." : "Reconocer alimento"}
                      </Text>
                    </Pressable>
                  </View>

                  {scanError && <Text style={styles.scanErrorText}>{scanError}</Text>}

                  <Text style={styles.scanSeparator}>— o completá manualmente —</Text>

                  <TextInput
                    style={styles.modalInput}
                    placeholder="Nombre"
                    value={nombreInput}
                    onChangeText={setNombreInput}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Kcal por porción"
                    keyboardType="number-pad"
                    value={kcalInput}
                    onChangeText={setKcalInput}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Proteína por porción (g)"
                    keyboardType="decimal-pad"
                    value={proteinaInput}
                    onChangeText={setProteinaInput}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Carbs netos por porción (g)"
                    keyboardType="decimal-pad"
                    value={carbosInput}
                    onChangeText={setCarbosInput}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Grasas por porción (g)"
                    keyboardType="decimal-pad"
                    value={grasasInput}
                    onChangeText={setGrasasInput}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Tamaño de porción (g)"
                    keyboardType="decimal-pad"
                    value={porcionGInput}
                    onChangeText={setPorcionGInput}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Cantidad que comiste (g)"
                    keyboardType="decimal-pad"
                    value={cantidadGInput}
                    onChangeText={setCantidadGInput}
                  />

                  <View style={styles.modalActionsRow}>
                    <Pressable style={styles.modalCancelButton} onPress={closeIngredienteForm}>
                      <Text style={styles.modalCancelText}>Cancelar</Text>
                    </Pressable>
                    <Pressable style={styles.modalConfirmButton} onPress={handleAgregarIngrediente}>
                      <Text style={styles.modalConfirmText}>Agregar</Text>
                    </Pressable>
                  </View>
                </>
              )}
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
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  ingredienteCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  ingredienteInfo: {
    flexShrink: 1,
    paddingRight: 8,
  },
  ingredienteNombre: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  ingredienteDetalle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  addIngredienteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.teal,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  addIngredienteText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.teal,
  },
  modalSeparator: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginBottom: 12,
  },
  totalesRow: {
    marginBottom: 14,
  },
  totalesLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  totalesValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  scanButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  scanButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.scanBackground,
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.scanText,
  },
  recognizeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.recognizeBackground,
  },
  recognizeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.recognizeText,
  },
  scanErrorText: {
    fontSize: 13,
    color: COLORS.danger,
    marginBottom: 10,
  },
  scanSeparator: {
    textAlign: "center",
    fontSize: 12,
    color: COLORS.textSecondary,
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
