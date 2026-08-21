import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ApiError, describeError } from "@/api/errors";
import {
  Avatar,
  Card,
  ErrorBanner,
  Field,
  GhostButton,
  Pill,
  PrimaryButton,
  ProgressBar,
  SectionLabel,
} from "@/components/online/Controls";
import { OnlineScreen } from "@/components/online/Screen";
import { OnlineGradients, OnlinePalette } from "@/components/online/theme";
import { t } from "@/i18n";
import { useSession } from "@/online/session";

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

export default function ProfileScreen(): ReactElement {
  const { user, api, applyUser, logout } = useSession();

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
      <OnlineScreen title={t("online.profile.title")} backTo="/online">
        <ErrorBanner message={t("online.error.sessionExpired")} />
      </OnlineScreen>
    );
  }

  const memberSince = new Date(user.createdAt).toLocaleDateString();

  return (
    <OnlineScreen
      badge={t("online.profile.badge")}
      title={t("online.profile.title")}
      subtitle={t("online.profile.subtitle")}
      backTo="/online"
    >
      {banner ? <ErrorBanner message={banner} /> : null}

      <Card>
        <View style={styles.identityRow}>
          <Avatar username={user.username} size={62} />
          <View style={styles.identityText}>
            <Text style={styles.username}>{user.username}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
        </View>

        <View style={styles.levelRow}>
          <Pill label={t("online.level", { level: user.level })} tone="accent" />
          <Text style={styles.xpText}>{t("online.xp", { xp: user.xp })}</Text>
        </View>

        <View style={styles.progressBlock}>
          <ProgressBar value={user.progress.progress} />
          <Text style={styles.progressHint}>
            {t("online.profile.nextLevel", {
              xp: user.progress.xpToNextLevel,
              level: user.level + 1,
            })}
          </Text>
        </View>
      </Card>

      <SectionLabel title={t("online.profile.account")} />

      <Card>
        {editing ? (
          <>
            <Field
              label={t("online.auth.username")}
              value={username}
              onChangeText={setUsername}
              hint={t("online.auth.usernameHint")}
              error={fieldError}
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <PrimaryButton
              label={t("online.profile.save")}
              onPress={save}
              loading={busy}
            />
            <View style={styles.cancelRow}>
              <GhostButton
                label={t("online.profile.cancel")}
                onPress={cancelEditing}
                disabled={busy}
              />
            </View>
          </>
        ) : (
          <>
            <InfoRow
              label={t("online.auth.username")}
              value={user.username}
            />
            <InfoRow label={t("online.auth.email")} value={user.email} />
            <InfoRow
              label={t("online.profile.memberSince")}
              value={memberSince}
            />

            {saved ? (
              <Text style={styles.savedNote}>
                ✅ {t("online.profile.saved")}
              </Text>
            ) : null}

            <View style={styles.editRow}>
              <GhostButton
                label={t("online.profile.edit")}
                onPress={startEditing}
                tone="accent"
              />
            </View>
          </>
        )}
      </Card>

      <SectionLabel
        title={t("online.profile.session")}
        hint={t("online.profile.sessionHint")}
      />

      <Card>
        <PrimaryButton
          label={t("online.profile.logout")}
          onPress={signOut}
          loading={signingOut}
          colors={OnlineGradients.danger}
        />
      </Card>
    </OnlineScreen>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  identityText: {
    flex: 1,
  },
  username: {
    color: OnlinePalette.text,
    fontSize: 22,
    fontWeight: "800",
    fontFamily: "System",
  },
  email: {
    marginTop: 4,
    color: OnlinePalette.textFaint,
    fontSize: 13,
    fontFamily: "System",
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  xpText: {
    color: OnlinePalette.textMuted,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  progressBlock: {
    marginTop: 12,
  },
  progressHint: {
    marginTop: 8,
    color: OnlinePalette.textFaint,
    fontSize: 12,
    fontFamily: "System",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: OnlinePalette.border,
    gap: 16,
  },
  infoLabel: {
    color: OnlinePalette.textFaint,
    fontSize: 13,
    fontFamily: "System",
  },
  infoValue: {
    flexShrink: 1,
    color: OnlinePalette.textSoft,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "System",
    textAlign: "right",
  },
  savedNote: {
    marginTop: 14,
    color: "#6EE7B7",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "System",
  },
  editRow: {
    marginTop: 16,
  },
  cancelRow: {
    marginTop: 10,
  },
});
