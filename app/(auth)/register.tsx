import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: name.trim() },
      },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView className="flex-1 justify-center bg-[#f8f7f4] px-6">
      <Text className="mb-8 text-3xl font-bold text-[#2C2C2A]">
        Crear cuenta
      </Text>

      <Text className="mb-1 text-sm font-medium text-[#2C2C2A]">Nombre</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        placeholder="Tu nombre"
        placeholderTextColor="#9CA3AF"
        className="mb-4 rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#2C2C2A]"
      />

      <Text className="mb-1 text-sm font-medium text-[#2C2C2A]">Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="tu@email.com"
        placeholderTextColor="#9CA3AF"
        className="mb-4 rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#2C2C2A]"
      />

      <Text className="mb-1 text-sm font-medium text-[#2C2C2A]">Contraseña</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        placeholder="••••••••"
        placeholderTextColor="#9CA3AF"
        className="mb-4 rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#2C2C2A]"
      />

      {error ? (
        <Text className="mb-4 text-sm text-red-600">{error}</Text>
      ) : null}

      <Pressable
        onPress={handleRegister}
        disabled={loading}
        className="mb-4 items-center rounded-xl bg-[#1D9E75] py-3"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">Registrarse</Text>
        )}
      </Pressable>

      <Link href="/(auth)/login" asChild>
        <Pressable>
          <Text className="text-center text-sm text-[#2C2C2A]">
            ¿Ya tienes cuenta?{" "}
            <Text className="font-semibold text-[#1D9E75]">Inicia sesión</Text>
          </Text>
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}
