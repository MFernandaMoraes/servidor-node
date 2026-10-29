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

        `ALTER TABLE cliente ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0`,

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
            ('streetwear'), ('alt'), ('classico'), ('boho')`,

        `CREATE TABLE IF NOT EXISTS colecao (
            id_colecao INT AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(120) NOT NULL,
            temporada VARCHAR(80) NOT NULL,
            data_inicio DATE NOT NULL,
            data_fim DATE NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'Em preparação',
            descricao TEXT NULL,
            herdou_de VARCHAR(120) NULL,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS estilo_diretriz (
            id_diretriz INT AUTO_INCREMENT PRIMARY KEY,
            id_colecao INT NOT NULL,
            nome VARCHAR(120) NOT NULL,
            silhueta VARCHAR(120) NULL,
            tecido VARCHAR(120) NULL,
            palavras_chave VARCHAR(255) NULL,
            paleta VARCHAR(500) NULL,
            mood_url VARCHAR(500) NULL,
            herda TINYINT(1) NOT NULL DEFAULT 1,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_colecao) REFERENCES colecao(id_colecao) ON DELETE CASCADE
        )`
    ];

    createQueries.forEach((query) => {
        connection.query(query, (err) => {
            if (err) {
                console.error('Erro ao criar tabela: ', err.stack);
            }
        });
    });
});

bcrypt.hash('admin123', 10).then(hash => {
    connection.query(
        `INSERT IGNORE INTO cliente (nome, email, telefone, senha, is_admin)
            VALUES ('Admin Aura', 'admin@aura.com', '11999999999', ?, 1)`,
        [hash],
        (err) => {
            if (err) console.error('Erro ao criar admin:', err.stack);
            else console.log('Admin pronto: admin@aura.com / admin123');
        }
    );
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
            'SELECT id_cliente, nome, email, senha, is_admin FROM cliente WHERE email = ?',
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
                email: cliente.email,
                is_admin: !!cliente.is_admin
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro no servidor ao fazer login.' });
    }
});

/* =========================================================
   RF02 — COLEÇÕES
   ========================================================= */
app.get('/colecoes', async (req, res) => {
    try {
        const [rows] = await connection.promise().query(
            'SELECT * FROM colecao ORDER BY criado_em DESC'
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar coleções.' });
    }
});

app.post('/colecoes', async (req, res) => {
    const { nome, temporada, data_inicio, data_fim, status, descricao, herdou_de } = req.body;

    if (!nome || !temporada || !data_inicio || !data_fim) {
        return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
    }

    try {
        const [result] = await connection.promise().query(
            `INSERT INTO colecao (nome, temporada, data_inicio, data_fim, status, descricao, herdou_de)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [nome, temporada, data_inicio, data_fim, status || 'Em preparação', descricao || null, herdou_de || null]
        );
        res.status(201).json({ mensagem: 'Coleção criada!', id_colecao: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao criar coleção.' });
    }
});

app.patch('/colecoes/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ erro: 'Informe o status.' });

    try {
        const [r] = await connection.promise().query(
            'UPDATE colecao SET status = ? WHERE id_colecao = ?',
            [status, req.params.id]
        );
        if (!r.affectedRows) return res.status(404).json({ erro: 'Coleção não encontrada.' });
        res.json({ mensagem: 'Status atualizado.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao atualizar status.' });
    }
});

app.delete('/colecoes/:id', async (req, res) => {
    try {
        const [r] = await connection.promise().query(
            'DELETE FROM colecao WHERE id_colecao = ?', [req.params.id]
        );
        if (!r.affectedRows) return res.status(404).json({ erro: 'Coleção não encontrada.' });
        res.json({ mensagem: 'Coleção removida.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao remover coleção.' });
    }
});

/* =========================================================
   RF02 — ESTILOS (DIRETRIZES ESTÉTICAS)
   ========================================================= */
app.get('/estilos-diretriz', async (req, res) => {
    try {
        const [rows] = await connection.promise().query(
            `SELECT d.*, c.nome AS colecao_nome
             FROM estilo_diretriz d
             JOIN colecao c ON c.id_colecao = d.id_colecao
             ORDER BY d.criado_em DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar estilos.' });
    }
});

app.post('/estilos-diretriz', async (req, res) => {
    const { id_colecao, nome, silhueta, tecido, palavras_chave, paleta, mood_url, herda } = req.body;

    if (!id_colecao || !nome) {
        return res.status(400).json({ erro: 'Coleção e nome são obrigatórios.' });
    }

    try {
        const [result] = await connection.promise().query(
            `INSERT INTO estilo_diretriz
                (id_colecao, nome, silhueta, tecido, palavras_chave, paleta, mood_url, herda)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id_colecao, nome,
                silhueta || null, tecido || null,
                palavras_chave || null,
                Array.isArray(paleta) ? paleta.join(',') : (paleta || null),
                mood_url || null,
                herda ? 1 : 0
            ]
        );
        res.status(201).json({ mensagem: 'Estilo criado!', id_diretriz: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao criar estilo.' });
    }
});

app.delete('/estilos-diretriz/:id', async (req, res) => {
    try {
        const [r] = await connection.promise().query(
            'DELETE FROM estilo_diretriz WHERE id_diretriz = ?', [req.params.id]
        );
        if (!r.affectedRows) return res.status(404).json({ erro: 'Estilo não encontrado.' });
        res.json({ mensagem: 'Estilo removido.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao remover estilo.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}/`);
});