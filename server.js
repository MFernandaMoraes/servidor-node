// Importar o módulo nativo 'http' do Node.js
const http = require('http');

// Define o endereço (localhost - minha máquina local) e a porta onde o servidor vai escutar
const hostname = '127.0.0.1';
const port = 3000;

// Cria o servidor web
const server = http.createServer( (req, res) => {

    // Define o status http como 200 (OK) e o tipo de conteúdo como texto plano em UTF-8
    res.writeHead(200, {'content-type': 'UTF-8'});

    // Envia a resposta para o navegador/cliente
    res.end('Olá alunos! O servidor Node.js está rodando com suscesso!');

}); 

// Faz o servidor começar a escutar na porta definida
server.listen(port, hostname, () => {
    console.log(`Servidor rodando em http://${hostname}:${port}/`)
});