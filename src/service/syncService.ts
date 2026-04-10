import * as vscode from 'vscode';
import {
  GITHUB_TOKEN_SECRET_KEY,
  REFRESH_INTERVAL_CONFIG_KEY,
  SYNC_FILE_NAME,
} from '../constants';
import { FundService } from './fundService';
import { StockService } from './stockService';
import {
  createGitHubGist,
  getGitHubGist,
  GistItem,
  listGitHubGists,
  updateGitHubGist,
} from '../utils/fetch';
import { logger } from '../utils/logger';

interface SyncPayload {
  version: 1;
  updatedAt: string;
  data: {
    funds: string[];
    stocks: string[];
    interval: number;
  };
}

export class SyncService {
  constructor(
    private context: vscode.ExtensionContext,
    private fundService: FundService,
    private stockService: StockService
  ) {}

  async githubLogin(): Promise<boolean> {
    const token = await vscode.window.showInputBox({
      prompt: 'Please input GitHub personal token',
      password: true,
      ignoreFocusOut: true,
    });

    if (!token) {
      return false;
    }

    await this.context.secrets.store(GITHUB_TOKEN_SECRET_KEY, token.trim());
    logger.info('GitHub token saved');
    vscode.window.showInformationMessage('GitHub token saved');
    return true;
  }

  async githubLogout(): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      'Clear saved GitHub token?',
      { modal: true },
      'Logout'
    );

    if (confirmed !== 'Logout') {
      return;
    }

    await this.context.secrets.delete(GITHUB_TOKEN_SECRET_KEY);
    logger.info('GitHub token cleared');
    vscode.window.showInformationMessage('GitHub token cleared');
  }

  async hasGitHubToken(): Promise<boolean> {
    return Boolean(await this.context.secrets.get(GITHUB_TOKEN_SECRET_KEY));
  }

  async githubUpload(): Promise<void> {
    const token = await this.ensureToken();
    if (!token) {
      return;
    }

    const payload = this.getSyncPayload();
    const content = JSON.stringify(payload, null, 2);
    const gist = await this.findSyncGist(token);

    if (gist) {
      await updateGitHubGist(token, gist.id, content);
      logger.info(`Updated sync gist ${gist.id}`);
      vscode.window.showInformationMessage('GitHub sync uploaded');
      return;
    }

    const createdGist = await createGitHubGist(token, content);
    logger.info(`Created sync gist ${createdGist.id}`);
    vscode.window.showInformationMessage('GitHub sync uploaded');
  }

  async githubDownload(): Promise<void> {
    const token = await this.ensureToken();
    if (!token) {
      return;
    }

    const gist = await this.findSyncGist(token);
    if (!gist) {
      vscode.window.showErrorMessage('Cloud sync data not found');
      return;
    }

    const confirmed = await vscode.window.showWarningMessage(
      'Download will overwrite local funds, stocks and interval. Continue?',
      { modal: true },
      'Download'
    );

    if (confirmed !== 'Download') {
      return;
    }

    const fullGist = await getGitHubGist(token, gist.id);
    const file = fullGist.files[SYNC_FILE_NAME];
    if (!file?.content) {
      throw new Error('Sync file content not found');
    }

    const payload = this.parseSyncPayload(file.content);
    await this.fundService.setCodes(payload.data.funds);
    await this.stockService.setCodes(payload.data.stocks);
    await vscode.workspace
      .getConfiguration()
      .update(REFRESH_INTERVAL_CONFIG_KEY, payload.data.interval, true);
    logger.info(`Updated local interval to ${payload.data.interval}`);
    await this.fundService.reload();
    await this.stockService.reload();

    logger.info(`Downloaded sync gist ${gist.id}`);
    vscode.window.showInformationMessage('GitHub sync downloaded');
  }

  private getSyncPayload(): SyncPayload {
    const interval = vscode.workspace
      .getConfiguration()
      .get<number>(REFRESH_INTERVAL_CONFIG_KEY, 10000);

    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      data: {
        funds: this.fundService.getCodes(),
        stocks: this.stockService.getCodes(),
        interval,
      },
    };
  }

  private async ensureToken(): Promise<string | undefined> {
    const token = await this.context.secrets.get(GITHUB_TOKEN_SECRET_KEY);
    if (token) {
      return token;
    }

    const saved = await this.githubLogin();
    if (!saved) {
      return undefined;
    }

    return (await this.context.secrets.get(GITHUB_TOKEN_SECRET_KEY)) || undefined;
  }

  private async findSyncGist(token: string): Promise<GistItem | undefined> {
    const gists = await listGitHubGists(token);
    const matchedGists = gists.filter((gist) => Boolean(gist.files[SYNC_FILE_NAME]));

    if (matchedGists.length > 1) {
      logger.warn(`Multiple sync gists found, using ${matchedGists[0].id}`);
    }

    return matchedGists[0];
  }

  private parseSyncPayload(content: string): SyncPayload {
    const payload = JSON.parse(content) as Partial<SyncPayload>;

    if (
      payload.version !== 1 ||
      !payload.data ||
      !Array.isArray(payload.data.funds) ||
      !Array.isArray(payload.data.stocks) ||
      typeof payload.data.interval !== 'number'
    ) {
      throw new Error('Invalid sync data');
    }

    return {
      version: 1,
      updatedAt: payload.updatedAt || new Date().toISOString(),
      data: {
        funds: payload.data.funds,
        stocks: payload.data.stocks,
        interval: payload.data.interval,
      },
    };
  }
}
