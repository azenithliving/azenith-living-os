'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { arNum } from '@/lib/ops/metricLabels';
import { linkFromPhone } from '@/lib/cad/sketch-link';
import { imageKeyOf } from '@/lib/cad/vote-keys';
import { cleanDeviceKey, newDeviceKey } from '@/lib/cad/visit-keys';
import { ROOM_CHOICES } from '@/lib/cad/room-labels';
import { AREA_CHIPS, nearLabel, type TasteSource } from '@/lib/regions';
import { DRAWABLE_SHAPES, type Plan, type PlanOpening, type PlanShape } from '@/lib/cad/plan';
import RoomPlan from '@/components/cad/RoomPlan';
import ColourMatrix, { type MatrixEntry, type Pick as ColourPick } from '@/components/cad/ColourMatrix';

type Dimension = { label: string; meters: number; confirmed?: boolean };
type Sheet = {
  room: string | null;
  dimensions: Dimension[];
  openings: { kind: string; widthMeters: number | null }[];
  area_sqm: number | string | null;
  /** The room as the store walked it. Absent only on a paper whose shape is not settled. */
  plan?: Plan | null;
  shape_question?: string | null;
  /** The colours his room's pictures really carry, and the up-to-three he stopped on. */
  colour_matrix?: MatrixEntry[];
  colour_picks?: ColourPick[];
  confirmed_count: number;
  ok: boolean;
  failure: string | null;
  confirmed_at: string | null;
  sealed: boolean;
  unchanged: boolean;
  customer_dimensions: number[] | null;
  contact?: { hasPhone: boolean; city: string | null };
};

const OPENING_LABEL: Record<string, string> = { door: 'باب', window: 'شباك' };

/**
 * The customer's own sheet: what the store read from his drawing, and the numbers he
 * says are right. No account and no password — the long address is the whole login,
 * and it opens one sheet and nothing else.
 *
 * The address is read from the live path rather than a search hook so the page stays
 * prerenderable; a token that is not shaped like a token is never sent to the server.
 */
type SheetImage = {
  id: number | null;
  url: string;
  thumb: string;
  style: string | null;
  roomType: string;
  /** True when this picture is close to a colour he stopped on. */
  near?: boolean;
};

/** Which taste the store's pictures were ordered by, said in words the customer reads. */
type RegionTaste = { source: TasteSource; line: string; area: string | null; papers: number; colours: string[] };

const STYLE_LABEL: Record<string, string> = { modern: 'مودرن', classic: 'كلاسيك', minimal: 'مينيمال', luxury: 'فخم' };

export default function PassportPage() {
  const [token, setToken] = useState('');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [images, setImages] = useState<SheetImage[]>([]);
  const [imagesForHisRoom, setImagesForHisRoom] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [typed, setTyped] = useState<string[]>(['', '']);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [news, setNews] = useState<string | null>(null);
  const [tallies, setTallies] = useState<Record<string, { likes: number; voters: string[] }>>({});
  const [people, setPeople] = useState<string[]>([]);
  const [me, setMe] = useState('');
  const [voting, setVoting] = useState<string | null>(null);
  // The contact moment: his area, the room type when the paper never named one, and what the
  // bank actually sent back.
  const [city, setCity] = useState('');
  const [taste, setTaste] = useState<RegionTaste | null>(null);
  // Once he has started typing his area, a poll must not overwrite his letters with the stored one.
  const cityTouchedRef = useRef(false);
  const [roomChoice, setRoomChoice] = useState('');
  const [offer, setOffer] = useState<{ line: string; picks: SheetImage[]; matched: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  // A drag ends in one write; a second one while it is in the air would fight over the same row.
  const [drawing, setDrawing] = useState(false);
  // His colour taps: the draft is what he just pressed, until the store's answer replaces it.
  const [colourDraft, setColourDraft] = useState<ColourPick[] | null>(null);
  const [colouring, setColouring] = useState(false);
  // A poll that answers while a tap is still in the air can paint the count back to what it was
  // before the tap. Measured on the published site 2026-10-03: the first reader showed the
  // picture with no number at all for a moment.
  const votingRef = useRef<string | null>(null);

  /**
   * The phone's own label for itself: generated once, kept in its own storage, sent as a header, and
   * never a name. It is what lets the store tell «he came back to look» from «he refreshed twice»,
   * and nothing about the person can be read from it.
   */
  const ensureVisitKey = useCallback(() => {
    let saved = '';
    try {
      saved = String(window.localStorage.getItem('azenith-visit-key') ?? '');
    } catch {
      // A browser that will not store anything still gets a label for this one visit.
    }
    const known = cleanDeviceKey(saved);
    if (known) return known;
    const fresh = newDeviceKey();
    try {
      window.localStorage.setItem('azenith-visit-key', fresh);
    } catch {
      // Same: the label is a counting aid, the sheet is the record.
    }
    return fresh;
  }, []);

  const load = useCallback((target: string) => {
    fetch(`/api/passport/${target}`, { headers: { 'x-visit-key': ensureVisitKey() } })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          setSheet(data.sheet);
          setImages(Array.isArray(data.images) ? data.images : []);
          setImagesForHisRoom(Boolean(data.images_for_his_room));
          setTaste(data.taste ?? null);
          // His recorded area is the box's starting word, so a paper that already knows it does not
          // make him say it again.
          if (!cityTouchedRef.current) setCity(String(data.sheet?.contact?.city ?? ''));
        } else setProblem(data?.error || 'الورقة ما جاتش');
      })
      .catch(() => setProblem('المتجر ما ردّش'));
  }, [ensureVisitKey]);

  useEffect(() => {
    const match = window.location.pathname.match(/\/passport\/([A-Za-z0-9_-]{20,32})/);
    if (!match) {
      setProblem('العنوان ده مش عنوان ورقة');
      return;
    }
    setToken(match[1]);
    load(match[1]);
  }, [load]);

  const confirm = useCallback(async () => {
    if (!token || busy) return;
    const numbers = typed.map((v) => Number(v.replace(',', '.'))).filter((v) => Number.isFinite(v) && v > 0);
    if (numbers.length === 0) {
      setNews('اكتب مقاس واحد على الأقل بالأرقام');
      return;
    }
    // Checked with the store's own rule, so what he is told about his number and what the
    // shop stores for it cannot drift apart.
    const dialed = phone.trim();
    if (dialed && !linkFromPhone(dialed)) {
      setNews('الرقم ده مش موبايل مصري. سيبه فاضي لو مش عايز تسيب رقم.');
      return;
    }
    setBusy(true);
    setNews(null);
    try {
      const res = await fetch(`/api/passport/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // His own number, when he chooses to leave it: that is what lets the shop find this
        // sheet again the moment he calls.
        body: JSON.stringify({ dimensions: numbers, customer_phone: dialed || null }),
      });
      const data = await res.json();
      if (data?.success && data.sheet) setSheet(data.sheet);
      setNews(data?.message || data?.error || 'المتجر ما ردّش');
    } catch {
      setNews('المتجر ما ردّش — جرّب تاني');
    } finally {
      setBusy(false);
    }
  }, [busy, phone, token, typed]);

  /**
   * Two things he may say about his room without touching a measurement: which shape it is, and
   * where the door sits along its wall. Both go to the store's own builder, and what comes back is
   * what the sheet shows — a phone never keeps a drawing the record refused.
   */
  const sendPlan = useCallback(
    async (patch: { shape?: PlanShape; openings?: PlanOpening[] }) => {
      if (!token || drawing) return;
      setDrawing(true);
      setNews(null);
      try {
        const res = await fetch(`/api/passport/${token}/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const data = await res.json().catch(() => ({}));
        if (!data?.success) {
          setNews(String(data?.error || 'المتجر ما سجلش الرسم'));
          return;
        }
        setSheet((prev) => (prev ? { ...prev, plan: data.plan } : prev));
      } catch {
        setNews('المتجر ما ردّش — جرّب تاني');
      } finally {
        setDrawing(false);
      }
    },
    [drawing, token]
  );

  /**
   * His colours go to the store and come back from it. The re-order of his pictures is the store's
   * answer rather than a local sort, so what he sees and what the owner's file shows are one order.
   */
  const sendColours = useCallback(
    async (next: ColourPick[]) => {
      if (!token || colouring) return;
      setColourDraft(next);
      setColouring(true);
      setNews(null);
      try {
        const res = await fetch(`/api/passport/${token}/colours`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ picks: next }),
        });
        const data = await res.json().catch(() => ({}));
        if (!data?.success) {
          setNews(String(data?.error || 'المتجر ما سجلش الألوان'));
          setColourDraft(null);
          return;
        }
        load(token);
      } catch {
        setNews('المتجر ما ردّش — جرّب تاني');
        setColourDraft(null);
      } finally {
        setColouring(false);
      }
    },
    [colouring, load, token]
  );

  /**
   * Ask for the number at the moment it buys him something: he wants the suggestions on his
   * own phone, so the shop asks for the phone and the area in the same breath. The answer is
   * what the bank really holds — never a promise about measurements it cannot see.
   */
  const sendOffer = useCallback(async () => {
    if (sending || !token) return;
    setSending(true);
    setNews(null);
    try {
      const res = await fetch(`/api/passport/${token}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, city, room: roomChoice || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) {
        setNews(String(data?.error || 'المتجر ما سجلش الرقم'));
        return;
      }
      setOffer({ line: String(data.line ?? ''), picks: Array.isArray(data.picks?.images) ? data.picks.images : [], matched: Boolean(data.picks?.matched) });
      setTaste(data.taste ?? null);
    } catch {
      setNews('المتجر ما ردّش — جرّب تاني.');
    } finally {
      setSending(false);
    }
  }, [city, phone, roomChoice, sending, token]);

  const confirmed = Boolean(sheet?.confirmed_at);

  /**
   * The store's own areas, offered as taps before he types a letter — the free box stays, because
   * a customer in a district the map does not hold still gets his own word into the record rather
   * than a pick he never said.
   */
  const areaChips = (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {AREA_CHIPS.map((area) => (
        <button
          key={area}
          type="button"
          onClick={() => {
            cityTouchedRef.current = true;
            setCity(city.trim() === area ? '' : area);
          }}
          data-area-chip={area}
          data-area-chip-selected={city.trim() === area ? '1' : '0'}
          className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
            city.trim() === area
              ? 'border-amber-500/50 bg-amber-500/20 text-amber-100'
              : 'border-white/10 bg-white/5 text-white/60'
          }`}
        >
          {area}
        </button>
      ))}
    </div>
  );

  const applyVotes = useCallback(
    (data: { tallies?: Array<{ image_key: string; likes: number; voters: string[] }>; people?: string[] }) => {
      const next: Record<string, { likes: number; voters: string[] }> = {};
      for (const row of data.tallies ?? []) {
        next[String(row.image_key)] = { likes: Number(row.likes) || 0, voters: Array.isArray(row.voters) ? row.voters : [] };
      }
      setTallies(next);
      setPeople(Array.isArray(data.people) ? data.people : []);
    },
    []
  );

  // The family shares one address at the same time. Nothing is pushed to this page, so it asks
  // every twenty seconds — but only while it is the window somebody is actually looking at, and
  // again the moment it comes back. A poll that never sleeps spends the store's free ceilings on
  // a closed tab.
  useEffect(() => {
    if (!token) return;
    let stopped = false;
    const load = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (votingRef.current) return;
      fetch(`/api/passport/${token}/votes`)
        .then((r) => r.json())
        .then((data) => {
          if (!stopped && data?.success) applyVotes(data);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 20000);
    const onShow = () => load();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [applyVotes, token]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('azenith-family-name');
      if (saved) setMe(String(saved).slice(0, 24));
    } catch {
      // A browser that will not store a name is not a reason to lose the sheet.
    }
  }, []);

  const giveName = (value: string) => {
    const clean = value.replace(/[\u0000-\u001f<>]/g, ' ').slice(0, 24);
    setMe(clean);
    try {
      window.localStorage.setItem('azenith-family-name', clean);
    } catch {
      // Same: the name is a convenience, the vote is the record.
    }
  };

  const castVote = useCallback(
    async (image: SheetImage) => {
      if (!token || voting) return;
      const voter = me.trim();
      if (!voter) {
        setNews('اكتب اسمك الأول — من غير اسم مش بنعرف الصوت لمين.');
        return;
      }
      const key = imageKeyOf(image);
      const liked = !tallies[key]?.voters.includes(voter);
      const before = tallies;
      const voters = (before[key]?.voters ?? []).filter((name) => name !== voter);
      if (liked) voters.push(voter);
      setTallies({ ...before, [key]: { likes: voters.length, voters } });
      votingRef.current = key;
      setVoting(key);
      setNews(null);
      try {
        const res = await fetch(`/api/passport/${token}/votes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_key: key, image_url: image.url, voter, liked }),
        });
        const data = await res.json();
        if (data?.success) applyVotes(data);
        else {
          setTallies(before);
          setNews(data?.error || 'المتجر ما سجلش الصوت');
        }
      } catch {
        setTallies(before);
        setNews('المتجر ما ردّش — صوتك مش مسجل');
      } finally {
        votingRef.current = null;
        setVoting(null);
      }
    },
    [applyVotes, me, token, tallies, voting]
  );

  // Twenty thumbnails all wearing the same word say nothing twenty times. One style across
  // the set belongs in the heading; the word only returns under each picture when they vary.
  const styles = new Set(
    images.map((img) => (img.style ? STYLE_LABEL[img.style] : null)).filter(Boolean) as string[]
  );
  const onlyStyle = styles.size === 1 ? ([...styles][0] as string) : null;

  return (
    <main dir="rtl" className="min-h-screen bg-[#0d0f12] px-5 pb-16 pt-28 text-white">
      <div className="mx-auto max-w-md">
        <p className="text-[11px] font-bold tracking-wide text-amber-400">أزينث ليفينج</p>
        <h1 className="mt-1 text-xl font-black">{sheet?.room || 'ورقة مقاساتك'}</h1>

        {problem && <p className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-[12px] text-rose-300">{problem}</p>}

        {sheet && (
          <>
            <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <h2 className="text-[12px] font-bold text-white/60">اللي قريناه من رسمتك</h2>
              <ul className="mt-2 space-y-1.5">
                {sheet.dimensions.map((d, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate text-white/70">{d.label}</span>
                    <span className="shrink-0 font-black">
                      {arNum(d.meters)} متر
                      {d.confirmed && <span className="mr-2 text-[10px] font-bold text-emerald-300">متطابق</span>}
                    </span>
                  </li>
                ))}
                {sheet.dimensions.length === 0 && (
                  <li className="text-[12px] text-white/45">مفيش رقم اتأكد بعد — عشان كده مقاساتك تحت مهمة.</li>
                )}
              </ul>
              {sheet.openings.length > 0 && (
                <p className="mt-3 text-[11px] text-white/50">
                  الفتحات: {sheet.openings.map((o) => `${OPENING_LABEL[o.kind] ?? o.kind}${o.widthMeters ? ` ${arNum(o.widthMeters)}م` : ''}`).join(' · ')}
                </p>
              )}
              {sheet.area_sqm || sheet.plan?.areaSqm ? (
                <p className="mt-3 text-[12px] text-white/60">
                  المساحة الحسابية: {arNum(Number(sheet.plan?.complete ? sheet.plan.areaSqm : sheet.area_sqm))} متر مربع
                </p>
              ) : null}
              {sheet.failure && <p className="mt-3 text-[11px] leading-relaxed text-amber-300/90">{sheet.failure}</p>}
            </section>

            {/* The room the numbers describe, drawn before he signs it — the sheet he agrees to is
                this picture, not a list of digits. */}
            <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4" data-plan-block>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[12px] font-bold text-white/60">رسمتك</h2>
                {drawing && <span className="text-[10px] text-white/40">بأعدّل…</span>}
              </div>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-2">
                <RoomPlan
                  plan={sheet.plan ?? null}
                  question={sheet.shape_question}
                  interactive
                  shapes={sheet.dimensions.length >= 2 ? DRAWABLE_SHAPES : []}
                  onShape={(shape) => void sendPlan({ shape })}
                  onMove={(openings) => void sendPlan({ openings })}
                />
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-white/40">
                اسحب الباب أو الشباك على ضلعه يروح معاك — الأرقام اللي اتفقتنا عليها ما بتتغيرش بالسحب.
              </p>
            </section>

            {confirmed ? (
              <section className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                <h2 className="text-[13px] font-black text-emerald-300">دي ورقتك المعتمدة</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-white/70">
                  الأرقام اللي كتبتها: {Array.isArray(sheet.customer_dimensions) ? sheet.customer_dimensions.map((v) => arNum(Number(v))).join(' · ') : '—'}
                </p>
                <p className="mt-1 text-[11px] text-white/45">
                  {sheet.unchanged
                    ? 'مختومة ومفيش حاجة اتغيرت بعدها.'
                    : 'الأرقام على الورقة اتغيرت بعد اعتمادك — كلّمنا قبل أي تنفيذ.'}
                </p>
              </section>
            ) : (
              <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <h2 className="text-[12px] font-bold text-white/60">أكّد مقاساتك: اكتبها بنفسك</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                  اللي انت بتكتبه هو اللي بنشتغل بيه. لو رقمك طابق اللي قريناه، الورقة تتقفل وتاتبعتلك على طول.
                </p>
                <input
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="موبايلك — لو عايز نفضل متصلين بيك"
                  dir="ltr"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right text-[13px] text-white placeholder-white/25 focus:border-amber-500/40 focus:outline-none"
                />
                <div className="mt-2 grid grid-cols-2 gap-2" data-dim-fields>
                  {typed.map((value, i) => (
                    <input
                      key={i}
                      data-dim-input={i}
                      inputMode="decimal"
                      value={value}
                      onChange={(e) =>
                        setTyped((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                      }
                      placeholder={`مقاس ${arNum(i + 1)}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder-white/25 focus:border-amber-500/40 focus:outline-none"
                    />
                  ))}
                </div>
                <button
                  data-confirm-dims
                  onClick={confirm}
                  disabled={busy}
                  className="mt-3 w-full rounded-xl bg-amber-500/20 border border-amber-500/30 px-4 py-2.5 text-[13px] font-black text-amber-200 disabled:opacity-50"
                >
                  {busy ? 'بأأكد…' : 'أكّد مقاساتي'}
                </button>
                {news && <p data-dim-news className="mt-2 text-[11px] leading-relaxed text-white/60">{news}</p>}
              </section>
            )}
            {offer ? (
              <section
                className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4"
                data-contact-offer
                data-contact-sent
              >
                <h2 className="text-[12px] font-black text-emerald-200">{offer.line}</h2>
                {offer.picks.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {offer.picks.map((pick, i) => (
                      <img
                        key={pick.url}
                        src={pick.thumb}
                        alt={`اقتراح تجهيز ${arNum(i + 1)} من المتجر`}
                        data-offer-picture={pick.url}
                        className="aspect-square w-full rounded-xl border border-white/10 object-cover"
                      />
                    ))}
                  </div>
                )}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `ورقتي من أزينث: ${typeof window !== 'undefined' ? window.location.href : ''}${
                      offer.picks.length ? `\n${offer.picks.map((p) => p.url).join('\n')}` : ''
                    }`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  data-contact-share
                  className="mt-3 block rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2.5 text-center text-[13px] font-black text-emerald-100"
                >
                  ابعتها على واتساب وخلي المتجر يكمل معاك
                </a>
                <p className="mt-2 text-[10px] leading-relaxed text-white/45">
                  رقمك اتسجل مع الورقة دي، فالمتجر عارف صاحب الورقة مين من غير ما تسأل.
                </p>
              </section>
            ) : sheet?.contact?.hasPhone ? (
              <section className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4" data-contact-offer data-contact-claimed>
                <h2 className="text-[12px] font-black text-emerald-200">رقمك عندنا من ورقته دي</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-white/60">
                  {sheet.contact.city ? `منطقتك اللي سجلتها: ${sheet.contact.city}.` : 'لسه ما سجلتش منطقتك — لو عايز اقتراحات أقرب لمكانك قولها.'}
                  {' '}الصور اللي تحت دي من بنك المتجر لنوع مكانك، وشاركها مع أهلك في الغرفة اللي بعدها.
                </p>
                {!sheet.contact.city && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={city}
                      onChange={(e) => {
                        cityTouchedRef.current = true;
                        setCity(e.target.value);
                      }}
                      placeholder="منطقتك"
                      data-contact-city
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder-white/25 focus:border-amber-500/40 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={sendOffer}
                      disabled={sending}
                      className="rounded-xl bg-amber-500/20 border border-amber-500/30 px-3 py-2 text-[12px] font-bold text-amber-200 disabled:opacity-50"
                    >
                      {sending ? 'بأضيف…' : 'أضفها'}
                    </button>
                  </div>
                )}
                {!sheet.contact.city && areaChips}
              </section>
            ) : (
              <section className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4" data-contact-offer>
                <h2 className="text-[13px] font-black text-amber-200">عايز ٣ اقتراحات تجهيز توصلك على واتساب؟</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-white/60">
                  بنرشّحلك من صور المتجر على حسب نوع غرفتك، ونابعتلك اللي عجبك. رقمك بيخلي المتجر متصل بيك،
                  ومنطقتك بتعرفنا مكانك.
                </p>
                <input
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="موبايلك — للاستلام على واتساب"
                  dir="ltr"
                  data-contact-phone
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right text-[13px] text-white placeholder-white/25 focus:border-amber-500/40 focus:outline-none"
                />
                <input
                  value={city}
                  onChange={(e) => {
                    cityTouchedRef.current = true;
                    setCity(e.target.value);
                  }}
                  placeholder="منطقتك — زي التجمع أو زايد أو الإسكندرية"
                  data-contact-city
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder-white/25 focus:border-amber-500/40 focus:outline-none"
                />
                {!sheet?.contact?.city && areaChips}
                {!sheet?.room && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ROOM_CHOICES.map((choice) => (
                      <button
                        key={choice.type}
                        type="button"
                        onClick={() => setRoomChoice(roomChoice === choice.type ? '' : choice.type)}
                        data-contact-room={choice.type}
                        data-contact-room-selected={roomChoice === choice.type ? '1' : '0'}
                        className={`rounded-full border px-3 py-1 text-[11px] ${
                          roomChoice === choice.type
                            ? 'border-amber-500/50 bg-amber-500/20 text-amber-100'
                            : 'border-white/10 bg-white/5 text-white/55'
                        }`}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={sendOffer}
                  disabled={sending || !phone.trim()}
                  className="mt-3 w-full rounded-xl bg-amber-500/20 border border-amber-500/30 px-4 py-2.5 text-[13px] font-black text-amber-200 disabled:opacity-50"
                >
                  {sending ? 'بأجهزها…' : 'ابعتلي الاقتراحات'}
                </button>
              </section>
            )}
            {images.length > 0 && (
              <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4" data-colour-block>
                <h2 className="text-[12px] font-bold text-white/60">ألوان مكانك</h2>
                <div className="mt-3">
                  <ColourMatrix
                    matrix={sheet.colour_matrix ?? []}
                    picks={colourDraft ?? sheet.colour_picks ?? []}
                    onChange={(next) => void sendColours(next)}
                    busy={colouring}
                  />
                </div>
              </section>
            )}
            {images.length > 0 && (
              <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4" data-family-room>
                <h2 className="text-[12px] font-bold text-white/60">
                  {imagesForHisRoom ? 'غرفة قرار العائلة · صور مختارة لنوع مكانك' : 'غرفة قرار العائلة · أفكار عامة من البيت — مكانك اللي على الورقة مش في بنك الصور بعد'}
                  {onlyStyle ? ` · ${onlyStyle}` : ''}
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                  افتحوا نفس الرابط على كل التليفونات، كل واحد يكتب اسمه، واللي يعجبه يضغط. اللي بتختاروه يوصل لشيت العميل عند المتجر.
                </p>
                {taste?.line && (
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-200/70" data-region-line={taste.source}>
                    {taste.line}
                  </p>
                )}
                <label className="mt-3 block">
                  <span className="text-[11px] text-white/50">اسمك أو علاقتك في البيت</span>
                  <input
                    value={me}
                    onChange={(e) => giveName(e.target.value)}
                    placeholder="مثال: أنا، ماما، أحمد"
                    data-family-name
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder-white/25 focus:border-amber-500/40 focus:outline-none"
                  />
                </label>
                {people.length > 0 && (
                  <p className="mt-2 text-[11px] text-white/45" data-family-people>
                    صوت على الورقة دي: {people.join(' · ')}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {images.map((img, i) => {
                    const key = imageKeyOf(img);
                    const tally = tallies[key];
                    const mine = Boolean(me.trim() && tally?.voters.includes(me.trim()));
                    return (
                      <div key={i}>
                        <a href={img.url} target="_blank" rel="noopener noreferrer" className="relative block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.thumb}
                            alt="فكرة تصميم"
                            loading="lazy"
                            className="h-28 w-full rounded-xl border border-white/10 object-cover"
                          />
                          {img.near && (
                            <span
                              data-picture-near={img.url}
                              className="absolute right-1.5 top-1.5 rounded-full border border-amber-400/50 bg-black/70 px-2 py-0.5 text-[9px] font-bold text-amber-200"
                            >
                              {nearLabel(taste?.source ?? "quality")}
                            </span>
                          )}
                        </a>
                        <button
                          type="button"
                          onClick={() => castVote(img)}
                          aria-pressed={mine}
                          data-family-vote={key}
                          className={`mt-1 flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                            mine ? 'border-rose-400/50 bg-rose-500/15 text-rose-200' : 'border-white/10 bg-white/5 text-white/60'
                          }`}
                        >
                          <span>{mine ? 'اخترته' : 'أحبها'}</span>
                          <span data-family-count={key}>{tally?.likes ? arNum(tally.likes) : ''}</span>
                        </button>
                        {!onlyStyle && img.style && STYLE_LABEL[img.style] ? (
                          <span className="mt-1 block text-[10px] text-white/40">{STYLE_LABEL[img.style]}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {news && <p className="mt-2 text-[11px] leading-relaxed text-white/60">{news}</p>}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `ورقة مقاساتي وتصميمي من أزينث ليفينج — اختاروا اللي يعجبكم من هنا: ${window.location.href}`
                  )}`}
                  className="mt-4 block w-full rounded-xl border border-emerald-500/30 bg-emerald-600/20 px-4 py-2.5 text-center text-[13px] font-black text-emerald-200"
                >
                  ابعتها على واتساب وشاركهم الرابط
                </a>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
