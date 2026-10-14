USE controle_pda;

-- Remove a versão anterior (tabelas vazias)
DROP TABLE IF EXISTS tentativas, checkins, lideres, pdas, colaboradores, empresas;

-- 1) EMPRESAS: só o nome é digitado
CREATE TABLE empresas (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(120) NOT NULL UNIQUE,
  tipo       ENUM('propria','terceirizada') NOT NULL DEFAULT 'terceirizada',
  ativo      TINYINT(1) NOT NULL DEFAULT 1,
  criado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2) COLABORADORES: nome, CPF e empresa. Líder é só uma marcação.
CREATE TABLE colaboradores (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empresa_id  INT UNSIGNED NOT NULL,
  nome        VARCHAR(120) NOT NULL,
  cpf         CHAR(11) NOT NULL UNIQUE,          -- só números
  vinculo     ENUM('clt','diarista') NOT NULL,   -- o app preenche pela empresa
  lider       TINYINT(1) NOT NULL DEFAULT 0,     -- 1 = pode usar o modo Balcão
  senha_hash  VARCHAR(100) NULL,                 -- só para líderes
  ativo       TINYINT(1) NOT NULL DEFAULT 1,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_colab_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT ck_lider_senha CHECK (lider = 0 OR senha_hash IS NOT NULL),
  INDEX idx_colab_nome (nome)
) ENGINE=InnoDB;

-- 3) PDAs: número de série e modelo
CREATE TABLE pdas (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero_serie  VARCHAR(60) NOT NULL UNIQUE,
  modelo        VARCHAR(60) NOT NULL,
  status        ENUM('livre','reservado','em_uso','bloqueado','manutencao') NOT NULL DEFAULT 'livre',
  token_hash    CHAR(64) NULL UNIQUE,            -- preenchido quando o aparelho é configurado
  ativo         TINYINT(1) NOT NULL DEFAULT 1,
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4) CHECKINS: entrega e devolução. Também é o histórico.
CREATE TABLE checkins (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pda_id             INT UNSIGNED NOT NULL,
  colaborador_id     INT UNSIGNED NOT NULL,
  lider_checkin_id   INT UNSIGNED NOT NULL,
  lider_checkout_id  INT UNSIGNED NULL,
  status             ENUM('aguardando','em_uso','finalizado','cancelado') NOT NULL DEFAULT 'aguardando',
  checkin_em         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmado_em      DATETIME NULL,              -- quando digitou o CPF no PDA
  checkout_em        DATETIME NULL,
  cpf_errado_qtd     TINYINT UNSIGNED NOT NULL DEFAULT 0,  -- tentativas de CPF errado
  observacao         VARCHAR(255) NULL,
  pda_ativo          INT UNSIGNED GENERATED ALWAYS AS
                       (IF(status IN ('aguardando','em_uso'), pda_id, NULL)) STORED,
  colaborador_ativo  INT UNSIGNED GENERATED ALWAYS AS
                       (IF(status IN ('aguardando','em_uso'), colaborador_id, NULL)) STORED,
  CONSTRAINT fk_chk_pda       FOREIGN KEY (pda_id)            REFERENCES pdas(id),
  CONSTRAINT fk_chk_colab     FOREIGN KEY (colaborador_id)    REFERENCES colaboradores(id),
  CONSTRAINT fk_chk_lider_in  FOREIGN KEY (lider_checkin_id)  REFERENCES colaboradores(id),
  CONSTRAINT fk_chk_lider_out FOREIGN KEY (lider_checkout_id) REFERENCES colaboradores(id),
  CONSTRAINT uq_pda_ativo     UNIQUE (pda_ativo),
  CONSTRAINT uq_colab_ativo   UNIQUE (colaborador_ativo),
  CONSTRAINT ck_checkout CHECK (
    (status IN ('aguardando','em_uso') AND checkout_em IS NULL) OR
    (status IN ('finalizado','cancelado') AND checkout_em IS NOT NULL)
  ),
  INDEX idx_chk_data (checkin_em)
) ENGINE=InnoDB;

INSERT INTO empresas (nome, tipo) VALUES ('J&T Express', 'propria');

SHOW TABLES;