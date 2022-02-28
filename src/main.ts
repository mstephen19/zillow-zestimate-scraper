import Apify, { RequestOptions } from 'apify';

import { replenishCookies, getCookie, removeCookie } from './utils';

import { Schema, Cookie } from './types';

import { LABELS, FIND_ADDRESS_REQUEST, ESTIMATE_REQUEST } from './consts';

const { log } = Apify.utils;

Apify.main(async () => {
    const { addresses, proxy, resultsToScrape = 1 } = (await Apify.getInput()) as Schema;

    if (!addresses) throw new Error('Must provide at least one address!');
    if (!proxy?.useApifyProxy) throw new Error('Must use a proxy!');

    if (!proxy.apifyProxyGroups?.includes('RESIDENTIAL')) log.warning('It is recommended to use the RESIDENTIAL proxy group.');

    const cookieRequestsToSend = addresses.length > 10 ? Math.ceil(addresses.length * resultsToScrape) : 15;
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
        handlePageTimeoutSecs: 20,
        proxyConfiguration,
        requestQueue,
        requestList,
        useSessionPool: true,
        sessionPoolOptions: {
            sessionOptions: {
                sessionPool,
                maxErrorScore: 1,
            },
        },
        persistCookiesPerSession: true,
        maxRequestRetries: 5,
        ignoreSslErrors: true,
        maxConcurrency: 5,
        autoscaledPoolOptions: {
            desiredConcurrency: 5,
        },
        preNavigationHooks: [
            async ({ request }) => {
                const { cookie } = request.headers;
                if (!getCookie()) {
                    log.warning('Ran out of cookies! Going to farm more...');
                    await replenishCookies();
                }

                if (request.retryCount) {
                    removeCookie(cookie);
                    request.headers.cookie = getCookie() as Cookie;
                }
            },
        ],
        handlePageFunction: async ({ request, json, crawler: { requestQueue: crawlerRequestQueue } }) => {
            switch (request.userData.label) {
                default:
                    break;
                case LABELS.FIND_ADDRESS: {
                    try {
                        let arr: any[] = json?.results;

                        arr = arr.slice(0, resultsToScrape);

                        for (const propertyObj of arr) {
                            const { display, metaData } = propertyObj;

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
                            log.info(`Grabbed Zillow Property ID from ${property.address}.`);
                        }
                    } catch (error) {
                        const { address } = request.userData;
                        log.error(`Failed when grabbing Property ID for ${address}.`);
                    }
                    break;
                }
                case LABELS.GET_ESTIMATE: {
                    const { property } = request.userData;
                    try {
                        const data = json?.data?.property;

                        const final = {
                            ...property,
                            zestimate: data?.zestimate,
                            fullData: data,
                        };

                        log.info(`Pushing Zillow data (including Zestimate) for ${property.address}...`);
                        await Apify.pushData(final);
                    } catch (error) {
                        log.error(`Failed when grabbing Zestimate for ${property?.address}`);
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
