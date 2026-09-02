import { ChartBar, Robot, House, Tray, Kanban, Gear, UsersThree } from "@phosphor-icons/react";
import { AppWindow } from "@/components/mockup/AppWindow";
import { SidebarNav } from "@/components/mockup/SidebarNav";
import { StatCard } from "@/components/mockup/StatCard";
import styles from "./VendasCrmMockup.module.css";

const NAV_ITEMS = [
  { label: "Resumo", icon: House },
  { label: "Inbox", icon: Tray },
  { label: "Pipeline", icon: Kanban },
  { label: "Agentes IA", icon: Robot },
  { label: "Relatórios", icon: ChartBar },
  { label: "Configurações", icon: Gear },
] as const;

const STAGES = [
  { label: "Novos", count: "48", deal: "Acme Ltda.", value: "€ 1 200" },
  { label: "Qualificados", count: "72", deal: "Nova Digital", value: "€ 2 400" },
  { label: "Proposta", count: "23", deal: "Delta Corp", value: "€ 4 200" },
  { label: "Ganho", count: "25", deal: "Clínica Vitalis", value: "€ 3 800" },
] as const;

const NEXT_ACTIONS = [
  { title: "Ligar para cliente", meta: "Nova Digital · Hoje, 10:00" },
  { title: "Enviar proposta", meta: "Delta Corp · Hoje, 14:30" },
] as const;

export function VendasCrmMockup() {
  return (
    <AppWindow
      panel={
        <>
          <p className={styles.panelTitle}>Próximas ações</p>
          {NEXT_ACTIONS.map((action) => (
            <div className={styles.action} key={action.title}>
              <UsersThree aria-hidden="true" size={14} weight="duotone" color="currentColor" />
              <div>
                <p className={styles.actionTitle}>{action.title}</p>
                <p className={styles.actionMeta}>{action.meta}</p>
              </div>
            </div>
          ))}
        </>
      }
      sidebar={<SidebarNav activeLabel="Pipeline" items={NAV_ITEMS} />}
    >
      <div className={styles.stats}>
        <StatCard delta="↑ 18% vs. mês anterior" label="Leads ativos" value="1 248" />
        <StatCard delta="↑ 12% vs. mês anterior" label="Oportunidades" value="326" />
        <StatCard delta="↑ 22% vs. mês anterior" label="Negócios ganhos" value="128" />
        <StatCard delta="↑ 16% vs. mês anterior" label="Receita" value="€ 42 560" />
      </div>
      <div className={styles.board}>
        {STAGES.map((stage) => (
          <div className={styles.column} key={stage.label}>
            <p className={styles.columnHeader}>
              <span className={styles.columnLabel}>{stage.label}</span>
              <span>{stage.count}</span>
            </p>
            <div className={styles.card}>
              <p className={styles.cardTitle}>{stage.deal}</p>
              <p className={styles.cardMeta}>{stage.value}</p>
            </div>
          </div>
        ))}
      </div>
    </AppWindow>
  );
}
