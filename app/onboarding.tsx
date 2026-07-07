import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { updateProfile, insertWeight, insertMeasurements, fetchProfile } from "@/lib/queries";
import { analyzeProfile, type ProfileAnalysis } from "@/lib/ai";
import { profileQueryKey } from "@/app/_layout";

const COLORS = {
  teal: "#1D9E75",
  tealSoft: "#E1F5EE",
  background: "#f8f7f4",
  cardBorder: "#e8e7e1",
  textPrimary: "#2C2C2A",
  textSecondary: "#888780",
  white: "#ffffff",
  orange: "#BA7517",
  orangeSoft: "#FAEEDA",
  red: "#993C1D",
  redSoft: "#FAECE7",
};

const ANALYZING_MESSAGES = [
  "Calculando composición corporal",
  "Estimando masa muscular",
  "Definiendo tus objetivos",
  "Preparando tu plan personalizado",
];

function formatFecha(text: string): string {
  const nums = text.replace(/\D/g, "");
  if (nums.length <= 2) return nums;
  if (nums.length <= 4) return `${nums.slice(0, 2)}/${nums.slice(2)}`;
  return `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4, 8)}`;
}

function ddmmyyyyToIso(value: string): string {
  const [dia, mes, anio] = value.split("/");
  return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

function riesgoColors(riesgo: ProfileAnalysis["riesgo_cardiometabolico"]) {
  if (riesgo === "alto") return { color: COLORS.red, background: COLORS.redSoft };
  if (riesgo === "moderado") return { color: COLORS.orange, background: COLORS.orangeSoft };
  return { color: COLORS.teal, background: COLORS.tealSoft };
}

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);

  const [nombre, setNombre] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [sexo, setSexo] = useState<"hombre" | "mujer" | null>(null);

  const [altura, setAltura] = useState("");
  const [peso, setPeso] = useState("");
  const [cintura, setCintura] = useState("");
  const [cadera, setCadera] = useState("");
  const [cuello, setCuello] = useState("");
  const [muneca, setMuneca] = useState("");

  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const step1Valid = nombre.trim().length > 0 && fechaNacimiento.length === 10 && sexo !== null;
  const step2Valid =
    altura.trim().length > 0 &&
    peso.trim().length > 0 &&
    cintura.trim().length > 0 &&
    cadera.trim().length > 0 &&
    cuello.trim().length > 0 &&
    muneca.trim().length > 0;

  function goToAnalysis() {
    setStep(3);
  }

  async function handleConfirmPlan() {
    if (!analysis) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa");

      if (analysis.peso_objetivo_kg == null) {
        throw new Error("El análisis no incluye un peso objetivo válido");
      }

      await updateProfile(user.id, {
        full_name: nombre.trim(),
        altura_cm: Number(altura),
        peso_inicial_kg: Number(peso),
        objetivo_kg: analysis.peso_objetivo_kg,
        fecha_nacimiento: ddmmyyyyToIso(fechaNacimiento),
        sexo: sexo === "hombre" ? "M" : "F",
      });

      const weightData = { pesoKg: Number(peso) };
      console.log("Saving weight...", weightData);
      await insertWeight(user.id, weightData.pesoKg).catch((error) => {
        console.log("Weight result:", error);
        throw error;
      });
      console.log("Weight result:", null);

      const measurementsData = {
        cintura_cm: Number(cintura),
        cadera_cm: Number(cadera),
        cuello_cm: Number(cuello),
        muneca_cm: Number(muneca),
      };
      console.log("Saving measurements...", measurementsData);
      await insertMeasurements(user.id, measurementsData).catch((error) => {
        console.log("Measurements result:", error);
        throw error;
      });
      console.log("Measurements result:", null);

      // Guard against an in-flight fetch resolving after our write and
      // clobbering the cache back to the stale (pre-onboarding) profile.
      await queryClient.cancelQueries({ queryKey: profileQueryKey(user.id) });
      const freshProfile = await fetchProfile(user.id);
      queryClient.setQueryData(profileQueryKey(user.id), freshProfile);

      router.replace("/(tabs)");
    } catch (e) {
      console.log("Onboarding save error:", e);
      setSaving(false);
      setAnalyzeError(e instanceof Error ? e.message : "Error al guardar tu plan");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.progressRow}>
        {[1, 2, 3, 4].map((n) => (
          <View
            key={n}
            style={[
              styles.progressSegment,
              n <= step && styles.progressSegmentActive,
            ]}
          />
        ))}
      </View>

      {step === 1 && (
        <Step1
          nombre={nombre}
          setNombre={setNombre}
          fechaNacimiento={fechaNacimiento}
          setFechaNacimiento={setFechaNacimiento}
          sexo={sexo}
          setSexo={setSexo}
          valid={step1Valid}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <Step2
          altura={altura}
          setAltura={setAltura}
          peso={peso}
          setPeso={setPeso}
          cintura={cintura}
          setCintura={setCintura}
          cadera={cadera}
          setCadera={setCadera}
          cuello={cuello}
          setCuello={setCuello}
          muneca={muneca}
          setMuneca={setMuneca}
          valid={step2Valid}
          onBack={() => setStep(1)}
          onNext={goToAnalysis}
        />
      )}

      {step === 3 && (
        <Step3
          onDone={(result, error) => {
            setAnalysis(result);
            setAnalyzeError(error);
            setStep(4);
          }}
          input={{
            nombre: nombre.trim(),
            sexo: sexo!,
            fecha_nacimiento: fechaNacimiento,
            altura_cm: Number(altura),
            peso_kg: Number(peso),
            cintura_cm: Number(cintura),
            cadera_cm: Number(cadera),
            cuello_cm: Number(cuello),
            muneca_cm: Number(muneca),
          }}
        />
      )}

      {step === 4 && (
        <Step4
          nombre={nombre.trim()}
          analysis={analysis}
          error={analyzeError}
          saving={saving}
          onConfirm={handleConfirmPlan}
          onRetry={() => setStep(3)}
        />
      )}
    </SafeAreaView>
  );
}

function Step1({
  nombre,
  setNombre,
  fechaNacimiento,
  setFechaNacimiento,
  sexo,
  setSexo,
  valid,
  onNext,
}: {
  nombre: string;
  setNombre: (v: string) => void;
  fechaNacimiento: string;
  setFechaNacimiento: (v: string) => void;
  sexo: "hombre" | "mujer" | null;
  setSexo: (v: "hombre" | "mujer") => void;
  valid: boolean;
  onNext: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Contanos sobre vos</Text>
      <Text style={styles.subtitle}>Estos datos nos ayudan a personalizar tu plan</Text>

      <Text style={styles.label}>Nombre completo</Text>
      <TextInput
        value={nombre}
        onChangeText={setNombre}
        placeholder="Tu nombre"
        placeholderTextColor={COLORS.textSecondary}
        style={styles.input}
      />

      <Text style={styles.label}>Fecha de nacimiento</Text>
      <TextInput
        value={fechaNacimiento}
        onChangeText={(text) => setFechaNacimiento(formatFecha(text))}
        placeholder="DD/MM/AAAA"
        placeholderTextColor={COLORS.textSecondary}
        keyboardType="numeric"
        maxLength={10}
        style={styles.input}
      />

      <Text style={styles.label}>Sexo</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => setSexo("hombre")}
          style={[styles.choiceButton, sexo === "hombre" && styles.choiceButtonActive]}
        >
          <Text style={[styles.choiceText, sexo === "hombre" && styles.choiceTextActive]}>
            Hombre
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSexo("mujer")}
          style={[styles.choiceButton, sexo === "mujer" && styles.choiceButtonActive]}
        >
          <Text style={[styles.choiceText, sexo === "mujer" && styles.choiceTextActive]}>
            Mujer
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onNext}
        disabled={!valid}
        style={[styles.primaryButton, !valid && styles.primaryButtonDisabled]}
      >
        <Text style={styles.primaryButtonText}>Siguiente</Text>
      </Pressable>
    </ScrollView>
  );
}

function MeasurementRow({
  label,
  note,
  value,
  onChangeText,
  markerColor,
}: {
  label: string;
  note?: string;
  value: string;
  onChangeText: (v: string) => void;
  markerColor: string;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.row}>
        <View style={[styles.marker, { backgroundColor: markerColor }]} />
        <Text style={styles.label}>{label}</Text>
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="0"
        placeholderTextColor={COLORS.textSecondary}
        keyboardType="decimal-pad"
        style={styles.input}
      />
    </View>
  );
}

function BodyDiagram() {
  return (
    <View style={styles.diagramContainer}>
      <View style={styles.silhouetteHead} />
      <View style={styles.silhouetteNeck}>
        <View style={[styles.diagramDot, { backgroundColor: "#378ADD" }]} />
      </View>
      <View style={styles.silhouetteTorso}>
        <View style={[styles.diagramDot, { backgroundColor: "#1D9E75", top: 20 }]} />
        <View style={[styles.diagramDot, { backgroundColor: "#BA7517", top: 60 }]} />
      </View>
      <View style={styles.silhouetteArm} />
      <View style={[styles.silhouetteArm, { right: undefined, left: 8 }]}>
        <View style={[styles.diagramDot, { backgroundColor: "#993C1D" }]} />
      </View>
      <View style={styles.silhouetteLegs} />
    </View>
  );
}

function Step2({
  altura,
  setAltura,
  peso,
  setPeso,
  cintura,
  setCintura,
  cadera,
  setCadera,
  cuello,
  setCuello,
  muneca,
  setMuneca,
  valid,
  onBack,
  onNext,
}: {
  altura: string;
  setAltura: (v: string) => void;
  peso: string;
  setPeso: (v: string) => void;
  cintura: string;
  setCintura: (v: string) => void;
  cadera: string;
  setCadera: (v: string) => void;
  cuello: string;
  setCuello: (v: string) => void;
  muneca: string;
  setMuneca: (v: string) => void;
  valid: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Tus medidas</Text>
        <Text style={styles.subtitle}>
          Necesitamos estos datos para analizar tu composición corporal
        </Text>

        <BodyDiagram />

        <MeasurementRow label="Altura (cm)" value={altura} onChangeText={setAltura} markerColor="#378ADD" />
        <MeasurementRow label="Peso actual (kg)" value={peso} onChangeText={setPeso} markerColor="#1D9E75" />
        <MeasurementRow
          label="Cintura (cm)"
          note="A nivel del ombligo"
          value={cintura}
          onChangeText={setCintura}
          markerColor="#1D9E75"
        />
        <MeasurementRow
          label="Cadera (cm)"
          note="Parte más ancha"
          value={cadera}
          onChangeText={setCadera}
          markerColor="#BA7517"
        />
        <MeasurementRow
          label="Cuello (cm)"
          note="Base del cuello"
          value={cuello}
          onChangeText={setCuello}
          markerColor="#378ADD"
        />
        <MeasurementRow
          label="Muñeca (cm)"
          note="Punto más angosto"
          value={muneca}
          onChangeText={setMuneca}
          markerColor="#993C1D"
        />

        <Pressable
          onPress={onNext}
          disabled={!valid}
          style={[styles.primaryButton, !valid && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryButtonText}>Siguiente</Text>
        </Pressable>

        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Atrás</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Step3({
  input,
  onDone,
}: {
  input: Parameters<typeof analyzeProfile>[0];
  onDone: (result: ProfileAnalysis | null, error: string | null) => void;
}) {
  const [messageIndex, setMessageIndex] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % ANALYZING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    analyzeProfile(input)
      .then((result) => onDone(result, null))
      .catch((e) => onDone(null, e instanceof Error ? e.message : "Error al analizar tu perfil"));
  }, [input, onDone]);

  return (
    <View style={styles.analyzingContainer}>
      <ActivityIndicator size="large" color={COLORS.teal} />
      <Text style={styles.analyzingTitle}>Analizando tu perfil...</Text>
      <Text style={styles.analyzingSubtitle}>{ANALYZING_MESSAGES[messageIndex]}</Text>
    </View>
  );
}

function Step4({
  nombre,
  analysis,
  error,
  saving,
  onConfirm,
  onRetry,
}: {
  nombre: string;
  analysis: ProfileAnalysis | null;
  error: string | null;
  saving: boolean;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  if (error || !analysis) {
    return (
      <View style={styles.analyzingContainer}>
        <Text style={styles.analyzingTitle}>No pudimos analizar tu perfil</Text>
        <Text style={styles.analyzingSubtitle}>{error ?? "Intenta nuevamente"}</Text>
        <Pressable onPress={onRetry} style={[styles.primaryButton, { marginTop: 24 }]}>
          <Text style={styles.primaryButtonText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const riesgo = riesgoColors(analysis.riesgo_cardiometabolico);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Tu plan, {nombre}</Text>

      <View style={styles.card}>
        <Text style={styles.cardText}>{analysis.resumen}</Text>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>IMC</Text>
          <Text style={styles.metricValue}>{analysis.imc}</Text>
          <Text style={styles.metricSubtext}>{analysis.imc_categoria}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>% Grasa corporal</Text>
          <Text style={styles.metricValue}>{analysis.porcentaje_grasa}%</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Masa magra</Text>
          <Text style={styles.metricValue}>{analysis.masa_magra_kg} kg</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Complexión</Text>
          <Text style={styles.metricValue}>{analysis.complexion}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tu objetivo</Text>
        <Text style={styles.cardText}>
          Peso objetivo: {analysis.peso_objetivo_kg} kg
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Etapas</Text>
        {analysis.etapas.map((etapa, i) => (
          <Text key={i} style={styles.cardText}>
            • {etapa.peso_kg} kg — {etapa.descripcion}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Plan diario</Text>
        <Text style={styles.cardText}>Calorías: {analysis.calorias_objetivo} kcal</Text>
        <Text style={styles.cardText}>Proteína: {analysis.proteina_g} g</Text>
        <Text style={styles.cardText}>Carbohidratos: {analysis.carbos_g} g</Text>
        <Text style={styles.cardText}>Grasas: {analysis.grasas_g} g</Text>
      </View>

      <View style={[styles.card, { backgroundColor: riesgo.background }]}>
        <Text style={styles.cardTitle}>Riesgo cardiometabólico</Text>
        <Text style={[styles.cardText, { color: riesgo.color, fontWeight: "600" }]}>
          {analysis.riesgo_cardiometabolico.toUpperCase()}
        </Text>
      </View>

      <Pressable
        onPress={onConfirm}
        disabled={saving}
        style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Empezar mi plan</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  progressRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.cardBorder,
  },
  progressSegmentActive: {
    backgroundColor: COLORS.teal,
  },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "500", color: COLORS.textPrimary, marginBottom: 6 },
  note: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  choiceButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  choiceButtonActive: {
    backgroundColor: COLORS.teal,
    borderColor: COLORS.teal,
  },
  choiceText: { fontSize: 15, fontWeight: "500", color: COLORS.textPrimary },
  choiceTextActive: { color: COLORS.white },
  primaryButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "600" },
  backButton: { alignItems: "center", paddingVertical: 16 },
  backButtonText: { color: COLORS.textSecondary, fontSize: 14 },
  marker: { width: 10, height: 10, borderRadius: 5 },
  diagramContainer: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    position: "relative",
  },
  silhouetteHead: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.cardBorder,
  },
  silhouetteNeck: {
    width: 16,
    height: 12,
    backgroundColor: COLORS.cardBorder,
    alignItems: "center",
  },
  silhouetteTorso: {
    width: 70,
    height: 90,
    borderRadius: 16,
    backgroundColor: COLORS.cardBorder,
    alignItems: "center",
  },
  silhouetteArm: {
    position: "absolute",
    right: 8,
    top: 60,
    width: 14,
    height: 60,
    borderRadius: 7,
    backgroundColor: COLORS.cardBorder,
    alignItems: "center",
  },
  silhouetteLegs: {
    width: 50,
    height: 4,
  },
  diagramDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  analyzingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  analyzingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginTop: 24,
    textAlign: "center",
  },
  analyzingSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
    textAlign: "center",
  },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  cardText: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    width: "47%",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  metricLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  metricValue: { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary },
  metricSubtext: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});
