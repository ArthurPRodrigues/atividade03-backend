const sqlite3 = require("sqlite3");
const express = require("express");
const axios = require("axios");
const app = express();

app.use(express.json()); // Para analisar corpos de requisições JSON
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
    const { TIPO_INGRESSO, NUMERO_ATRACOES } = req.body;

    // Verifica se o CPF existe no serviço de cadastro
    const response = await axios.get(`http://localhost:8080/Cadastro/${cpf}`);
    const user = response.data;

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // Calcula as datas
    const dataResgate = new Date();
    let dataLimite = null;

    if (TIPO_INGRESSO === "Day pass") {
      dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() + 1);
    } else if (TIPO_INGRESSO === "Full pass") {
      dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() + 365);
    } else if (TIPO_INGRESSO === "Limitado") {
      dataLimite = null; // Apenas limitado pelo número de atrações
    }

    // Insere o ingresso no banco
    db.run(
      `INSERT INTO ingresso (CPF, TIPO_INGRESSO, NUMERO_ATRACOES, DATA_RESGATE, DATA_LIMITE)
       VALUES (?, ?, ?, ?, ?)`,
      [
        cpf,
        TIPO_INGRESSO,
        NUMERO_ATRACOES || 0,
        dataResgate.toISOString(),
        dataLimite ? dataLimite.toISOString() : null
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
          DATA_LIMITE: dataLimite
        });
      }
    );
  } catch (error) {
    console.error("Erro na requisição:", error.message);
    res.status(500).json({ error: "Erro ao processar a requisição." });
  }
});

// Porta
const PORT = process.env.PORT || 8090;
app.listen(PORT, () => {
  console.log(`Serviço de Ingressos rodando na porta ${PORT}`);
});
