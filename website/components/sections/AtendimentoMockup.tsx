import {
  BarChart3,
  Bot,
  Home,
  Inbox,
  MessageCircle,
  Send,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { AppWindow } from "@/components/mockup/AppWindow";
import { SidebarNav } from "@/components/mockup/SidebarNav";
import styles from "./AtendimentoMockup.module.css";

const NAV_ITEMS = [
  { label: "Resumo", icon: Home },
  { label: "Inbox", icon: Inbox },
  { label: "Leads", icon: Users },
  { label: "Agentes IA", icon: Bot },
  { label: "Relatórios", icon: BarChart3 },
  { label: "Configurações", icon: Settings },
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
      sidebar={<SidebarNav activeLabel="Inbox" items={NAV_ITEMS} />}
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
            <MessageCircle aria-hidden="true" size={14} strokeWidth={1.8} />
            Olá! Queria saber mais sobre os vossos planos.
          </div>
          <div className={styles.suggestions}>
            <p className={styles.suggestionsLabel}>
              <Sparkles aria-hidden="true" size={14} strokeWidth={1.8} />
              IA sugeriu resposta
            </p>
            {SUGGESTIONS.map((suggestion) => (
              <div className={styles.suggestionRow} key={suggestion}>
                <p>{suggestion}</p>
                <Send aria-hidden="true" size={14} strokeWidth={1.8} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppWindow>
  );
}
