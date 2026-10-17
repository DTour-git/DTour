import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { colors, fonts } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { IconBtn, LogoMark, PrimaryBtn, Screen } from '@/components/ui';
import { useRouter } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();
const DOMAIN = 'dtu.ac.in';

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<'start' | 'code'>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const google = async () => {
    setBusy(true); setError(null);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true, queryParams: { hd: DOMAIN, prompt: 'select_account' } },
      });
      if (error || !data.url) throw error ?? new Error('Could not start Google sign-in');
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type === 'success') {
        const url = new URL(res.url);
        const err = url.searchParams.get('error_description');
        if (err) throw new Error(err);
        const authCode = url.searchParams.get('code');
        if (authCode) { const { error: ex } = await supabase.auth.exchangeCodeForSession(authCode); if (ex) throw ex; }
      }
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const send = async () => {
    const addr = email.trim().toLowerCase();
    if (!addr.endsWith(`@${DOMAIN}`)) { setError(`Use your @${DOMAIN} email address.`); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setError(error.message); else { setEmail(addr); setStep('code'); }
  };

  const verify = async () => {
    setBusy(true); setError(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    setBusy(false);
    if (error) setError(error.message);
  };

  const input = { height: 46, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 2, borderWidth: 1, borderColor: colors.divider, fontFamily: fonts.regular, fontSize: 15, color: colors.text } as const;

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingLeft: 6 }}><IconBtn name="x" label="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /></View>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <LogoMark size={34} /><T size={44} w={600} ls={-0.035} lh={1}>DTour</T>
          </View>
          <T size={18} i color={colors.neutral700} style={{ marginTop: 12, marginBottom: 22 }}>The campus, all in one place.</T>
          <View style={{ borderTopWidth: 3, borderBottomWidth: 1, borderColor: colors.text, paddingVertical: 10 }}>
            <T size={15} w={600}>{step === 'start' ? 'Sign in with your DTU account' : 'Check your DTU inbox'}</T>
          </View>
          {step === 'start' ? (
            <View style={{ marginTop: 26 }}>
              <PrimaryBtn label="Continue with Google" icon="google-logo" height={48} onPress={google} disabled={busy} />
              <T size={13} color={colors.neutral700} style={{ marginTop: 8 }}>Only @{DOMAIN} accounts can join.</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28, marginBottom: 18 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} /><T size={13} color={colors.neutral700}>or get a code by email</T><View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
              </View>
              <TextInput value={email} onChangeText={setEmail} placeholder={`name_2k24co123@${DOMAIN}`} placeholderTextColor={colors.neutral600}
                autoCapitalize="none" autoComplete="email" keyboardType="email-address" style={input} />
              <PrimaryBtn label="Send code" secondary onPress={send} disabled={busy} style={{ marginTop: 10 }} />
              <T size={13} lh={1.5} color={colors.neutral700} style={{ marginTop: 10 }}>Can’t open your DTU mail on this phone? Open it on any other device and type the 6-digit code here.</T>
            </View>
          ) : (
            <View style={{ marginTop: 26 }}>
              <T size={16} lh={1.55} style={{ marginBottom: 18 }}>We sent a 6-digit code to <T size={16} w={600}>{email}</T>. It expires in 10 minutes.</T>
              <TextInput value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" autoFocus
                style={[input, { height: 58, fontFamily: fonts.semibold, fontSize: 28, letterSpacing: 8, textAlign: 'center' }]} />
              <PrimaryBtn label="Sign in" height={48} onPress={verify} disabled={busy || code.length < 6} style={{ marginTop: 14 }} />
              <PrimaryBtn label="← Use a different email" secondary onPress={() => { setStep('start'); setCode(''); }} style={{ marginTop: 10, borderWidth: 0 }} />
            </View>
          )}
          {error && (
            <View style={{ marginTop: 20, padding: 12, backgroundColor: colors.accent2_100, borderRadius: 2, flexDirection: 'row', gap: 8 }}>
              <Icon name="warning" size={18} color={colors.accent2_800} /><T size={14} color={colors.accent2_800} style={{ flex: 1 }}>{error}</T>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
