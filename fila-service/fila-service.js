const express = require("express");
const sqlite3 = require("sqlite3");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var db = new sqlite3.Database("./dados_fila.db", (err) => {
  if (err) {
    console.log("ERRO: não foi possível conectar ao SQLite.");
    throw err;
  }
  console.log("Conectado ao banco de fila");
});

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

// FUNCIONA
app.post("/Fila", (req, res) => {
  const { id_atracao, pessoas } = req.body;
  db.run(
    `INSERT INTO fila (id_atracao, pessoas) VALUES (?, ?)`,
    [id_atracao, pessoas],
    function (err) {
      if (err) {
        console.error("Erro ao criar fila:", err.message);
        return res.status(500).send("Erro ao criar fila.");
      }
      res.status(201).json({
        message: "Fila criada com sucesso",
        id_atracao,
        pessoas,
      });
    }
  );
});

// FUNCIONA
app.get("/Fila", (req, res) => {
  db.all(`SELECT * FROM fila`, [], (err, rows) => {
    if (err) {
      console.error("Erro ao listar filas:", err.message);
      return res.status(500).send("Erro ao listar filas.");
    }
    res.status(200).json(rows);
  });
});

// FUNCIONA
app.get("/Fila/:id", (req, res) => {
  db.get(
    `SELECT * FROM fila WHERE id_atracao = ?`,
    [req.params.id],
    (err, row) => {
      if (err) {
        console.error("Erro ao consultar fila:", err.message);
        return res.status(500).send("Erro ao consultar fila.");
      }
      if (!row) {
        return res.status(404).send("Fila não encontrada.");
      }
      res.status(200).json(row);
    }
  );
});

// FUNCIONA
app.patch("/Fila/:id", (req, res) => {
  const { pessoas } = req.body;
  db.run(
    `UPDATE fila SET pessoas = COALESCE(?, pessoas) WHERE id_atracao = ?`,
    [pessoas, req.params.id],
    function (err) {
      if (err) {
        console.error("Erro ao atualizar fila:", err.message);
        return res.status(500).send("Erro ao atualizar fila.");
      }
      if (this.changes === 0) {
        return res.status(404).send("Fila não encontrada.");
      }
      res.status(200).send("Fila atualizada com sucesso.");
    }
  );
});

// FUNCIONA
app.delete("/Fila/:id", (req, res) => {
  db.run(
    `DELETE FROM fila WHERE id_atracao = ?`,
    [req.params.id],
    function (err) {
      if (err) {
        console.error("Erro ao remover fila:", err.message);
        return res.status(500).send("Erro ao remover fila.");
      }
      if (this.changes === 0) {
        return res.status(404).send("Fila não encontrada.");
      }
      res.status(200).send("Fila removida com sucesso.");
    }
  );
});

// FUNCIONA
app.post("/Fila/Catraca/:id_ingresso", async (req, res) => {
  try {
    const { id_ingresso } = req.params;
    const { id_atracao } = req.body;

    if (!id_atracao) {
      return res.status(400).send("ID da atração é obrigatório.");
    }

    const filaResp = await axios.get(`http://localhost:8110/Fila/${id_atracao}`);
    const filaAtual = filaResp.data.pessoas ?? 0;

    await axios.patch(`http://localhost:8110/Fila/${id_atracao}`, {
      pessoas: filaAtual + 1,
    });

    const ingressoResp = await axios.patch(
      `http://localhost:8090/Ingresso/usar/${id_ingresso}`
    );

    res.status(200).json({
      message: "Passagem pela catraca registrada.",
      fila_atual: filaAtual + 1,
      ingresso: ingressoResp.data,
    });
  } catch (error) {
    res.status(500).send("Erro ao processar passagem pela catraca.");
  }
});

const PORT = process.env.PORT || 8110;
app.listen(PORT, () => {
  console.log(`Serviço de Filas rodando na porta ${PORT}`);
});
