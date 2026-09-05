"use client";

import { type FormEvent, useEffect, useState } from "react";
import styles from "@/components/sections/InnerPages.module.css";

type SubmissionState = "idle" | "pending" | "success" | "error";
type FieldName = "name" | "company" | "email" | "whatsapp" | "message" | "consent";
const requiredFields = [
  { name: "name" as const, label: "Nome" }, { name: "company" as const, label: "Empresa" },
  { name: "email" as const, label: "E-mail" }, { name: "whatsapp" as const, label: "WhatsApp" },
];
function formatList(values: readonly string[]) {
  if (values.length < 2) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} e ${values.at(-1)}`;
}

export function ContactForm() {
  const [state, setState] = useState<SubmissionState>("idle");
  const [isValid, setIsValid] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [values, setValues] = useState<Record<FieldName, string | boolean>>({
    name: "", company: "", email: "", whatsapp: "", message: "", consent: false,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setIsQuoteIntent(params.get("intent") === "quote");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function validate(field: HTMLInputElement | HTMLTextAreaElement) {
    if (field.validity.valid) return "";
    if (field.name === "consent") return "Autorize o contacto para continuar.";
    if (field.validity.valueMissing) return "Este campo é obrigatório.";
    if (field.validity.typeMismatch) return "Insira um e-mail válido.";
    return "Verifique este campo.";
  }

  function fieldProps(name: FieldName) {
    return {
      id: name, "aria-invalid": Boolean(errors[name]), "aria-describedby": `${name}-error`,
      onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const field = event.currentTarget;
        setTouched((current) => ({ ...current, [name]: true }));
        setErrors((current) => ({ ...current, [name]: validate(field) }));
      },
    };
  }

  function handleChange(event: FormEvent<HTMLFormElement>) {
    setIsValid(event.currentTarget.checkValidity());
    const field = event.target;
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      const name = field.name as FieldName;
      setValues((current) => ({ ...current, [name]: field instanceof HTMLInputElement && field.type === "checkbox" ? field.checked : field.value }));
      if (touched[name]) setErrors((current) => ({ ...current, [name]: validate(field) }));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      setTouched(Object.fromEntries([...requiredFields.map(({ name }) => [name, true]), ["consent", true]]));
      const invalid = form.querySelector<HTMLInputElement>(":invalid");
      invalid?.focus();
      return;
    }
    void submit(form);
  }

  async function submit(form: HTMLFormElement) {
    setState("pending");
    const data = new FormData(form);
    try {
      const payload = { name: data.get("name"), company: data.get("company"), email: data.get("email"), whatsapp: data.get("whatsapp"), message: data.get("message") || undefined, consent: data.get("consent") === "on", website: data.get("website") };
      if (String(payload.website ?? "").trim()) { form.reset(); setValues({ name: "", company: "", email: "", whatsapp: "", message: "", consent: false }); setIsValid(false); setErrors({}); setTouched({}); setState("success"); return; }
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) { setState("error"); return; }
      form.reset(); setValues({ name: "", company: "", email: "", whatsapp: "", message: "", consent: false }); setIsValid(false); setErrors({}); setTouched({}); setState("success");
    } catch { setState("error"); }
  }

  const missing = requiredFields.filter(({ name }) => !values[name]).map(({ label }) => label);
  const consentMissing = !values.consent;
  const status = state === "success" ? "Recebemos a sua solicitação. Entraremos em contacto brevemente." : state === "error" ? "Não foi possível enviar agora. Os seus dados continuam preenchidos. Tente novamente daqui a alguns minutos." : isValid ? "Os seus dados serão usados apenas para responder a este contacto." : [missing.length ? `Falta preencher: ${formatList(missing)}.` : "", consentMissing ? "Falta autorizar o contacto." : ""].filter(Boolean).join(" ");

  return <form className={styles.form} aria-label={isQuoteIntent ? "Pedido de orçamento" : "Solicitação de demonstração"} aria-describedby="demo-form-status" onChange={handleChange} onSubmit={handleSubmit}>
    {isQuoteIntent ? <p className={styles.formNote}>Pedido de orçamento para serviços. Descreva brevemente o que pretende realizar.</p> : null}
    <div className={styles.fieldGrid}>
      {requiredFields.map(({ name, label }) => <label className={styles.field} key={name}><span className={styles.label}>{label} <span className={styles.required}>Obrigatório</span></span><input className={styles.input} name={name} type={name === "email" ? "email" : name === "whatsapp" ? "tel" : "text"} autoComplete={name === "company" ? "organization" : name === "whatsapp" ? "tel" : name} placeholder={name === "name" ? "Como se chama?" : name === "company" ? "Nome da empresa" : name === "email" ? "nome@empresa.com" : "(00) 00000-0000"} required {...fieldProps(name)} /><span className={styles.fieldError} id={`${name}-error`} role="alert">{errors[name]}</span></label>)}
    </div>
    <label className={styles.field}><span className={styles.label}>Como podemos ajudar? <span className={styles.optional}>Opcional</span></span><textarea className={styles.textarea} name="message" placeholder="Conte-nos brevemente o que pretende fazer ou resolver." rows={4} {...fieldProps("message")} /><span className={styles.fieldError} id="message-error" role="alert">{errors.message}</span></label>
    <input name="website" type="text" aria-hidden="true" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px" }} />
    <label className={styles.consent} htmlFor="consent"><input name="consent" type="checkbox" required {...fieldProps("consent")} /><span>Autorizo o contacto da equipa sobre esta solicitação. <span className={styles.required}>Obrigatório</span></span><span className={styles.fieldError} id="consent-error" role="alert">{errors.consent}</span></label>
    <button aria-describedby="demo-form-status" className={styles.submit} disabled={!isValid || state === "pending"} type="submit">{state === "pending" ? "Enviando…" : "Agendar demonstração"}</button>
    <p className={`${styles.sectionCopy} ${styles.formNote}`} id="demo-form-status" aria-live="polite">{status}</p>
  </form>;
}
