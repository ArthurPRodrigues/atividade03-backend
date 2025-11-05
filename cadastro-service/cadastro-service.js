const sqlite3 = require("sqlite3");
const express = require("express");

const app = express();
const axios = require("axios");

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Precisa disso aqui pra ler o postman com a tabelinha que o Adan gosta de usar

var db = new sqlite3.Database("./dados_cadastro.db", (err) => {
  if (err) {
    console.log("ERRO: não foi possível conectar ao SQLite.");
    throw err;
  }
  console.log("Conectado ao SQLite!");
});

db.run(
  `CREATE TABLE IF NOT EXISTS cadastro 
    (nome TEXT NOT NULL, 
     email TEXT NOT NULL, 
     cpf INTEGER PRIMARY KEY NOT NULL UNIQUE,
     telefone TEXT NOT NULL
    )`,
  [],
  (err) => {
    if (err) {
      console.log("ERRO: não foi possível criar tabela.");
      throw err;
    }
  }
);

// Cadastra um novo cliente FUNCIONA
app.post("/Cadastro", (req, res, next) => {
  db.run(
    `INSERT INTO cadastro (nome, email, cpf, telefone) VALUES (?, ?, ?, ?)`,
    [req.body.nome, req.body.email, req.body.cpf, req.body.telefone],
    (err) => {
      if (err) {
        console.log("Erro: " + err);
        res.status(500).send("Erro ao cadastrar cliente.");
      } else {
        console.log("Cliente cadastrado");
        res.status(200).send("Cliente cadastrado");
      }
    }
  );
});

// Retorna todos os clientes FUNCIONA
app.get("/Cadastro", (req, res, next) => {
  db.all(`SELECT * FROM cadastro`, [], (err, result) => {
    if (err) {
      console.log("Erro: " + err);
      res.status(500).send("Erro ao obter dados");
    } else {
      res.status(200).json(result);
    }
  });
});

// Retorna o cadastro de um cliente FUNCIONA
app.get("/Cadastro/:cpf", (req, res, next) => {
  db.get(
    `SELECT * FROM cadastro WHERE cpf = ?`,
    req.params.cpf,
    (err, result) => {
      if (result == null) {
        console.log("Cliente não encontrado");
        res.status(404).send("Cliente não encontrado");
      } else {
        res.status(200).json(result);
      }
    }
  );
});

// Altera o cadastro de um cliente FUNCIONA
app.patch("/Cadastro/:cpf", (req, res, next) => {
  db.run(
    `UPDATE cadastro 
     SET nome = COALESCE(?, nome), 
         email = COALESCE(?, email),
         telefone = COALESCE(?, telefone) 
     WHERE cpf = ?`,
    [req.body.nome, req.body.email, req.body.telefone, req.params.cpf],
    function (err) {
      if (err) {
        res.status(500).send("Erro ao alterar dados");
      } else if (this.changes == 0) {
        console.log("Cliente não encontrado");
        res.status(404).send("Cliente não encontrado");
      } else {
        res.status(200).send("Cliente alterado");
      }
    }
  );
});

// Deleta um cliente do cadastro FUNCIONA
app.delete("/Cadastro/:cpf", (req, res, next) => {
  db.run(`DELETE FROM cadastro WHERE cpf = ?`, req.params.cpf, function (err) {
    if (err) {
      res.status(500).send("Erro ao remover cliente");
    } else if (this.changes == 0) {
      console.log("Cliente não encontrado");
      res.status(404).send("Cliente não encontrado");
    } else {
      res.status(200).send("Cliente removido");
    }
  });
});

app.listen(8080, () => {
  console.log("Cadastro rodando na porta 8080");
});
