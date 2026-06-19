const fs = require('fs/promises');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

class CsvService {
  constructor(outputDir) {
    this.outputDir = outputDir;
  }

  async ensureOutputDir() {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  async writeCsv(exportDefinition, rows, fields) {
    await this.ensureOutputDir();
    this.validateFilename(exportDefinition.filename);

    const finalPath = path.join(this.outputDir, exportDefinition.filename);
    const tempPath = `${finalPath}.tmp`;
    const headers = this.getHeaders(rows, fields);

    try {
      await fs.rm(tempPath, { force: true });

      if (headers.length === 0) {
        await fs.writeFile(tempPath, '\ufeff', 'utf8');
      } else {
        const csvWriter = createObjectCsvWriter({
          path: tempPath,
          header: headers.map((header) => ({ id: header, title: header })),
          fieldDelimiter: ',',
          encoding: 'utf8',
        });

        await csvWriter.writeRecords(rows);
        await this.prependBom(tempPath);
      }

      await fs.rename(tempPath, finalPath);
      return finalPath;
    } catch (error) {
      await fs.rm(tempPath, { force: true });
      throw error;
    }
  }

  getHeaders(rows, fields) {
    if (Array.isArray(fields) && fields.length > 0) {
      return fields.map((field) => field.name);
    }

    if (Array.isArray(rows) && rows.length > 0) {
      return Object.keys(rows[0]);
    }

    return [];
  }

  async prependBom(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    if (content.charCodeAt(0) === 0xfeff) {
      return;
    }

    await fs.writeFile(filePath, `\ufeff${content}`, 'utf8');
  }

  validateFilename(filename) {
    if (!filename || filename !== path.basename(filename)) {
      throw new Error(`Nombre de archivo invalido: ${filename}`);
    }
  }
}

module.exports = CsvService;
