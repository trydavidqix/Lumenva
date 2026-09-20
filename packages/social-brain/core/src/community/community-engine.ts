/**
 * Represents the source of the inbound message.
 */
export type MessageSource = 'comment' | 'dm' | 'messenger';

/**
 * Represents an inbound message from a community channel.
 */
export interface InboundMessage {
  id: string;
  source: MessageSource;
  content: string;
  authorId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Represents the possible routing destinations/actions for a message.
 */
export type RouteAction = 
  | 'auto_reply'       // Safe answer (auto)
  | 'route_to_crm'     // Lead (CRM)
  | 'route_to_support' // Support (human agent)
  | 'escalate';        // Sensitive (requires approval/handoff)

/**
 * Represents the classification result of a message.
 */
export interface ClassificationResult {
  action: RouteAction;
  confidence: number;
  reason?: string;
  suggestedReply?: string;
}

/**
 * Interface for the message classifier.
 * In a full implementation, this would use an LLM or heuristics to classify the message.
 */
export interface MessageClassifier {
  classify(message: InboundMessage): Promise<ClassificationResult>;
}

/**
 * Interface for routing actions based on classification.
 */
export interface MessageRouter {
  handleAutoReply(message: InboundMessage, result: ClassificationResult): Promise<void>;
  routeToCrm(message: InboundMessage, result: ClassificationResult): Promise<void>;
  routeToSupport(message: InboundMessage, result: ClassificationResult): Promise<void>;
  escalate(message: InboundMessage, result: ClassificationResult): Promise<void>;
}

/**
 * The Community Engine handles the intake, classification, and routing of community messages.
 */
export class CommunityEngine {
  constructor(
    private readonly classifier: MessageClassifier,
    private readonly router: MessageRouter
  ) {}

  /**
   * Processes an inbound message, classifying it and routing it to the appropriate handler.
   * 
   * @param message The inbound message to process.
   */
  async processMessage(message: InboundMessage): Promise<void> {
    const classification = await this.classifier.classify(message);

    switch (classification.action) {
      case 'auto_reply':
        await this.router.handleAutoReply(message, classification);
        break;
      case 'route_to_crm':
        await this.router.routeToCrm(message, classification);
        break;
      case 'route_to_support':
        await this.router.routeToSupport(message, classification);
        break;
      case 'escalate':
        await this.router.escalate(message, classification);
        break;
      default:
        // Fallback to escalation for unknown actions
        await this.router.escalate(message, classification);
        break;
    }
  }
}
