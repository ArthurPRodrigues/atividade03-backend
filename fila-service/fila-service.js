const express = require("express");
const sqlite3 = require("sqlite3");

const axios = require("axios");
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Criar nova fila (inicialmente com 0 pessoas) FUNCIONA
app.post("/Fila", async (req, res) => {
  const { id_atracao, pessoas } = req.body;

  db.run(
    `INSERT INTO fila (id_atracao, pessoas) VALUES (?, ?)`,
    [id_atracao, pessoas || 0],
    async (err) => {
      if (err) {
        console.error("Erro ao criar fila:", err.message);
        return res.status(500).send("Erro ao criar fila.");
      }

      console.log(`Fila criada com sucesso para atração ${id_atracao}.`);

      try {
        // passa atracao para true caso seja false
        await axios.patch(`http://localhost:8100/Atracao/${id_atracao}`, { status: true });
        console.log(`Atração ${id_atracao} ativada com sucesso.`);

        const atracaoResp = await axios.get(`http://localhost:8100/Atracao/${id_atracao}`);
        const atracao = atracaoResp.data;

        // Faz um post pra criar a espera
        await axios.post(`http://localhost:8120/Espera`, {
          id_atracao: atracao.id,
          nome_atracao: atracao.nome,
          pessoas_fila: pessoas || 0,
          capacidade: atracao.capacidade,
          tempo_medio: atracao.tempo_medio,
          tempo_estimado: "Calculando..."
        });

        console.log(`Tempo de espera inicial criado para ${atracao.nome}.`);
      } catch (error) {
        console.warn("Aviso: falha ao atualizar atração ou espera:", error.message);
      }

      res.status(201).send("Fila criada, atração ativada e espera inicial registrada!");
    }
  );
});

// Atualizar número de pessoas (incrementar/decrementar) FUNCIONA
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

// Obter número de pessoas de uma fila FUNCIONA
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

// Listar todas as filas FUNCIONA
app.get("/Fila", (req, res) => {
  db.all(`SELECT * FROM fila`, [], (err, rows) => {
    if (err) return res.status(500).send("Erro ao listar filas.");
    res.json(rows);
  });
});


// Deleta fila FUNCIONA
app.delete("/Fila/:id_atracao", async (req, res) => {
  const id = Number(req.params.id_atracao); // 🔹 conversão explícita

  db.run(`DELETE FROM fila WHERE id_atracao = ?`, [id], async function (err) {
    if (err) {
      console.error("Erro ao remover fila:", err.message);
      return res.status(500).send("Erro ao remover fila.");
    }

    if (this.changes === 0) {
      console.log(`Fila com id_atracao ${id} não encontrada.`);
      return res.status(404).send("Fila não encontrada.");
    }

    console.log(`Fila ${id} removida com sucesso!`);

    try {
      // Coloca atração em manutenção
      await axios.patch(`http://localhost:8100/Atracao/${id}`, { status: false });

      // Deleta espera correspondente
      console.log(`Tentando deletar tempo de espera da atração ${id}...`);
      const resp = await axios.delete(`http://localhost:8120/Espera/${id}`);
      console.log(`Resposta do serviço de espera: ${resp.status} ${resp.statusText}`);

      console.log(`Atração ${id} colocada em manutenção e espera removida.`);
    } catch (error) {
      if (error.response) {
        console.warn(
          `Erro ao deletar espera: ${error.response.status} ${error.response.statusText} - ${error.response.data}`
        );
      } else {
        console.warn("Erro ao contatar serviço de espera:", error.message);
      }
    }

    res.status(200).send("Fila removida, atração em manutenção e espera excluída!");
  });
});


// Iniciar servidor
app.listen(8110, () => {
  console.log("Serviço de Filas rodando na porta 8110");
});
