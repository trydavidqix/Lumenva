#!/usr/bin/env bash
# Compatibilidade de nomes de ambiente durante a migração Deskcomm -> Lumenva.
# Sourced pelos scripts do kit; nunca imprime valores.

env_alias() { # env_alias <sufixo>
  local new_name="LUMENVA_$1" old_name="DESKCOMM_$1"
  local new_value="${!new_name-}" old_value="${!old_name-}"

  if [ -n "$new_value" ] && [ -n "$old_value" ] && [ "$new_value" != "$old_value" ]; then
    printf 'Variáveis %s e %s definidas com valores diferentes. Remova uma delas.\n' "$new_name" "$old_name" >&2
    return 1
  fi

  if [ -n "$new_value" ]; then
    export "$new_name=$new_value"
  elif [ -n "$old_value" ]; then
    printf 'Aviso: usando %s como fallback legado para %s.\n' "$old_name" "$new_name" >&2
    export "$new_name=$old_value"
  else
    unset "$new_name"
  fi
}
