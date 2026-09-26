/**
 * Adapter WAHA — o primeiro `ChannelAdapter`, e de propósito o mais burro
 * possível: cada método delega ao `lib/waha/*` que já existe e já é testado.
 * Reimplementar aqui é como se perde paridade de comportamento sem perceber.
 *
 * Nenhuma regra de negócio mora neste arquivo (ver `ChannelAdapter` em ../types).
 */
import { createWahaF7Adapter } from "./waha/wiring";
import type { ChannelAdapter } from "../types";

export const wahaAdapter: ChannelAdapter = createWahaF7Adapter();
