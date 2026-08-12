import {
  BarChart3,
  Contact,
  Home,
  Inbox,
  MessageCircle,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { AppWindow } from "@/components/mockup/AppWindow";
import { SidebarNav } from "@/components/mockup/SidebarNav";
import { StatCard } from "@/components/mockup/StatCard";
import styles from "./HeroProductMockup.module.css";

const NAV_ITEMS = [
  { label: "Resumo", icon: Home },
  { label: "Inbox", icon: Inbox },
  { label: "Leads", icon: Users },
  { label: "Contactos", icon: Contact },
  { label: "Conversas", icon: MessageCircle },
  { label: "Automação", icon: Zap },
  { label: "Relatórios", icon: BarChart3 },
  { label: "Configurações", icon: Settings },
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
            <Zap aria-hidden="true" size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>
      <div className={styles.activity}>
        <p className={styles.chartTitle}>Atividade recente</p>
        <div className={styles.activityItem}>
          <MessageSquare aria-hidden="true" size={16} strokeWidth={1.8} />
          <div>
            <p className={styles.activityTitle}>Nova conversa com João Silva</p>
            <p className={styles.activityMeta}>via WhatsApp</p>
          </div>
        </div>
        <div className={styles.activityItem}>
          <Sparkles aria-hidden="true" size={16} strokeWidth={1.8} />
          <div>
            <p className={styles.activityTitle}>Resposta gerada: Proposta #482</p>
            <p className={styles.activityMeta}>por Agente de IA</p>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}
