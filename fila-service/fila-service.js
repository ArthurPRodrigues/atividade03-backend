const express = require("express");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());

// Conexão com o banco de dados
var db = new sqlite3.Database("./dados_filas.db", (err) => {
  if (err) {
    console.log("ERRO: não foi possível conectar ao SQLite.");
    throw err;
  }
  console.log("Conectado ao banco de filas!");
});

// Criação da tabela
db.run(
  `CREATE TABLE IF NOT EXISTS fila (
    id_atracao INTEGER PRIMARY KEY,
    pessoas INTEGER NOT NULL
  )`,
  [],
  (err) => {
    if (err) throw err;
  }
);

// Criar nova fila (inicialmente com 0 pessoas)
app.post("/Fila", (req, res) => {
  const { id_atracao, pessoas } = req.body;
  db.run(
    `INSERT INTO fila (id_atracao, pessoas) VALUES (?, ?)`,
    [id_atracao, pessoas || 0],
    (err) => {
      if (err) return res.status(500).send("Erro ao criar fila.");
      res.status(201).send("Fila criada com sucesso!");
    }
  );
});

// Atualizar número de pessoas (incrementar/decrementar)
app.patch("/Fila/:id_atracao", (req, res) => {
  const { pessoas } = req.body;
  db.run(
    `UPDATE fila SET pessoas = ? WHERE id_atracao = ?`,
    [pessoas, req.params.id_atracao],
    function (err) {
      if (err) return res.status(500).send("Erro ao atualizar fila.");
      if (this.changes === 0)
        return res.status(404).send("Fila não encontrada.");
      res.send("Fila atualizada com sucesso!");
    }
  );
});

// Obter número de pessoas de uma fila
app.get("/Fila/:id_atracao", (req, res) => {
  db.get(
    `SELECT * FROM fila WHERE id_atracao = ?`,
    [req.params.id_atracao],
    (err, row) => {
      if (err) return res.status(500).send("Erro ao consultar fila.");
      if (!row) return res.status(404).send("Fila não encontrada.");
      res.json(row);
    }
  );
});

// Listar todas as filas
app.get("/Fila", (req, res) => {
  db.all(`SELECT * FROM fila`, [], (err, rows) => {
    if (err) return res.status(500).send("Erro ao listar filas.");
    res.json(rows);
  });
});

// Iniciar servidor
app.listen(8110, () => {
  console.log("Serviço de Filas rodando na porta 8110");
});
