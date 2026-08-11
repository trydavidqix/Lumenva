import { BarChart3, Bot, GitBranch, Home, Inbox, Settings, Zap } from "lucide-react";
import { AppWindow } from "@/components/mockup/AppWindow";
import { SidebarNav } from "@/components/mockup/SidebarNav";
import { StatCard } from "@/components/mockup/StatCard";
import styles from "./AutomacaoMockup.module.css";

const NAV_ITEMS = [
  { label: "Resumo", icon: Home },
  { label: "Inbox", icon: Inbox },
  { label: "Agentes IA", icon: Bot },
  { label: "Automações", icon: Zap },
  { label: "Relatórios", icon: BarChart3 },
  { label: "Configurações", icon: Settings },
] as const;

const FLOW_STEPS = ["Novo lead", "Qualificar", "Enviar WhatsApp", "Atualizar CRM"] as const;

const RECENT_RUNS = [
  { title: "Lead qualificado", meta: "#FLW-1842 · agora" },
  { title: "Mensagem enviada", meta: "#FLW-1841 · há 2 min" },
] as const;

export function AutomacaoMockup() {
  return (
    <AppWindow
      panel={
        <>
          <p className={styles.panelTitle}>Execuções recentes</p>
          {RECENT_RUNS.map((run) => (
            <div className={styles.run} key={run.title}>
              <p className={styles.runTitle}>{run.title}</p>
              <p className={styles.runMeta}>{run.meta}</p>
            </div>
          ))}
        </>
      }
      sidebar={<SidebarNav activeLabel="Automações" items={NAV_ITEMS} />}
    >
      <div className={styles.stats}>
        <StatCard delta="↑ 20% vs. mês anterior" label="Fluxos ativos" value="24" />
        <StatCard delta="↑ 18% vs. mês anterior" label="Execuções" value="18 420" />
        <StatCard delta="↑ 4,2% vs. mês anterior" label="Taxa de sucesso" value="98,6%" />
        <StatCard delta="↑ 16% vs. mês anterior" label="Tempo poupado" value="126 h" />
      </div>
      <div className={styles.flow}>
        <p className={styles.flowTitle}>
          <GitBranch aria-hidden="true" size={14} strokeWidth={1.8} />
          Construtor de fluxo
        </p>
        <div className={styles.flowSteps}>
          {FLOW_STEPS.map((step) => (
            <span className={styles.flowStep} key={step}>
              {step}
            </span>
          ))}
        </div>
      </div>
    </AppWindow>
  );
}
