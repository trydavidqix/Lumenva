import {
  ChartBar,
  AddressBook,
  House,
  Tray,
  ChatCircle,
  Gear,
  Sparkle,
  UsersThree,
  Lightning,
} from "@phosphor-icons/react";
import { AppWindow } from "@/components/mockup/AppWindow";
import { SidebarNav } from "@/components/mockup/SidebarNav";
import { StatCard } from "@/components/mockup/StatCard";
import styles from "./HeroProductMockup.module.css";

const NAV_ITEMS = [
  { label: "Resumo", icon: House },
  { label: "Inbox", icon: Tray },
  { label: "Leads", icon: UsersThree },
  { label: "Contactos", icon: AddressBook },
  { label: "Conversas", icon: ChatCircle },
  { label: "Automação", icon: Lightning },
  { label: "Relatórios", icon: ChartBar },
  { label: "Configurações", icon: Gear },
] as const;

const PIPELINE = [
  { label: "Novos", value: "364" },
  { label: "Qualificados", value: "128" },
  { label: "Proposta", value: "64" },
  { label: "Negociação", value: "34" },
  { label: "Ganho", value: "16" },
] as const;

export function HeroProductMockup() {
  return (
    <AppWindow sidebar={<SidebarNav activeLabel="Resumo" items={NAV_ITEMS} />}>
      <div className={styles.stats}>
        <StatCard delta="↑ 18% vs. mês anterior" label="Novas conversas" value="1 248" />
        <StatCard delta="↑ 21% vs. mês anterior" label="Conversas" value="3 562" />
        <StatCard delta="↑ 15% vs. mês anterior" label="Negócios ganhos" value="128" />
        <StatCard delta="↑ 11% vs. mês anterior" label="Receita" value="€ 42 560" />
      </div>
      <div className={styles.chartRow}>
        <div className={styles.chart}>
          <p className={styles.chartTitle}>Conversas ao longo do tempo</p>
          <svg aria-hidden="true" className={styles.sparkline} viewBox="0 0 240 60" preserveAspectRatio="none">
            <polyline
              fill="none"
              points="0,40 30,30 60,44 90,20 120,34 150,14 180,28 210,10 240,22"
              stroke="var(--color-ink)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </div>
        <div className={styles.pipelineColumn}>
          <div className={styles.pipeline}>
            <p className={styles.chartTitle}>Pipeline</p>
            <ul className={styles.pipelineList}>
              {PIPELINE.map((stage) => (
                <li className={styles.pipelineItem} key={stage.label}>
                  <span>{stage.label}</span>
                  <span>{stage.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <button className={styles.newAutomation} type="button">
            Nova automação
            <Lightning aria-hidden="true" size={14} weight="duotone" color="currentColor" />
          </button>
        </div>
      </div>
      <div className={styles.activity}>
        <p className={styles.chartTitle}>Atividade recente</p>
        <div className={styles.activityItem}>
          <ChatCircle aria-hidden="true" size={16} weight="duotone" color="currentColor" />
          <div>
            <p className={styles.activityTitle}>Nova conversa com João Silva</p>
            <p className={styles.activityMeta}>via WhatsApp</p>
          </div>
        </div>
        <div className={styles.activityItem}>
          <Sparkle aria-hidden="true" size={16} weight="duotone" color="currentColor" />
          <div>
            <p className={styles.activityTitle}>Resposta gerada: Proposta #482</p>
            <p className={styles.activityMeta}>por Agente de IA</p>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}
