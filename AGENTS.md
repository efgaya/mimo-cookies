# Regras para agentes

Este arquivo se aplica a todo o repositório.

## Segurança e preservação do funcionamento

- Preserve o funcionamento atual dos fluxos de pedidos e de controle de estoque.
- Não altere o Supabase de produção sem autorização explícita do usuário.
- Não apague tabelas, colunas ou dados.
- Não exponha senhas, chaves `service_role` ou quaisquer outras credenciais ou chaves privadas em código, logs, documentação, commits ou respostas.
- Quando uma alteração exigir execução manual no Supabase, informe isso claramente, descrevendo o que precisa ser executado e os impactos esperados.

## Git e alterações no código

- Não execute `git push` sem autorização explícita do usuário.
- Prefira mudanças pequenas, localizadas e fáceis de revisar.
- Preserve o comportamento existente fora do escopo solicitado.
- Depois de qualquer alteração, sempre apresente:
  1. um resumo objetivo do que foi alterado;
  2. o resultado do `git diff` para revisão.
