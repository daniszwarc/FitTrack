import { supabase } from "@/lib/supabase";

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function fetchLatestWeight(userId: string) {
  const { data, error } = await supabase
    .from("weight_logs")
    .select("peso_kg, fecha")
    .eq("user_id", userId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchLatestMeasurement(userId: string) {
  const { data, error } = await supabase
    .from("measurements")
    .select("cintura_cm, fecha")
    .eq("user_id", userId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchTodayFoodTotals(userId: string) {
  const { data, error } = await supabase
    .from("food_logs")
    .select("kcal, proteina_g")
    .eq("user_id", userId)
    .eq("fecha", todayDateString());

  if (error) throw error;

  return (data ?? []).reduce(
    (acc, row) => ({
      calories: acc.calories + (row.kcal ?? 0),
      protein: acc.protein + (row.proteina_g ?? 0),
    }),
    { calories: 0, protein: 0 }
  );
}

export async function fetchTodayWalkMinutes(userId: string) {
  const { data, error } = await supabase
    .from("workout_logs")
    .select("duracion_min")
    .eq("user_id", userId)
    .eq("fecha", todayDateString())
    .eq("dia_tipo", "caminata");

  if (error) throw error;

  return (data ?? []).reduce((sum, row) => sum + (row.duracion_min ?? 0), 0);
}

export async function insertWalkSession(userId: string, duracionMin: number) {
  const { error } = await supabase.from("workout_logs").insert({
    user_id: userId,
    fecha: todayDateString(),
    dia_tipo: "caminata",
    duracion_min: duracionMin,
  });

  if (error) throw error;
}

export async function insertGymSession(
  userId: string,
  diaTipo: "A" | "B",
  ejerciciosCompletados: string[]
) {
  const { error } = await supabase.from("workout_logs").insert({
    user_id: userId,
    fecha: todayDateString(),
    dia_tipo: diaTipo,
    ejercicios_completados: ejerciciosCompletados,
  });

  if (error) throw error;
}

export type TipoComida = "desayuno" | "almuerzo" | "merienda" | "cena";

export type FoodLog = {
  id: string;
  nombre: string;
  tipo_comida: TipoComida;
  kcal: number;
  proteina_g: number | null;
  carbos_g: number | null;
  grasas_g: number | null;
};

export async function fetchTodayFoodLogs(userId: string): Promise<FoodLog[]> {
  const { data, error } = await supabase
    .from("food_logs")
    .select("id, nombre, tipo_comida, kcal, proteina_g, carbos_g, grasas_g")
    .eq("user_id", userId)
    .eq("fecha", todayDateString())
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function insertFoodLog(
  userId: string,
  tipoComida: TipoComida,
  input: {
    nombre: string;
    kcal: number;
    proteina_g?: number | null;
    carbos_g?: number | null;
    grasas_g?: number | null;
  }
) {
  const { error } = await supabase.from("food_logs").insert({
    user_id: userId,
    fecha: todayDateString(),
    tipo_comida: tipoComida,
    nombre: input.nombre,
    kcal: input.kcal,
    proteina_g: input.proteina_g ?? null,
    carbos_g: input.carbos_g ?? null,
    grasas_g: input.grasas_g ?? null,
  });

  if (error) throw error;
}

export async function deleteFoodLog(id: string) {
  const { error } = await supabase.from("food_logs").delete().eq("id", id);
  if (error) throw error;
}

function startOfWeekDateString() {
  const now = new Date();
  const day = now.getDay(); // 0 = domingo
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const dayStr = String(monday.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayStr}`;
}

export type WeightLog = {
  id: string;
  peso_kg: number;
  fecha: string;
};

export async function fetchWeightLogs(userId: string, limit = 7): Promise<WeightLog[]> {
  const { data, error } = await supabase
    .from("weight_logs")
    .select("id, peso_kg, fecha")
    .eq("user_id", userId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).reverse();
}

export type Measurement = {
  id: string;
  fecha: string;
  cintura_cm: number | null;
  cadera_cm: number | null;
  cuello_cm: number | null;
  muneca_cm: number | null;
};

export async function fetchLatestMeasurements(userId: string, limit = 2): Promise<Measurement[]> {
  const { data, error } = await supabase
    .from("measurements")
    .select("id, fecha, cintura_cm, cadera_cm, cuello_cm, muneca_cm")
    .eq("user_id", userId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function fetchWorkoutStreak(userId: string) {
  const { data, error } = await supabase
    .from("workout_logs")
    .select("fecha, dia_tipo")
    .eq("user_id", userId)
    .order("fecha", { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const uniqueDates = Array.from(new Set(rows.map((row) => row.fecha))).sort(
    (a, b) => (a < b ? 1 : -1)
  );

  let streakDays = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const dateStr of uniqueDates) {
    const cursorStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(
      cursor.getDate()
    ).padStart(2, "0")}`;
    if (dateStr === cursorStr) {
      streakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (dateStr < cursorStr) {
      break;
    }
  }

  const weekStart = startOfWeekDateString();
  const thisWeekRows = rows.filter((row) => row.fecha >= weekStart);
  const gymSessionsThisWeek = thisWeekRows.filter(
    (row) => row.dia_tipo === "A" || row.dia_tipo === "B"
  ).length;

  const { data: walkRows, error: walkError } = await supabase
    .from("workout_logs")
    .select("duracion_min")
    .eq("user_id", userId)
    .eq("dia_tipo", "caminata")
    .gte("fecha", weekStart);

  if (walkError) throw walkError;

  const walkMinutesThisWeek = (walkRows ?? []).reduce(
    (sum, row) => sum + (row.duracion_min ?? 0),
    0
  );

  return { streakDays, gymSessionsThisWeek, walkMinutesThisWeek };
}

export async function insertWeight(userId: string, pesoKg: number) {
  const { error } = await supabase.from("weight_logs").insert({
    user_id: userId,
    fecha: todayDateString(),
    peso_kg: pesoKg,
  });

  if (error) throw error;
}

export async function insertMeasurements(
  userId: string,
  input: {
    cintura_cm?: number | null;
    cadera_cm?: number | null;
    cuello_cm?: number | null;
    muneca_cm?: number | null;
  }
) {
  const { error } = await supabase.from("measurements").insert({
    user_id: userId,
    fecha: todayDateString(),
    cintura_cm: input.cintura_cm ?? null,
    cadera_cm: input.cadera_cm ?? null,
    cuello_cm: input.cuello_cm ?? null,
    muneca_cm: input.muneca_cm ?? null,
  });

  if (error) throw error;
}

export type Profile = {
  altura_cm: number | null;
  objetivo_kg: number | null;
};

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("altura_cm, objetivo_kg")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  input: {
    full_name: string;
    altura_cm: number;
    peso_inicial_kg: number;
    objetivo_kg: number;
    fecha_nacimiento: string;
    sexo?: "M" | "F";
  }
) {
  const profileData = { id: userId, ...input };
  console.log("Saving profile...", profileData);
  const { error } = await supabase.from("profiles").upsert(profileData);
  console.log("Profile result:", error);

  if (error) throw error;
}

export async function fetchDashboardData(userId: string) {
  const [weight, measurement, food, walkMinutes] = await Promise.all([
    fetchLatestWeight(userId),
    fetchLatestMeasurement(userId),
    fetchTodayFoodTotals(userId),
    fetchTodayWalkMinutes(userId),
  ]);

  return {
    weightKg: weight?.peso_kg ?? null,
    waistCm: measurement?.cintura_cm ?? null,
    caloriesToday: food.calories,
    proteinToday: food.protein,
    walkMinutesToday: walkMinutes,
  };
}
