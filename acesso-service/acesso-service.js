const express = require("express");
const sqlite3 = require("sqlite3");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexão com o banco de dados
var db = new sqlite3.Database("./dados_acessos.db", (err) => {
  if (err) {
    console.log("ERRO: não foi possível conectar ao SQLite.");
    throw err;
  }
  console.log("Conectado ao banco de acessos!");
});

// Criação da tabela de histórico de acessos
db.run(
  `CREATE TABLE IF NOT EXISTS acesso (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    ID_INGRESSO INTEGER NOT NULL,
    ID_ATRACAO INTEGER NOT NULL,
    CPF INTEGER NOT NULL,
    DATA_HORA TEXT NOT NULL,
    STATUS TEXT NOT NULL
  )`,
  [],
  (err) => {
    if (err) throw err;
  }
);

// POST /Acesso - Registrar acesso a uma atração
app.post("/Acesso", async (req, res) => {
  try {
    const { id_ingresso, id_atracao } = req.body;

    if (!id_ingresso || !id_atracao) {
      return res
        .status(400)
        .json({ error: "id_ingresso e id_atracao são obrigatórios." });
    }

    // 1. Buscar o ingresso
    let ingresso;
    try {
      const ingressoResponse = await axios.get(
        `http://localhost:8090/Ingresso/${id_ingresso}`
      );
      ingresso = ingressoResponse.data;
    } catch (error) {
      return res.status(404).json({ error: "Ingresso não encontrado." });
    }

    // 2. Verificar se o ingresso expirou (DATA_LIMITE)
    if (ingresso.DATA_LIMITE) {
      const dataLimite = new Date(ingresso.DATA_LIMITE);
      const agora = new Date();

      if (agora > dataLimite) {
        // Registrar acesso negado
        db.run(
          `INSERT INTO acesso (ID_INGRESSO, ID_ATRACAO, CPF, DATA_HORA, STATUS) VALUES (?, ?, ?, ?, ?)`,
          [
            id_ingresso,
            id_atracao,
            ingresso.CPF,
            new Date().toISOString(),
            "negado_expirado",
          ],
          () => {}
        );
        return res.status(403).json({ error: "Ingresso expirado." });
      }
    }

    // 3. Verificar se ainda tem atrações disponíveis (se for ingresso limitado)
    if (
      ingresso.TIPO_INGRESSO === "Limitado" ||
      ingresso.TIPO_INGRESSO === "Day pass"
    ) {
      if (ingresso.NUMERO_ATRACOES <= 0) {
        // Registrar acesso negado
        db.run(
          `INSERT INTO acesso (ID_INGRESSO, ID_ATRACAO, CPF, DATA_HORA, STATUS) VALUES (?, ?, ?, ?, ?)`,
          [
            id_ingresso,
            id_atracao,
            ingresso.CPF,
            new Date().toISOString(),
            "negado_sem_creditos",
          ],
          () => {}
        );
        return res
          .status(403)
          .json({ error: "Ingresso sem atrações disponíveis." });
      }
    }

    // 4. Verificar se a atração existe e está funcionando
    let atracao;
    try {
      const atracaoResponse = await axios.get(
        `http://localhost:8100/Atracao/${id_atracao}`
      );
      atracao = atracaoResponse.data;

      if (!atracao.status) {
        // Registrar acesso negado
        db.run(
          `INSERT INTO acesso (ID_INGRESSO, ID_ATRACAO, CPF, DATA_HORA, STATUS) VALUES (?, ?, ?, ?, ?)`,
          [
            id_ingresso,
            id_atracao,
            ingresso.CPF,
            new Date().toISOString(),
            "negado_manutencao",
          ],
          () => {}
        );
        return res.status(403).json({ error: "Atração em manutenção." });
      }
    } catch (error) {
      return res.status(404).json({ error: "Atração não encontrada." });
    }

    // 5. Decrementar o número de atrações (se não for Full pass ilimitado)
    if (ingresso.TIPO_INGRESSO !== "Full pass") {
      const novoNumero = ingresso.NUMERO_ATRACOES - 1;

      try {
        await axios.patch(`http://localhost:8090/Ingresso/${id_ingresso}`, {
          NUMERO_ATRACOES: novoNumero,
        });
      } catch (error) {
        console.error("Erro ao atualizar ingresso:", error.message);
        return res.status(500).send("Erro ao atualizar ingresso.");
      }

      db.run(
        `INSERT INTO acesso (ID_INGRESSO, ID_ATRACAO, CPF, DATA_HORA, STATUS) VALUES (?, ?, ?, ?, ?)`,
        [
          id_ingresso,
          id_atracao,
          ingresso.CPF,
          new Date().toISOString(),
          "sucesso",
        ],
        function (err) {
          if (err) {
            console.error("Erro ao registrar acesso:", err.message);
            return res.status(500).send("Erro ao registrar acesso.");
          }

          console.log(
            `Acesso registrado: Ingresso ${id_ingresso} -> Atração ${id_atracao}`
          );
          res.status(200).json({
            message: "Acesso à atração registrado com sucesso!",
            acesso_id: this.lastID,
            ingresso_id: id_ingresso,
            atracao_id: id_atracao,
            atracao_nome: atracao.nome,
            atracoes_restantes_ingresso: novoNumero,
            tipo_ingresso: ingresso.TIPO_INGRESSO,
            data_hora: new Date().toISOString(),
          });
        }
      );
    } else {
      // Full pass - acesso ilimitado, não decrementa
      db.run(
        `INSERT INTO acesso (ID_INGRESSO, ID_ATRACAO, CPF, DATA_HORA, STATUS) VALUES (?, ?, ?, ?, ?)`,
        [
          id_ingresso,
          id_atracao,
          ingresso.CPF,
          new Date().toISOString(),
          "sucesso",
        ],
        function (err) {
          if (err) {
            console.error("Erro ao registrar acesso:", err.message);
            return res.status(500).send("Erro ao registrar acesso.");
          }

          console.log(
            `Acesso registrado (Full Pass): Ingresso ${id_ingresso} -> Atração ${id_atracao}`
          );
          res.status(200).json({
            message: "Acesso à atração registrado com sucesso!",
            acesso_id: this.lastID,
            ingresso_id: id_ingresso,
            atracao_id: id_atracao,
            atracao_nome: atracao.nome,
            atracoes_restantes_ingresso: "Ilimitado",
            tipo_ingresso: ingresso.TIPO_INGRESSO,
            data_hora: new Date().toISOString(),
          });
        }
      );
    }
  } catch (error) {
    console.error("Erro ao processar acesso:", error.message);
    res.status(500).json({ error: "Erro ao processar acesso à atração." });
  }
});

// GET /Acesso - Listar todos os acessos
app.get("/Acesso", (req, res) => {
  db.all(`SELECT * FROM acesso ORDER BY DATA_HORA DESC`, [], (err, rows) => {
    if (err) {
      console.error("Erro ao listar acessos:", err.message);
      return res.status(500).send("Erro ao listar acessos.");
    }
    res.status(200).json(rows);
  });
});

// GET /Acesso/:id - Buscar acesso por ID
app.get("/Acesso/:id", (req, res) => {
  db.get(`SELECT * FROM acesso WHERE ID = ?`, [req.params.id], (err, row) => {
    if (err) {
      console.error("Erro ao buscar acesso:", err.message);
      return res.status(500).send("Erro ao buscar acesso.");
    }
    if (!row) {
      return res.status(404).send("Acesso não encontrado.");
    }
    res.status(200).json(row);
  });
});

// GET /Acesso/ingresso/:id_ingresso - Buscar acessos de um ingresso
app.get("/Acesso/ingresso/:id_ingresso", (req, res) => {
  db.all(
    `SELECT * FROM acesso WHERE ID_INGRESSO = ? ORDER BY DATA_HORA DESC`,
    [req.params.id_ingresso],
    (err, rows) => {
      if (err) {
        console.error("Erro ao buscar acessos:", err.message);
        return res.status(500).send("Erro ao buscar acessos do ingresso.");
      }
      res.status(200).json(rows);
    }
  );
});

// GET /Acesso/usuario/:cpf - Buscar acessos de um usuário
app.get("/Acesso/usuario/:cpf", (req, res) => {
  db.all(
    `SELECT * FROM acesso WHERE CPF = ? ORDER BY DATA_HORA DESC`,
    [req.params.cpf],
    (err, rows) => {
      if (err) {
        console.error("Erro ao buscar acessos:", err.message);
        return res.status(500).send("Erro ao buscar acessos do usuário.");
      }
      res.status(200).json(rows);
    }
  );
});

// GET /Acesso/atracao/:id_atracao - Buscar acessos de uma atração
app.get("/Acesso/atracao/:id_atracao", (req, res) => {
  db.all(
    `SELECT * FROM acesso WHERE ID_ATRACAO = ? ORDER BY DATA_HORA DESC`,
    [req.params.id_atracao],
    (err, rows) => {
      if (err) {
        console.error("Erro ao buscar acessos:", err.message);
        return res.status(500).send("Erro ao buscar acessos da atração.");
      }
      res.status(200).json(rows);
    }
  );
});

// Servidor
app.listen(8120, () => {
  console.log("Serviço de Acessos rodando na porta 8120");
});
