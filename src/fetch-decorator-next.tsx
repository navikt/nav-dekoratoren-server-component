/* eslint-disable no-console */

import { JSDOM } from 'jsdom'
import NodeCache from 'node-cache'
import parse from 'html-react-parser'
import React, { ReactElement } from 'react'

import { getDecoratorUrl } from './urls'
import { DecoratorFetchProps } from './common-types'

const SECONDS_PER_MINUTE = 60
const FIVE_MINUTES_IN_SECONDS = 5 * SECONDS_PER_MINUTE

const cache = new NodeCache({
    stdTTL: FIVE_MINUTES_IN_SECONDS,
    checkperiod: SECONDS_PER_MINUTE,
})

export type DecoratorElements = {
    DECORATOR_STYLES: string
    DECORATOR_SCRIPTS: string
    DECORATOR_HEADER: string
    DECORATOR_FOOTER: string
}

const fetchDecorator = async (url: string, props: DecoratorFetchProps, retries = 3): Promise<string> => {
    let tryCount = 0

    const fetchDom = async (): Promise<string> => {
        if (tryCount >= retries) {
            throw new Error('Failed to fetch decorator after 3 retries')
        }

        try {
            console.info(`Fetching ${url}... (try ${tryCount})`)
            const response = await fetch(url, {
                next: { revalidate: 15 * 60 },
            } as RequestInit)

            if (!response.ok) {
                throw new Error(`${response.status} - ${response.statusText}`)
            }

            return response.text()
        } catch (e) {
            console.error(new Error(`Failed to fetch decorator (try ${tryCount}), retrying...`, { cause: e }))

            tryCount++
            return fetchDom()
        }
    }

    return fetchDom()
}

function parseDom(dom: string): DecoratorElements {
    const { document } = new JSDOM(dom).window

    const styles = document.getElementById('styles')?.innerHTML
    if (!styles) {
        throw new Error('Decorator styles element not found!')
    }

    const scripts = document.getElementById('scripts')?.innerHTML
    if (!scripts) {
        throw new Error('Decorator scripts element not found!')
    }

    const header = document.getElementById('header-withmenu')?.innerHTML
    if (!header) {
        throw new Error('Decorator header element not found!')
    }

    const footer = document.getElementById('footer-withmenu')?.innerHTML
    if (!footer) {
        throw new Error('Decorator footer element not found!')
    }

    return {
        DECORATOR_STYLES: styles.trim(),
        DECORATOR_SCRIPTS: scripts.trim(),
        DECORATOR_HEADER: header.trim(),
        DECORATOR_FOOTER: footer.trim(),
    }
}

const fetchDecoratorHtml = async (url: string, props: DecoratorFetchProps): Promise<DecoratorElements> => {
    try {
        const dom = await fetchDecorator(url, props)
        return parseDom(dom)
    } catch (e) {
        console.error(
            new Error(`Failed to fetch decorator: Do support for fallback to client side rendering yet`, { cause: e }),
        )

        throw e
    }
}

type ParsedRscComponents = {
    Styles: () => ReactElement
    Header: () => ReactElement
    Footer: () => ReactElement
    Scripts: () => ReactElement
}

export async function getDecoratorRsc(props: DecoratorFetchProps): Promise<ParsedRscComponents> {
    const url: string = getDecoratorUrl(props)

    const cacheData = cache.get<ParsedRscComponents>(url)
    if (cacheData) {
        return cacheData
    }

    const { DECORATOR_STYLES, DECORATOR_HEADER, DECORATOR_FOOTER, DECORATOR_SCRIPTS } = await fetchDecoratorHtml(
        url,
        props,
    )

    const Styles = (): ReactElement => <>{parse(DECORATOR_STYLES, { trim: true })}</>
    const Header = (): ReactElement => (
        <div
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
                __html: DECORATOR_HEADER,
            }}
        />
    )
    const Footer = (): ReactElement => (
        <div
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
                __html: DECORATOR_FOOTER,
            }}
        />
    )
    const Scripts = (): ReactElement => <>{parse(DECORATOR_SCRIPTS, { trim: true })}</>

    const rscComponents = {
        Styles,
        Header,
        Footer,
        Scripts,
    }

    cache.set(url, rscComponents)

    return rscComponents
}
