import Link from 'next/link';
import { ago, n, type ThreadCard } from '@dtour/shared';
import { Icon } from './Icon';
import { FlairTag, Tag } from './ui';
import { threadHref } from '@/lib/routes';

/** List row for a thread — the "From the boards" featured layout at list scale. */
export function ThreadRow({ t, showBoard = true }: { t: ThreadCard; showBoard?: boolean }) {
  return (
    <Link href={threadHref(t)} className="row-rule hover-row" style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 18, padding: '20px 0', color: 'var(--color-text)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-neutral-700)' }}>
        <Icon name="arrow-fat-up" size={22} color="var(--color-accent)" />
        <span style={{ font: '600 17px var(--font-heading)', color: 'var(--color-text)' }}>{n(t.score)}</span>
        <span style={{ fontSize: 11 }}>votes</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-neutral-700)', flexWrap: 'wrap' }}>
          {showBoard && <Tag tone={t.board.category_id === 2 || t.board.category_id === 4 ? 'accent2' : t.board.category_id === 5 ? 'neutral' : 'accent'}>{t.board.short_name ?? t.board.name}</Tag>}
          {t.kind === 'question' && <Tag tone="neutral">Question</Tag>}
          {t.kind === 'poll' && <Tag tone="neutral">Poll</Tag>}
          <b style={{ color: 'var(--color-text)' }}>@{t.author.handle}</b><FlairTag person={t.author} />{ago(t.created_at)}
        </div>
        <div style={{ font: '600 22px/1.2 var(--font-heading)', margin: '8px 0 6px' }}>{t.title}</div>
        <div style={{ display: 'flex', gap: 22, fontSize: 14, color: 'var(--color-neutral-700)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="chat-circle" size={18} />{n(t.reply_count)} replies</span>
          {t.attachment && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="file-pdf" size={18} color="var(--color-accent-2)" />{t.attachment.name}</span>}
          {t.accepted_reply_id && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="check-circle" size={18} color="var(--color-accent)" />Answered</span>}
        </div>
      </div>
    </Link>
  );
}
