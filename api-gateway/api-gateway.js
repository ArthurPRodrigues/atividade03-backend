const httpProxy = require("express-http-proxy");
const express = require("express");
const app = express();
var logger = require("morgan");

app.use(logger("dev"));

function selectProxyHost(req) {
  if (req.path.startsWith("/Cadastro")) return "http://localhost:8080/";
  else if (req.path.startsWith("/Ingresso")) return "http://localhost:8090/";
  else if (req.path.startsWith("/Atracao")) return "http://localhost:8100/";
  else if (req.path.startsWith("/Fila")) return "http://localhost:8110/";
  else if (req.path.startsWith("/Acesso")) return "http://localhost:8120/";
  else return null;
}

app.use((req, res, next) => {
  var proxyHost = selectProxyHost(req);
  if (proxyHost == null) res.status(404).send("Not found");
  else httpProxy(proxyHost)(req, res, next);
});

app.listen(8000, () => {
  console.log("API Gateway iniciado!");
});
