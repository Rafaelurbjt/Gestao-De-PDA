USE controle_pda;

CREATE OR REPLACE VIEW vw_painel AS
SELECT
  c.id                AS colaborador_id,
  c.nome,
  c.cpf,
  e.nome              AS empresa,
  c.vinculo,
  (k.id IS NOT NULL)  AS com_pda,       -- 1 = checkbox marcado
  p.numero_serie      AS pda,
  p.modelo,
  k.status            AS situacao,      -- aguardando ou em_uso
  k.checkin_em,
  k.confirmado_em,
  l.nome              AS lider_checkin,
  k.id                AS checkin_id
FROM colaboradores c
JOIN empresas e            ON e.id = c.empresa_id
LEFT JOIN checkins k       ON k.colaborador_ativo = c.id
LEFT JOIN pdas p           ON p.id = k.pda_id
LEFT JOIN colaboradores l  ON l.id = k.lider_checkin_id
WHERE c.ativo = 1;

SELECT * FROM vw_painel;