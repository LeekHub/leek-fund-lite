import { LogOutputChannel } from 'vscode';

class Logger {
  private outputChannel?: LogOutputChannel;

  initOutputChannel(_outputChannel: LogOutputChannel) {
    this.outputChannel = _outputChannel;
  }

  info(message: string, ...args: any[]): void {
    console.info(message, ...args);
    this.outputChannel?.info(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(message, ...args);
    this.outputChannel?.warn(message, ...args);
  }

  error(error: string | Error, ...args: any[]): void {
    console.error(error, ...args);
    this.outputChannel?.error(error, ...args);
  }

  debug(message: string, ...args: any[]): void {
    console.debug(message, ...args);
    this.outputChannel?.debug(message, ...args);
  }
}

const logger = new Logger();

export { logger };
