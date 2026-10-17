import { OpenLounge } from './OpenLounge';

// /lounge?room=… (linked from mention notifications) opens the Lounge drawer over Today.
export default async function LoungeLink({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const { room } = await searchParams;
  return <OpenLounge room={room ?? 'global'} />;
}
