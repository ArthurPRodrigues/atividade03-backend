const express = require("express");
const axios = require("axios");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexão com o banco
var db = new sqlite3.Database("./dados_espera.db", (err) => {
  if (err) {
    console.log("ERRO: não foi possível conectar ao SQLite.");
    throw err;
  }
  console.log("Conectado ao banco de tempos de espera!");
});

// Criação da tabela
db.run(
  `CREATE TABLE IF NOT EXISTS espera (
    id_atracao INTEGER PRIMARY KEY,
    nome_atracao TEXT,
    pessoas_fila INTEGER,
    capacidade INTEGER,
    tempo_medio INTEGER,
    tempo_estimado TEXT,
    atualizado_em TEXT
  )`,
  [],
  (err) => {
    if (err) throw err;
  }
);

// Função principal de atualização
async function atualizarTemposDeEspera() {
  try {
    console.log("\nAtualizando tempos de espera...");

    const atracoesResp = await axios.get("http://localhost:8100/Atracao");
    const filasResp = await axios.get("http://localhost:8110/Fila");

    const atracoes = atracoesResp.data;
    const filas = filasResp.data;

    if (!Array.isArray(atracoes) || !Array.isArray(filas)) {
      console.warn("Nenhuma atração ou fila encontrada para atualização.");
      return;
    }

    for (const atracao of atracoes) {
      const fila = filas.find((f) => f.id_atracao === atracao.id);
      if (!fila) {
        console.log(`Atração '${atracao.nome}' ainda não possui fila registrada.`);
        continue;
      }

      const { id, nome, capacidade, tempo_medio, status } = atracao;
      const pessoas = fila.pessoas;
      const atualizadoEm = new Date().toISOString();

      let tempoEstimado;

      if (status === 0) {
        // Atração em manutenção
        tempoEstimado = "Em manutenção";
      } else {
        // --- CÁLCULO DO TEMPO DE ESPERA ---
        // Versão mais realista: desconsidera o grupo atual (usa Math.floor)
        const ciclos = Math.floor(pessoas / capacidade);
        tempoEstimado = `${ciclos * tempo_medio} min`;
      }

      // Atualiza banco
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
            console.error(`Erro ao salvar tempo de espera para '${nome}':`, err.message);
        }
      );

      console.log(
        `[${nome}] | Fila: ${pessoas} pessoas | Capacidade: ${capacidade} | ` +
        `Tempo médio: ${tempo_medio} min | Estimado: ${tempoEstimado}`
      );
    }

    console.log(`Atualização concluída às ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    console.error("Erro ao atualizar tempos de espera:", error.message);
  }
}

// Atualiza automaticamente a cada 30 segundos
setInterval(atualizarTemposDeEspera, 30000);

// Cria a espera
app.post("/Espera", (req, res) => {
  const { id_atracao, nome_atracao, pessoas_fila, capacidade, tempo_medio, tempo_estimado } = req.body;
  const atualizado_em = new Date().toISOString();

  db.run(
    `INSERT INTO espera (id_atracao, nome_atracao, pessoas_fila, capacidade, tempo_medio, tempo_estimado, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id_atracao, nome_atracao, pessoas_fila, capacidade, tempo_medio, tempo_estimado, atualizado_em],
    (err) => {
      if (err) return res.status(500).send("Erro ao criar registro de espera.");
      res.status(201).send("Tempo de espera criado com sucesso!");
    }
  );
});

// Consultar espera de todas as atrações
app.get("/Espera", (req, res) => {
  db.all(`SELECT * FROM espera`, [], (err, rows) => {
    if (err) return res.status(500).send("Erro ao consultar tempos de espera.");
    res.json(rows);
  });
});

// Consultar espera de uma atração
app.get("/Espera/:id_atracao", (req, res) => {
  db.get(`SELECT * FROM espera WHERE id_atracao = ?`, [req.params.id_atracao], (err, row) => {
    if (err) return res.status(500).send("Erro ao consultar tempo de espera.");
    if (!row) return res.status(404).send("Atração não encontrada.");
    res.json(row);
  });
});

// Atualiza uma atração
app.patch("/Espera/:id_atracao", (req, res) => {
  const { nome_atracao, pessoas_fila, capacidade, tempo_medio, tempo_estimado } = req.body;
  const atualizado_em = new Date().toISOString();

  db.run(
    `UPDATE espera
     SET nome_atracao = COALESCE(?, nome_atracao),
         pessoas_fila = COALESCE(?, pessoas_fila),
         capacidade = COALESCE(?, capacidade),
         tempo_medio = COALESCE(?, tempo_medio),
         tempo_estimado = COALESCE(?, tempo_estimado),
         atualizado_em = ?
     WHERE id_atracao = ?`,
    [nome_atracao, pessoas_fila, capacidade, tempo_medio, tempo_estimado, atualizado_em, req.params.id_atracao],
    function (err) {
      if (err) return res.status(500).send("Erro ao atualizar tempo de espera.");
      if (this.changes === 0) return res.status(404).send("Atração não encontrada.");
      res.send("Tempo de espera atualizado com sucesso!");
    }
  );
});

// DELETA espera COM PROBLEMA
app.delete("/Espera/:id_atracao", (req, res) => {
  const id = Number(req.params.id_atracao);

  console.log(`🗑️ Tentando deletar espera com id_atracao = ${id}`);

  db.run(`DELETE FROM espera WHERE id_atracao = ?`, [id], function (err) {
    if (err) {
      console.error("Erro ao excluir tempo de espera:", err.message);
      return res.status(500).send("Erro ao excluir tempo de espera.");
    }

    if (this.changes === 0) {
      console.log(`❌ Nenhum registro encontrado com id_atracao = ${id}`);
      return res.status(404).send("Registro não encontrado.");
    }

    console.log(`✅ Tempo de espera excluído com sucesso! (id: ${id})`);
    res.send("Tempo de espera excluído com sucesso!");
  });
});


// Inicialização
app.listen(8120, () => {
  console.log("Estimador de Espera rodando na porta 8120");
  atualizarTemposDeEspera();
});
