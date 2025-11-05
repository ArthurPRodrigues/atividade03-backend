const sqlite3 = require("sqlite3");
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var db = new sqlite3.Database("./dados_ingressos.db", (err) => {
  if (err) {
    console.log("ERRO: não foi possível conectar ao SQLite.");
    throw err;
  }
  console.log("Conectado ao banco de ingresso");
});

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

// POST FUNCIONA
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

    if (TIPO_INGRESSO === "day") {
      dataLimite = new Date();
      dataLimite.setDate(dataResgate.getDate() + 1);
      NUMERO_ATRACOES = null;
    } else if (TIPO_INGRESSO === "anual") {
      dataLimite = new Date();
      dataLimite.setDate(dataResgate.getDate() + 365);
      NUMERO_ATRACOES = null;
    } else if (TIPO_INGRESSO === "standard") {
      dataLimite = null;
      NUMERO_ATRACOES = 10;
    } else {
      return res.status(400).json({ error: "Tipo de ingresso é inválido." });
    }

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

        res.status(201).json({
          message: "Ingresso cadastrado",
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

// GET pra todos FUNCIONA
app.get("/Ingresso", (req, res) => {
  db.all(`SELECT * FROM ingresso`, [], (err, rows) => {
    if (err) {
      console.error("Erro ao listar ingressos:", err.message);
      return res.status(500).send("Erro ao listar ingressos.");
    }
    res.status(200).json(rows);
  });
});

// GET /Ingresso/validar/:id - Valida utilidade do ingresso por ID
app.get("/Ingresso/validar/:id", (req, res) => {
  const ID = req.params.id;

  db.get("SELECT * FROM ingresso WHERE ID = ?", [ID], (err, ingresso) => {
    if (!ingresso) {
      return res.status(404).json({ error: "Ingresso não encontrado" });
    }

    const dataAtual = new Date();

    if (ingresso.TIPO_INGRESSO === "standard") {
      if (ingresso.NUMERO_ATRACOES === 0) {
        return res.status(400).json({
          error: "Ingresso do tipo standard já foi completamente utilizado",
          atracoes_restantes: 0,
        });
      }
      return res.status(200).json({
        message: "Ingresso válido",
        tipo_ingresso: ingresso.TIPO_INGRESSO,
        atracoes_restantes: ingresso.NUMERO_ATRACOES,
      });
    }

    if (ingresso.DATA_LIMITE) {
      const dataLimite = new Date(ingresso.DATA_LIMITE);

      if (dataLimite < dataAtual) {
        return res.status(400).json({
          error: "Data de uso do ingresso já venceu",
          data_atual: dataAtual.toLocaleString("pt-BR"),
          data_limite: dataLimite.toLocaleString("pt-BR"),
        });
      }
    }

    return res.status(200).json({
      message: "Ingresso válido",
      tipo_ingresso: ingresso.TIPO_INGRESSO,
    });
  });
});

// GET pra um só FUNCIONA
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

// PATCH FUNCIONA
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

// DELETE FUNCIONA
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

// POST - /Ingresso/Atracao/:cpf - Cadastra um acesso a uma atração de acordo com ingresso de um usuário cadastrado
app.post("/Ingresso/Atracao/:cpf", async (req, res) => {
  try {
    const cpf = req.params.cpf;
    const { id_atracao, id_ingresso } = req.body;
    console.log("CPF:", cpf, "ID Atração:", id_atracao, "ID Ingresso:", id_ingresso);
    
    if (!id_atracao || !id_ingresso) {
      return res.status(400).json({
        error: "ID da atração e ID do ingresso devem ser informados.",
      });
    }

    // Busca cadastro via AXIOS usando o CPF da URL
    let cadastro;
    try {
      const cadastroResponse = await axios.get(
        `http://localhost:8080/Cadastro/${cpf}`
      );
      cadastro = cadastroResponse.data;
    } catch (error) {
      console.error("Erro ao buscar cadastro:", error.message);
      return res.status(404).json({ error: "Cadastro não encontrado." });
    }

    // Busca atração via AXIOS
    let atracao;
    try {
      const atracaoResponse = await axios.get(
        `http://localhost:8100/Atracao/${id_atracao}`
      );
      atracao = atracaoResponse.data;
    } catch (error) {
      console.error("Erro ao buscar atração:", error.message);
      return res.status(404).json({ error: "Atração não encontrada." });
    }

    // Busca ingresso no banco e verifica se pertence ao CPF informado
    const ingresso = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM ingresso WHERE ID = ? AND CPF = ?`,
        [id_ingresso, cpf],
        (err, row) => {
          if (err) {
            console.error("Erro ao buscar ingresso:", err.message);
            return reject(err);
          }
          if (!row) {
            return reject(new Error("Ingresso não encontrado ou não pertence ao CPF informado."));
          }
          resolve(row);
        }
      );
    });

    // Busca fila via AXIOS
    let fila;
    let posicao_fila;
    try {
      const filaResponse = await axios.get(
        `http://localhost:8110/Fila/${id_atracao}`
      );
      fila = filaResponse.data;
      posicao_fila = fila.pessoas;
    } catch (error) {
      console.error("Erro ao buscar fila:", error.message);
      return res.status(404).json({ error: "Fila não encontrada." });
    }

    // Verifica se tudo foi encontrado
    if (!atracao || !ingresso || !cadastro) {
      return res.status(404).json({ error: "Informações não encontradas." });
    }

    // --- Verifica tipo de ingresso STANDARD ---
    if (ingresso.TIPO_INGRESSO === "standard") {
      if (ingresso.NUMERO_ATRACOES <= 0) {
        return res.status(400).json({
          error:
            "Ingresso sem atrações restantes, selecione um ingresso válido.",
        });
      }

      // Atualiza a fila
      const fila_atualizada = fila.pessoas + 1;
      await axios.patch(`http://localhost:8110/Fila/${id_atracao}`, {
        pessoas: fila_atualizada,
      });

      // Atualiza número de atrações no banco
      db.run(
        "UPDATE ingresso SET NUMERO_ATRACOES = ? WHERE ID = ?",
        [ingresso.NUMERO_ATRACOES - 1, ingresso.ID],
        (updateErr) => {
          if (updateErr) {
            console.error("Erro ao atualizar ingresso:", updateErr.message);
            return res
              .status(500)
              .json({ error: "Erro ao atualizar ingresso." });
          }

          return res.status(200).json({
            message: "Acesso à atração confirmado!",
            atracao: atracao.nome,
            posicao_fila: fila_atualizada,
            tipo_ingresso: ingresso.TIPO_INGRESSO,
            atracoes_restantes: ingresso.NUMERO_ATRACOES - 1,
          });
        }
      );
    }

    // --- Verifica tipo de ingresso DAY ou ANUAL ---
    else if (
      ingresso.TIPO_INGRESSO === "anual" ||
      ingresso.TIPO_INGRESSO === "day"
    ) {
      const fila_atualizada = fila.pessoas + 1;
      await axios.patch(`http://localhost:8110/Fila/${id_atracao}`, {
        pessoas: fila_atualizada,
      });
      return res.status(200).json({
        message: "Acesso à atração confirmado!",
        atracao: atracao.nome,
        posicao_fila: fila_atualizada,
        tipo_ingresso: ingresso.TIPO_INGRESSO,
        atracoes_restantes: "Ilimitado",
      });
    } else {
      return res.status(400).json({
        error: "Tipo de ingresso inválido para acesso à atração.",
      });
    }
  } catch (err) {
    console.error("Erro interno:", err.message);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});
app.listen(8090, () =>
  console.log("Controle de Ingressos rodando na porta 8090")
);
