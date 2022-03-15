import Apify, { RequestOptions } from 'apify';
// @ts-ignore
import dJSON from 'dirty-json';

import { replenishCookies, getCookie, removeCookie } from './utils';
import { Schema, Cookie } from './types';
import { LABELS, FIND_ADDRESS_REQUEST, ESTIMATE_REQUEST } from './consts';

const { log } = Apify.utils;

Apify.main(async () => {
    const { addresses, proxy, resultsToScrape = 1 } = (await Apify.getInput()) as Schema;

    if (!addresses) throw new Error('Must provide at least one address!');
    if (!proxy?.useApifyProxy) throw new Error('Must use a proxy!');

    if (!proxy.apifyProxyGroups?.includes('RESIDENTIAL') && !proxy.apifyProxyGroups?.includes('SHADER')) {
        log.warning('It is recommended to use RESIDENTIAL or SHADER proxy groups.');
    }

    const cookieRequestsToSend = addresses.length > 10 ? Math.ceil(((addresses.length + resultsToScrape) / 19) * 10) : 15;
    await replenishCookies(cookieRequestsToSend);

    const requests: RequestOptions[] = [];

    for (const address of addresses) {
        requests.push(FIND_ADDRESS_REQUEST(address));
    }
    log.info('Initial requests generated.');

    const requestList = await Apify.openRequestList('start-urls', requests);
    const requestQueue = await Apify.openRequestQueue();
    const proxyConfiguration = await Apify.createProxyConfiguration({ ...proxy });
    const sessionPool = await Apify.openSessionPool({});

    const crawler = new Apify.CheerioCrawler({
        handlePageTimeoutSecs: 25,
        requestTimeoutSecs: 45,
        proxyConfiguration,
        requestQueue,
        requestList,
        useSessionPool: true,
        sessionPoolOptions: {
            sessionOptions: {
                sessionPool,
                maxErrorScore: 1,
                maxUsageCount: 1,
            },
        },
        persistCookiesPerSession: true,
        maxRequestRetries: 25,
        ignoreSslErrors: true,
        maxConcurrency: 15,
        autoscaledPoolOptions: {
            desiredConcurrency: 4,
        },
        preNavigationHooks: [
            async ({ request }) => {
                const { cookie } = request.headers;
                if (!getCookie()) {
                    log.warning('Ran out of cookies! Will replenish.');
                    await replenishCookies();
                }

                if (request.retryCount) {
                    removeCookie(cookie);
                    request.headers.cookie = getCookie() as Cookie;
                }
            },
        ],
        handlePageFunction: async ({ request, json, body, crawler: { requestQueue: crawlerRequestQueue } }) => {
            switch (request.userData.label) {
                default:
                    break;
                case LABELS.FIND_ADDRESS: {
                    try {
                        let arr: any[] = json?.results;

                        arr = arr.slice(0, resultsToScrape);

                        for (const propertyObj of arr) {
                            const { display, metaData } = propertyObj;

                            if (!metaData?.zpid) return log.error('ZPID not found.');

                            const property = {
                                address: display,
                                type: metaData?.addressType ?? null,
                                zillow_zpid: metaData?.zpid ?? null,
                                latitude: metaData?.lat ?? null,
                                longitude: metaData?.lat ?? null,
                            };

                            if (!getCookie()) throw new Error('Out of cookies.');

                            const cookie = getCookie() as string;

                            await crawlerRequestQueue?.addRequest(
                                ESTIMATE_REQUEST({ zpid: metaData?.zpid as string, cookie, userData: { property } })
                            );
                            log.info(`Grabbed Zillow Property IDs from ${property.address}.`);
                        }
                    } catch (error) {
                        const { address } = request.userData;
                        log.error(`Failed when grabbing Property ID for ${address}: ${error}`);
                    }
                    break;
                }
                case LABELS.GET_ESTIMATE: {
                    const { property } = request.userData;
                    try {
                        const bufferString = Buffer.from(body).toString();
                        if (bufferString.includes('meta name="robots"')) throw new Error('Bot-detected by Zillow');

                        const response = json || dJSON.parse(bufferString.concat('": null }}}'));
                        if (!response) throw new Error('JSON not present in response.');

                        const { property: data } = response?.data || {};
                        if (!data) throw new Error('Property data not present in JSON.');

                        const final = {
                            ...property,
                            zestimate: data?.zestimate,
                            fullData: data,
                        };

                        log.info(`Pushing Zillow data (including Zestimate) for ${property.address}...`);
                        await Apify.pushData(final);
                    } catch (error) {
                        throw log.error(`Failed when grabbing Zestimate for ${property?.address}: ${error}`);
                    }
                    break;
                }
            }
        },
    });

    log.info('Starting the crawl.');
    await crawler.run();
    log.info('Crawl finished.');
});
