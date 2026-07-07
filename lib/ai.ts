export type OnboardingInput = {
  nombre: string;
  sexo: "hombre" | "mujer";
  fecha_nacimiento: string;
  altura_cm: number;
  peso_kg: number;
  cintura_cm: number;
  cadera_cm: number;
  cuello_cm: number;
  muneca_cm: number;
};

export type ProfileAnalysis = {
  imc: number;
  imc_categoria: string;
  porcentaje_grasa: number;
  masa_grasa_kg: number;
  masa_magra_kg: number;
  complexion: "pequeña" | "mediana" | "grande";
  ratio_cintura_altura: number;
  ratio_cintura_cadera: number;
  riesgo_cardiometabolico: "bajo" | "moderado" | "alto";
  bmr: number;
  tdee: number;
  calorias_objetivo: number;
  proteina_g: number;
  carbos_g: number;
  grasas_g: number;
  peso_objetivo_kg: number;
  etapas: { peso_kg: number; descripcion: string }[];
  resumen: string;
};

function calcularEdad(fechaNacimiento: string): number {
  const [dia, mes, anio] = fechaNacimiento.split("/").map(Number);
  const nacimiento = new Date(anio, mes - 1, dia);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}

export async function analyzeProfile(input: OnboardingInput): Promise<ProfileAnalysis> {
  const edad = calcularEdad(input.fecha_nacimiento);

  const prompt = `Sos un nutricionista y especialista en composición corporal.
Analizá este perfil y devolvé SOLO un JSON sin texto adicional:

Datos:
- Nombre: ${input.nombre}
- Sexo: ${input.sexo}
- Edad: ${edad} años
- Altura: ${input.altura_cm} cm
- Peso: ${input.peso_kg} kg
- Cintura: ${input.cintura_cm} cm
- Cadera: ${input.cadera_cm} cm
- Cuello: ${input.cuello_cm} cm
- Muñeca: ${input.muneca_cm} cm

Calculá y devolvé:
{
  "imc": número con 1 decimal,
  "imc_categoria": texto (Peso saludable/Sobrepeso/Obesidad grado I/II/III),
  "porcentaje_grasa": número con 1 decimal (fórmula Navy para hombres:
    495/(1.0324-0.19077*log10(cintura-cuello)+0.15456*log10(altura))-450,
    para mujeres usar fórmula Navy con cadera),
  "masa_grasa_kg": número con 1 decimal,
  "masa_magra_kg": número con 1 decimal,
  "complexion": "pequeña" | "mediana" | "grande" (Complexión ósea (SOLO para hombres, calcular altura_cm / muneca_cm):
    - resultado > 10.4 → complexión pequeña
    - resultado entre 9.6 y 10.4 → complexión mediana
    - resultado < 9.6 → complexión grande
    Ejemplo: 176 / 20.5 = 8.58 → complexión grande),
  "ratio_cintura_altura": número con 2 decimales,
  "ratio_cintura_cadera": número con 2 decimales,
  "riesgo_cardiometabolico": "bajo" | "moderado" | "alto",
  "bmr": número entero (Mifflin-St Jeor),
  "tdee": número entero (BMR * 1.55 actividad moderada),
  "calorias_objetivo": número entero (TDEE - 500),
  "proteina_g": número entero (peso_kg * 1.4, redondeado),
  "carbos_g": número entero,
  "grasas_g": número entero,
  "peso_objetivo_kg": número con 1 decimal (masa_magra / 0.82
    para llegar a ~18% grasa, ajustado por complexión),
  "etapas": [
    { "peso_kg": número, "descripcion": texto corto },
    ... (3-4 etapas desde peso actual hasta objetivo)
  ],
  "resumen": texto de 2-3 oraciones explicando el análisis
    en tono positivo y motivador, en español
}`;

  const response = await fetch("https://api.nan.builders/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_NAN_BUILDERS_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen3.6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Error al analizar perfil: ${response.status}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Respuesta del AI no contiene un JSON válido");
  }

  return JSON.parse(jsonMatch[0]) as ProfileAnalysis;
}
