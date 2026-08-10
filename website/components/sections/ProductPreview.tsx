import { MessageCircle, Sparkles } from "lucide-react";
import styles from "./ProductPreview.module.css";

const STAGES = ["Novo", "Em conversa", "Fechado"] as const;

export function ProductPreview() {
  return (
    <div aria-hidden="true" className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelHeaderTitle}>
          <MessageCircle size={16} strokeWidth={1.8} />
          Caixa de entrada
        </span>
        <span className={styles.channel}>WhatsApp</span>
      </div>
      <div className={styles.message}>
        <div className={styles.messageMeta}>
          <span className={styles.contact}>Cliente</span>
          <span className={styles.priority}>Prioridade alta</span>
        </div>
        <p className={styles.messageText}>Ainda dá tempo de entregar hoje?</p>
      </div>
      <div className={styles.suggestion}>
        <span className={styles.suggestionLabel}>
          <Sparkles size={14} strokeWidth={1.8} />
          Sugestão da IA
        </span>
        <p className={styles.suggestionText}>Sim, o pedido chega até às 18h.</p>
      </div>
      <div className={styles.pipeline}>
        {STAGES.map((stage, index) => (
          <span className={styles.stage} data-active={index === 1} key={stage}>
            {stage}
          </span>
        ))}
      </div>
    </div>
  );
}
