import { chatPlaceLabel } from '@/lib/ops/draft-labels';
import { bracketListItems, isBulletLine, splitInline, stripBullet } from '@/lib/talk/emphasis';

/**
 * The one thing that knows how an answer is drawn.
 *
 * Measured on the owner's assistant dock 2026-10-24: the chat panel had carried this renderer since
 * the emphasis fix, but as a function inside its own file — so every other surface that prints an
 * answer (the dock, the unified assistant, its live-browser panel) was still showing «**حفظت
 * تفضيلك:**» with the asterisks on the glass. The fact «how a reply is drawn» had one owner that no
 * one else could reach. It is exported now; a screen that shows an answer uses this, or it reprints
 * the model's markers.
 */
export function MarkdownContent({ content, onZoom }: { content: string; onZoom?: (src: string, label: string) => void }) {
  const lines = content.split('\n');
  const elements: any[] = [];
  let tableRows: string[][] = [];
  // P5-M2: any site path or URL inside prose becomes a real clickable link
  const INLINE_LINK = /(https?:\/\/[^\s)>\]"'،]+|(?<![\w/])\/[A-Za-z0-9\-_./%]+[A-Za-z0-9\-_/])/g;
  const IMAGE_URL = /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i;
  // Emphasis first, bare addresses second. The order is the whole rule: this used to cut the line on
  // every URL BEFORE the markers were read, so «[اسم](https://…/x)» came apart as «[اسم](» + a live
  // address + «)», no piece of it looked like a link any more, and his screen kept the brackets. A
  // test on the splitter alone could not see it — only this function's order can.
  const renderInline = (text: string) =>
    splitInline(text).map((chunk, i) =>
      chunk.kind === "bold" ? (
        <strong key={i} className="font-bold text-white" data-emphasis="bold">
          {chunk.value}
        </strong>
      ) : chunk.kind === "em" ? (
        <em key={i} data-emphasis="em">
          {chunk.value}
        </em>
      ) : chunk.kind === "code" ? (
        <code key={i} data-emphasis="code" className="rounded bg-black/40 px-1 py-0.5 text-[12px]" dir="ltr">
          {chunk.value}
        </code>
      ) : chunk.kind === "math" ? (
        // «٢× = ٥٤٠٠٠» in a right-to-left sentence is shown with its two sides swapped: each number
        // keeps its own order, and the mark between them follows the line. The run gets its own
        // direction — the word order is not touched, only which way it reads.
        //
        // Measured on this browser 2026-10-12, `dir="ltr"` alone does NOT do it: the run is isolated
        // and still laid out right-to-left (Arabic-Indic digits are resolved by the surrounding
        // paragraph). `isolate-override` is the one of the seven ways tried that puts the first
        // character on the left, and the run never contains an Arabic word to override.
        <span
          key={i}
          data-inline="math"
          dir="ltr"
          className="whitespace-nowrap"
          style={{ unicodeBidi: "isolate-override" }}
        >
          {chunk.value}
        </span>
      ) : chunk.kind === "email" ? (
        // An address is one thing he copies or dials, and the elite form writes Arabic-Indic digits
        // inside it — the exact characters a right-to-left line moves.
        <span
          key={i}
          data-inline="email"
          dir="ltr"
          className="whitespace-nowrap"
          style={{ unicodeBidi: "isolate-override" }}
        >
          {chunk.value}
        </span>
      ) : chunk.kind === "link" ? (
        // An address the model named in Arabic gets its Arabic name on the screen and its address
        // behind the press — a bare URL inside an Arabic line reorders the whole line.
        <a
          key={i}
          href={chunk.href}
          target="_blank"
          rel="noopener noreferrer"
          data-emphasis="link"
          className="text-sky-300 hover:underline"
        >
          {chunk.value}
        </a>
      ) : (
        <span key={i}>
          {String(chunk.value)
            .split(INLINE_LINK)
            .map((part, j) =>
              part && IMAGE_URL.test(part) && onZoom ? (
                // Any picture named in the conversation is pressable: one press opens it over
                // the thread with a zoom, one press puts it back. A link he has to leave the
                // chat to look at is not a preview.
                <button
                  key={`${i}-${j}`}
                  data-image-preview={part}
                  onClick={() => onZoom(part, 'صورة من المحادثة')}
                  className="my-1 block text-right"
                >
                  <img src={part} alt="صورة مرفقة" className="max-h-40 rounded-lg border border-white/10 object-contain" />
                </button>
              ) : part && /^https?:\/\//.test(part) ? (
                <a key={`${i}-${j}`} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline" dir="ltr">{part}</a>
              ) : part && /^\/[A-Za-z]/.test(part) ? (
                // A path is an address inside his sentence; the place it leads to is the thing he can
                // read. The address stays where it belongs — behind the press.
                <a key={`${i}-${j}`} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">{chatPlaceLabel(part)}</a>
              ) : (
                <span key={`${i}-${j}`}>{part}</span>
              )
            )}
        </span>
      )
    );
  const flushTable = () => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const body = tableRows.slice(1).filter(r => !r.every(c => /^[-:]+$/.test(c.trim())));
      // A cell is prose: the load report writes «| **زمن الاستجابة** | **145ms** |», and printing the
      // row's text raw put the model's markers back on his screen after the emphasis pass had taken
      // them off every other line. Cells get the same inline pass. They also wrap, because at his
      // width a five-column table held on one line each is a table he has to scroll to read.
      elements.push(
        <div key={`tbl-${elements.length}`} className="my-2 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-[11px]">
            <thead><tr className="bg-white/5">{header.map((c,i) => <th key={i} className="p-1.5 text-right font-bold text-white/70 align-top">{renderInline(c.trim())}</th>)}</tr></thead>
            <tbody>{body.map((row, ri) => <tr key={ri} className="border-t border-white/5">{row.map((c, ci) => <td key={ci} className="p-1.5 text-white/80 align-top">{renderInline(c.trim())}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
  };
  lines.forEach((line) => {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.split('|').slice(1, -1);
      tableRows.push(cells);
    } else {
      flushTable();
      const bracketList = bracketListItems(line);
      if (line.trim() === '') elements.push(<div key={`br-${elements.length}`} className="h-2" />);
      else if (line.trim().startsWith('#')) elements.push(<div key={`h-${elements.length}`} className="font-bold text-white mt-2">{renderInline(line.replace(/^#+\s*/, ''))}</div>);
      else if (isBulletLine(line)) elements.push(<div key={`li-${elements.length}`} className="mr-3">• {renderInline(stripBullet(line))}</div>);
      // The employees offer next steps as «[افتح التقرير] [راجع السجل]». Those are list items wearing
      // brackets; the chat draws them as the list they are and keeps every word.
      else if (bracketList) elements.push(
        <div key={`bl-${elements.length}`} className="mr-3" data-inline="bracket-list">
          {bracketList.map((item, j) => (
            <div key={j}>• {renderInline(item)}</div>
          ))}
        </div>
      );
      else elements.push(<div key={`p-${elements.length}`} className="whitespace-pre-wrap">{renderInline(line)}</div>);
    }
  });
  flushTable();
  return <div className="space-y-1">{elements}</div>;
}
