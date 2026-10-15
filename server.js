const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const port = 3000;

// Use o cors
app.use(cors());

// Middleware para o Express entender JSON no corpo da requisição (req.body)
app.use(express.json());

// 1. Configura a conexão com o MySQL
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'auraBoutique'
});

// Conecta ao banco de dados
connection.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao MySQL: ', err.stack);
        return;
    }
    console.log('Conectado ao MySQL com sucesso!');

    // Queries de criação — agora em um array, cada uma executada separadamente
    const createQueries = [
        `CREATE TABLE IF NOT EXISTS estilo (
            id_estilo INT AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(50) NOT NULL UNIQUE
        )`,

        `CREATE TABLE IF NOT EXISTS cliente (
            id_cliente INT AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            telefone VARCHAR(20) NOT NULL,
            senha VARCHAR(255) NOT NULL,
            id_loja INT DEFAULT 1,
            id_estilo_preferido INT NULL,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS cliente_estilo (
            id_cliente INT NOT NULL,
            id_estilo INT NOT NULL,
            PRIMARY KEY (id_cliente, id_estilo),
            FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE CASCADE,
            FOREIGN KEY (id_estilo) REFERENCES estilo(id_estilo) ON DELETE CASCADE
        )`,

        `INSERT IGNORE INTO estilo (nome) VALUES
            ('streetwear'), ('alt'), ('classico'), ('boho')`
    ];

    createQueries.forEach((query) => {
        connection.query(query, (err) => {
            if (err) {
                console.error('Erro ao criar tabela: ', err.stack);
            }
        });
    });
});

/* =========================================================
   CADASTRO — POST /cadastro
   ========================================================= */
app.post('/cadastro', async (req, res) => {
    const { nome, email, telefone, senha, estilos, estiloPrincipal } = req.body;

    if (!nome || !email || !telefone || !senha) {
        return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
    }

    try {
        const senhaHash = await bcrypt.hash(senha, 10);

        // Busca id do estilo principal
        let idEstiloPreferido = null;
        if (estiloPrincipal) {
            const [rows] = await connection.promise().query(
                'SELECT id_estilo FROM estilo WHERE nome = ?',
                [estiloPrincipal]
            );
            if (rows.length) idEstiloPreferido = rows[0].id_estilo;
        }

        // Insere cliente
        const [result] = await connection.promise().query(
            `INSERT INTO cliente (nome, email, telefone, senha, id_estilo_preferido)
             VALUES (?, ?, ?, ?, ?)`,
            [nome, email, telefone, senhaHash, idEstiloPreferido]
        );

        const idCliente = result.insertId;

        // Insere estilos escolhidos (N:N)
        if (Array.isArray(estilos) && estilos.length) {
            const placeholders = estilos
                .map(() => '(?, (SELECT id_estilo FROM estilo WHERE nome = ?))')
                .join(',');
            const values = [];
            estilos.forEach(e => values.push(idCliente, e));

            await connection.promise().query(
                `INSERT IGNORE INTO cliente_estilo (id_cliente, id_estilo) VALUES ${placeholders}`,
                values
            );
        }

        return res.status(201).json({
            mensagem: 'Cadastro realizado com sucesso!',
            id_cliente: idCliente
        });

    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ erro: 'E-mail já cadastrado.' });
        }
        return res.status(500).json({ erro: 'Erro no servidor ao cadastrar.' });
    }
});

/* =========================================================
   LOGIN — POST /login
   ========================================================= */
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: 'Informe e-mail e senha.' });
    }

    try {
        const [rows] = await connection.promise().query(
            'SELECT id_cliente, nome, email, senha FROM cliente WHERE email = ?',
            [email]
        );

        if (!rows.length) {
            return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
        }

        const cliente = rows[0];
        const senhaOk = await bcrypt.compare(senha, cliente.senha);

        if (!senhaOk) {
            return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
        }

        return res.json({
            mensagem: 'Login realizado com sucesso!',
            cliente: {
                id: cliente.id_cliente,
                nome: cliente.nome,
                email: cliente.email
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro no servidor ao fazer login.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}/`);
});