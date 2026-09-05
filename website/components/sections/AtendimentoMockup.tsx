import {
  ChartBar,
  Robot,
  House,
  Tray,
  ChatCircle,
  PaperPlaneRight,
  Gear,
  Sparkle,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import { AppWindow } from "@/components/mockup/AppWindow";
import { SidebarNav } from "@/components/mockup/SidebarNav";
import styles from "./AtendimentoMockup.module.css";

const NAV_ITEMS = [
  { label: "Resumo", icon: House },
  { label: "Inbox", icon: Tray },
  { label: "Leads", icon: UsersThree },
  { label: "Agentes IA", icon: Robot },
  { label: "Relatórios", icon: ChartBar },
  { label: "Configurações", icon: Gear },
] as const;

const CONVERSATIONS = [
  { name: "João Silva", preview: "Olá! Queria saber mais sobre os planos.", time: "09:41" },
  { name: "Maria Fernandes", preview: "Preciso de ajuda com a minha fatura.", time: "09:32" },
  { name: "Pedro Costa", preview: "Onde consigo acompanhar o pedido?", time: "09:21" },
] as const;

const SUGGESTIONS = [
  "Claro! Aqui está um resumo dos nossos planos e diferenças principais.",
  "Posso enviar-lhe os detalhes de cada plano por aqui?",
] as const;

export function AtendimentoMockup() {
  return (
    <AppWindow
      panel={
        <>
          <div>
            <p className={styles.panelLabel}>Resumo da conversa</p>
            <p className={styles.panelText}>
              O cliente pediu informações sobre planos e preços.
            </p>
          </div>
          <div>
            <p className={styles.panelLabel}>Prioridade</p>
            <p className={styles.panelText}>Normal</p>
          </div>
          <div>
            <p className={styles.panelLabel}>Automação ativa</p>
            <p className={styles.panelText}>Qualificação de leads</p>
          </div>
        </>
      }
      sidebar={<SidebarNav activeLabel="Tray" items={NAV_ITEMS} />}
    >
      <div className={styles.layout}>
        <ul className={styles.conversationList}>
          {CONVERSATIONS.map((conversation) => (
            <li className={styles.conversationItem} data-active={conversation.name === "João Silva"} key={conversation.name}>
              <p className={styles.conversationName}>{conversation.name}</p>
              <p className={styles.conversationPreview}>{conversation.preview}</p>
              <p className={styles.conversationTime}>{conversation.time}</p>
            </li>
          ))}
        </ul>
        <div className={styles.thread}>
          <div className={styles.bubbleIn}>
            <ChatCircle aria-hidden="true" size={14} weight="duotone" color="currentColor" />
            Olá! Queria saber mais sobre os vossos planos.
          </div>
          <div className={styles.suggestions}>
            <p className={styles.suggestionsLabel}>
              <Sparkle aria-hidden="true" size={14} weight="duotone" color="currentColor" />
              IA sugeriu resposta
            </p>
            {SUGGESTIONS.map((suggestion) => (
              <div className={styles.suggestionRow} key={suggestion}>
                <p>{suggestion}</p>
                <PaperPlaneRight aria-hidden="true" size={14} weight="duotone" color="currentColor" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppWindow>
  );
}
