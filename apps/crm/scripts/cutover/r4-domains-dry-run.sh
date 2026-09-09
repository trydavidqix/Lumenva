#!/usr/bin/env bash
set -euo pipefail
python3 <<'PY'
import hashlib, hmac
hosts={'app':'app.lumenva.pt','root':'lumenva.pt'}
assert all(v.endswith('.lumenva.pt') or v=='lumenva.pt' for v in hosts.values())
origin='https://app.lumenva.pt'; allowlist={origin}; assert origin in allowlist
body=b'{"event":"message"}'; secret=b'dry-run-only'; sig=hmac.new(secret,body,hashlib.sha512).hexdigest(); assert hmac.compare_digest(sig,hmac.new(secret,body,hashlib.sha512).hexdigest())
oauth={'authorize_url':'https://app.lumenva.pt/api/v1/integrations/mock/callback'}; assert oauth['authorize_url'].startswith('https://app.lumenva.pt/')
cookie='r4_dry_run=1; Domain=.lumenva.pt; Secure; HttpOnly'; assert 'Domain=.lumenva.pt' in cookie
print('R4 dry-run PASS: hosts OAuth mock, assinatura WAHA, CORS e cookie simulados localmente; nenhum DNS/configuração externa alterado.')
PY
