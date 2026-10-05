import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import templatesJson from "./templates.json";
import { bestCompanyOnForm } from "./registry";
import type { FieldKey, FillWarning, FormProfile, Holding, Rect, RegistrarTemplate } from "./types";

export const TEMPLATES = templatesJson as RegistrarTemplate[];
export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id) ?? null;

const INK = rgb(0.07, 0.16, 0.42); // blue-black, reads as pen on a scan
const PDF_DIR = path.join(process.cwd(), "lib", "forms", "pdf");

export interface FormImages {
  photo?: Uint8Array | null;
  signature?: Uint8Array | null;
}

export interface FilledForm {
  registrarId: string;
  registrar: string;
  ticked: string[];
  /** Holdings named for this registrar that aren't printed on its form. Write them in by hand. */
  unlisted: string[];
  warnings: FillWarning[];
}

/** Phones go on forms in local format: 0803 123 4567 rather than +234. */
function localPhone(p: string): string {
  const d = (p ?? "").replace(/\D/g, "");
  if (d.startsWith("234") && d.length === 13) return "0" + d.slice(3);
  return d;
}

function values(p: FormProfile): Record<FieldKey, string> {
  const up = (s: string) => (s ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  const given = [p.firstName, p.otherNames].filter((s) => s?.trim()).join(" ");
  return {
    surname: up(p.surname), firstName: up(p.firstName), otherNames: up(p.otherNames), givenNames: up(given),
    fullName: up([given, p.surname].join(" ")),
    bvn: (p.bvn ?? "").replace(/\D/g, ""), bankName: up(p.bankName), accountNumber: (p.accountNumber ?? "").replace(/\D/g, ""),
    address: up(p.address), city: up(p.city), state: up(p.state), country: up(p.country), previousAddress: up(p.previousAddress),
    chn: up(p.chn).replace(/\s/g, ""), phone1: localPhone(p.phone1), phone2: localPhone(p.phone2),
    email: (p.email ?? "").trim().toLowerCase(),
  };
}

/** Top-left template coordinates to pdf-lib's bottom-left, scaled to the page actually in the file. */
function mapper(page: PDFPage, t: RegistrarTemplate) {
  const sx = page.getWidth() / t.page.w;
  const sy = page.getHeight() / t.page.h;
  return {
    rect: (r: Rect) => ({ x: r.x * sx, y: page.getHeight() - (r.y + r.h) * sy, w: r.w * sx, h: r.h * sy }),
    pt: (x: number, y: number) => ({ x: x * sx, y: page.getHeight() - y * sy }),
    s: sx,
  };
}

function drawFitted(page: PDFPage, font: PDFFont, text: string, r: { x: number; y: number; w: number; h: number }) {
  let size = Math.min(10, r.h * 0.62);
  while (size > 5 && font.widthOfTextAtSize(text, size) > r.w) size -= 0.25;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > r.w) t = t.slice(0, -1);
  page.drawText(t, { x: r.x, y: r.y + r.h / 2 - size * 0.35, size, font, color: INK });
  return t.length < text.length;
}

function drawTick(page: PDFPage, cx: number, cy: number, s: number) {
  const th = Math.max(1, s * 0.13);
  page.drawLine({ start: { x: cx - s * 0.42, y: cy + s * 0.02 }, end: { x: cx - s * 0.1, y: cy - s * 0.32 }, thickness: th, color: INK });
  page.drawLine({ start: { x: cx - s * 0.1, y: cy - s * 0.32 }, end: { x: cx + s * 0.45, y: cy + s * 0.4 }, thickness: th, color: INK });
}

async function embed(doc: PDFDocument, bytes: Uint8Array): Promise<PDFImage> {
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  return png ? doc.embedPng(bytes) : doc.embedJpg(bytes);
}

function drawContained(page: PDFPage, img: PDFImage, r: { x: number; y: number; w: number; h: number }, pad = 2) {
  const scale = Math.min((r.w - pad * 2) / img.width, (r.h - pad * 2) / img.height);
  const w = img.width * scale, h = img.height * scale;
  page.drawImage(img, { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, width: w, height: h });
}

/** Fills one registrar's form onto `out` as a new page. */
async function fillOnto(out: PDFDocument, t: RegistrarTemplate, profile: FormProfile, companies: string[], images: FormImages): Promise<FilledForm> {
  const src = await PDFDocument.load(await readFile(path.join(PDF_DIR, t.file)));
  const [page] = await out.copyPages(src, [0]);
  out.addPage(page);
  const font = await out.embedFont(StandardFonts.Helvetica);
  const m = mapper(page, t);
  const v = values(profile);
  const warnings: FillWarning[] = [];

  for (const f of t.fields) {
    let text = v[f.key];
    if (!text) continue;
    // Some forms print the CHN's leading "C" in the first box already.
    if (f.printedPrefix && text.startsWith(f.printedPrefix)) text = text.slice(f.printedPrefix.length);
    if (f.kind === "cells") {
      const chars = [...text];
      let cells = f.cells;
      if (chars.length > cells.length) {
        // A number can't lose digits: carry on past the last box at the same spacing.
        // Some forms print too few boxes, e.g. Africa Prudential's 10 for an 11-digit BVN.
        const numeric = /^\d+$/.test(text) && cells.length >= 2;
        if (numeric) {
          const last = cells[cells.length - 1], pitch = last.x - cells[cells.length - 2].x;
          cells = [...cells, ...chars.slice(cells.length).map((_, i) => ({ ...last, x: last.x + pitch * (i + 1) }))];
          warnings.push({ registrarId: t.id, message: `${f.key} has ${chars.length} digits but the form prints ${f.cells.length} boxes; the extra digits run past the last box.` });
        } else {
          warnings.push({ registrarId: t.id, message: `${f.key} has ${chars.length} characters but the form has ${cells.length} boxes; the end was cut.` });
        }
      }
      cells.forEach((c, i) => {
        const ch = chars[i];
        if (!ch || ch === " ") return;
        const r = m.rect(c);
        const size = Math.min(r.h * 0.62, r.w * 0.9, 11);
        const w = font.widthOfTextAtSize(ch, size);
        page.drawText(ch, { x: r.x + (r.w - w) / 2, y: r.y + r.h / 2 - size * 0.35, size, font, color: INK });
      });
    } else {
      const r = m.rect(f);
      if (drawFitted(page, font, text, r)) warnings.push({ registrarId: t.id, message: `${f.key} was too long for its box and was shortened.` });
    }
  }

  const ticked: string[] = [];
  const unlisted: string[] = [];
  for (const c of companies) {
    const listed = t.companies.length === 1 && !t.companies[0].tick ? t.companies[0].name : bestCompanyOnForm(t.id, c);
    const entry = listed ? t.companies.find((x) => x.name === listed) : null;
    if (!entry) { unlisted.push(c); continue; }
    if (entry.tick) {
      const p = m.pt(entry.tick.x, entry.tick.y);
      drawTick(page, p.x, p.y, entry.tick.s * m.s);
    }
    if (!ticked.includes(entry.name)) ticked.push(entry.name);
  }
  if (unlisted.length) warnings.push({ registrarId: t.id, message: `Not printed on this form, add by hand: ${unlisted.join(", ")}.` });

  if (images.photo && t.photo) drawContained(page, await embed(out, images.photo), m.rect(t.photo), 3);
  else if (t.photo) warnings.push({ registrarId: t.id, message: "No passport photo was supplied." });
  if (images.signature && t.signature) drawContained(page, await embed(out, images.signature), m.rect(t.signature), 2);
  else if (t.signature) warnings.push({ registrarId: t.id, message: "No signature was supplied." });

  return { registrarId: t.id, registrar: t.registrar, ticked, unlisted, warnings };
}

/**
 * One PDF with a filled page per registrar, in the order holdings first name them.
 * Holdings on the same registrar share one form with several ticks.
 */
export async function fillForms(profile: FormProfile, holdings: Holding[], images: FormImages) {
  const byRegistrar = new Map<string, string[]>();
  for (const h of holdings) {
    if (!templateById(h.registrarId)) throw new Error(`No form is mapped for registrar "${h.registrarId}".`);
    byRegistrar.set(h.registrarId, [...(byRegistrar.get(h.registrarId) ?? []), h.company]);
  }
  const out = await PDFDocument.create();
  out.setTitle("Dividendi e-mandate forms");
  out.setCreator("Dividendi");
  const forms: FilledForm[] = [];
  for (const [id, companies] of byRegistrar) forms.push(await fillOnto(out, templateById(id)!, profile, companies, images));
  return { pdf: await out.save(), forms };
}

export function dataUrlBytes(dataUrl: string | null | undefined): Uint8Array | null {
  if (!dataUrl) return null;
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Images must be PNG or JPEG data URLs.");
  return Uint8Array.from(Buffer.from(m[2], "base64"));
}
