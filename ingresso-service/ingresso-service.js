const sqlite3 = require("sqlite3");
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Acessa o arquivo com o banco de dados
var db = new sqlite3.Database("./dados_ingressos.db", (err) => {
  if (err) {
    console.log("ERRO: não foi possível conectar ao SQLite.");
    throw err;
  }
  console.log("Conectado ao SQLite!");
});

// Cria a tabela ingresso
db.run(
  `CREATE TABLE IF NOT EXISTS ingresso 
    (ID INTEGER PRIMARY KEY NOT NULL UNIQUE,
    CPF INTEGER NOT NULL,
    TIPO_INGRESSO TEXT NOT NULL,
    NUMERO_ATRACOES INTEGER NOT NULL,
    DATA_RESGATE DATE NOT NULL UNIQUE,
    DATA_LIMITE DATE NOT NULL UNIQUE)`,
  [],
  (err) => {
    if (err) {
      console.log("ERRO: não foi possível criar tabela.");
      throw err;
    }
  }
);

// Método HTTP POST /Ingresso - cadastra um novo ingresso
app.post("/Ingresso", async (req, res) => {
  try {
    const cpf = req.body.CPF;
    const response = await axios.get(`http://localhost:8080/Cadastro/${cpf}`);
    const user = response.data;
    const tipo_ingresso = req.body.TIPO_INGRESSO;

    if (tipo_ingresso === "Day pass") {
      data_resgate = now(data_resgate);
      data_limite.setHours(data_limite.getHours() + 24);
    } else if (tipo_ingresso === "Full pass") {
      data_limite = null;
    }

    if (user) {
      db.run(
        `INSERT INTO ingresso (ID, CPF, TIPO_INGRESSO, NUMERO_ATRACOES, DATA_RESGATE, DATA_LIMITE) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.body.ID,
          cpf,
          tipo_ingresso,
          numero_atracoes,
          data_resgate.toISOString(),
          data_limite ? data_limite.toISOString() : null,
        ],
        (err) => {
          if (err) {
            console.log("Erro: " + err);
            return res.status(500).send("Erro ao cadastrar ingresso.");
          }
          res.status(201).json({
            message: "Ingresso cadastrado com sucesso",
            data_limite: data_limite ? data_limite.toISOString() : null,
          });
        }
      );
    } else {
      res.status(404).json({ error: "Usuário não encontrado" });
    }
  } catch (error) {
    console.error("Erro na requisição:", error);
    res.status(500).json({ error: "Erro ao processar a requisição" });
  }
});

// Inicia o servidor na porta 8090
const PORT = process.env.PORT || 8090;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
