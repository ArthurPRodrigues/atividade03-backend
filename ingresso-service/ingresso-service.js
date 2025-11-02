const sqlite3 = require("sqlite3");
const express = require("express");

const app = express();
app.use(express.json());
const axios = require("axios");

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
    DATA_RESGATE DATE NOT NULL UNIQUE)`,
  [],
  (err) => {
    if (err) {
      console.log("ERRO: não foi possível criar tabela.");
      throw err;
    }
  }
);

// Método HTTP POST /Ingresso - cadastra um novo ingresso
app.post("/Ingresso", (req, res, next) => {
  const cpf = req.body.CPF;
  const user = axios.get(`http://localhost:8080/Cadastro/${cpf}`);
  if (user !== null && user !== undefined) {
    db.run(
      `INSERT INTO ingresso (ID, TIPO_INGRESSO, CPF, NUMERO_ATRACOES, DATA_RESGATE) VALUES (?, ?, ?, ?, ?)`,
      [
        req.body.ID,
        req.body.TIPO_INGRESSO,
        req.body.CPF,
        req.body.NUMERO_ATRACOES,
        req.body.DATA_RESGATE,
      ],
      (err) => {
        if (err) {
          console.log("Erro: " + err);
          res.status(500).send("Erro ao cadastrar ingresso.");
        }
      }
    );
  }
});
