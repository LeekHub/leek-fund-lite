import * as iconv from 'iconv-lite';
import fetch from 'node-fetch';

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
      console.error(
        `[LEEK_FUND_LITE] Failed to fetch fund ${code} data:`,
        data
      );
    }
  } catch (e) {
    console.error(`[LEEK_FUND_LITE] Failed to fetch fund ${code} data:`, e);
  }
  return null;
}

export async function fetchFundData(codes: string[]): Promise<FundData[]> {
  if (!codes || !Array.isArray(codes)) {
    console.error('[LEEK_FUND_LITE] Invalid fund codes:', codes);
    return [];
  }

  console.log('[LEEK_FUND_LITE] Fetching fund data...');
  const results: FundData[] = [];
  const batchSize = 10;

  try {
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(batch.map(fetchSingleFund));
      results.push(
        ...batchResults
          .filter(
            (result): result is PromiseFulfilledResult<FundData | null> =>
              result.status === 'fulfilled'
          )
          .map((result) => result.value)
          .filter((data): data is FundData => data !== null)
      );
    }
  } catch (error) {
    console.error(`[LEEK_FUND_LITE] Failed to fetch fund data:`, error);
  }

  console.log('[LEEK_FUND_LITE] Fund data fetched successfully');
  return results;
}

export async function fetchStockData(codes: string[]): Promise<StockData[]> {
  if (!codes || !Array.isArray(codes)) {
    console.error('[LEEK_FUND_LITE] Invalid stock codes:', codes);
    return [];
  }

  console.log('[LEEK_FUND_LITE] Fetching stock data...');
  const results: StockData[] = [];

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

    if (text) {
      const stockList = text.split(';\n').filter(Boolean);

      for (const stock of stockList) {
        const [code, data] = stock.split('=');
        if (data) {
          const values = data.replace(/^"|"$/g, '').split(',');
          const stockCode = code.replace('var hq_str_', '');

          if (values.length > 1) {
            if (/^(sh|sz|bj)/.test(stockCode)) {
              // A-Shares
              results.push({
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
              });
            } else if (/^gb_/.test(stockCode)) {
              // Hong Kong Stocks
              results.push({
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
              });
            } else if (/^usr_/.test(stockCode)) {
              // US Stocks
              results.push({
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
              });
            } else if (/^nf_/.test(stockCode)) {
              // CN Futures
              const isStockIndexFuture = /nf_(IC|IF|IH|IM|TF|TS|T\d+|TL)/.test(
                stockCode
              );

              if (isStockIndexFuture) {
                // Stock Index Futures
                results.push({
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
                });
              } else {
                // Commodity Futures
                results.push({
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
                });
              }
            } else if (/^hf_/.test(stockCode)) {
              // International Futures
              results.push({
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
              });
            }
          }
        }
      }
    } else {
      console.error('[LEEK_FUND_LITE] Failed to fetch stock data:', text);
    }
  } catch (e) {
    console.error('[LEEK_FUND_LITE] Failed to fetch stock data:', e);
  }

  console.log('[LEEK_FUND_LITE] Stock data fetched successfully');
  return results;
}
