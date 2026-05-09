import { createClient, type Session } from "@supabase/supabase-js";
import type { BackupData } from "./types";

const SUPABASE_URL = "https://ufxmtxyziymozszkoajw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmeG10eHl6aXltb3pzemtvYWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTE5MDAsImV4cCI6MjA5MzgyNzkwMH0.-Z9FZwTH7xx87BFKciVPkFtJMtb5k_FWrq-ofAeADwo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type CloudBackup = {
  backup_data: BackupData;
  updated_at: string;
};

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback: (session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function uploadCloudBackup(backup: BackupData) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("请先登录 Supabase");

  const { error } = await supabase.from("app_backups").upsert(
    {
      user_id: userId,
      backup_data: backup,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function downloadCloudBackup(): Promise<CloudBackup | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("请先登录 Supabase");

  const { data, error } = await supabase
    .from("app_backups")
    .select("backup_data, updated_at")
    .eq("user_id", userId)
    .maybeSingle<CloudBackup>();
  if (error) throw error;
  return data;
}
