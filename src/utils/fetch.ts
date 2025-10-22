import * as iconv from 'iconv-lite';
import fetch from 'node-fetch';
import * as pLimit from 'p-limit';
import { logger } from './logger';
import { CONCURRENCY } from '../constants';

export interface FundData {
  code: string;
  name: string;
  netWorth: string;
  netWorthDate: string;
  estimatedWorth: string;
  estimatedWorthPercent: string;
  estimatedWorthTime: string;
}

export interface StockData {
  code: string;
  name: string;
  open: string;
  yestclose: string;
  price: string;
  high: string;
  low: string;
  volume: string;
  amount: string;
  time: string;
}

export interface StockSuggestItem {
  code: string;
  name: string;
}

async function fetchSingleFund(code: string): Promise<FundData | null> {
  try {
    const url = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${new Date().getTime()}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
        Referer: 'http://fund.eastmoney.com/',
      },
      timeout: 10000,
    });

    const data = await response.text();

    if (data && data.startsWith('jsonpgz')) {
      const jsonStr = data.slice(8, -2);
      const rawData = JSON.parse(jsonStr);
      const fundData: FundData = {
        code: rawData.fundcode,
        name: rawData.name,
        netWorth: rawData.dwjz,
        netWorthDate: rawData.jzrq,
        estimatedWorth: rawData.gsz,
        estimatedWorthPercent: rawData.gszzl,
        estimatedWorthTime: rawData.gztime,
      };
      return fundData;
    } else {
      logger.error(`Failed to fetch fund ${code} data:`, data);
    }
  } catch (e) {
    logger.error(`Failed to fetch fund ${code} data:`, e);
  }
  return null;
}

export async function fetchFundData(codes: string[]): Promise<FundData[]> {
  if (!codes || !Array.isArray(codes)) {
    logger.error('Invalid fund codes:', codes);
    return [];
  }

  logger.info('Fetching fund data...');

  try {
    const limit = pLimit(CONCURRENCY);

    const results = await Promise.allSettled(
      codes.map((code) => limit(() => fetchSingleFund(code)))
    );

    logger.info('Fund data fetched successfully');

    return results
      .filter(
        (result): result is PromiseFulfilledResult<FundData> =>
          result.status === 'fulfilled' && result.value !== null
      )
      .map((result) => result.value);
  } catch (error) {
    logger.error(`Failed to fetch fund data:`, error);
    return [];
  }
}

export async function fetchStocks(codes: string[]): Promise<StockData[]> {
  try {
    const url = `http://hq.sinajs.cn/list=${codes.join(',')}`;

    const response = await fetch(url, {
      headers: {
        Referer: 'http://finance.sina.com.cn',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
      },
    });

    const arrayBuffer = await response.arrayBuffer();
    const text = iconv.decode(Buffer.from(arrayBuffer), 'GB18030');

    if (!text || text.includes('FAILED')) {
      logger.error(`Failed to fetch stocks data:`, text);
      return [];
    }

    const stockList = text.split(';\n').filter(Boolean);
    const results: StockData[] = [];

    for (const stock of stockList) {
      const [code, data] = stock.split('=');
      if (data) {
        const values = data.replace(/^"|"$/g, '').split(',');
        const stockCode = code.replace('var hq_str_', '');

        if (values.length > 1) {
          let stockData: StockData | null = null;

          if (/^(sh|sz|bj)/.test(stockCode)) {
            // A-Shares
            stockData = {
              code: stockCode,
              name: values[0],
              open: values[1],
              yestclose: values[2],
              price: values[3],
              high: values[4],
              low: values[5],
              volume: values[8],
              amount: values[9],
              time: `${values[30]} ${values[31]}`,
            };
          } else if (/^gb_/.test(stockCode)) {
            // Hong Kong Stocks
            stockData = {
              code: stockCode,
              name: values[0],
              open: values[5],
              yestclose: values[26],
              price: values[1],
              high: values[6],
              low: values[7],
              volume: values[10],
              amount: 'No Data',
              time: values[3],
            };
          } else if (/^usr_/.test(stockCode)) {
            // US Stocks
            stockData = {
              code: stockCode,
              name: values[0],
              open: values[5],
              yestclose: values[26],
              price: values[1],
              high: values[6],
              low: values[7],
              volume: values[10],
              amount: 'No Data',
              time: values[3],
            };
          } else if (/^nf_/.test(stockCode)) {
            // CN Futures
            const isStockIndexFuture = /nf_(IC|IF|IH|IM|TF|TS|T\d+|TL)/.test(
              stockCode
            );

            if (isStockIndexFuture) {
              // Stock Index Futures
              stockData = {
                code: stockCode,
                name: values[49].slice(0, -1),
                open: values[0],
                yestclose: values[13],
                price: values[3],
                high: values[1],
                low: values[2],
                volume: values[4],
                amount: 'No Data',
                time: `${values[values.length - 2]} ${
                  values[values.length - 1]
                }`,
              };
            } else {
              // Commodity Futures
              stockData = {
                code: stockCode,
                name: values[0],
                open: values[2],
                yestclose: values[8 + 2],
                price: values[8],
                high: values[3],
                low: values[4],
                volume: values[8 + 6],
                amount: 'No Data',
                time: values[values.length - 2],
              };
            }
          } else if (/^hf_/.test(stockCode)) {
            // International Futures
            stockData = {
              code: stockCode,
              name: values[13],
              open: values[8],
              yestclose: values[7],
              price: values[0],
              high: values[4],
              low: values[5],
              volume: values[14].slice(0, -1),
              amount: 'No Data',
              time: values[6],
            };
          }

          if (stockData) {
            results.push(stockData);
          }
        }
      }
    }

    return results;
  } catch (e) {
    logger.error(`Failed to fetch stocks data:`, e);
    return [];
  }
}

export async function fetchStockData(codes: string[]): Promise<StockData[]> {
  if (!codes || !Array.isArray(codes)) {
    logger.error('Invalid stock codes:', codes);
    return [];
  }

  logger.info('Fetching stock data...');

  try {
    const results = await fetchStocks(codes);

    logger.info('Stock data fetched successfully');
    return results;
  } catch (error) {
    logger.error(`Failed to fetch stock data:`, error);
    return [];
  }
}

export async function fetchStockList(): Promise<StockSuggestItem[]> {
  const url = 'https://leek-hub.vercel.app/api/stocks';

  try {
    logger.info('Fetching stock list...');
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = (await response.json()) as { data: StockSuggestItem[] };

    const list = data?.data || [];

    logger.info('Stock list fetched successfully');
    return list;
  } catch (error) {
    logger.error('Failed to fetch stock list:', error);
    return [];
  }
}
