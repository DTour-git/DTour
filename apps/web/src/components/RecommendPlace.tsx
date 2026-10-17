'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { recommendPlace } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from './Icon';
import { useShell } from './shell/Shell';

export function RecommendPlace() {
  const { requireMe, toast } = useShell();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ category: 'nearby', name: '', where: '', price: '' });
  const save = async () => {
    const me = requireMe(); if (!me || !f.name.trim()) return;
    try {
      await recommendPlace(supabaseBrowser(), { userId: me.id, category: f.category, name: f.name.trim(), whereLabel: f.where.trim(), priceLabel: f.price.trim() });
      toast('Thanks — added to Kahan chalein?'); setOpen(false); router.refresh();
    } catch (e) { toast((e as Error).message); }
  };
  return (
    <>
      <button className="btn btn-primary" onClick={() => requireMe() && setOpen(true)}><Icon name="plus" size={17} />Recommend a place</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)} style={{ zIndex: 40 }}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-bg)' }}>
            <div className="dialog-title">Recommend a place</div>
            <div className="seg">
              {[['canteen', 'Canteen'], ['nearby', 'Khaana nearby'], ['chill', 'Chill spot']].map(([k, l]) => (
                <label key={k} className="seg-opt"><input type="radio" name="cat" checked={f.category === k} onChange={() => setF({ ...f, category: k })} />{l}</label>
              ))}
            </div>
            <input className="input" placeholder="Name — e.g. Sec-11 momo lane" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={{ height: 40 }} />
            <input className="input" placeholder="Where — e.g. Rohini · after 8 pm" value={f.where} onChange={(e) => setF({ ...f, where: e.target.value })} style={{ height: 40 }} />
            <input className="input" placeholder="Price — e.g. ₹60 or ₹₹" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} style={{ height: 40 }} />
            <div className="dialog-actions"><button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Add</button></div>
          </div>
        </div>
      )}
    </>
  );
}
