const sqlite3 = require("sqlite3");
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Banco de dados
var db = new sqlite3.Database("./dados_ingressos.db", (err) => {
  if (err) {
    console.log("ERRO: não foi possível conectar ao SQLite.");
    throw err;
  }
  console.log("Conectado ao banco de ingressos!");
});

// Criação da tabela
db.run(
  `CREATE TABLE IF NOT EXISTS ingresso (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    CPF INTEGER NOT NULL,
    TIPO_INGRESSO TEXT NOT NULL,
    NUMERO_ATRACOES INTEGER,
    DATA_RESGATE TEXT NOT NULL,
    DATA_LIMITE TEXT
  )`,
  [],
  (err) => {
    if (err) throw err;
  }
);

app.post("/Ingresso/:cpf", async (req, res) => {
  try {
    const cpf = req.params.cpf;
    const { TIPO_INGRESSO } = req.body;

    // Verifica se o CPF existe no serviço de cadastro
    const response = await axios.get(`http://localhost:8080/Cadastro/${cpf}`);
    const user = response.data;

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // Calcula as datas e numero atracaos
    const dataResgate = new Date();
    let dataLimite = null;
    let NUMERO_ATRACOES = 0;

    if (TIPO_INGRESSO === "Day pass") {
      dataLimite = new Date();
      dataLimite.setDate(dataResgate.getDate() + 1);
      NUMERO_ATRACOES = 10;
    } else if (TIPO_INGRESSO === "Full pass") {
      dataLimite = new Date();
      dataLimite.setDate(dataResgate.getDate() + 365);
      NUMERO_ATRACOES = null;
    } else if (TIPO_INGRESSO === "Limitado") {
      dataLimite = null;
      NUMERO_ATRACOES = 10;
    } else {
      NUMERO_ATRACOES = 10;
    }

    // Insere o ingresso no banco
    db.run(
      `INSERT INTO ingresso (CPF, TIPO_INGRESSO, NUMERO_ATRACOES, DATA_RESGATE, DATA_LIMITE)
       VALUES (?, ?, ?, ?, ?)`,
      [
        cpf,
        TIPO_INGRESSO,
        NUMERO_ATRACOES || null,
        dataResgate.toISOString(),
        dataLimite ? dataLimite.toISOString() : null,
      ],
      function (err) {
        if (err) {
          console.error("Erro ao cadastrar ingresso:", err.message);
          return res.status(500).send("Erro ao cadastrar ingresso.");
        }

        console.log(`Ingresso criado para o CPF ${cpf}!`);
        res.status(201).json({
          message: "Ingresso cadastrado com sucesso!",
          id: this.lastID,
          cpf,
          TIPO_INGRESSO,
          NUMERO_ATRACOES,
          DATA_RESGATE: dataResgate,
          DATA_LIMITE: dataLimite,
        });
      }
    );
  } catch (error) {
    console.error("Erro na requisição:", error.message);
    res.status(500).json({ error: "Erro ao processar a requisição." });
  }
});

// GET /Ingresso - Listar todos os ingressos
app.get("/Ingresso", (req, res) => {
  db.all(`SELECT * FROM ingresso`, [], (err, rows) => {
    if (err) {
      console.error("Erro ao listar ingressos:", err.message);
      return res.status(500).send("Erro ao listar ingressos.");
    }
    res.status(200).json(rows);
  });
});

// GET /Ingresso/:id - Buscar ingresso por ID
app.get("/Ingresso/:id", (req, res) => {
  db.get(`SELECT * FROM ingresso WHERE ID = ?`, [req.params.id], (err, row) => {
    if (err) {
      console.error("Erro ao buscar ingresso:", err.message);
      return res.status(500).send("Erro ao buscar ingresso.");
    }
    if (!row) {
      return res.status(404).send("Ingresso não encontrado.");
    }
    res.status(200).json(row);
  });
});

// GET /Ingresso/usuario/:cpf - Buscar ingressos de um usuário
app.get("/Ingresso/usuario/:cpf", (req, res) => {
  db.all(
    `SELECT * FROM ingresso WHERE CPF = ?`,
    [req.params.cpf],
    (err, rows) => {
      if (err) {
        console.error("Erro ao buscar ingressos:", err.message);
        return res.status(500).send("Erro ao buscar ingressos do usuário.");
      }
      res.status(200).json(rows);
    }
  );
});

// POST /Ingresso/:id/acessar-atracao/:id_atracao
app.post("/Ingresso/:id/acessar-atracao/:id_atracao", async (req, res) => {
  try {
    const ingressoId = req.params.id;
    const atracaoId = req.params.id_atracao;

    // 1. Buscar o ingresso
    db.get(
      `SELECT * FROM ingresso WHERE ID = ?`,
      [ingressoId],
      async (err, ingresso) => {
        if (err) {
          console.error("Erro ao buscar ingresso:", err.message);
          return res.status(500).send("Erro ao buscar ingresso.");
        }

        if (!ingresso) {
          return res.status(404).json({ error: "Ingresso não encontrado." });
        }

        // 2. Verificar se o ingresso expirou (DATA_LIMITE)
        if (ingresso.DATA_LIMITE) {
          const dataLimite = new Date(ingresso.DATA_LIMITE);
          const agora = new Date();

          if (agora > dataLimite) {
            return res.status(403).json({ error: "Ingresso expirado." });
          }
        }

        // 3. Verificar se ainda tem atrações disponíveis (se for ingresso limitado)
        if (
          ingresso.TIPO_INGRESSO === "Limitado" ||
          ingresso.TIPO_INGRESSO === "Day pass"
        ) {
          if (ingresso.NUMERO_ATRACOES <= 0) {
            return res
              .status(403)
              .json({ error: "Ingresso sem atrações disponíveis." });
          }
        }

        // 4. Verificar se a atração existe
        try {
          const atracaoResponse = await axios.get(
            `http://localhost:8100/Atracao/${atracaoId}`
          );
          const atracao = atracaoResponse.data;

          if (!atracao) {
            return res.status(404).json({ error: "Atração não encontrada." });
          }

          if (!atracao.status) {
            return res.status(403).json({ error: "Atração em manutenção." });
          }

          // 5. Decrementar o número de atrações (se não for Full pass ilimitado)
          if (ingresso.TIPO_INGRESSO !== "Full pass") {
            const novoNumero = ingresso.NUMERO_ATRACOES - 1;

            db.run(
              `UPDATE ingresso SET NUMERO_ATRACOES = ? WHERE ID = ?`,
              [novoNumero, ingressoId],
              function (err) {
                if (err) {
                  console.error("Erro ao atualizar ingresso:", err.message);
                  return res.status(500).send("Erro ao atualizar ingresso.");
                }

                console.log(
                  `Acesso registrado: Ingresso ${ingressoId} -> Atração ${atracaoId}`
                );
                res.status(200).json({
                  message: "Acesso à atração registrado com sucesso!",
                  ingresso_id: ingressoId,
                  atracao_id: atracaoId,
                  atracao_nome: atracao.nome,
                  atracoes_restantes: novoNumero,
                  tipo_ingresso: ingresso.TIPO_INGRESSO,
                });
              }
            );
          } else {
            // Full pass - acesso ilimitado, não decrementa
            console.log(
              `Acesso registrado (Full Pass): Ingresso ${ingressoId} -> Atração ${atracaoId}`
            );
            res.status(200).json({
              message: "Acesso à atração registrado com sucesso!",
              ingresso_id: ingressoId,
              atracao_id: atracaoId,
              atracao_nome: atracao.nome,
              atracoes_restantes: "Ilimitado",
              tipo_ingresso: ingresso.TIPO_INGRESSO,
            });
          }
        } catch (error) {
          if (error.response && error.response.status === 404) {
            return res.status(404).json({ error: "Atração não encontrada." });
          }
          console.error("Erro ao verificar atração:", error.message);
          return res.status(500).json({ error: "Erro ao verificar atração." });
        }
      }
    );
  } catch (error) {
    console.error("Erro ao processar acesso:", error.message);
    res.status(500).json({ error: "Erro ao processar acesso à atração." });
  }
});

// PATCH /Ingresso/:id - Atualizar ingresso
app.patch("/Ingresso/:id", (req, res) => {
  const { TIPO_INGRESSO, NUMERO_ATRACOES } = req.body;

  db.run(
    `UPDATE ingresso 
     SET TIPO_INGRESSO = COALESCE(?, TIPO_INGRESSO),
         NUMERO_ATRACOES = COALESCE(?, NUMERO_ATRACOES)
     WHERE ID = ?`,
    [TIPO_INGRESSO, NUMERO_ATRACOES, req.params.id],
    function (err) {
      if (err) {
        console.error("Erro ao atualizar ingresso:", err.message);
        return res.status(500).send("Erro ao atualizar ingresso.");
      }
      if (this.changes === 0) {
        return res.status(404).send("Ingresso não encontrado.");
      }
      res.status(200).send("Ingresso atualizado com sucesso!");
    }
  );
});

// DELETE /Ingresso/:id - Remover ingresso
app.delete("/Ingresso/:id", (req, res) => {
  db.run(`DELETE FROM ingresso WHERE ID = ?`, [req.params.id], function (err) {
    if (err) {
      console.error("Erro ao remover ingresso:", err.message);
      return res.status(500).send("Erro ao remover ingresso.");
    }
    if (this.changes === 0) {
      return res.status(404).send("Ingresso não encontrado.");
    }
    res.status(200).send("Ingresso removido com sucesso!");
  });
});

// Porta
const PORT = process.env.PORT || 8090;
app.listen(PORT, () => {
  console.log(`Serviço de Ingressos rodando na porta ${PORT}`);
});
