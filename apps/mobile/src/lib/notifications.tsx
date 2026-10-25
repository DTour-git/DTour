import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { unreadNotificationCount } from '@dtour/shared';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { appRoute } from './routes';
import { loadNotifications, pushSupported, registerPush } from './push';

const Ctx = createContext<{ unread: number; setUnread: (n: number) => void; version: number }>({ unread: 0, setUnread: () => {}, version: 0 });
export const useNotifications = () => useContext(Ctx);

function PushResponseListener() {
  const router = useRouter();
  const Notifications = loadNotifications()!; // only rendered when pushSupported
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const route = lastResponse.notification.request.content.data?.route;
    if (typeof route === 'string') {
      Notifications.clearLastNotificationResponse();
      router.push(appRoute(route));
    }
  }, [lastResponse, router, Notifications]);
  return null;
}

/** Live unread count (realtime on the user's own notification rows). */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const [unread, setUnread] = useState(0);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!profile || !session) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    unreadNotificationCount(supabase).then(setUnread);
    (async () => {
      await supabase.realtime.setAuth(session.access_token); // RLS needs the user's JWT on the socket
      ch = supabase.channel(`notifications:${profile.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => {
          unreadNotificationCount(supabase).then(setUnread);
          setVersion((v) => v + 1);
        }).subscribe();
    })();
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [profile?.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile || !session) return;
    // Previously granted permission is enough to refresh the token silently.
    registerPush(profile.id).catch(() => {});
  }, [profile, session]);

  return <Ctx.Provider value={{ unread: profile ? unread : 0, setUnread, version }}>
    {profile && pushSupported && <PushResponseListener />}
    {children}
  </Ctx.Provider>;
}
