const express = require("express");
const sqlite3 = require("sqlite3");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var db = new sqlite3.Database("./dados_atracoes.db", (err) => {
  if (err) {
    console.log("ERRO: não foi possível conectar ao SQLite.");
    throw err;
  }
  console.log("Banco conectado");
});

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

// Cadastrar nova atração + fila + espera
app.post("/Atracao", async (req, res) => {
  try {
    const status = req.body.status === false ? 0 : 1; // 1 = É funcionado, 0 = é em manutenção

    db.run(
      `INSERT INTO atracao (id, nome, capacidade, tempo_medio, status) VALUES (?, ?, ?, ?, ?)`,
      [
        req.body.id,
        req.body.nome,
        req.body.capacidade,
        req.body.tempo_medio,
        status,
      ],
      async (err) => {
        if (err) {
          return res.status(500).send("Erro na hora de cadastrar atração");
        }

        // Cria fila +espera
        try {
          const filaResponse = await axios.post("http://localhost:8110/Fila", {
            id_atracao: req.body.id,
            pessoas: 0,
          });

          const esperaResponse = await axios.post(
            "http://localhost:8120/Espera",
            {
              id_atracao: req.body.id,
              nome_atracao: req.body.nome,
              pessoas_fila: 0,
              capacidade: req.body.capacidade,
              tempo_medio: req.body.tempo_medio,
              tempo_estimado: "Calculando...",
            }
          );

          return res.status(201).json({
            atracao: {
              id: req.body.id,
              nome: req.body.nome,
              capacidade: req.body.capacidade,
              tempo_medio: req.body.tempo_medio,
              status,
            },
            fila: filaResponse.data,
            espera: esperaResponse.data,
          });
        } catch (subErr) {
          console.error(
            "Erro na hora de criar fila ou espera da atração:",
            subErr.message
          );
          return res.status(201).json({
            message:
              "Atração ok, checar criar fila e/ou espera.",
          });
        }
      }
    );
  } catch (error) {
    console.error("Erro na requisição:", error.message);
    res.status(500).send("Erro ao processar cadastro da atração.");
  }
});

// Listar todas as atrações FUNCIONA
app.get("/Atracao", (req, res) => {
  db.all(`SELECT * FROM atracao`, [], (err, rows) => {
    if (err) return res.status(500).send("Erro ao listar atrações.");

    const atracoes = rows.map((a) => ({
      ...a,
      status: !!a.status,
    }));

    res.json(atracoes);
  });
});

// Consultar atraçao com ID FUNCIONA
app.get("/Atracao/:id", (req, res) => {
  db.get(`SELECT * FROM atracao WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).send("Erro ao consultar atração.");
    if (!row) return res.status(404).send("Atração não encontrada.");

    row.status = !!row.status;
    res.json(row);
  });
});

// Atualizar dados da atração FUNCIONA
app.patch("/Atracao/:id", (req, res) => {
  const { nome, capacidade, tempo_medio } = req.body;

  let status;
  if (req.body.status !== undefined) {
    if (
      req.body.status === true ||
      req.body.status === "true" ||
      req.body.status === 1 ||
      req.body.status === "1"
    ) {
      status = 1;
    } else if (
      req.body.status === false ||
      req.body.status === "false" ||
      req.body.status === 0 ||
      req.body.status === "0"
    ) {
      status = 0;
    } else {
      status = undefined;
    }
  }

  db.run(
    `UPDATE atracao
     SET nome = COALESCE(?, nome),
         capacidade = COALESCE(?, capacidade),
         tempo_medio = COALESCE(?, tempo_medio),
         status = COALESCE(?, status)
     WHERE id = ?`,
    [nome, capacidade, tempo_medio, status, req.params.id],
    function (err) {
      if (err) return res.status(500).send("Erro no patch da atração.");
      if (this.changes === 0)
        return res.status(404).send("Atração não encontrada.");
      res.send("Atração patch ok");
    }
  );
});

// Deletar espera, fila e atração NESSA ORDEM!!!
app.delete("/Atracao/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Deleta a espera
    try {
      await axios.delete(`http://localhost:8120/Espera/${id}`);
    } catch (esperaErr) {
      console.warn(
        `Não removeu a espera da atração ${id} - ${esperaErr.message}`
      );
    }

    // Deleta a fila
    try {
      await axios.delete(`http://localhost:8110/Fila/${id}`);
    } catch (filaErr) {
      console.warn(
        `Não removeu a fila da atração ${id} - ${filaErr.message}`
      );
    }

    // Remove a atração local
    db.run(`DELETE FROM atracao WHERE id = ?`, [id], function (err) {
      if (err) {
        console.error("Erro ao remover atração:", err.message);
        return res.status(500).send("Erro ao remover atração.");
      }

      if (this.changes === 0) {
        return res.status(404).send("Atração não encontrada.");
      }

      console.log(`Atração ${id} e seus registros associados foram removidos.`);
      res.status(200).send("Atração, fila e espera removidas com sucesso!");
    });
  } catch (error) {
    console.error("Erro ao excluir atração:", error.message);
    res.status(500).send("Erro ao excluir atração:");
  }
});

// Servidor ouvindo na porta 8100
app.listen(8100, () => {
  console.log("Atracao rodando na porta 8100");
});
