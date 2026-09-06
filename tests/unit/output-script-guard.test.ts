import { describe, expect, it } from 'vitest';
import { detectScriptContamination } from '@/lib/ai/output-script-guard';
describe('output script guard', () => {
  it('accepts clean Portuguese', () => expect(detectScriptContamination('Olá', 'Olá, como está?').contaminated).toBe(false));
  it('detects isolated Armenian contamination', () => expect(detectScriptContamination('Oi', 'Olá, դեռ tudo bem?').contaminated).toBe(true));
  it('accepts fully Greek response to Greek input', () => expect(detectScriptContamination('Γεια σου', 'Καλημέρα, πώς είσαι;').contaminated).toBe(false));
  it('ignores numbers and emoji', () => expect(detectScriptContamination('Olá', 'Olá 123 🙂').contaminated).toBe(false));
});
