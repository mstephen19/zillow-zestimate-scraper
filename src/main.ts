import Apify, { RequestOptions } from 'apify';
// eslint-disable-next-line
// @ts-ignore
import dJSON from 'dirty-json';

import { replenishCookies, getCookie, removeCookie } from './utils';
import { Schema, Cookie } from './types';
import { LABELS, FIND_ADDRESS_REQUEST, ESTIMATE_REQUEST } from './consts';

const { log } = Apify.utils;

let expected: number = 0;

Apify.main(async () => {
    const { addresses, proxy, resultsToScrape = 1 } = (await Apify.getInput()) as Schema;

    log.info(`The maximum possible results is: ${addresses.length * resultsToScrape}`);

    if (!addresses) throw new Error('Must provide at least one address!');
    if (!proxy?.useApifyProxy) throw new Error('Must use a proxy!');

    if (!proxy.apifyProxyGroups?.includes('RESIDENTIAL') && !proxy.apifyProxyGroups?.includes('SHADER')) {
        log.warning('It is recommended to use RESIDENTIAL or SHADER proxy groups.');
    }

    const cookieRequestsToSend = addresses.length > 500 ? addresses.length / 20 : addresses.length + resultsToScrape;
    await replenishCookies(cookieRequestsToSend);

    const requests: RequestOptions[] = [];

    for (const address of addresses) {
        requests.push(FIND_ADDRESS_REQUEST(address));
    }
    log.info('Initial requests generated.');

    const requestList = await Apify.openRequestList('start-urls', requests);
    const requestQueue = await Apify.openRequestQueue();
    const proxyConfiguration = await Apify.createProxyConfiguration({ ...proxy });

    const crawler = new Apify.CheerioCrawler({
        handlePageTimeoutSecs: 25,
        requestTimeoutSecs: 40,
        proxyConfiguration,
        requestQueue,
        requestList,
        useSessionPool: true,
        sessionPoolOptions: {
            maxPoolSize: 30,
            // eslint-disable-next-line
            //@ts-ignore
            sessionOptions: {
                maxErrorScore: 1,
                maxUsageCount: 20,
            },
        },
        persistCookiesPerSession: false,
        maxRequestRetries: 25,
        ignoreSslErrors: true,
        maxConcurrency: 20,
        autoscaledPoolOptions: {
            desiredConcurrency: 15,
        },
        preNavigationHooks: [
            async ({ request }) => {
                const { cookie } = request.headers;
                if (!getCookie()) {
                    log.warning('Ran out of cookies! Replenishing now...');
                    await replenishCookies();
                }

                if (request.retryCount) {
                    removeCookie(cookie);
                    request.headers.cookie = getCookie() as Cookie;
                }
            },
        ],
        handlePageFunction: async ({ request, response: { statusCode }, json, body, crawler: { requestQueue: crawlerRequestQueue }, session }) => {
            session.retireOnBlockedStatusCodes(403, [502, 401, 402]);

            if (statusCode !== 200) throw new Error('Received non-200 status code.');

            switch (request.userData.label) {
                default:
                    break;
                case LABELS.FIND_ADDRESS: {
                    const { address } = request.userData;
                    try {
                        let arr = json?.results;

                        arr = arr.slice(0, resultsToScrape);

                        if (arr.length === 0) log.warning(`Found 0 results for ${address}`);
                        if (arr.length > 0) log.info(`Found ${arr.length} addresses for input ${address}`);

                        expected += arr.length;

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
                        session.retire();
                        throw log.error(`Failed when grabbing Zestimate for ${property?.address}: ${error}`);
                    }
                    break;
                }
            }
        },
    });

    log.info('Starting the crawl.');
    await crawler.run();
    log.info(`Crawl finished. Expected results: ${expected}`);
});
