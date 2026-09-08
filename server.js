// Importa o módulo nativo 'http' do Node.js
const http = require('http');
const mysql = require('mysql2');

// 1. Configura a conexão com o MySQL
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'petshoppessego'
});

// Conecta ao banco de dados
connection.connect((err) => {
    if(err){
        console.error('Erro ao conectar ao MySQL: ', err.stack);
        return;
    }

    console.log('Conectado ao MySQL com sucesso!');
});

// Define o endereço (localhost) e a porta onde o servidor vai escutar
const hostname = '127.0.0.1';
const port = 3000;

// Cria o servidor web
const server = http.createServer((req, res) => {

    if (req.url === '/') {
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        return res.end('<h1>Página Inicial</h1>'); // O return impede a execução  das linhas seguintes
    }

    if (req.url === '/alunos') {
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        return res.end('<h1>Lista de alunos </h1>');
    }

    // Se nenhuma rota acima for satisfeita, cai no 404
    res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
    
    // Envia a resposta para o navegador/cliente
    res.end('<h1 style="color: red;">404 - rota não encontrada</h1>');

});

// Faz o servidor começar a escutar na porta definida
server.listen(port, hostname, () => {
  console.log(`Servidor rodando em http://${hostname}:${port}/`);
});