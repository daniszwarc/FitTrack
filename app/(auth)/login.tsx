import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>Iniciar sesión</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="tu@email.com"
          placeholderTextColor="#888780"
          style={styles.input}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="••••••••"
          placeholderTextColor="#888780"
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={handleLogin} disabled={loading} style={styles.primaryButton}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Entrar</Text>
          )}
        </Pressable>

        <Link href="/(auth)/register" asChild>
          <Pressable>
            <Text style={styles.linkText}>
              ¿No tienes cuenta? <Text style={styles.linkTextAccent}>Regístrate</Text>
            </Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, justifyContent: "center", backgroundColor: "#f8f7f4" },
  content: { paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: "700", color: "#2C2C2A", marginBottom: 32 },
  label: { fontSize: 14, fontWeight: "500", color: "#2C2C2A", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e8e7e1",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    color: "#2C2C2A",
    marginBottom: 20,
  },
  error: { marginBottom: 16, fontSize: 14, color: "#993C1D" },
  primaryButton: {
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#1D9E75",
    paddingVertical: 14,
    marginBottom: 20,
  },
  primaryButtonText: { fontSize: 16, fontWeight: "600", color: "#ffffff" },
  linkText: { textAlign: "center", fontSize: 14, color: "#2C2C2A" },
  linkTextAccent: { fontWeight: "600", color: "#1D9E75" },
});
