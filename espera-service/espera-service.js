const express = require("express");
const axios = require("axios");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Banco de dados para armazenar estimativas de espera
var db = new sqlite3.Database("./dados_espera.db", (err) => {
  if (err) {
    console.log("❌ ERRO: não foi possível conectar ao SQLite.");
    throw err;
  }
  console.log("✅ Conectado ao banco de tempos de espera!");
});

// Criação da tabela
db.run(
  `CREATE TABLE IF NOT EXISTS espera (
    id_atracao INTEGER PRIMARY KEY,
    nome_atracao TEXT,
    pessoas_fila INTEGER,
    capacidade INTEGER,
    tempo_medio INTEGER,
    tempo_estimado INTEGER,
    atualizado_em TEXT
  )`,
  [],
  (err) => {
    if (err) throw err;
  }
);

// Função principal: calcular e salvar tempos de espera
async function atualizarTemposDeEspera() {
  try {
    console.log("\n🔄 Atualizando tempos de espera...");

    // Consulta microserviços
    const atracoesResp = await axios.get("http://localhost:8100/Atracao");
    const filasResp = await axios.get("http://localhost:8110/Fila");

    const atracoes = atracoesResp.data;
    const filas = filasResp.data;

    if (!Array.isArray(atracoes) || !Array.isArray(filas)) {
      console.warn("⚠️ Nenhuma atração ou fila encontrada para atualização.");
      return;
    }

    for (const atracao of atracoes) {
      const fila = filas.find((f) => f.id_atracao === atracao.id);
      if (!fila) {
        console.log(`⚠️ Atração '${atracao.nome}' ainda não possui fila registrada.`);
        continue;
      }

      const { id, nome, capacidade, tempo_medio } = atracao;
      const pessoas = fila.pessoas;

      const tempoEstimado = Math.ceil((pessoas / capacidade) * tempo_medio);
      const atualizadoEm = new Date().toISOString();

      // Salva/atualiza no banco
      db.run(
        `INSERT INTO espera (id_atracao, nome_atracao, pessoas_fila, capacidade, tempo_medio, tempo_estimado, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id_atracao) DO UPDATE SET
            nome_atracao = excluded.nome_atracao,
            pessoas_fila = excluded.pessoas_fila,
            capacidade = excluded.capacidade,
            tempo_medio = excluded.tempo_medio,
            tempo_estimado = excluded.tempo_estimado,
            atualizado_em = excluded.atualizado_em`,
        [id, nome, pessoas, capacidade, tempo_medio, tempoEstimado, atualizadoEm],
        (err) => {
          if (err)
            console.error(
              `❌ Erro ao salvar tempo de espera para '${nome}':`,
              err.message
            );
        }
      );

      // Log detalhado de cada atração
      console.log(
        `🕹️ [${nome}] | Fila: ${pessoas} pessoas | Capacidade: ${capacidade} | ` +
          `Tempo médio: ${tempo_medio} min | ⏱️ Estimado: ${tempoEstimado} min`
      );
    }

    console.log(`✅ Atualização concluída às ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    console.error("❌ Erro ao atualizar tempos de espera:", error.message);
  }
}

// Atualiza automaticamente a cada 30 segundos
setInterval(atualizarTemposDeEspera, 30000);

// Permite atualizar manualmente (via Postman)
app.post("/Espera/atualizar", async (req, res) => {
  await atualizarTemposDeEspera();
  res.send("Tempos de espera recalculados manualmente!");
});

// Consultar todos os tempos salvos
app.get("/Espera", (req, res) => {
  db.all(`SELECT * FROM espera`, [], (err, rows) => {
    if (err) return res.status(500).send("Erro ao consultar tempos de espera.");
    res.json(rows);
  });
});

// Consultar tempo de espera de uma atração específica
app.get("/Espera/:id_atracao", (req, res) => {
  db.get(
    `SELECT * FROM espera WHERE id_atracao = ?`,
    [req.params.id_atracao],
    (err, row) => {
      if (err) return res.status(500).send("Erro ao consultar tempo de espera.");
      if (!row) return res.status(404).send("Atração não encontrada.");
      res.json(row);
    }
  );
});

// Inicia o servidor e faz a primeira atualização imediata
app.listen(8120, () => {
  console.log("Estimador de Espera rodando na porta 8120");
  atualizarTemposDeEspera(); // primeira execução automática
});
