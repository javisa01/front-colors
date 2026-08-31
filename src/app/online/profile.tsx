import type { ReactElement } from "react";
import { useOnlineTabBarSpace } from "@/components/online/OnlineTabBar";
import { AmbientOrbs } from "@/design/Ambient";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ApiError, describeError } from "@/api/errors";
import { SettingsButton } from "@/components/SettingsButton";
import { Avatar } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { ErrorBanner, Pill, ProgressBar } from "@/design/Feedback";
import { Field, InfoRow, Notice } from "@/design/Form";
import { Card, Screen, SectionHeader } from "@/design/Layout";
import { Space, Type } from "@/design/tokens";
import { t } from "@/i18n";
import { useSession } from "@/online/session";

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

/**
 * Ficha del jugador: identidad, progreso y salida de sesión.
 *
 * El bloque de cuenta alterna entre lectura y edición en el mismo sitio, sin
 * abrir un modal: solo hay un campo editable, y sacar una capa encima para
 * cambiar una línea es más ceremonia de la que el cambio merece.
 */
export default function ProfileScreen(): ReactElement {
  const { user, api, applyUser, logout } = useSession();
  const tabBarSpace = useOnlineTabBarSpace();

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username ?? "");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const startEditing = useCallback(() => {
    setUsername(user?.username ?? "");
    setFieldError(undefined);
    setBanner(null);
    setSaved(false);
    setEditing(true);
  }, [user]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setFieldError(undefined);
    setBanner(null);
  }, []);

  const save = useCallback(async () => {
    const clean = username.trim();

    if (clean === user?.username) {
      setEditing(false);
      return;
    }
    if (clean.length < 3 || clean.length > 24) {
      setFieldError(t("online.auth.error.usernameLength"));
      return;
    }
    if (!USERNAME_PATTERN.test(clean)) {
      setFieldError(t("online.auth.error.usernameChars"));
      return;
    }

    setBusy(true);
    setFieldError(undefined);
    setBanner(null);
    try {
      const { user: updated } = await api.users.updateMe({ username: clean });
      await applyUser(updated);
      setEditing(false);
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === "USERNAME_ALREADY_USED") {
        setFieldError(describeError(error));
      } else {
        setBanner(describeError(error));
      }
    } finally {
      setBusy(false);
    }
  }, [username, user, api, applyUser]);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    // No hace falta navegar: al caer la sesión, la guarda del layout online
    // manda a `/online/auth`.
    await logout();
  }, [logout]);

  if (!user) {
    return (
      <Screen
        title={t("online.profile.title")}
        backdrop={<AmbientOrbs />}
        contentStyle={{ paddingBottom: tabBarSpace }}
        headerAction={<SettingsButton />}
      >
        <ErrorBanner message={t("online.error.sessionExpired")} />
      </Screen>
    );
  }

  const memberSince = new Date(user.createdAt).toLocaleDateString();

  return (
    <Screen
      eyebrow={t("online.profile.badge")}
      title={t("online.profile.title")}
      subtitle={t("online.profile.subtitle")}
      backdrop={<AmbientOrbs />}
      contentStyle={{ paddingBottom: tabBarSpace }}
      headerAction={<SettingsButton />}
    >
      {banner ? <ErrorBanner message={banner} /> : null}

      <Card style={styles.block}>
        <View style={styles.identityRow}>
          <Avatar username={user.username} size={60} />
          <View style={styles.identityText}>
            <Text style={Type.title} numberOfLines={1}>
              {user.username}
            </Text>
            <Text style={Type.caption} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
        </View>

        <View style={styles.levelRow}>
          <Pill label={t("online.level", { level: user.level })} tone="accent" />
          <Text style={Type.metricSmall}>{t("online.xp", { xp: user.xp })}</Text>
        </View>

        <ProgressBar value={user.progress.progress} />
        <Text style={[Type.caption, styles.progressHint]}>
          {t("online.profile.nextLevel", {
            xp: user.progress.xpToNextLevel,
            level: user.level + 1,
          })}
        </Text>
      </Card>

      <SectionHeader title={t("online.profile.account")} />

      <Card style={styles.block}>
        {editing ? (
          <>
            <Field
              label={t("online.auth.username")}
              value={username}
              onChangeText={setUsername}
              hint={t("online.auth.usernameHint")}
              error={fieldError}
              icon="user"
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <View style={styles.actions}>
              <Button
                label={t("online.profile.save")}
                icon="check"
                onPress={save}
                loading={busy}
              />
              <Button
                label={t("online.profile.cancel")}
                variant="ghost"
                size="md"
                onPress={cancelEditing}
                disabled={busy}
              />
            </View>
          </>
        ) : (
          <>
            <InfoRow label={t("online.auth.username")} value={user.username} />
            <InfoRow label={t("online.auth.email")} value={user.email} />
            <InfoRow
              label={t("online.profile.memberSince")}
              value={memberSince}
              last
            />

            {saved ? <Notice message={t("online.profile.saved")} /> : null}

            <Button
              label={t("online.profile.edit")}
              icon="edit"
              variant="secondary"
              size="md"
              onPress={startEditing}
              style={styles.editButton}
            />
          </>
        )}
      </Card>

      <SectionHeader
        title={t("online.profile.session")}
        hint={t("online.profile.sessionHint")}
      />

      <Button
        label={t("online.profile.logout")}
        icon="logOut"
        variant="danger"
        onPress={signOut}
        loading={signingOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: Space.xxl,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
  },
  identityText: {
    flex: 1,
    gap: Space.xxs,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Space.xl,
    marginBottom: Space.md,
  },
  progressHint: {
    marginTop: Space.sm,
  },
  actions: {
    gap: Space.sm,
  },
  editButton: {
    marginTop: Space.lg,
  },
});
