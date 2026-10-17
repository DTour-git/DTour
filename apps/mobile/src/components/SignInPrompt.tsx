import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@dtour/shared';
import { T } from './T';
import { LogoMark, PrimaryBtn, Screen } from './ui';

/** Shown on the You tab to visitors. */
export function SignInPrompt() {
  const router = useRouter();
  return (
    <Screen>
      <View style={{ padding: 24, paddingTop: 48 }}>
        <LogoMark size={34} />
        <T size={30} w={600} ls={-0.025} style={{ marginTop: 20 }}>Your DTour</T>
        <T size={16.5} i lh={1.45} color={colors.neutral800} style={{ marginTop: 8 }}>
          Sign in with your DTU account to post, reply, vote, RSVP, join teams, chat in the Lounge and get notified when someone replies.
        </T>
        <PrimaryBtn label="Sign in" height={48} onPress={() => router.push('/login')} style={{ marginTop: 24 }} />
      </View>
    </Screen>
  );
}
