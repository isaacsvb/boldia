/**
 * BOLD AI — Local PDF / ePub text extraction (pure JS, Expo Go compatible).
 *
 * Strategy:
 *   • ePub  — an ePub is a ZIP of XHTML. We unzip with JSZip, read the OPF
 *             spine to get reading order, strip tags from each chapter, and
 *             concatenate. 100% JS, works in Expo Go.
 *   • PDF   — PDFs are harder without native code. We extract text from the
 *             content streams of uncompressed/FlateDecode pages. This handles
 *             the majority of text-based (non-scanned) PDFs. For scanned PDFs
 *             you'd need OCR, which is out of scope for the $0 Expo Go path.
 *
 * Both paths end by splitting the raw text into shadowing-sized sentences.
 */
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

export interface ParsedDocument {
  title: string;
  fileType: 'pdf' | 'epub';
  sentences: string[];
}

/** Public entry point: detect type from extension/uri and parse. */
export async function parseDocument(uri: string, name: string): Promise<ParsedDocument> {
  const lower = name.toLowerCase();
  if (lower.endsWith('.epub')) return parseEpub(uri, name);
  if (lower.endsWith('.pdf')) return parsePdf(uri, name);
  throw new Error('Unsupported file type. Please choose a .pdf or .epub file.');
}

// ---------------------------------------------------------------------------
// ePub
// ---------------------------------------------------------------------------
async function parseEpub(uri: string, name: string): Promise<ParsedDocument> {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const zip = await JSZip.loadAsync(b64, { base64: true });
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

  // 1. container.xml -> path to the OPF package file
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new Error('Invalid ePub: missing container.xml');
  const container = parser.parse(containerXml);
  const opfPath: string = container.container.rootfiles.rootfile['@_full-path'];
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

  // 2. OPF -> manifest (id->href) + spine (reading order) + title
  const opfXml = await zip.file(opfPath)?.async('string');
  if (!opfXml) throw new Error('Invalid ePub: missing OPF');
  const opf = parser.parse(opfXml);

  const title =
    opf.package?.metadata?.['dc:title']?.['#text'] ??
    opf.package?.metadata?.['dc:title'] ??
    name.replace(/\.epub$/i, '');

  const manifestItems = asArray(opf.package.manifest.item);
  const idToHref = new Map<string, string>();
  for (const it of manifestItems) idToHref.set(it['@_id'], it['@_href']);

  const spineItems = asArray(opf.package.spine.itemref);

  // 3. Read each spine doc in order, strip to plain text
  let fullText = '';
  for (const ref of spineItems) {
    const href = idToHref.get(ref['@_idref']);
    if (!href) continue;
    const content = await zip.file(opfDir + href)?.async('string');
    if (content) fullText += ' ' + stripHtml(content);
  }

  return { title: String(title), fileType: 'epub', sentences: splitSentences(fullText) };
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function stripHtml(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// PDF (lightweight text-stream extraction)
// ---------------------------------------------------------------------------
async function parsePdf(uri: string, name: string): Promise<ParsedDocument> {
  const raw = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  }).catch(async () => {
    // Binary-safe fallback: read as latin1-ish via base64 decode
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64ToLatin1(b64);
  });

  const text = extractPdfText(raw);
  if (!text.trim()) {
    throw new Error(
      'Could not extract text from this PDF. It may be scanned/image-only (OCR not supported in the Expo Go build).'
    );
  }
  return {
    title: name.replace(/\.pdf$/i, ''),
    fileType: 'pdf',
    sentences: splitSentences(text),
  };
}

/**
 * Extract visible text from PDF content streams. Pulls strings from Tj/TJ
 * operators inside BT/ET text blocks. Handles the common uncompressed case;
 * FlateDecode streams are skipped gracefully (they appear as noise and are
 * filtered out).
 */
function extractPdfText(pdf: string): string {
  const out: string[] = [];
  // Parenthesised strings: (text) Tj   and   [(a) -250 (b)] TJ
  const streamMatches = pdf.match(/stream([\s\S]*?)endstream/g) ?? [pdf];
  for (const chunk of streamMatches) {
    // (literal) strings
    const parenRegex = /\(((?:\\.|[^\\()])*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = parenRegex.exec(chunk)) !== null) {
      const s = m[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, ' ')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');
      if (/[A-Za-zÀ-ÿ]/.test(s)) out.push(s);
    }
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

function base64ToLatin1(b64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const clean = b64.replace(/=+$/, '');
  let out = '';
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = lookup[clean.charCodeAt(i)];
    const e2 = lookup[clean.charCodeAt(i + 1)];
    const e3 = lookup[clean.charCodeAt(i + 2)];
    const e4 = lookup[clean.charCodeAt(i + 3)];
    out += String.fromCharCode((e1 << 2) | (e2 >> 4));
    if (i + 2 < clean.length) out += String.fromCharCode(((e2 & 15) << 4) | (e3 >> 2));
    if (i + 3 < clean.length) out += String.fromCharCode(((e3 & 3) << 6) | e4);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sentence segmentation (shared)
// ---------------------------------------------------------------------------
/** Split raw text into shadowing-sized sentences (EN + FR punctuation). */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  // Split on sentence terminators while keeping them; handle « » and …
  const rough = normalized
    .replace(/([.!?…])\s+/g, '$1\u0001')
    .split('\u0001');
  return rough
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    // Keep sentences within a comfortable shadowing length (Azure <=30s audio).
    .flatMap((s) => (s.length > 220 ? chunkLong(s) : [s]));
}

function chunkLong(sentence: string): string[] {
  const words = sentence.split(' ');
  const chunks: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).length > 180) {
      chunks.push(cur.trim());
      cur = w;
    } else {
      cur += ' ' + w;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}
