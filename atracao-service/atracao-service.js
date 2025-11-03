const express = require("express");
const sqlite3 = require("sqlite3");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conecta com o banco SQLite
var db = new sqlite3.Database("./dados_atracoes.db", (err) => {
  if (err) {
    console.log("ERRO: não foi possível conectar ao SQLite.");
    throw err;
  }
  console.log("Conectado ao banco de atrações!");
});

// Cria a tabela, se não existir
db.run(
  `CREATE TABLE IF NOT EXISTS atracao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    capacidade INTEGER NOT NULL,
    tempo_medio INTEGER NOT NULL,
    status INTEGER NOT NULL
  )`,
  [],
  (err) => {
    if (err) throw err;
  }
);

// Cadastrar nova atração FUNCIONA
app.post("/Atracao", (req, res, next) => {
  const status = req.body.status === false ? 0 : 1; // 1 = funcionando, 0 = manutenção

  db.run(
    `INSERT INTO atracao (id, nome, capacidade, tempo_medio, status) VALUES (?, ?, ?, ?, ?)`,
    [
      req.body.id,
      req.body.nome,
      req.body.capacidade,
      req.body.tempo_medio,
      status,
    ],
    (err) => {
      if (err) {
        console.log("Erro: " + err);
        res.status(500).send("Erro ao cadastrar atração.");
      } else {
        console.log("Atração cadastrada com sucesso!");
        res.status(200).send("Atração cadastrada com sucesso!");
      }
    }
  );
});

// Listar todas as atrações FUNCIONA
app.get("/Atracao", (req, res) => {
  db.all(`SELECT * FROM atracao`, [], (err, rows) => {
    if (err) return res.status(500).send("Erro ao listar atrações.");

    // Converter 0/1 em boolean
    const atracoes = rows.map((a) => ({
      ...a,
      status: !!a.status,
    }));

    res.json(atracoes);
  });
});

// Consultar uma atração por ID FUNCIONA
app.get("/Atracao/:id", (req, res) => {
  db.get(`SELECT * FROM atracao WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).send("Erro ao consultar atração.");
    if (!row) return res.status(404).send("Atração não encontrada.");

    // Converter 0/1 em boolean
    row.status = !!row.status;
    res.json(row);
  });
});

// Atualizar dados da atração FUNCIONA
app.patch("/Atracao/:id", (req, res) => {
  const { nome, capacidade, tempo_medio } = req.body;
  const status =
    req.body.status === undefined
      ? undefined
      : req.body.status
      ? 1
      : 0;

  db.run(
    `UPDATE atracao
     SET nome = COALESCE(?, nome),
         capacidade = COALESCE(?, capacidade),
         tempo_medio = COALESCE(?, tempo_medio),
         status = COALESCE(?, status)
     WHERE id = ?`,
    [nome, capacidade, tempo_medio, status, req.params.id],
    function (err) {
      if (err) return res.status(500).send("Erro ao atualizar atração.");
      if (this.changes === 0)
        return res.status(404).send("Atração não encontrada.");
      res.send("Atração atualizada com sucesso!");
    }
  );
});

// Remover atração FUNCIONA
app.delete("/Atracao/:id", (req, res) => {
  db.run(`DELETE FROM atracao WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).send("Erro ao remover atração.");
    if (this.changes === 0)
      return res.status(404).send("Atração não encontrada.");
    res.send("Atração removida com sucesso!");
  });
});

// Servidor ouvindo na porta 8100
app.listen(8100, () => {
  console.log("Serviço de Atrações rodando na porta 8100");
});