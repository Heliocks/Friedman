const path = require('path');
const ftp = require('basic-ftp');

class FtpService {
  constructor(config) {
    this.config = config;
    this.client = new ftp.Client();
  }

  async connect() {
    this.client.ftp.verbose = false;

    await this.client.access({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      secure: this.config.secure,
    });

    await this.client.ensureDir(this.config.remoteDir);
  }

  async uploadFile(localFilePath) {
    const remoteFilename = path.basename(localFilePath);
    await this.client.uploadFrom(localFilePath, remoteFilename);
    return remoteFilename;
  }

  close() {
    if (!this.client.closed) {
      this.client.close();
    }
  }
}

module.exports = FtpService;
