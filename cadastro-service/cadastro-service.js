// Importa o package do SQLite
const sqlite3 = require("sqlite3");
const express = require("express");

const app = express();
app.use(express.json());
const axios = require("axios");

app.use(express.json()); // Para analisar corpos de requisições JSON
app.use(express.urlencoded({ extended: true }));

// Acessa o arquivo com o banco de dados
var db = new sqlite3.Database("./dados_cadastro.db", (err) => {
  if (err) {
    console.log("ERRO: não foi possível conectar ao SQLite.");
    throw err;
  }
  console.log("Conectado ao SQLite!");
});

// Cria a tabela cadastro, caso ela não exista
db.run(
  `CREATE TABLE IF NOT EXISTS cadastro 
    (nome TEXT NOT NULL, 
     email TEXT NOT NULL, 
     cpf INTEGER PRIMARY KEY NOT NULL UNIQUE)`,
  [],
  (err) => {
    if (err) {
      console.log("ERRO: não foi possível criar tabela.");
      throw err;
    }
  }
);

// Método HTTP POST /Cadastro - cadastra um novo cliente FUNCIONA
app.post("/Cadastro", (req, res, next) => {
  db.run(
    `INSERT INTO cadastro (nome, email, cpf) VALUES (?, ?, ?)`,
    [req.body.nome, req.body.email, req.body.cpf],
    (err) => {
      if (err) {
        console.log("Erro: " + err);
        res.status(500).send("Erro ao cadastrar cliente.");
      } else {
        const cpf = req.body.cpf;
        console.log("Cliente cadastrado com sucesso!");
        res.status(200).send("Cliente cadastrado com sucesso!");
      }
    }
  );
});

// Método HTTP GET /Cadastro - retorna todos os clientes FUNCIONA
app.get("/Cadastro", (req, res, next) => {
  db.all(`SELECT * FROM cadastro`, [], (err, result) => {
    if (err) {
      console.log("Erro: " + err);
      res.status(500).send("Erro ao obter dados.");
    } else {
      res.status(200).json(result);
    }
  });
});

// Método HTTP GET /Cadastro/:cpf - retorna o cadastro de um cliente FUNCIONA
app.get("/Cadastro/:cpf", (req, res, next) => {
  db.get(
    `SELECT * FROM cadastro WHERE cpf = ?`,
    req.params.cpf,
    (err, result) => {
      if (result == null) {
        console.log("Cliente não encontrado.");
        res.status(404).send("Cliente não encontrado.");
      } else {
        res.status(200).json(result);
      }
    }
  );
});

// Método HTTP PATCH /Cadastro/:cpf - altera o cadastro de um cliente FUNCIONA
app.patch("/Cadastro/:cpf", (req, res, next) => {
  db.run(
    `UPDATE cadastro 
     SET nome = COALESCE(?, nome), 
         email = COALESCE(?, email) 
     WHERE cpf = ?`,
    [req.body.nome, req.body.email, req.params.cpf],
    function (err) {
      if (err) {
        res.status(500).send("Erro ao alterar dados.");
      } else if (this.changes == 0) {
        console.log("Cliente não encontrado.");
        res.status(404).send("Cliente não encontrado.");
      } else {
        res.status(200).send("Cliente alterado com sucesso!");
      }
    }
  );
});

// Método HTTP DELETE /Cadastro/:cpf - remove um cliente do cadastro FUNCIONA
app.delete("/Cadastro/:cpf", (req, res, next) => {
  db.run(`DELETE FROM cadastro WHERE cpf = ?`, req.params.cpf, function (err) {
    if (err) {
      res.status(500).send("Erro ao remover cliente.");
    } else if (this.changes == 0) {
      console.log("Cliente não encontrado.");
      res.status(404).send("Cliente não encontrado.");
    } else {
      res.status(200).send("Cliente removido com sucesso!");
    }
  });
});

app.listen(8080, () => {
  console.log("Servidor rodando na porta 8080");
});
