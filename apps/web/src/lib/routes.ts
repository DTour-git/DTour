export const threadHref = (t: { id: number; board: { slug: string } }) => `/b/${t.board.slug}/${t.id}`;
export const boardHref = (b: { slug: string; link_screen?: string | null }) =>
  b.link_screen === 'teams' ? '/teams' : b.link_screen === 'societies' ? '/societies' : b.link_screen === 'kahan' ? '/kahan-chalein' : `/b/${b.slug}`;
