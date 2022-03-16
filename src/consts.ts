import { RequestOptions } from 'apify';
import query from './query';

export enum LABELS {
    FIND_ADDRESS = 'FIND_ADDRESS',
    GET_ESTIMATE = 'GET_ESTIMATE',
}

const ADDRESS_QUERY_URL = (queryStr: string): string => {
    return `https://www.zillowstatic.com/autocomplete/v3/suggestions?q=${queryStr}&resultTypes=allAddress&resultCount=12`;
};

export const FIND_ADDRESS_REQUEST = (address: string): RequestOptions => {
    return {
        url: ADDRESS_QUERY_URL(address),
        userData: { label: LABELS.FIND_ADDRESS, address },
    };
};

export const ESTIMATE_REQUEST = <T extends Record<string, unknown>>({
    zpid,
    cookie,
    userData,
}: {
    zpid: string;
    cookie: string;
    userData: T;
}): RequestOptions => {
    return {
        url: `https://www.zillow.com/graphql/`,
        headers: {
            'Content-Type': 'application/json',
            cookie,
        },
        method: 'POST',
        payload: JSON.stringify({
            operationName: `HowMuchIsMyHomeWorthReviewQuery`,
            variables: {
                zpid,
            },
            query,
        }),
        userData: {
            label: LABELS.GET_ESTIMATE,
            ...userData,
        },
        useExtendedUniqueKey: true,
    };
};
