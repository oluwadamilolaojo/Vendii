/**
 * Registrar e-mandate templates. One per registrar, mapped from their own scanned PDF.
 * All positions are PDF points measured from the TOP-LEFT of the page.
 */
export interface Rect { x: number; y: number; w: number; h: number }

export type FieldKey =
  | "surname" | "firstName" | "otherNames" | "givenNames" | "fullName"
  | "bvn" | "bankName" | "accountNumber"
  | "address" | "city" | "state" | "country" | "previousAddress"
  | "chn" | "phone1" | "phone2" | "email";

export type TemplateField =
  | ({ key: FieldKey; kind: "text"; printedPrefix?: string } & Rect)
  | { key: FieldKey; kind: "cells"; cells: Rect[]; printedPrefix?: string };

export interface TemplateCompany {
  name: string;
  /** Centre of the tick and its size. Null when the form covers one company and has no tick list. */
  tick: { x: number; y: number; s: number } | null;
}

export interface RegistrarTemplate {
  id: string;
  registrar: string;
  file: string;
  page: { w: number; h: number };
  fields: TemplateField[];
  photo: Rect | null;
  signature: Rect | null;
  companies: TemplateCompany[];
  notes: string | null;
}

/** What a shareholder gives us once. Every registrar form is filled from this. */
export interface FormProfile {
  surname: string;
  firstName: string;
  otherNames: string;
  bvn: string;
  bankName: string;
  accountNumber: string;
  address: string;
  city: string;
  state: string;
  country: string;
  previousAddress: string;
  chn: string;
  phone1: string;
  phone2: string;
  email: string;
}

export interface Holding {
  /** Template id, e.g. "coronation". */
  registrarId: string;
  /** As the shareholder or the register names it. Matched against the form's own list. */
  company: string;
}

export interface FillWarning {
  registrarId: string;
  message: string;
}
