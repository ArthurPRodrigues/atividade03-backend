const { spawn } = require("child_process");

const services = [
  {
    name: "Cadastro de Usuários",
    script: "./cadastro-service/cadastro-service.js",
  },
  {
    name: "Controle de Ingressos",
    script: "./ingresso-service/ingresso-service.js",
  },
  {
    name: "Cadastro de Atrações",
    script: "./atracao-service/atracao-service.js",
  },
  { name: "Controle de Filas", script: "./fila-service/fila-service.js" },
  { name: "Controle de Acessos", script: "./acesso-service/acesso-service.js" },
  { name: "API Gateway", script: "./api-gateway/api-gateway.js" },
];

services.forEach((service) => {
  const proc = spawn("node", [service.script], { stdio: "inherit" });

  proc.on("spawn", () => {
    console.log(`${service.name} iniciado`);
  });

  proc.on("close", (code) => {
    console.log(`${service.name} terminou com código ${code}`);
  });

  proc.on("error", (err) => {
    console.error(`Erro ao iniciar ${service.name}:`, err);
  });
});
