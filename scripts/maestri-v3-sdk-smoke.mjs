import { Codex, Thread } from '@openai/codex-sdk';
import * as Jules from '@google/jules-sdk';

if (typeof Codex !== 'function' || typeof Thread !== 'function') {
  throw new Error('Codex SDK exports are unavailable');
}

const requiredJulesExports = ['JulesApiError', 'JulesAuthenticationError'];
for (const name of requiredJulesExports) {
  if (!(name in Jules)) throw new Error(`Jules SDK export is unavailable: ${name}`);
}

console.log(JSON.stringify({
  codex: ['Codex', 'Thread'],
  jules: requiredJulesExports,
  externalApiCalled: false,
}, null, 2));
