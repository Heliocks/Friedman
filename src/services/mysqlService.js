const mysql = require('mysql2/promise');

class MySQLService {
  constructor(config) {
    this.config = config;
    this.pool = null;
  }

  async connect() {
    const poolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    };

    if (this.config.ssl) {
      poolConfig.ssl = this.config.ssl;
    }

    this.pool = mysql.createPool(poolConfig);

    const connection = await this.pool.getConnection();
    try {
      await connection.ping();
    } finally {
      connection.release();
    }
  }

  async execute(sql) {
    if (!this.pool) {
      throw new Error('La conexion MySQL no ha sido inicializada.');
    }

    const [rows, fields] = await this.pool.query(sql);
    return { rows, fields };
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

module.exports = MySQLService;
