"use client";

import { type FormEvent, useState } from "react";
import styles from "@/components/sections/InnerPages.module.css";

type SubmissionState = "idle" | "pending" | "success" | "error";

export function ContactForm() {
  const [state, setState] = useState<SubmissionState>("idle");
  const [isValid, setIsValid] = useState(false);

  function handleFormChange(event: FormEvent<HTMLFormElement>) {
    setIsValid(event.currentTarget.checkValidity());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name"),
      company: formData.get("company"),
      email: formData.get("email"),
      whatsapp: formData.get("whatsapp"),
      consent: formData.get("consent") === "on",
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setState("error");
        return;
      }

      form.reset();
      setIsValid(false);
      setState("success");
    } catch {
      setState("error");
    }
  }

  const status =
    state === "success"
      ? "Recebemos sua solicitação. Retornaremos em breve."
      : state === "error"
        ? "Não foi possível enviar agora. Tente novamente em alguns minutos."
        : isValid
          ? "Seus dados serão usados somente para responder a este contato."
          : "Preencha todos os campos para habilitar o envio.";

  return (
    <form
      className={styles.form}
      aria-label="Solicitação de demonstração"
      aria-describedby="demo-form-status"
      onChange={handleFormChange}
      onSubmit={handleSubmit}
    >
      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span className={styles.label}>Nome</span>
          <input
            className={styles.input}
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Como podemos te chamar?"
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Empresa</span>
          <input
            className={styles.input}
            name="company"
            type="text"
            autoComplete="organization"
            placeholder="Nome da empresa"
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>E-mail</span>
          <input
            className={styles.input}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>WhatsApp</span>
          <input
            className={styles.input}
            name="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            required
          />
        </label>
      </div>
      <label className={styles.consent}>
        <input name="consent" type="checkbox" required />
        <span>Autorizo o contato da equipe sobre esta solicitação.</span>
      </label>
      <button
        aria-describedby="demo-form-status"
        className={styles.submit}
        disabled={!isValid || state === "pending"}
        type="submit"
      >
        {state === "pending" ? "Enviando…" : "Agendar demonstração"}
      </button>
      <p className={`${styles.sectionCopy} ${styles.formNote}`} id="demo-form-status" aria-live="polite">
        {status}
      </p>
    </form>
  );
}
