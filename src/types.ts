import { ProxyConfigurationOptions } from 'apify';

export interface Schema {
    addresses: string[];
    proxy: ProxyConfigurationOptions & { useApifyProxy: boolean };
    resultsToScrape?: number;
}

export type Cookie = string;

export interface CookieObject {
    cookie: Cookie;
    uses: number;
}
