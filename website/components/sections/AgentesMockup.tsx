import {
  ChartBar,
  Robot,
  CreditCard,
  Headphones,
  House,
  Tray,
  Gear,
  TrendUp,
} from "@phosphor-icons/react";
import { AppWindow } from "@/components/mockup/AppWindow";
import { SidebarNav } from "@/components/mockup/SidebarNav";
import { StatCard } from "@/components/mockup/StatCard";
import styles from "./AgentesMockup.module.css";

const NAV_ITEMS = [
  { label: "Resumo", icon: House },
  { label: "Inbox", icon: Tray },
  { label: "Agentes IA", icon: Robot },
  { label: "Relatórios", icon: ChartBar },
  { label: "Configurações", icon: Gear },
] as const;

const AGENTS = [
  { icon: TrendUp, name: "Agente Comercial", role: "Qualificação e follow-up", status: "Ativo", accuracy: "82%" },
  { icon: Headphones, name: "Agente de Suporte", role: "Respostas e triagem", status: "Ativo", accuracy: "85%" },
  { icon: CreditCard, name: "Agente de Cobrança", role: "Pagamentos e lembretes", status: "Em teste", accuracy: "74%" },
  { icon: Gear, name: "Agente Operacional", role: "Tarefas internas", status: "Ativo", accuracy: "88%" },
] as const;

export function AgentesMockup() {
  return (
    <AppWindow
      panel={
        <>
          <div>
            <p className={styles.panelLabel}>Resumo do agente</p>
            <p className={styles.panelText}>
              Agente Comercial qualifica leads e agenda reuniões com a equipa de vendas.
            </p>
          </div>
          <div>
            <p className={styles.panelLabel}>Fontes de conhecimento</p>
            <p className={styles.panelText}>FAQ · Documentação · CRM</p>
          </div>
        </>
      }
      sidebar={<SidebarNav activeLabel="Agentes IA" items={NAV_ITEMS} />}
    >
      <div className={styles.stats}>
        <StatCard delta="↑ 20% vs. mês anterior" label="Agentes ativos" value="12" />
        <StatCard delta="↑ 18% vs. mês anterior" label="Conversas tratadas" value="3 562" />
        <StatCard delta="↑ 12% vs. mês anterior" label="Resolução automática" value="78%" />
        <StatCard delta="↓ 8s vs. mês anterior" label="Tempo médio" value="1m 42s" />
      </div>
      <div className={styles.agentGrid}>
        {AGENTS.map(({ icon: Icon, name, role, status, accuracy }) => (
          <div className={styles.agentCard} key={name}>
            <div className={styles.agentHeader}>
              <Icon aria-hidden="true" size={16} weight="duotone" color="currentColor" />
              <div>
                <p className={styles.agentName}>{name}</p>
                <p className={styles.agentRole}>{role}</p>
              </div>
            </div>
            <div className={styles.agentFooter}>
              <span className={styles.agentStatus} data-active={status === "Ativo"}>
                {status}
              </span>
              <span>{accuracy}</span>
            </div>
          </div>
        ))}
      </div>
    </AppWindow>
  );
}
