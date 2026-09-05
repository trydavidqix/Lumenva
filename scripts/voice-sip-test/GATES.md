# Gates: voice barge-in audio synchronization

OWNS: scripts/voice-sip-test/src/server.ts, scripts/voice-sip-test/GATES.md

Scope: synchronize barge-in cancellation, conversation truncation, output clearing, and type safety in the voice SIP sideband handler

- [x] G1: TypeScript compilation succeeds for the voice SIP test subproject
  CHECK: ./node_modules/.bin/tsc -p tsconfig.json --noEmit && node -e "console.log('VOICE_TYPECHECK_PASS')"
  EXPECT: VOICE_TYPECHECK_PASS
  CWD: scripts/voice-sip-test
  EVIDENCE: automatic-evidence=v1; definition-sha256=dfec42fefedc85d07d6cbc70f9ac9f21fa46164c9b9f21b5e3a78fcdf1e2e0ff; exit=0; EXPECT=matched; output-sha256=88d94db671fac7a1a8b2d17c6d3656686235c0e9d4927e020c16116ec8620b07; output-bytes=21; shell=/bin/sh; cwd=/Users/david/Desktop/Projetos/CRM/DeskcommCRM/scripts/voice-sip-test; path=34c4cba9c7a6/25 entries

- [x] G2: Barge-in handler emits cancel, truncate, and output clear in synchronized order
  CHECK: node -e "const fs=require('fs'); const s=fs.readFileSync('src/server.ts','utf8'); const a=['response.cancel','conversation.item.truncate','output_audio_buffer.clear']; if (!a.every(x=>s.includes(x))) process.exit(1); const i=a.map(x=>s.indexOf(x)); if (!(i[0] < i[1] && i[1] < i[2])) process.exit(1); if (!s.includes('input_audio_buffer.speech_started')) process.exit(1); if (!s.includes('interruptActiveResponse();')) process.exit(1); console.log('VOICE_BARGE_IN_SYNC_PASS')"
  EXPECT: VOICE_BARGE_IN_SYNC_PASS
  CWD: scripts/voice-sip-test
  EVIDENCE: automatic-evidence=v1; definition-sha256=ca8dbb2563896508c7c0aa2ce747c266bfcea8356b5cb515f619f68adce1a5df; exit=0; EXPECT=matched; output-sha256=a2150d66883822167b1c36336d9aa3c5794d439d5334c675a9cedc8054d90bed; output-bytes=25; shell=/bin/sh; cwd=/Users/david/Desktop/Projetos/CRM/DeskcommCRM/scripts/voice-sip-test; path=34c4cba9c7a6/25 entries

- [x] G3: No server restart or test call was executed
  EVIDENCE: Reviewed command history and process actions for this task; no server restart and no outbound test call were executed.
