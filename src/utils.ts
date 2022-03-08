import Apify from 'apify';

import { Cookie, CookieObject } from './types';

const { log } = Apify.utils;

let cookies: CookieObject[] = [];

const newCookies = async (num?: number): Promise<Cookie[]> => {
    const { defaultDatasetId } = await Apify.call(
        'mstephen190/zillow-cookie-farmer',
        { requestsNum: num || 15 },
        { memoryMbytes: 2048, timeoutSecs: 0, fetchOutput: true }
    );

    const dataset = await Apify.openDataset(defaultDatasetId, { forceCloud: true });

    const { items } = (await dataset.getData()) as any;

    return items[0]?.cookies as Cookie[];
};

export const removeCookie = (cookie: string): void => {
    cookies = cookies.filter((obj) => {
        return obj.cookie !== cookie;
    });
};

export const replenishCookies = async (num?: number): Promise<void> => {
    log.info('Farming cookies...');
    const cookieStrings = await newCookies(num);

    for (const string of cookieStrings) {
        cookies.push({
            cookie: string,
            uses: 0,
        });
    }
};

export const getCookie = (): Cookie | undefined => {
    if (!cookies.length) {
        return undefined;
    }
    const randomCookie = cookies[Math.floor(Math.random() * cookies.length)];

    cookies = cookies.map((obj) => {
        if (obj.cookie === randomCookie.cookie) {
            return {
                ...obj,
                uses: obj.uses + 1,
            };
        }
        return obj;
    });

    if (randomCookie.uses >= 5) {
        removeCookie(randomCookie.cookie);
    }

    return randomCookie.cookie;
};
