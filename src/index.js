require('dotenv').config();

const fs = require('fs');
const path = require('path');
const exportsConfig = require('./config/exports');
const MySQLService = require('./services/mysqlService');
const CsvService = require('./services/csvService');
const FtpService = require('./services/ftpService');
const logger = require('./utils/logger');

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'salida');

async function main() {
  logger.info('Inicio del proceso de exportacion.');

  const csvService = new CsvService(outputDir);
  let mysqlService;
  let ftpService;
  const generatedFiles = [];

  try {
    await csvService.ensureOutputDir();
    validateExportsConfig(exportsConfig);

    const mySqlConfig = getMySqlConfig();
    mysqlService = new MySQLService(mySqlConfig);
    ftpService = new FtpService(getFtpConfig());

    logger.info('Conectando a MySQL.', {
      host: mySqlConfig.host,
      port: mySqlConfig.port,
      database: mySqlConfig.database,
      ssl: Boolean(mySqlConfig.ssl),
    });
    await mysqlService.connect();
    logger.info('Conexion MySQL establecida.');

    for (const exportDefinition of exportsConfig) {
      try {
        logger.info('Procesando exportacion.', {
          name: exportDefinition.name,
          filename: exportDefinition.filename,
        });

        const { rows, fields } = await mysqlService.execute(exportDefinition.sql);
        logger.info('Query ejecutado.', {
          name: exportDefinition.name,
          records: rows.length,
        });

        const filePath = await csvService.writeCsv(exportDefinition, rows, fields);
        generatedFiles.push(filePath);

        logger.info('Archivo CSV generado.', {
          name: exportDefinition.name,
          records: rows.length,
          file: filePath,
        });
      } catch (error) {
        logger.error('Error al procesar exportacion.', {
          name: exportDefinition.name,
          filename: exportDefinition.filename,
          error: serializeError(error),
        });
        throw error;
      }
    }

    logger.info('Conectando a FTP/FTPS.', {
      host: process.env.FTP_HOST,
      remoteDir: process.env.FTP_REMOTE_DIR || '/',
      secure: parseBoolean(process.env.FTP_SECURE, false),
    });

    await ftpService.connect();
    logger.info('Conexion FTP/FTPS establecida.');

    for (const filePath of generatedFiles) {
      const remoteFilename = path.basename(filePath);
      try {
        logger.info('Subiendo archivo FTP.', {
          localFile: filePath,
          remoteFile: remoteFilename,
          remoteDir: process.env.FTP_REMOTE_DIR || '/',
        });

        await ftpService.uploadFile(filePath);
        logger.info('Carga FTP finalizada.', {
          localFile: filePath,
          remoteFile: remoteFilename,
          remoteDir: process.env.FTP_REMOTE_DIR || '/',
        });
      } catch (error) {
        logger.error('Error al subir archivo FTP.', {
          localFile: filePath,
          remoteFile: remoteFilename,
          remoteDir: process.env.FTP_REMOTE_DIR || '/',
          error: serializeError(error),
        });
        throw error;
      }
    }
  } catch (error) {
    process.exitCode = 1;
    logger.error('Error durante el proceso de exportacion.', {
      error: serializeError(error),
    });
  } finally {
    await closeResources(mysqlService, ftpService);
    logger.info('Fin del proceso de exportacion.', {
      exitCode: process.exitCode || 0,
    });
  }
}

function getMySqlConfig() {
  return {
    host: getRequiredEnv('MYSQL_HOST'),
    port: parsePort(process.env.MYSQL_PORT, 3306, 'MYSQL_PORT'),
    database: getRequiredEnv('MYSQL_DATABASE'),
    user: getRequiredEnv('MYSQL_USER'),
    password: getRequiredEnv('MYSQL_PASSWORD'),
    ssl: getMySqlSslConfig(),
  };
}

function getFtpConfig() {
  return {
    host: getRequiredEnv('FTP_HOST'),
    port: parsePort(process.env.FTP_PORT, 21, 'FTP_PORT'),
    user: getRequiredEnv('FTP_USER'),
    password: getRequiredEnv('FTP_PASSWORD'),
    remoteDir: process.env.FTP_REMOTE_DIR || '/',
    secure: parseBoolean(process.env.FTP_SECURE, false),
  };
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Falta configurar la variable de entorno ${name}.`);
  }

  return value;
}

function getMySqlSslConfig() {
  if (!parseBoolean(process.env.MYSQL_SSL, false)) {
    return undefined;
  }

  const sslConfig = {
    rejectUnauthorized: parseBoolean(process.env.MYSQL_SSL_REJECT_UNAUTHORIZED, true),
  };

  if (process.env.MYSQL_SSL_CA) {
    sslConfig.ca = readSslFile(process.env.MYSQL_SSL_CA, 'MYSQL_SSL_CA');
  }

  if (process.env.MYSQL_SSL_CERT) {
    sslConfig.cert = readSslFile(process.env.MYSQL_SSL_CERT, 'MYSQL_SSL_CERT');
  }

  if (process.env.MYSQL_SSL_KEY) {
    sslConfig.key = readSslFile(process.env.MYSQL_SSL_KEY, 'MYSQL_SSL_KEY');
  }

  return sslConfig;
}

function readSslFile(filePath, envName) {
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(projectRoot, filePath);

  try {
    return fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    throw new Error(`No se pudo leer el archivo configurado en ${envName}: ${resolvedPath}`);
  }
}

function parsePort(value, defaultValue, name) {
  const rawValue = value || String(defaultValue);
  const port = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`La variable ${name} debe ser un puerto valido.`);
  }

  return port;
}

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalizedValue = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'si'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no', 'n'].includes(normalizedValue)) {
    return false;
  }

  throw new Error(`Valor booleano invalido: ${value}`);
}

function validateExportsConfig(exportsToValidate) {
  if (!Array.isArray(exportsToValidate) || exportsToValidate.length === 0) {
    throw new Error('src/config/exports.js debe exportar al menos una exportacion.');
  }

  for (const exportDefinition of exportsToValidate) {
    if (!exportDefinition.name || !exportDefinition.filename || !exportDefinition.sql) {
      throw new Error('Cada exportacion debe tener name, filename y sql.');
    }
  }
}

async function closeResources(mysqlService, ftpService) {
  try {
    if (mysqlService) {
      await mysqlService.close();
      logger.info('Conexion MySQL cerrada.');
    }
  } catch (error) {
    process.exitCode = 1;
    logger.error('Error al cerrar la conexion MySQL.', {
      error: serializeError(error),
    });
  }

  try {
    if (ftpService) {
      ftpService.close();
      logger.info('Conexion FTP/FTPS cerrada.');
    }
  } catch (error) {
    process.exitCode = 1;
    logger.error('Error al cerrar la conexion FTP/FTPS.', {
      error: serializeError(error),
    });
  }
}

function serializeError(error) {
  if (!error) {
    return {};
  }

  return {
    message: error.message,
    stack: error.stack,
    code: error.code,
    errno: error.errno,
    sqlState: error.sqlState,
    sqlMessage: error.sqlMessage,
  };
}

main();
