const fetch = require('node-fetch');
const config = require('./config');

class Logger {
  // HTTP middleware
  httpLogger = (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    res.send = (resBody) => {
      const duration = Date.now() - startTime;
      const logData = {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        hasAuth: !!req.headers.authorization,
        reqBody: this.sanitize(JSON.stringify(req.body || {})),
        resBody: this.sanitize(JSON.stringify(resBody || {})),
        duration: `${duration}ms`
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http-request', logData);
      res.send = originalSend;
      return res.send(resBody);
    };
    next();
  };

  // General log method
  log(level, type, logData) {
    const labels = { 
      component: config.logging.source, 
      level: level, 
      type: type 
    };
    const values = [this.nowString(), JSON.stringify(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };
    this.sendLogToGrafana(logEvent);
  }

  // Status code to log level
  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  // Timestamp in nanoseconds
  nowString() {
    return (Date.now() * 1000000).toString();
  }

  // Sanitize sensitive data
  sanitize(data) {
    return data.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"****\\"')
               .replace(/\\"apiKey\\":\s*\\"[^"]*\\"/g, '\\"apiKey\\": \\"****\\"')
               .replace(/\\"token\\":\s*\\"[^"]*\\"/g, '\\"token\\": \\"****\\"');
  }

  // Send to Grafana Loki
  async sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    try {
      const res = await fetch(config.logging.url, {
        method: 'POST',
        body: body,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
        },
      });
      if (!res.ok) console.error('Failed to send log to Grafana:', res.statusText);
    } catch (err) {
      console.error('Error sending log to Grafana:', err);
    }
  }
}

module.exports = new Logger();