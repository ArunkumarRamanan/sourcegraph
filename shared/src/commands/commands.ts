import { isArray } from 'lodash-es'
import { concat, from, of, Subscription, Unsubscribable } from 'rxjs'
import { first } from 'rxjs/operators'
import { Services } from '../api/client/services'
import { KeyPath, SettingsEdit } from '../api/client/services/settings'
import { ActionContributionClientCommandUpdateConfiguration } from '../api/protocol'
import { Position } from '../api/protocol/plainTypes'
import { PlatformContext } from '../platform/context'

/**
 * Registers the builtin client commands that are required for Sourcegraph extensions. See
 * {@link module:sourcegraph.module/protocol/contribution.ActionContribution#command} for
 * documentation.
 */
export function registerBuiltinClientCommands(
    { settings: settingsService, commands: commandRegistry, textDocumentLocations }: Services,
    context: Pick<PlatformContext, 'queryGraphQL' | 'queryLSP'>
): Unsubscribable {
    const subscription = new Subscription()

    subscription.add(
        commandRegistry.registerCommand({
            command: 'open',
            run: (url: string) => {
                // The `open` client command is usually implemented by ActionItem rendering the action with the
                // HTML <a> element, not by handling it here. Using an HTML <a> element means it is a standard
                // link, and native system behaviors such as open-in-new-tab work.
                //
                // If a client is not running in a web browser, this handler should be updated to call the system's
                // default URL handler using the system (e.g., Electron) API.
                window.open(url, '_blank')
                return Promise.resolve()
            },
        })
    )

    subscription.add(
        commandRegistry.registerCommand({
            command: 'openPanel',
            run: (viewID: string) => {
                // As above for `open`, the `openPanel` client command is usually implemented by an HTML <a>
                // element.
                window.open(urlForOpenPanel(viewID, window.location.hash))
                return Promise.resolve()
            },
        })
    )

    /**
     * Executes the location provider and returns its results.
     */
    subscription.add(
        commandRegistry.registerCommand({
            command: 'executeLocationProvider',
            run: (id: string, uri: string, position: Position) =>
                concat(
                    textDocumentLocations.getLocation(id, { textDocument: { uri }, position }),
                    // Concat with [] to avoid undefined promise value when the getLocation observable completes
                    // without emitting. See https://github.com/ReactiveX/rxjs/issues/1736.
                    of([])
                )
                    .pipe(first())
                    .toPromise(),
        })
    )

    subscription.add(
        commandRegistry.registerCommand({
            command: 'updateConfiguration',
            run: (...anyArgs: any[]): Promise<void> => {
                const args = anyArgs as ActionContributionClientCommandUpdateConfiguration['commandArguments']
                return settingsService.update(convertUpdateConfigurationCommandArgs(args))
            },
        })
    )

    /**
     * Sends a GraphQL request to the Sourcegraph GraphQL API and returns the result. The request is performed
     * with the privileges of the current user.
     */
    subscription.add(
        commandRegistry.registerCommand({
            command: 'queryGraphQL',
            run: (query: string, variables: { [name: string]: any }): Promise<any> =>
                // 🚨 SECURITY: The request might contain private info (such as
                // repository names), so the `mightContainPrivateInfo` parameter
                // is set to `true`. It is up to the client (e.g. browser
                // extension) to check that parameter and prevent the request
                // from being sent to Sourcegraph.com.
                from(context.queryGraphQL(query, variables, true)).toPromise(),
        })
    )

    /**
     * Sends a batched LSP request to the Sourcegraph LSP gateway API and returns the result. The request is
     * performed with the privileges of the current user.
     */
    subscription.add(
        commandRegistry.registerCommand({
            command: 'queryLSP',
            run: requests => from(context.queryLSP(requests)).toPromise(),
        })
    )

    return subscription
}

/**
 * Constructs the URL that will result in the panel being opened to the specified view. Other parameters in the URL
 * hash are preserved.
 *
 * @param viewID The ID of the view to open in the panel.
 * @param urlHash The current URL hash (beginning with '#' if non-empty).
 */
export function urlForOpenPanel(viewID: string, urlHash: string): string {
    // Preserve the existing URL fragment, if any.
    const params = new URLSearchParams(urlHash.slice('#'.length))
    params.set('tab', viewID)
    // In the URL fragment, the 'L1:2-3:4' is treated as a parameter with no value. Undo the escaping of ':'
    // and the addition of the '=' for the empty value, for aesthetic reasons.
    const paramsString = params
        .toString()
        .replace(/%3A/g, ':')
        .replace(/=&/g, '&')
    return `#${paramsString}`
}

/**
 * Converts the arguments for the `updateConfiguration` client command (as documented in
 * {@link ActionContributionClientCommandUpdateConfiguration#commandArguments})
 * to {@link SettingsUpdate}.
 */
export function convertUpdateConfigurationCommandArgs(
    args: ActionContributionClientCommandUpdateConfiguration['commandArguments']
): SettingsEdit {
    if (!isArray(args) || !(args.length >= 2 && args.length <= 4)) {
        throw new Error(
            `invalid updateConfiguration arguments: ${JSON.stringify(
                args
            )} (must be an array with either 2 or 4 elements)`
        )
    }

    let keyPath: KeyPath
    if (isArray(args[0])) {
        keyPath = args[0]
    } else if (typeof args[0] === 'string') {
        // For convenience, allow the 1st arg (the key path) to be a string, and interpret this as referring to the
        // object property.
        keyPath = [args[0]]
    } else {
        throw new Error(
            `invalid updateConfiguration arguments: ${JSON.stringify(
                args
            )} (1st element, the key path, must be a string (referring to a settings property) or an array of type (string|number)[] (referring to a deeply nested settings property))`
        )
    }

    if (!(args[2] === undefined || args[2] === null)) {
        throw new Error(`invalid updateConfiguration arguments: ${JSON.stringify(args)} (3rd element must be null)`)
    }

    const valueIsJSONEncoded = args.length === 4 && args[3] === 'json'
    return { path: keyPath, value: valueIsJSONEncoded ? JSON.parse(args[1]) : args[1] }
}
