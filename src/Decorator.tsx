import React, { JSX, PropsWithChildren } from 'react'

import { DecoratorFetchProps } from './common-types'
import { getDecoratorRsc } from './fetch-decorator-next'

export interface DecoratorProps {
    decoratorProps: DecoratorFetchProps
}

export async function Decorator({ children, decoratorProps }: PropsWithChildren<DecoratorProps>): Promise<JSX.Element> {
    const { Styles, Header, Footer, Scripts } = await getDecoratorRsc(decoratorProps)

    return (
        <>
            <head>
                <Styles />
            </head>
            <body>
                <Header />
                {children}
                <Footer />
                <Scripts />
            </body>
        </>
    )
}
