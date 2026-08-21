import { LinearGradient } from "expo-linear-gradient";
import type { ReactElement, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { OnlineGradients, OnlinePalette } from "@/components/online/theme";
import { playTick } from "@/utils/sound";

// ---------------------------------------------------------------------------
// Contenedores
// ---------------------------------------------------------------------------

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}): ReactElement {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}): ReactElement {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  colors?: readonly [string, string];
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  colors = OnlineGradients.accent,
}: PrimaryButtonProps): ReactElement {
  const blocked = disabled || loading;

  return (
    <Pressable
      onPress={() => {
        if (blocked) {
          return;
        }
        playTick();
        onPress();
      }}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !blocked && styles.primaryButtonPressed,
        blocked && styles.primaryButtonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: loading }}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryGradient}
      >
        {loading ? (
          <ActivityIndicator color={OnlinePalette.text} />
        ) : (
          <Text style={styles.primaryText}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  tone = "neutral",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: "neutral" | "danger" | "accent";
  disabled?: boolean;
}): ReactElement {
  return (
    <Pressable
      onPress={() => {
        if (disabled) {
          return;
        }
        playTick();
        onPress();
      }}
      style={({ pressed }) => [
        styles.ghostButton,
        tone === "danger" && styles.ghostDanger,
        tone === "accent" && styles.ghostAccent,
        pressed && !disabled && styles.ghostPressed,
        disabled && styles.ghostDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text
        style={[
          styles.ghostText,
          tone === "danger" && styles.ghostTextDanger,
          tone === "accent" && styles.ghostTextAccent,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Campo de texto
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  maxLength?: number;
  onSubmitEditing?: () => void;
  returnKeyType?: TextInputProps["returnKeyType"];
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  secure = false,
  keyboardType,
  autoCapitalize = "none",
  autoComplete,
  maxLength,
  onSubmitEditing,
  returnKeyType = "next",
}: FieldProps): ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={OnlinePalette.textDim}
        style={[styles.input, !!error && styles.inputError]}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        maxLength={maxLength}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        accessibilityLabel={label}
      />
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Estados: error, vacío, cargando
// ---------------------------------------------------------------------------

export function ErrorBanner({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}): ReactElement {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <View style={styles.errorBody}>
        <Text style={styles.errorText}>{message}</Text>
        {onRetry && retryLabel ? (
          <Pressable
            onPress={() => {
              playTick();
              onRetry();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={retryLabel}
          >
            <Text style={styles.errorRetry}>{retryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function EmptyState({
  emoji,
  title,
  hint,
}: {
  emoji: string;
  title: string;
  hint?: string;
}): ReactElement {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

export function Loading({ label }: { label: string }): ReactElement {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={OnlinePalette.accent} size="large" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pastilla, avatar y progreso
// ---------------------------------------------------------------------------

export function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "accent" | "success" | "warning";
}): ReactElement {
  return (
    <View
      style={[
        styles.pill,
        tone === "accent" && styles.pillAccent,
        tone === "success" && styles.pillSuccess,
        tone === "warning" && styles.pillWarning,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          tone === "accent" && styles.pillTextAccent,
          tone === "success" && styles.pillTextSuccess,
          tone === "warning" && styles.pillTextWarning,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const AVATAR_PALETTES = [
  OnlineGradients.accent,
  OnlineGradients.violet,
  OnlineGradients.pink,
  OnlineGradients.success,
  OnlineGradients.gold,
];

/**
 * Inicial del nombre sobre un degradado derivado del propio nombre: el mismo
 * jugador sale siempre del mismo color, sin necesidad de guardar nada.
 */
export function Avatar({
  username,
  size = 46,
}: {
  username: string;
  size?: number;
}): ReactElement {
  let hash = 0;
  for (let index = 0; index < username.length; index += 1) {
    hash = (hash * 31 + username.charCodeAt(index)) % 997;
  }
  const colors = AVATAR_PALETTES[hash % AVATAR_PALETTES.length];

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 3.2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>
        {username.slice(0, 1).toUpperCase()}
      </Text>
    </LinearGradient>
  );
}

/** Barra de progreso al siguiente nivel; `value` va de 0 a 1. */
export function ProgressBar({ value }: { value: number }): ReactElement {
  const clamped = Math.max(0, Math.min(1, value));
  const width: `${number}%` = `${clamped * 100}%`;

  return (
    <View style={styles.progressTrack}>
      <LinearGradient
        colors={OnlineGradients.accent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.progressFill, { width }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: OnlinePalette.surface,
    borderWidth: 1,
    borderColor: OnlinePalette.border,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  sectionHeader: {
    marginTop: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    color: OnlinePalette.text,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: "System",
  },
  sectionHint: {
    marginTop: 4,
    color: OnlinePalette.textFaint,
    fontSize: 13,
    fontFamily: "System",
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 18,
    overflow: "hidden",
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryGradient: {
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  primaryText: {
    color: OnlinePalette.text,
    fontSize: 17,
    fontWeight: "800",
    fontFamily: "System",
  },
  ghostButton: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: OnlinePalette.border,
    backgroundColor: OnlinePalette.background,
    alignItems: "center",
  },
  ghostAccent: {
    borderColor: OnlinePalette.accent,
  },
  ghostDanger: {
    borderColor: OnlinePalette.dangerDeep,
  },
  ghostPressed: {
    opacity: 0.75,
  },
  ghostDisabled: {
    opacity: 0.45,
  },
  ghostText: {
    color: OnlinePalette.textSoft,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "System",
  },
  ghostTextAccent: {
    color: OnlinePalette.accentSoft,
  },
  ghostTextDanger: {
    color: "#FCA5A5",
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: OnlinePalette.textSoft,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 7,
    fontFamily: "System",
  },
  input: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: OnlinePalette.background,
    borderWidth: 1,
    borderColor: OnlinePalette.border,
    color: OnlinePalette.text,
    fontSize: 15,
    fontFamily: "System",
  },
  inputError: {
    borderColor: OnlinePalette.danger,
  },
  fieldHint: {
    marginTop: 6,
    color: OnlinePalette.textFaint,
    fontSize: 12,
    fontFamily: "System",
  },
  fieldError: {
    marginTop: 6,
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "System",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#2A1215",
    borderWidth: 1,
    borderColor: OnlinePalette.dangerDeep,
    marginBottom: 14,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorBody: {
    flex: 1,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "System",
  },
  errorRetry: {
    marginTop: 8,
    color: OnlinePalette.accentSoft,
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "System",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 34,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    color: OnlinePalette.textSoft,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: "System",
  },
  emptyHint: {
    marginTop: 6,
    color: OnlinePalette.textFaint,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    fontFamily: "System",
    maxWidth: 320,
  },
  loading: {
    alignItems: "center",
    paddingVertical: 44,
  },
  loadingText: {
    marginTop: 14,
    color: OnlinePalette.textMuted,
    fontSize: 14,
    fontFamily: "System",
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: OnlinePalette.border,
    borderWidth: 1,
    borderColor: OnlinePalette.border,
  },
  pillAccent: {
    backgroundColor: OnlinePalette.accentSurface,
    borderColor: OnlinePalette.accent,
  },
  pillSuccess: {
    backgroundColor: "#052E22",
    borderColor: OnlinePalette.successDeep,
  },
  pillWarning: {
    backgroundColor: "#2C1D05",
    borderColor: OnlinePalette.warning,
  },
  pillText: {
    color: OnlinePalette.textMuted,
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  pillTextAccent: {
    color: OnlinePalette.accentSoft,
  },
  pillTextSuccess: {
    color: "#6EE7B7",
  },
  pillTextWarning: {
    color: "#FCD34D",
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: OnlinePalette.text,
    fontWeight: "800",
    fontFamily: "System",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: OnlinePalette.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
});
